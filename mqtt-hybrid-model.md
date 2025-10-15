# Reliable Backend Timers with the Hybrid Model

## The Problem (https://github.com/eyalgal/simple-timer-card/issues/46)

The standard MQTT setup for Simple Timer Card relies on the frontend (your browser) to check for expired timers. This means **if no UI is open**, timers might not fire notifications when they finish. Your timer could expire while you're away from your device, and you'd miss the notification entirely.

## The Solution

The **Hybrid Model** solves this by adding a backend "Companion Automation" in Home Assistant. This automation acts as a **failsafe**, guaranteeing timers are handled even when the UI is closed. 

You get the best of both worlds:
- **Instant UI feedback** when you're viewing the card
- **Backend reliability** when the UI is closed
- **No duplicate notifications** - smart detection prevents double alerts

---

## Setup Guide

### 1. Configure the MQTT Sensor

First, for persistent timers that sync across devices, you need to configure an MQTT sensor. Add the following to your `configuration.yaml`:

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

> ⚠️ **Important:** The `state_topic` and `json_attributes_topic` must be exactly as shown.

After adding this, restart Home Assistant to create the sensor.

---

### 2. Set Up the Backend Failsafe

#### A. Create a Helper to Track Timers

This helper prevents the backend from sending duplicate notifications. You can create it using either the UI or YAML.

#### Method A: Using the UI (Recommended)

 1. Go to **Settings** > **Devices & Services**.
 2. Select the **Helpers** tab.
 3. Click **Create Helper** and choose **Text**.
 4. Set the **Name** to `Simple Timer Card Backend Processed`.
 5. **Important:** The entity ID will automatically become `input_text.simple_timer_card_backend_processed`. Leave this as is.
 6. Click **Create**.
 
#### Method B: Using YAML

Add the following to your `configuration.yaml`:
```
# configuration.yaml
input_text:
  simple_timer_card_backend_processed:
    name: "Simple Timer Card Backend Processed"
    max: 255
```
After adding this, restart Home Assistant or reload helpers from **Developer Tools** → **YAML** → **Reload all YAML configuration** → **Input text**.

---

#### B. Create the Companion Automation

This automation runs every second to check for expired timers that the UI might have missed. Create a new automation in Home Assistant:

```yaml
alias: "Simple Timer Card: Backend Failsafe"
description: "Handles expired MQTT timers when no UI is open"
trigger:
  - platform: time_pattern
    seconds: "/1"
condition:
  - condition: template
    value_template: "{{ states('sensor.simple_timer_store') not in ['unknown', 'unavailable'] and state_attr('sensor.simple_timer_store', 'timers') | count > 0 }}"
action:
  - repeat:
      for_each: "{{ state_attr('sensor.simple_timer_store', 'timers') }}"
      sequence:
        - if:
            # Condition 1: Is the timer's end time in the past?
            - condition: template
              value_template: "{{ repeat.item.end < (now().timestamp() * 1000) }}"
            # Condition 2: Have we NOT already processed this timer?
            - condition: template
              value_template: "{{ repeat.item.id not in states('input_text.simple_timer_card_backend_processed') }}"
          then:
            # If both are true, just fire the event. The notification automation will handle the rest.
            - event: stc_timer_expired
              event_data:
                id: "{{ repeat.item.id }}"
                label: "{{ repeat.item.label }}"
  # This part of the automation cleans up very old IDs from the helper to prevent it from getting too long.
  - if:
      - condition: template
        value_template: "{{ states('input_text.simple_timer_card_backend_processed') | length > 200 }}"
    then:
      - service: input_text.set_value
        target:
          entity_id: input_text.simple_timer_card_backend_processed
        data:
          value: "{{ states('input_text.simple_timer_card_backend_processed').split(',')[-10:] | join(',') }}"
mode: single
```

> ⚠️ **Important:** If you changed the sensor name in Step 1, update the `sensor_entity` variable in this automation to match.

---

### 3. Create Your Notification Automation

Now create an automation that listens for timer expiry events from **both** the frontend and the backend. Here's an example:

```yaml
alias: "Timer Notification: Timer Finished"
description: "Sends a push notification when any timer expires"
trigger:
  # Trigger 1: From the Simple Timer Card UI (Frontend)
  - platform: mqtt
    topic: simple_timer_card/events/expired
    id: "frontend"

  # Trigger 2: From the Failsafe Automation (Backend)
  - platform: event
    event_type: stc_timer_expired
    id: "backend"

variables:
  timer_id: "{{ trigger.payload_json.id if trigger.id == 'frontend' else trigger.event.data.id }}"
  timer_label: "{{ trigger.payload_json.label if trigger.id == 'frontend' else trigger.event.data.label }}"

action:
  # This 'if' block now acts as our condition to prevent duplicate runs.
  - if:
      - condition: template
        value_template: "{{ timer_id not in states('input_text.simple_timer_card_backend_processed') }}"
    then:
      # If the timer is new, immediately add its ID to our helper to "claim" it.
      - service: input_text.set_value
        target:
          entity_id: input_text.simple_timer_card_backend_processed
        data:
          value: "{{ states('input_text.simple_timer_card_backend_processed') ~ ',' ~ timer_id }}"
      
      # Then, send the notification.
      - service: notify.mobile_app_your_phone # <-- Your notification service
        data:
          title: "⏱️ Timer Expired"
          message: "{{ timer_label | default('Timer') }} is done!"
          data:
            tag: "timer_{{ timer_id | default('unknown') }}"
            channel: Timers
            importance: high
            notification_icon: mdi:timer-outline

# 'single' mode is still useful as a final safety net.
mode: single
```

> **Key Points:**
> - Both triggers listen to the same MQTT topic
> - The `mode: single` setting prevents duplicate notifications if both frontend and backend fire at the same time
> - The `tag` in notification data ensures only one notification per timer appears

---

## You're All Set!

Your timers are now fully reliable:
- **Frontend fires events** when you're viewing the card
- **Backend failsafe** catches any timers the frontend missed
- **No duplicates** thanks to smart deduplication
