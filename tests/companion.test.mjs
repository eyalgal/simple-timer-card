import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "customElements", "localStorage", "HTMLElement", "Element", "Node", "CustomEvent", "Document", "CSSStyleSheet", "ShadowRoot"]) {
  globalThis[key] = dom.window[key];
}
await import("../simple-timer-card.js");
afterEach(() => localStorage.clear());
after(() => dom.window.close());

const LIST = "sensor.simple_timer_card_timers";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeCard(config = {}, { companion = true, states = {} } = {}) {
  const card = document.createElement("simple-timer-card");
  card.setConfig(config);
  const subs = [];
  const calls = [];
  const ws = [];
  const warnings = [];
  card.addEventListener("hass-notification", (ev) => warnings.push(ev.detail.message));
  card.hass = {
    user: { id: "tester", is_admin: false },
    config: { version: "2026.11.2" },
    connection: {
      subscribeMessage(callback, message) { subs.push({ callback, message }); return Promise.resolve(() => Promise.resolve()); },
      addEventListener() {},
      removeEventListener() {},
    },
    states: {
      ...(companion ? { [LIST]: { state: "0", attributes: { friendly_name: "Simple Timer Card Timers", supported_features: 255, simple_timer_card_api: 1 } } } : {}),
      "fan.air_purifier": { state: "on", attributes: { friendly_name: "Air purifier" } },
      ...states,
    },
    services: {
      fan: {
        turn_on: { target: { entity: [{ domain: ["fan"] }] }, fields: {} },
        turn_off: { target: { entity: [{ domain: ["fan"] }] }, fields: {} },
        set_percentage: { target: { entity: [{ domain: ["fan"] }] }, fields: { percentage: { required: true } } },
        reload: { fields: {} },
      },
    },
    localize: () => "",
    callService: (...args) => { calls.push(args); return Promise.resolve(); },
    callWS: (msg) => { ws.push(msg); return Promise.resolve({ response: { [LIST]: { timer_id: "c1" } } }); },
  };
  return { card, subs, calls, ws, warnings };
}

function item(overrides = {}) {
  return { timer_id: "c1", name: null, status: "active", created_duration: 600, total_duration: 600, created_at: new Date().toISOString(), remaining: 500, action: null, metadata: {}, source: "card", ...overrides };
}

test("the companion list is a timer list that uses its own websocket and actions", async () => {
  const { card, subs, calls } = makeCard({ entities: [LIST] });
  card._updateTimers();
  await flush();
  assert.deepEqual(subs[0].message, { type: "simple_timer_card/item/subscribe", entity_id: LIST });
  subs[0].callback({ type: "timers", timers: [item()] });
  card._updateTimers();
  const [timer] = card._timers;
  assert.equal(timer.source, "timer_list");
  card._handlePause(timer);
  card._handleSnooze({ ...timer, id: "other" });
  card._lastActionTime.clear();
  card._handleRestart(timer);
  assert.deepEqual(calls.map(([domain, service, data]) => [domain, service, data.duration]), [
    ["simple_timer_card", "pause_timer", undefined],
    ["simple_timer_card", "restart_timer", "00:05:00"],
    ["simple_timer_card", "restart_timer", undefined],
  ]);
});

test("a typed command becomes a companion timer, once", async () => {
  const { card, ws } = makeCard();
  card._setActionDraft({ mode: "command", command: "turn off the air purifier" });
  assert.equal(card._createAndSaveTimer(1800, ""), true);
  await flush();
  assert.equal(ws[0].domain, "simple_timer_card");
  assert.deepEqual(ws[0].target, { entity_id: LIST });
  assert.equal(ws[0].service_data.command, "turn off the air purifier");
  assert.equal(ws[0].service_data.metadata.source, "card");
  assert.equal(card._actionDraft.mode, "none");
  card._lastActionTime.clear();
  card._createAndSaveTimer(60, "");
  await flush();
  assert.equal(ws.length, 1, "a plain timer afterwards does not go to the companion");
});

test("any device action becomes a Home Assistant action list", async () => {
  const { card, ws } = makeCard();
  assert.deepEqual(card._servicesForEntity("fan.air_purifier"), ["fan.turn_on", "fan.turn_off", "homeassistant.toggle"]);
  card._setActionDraft({ mode: "device", entity: "fan.air_purifier", service: "fan.turn_off" });
  card._createAndSaveTimer(600, "Purifier");
  await flush();
  assert.deepEqual(ws[0].service_data.actions, [{ action: "fan.turn_off", target: { entity_id: "fan.air_purifier" } }]);
  assert.equal(ws[0].service_data.name, "Purifier");
});

