# Voice PE timers → Home Assistant template sensors (for Simple Timer Card)

This guide exposes local Voice PE timers as Home Assistant template sensors you can drop into your Simple Timer Card.

What’s included:
- ESPHome code that mirrors local timers into sensors and text sensors
- A sticky `finished` state that lasts **10 seconds** or until the timer is cancelled on the device
- Home Assistant template sensors with `state`, `duration`, `remaining`, `timer_name`, and `display_name` attributes
- A sample Simple Timer Card config (`mode: voice_pe`)

Notes:
- Example shows **3 timers**, but you can do **1..N**. Copy the slot blocks to add more.
- Voice PE keeps the timer list **sorted by soonest to finish**. When a new timer is shorter, it takes the first slot. Example: if Timer 1 has 5m left and you add a 2m timer, the 2m timer becomes slot 1 and the 5m timer moves to slot 2.
- The **10 seconds** finished latch is **hardcoded** below. Change the `TTL` value if you want a different period, or remove the `globals` and `interval` if you do not want sticky finished at all.

---

## 1) ESPHome: mirror timers (with 10s sticky finished)

Append to your Voice PE YAML. Keep your existing `packages`, `wifi`, etc.

```yaml
# --- Mirror 3 Voice PE timers to HA, and clear when done/cancelled ---

globals:
  # Finished latches (do not persist across reboot)
  - id: t1_finished
    type: bool
    restore_value: no
    initial_value: 'false'
  - id: t2_finished
    type: bool
    restore_value: no
    initial_value: 'false'
  - id: t3_finished
    type: bool
    restore_value: no
    initial_value: 'false'

  # Finished timestamps (ms since boot). 0 means not set.
  - id: t1_finished_ts
    type: uint32_t
    restore_value: no
    initial_value: '0'
  - id: t2_finished_ts
    type: uint32_t
    restore_value: no
    initial_value: '0'
  - id: t3_finished_ts
    type: uint32_t
    restore_value: no
    initial_value: '0'

# Sensors / text_sensors (3 slots; copy the pattern to add more)
sensor:
  - platform: template
    id: timer_count
    name: "Timers Count"
    accuracy_decimals: 0

  - platform: template
    id: timer_1_seconds_left
    name: "Timer 1 Seconds Left"
    unit_of_measurement: "s"
    accuracy_decimals: 0
  - platform: template
    id: timer_1_total_seconds
    name: "Timer 1 Total Seconds"
    unit_of_measurement: "s"
    accuracy_decimals: 0

  - platform: template
    id: timer_2_seconds_left
    name: "Timer 2 Seconds Left"
    unit_of_measurement: "s"
    accuracy_decimals: 0
  - platform: template
    id: timer_2_total_seconds
    name: "Timer 2 Total Seconds"
    unit_of_measurement: "s"
    accuracy_decimals: 0

  - platform: template
    id: timer_3_seconds_left
    name: "Timer 3 Seconds Left"
    unit_of_measurement: "s"
    accuracy_decimals: 0
  - platform: template
    id: timer_3_total_seconds
    name: "Timer 3 Total Seconds"
    unit_of_measurement: "s"
    accuracy_decimals: 0

text_sensor:
  - platform: template
    id: timer_1_name
    name: "Timer 1 Name"
  - platform: template
    id: timer_1_state
    name: "Timer 1 State"

  - platform: template
    id: timer_2_name
    name: "Timer 2 Name"
  - platform: template
    id: timer_2_state
    name: "Timer 2 State"

  - platform: template
    id: timer_3_name
    name: "Timer 3 Name"
  - platform: template
    id: timer_3_state
    name: "Timer 3 State"

# Auto-clear sticky "finished" after 10 seconds (TTL)
interval:
  - interval: 5s
    then:
      - lambda: |-
          auto clear_slot = [&](int slot){
            switch(slot){
              case 1: id(timer_1_name).publish_state("");
                      id(timer_1_state).publish_state("idle");
                      id(timer_1_seconds_left).publish_state(0);
                      id(timer_1_total_seconds).publish_state(0);
                      id(t1_finished) = false;
                      id(t1_finished_ts) = 0; break;
              case 2: id(timer_2_name).publish_state("");
                      id(timer_2_state).publish_state("idle");
                      id(timer_2_seconds_left).publish_state(0);
                      id(timer_2_total_seconds).publish_state(0);
                      id(t2_finished) = false;
                      id(t2_finished_ts) = 0; break;
              case 3: id(timer_3_name).publish_state("");
                      id(timer_3_state).publish_state("idle");
                      id(timer_3_seconds_left).publish_state(0);
                      id(timer_3_total_seconds).publish_state(0);
                      id(t3_finished) = false;
                      id(t3_finished_ts) = 0; break;
            }
          };

          const uint32_t now = millis();
          const uint32_t TTL = 10000;  // hardcoded 10s sticky finished

          if (id(t1_finished) && id(t1_finished_ts) != 0 && (uint32_t)(now - id(t1_finished_ts)) > TTL) clear_slot(1);
          if (id(t2_finished) && id(t2_finished_ts) != 0 && (uint32_t)(now - id(t2_finished_ts)) > TTL) clear_slot(2);
          if (id(t3_finished) && id(t3_finished_ts) != 0 && (uint32_t)(now - id(t3_finished_ts)) > TTL) clear_slot(3);

# Mirror logic (Voice Assistant provides a timers vector sorted by soonest end)
voice_assistant:
  on_timer_tick:
    - lambda: |-
        auto clear_slot_if_not_finished = [&](int slot){
          bool finished = (slot==1? id(t1_finished) : slot==2? id(t2_finished) : id(t3_finished));
          if (!finished) {
            switch(slot){
              case 1: id(timer_1_name).publish_state("");
                      id(timer_1_state).publish_state("idle");
                      id(timer_1_seconds_left).publish_state(0);
                      id(timer_1_total_seconds).publish_state(0); break;
              case 2: id(timer_2_name).publish_state("");
                      id(timer_2_state).publish_state("idle");
                      id(timer_2_seconds_left).publish_state(0);
                      id(timer_2_total_seconds).publish_state(0); break;
              case 3: id(timer_3_name).publish_state("");
                      id(timer_3_state).publish_state("idle");
                      id(timer_3_seconds_left).publish_state(0);
                      id(timer_3_total_seconds).publish_state(0); break;
            }
          }
        };

        clear_slot_if_not_finished(1);
        clear_slot_if_not_finished(2);
        clear_slot_if_not_finished(3);

        const int count = (int) timers.size();
        id(timer_count).publish_state(count);
        auto clamp_nonneg = [](int v){ return v < 0 ? 0 : v; };

        if (count > 0 && !id(t1_finished)) {
          const auto &t = timers[0];
          id(timer_1_name).publish_state(t.name.c_str());
          id(timer_1_state).publish_state(t.is_active ? "active" : "paused");
          id(timer_1_seconds_left).publish_state(clamp_nonneg((int)t.seconds_left));
          id(timer_1_total_seconds).publish_state(clamp_nonneg((int)t.total_seconds));
        }
        if (count > 1 && !id(t2_finished)) {
          const auto &t = timers[1];
          id(timer_2_name).publish_state(t.name.c_str());
          id(timer_2_state).publish_state(t.is_active ? "active" : "paused");
          id(timer_2_seconds_left).publish_state(clamp_nonneg((int)t.seconds_left));
          id(timer_2_total_seconds).publish_state(clamp_nonneg((int)t.total_seconds));
        }
        if (count > 2 && !id(t3_finished)) {
          const auto &t = timers[2];
          id(timer_3_name).publish_state(t.name.c_str());
          id(timer_3_state).publish_state(t.is_active ? "active" : "paused");
          id(timer_3_seconds_left).publish_state(clamp_nonneg((int)t.seconds_left));
          id(timer_3_total_seconds).publish_state(clamp_nonneg((int)t.total_seconds));
        }

  on_timer_finished:
    - lambda: |-
        // Latch the first non-latched slot as "finished" for 10s
        auto latch = [&](int slot){
          switch(slot){
            case 1: id(t1_finished) = true; id(t1_finished_ts) = millis(); break;
            case 2: id(t2_finished) = true; id(t2_finished_ts) = millis(); break;
            case 3: id(t3_finished) = true; id(t3_finished_ts) = millis(); break;
          }
          // Show finished: keep name and total, remaining = 0, state = finished
          if (slot==1) {
            id(timer_1_name).publish_state(timer.name.c_str());
            id(timer_1_state).publish_state("finished");
            id(timer_1_seconds_left).publish_state(0);
            id(timer_1_total_seconds).publish_state((int)timer.total_seconds);
          } else if (slot==2) {
            id(timer_2_name).publish_state(timer.name.c_str());
            id(timer_2_state).publish_state("finished");
            id(timer_2_seconds_left).publish_state(0);
            id(timer_2_total_seconds).publish_state((int)timer.total_seconds);
          } else {
            id(timer_3_name).publish_state(timer.name.c_str());
            id(timer_3_state).publish_state("finished");
            id(timer_3_seconds_left).publish_state(0);
            id(timer_3_total_seconds).publish_state((int)timer.total_seconds);
          }
        };

        if (!id(t1_finished)) { latch(1); }
        else if (!id(t2_finished)) { latch(2); }
        else if (!id(t3_finished)) { latch(3); }
        // If all three are latched, the oldest will auto-clear within 10s

  on_timer_cancelled:
    - lambda: |-
        // Treat cancel as dismiss: clear latches and reset everything
        id(t1_finished) = false; id(t1_finished_ts) = 0;
        id(t2_finished) = false; id(t2_finished_ts) = 0;
        id(t3_finished) = false; id(t3_finished_ts) = 0;

        id(timer_count).publish_state(0);
        id(timer_1_name).publish_state("");
        id(timer_1_state).publish_state("idle");
        id(timer_1_seconds_left).publish_state(0);
        id(timer_1_total_seconds).publish_state(0);
        id(timer_2_name).publish_state("");
        id(timer_2_state).publish_state("idle");
        id(timer_2_seconds_left).publish_state(0);
        id(timer_2_total_seconds).publish_state(0);
        id(timer_3_name).publish_state("");
        id(timer_3_state).publish_state("idle");
        id(timer_3_seconds_left).publish_state(0);
        id(timer_3_total_seconds).publish_state(0);

  on_timer_started:
    - lambda: |-
        // New timer should show live data, so drop any finished latches
        id(t1_finished) = false; id(t1_finished_ts) = 0;
        id(t2_finished) = false; id(t2_finished_ts) = 0;
        id(t3_finished) = false; id(t3_finished_ts) = 0;
```

