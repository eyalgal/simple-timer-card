# Simple Timer Card

A Home Assistant custom card for displaying and managing timers from various sources with a clean, minimal interface.

## Features

- **Multiple Timer Sources:**
  - Alexa timers (read-only)
  - **NEW:** Home Assistant timer entities (timer.*)
  - device_class: timestamp sensors (completion times)
  - sensors with numeric "minutes to arrival" attribute (ETA)
  - input_text helper entities (JSON store) for shared timers
  - localStorage JSON storage for persistent local timers
  - **NEW:** MQTT retained storage for cross-device sync

- **Timer Management:**
  - Create timers with custom durations and labels
  - Quick preset timer buttons (15m, 30m, 1h, 2h, etc.)
  - Snooze, dismiss, and cancel timer operations
  - Automatic expiration handling with configurable policies

- **Audio Notifications:**
  - **NEW:** Play audio files when timers expire
  - Support for locally hosted audio files (MP3, WAV, etc.)
  - Configurable repeat count (1-10 times)
  - Automatic state tracking to prevent duplicate notifications

- **Display Options:**
  - Multiple layout styles: vertical, horizontal
  - Progress indicators: bar, circle, chip
  - Customizable colors and icons

## JSON Timer Storage

The card now supports persistent local timer storage using JSON format in localStorage. This provides:

- **Persistence:** Timers survive page refreshes and browser restarts
- **No Dependencies:** Works without requiring input_text helper entities
- **JSON Format:** Clean, structured data format
- **Isolation:** Each card instance maintains separate timer storage

### Storage Format

```json
{
  "timers": [
    {
      "id": "preset-1640995200000",
      "label": "15 minutes",
      "icon": "mdi:timer-outline", 
      "color": "var(--primary-color)",
      "end": 1640996100000,
      "duration": 900000,
      "source": "local",
      "source_entity": "local"
    }
  ],
  "version": 1,
  "lastUpdated": 1640995200000
}
```

### Storage Key

Each card instance uses a unique localStorage key: `simple-timer-card-timers-{title}`

## Cross-device storage via MQTT (retained)

The card supports MQTT-backed timer storage for sharing timers across multiple devices and browsers. This provides:

- **Cross-device sync:** Timers appear on all devices instantly
- **Persistence:** Timers survive server restarts (retained messages)
- **Real-time updates:** Changes sync within 1-2 seconds
- **No local storage:** Data stored on MQTT broker

### Home Assistant Configuration

Add this to your `configuration.yaml` (or packages):

```yaml
mqtt:
  # Assume broker already configured

sensor:
  - platform: mqtt
    name: Simple Timer Store
    unique_id: simple_timer_store
    state_topic: simple_timer_card/timers/state
    value_template: "{{ value_json.version | default(1) }}"
    json_attributes_topic: simple_timer_card/timers
```

### Card Configuration

```yaml
type: custom:simple-timer-card
title: Kitchen Timers
storage: mqtt                        # Enable MQTT storage
mqtt:
  topic: simple_timer_card/timers          # Retained payload topic (JSON)
  state_topic: simple_timer_card/timers/state  # Tiny numeric state (optional)
  sensor_entity: sensor.simple_timer_store     # HA MQTT sensor exposing attributes
show_timer_presets: true
timer_presets: [15, 30, 60, 120]
```

### How it works

- The card publishes timer data as JSON to `simple_timer_card/timers` with `retain: true`
- Home Assistant MQTT sensor exposes this data via its `attributes.timers`
- Multiple cards/devices read from the same sensor for instant sync
- Optional state topic publishes version info to keep sensor state evolving

### Clearing MQTT timers

To clear all timers, publish an empty payload:

```yaml
service: mqtt.publish
data:
  topic: simple_timer_card/timers
  payload: '{"timers":[],"version":1}'
  retain: true
```

## Configuration

```yaml
type: custom:simple-timer-card
title: My Timers
# storage is now automatic - no need to configure manually
entities:
  - timer.kitchen          # Home Assistant timer entity
  - timer.workout          # Another timer entity  
  - input_text.timer_helper  # Optional: for shared timers (enables helper storage)
show_timer_presets: true
timer_presets: [15, 30, 60, 120]  # minutes
expire_action: keep  # keep | dismiss | remove
audio_enabled: true  # Enable audio notifications
audio_file_url: /local/timer-sound.mp3  # Path to audio file
audio_repeat_count: 3  # Number of times to play audio (1-10)
```

### Automatic Storage Selection

The card automatically determines the best storage backend based on your configuration:

- **Local Storage**: Used when no special entities are configured
  - Timers persist in browser localStorage
  - No external dependencies required

- **Helper Storage**: Used when `input_text` or `text` entities are configured
  - Timers stored in Home Assistant helper entities
  - Enables sharing timers across multiple card instances

- **MQTT Storage**: Used when the configured MQTT sensor entity is referenced
  - Timers stored in MQTT for cross-device synchronization  
  - Requires MQTT broker and sensor configuration

**Examples:**
```yaml
# Automatic local storage (no entities)
type: custom:simple-timer-card
show_timer_presets: true

# Automatic helper storage (helper entities configured)
type: custom:simple-timer-card
entities:
  - input_text.kitchen_timers

# Automatic MQTT storage (MQTT sensor configured)
type: custom:simple-timer-card
entities:
  - sensor.simple_timer_store
mqtt:
  sensor_entity: sensor.simple_timer_store
```

### Audio Configuration

To use audio notifications:

1. **Upload Audio File**: Place your audio file (MP3, WAV, etc.) in the `/config/www/` directory
2. **Set Audio URL**: Use `/local/filename.mp3` format in the configuration
3. **Configure Repeat**: Set how many times the audio should play (1-10 times)
4. **Enable Audio**: Toggle the audio notifications on/off

**Example audio file paths:**
- Local file: `/local/timer-sound.mp3`
- External URL: `https://example.com/sound.wav`
- Longer path: `/local/sounds/timer-finished.mp3`

**Note**: Due to browser security policies, audio may require user interaction before playing. Test your setup to ensure audio plays correctly in your environment.
=======
### Timer Entity Support

The card automatically detects and supports Home Assistant timer entities (`timer.*`):

- **States:** Displays `active` and `paused` timers
- **Controls:** Cancel (timer.cancel), Dismiss (timer.finish), Snooze (timer.start)
- **Attributes:** Uses `finishes_at`, `remaining`, and `duration` attributes
- **Icons:** `mdi:timer` for active, `mdi:timer-pause` for paused timers

## Installation

1. Copy `simple-timer-card.js` to your `www` folder
2. Add the resource in your Lovelace configuration
3. Add the card to your dashboard

## Version History

- **v1.4.1:** Fixed custom timer creation and implemented automatic storage selection
  - Fixed bug where custom timers for sensor entities failed to save properly
  - Removed manual storage selector from editor - storage is now automatically determined
  - Improved storage selection logic to analyze all configured entities
  - Added informational storage type display in editor
- **v1.3.6:** Added MQTT-backed cross-device timer storage
- **v1.4.0:** Added audio notification support for timer expiration with configurable repeat count
- **v1.3.5:** Added support for Home Assistant timer entities (timer.*) with full control integration
- **v1.3.4:** Added JSON-based localStorage timer storage for persistent local timers
- **v1.3.3:** Editor and service call fixes
- **v1.3.2:** Previous improvements