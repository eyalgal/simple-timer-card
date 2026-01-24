# ⏱️ Simple Timer Card for Home Assistant
[![GitHub Release][release_badge]][release]
[![Community Forum][forum_badge]][forum]
[![Buy Me A Coffee][bmac_badge]][bmac]

<!-- Link references -->
[release_badge]: https://img.shields.io/github/v/release/eyalgal/simple-timer-card
[release]: https://github.com/eyalgal/simple-timer-card/releases
[forum_badge]: https://img.shields.io/badge/Community-Forum-5294E2.svg
[forum]: https://community.home-assistant.io/t/simple-timer-card-a-clean-way-to-track-timers-in-home-assistant/928813
[bmac_badge]: https://img.shields.io/badge/buy_me_a-coffee-yellow
[bmac]: https://www.buymeacoffee.com/eyalgal

A versatile and highly customizable timer card for Home Assistant Lovelace, offering multiple display styles and support for various timer sources.

<img width="1000" alt="Simple Timer Card Design" src="https://github.com/user-attachments/assets/d1c562d4-c3e4-4069-b22f-2f3aab58e40b" />

> **Note**
> This card provides a clean and intuitive interface for managing timers in Home Assistant. It supports both local storage and MQTT integration for persistent timers that survive browser reloads and stay synchronized across devices.

## **✨ Features**

