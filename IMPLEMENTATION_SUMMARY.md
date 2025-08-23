## Paused Alexa Timer Support - Implementation Summary

### Problem
The simple-timer-card was only showing active Alexa timers from the `sorted_active` attribute and ignoring paused timers, causing them to disappear from the timer list when paused.

### Solution
Enhanced the `_parseAlexa` function to support both active and paused Alexa timers:

#### Key Changes:

1. **Enhanced Timer Parsing** (`_parseAlexa` function):
   - Now checks both `sorted_active` and `sorted_paused` attributes
   - Paused timers get distinct visual styling (pause icon and warning color)
   - Added `paused: true/false` property to timer objects

2. **Visual Indicators**:
   - Paused timers show `mdi:timer-pause` icon (vs `mdi:timer-outline` for active)
   - Paused timers use warning color (`var(--warning-color)`) vs default blue
   - Status text shows "(Paused)" suffix for paused timers

3. **Behavior Adjustments**:
   - Paused timers show static remaining time (don't count down)
   - Paused timers don't trigger audio notifications when time expires
   - Progress bars are hidden for paused timers

#### Expected Alexa Entity Format:
```json
{
  "attributes": {
    "sorted_active": [
      ["timer-id", {
        "timerLabel": "Pizza",
        "triggerTime": 1640995200000,
        "originalDurationInMillis": 900000
      }]
    ],
    "sorted_paused": [
      ["timer-id-2", {
        "timerLabel": "1h timer", 
        "triggerTime": 1640998800000,
        "originalDurationInMillis": 3600000
      }]
    ]
  }
}
```

### Testing
- Verified logic with comprehensive unit tests
- Handles cases with active only, paused only, both, or neither
- Maintains backward compatibility with existing active timer functionality

This change ensures paused Alexa timers remain visible in the timer list with appropriate visual indicators, matching the behavior users expect.