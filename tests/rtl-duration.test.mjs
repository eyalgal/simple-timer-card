import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const key of ["window", "document", "customElements", "localStorage", "HTMLElement", "Element", "Node", "CustomEvent", "Document", "CSSStyleSheet", "ShadowRoot"]) {
  globalThis[key] = dom.window[key];
}
await import("../simple-timer-card.js");
afterEach(() => { document.body.replaceChildren(); localStorage.clear(); });
after(() => dom.window.close());

async function mount(config = {}, states = {}) {
  const card = document.createElement("simple-timer-card");
  card.setConfig({ type: "custom:simple-timer-card", storage_namespace: "rtl-test", language: "he", ...config });
  const calls = [];
  card.hass = { states, services: {}, language: "he", connected: true, callService: (...args) => { calls.push(args); return Promise.resolve(); } };
  card._unlockAudioHandler = () => {};
  document.body.append(card);
  await card.updateComplete;
  return { card, calls };
}

function checkPair(pair, direction, number, unit) {
  assert.ok(pair);
  assert.equal(pair.dir, direction);
  const value = pair.querySelector(".duration-number");
  const label = pair.querySelector(".duration-unit");
  assert.equal(value.localName, "bdi");
  assert.equal(value.dir, "ltr");
  assert.equal(value.textContent, number);
  assert.equal(label.localName, "bdi");
  assert.equal(label.dir, direction);
  assert.equal(label.textContent, unit);
}

for (const [language, direction, units] of [
  ["en", "ltr", ["h", "m", "s"]],
  ["he", "rtl", ["ש׳", "דק׳", "שנ׳"]],
  ["he-IL", "rtl", ["ש׳", "דק׳", "שנ׳"]],
]) {
  test(`${language}: keypad isolates values and units without changing HHMMSS input order`, async () => {
    const { card } = await mount({ language, custom_timer_input: "keypad" });
    card._toggleCustom("horizontal");
    await card.updateComplete;
    for (const digit of "123456") {
      card.shadowRoot.querySelector(`[data-key="${digit}"]`).click();
      await card.updateComplete;
    }
    const output = card.shadowRoot.querySelector(".duration-readout");
    assert.equal(output.dir, "ltr");
    assert.equal(card.shadowRoot.querySelector(".duration-key-grid").dir, "ltr");
    const pairs = [...output.querySelectorAll(".duration-part")];
    assert.equal(pairs.length, 3);
    pairs.forEach((pair, index) => checkPair(pair, direction, ["12", "34", "56"][index], units[index]));
    assert.equal(card._durationSeconds("horizontal"), 45296);
    assert.equal(card._keypadDigits.horizontal, "123456");
  });
}

test("Hebrew quick presets keep values and units isolated", async () => {
  const { card } = await mount({ timer_presets: ["90s", 12, "2h"] });
  const pairs = [...card.shadowRoot.querySelectorAll(".btn-preset .duration-part")];
  assert.equal(pairs.length, 3);
  for (const [index, value, unit] of [[0, "90", "שנ׳"], [1, "12", "דק׳"], [2, "2", "ש׳"]]) {
    checkPair(pairs[index], "rtl", value, unit);
  }
});

test("Hebrew increments isolate the sign with the number", async () => {
  const { card } = await mount({ minute_buttons: [12, "30s", "2h"] });
  card._toggleCustom("horizontal");
  await card.updateComplete;
  const buttons = [...card.shadowRoot.querySelectorAll(".buttons-grid button")];
  for (const [index, number, unit] of [[0, "+12", "דק׳"], [1, "+30", "שנ׳"], [2, "+2", "ש׳"], [3, "-12", "דק׳"], [4, "-30", "שנ׳"], [5, "-2", "ש׳"]]) {
    checkPair(buttons[index].querySelector(".duration-part"), "rtl", number, unit);
  }
  buttons[0].click();
  await card.updateComplete;
  assert.equal(card._durationSeconds("horizontal"), 27 * 60);
});

