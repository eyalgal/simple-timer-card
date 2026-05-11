# 🛠️ Simple Timer Card Configuration

This document is the **full configuration reference** for Simple Timer Card.

If you are new, the absolute minimum is:

```yaml
type: custom:simple-timer-card
```

That gives you a working card that auto-detects every supported timer in your Home Assistant instance. Everything else is optional.

> 💡 **Tip:** All of the options below are also available in the visual editor (click the card &rarr; *Edit card*). The editor groups them into the same sections used here.

---

## 📑 Table of contents

1. [Quick start](#-quick-start)
2. [Appearance](#-appearance)
3. [Timer entities](#-timer-entities)
4. [Sorting & ordering](#-sorting--ordering)
5. [Time format](#-time-format)
6. [Timer defaults & behavior](#-timer-defaults--behavior)
7. [Quick-start presets](#-quick-start-presets)
8. [Pinned timers](#-pinned-timers)
9. [Audio notifications](#-audio-notifications)
10. [Storage & persistence](#-storage--persistence)
11. [Voice PE integration](#-voice-pe-integration)
12. [Compatibility mode](#-compatibility-mode)
13. [Language support](#-language-support)
14. [Examples & help](#-examples--help)

---

## 🚀 Quick start

```yaml
type: custom:simple-timer-card
title: Kitchen
entities:
  - timer.kitchen
  - timer.oven
```

Most defaults are automatically stripped from the saved YAML, so the config stays minimal.

---

## 🎨 Appearance

Controls how the card looks and where the active-timers heading sits.

```yaml
type: custom:simple-timer-card
title: Kitchen
layout: horizontal
style: bar_horizontal
progress_mode: drain
language: en
show_active_header: true
```

| Name                 | Type    | Default          | Description                                                                                  |
| -------------------- | ------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `type`               | string  | **required**     | `custom:simple-timer-card`                                                                   |
| `title`              | string  | `null`           | Optional card title                                                                          |
| `layout`             | string  | `horizontal`     | Card layout when no timers are running: `horizontal` or `vertical`                           |
| `style`              | string  | `bar_horizontal` | Active timer style: `bar_horizontal`, `bar_vertical`, `fill_horizontal`, `fill_vertical`, `circle` |
| `progress_mode`      | string  | `drain`          | How the progress indicator fills: `drain`, `fill`, or `milestones` (bar styles only)         |
| `language`           | string  | auto             | UI language. Defaults to your Home Assistant language. See [Language support](#-language-support). |
| `show_active_header` | boolean | `true`           | Show the "Active Timers" heading above running timers                                        |

---

## ⏱️ Timer entities

The `entities:` list tells the card which timer sources to display. Each entry can be a plain entity ID or an object with overrides.

```yaml
entities:
  - timer.kitchen
  - entity: timer.oven
    name: Oven
    icon: mdi:stove
  - entity: sensor.next_alarm
    mode: timestamp
    start_time_attr: last_triggered
```

### Supported sources

Mix and match freely. Mode is auto-detected by default.

| Source                    | Domain / hint                                   |
| ------------------------- | ----------------------------------------------- |
| Native HA timer           | `timer.*`                                       |
| Alexa                     | `alexa_media_player` next-timer sensors         |
| Voice PE                  | Voice PE entities (see [Voice PE](#-voice-pe-integration)) |
| Helper                    | `input_text.*`, `text.*`                        |
| Timestamp sensor          | Any sensor whose state or attribute is an ISO timestamp |
| Minutes attribute sensor  | Any sensor exposing a "minutes remaining" attribute     |

### Per-entity options

| Name                           | Type    | Default      | Applies when           | Description                                                                  |
| ------------------------------ | ------- | ------------ | ---------------------- | ---------------------------------------------------------------------------- |
| `entity`                       | string  | **required** | Always                 | Entity ID                                                                    |
| `name`                         | string  | auto         | Always                 | Override the displayed name                                                  |
| `mode`                         | string  | `auto`       | Always                 | One of `auto`, `timer`, `alexa`, `voice_pe`, `helper`, `timestamp`, `minutes_attr` |
| `icon`                         | string  | auto         | Always                 | Override the icon                                                            |
| `color`                        | string  | auto         | Always                 | Override the color (any CSS color or HA theme variable)                      |
| `expired_subtitle`             | string  | inherited    | Always                 | Override the message shown when this timer expires                           |
| `minutes_attr`                 | string  | `Minutes to arrive` | `mode: minutes_attr` | Attribute name holding minutes remaining                            |
| `start_time_entity`            | string  | self         | `mode: timestamp`      | Use another entity for the start timestamp                                   |
| `start_time_attr`              | string  | `start_time` | `mode: timestamp`      | Attribute on the entity holding the start timestamp                          |
| `keep_timer_visible_when_idle` | boolean | `false`      | `mode: timer`          | Keep the row in view even when the timer is idle                             |
| `hide_timer_actions`           | boolean | `false`      | `mode: timer`          | Hide the start / pause / cancel buttons                                      |
| `audio_enabled`                | boolean | `false`      | Always                 | Enable an entity-specific expiry sound                                       |
| `audio_file_url`               | string  | `""`         | `audio_enabled: true`  | URL or path to the audio file                                                |
| `audio_repeat_count`           | number  | `1`          | `audio_enabled: true`  | How many times to play the audio                                             |

---

## 🔀 Sorting & ordering

Controls the order timers appear in.

```yaml
sort_by: time_left           # or name
sort_order: asc              # or desc
pinned_timers_position: inline
```

| Name                     | Type   | Default     | Description                                                              |
| ------------------------ | ------ | ----------- | ------------------------------------------------------------------------ |
| `sort_by`                | string | `time_left` | `time_left` or `name`                                                    |
| `sort_order`             | string | `asc`       | `asc` (ascending) or `desc` (descending)                                 |
| `pinned_timers_position` | string | `inline`    | Where pinned timers appear: `inline` (mixed with active), `top`, or `bottom` |

---

## 🕐 Time format

Controls how the time-remaining string is rendered.

```yaml
time_format: hms
time_format_units: [days, hours, minutes, seconds]
```

| Name                | Type    | Default                                | Description                                                                  |
| ------------------- | ------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `time_format`       | string  | `hms`                                  | One of `hms`, `hm`, `ss`, `dhms`, `human_compact`, `human_short`, `human_natural` |
| `time_format_units` | array   | `[days, hours, minutes, seconds]`      | Allowed units (in order). Used by `human_*` and `dhms` formats               |

### Format reference

| Value             | Example output (1h 23m 45s)     |
| ----------------- | ------------------------------- |
| `hms`             | `01:23:45`                      |
| `hm`              | `01:23`                         |
| `ss`              | `5025` (seconds only)           |
| `dhms`            | `00:01:23:45`                   |
| `human_compact`   | `1h23m45s`                      |
| `human_short`     | `1h 23m 45s`                    |
| `human_natural`   | `1 hour, 23 minutes, 45 seconds` |

### Milestones (only when `progress_mode: milestones`)

```yaml
progress_mode: milestones
milestone_unit: minutes
milestone_pulse: true
```

| Name              | Type    | Default | Description                                                                                  |
| ----------------- | ------- | ------- | -------------------------------------------------------------------------------------------- |
| `milestone_unit`  | string  | `auto`  | Granularity of milestone segments. One of `auto`, `none`, `years`, `months`, `weeks`, `days`, `hours`, `minutes`, `seconds` |
| `milestone_pulse` | boolean | `true`  | Pulse the currently-active milestone segment                                                 |

---

## ⚙️ Timer defaults & behavior

Defaults applied when no entity-level override is given, plus what happens when a timer expires.

```yaml
default_new_timer_duration_mins: 10
snooze_duration: 5
default_timer_icon: mdi:timer-outline
default_timer_color: var(--primary-color)
expired_subtitle: "Time's up!"
expire_action: keep
expire_keep_for: 120
auto_dismiss_writable: false
```

| Name                              | Type    | Default                | Description                                                                                  |
| --------------------------------- | ------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `default_new_timer_duration_mins` | number  | `15`                   | Starting value (in minutes) for the **Custom timer** duration input. Set `0` to start empty. |
| `snooze_duration`                 | number  | `5`                    | Minutes added when the user taps **Snooze** on an expired timer                              |
| `default_timer_icon`              | string  | `mdi:timer-outline`    | Default icon for entities that do not specify one                                            |
| `default_timer_color`             | string  | `var(--primary-color)` | Default color for entities that do not specify one (any CSS color or HA variable)            |
| `expired_subtitle`                | string  | localized "Time's up!" | Default subtitle shown when a timer expires                                                  |
| `expire_action`                   | string  | `keep`                 | What to do when a timer hits zero: `keep` (show with expired message), `dismiss`, or `remove` |
| `expire_keep_for`                 | number  | `120`                  | Seconds to keep an expired timer visible (only when `expire_action: keep`)                   |
| `auto_dismiss_writable`           | boolean | `false`                | For helper-backed timers (`input_text`/`text`), clear the entity at 0 instead of leaving the expired value |

---

## ⚡ Quick-start presets

Buttons shown in the empty state for one-tap timer creation, plus inputs for the custom-timer flow.

```yaml
show_timer_presets: true
timer_presets: [5, 15, 30, 90s]
timer_name_presets: [Pasta, Tea, Workout]
minute_buttons: [1, 5, 10]
```

| Name                 | Type    | Default       | Description                                                                                                |
| -------------------- | ------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| `show_timer_presets` | boolean | `true`        | Show the one-tap preset buttons above the empty state                                                      |
| `timer_presets`      | array   | `[5, 15, 30]` | Quick-start presets. Numbers are minutes; suffix with `s` for seconds (e.g. `90s`)                         |
| `timer_name_presets` | array   | `[]`          | Suggested labels offered in the custom-name picker                                                         |
| `minute_buttons`     | array   | `[1, 5, 10]`  | +/− adjustment buttons next to the custom timer duration input. Numbers are minutes; suffix `s` for seconds |

---

## 📌 Pinned timers

Reusable one-tap timers that always show in the empty state. They hide while running and reappear once finished.

```yaml
pinned_timers:
  - id: tea
    name: Tea
    duration: 7m
    icon: mdi:tea
    color: '#7CB342'
  - id: pasta
    name: Pasta
    duration: 11m
    icon: mdi:pasta
```

### Pinned timer options

| Name                         | Type    | Default      | Description                                                                                |
| ---------------------------- | ------- | ------------ | ------------------------------------------------------------------------------------------ |
| `id`                         | string  | auto         | Stable identifier used for persistence. Recommended so renames don't reset progress.       |
| `name`                       | string  | `#<index>`   | Displayed label                                                                            |
| `duration`                   | string \| number | **required** | Duration. Accepts `5m`, `90s`, `1h`, or raw seconds                              |
| `icon`                       | string  | `default_timer_icon` | Icon                                                                               |
| `color`                      | string  | `default_timer_color` | Color (any CSS color or HA variable)                                              |
| `expired_subtitle`           | string  | inherited    | Override expired message                                                                   |
| `audio_enabled`              | boolean | `false`      | Enable a per-pin expiry sound                                                              |
| `audio_file_url`             | string  | `""`         | URL or path to audio file                                                                  |
| `audio_repeat_count`         | number  | `1`          | How many times to play the audio                                                           |
| `audio_play_until_dismissed` | boolean | `false`      | Keep playing until the user acts on the timer (overrides `audio_repeat_count`)             |

---

## 🔊 Audio notifications

Global audio settings used when a timer expires. Entity-level and pinned-timer audio settings override these.

```yaml
audio_enabled: true
audio_file_url: /local/sounds/done.mp3
audio_completion_delay: 4
audio_repeat_count: 1
audio_play_until_dismissed: false
```

| Name                         | Type    | Default | Description                                                                              |
| ---------------------------- | ------- | ------- | ---------------------------------------------------------------------------------------- |
| `audio_enabled`              | boolean | `false` | Master switch                                                                            |
| `audio_file_url`             | string  | `""`    | URL or path (e.g. `/local/sounds/done.mp3` or `https://...`)                             |
| `audio_completion_delay`     | number  | `4`     | Seconds to wait between repeats                                                          |
| `audio_repeat_count`         | number  | `1`     | How many times to play                                                                   |
| `audio_play_until_dismissed` | boolean | `false` | Keep playing until the user dismisses or snoozes the timer (overrides `audio_repeat_count`) |

---

## 💾 Storage & persistence

Where the card persists user-created timers (presets, pinned timers, custom timers).

### Local (default)

Timers are stored in browser `localStorage`. They persist across reloads on the same device.

No configuration needed:

```yaml
type: custom:simple-timer-card
```

### Helper entity

Use an `input_text` or `text` helper to persist timers in HA itself. Syncs across devices.

```yaml
default_timer_entity: input_text.timer_store
```

### MQTT

Best for cross-device sync. Pick an MQTT-backed sensor (or supply an explicit `mqtt:` block).

```yaml
default_timer_entity: sensor.simple_timer_store
# or, explicitly:
storage: mqtt
mqtt:
  sensor_entity: sensor.simple_timer_store
  topic: simple_timer/state
```

Full details on the MQTT payload and hybrid model: [mqtt-hybrid-model.md](mqtt-hybrid-model.md).

### Storage options

| Name                   | Type   | Default | Description                                                                                            |
| ---------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------ |
| `default_timer_entity` | string | `null`  | Helper (`input_text`/`text`) or MQTT sensor used as the timer store. Auto-detects `local` vs `mqtt`.   |
| `storage`              | string | auto    | Force a backend: `local` or `mqtt`. Usually auto-detected from `default_timer_entity`.                 |
| `mqtt.sensor_entity`   | string | -       | MQTT sensor entity holding state                                                                       |
| `mqtt.topic`           | string | -       | Base MQTT topic                                                                                        |
| `mqtt.state_topic`     | string | -       | Override the state topic                                                                               |
| `mqtt.events_topic`    | string | -       | Override the events topic                                                                              |

---

## 🗣️ Voice PE integration

Mirror or fully control Voice PE timers from the card.

```yaml
auto_voice_pe: true
voice_pe_control_entity: text.voice_pe_timer_command
```

| Name                      | Type    | Default | Description                                                                                          |
| ------------------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `auto_voice_pe`           | boolean | `false` | Auto-detect and mirror Voice PE timers                                                               |
| `voice_pe_control_entity` | string  | `null`  | A `text` or `input_text` entity used to send Voice PE commands (required for full control, not just mirroring) |

Full guides:

* [voice-pe/voice-pe.md](voice-pe/voice-pe.md) - overview
* [voice-pe/voice-pe-esphome.md](voice-pe/voice-pe-esphome.md) - ESPHome-based local timers

---

## 🧷 Compatibility mode

Preserves the storage and MQTT contracts from older versions.

```yaml
compatibility_mode: 2.1.1   # default, preserves v2.1.1 behavior
# or
compatibility_mode: latest  # opt in to the newest behavior
```

| Name                 | Type   | Default | Description                                                  |
| -------------------- | ------ | ------- | ------------------------------------------------------------ |
| `compatibility_mode` | string | `2.1.1` | `2.1.1` (legacy behavior, default) or `latest` (current spec) |

If you are upgrading from v2.1.1 and your timers stop persisting, leave this on `2.1.1`.

---

## 🌍 Language support

The card supports multiple UI languages:

* English (`en`)
* German (`de`)
* Spanish (`es`)
* Danish (`da`)
* Italian (`it`)
* French (`fr`)
* Hebrew (`he`) - right-to-left
* Polish (`pl`)

```yaml
language: de
```

If no language is set, the card automatically uses your Home Assistant language. Additional languages are welcome via contributions.

---

## 📚 Examples & help

See the [`examples/`](examples) folder for ready-to-paste configs:

* MQTT notifications
* Helper monitoring
* Mobile push notifications

**Need help?** Open an issue on [GitHub](https://github.com/eyalgal/simple-timer-card/issues) or ask in the Home Assistant [community forum](https://community.home-assistant.io/t/simple-timer-card-a-clean-way-to-track-timers-in-home-assistant/928813).
