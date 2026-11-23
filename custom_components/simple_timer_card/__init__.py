"""Simple Timer Card companion: server-side timers that run actions.

Timers live in Home Assistant, survive restarts, and can run a voice-style
command or any Home Assistant action when they finish, with no dashboard open.
Optionally, Home Assistant's delayed voice commands ("turn off the lights in
10 minutes") are captured as timers so they can be seen and cancelled.
"""

from __future__ import annotations

from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.typing import ConfigType

from . import voice, websocket
from .actions import async_run_action
from .const import (
    CONF_CAPTURE_VOICE,
    CONF_LATE_MINUTES,
    DEFAULT_CAPTURE_VOICE,
    DEFAULT_LATE_MINUTES,
    DOMAIN,
)
from .timers import TimerList

PLATFORMS = [Platform.SENSOR]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the websocket API once."""
    hass.data.setdefault(DOMAIN, {})
    websocket.async_setup(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Load timers and start capturing voice commands if enabled."""
    late_minutes = entry.options.get(CONF_LATE_MINUTES, DEFAULT_LATE_MINUTES)
    timer_list = TimerList(
        hass,
        entry.entry_id,
        late_window=timedelta(minutes=late_minutes),
        action_runner=async_run_action,
    )
    await timer_list.async_load()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = timer_list
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    @callback
    def _started(_hass: HomeAssistant) -> None:
        timer_list.async_run_pending_actions()
        if entry.options.get(CONF_CAPTURE_VOICE, DEFAULT_CAPTURE_VOICE):
            voice.async_install(hass, timer_list)

    # Intents and conversation agents are ready once Home Assistant started.
    entry.async_on_unload(async_at_started(hass, _started))
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Restore the voice handler and stop scheduled timers."""
    voice.async_uninstall(hass)
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded and (timer_list := hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)):
        timer_list.async_shutdown()
    return unloaded
