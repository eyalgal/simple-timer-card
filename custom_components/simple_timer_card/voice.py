"""Capture Home Assistant's delayed voice commands as visible timers.

"Turn off the lights in 10 minutes" is handled by the HassStartTimer intent
with a conversation_command slot. Core keeps such timers in memory, where no
dashboard can see or cancel them. When enabled, this wraps that intent
handler: requests carrying a command become timers in this integration (which
run the same command when they finish), everything else goes to the original
handler unchanged. Responses are unchanged too, so the assistant answers in
the user's language exactly as before.
"""

from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import intent

from .actions import async_build_action
from .timers import TimerList

_LOGGER = logging.getLogger(__name__)

try:
    from homeassistant.components.intent.timers import (
        NoTimerCommandError,
        StartTimerIntentHandler,
    )
except ImportError:  # pragma: no cover - core layout changed
    StartTimerIntentHandler = None  # type: ignore[assignment,misc]
    NoTimerCommandError = None  # type: ignore[assignment,misc]


def _find_handler(hass: HomeAssistant, intent_type: str) -> intent.IntentHandler | None:
    return next((h for h in intent.async_get(hass) if h.intent_type == intent_type), None)


if StartTimerIntentHandler is not None:

    class CapturingStartTimerIntentHandler(StartTimerIntentHandler):  # type: ignore[misc,valid-type]
        """HassStartTimer that keeps delayed commands in a TimerList."""

        def __init__(self, timer_list: TimerList, original: intent.IntentHandler) -> None:
            """Initialize, keeping the original handler for everything else."""
            super().__init__()
            self._timer_list = timer_list
            self.original = original
            # Keep the original metadata so LLM tools see the same intent.
            for attr in ("description", "slot_schema", "platforms"):
                if hasattr(original, attr):
                    setattr(self, attr, getattr(original, attr))

        async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
            """Capture delayed commands, delegate the rest."""
            raw = intent_obj.slots.get("conversation_command") or {}
            command = str(raw.get("value") or "").strip()
            if not command:
                return await self.original.async_handle(intent_obj)

            slots = self.async_validate_slots(intent_obj.slots)
            if not await self._validate_conversation_command(intent_obj, command):
                raise NoTimerCommandError(command)

            def _int(key: str) -> int:
                return int(slots[key]["value"]) if key in slots else 0

            seconds = _int("hours") * 3600 + _int("minutes") * 60 + _int("seconds")
            name = slots["name"]["value"] if "name" in slots else None
            action: dict[str, Any] | None = await async_build_action(
                intent_obj.hass,
                command=command,
                actions=None,
                language=intent_obj.language,
                context=intent_obj.context,
                agent_id=intent_obj.conversation_agent_id,
                device_id=intent_obj.device_id,
                validate_command=False,
            )
            await self._timer_list.async_create(
                duration=timedelta(seconds=seconds),
                name=name,
                action=action,
                source="voice",
                context=intent_obj.context,
            )
            return intent_obj.create_response()


@callback
def async_install(hass: HomeAssistant, timer_list: TimerList) -> bool:
    """Wrap HassStartTimer. Returns False if this core version is unsupported."""
    if StartTimerIntentHandler is None:
        _LOGGER.warning("Delayed voice commands cannot be captured on this Home Assistant version")
        return False
    current = _find_handler(hass, intent.INTENT_START_TIMER)
    if current is None:
        _LOGGER.warning("HassStartTimer is not registered; delayed voice commands are not captured")
        return False
    if isinstance(current, CapturingStartTimerIntentHandler):
        return True
    if not isinstance(current, StartTimerIntentHandler):
        _LOGGER.warning("HassStartTimer is handled by %s; not capturing delayed voice commands", current)
        return False
    try:
        wrapper = CapturingStartTimerIntentHandler(timer_list, current)
    except TypeError:
        _LOGGER.warning("This Home Assistant version's timer handler cannot be wrapped")
        return False
    intent.async_remove(hass, intent.INTENT_START_TIMER)
    intent.async_register(hass, wrapper)
    return True


@callback
def async_uninstall(hass: HomeAssistant) -> None:
    """Restore the original HassStartTimer handler."""
    if StartTimerIntentHandler is None:
        return
    current = _find_handler(hass, intent.INTENT_START_TIMER)
    if isinstance(current, CapturingStartTimerIntentHandler):
        intent.async_remove(hass, intent.INTENT_START_TIMER)
        intent.async_register(hass, current.original)
