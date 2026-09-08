import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const key of ["window", "document", "customElements", "localStorage", "HTMLElement", "Element", "Node", "CustomEvent", "Document", "CSSStyleSheet", "ShadowRoot"]) {
  globalThis[key] = dom.window[key];
}
for (const name of ["ha-input", "ha-entity-picker"]) customElements.define(name, class extends HTMLElement {});
customElements.define("ha-expansion-panel", class extends HTMLElement {
  get expanded() { return this.hasAttribute("expanded"); }
  set expanded(value) { this.toggleAttribute("expanded", value); }
});
await import("../simple-timer-card.js");
afterEach(() => { document.body.replaceChildren(); localStorage.clear(); });
after(() => dom.window.close());

async function mount(config = {}) {
  const editor = document.createElement("simple-timer-card-editor");
  editor.hass = { language: "en", states: {}, services: { notify: { mobile_app: {} } } };
  editor.setConfig({ type: "custom:simple-timer-card", ...config });
  const events = [];
  editor.addEventListener("config-changed", event => events.push(event.detail.config));
  document.body.append(editor);
  await editor.updateComplete;
  return { editor, events };
}

function control(editor, key) {
  return [...editor.shadowRoot.querySelectorAll("*")].find(el => el.configValue === key);
}

function available(editor, el) {
  if (!el || el.closest("[data-search-hidden], [hidden]")) return false;
  const all = editor.shadowRoot.querySelector(".card-config").matches(".show-advanced, .is-searching");
  return all || !el.closest(".advanced");
}

function sections(editor) {
  return [...editor.shadowRoot.querySelectorAll("ha-expansion-panel")].filter(el => available(editor, el)).map(el => el.dataset.section);
}

async function advanced(editor, value) {
  const toggle = editor.shadowRoot.querySelector("[data-editor-advanced]");
  toggle.checked = value;
  toggle.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await editor.updateComplete;
}

async function search(editor, query) {
  const field = editor.shadowRoot.querySelector(".editor-search");
  field.value = query;
  field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await editor.updateComplete;
}

test("simple mode contains four essential sections including timer storage", async () => {
  const { editor } = await mount();
  assert.deepEqual(sections(editor), ["entities", "storage", "appearance", "input"]);
  assert.deepEqual([...editor.shadowRoot.querySelectorAll("ha-expansion-panel[expanded]")].map(p => p.dataset.section), ["entities"]);
  for (const key of ["title", "style", "custom_timer_input", "show_timer_input_selector", "minute_buttons", "default_new_timer_duration_mins", "timer_presets", "auto_discover_google", "auto_discover_alexa", "auto_voice_pe", "default_timer_entity"]) {
    assert.ok(available(editor, control(editor, key)), `Expected simple field ${key}`);
  }
  for (const key of ["layout", "language", "sort_by", "time_format", "default_timer_icon", "audio_enabled", "snooze_duration", "timer_name_presets"]) {
    assert.equal(available(editor, control(editor, key)), false, `Expected advanced field ${key}`);
  }
});

test("input fields stay together; fixed keypad hides button settings only in simple mode", async () => {
  const { editor } = await mount({ custom_timer_input: "keypad" });
  for (const key of ["custom_timer_input", "show_timer_input_selector", "minute_buttons", "default_new_timer_duration_mins", "timer_name_presets", "show_timer_presets", "timer_presets"]) {
    assert.equal(control(editor, key).closest("ha-expansion-panel").dataset.section, "input");
  }
  assert.equal(available(editor, control(editor, "minute_buttons")), false);
  assert.equal(available(editor, control(editor, "default_new_timer_duration_mins")), false);
  await advanced(editor, true);
  assert.equal(available(editor, control(editor, "minute_buttons")), true);
  await advanced(editor, false);
  const toggle = control(editor, "show_timer_input_selector");
  toggle.checked = true;
  toggle.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await editor.updateComplete;
  assert.equal(available(editor, control(editor, "minute_buttons")), true);
});

test("selector setting emits opt-in and removes false without changing input method", async () => {
  const { editor, events } = await mount({ custom_timer_input: "keypad" });
  const toggle = control(editor, "show_timer_input_selector");
  assert.equal(toggle.checked, false);
  for (const value of [true, false]) {
    toggle.checked = value;
    toggle.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await editor.updateComplete;
    assert.equal(events.at(-1).custom_timer_input, "keypad");
    assert.equal(events.at(-1).show_timer_input_selector, value ? true : undefined);
  }
});

