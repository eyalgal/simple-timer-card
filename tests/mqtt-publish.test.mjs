import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "customElements", "localStorage", "HTMLElement", "Element", "Node", "CustomEvent", "Document", "CSSStyleSheet", "ShadowRoot"]) {
  globalThis[key] = dom.window[key];
}
await import("../simple-timer-card.js");
afterEach(() => localStorage.clear());
after(() => dom.window.close());

const relay = "automation.simple_timer_card_mqtt_relay";
const timer = { id: "tea", label: "Tea", duration: 60000, end_ts: 2000000, source: "mqtt" };
const events = ["created", "started", "expired", "cancelled", "paused", "resumed", "snoozed", "finished"];

function makeCard({ admin = true, version = "2026.10.0", mqtt = {}, config = {}, callService } = {}) {
  const card = document.createElement("simple-timer-card");
  card.setConfig({ storage: "mqtt", storage_namespace: "mqtt-publish-test", mqtt, ...config });
  const calls = [];
  const warnings = [];
  card.addEventListener("hass-notification", ev => warnings.push(ev.detail.message));
  card.hass = {
    user: { id: "tester", is_admin: admin },
    config: { version },
    states: { [relay]: { state: "on" } },
    callService: (...args) => { calls.push(args); return callService ? callService(...args) : Promise.resolve(); },
  };
  return { card, calls, warnings };
}

test("administrators keep direct custom-topic storage and every event, even with a relay configured", async () => {
  const { card, calls } = makeCard({ mqtt: {
    topic: "kitchen/timers", state_topic: "kitchen/state", events_topic: "kitchen/events", publish_automation: relay,
  } });
  card._saveTimersToStorage_mqtt([timer], []);
  for (const event of events) card._publishTimerEvent(event, timer);
  await card._mqttPublishQueue;
  assert.equal(calls.length, 2 + events.length);
  assert.ok(calls.every(([domain, service]) => domain === "mqtt" && service === "publish"));
  assert.deepEqual(calls.map(([, , data]) => data.topic), ["kitchen/timers", "kitchen/state", ...events.map(event => `kitchen/events/${event}`)]);
  const store = JSON.parse(calls[0][2].payload);
  assert.deepEqual(store.timers, [timer]);
  assert.deepEqual(store.deleted, []);
  assert.equal(store.version, 1);
  assert.deepEqual(JSON.parse(calls[1][2].payload), { version: 1, t: store.lastUpdated });
  assert.deepEqual(calls.map(([, , data]) => data.retain), [true, true, ...events.map(() => false)]);
  assert.deepEqual(calls.slice(2).map(([, , data]) => JSON.parse(data.payload).event), events);
});

test("non-admin relay preserves the envelope, tombstones, state marker and every event", async () => {
  const { card, calls, warnings } = makeCard({ admin: false, mqtt: { publish_automation: relay } });
  const tombstone = { id: "deleted", rev: 2, ts: Date.now() };
  card._saveTimersToStorage_mqtt([timer], [tombstone]);
  for (const event of events) card._publishTimerEvent(event, timer);
  await card._mqttPublishQueue;
  assert.equal(calls.length, 2 + events.length);
  for (const [domain, service, data] of calls) {
    assert.equal(domain, "automation");
    assert.equal(service, "trigger");
    assert.equal(data.entity_id, relay);
    assert.equal(data.skip_condition, false);
    assert.deepEqual(Object.keys(data.variables), ["stc_request"]);
    assert.equal(data.variables.stc_request.topic, undefined);
    assert.equal(data.variables.stc_request.retain, undefined);
  }
  const requests = calls.map(([, , data]) => data.variables.stc_request);
  assert.deepEqual(requests.map(request => request.operation), ["store", "state", ...events.map(() => "event")]);
  assert.deepEqual(requests[0].payload.timers, [timer]);
  assert.deepEqual(requests[0].payload.deleted, [tombstone]);
  assert.deepEqual(requests[1].payload, { version: 1, t: requests[0].payload.lastUpdated });
  assert.deepEqual(requests.slice(2).map(request => request.event), events);
  assert.deepEqual(requests.slice(2).map(request => request.payload.event), events);
  assert.deepEqual(warnings, []);
});

for (const admin of [true, false]) {
  test(`latest compatibility keeps its bare array and version 2 marker (admin=${admin})`, async () => {
    const { card, calls } = makeCard({ admin, mqtt: { publish_automation: relay }, config: { compatibility_mode: "latest" } });
    card._saveTimersToStorage_mqtt([timer]);
    await card._mqttPublishQueue;
    const payloads = calls.map(([, , data]) => admin ? JSON.parse(data.payload) : data.variables.stc_request.payload);
    assert.deepEqual(payloads[0], [timer]);
    assert.equal(payloads[1].version, 2);
  });
}

test("relay carries large snapshots and preserves Voice PE event metadata", async () => {
  const { card, calls } = makeCard({ admin: false, mqtt: { publish_automation: relay } });
  const timers = Array.from({ length: 20 }, (_, i) => ({ ...timer, id: `timer-${i}` }));
  card._saveTimersToStorage_mqtt(timers);
  const voice = { ...timer, source: "voice_pe", pinned_id: "kitchen:tea", voice_pe_timer_id: "local:1",
    control_entity: "text.voice", state: "active", start_ts: 1000, end_ts: 61000, duration_ms: 60000, remaining_ms: 59000 };
  await card._publishTimerEvent("started", voice);
  const store = calls[0][2].variables.stc_request.payload;
  assert.ok(JSON.stringify(store).length > 255);
  assert.deepEqual(store.timers, timers);
  const payload = calls[2][2].variables.stc_request.payload;
  for (const key of ["pinned_id", "voice_pe_timer_id", "control_entity", "state", "start_ts", "end_ts", "duration_ms", "remaining_ms"]) {
    assert.equal(payload[key], voice[key]);
  }
});

