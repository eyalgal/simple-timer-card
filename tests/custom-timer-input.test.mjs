import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const key of ["window", "document", "customElements", "localStorage", "HTMLElement", "Element", "Node", "CustomEvent", "Document", "CSSStyleSheet", "ShadowRoot"]) {
  globalThis[key] = dom.window[key];
}
customElements.define("ha-input", class extends HTMLElement {});
await import("../simple-timer-card.js");

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});
after(() => dom.window.close());

async function mount(config = {}, { active = false } = {}) {
  const card = document.createElement("simple-timer-card");
  card.setConfig({ type: "custom:simple-timer-card", storage_namespace: "keypad-test", ...config });
  const calls = [];
  card.hass = {
    states: {}, services: {}, language: "en", connected: true, user: { is_admin: true },
    callService: (...args) => { calls.push(args); return Promise.resolve(); },
  };
  card._unlockAudioHandler = () => {};
  if (active) {
    card._saveTimersToStorage_local([{ id: "existing", source: "local", source_entity: "local", label: "Existing",
      duration: 3600000, start_ts: Date.now(), end_ts: Date.now() + 3600000 }]);
  }
  document.body.append(card);
  await card.updateComplete;
  return { card, calls };
}

function picker(card) {
  return card.shadowRoot.querySelector("[data-duration-picker]");
}

async function click(card, element) {
  assert.ok(element, "Expected control to be rendered");
  element.click();
  await card.updateComplete;
}

async function open(card) {
  const label = card._config.show_timer_presets === false ? "add" : "custom";
  await click(card, [...card.shadowRoot.querySelectorAll("button")].find(b => b.textContent.trim() === card._localize(label)));
  assert.equal(picker(card).getAttribute("aria-hidden"), "false");
}

async function key(card, value) {
  await click(card, picker(card).querySelector(`[data-key="${value}"]`));
}

async function mode(card, name) {
  await click(card, [...picker(card).querySelectorAll(".duration-mode-btn")].find(b => b.textContent === card._localize(`input_${name}`)));
}

function readout(card) {
  return picker(card).querySelector(".duration-readout")?.textContent.replace(/\s/g, "");
}

test("default stepper, configured zero, and keypad have correct initial values", async () => {
  for (const [config, inputMode, seconds] of [
    [{}, "stepper", 900],
    [{ default_new_timer_duration_mins: 0 }, "stepper", 0],
    [{ default_new_timer_duration_mins: 20 }, "stepper", 1200],
    [{ custom_timer_input: "keypad", default_new_timer_duration_mins: 20 }, "keypad", 0],
    [{ custom_timer_input: "invalid" }, "stepper", 900],
  ]) {
    const { card } = await mount(config);
    await open(card);
    assert.equal(picker(card).querySelector(".duration-entry").dataset.inputMode, inputMode);
    assert.equal(card._durationSeconds("horizontal"), seconds);
    assert.equal(picker(card).querySelector(".btn-primary").disabled, seconds === 0);
    card.remove();
  }
});

for (const scenario of [
  { name: "empty horizontal", layout: "horizontal", which: "horizontal" },
  { name: "empty vertical", layout: "vertical", which: "vertical" },
  ...["fill_horizontal", "fill_vertical", "bar_horizontal", "bar_vertical", "circle_horizontal", "circle_vertical"].map(style => ({
    name: `active ${style}`, style, active: true, which: style.startsWith("fill") ? "fill" : "bar",
  })),
]) {
  test(`${scenario.name}: digits create a named timer through the common input`, async () => {
    const { card } = await mount({ custom_timer_input: "keypad", layout: scenario.layout, style: scenario.style }, scenario);
    await open(card);
    assert.equal(picker(card).dataset.durationPicker, scenario.which);
    assert.equal(readout(card), "00h00m00s");
    await key(card, "1");
    assert.equal(readout(card), "00h00m01s");
    await key(card, "5");
    assert.equal(readout(card), "00h00m15s");
    await key(card, "9");
    assert.equal(readout(card), "00h01m59s");
    const name = picker(card).querySelector("input");
    assert.ok(name);
    name.value = "Tea";
    name.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await click(card, picker(card).querySelector(".btn-primary"));
    const created = card._loadTimersFromStorage_local().find(t => t.label === "Tea");
    assert.ok(created);
    assert.equal(created.duration, 119000);
    assert.equal(created.end_ts - created.start_ts, 119000);
    assert.equal(card._durationSeconds(scenario.which), 0);
    assert.equal(picker(card).getAttribute("aria-hidden"), "true");
    card._updateTimers();
    await card.updateComplete;
    await open(card);
    assert.equal(readout(card), "00h00m00s");
    assert.equal(card._timerInputMode, "keypad");
  });
}

