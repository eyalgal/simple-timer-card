import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_TIMER_SECONDS,
  normalizeTimerInput,
  durationDigitFields,
  durationDigitsToSeconds,
  secondsToDurationDigits,
  editDurationDigits,
} from "../src/duration-input.js";

test("digits shift into seconds, then minutes, then hours", () => {
  let digits = "";
  for (const [key, expectedFields, seconds] of [
    ["1", ["00", "00", "01"], 1],
    ["5", ["00", "00", "15"], 15],
    ["9", ["00", "01", "59"], 119],
  ]) {
    digits = editDurationDigits(digits, key);
    assert.deepEqual(durationDigitFields(digits), expectedFields);
    assert.equal(durationDigitsToSeconds(digits), seconds);
  }
});

test("double zero enters minutes and hours quickly", () => {
  assert.equal(durationDigitsToSeconds(editDurationDigits("5", "00")), 300);
  assert.equal(durationDigitsToSeconds(editDurationDigits(editDurationDigits("1", "00"), "00")), 3600);
});

test("zero, backspace, and clear preserve digit-entry semantics", () => {
  assert.equal(editDurationDigits("", "0"), "");
  assert.equal(editDurationDigits("", "00"), "");
  assert.equal(editDurationDigits("", "backspace"), "");
  assert.equal(editDurationDigits("159", "backspace"), "15");
  assert.equal(editDurationDigits("159", "clear"), "");
  assert.deepEqual(durationDigitFields(""), ["00", "00", "00"]);
});

test("out-of-range minute/second fields are normalized only on conversion", () => {
  assert.deepEqual(durationDigitFields("90"), ["00", "00", "90"]);
  assert.equal(durationDigitsToSeconds("90"), 90);
  assert.equal(secondsToDurationDigits(durationDigitsToSeconds("90")), "130");
  assert.equal(secondsToDurationDigits(durationDigitsToSeconds("199")), "239");
  assert.equal(secondsToDurationDigits(durationDigitsToSeconds("999999")), "1004039");
});

test("long stepper durations round-trip without truncating hours", () => {
  for (const seconds of [0, 1, 119, 900, 3599, 3600, 99 * 3600, 100 * 3600, MAX_TIMER_SECONDS]) {
    assert.equal(durationDigitsToSeconds(secondsToDurationDigits(seconds)), seconds);
  }
  assert.deepEqual(durationDigitFields(secondsToDurationDigits(MAX_TIMER_SECONDS)), ["8760", "00", "00"]);
});

test("entry is bounded and non-digit edits are rejected", () => {
  assert.equal(editDurationDigits("8760000", "0"), "87600000");
  assert.equal(editDurationDigits("8760000", "1"), null);
  assert.equal(editDurationDigits("87600000", "0"), null);
  for (const key of ["-", ".", "e", "1e5", "99", " ", "Enter", "000", "abc"]) {
    assert.equal(editDurationDigits("15", key), null);
  }
  for (const value of [null, undefined, 123, "NaN", "1e3", "-100", "123456789"]) {
    assert.equal(durationDigitsToSeconds(value), 0);
  }
});

test("input mode defaults to the existing stepper", () => {
  for (const value of [undefined, null, {}, [], "", "clock", "stepper"]) assert.equal(normalizeTimerInput(value), "stepper");
  for (const value of ["keypad", "KEYPAD", " Keypad "]) assert.equal(normalizeTimerInput(value), "keypad");
});