"""Websocket commands: the same contract as Home Assistant timer lists."""

from __future__ import annotations

from typing import Any

from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import Unauthorized
from homeassistant.util import dt as dt_util

try:
    import probatio as vol
except ImportError:  # pragma: no cover - Home Assistant before probatio
    import voluptuous as vol  # type: ignore[no-redef]

from .const import DOMAIN, WS_LIST, WS_SUBSCRIBE, TimerEventType
from .timers import TimerItem, TimerList


def _find_list(hass: HomeAssistant, entity_id: str) -> TimerList | None:
    for timer_list in hass.data.get(DOMAIN, {}).values():
        if isinstance(timer_list, TimerList) and timer_list.entity_id == entity_id:
            return timer_list
    return None


@callback
def async_setup(hass: HomeAssistant) -> None:
    """Register the websocket commands once."""
    websocket_api.async_register_command(hass, websocket_subscribe)
    websocket_api.async_register_command(hass, websocket_list)


@websocket_api.websocket_command({vol.Required("type"): WS_SUBSCRIBE, vol.Required("entity_id"): str})
@websocket_api.async_response
async def websocket_subscribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Send a snapshot, then every change."""
    entity_id: str = msg["entity_id"]
    if not connection.user.permissions.check_entity(entity_id, POLICY_READ):
        raise Unauthorized(entity_id=entity_id)
    timer_list = _find_list(hass, entity_id)
    if timer_list is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, f"Timer list not found: {entity_id}")
        return

    @callback
    def forward(event_type: TimerEventType, timer: TimerItem, delta: float | None) -> None:
        message: dict[str, Any] = {
            "type": "change",
            "event_type": event_type.value,
            "timer": timer.as_dict(dt_util.utcnow()),
        }
        if delta is not None:
            message["delta"] = delta
        connection.send_message(websocket_api.event_message(msg["id"], message))

    connection.subscriptions[msg["id"]] = timer_list.async_subscribe(forward)
    connection.send_result(msg["id"])
    now = dt_util.utcnow()
    connection.send_message(
        websocket_api.event_message(
            msg["id"], {"type": "timers", "timers": [t.as_dict(now) for t in timer_list.sorted_timers()]}
        )
    )


@websocket_api.websocket_command({vol.Required("type"): WS_LIST, vol.Required("entity_id"): str})
@websocket_api.async_response
async def websocket_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return the current timers."""
    entity_id: str = msg["entity_id"]
    if not connection.user.permissions.check_entity(entity_id, POLICY_READ):
        raise Unauthorized(entity_id=entity_id)
    timer_list = _find_list(hass, entity_id)
    if timer_list is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, f"Timer list not found: {entity_id}")
        return
    now = dt_util.utcnow()
    connection.send_result(msg["id"], {"timers": [t.as_dict(now) for t in timer_list.sorted_timers()]})
