# Voice PE → ESPHome walkthrough (mirroring + locally controllable timers)

This page is the advanced ESPHome implementation walkthrough for the Voice PE + Simple Timer Card integration.

Use this if you want both:

* **Remote timers:** native timers created by voice, mirrored from `voice_assistant` for read-only display in Home Assistant.
* **Local timers:** independent timers implemented by this example on the device, with UI start / pause / resume / cancel commands. They are not native voice timers, Home Assistant `timer.*` helpers, or browser-storage timers.

**Stock Voice PE firmware does not expose its native timers as Home Assistant timer entities or as these slot sensors.** This example adds sensors and a separate local timer implementation. It does not add card control of native voice timers.

If you only want a mirror only read only setup, use:

* Mirror only: [voice-pe-esphome-readonly.md](voice-pe-esphome-readonly.md)

## Unofficial advanced

This requires taking full control of your Voice PE device configuration. Proceed only if you understand ESPHome and can recover your device.

**This firmware example has not been compiled or flashed against current ESPHome for this documentation update.** No current package revision, ESPHome version, or pin configuration is validated here. The package reference below is not pinned to a validated revision. Select compatible versions, inspect the merged configuration, and validate and compile it before flashing. Back up your configuration and retain access to the [official Voice PE documentation](https://voice-pe.home-assistant.io/) and [official firmware installer](https://esphome.github.io/home-assistant-voice-pe/) for recovery.

## What you will get (entities Home Assistant will see)

### Per display slot (1..3)

* `sensor.home_assistant_voice_timer_X_total_seconds`
* `sensor.home_assistant_voice_timer_X_seconds_left`
* `sensor.home_assistant_voice_timer_X_name`
* `sensor.home_assistant_voice_timer_X_state` active paused finished idle
* `sensor.home_assistant_voice_timer_X_id` required for local control local vs remote

### Global

* `sensor.home_assistant_voice_timers_count`: mirrored remote entries plus unfinished local timers, including paused locals. This can exceed the three displayed rows and excludes finished locals. Only the first three native timers are stored in this example.

The generated suffix is normally **`timers_count`**, plural, from `name: "Timers Count"`. The internal ESPHome ID remains `timer_count`.

### Control input (for local timers)

* `text.home_assistant_voice_timer_command`: example command entity used by the HA templates and card below for start / pause / resume / cancel.

> All IDs are examples. The base config uses `friendly_name: Home Assistant Voice`,
> but actual IDs can have different prefixes, numeric suffixes such as `_2`, or
> earlier registry renames. Confirm every raw sensor, template sensor, and command
> entity in *Developer Tools → States*.
>
> With `name: "Voice PE Timer Command"` in section 2, the initial command ID may be
> `text.home_assistant_voice_voice_pe_timer_command`. The shorter ID used below
> assumes you rename that entity in Home Assistant. Alternatively, keep its real
> ID and substitute it in all three `control_entity` templates and the card's
> `voice_pe_control_entity`. No firmware rename is required.
>
> `timer_X_name`, `timer_X_state` and `timer_X_id` are declared under `text_sensor:`
> in ESPHome but arrive as `sensor.` entities, because Home Assistant has no
> `text_sensor` domain.

## How the integration works (high level)

1. `voice_assistant.on_timer_tick` provides the native timers vector, ordered by soonest finish in the timer interface this example uses.
2. The first three entries are mirrored into internal remote storage `r1` through `r3`.
3. Separately, local timers `t1` through `t3` are created and controlled via commands written to the command entity.
4. `publish_display` fills three shared display slots with remote timers first, then local timers in local-slot order. The `timer_id` attribute identifies the current occupant, not a fixed HA slot.

### Limits of this example

* **Three local timers maximum.** A start reuses the first empty or finished local slot. If all three contain unfinished timers, a fourth start replaces local slot 3, including a paused timer. There is no queue or full-capacity rejection.
* **Only three shared display slots.** Remote timers take priority. Local timers can be hidden while still counting down and invoking the local ring script. A local timer may finish and be cleaned up without ever appearing on the card. Explicit card entries do not increase firmware display capacity.
* **Native timers stay read-only.** The local command handler cannot pause, resume, or cancel them. `remote:1` through `remote:3` are synthetic display IDs, not native timer control IDs.
* **No guaranteed remote finished TTL.** Any native finish or cancel callback clears all remote mirror slots until remaining timers are republished by a later tick. The native timers themselves are not all cancelled by this cleanup.
* **Local TTL is separate.** Local finished records are eligible for cleanup after 10 seconds, checked every 5 seconds, unless cancelled or reused sooner. This is not a guarantee about remote timers or the separate mirror-only example.
* **Alarm state is shared.** Local commands, local TTL cleanup, and the boot hook turn off `timer_ringing`, which can affect an already ringing native alarm. Local storage is independent; the sound and LED hooks are not isolated. Sound compatibility must be validated as described in section 4.

## 0) Start from the official Voice PE package

An illustrative base, not a replacement for your existing provisioning and hardware settings:

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

### Merge the fragments, do not blindly append them

Keep your existing `packages`, `wifi`, `api`, hardware settings, and package hooks. The repeated headings below split one example for readability; they are **not** instructions to paste duplicate YAML mapping keys into the same file.

* Merge sections 3.1 and 3.2 into **one `globals:` list**.
* Merge the scripts in sections 4, 5, and 6 into **one `script:` list**, retaining existing scripts and resolving any ID collisions.
* Merge sections 7 and 9 into **one `interval:` list**, retaining existing intervals.
* Keep **one `esphome:` mapping**. Add section 10 as an additional `on_boot` automation without replacing the package's boot actions. If an existing hook is written as a single automation, preserve it as an entry when combining hooks into a list.
* Merge `sensor`, `text_sensor`, `text`, and `voice_assistant` entries with their existing sections. Preserve the package's existing `voice_assistant` configuration and actions in matching timer callbacks, including native sound and LED behavior. Add the mirror actions to those callbacks instead of replacing the callbacks wholesale.

Inspect the fully merged package configuration before compiling to confirm the original boot and voice-assistant hooks remain and each added action runs once. Do not combine this implementation with the mirror-only firmware fragments.

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
    id: timer_1_id
    name: "Timer 1 ID"
  - platform: template
    id: timer_1_name
    name: "Timer 1 Name"
  - platform: template
    id: timer_1_state
    name: "Timer 1 State"

  - platform: template
    id: timer_2_id
    name: "Timer 2 ID"
  - platform: template
    id: timer_2_name
    name: "Timer 2 Name"
  - platform: template
    id: timer_2_state
    name: "Timer 2 State"

  - platform: template
    id: timer_3_id
    name: "Timer 3 ID"
  - platform: template
    id: timer_3_name
    name: "Timer 3 Name"
  - platform: template
    id: timer_3_state
    name: "Timer 3 State"
```

## 2) Control input (required for local timers)

```yaml
text:
  - platform: template
    id: command_input
    name: "Voice PE Timer Command"
    optimistic: true
    mode: text
    on_value:
      then:
        - script.execute: handle_command
```

## 3) Internal storage (remote + local, 3 slots)

### 3.1) Local timer globals

```yaml
globals:
  - id: boot_counter
    type: uint32_t
    restore_value: yes
    initial_value: "0"

  - id: t1_id
    type: std::string
    restore_value: yes
    initial_value: '""'
  - id: t1_name_g
    type: std::string
    restore_value: yes
    initial_value: '""'
  - id: t1_total
    type: int
    restore_value: yes
    initial_value: "0"
  - id: t1_left
    type: int
    restore_value: yes
    initial_value: "0"
  - id: t1_active
    type: bool
    restore_value: yes
    initial_value: "false"
  - id: t1_finished
    type: bool
    restore_value: yes
    initial_value: "false"
  - id: t1_finished_ts
    type: uint32_t
    restore_value: yes
    initial_value: "0"

  - id: t2_id
    type: std::string
    restore_value: yes
    initial_value: '""'
  - id: t2_name_g
    type: std::string
    restore_value: yes
    initial_value: '""'
  - id: t2_total
    type: int
    restore_value: yes
    initial_value: "0"
  - id: t2_left
    type: int
    restore_value: yes
    initial_value: "0"
  - id: t2_active
    type: bool
    restore_value: yes
    initial_value: "false"
  - id: t2_finished
    type: bool
    restore_value: yes
    initial_value: "false"
  - id: t2_finished_ts
    type: uint32_t
    restore_value: yes
    initial_value: "0"

  - id: t3_id
    type: std::string
    restore_value: yes
    initial_value: '""'
  - id: t3_name_g
    type: std::string
    restore_value: yes
    initial_value: '""'
  - id: t3_total
    type: int
    restore_value: yes
    initial_value: "0"
  - id: t3_left
    type: int
    restore_value: yes
    initial_value: "0"
  - id: t3_active
    type: bool
    restore_value: yes
    initial_value: "false"
  - id: t3_finished
    type: bool
    restore_value: yes
    initial_value: "false"
  - id: t3_finished_ts
    type: uint32_t
    restore_value: yes
    initial_value: "0"
```

### 3.2) Remote (mirrored) timer globals

```yaml
globals:
  - id: r1_present
    type: bool
    restore_value: no
    initial_value: "false"
  - id: r1_name
    type: std::string
    restore_value: no
    initial_value: '""'
  - id: r1_total
    type: int
    restore_value: no
    initial_value: "0"
  - id: r1_left
    type: int
    restore_value: no
    initial_value: "0"
  - id: r1_active
    type: bool
    restore_value: no
    initial_value: "false"
  - id: r1_finished
    type: bool
    restore_value: no
    initial_value: "false"
  - id: r1_finished_ts
    type: uint32_t
    restore_value: no
    initial_value: "0"

  - id: r2_present
    type: bool
    restore_value: no
    initial_value: "false"
  - id: r2_name
    type: std::string
    restore_value: no
    initial_value: '""'
  - id: r2_total
    type: int
    restore_value: no
    initial_value: "0"
  - id: r2_left
    type: int
    restore_value: no
    initial_value: "0"
  - id: r2_active
    type: bool
    restore_value: no
    initial_value: "false"
  - id: r2_finished
    type: bool
    restore_value: no
    initial_value: "false"
  - id: r2_finished_ts
    type: uint32_t
    restore_value: no
    initial_value: "0"

  - id: r3_present
    type: bool
    restore_value: no
    initial_value: "false"
  - id: r3_name
    type: std::string
    restore_value: no
    initial_value: '""'
  - id: r3_total
    type: int
    restore_value: no
    initial_value: "0"
  - id: r3_left
    type: int
    restore_value: no
    initial_value: "0"
  - id: r3_active
    type: bool
    restore_value: no
    initial_value: "false"
  - id: r3_finished
    type: bool
    restore_value: no
    initial_value: "false"
  - id: r3_finished_ts
    type: uint32_t
    restore_value: no
    initial_value: "0"
```

## 4) Local ring behavior (sound + LED ring)

Local timers are not native Voice PE timers, so they do not automatically trigger the native timer finish experience. This block attempts to reuse the package's `timer_ringing` switch and `play_sound` script for sound and LEDs.

**Package-version dependency:** the `play_sound` parameters and the accepted value/type of `sound_file` must match your selected Voice PE package. In particular, `sound_file: timer_finished_sound` below is an unverified example, not a claim that the current package accepts that literal or that it should be changed to a particular lambda or substitution. Check the package's script declaration and its own timer-finish call, then validate and compile your merged configuration. Do not assume successful compilation alone proves ringing or alarm dismissal works on the device.

```yaml
script:
  - id: ring_local_timer
    mode: restart
    then:
      - switch.turn_on: timer_ringing
      - script.execute:
          id: play_sound
          priority: true
          sound_file: timer_finished_sound
```

## 5) Publish the merged display slots (remote first, then local)

```yaml
script:
  - id: publish_display
    mode: queued
    then:
      - lambda: |-
          auto clamp0 = [](int v){ return v < 0 ? 0 : v; };

          auto publish_slot_idle = [&](int ds){
            if (ds == 1) { id(timer_1_id).publish_state(""); id(timer_1_name).publish_state(""); id(timer_1_state).publish_state("idle"); id(timer_1_seconds_left).publish_state(0); id(timer_1_total_seconds).publish_state(0); }
            else if (ds == 2) { id(timer_2_id).publish_state(""); id(timer_2_name).publish_state(""); id(timer_2_state).publish_state("idle"); id(timer_2_seconds_left).publish_state(0); id(timer_2_total_seconds).publish_state(0); }
            else { id(timer_3_id).publish_state(""); id(timer_3_name).publish_state(""); id(timer_3_state).publish_state("idle"); id(timer_3_seconds_left).publish_state(0); id(timer_3_total_seconds).publish_state(0); }
          };

          auto publish_slot_values = [&](int ds, const std::string &tid, const std::string &nm, const std::string &st, int left, int total){
            left = clamp0(left);
            total = clamp0(total);

            if (ds == 1) { id(timer_1_id).publish_state(tid.c_str()); id(timer_1_name).publish_state(nm.c_str()); id(timer_1_state).publish_state(st.c_str()); id(timer_1_seconds_left).publish_state(left); id(timer_1_total_seconds).publish_state(total); }
            else if (ds == 2) { id(timer_2_id).publish_state(tid.c_str()); id(timer_2_name).publish_state(nm.c_str()); id(timer_2_state).publish_state(st.c_str()); id(timer_2_seconds_left).publish_state(left); id(timer_2_total_seconds).publish_state(total); }
            else { id(timer_3_id).publish_state(tid.c_str()); id(timer_3_name).publish_state(nm.c_str()); id(timer_3_state).publish_state(st.c_str()); id(timer_3_seconds_left).publish_state(left); id(timer_3_total_seconds).publish_state(total); }
          };

          auto remote_present = [&](int rs)->bool{
            if (rs==1) return id(r1_present);
            if (rs==2) return id(r2_present);
            return id(r3_present);
          };

          auto remote_name = [&](int rs)->std::string{
            if (rs==1) return id(r1_name);
            if (rs==2) return id(r2_name);
            return id(r3_name);
          };

          auto remote_total = [&](int rs)->int{
            if (rs==1) return id(r1_total);
            if (rs==2) return id(r2_total);
            return id(r3_total);
          };

          auto remote_left = [&](int rs)->int{
            if (rs==1) return id(r1_left);
            if (rs==2) return id(r2_left);
            return id(r3_left);
          };

          auto remote_state = [&](int rs)->std::string{
            bool finished=false;
            bool active=false;

            if (rs==1){ finished=id(r1_finished); active=id(r1_active); }
            else if (rs==2){ finished=id(r2_finished); active=id(r2_active); }
            else { finished=id(r3_finished); active=id(r3_active); }

            if (finished) return "finished";
            return active ? "active" : "paused";
          };

          auto local_has = [&](int ls) -> bool {
            if (ls == 1) return !id(t1_id).empty();
            if (ls == 2) return !id(t2_id).empty();
            return !id(t3_id).empty();
          };

          auto local_is_finished = [&](int ls) -> bool {
            if (ls == 1) return id(t1_finished);
            if (ls == 2) return id(t2_finished);
            return id(t3_finished);
          };

          auto local_is_active = [&](int ls) -> bool {
            if (ls == 1) return id(t1_active);
            if (ls == 2) return id(t2_active);
            return id(t3_active);
          };

          auto local_id = [&](int ls) -> std::string {
            if (ls == 1) return id(t1_id);
            if (ls == 2) return id(t2_id);
            return id(t3_id);
          };

          auto local_name = [&](int ls) -> std::string {
            if (ls == 1) return id(t1_name_g);
            if (ls == 2) return id(t2_name_g);
            return id(t3_name_g);
          };

          auto local_total = [&](int ls) -> int {
            if (ls == 1) return id(t1_total);
            if (ls == 2) return id(t2_total);
            return id(t3_total);
          };

          auto local_left = [&](int ls) -> int {
            if (ls == 1) return id(t1_left);
            if (ls == 2) return id(t2_left);
            return id(t3_left);
          };

          int remote_cnt = 0;
          for (int i=1;i<=3;i++) if (remote_present(i)) remote_cnt++;

          int local_cnt = 0;
          for (int i=1;i<=3;i++) if (local_has(i) && !local_is_finished(i)) local_cnt++;

          id(timer_count).publish_state(remote_cnt + local_cnt);

          int ds = 1;

          for (int rs=1; rs<=3 && ds<=3; rs++) {
            if (!remote_present(rs)) continue;
            std::string tid = "remote:" + std::to_string(rs);
            publish_slot_values(ds, tid, remote_name(rs), remote_state(rs), remote_left(rs), remote_total(rs));
            ds++;
          }

          for (int ls=1; ls<=3 && ds<=3; ls++) {
            if (!local_has(ls)) continue;

            std::string st = "idle";
            if (local_is_finished(ls)) st = "finished";
            else st = local_is_active(ls) ? "active" : "paused";

            publish_slot_values(ds, local_id(ls), local_name(ls), st, local_left(ls), local_total(ls));
            ds++;
          }

          while (ds <= 3) {
            publish_slot_idle(ds);
            ds++;
          }
```

## 6) Handle local timer control commands

Commands written into your command entity, shown here as `text.home_assistant_voice_timer_command`:

* `start:<seconds>:<optional name>`
* `pause:<timer_id>`
* `resume:<timer_id>`
* `cancel:<timer_id>`

Pause / resume / cancel require the current `local:` ID published by the device. A remote display ID is not a local control target.

For an unnamed local timer, the example stores a **generated duration label**, such as `5m timer`. `publish_display` exposes that label through `timer_X_name`, and the templates below use it in `display_name`. It is not hidden internal metadata. A supplied name is used instead.

```yaml
script:
  - id: handle_command
    mode: queued
    then:
      - switch.turn_off: timer_ringing
      - lambda: |-
          std::string cmd = id(command_input).state;
          if (cmd.empty()) return;

          auto mk_id = [&]() -> std::string {
            return "local:" + std::to_string(id(boot_counter)) + "-" + std::to_string(millis());
          };

          auto default_name_for = [&](int sec) -> std::string {
            if (sec < 60) return std::to_string(sec) + "s timer";
            if (sec % 60 == 0 && sec < 3600) return std::to_string(sec / 60) + "m timer";
            if (sec % 3600 == 0) return std::to_string(sec / 3600) + "h timer";
            return std::to_string(sec / 60) + "m timer";
          };

          auto slot_for_id = [&](const std::string &tid) -> int {
            if (!id(t1_id).empty() && id(t1_id) == tid) return 1;
            if (!id(t2_id).empty() && id(t2_id) == tid) return 2;
            if (!id(t3_id).empty() && id(t3_id) == tid) return 3;
            return 0;
          };

          auto alloc_slot = [&]() -> int {
            if (id(t1_id).empty() || id(t1_finished)) return 1;
            if (id(t2_id).empty() || id(t2_finished)) return 2;
            if (id(t3_id).empty() || id(t3_finished)) return 3;
            return 3;
          };

          auto clear_local_slot = [&](int s) {
            if (s == 1) { id(t1_id)=""; id(t1_name_g)=""; id(t1_total)=0; id(t1_left)=0; id(t1_active)=false; id(t1_finished)=false; id(t1_finished_ts)=0; }
            else if (s == 2) { id(t2_id)=""; id(t2_name_g)=""; id(t2_total)=0; id(t2_left)=0; id(t2_active)=false; id(t2_finished)=false; id(t2_finished_ts)=0; }
            else { id(t3_id)=""; id(t3_name_g)=""; id(t3_total)=0; id(t3_left)=0; id(t3_active)=false; id(t3_finished)=false; id(t3_finished_ts)=0; }
          };

          auto set_active = [&](int s, bool active) {
            if (s == 1) id(t1_active)=active;
            else if (s == 2) id(t2_active)=active;
            else id(t3_active)=active;
          };

          auto can_resume = [&](int s)->bool{
            if (s == 1) return !id(t1_finished) && id(t1_left) > 0;
            if (s == 2) return !id(t2_finished) && id(t2_left) > 0;
            return !id(t3_finished) && id(t3_left) > 0;
          };

          if (cmd.rfind("start:", 0) == 0) {
            std::string rest = cmd.substr(6);

            std::string seconds_s = rest;
            std::string name_s = "";
            size_t pos = rest.find(':');
            if (pos != std::string::npos) {
              seconds_s = rest.substr(0, pos);
              name_s = rest.substr(pos + 1);
            }

            int s = atoi(seconds_s.c_str());
            if (s <= 0) { id(command_input).publish_state(""); return; }

            std::string stored_name = name_s.empty() ? default_name_for(s) : name_s;

            int slot = alloc_slot();
            std::string tid = mk_id();

            if (slot == 1) { id(t1_id)=tid; id(t1_name_g)=stored_name; id(t1_total)=s; id(t1_left)=s; id(t1_active)=true; id(t1_finished)=false; id(t1_finished_ts)=0; }
            else if (slot == 2) { id(t2_id)=tid; id(t2_name_g)=stored_name; id(t2_total)=s; id(t2_left)=s; id(t2_active)=true; id(t2_finished)=false; id(t2_finished_ts)=0; }
            else { id(t3_id)=tid; id(t3_name_g)=stored_name; id(t3_total)=s; id(t3_left)=s; id(t3_active)=true; id(t3_finished)=false; id(t3_finished_ts)=0; }

            id(publish_display).execute();
            id(command_input).publish_state("");
            return;
          }

          if (cmd.rfind("pause:", 0) == 0) {
            std::string tid = cmd.substr(6);
            int slot = slot_for_id(tid);
            if (slot != 0) set_active(slot, false);
            id(publish_display).execute();
            id(command_input).publish_state("");
            return;
          }

          if (cmd.rfind("resume:", 0) == 0) {
            std::string tid = cmd.substr(7);
            int slot = slot_for_id(tid);
            if (slot != 0 && can_resume(slot)) set_active(slot, true);
            id(publish_display).execute();
            id(command_input).publish_state("");
            return;
          }

          if (cmd.rfind("cancel:", 0) == 0) {
            std::string tid = cmd.substr(7);
            int slot = slot_for_id(tid);
            if (slot != 0) clear_local_slot(slot);
            id(publish_display).execute();
            id(command_input).publish_state("");
            return;
          }

          id(command_input).publish_state("");
          id(publish_display).execute();
```

## 7) Local countdown + local TTL cleanup + ring on finish

The countdown decrements once per running interval, not from an absolute wall-clock deadline. It is not a guarantee of accurate timer recovery across device downtime or reboot. The cleanup interval below applies to **local** finished records only, with a 10-second threshold checked every 5 seconds. Ringing also depends on the package hooks in section 4.

```yaml
interval:
  - interval: 1s
    then:
      - lambda: |-
          auto tick_one = [&](int s) {
            if (s == 1) {
              if (id(t1_id).empty() || id(t1_finished) || !id(t1_active)) return;
              if (id(t1_left) > 0) id(t1_left) -= 1;
              if (id(t1_left) <= 0) {
                id(t1_left) = 0;
                id(t1_active) = false;
                id(t1_finished) = true;
                id(t1_finished_ts) = millis();
                id(ring_local_timer).execute();
              }
              return;
            }
            if (s == 2) {
              if (id(t2_id).empty() || id(t2_finished) || !id(t2_active)) return;
              if (id(t2_left) > 0) id(t2_left) -= 1;
              if (id(t2_left) <= 0) {
                id(t2_left) = 0;
                id(t2_active) = false;
                id(t2_finished) = true;
                id(t2_finished_ts) = millis();
                id(ring_local_timer).execute();
              }
              return;
            }
            if (s == 3) {
              if (id(t3_id).empty() || id(t3_finished) || !id(t3_active)) return;
              if (id(t3_left) > 0) id(t3_left) -= 1;
              if (id(t3_left) <= 0) {
                id(t3_left) = 0;
                id(t3_active) = false;
                id(t3_finished) = true;
                id(t3_finished_ts) = millis();
                id(ring_local_timer).execute();
              }
              return;
            }
          };

          tick_one(1);
          tick_one(2);
          tick_one(3);

          id(publish_display).execute();

  - interval: 5s
    then:
      - lambda: |-
          const uint32_t now = millis();
          const uint32_t TTL = 10000;

          auto clear_if_ttl = [&](int s) {
            if (s == 1) {
              if (!id(t1_finished) || id(t1_finished_ts) == 0) return;
              if ((uint32_t)(now - id(t1_finished_ts)) <= TTL) return;
              id(timer_ringing).turn_off();
              id(t1_id)=""; id(t1_name_g)=""; id(t1_total)=0; id(t1_left)=0; id(t1_active)=false; id(t1_finished)=false; id(t1_finished_ts)=0;
              return;
            }
            if (s == 2) {
              if (!id(t2_finished) || id(t2_finished_ts) == 0) return;
              if ((uint32_t)(now - id(t2_finished_ts)) <= TTL) return;
              id(timer_ringing).turn_off();
              id(t2_id)=""; id(t2_name_g)=""; id(t2_total)=0; id(t2_left)=0; id(t2_active)=false; id(t2_finished)=false; id(t2_finished_ts)=0;
              return;
            }
            if (s == 3) {
              if (!id(t3_finished) || id(t3_finished_ts) == 0) return;
              if ((uint32_t)(now - id(t3_finished_ts)) <= TTL) return;
              id(timer_ringing).turn_off();
              id(t3_id)=""; id(t3_name_g)=""; id(t3_total)=0; id(t3_left)=0; id(t3_active)=false; id(t3_finished)=false; id(t3_finished_ts)=0;
              return;
            }
          };

          clear_if_ttl(1);
          clear_if_ttl(2);
          clear_if_ttl(3);

          id(publish_display).execute();
```

## 8) Mirror Voice PE timers into remote slots (voice_assistant timer events)

This mirrors native device timers into `r1` through `r3`. A tick reporting a positive total and zero seconds left can publish `finished` in that snapshot, but this is not a latched 10-second completion display.

Both `on_timer_cancelled` and `on_timer_finished` clear **all remote slots**, not just the affected timer. Other native timers are temporarily absent from the mirror until a later tick republishes them. This avoids relying on another tick after the last native timer disappears, but does not provide per-timer remote cleanup or a guaranteed remote TTL. Preserve the official package's existing actions in these callbacks when merging.

```yaml
voice_assistant:
  on_timer_tick:
    - lambda: |-
        auto clamp0 = [](int v){ return v < 0 ? 0 : v; };

        auto clear_remote = [&](int i){
          if (i==1){ id(r1_present)=false; id(r1_name)=""; id(r1_total)=0; id(r1_left)=0; id(r1_active)=false; id(r1_finished)=false; id(r1_finished_ts)=0; }
          else if (i==2){ id(r2_present)=false; id(r2_name)=""; id(r2_total)=0; id(r2_left)=0; id(r2_active)=false; id(r2_finished)=false; id(r2_finished_ts)=0; }
          else { id(r3_present)=false; id(r3_name)=""; id(r3_total)=0; id(r3_left)=0; id(r3_active)=false; id(r3_finished)=false; id(r3_finished_ts)=0; }
        };

        auto mark_finished_once = [&](int idx){
          if (idx==1){ if (!id(r1_finished)) { id(r1_finished)=true; id(r1_finished_ts)=millis(); } }
          else if (idx==2){ if (!id(r2_finished)) { id(r2_finished)=true; id(r2_finished_ts)=millis(); } }
          else { if (!id(r3_finished)) { id(r3_finished)=true; id(r3_finished_ts)=millis(); } }
        };

        auto clear_finished_if_running = [&](int idx){
          if (idx==1){ id(r1_finished)=false; id(r1_finished_ts)=0; }
          else if (idx==2){ id(r2_finished)=false; id(r2_finished_ts)=0; }
          else { id(r3_finished)=false; id(r3_finished_ts)=0; }
        };

        auto set_remote = [&](int i, const auto &t){
          std::string nm = t.name.c_str();
          int total = clamp0((int)t.total_seconds);
          int left = clamp0((int)t.seconds_left);

          bool finished = (total > 0 && left == 0);
          bool active = ((bool)t.is_active) && (left > 0) && !finished;

          if (finished) mark_finished_once(i);
          else if (left > 0) clear_finished_if_running(i);

          if (i==1){ id(r1_present)=true; id(r1_name)=nm; id(r1_total)=total; id(r1_left)=left; id(r1_active)=active; }
          else if (i==2){ id(r2_present)=true; id(r2_name)=nm; id(r2_total)=total; id(r2_left)=left; id(r2_active)=active; }
          else { id(r3_present)=true; id(r3_name)=nm; id(r3_total)=total; id(r3_left)=left; id(r3_active)=active; }
        };

        clear_remote(1);
        clear_remote(2);
        clear_remote(3);

        const int n = (int) timers.size();
        if (n > 0) set_remote(1, timers[0]);
        if (n > 1) set_remote(2, timers[1]);
        if (n > 2) set_remote(3, timers[2]);

        id(publish_display).execute();

  on_timer_cancelled:
    - lambda: |-
        // on_timer_tick stops firing when no timers remain.
        // Force-clear all remote slots so entities don't stay stuck.
        id(r1_present)=false; id(r1_name)=""; id(r1_total)=0; id(r1_left)=0; id(r1_active)=false; id(r1_finished)=false; id(r1_finished_ts)=0;
        id(r2_present)=false; id(r2_name)=""; id(r2_total)=0; id(r2_left)=0; id(r2_active)=false; id(r2_finished)=false; id(r2_finished_ts)=0;
        id(r3_present)=false; id(r3_name)=""; id(r3_total)=0; id(r3_left)=0; id(r3_active)=false; id(r3_finished)=false; id(r3_finished_ts)=0;
        id(publish_display).execute();

  on_timer_finished:
    - lambda: |-
        // Same cleanup for finished timers.
        id(r1_present)=false; id(r1_name)=""; id(r1_total)=0; id(r1_left)=0; id(r1_active)=false; id(r1_finished)=false; id(r1_finished_ts)=0;
        id(r2_present)=false; id(r2_name)=""; id(r2_total)=0; id(r2_left)=0; id(r2_active)=false; id(r2_finished)=false; id(r2_finished_ts)=0;
        id(r3_present)=false; id(r3_name)=""; id(r3_total)=0; id(r3_left)=0; id(r3_active)=false; id(r3_finished)=false; id(r3_finished_ts)=0;
        id(publish_display).execute();
```

## 9) Remote cleanup interval (not a guaranteed TTL)

This interval can clear a residual remote finished record only if its timestamp survives long enough. Section 8 clears and rebuilds remote storage on every tick, resetting those timestamps, and the finish/cancel handlers clear remote records immediately. Keeping this interval does **not** guarantee a sticky remote finished state. The local TTL in section 7 and mirror-only latches in [voice-pe-esphome-readonly.md](voice-pe-esphome-readonly.md) are separate implementations.

```yaml
interval:
  - interval: 5s
    then:
      - lambda: |-
          const uint32_t now = millis();
          const uint32_t TTL = 10000;

          auto clear_remote_if_ttl = [&](int i){
            if (i==1){
              if (!id(r1_present) || !id(r1_finished) || id(r1_finished_ts)==0) return;
              if ((uint32_t)(now - id(r1_finished_ts)) <= TTL) return;
              id(r1_present)=false; id(r1_name)=""; id(r1_total)=0; id(r1_left)=0; id(r1_active)=false; id(r1_finished)=false; id(r1_finished_ts)=0;
              return;
            }
            if (i==2){
              if (!id(r2_present) || !id(r2_finished) || id(r2_finished_ts)==0) return;
              if ((uint32_t)(now - id(r2_finished_ts)) <= TTL) return;
              id(r2_present)=false; id(r2_name)=""; id(r2_total)=0; id(r2_left)=0; id(r2_active)=false; id(r2_finished)=false; id(r2_finished_ts)=0;
              return;
            }
            if (!id(r3_present) || !id(r3_finished) || id(r3_finished_ts)==0) return;
            if ((uint32_t)(now - id(r3_finished_ts)) <= TTL) return;
            id(r3_present)=false; id(r3_name)=""; id(r3_total)=0; id(r3_left)=0; id(r3_active)=false; id(r3_finished)=false; id(r3_finished_ts)=0;
          };

          clear_remote_if_ttl(1);
          clear_remote_if_ttl(2);
          clear_remote_if_ttl(3);

          id(publish_display).execute();
```

## 10) Boot hook (recommended)

Merge this into the existing `esphome` mapping as an additional boot automation. Preserve the package's current boot hooks and their actions; do not replace the earlier `esphome` settings or paste a second key into the same mapping.

```yaml
esphome:
  on_boot:
    priority: -10
    then:
      - switch.turn_off: timer_ringing
      - lambda: |-
          id(boot_counter) += 1;
      - script.execute: publish_display
```

## 11) Home Assistant template sensors (all three slots)

After validating, compiling, and flashing your own merged configuration, confirm the raw entities in Home Assistant. Use these templates **instead of** the mirror-only HA templates if switching setups. Merge the three sensor definitions into your existing `template` configuration; do not create duplicate top-level keys or a second set of the same sensors.

These repeat the mirror-only `display_name`, `timer_name`, `duration`, and `remaining` attributes described in [voice-pe.md](voice-pe.md), adding the complete local-control mapping for every slot:

* `timer_id` comes from that display slot's raw `sensor.home_assistant_voice_timer_N_id`. It changes when the slot's occupant changes.
* `control_entity` is `text.home_assistant_voice_timer_command` **only when the trimmed ID starts with `local:`**, otherwise it is empty. The card treats any nonempty ID plus control-entity attribute as controllable; it does not enforce the `local:` prefix itself. Do not expose the command entity unconditionally on remote or empty slots.
* `availability` uses `has_value` for required state, timing, and ID sensors, with valid-state and numeric checks. Empty IDs are normal for idle slots. Optional unknown/unavailable names become empty, while missing required data makes the template sensor unavailable. The explicit `idle` fallback does not override that availability check.
* `display_name` uses a usable name or a duration-based label. `timer_name` alone is not read as the card's label. Unnamed local timers already have the generated duration label described in section 6.

All entity IDs below are examples, including the resulting `sensor.vpe_timer_1`, `sensor.vpe_timer_2`, and `sensor.vpe_timer_3`. Substitute real prefixes, numeric suffixes, or renamed IDs. Rename the command entity to the shorter example ID or replace it consistently in **all three** attributes and the card configuration.

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
             and is_number(states('sensor.home_assistant_voice_timer_1_seconds_left'))
             and has_value('sensor.home_assistant_voice_timer_1_id') }}
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
          timer_id: >-
            {% set timer_id = states('sensor.home_assistant_voice_timer_1_id') | trim %}
            {{ timer_id if timer_id | lower not in ['unknown', 'unavailable'] else '' }}
          control_entity: >-
            {% set timer_id = states('sensor.home_assistant_voice_timer_1_id') | trim %}
            {{ 'text.home_assistant_voice_timer_command' if timer_id.startswith('local:') else '' }}

      - name: "VPE Timer 2"
        availability: >-
          {{ has_value('sensor.home_assistant_voice_timer_2_state')
             and (states('sensor.home_assistant_voice_timer_2_state') | trim | lower) in ['active', 'paused', 'finished', 'idle']
             and has_value('sensor.home_assistant_voice_timer_2_total_seconds')
             and is_number(states('sensor.home_assistant_voice_timer_2_total_seconds'))
             and has_value('sensor.home_assistant_voice_timer_2_seconds_left')
             and is_number(states('sensor.home_assistant_voice_timer_2_seconds_left'))
             and has_value('sensor.home_assistant_voice_timer_2_id') }}
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
          timer_id: >-
            {% set timer_id = states('sensor.home_assistant_voice_timer_2_id') | trim %}
            {{ timer_id if timer_id | lower not in ['unknown', 'unavailable'] else '' }}
          control_entity: >-
            {% set timer_id = states('sensor.home_assistant_voice_timer_2_id') | trim %}
            {{ 'text.home_assistant_voice_timer_command' if timer_id.startswith('local:') else '' }}

      - name: "VPE Timer 3"
        availability: >-
          {{ has_value('sensor.home_assistant_voice_timer_3_state')
             and (states('sensor.home_assistant_voice_timer_3_state') | trim | lower) in ['active', 'paused', 'finished', 'idle']
             and has_value('sensor.home_assistant_voice_timer_3_total_seconds')
             and is_number(states('sensor.home_assistant_voice_timer_3_total_seconds'))
             and has_value('sensor.home_assistant_voice_timer_3_seconds_left')
             and is_number(states('sensor.home_assistant_voice_timer_3_seconds_left'))
             and has_value('sensor.home_assistant_voice_timer_3_id') }}
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
          timer_id: >-
            {% set timer_id = states('sensor.home_assistant_voice_timer_3_id') | trim %}
            {{ timer_id if timer_id | lower not in ['unknown', 'unavailable'] else '' }}
          control_entity: >-
            {% set timer_id = states('sensor.home_assistant_voice_timer_3_id') | trim %}
            {{ 'text.home_assistant_voice_timer_command' if timer_id.startswith('local:') else '' }}
```

Reload Template Entities or restart Home Assistant. Confirm the template sensors' state and attributes, not just the raw seconds sensors. The command entity is a separate input and must exist and be available before sending commands.

## 12) Simple Timer Card configuration (remote display + local UI creation)

List **all three** template sensors explicitly and set each entry's `mode: voice_pe`. The example uses horizontal bars with separate pause/resume and cancel buttons for local timer rows.

```yaml
type: custom:simple-timer-card
style: bar_horizontal
auto_voice_pe: true
voice_pe_control_entity: text.home_assistant_voice_timer_command
entities:
  - mode: voice_pe
    entity: sensor.vpe_timer_1
  - mode: voice_pe
    entity: sensor.vpe_timer_2
  - mode: voice_pe
    entity: sensor.vpe_timer_3
```

### Why both an explicit list and `auto_voice_pe: true`?

* Voice PE auto-discovery only fills an **empty `entities` list**. It considers supported timer states with a **nonempty `control_entity` attribute**, then keeps that initial discovered list rather than continuously tracking new slots.
* These shared slots dynamically switch between remote, local, and idle occupants. Remote and idle slots deliberately have an empty control attribute, so auto-discovery can miss them or discover only a subset. The normal `mode: auto` detector does not recognize this template format either. Explicit `mode: voice_pe` entries keep all three slots configured through those changes.
* With that list present, `auto_voice_pe: true` still routes the preset/custom timer UI to Voice PE local creation. `voice_pe_control_entity` provides the command target even when the first listed sensor is remote or idle and has no control attribute. It does **not** make that remote timer controllable or select a fixed local storage slot; the device's allocator chooses the slot.

Keep the command text entity out of the card's `entities` list and do not use it as a generic timer-storage helper. The card sends `start:<seconds>[:<name>]` through `text.set_value`; it reads the slot attributes for pause/resume/cancel. Local timers do not support snooze or duration extension through this command protocol. Native timers remain read-only regardless of the card-level creation settings.

Before relying on the setup, check that local occupants expose a `local:` ID and the correct command entity, while remote/empty occupants have an empty `control_entity`. Unavailable sensors are skipped by the card, so an empty card is not proof that no device timers are running. Check raw entities and remember the remote-first display limit. Actual compilation, flashing, and device behavior require separate validation.

## Scale up to 5 slots

The example is fixed at three local storage slots and three shared display slots. Adding two HA sensors or card entries alone does not create capacity. A five-slot adaptation would need new entities and globals, ID lookup and allocation branches, display logic, all countdown/finish/cleanup handlers, HA templates, and card entries. That is a separate firmware change requiring validation and compilation, not a supported option in the example as written.
