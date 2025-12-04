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

* **Flexible Display Styles:** Choose from five distinct timer display styles: `fill_horizontal`, `fill_vertical`, `bar_horizontal`, `bar_vertical`, or `circle`.
* **Progress Animation Modes:** Circle and bar styles support both `drain` (shrinks/empties) and `fill` (grows) progress animations for visual preference.
* **Dual Layout Control:** Separate `layout` (for no-timers state) and `style` (for active timers) options allow any combination.
* **Timer Presets:** Quick-access buttons for commonly used timer durations. Supports both minutes and seconds format (e.g., `5`, `90s`).
* **Timer Name Presets:** Predefined timer names for quick selection when creating timers (e.g., "Break", "Exercise", "Cooking").
* **Custom Timers:** Set custom timer durations using minute/second buttons or manual input with flexible format support (`5m`, `90s`, `1h30m`, `2:30`). Default duration can be customized via `default_new_timer_duration_mins` parameter.
* **Persistent Storage:** Support for local browser storage or MQTT integration for timers that survive reloads and sync across devices. MQTT publishes both `started` and `expired` events for automation triggers.
* **Audio Notifications:** Play custom audio files when timers expire, with repeat counts and play-until-dismissed options.
* **Alexa Integration:** Separate audio settings for Alexa devices, based on [alexa_media_player](https://github.com/alandtse/alexa_media_player).
* **Voice PE Integration:** Full support for Voice PE timers with template sensors - [see setup guide](voice-pe.md).
* **Timer Actions:** Configurable actions when timers expire (keep, dismiss, or auto-dismiss).
* **Snooze Functionality:** Easily snooze expired timers for additional time.
* **Active Timer Management:** View and manage multiple active timers simultaneously.
* **Smart Auto-Detection & Entity Integration:** Automatic detection of timer sources with ISO date validation and entity type checking. Connect to Home Assistant entities including MQTT sensors, input helpers, and more.
* **Customizable Appearance:** Adjust colors, icons, and styling to match your Home Assistant theme.
* **Native Theme Integration:** Automatically uses Home Assistant theme colors and native UI elements.
* **Visual Progress Indicators:** Clear visual feedback showing timer progress and status.
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

| Name                     | Type      | Default                 | Description                                                                                        |
| :----------------------- | :-------- | :---------------------- | :------------------------------------------------------------------------------------------------- |
| `type`                   | `string`  | **Required**            | `custom:simple-timer-card`                                                                        |
| `layout`                 | `string`  | `horizontal`            | Card layout for no-timers state. Can be `horizontal` or `vertical`                                |
| `style`                  | `string`  | `bar_horizontal`        | Timer display style. Can be `fill_vertical`, `fill_horizontal`, `bar_vertical`, `bar_horizontal` (default), or `circle` |
| `title`                  | `string`  | `null`                  | Optional title for the card                                                                        |
| `entities`               | `array`   | `[]`                    | Array of timer entities to display                                                                |
| `progress_mode`          | `string`  | `drain`                 | Progress animation mode: `drain` (shrinks as time counts down) or `fill` (grows as time elapses). Applies to `circle`, `bar_horizontal`, and `bar_vertical` styles. **Note:** `circle_mode` is deprecated in favor of `progress_mode` |

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
- **Alexa**: Amazon Alexa timers via [alexa_media_player](https://github.com/alandtse/alexa_media_player) integration
- **Timer**: Native Home Assistant timer entities (`timer.*`)
- **Voice PE**: Voice PE integration timers with `display_name` attribute support
- **Helper**: Input text/text entities for manual timer management
- **Timestamp**: Sensor entities with timestamp device class. Supports optional `start_time_attr` attribute or separate `start_time_entity` for duration calculation
- **Minutes Attr**: Sensors with custom minutes-to-arrival attributes

> **💡 Style Options:** The `style` parameter supports five distinct visual presentations with direction control. The `layout` parameter controls how the card appears when there are no active timers, while `style` controls the active timer display. Any layout/style combination is possible for maximum flexibility.

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

### **Storage & Persistence**

| Name                    | Type      | Default | Description                                                                                        |
| :---------------------- | :-------- | :------ | :------------------------------------------------------------------------------------------------- |
| `default_timer_entity`  | `string`  | `null`  | Entity ID for timer storage (MQTT sensor)                                                         |

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

| Name                              | Type      | Default | Description                                                                                        |
| :-------------------------------- | :-------- | :------ | :------------------------------------------------------------------------------------------------- |
| `audio_enabled`                   | `boolean` | `false` | Enable audio notifications when timers expire                                                     |
| `audio_file_url`                  | `string`  | `""`    | URL or path to audio file to play                                                                 |
| `audio_repeat_count`              | `number`  | `1`     | Number of times to repeat the audio (1-10)                                                        |
| `audio_play_until_dismissed`      | `boolean` | `false` | Continue playing audio until timer is dismissed or snoozed                                        |

### **Alexa Audio Settings**

| Name                              | Type      | Default | Description                                                                                        |
| :-------------------------------- | :-------- | :------ | :------------------------------------------------------------------------------------------------- |
| `alexa_audio_enabled`             | `boolean` | `false` | Enable separate audio settings for Alexa devices                                                  |
| `alexa_audio_file_url`            | `string`  | `""`    | URL or path to audio file for Alexa devices                                                       |
| `alexa_audio_repeat_count`        | `number`  | `1`     | Number of times to repeat Alexa audio (1-10)                                                      |
| `alexa_audio_play_until_dismissed`| `boolean` | `false` | Continue playing Alexa audio until timer is dismissed or snoozed                                  |

## **🔔 Notifications**

This card focuses on timer display and management. For notifications when timers expire, use Home Assistant automations.

### **MQTT Timers**
If using MQTT storage, the card publishes events to:
- `simple_timer_card/events/started` when timers are created
- `simple_timer_card/events/expired` when timers finish

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

> **Note:** The deprecated `circle_mode` parameter is still supported for backward compatibility but will be removed in a future version. Please use `progress_mode` instead.

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
