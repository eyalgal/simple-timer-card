import assert from "node:assert/strict";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "customElements", "localStorage", "HTMLElement", "Element", "Node", "CustomEvent", "Document", "CSSStyleSheet", "ShadowRoot"]) {
  globalThis[key] = dom.window[key];
}
await import("../simple-timer-card.js");
after(() => dom.window.close());

const sensor = "sensor.kitchen_timers";
const timerId = "timer/6ed06a56-8a58-c6e3-a7d4-03f92c9d8a51";

function makeCard({ services = { google_home: { delete_timer: {} } }, callService } = {}) {
  const card = document.createElement("simple-timer-card");
  card.setConfig({ entities: [sensor] });
  const calls = [];
  const warnings = [];
  card.addEventListener("hass-notification", ev => warnings.push(ev.detail.message));
  card.hass = {
    user: { id: "tester", is_admin: true },
    config: { version: "2026.10.0" },
    services,
    states: {
      [sensor]: {
        state: "ringing",
        attributes: { friendly_name: "Kitchen", timers: [{ timer_id: timerId, fire_time: Math.floor(Date.now() / 1000), duration: "0:05:00", status: "ringing" }] },
      },
    },
    callService: (...args) => { calls.push(args); return callService ? callService(...args) : Promise.resolve(); },
  };
  const [timer] = card._parseGoogle(sensor, card.hass.states[sensor], {});
  return { card, calls, warnings, timer };
}

test("dismissing a Google Home timer deletes it on the speaker and hides it", () => {
  const { card, calls, timer } = makeCard();
  card._handleDismiss(timer);
  assert.deepEqual(calls, [["google_home", "delete_timer", { entity_id: sensor, timer_id: timerId }]]);
  assert.ok(card._dismissed.has(`${sensor}:${timer.id}`));
});

test("Google Home dismiss stays card-only when the service is unavailable", () => {
  const { card, calls, timer } = makeCard({ services: {} });
  card._handleDismiss(timer);
  assert.equal(calls.length, 0);
  assert.ok(card._dismissed.has(`${sensor}:${timer.id}`));
});

test("a failed delete_timer call still hides the timer and warns", async () => {
  const { card, warnings, timer } = makeCard({ callService: () => Promise.reject(new Error("boom")) });
  card._handleDismiss(timer);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(card._dismissed.has(`${sensor}:${timer.id}`));
  assert.equal(warnings.length, 1);
});