* **Alexa Integration:** Works great with [alexa_media_player](https://github.com/alandtse/alexa_media_player). Auto-detects Alexa timer entities (legacy + new attribute structures). Per-entity audio overrides apply here too.
* **Voice PE Integration:** Mirror Voice PE timers via template sensors - [setup guide](voice-pe.md). Advanced UI-controlled local timers (start/pause/resume/cancel): [ESPHome walkthrough](voice-pe-esphome.md).
* **Flexible Display Styles:** Choose from five distinct timer display styles: `fill_horizontal`, `fill_vertical`, `bar_horizontal`, `bar_vertical`, or `circle`.
* **Progress Animation Modes:** Circle and bar styles support `drain` (shrinks/empties), `fill` (grows), and `milestones` (segmented progress by time units) animations for visual preference.
* **Dual Layout Control:** Separate `layout` (for no-timers state) and `style` (for active timers) options allow any combination.
* **Timer Presets:** Quick-access buttons for commonly used timer durations. Supports both minutes and seconds format (e.g., `5`, `90s`).
* **Pinned Timers:** Define one-tap timers (name, duration, icon, color, expiry message, optional audio). When you start a pinned timer, it becomes a normal running timer and the pinned entry hides until that run finishes.
* **Timer Name Presets:** Predefined timer names for quick selection when creating timers (e.g., "Break", "Exercise", "Cooking").
* **Custom Timers:** Set custom timer durations using minute/second buttons or manual input with flexible format support (`5m`, `90s`, `1h30m`, `2:30`). Default duration can be customized via `default_new_timer_duration_mins` parameter.
* **Persistent Storage:** Support for local browser storage or MQTT integration for timers that survive reloads and sync across devices. MQTT publishes both `started` and `expired` events for automation triggers.
* **Audio Notifications:** Play custom audio files when timers expire, with repeat counts and play-until-dismissed options.
* **Timer Actions:** Configurable actions when timers expire (keep, dismiss, or auto-dismiss).
* **Snooze Functionality:** Easily snooze expired timers for additional time.
* **Active Timer Management:** View and manage multiple active timers simultaneously.
* **Customizable Time Display:** Multiple time format options including HMS, HM, human-readable formats, and customizable time unit ordering.
* **Smart Auto-Detection & Entity Integration:** Automatic detection of timer sources based on entity type and attributes. Connect to Home Assistant entities including MQTT sensors, input helpers, and more.
* **Customizable Appearance:** Adjust colors, icons, and styling to match your Home Assistant theme.
* **Native Theme Integration:** Automatically uses Home Assistant theme colors and native UI elements.
* **Visual Progress Indicators:** Clear visual feedback showing timer progress and status.
* **Language Support:** Added support for multiple languages. Currently supports English (`en`), German (`de`), and Spanish (`es`).
* **🔒 Security Features:** Built-in XSS protection, input validation, rate limiting, and secure audio URL handling.

## **🔒 Security**

Simple Timer Card v1.2.0+ includes comprehensive security features:

* **XSS Protection:** All timer labels are automatically sanitized to prevent script injection
* **Input Validation:** Duration limits (24h max), label length limits (100 chars), and type validation
* **URL Security:** Audio URLs are validated to only allow safe protocols and paths
* **Rate Limiting:** Actions are throttled to prevent spam and performance issues
* **Data Integrity:** localStorage and MQTT data validation with graceful error handling

For security guidelines and vulnerability reporting, see [SECURITY.md](SECURITY.md).

## **✅ Requirements**

* **Home Assistant:** Version 2023.4 or newer
* **Optional:** [MQTT sensor](https://github.com/eyalgal/simple-timer-card?tab=readme-ov-file#-mqtt-setup-for-persistent-timers) for persistent timer storage

## **🚀 Installation**

**HACS**

Simple Timer Card is available in [HACS](https://hacs.xyz/) (Home Assistant Community Store).

Use this link to directly go to the repository in HACS:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=eyalgal&repository=simple-timer-card)

### **Manual Installation**

1. Download the `simple-timer-card.js` file from the [latest release](https://github.com/eyalgal/simple-timer-card/releases)
2. Copy it to your `config/www` folder
3. Add the following to your Lovelace resources:

```yaml
resources:
  - url: /local/simple-timer-card.js
    type: module
```

## **📝 Configuration**

### **Basic Configuration**

**Cleaner YAML:** empty arrays and default values are automatically omitted from the editor output. You can start with just:

```yaml
type: custom:simple-timer-card
```

| Name                     | Type      | Default                 | Description                                                                                        |
| :----------------------- | :-------- | :---------------------- | :------------------------------------------------------------------------------------------------- |
| `type`                   | `string`  | **Required**            | `custom:simple-timer-card`                                                                        |
| `layout`                 | `string`  | `horizontal`            | Card layout for no-timers state. Can be `horizontal` or `vertical`                                |
| `style`                  | `string`  | `bar_horizontal`        | Timer display style. Can be `fill_vertical`, `fill_horizontal`, `bar_vertical`, `bar_horizontal` (default), or `circle` |
| `title`                  | `string`  | `null`                  | Optional title for the card                                                                        |
| `language`               | `string`  | `en`                    | Language for UI text. Supports `en` (English), `de` (German), `es` (Spanish).                     |
| `entities`               | `array`   | `[]`                    | Optional. Array of timer entities to display                                                      |
| `pinned_timers`          | `array`   | `[]`                    | Optional. Array of pinned timers (one-tap timers)                                                  |
| `progress_mode`          | `string`  | `drain`                 | Progress animation mode: `drain` (shrinks as time counts down), `fill` (grows as time elapses), or `milestones` (segmented progress by time units). Applies to `circle`, `bar_horizontal`, and `bar_vertical` styles. **Note:** `circle_mode` is deprecated in favor of `progress_mode` |
| `auto_voice_pe`          | `boolean` | `false`                 | **v2.1.0+** When enabled, timers started from the card UI (custom/pinned) are created as **local Voice PE timers** (requires Voice PE integration + control entity) |
| `voice_pe_control_entity`| `string`  | `null`                  | **v2.1.0+** Override the control entity used to send Voice PE commands (e.g. `text.voice_pe_timer_command`). If omitted, the card tries to discover it from the timer entity attributes or by searching for an entity containing `voice_pe_timer_command`. |

### **Entity Configuration**

Each entity in the `entities` array can be either a simple string (entity ID) or an object with the following properties:

| Name                           | Type      | Default         | Description                                                                                        |
| :----------------------------- | :-------- | :-------------- | :------------------------------------------------------------------------------------------------- |
| `entity`                       | `string`  | **Required**    | Home Assistant entity ID                                                                           |
| `name`                         | `string`  | `auto`          | Override the entity name                                                                           |
| `mode`                         | `string`  | `auto`          | Timer parsing mode: `auto`, `alexa`, `timer`, `voice_pe`, `helper`, `timestamp`, or `minutes_attr` |
| `icon`                         | `string`  | `auto`          | Override the entity icon                                                                           |
| `color`                        | `string`  | `auto`          | Override the entity color                                                                          |
| `minutes_attr`                 | `string`  | `Minutes to arrival` | Attribute name for `minutes_attr` mode                                                       |
| `start_time_attr`              | `string`  | `start_time`    | Attribute name for start time when using `timestamp` mode (enables duration calculation)         |
| `start_time_entity`            | `string`  | none            | Entity ID for separate start time entity when using `timestamp` mode (alternative to `start_time_attr`) |
| `keep_timer_visible_when_idle` | `boolean` | `false`         | Keep timer visible when idle (timer mode only)                                                    |
| `audio_enabled`                | `boolean` | `false`         | Enable per-entity audio notifications                                                             |
| `audio_file_url`               | `string`  | `""`            | Per-entity audio file URL                                                                          |
| `audio_repeat_count`           | `number`  | `1`             | Per-entity audio repeat count                                                                      |
| `audio_play_until_dismissed`   | `boolean` | `false`         | Per-entity play until dismissed setting                                                           |
| `hide_timer_actions`           | `boolean` | `false`         | Hide manual action buttons (start/pause/cancel/dismiss/snooze) for entities where `mode: timer` |

**Supported Timer Sources:**

- **Auto**: Automatically detects the timer source based on entity type and attributes
- **Alexa**: Amazon Alexa timers via [alexa_media_player](https://github.com/alandtse/alexa_media_player) integration. Supports both `sorted_active`/`sorted_paused` (legacy) and `alarms_brief` (v1.5.1+) attribute structures
- **Timer**: Native Home Assistant timer entities (`timer.*`)
- **Voice PE**: Voice PE integration timers via template sensors (supports `display_name`, `duration`, `remaining`, and optional control attributes)
- **Helper**: Input text/text entities for manual timer management
- **Timestamp**: Sensor entities with timestamp device class. Supports optional `start_time_attr` attribute or separate `start_time_entity` for duration calculation
- **Minutes Attr**: Sensors with custom minutes-to-arrival attributes

> **💡 Style Options:** The `style` parameter supports five distinct visual presentations with direction control. The `layout` parameter controls how the card appears when there are no active timers, while `style` controls the active timer display. Any layout/style combination is possible for maximum flexibility.

### **Voice PE integration (quick note)**

The Voice PE integration is documented in:
- [voice-pe.md](voice-pe.md) (recommended: Home Assistant template sensors + card setup)
- [voice-pe-esphome-readonly.md](voice-pe-esphome-readonly.md) (ESPHome mirror-only / read-only implementation)
- [voice-pe-esphome.md](voice-pe-esphome.md) (ESPHome advanced implementation: local UI-controlled timers + mirroring)

**Advanced local control:** If your template sensors expose:
- `timer_id` (a string like `local:...`)
- `control_entity` (e.g. `text.voice_pe_timer_command`)

…then the card can control those timers (pause/resume/cancel) and, with **v2.1.0+**, can optionally create new card timers as local Voice PE timers (`auto_voice_pe: true`).

### **Pinned Timers**

Pinned timers are one-tap presets that appear in the timer list when they are not currently running. Starting a pinned timer creates a normal running timer (with the pinned timer's settings), and the pinned entry stays hidden until that run is gone.

```yaml
type: custom:simple-timer-card
pinned_timers:
  - id: tea
    name: Tea
    duration: 420        # seconds
    icon: mdi:tea
    color: "#00a7c7"
    expired_subtitle: "Tea is ready"
    audio_enabled: true
    audio_file_url: /local/sounds/done.mp3
```

**Pinned timer fields**

| Name                     | Type      | Default | Description |
| :----------------------- | :-------- | :------ | :---------- |
| `id`                     | `string`  | **Required** | Unique ID for the pinned timer |
| `name`                   | `string`  | **Required** | Display name |
| `duration`               | `number`  | **Required** | Duration in seconds |
| `icon`                   | `string`  | `auto`  | Override icon |
| `color`                  | `string`  | `auto`  | Override color |
| `expired_subtitle`       | `string`  | `Time's up!` | Expired message for this pinned timer |
| `audio_enabled`          | `boolean` | `false` | Enable audio for this pinned timer |
| `audio_file_url`         | `string`  | `""`    | Audio file URL/path |
| `audio_repeat_count`     | `number`  | `1`     | Repeat count (1-10) |
| `audio_play_until_dismissed` | `boolean` | `false` | Keep playing until dismissed |

### **Timer Configuration**

| Name                           | Type      | Default         | Description                                                                                        |
| :----------------------------- | :-------- | :-------------- | :------------------------------------------------------------------------------------------------- |
| `timer_presets`                | `array`   | `[5, 15, 30]`   | Array of preset timer durations. Supports minutes (e.g., `5`, `15`) or seconds with 's' suffix (e.g., `30s`, `90s`) |
| `show_timer_presets`           | `boolean` | `true`          | Show or hide the timer preset buttons                                                             |
| `minute_buttons`               | `array`   | `[1, 5, 10]`    | Array of minute increment buttons for custom timers. Supports minutes or seconds with 's' suffix (e.g., `30s`) |
| `show_time_selector`           | `boolean` | `false`         | Show manual time input selector. Supports flexible formats like `5m`, `90s`, `1h30m`, or `2:30` |
| `show_active_header`           | `boolean` | `true`          | Show "Active Timers" header section                                                               |
| `default_timer_icon`           | `string`  | `mdi:timer-outline` | Default icon for timer cards                                                                   |
| `default_timer_color`          | `string`  | `var(--primary-color)` | Default color for timer elements                                                            |
| `timer_name_presets`           | `array`   | `[]`                | Array of preset timer names for quick selection when creating timers (e.g., `['Break', 'Exercise']`)        |
| `default_new_timer_duration_mins` | `number`  | `15`             | Default duration in minutes for custom timer picker                                                       |

**Timer Name Presets:** When configured, preset timer names appear as clickable buttons during timer creation, allowing users to quickly assign meaningful names like "Break", "Exercise", or "Cooking" to their timers. If no presets are configured, a simple text input field is shown instead.

### **Time Display Configuration**

| Name                    | Type      | Default                      | Description                                                                                        |
| :---------------------- | :-------- | :--------------------------- | :------------------------------------------------------------------------------------------------- |
| `time_format`           | `string`  | `hms`                        | Time display format: `hms` (HH:MM:SS), `hm` (HH:MM), `ss` (seconds only), `dhms` (DD:HH:MM:SS), `human_compact` (e.g., "5h 30m"), `human_short` (e.g., "5h 30m 15s"), or `human_natural` (e.g., "5 hours 30 minutes") |
| `time_format_units`     | `array`   | `['days','hours','minutes','seconds']` | Ordered array of time units to display. Supports: `years`, `months`, `weeks`, `days`, `hours`, `minutes`, `seconds`. Can also be a comma-separated string |

### **Milestones Progress Mode**

When `progress_mode` is set to `milestones`, the progress bar is divided into segments based on time units. The following settings control milestone behavior:

| Name                    | Type      | Default         | Description                                                                                        |
| :---------------------- | :-------- | :-------------- | :------------------------------------------------------------------------------------------------- |
| `milestone_unit`        | `string`  | `auto`          | Unit for milestone segments: `auto` (automatically selects appropriate unit), `none`, `years`, `months`, `weeks`, `days`, `hours`, `minutes`, or `seconds`. Only applies when `progress_mode: milestones` |
| `milestone_pulse`       | `boolean` | `true`          | Enable pulsing animation on the active milestone segment. Only applies when `progress_mode: milestones` |

### **Storage & Persistence**

| Name                    | Type      | Default | Description                                                                                        |
| :---------------------- | :-------- | :------ | :------------------------------------------------------------------------------------------------- |
| `default_timer_entity`  | `string`  | `null`  | Entity ID for timer storage. Supports `input_text.*`, `text.*` entities for helper-based storage, or `sensor.*` entities for MQTT-based storage. Required for persistent timers |
| `storage_namespace`     | `string`  | `"default"` or entity ID | Namespace for local storage isolation. Allows multiple card instances to maintain separate timer storage. If not specified, uses `default_timer_entity` value when available, otherwise defaults to `"default"` |

### **Expiry & Actions**

| Name                           | Type      | Default      | Description                                                                                        |
| :----------------------------- | :-------- | :----------- | :------------------------------------------------------------------------------------------------- |
| `expire_action`                | `string`  | `keep`       | Action when timer expires: `keep`, `dismiss`, or `remove`                                         |
| `expire_keep_for`              | `number`  | `120`        | How long to keep expired timers (in seconds) before auto-dismissing                               |
| `auto_dismiss_writable`        | `boolean` | `false`      | Allow expired timers to be dismissed automatically                                                |
| `snooze_duration`              | `number`  | `5`          | Default snooze duration in minutes                                                                |
| `expired_subtitle`             | `string`  | `Time's up!` | Message displayed when timer expires                                                              |
| `show_progress_when_unknown`   | `boolean` | `false`      | Show progress bar even when timer duration is unknown                                             |

**Expiry Action Behavior:**
- **`keep`**: Expired timers remain visible for `expire_keep_for` seconds, then auto-dismiss. Works with all timer sources.
- **`dismiss`**: Expired timers are immediately hidden from view but remain in entity state (for read-only sources like `timestamp`, `voice_pe`, `alexa`).
- **`remove`**: Expired timers are completely removed. For writable sources (`helper`, `local`, `mqtt`), this deletes the timer data. For read-only sources, behaves like `dismiss`.

### **Audio Notifications**
> **Tip**
> You can override audio per entity and per pinned timer. If a timer has per-timer audio enabled, it takes precedence over the global audio settings.

| Name                              | Type      | Default | Description                                                                                        |
| :-------------------------------- | :-------- | :------ | :------------------------------------------------------------------------------------------------- |
| `audio_enabled`                   | `boolean` | `false` | Enable audio notifications when timers expire                                                     |
| `audio_file_url`                  | `string`  | `""`    | URL or path to audio file to play                                                                 |
| `audio_repeat_count`              | `number`  | `1`     | Number of times to repeat the audio (1-10)                                                        |
| `audio_play_until_dismissed`      | `boolean` | `false` | Continue playing audio until timer is dismissed or snoozed                                        |
| `audio_completion_delay`          | `number`  | `4`     | Delay in seconds before auto-dismissing timer after audio completes (when using `expire_action: remove`) |

## **🔔 Notifications**

This card focuses on timer display and management. For notifications when timers expire, use Home Assistant automations.

### **MQTT Timers**
If you use MQTT storage, Simple Timer Card publishes timer event messages to MQTT topics for external automation, notification, or cross-device sync. The following topics/events are published:

- `simple_timer_card/events/started` When a timer is **created/started**
- `simple_timer_card/events/expired` When a timer **finishes/expires** (countdown hits zero)
- `simple_timer_card/events/cancelled` When a timer is **cancelled**
- `simple_timer_card/events/paused` When a timer is **paused**
- `simple_timer_card/events/resumed` When a timer is **resumed**

See `examples/mqtt_timer_notifications.yaml` for a mobile notification automation.

### **Helper Timers**
For helper entities, create a state trigger automation. See `examples/helper_timer_monitor.yaml`.

### **Native Timer Entities**
Use the built-in `timer.finished` event. Example:
```yaml
trigger:
  - platform: event
    event_type: timer.finished
```

Check the `examples/` folder for ready-to-use automation templates.

## **🔧 MQTT Setup for Persistent Timers**

For persistent timers that survive browser reloads and sync across devices, configure an MQTT sensor:

```yaml
# configuration.yaml
mqtt:
  sensor:
    - name: Simple Timer Store
      unique_id: simple_timer_store
      state_topic: simple_timer_card/timers/state
      value_template: "{{ value_json.version | default(1) }}"
      json_attributes_topic: simple_timer_card/timers
```

> **⚠️ Important:** The `state_topic` and `json_attributes_topic` must be exactly as shown above. It is also strongly recommended to keep the `value_template` as is. Please follow the [**Hybrid Model setup guide**](mqtt-hybrid-model.md) to setup a failover.

## **🎨 Styling**

The card offers flexible styling options with five distinct display styles:

- **Progress Bar Horizontal** (`bar_horizontal`): Traditional horizontal progress bar with timer information
- **Progress Bar Vertical** (`bar_vertical`): Vertical progress bar layout with timer information  
- **Background Fill Horizontal** (`fill_horizontal`): Full horizontal background color fill that progresses as timer counts down
- **Background Fill Vertical** (`fill_vertical`): Full vertical background color fill that progresses as timer counts down
- **Circle** (`circle`): Modern circular progress ring with centered timer display. Supports both clockwise (`fill`) and counter-clockwise (`drain`) progress modes

The `layout` parameter controls the card appearance when there are no active timers, while `style` controls active timer display. This separation allows any combination of layout and style for maximum flexibility.

### **Progress Mode Options**

When using `circle`, `bar_horizontal`, or `bar_vertical` styles, you can control the progress animation:

- **`drain`** (default): Progress shrinks/empties as time counts down - circle empties, bars decrease
- **`fill`**: Progress grows as time elapses - circle fills up, bars increase
- **`milestones`**: Progress bar is divided into segments based on time units (only works with bar styles: `bar_horizontal` and `bar_vertical`). Each segment represents a time unit (e.g., hours, minutes) and fills/empties as time progresses

```yaml
type: custom:simple-timer-card
style: circle
progress_mode: drain  # Counter-clockwise drain effect for circle, decreasing bar for bars
```

```yaml
type: custom:simple-timer-card
style: bar_horizontal
progress_mode: fill  # Bar grows from left to right as time elapses
```

```yaml
type: custom:simple-timer-card
style: bar_horizontal
progress_mode: milestones  # Segmented progress bar with milestone units
milestone_unit: auto  # Automatically select appropriate unit
milestone_pulse: true  # Pulse the active segment
```

> **Note:** The deprecated `circle_mode` parameter is still supported for backward compatibility but will be removed in a future version. Please use `progress_mode` instead.

### **Milestones Mode Details**

The `milestones` progress mode creates a segmented progress bar where each segment represents a unit of time. This provides a clear visual indication of progress through distinct time intervals.

**How it works:**
- The progress bar is divided into equal segments
- Each segment represents one unit of the selected time scale (hours, minutes, etc.)
- Segments fill or empty based on the `progress_mode` setting (drain vs fill)
- The currently active segment can pulse for visual feedback (controlled by `milestone_pulse`)
- The time unit is automatically selected based on timer duration when `milestone_unit: auto`

**Configuration options:**
- `milestone_unit`: Choose the time unit for segments (`auto`, `hours`, `minutes`, `seconds`, etc.)
- `milestone_pulse`: Enable/disable pulsing animation on the active segment (default: `true`)

**Example:**
A 30-minute timer with `milestone_unit: minutes` will show 30 segments, each representing 1 minute.

The card uses CSS custom properties that can be overridden:

```yaml
type: custom:simple-timer-card
card_mod:
  style: |
    :host {
      --stc-radius: 12px;
      --stc-chip-radius: 6px;
    }
```

## **🐛 Troubleshooting**

**Timers not persisting after browser reload:**
- Ensure you have configured a `default_timer_entity` pointing to a valid MQTT sensor
- Verify your MQTT sensor is using the exact state topic: `simple_timer_card/timers/state`

**Audio not playing:**
- Check that the audio file URL is accessible
- Verify browser audio permissions
- Test with a simple audio file first

**Notifications not working:**
- Timer notifications are now handled by Home Assistant automations
- Check the `examples/` folder for automation templates
- For MQTT timers, ensure your automation listens to `simple_timer_card/events/expired`
- For helper timers, create state trigger automations
- For native timer entities, use the built-in `timer.finished` event

**Card not loading:**
- Ensure the card is properly added to your Lovelace resources
- Check the browser console for JavaScript errors

## **📄 License**

This project is licensed under the MIT License. See the `LICENSE` file for details.

## **❤️ Support**

If you find this card useful and would like to show your support, you can buy me a coffee:

<a href="https://coff.ee/eyalgal" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
```
