# 🛠️ Simple Timer Card Configuration

This document is the **full configuration reference** for Simple Timer Card.

If you are new, the absolute minimum is:

```yaml
type: custom:simple-timer-card
```

That gives you a working card that auto-detects every supported timer in your Home Assistant instance. Everything else is optional.

> 💡 **Tip:** All of the options below are also available in the visual editor (click the card &rarr; *Edit card*). Use the search box at the top to jump to a setting, or toggle **Show advanced** to expose less-common options. The editor groups settings into the same sections used here.

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
9. [Tap, hold & double-tap actions](#ï¸-tap-hold--double-tap-actions)
10. [Custom action buttons](#-custom-action-buttons)
11. [Audio notifications](#-audio-notifications)
12. [Push notification fallback](#-push-notification-fallback)
13. [Storage & persistence](#-storage--persistence)
14. [Voice PE integration](#-voice-pe-integration)
15. [Compatibility mode](#-compatibility-mode)
16. [Language support](#-language-support)
17. [Examples & help](#-examples--help)

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
| `buttons`                      | list    | inherited    | Always                 | Extra action buttons for this row, see [Custom action buttons](#-custom-action-buttons) |
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
| `buttons`                    | list    | inherited    | Extra action buttons for this pin, see [Custom action buttons](#-custom-action-buttons)    |

---

## �️ Tap, hold & double-tap actions

Standard Home Assistant `tap_action` / `hold_action` / `double_tap_action` configs, supported at both card level and per entity row.

```yaml
tap_action:
  action: toggle
hold_action:
  action: more-info
double_tap_action:
  action: navigate
  navigation_path: /lovelace/timers
```

| Name                | Type   | Default     | Description                                                                |
| ------------------- | ------ | ----------- | -------------------------------------------------------------------------- |
| `tap_action`        | object | _see below_ | Fires on a quick tap that doesn't land on a built-in control               |
| `hold_action`       | object | none        | Fires after a 500 ms press-and-hold                                        |
| `double_tap_action` | object | none        | Fires on a second tap within 300 ms of the first                           |

Each action accepts the full Home Assistant `ActionConfig`: `more-info`, `toggle`, `navigate`, `url`, `call-service` / `perform-action`, `assist`, or `none`. See the [Home Assistant action docs](https://www.home-assistant.io/dashboards/actions/) for the full schema.

### Per-row actions

Each entry under `entities:` and `pinned_timers:` accepts the same three keys, and they override the card-level values for that row.

```yaml
entities:
  - entity: timer.oven
    tap_action:
      action: more-info
```

### Resolution order

Row → card → built-in default. The only built-in default is **tap on an idle native `timer.*` row opens the inline duration editor**. Hold and double-tap have no built-in fallback.

### Smart `toggle` routing

HA's `timer.*` domain has no `toggle` service, so when you set `tap_action: toggle` the card routes to the most useful per-state action:

| Timer state                            | What `toggle` does              |
| -------------------------------------- | ------------------------------- |
| Predefined (pinned) row                | Start                           |
| Idle native HA `timer.*`               | Open the inline duration editor |
| Idle helper / local / MQTT / Voice PE  | Start                           |
| Running or paused                      | Pause / resume                  |
| Anything else                          | Falls through to `domain.toggle` |

### What's ignored

Tap handlers do not fire when the tap lands on an in-card control (`button`, `ha-icon-button`, `ha-textfield`, `ha-input`, `ha-select`, the action buttons row, the progress bar, or any element marked `data-no-action`). The start, pause, cancel, edit, and custom-duration controls all keep working normally.

---

## 🔘 Custom action buttons

Add your own icon buttons next to the built-in start / pause / cancel controls. Configure `buttons:` at card level (applies to every row), per entity row, or per pinned timer. The most specific list wins: pinned/entity buttons override the card-level list (the same way `tap_action` resolves). Configurable in the visual editor (action + icon) or in YAML.

```yaml
type: custom:simple-timer-card
entities:
  - timer.ac_bedroom
buttons:
  - action: finish            # shorthand preset
  - icon: mdi:plus
    name: +5 min
    action:
      action: perform-action
      perform_action: timer.change
      data:
        duration: "00:05:00"  # timer.change accepts negative values too
```

Each button supports:

| Name        | Type            | Default              | Description                                                                                 |
| ----------- | --------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `action`    | string\|object  | **required**         | A shorthand preset string, or a full Home Assistant `ActionConfig` object                   |
| `icon`      | string          | preset icon          | Button icon. Optional when `action` is a preset string, required for custom actions         |
| `name`      | string          | `""`                 | Tooltip text                                                                                 |
| `color`     | string          | inherit              | Icon color (any CSS color or HA theme variable)                                             |
| `show_when` | string\|list    | `[running, paused]`  | Timer states the button appears in: `idle`, `running`, `paused`                             |

### Shorthand presets

Use a string for `action` to call a built-in handler. The icon is supplied automatically (override with `icon`):

| Preset    | Does                                                                  |
| --------- | -------------------------------------------------------------------- |
| `finish`  | Completes the timer now (native `timer.finish`, fires the ring/event) |
| `cancel`  | Cancels the timer (same as the built-in X)                           |
| `pause`   | Toggles pause / resume                                               |
| `resume`  | Resumes a paused timer                                               |
| `snooze`  | Snoozes a ringing timer                                              |
| `dismiss` | Dismisses a ringing timer                                            |

### Custom actions

For anything else, pass a full Home Assistant `ActionConfig` (`perform-action` / `call-service`, `more-info`, `navigate`, `url`, `toggle`). When a `perform-action` has no `target` or `data.entity_id`, the timer's own entity is used as the target, so `timer.change`, `timer.finish`, etc. apply to the right timer automatically.

### Placement

Buttons sit at the leftmost edge of the controls, before the start / pause control, in the bar and fill styles. In the `circle` style they appear as a small floating button in the corner opposite the cancel X, so the tile keeps its height.

> A pinned timer's buttons appear once it is started (its default `show_when` is running + paused, so the idle tile in the tray shows only the start control). The buttons carry over to the live timer it creates.

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

> 📱 **iOS / iPad:** Safari and the Home Assistant Companion App's iPad webview block audio from playing unless the page has received a user tap during the current session. The card primes audio on the first tap anywhere on the card, so for normal use (you tap a preset or start a timer manually) alarms work. The first alarm of a fresh page load that is triggered entirely by voice or an automation, with no prior tap, will be silent: tap the card once after loading the dashboard to enable sound for the rest of the session. A locked screen or fully backgrounded tab also blocks audio, which is a hard iOS limitation. To cover the hands-off case, see [Push notification fallback](#-push-notification-fallback) below.

---

## 📲 Push notification fallback

When a timer ends, the card can also fire a Home Assistant `notify` service call. This is useful on iPad and iPhone, where the in-page audio cannot play if the dashboard has not received a user tap during the current page session (a locked screen, a fully backgrounded tab, or a cold-loaded dashboard with a voice-triggered timer all fall into this case). A push notification goes through iOS / Android system channels and is not subject to the browser autoplay policy, so it will ring even when in-page audio cannot.

```yaml
notify:
  service: notify.mobile_app_kitchen_ipad   # any notify.* service
  message: "{name} timer is done"
  title: "Kitchen timer"
  when: on_audio_fail                       # on_audio_fail (default) | always
  data:                                     # passed through to the notify service
    push:
      sound: chime.caf
      interruption-level: time-sensitive
```

| Name      | Type   | Default          | Description                                                                                                                                                                  |
| --------- | ------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service` | string | _(required)_     | A Home Assistant notify service in `domain.service` form (for example `notify.mobile_app_kitchen_ipad`, `notify.alexa_media`, `notify.persistent_notification`).              |
| `message` | string | `Timer {name} finished` | Notification body. Supports placeholders `{name}`, `{entity_id}`, `{duration}`.                                                                                          |
| `title`   | string | _(none)_         | Notification title. Same placeholders as `message`.                                                                                                                          |
| `when`    | string | `on_audio_fail`  | `on_audio_fail` fires the notification only when the browser rejects `audio.play()` (the iOS hands-off case). `always` fires it on every timer end alongside the in-page audio. |
| `data`    | object | `{}`             | Raw object merged into the notify service call. Use it for platform-specific fields like `push.sound`, `interruption-level`, `tag`, or Android `channel`.                    |

**Common patterns:**

- **iPad on the kitchen wall**: `service: notify.mobile_app_kitchen_ipad`, `when: on_audio_fail`. The iPad rings via in-page audio when you are tapping the dashboard, and via push when a timer was started hands-off.
- **Always also ring a phone**: `service: notify.mobile_app_yourphone`, `when: always`. Phone rings on every timer end regardless of where you are.
- **Persistent notification banner only**: `service: notify.persistent_notification`. No sound, just a banner in HA.

**What it cannot do:** play a custom sound from the card's `audio_file_url` through the notification. The notification's sound is whatever the target platform plays (configured via `data.push.sound` on iOS, or the Companion App's notification channel on Android).

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

### Multiple cards on one dashboard

When more than one card lives on the same dashboard and uses local browser storage (no `default_timer_entity`, no MQTT), each card needs its own namespace so they don't share state.

The card derives its `localStorage` key from, in order:

`storage_namespace` > `default_timer_entity` > first entity in `entities:` > per-instance random key

So cards that set `default_timer_entity` or list `entities:` are isolated automatically. Cards with none of those get a fresh per-instance namespace on each load - to make the namespace stable across reloads, set `storage_namespace` explicitly:

```yaml
- type: custom:simple-timer-card
  storage_namespace: living_room
- type: custom:simple-timer-card
  storage_namespace: kitchen
```

For two genuinely independent timers, the supported setups are still a per-card `timer.*` helper via `default_timer_entity:` or per-card MQTT with a unique `mqtt.topic:`.

### Storage options

| Name                   | Type   | Default | Description                                                                                            |
| ---------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------ |
| `default_timer_entity` | string | `null`  | Helper (`input_text`/`text`) or MQTT sensor used as the timer store. Auto-detects `local` vs `mqtt`.   |
| `storage`              | string | auto    | Force a backend: `local` or `mqtt`. Usually auto-detected from `default_timer_entity`.                 |
| `storage_namespace`    | string | auto    | Override the `localStorage` namespace for this card. Defaults to `default_timer_entity`, then the first entity in `entities:`, then a per-instance random key. Needed when running multiple local-storage cards on one dashboard. |
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
* Dutch (`nl`)

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