test("live switching keeps duration, name, storage key and saved config", async () => {
  const { card } = await mount({ storage_namespace: undefined, custom_timer_input: "keypad", minute_buttons: ["30s", 5] });
  await open(card);
  const config = JSON.stringify(card._config);
  const storageKey = card._getStorageKey();
  let configEvents = 0;
  card.addEventListener("config-changed", () => configEvents++);
  await key(card, "1"); await key(card, "5"); await key(card, "9");
  const name = picker(card).querySelector("input");
  name.value = "Coffee";
  await mode(card, "stepper");
  assert.equal(card._durationSeconds("horizontal"), 119);
  assert.equal(picker(card).querySelector("input"), name);
  assert.equal(name.value, "Coffee");
  await click(card, picker(card).querySelector(".buttons-grid button"));
  assert.equal(card._durationSeconds("horizontal"), 149);
  await mode(card, "keypad");
  assert.equal(readout(card), "00h02m29s");
  assert.equal(picker(card).querySelector("input").value, "Coffee");
  assert.equal(card._getStorageKey(), storageKey);
  assert.equal(JSON.stringify(card._config), config);
  assert.equal(configEvents, 0);
});

test("unconfigured cards retain the existing automatic storage namespace", async () => {
  const { card } = await mount({ storage_namespace: undefined });
  assert.equal(card._getStorageKey(), "simple-timer-card-auto-1htuhog");
  await open(card);
  await mode(card, "keypad");
  assert.equal(card._getStorageKey(), "simple-timer-card-auto-1htuhog");
  assert.equal(readout(card), "00h15m00s");
});

test("backspace and clear operate on raw digits; zero cannot start", async () => {
  const { card } = await mount({ custom_timer_input: "keypad" });
  await open(card);
  card._startFromCustom("horizontal");
  assert.equal(picker(card).getAttribute("aria-hidden"), "false");
  assert.equal(card._loadTimersFromStorage_local().length, 0);
  await key(card, "1"); await key(card, "5"); await key(card, "9");
  await key(card, "backspace");
  assert.equal(readout(card), "00h00m15s");
  await click(card, picker(card).querySelector(".duration-clear"));
  assert.equal(readout(card), "00h00m00s");
  assert.equal(picker(card).querySelector(".btn-primary").disabled, true);
  assert.equal(picker(card).querySelector('[data-key="backspace"]').disabled, true);
});

test("ninety seconds starts as a ninety-second timer", async () => {
  const { card } = await mount({ custom_timer_input: "keypad" });
  await open(card);
  await key(card, "9"); await key(card, "0");
  assert.equal(readout(card), "00h00m90s");
  await click(card, picker(card).querySelector(".btn-primary"));
  assert.equal(card._loadTimersFromStorage_local()[0].duration, 90000);
});

test("cancel keeps the draft but does not create a timer", async () => {
  const { card } = await mount({ custom_timer_input: "keypad" });
  await open(card);
  await key(card, "5"); await key(card, "00");
  picker(card).querySelector("input").value = "Pasta";
  await click(card, picker(card).querySelector(".picker-actions .btn-ghost"));
  assert.equal(picker(card).getAttribute("aria-hidden"), "true");
  assert.equal(picker(card).hasAttribute("inert"), true);
  assert.equal(card._loadTimersFromStorage_local().length, 0);
  await open(card);
  assert.equal(readout(card), "00h05m00s");
  assert.equal(picker(card).querySelector("input").value, "Pasta");
});

