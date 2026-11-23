"""Config and options flow for the Simple Timer Card companion."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers import selector

try:
    import probatio as vol
except ImportError:  # pragma: no cover - Home Assistant before probatio
    import voluptuous as vol  # type: ignore[no-redef]

from .const import (
    CONF_CAPTURE_VOICE,
    CONF_LATE_MINUTES,
    DEFAULT_CAPTURE_VOICE,
    DEFAULT_LATE_MINUTES,
    DOMAIN,
)


def _options_schema(options: dict[str, Any]) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(
                CONF_CAPTURE_VOICE, default=options.get(CONF_CAPTURE_VOICE, DEFAULT_CAPTURE_VOICE)
            ): selector.BooleanSelector(),
            vol.Required(
                CONF_LATE_MINUTES, default=options.get(CONF_LATE_MINUTES, DEFAULT_LATE_MINUTES)
            ): selector.NumberSelector(
                selector.NumberSelectorConfig(min=0, max=1440, step=1, unit_of_measurement="min", mode=selector.NumberSelectorMode.BOX)
            ),
        }
    )


class SimpleTimerCardConfigFlow(ConfigFlow, domain=DOMAIN):
    """Set up the companion."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Create the single timer list."""
        if user_input is not None:
            return self.async_create_entry(
                title="Simple Timer Card",
                data={},
                options={
                    CONF_CAPTURE_VOICE: user_input[CONF_CAPTURE_VOICE],
                    CONF_LATE_MINUTES: int(user_input[CONF_LATE_MINUTES]),
                },
            )
        return self.async_show_form(step_id="user", data_schema=_options_schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        """Return the options flow."""
        return SimpleTimerCardOptionsFlow()


class SimpleTimerCardOptionsFlow(OptionsFlow):
    """Change how delayed commands and late actions are handled."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Show the options."""
        if user_input is not None:
            return self.async_create_entry(
                data={
                    CONF_CAPTURE_VOICE: user_input[CONF_CAPTURE_VOICE],
                    CONF_LATE_MINUTES: int(user_input[CONF_LATE_MINUTES]),
                }
            )
        return self.async_show_form(step_id="init", data_schema=_options_schema(dict(self.config_entry.options)))
