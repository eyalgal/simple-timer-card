import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { parse } from "yaml";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "customElements", "localStorage", "HTMLElement", "Element", "Node", "CustomEvent", "Document", "CSSStyleSheet", "ShadowRoot"]) {
  globalThis[key] = dom.window[key];
}
await import("../simple-timer-card.js");
afterEach(() => localStorage.clear());
after(() => dom.window.close());

const KITCHEN = "timer_list.kitchen_timers";
const BEDROOM = "timer_list.bedroom_timers";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

function makeConnection() {
  const subs = [];
  return {
    subs,
    subscribeMessage(callback, message) {
      subs.push({ callback, message });
      return Promise.resolve(() => Promise.resolve());
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

function makeCard(config = {}, { states = {}, registry = true } = {}) {
  const card = document.createElement("simple-timer-card");
  card.setConfig(config);
  const connection = makeConnection();
  const calls = [];
  const ws = [];
  const warnings = [];
  card.addEventListener("hass-notification", (ev) => warnings.push(ev.detail.message));
  card.hass = {
    user: { id: "tester", is_admin: true },
    config: { version: "2026.12.0" },
    connection,
    states: {
      [KITCHEN]: { state: "1", attributes: { friendly_name: "Kitchen Timers", supported_features: 63 } },
      [BEDROOM]: { state: "0", attributes: { friendly_name: "Bedroom Timers", supported_features: 63 } },
      ...states,
    },
    ...(registry ? {
      entities: { [KITCHEN]: { device_id: "d1" }, [BEDROOM]: { device_id: "d2" } },
      devices: { d1: { name: "Kitchen Voice", area_id: "kitchen" }, d2: { name: "Bedroom Voice", area_id: "bedroom" } },
      areas: { kitchen: { name: "Kitchen" }, bedroom: { name: "Bedroom" } },
    } : {}),
    callService: (...args) => { calls.push(args); return Promise.resolve(); },
    callWS: (msg) => { ws.push(msg); return Promise.resolve({ response: {} }); },
  };
  return { card, connection, calls, ws, warnings };
}

function listItem(overrides = {}) {
  return { timer_id: "t", name: null, status: "active", created_duration: 300, total_duration: 300, created_at: iso(), remaining: 200, ...overrides };
}

async function withTimers(config, timersByList, options) {
  const ctx = makeCard(config, options);
  ctx.card._updateTimers();
  await flush();
  for (const sub of ctx.connection.subs) {
    const timers = timersByList[sub.message.entity_id];
    if (timers) sub.callback({ type: "timers", timers });
  }
  ctx.card._updateTimers();
  return ctx;
}

test("ringing rows get the configured animation class", async () => {
  const { card } = makeCard({ ring_animation: "shake" });
  assert.equal(card._ringAnimationClass(), " ring-shake");
  card.setConfig({ ring_animation: "spin" });
  assert.equal(card._ringAnimationClass(), "");
});

test("max_rows shows the first timers and a toggle for the rest", async () => {
  const { card } = await withTimers({ entities: [KITCHEN], max_rows: 2 }, {
    [KITCHEN]: [listItem({ timer_id: "a" }), listItem({ timer_id: "b" }), listItem({ timer_id: "c" })],
  });
  document.body.appendChild(card);
  await card.updateComplete;
  assert.equal(card.shadowRoot.querySelectorAll("li.item").length, 2);
  const toggle = card.shadowRoot.querySelector(".more-toggle");
  assert.equal(toggle.textContent.trim(), "+1 more");
  toggle.click();
  await card.updateComplete;
  assert.equal(card.shadowRoot.querySelectorAll("li.item").length, 3);
  card.remove();
});

test("hide_when_empty hides the card and asks hui-card to keep it connected", async () => {
  const { card } = makeCard({ entities: [KITCHEN], hide_when_empty: true });
  const events = [];
  card.addEventListener("card-visibility-changed", (ev) => events.push(ev.detail.value));
  assert.equal(card.connectedWhileHidden, true);
  document.body.appendChild(card);
  await card.updateComplete;
  assert.equal(card.hidden, true);
  assert.deepEqual(events, [false]);

  card.preview = true;
  card.requestUpdate();
  await card.updateComplete;
  assert.equal(card.hidden, false);
  card.remove();
});

test("timers from several devices show the device, and grouping adds headers", async () => {
  const timers = { [KITCHEN]: [listItem({ timer_id: "a" })], [BEDROOM]: [listItem({ timer_id: "b", name: "nap" })] };
  const labelled = await withTimers({ entities: [KITCHEN, BEDROOM] }, timers);
  const byId = Object.fromEntries(labelled.card._timers.map((t) => [t.timer_list_timer_id, t]));
  assert.equal(byId.a.context_label, "Kitchen Voice");
  assert.equal(byId.a.label, labelled.card._formatTimerLabel(300));
  assert.equal(byId.b.context_label, "Bedroom Voice");
  assert.equal(byId.b.label, "nap");

  const grouped = await withTimers({ entities: [KITCHEN, BEDROOM], group_by: "area" }, timers);
  const items = grouped.card._groupTimersForDisplay(grouped.card._timers);
  assert.deepEqual(items.filter((i) => i.header).map((i) => i.header).sort(), ["Bedroom", "Kitchen"]);
  assert.equal(grouped.card._timers[0].context_label, undefined);
});

test("default_timer_area starts timers on the timer list in that area", async () => {
  const { card, ws } = makeCard({ default_timer_area: "bedroom" });
  card._createPresetTimer(5);
  await flush();
  assert.deepEqual(ws[0].target, { entity_id: BEDROOM });
});

test("the start-on picker routes new timers, and This card skips timer lists", async () => {
  const { card, ws } = makeCard({ entities: [KITCHEN, BEDROOM], default_timer_entity: KITCHEN });
  card._updateTimers();
  assert.equal(card._showTargetPicker(), true);
  card._targetChoice = `list:${BEDROOM}`;
  card._createAndSaveTimer(60, "Tea");
  await flush();
  assert.deepEqual(ws.map((m) => [m.target.entity_id, m.service_data.name]), [[BEDROOM, "Tea"]]);

  card._targetChoice = "card";
  card._lastActionTime.clear();
  card._createAndSaveTimer(60, "Local");
  await flush();
  assert.equal(ws.length, 1);
  assert.equal(card._loadTimersFromStorage().length, 1);
});

test("browser voice satellites show running and paused timers read-only", () => {
  const now = Date.now();
  const sat = "assist_satellite.hall_tablet";
  const { card } = makeCard({ auto_discover_voice_satellites: true }, {
    states: { [sat]: { state: "idle", attributes: { friendly_name: "Hall tablet", active_timers: [
      { id: "x", name: "pizza", total_seconds: 600, started_at: now / 1000 - 60, start_minutes: 10, is_active: true },
      { id: "y", total_seconds: 120, started_at: now / 1000 - 500, start_minutes: 5, is_active: false },
    ] } } },
  });
  card._updateTimers();
  const byId = Object.fromEntries(card._timers.map((t) => [t.id, t]));
  const running = byId[`voice_satellite:${sat}:x`];
  const paused = byId[`voice_satellite:${sat}:y`];
  assert.equal(running.label, "pizza");
  assert.ok(running.remaining_ms > 535000 && running.remaining_ms <= 540000);
  assert.equal(paused.paused, true);
  assert.equal(paused.remaining_ms, 120000);
  assert.equal(paused.duration_ms, 300000);
  assert.equal(card._getTimerRenderState(running, "bar_horizontal").supportsManualControls, false);
});

test("count-up rows show elapsed time, never ring, and turn amber past the goal", () => {
  const fed = "input_datetime.baby_fed";
  const { card } = makeCard({ entities: [{ entity: fed, mode: "count_up", goal: "2h" }] }, {
    states: { [fed]: { state: "x", attributes: { friendly_name: "Baby fed", timestamp: Date.now() / 1000 - 3 * 3600, has_date: true } } },
  });
  card._updateTimers();
  const [row] = card._timers;
  assert.equal(row.source, "count_up");
  assert.ok(row.remaining_ms >= 3 * 3600 * 1000);
  assert.equal(row.percent, 100);
  assert.equal(card._ringingTimers.size, 0);
  const state = card._getTimerRenderState(row, "bar_horizontal");
  assert.equal(state.ring, false);
  assert.equal(state.color, "var(--warning-color)");
  assert.match(state.timeStr, / ago$/);
});

test("template rows subscribe to render_template and become read-only timers", async () => {
  const template = "{{ [] | tojson }}";
  const { card, connection } = makeCard({ timers_template: template });
  card._updateTimers();
  await flush();
  const sub = connection.subs.find((s) => s.message.type === "render_template");
  assert.deepEqual(sub.message, { type: "render_template", template, report_errors: true });
  sub.callback({ result: JSON.stringify([
    { name: "Printer", start: iso(-600000), end: iso(3000000) },
    { name: "Old", end: iso(-3600000) },
    { name: "Since", since: iso(-60000) },
    "junk",
  ]) });
  card._updateTimers();
  const labels = card._timers.map((t) => t.label).sort();
  assert.deepEqual(labels, ["Printer", "Since"]);
  const printer = card._timers.find((t) => t.label === "Printer");
  assert.equal(printer.duration_ms, 3600000);
});

function mqttCard(config = {}) {
  return makeCard({
    storage: "mqtt",
    storage_namespace: "device-timer-test",
    mqtt: { sensor_entity: "sensor.simple_timer_store" },
    device_timers: [{ entity: "fan.air_purifier" }, { entity: "light.porch", service: "turn_on", name: "Porch light on" }, { entity: "bad id" }],
    ...config,
  }, { states: { "fan.air_purifier": { state: "on", attributes: { friendly_name: "Air purifier" } } } });
}

test("device timers store an allowlisted on_finish action in the MQTT record", () => {
  const { card } = mqttCard();
  assert.deepEqual(card._deviceTimers().map((d) => d.key), ["fan.air_purifier:turn_off", "light.porch:turn_on"]);
  card._targetChoice = "device:fan.air_purifier:turn_off";
  assert.equal(card._createAndSaveTimer(1800, ""), true);
  const [record] = card._loadTimersFromStorage();
  assert.deepEqual(record.on_finish, { entity_id: "fan.air_purifier", service: "turn_off" });
  assert.equal(record.label, "Air purifier");
  assert.equal(record.end_ts - record.start_ts, 1800000);
  card._updateTimers();
  assert.equal(card._timers[0].context_label, "turns off Air purifier");
});

test("device timers refuse to start without MQTT storage", () => {
  const { card, warnings } = makeCard({ device_timers: ["fan.air_purifier"] });
  card._targetChoice = "device:fan.air_purifier:turn_off";
  assert.equal(card._createAndSaveTimer(60, ""), false);
  assert.equal(card._loadTimersFromStorage().length, 0);
  assert.equal(warnings.length, 1);
});

test("finishing a device timer moves its deadline, and dismiss waits for the backend", async () => {
  const { card } = mqttCard();
  card._targetChoice = "device:fan.air_purifier:turn_off";
  card._createAndSaveTimer(600, "");
  card._updateTimers();
  const [timer] = card._timers;
  assert.equal(card._getTimerRenderState(timer, "bar_horizontal").supportsSnooze, false);
  card._handleFinish(timer);
  const [record] = card._loadTimersFromStorage();
  assert.ok(Date.now() - record.end_ts < 1000);

  card._updateTimers();
  card._handleDismiss(card._timers[0]);
  assert.equal(card._loadTimersFromStorage().length, 1);
  assert.ok(card._dismissed.has(`${record.source_entity}:${record.id}`));
});

test("a pinned timer with on_finish starts a device timer", () => {
  const { card } = mqttCard({ pinned_timers: [{ id: "purifier", name: "Purifier 30m", duration: "30m", on_finish: { entity: "fan.air_purifier", service: "turn_off" } }] });
  const [pinned] = card._getPinnedTimers();
  card._handleStart(pinned);
  const [record] = card._loadTimersFromStorage();
  assert.deepEqual(record.on_finish, { entity_id: "fan.air_purifier", service: "turn_off" });
  assert.equal(record.label, "Purifier 30m");
  assert.equal(record.pinned_id, pinned.pinned_id);
});

test("the device action monitor only runs allowlisted actions and claims after acting", () => {
  const monitor = parse(readFileSync(new URL("../examples/mqtt_device_action_monitor.yaml", import.meta.url), "utf8"));
  assert.ok(Object.keys(monitor.variables.allowed_actions).length > 0);
  assert.match(monitor.action[1].variables.scan, /entity in allowed_actions/);
  assert.match(monitor.action[1].variables.scan, /now_ms - end_ts <= max_late_ms/);
  const sequence = monitor.action.find((step) => step.repeat).repeat.sequence;
  const actIndex = sequence.findIndex((step) => step.service === "homeassistant.{{ repeat.item.service }}");
  const claimIndex = sequence.findIndex((step) => step.service === "input_text.set_value");
  assert.ok(actIndex >= 0 && claimIndex > actIndex);
  assert.equal(monitor.mode, "single");
});

test("the timer list blueprint watches every event type and filters by name", () => {
  const customTags = [{ tag: "!input", resolve: (value) => ({ input: value }) }];
  const text = readFileSync(new URL("../blueprints/automation/simple_timer_card/timer_list_event.yaml", import.meta.url), "utf8");
  const blueprint = parse(text, { customTags });
  const options = blueprint.blueprint.input.events.selector.select.options.map((o) => o.value).sort();
  assert.deepEqual(blueprint.triggers.map((t) => t.id).sort(), options);
  for (const trigger of blueprint.triggers) {
    assert.equal(trigger.trigger, `timer_list.timer_${trigger.id}`);
    assert.deepEqual(trigger.target, { input: "timer_lists" });
  }
  assert.match(blueprint.conditions[1].value_template, /trigger\.timer\.name/);
});

test("a device choice applies once, to the custom timer only", () => {
  const { card } = mqttCard();
  card._targetChoice = "device:fan.air_purifier:turn_off";
  card._createPresetTimer(5);
  assert.equal(card._loadTimersFromStorage()[0].on_finish, undefined);
  card._createAndSaveTimer(60, "");
  assert.equal(card._targetChoice, null);
  assert.equal(card._loadTimersFromStorage().filter((t) => t.on_finish).length, 1);
});
