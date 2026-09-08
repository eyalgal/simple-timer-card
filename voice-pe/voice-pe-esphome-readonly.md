# Voice PE → ESPHome walkthrough (mirror-only / read-only timers)

This page explains the **mirror-only** (read-only) Voice PE integration.

Use this if you only want to **display timers that were created by voice on the Voice PE device** in Home Assistant / Simple Timer Card.

**Stock Voice PE firmware does not expose native voice timers as Home Assistant `timer.*` entities or as the slot sensors below.** This custom configuration adds a read-only sensor mirror. It does not provide UI control of native timers.

- ✅ Shows timer name, total seconds, remaining seconds, count, and state
- ✅ Optional sticky `finished` state (TTL)
- ❌ No UI start / pause / resume / cancel (read-only)

If you want **independent UI-controlled local timers** too (start/pause/resume/cancel from the dashboard), use the advanced guide. Its local timers are separate from native voice timers, which remain read-only:
- **Advanced:** [voice-pe-esphome.md](voice-pe-esphome.md)

> **⚠️ Unofficial / advanced**
> This requires taking full control of your Voice PE device configuration. Proceed only if you understand ESPHome and can recover your device.

The firmware example has **not been compiled or flashed against current ESPHome** for this documentation update. No current package revision, ESPHome version, or pin configuration is validated here. Back up your existing configuration, validate and compile the fully merged configuration for your chosen versions before flashing, and keep access to the [official Voice PE documentation](https://voice-pe.home-assistant.io/) and [official firmware installer](https://esphome.github.io/home-assistant-voice-pe/) for recovery.

---

## What Home Assistant will see (per slot)

This mirror-only approach exposes (per slot 1..3 shown here):

- `sensor.home_assistant_voice_timer_X_total_seconds`
- `sensor.home_assistant_voice_timer_X_seconds_left`
- `sensor.home_assistant_voice_timer_X_name`
- `sensor.home_assistant_voice_timer_X_state` (`active`, `paused`, `finished`, `idle`)

And globally:
- `sensor.home_assistant_voice_timers_count`

> These are example IDs based on the `friendly_name` in the base config below.
> Replace them with the actual IDs from *Developer Tools → States*, including any
> numeric suffixes such as `_2`, MAC suffixes, or registry renames. The global entity
> normally uses `timers_count`, plural, because its name is "Timers Count"; its
> internal ESPHome ID is still `timer_count`.
>
> `timer_X_name` and `timer_X_state` are declared under `text_sensor:` in ESPHome
> but arrive in Home Assistant as `sensor.` entities, because Home Assistant has
> no `text_sensor` domain.

> There is **no** `timer_id` and **no** `control_entity` because there is no local control.

---

## 0) Start from the official Voice PE package

An illustrative base, not a replacement for your existing provisioning and hardware settings. This package reference is not pinned to a validated revision:

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

Merge the following fragments into the matching sections of your existing YAML. **Do not blindly append duplicate top-level keys.** Keep a single `esphome` mapping and combine `sensor`, `text_sensor`, `globals`, and `interval` lists with existing entries. Preserve the official package's existing boot hooks, `voice_assistant` configuration, and timer callback actions, including native sound and LED behavior. Add the mirror actions to matching callbacks instead of replacing them wholesale. Inspect the merged package configuration before compiling, and do not combine this implementation with the advanced firmware fragments.

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
- a `10s` TTL threshold checked every `5s`, so normal cleanup happens roughly 10 to 15 seconds after latching

Cancellation clears all latches early. Finished latches occupy display slots, leaving fewer slots for other active timers until cleared. This TTL implementation is separate from both local and remote handling in the advanced guide.

The callback example in section 3 references these globals. **Include this section when using that example as written.** To omit sticky finished behavior, first adapt the callbacks to remove every latch/timestamp reference and the custom finish-latching action, preserving the official package's own actions. Simply skipping this section will leave undefined IDs and will not compile.

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

If you choose the no-TTL adaptation, validate and compile the adapted callbacks together with the rest of the configuration before flashing.

---

## 3) Mirror timers from `voice_assistant`

The example uses the `timers` vector supplied to `on_timer_tick`, ordered by soonest finish in the timer interface it targets. It fills available display slots from the first timers in that vector. Only three slots are shown; a sticky finished latch takes priority over a running timer's display.

`on_timer_cancelled` clears **all** mirrored slots and latches, not just the cancelled timer. Other native timers continue on the device and reappear when a later tick republishes them. The count sensor reports the vector size on ticks, including timers beyond the three-slot display; TTL/cancel cleanup resets it to zero until another tick. It is not a persistent independent count.

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

> For a no-TTL adaptation, remove all `tX_finished` and `tX_finished_ts` references,
> including the latch checks around slot assignment and the custom finish-latching
> action. Do not remove the official package's native finish/cancel actions. Use
> the full example above with section 2 unless you are validating that adaptation.

---

## 4) Next steps in Home Assistant

Once your validated configuration is flashed and the raw entities are present, use:
- [voice-pe.md](voice-pe.md) for the complete three-slot HA templates and explicit `mode: voice_pe` card entries.

Those templates normalize state/name values and use `has_value` availability so missing data is not silently reported as an idle timer. Match their IDs and the card's template-sensor IDs to your actual entities, including numeric suffixes and renames. Mirror-only sensors deliberately lack `control_entity`, so Voice PE auto-discovery will not find them; list all three explicitly. The card can still create separate browser or configured storage timers, but it cannot control native voice timers through this mirror.

---

## Scale up to more slots

Copy the slot pattern to create slot 4/5/etc:
- add `timer_4_*` entities
- add `t4_finished*` (if using sticky finished)
- update the logic to publish additional slots

If you want **local controllable timers** too, use:
- [voice-pe-esphome.md](voice-pe-esphome.md)
