# Voice PE timers → Home Assistant template sensors (for Simple Timer Card)

This guide exposes local Voice PE timers as Home Assistant template sensors you can drop into your Simple Timer Card.

What's included:
- ESPHome code that mirrors local timers into sensors and text sensors
- A sticky `finished` state that lasts **10 seconds** or until the timer is cancelled on the device
- Home Assistant template sensors with `state`, `duration`, `remaining`, `timer_name`, and `display_name` attributes
- A sample Simple Timer Card config (`mode: voice_pe`)

Notes:
- Example shows **3 timers**, but you can do **1..N**. Copy the slot blocks to add more.
- Voice PE keeps the timer list **sorted by soonest to finish**. When a new timer is shorter, it takes the first slot. Example: if Timer 1 has 5m left and you add a 2m timer, the 2m timer becomes slot 1 and the 5m timer moves to slot 2.

## 1) ESPHome: mirror timers (with 10s sticky finished)

Add to your Voice PE device's YAML:

```yaml
globals:
  - id: timer_count
    type: int
    initial_value: '0'
  - id: t1_finished
    type: bool
    initial_value: 'false'
  - id: t1_finished_ts
    type: uint32_t
    initial_value: '0'
  - id: t2_finished
    type: bool
    initial_value: 'false'
  - id: t2_finished_ts
    type: uint32_t
    initial_value: '0'
  - id: t3_finished
    type: bool
    initial_value: 'false'
  - id: t3_finished_ts
    type: uint32_t
    initial_value: '0'

sensor:
  - platform: template
    name: "Timer Count"
    id: timer_count
    accuracy_decimals: 0

  - platform: template
    name: "Timer 1 Seconds Left"
    id: timer_1_seconds_left
    accuracy_decimals: 0

  - platform: template
    name: "Timer 1 Total Seconds"
    id: timer_1_total_seconds
    accuracy_decimals: 0

  - platform: template
    name: "Timer 2 Seconds Left"
    id: timer_2_seconds_left
    accuracy_decimals: 0

  - platform: template
    name: "Timer 2 Total Seconds"
    id: timer_2_total_seconds
    accuracy_decimals: 0

  - platform: template
    name: "Timer 3 Seconds Left"
    id: timer_3_seconds_left
    accuracy_decimals: 0

  - platform: template
    name: "Timer 3 Total Seconds"
    id: timer_3_total_seconds
    accuracy_decimals: 0

text_sensor:
  - platform: template
    name: "Timer 1 Name"
    id: timer_1_name

  - platform: template
    name: "Timer 1 State"
    id: timer_1_state

  - platform: template
    name: "Timer 2 Name"
    id: timer_2_name

  - platform: template
    name: "Timer 2 State"
    id: timer_2_state

  - platform: template
    name: "Timer 3 Name"
    id: timer_3_name

  - platform: template
    name: "Timer 3 State"
    id: timer_3_state

voice_assistant:
  # your existing config...
  on_timer_tick:
    - lambda: |-
        const auto &timers = id(va).get_timers();
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
            case 1: id(timer_1_state).publish_state("finished");
                    id(t1_finished) = true;
                    id(t1_finished_ts) = millis(); break;
            case 2: id(timer_2_state).publish_state("finished");
                    id(t2_finished) = true;
                    id(t2_finished_ts) = millis(); break;
            case 3: id(timer_3_state).publish_state("finished");
                    id(t3_finished) = true;
                    id(t3_finished_ts) = millis(); break;
          }
        };

        if (!id(t1_finished)) latch(1);
        else if (!id(t2_finished)) latch(2);
        else if (!id(t3_finished)) latch(3);

  on_timer_cancelled:
    - lambda: |-
        // Clear the finished state when a timer is cancelled
        auto clear = [&](int slot){
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

        // Check expired finished states
        if (id(t1_finished) && (now - id(t1_finished_ts) > TTL)) clear(1);
        if (id(t2_finished) && (now - id(t2_finished_ts) > TTL)) clear(2);
        if (id(t3_finished) && (now - id(t3_finished_ts) > TTL)) clear(3);
```

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

## 3) Simple Timer Card config

Add the template sensors to your card with `mode: voice_pe`:

```yaml
type: custom:simple-timer-card
title: Voice PE Timers
entities:
  - entity: sensor.vpe_timer_1
    mode: voice_pe
  - entity: sensor.vpe_timer_2  
    mode: voice_pe
  - entity: sensor.vpe_timer_3
    mode: voice_pe
```

## 4) Troubleshooting

- **ESPHome sensors not updating?** Check that your Voice PE device's ESPHome config includes the `on_timer_tick`, `on_timer_finished`, and `on_timer_cancelled` sections.
- **Template sensors showing "unknown"?** Verify the sensor entity IDs match between ESPHome and your template config.
- **Timers not appearing in the card?** Make sure the `mode: voice_pe` is set and the entity state is not "unavailable".
