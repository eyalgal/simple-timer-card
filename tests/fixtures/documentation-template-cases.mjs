import { readFileSync } from "node:fs";
import { parse } from "yaml";

const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
const yamlBlocks = file => [...read(file).matchAll(/^```yaml\n([\s\S]*?)^```[ \t]*$/gm)].map(match => parse(match[1]));

// Run these through HA's read-only template renderer. Synthetic state replaces
// states/has_value/state_attr, so no installed entities or actions are touched.
const mockState = `
{% macro states(entity_id) -%}{{ test_states.get(entity_id, 'unknown') }}{%- endmacro %}
{% macro mock_has_value(entity_id, returns) -%}
  {% do returns(entity_id in test_states and test_states[entity_id] not in ['unknown', 'unavailable']) %}
{%- endmacro %}
{% set has_value = mock_has_value | as_function %}
{% macro mock_state_attr(entity_id, attribute, returns) -%}
  {% do returns(test_attributes.get(entity_id, {}).get(attribute)) %}
{%- endmacro %}
{% set state_attr = mock_state_attr | as_function %}
`;

function jsonResult(template) {
  const start = template.lastIndexOf("{{");
  const end = template.lastIndexOf("}}");
  if (start < 0 || end < start) throw new Error("Expected final template expression");
  return `${template.slice(0, start)}{{ (${template.slice(start + 2, end).trim()}) | to_json }}${template.slice(end + 2)}`;
}