---

## 2) Home Assistant: template sensors

Create one HA template sensor per slot. These expose:
- `state`: `active`, `paused`, `finished`, or `idle`
- `duration` and `remaining`: `"H:MM:SS"` strings
- `timer_name`: original spoken name
- `display_name`: dynamic label like `Voice PE - 1h` or `Voice PE - 20m` (your card can use this)

**Use your actual entity IDs**. The generic IDs below assume you kept the ESPHome IDs exactly as in section 1.

```yaml
template:
  - sensor:
      - name: "VPE Timer 1"
        state: "{{ states('sensor.timer_1_state') or 'idle' }}"
        attributes:
          display_name: >-
            {% set s = states('sensor.timer_1_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% if h > 0 %}Voice PE - {{ h }}h
            {% elif m > 0 %}Voice PE - {{ m }}m
            {% else %}Voice PE - {{ sec }}s{% endif %}
          timer_name: "{{ states('sensor.timer_1_name') }}"
          duration: >-
            {% set s = states('sensor.timer_1_total_seconds')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          remaining: >-
            {% set s = states('sensor.timer_1_seconds_left')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          supports_pause: false
          supports_cancel: false

      - name: "VPE Timer 2"
        state: "{{ states('sensor.timer_2_state') or 'idle' }}"
        attributes:
          display_name: >-
            {% set s = states('sensor.timer_2_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% if h > 0 %}Voice PE - {{ h }}h
            {% elif m > 0 %}Voice PE - {{ m }}m
            {% else %}Voice PE - {{ sec }}s{% endif %}
          timer_name: "{{ states('sensor.timer_2_name') }}"
          duration: >-
            {% set s = states('sensor.timer_2_total_seconds')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          remaining: >-
            {% set s = states('sensor.timer_2_seconds_left')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          supports_pause: false
          supports_cancel: false

      - name: "VPE Timer 3"
        state: "{{ states('sensor.timer_3_state') or 'idle' }}"
        attributes:
          display_name: >-
            {% set s = states('sensor.timer_3_total_seconds')|int(0) %}
            {% set h = s // 3600 %}
            {% set m = (s % 3600) // 60 %}
            {% set sec = s % 60 %}
            {% if h > 0 %}Voice PE - {{ h }}h
            {% elif m > 0 %}Voice PE - {{ m }}m
            {% else %}Voice PE - {{ sec }}s{% endif %}
          timer_name: "{{ states('sensor.timer_3_name') }}"
          duration: >-
            {% set s = states('sensor.timer_3_total_seconds')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          remaining: >-
            {% set s = states('sensor.timer_3_seconds_left')|int(0) %}
            {{ '%d:%02d:%02d' % (s//3600, (s%3600)//60, s%60) }}
          supports_pause: false
          supports_cancel: false
```

Reload Template Entities or restart Home Assistant.

---

## 3) Simple Timer Card example

Use your card’s `voice_pe` mode against the 3 template sensors.

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

Your card should read:
- `entity.state` for `active`, `paused`, `finished`, `idle`
- `entity.attributes.duration` and `entity.attributes.remaining` for time display
- optionally `entity.attributes.display_name` for the label

---

## Scale up or down

- **Fewer timers**: delete slot 3 (and 2) blocks in both ESPHome and HA templates.  
- **More timers**: copy slot 3 to create slot 4, 5, etc. Then add matching template sensors and card entries.

That’s it. Paste, flash, reload templates, and you’re good.
