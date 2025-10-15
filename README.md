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
* **Circular Progress Modes:** Circle style supports both clockwise fill and counter-clockwise drain progress animations.
* **Dual Layout Control:** Separate `layout` (for no-timers state) and `style` (for active timers) options allow any combination.
* **Timer Presets:** Quick-access buttons for commonly used timer durations (customizable).
* **Timer Name Presets:** Predefined timer names for quick selection when creating timers (e.g., "Break", "Exercise", "Cooking").
* **Custom Timers:** Set custom timer durations using minute buttons or manual input.
* **Persistent Storage:** Support for local browser storage or MQTT integration for timers that survive reloads and sync across devices.
* **Audio Notifications:** Play custom audio files when timers expire, with repeat counts and play-until-dismissed options.
* **Alexa Integration:** Separate audio settings for Alexa devices, based on [alexa_media_player](https://github.com/alandtse/alexa_media_player).
* **Voice PE Integration:** Full support for Voice PE timers with template sensors - [see setup guide](voice-pe.md).
* **Timer Actions:** Configurable actions when timers expire (keep, dismiss, or auto-dismiss).
* **Snooze Functionality:** Easily snooze expired timers for additional time.
* **Active Timer Management:** View and manage multiple active timers simultaneously.
* **Entity Integration:** Connect to Home Assistant entities including MQTT sensors, input helpers, and more.
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
| `circle_mode`            | `string`  | `fill`                  | Circle progress direction: `fill` (clockwise) or `drain` (counter-clockwise). Only applies when `style` is set to `circle` |

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
- **Timestamp**: Sensor entities with timestamp device class. Supports optional `start_time` attribute for duration calculation
- **Minutes Attr**: Sensors with custom minutes-to-arrival attributes

> **💡 Style Options:** The `style` parameter supports five distinct visual presentations with direction control. The `layout` parameter controls how the card appears when there are no active timers, while `style` controls the active timer display. Any layout/style combination is possible for maximum flexibility.

### **Timer Configuration**

| Name                           | Type      | Default         | Description                                                                                        |
| :----------------------------- | :-------- | :-------------- | :------------------------------------------------------------------------------------------------- |
| `timer_presets`                | `array`   | `[5, 15, 30]`   | Array of preset timer durations in minutes                                                        |
| `show_timer_presets`           | `boolean` | `true`          | Show or hide the timer preset buttons                                                             |
| `minute_buttons`               | `array`   | `[1, 5, 10]`    | Array of minute increment buttons for custom timers                                               |
| `show_time_selector`           | `boolean` | `false`         | Show manual time input selector                                                                    |
| `show_active_header`           | `boolean` | `true`          | Show "Active Timers" header section                                                               |
| `default_timer_icon`           | `string`  | `mdi:timer-outline` | Default icon for timer cards                                                                   |
| `default_timer_color`          | `string`  | `var(--primary-color)` | Default color for timer elements                                                            |
| `timer_name_presets`           | `array`   | `[]`                | Array of preset timer names for quick selection when creating timers (e.g., `['Break', 'Exercise']`)        |

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
If using MQTT storage, the card publishes events to `simple_timer_card/events/expired` when timers finish. See `examples/mqtt_timer_notifications.yaml` for a mobile notification automation.

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

## **✨ New in v1.3.5: Reliable Backend Timers with the Hybrid Model ✨**

The standard MQTT timer setup works great for most use cases, but it has one limitation: the frontend (your browser) needs to be open to check for expired timers and fire notifications. If you close all browser tabs with Home Assistant, timer expiry events might not be published until you reopen the UI.

**The Hybrid Model** solves this by adding a backend "Companion Automation" in Home Assistant. This automation acts as a failsafe, running on your Home Assistant server every second to check for expired timers—guaranteeing timers are handled even when the UI is closed. This gives you the best of both worlds: instant UI feedback when you're viewing the dashboard, and backend reliability when you're not. 🚀

### 🔧 1. Configure the MQTT Sensor

First, for persistent timers that sync across devices, you need to configure an MQTT sensor. Add the following to your `configuration.yaml`:

```yaml
# configuration.yaml
mqtt:
  sensor:
    - name: "Simple Timer Card Timers" # You can change the name
      unique_id: simple_timer_card_timers
      state_topic: "simple_timer_card/timers/state"
      value_template: "{{ value_json.version | default(1) }}"
      json_attributes_topic: "simple_timer_card/timers"
```

> **⚠️ Important:** The `state_topic` and `json_attributes_topic` must be exactly as shown.

### 🚀 2. Set Up the Backend Failsafe

#### A. Create a Helper to Track Timers

This `input_text` helper prevents the backend from sending duplicate notifications for the same timer:

```yaml
# configuration.yaml or helpers.yaml
input_text:
  simple_timer_card_backend_processed:
    name: "Simple Timer Card Backend Processed"
    max: 255
    initial: ""
```

#### B. Create the Companion Automation

This automation runs every second to check for expired timers that the UI might have missed. Add this automation to your Home Assistant configuration:

```yaml
alias: "Simple Timer Card: Backend Failsafe"
description: "Checks for expired timers every second and publishes events if the UI missed them"
triggers:
  - trigger: time_pattern
    seconds: "*"
conditions: []
actions:
  - variables:
      timers: >-
        {{ state_attr('sensor.simple_timer_card_timers', 'timers') | default([]) }}
      now_ts: "{{ now().timestamp() }}"
      processed_ids: >-
        {{ states('input_text.simple_timer_card_backend_processed').split(',') | list }}
  - repeat:
      for_each: "{{ timers }}"
      sequence:
        - variables:
            timer_id: "{{ repeat.item.id }}"
            expires_at: "{{ repeat.item.expiresAt / 1000 }}"
            is_expired: "{{ expires_at <= now_ts }}"
            already_processed: "{{ timer_id in processed_ids }}"
        - if:
            - condition: template
              value_template: "{{ is_expired and not already_processed }}"
          then:
            - action: mqtt.publish
              data:
                topic: simple_timer_card/events/expired
                payload: >-
                  {{ {
                    'id': repeat.item.id,
                    'label': repeat.item.label,
                    'source': 'backend'
                  } | to_json }}
            - action: input_text.set_value
              target:
                entity_id: input_text.simple_timer_card_backend_processed
              data:
                value: >-
                  {% set current = states('input_text.simple_timer_card_backend_processed') %}
                  {% if current == '' %}
                    {{ timer_id }}
                  {% else %}
                    {{ current }},{{ timer_id }}
                  {% endif %}
  - variables:
      active_timer_ids: "{{ timers | map(attribute='id') | list }}"
  - action: input_text.set_value
    target:
      entity_id: input_text.simple_timer_card_backend_processed
    data:
      value: >-
        {% set processed = states('input_text.simple_timer_card_backend_processed').split(',') %}
        {% set valid = processed | select('in', active_timer_ids) | list %}
        {{ valid | join(',') }}
mode: single
```

> **⚠️ Important:** If you named your sensor differently in step 1, update `sensor.simple_timer_card_timers` in the automation above to match your sensor name.

### ✅ 3. Create Your Notification Automation

This is an example automation that listens for timer expiry events from **both** the frontend and the backend. The two triggers and the `mode: single` setting ensure you won't receive duplicate notifications:

```yaml
alias: "Timer Notification: Kitchen Timer Finished"
description: "Sends notification when kitchen timer expires (hybrid model)"
triggers:
  - trigger: mqtt
    topic: simple_timer_card/events/expired
    value_template: "{{ value_json.source == 'frontend' }}"
  - trigger: mqtt
    topic: simple_timer_card/events/expired
    value_template: "{{ value_json.source == 'backend' }}"
conditions:
  - condition: template
    value_template: "{{ 'Kitchen' in trigger.payload_json.label }}"
actions:
  - action: notify.mobile_app_your_phone
    data:
      title: "🍳 Kitchen Timer Finished"
      message: "{{ trigger.payload_json.label }} is done!"
      data:
        tag: "timer_{{ trigger.payload_json.id }}"
        channel: Timers
        importance: high
        notification_icon: mdi:timer-outline
mode: single
```

With this setup complete, your MQTT timers will fire reliably whether your Home Assistant UI is open or closed! 🎉

## **🎯 Usage Examples**

### **Basic Timer Card**

A simple timer card with default presets and horizontal layout:

```yaml
type: custom:simple-timer-card
entities: []
title: Kitchen Timer
```

### **Vertical Layout with Custom Presets**

Perfect for narrow dashboard spaces with vertical fill display:

```yaml
type: custom:simple-timer-card
entities: []
layout: vertical
title: Quick Timer
timer_presets: [10, 20, 45]
style: fill_vertical
```

### **Circle Style Timer**

Modern circular progress display with custom colors:

```yaml
type: custom:simple-timer-card
entities: []
title: Focus Timer
style: circle
timer_presets: [15, 25, 45]
default_timer_color: '#2196f3'
default_timer_icon: 'mdi:brain'
```

### **Circle Timer with Drain Mode and Name Presets**

Counter-clockwise circle progress with predefined timer names:

```yaml
type: custom:simple-timer-card
entities: []
title: Activity Timer
style: circle
circle_mode: drain
timer_presets: [5, 10, 15, 30]
timer_name_presets: ['Break', 'Exercise', 'Meditation', 'Reading', 'Work Session']
default_timer_color: '#9c27b0'
default_timer_icon: 'mdi:clock-outline'
```

### **Persistent Timer with Audio**

Timer that survives browser reloads and plays audio when expired:

```yaml
type: custom:simple-timer-card
entities: []
title: Study Timer
default_timer_entity: sensor.timer_storage_mqtt
audio_enabled: true
audio_file_url: /local/sounds/timer_bell.mp3
audio_repeat_count: 3
timer_presets: [25, 45, 60] # Pomodoro-style intervals
```

### **Advanced Configuration with MQTT**

For synchronized timers across multiple devices:

```yaml
type: custom:simple-timer-card
entities: []
title: Workout Timer
layout: horizontal
style: bar_horizontal
default_timer_entity: sensor.mqtt_timer_storage
timer_presets: [30, 45, 60, 90]
minute_buttons: [5, 10, 15]
audio_enabled: true
audio_file_url: /local/sounds/workout_bell.wav
expire_action: auto_dismiss
expire_keep_for: 60
snooze_duration: 10
```

### **Family Cooking Timer**

Multiple preset timers for different cooking tasks with modern circle display:

```yaml
type: custom:simple-timer-card
entities: []
title: Cooking Timer
style: circle
timer_presets: [3, 5, 8, 12, 15, 20, 25, 30]
timer_name_presets: ['Eggs', 'Pasta', 'Rice', 'Bread', 'Roast', 'Cookies']
show_active_header: true
audio_enabled: true
audio_file_url: /local/sounds/kitchen_timer.mp3
default_timer_color: '#ff6b35'
default_timer_icon: 'mdi:chef-hat'
```

### **MQTT Timer with Automation Notifications**

Timer with MQTT storage and automated notifications using Home Assistant automations:

```yaml
type: custom:simple-timer-card
entities: []
title: Study Timer
style: bar_vertical
timer_presets: [25, 45, 60] # Pomodoro-style intervals
default_timer_entity: sensor.study_timers
audio_enabled: true
audio_file_url: /local/sounds/study_bell.mp3
```

Then create this automation for notifications:
```yaml
alias: "Study Timer Notifications"
trigger:
  - platform: mqtt
    topic: "simple_timer_card/events/expired"
condition:
  - condition: template
    value_template: "{{ 'Study' in trigger.payload_json.label }}"
action:
  - service: notify.mobile_app_your_phone
    data:
      title: "📚 Study Timer Complete"
      message: "{{ trigger.payload_json.label }} session is finished!"
```

### **Entity Configuration Examples**

Configuration with multiple timer sources and per-entity settings:

```yaml
type: custom:simple-timer-card
title: Multi-Source Timers
entities:
  # Simple entity reference
  - timer.cooking
  # Entity with overrides
  - entity: sensor.alexa_kitchen
    name: Kitchen Alexa
    mode: alexa
    color: '#2196f3'
    icon: 'mdi:amazon-alexa'
  # Voice PE timer with display_name support
  - entity: sensor.voice_pe_timer
    mode: voice_pe
    audio_enabled: true
    audio_file_url: /local/sounds/voice_pe_alert.mp3
  # Helper entity with custom settings
  - entity: input_text.workout_timer
    mode: helper
    name: Workout Session
    keep_timer_visible_when_idle: true
    color: '#4caf50'
  # Timestamp sensor
  - entity: sensor.next_train_arrival
    mode: timestamp
    name: Next Train
    icon: 'mdi:train'
  # Custom minutes attribute
  - entity: sensor.delivery_eta
    mode: minutes_attr
    minutes_attr: 'minutes_remaining'
    name: Package Delivery
```

### **Style Showcase**

Examples of different style options:

```yaml
# Horizontal fill style
type: custom:simple-timer-card
entities: []
title: Kitchen Timer
style: fill_horizontal
layout: horizontal
audio_enabled: true
audio_file_url: /local/sounds/kitchen_bell.mp3

# Vertical bar in compact space
type: custom:simple-timer-card
entities: []
title: Compact Timer
style: bar_vertical
layout: vertical
timer_presets: [5, 10, 15]

# Circle style with audio alerts
type: custom:simple-timer-card
entities: []
title: Focus Timer
style: circle
audio_enabled: true
audio_file_url: /local/sounds/meditation_bell.mp3
audio_repeat_count: 3
```

> **💡 Automation Setup:** Check the `examples/` folder for ready-to-use automation templates that work with this card's timer events.

> **🔔 Audio Features:** The card supports local audio notifications including:
> - **Audio Notifications:** Play custom sound files when timers expire
> - **Alexa Integration:** Separate audio settings for Alexa devices
> - **Repeat Options:** Configure audio repeat counts and play-until-dismissed behavior
> - **Browser-based:** Audio plays directly in the browser, no automation required

> **🎙️ Voice PE Integration:** Full support for Voice PE timers! Voice PE users can now display their local timers in Home Assistant. [**See our setup guide →**](voice-pe.md)
> - ESPHome integration for mirroring Voice PE timers to HA sensors
> - Template sensor setup with finished state support
> - Simple Timer Card configuration examples
> - **Major user-requested feature** - seamlessly integrate your Voice PE timers!

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

> **⚠️ Important:** The `state_topic` and `json_attributes_topic` Important: The state_topic and json_attributes_topic must be exactly as shown above. It is also strongly recommend to keep the `value_template` as is.

## **🎨 Styling**

The card offers flexible styling options with five distinct display styles:

- **Progress Bar Horizontal** (`bar_horizontal`): Traditional horizontal progress bar with timer information
- **Progress Bar Vertical** (`bar_vertical`): Vertical progress bar layout with timer information  
- **Background Fill Horizontal** (`fill_horizontal`): Full horizontal background color fill that progresses as timer counts down
- **Background Fill Vertical** (`fill_vertical`): Full vertical background color fill that progresses as timer counts down
- **Circle** (`circle`): Modern circular progress ring with centered timer display. Supports both clockwise (`fill`) and counter-clockwise (`drain`) progress modes

The `layout` parameter controls the card appearance when there are no active timers, while `style` controls active timer display. This separation allows any combination of layout and style for maximum flexibility.

### **Circle Mode Options**

When using the `circle` style, you can control the progress direction:

- **`fill`** (default): Clockwise progress - circle fills up as time elapses
- **`drain`**: Counter-clockwise progress - circle empties/drains as time counts down

```yaml
type: custom:simple-timer-card
style: circle
circle_mode: drain  # Counter-clockwise drain effect
```

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