for (const layout of ["horizontal", "vertical"]) {
  for (const style of ["fill_horizontal", "bar_horizontal"]) {
    test(`${layout} / ${style}: restored draft matches its keypad after changing mode in another form`, async () => {
      const { card } = await mount({ layout, style, minute_buttons: [5] });
      await open(card);
      await click(card, picker(card).querySelector(".buttons-grid button"));
      assert.equal(card._durationSeconds(layout), 1200);
      await click(card, picker(card).querySelector(".picker-actions .btn-ghost"));
      await click(card, card.shadowRoot.querySelector(".btn-preset"));
      card._updateTimers();
      await card.updateComplete;
      await open(card);
      await mode(card, "keypad");
      await click(card, picker(card).querySelector(".picker-actions .btn-ghost"));
      await click(card, card.shadowRoot.querySelector('.item .action-btn[title="Cancel"]'));
      card._updateTimers();
      await card.updateComplete;
      await open(card);
      assert.equal(picker(card).dataset.durationPicker, layout);
      assert.equal(readout(card), "00h20m00s");
      assert.equal(card._durationSeconds(layout), 1200);
      await key(card, "backspace");
      assert.equal(readout(card), "00h02m00s");
      assert.equal(card._durationSeconds(layout), 120);
    });
  }
}

test("invalid names do not discard a duration draft", async () => {
  const { card } = await mount({ custom_timer_input: "keypad" });
  await open(card);
  await key(card, "5");
  picker(card).querySelector("input").value = "x".repeat(101);
  await click(card, picker(card).querySelector(".btn-primary"));
  assert.equal(picker(card).getAttribute("aria-hidden"), "false");
  assert.equal(readout(card), "00h00m05s");
  assert.equal(card._loadTimersFromStorage_local().length, 0);
});

test("scoped physical keyboard handles digits and editing without affecting name entry", async () => {
  const { card } = await mount({ custom_timer_input: "keypad" });
  await open(card);
  const keypad = picker(card).querySelector(".duration-keypad");
  async function press(target, key, options = {}) {
    const event = new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
    target.dispatchEvent(event);
    await card.updateComplete;
    return event.defaultPrevented;
  }
  for (const key of ["1", "5", "9"]) assert.equal(await press(keypad, key), true);
  assert.equal(readout(card), "00h01m59s");
  assert.equal(await press(keypad, "Backspace"), true);
  assert.equal(readout(card), "00h00m15s");
  assert.equal(await press(keypad, "Delete"), true);
  assert.equal(readout(card), "00h00m00s");
  assert.equal(await press(keypad, "1", { ctrlKey: true }), false);
  assert.equal(await press(keypad, "1", { metaKey: true }), false);
  assert.equal(await press(keypad, "Tab"), false);
  assert.equal(await press(picker(card).querySelector("input"), "1"), false);
  assert.equal(readout(card), "00h00m00s");
  await press(keypad, "5");
  assert.equal(await press(picker(card).querySelector('[data-key="1"]'), "Enter"), false);
  assert.equal(await press(keypad, "Enter"), true);
  assert.equal(card._loadTimersFromStorage_local()[0].duration, 5000);
});

test("right-to-left UI keeps numeral and keypad ordering left-to-right", async () => {
  const { card } = await mount({ custom_timer_input: "keypad", language: "he" });
  await open(card);
  assert.equal(card.shadowRoot.querySelector("ha-card").dir, "rtl");
  assert.equal(picker(card).querySelector(".duration-readout").dir, "ltr");
  const grid = picker(card).querySelector(".duration-key-grid");
  assert.equal(grid.dir, "ltr");
  assert.deepEqual([...grid.children].map(b => b.dataset.key), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "backspace"]);
  assert.equal(picker(card).querySelector(".duration-mode-btn[aria-pressed=true]").textContent, "לוח מקשים");
});

test("keypad works without quick presets and existing quick presets stay one-tap", async () => {
  const { card } = await mount({ custom_timer_input: "keypad", show_timer_presets: false });
  await open(card);
  await key(card, "1");
  assert.equal(readout(card), "00h00m01s");
  card.remove();
  const { card: presetCard } = await mount({ custom_timer_input: "keypad", timer_presets: ["90s"] });
  await click(presetCard, presetCard.shadowRoot.querySelector(".btn-preset"));
  assert.equal(presetCard._loadTimersFromStorage_local()[0].duration, 90000);
});

test("independent cards do not share live input mode or draft", async () => {
  const { card: first } = await mount();
  const { card: second } = await mount({ storage_namespace: "second" });
  await open(first); await open(second);
  await mode(first, "keypad");
  await click(first, picker(first).querySelector(".duration-clear"));
  await key(first, "7");
  assert.equal(second._timerInputMode, "stepper");
  assert.equal(second._durationSeconds("horizontal"), 900);
});