test("missing relay makes no unauthorized calls or silent local-storage fallback", async () => {
  const { card, calls, warnings } = makeCard({ admin: false });
  card._saveTimersToStorage_mqtt([timer]);
  for (const event of events) card._publishTimerEvent(event, timer);
  await card._mqttPublishQueue;
  assert.deepEqual(calls, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /mqtt\.publish_automation/);
  assert.equal(card._config.storage, "mqtt");
  assert.equal(localStorage.getItem(card._getStorageKey()), null);
});

for (const version of ["2025.12.4", "2026.9.3", "2026.9.0b1"]) {
  test(`non-admin direct publishing remains supported on HA ${version}`, async () => {
    const { card, calls } = makeCard({ admin: false, version });
    assert.equal(await card._publishTimerEvent("started", timer), true);
    assert.equal(calls[0][0], "mqtt");
  });
}

for (const version of ["2026.10.0b1", "2026.11.0", "2027.1.0", "unknown"]) {
  test(`non-admin without a relay does not attempt direct publishing on HA ${version}`, async () => {
    const { card, calls } = makeCard({ admin: false, version });
    assert.equal(await card._publishTimerEvent("started", timer), false);
    assert.deepEqual(calls, []);
  });
}

test("unknown user fails closed and resumes when user information arrives", async () => {
  const { card, calls, warnings } = makeCard();
  delete card.hass.user;
  assert.equal(await card._publishTimerEvent("started", timer), false);
  assert.equal(calls.length, 0);
  assert.match(warnings[0], /user information/);
  card.hass = { ...card.hass, user: { id: "tester", is_admin: true } };
  assert.equal(await card._publishTimerEvent("started", timer), true);
});

test("missing, disabled and unavailable relays warn without calling HA; enabling recovers", async () => {
  for (const state of [undefined, "off", "unavailable"]) {
    const { card, calls, warnings } = makeCard({ admin: false, mqtt: { publish_automation: relay } });
    card.hass.states = state ? { [relay]: { state } } : {};
    await card._publishTimerEvent("started", timer);
    await card._publishTimerEvent("expired", timer);
    assert.equal(calls.length, 0);
    assert.equal(warnings.length, 1);
    card.hass = { ...card.hass, states: { [relay]: { state: "on" } } };
    assert.equal(await card._publishTimerEvent("started", timer), true);
  }
});

for (const admin of [true, false]) {
  test(`Unauthorized stops queued and subsequent writes without unhandled rejection (admin=${admin})`, async () => {
    const { card, calls, warnings } = makeCard({ admin, mqtt: { publish_automation: relay },
      callService: () => Promise.reject({ code: "unauthorized", message: "Unauthorized" }) });
    card._saveTimersToStorage_mqtt([timer]);
    card._publishTimerEvent("started", timer);
    await card._mqttPublishQueue;
    assert.equal(await card._publishTimerEvent("expired", timer), false);
    assert.equal(calls.length, 1);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Further writes are paused/);
  });
}

test("transport/user changes clear a permission block", async () => {
  let deny = true;
  const { card, calls } = makeCard({ admin: false, mqtt: { publish_automation: relay },
    callService: () => deny ? Promise.reject(new Error("Unauthorized")) : Promise.resolve() });
  await card._publishTimerEvent("started", timer);
  deny = false;
  card.hass = { ...card.hass, user: { id: "admin", is_admin: true } };
  assert.equal(await card._publishTimerEvent("started", timer), true);
  assert.equal(calls[1][0], "mqtt");
});

test("other service failures warn once and a later request can recover", async () => {
  let fail = true;
  const { card, warnings } = makeCard({ callService: () => {
    if (fail) throw new Error("Broker unavailable");
    return Promise.resolve();
  } });
  assert.equal(await card._publishTimerEvent("started", timer), false);
  assert.equal(await card._publishTimerEvent("started", timer), false);
  assert.equal(warnings.length, 1);
  fail = false;
  assert.equal(await card._publishTimerEvent("started", timer), true);
});

test("queued data is snapshotted before later mutations", async () => {
  const { card, calls } = makeCard({ admin: false, mqtt: { publish_automation: relay } });
  const timers = [{ ...timer }];
  card._saveTimersToStorage_mqtt(timers);
  timers[0].label = "Changed";
  await card._mqttPublishQueue;
  assert.equal(calls[0][2].variables.stc_request.payload.timers[0].label, "Tea");
});

test("relay config validates entity IDs and preserves legacy sensor shorthand and namespace", () => {
  for (const bad of ["script.relay", "automation.", "automation.bad id", 123]) {
    assert.throws(() => makeCard({ mqtt: { publish_automation: bad } }), /automation entity ID/);
  }
  const { card } = makeCard({ config: { storage: undefined, storage_namespace: undefined, default_timer_entity: "sensor.timer_store" } });
  const namespace = card._storageNamespace;
  card.setConfig({ default_timer_entity: "sensor.timer_store", mqtt: { publish_automation: relay } });
  assert.equal(card._config.storage, "mqtt");
  assert.equal(card._config.mqtt.sensor_entity, "sensor.timer_store");
  assert.equal(card._storageNamespace, namespace);
  const config = { storage: "mqtt", mqtt: { topic: "custom/timers" } };
  card.setConfig(config);
  const automatic = card._storageNamespace;
  card.setConfig({ ...config, mqtt: { ...config.mqtt, publish_automation: relay } });
  assert.equal(card._storageNamespace, automatic);
});