test("advanced toggle reveals specialist panels without emitting configuration", async () => {
  const { editor, events } = await mount();
  const before = JSON.stringify(editor._config);
  await advanced(editor, true);
  assert.deepEqual(sections(editor), ["entities", "storage", "appearance", "input", "display", "styling", "defaults", "pinned", "audio", "notify", "actions"]);
  await advanced(editor, false);
  assert.deepEqual(sections(editor), ["entities", "storage", "appearance", "input"]);
  assert.equal(JSON.stringify(editor._config), before);
  assert.equal(events.length, 0);
});

test("editor mode persists across instances and config reloads without changing YAML", async () => {
  const preference = "simple-timer-card-editor-mode";
  const { editor, events } = await mount({ title: "Kitchen" });
  assert.equal(localStorage.getItem(preference), null);
  await advanced(editor, true);
  assert.equal(localStorage.getItem(preference), "advanced");
  assert.deepEqual(editor._config, { type: "custom:simple-timer-card", title: "Kitchen" });
  assert.equal(events.length, 0);
  editor.remove();
  const { editor: reopened, events: newEvents } = await mount({ title: "Office", storage_namespace: "different-card" });
  assert.equal(reopened._showAdvanced, true);
  assert.ok(available(reopened, control(reopened, "sort_by")));
  reopened.setConfig({ type: "custom:simple-timer-card", title: "Reloaded" });
  await reopened.updateComplete;
  assert.equal(reopened._showAdvanced, true);
  await advanced(reopened, false);
  assert.equal(localStorage.getItem(preference), "simple");
  assert.equal(newEvents.length, 0);
  const { editor: third } = await mount();
  assert.equal(third._showAdvanced, false);
});

test("searching advanced fields never replaces the remembered mode", async () => {
  const { editor } = await mount();
  await advanced(editor, false);
  await search(editor, "sort_by");
  assert.ok(available(editor, control(editor, "sort_by")));
  assert.equal(localStorage.getItem("simple-timer-card-editor-mode"), "simple");
  await search(editor, "");
  const { editor: reopened } = await mount();
  assert.equal(reopened._showAdvanced, false);
});

test("missing or invalid editor preference defaults to simple", async () => {
  for (const value of ["", "true", "false", "{bad json}", "unknown"]) {
    localStorage.setItem("simple-timer-card-editor-mode", value);
    const { editor } = await mount();
    assert.equal(editor._showAdvanced, false);
    editor.remove();
  }
});

test("blocked localStorage does not break the editor or mode switching", async () => {
  const proto = dom.window.Storage.prototype;
  const read = proto.getItem;
  const write = proto.setItem;
  proto.getItem = () => { throw new dom.window.DOMException("Storage unavailable", "SecurityError"); };
  proto.setItem = () => { throw new dom.window.DOMException("Storage unavailable", "SecurityError"); };
  try {
    const { editor, events } = await mount();
    assert.equal(editor._showAdvanced, false);
    await advanced(editor, true);
    assert.equal(editor._showAdvanced, true);
    await advanced(editor, false);
    assert.equal(editor._showAdvanced, false);
    assert.equal(events.length, 0);
  } finally {
    proto.getItem = read;
    proto.setItem = write;
  }
});

test("search finds advanced fields and YAML keys without toggling advanced or changing configuration", async () => {
  const { editor, events } = await mount();
  await search(editor, "sort_by");
  assert.deepEqual(sections(editor), ["display"]);
  assert.equal(available(editor, control(editor, "sort_by")), true);
  assert.equal(editor._showAdvanced, false);
  assert.ok(editor.shadowRoot.querySelector('[data-section="display"] .advanced-badge'));
  await search(editor, "source_styles alexa");
  assert.deepEqual(sections(editor), ["styling"]);
  assert.ok([...editor.shadowRoot.querySelectorAll('[label="Alexa icon"]')].some(el => available(editor, el)));
  await search(editor, "minute_buttons");
  assert.deepEqual(sections(editor), ["input"]);
  await search(editor, "Tap action");
  assert.deepEqual(sections(editor), ["actions"]);
  await search(editor, "zzzz-no-such-option");
  assert.deepEqual(sections(editor), []);
  assert.equal(editor.shadowRoot.querySelector(".search-empty").hidden, false);
  await search(editor, "");
  assert.equal(editor.shadowRoot.querySelector(".search-empty").hidden, true);
  assert.deepEqual(sections(editor), ["entities", "storage", "appearance", "input"]);
  assert.equal(events.length, 0);
});

