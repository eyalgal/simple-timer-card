# Voice PE timers → Home Assistant template sensors (for Simple Timer Card)

This guide exposes **Voice PE timers** as Home Assistant template sensors you can use with **Simple Timer Card**.

**Stock Voice PE firmware does not expose native voice timers as Home Assistant `timer.*` entities or as the slot sensors used here.** The card cannot read those timers directly. Both ESPHome guides add a read-only mirror; the advanced example also implements independent local timers on the device. It does not make native voice timers controllable from the card.

It supports two setup levels:

1. **Mirror-only (recommended / simplest):** show timers created by voice on the Voice PE device (read-only).
2. **Advanced (optional):** also create **independent, locally controllable timers** from the UI (start / pause / resume / cancel). These are neither native voice timers nor Home Assistant timer helpers.

---

## ⚠️ Important – Unofficial hack warning

This is an **unofficial workaround** that requires taking **full control** of your Voice PE device (you overwrite the default config).  
Future Voice PE / ESPHome updates may break this. Use at your own risk.

The firmware examples have **not been compiled or flashed against current ESPHome** for this documentation update. No current package revision, ESPHome version, or device pin configuration is validated here. Validate and compile the complete merged configuration for your chosen versions before flashing. Back up your existing configuration and keep a recovery path through the [official Voice PE documentation](https://voice-pe.home-assistant.io/) and [official firmware installer](https://esphome.github.io/home-assistant-voice-pe/).

---

## Before you start

- You must be running a custom ESPHome config on your Voice PE device.
- Template sensors must be added to your Home Assistant `configuration.yaml` (or included packages).
- You **must change example entity IDs** to match yours. Check device-name prefixes, MAC suffixes, registry-generated numeric suffixes such as `_2`, and any manual renames, including the template sensors used in the card.

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

- The examples mirror the first three native timers reported by `voice_assistant`, ordered by soonest finish. Slots are display positions, not permanent timer identities, so adding a shorter timer can move existing timers.
- Mirror-only can latch `finished` with a 10-second TTL checked every 5 seconds. Cancellation clears those latches early. This is separate from the advanced example's local-timer TTL.
- Advanced has three local storage slots. A fourth simultaneous unfinished local timer replaces local slot 3. Remote timers fill the three shared display slots first, so local timers can keep running and invoke the ring script while hidden from the card.
- Advanced remote finish/cancel handlers clear **all mirrored remote slots**, not the remaining native timers themselves. Other remote timers reappear only when republished by a later tick. There is no guaranteed remote `finished` TTL in that example.

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

> These are example IDs for the `friendly_name: Home Assistant Voice` used in the
> ESPHome guides, not guaranteed entity IDs. Home Assistant may retain older IDs
> after a rename or add numeric suffixes. Replace each reference with its actual ID.
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
- This template sensor structure is the **mirror-only** format. For advanced local control, use the complete three-slot templates in [voice-pe-esphome.md](voice-pe-esphome.md#11-home-assistant-template-sensors-all-three-slots) instead, not in addition to these sensors.
- `availability` uses `has_value` for the required raw state and timing sensors, and checks valid states and numeric timing data. Missing, `unknown`, or `unavailable` inputs make the template sensor unavailable, rather than reporting a valid idle timer. The card skips unavailable sensors; inspect them in Home Assistant if the card is empty.
- State values are trimmed and lowercased, with an explicit `idle` fallback. Availability prevents invalid source states from being presented as valid idle data. Optional names that are `unknown` or `unavailable` become empty; a missing name alone does not make a timer unavailable.
- The card reads `display_name` for its label, not `timer_name` directly. These templates use a valid timer name when present and a duration-based display label otherwise.
- Merge the sensor entries into your existing Home Assistant `template` configuration. Do not add a second top-level `template:` key.

Add the following to your Home Assistant template configuration, replacing all example entity IDs with yours:

```yaml
template:
  - sensor:
      - name: "VPE Timer 1"
        availability: >-
          {{ has_value('sensor.home_assistant_voice_timer_1_state')
             and (states('sensor.home_assistant_voice_timer_1_state') | trim | lower) in ['active', 'paused', 'finished', 'idle']
             and has_value('sensor.home_assistant_voice_timer_1_total_seconds')
             and is_number(states('sensor.home_assistant_voice_timer_1_total_seconds'))
             and has_value('sensor.home_assistant_voice_timer_1_seconds_left')
             and is_number(states('sensor.home_assistant_voice_timer_1_seconds_left')) }}
        state: >-
          {% set value = states('sensor.home_assistant_voice_timer_1_state') | trim | lower %}
          {{ value if value in ['active', 'paused', 'finished', 'idle'] else 'idle' }}
        attributes:
          display_name: >-
            {% set name = states('sensor.home_assistant_voice_timer_1_name') | trim %}
            {% set s = states('sensor.home_assistant_voice_timer_1_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% if name | lower not in ['', 'unknown', 'unavailable'] %}{{ name }}
            {% elif h > 0 %}Voice PE - {{ h }}h
            {% elif m > 0 %}Voice PE - {{ m }}m
            {% else %}Voice PE - {{ sec }}s{% endif %}
          timer_name: >-
            {% set name = states('sensor.home_assistant_voice_timer_1_name') | trim %}
            {{ name if name | lower not in ['unknown', 'unavailable'] else '' }}
          duration: >-
            {% set s = states('sensor.home_assistant_voice_timer_1_total_seconds')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          remaining: >-
            {% set s = states('sensor.home_assistant_voice_timer_1_seconds_left')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}

      - name: "VPE Timer 2"
        availability: >-
          {{ has_value('sensor.home_assistant_voice_timer_2_state')
             and (states('sensor.home_assistant_voice_timer_2_state') | trim | lower) in ['active', 'paused', 'finished', 'idle']
             and has_value('sensor.home_assistant_voice_timer_2_total_seconds')
             and is_number(states('sensor.home_assistant_voice_timer_2_total_seconds'))
             and has_value('sensor.home_assistant_voice_timer_2_seconds_left')
             and is_number(states('sensor.home_assistant_voice_timer_2_seconds_left')) }}
        state: >-
          {% set value = states('sensor.home_assistant_voice_timer_2_state') | trim | lower %}
          {{ value if value in ['active', 'paused', 'finished', 'idle'] else 'idle' }}
        attributes:
          display_name: >-
            {% set name = states('sensor.home_assistant_voice_timer_2_name') | trim %}
            {% set s = states('sensor.home_assistant_voice_timer_2_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% if name | lower not in ['', 'unknown', 'unavailable'] %}{{ name }}
            {% elif h > 0 %}Voice PE - {{ h }}h
            {% elif m > 0 %}Voice PE - {{ m }}m
            {% else %}Voice PE - {{ sec }}s{% endif %}
          timer_name: >-
            {% set name = states('sensor.home_assistant_voice_timer_2_name') | trim %}
            {{ name if name | lower not in ['unknown', 'unavailable'] else '' }}
          duration: >-
            {% set s = states('sensor.home_assistant_voice_timer_2_total_seconds')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          remaining: >-
            {% set s = states('sensor.home_assistant_voice_timer_2_seconds_left')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}

      - name: "VPE Timer 3"
        availability: >-
          {{ has_value('sensor.home_assistant_voice_timer_3_state')
             and (states('sensor.home_assistant_voice_timer_3_state') | trim | lower) in ['active', 'paused', 'finished', 'idle']
             and has_value('sensor.home_assistant_voice_timer_3_total_seconds')
             and is_number(states('sensor.home_assistant_voice_timer_3_total_seconds'))
             and has_value('sensor.home_assistant_voice_timer_3_seconds_left')
             and is_number(states('sensor.home_assistant_voice_timer_3_seconds_left')) }}
        state: >-
          {% set value = states('sensor.home_assistant_voice_timer_3_state') | trim | lower %}
          {{ value if value in ['active', 'paused', 'finished', 'idle'] else 'idle' }}
        attributes:
          display_name: >-
            {% set name = states('sensor.home_assistant_voice_timer_3_name') | trim %}
            {% set s = states('sensor.home_assistant_voice_timer_3_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% if name | lower not in ['', 'unknown', 'unavailable'] %}{{ name }}
            {% elif h > 0 %}Voice PE - {{ h }}h
            {% elif m > 0 %}Voice PE - {{ m }}m
            {% else %}Voice PE - {{ sec }}s{% endif %}
          timer_name: >-
            {% set name = states('sensor.home_assistant_voice_timer_3_name') | trim %}
            {{ name if name | lower not in ['unknown', 'unavailable'] else '' }}
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

Explicitly list all three template sensors with `mode: voice_pe`. Replace their IDs with the ones Home Assistant actually created, including any numeric suffixes or renames. Do not list the raw ESPHome timing sensors instead:

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

Leave `auto_voice_pe` disabled for mirror-only. Voice PE auto-discovery requires a nonempty `control_entity`, which these read-only sensors deliberately do not provide. The card's normal timer-creation UI can still create separate browser or configured storage timers; it cannot start native voice timers on the device. Device-local UI creation requires the advanced setup.

### What the card reads
The card uses:

- `entity.state` for: `active`, `paused`, `finished`, `idle`
- `entity.attributes.duration` and `entity.attributes.remaining` as `H:MM:SS` strings, not the raw seconds sensors
- `entity.attributes.display_name` for the label, with fallbacks to `friendly_name`, the per-entity card name, and the generic timer label

`timer_name` is retained as metadata and copied into `display_name` by the templates when usable. Idle Voice PE slots are hidden by the card. Advanced control additionally requires `timer_id` and a conditional `control_entity` attribute, supplied by the advanced templates.

---

## Scale up or down

- The firmware examples are fixed at three display slots. Removing a card entry only hides a slot; it does not change firmware capacity.
- Changing capacity requires adapting every affected ESPHome entity, global, slot reference, publishing/cleanup handler, and any local allocation/countdown logic, then updating HA templates and card entries. Such firmware changes need their own validation and compilation.

---

## Troubleshooting

- **Everything is unavailable, or the card shows no timers**
  - Stock firmware does not provide these slot sensors. Confirm that the custom configuration is installed and that the raw entities exist and are available.
  - Check *Developer Tools → States*, filter on `timer_`, and update every template and card reference to the actual entity IDs. Prefix changes, numeric suffixes, and entity-registry renames all matter.
  - The templates intentionally remain unavailable while required state/timing data is missing or invalid. Do not replace that condition with a hardcoded idle state to hide a connection or naming problem.
  - Remember that `timer_1_state` and `timer_1_name` are `sensor.` entities in Home
    Assistant even though ESPHome declares them under `text_sensor:`.

- **Timers appear in the wrong order**
  - This is expected: Voice PE sorts timers by soonest-to-finish, so slots can change when you add a shorter timer.

---

## Want UI control (advanced)?

If you want to create timers from the UI and control them (pause/resume/cancel), follow:

- ESPHome walkthrough (advanced): **[voice-pe-esphome.md](voice-pe-esphome.md)**, including its complete three-slot HA templates and explicit card configuration.

That setup controls only the independent local timers. Native voice timers remain read-only in the card.