test("native inline editing uses the same signed-unit rendering and LTR clock", async () => {
  const entity = "timer.kitchen";
  const { card } = await mount({ entities: [{ entity, keep_timer_visible_when_idle: true }], minute_buttons: [12] }, {
    [entity]: { state: "idle", attributes: { duration: "00:15:00", friendly_name: "Kitchen" } },
  });
  const timer = card._timers.find(t => t.source_entity === entity);
  assert.ok(timer);
  card._openTimerEditor(timer);
  await card.updateComplete;
  const root = card.shadowRoot.querySelector(".editor-container");
  const pairs = [...root.querySelectorAll(".duration-part")];
  checkPair(pairs[0], "rtl", "+12", "דק׳");
  checkPair(pairs[1], "rtl", "-12", "דק׳");
  assert.equal(root.querySelector(".display").dir, "ltr");
  assert.equal(root.querySelector(".display").textContent, "15:00");
});

test("Hebrew seconds presets get localized names without presentation markup", async () => {
  const { card } = await mount({ timer_presets: ["30s"] });
  card.shadowRoot.querySelector(".btn-preset").click();
  const [timer] = card._loadTimersFromStorage_local();
  assert.equal(timer.duration, 30000);
  assert.equal(timer.label, "30שנ׳ טיימר");
  assert.equal(timer.label, card._formatTimerLabel(30));
  assert.ok(/^preset-\d+$/.test(timer.id));
  assert.equal(/[\u200e\u200f\u202a-\u202e\u2066-\u2069<>]/.test(timer.label), false);
});

test("RTL rendering does not alter native service duration", async () => {
  const { card, calls } = await mount({ custom_timer_input: "keypad", default_timer_entity: "timer.kitchen" });
  card._toggleCustom("horizontal");
  await card.updateComplete;
  for (const digit of "159") {
    card.shadowRoot.querySelector(`[data-key="${digit}"]`).click();
    await card.updateComplete;
  }
  card.shadowRoot.querySelector(".text-input").value = "Tea 2!";
  card.shadowRoot.querySelector(".picker-actions .btn-primary").click();
  assert.deepEqual(calls.find(call => call[0] === "timer"), ["timer", "start", { entity_id: "timer.kitchen", duration: "00:01:59" }]);
  assert.equal(card._formatDurationForService(119), "00:01:59");
});

test("RTL presentation does not leak markup or directional controls into MQTT data", async () => {
  const { card, calls } = await mount({ custom_timer_input: "keypad", storage: "mqtt", mqtt: { topic: "rtl/timers" } });
  card._toggleCustom("horizontal");
  await card.updateComplete;
  for (const digit of "159") {
    card.shadowRoot.querySelector(`[data-key="${digit}"]`).click();
    await card.updateComplete;
  }
  card.shadowRoot.querySelector(".text-input").value = "תה Tea 2!";
  card.shadowRoot.querySelector(".picker-actions .btn-primary").click();
  const publish = calls.find(call => call[0] === "mqtt" && call[1] === "publish" && call[2].topic === "rtl/timers");
  assert.ok(publish);
  const [timer] = JSON.parse(publish[2].payload).timers;
  assert.equal(timer.label, "תה Tea 2!");
  assert.equal(timer.duration, 119000);
  assert.equal(/[\u200e\u200f\u202a-\u202e\u2066-\u2069<>]/.test(publish[2].payload), false);
});

test("human-readable Hebrew durations keep each count only once", async () => {
  const { card } = await mount();
  assert.equal(card._formatHumanUnits(5025000, "compact"), "1ש׳ 23דק׳ 45שנ׳");
  assert.equal(card._formatHumanUnits(5025000, "short"), "1 שעה, 23 דקות, 45 שניות");
  assert.equal(card._formatHumanUnits(5025000, "natural"), "1 שעה, 23 דקות, 45 שניות");
});