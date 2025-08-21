# Simple Timer Card

A Home Assistant custom card for displaying and managing timers from various sources with a clean, minimal interface.

## Features

- **Multiple Timer Sources:**
  - Alexa timers (read-only)
  - device_class: timestamp sensors (completion times)
  - sensors with numeric "minutes to arrival" attribute (ETA)
  - input_text helper entities (JSON store) for shared timers
  - **NEW:** localStorage JSON storage for persistent local timers

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

## Configuration

```yaml
type: custom:simple-timer-card
title: My Timers
entities:
  - input_text.timer_helper  # Optional: for shared timers
show_timer_presets: true
timer_presets: [15, 30, 60, 120]  # minutes
expire_action: keep  # keep | dismiss | remove
```

## Installation

1. Copy `simple-timer-card.js` to your `www` folder
2. Add the resource in your Lovelace configuration
3. Add the card to your dashboard

## Version History

- **v1.3.4:** Added JSON-based localStorage timer storage for persistent local timers
- **v1.3.3:** Editor and service call fixes
- **v1.3.2:** Previous improvements