test("quick actions and pinned on_finish accept devices, commands and raw actions", async () => {
  const { card, ws } = makeCard({
    device_timers: [{ entity: "fan.air_purifier" }, { command: "lock the front door", name: "Lock up" }, { entity: "bad id" }],
    pinned_timers: [{ id: "p", name: "Purifier 30m", duration: "30m", on_finish: { entity: "fan.air_purifier", service: "turn_on" } }],
  });
  const favorites = card._favoriteActions();
  assert.deepEqual(favorites.map((f) => f.key), ["fan.air_purifier:fan.turn_off", "command:lock the front door"]);
  card._handleStart(card._getPinnedTimers()[0]);
  await flush();
  assert.deepEqual(ws[0].service_data.actions, [{ action: "fan.turn_on", target: { entity_id: "fan.air_purifier" } }]);
  assert.equal(ws[0].service_data.name, "Purifier 30m");
  assert.match(ws[0].service_data.metadata.pinned_id, /:p$/);
});

test("without the companion, actions are not offered and cannot start", () => {
  const { card, ws, warnings } = makeCard({}, { companion: false });
  assert.equal(card._actionPickerEnabled(), false);
  assert.equal(card._createActionTimer(card._normalizeActionSpec({ command: "turn off the fan" }), 60000, ""), false);
  assert.equal(ws.length, 0);
  assert.equal(warnings.length, 1);
});

test("action timers are labelled with what they will do", async () => {
  const { card, subs } = makeCard({ entities: [LIST] });
  card._updateTimers();
  await flush();
  subs[0].callback({ type: "timers", timers: [
    item({ timer_id: "a", action: { type: "command", command: "turn off the lights" }, source: "voice" }),
    item({ timer_id: "b", name: "Purifier", action: { type: "actions", actions: [{ action: "fan.turn_off", target: { entity_id: ["fan.air_purifier"] } }] } }),
  ] });
  card._updateTimers();
  const byId = Object.fromEntries(card._timers.map((t) => [t.timer_list_timer_id, t]));
  assert.equal(byId.a.label, "Turn off the lights");
  assert.equal(byId.a.icon, "mdi:microphone-message");
  assert.equal(byId.a.context_label, undefined);
  assert.equal(byId.b.label, "Purifier");
  assert.equal(byId.b.context_label, "then Turn off Air purifier");
});

