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

const LIST = "timer_list.kitchen_voice_timers";
const ALL_FEATURES = 63;

function makeConnection({ fail = false } = {}) {
  const subs = [];
  const listeners = {};
  return {
    subs,
    listeners,
    subscribeMessage(callback, message, options) {
      const sub = { callback, message, options, unsubscribed: false };
      subs.push(sub);
      if (fail) return Promise.reject({ code: "unknown_command", message: "Unknown command." });
      return Promise.resolve(() => { sub.unsubscribed = true; return Promise.resolve(); });
    },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
  };
}

function makeCard({ config = {}, features = ALL_FEATURES, state = "1", connection = makeConnection(), states = {}, callWS } = {}) {
  const card = document.createElement("simple-timer-card");
  card.setConfig({ entities: [LIST], ...config });
  const calls = [];
  const ws = [];
  const warnings = [];
  card.addEventListener("hass-notification", (ev) => warnings.push(ev.detail.message));
  card.hass = {
    user: { id: "tester", is_admin: false },
    config: { version: "2026.12.0" },
    connection,
    states: {
      [LIST]: { state, attributes: { friendly_name: "Kitchen Voice Timers", supported_features: features } },
      ...states,
    },
    callService: (...args) => { calls.push(args); return Promise.resolve(); },
    callWS: (msg) => { ws.push(msg); return callWS ? callWS(msg) : Promise.resolve({ response: { [LIST]: { timer_id: "new-1" } } }); },
  };
  return { card, calls, ws, warnings, connection };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function item(overrides = {}) {
  return {
    timer_id: "t1",
    name: null,
    status: "active",
    created_duration: 300,
    total_duration: 300,
    created_at: new Date().toISOString(),
    finishes_at: new Date(Date.now() + 120000).toISOString(),
    paused_remaining: null,
    ended_at: null,
    remaining: 120,
    ...overrides,
  };
}

async function subscribed(options) {
  const ctx = makeCard(options);
  ctx.card._updateTimers();
  await flush();
  const [sub] = ctx.connection.subs;
  const send = (msg) => { sub.callback(msg); ctx.card._updateTimers(); };
  return { ...ctx, sub, send };
}

test("subscribes to the list and shows active and paused timers, not cancelled ones", async () => {
  const { card, sub, send } = await subscribed();
  assert.deepEqual(sub.message, { type: "timer_list/item/subscribe", entity_id: LIST });
  assert.equal(sub.options.resubscribe, false);

  send({ type: "timers", timers: [
    item({ timer_id: "a", name: "pasta", remaining: 90 }),
    item({ timer_id: "b", status: "paused", paused_remaining: 45, remaining: 45, finishes_at: null }),
    item({ timer_id: "c", status: "cancelled", ended_at: new Date().toISOString(), remaining: 0 }),
  ] });

  const byId = Object.fromEntries(card._timers.map((t) => [t.timer_list_timer_id, t]));
  assert.deepEqual(Object.keys(byId).sort(), ["a", "b"]);
  assert.equal(byId.a.label, "pasta");
  assert.equal(byId.a.duration_ms, 300000);
  assert.ok(byId.a.remaining_ms > 88000 && byId.a.remaining_ms <= 90000);
  assert.equal(byId.b.paused, true);
  assert.equal(byId.b.remaining_ms, 45000);
  assert.match(byId.b.label, /^Kitchen Voice - 5/);
  assert.equal(byId.a.supports.pause, true);
});

test("change events add, update and remove timers", async () => {
  const { card, send } = await subscribed();
  send({ type: "timers", timers: [item({ timer_id: "a" })] });
  send({ type: "change", event_type: "created", timer: item({ timer_id: "b", name: "tea" }) });
  assert.equal(card._timers.length, 2);
  send({ type: "change", event_type: "paused", timer: item({ timer_id: "b", name: "tea", status: "paused", paused_remaining: 30, remaining: 30 }) });
  assert.equal(card._timers.find((t) => t.timer_list_timer_id === "b").paused, true);
  send({ type: "change", event_type: "removed", timer: item({ timer_id: "a" }) });
  assert.deepEqual(card._timers.map((t) => t.timer_list_timer_id), ["b"]);
});

test("a finished timer rings for the expire window, then hides without touching Home Assistant", async () => {
  const { card, calls, send } = await subscribed({ config: { expire_keep_for: 60 } });
  send({ type: "change", event_type: "finished", timer: item({ status: "finished", remaining: 0, ended_at: new Date().toISOString() }) });
  const [ringing] = card._timers;
  assert.equal(ringing.remaining, 0);
  assert.ok(card._ringingTimers.has(ringing.id));

  send({ type: "timers", timers: [item({ status: "finished", remaining: 0, ended_at: new Date(Date.now() - 61000).toISOString() })] });
  assert.equal(card._timers.length, 0);
  assert.equal(calls.length, 0);
});

test("row controls call the matching timer_list actions", async () => {
  const { card, calls, send } = await subscribed();
  send({ type: "timers", timers: [item()] });
  const [t] = card._timers;
  card._handlePause(t);
  card._handleResume({ ...t, paused: true });
  card._handleAddTime(t, 60);
  card._lastActionTime.clear();
  card._handleAddTime(t, -30);
  card._handleFinish(t);
  card._lastActionTime.clear();
  card._handleCancel(t);
  await flush();
  const target = { entity_id: LIST, timer_id: "t1" };
  assert.deepEqual(calls.map(([domain, service, data]) => [domain, service, data]), [
    ["timer_list", "pause_timer", target],
    ["timer_list", "unpause_timer", target],
    ["timer_list", "add_time", { ...target, duration: "00:01:00" }],
    ["timer_list", "subtract_time", { ...target, duration: "00:00:30" }],
    ["timer_list", "finish_timer", target],
    ["timer_list", "cancel_timer", target],
  ]);
});

test("cancel falls back to remove_timer, and unsupported actions only warn", async () => {
  const { card, calls, warnings, send } = await subscribed({ features: 16 });
  send({ type: "timers", timers: [item()] });
  const [t] = card._timers;
  card._handleCancel(t);
  card._handlePause(t);
  assert.deepEqual(calls.map(([, service]) => service), ["remove_timer"]);
  assert.equal(warnings.length, 1);
});

test("dismiss hides the timer and removes it from the list without an error toast", async () => {
  const { card, calls, send } = await subscribed();
  send({ type: "change", event_type: "finished", timer: item({ status: "finished", remaining: 0, ended_at: new Date().toISOString() }) });
  const [t] = card._timers;
  card._handleDismiss(t);
  card._updateTimers();
  assert.equal(card._timers.length, 0);
  assert.deepEqual(calls, [["timer_list", "remove_timer", { entity_id: LIST, timer_id: "t1" }, undefined, false]]);
});

test("read-only lists render without controls and still allow a card-only dismiss", async () => {
  const { card, calls, send } = await subscribed({ features: 0 });
  send({ type: "change", event_type: "finished", timer: item({ status: "finished", remaining: 0, ended_at: new Date().toISOString() }) });
  const [t] = card._timers;
  const state = card._getTimerRenderState(t, "bar_horizontal");
  assert.equal(state.supportsManualControls, false);
  assert.equal(state.supportsReadOnlyDismiss, true);
  card._handleDismiss(t);
  assert.equal(calls.length, 0);
});

test("new timers go to the default timer list, sending only user-given names", async () => {
  const { card, ws } = makeCard({ config: { entities: [], default_timer_entity: LIST } });
  card._createPresetTimer(5);
  card._createAndSaveTimer(90, "Eggs");
  await flush();
  assert.deepEqual(ws.map((m) => m.service_data), [{ duration: "00:05:00" }, { duration: "00:01:30", name: "Eggs" }]);
  for (const message of ws) {
    assert.equal(message.type, "call_service");
    assert.equal(message.domain, "timer_list");
    assert.equal(message.service, "create_timer");
    assert.deepEqual(message.target, { entity_id: LIST });
    assert.equal(message.return_response, true);
  }
});

test("a single listed timer list is the default target, but an explicit helper target wins", async () => {
  const single = makeCard();
  single.card._createPresetTimer(1);
  await flush();
  assert.equal(single.ws.length, 1);

  const helper = makeCard({ config: { default_timer_entity: "input_text.timer_store" }, states: { "input_text.timer_store": { state: '{"timers":[]}', attributes: {} } } });
  helper.card._createAndSaveTimer(60, "");
  await flush();
  assert.equal(helper.ws.length, 0);
  assert.deepEqual(helper.calls.map(([domain, service]) => [domain, service]), [["input_text", "set_value"]]);
});

test("a started pinned timer keeps its pinned id and options on the created timer", async () => {
  const { card, send } = await subscribed({ callWS: () => Promise.resolve({ response: { [LIST]: { timer_id: "p1" } } }) });
  card._createPresetTimer(10, null, { voice_pe_name: "Laundry", pinned_id: "laundry", icon: "mdi:washing-machine", expired_subtitle: "Done" });
  await flush();
  send({ type: "change", event_type: "created", timer: item({ timer_id: "p1", name: "Laundry", created_duration: 600, total_duration: 600, remaining: 600 }) });
  const [t] = card._timers;
  assert.equal(t.pinned_id, "laundry");
  assert.equal(t.icon, "mdi:washing-machine");
  assert.equal(t.expired_subtitle, "Done");
  send({ type: "change", event_type: "removed", timer: item({ timer_id: "p1" }) });
  assert.equal(localStorage.getItem("simple-timer-card-timer-list-meta"), null);
});

test("snooze starts a replacement timer with the same name and removes the finished one", async () => {
  const { card, ws, calls, send } = await subscribed({ config: { snooze_duration: 2 } });
  send({ type: "change", event_type: "finished", timer: item({ name: "pizza", status: "finished", remaining: 0, ended_at: new Date().toISOString() }) });
  card._handleSnooze(card._timers[0]);
  await flush();
  await flush();
  assert.deepEqual(ws[0].service_data, { duration: "00:02:00", name: "pizza" });
  assert.deepEqual(calls, [["timer_list", "remove_timer", { entity_id: LIST, timer_id: "t1" }, undefined, false]]);
});

test("a stale subscription is renewed when the active count disagrees", async () => {
  const { card, connection, sub, send } = await subscribed({ state: "1" });
  send({ type: "timers", timers: [] });
  card._timerLists.get(LIST).mismatchSince = Date.now() - 4000;
  card._updateTimers();
  await flush();
  assert.equal(connection.subs.length, 2);
  assert.equal(sub.unsubscribed, true);
});

test("an unavailable list drops its subscription and timers, and a reconnect resubscribes", async () => {
  const { card, connection, sub, send } = await subscribed();
  send({ type: "timers", timers: [item()] });
  card.hass = { ...card.hass, states: { [LIST]: { state: "unavailable", attributes: {} } } };
  card._updateTimers();
  assert.equal(sub.unsubscribed, true);
  assert.equal(card._timers.length, 0);

  card.hass = { ...card.hass, states: { [LIST]: { state: "1", attributes: { supported_features: ALL_FEATURES } } } };
  card._updateTimers();
  await flush();
  assert.equal(connection.subs.length, 2);
  connection.listeners.ready.forEach((fn) => fn());
  card._updateTimers();
  assert.equal(connection.subs.length, 3);
});

test("Home Assistant without timer lists fails quietly and retries later", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const { card, connection } = await subscribed({ connection: makeConnection({ fail: true }) });
    assert.equal(card._timerLists.get(LIST).status, "error");
    card._updateTimers();
    assert.equal(connection.subs.length, 1);
    card._timerLists.get(LIST).retryAt = 0;
    card._updateTimers();
    assert.equal(connection.subs.length, 2);
  } finally {
    console.warn = originalWarn;
  }
});

test("auto-discovery picks up unlisted timer lists", async () => {
  const other = "timer_list.bedroom_timers";
  const { card, connection } = makeCard({
    config: { entities: [], auto_discover_timer_lists: true },
    states: { [other]: { state: "0", attributes: { supported_features: ALL_FEATURES } } },
  });
  card._updateTimers();
  await flush();
  assert.deepEqual(connection.subs.map((s) => s.message.entity_id).sort(), [other, LIST].sort());
});