test("long duration survives switching to and from the keypad", async () => {
  const { card } = await mount({ default_new_timer_duration_mins: 6000 });
  await open(card);
  await mode(card, "keypad");
  assert.equal(readout(card), "100h00m00s");
  assert.equal(card._durationSeconds("horizontal"), 360000);
  await mode(card, "stepper");
  assert.equal(card._durationSeconds("horizontal"), 360000);
});

test("keypad duration uses the native timer creation backend", async () => {
  const { card, calls } = await mount({ custom_timer_input: "keypad", default_timer_entity: "timer.kitchen" });
  await open(card);
  await key(card, "1"); await key(card, "5"); await key(card, "9");
  await click(card, picker(card).querySelector(".btn-primary"));
  assert.deepEqual(calls.find(c => c[0] === "timer" && c[1] === "start"), ["timer", "start", { entity_id: "timer.kitchen", duration: "00:01:59" }]);
});

test("keypad duration uses the MQTT creation backend", async () => {
  const { card, calls } = await mount({ custom_timer_input: "keypad", storage: "mqtt", mqtt: { topic: "keypad/timers" } });
  await open(card);
  await key(card, "1"); await key(card, "5"); await key(card, "9");
  await click(card, picker(card).querySelector(".btn-primary"));
  const publish = calls.find(c => c[0] === "mqtt" && c[1] === "publish" && c[2].topic === "keypad/timers");
  assert.ok(publish);
  assert.equal(JSON.parse(publish[2].payload).timers[0].duration, 119000);
});

test("stepper reset honors the configured default including zero", async () => {
  const { card } = await mount({ default_new_timer_duration_mins: 0 });
  await open(card);
  await click(card, picker(card).querySelector(".buttons-grid button"));
  assert.equal(card._durationSeconds("horizontal"), 60);
  await click(card, picker(card).querySelector(".btn-primary"));
  assert.equal(card._durationSeconds("horizontal"), 0);
});

async function mountEditor(config = {}) {
  const editor = document.createElement("simple-timer-card-editor");
  editor.hass = { states: {}, services: {} };
  editor.setConfig({ type: "custom:simple-timer-card", ...config });
  document.body.append(editor);
  await editor.updateComplete;
  return editor;
}

test("editor exposes default input in modern options and legacy list items", async () => {
  const editor = await mountEditor();
  const select = editor.shadowRoot.querySelector('ha-select[label="Custom timer input"]');
  assert.ok(select);
  assert.equal(select.value, "stepper");
  assert.deepEqual(select.options.map(o => o.value), ["stepper", "keypad"]);
  assert.deepEqual([...select.querySelectorAll("mwc-list-item")].map(i => i.getAttribute("value")), ["stepper", "keypad"]);
});

for (const shape of ["detail-value", "detail-index", "target-value"]) {
  test(`editor emits keypad, strips stepper default, and preserves unrelated config (${shape})`, async () => {
    const editor = await mountEditor({ title: "Kitchen", source_styles: { alexa: { icon: "mdi:speaker" } } });
    const select = editor.shadowRoot.querySelector('ha-select[label="Custom timer input"]');
    const emitted = [];
    editor.addEventListener("config-changed", e => emitted.push(e.detail.config));
    select.value = "keypad";
    const detail = shape === "detail-value" ? { value: "keypad" } : shape === "detail-index" ? { index: 1 } : {};
    select.dispatchEvent(new CustomEvent("selected", { detail, bubbles: true }));
    assert.equal(emitted.at(-1).custom_timer_input, "keypad");
    assert.equal(emitted.at(-1).title, "Kitchen");
    assert.deepEqual(emitted.at(-1).source_styles, { alexa: { icon: "mdi:speaker" } });
    select.dispatchEvent(new CustomEvent("selected", { detail: { value: "stepper" }, bubbles: true }));
    assert.equal(Object.hasOwn(emitted.at(-1), "custom_timer_input"), false);
    const { card } = await mount({ custom_timer_input: "keypad" });
    assert.equal(card._timerInputMode, "keypad");
    card.setConfig({ ...emitted.at(-1), custom_timer_input: "invalid" });
    assert.equal(card._timerInputMode, "stepper");
  });
}