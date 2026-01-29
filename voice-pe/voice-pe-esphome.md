# Voice PE → ESPHome walkthrough (mirroring + locally controllable timers)

This page is the advanced ESPHome implementation walkthrough for the Voice PE + Simple Timer Card integration.

Use this if you want both:

* Remote timers: timers created via voice on the Voice PE device mirrored from `voice_assistant` timers
* Local timers: timers created from the Home Assistant UI start pause resume cancel

If you only want a mirror only read only setup, use:

* Mirror only: [voice-pe-esphome-readonly.md](voice-pe-esphome-readonly.md)

## Unofficial advanced

This requires taking full control of your Voice PE device configuration. Proceed only if you understand ESPHome and can recover your device.

## What you will get (entities Home Assistant will see)

### Per display slot (1..3)

* `sensor.timer_X_total_seconds`
* `sensor.timer_X_seconds_left`
* `text_sensor.timer_X_name`
* `text_sensor.timer_X_state` active paused finished idle
* `text_sensor.timer_X_id` required for local control local vs remote

### Global

* `sensor.timer_count` remote plus local active timers

### Control input (for local timers)

* `text.voice_pe_timer_command` receives commands like start pause resume cancel

## How the integration works (high level)

1. `voice_assistant.on_timer_tick` provides a timers vector remote timers sorted by soonest end.
2. We mirror the first N entries into internal remote storage r1..r3.
3. Separately, local timers t1..t3 are created controlled via commands written to `text.voice_pe_timer_command`.
4. A `publish_display` script merges remote timers first then local timers into display slots timer 1..timer 3.

Both remote and local timers can use a sticky finished state for about 10 seconds then clear.

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

Keep your existing Voice PE config packages wifi api etc.
Append the rest of this page to the same YAML.

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

Local timers are not native Voice PE timers, so they do not automatically trigger the device timer ring UI. This block makes local timers behave like the built in device timer finish experience by turning on `timer_ringing` and playing the configured timer finished sound.

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

Commands written into `text.voice_pe_timer_command`:

* `start:<seconds>:<optional name>`
* `pause:<timer_id>`
* `resume:<timer_id>`
* `cancel:<timer_id>`

This implementation guarantees:

* `timer_X_name` is empty when no user defined name is provided
* local slot stored name uses a fallback display name for internal use only, while the exposed name remains empty unless explicitly set

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

## 8) Mirror Voice PE timers into remote slots (voice_assistant on timer tick)

This mirrors device timers into r1..r3 and adds a sticky finished state if the device reports a timer with total greater than 0 and seconds left equal 0.

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
```

## 9) Remote TTL cleanup (sticky finished)

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

## Next: Home Assistant template sensors + card setup

After flashing and confirming entities exist, go back to:

* [voice-pe.md](voice-pe.md)

## Scale up to 5 slots

Copy the same pattern:

* add entities timer 4 and timer 5
* add local globals t4 and t5
* add remote globals r4 and r5
* update loops and conditions from 3 to 5