export function documentationTemplateCases() {
  const cases = [];
  function add(name, template, variables, expected, { json = false, project } = {}) {
    cases.push({ name, template: mockState + (json ? jsonResult(template) : template),
      variables: { test_states: {}, test_attributes: {}, ...variables }, expected, json, project });
  }

  const mqtt = yamlBlocks("mqtt-hybrid-model.md");
  const transport = mqtt.find(block => block.mqtt?.sensor).mqtt.sensor[0];
  add("MQTT state marker", transport.value_template, { value: '{"version":1}' }, "1");
  add("MQTT malformed state marker", transport.value_template, { value: "bad json" }, "invalid");
  const envelope = { version: 1, timers: [], deleted: [], lastUpdated: 2000000 };
  for (const [name, payload, valid] of [["valid", envelope, true], ["array", [], false], ["wrong shape", { version: 1, timers: {} }, false], ["bad JSON", null, false]]) {
    add(`MQTT envelope ${name}`, transport.json_attributes_template,
      { value: payload === null ? "invalid" : JSON.stringify(payload) }, valid, { project: "store_valid" });
  }

  const monitor = mqtt.find(block => block.alias);
  const scan = monitor.action.find(step => step.variables?.scan).variables.scan;
  const ledgerValid = monitor.action.find(step => step.variables?.ledger_valid).variables.ledger_valid;
  const plan = monitor.action.find(step => step.variables?.plan).variables.plan;
  const due = { id: "custom-1", end_ts: 1999000, state: "active", source: "mqtt", label: "Tea" };
  const vars = { records: [due], now_ms: 2000000 };
  add("MQTT due deadline", scan, vars,
    { valid: true, current: [[due.id, due.end_ts]], due: [{ key: [due.id, due.end_ts], label: "Tea" }] }, { json: true });
  for (const [name, record] of [["paused", { ...due, paused: true, end_ts: null }], ["idle", { ...due, idle: true }], ["template", { ...due, kind: "template" }], ["finished", { ...due, finished: true }], ["future", { ...due, end_ts: 3000000 }]]) {
    add(`MQTT skips ${name}`, scan, { ...vars, records: [record] }, [], { json: true, project: "due" });
  }
  for (const [name, records] of [["missing records", null], ["non-record", ["invalid"]], ["string deadline", [{ ...due, end_ts: "1999000" }]], ["invalid paused flag", [{ ...due, paused: "false" }]], ["duplicate IDs", [due, due]]]) {
    add(`MQTT rejects ${name}`, scan, { ...vars, records }, false, { json: true, project: "valid" });
  }
  for (const [name, ledger, valid] of [["valid", { v1: true, done: [[due.id, due.end_ts]] }, true], ["missing", null, false], ["wrong shape", { v1: true, done: "bad" }, false], ["bad pair", { v1: true, done: [["custom-1"]] }, false]]) {
    add(`MQTT ledger ${name}`, ledgerValid, { ledger }, valid, { json: true });
  }
  const oldKey = [due.id, due.end_ts - 10000];
  const key = [due.id, due.end_ts];
  const dueItem = { key, label: "Tea" };
  const scanned = { valid: true, current: [key], due: [dueItem] };
  add("MQTT preserves exact existing claim", plan, { ledger: { v1: true, done: [key] }, scan: scanned },
    { kept: [key], pending: [], combined: [key] }, { json: true });
  add("MQTT re-notifies changed deadline", plan, { ledger: { v1: true, done: [oldKey] }, scan: scanned },
    { kept: [], pending: [dueItem], combined: [key] }, { json: true });
  add("MQTT prunes only absent deadlines", plan, { ledger: { v1: true, done: [key] }, scan: { current: [], due: [] } },
    { kept: [], pending: [], combined: [] }, { json: true });
  const capacity = monitor.action.find(step => step.if?.[0]?.value_template?.includes("plan.combined")).if[0].value_template;
  add("MQTT ledger within capacity", capacity, { plan: { combined: [key] } }, false, { json: true });
  add("MQTT ledger capacity exceeded", capacity, { plan: { combined: [["x".repeat(250), due.end_ts]] } }, true, { json: true });

  const [climate] = [parse(read("examples/climate_timer_example.yaml"))];
  for (const [name, payload, permitted] of [["valid", { event: "expired", source: "mqtt", source_entity: "sensor.simple_timer_store", pinned_id: "climate_timers:study_1hr" }, true], ["wrong source", { event: "expired", source: "alexa" }, false], ["array payload", [], false]]) {
    add(`Climate event ${name}`, climate.condition[0].value_template, { trigger: { payload_json: payload } }, permitted, { json: true });
  }
  for (const [pin, permitted] of [["climate_timers:study_1hr", true], ["study_1hr", false], ["climate_timers:unknown", false], [123, false]]) {
    add(`Climate allowlist ${pin}`, climate.condition[1].value_template,
      { trigger: { payload_json: { pinned_id: pin } }, ...climate.variables }, permitted, { json: true });
  }

  for (const file of ["voice-pe/voice-pe.md", "voice-pe/voice-pe-esphome.md"]) {
    const sensors = yamlBlocks(file).find(block => block.template).template[0].sensor;
    for (const [index, sensor] of sensors.entries()) {
      const prefix = `sensor.home_assistant_voice_timer_${index + 1}`;
      const test_states = { [`${prefix}_state`]: "active", [`${prefix}_total_seconds`]: "119", [`${prefix}_seconds_left`]: "59", [`${prefix}_name`]: "Tea", [`${prefix}_id`]: "local:123" };
      const name = `${file} slot ${index + 1}`;
      add(`${name} available`, sensor.availability, { test_states }, true, { json: true });
      add(`${name} unavailable timing`, sensor.availability,
        { test_states: { ...test_states, [`${prefix}_seconds_left`]: "unavailable" } }, false, { json: true });
      add(`${name} duration`, sensor.attributes.duration, { test_states }, "0:01:59");
      add(`${name} name`, sensor.attributes.display_name, { test_states }, "Tea");
      if (sensor.attributes.control_entity) {
        add(`${name} local control`, sensor.attributes.control_entity, { test_states }, "text.home_assistant_voice_timer_command");
        add(`${name} remote read-only`, sensor.attributes.control_entity,
          { test_states: { ...test_states, [`${prefix}_id`]: "remote:1" } }, "");
        add(`${name} empty read-only`, sensor.attributes.control_entity,
          { test_states: { ...test_states, [`${prefix}_id`]: "" } }, "");
      }
    }
  }
  return cases;
}