test("every localized key exists in every language", () => {
  const source = readFileSync(new URL("../src/simple-timer-card.js", import.meta.url), "utf8");
  const used = new Set([...source.matchAll(/_localize\("([a-z0-9_]+)"\)/g)].map((m) => m[1]));
  const block = source.slice(source.indexOf("const TRANSLATIONS = {"), source.indexOf("\n};", source.indexOf("const TRANSLATIONS = {")));
  const languages = [...block.matchAll(/\n  ([a-z]{2}): \{/g)].map((m) => m[1]);
  assert.equal(languages.length, 10);
  for (const [index, lang] of languages.entries()) {
    const start = block.indexOf(`\n  ${lang}: {`);
    const end = index + 1 < languages.length ? block.indexOf(`\n  ${languages[index + 1]}: {`) : block.length;
    const text = block.slice(start, end);
    const missing = [...used].filter((key) => !new RegExp(`[\\s,{]${key}:`).test(text));
    assert.deepEqual(missing, [], `${lang} is missing keys`);
  }
});

test("the wizard picks a device and action, and closing it keeps the previous choice", () => {
  const { card } = makeCard({}, { states: { "fan.bedroom": { state: "off", attributes: { friendly_name: "Air purifier" } } } });
  card._openActionWizard("horizontal", "type");
  card._setActionDraft({ mode: "device", query: "air" });
  assert.deepEqual(card._searchActionEntities("air").sort(), ["fan.air_purifier", "fan.bedroom"]);
  card._setActionDraft({ entity: "fan.air_purifier", service: "fan.turn_off", query: "" });
  card._closeActionWizard(true);
  assert.equal(card._actionWizard, null);
  assert.equal(card._actionDraftSpec().key, "fan.air_purifier:fan.turn_off");

  card._openActionWizard("horizontal", "command");
  card._setActionDraft({ mode: "command", command: "turn on the lights" });
  card._closeActionWizard(false);
  assert.equal(card._actionDraftSpec().key, "fan.air_purifier:fan.turn_off");
});

test("integration storage sends every new timer to the companion and shows its timers unlisted", async () => {
  const { card, ws, calls } = makeCard({ storage: "integration", entities: ["timer.kitchen"] },
    { states: { "timer.kitchen": { state: "idle", attributes: { friendly_name: "Kitchen" } } } });
  card._updateTimers();
  assert.ok(card._knownTimerLists.includes(LIST));
  card._createPresetTimer(5);
  card._lastActionTime.clear();
  card._createAndSaveTimer(120, "Tea");
  await flush();
  assert.deepEqual(ws.map((m) => [m.domain, m.target.entity_id]), [["simple_timer_card", LIST], ["simple_timer_card", LIST]]);
  assert.equal(calls.length, 0, "the listed native timer is not used");
  assert.equal(card._loadTimersFromStorage_local().length, 0);
});

test("integration storage falls back to this browser without the companion", () => {
  const { card, ws } = makeCard({ storage: "integration" }, { companion: false });
  card._createAndSaveTimer(120, "Tea");
  assert.equal(ws.length, 0);
  card._updateTimers();
  assert.deepEqual(card._timers.map((t) => [t.source, t.label]), [["local", "Tea"]]);
});

test("the companion as default target is not mistaken for MQTT storage", () => {
  const { card } = makeCard({ default_timer_entity: LIST });
  assert.equal(card._config.storage, "local");
  assert.equal(card._config.mqtt.sensor_entity, null);
});

test("Put on a speaker lists only speakers, by kind and area, and hides the action link once picked", () => {
  const speakers = {};
  const entities = {};
  for (const [id, area] of [["office", "office"], ["kitchen", "kitchen"], ["bedroom", "bedroom"]]) {
    speakers[`timer_list.${id}`] = { state: "0", attributes: { friendly_name: `${id} timers`, supported_features: 63 } };
    entities[`timer_list.${id}`] = { area_id: area, platform: "esphome" };
  }
  const { card } = makeCard({ storage: "integration", auto_discover_timer_lists: true }, { states: speakers });
  card.hass.entities = entities;
  card.hass.areas = { office: { name: "Office" }, kitchen: { name: "Kitchen" }, bedroom: { name: "Bedroom" } };
  card._updateTimers();
  assert.deepEqual(card._targetDestinations().map((d) => d.value),
    ["list:timer_list.bedroom", "list:timer_list.kitchen", "list:timer_list.office"]);
  assert.equal(card._currentSpeaker(), null, "the integration is the default, not a speaker");
  entities["timer_list.office"].platform = "mobile_app";
  assert.deepEqual(card._targetDestinations().map((d) => d.group), ["speakers", "speakers", "phones"]);
  card._targetChoice = "list:timer_list.kitchen";
  assert.equal(card._currentSpeaker(), "timer_list.kitchen");
  assert.equal(card._renderTargetPicker("horizontal").strings.join("").includes("action-entry"), false);
  card._targetQuery = "kitch";
  card._closeActionWizard(false);
  assert.equal(card._targetQuery, "");
});

test("announce on a speaker lists speakers that can speak and goes through the companion", async () => {
  const { card, ws } = makeCard({}, { states: {
    "assist_satellite.kitchen": { state: "idle", attributes: { friendly_name: "Kitchen satellite", supported_features: 1 } },
    "media_player.echo": { state: "idle", attributes: { friendly_name: "Kitchen Echo", supported_features: 318399 } },
    "media_player.sonos": { state: "idle", attributes: { friendly_name: "Dining Sonos", supported_features: 512 } },
    "media_player.spotify": { state: "idle", attributes: { friendly_name: "Spotify", supported_features: 2048 } },
    "tts.home_assistant_cloud": { state: "unknown", attributes: {} },
  } });
  card.hass.entities = { "media_player.echo": { platform: "alexa_media" } };
  card.hass.services.notify = { alexa_media: {} };
  assert.deepEqual(card._searchAnnounceSpeakers("").sort(), ["assist_satellite.kitchen", "media_player.echo", "media_player.sonos"]);
  assert.deepEqual(card._announceActions("media_player.sonos", "hi"),
    [{ action: "simple_timer_card.announce", data: { entity_id: "media_player.sonos", message: "hi" } }]);
  delete card.hass.states["tts.home_assistant_cloud"];
  assert.equal(card._canAnnounceOn("media_player.sonos"), false, "needs a TTS engine");
  assert.equal(card._canAnnounceOn("media_player.echo"), true, "Alexa announces without TTS");
  card.hass.states["tts.home_assistant_cloud"] = { state: "unknown", attributes: {} };

  card._setActionDraft({ mode: "announce", speaker: "media_player.sonos" });
  assert.equal(card._actionSummary(card._actionDraftSpec()), "Announce on Dining Sonos");
  card._createAndSaveTimer(300, "Pasta");
  await flush();
  assert.deepEqual(ws[0].service_data.actions, [{ action: "simple_timer_card.announce", data: { entity_id: "media_player.sonos", message: "Pasta is done" } }]);
});
