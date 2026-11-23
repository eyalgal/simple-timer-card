# 🛠️ Simple Timer Card Configuration

This document is the **full configuration reference** for Simple Timer Card.

If you are new, the absolute minimum is:

```yaml
type: custom:simple-timer-card
```

That gives you a working card for timers created in the browser. List existing entities or enable speaker discovery to display timers from Home Assistant.

### Visual editor

Simple mode shows four sections:

| Section | Settings |
| --- | --- |
| **Timer sources** | Entity selection and Alexa, Google Home, and voice timer (timer list) discovery |
| **Timer storage** | Where new timers are created and the current storage type |
| **Appearance** | Title, style, layout, progress, language, time format, and timer ordering |
| **Timer input** | Input method, optional on-card switch, starting duration, increments, and quick-start presets |

Appearance includes the display and ordering controls in both editor modes.
Progress milestone options appear when the progress mode is set to Milestones.

Turn on **Advanced** for icons and colors, expiry behavior,
pinned timers, audio, push notifications, legacy Voice PE control details, and custom actions.
Per-entity overrides and timer-name suggestions also live in Advanced. Button
settings are hidden in simple mode when the card uses a fixed keypad; they remain
available in Advanced because native-timer editing also uses the increments.

The Simple/Advanced choice is remembered in this browser for the current Home
Assistant address, across cards and page reloads. It is an editor preference,
not a card YAML setting, and is separate from stored timers. Each device keeps
its own choice. If browser storage is blocked, the switch still works for the
current editor session.

