"""Server-side timer list for the Simple Timer Card companion integration."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import logging
from typing import Any

from homeassistant.core import CALLBACK_TYPE, Context, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers.event import async_track_point_in_utc_time
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util, ulid as ulid_util

from .const import (
    DOMAIN,
    EVENT_TIMER,
    MAX_ARCHIVED_TIMERS,
    STORAGE_VERSION,
    TimerEventType,
    TimerStatus,
)

_LOGGER = logging.getLogger(__name__)

TimerListener = Callable[[TimerEventType, "TimerItem", "float | None"], None]


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _parse(value: Any) -> datetime | None:
    if not value:
        return None
    parsed = dt_util.parse_datetime(str(value))
    return dt_util.as_utc(parsed) if parsed else None


@dataclass
class TimerItem:
    """One countdown timer, optionally running an action when it finishes."""

    timer_id: str
    name: str | None
    status: TimerStatus
    created_duration: timedelta
    total_duration: timedelta
    created_at: datetime
    finishes_at: datetime | None = None
    paused_remaining: timedelta | None = None
    ended_at: datetime | None = None
    action: dict[str, Any] | None = None
    action_result: str | None = None
    source: str = "service"
    icon: str | None = None
    color: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    user_id: str | None = None

    def remaining_at(self, now: datetime) -> timedelta:
        """Return the time left at the given moment."""
        if self.status == TimerStatus.PAUSED:
            return self.paused_remaining or timedelta(0)
        if self.status == TimerStatus.ACTIVE and self.finishes_at:
            return max(timedelta(0), self.finishes_at - now)
        return timedelta(0)

    def as_dict(self, now: datetime) -> dict[str, Any]:
        """Serialize like a Home Assistant timer list item, plus the extras."""
        return {
            "timer_id": self.timer_id,
            "name": self.name,
            "status": self.status.value,
            "created_duration": self.created_duration.total_seconds(),
            "total_duration": self.total_duration.total_seconds(),
            "created_at": _iso(self.created_at),
            "finishes_at": _iso(self.finishes_at) if self.status == TimerStatus.ACTIVE else None,
            "paused_remaining": (
                self.paused_remaining.total_seconds() if self.paused_remaining is not None else None
            ),
            "ended_at": _iso(self.ended_at),
            "remaining": self.remaining_at(now).total_seconds(),
            "action": self.action,
            "action_result": self.action_result,
            "source": self.source,
            "icon": self.icon,
            "color": self.color,
            "metadata": self.metadata,
        }

    def as_storage(self) -> dict[str, Any]:
        """Serialize for persistence."""
        return {
            "timer_id": self.timer_id,
            "name": self.name,
            "status": self.status.value,
            "created_duration": self.created_duration.total_seconds(),
            "total_duration": self.total_duration.total_seconds(),
            "created_at": _iso(self.created_at),
            "finishes_at": _iso(self.finishes_at),
            "paused_remaining": (
                self.paused_remaining.total_seconds() if self.paused_remaining is not None else None
            ),
            "ended_at": _iso(self.ended_at),
            "action": self.action,
            "action_result": self.action_result,
            "source": self.source,
            "icon": self.icon,
            "color": self.color,
            "metadata": self.metadata,
            "user_id": self.user_id,
        }

    @classmethod
    def from_storage(cls, data: dict[str, Any]) -> TimerItem:
        """Restore a persisted timer."""
        paused = data.get("paused_remaining")
        return cls(
            timer_id=str(data["timer_id"]),
            name=data.get("name"),
            status=TimerStatus(data["status"]),
            created_duration=timedelta(seconds=float(data["created_duration"])),
            total_duration=timedelta(seconds=float(data["total_duration"])),
            created_at=_parse(data.get("created_at")) or dt_util.utcnow(),
            finishes_at=_parse(data.get("finishes_at")),
            paused_remaining=timedelta(seconds=float(paused)) if paused is not None else None,
            ended_at=_parse(data.get("ended_at")),
            action=data.get("action"),
            action_result=data.get("action_result"),
            source=data.get("source") or "service",
            icon=data.get("icon"),
            color=data.get("color"),
            metadata=data.get("metadata") or {},
            user_id=data.get("user_id"),
        )


ActionRunner = Callable[[HomeAssistant, TimerItem], Any]


class TimerList:
    """Timers kept in Home Assistant and persisted across restarts."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry_id: str,
        *,
        late_window: timedelta,
        action_runner: ActionRunner,
    ) -> None:
        """Initialize the list."""
        self.hass = hass
        self.entry_id = entry_id
        self.entity_id: str | None = None
        self.late_window = late_window
        self._action_runner = action_runner
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry_id}")
        self.timers: dict[str, TimerItem] = {}
        self._scheduled: dict[str, CALLBACK_TYPE] = {}
        self._listeners: list[TimerListener] = []
        self._pending_actions: list[TimerItem] = []

    # --- lifecycle -------------------------------------------------------

    async def async_load(self) -> None:
        """Restore timers, finishing those whose time passed while stopped."""
        data = await self._store.async_load() or {}
        now = dt_util.utcnow()
        for raw in data.get("timers", []):
            try:
                timer = TimerItem.from_storage(raw)
            except (KeyError, TypeError, ValueError):
                _LOGGER.warning("Skipping an unreadable stored timer: %s", raw)
                continue
            self.timers[timer.timer_id] = timer
        for timer in list(self.timers.values()):
            if timer.status != TimerStatus.ACTIVE or not timer.finishes_at:
                continue
            if timer.finishes_at > now:
                self._schedule(timer)
                continue
            late = now - timer.finishes_at
            run = late <= self.late_window
            if not run and timer.action:
                timer.action_result = "skipped: finished while Home Assistant was stopped"
            self._finish(timer, run_action=False, ended_at=timer.finishes_at)
            if run and timer.action:
                self._pending_actions.append(timer)

    @callback
    def async_run_pending_actions(self) -> None:
        """Run actions of timers that finished while Home Assistant was stopped."""
        pending, self._pending_actions = self._pending_actions, []
        for timer in pending:
            self.hass.async_create_background_task(self._async_run_action(timer), f"{DOMAIN} late timer action {timer.timer_id}")

    @callback
    def async_shutdown(self) -> None:
        """Cancel scheduled callbacks."""
        for unsub in self._scheduled.values():
            unsub()
        self._scheduled.clear()

    @callback
    def async_subscribe(self, listener: TimerListener) -> CALLBACK_TYPE:
        """Subscribe to timer changes."""
        self._listeners.append(listener)

        @callback
        def unsubscribe() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return unsubscribe

    @property
    def active_count(self) -> int:
        """Number of running timers."""
        return sum(t.status == TimerStatus.ACTIVE for t in self.timers.values())

    @property
    def paused_count(self) -> int:
        """Number of paused timers."""
        return sum(t.status == TimerStatus.PAUSED for t in self.timers.values())

    @property
    def next_finish(self) -> datetime | None:
        """When the next running timer finishes."""
        times = [t.finishes_at for t in self.timers.values() if t.status == TimerStatus.ACTIVE and t.finishes_at]
        return min(times) if times else None

    def sorted_timers(self) -> list[TimerItem]:
        """Timers in creation order."""
        return sorted(self.timers.values(), key=lambda t: t.created_at)

    # --- actions ---------------------------------------------------------

    async def async_create(
        self,
        *,
        duration: timedelta,
        name: str | None = None,
        action: dict[str, Any] | None = None,
        icon: str | None = None,
        color: str | None = None,
        metadata: dict[str, Any] | None = None,
        source: str = "service",
        context: Context | None = None,
    ) -> TimerItem:
        """Create and start a timer."""
        if duration.total_seconds() <= 0:
            raise ServiceValidationError("The duration must be positive", translation_domain=DOMAIN, translation_key="invalid_duration")
        now = dt_util.utcnow()
        timer = TimerItem(
            timer_id=ulid_util.ulid_now(),
            name=(name or "").strip() or None,
            status=TimerStatus.ACTIVE,
            created_duration=duration,
            total_duration=duration,
            created_at=now,
            finishes_at=now + duration,
            action=action,
            source=source,
            icon=icon,
            color=color,
            metadata=dict(metadata or {}),
            user_id=context.user_id if context else None,
        )
        self.timers[timer.timer_id] = timer
        self._schedule(timer)
        self._notify(TimerEventType.CREATED, timer)
        return timer

    def _get(self, timer_id: str) -> TimerItem:
        if (timer := self.timers.get(timer_id)) is None:
            raise ServiceValidationError(
                f"Timer not found: {timer_id}",
                translation_domain=DOMAIN,
                translation_key="timer_not_found",
                translation_placeholders={"timer_id": timer_id},
            )
        return timer

    async def async_pause(self, timer_id: str) -> None:
        """Pause a running timer."""
        timer = self._get(timer_id)
        if timer.status != TimerStatus.ACTIVE:
            return
        timer.paused_remaining = timer.remaining_at(dt_util.utcnow())
        timer.finishes_at = None
        timer.status = TimerStatus.PAUSED
        self._unschedule(timer_id)
        self._notify(TimerEventType.PAUSED, timer)

    async def async_unpause(self, timer_id: str) -> None:
        """Resume a paused timer."""
        timer = self._get(timer_id)
        if timer.status != TimerStatus.PAUSED:
            return
        timer.finishes_at = dt_util.utcnow() + (timer.paused_remaining or timedelta(0))
        timer.paused_remaining = None
        timer.status = TimerStatus.ACTIVE
        self._schedule(timer)
        self._notify(TimerEventType.UNPAUSED, timer)

    async def async_cancel(self, timer_id: str) -> None:
        """Cancel a timer without running its action."""
        timer = self._get(timer_id)
        if timer.status not in (TimerStatus.ACTIVE, TimerStatus.PAUSED):
            return
        self._unschedule(timer_id)
        timer.status = TimerStatus.CANCELLED
        timer.ended_at = dt_util.utcnow()
        timer.finishes_at = None
        timer.paused_remaining = None
        self._notify(TimerEventType.CANCELLED, timer)
        self._prune_archive()

    async def async_finish(self, timer_id: str) -> None:
        """Finish a timer now, running its action."""
        timer = self._get(timer_id)
        if timer.status not in (TimerStatus.ACTIVE, TimerStatus.PAUSED):
            return
        self._finish(timer, run_action=True)

    async def async_add_time(self, timer_id: str, delta: timedelta) -> None:
        """Add (or with a negative delta, subtract) time."""
        timer = self._get(timer_id)
        if timer.status not in (TimerStatus.ACTIVE, TimerStatus.PAUSED) or not delta:
            return
        now = dt_util.utcnow()
        remaining = timer.remaining_at(now) + delta
        if remaining.total_seconds() <= 0:
            self._finish(timer, run_action=True)
            return
        if timer.status == TimerStatus.ACTIVE:
            timer.finishes_at = now + remaining
            self._schedule(timer)
        else:
            timer.paused_remaining = remaining
        timer.total_duration = max(timer.total_duration, remaining)
        self._notify(TimerEventType.TIME_CHANGED, timer, delta.total_seconds())

    async def async_restart(self, timer_id: str, duration: timedelta | None = None) -> None:
        """Run a timer again, keeping its name and action (used for snooze)."""
        timer = self._get(timer_id)
        length = duration or timer.created_duration
        if length.total_seconds() <= 0:
            raise ServiceValidationError("The duration must be positive", translation_domain=DOMAIN, translation_key="invalid_duration")
        now = dt_util.utcnow()
        timer.status = TimerStatus.ACTIVE
        timer.finishes_at = now + length
        timer.paused_remaining = None
        timer.ended_at = None
        timer.action_result = None
        timer.total_duration = length
        self._schedule(timer)
        self._notify(TimerEventType.RESTARTED, timer)

    async def async_remove(self, timer_id: str) -> None:
        """Remove a timer regardless of its status."""
        timer = self._get(timer_id)
        self._unschedule(timer_id)
        self.timers.pop(timer_id, None)
        self._notify(TimerEventType.REMOVED, timer)

    # --- internals -------------------------------------------------------

    def _schedule(self, timer: TimerItem) -> None:
        self._unschedule(timer.timer_id)
        if timer.finishes_at is None:
            return

        @callback
        def _elapsed(_now: datetime) -> None:
            self._scheduled.pop(timer.timer_id, None)
            current = self.timers.get(timer.timer_id)
            if current is not None and current.status == TimerStatus.ACTIVE:
                self._finish(current, run_action=True)

        self._scheduled[timer.timer_id] = async_track_point_in_utc_time(self.hass, _elapsed, timer.finishes_at)

    def _unschedule(self, timer_id: str) -> None:
        if (unsub := self._scheduled.pop(timer_id, None)) is not None:
            unsub()

    @callback
    def _finish(self, timer: TimerItem, *, run_action: bool, ended_at: datetime | None = None) -> None:
        self._unschedule(timer.timer_id)
        timer.status = TimerStatus.FINISHED
        timer.ended_at = ended_at or dt_util.utcnow()
        timer.finishes_at = None
        timer.paused_remaining = None
        self._notify(TimerEventType.FINISHED, timer)
        if run_action and timer.action:
            self.hass.async_create_background_task(self._async_run_action(timer), f"{DOMAIN} timer action {timer.timer_id}")
        self._prune_archive()

    async def _async_run_action(self, timer: TimerItem) -> None:
        try:
            result = await self._action_runner(self.hass, timer)
        except (HomeAssistantError, ValueError) as err:
            result = f"error: {err}"
            _LOGGER.warning("Timer %s action failed: %s", timer.name or timer.timer_id, err)
        except Exception as err:  # noqa: BLE001 - report any failure on the timer
            result = f"error: {err}"
            _LOGGER.exception("Timer %s action failed", timer.name or timer.timer_id)
        timer.action_result = result or "ok"
        if timer.timer_id in self.timers:
            self._notify(TimerEventType.ACTION_RAN, timer)

    def _prune_archive(self) -> None:
        archived = [t for t in self.timers.values() if t.status in (TimerStatus.FINISHED, TimerStatus.CANCELLED)]
        if len(archived) <= MAX_ARCHIVED_TIMERS:
            return
        archived.sort(key=lambda t: t.ended_at or t.created_at)
        for timer in archived[: len(archived) - MAX_ARCHIVED_TIMERS]:
            self.timers.pop(timer.timer_id, None)
            self._notify(TimerEventType.REMOVED, timer)

    @callback
    def _notify(self, event_type: TimerEventType, timer: TimerItem, delta: float | None = None) -> None:
        self._store.async_delay_save(self._data_to_save, 1)
        for listener in list(self._listeners):
            try:
                listener(event_type, timer, delta)
            except Exception:  # noqa: BLE001 - one bad listener must not break others
                _LOGGER.exception("Timer listener failed")
        if event_type != TimerEventType.ACTION_RAN or timer.action_result:
            data: dict[str, Any] = {
                "event": event_type.value,
                "entity_id": self.entity_id,
                "timer": timer.as_dict(dt_util.utcnow()),
            }
            if delta is not None:
                data["delta"] = delta
            self.hass.bus.async_fire(EVENT_TIMER, data)

    @callback
    def _data_to_save(self) -> dict[str, Any]:
        return {"timers": [t.as_storage() for t in self.sorted_timers()]}
