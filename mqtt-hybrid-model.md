# MQTT timers: backend notifications

**Customization templates, not a durable scheduler or a delivery guarantee.**
This guide addresses [notifications with no open frontend](https://github.com/eyalgal/simple-timer-card/issues/46)
by polling stored MQTT deadlines in Home Assistant (HA). It is intended for small,
non-critical workloads. Validate the YAML, templates, entities, and actions in your
own installation before enabling it.

The frontend still creates, controls, and displays timers. The backend monitor
below is the **only timer-notification path for this store**, whether a card is
open or closed. It calls your notification service directly. It neither listens
for frontend expiry events nor emits a second expiry event.

## Storage and event contracts

- Running stored records use `end_ts`, an epoch timestamp in **milliseconds**.
  Paused records use `paused: true`, `remaining_ms`, and `end_ts: null`. `remaining`
  is a frontend-derived value, not a stored countdown to poll. Do not test `end`
  or assume that a helper/sensor changes state when its deadline passes.
- Idle/predefined (`kind: template`) records are not running timers. The monitor
  explicitly excludes paused, idle, template, and finished records from alerts.
- The default `compatibility_mode: '2.1.1'` publishes a retained object envelope:
  `{timers: [...], deleted: [...], version: 1, lastUpdated: <epoch_ms>}`.
  The separate state topic carries `{version: 1, t: <epoch_ms>}`.
- `compatibility_mode: latest` instead publishes a bare timer array. It is
  **incompatible with this `json_attributes_topic` setup** and does not carry the
  shared `deleted` tombstones. Do not mix modes or wrap the array and assume that
  doing so restores the missing shared deletion protections.
- With the object envelope, cards use revisions, cached state, and deletion
  tombstones for **best-effort reconciliation**. Tombstones age out after **24
  hours**. Retained MQTT messages are snapshots, not transactional storage or a
  timer service. Concurrent writers, stale clients, and expired/missing tombstones
  can still lose edits or resurrect records. There are no concurrent-update or
  exactly-once guarantees. This monitor reads the sensor snapshot, not a card's
  private reconciliation cache, and does not reimplement that reconciliation.
- Card MQTT events require an actively running, connected frontend **and MQTT
  enabled on the card** (use `storage: mqtt` explicitly). They are published
  non-retained to `mqtt.events_topic` plus `/expired`, `/started`, etc. Ordinary
  MQTT timer events do **not** include `end_ts`; `timestamp` is the emission time,
  not an expiry-cycle identifier. Do not use it as a backend deadline key.
  Card `notify` calls also need a running
  frontend, although direct `notify` calls do not themselves require MQTT.

### Independent topic defaults

| Card setting | Default | HA consumer |
| --- | --- | --- |
| `mqtt.topic` | `simple_timer_card/timers` | Sensor `json_attributes_topic` |
| `mqtt.state_topic` | `simple_timer_card/timers/state` | Sensor `state_topic` |
| `mqtt.events_topic` | `simple_timer_card/events` | Event automation topic plus `/expired`, etc. |

These are three **independent settings**, not topics derived from `mqtt.topic`.
Custom topics are allowed, but change every corresponding publisher/consumer.
For independent stores, configure distinct sensors and topics explicitly.
`storage_namespace` does not isolate MQTT topics.

## 1. MQTT transport setup

Prerequisite: HA's MQTT integration connected to your broker. The following is a
**top-level configuration mapping**, not dashboard YAML or an automation. Merge
the sensor entry into an existing `mqtt.sensor` list rather than creating a
second `mqtt:` key. Apply it using HA's configuration reload/restart procedure.

```yaml
# CUSTOMIZATION TEMPLATE: top-level HA configuration mapping.
mqtt:
  sensor:
    - name: Simple Timer Store
      unique_id: simple_timer_store
      state_topic: simple_timer_card/timers/state
      value_template: >-
        {% set data = value | from_json(default=none) %}
        {{ 1 if data is mapping and data.get('version') is integer
           and data.get('version') == 1 else 'invalid' }}
      json_attributes_topic: simple_timer_card/timers
      json_attributes_template: >-
        {% set data = value | from_json(default=none) %}
        {% if data is mapping and data.get('version') is integer
              and data.get('version') == 1
              and data.get('timers') is sequence
              and data.get('timers') is not string
              and data.get('timers') is not mapping
              and data.get('deleted') is sequence
              and data.get('deleted') is not string
              and data.get('deleted') is not mapping
              and data.get('lastUpdated') is integer
              and data.get('lastUpdated') > 0 %}
          {{ dict(data, store_valid=true) | to_json }}
        {% else %}
          {{ {'store_valid': false, 'timers': none, 'deleted': none,
              'version': none, 'lastUpdated': none} | to_json }}
        {% endif %}
```

Verify the actual entity ID in **Developer Tools > States**. Names and unique IDs
do not guarantee an entity ID. This guide uses `sensor.simple_timer_store`; replace
it in the card and the monitor's `sensor_entity` variable if HA assigned another ID.
The sensor state should be `1`, with `store_valid: true` and a `timers` list after
the card publishes. Neither topic is a per-second heartbeat.

The attributes template marks bad JSON, wrong shapes, and bare arrays invalid
instead of turning them into an empty timer list that could clear the ledger.
`store_valid` validates the envelope only, not writer identity or freshness.
Broker disconnection can still leave a previously valid snapshot visible.

### Non-admin users (HA 2026.10+)

**Available since v2.9.1:** HA 2026.10 makes direct `mqtt.publish` calls admin-only.
An administrator must install the
[MQTT publish relay automation](examples/mqtt_publish_relay.yaml) for restricted
dashboard users. This is separate from the backend notification monitor below.

1. In **Settings > Automations & scenes**, create an empty automation, select
   **Edit in YAML**, and paste the example as one automation (not a dashboard
   card or a top-level `automation:` block).
2. In its first action, set `timer_topic`, `state_topic`, and `events_topic` to
   match the card and sensor. The defaults match this guide. Keep the validation
   **inside the actions**; manual triggers can skip top-level conditions and can
   supply variables, so the topic allowlist must also stay inside the actions.
3. Save, leave the automation enabled, and verify its actual entity ID.
   The suggested alias normally produces `automation.simple_timer_card_mqtt_relay`,
   but HA can assign a suffix. The non-admin account needs permission to control it.
4. Add `publish_automation: automation.simple_timer_card_mqtt_relay` to the
   card's existing `mqtt:` mapping, or select it under **Timer storage** in the
   visual editor. Keep the existing sensor, topics and namespace.
5. Fully reload the dashboard under each test account.

Administrators continue using `mqtt.publish` directly. Non-admins use
`automation.trigger` with a `variables.stc_request` object containing `operation`
(`store`, `state`, or `event`), `payload`, and, for events, `event`. The automation
chooses the topic and retain flag, not the caller. It supports both storage
compatibility formats, retains snapshots/state markers, and never retains events.
Requests exceeding **262144 characters after JSON encoding** are rejected.
`mode: queued` serializes accepted relay runs, with a maximum of 100 queued/running
runs; overflows are logged by HA. This does not make multi-client writes transactional.

A plain script wrapping `mqtt.publish` is not equivalent: scripts keep the
caller's user context. The relay relies on HA's automation runner creating a
new action context. This permission behavior must be tested on the target HA
version; it is not a promise about future HA authorization changes.

#### Verification checklist

- As an **admin**, confirm the existing direct path still works.
- As a **non-admin**, start both a preset and a custom timer; check that the
  shared sensor's `timers` attribute changes and another device sees the timer.
- Pause, resume, cancel, and let a timer expire. Verify the relevant non-retained
  event topics and any event-based automations. Check storage on both devices.
- Check the relay's **Traces** and HA logs for publish errors. A successful
  `automation.trigger` response alone is not proof of successful MQTT delivery.
- With no relay configured, a non-admin on HA 2026.10+ should see one setup
  warning rather than repeated unauthorized publishes. Missing/disabled relays
  also warn. After a permission rejection, fix permissions and reload to retry.

The card does not silently switch to local storage. Its existing display cache
can still contain unsynced changes after a failed write. Reads continue through
the MQTT sensor; this relay does not grant MQTT subscriptions, arbitrary topic
access, durable scheduling, or delivery guarantees.

## 2. Card setup and one notification owner

This is a **dashboard card mapping** for the card YAML editor. In a dashboard
`cards:` list, add it as one list item. The topics must match step 1.

```yaml
# CUSTOMIZATION TEMPLATE: dashboard card mapping, not HA configuration.
type: custom:simple-timer-card
storage: mqtt
storage_namespace: household_timers
compatibility_mode: '2.1.1'
mqtt:
  sensor_entity: sensor.simple_timer_store
  topic: simple_timer_card/timers
  state_topic: simple_timer_card/timers/state
  events_topic: simple_timer_card/events
notify: null
expire_action: keep
expire_keep_for: 300
auto_dismiss_writable: false
```

For **every card using this store**, remove its `notify` block or set `notify: null`.
Disabling audio alone does not disable card `notify`. Disable frontend MQTT
notification automations for the same store, including older dual-trigger
frontend/backend examples. Do not deploy both notification approaches together.
In-page audio can remain a deliberate local cue, but is not this backend path.

The five-minute retention is only a polling grace window, not an acknowledgment
protocol. A frontend can still dismiss/remove records before the monitor sees
them. Choose retention longer than normal polling delays and avoid immediate
automatic removal on any card sharing the store.

## 3. Bounded notification ledger

Create a **Text** helper in **Settings > Devices & services > Helpers**, set its
maximum length to **255**, and verify its entity ID. Or merge this **top-level
configuration mapping** into your existing `input_text:` mapping:

```yaml
# CUSTOMIZATION TEMPLATE: top-level HA configuration mapping.
input_text:
  simple_timer_card_backend_processed:
    name: Simple Timer Card Backend Processed
    max: 255
    # No initial: value. Allow HA to restore the previous ledger.
```

Use this helper only for this one monitor/store, not for timer storage. After
creating it, while the monitor is disabled, initialize it **once** with
`input_text.set_value` in **Developer Tools > Actions**: target
`input_text.simple_timer_card_backend_processed`, value `{"v1":true,"done":[]}`.
Do not reset it on startup. An unavailable, empty, or malformed helper is not
automatically treated as an empty ledger. When replacing the old comma-separated
ID example, disable the old automations and review existing expired timers before
initialization; previously delivered notifications cannot be recovered from IDs
alone and may repeat.

Each `done` entry is an exact `[id, end_ts]` pair, not a substring match or a
`pinned_id`. A snooze/restart or deadline edit creates a different cycle even when
`id` stays the same. Pairs are kept for as long as that record and deadline remain
in a valid snapshot. They are pruned **only when absent or the deadline changes**,
never by age or a "keep the last N" limit. Expired records left in storage retain
their claims, preventing a capacity-driven re-alert loop.

Before sending anything, the monitor checks that the retained claims **plus all
newly due cycles** fit in 255 characters of serialized JSON. If not, it warns and
stops that poll without truncating or claiming anything. Capacity depends on ID
length, not just timer count. Dismiss obsolete timers after reviewing them, or
use a more capable backend for larger workloads. **Do not clear the helper to
make room while the same expired records remain.**

The `v1: true` JSON marker is intentional: the lowercase JSON boolean keeps the
serialized helper value as text under HA's native template rendering. Keep the
`to_json` serialization in helper writes.

## 4. One serial polling monitor

**Customization template:** paste this **single automation mapping** into the
single-automation YAML editor. For an automation list, prefix `alias` with `- `
and indent the rest of the mapping two spaces. Do not add an `automation:` wrapper
in the editor. Replace `sensor_entity` and `processed_helper` with the actual IDs
from steps 1 and 3. Replace `notify.mobile_app_your_phone` with your actual action
from **Developer Tools > Actions**, and adapt its data to that notifier.
`persistent_notification.create` below is HA's built-in administrative warning,
not a second timer-expiry delivery path.

The monitor polls every five seconds, including after restart once valid data is
available. It accepts positive integer millisecond deadlines, rejects malformed
records/duplicate IDs without pruning claims, and safely parses the helper JSON.
An empty **valid** timer list permits pruning; unavailable/invalid data does not.

```yaml
# CUSTOMIZATION TEMPLATE: one automation mapping. One instance per store.
alias: "Simple Timer Card: Best-Effort Backend Notifications"
description: "Serial deadline polling for a small MQTT store, not a durable scheduler."
trigger:
  - platform: time_pattern
    seconds: "/5"
variables:
  sensor_entity: sensor.simple_timer_store
  processed_helper: input_text.simple_timer_card_backend_processed
condition:
  - condition: template
    value_template: >-
      {{ states(sensor_entity) == '1'
         and state_attr(sensor_entity, 'store_valid') is sameas true
         and states(processed_helper) not in ['unknown', 'unavailable'] }}
action:
  - variables:
      records: "{{ state_attr(sensor_entity, 'timers') }}"
      snapshot_updated: "{{ state_attr(sensor_entity, 'lastUpdated') }}"
      ledger: "{{ states(processed_helper) | from_json(default=none) }}"
      now_ms: "{{ (as_timestamp(now()) * 1000) | int }}"
  - variables:
      scan: >-
        {% set ns = namespace(valid=true, ids=[], current=[], due=[]) %}
        {% if records is not sequence or records is string or records is mapping %}
          {% set ns.valid = false %}
        {% else %}
          {% for t in records %}
            {% if t is not mapping %}
              {% set ns.valid = false %}
            {% else %}
              {% set tid = t.get('id') %}
              {% set end_ts = t.get('end_ts') %}
              {% set dormant = t.get('paused', false) or t.get('idle', false)
                   or t.get('finished', false) or t.get('kind') == 'template'
                   or t.get('source') == 'template'
                   or t.get('state') in ['paused', 'idle', 'finished'] %}
              {% if tid is not string or not tid or tid in ns.ids
                    or t.get('paused', false) is not boolean
                    or t.get('idle', false) is not boolean
                    or t.get('finished', false) is not boolean
                    or t.get('kind', 'active') is not string
                    or t.get('state', 'active') is not string
                    or not ((end_ts is integer and end_ts > 0)
                            or (end_ts is none and dormant)) %}
                {% set ns.valid = false %}
              {% else %}
                {% set ns.ids = ns.ids + [tid] %}
                {% if end_ts is integer and end_ts > 0 %}
                  {% set key = [tid, end_ts] %}
                  {% set ns.current = ns.current + [key] %}
                  {% if not dormant and t.get('source', 'mqtt') == 'mqtt'
                        and t.get('state', 'active') in ['active', 'expired']
                        and end_ts <= now_ms %}
                    {% set label = t.get('label') %}
                    {% set label = label if label is string and (label | trim) else 'Timer' %}
                    {% set ns.due = ns.due + [{'key': key, 'label': label}] %}
                  {% endif %}
                {% endif %}
              {% endif %}
            {% endif %}
          {% endfor %}
        {% endif %}
        {{ {'valid': ns.valid, 'current': ns.current, 'due': ns.due} }}
      ledger_valid: >-
        {% set ns = namespace(valid=false) %}
        {% if ledger is mapping and ledger.get('v1') is sameas true
              and ledger.get('done') is sequence
              and ledger.get('done') is not string
              and ledger.get('done') is not mapping %}
          {% set ns.valid = true %}
          {% for key in ledger['done'] %}
            {% if key is not sequence or key is string or key is mapping
                  or key | length != 2 or key[0] is not string or not key[0]
                  or key[1] is not integer or key[1] <= 0 %}
              {% set ns.valid = false %}
            {% endif %}
          {% endfor %}
        {% endif %}
        {{ ns.valid }}
  - if:
      - condition: template
        value_template: >-
          {{ not scan.valid or not ledger_valid
             or (state_attr(processed_helper, 'max') | int(0)) != 255 }}
    then:
      - service: persistent_notification.create
        data:
          notification_id: simple_timer_card_backend_monitor_warning
          title: "Timer monitor needs attention"
          message: >-
            No expiry notifications sent this poll. Check {{ sensor_entity }}
            records and {{ processed_helper }} JSON/max length (must be 255).
            Claims were not cleared. Review existing timers before repairing a ledger.
      - stop: "Invalid records or ledger configuration; preserve claims."
  - variables:
      plan: >-
        {% set ns = namespace(kept=[], pending=[], combined=[]) %}
        {% for key in ledger['done'] %}
          {% if key in scan.current and key not in ns.kept %}
            {% set ns.kept = ns.kept + [key] %}
          {% endif %}
        {% endfor %}
        {% set ns.combined = ns.kept %}
        {% for item in scan.due %}
          {% if item.key not in ns.combined %}
            {% set ns.pending = ns.pending + [item] %}
            {% set ns.combined = ns.combined + [item.key] %}
          {% endif %}
        {% endfor %}
        {{ {'kept': ns.kept, 'pending': ns.pending, 'combined': ns.combined} }}
  - if:
      - condition: template
        value_template: >-
          {{ ({'v1': true, 'done': plan.combined} | to_json | length) > 255 }}
    then:
      - service: persistent_notification.create
        data:
          notification_id: simple_timer_card_backend_monitor_warning
          title: "Timer monitor ledger is full"
          message: >-
            No expiry notifications sent this poll. Current claims plus due
            cycles exceed 255 characters. Review/dismiss obsolete stored timers
            or use another backend. Do not truncate/reset the ledger while the
            same expired records remain. This warning persists until dismissed.
      - stop: "Capacity exceeded; no timer notifications or ledger writes."
  # Remove only absent/changed deadlines. This does not claim new notifications.
  - if:
      - condition: template
        value_template: "{{ ledger['done'] != plan.kept }}"
    then:
      - service: input_text.set_value
        target:
          entity_id: "{{ processed_helper }}"
        data:
          value: "{{ {'v1': true, 'done': plan.kept} | to_json }}"
  - repeat:
      for_each: "{{ plan.pending }}"
      sequence:
        # Abort the whole poll on a changed snapshot/claim list. This is not a lock.
        - if:
            - condition: template
              value_template: >-
                {% set saved = states(processed_helper) | from_json(default=none) %}
                {% set expected = plan.kept +
                     (plan.pending[:repeat.index - 1] | map(attribute='key') | list) %}
                {{ not (states(sensor_entity) == '1'
                   and state_attr(sensor_entity, 'store_valid') is sameas true
                   and state_attr(sensor_entity, 'lastUpdated') == snapshot_updated
                   and state_attr(sensor_entity, 'timers') == records
                   and saved is mapping and saved.get('v1') is sameas true
                   and saved.get('done') == expected) }}
          then:
            - stop: "Store or ledger changed; recheck on the next poll."
        # Do not add continue_on_error: a rejected notify call must not be claimed.
        - service: notify.mobile_app_your_phone
          data:
            title: "Timer Expired"
            message: "{{ repeat.item.label }} is done!"
        # Claim only after the service returns without error. Not delivery proof.
        - service: input_text.set_value
          target:
            entity_id: "{{ processed_helper }}"
          data:
            value: >-
              {{ {'v1': true, 'done': plan.kept +
                  (plan.pending[:repeat.index] | map(attribute='key') | list)} | to_json }}
mode: single
max_exceeded: silent
```

### What the deduplication does and does not do

- Exact pair membership suppresses already claimed cycles while their records
  remain. The batch capacity check includes every due cycle before any alert.
  Successful notification calls are recorded one by one; a later failure does
  not pre-claim the rest of the batch.
- `mode: single` means **serial polling for this one automation**. Polls arriving
  while it runs are skipped. It is not cross-trigger/cross-automation duplicate
  suppression, and notification tags are not a delivery or exactly-once mechanism.
  Run just one copy of this monitor per store and give it exclusive use of its
  ledger helper.
- A notification service returning without error means HA accepted the call, not
  that a phone received it. Failure, timeout, restart, or a failed helper write
  between notification and claim can repeat an alert. A service can also accept
  a call whose downstream delivery later fails. There is **no exactly-once
  guarantee** and no transaction covering MQTT, notification delivery, and helper
  state. The final snapshot check narrows races but cannot eliminate them.

## Limitations

- **Polling/restarts:** normally up to five seconds plus service/runtime delays.
  Busy polls are skipped. HA must run with a correct clock; after restart only
  records still visible in the store can be considered. Helper restoration is
  not a transactional notification log.
- **Transient removal:** a valid empty/omitting snapshot permits pruning. A timer
  removed and restored across observed snapshots may alert again; changes entirely
  between polls can be missed. Removing a timer before its overdue record is seen
  loses that notification, including manual finish/removal or frontend cleanup.
- **HA/broker offline:** no monitor runs while HA is stopped. Broker outages can
  leave stale attributes and lost edits/events. Neither retained snapshots nor
  `store_valid` prove freshness or guarantee catch-up.
- **Helper capacity:** 255 characters is a hard limit. Overflow stops notifications
  and raises a warning instead of discarding live claims. Malformed/unavailable
  data never authorizes a ledger reset.
- **Untrusted writers/concurrency:** broker ACLs must restrict retained-state and
  event publishers. Payload labels, IDs, sources, timestamps, and tombstones are
  untrusted input, not authorization. Stale/conflicting/forged snapshots can cause
  wrong, repeated, or missed alerts. This example is **not safety-critical** and
  must not be used as a dependable equipment shutoff or emergency alert system.

## Other customization templates

- [examples/mqtt_timer_notifications.yaml](examples/mqtt_timer_notifications.yaml)
  and [examples/alexa_timer_notifications.yaml](examples/alexa_timer_notifications.yaml)
  are **frontend event notification alternatives**, not companion paths to enable
  alongside this monitor. They require an active card and MQTT; the monitor here
  only covers stored MQTT records, not Alexa or other external timer sources.
- [examples/helper_timer_monitor.yaml](examples/helper_timer_monitor.yaml) is an
  explicitly named **native `timer.finished` alternative**, not a JSON helper
  monitor. Native timers avoid frontend expiry detection, but HA does not replay
  `timer.finished` for deadlines that pass while HA is stopped.
- [examples/climate_timer_example.yaml](examples/climate_timer_example.yaml) uses
  an exact full `pinned_id` allowlist for a frontend-driven convenience action.
  It does not derive climate entity IDs from names and is not a backend shutoff
  guarantee.