Search finds all rendered settings, including advanced ones and their YAML keys.
Clearing search restores the previous editor mode and panel layout. Switching
editor modes or searching never changes saved configuration. Hidden settings stay
active; disabling audio or quick-start buttons also keeps their configured values
for later use. Some specialist options, such as custom MQTT topics and
notification payloads, remain YAML-only.

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
9. [Tap, hold & double-tap actions](#-tap-hold--double-tap-actions)
10. [Custom action buttons](#-custom-action-buttons)
11. [Audio notifications](#-audio-notifications)
12. [Push notification fallback](#-push-notification-fallback)
13. [Storage & persistence](#-storage--persistence)
14. [Voice timers (timer lists)](#-voice-timers-timer-lists)
15. [Companion integration](#-companion-integration)
16. [Voice PE integration (legacy)](#-voice-pe-integration)
17. [Compatibility mode](#-compatibility-mode)
18. [Language support](#-language-support)
19. [Examples & help](#-examples--help)

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
| `style`              | string  | `bar_horizontal` | Active timer style: `bar_horizontal`, `bar_vertical`, `fill_horizontal`, `fill_vertical`, `circle_vertical`, `circle_horizontal` |
| `progress_mode`      | string  | `drain`          | How the progress indicator fills: `drain`, `fill`, or `milestones` (bar styles only)         |
| `language`           | string  | auto             | UI language. Defaults to your Home Assistant language. See [Language support](#-language-support). |
| `show_active_header` | boolean | `true`           | Show the "Active Timers" heading above running timers                                        |
| `hide_when_empty`    | boolean | `false`          | Hide the whole card while there are no timers. It reappears when one starts. Pinned timers keep it visible, and it always shows while you edit the dashboard. |
| `max_rows`           | number  | all              | Show this many timers, with a **+N more** button for the rest                                |
| `group_by`           | string  | `none`           | Group timers under headers: `device`, `area`, `source`, or `none`. Headers appear only with two or more groups. |
| `device_label`       | string  | `auto`           | Add the device or area to the status line of voice timers: `auto` (when the card shows two or more satellites, and not grouped by device or area), `device`, `area`, or `none` |

---

## ⏱ Timer entities

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
| Voice timers (timer list) | `timer_list.*`, for example Voice PE and other voice satellites (see [Voice timers](#-voice-timers-timer-lists)) |
| Browser voice satellite   | `assist_satellite.*` from the Voice Satellite Card integration (see [Browser voice satellites](#browser-voice-satellites)) |
| Count up                  | Any timestamp, shown as time since (see [Count-up rows](#count-up-rows)) |
| Template rows             | Rows from a Jinja template (see [Template rows](#template-rows)) |
| Alexa                     | `alexa_media_player` next-timer sensors         |
| Google Home               | Timer sensors from the Google Home integration, identified by attributes |
| Voice PE (legacy)         | Custom ESPHome/template sensors (see [Voice PE](#-voice-pe-integration)) |
| Helper                    | `input_text.*`, `text.*`                        |
| Timestamp sensor          | A sensor whose state is the timer's end timestamp |
| Minutes attribute sensor  | Any sensor exposing a "minutes remaining" attribute     |

### Auto-discovery

Alexa, Google Home and voice satellites expose one timer entity per device,
which is tedious to list by hand and needs editing whenever a device is added.
They can be discovered instead:

```yaml
type: custom:simple-timer-card
auto_discover_alexa: true
auto_discover_google: true
auto_discover_timer_lists: true
```

| Name                        | Type    | Default | Description                                                            |
| --------------------------- | ------- | ------- | ---------------------------------------------------------------------- |
| `auto_discover_alexa`       | boolean | `false` | Pick up Alexa Media Player next-timer sensors without listing them.     |
| `auto_discover_google`      | boolean | `false` | Pick up Google Home timer sensors by their attributes, including renamed entities. |
| `auto_discover_timer_lists` | boolean | `false` | Pick up every `timer_list.*` entity, such as voice satellite timers. See [Voice timers](#-voice-timers-timer-lists). |
| `auto_discover_voice_satellites` | boolean | `false` | Pick up browser satellites from the Voice Satellite Card integration. See [Browser voice satellites](#browser-voice-satellites). |

Discovered entities are added to anything in `entities:`, never duplicated, and
carry no per-entity options. List an entity explicitly if you want to override
its icon, colour or name. Alexa and Google Home are read-only, so discovered
timers can be dismissed from this card once they ring but not started or paused
from it. Timer lists can be controlled; see [Voice timers](#-voice-timers-timer-lists).
Dismissing a Google Home timer also calls `google_home.delete_timer`, so it
stops ringing on the speaker. Dismissing an Alexa timer only hides it on the
card; the speaker keeps ringing. The Alexa Media Player
or Google Home integration must already expose the timer sensors in Home Assistant.

### Per-source icon and colour

Discovered timers have no per-entity options, so `source_styles` sets a default
icon and colour for every timer coming from a given source:

```yaml
type: custom:simple-timer-card
auto_discover_alexa: true
auto_discover_google: true
source_styles:
  alexa:
    icon: mdi:speaker
    color: "#00d4ff"
  google:
    icon: mdi:google-assistant
    color: "#4285f4"
  timer_list:
    icon: mdi:microphone-message
```

Keys are the source names: `alexa`, `google`, `timer_list`, `voice_satellite`, `count_up`,
`dynamic` (template rows), `voice_pe`, `timer`, `helper`, `timestamp`, `minutes_attr`. Each accepts `icon`, `color`, or both.

In the editor, enable **Advanced** and open **Icons & colors** for these settings.

> Material Design Icons dropped its Amazon brand icons, so there is no
> `mdi:amazon-alexa`. `mdi:google-assistant` does still exist. For actual brand
> logos, install an icon pack such as Simple Icons (`si:`) or Custom Brand Icons
> (`phu:`) and use one of their names instead.

Precedence is per-entity config, then `source_styles`, then the built-in default,
so an entity listed in `entities:` with its own `icon:` still wins.

> Paused and finished timers keep their state indicators (`mdi:timer-pause` with
> the warning colour, `mdi:timer-check` with the success colour) rather than the
> configured icon and colour. That applies to per-entity icons too, and keeps
> timer state readable at a glance. Active, idle and ringing timers use the
> configured style.

### Per-entity options

| Name                           | Type    | Default      | Applies when           | Description                                                                  |
| ------------------------------ | ------- | ------------ | ---------------------- | ---------------------------------------------------------------------------- |
| `entity`                       | string  | **required** | Always                 | Entity ID                                                                    |
| `name`                         | string  | auto         | Always                 | Override the displayed name                                                  |
| `mode`                         | string  | `auto`       | Always                 | One of `auto`, `timer`, `timer_list`, `voice_satellite`, `count_up`, `alexa`, `google`, `voice_pe`, `helper`, `timestamp`, `minutes_attr` |
| `icon`                         | string  | auto         | Always                 | Override the icon                                                            |
| `color`                        | string  | auto         | Always                 | Override the color (any CSS color or HA theme variable)                      |
| `expired_subtitle`             | string  | inherited    | Always                 | Override the message shown when this timer expires                           |
| `minutes_attr`                 | string  | `Minutes to arrival` | `mode: minutes_attr` | Attribute name holding minutes remaining                           |
| `start_time_entity`            | string  | self         | `mode: timestamp`      | Use another entity for the start timestamp                                   |
| `start_time_attr`              | string  | `start_time` | `mode: timestamp`      | Attribute on the entity holding the start timestamp                          |
| `keep_timer_visible_when_idle` | boolean | `false`      | `mode: timer`          | Keep the row in view even when the timer is idle                             |
| `hide_timer_actions`           | boolean | `false`      | `mode: timer` or `timer_list` | Hide the start / pause / cancel buttons                               |
| `goal`                         | string  | none         | `mode: count_up`       | Duration such as `3h`. Shows progress and turns the row amber once it has passed. |
| `attribute`                    | string  | state        | `mode: count_up`       | Read the start time from this attribute                                      |
| `use_last_changed`             | boolean | `false`      | `mode: count_up`       | Count from when the entity last changed state                                |
| `buttons`                      | list    | inherited    | Always                 | Extra action buttons for this row, see [Custom action buttons](#-custom-action-buttons) |
| `audio_enabled`                | boolean | `false`      | Always                 | Enable an entity-specific expiry sound                                       |
| `audio_file_url`               | string  | `""`         | `audio_enabled: true`  | URL or path to the audio file                                                |
| `audio_repeat_count`           | number  | `1`          | `audio_enabled: true`  | How many times to play the audio                                             |

### Browser voice satellites

Wall tablets running the [Voice Satellite Card integration](https://github.com/jxlarrea/voice-satellite-card-integration)
publish their timers on the `assist_satellite.*` entity. The card shows them
read-only: start and stop them by voice on the tablet, which also rings.

```yaml
type: custom:simple-timer-card
auto_discover_voice_satellites: true
```

If that integration moves to timer lists, use [Voice timers](#-voice-timers-timer-lists) instead.

### Count-up rows

`mode: count_up` shows how long ago something happened: the dishwasher
finished, the baby was fed, the plants were watered. The start time is the
entity's state (a timestamp), an `input_datetime`, an `attribute`, or the last
state change with `use_last_changed: true`. Rows are read-only and never ring.

```yaml
entities:
  - entity: input_datetime.baby_fed
    mode: count_up
    name: Fed
    goal: 3h
  - entity: binary_sensor.dishwasher
    mode: count_up
    use_last_changed: true
```

### Template rows

`timers_template` is a Jinja template that Home Assistant renders and keeps up
to date. It must return a JSON list. Each row needs a `name` plus either `end`
(a countdown) or `since` (a count-up). Optional fields are `start` or `duration`
for progress, `goal` for count-ups, `icon`, `color`, `id`, and
`expired_subtitle`. Times can be ISO strings or epoch seconds or milliseconds.
Invalid output shows no rows, at most 50 rows are shown, and rows are read-only.

```yaml
type: custom:simple-timer-card
timers_template: >-
  {% set ns = namespace(rows=[]) %}
  {% if is_state('sensor.printer_status', 'printing') %}
    {% set ns.rows = ns.rows + [{'name': 'Printer', 'end': states('sensor.printer_end_time'),
                                 'start': states('sensor.printer_start_time'),
                                 'icon': 'mdi:printer-3d'}] %}
  {% endif %}
  {{ ns.rows | tojson }}
```

---

## 🔀 Sorting & ordering

Controls the order timers appear in. These controls are in **Appearance** in both
Simple and Advanced editor modes.

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

Controls how the time-remaining string is rendered. Find these settings in
**Appearance** in either editor mode.

```yaml
time_format: hms
time_format_units: [days, hours, minutes, seconds]
```

| Name                | Type    | Default                                | Description                                                                  |
| ------------------- | ------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `time_format`       | string  | `hms`                                  | One of `hms`, `hm`, `ss`, `dhms`, `human_compact`, `human_short`, `human_natural` |
| `time_format_units` | array   | `[days, hours, minutes, seconds]`      | Allowed units (in order) for `human_*` formats. Does not change clock formats. |

### Format reference

| Value             | Example output (1h 23m 45s)     |
| ----------------- | ------------------------------- |
| `hms`             | `01:23:45`                      |
| `hm`              | `01:23`                         |
| `ss`              | `5025` (seconds only)           |
| `dhms`            | `01:23:45`                      |
| `human_compact`   | `1h 23m 45s`                    |
| `human_short`     | `1 hour, 23 minutes, 45 seconds` |
| `human_natural`   | `1 hour, 23 minutes, 45 seconds` |

Clock formats omit leading zero day/hour fields. For example, `dhms` adds the day
field once the duration reaches a day. `human_short` and `human_natural` currently
use the same localized wording.

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

## ⚙ Timer defaults & behavior

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
| `default_new_timer_duration_mins` | number  | `15`                   | Starting value (in minutes) for the **Custom timer** +/- buttons. Set `0` to start empty. Keypad entry always starts at zero. |
| `custom_timer_input`             | string  | `stepper`              | Custom input: `stepper` (+/- buttons) or `keypad`. Located under **Timer input** in the editor. |
| `show_timer_input_selector`       | boolean | `false`                | Show the optional Buttons / Keypad switch on the card. When hidden, use the configured `custom_timer_input`. |
| `snooze_duration`                 | number  | `5`                    | Minutes added when the user taps **Snooze** on an expired timer                              |
| `default_timer_icon`              | string  | `mdi:timer-outline`    | Default icon for entities that do not specify one                                            |
| `default_timer_color`             | string  | `var(--primary-color)` | Default color for entities that do not specify one (any CSS color or HA variable)            |
| `expired_subtitle`                | string  | localized "Time's up!" | Default subtitle shown when a timer expires                                                  |
| `expire_action`                   | string  | `keep`                 | `keep` shows the expired timer until `expire_keep_for`; `remove` cleans it up; `dismiss` leaves it for manual dismissal. |
| `expire_keep_for`                 | number  | `120`                  | Seconds to keep an expired timer visible (only when `expire_action: keep`)                   |
| `auto_dismiss_writable`           | boolean | `false`                | Retained compatibility setting; currently does not add automatic helper cleanup. Use `expire_action` instead. |
| `ring_animation`                  | string  | `none`                 | Animate ringing timers: `pulse` or `swing` (icon), `shake` or `hop` (row). Turned off when the system asks for reduced motion. |

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

### Custom timer input

All input controls are together in the editor under **Timer input**: input method,
starting duration, adjustment buttons, optional on-card switch, and quick-start
presets. Advanced also reveals name suggestions, independently of whether the
quick-start buttons are shown.

By default, the card uses the selected input method without showing a mode switch.
For a fixed keypad:

```yaml
custom_timer_input: keypad
show_timer_input_selector: false
```

Enable **Show input switch on card**, or set `show_timer_input_selector: true`,
to let users switch between **Buttons / Keypad** while entering a timer. It works
in both layouts, including when adding another timer while one is running.
Switching keeps the duration and timer name, does not change saved configuration
or storage keys, and lasts until the card is recreated.

- **Buttons** keeps the existing `minute_buttons` increments and starts at
  `default_new_timer_duration_mins` (15 by default).
- **Keypad** starts at `00h 00m 00s`. Digits enter from the right: `1`, `5`, `9`
  gives `00h 01m 59s`. `5`, `00` gives five minutes; `1`, `00`, `00` gives one hour.
- Backspace removes the last digit. **Clear** resets to zero. **Start** is disabled
  at zero. Entries such as `90` seconds are kept as typed while editing and
  normalized to `1m 30s` when starting or switching to Buttons.
- While the keypad is focused, number keys, Backspace and Delete work too. Enter
  starts the timer when the keypad area itself is focused; on a focused button,
  Enter activates that button. Typing a timer name is unaffected.
- Hours expand for longer durations, up to the existing 365-day limit. Hour,
  minute, and second columns and the numeric keypad keep their order in RTL.
  Within each value, Hebrew units appear to the left of the number with a
  correctly placed geresh (`׳`). Preset and adjustment labels follow the same
  rule, with `+`/`-` kept beside the digits.

Quick-start presets, pinned timers, and existing-timer editing are unchanged.

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
| `duration`                   | string \| number | **required** | Duration. Accepts `5m`, `90s`, `1h`, or `1d`. Bare numbers mean minutes.         |
| `icon`                       | string  | `default_timer_icon` | Icon                                                                               |
| `color`                      | string  | `default_timer_color` | Color (any CSS color or HA variable)                                              |
| `expired_subtitle`           | string  | inherited    | Override expired message                                                                   |
| `audio_enabled`              | boolean | `false`      | Enable a per-pin expiry sound                                                              |
| `audio_file_url`             | string  | `""`         | URL or path to audio file                                                                  |
| `audio_repeat_count`         | number  | `1`          | How many times to play the audio                                                           |
| `audio_play_until_dismissed` | boolean | `false`      | Keep playing until the user acts on the timer (overrides `audio_repeat_count`)             |
| `buttons`                    | list    | inherited    | Extra action buttons for this pin, see [Custom action buttons](#-custom-action-buttons)    |

---

## 👆 Tap, hold & double-tap actions

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

Supported Home Assistant-style actions are `more-info`, `toggle`, `navigate`,
`url`, `call-service` / `perform-action`, and `none`. This is not the complete
Home Assistant `ActionConfig` implementation; `assist` is not handled. See the
[Home Assistant action docs](https://www.home-assistant.io/dashboards/actions/)
for the standard action syntax.

### Per-row actions

Entries under `entities:` accept the same three keys and override the card-level
values for that row. Per-pin `tap_action`, `hold_action`, and `double_tap_action`
overrides are not resolved; use a pin's `buttons:` for custom actions instead.

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
| Running or paused native/timer list/helper/local/MQTT | Pause / resume    |
| Idle non-native or Voice PE             | No supported toggle behavior; use built-in controls or an explicit service action |
| Anything else                          | Falls through to `domain.toggle` |

### What's ignored

Tap handlers do not fire when the tap lands on an in-card control (`button`, `ha-icon-button`, `ha-textfield`, `ha-input`, `ha-select`, the action buttons row, the progress bar, or any element marked `data-no-action`). The start, pause, cancel, edit, and custom-duration controls all keep working normally.

---

## 🔘 Custom action buttons

Add your own icon buttons next to the built-in start / pause / cancel controls. Configure `buttons:` at card level (applies to every row), per entity row, or per pinned timer. The most specific list wins: pinned/entity buttons override the card-level list (the same way `tap_action` resolves). Configurable in the visual editor (action + icon) or in YAML.

Start, pause/resume, and cancel already have built-in controls, so the presets focus on actions you can't otherwise reach inline. Pause/resume is also offered as a preset since it's useful in the `circle_vertical` layout, which has no inline pause control.

```yaml
type: custom:simple-timer-card
entities:
  - timer.ac_bedroom
buttons:
  - action: finish            # shorthand preset
  - action: add               # add time to the running timer
    amount: 5m                # required, e.g. 5m, 30s, 1h
  - action: reduce            # subtract time from the running timer
    amount: 30s               # required, e.g. 5m, 30s, 1h
  - action: restart           # restart from the original duration
```

Each button supports:

| Name        | Type            | Default              | Description                                                                                 |
| ----------- | --------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `action`    | string\|object  | **required**         | A shorthand preset string, or a full Home Assistant `ActionConfig` object                   |
| `amount`    | string          | **required** for `add` / `reduce` | How much time to add or subtract, e.g. `5m`, `30s`, `1h`                       |
| `icon`      | string          | preset icon          | Button icon. Optional when `action` is a preset string, required for custom actions         |
| `name`      | string          | `""`                 | Tooltip text                                                                                 |
| `color`     | string          | inherit              | Icon color (any CSS color or HA theme variable)                                             |
| `show_when` | string\|list    | `[running, paused]`  | Timer states: `idle`, `running`, `paused`, `finished`. The ringing layout uses its built-in Snooze/Dismiss controls instead. |

### Shorthand presets

Use a string for `action` to call a built-in handler. The icon is supplied automatically (override with `icon`):

| Preset    | Does                                                                  |
| --------- | -------------------------------------------------------------------- |
| `finish`  | Calls native `timer.finish`, removes a helper/local/MQTT timer, or cancels a controllable Voice PE local timer. Publishes `finished` when MQTT events are enabled. |
| `add`     | Adds `amount` to the running or paused timer (`amount` required)      |
| `reduce`  | Subtracts `amount` from the running or paused timer (`amount` required) |
| `restart` | Restarts the timer from its original duration                        |
| `pause`   | Toggles pause / resume (handy in the `circle_vertical` layout)                |

### Custom actions

For anything else, pass a full Home Assistant `ActionConfig` (`perform-action` / `call-service`, `more-info`, `navigate`, `url`, `toggle`). When a `perform-action` has no `target` or `data.entity_id`, the timer's own entity is used as the target, so `timer.change`, `timer.finish`, etc. apply to the right timer automatically.

### Preset availability

Presets work for native `timer` entities, timer lists, `input_text` / `text`
helpers, and local / MQTT timers. On a timer list, a preset that the list does
not support shows a notice instead. Read-only Alexa, Google Home, timestamp, and
mirrored Voice PE timers cannot be controlled this way. The per-entity editor filters its list
by source; the card-level list keeps all presets.

For controllable Voice PE local timers, `finish` sends a cancel command. Use the
built-in pause/resume controls, not the `pause` shorthand, which currently does
not handle Voice PE even though the editor offers it. Finishing a timer is not
the same as natural expiry: automations listening only to MQTT `/expired` do
not receive the `/finished` event.

### Placement

Buttons sit before the start / pause control in the bar, fill and
`circle_horizontal` styles, following the page direction. In `circle_vertical`
they appear in the corner opposite the cancel X.

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
| `audio_completion_delay`     | number  | `4`     | Delay before cleanup with `expire_action: remove` when audio is enabled. Not a repeat interval. |
| `audio_repeat_count`         | number  | `1`     | How many times to play                                                                   |
| `audio_play_until_dismissed` | boolean | `false` | Keep playing until the user dismisses or snoozes the timer (overrides `audio_repeat_count`) |

> 📱 **iOS / iPad:** Browser autoplay policies can block alarm audio until a user
> gesture. Tap the card after loading to let it prime audio playback. A suspended
> tab or locked device can also stop the card's JavaScript from checking timers.
> Push fallback helps when the card is running but audio cannot play; it does not
> turn the card into a background scheduler.

---

## 📲 Push notification fallback

When a timer ends, a running card can call a Home Assistant `notify` service.
Push delivery is separate from browser audio, but the card must still be open,
connected and executing to detect expiry and send the call. A closed or suspended
dashboard cannot guarantee notifications. For MQTT timers with no dashboard open,
configure a separate [backend monitor](mqtt-hybrid-model.md). Delivery and sound
also depend on the target device's notification permissions and settings.

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
| `message` | string | `Timer {name} finished` | Body with `{name}`, `{entity_id}`, and `{duration}` placeholders. Duration is in milliseconds. |
| `title`   | string | _(none)_         | Notification title. Same placeholders as `message`.                                                                                                                          |
| `when`    | string | `on_audio_fail`  | `on_audio_fail` notifies if audio is disabled, missing, invalid, or fails to start. `always` also notifies alongside audio. Requires the card to detect expiry. |
| `data`    | object | `{}`             | Passed as the notification service's nested `data` object, for platform-specific fields such as `push.sound`, `tag`, or Android `channel`. |

**Common patterns:**

- **Open kitchen dashboard**: `service: notify.mobile_app_kitchen_ipad`, `when: on_audio_fail`. The running card tries audio and sends a push when audio is unavailable.
- **Also notify a phone**: `service: notify.mobile_app_yourphone`, `when: always`. Sends a notification whenever this running card detects a timer end.
- **Persistent notification banner only**: `service: notify.persistent_notification`. No sound, just a banner in HA.

**What it cannot do:** play a custom sound from the card's `audio_file_url` through the notification. The notification's sound is whatever the target platform plays (configured via `data.push.sound` on iOS, or the Companion App's notification channel on Android).

---

## 💾 Storage & persistence

Where the card creates or persists user-created timers. Choose a target under
**Timer storage** in either editor mode. Custom MQTT topics and namespaces use YAML.

### Native Home Assistant timer

To start a native timer through `timer.start`, select it explicitly:

```yaml
default_timer_entity: timer.kitchen
```

If the card lists exactly one native timer in `entities:`, it can select that
timer automatically. With several native timers, choose a default to avoid
ambiguity. Starting it again restarts that same entity, rather than creating a
second timer. Voice PE local-control setup has its own targeting rules below.

### Timer list

To create timers on a voice satellite or another timer list, select it:

```yaml
default_timer_entity: timer_list.kitchen_voice_timers
```

Each start creates a new timer on the list, so several can run at once. If the
card lists exactly one timer list and no native timer, it is selected
automatically. See [Voice timers](#-voice-timers-timer-lists).

### Local (default)

Without a native/timer list/helper/Voice PE target or MQTT backend, timers use browser
`localStorage`. They persist across reloads in the same browser and Home Assistant
origin, but do not sync across devices. Clearing site data removes them.

No configuration needed:

```yaml
type: custom:simple-timer-card
```

### Helper entity

An `input_text` or `text` entity can store timer JSON in HA, subject to the entity's
length limit. All readers must use the same entity. This is a constrained legacy
option: HA states, including `input_text`, are limited to 255 characters, and a
current timer record can exceed that even for one timer. Use native timers or
MQTT for normal cross-device use; do not assume a list fits in a helper.

```yaml
default_timer_entity: input_text.timer_store
```

### MQTT

Use an MQTT-backed sensor for shared lists of timers. Configure the sensor and
matching card topics as shown in [mqtt-hybrid-model.md](mqtt-hybrid-model.md).

```yaml
storage: mqtt
compatibility_mode: '2.1.1'
mqtt:
  sensor_entity: sensor.simple_timer_store
  topic: simple_timer_card/timers
  state_topic: simple_timer_card/timers/state
  events_topic: simple_timer_card/events
```

If using all default topics, `default_timer_entity: sensor.simple_timer_store`
remains a shorthand for MQTT storage. The three topics are independent: changing
`mqtt.topic` does not automatically change the state or event topic.

#### Non-admin publishing (v2.9.1)

Home Assistant 2026.10+ restricts `mqtt.publish` to administrators. Install the
[relay automation](examples/mqtt_publish_relay.yaml) as an administrator, then
add its actual entity ID to the existing `mqtt` mapping:

```yaml
mqtt:
  sensor_entity: sensor.simple_timer_store
  publish_automation: automation.simple_timer_card_mqtt_relay
```

The same card configuration works for both account types: administrators still
publish directly; non-admins call the configured automation. Without a relay,
non-admins retain direct publishing on known HA versions before 2026.10; on
2026.10+ (or an unknown version) writes are stopped with a setup warning.
Missing user information also pauses publishing rather than assuming admin access.

The relay handles storage, state markers and events. Its administrator-selected
topics must match the card's three topics; the caller cannot choose arbitrary
broker topics. The visual editor exposes the relay under **Timer storage** when
MQTT is selected. Adding only this setting does not change automatic storage
namespaces or pinned IDs.

Permission failures stop subsequent writes until the dashboard is reloaded or
the user/transport configuration changes. Warnings are deduplicated per card.
There is **no automatic fallback to local storage**: a visible/cached timer does
not prove that MQTT was updated. A successful automation trigger also does not
confirm MQTT delivery; inspect its trace and the shared sensor when testing.
See the [full setup and test checklist](mqtt-hybrid-model.md#non-admin-users-ha-202610).

#### Multi-device reconciliation

MQTT uses best-effort multi-device reconciliation. In the default compatibility
mode, timer revisions and deletion tombstones reduce stale snapshot problems.
The retained envelope has this shape (timer details omitted):

```json
{
  "timers": [ { "id": "custom-1", "rev": 3, "...": "..." } ],
  "deleted": [ { "id": "custom-0", "rev": 4, "ts": 1750000000000 } ],
  "version": 1,
  "lastUpdated": 1750000000000
}
```

Cards reconcile snapshots against cached revisions and tombstones and delay
automatic expiry processing after waking. Tombstones expire after **24 hours**.
Timestamp-based omission handling and reconnect heuristics are not a transaction
or a guarantee against lost concurrent edits or resurrected timers after long
offline periods. Older clients may ignore or discard tombstones. The bare-array
`latest` compatibility mode does not publish them at all.

MQTT storage alone does not schedule notifications. The optional backend guide
polls stored `end_ts` deadlines in milliseconds; notification delivery remains
best-effort and requires its separate HA automation.

### Multiple cards on one dashboard

When more than one card lives on the same dashboard and uses local browser storage (no `default_timer_entity`, no MQTT), each card needs its own namespace so they don't share state.

The card derives its `localStorage` key from, in order:

`storage_namespace` > `default_timer_entity` > first entity in `entities:` > a key derived from the card's own configuration

Cards selecting the same default or first entity can share a namespace. Without
those fields, a hash of the normalized configuration provides a stable key across
reloads. Reordering object keys does not create a distinct configuration hash.

Equivalent normalized configurations can share a key. To keep local stores
independent, give each card an explicit namespace:

```yaml
- type: custom:simple-timer-card
  storage_namespace: living_room
- type: custom:simple-timer-card
  storage_namespace: kitchen
```

Setting `storage_namespace` explicitly is also worthwhile for a single card, because the derived key changes if you edit the card's configuration, which starts the card on a fresh empty store.

The namespace also prefixes pinned IDs, for example `kitchen:tea`. It does not
partition MQTT data, its topic-based cache, or event topics. Independent MQTT
stores need distinct topics and matching sensors; give them distinct event
topics when their notification automations must also be isolated. Independent
native timers need different `timer.*` entities.

### Storage options

| Name                   | Type   | Default | Description                                                                                            |
| ---------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------ |
| `default_timer_entity` | string | `null`  | Native `timer.*` target, legacy text/helper store, or MQTT sensor. A single configured native timer can be selected automatically. |
| `storage`              | string | auto    | Force a backend: `local` or `mqtt`. Usually auto-detected from `default_timer_entity`.                 |
| `storage_namespace`    | string | auto    | Explicit local-store namespace and pinned-ID prefix. Does not isolate MQTT topics. See precedence above. |
| `mqtt.sensor_entity`   | string | -       | MQTT sensor entity holding state                                                                       |
| `mqtt.topic`           | string | `simple_timer_card/timers` | Retained timer payload topic, matching sensor `json_attributes_topic` |
| `mqtt.state_topic`     | string | `simple_timer_card/timers/state` | State/version marker topic, matching sensor `state_topic` |
| `mqtt.events_topic`    | string | `simple_timer_card/events` | Non-retained event prefix, followed by `/started`, `/expired`, etc. |
| `mqtt.publish_automation` | string | unset | Optional enabled `automation.*` relay for non-admin users; ignored for administrators. Requires the supplied backend automation and matching topics. |

---

## 🎙 Voice timers (timer lists)

Home Assistant keeps the timers on a voice satellite in a **timer list** entity
(`timer_list.*`). There is one per satellite, such as Voice PE or another
ESPHome, Wyoming or VoIP satellite, and one per mobile app device. The card shows
these timers and can control them. This works with stock Voice PE firmware and
needs no template sensors.

This requires a Home Assistant version in which your satellite has a timer list.
Look for a *Timers* entity on the device page. Until then, use the
[legacy Voice PE setup](#-voice-pe-integration).

```yaml
type: custom:simple-timer-card
auto_discover_timer_lists: true
default_timer_entity: timer_list.kitchen_voice_timers  # Optional: where new timers go.
```

Or list them to set names, icons and colours:

```yaml
type: custom:simple-timer-card
entities:
  - timer_list.kitchen_voice_timers
  - entity: timer_list.bedroom_voice_timers
    name: Bedroom
    icon: mdi:bed
```

| Name                        | Type    | Default | Description |
| --------------------------- | ------- | ------- | ----------- |
| `auto_discover_timer_lists` | boolean | `false` | Show every timer list without listing it. |
| `default_timer_entity`      | string  | `null`  | A `timer_list.*` entity here receives timers started from the card. |
| `default_timer_area`        | string  | `null`  | Area ID. New timers start on the timer list in that area, such as the kitchen Voice PE, when `default_timer_entity` is not set. |
| `target_picker`             | string  | `auto`  | **Start on** chips in the custom timer panel: `auto` (two or more timer lists), `always`, or `never`. **This card** keeps the timer in the card's own storage. |

**Starting timers.** Presets, the custom timer input and pinned timers create
a timer on the list picked under **Start on**, then `default_timer_entity`,
then the timer list in `default_timer_area`, then the only timer list in
`entities:` when no single native `timer.*` is listed. On a voice
satellite the timer also shows and rings on the device. The card sends a name
only when you give one, such as a custom name or a pinned timer's name, so the
satellite does not announce preset labels.

**Labels.** A timer shows its name. Unnamed timers show the list's name and the
duration they were set for, for example *Kitchen Voice - 5m*. A per-entity
`name` replaces the list's name.

**Controls.** Buttons follow the list's supported features. Actions the list
does not support are hidden or show a notice.

| On the card | Timer list action |
| ----------- | ----------------- |
| Pause / resume | `pause_timer` / `unpause_timer` |
| Cancel (×) | `cancel_timer`, or `remove_timer` when the list cannot cancel |
| `add` / `reduce` buttons | `add_time` / `subtract_time`. Reducing past the time left finishes the timer. |
| `finish` button | `finish_timer`. A satellite rings as if the time ran out. |
| Snooze | Starts a new timer with the same name for `snooze_duration`, then removes the finished one |
| `restart` button | Starts a new timer for the original duration, then removes the old one |
| Dismiss | `remove_timer`, which clears the timer on every dashboard |

**Finished timers.** A finished timer rings on the card for the expire window:
`expire_keep_for` with `expire_action: keep` (the default), until dismissed with
`dismiss`, or for the audio delay with `remove`. After that the card hides it
but leaves it in Home Assistant, which keeps the 10 most recent finished or
cancelled timers per list. Dismissing on the card does not silence a satellite
that is already ringing; stop it on the device.

**Limits.**

* Home Assistant keeps these timers in memory. A restart, or reloading the
  satellite's integration, clears them, as with voice timers before timer lists.
* Snooze and restart create a new timer, so automations see a new timer ID.
* Custom satellite integrations that still use the older timer handler API do
  not get a timer list, so the card cannot see their timers.
* Non-admin users can view and control timer lists without extra setup.

### Automations

The [Voice timer event blueprint](blueprints/automation/simple_timer_card/timer_list_event.yaml)
runs actions in Home Assistant when a timer on a timer list finishes, starts or
is cancelled, even with every dashboard closed. Filter by timer name to tie a
spoken timer to a device. For example, "set a timer called purifier for 30
minutes" can turn the air purifier off when it finishes; note that the
satellite still rings. The actions can use `trigger.timer.name` and
`trigger.entity_id`.

[Import the blueprint](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Feyalgal%2Fsimple-timer-card%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fsimple_timer_card%2Ftimer_list_event.yaml)

### Moving from the legacy Voice PE setup

1. Update Home Assistant and check that the satellite has a *Timers* entity.
2. Replace the `mode: voice_pe` sensors, `auto_voice_pe` and
   `voice_pe_control_entity` with the timer list, or with
   `auto_discover_timer_lists: true`.
3. Optionally return the device to the stock firmware and delete the template
   sensors from the legacy guides.

---

## 🧩 Companion integration

The card works on its own. The optional **Simple Timer Card integration** adds
what a dashboard card cannot do by itself:

* **Server-side timers.** Timers live in Home Assistant, keep running with every
  dashboard closed, show the same on every device, and survive restarts.
* **Actions when a timer ends.** Run a command such as "turn off the air
  purifier", or any Home Assistant action on any device. Home Assistant runs
  it, as the user who started the timer.
* **Delayed voice commands as timers.** "Turn off the lights in 10 minutes"
  normally runs hidden inside Home Assistant. With the option on, it appears on
  the card, where you can pause, extend or cancel it. This works in every
  language Assist supports, and Assist answers exactly as before.

Existing storage (browser, helpers, native timers and MQTT) keeps working
unchanged. The integration is only needed for these extras.

### Install

Copy `custom_components/simple_timer_card` from this repository into your
Home Assistant `config/custom_components` folder, restart Home Assistant, then
add **Simple Timer Card** under **Settings > Devices & services**. It creates
one entity, `sensor.simple_timer_card_timers`, whose state is the number of
running timers.

| Option | Default | Description |
| ------ | ------- | ----------- |
| Show delayed voice commands as timers | on | Capture "turn off the lights in 10 minutes" and similar commands. Turn off to leave them to Home Assistant. |
| Run late actions for up to | 10 min | If a timer ended while Home Assistant was stopped, its action still runs at startup when it is no later than this. |

### On the card

List the entity, or make it the default target so every new timer is stored in
Home Assistant:

```yaml
type: custom:simple-timer-card
default_timer_entity: sensor.simple_timer_card_timers
device_timers:                      # Optional one-tap quick actions.
  - entity: fan.air_purifier        # Default action: turn off.
  - entity: light.porch
    service: turn_on
    name: Porch light on
  - command: lock the front door
    name: Lock up
pinned_timers:
  - id: purifier_30
    name: Purifier off in 30m
    duration: 30m
    on_finish:
      entity: fan.air_purifier
      service: turn_off
```

When the integration is installed, the custom timer panel stays simple and adds
one link: **Do something when it ends**. It opens a short wizard:

1. **Control a device** or **Say a command**, or pick one of your quick actions.
2. For a device, search by name or room. Each result shows its area, device and
   entity ID, so similar names are easy to tell apart.
3. Pick what it should do: turn on, turn off, open, lock and so on.

The panel then shows the choice as one pill, for example
*Lock · Car, Driveway*. Tap it to change it, or × to remove it. The choice
applies to that one timer. A command is checked before the timer starts, to
make sure Home Assistant understands it.

While the timer runs, its row shows what will happen, for example
*12:34 · then Turn off Air purifier*. **Cancel** stops the timer without
running the action, **Finish** runs it now, and **Snooze** and **Restart** keep
it.

| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `device_timers` | list | none | Quick actions. Each entry is `entity` with an optional `service` (default `turn_off`; a name such as `open_cover` or a full action such as `cover.open_cover`), or `command`. Both accept `name` and `icon`. |
| `on_finish` | object | none | On a pinned timer: `entity` and `service`, `command`, or `actions` (a Home Assistant action list). |
| `action_timers` | boolean | `true` | Set `false` to hide **Do something when it ends**. |

Commands need the target entity to be exposed to Assist, as with any voice
command. Device actions run as the user who started the timer, so Home
Assistant's permissions apply.

### Actions and events

The entity offers `simple_timer_card.create_timer` (with `duration` and an
optional `name`, `command`, `actions`, `icon`, `color` and `metadata`),
`pause_timer`, `unpause_timer`, `cancel_timer`, `finish_timer`, `add_time`,
`subtract_time`, `restart_timer`, `remove_timer` and `get_timers`. Every change
fires a `simple_timer_card_timer` event with `event` (`created`, `finished`,
`cancelled`, ...), `entity_id` and the `timer`, so automations can react:

```yaml
triggers:
  - trigger: event
    event_type: simple_timer_card_timer
    event_data:
      event: finished
conditions:
  - condition: template
    value_template: "{{ trigger.event.data.timer.name == 'Laundry' }}"
actions:
  - action: notify.notify
    data:
      message: Laundry is done
```

---

## 🗣 Voice PE integration

> **Legacy.** If your satellite has a timer list, use
> [Voice timers](#-voice-timers-timer-lists) instead. This setup is kept for
> Home Assistant versions without timer lists.

Stock Voice PE firmware does not expose HA timer entities for this card. The
custom ESPHome guides mirror native voice timers read-only, or additionally
create independent local timers that the card can start, pause, resume and
cancel. They do not add control of native voice timers. Firmware examples must
be adapted and validated for your device; they were not build/flash-tested for
this card release.

```yaml
# Advanced local-timer setup, after configuring the guide's template sensors.
auto_voice_pe: true
voice_pe_control_entity: text.home_assistant_voice_timer_command  # Replace with yours.
entities:
  - entity: sensor.vpe_timer_1
    mode: voice_pe
  - entity: sensor.vpe_timer_2
    mode: voice_pe
  - entity: sensor.vpe_timer_3
    mode: voice_pe
```

| Name                      | Type    | Default | Description                                                                                          |
| ------------------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `auto_voice_pe`           | boolean | `false` | Enables the local-creation path. Auto-discovers only with an empty `entities` list, using timer-like state plus nonempty `control_entity`. |
| `voice_pe_control_entity` | string  | `null`  | Command entity for creating independent local timers. Per-row controls also require that sensor's `timer_id` and `control_entity` attributes. |

Mirror-only sensors have no control entity and should be listed explicitly with
`mode: voice_pe`. For mixed remote/local slots, also list every slot explicitly:
control metadata is intentionally absent when a slot contains a remote timer.

Full guides:

* [voice-pe/voice-pe.md](voice-pe/voice-pe.md) - overview
* [voice-pe/voice-pe-esphome-readonly.md](voice-pe/voice-pe-esphome-readonly.md) - read-only ESPHome mirror
* [voice-pe/voice-pe-esphome.md](voice-pe/voice-pe-esphome.md) - ESPHome-based local timers

---

## 🧷 Compatibility mode

Selects the MQTT payload shape. Keep the default for the documented MQTT sensor
and backend monitor; `latest` is an alternate format, not a required upgrade.

```yaml
compatibility_mode: '2.1.1'  # Default object envelope, including deletion tombstones.
```

Only for consumers that explicitly expect a bare array:

```yaml
compatibility_mode: latest  # Bare array, requires a different consumer.
```

| Name                 | Type   | Default | Description                                                  |
| -------------------- | ------ | ------- | ------------------------------------------------------------ |
| `compatibility_mode` | string | `2.1.1` | `2.1.1` publishes `{timers, deleted, version, lastUpdated}`; `latest` publishes a bare timer array. |

The bare array lacks shared tombstones and snapshot timestamps and is not
compatible with the guide's `json_attributes_topic` sensor. Do not mix formats
on one topic. No mode change is needed when upgrading to v2.9.0.

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
* Swedish (`sv`)

```yaml
language: de
```

If no language is set, the card automatically uses your Home Assistant language. Additional languages are welcome via contributions.

---

## 📚 Examples & help

The [`examples/`](examples) folder contains customization templates, not drop-in
automations. Replace entity IDs, topics and notification actions, follow each
file's paste context, and validate before enabling:

* [MQTT event notifications](examples/mqtt_timer_notifications.yaml) and [Alexa event notifications](examples/alexa_timer_notifications.yaml), requiring a running card
* [Native timer completion](examples/helper_timer_monitor.yaml), replacing the old JSON-helper monitor
* [Allowlisted climate timer actions](examples/climate_timer_example.yaml)

For backend polling of stored MQTT deadlines, see [mqtt-hybrid-model.md](mqtt-hybrid-model.md).

**Need help?** Open an issue on [GitHub](https://github.com/eyalgal/simple-timer-card/issues) or ask in the Home Assistant [community forum](https://community.home-assistant.io/t/simple-timer-card-a-clean-way-to-track-timers-in-home-assistant/928813).
