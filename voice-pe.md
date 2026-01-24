# Voice PE timers → Home Assistant template sensors (for Simple Timer Card)

This guide exposes **Voice PE timers** as Home Assistant template sensors you can use with **Simple Timer Card**.

It supports **two sources of timers**:

1. **Mirrored Voice PE timers** (timers created via voice on the device)
2. **UI-controlled “local” timers** (timers you start from the Home Assistant UI, then **pause / resume / cancel** from the card)

> **⚠️ Important – Unofficial Hack Warning**
> This is an **unofficial workaround** that requires taking **full control** of your Voice PE device (you overwrite the default config).
> Future Voice PE / ESPHome updates may break this. Use at your own risk.

> **📋 Before You Start**
> - You must be running a custom ESPHome config on your Voice PE device (full control).
> - Template sensors must be added to your Home Assistant `configuration.yaml` (or included packages).
> - You **must change example entity IDs** to match yours.

---

## What’s included

### ESPHome side (device)
- Exposes a small number of timer **slots** as ESPHome entities (this page shows **3 slots**; you can do more)
- Mirrors Voice PE timers (sorted by soonest to finish) into the slots
- Enables **local timers** that you can create and control from HA UI:
  - start timer
  - pause / resume / cancel
- Keeps a sticky `finished` state for ~10 seconds (TTL) so dashboards can show “finished” briefly.

### Home Assistant side
- One HA template sensor per slot
- Each slot sensor provides:
  - `state`: `active`, `paused`, `finished`, `idle`
  - `duration`, `remaining` as `"H:MM:SS"` strings
  - `timer_name`
  - `timer_id` (required for local control)
  - `control_entity` (only set for locally-controlled timers)

### Simple Timer Card
- Use `mode: voice_pe` against the template sensors.
- The card shows both mirrored and local timers.
- For local timers, the card can control the timer through `timer_id` + `control_entity`.

---

## Important behavior notes

- Voice PE reports timers sorted by “soonest to finish”. When a new shorter timer is created, it may take slot 1, pushing others down.
- `finished` is sticky for ~10s (TTL). After TTL, the slot clears to `idle`.
- **Only `local:` timers are controllable** from HA (pause/resume/cancel).
  - Mirrored Voice PE timers (voice-created) are display-only.

---

## 1) ESPHome: required entities (summary)

This page focuses on the **Home Assistant + card** side, but your Voice PE ESPHome config must expose at least:

Per slot (1..3):
- `sensor.<device>_timer_1_total_seconds`
- `sensor.<device>_timer_1_seconds_left`
- `sensor.<device>_timer_1_state`
- `sensor.<device>_timer_1_name`
- `sensor.<device>_timer_1_id`  ← **required** (used to decide if the timer is local and controllable)

And one control entity:
- `text.voice_pe_timer_command`

### Command format (what HA / the card sends)
The control text entity receives commands like:

- Start a local timer:
  - `start:<seconds>:<optional name>`
  - Examples:
    - `start:300:Pasta`
    - `start:60:Tea`
    - `start:90:` (no label)

- Pause:
  - `pause:<timer_id>`

- Resume:
  - `resume:<timer_id>`

- Cancel:
  - `cancel:<timer_id>`

**Timer IDs** should look like:
- `local:...` for UI-created timers (controllable)
- `remote:...` (or anything else) for mirrored timers (not controllable)

> Need the ESPHome implementation? Follow the full walkthrough here:
> **[voice-pe-esphome.md](voice-pe-esphome.md)**

---

## 2) Home Assistant: template sensors (new structure)

Create one HA template sensor per slot.

### Key changes vs older versions
- Adds `timer_id` attribute (needed for control)
- Adds `control_entity` attribute:
  - returns your command text entity **only when the timer is local**
  - otherwise returns empty (no control available)
- `display_name` includes a formatted duration plus a friendly label

> **⚠️ Critical:** Replace the entity IDs below with your actual entities.

Add to `configuration.yaml`:

```yaml
template:
  - sensor:
      - name: "VPE Timer 1"
        state: "{{ states('sensor.home_assistant_voice_timer_1_state') or 'idle' }}"
        attributes:
          # Only local timers can be controlled. For remote timers, return empty string.
          control_entity: >-
            {% set tid = states('sensor.home_assistant_voice_timer_1_id') %}
            {% if tid.startswith('local:') %}text.voice_pe_timer_command{% else %}{% endif %}

          # Expose timer_id so the card can send pause/resume/cancel commands for local timers.
          timer_id: "{{ states('sensor.home_assistant_voice_timer_1_id') }}"

          display_name: >-
            {% set s = states('sensor.home_assistant_voice_timer_1_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% set tp = namespace(val='') %}
            {% if h > 0 %}{% set tp.val = tp.val ~ h ~ 'h' %}{% endif %}
            {% if m > 0 %}{% set tp.val = tp.val ~ m ~ 'm' %}{% endif %}
            {% if sec > 0 or s == 0 %}{% set tp.val = tp.val ~ sec ~ 's' %}{% endif %}
            {% set rn = states('sensor.home_assistant_voice_timer_1_name') %}
            {% set tl = rn if rn not in ['unknown', 'unavailable', '', None] else 'Voice PE' %}
            {{ tp.val }} Timer - {{ tl }}

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
          control_entity: >-
            {% set tid = states('sensor.home_assistant_voice_timer_2_id') %}
            {% if tid.startswith('local:') %}text.voice_pe_timer_command{% else %}{% endif %}
          timer_id: "{{ states('sensor.home_assistant_voice_timer_2_id') }}"
          display_name: >-
            {% set s = states('sensor.home_assistant_voice_timer_2_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% set tp = namespace(val='') %}
            {% if h > 0 %}{% set tp.val = tp.val ~ h ~ 'h' %}{% endif %}
            {% if m > 0 %}{% set tp.val = tp.val ~ m ~ 'm' %}{% endif %}
            {% if sec > 0 or s == 0 %}{% set tp.val = tp.val ~ sec ~ 's' %}{% endif %}
            {% set rn = states('sensor.home_assistant_voice_timer_2_name') %}
            {% set tl = rn if rn not in ['unknown', 'unavailable', '', None] else 'Voice PE' %}
            {{ tp.val }} Timer - {{ tl }}
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
          control_entity: >-
            {% set tid = states('sensor.home_assistant_voice_timer_3_id') %}
            {% if tid.startswith('local:') %}text.voice_pe_timer_command{% else %}{% endif %}
          timer_id: "{{ states('sensor.home_assistant_voice_timer_3_id') }}"
          display_name: >-
            {% set s = states('sensor.home_assistant_voice_timer_3_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% set tp = namespace(val='') %}
            {% if h > 0 %}{% set tp.val = tp.val ~ h ~ 'h' %}{% endif %}
            {% if m > 0 %}{% set tp.val = tp.val ~ m ~ 'm' %}{% endif %}
            {% if sec > 0 or s == 0 %}{% set tp.val = tp.val ~ sec ~ 's' %}{% endif %}
            {% set rn = states('sensor.home_assistant_voice_timer_3_name') %}
            {% set tl = rn if rn not in ['unknown', 'unavailable', '', None] else 'Voice PE' %}
            {{ tp.val }} Timer - {{ tl }}
          timer_name: "{{ states('sensor.home_assistant_voice_timer_3_name') }}"
          duration: >-
            {% set s = states('sensor.home_assistant_voice_timer_3_total_seconds')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          remaining: >-
            {% set s = states('sensor.home_assistant_voice_timer_3_seconds_left')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
```

Reload Template Entities (or restart Home Assistant).

> Want 4–5 slots? Copy the block and create “VPE Timer 4/5”.  
> Your ESPHome config can expose more; this page just keeps the examples to 3.

---

## 3) Simple Timer Card configuration

### Basic (read + control local timers when available)

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

### What the card reads in `voice_pe` mode

The card reads:

- `entity.state` → `active`, `paused`, `finished`, `idle`
- `entity.attributes.duration` / `remaining` → time strings
- `entity.attributes.display_name` → label (optional)
- `entity.attributes.timer_id` → required for local control
- `entity.attributes.control_entity` → where to send commands (only present for local timers)

---

## 4) Simple Timer Card v2.1.0+: create new timers as “local Voice PE timers” (optional)

Starting in **Simple Timer Card v2.1.0**, you can choose whether timers you create from the card UI (custom timers and/or pinned timers) should be created as **local Voice PE timers** (so they show up in the Voice PE timer slots and can be controlled there).

### What this means
- When enabled, the card will create timers by sending `start:<seconds>:<name>` to your Voice PE command entity, instead of creating a normal card-local/helper/MQTT timer.
- Those timers will get a `local:` timer id from ESPHome, and you’ll be able to pause/resume/cancel them via the Voice PE slots.

> This requires your ESPHome implementation to support local timers and the command text entity described above.

### Configuration notes
- In v2.1.0 this is controlled by the card’s `auto_voice_pe` option (defaults to `false`).
- You also need the card to know where to send the command:
  - easiest: your `voice_pe` template sensors provide `control_entity` (as shown above)
  - or: set `voice_pe_control_entity: text.voice_pe_timer_command` in the card config

Example:

```yaml
type: custom:simple-timer-card
auto_voice_pe: true
voice_pe_control_entity: text.voice_pe_timer_command
entities:
  - mode: voice_pe
    entity: sensor.vpe_timer_1
  - mode: voice_pe
    entity: sensor.vpe_timer_2
  - mode: voice_pe
    entity: sensor.vpe_timer_3
```

---

## Troubleshooting

- **Everything is `unknown` / `idle`**
  - Your entity IDs don’t match. Go to *Developer Tools → States* and find the real ESPHome entities, then update the template sensors.

- **Pause/Resume/Cancel buttons do nothing**
  - Check that `timer_id` starts with `local:` (only local timers are controllable).
  - Confirm `control_entity` is `text.voice_pe_timer_command` for local timers (and empty for remote timers).
  - Confirm your ESPHome config handles `pause:`, `resume:`, `cancel:` commands.

---

## Scale up or down

- **Fewer timers**: remove slot 3 (and 2) from ESPHome + HA template sensors + card.
- **More timers**: add slots 4/5 in ESPHome, create matching HA template sensors, and add card entries.

That’s it—once ESPHome exposes the required entities, Home Assistant template sensors + Simple Timer Card will show mirrored timers and allow local control where supported.