test("clearing search restores the previous panel expansion state", async () => {
  const { editor } = await mount();
  const input = editor.shadowRoot.querySelector('[data-section="input"]');
  input.dispatchEvent(new CustomEvent("expanded-changed", { detail: { expanded: true } }));
  await editor.updateComplete;
  const before = { ...editor._expandedSections };
  await search(editor, "Appearance");
  const appearance = editor.shadowRoot.querySelector('[data-section="appearance"]');
  appearance.dispatchEvent(new CustomEvent("expanded-changed", { detail: { expanded: true } }));
  await editor.updateComplete;
  assert.deepEqual(editor._expandedSections, before);
  await search(editor, "");
  assert.ok(input.hasAttribute("expanded"));
  assert.equal(appearance.hasAttribute("expanded"), false);
});

test("search reconciles a panel collapsed by its native reflected property", async () => {
  const { editor, events } = await mount();
  const panel = editor.shadowRoot.querySelector('[data-section="entities"]');
  assert.equal(panel.expanded, true);
  await search(editor, "Timer sources");
  panel.expanded = false;
  panel.dispatchEvent(new CustomEvent("expanded-changed", { detail: { expanded: false } }));
  assert.equal(editor._expandedSections.entities, true);
  await search(editor, "");
  assert.equal(panel.expanded, true);
  await search(editor, "Timer sources");
  assert.equal(panel.expanded, true);
  assert.equal(events.length, 0);
});

test("entity search retains each matching timer's identifying picker", async () => {
  const { editor } = await mount({ entities: ["timer.kitchen", "timer.office"] });
  await search(editor, "Icon override");
  const matches = [...editor.shadowRoot.querySelectorAll(".entity-editor")].filter(el => available(editor, el));
  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map(group => {
    const identity = [...group.children].find(el => el.configValue === "entity");
    assert.ok(available(editor, identity));
    assert.ok(available(editor, group.querySelector('[label="Icon override"]')));
    return identity.value;
  }), ["timer.kitchen", "timer.office"]);
});

test("editing a simple field preserves hidden and inactive advanced configuration", async () => {
  const saved = {
    title: "Before", default_new_timer_duration_mins: 0,
    show_timer_presets: false, timer_presets: ["12m"], timer_name_presets: ["Tea"],
    minute_buttons: ["30s", "2h"], audio_enabled: false,
    audio_file_url: "/local/done.mp3", audio_repeat_count: 3, audio_completion_delay: 8, audio_play_until_dismissed: true,
    source_styles: { google: { icon: "mdi:google-assistant", color: "#fff" } },
    entities: [{ entity: "sensor.mini_timers", mode: "google", buttons: [], name: "Tea", hold_action: { action: "more-info" } }],
    pinned_timers: [{ id: "tea", name: "Tea", duration: "5m", buttons: [{ action: "pause", name: "Wait", color: "blue", show_when: "paused" }] }],
    storage: "mqtt", storage_namespace: "kitchen", mqtt: { topic: "kitchen/timers", state_topic: "kitchen/state", events_topic: "kitchen/events", sensor_entity: "sensor.store" },
    compatibility_mode: "latest", notify: { service: "notify.mobile_app", data: { custom: "preserve" } },
    tap_action: { action: "navigate", navigation_path: "/lovelace/timers" }, custom_setting: { future: true },
  };
  const { editor, events } = await mount(saved);
  await advanced(editor, true); await advanced(editor, false); await search(editor, "Title"); await search(editor, "");
  assert.equal(events.length, 0);
  const title = control(editor, "title");
  title.value = "After";
  title.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 70));
  const emitted = events.at(-1);
  assert.equal(emitted.title, "After");
  for (const [key, value] of Object.entries(saved)) {
    if (["title", "audio_enabled"].includes(key)) continue;
    assert.deepEqual(emitted[key], value, `Lost hidden configuration: ${key}`);
  }
  assert.equal(saved.title, "Before");
});

test("name suggestions remain editable when quick-start buttons are hidden", async () => {
  const { editor } = await mount({ show_timer_presets: false, timer_name_presets: ["Coffee"] });
  await advanced(editor, true);
  const names = control(editor, "timer_name_presets");
  assert.ok(available(editor, names));
  assert.equal(names.value, "Coffee");
  assert.equal(control(editor, "timer_presets"), undefined);
});

