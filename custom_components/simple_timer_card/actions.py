"""Actions a timer runs when it finishes."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import Context, HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv, intent
from homeassistant.helpers.script import Script, async_validate_actions_config

from .const import DOMAIN
from .timers import TimerItem

_LOGGER = logging.getLogger(__name__)


async def async_command_is_understood(
    hass: HomeAssistant,
    command: str,
    *,
    language: str | None,
    context: Context | None,
    agent_id: str | None = None,
    device_id: str | None = None,
) -> bool:
    """Return whether the built-in assistant recognizes a command.

    Mirrors how Home Assistant validates delayed voice commands. Other
    conversation agents (for example LLM agents) are not checked.
    """
    from homeassistant.components.conversation import (  # noqa: PLC0415
        ConversationInput,
        async_get_agent,
        default_agent,
    )

    agent = async_get_agent(hass, agent_id)
    if agent is None or not isinstance(agent, default_agent.DefaultAgent):
        return True
    test_input = ConversationInput(
        text=command,
        context=context or Context(),
        conversation_id=None,
        device_id=device_id,
        satellite_id=None,
        language=language or hass.config.language,
        agent_id=agent.entity_id,
    )
    if await agent.async_recognize_sentence_trigger(test_input) is not None:
        return True
    return await agent.async_recognize_intent(test_input) is not None


async def async_build_action(
    hass: HomeAssistant,
    *,
    command: str | None,
    actions: list[dict[str, Any]] | None,
    language: str | None,
    context: Context | None,
    agent_id: str | None = None,
    device_id: str | None = None,
    validate_command: bool = True,
) -> dict[str, Any] | None:
    """Validate and normalize the action stored on a timer."""
    command = (command or "").strip()
    if command and actions:
        raise ServiceValidationError(
            "Use either a command or actions, not both",
            translation_domain=DOMAIN,
            translation_key="command_and_actions",
        )
    if command:
        if validate_command and not await async_command_is_understood(
            hass, command, language=language, context=context, agent_id=agent_id, device_id=device_id
        ):
            raise ServiceValidationError(
                f"Home Assistant did not understand: {command}",
                translation_domain=DOMAIN,
                translation_key="command_not_understood",
                translation_placeholders={"command": command},
            )
        action: dict[str, Any] = {"type": "command", "command": command, "language": language or hass.config.language}
        if agent_id:
            action["agent_id"] = agent_id
        if device_id:
            action["device_id"] = device_id
        return action
    if actions:
        validated = await async_validate_actions_config(hass, cv.SCRIPT_SCHEMA(actions))
        return {"type": "actions", "actions": validated}
    return None


async def async_run_action(hass: HomeAssistant, timer: TimerItem) -> str:
    """Run a finished timer's action as the user who created it."""
    action = timer.action or {}
    context = Context(user_id=timer.user_id)
    if action.get("type") == "command":
        from homeassistant.components.conversation import async_converse  # noqa: PLC0415

        result = await async_converse(
            hass,
            action["command"],
            conversation_id=None,
            context=context,
            language=action.get("language"),
            agent_id=action.get("agent_id"),
            device_id=action.get("device_id"),
        )
        response = result.response
        if response.response_type is intent.IntentResponseType.ERROR:
            speech = response.speech.get("plain", {}).get("speech", "")
            _LOGGER.warning("Timer command failed: %s (%s)", action["command"], speech)
            return f"error: {speech or response.error_code}"
        return "ok"
    if action.get("type") == "actions":
        script = Script(hass, action["actions"], f"Timer {timer.name or timer.timer_id}", DOMAIN)
        await script.async_run(context=context)
        return "ok"
    return "error: unknown action"
