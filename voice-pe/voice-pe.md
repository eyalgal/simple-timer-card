# Voice PE timers → Home Assistant template sensors (for Simple Timer Card)

This guide exposes **Voice PE timers** as Home Assistant template sensors you can use with **Simple Timer Card**.

It supports two setup levels:

1. **Mirror-only (recommended / simplest):** show timers created by voice on the Voice PE device (read-only).
2. **Advanced (optional):** also create **locally controllable timers** from the UI (start / pause / resume / cancel).

---

## ⚠️ Important – Unofficial hack warning

This is an **unofficial workaround** that requires taking **full control** of your Voice PE device (you overwrite the default config).  
Future Voice PE / ESPHome updates may break this. Use at your own risk.

---

## Before you start

- You must be running a custom ESPHome config on your Voice PE device.
- Template sensors must be added to your Home Assistant `configuration.yaml` (or included packages).
- You **must change example entity IDs** to match yours (ESPHome device name, MAC suffix, etc).

---

## What’s included

### Home Assistant side (this page)
- One HA template sensor per “slot”
- Each slot sensor provides:
  - `state`: `active`, `paused`, `finished`, `idle`
  - `duration`, `remaining` as `"H:MM:SS"` strings
  - `timer_name` (spoken name)
  - `display_name` (friendly label you can show on the card)

### ESPHome side (choose one)
- **Mirror-only:** [voice-pe-esphome-readonly.md](voice-pe-esphome-readonly.md)  
  Mirrors Voice PE timers into a fixed number of slot entities.
- **Advanced (local control):** [voice-pe-esphome.md](voice-pe-esphome.md)  
  Mirrors Voice PE timers *and* supports starting/controlling “local” timers from the UI.

---

## Important behavior notes

- Voice PE reports timers sorted by “soonest to finish”. When a new shorter timer is created, it may take slot 1, pushing others down.
- Many setups keep a sticky `finished` state for ~10 seconds (TTL) so dashboards show “finished” briefly.

---

## 1) ESPHome: flash a config that exposes slot entities

Pick **one**:

- Mirror-only (recommended): follow  
  **[voice-pe-esphome-readonly.md](voice-pe-esphome-readonly.md)**

- Advanced (UI control, optional): follow  
  **[voice-pe-esphome.md](voice-pe-esphome.md)**

Once flashed, you should see ESPHome entities like:

- `sensor.home_assistant_voice_timer_1_total_seconds`
- `sensor.home_assistant_voice_timer_1_seconds_left`
- `sensor.home_assistant_voice_timer_1_state`
- `sensor.home_assistant_voice_timer_1_name`

> ESPHome prefixes every entity with the device's friendly name, so the ids above
> assume the `friendly_name: Home Assistant Voice` used in the ESPHome guides.
> Replace that prefix with your own device name.
>
> Note that ESPHome text sensors arrive in Home Assistant as `sensor.` entities.
> There is no `text_sensor` domain in Home Assistant, so `timer_1_state` and
> `timer_1_name` are both `sensor.` even though the ESPHome YAML declares them
> under `text_sensor:`.
>
> Check *Developer Tools → States* and filter on `timer_` to confirm yours.

---

## 2) Home Assistant: template sensors (mirror-only structure)

Create one HA template sensor per slot.

### Notes
- This template sensor structure is the **mirror-only** format.
- If you use the **advanced local-control** ESPHome setup, you’ll likely want the advanced template structure that includes `timer_id` and `control_entity` (that is covered in the advanced guide).

Add this to `configuration.yaml`. The ids below assume the `friendly_name: Home Assistant Voice` from the ESPHome guides, so replace that prefix with your own device name:

```yaml
template:
  - sensor:
      - name: "VPE Timer 1"
        state: "{{ states('sensor.home_assistant_voice_timer_1_state') or 'idle' }}"
        attributes:
          display_name: >-
            {% set s = states('sensor.home_assistant_voice_timer_1_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% if h > 0 %}Voice PE - {{ h }}h
            {% elif m > 0 %}Voice PE - {{ m }}m
            {% else %}Voice PE - {{ sec }}s{% endif %}
          timer_name: "{{ states('sensor.home_assistant_voice_timer_1_name') }}"
          duration: >-
            {% set s = states('sensor.home_assistant_voice_timer_1_total_seconds')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          remaining: >-
            {% set s = states('sensor.home_assistant_voice_timer_1_seconds_left')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}

      - name: "VPE Timer 2"
        state: "{{ states('sensor.home_assistant_voice_timer_2_state') or 'idle' }}"
        attributes:
          display_name: >-
            {% set s = states('sensor.home_assistant_voice_timer_2_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% if h > 0 %}Voice PE - {{ h }}h
            {% elif m > 0 %}Voice PE - {{ m }}m
            {% else %}Voice PE - {{ sec }}s{% endif %}
          timer_name: "{{ states('sensor.home_assistant_voice_timer_2_name') }}"
          duration: >-
            {% set s = states('sensor.home_assistant_voice_timer_2_total_seconds')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          remaining: >-
            {% set s = states('sensor.home_assistant_voice_timer_2_seconds_left')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}

      - name: "VPE Timer 3"
        state: "{{ states('sensor.home_assistant_voice_timer_3_state') or 'idle' }}"
        attributes:
          display_name: >-
            {% set s = states('sensor.home_assistant_voice_timer_3_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% if h > 0 %}Voice PE - {{ h }}h
            {% elif m > 0 %}Voice PE - {{ m }}m
            {% else %}Voice PE - {{ sec }}s{% endif %}
          timer_name: "{{ states('sensor.home_assistant_voice_timer_3_name') }}"
          duration: >-
            {% set s = states('sensor.home_assistant_voice_timer_3_total_seconds')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          remaining: >-
            {% set s = states('sensor.home_assistant_voice_timer_3_seconds_left')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
```

Reload Template Entities (or restart Home Assistant).

---

## 3) Simple Timer Card configuration (mirror-only)

Use your card’s `voice_pe` mode against the 3 template sensors:

```yaml
type: custom:simple-timer-card
entities:
  - mode: voice_pe
    entity: sensor.vpe_timer_1
  - mode: voice_pe
    entity: sensor.vpe_timer_2
  - mode: voice_pe
    entity: sensor.vpe_timer_3
```

### What the card reads
The card uses:

- `entity.state` for: `active`, `paused`, `finished`, `idle`
- `entity.attributes.duration` and `entity.attributes.remaining` for display
- `entity.attributes.display_name` for label (optional)

---

## Scale up or down

- **Fewer timers**: remove slot 3 (and 2) from both ESPHome and HA templates.
- **More timers**: add slot 4/5 in ESPHome + HA template sensors and add more card entries.

---

## Troubleshooting

- **Everything is `unknown` / `idle`**
  - The entity ids in the template sensors do not match your device. ESPHome prefixes
    entities with the device friendly name, so a device named `Kitchen Voice` gives
    `sensor.kitchen_voice_timer_1_state`, not `sensor.timer_1_state`. Check
    *Developer Tools → States*, filter on `timer_`, and update the templates.
  - Remember that `timer_1_state` and `timer_1_name` are `sensor.` entities in Home
    Assistant even though ESPHome declares them under `text_sensor:`.

- **Timers appear in the wrong order**
  - This is expected: Voice PE sorts timers by soonest-to-finish, so slots can change when you add a shorter timer.

---

## Want UI control (advanced)?

If you want to create timers from the UI and control them (pause/resume/cancel), follow:

- ESPHome walkthrough (advanced): **[voice-pe-esphome.md](voice-pe-esphome.md)**

That advanced guide also covers the advanced template sensor structure (adds `timer_id` and `control_entity`).