test("turning features off and back on retains their configured values", async () => {
  const { editor, events } = await mount({ audio_enabled: true, audio_file_url: "/local/end.mp3", audio_repeat_count: 3,
    show_timer_presets: true, timer_presets: ["90s"], timer_name_presets: ["Tea"], expire_action: "keep", expire_keep_for: 45 });
  await advanced(editor, true);
  for (const setting of ["audio_enabled", "show_timer_presets"]) {
    for (const value of [false, true]) {
      const toggle = control(editor, setting);
      toggle.checked = value;
      toggle.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      await editor.updateComplete;
      assert.equal(events.at(-1).audio_file_url, "/local/end.mp3");
      assert.equal(events.at(-1).audio_repeat_count, 3);
      assert.deepEqual(events.at(-1).timer_presets, ["90s"]);
      assert.deepEqual(events.at(-1).timer_name_presets, ["Tea"]);
    }
  }
  for (const value of ["dismiss", "keep"]) {
    control(editor, "expire_action").dispatchEvent(new CustomEvent("selected", { detail: { value }, bubbles: true }));
    await editor.updateComplete;
    assert.equal(events.at(-1).expire_keep_for, 45);
    assert.equal(!!control(editor, "expire_keep_for"), value === "keep");
  }
});

test("entity entries are compact in simple mode; Google mode remains correct", async () => {
  const { editor } = await mount({ entities: ["sensor.office"] });
  editor.hass = { ...editor.hass, states: { "sensor.office": { attributes: { timers: [{ timer_id: "id", fire_time: 1900000000, duration: "0:15:00", status: "set" }] } } } };
  await editor.updateComplete;
  assert.ok(available(editor, control(editor, "entity")));
  assert.equal(available(editor, control(editor, "mode")), false);
  await advanced(editor, true);
  assert.ok(available(editor, control(editor, "mode")));
  assert.ok(control(editor, "mode").options.some(o => o.value === "google"));
  assert.ok(editor.shadowRoot.textContent.includes("Detected mode: Google"));
  await advanced(editor, false);
  await search(editor, "Icon override");
  assert.deepEqual(sections(editor), ["entities"]);
  assert.ok(available(editor, control(editor, "icon")));
});

test("search respects feature prerequisites instead of enabling them", async () => {
  const { editor, events } = await mount({ custom_timer_input: "keypad", audio_enabled: false, auto_voice_pe: false });
  await search(editor, "audio_repeat_count");
  assert.equal(control(editor, "audio_repeat_count"), undefined);
  assert.equal(editor._config.audio_enabled, false);
  await search(editor, "voice_pe_control_entity");
  assert.equal(control(editor, "voice_pe_control_entity"), undefined);
  assert.equal(editor._config.auto_voice_pe, false);
  assert.equal(events.length, 0);
});

test("discovery and optional Voice PE control live in the appropriate sections", async () => {
  const { editor, events } = await mount({ auto_voice_pe: true });
  for (const key of ["auto_voice_pe", "auto_discover_alexa", "auto_discover_google"]) {
    assert.equal(control(editor, key).closest("ha-expansion-panel").dataset.section, "entities");
  }
  const voice = control(editor, "voice_pe_control_entity");
  assert.equal(voice.closest("ha-expansion-panel").dataset.section, "storage");
  assert.equal(available(editor, voice), false);
  assert.ok(available(editor, control(editor, "default_timer_entity")));
  await advanced(editor, true);
  assert.ok(available(editor, voice));
  voice.dispatchEvent(new CustomEvent("value-changed", { detail: { value: "text.voice_command" }, bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(events.at(-1).voice_pe_control_entity, "text.voice_command");
});

for (const [config, description] of [
  [{ default_timer_entity: "timer.kitchen" }, "Native Home Assistant Timer"],
  [{ default_timer_entity: "input_text.store" }, "Helper Entities"],
  [{ storage: "mqtt", mqtt: { topic: "kitchen" } }, "MQTT"],
  [{ storage: "local", mqtt: { topic: "kitchen" } }, "Local Browser Storage"],
]) {
  test(`simple storage summary reports ${description}`, async () => {
    const { editor } = await mount(config);
    assert.equal(editor.shadowRoot.querySelector(".storage-label strong").textContent, description);
    assert.ok(available(editor, editor.shadowRoot.querySelector(".storage-info")));
    assert.ok(available(editor, control(editor, "default_timer_entity")));
    assert.equal(editor.shadowRoot.querySelector('[data-section="storage"] .advanced-badge'), null);
  });
}