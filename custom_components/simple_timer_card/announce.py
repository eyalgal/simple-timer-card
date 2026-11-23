"""Announce a message on any speaker when a timer ends.

The speaker decides how: voice satellites announce natively, Alexa Media
Player speakers through notify.alexa_media, and other media players through
text-to-speech with the preferred Assist pipeline's voice. The engine is
picked when the timer ends, so a later pipeline change is honoured.
"""

from __future__ import annotations

import logging
from typing import Any

try:
    import probatio as vol
except ImportError:  # pragma: no cover - Home Assistant before probatio
    import voluptuous as vol  # type: ignore[no-redef]

from homeassistant.core import Context, HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv, entity_registry as er

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

SERVICE_ANNOUNCE = "announce"
CLOUD_TTS = "tts.home_assistant_cloud"

ANNOUNCE_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("message"): cv.string,
    }
)


def _cloud_active(hass: HomeAssistant) -> bool:
    try:
        from homeassistant.components.cloud import async_active_subscription
    except ImportError:
        return False
    try:
        return bool(async_active_subscription(hass))
    except Exception:  # noqa: BLE001 - cloud not set up
        return False


def _usable_engine(hass: HomeAssistant, engine: str | None) -> bool:
    if not engine or not engine.startswith("tts.") or hass.states.get(engine) is None:
        return False
    entry = er.async_get(hass).async_get(engine)
    if engine == CLOUD_TTS or (entry is not None and entry.platform == "cloud"):
        return _cloud_active(hass)
    return True


def tts_choice(hass: HomeAssistant) -> tuple[str | None, dict[str, Any]]:
    """The preferred pipeline's voice, else any usable TTS entity."""
    try:
        from homeassistant.components import assist_pipeline

        pipeline = assist_pipeline.async_get_pipeline(hass)
    except Exception:  # noqa: BLE001 - assist_pipeline not loaded
        pipeline = None
    if pipeline is not None and _usable_engine(hass, pipeline.tts_engine):
        extra: dict[str, Any] = {}
        if pipeline.tts_language:
            extra["language"] = pipeline.tts_language
        if pipeline.tts_voice:
            extra["options"] = {"voice": pipeline.tts_voice}
        return pipeline.tts_engine, extra
    engines = sorted(hass.states.async_entity_ids("tts"))
    # Local engines first: they need no account and no internet.
    engines.sort(key=lambda engine: engine == CLOUD_TTS)
    for engine in engines:
        if _usable_engine(hass, engine):
            return engine, {}
    return None, {}


async def async_announce(
    hass: HomeAssistant, entity_id: str, message: str, context: Context | None = None
) -> None:
    """Say a message on a speaker."""
    domain = entity_id.split(".", 1)[0]
    if domain == "assist_satellite":
        await hass.services.async_call(
            "assist_satellite", "announce", {"message": message},
            target={"entity_id": entity_id}, blocking=True, context=context,
        )
        return
    entry = er.async_get(hass).async_get(entity_id)
    if entry is not None and entry.platform == "alexa_media" and hass.services.has_service("notify", "alexa_media"):
        await hass.services.async_call(
            "notify", "alexa_media",
            {"message": message, "target": [entity_id], "data": {"type": "announce"}},
            blocking=True, context=context,
        )
        return
    engine, extra = tts_choice(hass)
    if engine is None:
        raise HomeAssistantError(
            translation_domain=DOMAIN, translation_key="no_tts", translation_placeholders={"entity_id": entity_id}
        )
    _LOGGER.debug("Announcing on %s with %s %s", entity_id, engine, extra)
    await hass.services.async_call(
        "tts", "speak", {"media_player_entity_id": entity_id, "message": message, "cache": True, **extra},
        target={"entity_id": engine}, blocking=True, context=context,
    )


def async_setup(hass: HomeAssistant) -> None:
    """Register the announce service."""

    async def _handle(call: ServiceCall) -> None:
        await async_announce(hass, call.data["entity_id"], call.data["message"], call.context)

    hass.services.async_register(DOMAIN, SERVICE_ANNOUNCE, _handle, schema=ANNOUNCE_SCHEMA)
