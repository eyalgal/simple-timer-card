"""The timer list entity and its actions."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse, callback
from homeassistant.helpers import config_validation as cv, entity_platform
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.util import dt as dt_util

try:
    import probatio as vol
except ImportError:  # pragma: no cover - Home Assistant before probatio
    import voluptuous as vol  # type: ignore[no-redef]

from .actions import async_build_action
from .const import (
    ALL_FEATURES,
    API_VERSION,
    ATTR_ACTIONS,
    ATTR_COLOR,
    ATTR_COMMAND,
    ATTR_DURATION,
    ATTR_ICON,
    ATTR_LANGUAGE,
    ATTR_METADATA,
    ATTR_NAME,
    ATTR_STATUS,
    ATTR_TIMER_ID,
    DOMAIN,
    TimerEventType,
    TimerStatus,
)
from .timers import TimerItem, TimerList

TIMER_ID_SCHEMA = {vol.Required(ATTR_TIMER_ID): cv.string}
DURATION_SCHEMA = {vol.Required(ATTR_TIMER_ID): cv.string, vol.Required(ATTR_DURATION): cv.positive_time_period}


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    """Set up the timer list entity and register its actions."""
    timer_list: TimerList = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([TimerListSensor(entry, timer_list)])

    platform = entity_platform.async_get_current_platform()
    platform.async_register_entity_service(
        "create_timer",
        {
            vol.Required(ATTR_DURATION): cv.positive_time_period,
            vol.Optional(ATTR_NAME): cv.string,
            vol.Optional(ATTR_COMMAND): cv.string,
            vol.Optional(ATTR_ACTIONS): cv.ensure_list,
            vol.Optional(ATTR_LANGUAGE): cv.string,
            vol.Optional(ATTR_ICON): cv.icon,
            vol.Optional(ATTR_COLOR): cv.string,
            vol.Optional(ATTR_METADATA): dict,
        },
        _async_create_timer,
        supports_response=SupportsResponse.OPTIONAL,
    )
    platform.async_register_entity_service("pause_timer", TIMER_ID_SCHEMA, _by_id("async_pause"))
    platform.async_register_entity_service("unpause_timer", TIMER_ID_SCHEMA, _by_id("async_unpause"))
    platform.async_register_entity_service("cancel_timer", TIMER_ID_SCHEMA, _by_id("async_cancel"))
    platform.async_register_entity_service("finish_timer", TIMER_ID_SCHEMA, _by_id("async_finish"))
    platform.async_register_entity_service("remove_timer", TIMER_ID_SCHEMA, _by_id("async_remove"))
    platform.async_register_entity_service("add_time", DURATION_SCHEMA, _async_add_time)
    platform.async_register_entity_service("subtract_time", DURATION_SCHEMA, _async_subtract_time)
    platform.async_register_entity_service(
        "restart_timer",
        {vol.Required(ATTR_TIMER_ID): cv.string, vol.Optional(ATTR_DURATION): cv.positive_time_period},
        _async_restart_timer,
    )
    platform.async_register_entity_service(
        "get_timers",
        {vol.Optional(ATTR_STATUS): vol.All(cv.ensure_list, [vol.In([s.value for s in TimerStatus])])},
        _async_get_timers,
        supports_response=SupportsResponse.ONLY,
    )


def _by_id(method: str):
    async def handler(entity: TimerListSensor, call: ServiceCall) -> None:
        await getattr(entity.timer_list, method)(call.data[ATTR_TIMER_ID])

    return handler


async def _async_create_timer(entity: TimerListSensor, call: ServiceCall) -> ServiceResponse:
    data = call.data
    action = await async_build_action(
        entity.hass,
        command=data.get(ATTR_COMMAND),
        actions=data.get(ATTR_ACTIONS),
        language=data.get(ATTR_LANGUAGE),
        context=call.context,
    )
    timer = await entity.timer_list.async_create(
        duration=data[ATTR_DURATION],
        name=data.get(ATTR_NAME),
        action=action,
        icon=data.get(ATTR_ICON),
        color=data.get(ATTR_COLOR),
        metadata=data.get(ATTR_METADATA),
        source="card" if (data.get(ATTR_METADATA) or {}).get("source") == "card" else "service",
        context=call.context,
    )
    return {ATTR_TIMER_ID: timer.timer_id}


async def _async_add_time(entity: TimerListSensor, call: ServiceCall) -> None:
    await entity.timer_list.async_add_time(call.data[ATTR_TIMER_ID], call.data[ATTR_DURATION])


async def _async_subtract_time(entity: TimerListSensor, call: ServiceCall) -> None:
    await entity.timer_list.async_add_time(call.data[ATTR_TIMER_ID], -call.data[ATTR_DURATION])


async def _async_restart_timer(entity: TimerListSensor, call: ServiceCall) -> None:
    await entity.timer_list.async_restart(call.data[ATTR_TIMER_ID], call.data.get(ATTR_DURATION))


async def _async_get_timers(entity: TimerListSensor, call: ServiceCall) -> ServiceResponse:
    statuses = call.data.get(ATTR_STATUS)
    now = dt_util.utcnow()
    return {
        "timers": [
            t.as_dict(now) for t in entity.timer_list.sorted_timers() if not statuses or t.status.value in statuses
        ]
    }


class TimerListSensor(SensorEntity):
    """Number of running timers; the timers come over the websocket."""

    _attr_has_entity_name = True
    _attr_translation_key = "timers"
    _attr_icon = "mdi:timer-outline"
    _attr_should_poll = False
    _attr_supported_features = int(ALL_FEATURES)
    _unrecorded_attributes = frozenset({"simple_timer_card_api", "next_finishes_at", "paused"})

    def __init__(self, entry: ConfigEntry, timer_list: TimerList) -> None:
        """Initialize the entity."""
        self.timer_list = timer_list
        self._attr_unique_id = f"{entry.entry_id}_timers"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            entry_type=DeviceEntryType.SERVICE,
            manufacturer="Simple Timer Card",
        )

    async def async_added_to_hass(self) -> None:
        """Track list changes."""
        self.timer_list.entity_id = self.entity_id
        self.async_on_remove(self.timer_list.async_subscribe(self._handle_change))

    @callback
    def _handle_change(self, _event: TimerEventType, _timer: TimerItem, _delta: float | None) -> None:
        self.async_write_ha_state()

    @property
    def native_value(self) -> int:
        """Return the number of running timers."""
        return self.timer_list.active_count

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Expose the API marker the card detects, plus a summary."""
        next_finish = self.timer_list.next_finish
        return {
            "simple_timer_card_api": API_VERSION,
            "next_finishes_at": next_finish.isoformat() if next_finish else None,
            "paused": self.timer_list.paused_count,
        }

