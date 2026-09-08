import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import GithubSlugger from "github-slugger";
import { parseAllDocuments } from "yaml";

const root = fileURLToPath(new URL("../", import.meta.url));
const markdownFiles = ["", "voice-pe"].flatMap(dir =>
  readdirSync(join(root, dir)).filter(name => name.endsWith(".md")).map(name => join(root, dir, name))
);
const exampleFiles = readdirSync(join(root, "examples"))
  .filter(name => /\.ya?ml$/.test(name)).map(name => join(root, "examples", name));
const read = path => new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path));

function yamlExamples(text) {
  return [...text.matchAll(/^([ \t]*)```(?:yaml|yml)\s*\r?\n([\s\S]*?)^\1```[ \t]*$/gm)].map(match => ({
    line: text.slice(0, match.index).split("\n").length + 1,
    code: match[2].split("\n").map(line => line.startsWith(match[1]) ? line.slice(match[1].length) : line).join("\n"),
  }));
}

function yamlDocuments(code, label) {
  const documents = parseAllDocuments(code);
  for (const document of documents) {
    assert.deepEqual(document.errors.map(error => error.message), [], label);
  }
  // ESPHome-specific tags are only syntax-checked, not compiled or evaluated.
  return documents.map(document => document.toJS());
}

function headingIds(text) {
  const slugger = new GithubSlugger();
  const prose = text.replace(/^([ \t]*)```[^\n]*\n[\s\S]*?^\1```[ \t]*$/gm, "");
  return new Set([...prose.matchAll(/^#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gm)]
    .map(match => slugger.slug(match[1].replace(/`/g, ""))));
}

for (const path of markdownFiles) {
  const name = relative(root, path);
  test(`${name}: UTF-8, local links, anchors and YAML examples`, () => {
    const text = read(path);
    assert.ok(!text.includes("\ufffd"), `${name}: replacement character`);
    const prose = text.replace(/^([ \t]*)```[^\n]*\n[\s\S]*?^\1```[ \t]*$/gm, "");
    for (const [, target] of prose.matchAll(/\]\(([^\s)]+)\)/g)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
      const [file, fragment] = target.split("#");
      const destination = file ? resolve(dirname(path), decodeURIComponent(file)) : path;
      assert.ok(existsSync(destination), `${name}: missing ${target}`);
      if (fragment && extname(destination) === ".md") {
        assert.ok(headingIds(read(destination)).has(decodeURIComponent(fragment)), `${name}: missing anchor ${target}`);
      }
    }
    for (const example of yamlExamples(text)) yamlDocuments(example.code, `${name}:${example.line}`);
  });
}

for (const path of exampleFiles) {
  const name = relative(root, path);
  test(`${name}: explicit automation template and valid YAML`, () => {
    const text = read(path);
    assert.match(text, /CUSTOMIZATION TEMPLATE/);
    assert.match(text, /Paste context:/);
    const [automation] = yamlDocuments(text, name);
    assert.equal(typeof automation.alias, "string");
    assert.ok(Array.isArray(automation.trigger));
    assert.ok(Array.isArray(automation.action));
  });
}

test("Voice PE guides provide complete, separate three-slot HA templates", () => {
  for (const [file, controllable] of [["voice-pe/voice-pe.md", false], ["voice-pe/voice-pe-esphome.md", true]]) {
    const examples = yamlExamples(read(join(root, file))).flatMap(example => yamlDocuments(example.code, file));
    const templates = examples.find(example => example.template)?.template[0].sensor;
    assert.equal(templates.length, 3);
    for (const [index, sensor] of templates.entries()) {
      assert.match(sensor.availability, /has_value/);
      assert.ok(sensor.state.includes(`timer_${index + 1}_state`));
      for (const attr of ["display_name", "timer_name", "duration", "remaining"]) assert.equal(typeof sensor.attributes[attr], "string");
      if (controllable) {
        assert.ok(sensor.attributes.timer_id.includes(`timer_${index + 1}_id`));
        assert.match(sensor.attributes.control_entity, /timer_id\.startswith\('local:'\)/);
        assert.match(sensor.attributes.control_entity, /else ''/);
      } else {
        assert.equal(sensor.attributes.control_entity, undefined);
      }
    }
    const card = examples.find(example => example.type === "custom:simple-timer-card");
    assert.deepEqual(card.entities, [1, 2, 3].map(index => ({ mode: "voice_pe", entity: `sensor.vpe_timer_${index}` })));
    assert.equal(card.auto_voice_pe === true, controllable);
  }
});

test("MQTT guide uses matching object-envelope topics and one backend notifier", () => {
  const file = "mqtt-hybrid-model.md";
  const examples = yamlExamples(read(join(root, file))).flatMap(example => yamlDocuments(example.code, file));
  const sensor = examples.find(example => example.mqtt?.sensor)?.mqtt.sensor[0];
  const card = examples.find(example => example.type === "custom:simple-timer-card");
  assert.equal(card.mqtt.topic, sensor.json_attributes_topic);
  assert.equal(card.mqtt.state_topic, sensor.state_topic);
  assert.equal(card.compatibility_mode, "2.1.1");
  assert.equal(card.notify, null);
  const monitor = examples.find(example => example.alias);
  assert.deepEqual(monitor.trigger, [{ platform: "time_pattern", seconds: "/5" }]);
  assert.equal(monitor.mode, "single");
  const helper = examples.find(example => example.input_text)?.input_text.simple_timer_card_backend_processed;
  assert.equal(helper.max, 255);
  assert.equal(helper.initial, undefined);
  const scan = monitor.action.find(step => step.variables?.scan)?.variables.scan;
  assert.match(scan, /t\.get\('end_ts'\)/);
  assert.match(scan, /\[tid, end_ts\]/);
  assert.doesNotMatch(scan, /t\.get\('(?:end|remaining)'\)/);
  const sequence = monitor.action.find(step => step.repeat)?.repeat.sequence;
  const notifyIndex = sequence.findIndex(step => step.service?.startsWith("notify."));
  const claimIndex = sequence.findIndex(step => step.service === "input_text.set_value");
  assert.ok(notifyIndex >= 0 && claimIndex > notifyIndex, "Claim only after notification is accepted");
});

test("climate example targets only full namespaced pinned IDs", () => {
  const [automation] = yamlDocuments(read(join(root, "examples/climate_timer_example.yaml")), "climate example");
  const mapping = automation.variables.climate_by_pinned_id;
  assert.ok(Object.keys(mapping).every(key => key.startsWith("climate_timers:")));
  assert.ok(Object.values(mapping).every(entity => entity.startsWith("climate.")));
  assert.match(automation.condition[0].value_template, /'expired'/);
  assert.match(automation.condition[0].value_template, /'mqtt'/);
  assert.match(automation.condition[1].value_template, /pin in climate_by_pinned_id/);
  assert.equal(automation.action[0].target.entity_id, "{{ climate_by_pinned_id[trigger.payload_json.pinned_id] }}");
});

test("HACS artifact and supported release versions agree", () => {
  const manifest = JSON.parse(read(join(root, "hacs.json")));
  assert.ok(statSync(join(root, manifest.filename)).isFile());
  const source = read(join(root, "src/simple-timer-card.js"));
  const version = source.match(/const cardVersion\s*=\s*"([^"]+)"/)[1];
  assert.ok(source.includes(`* Version: ${version}`));
  assert.match(read(join(root, "SECURITY.md")), /Latest stable/);
});