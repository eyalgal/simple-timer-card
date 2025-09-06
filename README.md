# ⏱️ Simple Timer Card for Home Assistant
[![GitHub Release][release_badge]][release]
[![Community Forum][forum_badge]][forum]
[![Buy Me A Coffee][bmac_badge]][bmac]

<!-- Link references -->
[release_badge]: https://img.shields.io/github/v/release/eyalgal/simple-timer-card
[release]: https://github.com/eyalgal/simple-timer-card/releases
[forum_badge]: https://img.shields.io/badge/Community-Forum-5294E2.svg
[forum]: https://community.home-assistant.io/
[bmac_badge]: https://img.shields.io/badge/buy_me_a-coffee-yellow
[bmac]: https://www.buymeacoffee.com/eyalgal

A versatile and highly customizable timer card for Home Assistant Lovelace, offering multiple display styles and support for various timer sources.

<img width="1000" alt="Simple Timer Card Design" src="https://github.com/user-attachments/assets/d1c562d4-c3e4-4069-b22f-2f3aab58e40b" />

> **Note**
> This card provides a clean and intuitive interface for managing timers in Home Assistant. It supports both local storage and MQTT integration for persistent timers that survive browser reloads and stay synchronized across devices.

## **✨ Features**

* **Multiple Display Styles:** Choose between horizontal or vertical layouts with progress bar, background fill, or circular progress styles.
* **Timer Presets:** Quick-access buttons for commonly used timer durations (customizable).
* **Custom Timers:** Set custom timer durations using minute buttons or manual input.
* **Persistent Storage:** Support for local browser storage or MQTT integration for timers that survive reloads and sync across devices.
* **Audio Notifications:** Play custom audio files when timers expire, with support for repeat counts.
* **Mobile Push Notifications:** Send push notifications to selected mobile devices when timers expire, with customizable titles and messages.
* **Alexa Integration:** based on [alexa_media_player](https://github.com/alandtse/alexa_media_player).
* **Timer Actions:** Configurable actions when timers expire (keep, dismiss, or auto-dismiss).
* **Snooze Functionality:** Easily snooze expired timers for additional time.
* **Active Timer Management:** View and manage multiple active timers simultaneously.
* **Entity Integration:** Connect to Home Assistant MQTT sensors for data persistence.
* **Customizable Appearance:** Adjust colors, icons, and styling to match your Home Assistant theme.
* **Native Theme Integration:** Automatically uses Home Assistant theme colors and native UI elements.
* **Visual Progress Indicators:** Clear visual feedback showing timer progress and status.

## **✅ Requirements**

* **Home Assistant:** Version 2023.4 or newer
* **Optional:** [MQTT sensor](https://github.com/eyalgal/simple-timer-card?tab=readme-ov-file#-mqtt-setup-for-persistent-timers) for persistent timer storage

## **🚀 Installation**

**HACS**

Simple Timer Card is available in [HACS](https://hacs.xyz/) (Home Assistant Community Store).

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=eyalgal&repository=simple-timer-card&category=plugin)

<!--- 1. Install HACS if you don't have it already
2. Open HACS in Home Assistant
3. Search for "Simple Timer Card"
4. Click the download button ⬇️
--->
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
| `layout`                 | `string`  | `horizontal`            | Card layout. Can be `horizontal` or `vertical`                                                    |
| `style`                  | `string`  | `bar`                   | Timer display style. Can be `bar` (progress bar), `fill` (background fill), or `circle` (circular progress)  |
| `title`                  | `string`  | `null`                  | Optional title for the card                                                                        |
| `entities`               | `array`   | `[]`                    | Array of timer entities to display                                                                |

> **💡 Style Options:** The `style` parameter supports three distinct visual presentations. Each style works with both horizontal and vertical layouts, giving you complete flexibility in how timers are displayed.

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

### **Storage & Persistence**

| Name                    | Type      | Default | Description                                                                                        |
| :---------------------- | :-------- | :------ | :------------------------------------------------------------------------------------------------- |
| `default_timer_entity`  | `string`  | `null`  | Entity ID for timer storage (MQTT sensor)                                                         |

### **Expiry & Actions**

| Name                           | Type      | Default      | Description                                                                                        |
| :----------------------------- | :-------- | :----------- | :------------------------------------------------------------------------------------------------- |
| `expire_action`                | `string`  | `keep`       | Action when timer expires: `keep`, `dismiss`, or `auto_dismiss`                                   |
| `expire_keep_for`              | `number`  | `120`        | How long to keep expired timers (in seconds) before auto-dismissing                               |
| `auto_dismiss_writable`        | `boolean` | `false`      | Allow expired timers to be dismissed automatically                                                |
| `snooze_duration`              | `number`  | `5`          | Default snooze duration in minutes                                                                |
| `expired_subtitle`             | `string`  | `Time's up!` | Message displayed when timer expires                                                              |
| `show_progress_when_unknown`   | `boolean` | `false`      | Show progress bar even when timer duration is unknown                                             |

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

### **Mobile Push Notifications**

| Name                              | Type      | Default              | Description                                                                                        |
| :-------------------------------- | :-------- | :------------------- | :------------------------------------------------------------------------------------------------- |
| `notify_on_expire`                | `boolean` | `false`              | Enable push notifications to mobile devices when timers expire                                    |
| `notify_title`                    | `string`  | `"⏱ Timer done"`     | Title for push notifications (supports {label} template)                                          |
| `notify_message`                  | `string`  | `"{label} is up."`   | Message for push notifications (supports {label} template)                                        |
| `notify_device_ids`               | `array`   | `[]`                 | Array of mobile device IDs to send notifications to                                               |

## **🎯 Usage Examples**

### **Basic Timer Card**

A simple timer card with default presets and horizontal layout:

```yaml
type: custom:simple-timer-card
title: Kitchen Timer
```

### **Vertical Layout with Custom Presets**

Perfect for narrow dashboard spaces:

```yaml
type: custom:simple-timer-card
layout: vertical
title: Quick Timer
timer_presets: [10, 20, 45]
style: fill
```

### **Circle Style Timer**

Modern circular progress display with custom colors:

```yaml
type: custom:simple-timer-card
title: Focus Timer
style: circle
timer_presets: [15, 25, 45]
default_timer_color: '#2196f3'
default_timer_icon: 'mdi:brain'
```

### **Persistent Timer with Audio**

Timer that survives browser reloads and plays audio when expired:

```yaml
type: custom:simple-timer-card
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
title: Workout Timer
layout: horizontal
style: bar
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
title: Cooking Timer
style: circle
timer_presets: [3, 5, 8, 12, 15, 20, 25, 30]
show_active_header: true
audio_enabled: true
audio_file_url: /local/sounds/kitchen_timer.mp3
default_timer_color: '#ff6b35'
default_timer_icon: 'mdi:chef-hat'
```

### **Mobile Notification Timer**

Timer with push notifications to mobile devices:

```yaml
type: custom:simple-timer-card
title: Study Timer
timer_presets: [25, 45, 60] # Pomodoro-style intervals
notify_on_expire: true
notify_title: "📚 Study Timer Complete"
notify_message: "{label} session is finished!"
notify_device_ids:
  - device_id_of_your_phone
  - device_id_of_other_phone
audio_enabled: true
audio_file_url: /local/sounds/study_bell.mp3
```

> **💡 Device Selection:** Use the visual editor to select mobile devices from a dropdown list rather than manually entering device IDs.

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

The card offers flexible styling options with three distinct display styles:

- **Progress Bar** (`bar`): Traditional horizontal progress bar with timer information
- **Background Fill** (`fill`): Full background color fill that progresses as timer counts down  
- **Circle** (`circle`): Modern circular progress ring with centered timer display

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

**Mobile notifications not working:**
- Ensure you have selected mobile devices in the card configuration
- Verify your mobile devices are connected to Home Assistant with the mobile app
- Check that the `notify.mobile_app` service is available in your Home Assistant instance
- Test notifications manually using Developer Tools > Services

**Card not loading:**
- Ensure the card is properly added to your Lovelace resources
- Check the browser console for JavaScript errors

## **📄 License**

This project is licensed under the MIT License. See the `LICENSE` file for details.

## **❤️ Support**

If you find this card useful and would like to show your support, you can buy me a coffee:

<a href="https://coff.ee/eyalgal" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
