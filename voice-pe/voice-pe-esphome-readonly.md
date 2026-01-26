# Voice PE → ESPHome walkthrough (mirror-only / read-only timers)

This page explains the **mirror-only** (read-only) Voice PE integration.

Use this if you only want to **display timers that were created by voice on the Voice PE device** in Home Assistant / Simple Timer Card.

- ✅ Shows timer name, total seconds, remaining seconds, count, and state
- ✅ Optional sticky `finished` state (TTL)
- ❌ No UI start / pause / resume / cancel (read-only)

If you want **UI-controlled timers** too (start/pause/resume/cancel from the dashboard), use the advanced guide:
- **Advanced:** [voice-pe-esphome.md](voice-pe-esphome.md)

> **⚠️ Unofficial / advanced**
> This requires taking full control of your Voice PE device configuration. Proceed only if you understand ESPHome and can recover your device.

---

## What Home Assistant will see (per slot)

This mirror-only approach exposes (per slot 1..3 shown here):

- `sensor.timer_X_total_seconds`
- `sensor.timer_X_seconds_left`
- `text_sensor.timer_X_name`
- `text_sensor.timer_X_state` (`active`, `paused`, `finished`, `idle`)

And globally:
- `sensor.timer_count`

> There is **no** `timer_id` and **no** `control_entity` because there is no local control.

---

## 0) Start from the official Voice PE package

A typical base:

```yaml
substitutions:
  name: home-assistant-voice
  friendly_name: Home Assistant Voice

packages:
  voice_pe: github://esphome/home-assistant-voice-pe/home-assistant-voice.yaml

esphome:
  name: ${name}
  friendly_name: ${friendly_name}
  name_add_mac_suffix: false

api:

wifi:

logger:
```

Append the rest of this guide to your YAML.

---

## 1) Display slot entities (3 slots)

```yaml
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
```

---

## 2) Optional: sticky `finished` state (TTL)

Voice PE timers may “disappear” quickly after finishing. If you want dashboards to show a timer as **finished** briefly, you can latch `finished` for a TTL window.

This implementation uses:
- `t1_finished`, `t2_finished`, `t3_finished` latches
- timestamps `tX_finished_ts`
- a TTL clear interval (default `10s`)

```yaml
globals:
  - id: t1_finished
    type: bool
    restore_value: no
    initial_value: "false"
  - id: t2_finished
    type: bool
    restore_value: no
    initial_value: "false"
  - id: t3_finished
    type: bool
    restore_value: no
    initial_value: "false"

  - id: t1_finished_ts
    type: uint32_t
    restore_value: no
    initial_value: "0"
  - id: t2_finished_ts
    type: uint32_t
    restore_value: no
    initial_value: "0"
  - id: t3_finished_ts
    type: uint32_t
    restore_value: no
    initial_value: "0"

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
            id(timer_count).publish_state(0);
          };

          const uint32_t now = millis();
          const uint32_t TTL = 10000;  // 10 seconds

          if (id(t1_finished) && id(t1_finished_ts) != 0 && (uint32_t)(now - id(t1_finished_ts)) > TTL) clear_slot(1);
          if (id(t2_finished) && id(t2_finished_ts) != 0 && (uint32_t)(now - id(t2_finished_ts)) > TTL) clear_slot(2);
          if (id(t3_finished) && id(t3_finished_ts) != 0 && (uint32_t)(now - id(t3_finished_ts)) > TTL) clear_slot(3);
```

If you don’t want sticky finished at all, skip this entire section.

---

## 3) Mirror timers from `voice_assistant`

Voice PE provides a `timers` vector (sorted by soonest end). We mirror the first 3 into the slot entities.

```yaml
voice_assistant:
  on_timer_tick:
    - lambda: |-
        const int count = (int) timers.size();
        auto clamp_nonneg = [](int v){ return v < 0 ? 0 : v; };

        id(timer_count).publish_state(count);

        int timer_index = 0;

        if (id(t1_finished)) {
          // keep showing finished until TTL clears it
        } else if (timer_index < count) {
          const auto &t = timers[timer_index];
          id(timer_1_name).publish_state(t.name.c_str());
          id(timer_1_state).publish_state(t.is_active ? "active" : "paused");
          id(timer_1_seconds_left).publish_state(clamp_nonneg((int)t.seconds_left));
          id(timer_1_total_seconds).publish_state(clamp_nonneg((int)t.total_seconds));
          timer_index++;
        } else {
          id(timer_1_name).publish_state("");
          id(timer_1_state).publish_state("idle");
          id(timer_1_seconds_left).publish_state(0);
          id(timer_1_total_seconds).publish_state(0);
        }

        if (id(t2_finished)) {
        } else if (timer_index < count) {
          const auto &t = timers[timer_index];
          id(timer_2_name).publish_state(t.name.c_str());
          id(timer_2_state).publish_state(t.is_active ? "active" : "paused");
          id(timer_2_seconds_left).publish_state(clamp_nonneg((int)t.seconds_left));
          id(timer_2_total_seconds).publish_state(clamp_nonneg((int)t.total_seconds));
          timer_index++;
        } else {
          id(timer_2_name).publish_state("");
          id(timer_2_state).publish_state("idle");
          id(timer_2_seconds_left).publish_state(0);
          id(timer_2_total_seconds).publish_state(0);
        }

        if (id(t3_finished)) {
        } else if (timer_index < count) {
          const auto &t = timers[timer_index];
          id(timer_3_name).publish_state(t.name.c_str());
          id(timer_3_state).publish_state(t.is_active ? "active" : "paused");
          id(timer_3_seconds_left).publish_state(clamp_nonneg((int)t.seconds_left));
          id(timer_3_total_seconds).publish_state(clamp_nonneg((int)t.total_seconds));
          timer_index++;
        } else {
          id(timer_3_name).publish_state("");
          id(timer_3_state).publish_state("idle");
          id(timer_3_seconds_left).publish_state(0);
          id(timer_3_total_seconds).publish_state(0);
        }

  on_timer_finished:
    - lambda: |-
        // Latch a finished state for TTL (optional section must exist)
        auto latch = [&](int slot){
          switch(slot){
            case 1: id(t1_finished) = true; id(t1_finished_ts) = millis(); break;
            case 2: id(t2_finished) = true; id(t2_finished_ts) = millis(); break;
            case 3: id(t3_finished) = true; id(t3_finished_ts) = millis(); break;
          }

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

        // Use first free latch slot
        if (!id(t1_finished)) { latch(1); }
        else if (!id(t2_finished)) { latch(2); }
        else if (!id(t3_finished)) { latch(3); }

  on_timer_cancelled:
    - lambda: |-
        // Clear everything (also resets sticky finished)
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
```

> If you skipped the “sticky finished” globals, also remove the parts that reference `tX_finished`.

---

## 4) Next steps in Home Assistant

Once ESPHome is flashed and the entities exist, go back to:
- [voice-pe.md](voice-pe.md)

…to create the Home Assistant template sensors and configure Simple Timer Card.

---

## Scale up to more slots

Copy the slot pattern to create slot 4/5/etc:
- add `timer_4_*` entities
- add `t4_finished*` (if using sticky finished)
- update the logic to publish additional slots

If you want **local controllable timers** too, use:
- [voice-pe-esphome.md](voice-pe-esphome.md)
