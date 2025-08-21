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
storage: local                # local | helper | mqtt
entities:
  - timer.kitchen          # Home Assistant timer entity
  - timer.workout          # Another timer entity  
  - input_text.timer_helper  # Optional: for shared timers
show_timer_presets: true
timer_presets: [15, 30, 60, 120]  # minutes
expire_action: keep  # keep | dismiss | remove
```

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

- **v1.3.6:** Added MQTT-backed cross-device timer storage
- **v1.3.5:** Added support for Home Assistant timer entities (timer.*) with full control integration
- **v1.3.4:** Added JSON-based localStorage timer storage for persistent local timers
- **v1.3.3:** Editor and service call fixes
- **v1.3.2:** Previous improvements