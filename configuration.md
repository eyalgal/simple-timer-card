# 🛠️ Simple Timer Card Configuration

This document contains the **full configuration reference** for Simple Timer Card.

If you are new, you can start with:

```yaml
type: custom:simple-timer-card
```

Most options are optional and defaults are automatically cleaned from YAML output.

---

## 🌍 Language Support

The card supports multiple UI languages:

* English (`en`)
* German (`de`)
* Spanish (`es`)
* Danish (`da`)

```yaml
language: de
```

Additional languages are welcome via contributions.

---

## Basic Options

| Name       | Type   | Default        | Description                                                   |
| ---------- | ------ | -------------- | ------------------------------------------------------------- |
| `type`     | string | required       | `custom:simple-timer-card`                                    |
| `title`    | string | null           | Optional card title                                           |
| `layout`   | string | horizontal     | Layout when no timers are active (`horizontal` or `vertical`) |
| `style`    | string | bar_horizontal | Active timer display style                                    |
| `language` | string | en             | UI language (`en`, `de`, `es`, `da`)                          |

---

## Timer Sources

Timers can come from many sources. You can mix and match freely.

Supported sources:

* Native Home Assistant timers (`timer.*`)
* Alexa timers via `alexa_media_player`
* Voice PE timers
* Helper entities (`input_text.*`, `text.*`)
* MQTT sensors
* Timestamp sensors
* Sensors with custom minute attributes

Timers are auto detected by default, or you can force a mode per entity.

---

## Entities

```yaml
entities:
  - entity: timer.kitchen
    name: Kitchen Timer
```

Each entity can be a string or an object.

| Name     | Type   | Default  | Description                                                   |
| -------- | ------ | -------- | ------------------------------------------------------------- |
| `entity` | string | required | Entity ID                                                     |
| `name`   | string | auto     | Override name                                                 |
| `mode`   | string | auto     | auto, timer, alexa, voice_pe, helper, timestamp, minutes_attr |
| `icon`   | string | auto     | Override icon                                                 |
| `color`  | string | auto     | Override color                                                |

---

## Presets & Custom Timers

### Timer Presets

```yaml
timer_presets: [5, 15, 30, 90s]
```

* Supports minutes or seconds (`30s`)
* One tap start

### Pinned Timers

Pinned timers are one‑tap reusable timers.

```yaml
pinned_timers:
  - id: tea
    name: Tea
    duration: 420
    icon: mdi:tea
```

Pinned timers hide while running and reappear once finished.

---

## Sorting & Layout

```yaml
sort_by: time_left   # or name
sort_order: asc      # or desc
pinned_timers_position: inline  # top, bottom
```

Defaults preserve v2.1.1 behavior.

---

## Progress Display

Available styles:

* bar_horizontal
* bar_vertical
* fill_horizontal
* fill_vertical
* circle

Progress modes:

* drain (default)
* fill
* milestones

```yaml
style: circle
progress_mode: drain
```

---

## Storage & Persistence

### Local

Default. Timers persist per browser.

### MQTT

```yaml
storage: mqtt
default_timer_entity: sensor.simple_timer_store
```

Allows timers to survive reloads and sync across devices.

The MQTT payload remains compatible with v2.1.1 by default.

---

## Voice PE Integration

Voice PE timers can be mirrored or fully controlled.

```yaml
auto_voice_pe: true
voice_pe_control_entity: text.voice_pe_timer_command
```

Full guides:

* voice-pe/voice-pe.md
* voice-pe/voice-pe-esphome.md

---

## Expiry & Audio

```yaml
audio_enabled: true
audio_file_url: /local/sounds/done.mp3
expire_action: keep
```

Supports:

* Per timer audio
* Snooze
* Auto dismiss

---

## Compatibility Mode

```yaml
compatibility_mode: 2.1.1
```

Default behavior preserves older MQTT and storage contracts.

Advanced users can opt into:

```yaml
compatibility_mode: latest
```

---

## Examples

See the `examples/` folder for:

* MQTT notifications
* Helper monitoring
* Mobile push notifications

---

## Need help?

Open an issue on GitHub or ask in the Home Assistant community forum.
