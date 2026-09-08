export const MAX_TIMER_SECONDS = 365 * 24 * 60 * 60;

export function normalizeTimerInput(value) {
  return typeof value === "string" && value.trim().toLowerCase() === "keypad" ? "keypad" : "stepper";
}

export function durationDigitFields(digits) {
  const padded = String(digits).padStart(6, "0");
  return [padded.slice(0, -4), padded.slice(-4, -2), padded.slice(-2)];
}

export function durationDigitsToSeconds(digits) {
  if (typeof digits !== "string" || !/^\d{0,8}$/.test(digits)) return 0;
  const [hours, minutes, seconds] = durationDigitFields(digits).map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

export function secondsToDurationDigits(seconds) {
  const total = Number.isFinite(seconds) ? Math.min(MAX_TIMER_SECONDS, Math.max(0, Math.floor(seconds))) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  return `${hours}${String(minutes).padStart(2, "0")}${String(total % 60).padStart(2, "0")}`.replace(/^0+/, "");
}

export function editDurationDigits(digits, key) {
  if (key === "clear") return "";
  if (key === "backspace") return digits.slice(0, -1);
  if (!/^(\d|00)$/.test(key)) return null;
  const next = (digits + key).replace(/^0+/, "");
  if (next.length > 8 || durationDigitsToSeconds(next) > MAX_TIMER_SECONDS) return null;
  return next;
}