# ✨ New in v1.3.5: Reliable Backend Timers with the Hybrid Model ✨

## The Problem

The standard MQTT setup for Simple Timer Card relies on the frontend (your browser) to check for expired timers. This means **if no UI is open**, timers might not fire notifications when they finish. Your timer could expire while you're away from your device, and you'd miss the notification entirely.

## The Solution: The Hybrid Model 🚀

The **Hybrid Model** solves this by adding a backend "Companion Automation" in Home Assistant. This automation acts as a **failsafe**, guaranteeing timers are handled even when the UI is closed. 

You get the best of both worlds:
- ✅ **Instant UI feedback** when you're viewing the card
- ✅ **Backend reliability** when the UI is closed
- ✅ **No duplicate notifications** - smart detection prevents double alerts

Let's set it up!

---

## Setup Guide

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

> ⚠️ **Important:** The `state_topic` and `json_attributes_topic` must be exactly as shown.

After adding this, restart Home Assistant to create the sensor.

---

### 🚀 2. Set Up the Backend Failsafe

#### A. Create a Helper to Track Timers

This helper prevents the backend from sending duplicate notifications. Add it to your `configuration.yaml`:

```yaml
# configuration.yaml
input_text:
  simple_timer_card_backend_processed:
    name: "Simple Timer Card Backend Processed"
    max: 255
    initial: ""
```

After adding this, restart Home Assistant or reload helpers from **Developer Tools** → **YAML** → **Reload all YAML configuration** → **Input text**.

---

#### B. Create the Companion Automation

This automation runs every second to check for expired timers that the UI might have missed. Create a new automation in Home Assistant:

```yaml
alias: "Simple Timer Card: Backend Failsafe"
description: "Checks for expired MQTT timers every second and publishes events if the UI missed them"
triggers:
  - trigger: time_pattern
    seconds: "*"
conditions: []
actions:
  - variables:
      sensor_entity: "sensor.simple_timer_card_timers"  # ⚠️ Change this if you used a different name in step 1
      timers: "{{ state_attr(sensor_entity, 'timers') | default([]) }}"
      current_time: "{{ now().timestamp() }}"
      processed_list: "{{ states('input_text.simple_timer_card_backend_processed').split(',') }}"
  - repeat:
      for_each: "{{ timers }}"
      sequence:
        - variables:
            timer_id: "{{ repeat.item.id }}"
            end_time: "{{ repeat.item.endTime / 1000 }}"
            is_expired: "{{ end_time <= current_time }}"
            already_processed: "{{ timer_id in processed_list }}"
        - if:
            - condition: template
              value_template: "{{ is_expired and not already_processed }}"
          then:
            - data:
                topic: "simple_timer_card/events/expired"
                payload: "{{ repeat.item | to_json }}"
              action: mqtt.publish
            - data:
                value: >
                  {{ (processed_list + [timer_id]) | join(',') }}
              target:
                entity_id: input_text.simple_timer_card_backend_processed
  - if:
      - condition: template
        value_template: "{{ processed_list | length > 0 }}"
    then:
      - variables:
          valid_ids: "{{ timers | map(attribute='id') | list }}"
          cleaned_list: "{{ processed_list | select('in', valid_ids) | list }}"
      - if:
          - condition: template
            value_template: "{{ cleaned_list | length != processed_list | length }}"
        then:
          - data:
              value: "{{ cleaned_list | join(',') }}"
            target:
              entity_id: input_text.simple_timer_card_backend_processed
mode: single
```

> ⚠️ **Important:** If you changed the sensor name in Step 1, update the `sensor_entity` variable in this automation to match.

---

### ✅ 3. Create Your Notification Automation

Now create an automation that listens for timer expiry events from **both** the frontend and the backend. Here's an example:

```yaml
alias: "Timer Notification: Kitchen Timer Finished"
description: "Sends notification when kitchen timer expires (works with or without UI open)"
triggers:
  # Trigger 1: Frontend event (when UI is open)
  - trigger: mqtt
    topic: "simple_timer_card/events/expired"
  # Trigger 2: Backend failsafe (when UI is closed)
  - trigger: mqtt
    topic: "simple_timer_card/events/expired"
conditions:
  - condition: template
    value_template: "{{ 'Kitchen' in trigger.payload_json.label }}"
actions:
  - data:
      title: "🍳 Kitchen Timer Complete"
      message: "{{ trigger.payload_json.label }} is done!"
      data:
        tag: "timer_{{ trigger.payload_json.id }}"
        channel: "Timers"
        importance: high
        notification_icon: mdi:timer-outline
    action: notify.mobile_app_your_phone
mode: single  # ⚠️ Important: Prevents duplicate notifications
```

> 💡 **Key Points:**
> - Both triggers listen to the same MQTT topic
> - The `mode: single` setting prevents duplicate notifications if both frontend and backend fire at the same time
> - The `tag` in notification data ensures only one notification per timer appears

---

## 🎉 You're All Set!

Your timers are now fully reliable:
- ✨ **Frontend fires events** when you're viewing the card
- 🔒 **Backend failsafe** catches any timers the frontend missed
- 📱 **No duplicates** thanks to smart deduplication

Enjoy worry-free timers that work whether your UI is open or not!
