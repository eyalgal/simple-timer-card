/*
 * Simple Timer Card
 *
 * A versatile and highly customizable timer card for Home Assistant Lovelace, offering multiple display styles and support for various timer sources.
 *
 * Author: eyalgal
 * License: MIT
 * Version: 3.0.0
 * For more information, visit: https://github.com/eyalgal/simple-timer-card
 */

import { html, LitElement, css } from "lit";
import { html as shtml, literal } from "lit/static-html.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { live } from "lit/directives/live.js";
import { MAX_TIMER_SECONDS, normalizeTimerInput, durationDigitFields, durationDigitsToSeconds, secondsToDurationDigits, editDurationDigits } from "./duration-input.js";

const cardVersion="3.0.0";

const DAY_IN_MS = 86400000;
const YEAR_IN_MS = 365 * DAY_IN_MS;
const HOUR_IN_SECONDS = 3600;
const MINUTE_IN_SECONDS = 60;
const EDITOR_MODE_STORAGE_KEY = "simple-timer-card-editor-mode";

// A tick gap this large means the page was frozen (device asleep or app
// backgrounded), so any hass state still in memory predates the freeze.
const MQTT_WAKE_GAP_MS = 5000;
// How long to wait after a wake for the websocket to resync entity states
// before trusting the MQTT sensor snapshot again.
const MQTT_RESYNC_GRACE_MS = 5000;
// Retain deletion markers to reduce stale resurrection after a client wakes.
const MQTT_TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000;

// Home Assistant timer_list entities (voice satellite and mobile app timers).
// Bits mirror TimerListEntityFeature in homeassistant/components/timer_list.
// RESTART and RUN_ACTIONS exist only on the companion integration's list.
const TIMER_LIST_FEATURE = { CREATE: 1, PAUSE: 2, CANCEL: 4, ADD_TIME: 8, REMOVE: 16, FINISH: 32, RESTART: 64, RUN_ACTIONS: 128 };
// The optional companion integration (custom_components/simple_timer_card)
// keeps timers in Home Assistant and can run an action when they finish.
const COMPANION_DOMAIN = "simple_timer_card";
// The entity state is the number of active timers. If the subscribed cache
// disagrees for this long, the subscription is assumed stale and is renewed.
const TIMER_LIST_RESYNC_MS = 3000;
const TIMER_LIST_RETRY_MS = 30000;
const TIMER_LIST_META_KEY = "simple-timer-card-timer-list-meta";
const ENTITY_ID_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;

function _cleanUndefined(obj) {
  if (!obj || typeof obj !== "object") return obj;
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) delete obj[k];
  }
  return obj;
}

const CARD_STYLES = ["fill_vertical", "fill_horizontal", "bar_vertical", "bar_horizontal", "circle_vertical", "circle_horizontal"];

// `circle` was the only circle style before 2.9.0 and was laid out vertically.
function _normalizeCardStyle(value) {
  const v = String(value || "").toLowerCase();
  if (v === "circle") return "circle_vertical";
  return CARD_STYLES.includes(v) ? v : "bar_horizontal";
}

function _isCircleStyle(style) {
  return style === "circle_vertical" || style === "circle_horizontal";
}

function _timerRev(t) {
  const r = Number(t?.rev);
  return Number.isFinite(r) && r > 0 ? r : 0;
}

// Lamport counter: always one above anything either side has seen, so revisions
// keep increasing without depending on device clocks staying in sync.
function _nextMqttRev(timers, tombstones) {
  let max = 0;
  for (const t of timers || []) max = Math.max(max, _timerRev(t));
  for (const d of tombstones || []) max = Math.max(max, Number(d?.rev) || 0);
  return max + 1;
}

function _pruneTombstones(tombstones, now = Date.now()) {
  return (tombstones || []).filter((d) => d?.id && now - (Number(d.ts) || 0) < MQTT_TOMBSTONE_TTL_MS);
}

// Stable across reloads and distinct per card, so a card with no explicit
// namespace keeps its timers without colliding with a differently configured
// card on the same dashboard.
function _stableConfigHash(config) {
  // Changing the publish transport must not rename existing pinned timers.
  if (config.mqtt?.publish_automation) {
    const mqtt = { ...config.mqtt };
    delete mqtt.publish_automation;
    config = { ...config, mqtt };
    if (Object.keys(mqtt).length === 0) delete config.mqtt;
  }
  const seen = new WeakSet();
  const ordered = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return null;
    seen.add(v);
    if (Array.isArray(v)) return v.map(ordered);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = ordered(v[k]);
    return out;
  };
  let json;
  try {
    json = JSON.stringify(ordered(config)) || "";
  } catch (e) {
    json = "";
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

// Versions 2.4.0 to 2.8.0 keyed unconfigured cards by a random value, leaving a
// dead entry behind on every reload.
let _prunedLegacyInstanceKeys = false;
function _pruneLegacyInstanceNamespaces() {
  if (_prunedLegacyInstanceKeys) return;
  _prunedLegacyInstanceKeys = true;
  try {
    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("simple-timer-card-instance-")) stale.push(key);
    }
    for (const key of stale) localStorage.removeItem(key);
  } catch (e) {}
}

// Tombstones suppress timers at or below their revision. Timestamp-based
// omissions support older writers, but this is not transactional reconciliation.
function _mergeMqttState(local, incoming, { acceptOmissions = true, now = Date.now() } = {}) {
  const tombs = new Map();
  for (const d of [...(local?.tombstones || []), ...(incoming?.tombstones || [])]) {
    if (!d?.id) continue;
    const rev = Number(d.rev) || 0;
    const prev = tombs.get(d.id);
    if (!prev || rev > prev.rev) tombs.set(d.id, { id: d.id, rev, ts: Number(d.ts) || now });
  }

  const timers = new Map();
  for (const t of incoming?.timers || []) if (t?.id) timers.set(t.id, t);
  if (!acceptOmissions) {
    for (const t of local?.timers || []) {
      if (!t?.id) continue;
      const prev = timers.get(t.id);
      if (!prev || _timerRev(t) > _timerRev(prev)) timers.set(t.id, t);
    }
  }

  const alive = [];
  for (const t of timers.values()) {
    const tomb = tombs.get(t.id);
    if (tomb && tomb.rev >= _timerRev(t)) continue;
    alive.push(t);
  }

  return { timers: alive, tombstones: _pruneTombstones([...tombs.values()], now) };
}

function _remainingMsFromStoredTimer(t, nowTs = Date.now()) {
  if (!t || typeof t !== "object") return 0;
  if (t.paused) {
    const r = Number(t.remaining_ms);
    return Number.isFinite(r) ? Math.max(0, r) : 0;
  }
  const endTs = Number(t.end_ts);
  return Number.isFinite(endTs) ? Math.max(0, endTs - nowTs) : 0;
}

function _pauseUpdatesFromTimer(timer, nowTs = Date.now()) {
  // Compute remaining live from end_ts at the click moment. The cached
  // timer.remaining value is up to 250 ms stale (tick interval), which can
  // freeze the paused display one whole second higher than what the active
  // tick would have shown next.
  const remainingMs = _remainingMsFromStoredTimer(timer, nowTs);
  return { paused: true, remaining_ms: remainingMs, end_ts: null, state: "paused" };
}

function _resumeUpdatesFromTimer(timer, nowTs = Date.now()) {
  const remaining = Number(timer?.remaining);
  const remainingMs = Number.isFinite(remaining) ? Math.max(0, remaining) : _remainingMsFromStoredTimer(timer, nowTs);
  const durationMs = Number(timer?.duration_ms ?? timer?.duration ?? 0);
  const elapsed = durationMs > 0 ? Math.max(0, durationMs - remainingMs) : 0;
  const startTs = nowTs - elapsed;
  const endTs = nowTs + remainingMs;
  return { paused: false, start_ts: startTs, end_ts: endTs, remaining_ms: undefined, state: "active" };
}

const DAY_IN_SECONDS = 86400;

const TRANSLATIONS = {
  en: {
    no_timers: "No Timers",
    timer_name_optional: "Timer Name (Optional)",
    click_to_start: "Click to start",
    no_active_timers: "No Active Timers",
    active_timers: "Active Timers",
    add: "Add",
    custom: "Custom",
    input_stepper: "Buttons",
    input_keypad: "Keypad",
    duration_input: "Duration input",
    clear: "Clear",
    backspace: "Delete last digit",
    cancel: "Cancel",
    save: "Save",
    start: "Start",
    snooze: "Snooze",
    dismiss: "Dismiss",
    ready: "Ready",
    paused: "Paused",
    times_up: "Time's up!",
    timer: "Timer",
    hour_ago: "{n} hour ago",
    hours_ago: "{n} hours ago",
    minute_ago: "{n} minute ago",
    minutes_ago: "{n} minutes ago",
    second_ago: "{n} second ago",
    seconds_ago: "{n} seconds ago",
    h: "h", m: "m", s: "s", d: "d",
    w_short: "w", mo_short: "mo", y_short: "y",
    day: "day", days: "days", week: "week", weeks: "weeks",
    month: "month", months: "months", year: "year", years: "years",
    hour: "hour", hours: "hours", minute: "minute", minutes: "minutes",
    second: "second", seconds: "seconds",
    more_timers: "+{n} more", show_less: "Show less", when_done: "When done",
    just_a_timer: "Just a timer", this_card: "This card", then_action: "then {action}", run_command: "Command",
    put_on_speaker: "Put on a speaker", choose_speaker: "Choose a speaker", announce_title: "Announce on a speaker", announce_desc: "Say something on any speaker when it ends", announce_on: "Announce on {speaker}", announce_message: "What to say (optional)", announce_plain: "Your timer is done", announce_named: "{name} is done",
    search_targets: "Search speakers or rooms",
    speakers: "Speakers", phones: "Phones",
    control_device: "Device", command_placeholder: "e.g. turn off the air purifier", choose_device: "Device", choose_action: "Action",
    needs_companion: "Install the Simple Timer Card integration to run actions when timers end.", timer_start_failed: "Could not start the timer: {error}", action_not_supported: "This timer doesn't support that.", group_other: "Other",
    group_voice: "Voice", group_pinned: "Pinned", group_since: "Since", group_template: "Template",
    group_sensors: "Sensors", group_timers: "Timers", since: "{t} ago",
    add_action: "Do something when it ends", when_it_ends: "When it ends", control_device_title: "Control a device",
    control_device_desc: "Turn on or off, open, lock and more", run_command_title: "Say a command", run_command_desc: "Anything you would ask Assist, e.g. \"turn off the purifier\"",
    quick_actions: "Quick actions", search_devices: "Search by name or room", what_to_do: "What should it do?",
    type_to_search: "Type a name or room to find a device", back: "Back", done: "Done",
    close: "Close",
  },
  de: {
    no_timers: "Keine Timer",
    timer_name_optional: "Timer-Name (optional)",
    click_to_start: "Zum Starten klicken",
    no_active_timers: "Keine aktiven Timer",
    active_timers: "Aktive Timer",
    add: "Hinzufügen",
    custom: "Benutzerdefiniert",
    input_stepper: "Tasten",
    input_keypad: "Ziffernblock",
    duration_input: "Dauer eingeben",
    clear: "Löschen",
    backspace: "Letzte Ziffer löschen",
    cancel: "Abbrechen",
    save: "Speichern",
    start: "Starten",
    snooze: "Schlummern",
    dismiss: "Verwerfen",
    ready: "Bereit",
    paused: "Pausiert",
    times_up: "Zeit abgelaufen!",
    timer: "Timer",
    hour_ago: "vor {n} Stunde",
    hours_ago: "vor {n} Stunden",
    minute_ago: "vor {n} Minute",
    minutes_ago: "vor {n} Minuten",
    second_ago: "vor {n} Sekunde",
    seconds_ago: "vor {n} Sekunden",
    h: "h", m: "m", s: "s", d: "T",
    w_short: "W", mo_short: "Mo", y_short: "J",
    day: "Tag", days: "Tage", week: "Woche", weeks: "Wochen",
    month: "Monat", months: "Monate", year: "Jahr", years: "Jahre",
    hour: "Stunde", hours: "Stunden", minute: "Minute", minutes: "Minuten",
    second: "Sekunde", seconds: "Sekunden",
    more_timers: "+{n} weitere", show_less: "Weniger anzeigen", when_done: "Danach",
    just_a_timer: "Nur ein Timer", this_card: "Diese Karte", then_action: "danach {action}", run_command: "Befehl",
    put_on_speaker: "Auf einem Lautsprecher starten", choose_speaker: "Lautsprecher wählen", announce_title: "Auf einem Lautsprecher ansagen", announce_desc: "Am Ende etwas auf einem beliebigen Lautsprecher sagen", announce_on: "Ansage auf {speaker}", announce_message: "Was gesagt werden soll (optional)", announce_plain: "Dein Timer ist abgelaufen", announce_named: "{name} ist fertig",
    search_targets: "Lautsprecher oder Räume suchen",
    speakers: "Lautsprecher", phones: "Telefone",
    control_device: "Gerät", command_placeholder: "z. B. Luftreiniger ausschalten", choose_device: "Gerät", choose_action: "Aktion",
    needs_companion: "Installiere die Simple-Timer-Card-Integration, um beim Ablauf Aktionen auszuführen.", timer_start_failed: "Timer konnte nicht gestartet werden: {error}", action_not_supported: "Dieser Timer unterstützt das nicht.", group_other: "Sonstige",
    group_voice: "Sprache", group_pinned: "Angeheftet", group_since: "Seit", group_template: "Vorlage",
    group_sensors: "Sensoren", group_timers: "Timer", since: "vor {t}",
    add_action: "Etwas tun, wenn er abläuft", when_it_ends: "Wenn er abläuft", control_device_title: "Gerät steuern",
    control_device_desc: "Ein- oder ausschalten, öffnen, sperren und mehr", run_command_title: "Befehl sprechen", run_command_desc: "Alles, was du Assist fragen würdest, z. B. „Luftreiniger aus“",
    quick_actions: "Schnellaktionen", search_devices: "Nach Name oder Raum suchen", what_to_do: "Was soll passieren?",
    type_to_search: "Name oder Raum eingeben, um ein Gerät zu finden", back: "Zurück", done: "Fertig",
    close: "Schließen",
  },
  es: {
    no_timers: "Sin Temporizadores",
    timer_name_optional: "Nombre del temporizador (opcional)",
    click_to_start: "Clic para iniciar",
    no_active_timers: "Sin Temporizadores Activos",
    active_timers: "Temporizadores Activos",
    add: "Añadir",
    custom: "Personalizado",
    input_stepper: "Botones",
    input_keypad: "Teclado",
    duration_input: "Introducir duración",
    clear: "Borrar",
    backspace: "Borrar último dígito",
    cancel: "Cancelar",
    save: "Guardar",
    start: "Iniciar",
    snooze: "Posponer",
    dismiss: "Descartar",
    ready: "Listo",
    paused: "Pausado",
    times_up: "¡Se acabó el tiempo!",
    timer: "Temporizador",
    hour_ago: "hace {n} hora",
    hours_ago: "hace {n} horas",
    minute_ago: "hace {n} minuto",
    minutes_ago: "hace {n} minutos",
    second_ago: "hace {n} segundo",
    seconds_ago: "hace {n} segundos",
    h: "h", m: "m", s: "s", d: "d",
    w_short: "sem", mo_short: "mes", y_short: "a",
    day: "día", days: "días", week: "semana", weeks: "semanas",
    month: "mes", months: "meses", year: "año", years: "años",
    hour: "hora", hours: "horas", minute: "minuto", minutes: "minutos",
    second: "segundo", seconds: "segundos",
    more_timers: "+{n} más", show_less: "Mostrar menos", when_done: "Al terminar",
    just_a_timer: "Solo un temporizador", this_card: "Esta tarjeta", then_action: "después {action}", run_command: "Comando",
    put_on_speaker: "Poner en un altavoz", choose_speaker: "Elige un altavoz", announce_title: "Anunciar en un altavoz", announce_desc: "Decir algo en cualquier altavoz al terminar", announce_on: "Anunciar en {speaker}", announce_message: "Qué decir (opcional)", announce_plain: "Tu temporizador ha terminado", announce_named: "{name} ha terminado",
    search_targets: "Buscar altavoces o habitaciones",
    speakers: "Altavoces", phones: "Teléfonos",
    control_device: "Dispositivo", command_placeholder: "p. ej. apaga el purificador", choose_device: "Dispositivo", choose_action: "Acción",
    needs_companion: "Instala la integración Simple Timer Card para ejecutar acciones al terminar los temporizadores.", timer_start_failed: "No se pudo iniciar el temporizador: {error}", action_not_supported: "Este temporizador no admite esa acción.", group_other: "Otros",
    group_voice: "Voz", group_pinned: "Fijados", group_since: "Desde", group_template: "Plantilla",
    group_sensors: "Sensores", group_timers: "Temporizadores", since: "hace {t}",
    add_action: "Hacer algo al terminar", when_it_ends: "Al terminar", control_device_title: "Controlar un dispositivo",
    control_device_desc: "Encender o apagar, abrir, bloquear y más", run_command_title: "Decir un comando", run_command_desc: "Lo que le pedirías a Assist, p. ej. «apaga el purificador»",
    quick_actions: "Acciones rápidas", search_devices: "Buscar por nombre o habitación", what_to_do: "¿Qué debe hacer?",
    type_to_search: "Escribe un nombre o una habitación para encontrar un dispositivo", back: "Atrás", done: "Listo",
    close: "Cerrar",
  },
  da: {
    no_timers: "Ingen timere",
    timer_name_optional: "Timernavn (valgfrit)",
    click_to_start: "Tryk for at starte",
    no_active_timers: "Ingen aktive timere",
    active_timers: "Aktive Timere",
    add: "Tilføj",
    custom: "Tilpasset",
    input_stepper: "Knapper",
    input_keypad: "Taltastatur",
    duration_input: "Indtast varighed",
    clear: "Ryd",
    backspace: "Slet sidste ciffer",
    cancel: "Annuller",
    save: "Gem",
    start: "Start",
    snooze: "Snooze",
    dismiss: "Afvis",
    ready: "Klar",
    paused: "På pause",
    times_up: "Tid udløbet!",
    timer: "Timer",
    hour_ago: "for {n} time siden",
    hours_ago: "for {n} timer siden",
    minute_ago: "for {n} minut siden",
    minutes_ago: "for {n} minutter siden",
    second_ago: "for {n} sekund siden",
    seconds_ago: "for {n} sekunder siden",
    h: "t", m: "m", s: "s", d: "d",
    w_short: "u", mo_short: "må", y_short: "å",
    day: "dag", days: "dage", week: "uge", weeks: "uger",
    month: "måned", months: "måneder", year: "år", years: "år",
    hour: "time", hours: "timer", minute: "minut", minutes: "minutter",
    second: "sekund", seconds: "sekunder",
    more_timers: "+{n} mere", show_less: "Vis mindre", when_done: "Når den er færdig",
    just_a_timer: "Kun en timer", this_card: "Dette kort", then_action: "derefter {action}", run_command: "Kommando",
    put_on_speaker: "Sæt på en højttaler", choose_speaker: "Vælg en højttaler", announce_title: "Annoncér på en højttaler", announce_desc: "Sig noget på en vilkårlig højttaler, når den er færdig", announce_on: "Annoncér på {speaker}", announce_message: "Hvad der skal siges (valgfrit)", announce_plain: "Din timer er færdig", announce_named: "{name} er færdig",
    search_targets: "Søg efter højttalere eller rum",
    speakers: "Højttalere", phones: "Telefoner",
    control_device: "Enhed", command_placeholder: "f.eks. sluk luftrenseren", choose_device: "Enhed", choose_action: "Handling",
    needs_companion: "Installer Simple Timer Card-integrationen for at udføre handlinger, når timere slutter.", timer_start_failed: "Kunne ikke starte timeren: {error}", action_not_supported: "Denne timer understøtter ikke det.", group_other: "Andet",
    group_voice: "Stemme", group_pinned: "Fastgjort", group_since: "Siden", group_template: "Skabelon",
    group_sensors: "Sensorer", group_timers: "Timere", since: "for {t} siden",
    add_action: "Gør noget, når den slutter", when_it_ends: "Når den slutter", control_device_title: "Styr en enhed",
    control_device_desc: "Tænd eller sluk, åbn, lås og mere", run_command_title: "Sig en kommando", run_command_desc: "Alt, du ville bede Assist om, f.eks. \"sluk luftrenseren\"",
    quick_actions: "Hurtige handlinger", search_devices: "Søg efter navn eller rum", what_to_do: "Hvad skal der ske?",
    type_to_search: "Skriv et navn eller rum for at finde en enhed", back: "Tilbage", done: "Færdig",
    close: "Luk",
  },
  it: {
    no_timers: "Nessun timer",
    timer_name_optional: "Nome timer (facoltativo)",
    click_to_start: "Clicca per avviare",
    no_active_timers: "Nessun timer attivo",
    active_timers: "Timer attivi",
    add: "Aggiungi",
    custom: "Personalizzato",
    input_stepper: "Pulsanti",
    input_keypad: "Tastierino",
    duration_input: "Inserisci durata",
    clear: "Svuota",
    backspace: "Elimina ultima cifra",
    cancel: "Annulla",
    save: "Salva",
    start: "Avvia",
    snooze: "Rimanda",
    dismiss: "Ignora",
    ready: "Pronto",
    paused: "In pausa",
    times_up: "Tempo finito!",
    timer: "Timer",
    hour_ago: "{n} ora fa",
    hours_ago: "{n} ore fa",
    minute_ago: "{n} minuto fa",
    minutes_ago: "{n} minuti fa",
    second_ago: "{n} secondo fa",
    seconds_ago: "{n} secondi fa",
    h: "h", m: "m", s: "s", d: "g",
    w_short: "set", mo_short: "me", y_short: "a",
    day: "giorno", days: "giorni", week: "settimana", weeks: "settimane",
    month: "mese", months: "mesi", year: "anno", years: "anni",
    hour: "ora", hours: "ore", minute: "minuto", minutes: "minuti",
    second: "secondo", seconds: "secondi",
    more_timers: "+{n} altri", show_less: "Mostra meno", when_done: "Al termine",
    just_a_timer: "Solo un timer", this_card: "Questa scheda", then_action: "poi {action}", run_command: "Comando",
    put_on_speaker: "Metti su un altoparlante", choose_speaker: "Scegli un altoparlante", announce_title: "Annuncia su un altoparlante", announce_desc: "Dì qualcosa su qualsiasi altoparlante al termine", announce_on: "Annuncia su {speaker}", announce_message: "Cosa dire (facoltativo)", announce_plain: "Il timer è terminato", announce_named: "{name} è terminato",
    search_targets: "Cerca altoparlanti o stanze",
    speakers: "Altoparlanti", phones: "Telefoni",
    control_device: "Dispositivo", command_placeholder: "es. spegni il purificatore", choose_device: "Dispositivo", choose_action: "Azione",
    needs_companion: "Installa l'integrazione Simple Timer Card per eseguire azioni allo scadere dei timer.", timer_start_failed: "Impossibile avviare il timer: {error}", action_not_supported: "Questo timer non lo supporta.", group_other: "Altro",
    group_voice: "Voce", group_pinned: "Fissati", group_since: "Da", group_template: "Modello",
    group_sensors: "Sensori", group_timers: "Timer", since: "{t} fa",
    add_action: "Fai qualcosa alla fine", when_it_ends: "Alla fine", control_device_title: "Controlla un dispositivo",
    control_device_desc: "Accendi o spegni, apri, blocca e altro", run_command_title: "Dì un comando", run_command_desc: "Qualsiasi cosa chiederesti ad Assist, es. \"spegni il purificatore\"",
    quick_actions: "Azioni rapide", search_devices: "Cerca per nome o stanza", what_to_do: "Cosa deve fare?",
    type_to_search: "Scrivi un nome o una stanza per trovare un dispositivo", back: "Indietro", done: "Fatto",
    close: "Chiudi",
  },
  fr: {
    no_timers: "Aucun minuteur",
    timer_name_optional: "Nom du minuteur (facultatif)",
    click_to_start: "Cliquez pour démarrer",
    no_active_timers: "Aucun minuteur actif",
    active_timers: "Minuteurs actifs",
    add: "Ajouter",
    custom: "Personnalisé",
    input_stepper: "Boutons",
    input_keypad: "Clavier",
    duration_input: "Saisir la durée",
    clear: "Effacer",
    backspace: "Effacer le dernier chiffre",
    cancel: "Annuler",
    save: "Sauvegarder",
    start: "Démarrer",
    snooze: "Répéter",
    dismiss: "Rejeter",
    ready: "Prêt",
    paused: "En pause",
    times_up: "Le temps est écoulé !",
    timer: "Minuteur",
    hour_ago: "il y a {n} heure",
    hours_ago: "il y a {n} heures",
    minute_ago: "il y a {n} minute",
    minutes_ago: "il y a {n} minutes",
    second_ago: "il y a {n} seconde",
    seconds_ago: "il y a {n} secondes",
    h: "h", m: "m", s: "s", d: "j",
    w_short: "sem", mo_short: "mo", y_short: "a",
    day: "jour", days: "jours", week: "semaine", weeks: "semaines",
    month: "mois", months: "mois", year: "année", years: "années",
    hour: "heure", hours: "heures", minute: "minute", minutes: "minutes",
    second: "seconde", seconds: "secondes",
    more_timers: "+{n} de plus", show_less: "Afficher moins", when_done: "À la fin",
    just_a_timer: "Juste un minuteur", this_card: "Cette carte", then_action: "puis {action}", run_command: "Commande",
    put_on_speaker: "Mettre sur une enceinte", choose_speaker: "Choisir une enceinte", announce_title: "Annoncer sur une enceinte", announce_desc: "Dire quelque chose sur n'importe quelle enceinte à la fin", announce_on: "Annoncer sur {speaker}", announce_message: "Quoi dire (facultatif)", announce_plain: "Votre minuteur est terminé", announce_named: "{name} est terminé",
    search_targets: "Rechercher des enceintes ou des pièces",
    speakers: "Enceintes", phones: "Téléphones",
    control_device: "Appareil", command_placeholder: "ex. éteins le purificateur", choose_device: "Appareil", choose_action: "Action",
    needs_companion: "Installez l'intégration Simple Timer Card pour lancer des actions à la fin des minuteurs.", timer_start_failed: "Impossible de démarrer le minuteur : {error}", action_not_supported: "Ce minuteur ne le permet pas.", group_other: "Autres",
    group_voice: "Voix", group_pinned: "Épinglés", group_since: "Depuis", group_template: "Modèle",
    group_sensors: "Capteurs", group_timers: "Minuteurs", since: "il y a {t}",
    add_action: "Faire quelque chose à la fin", when_it_ends: "À la fin", control_device_title: "Contrôler un appareil",
    control_device_desc: "Allumer ou éteindre, ouvrir, verrouiller et plus", run_command_title: "Dire une commande", run_command_desc: "Tout ce que vous demanderiez à Assist, ex. « éteins le purificateur »",
    quick_actions: "Actions rapides", search_devices: "Rechercher par nom ou pièce", what_to_do: "Que doit-il se passer ?",
    type_to_search: "Saisissez un nom ou une pièce pour trouver un appareil", back: "Retour", done: "Terminé",
    close: "Fermer",
  },
  he: {
    no_timers: "אין טיימרים",
    timer_name_optional: "שם הטיימר (אופציונלי)",
    click_to_start: "לחץ להתחלה",
    no_active_timers: "אין טיימרים פעילים",
    active_timers: "טיימרים פעילים",
    add: "הוסף",
    custom: "מותאם אישית",
    input_stepper: "כפתורים",
    input_keypad: "לוח מקשים",
    duration_input: "הזנת משך זמן",
    clear: "ניקוי",
    backspace: "מחיקת הספרה האחרונה",
    cancel: "ביטול",
    save: "שמור",
    start: "התחל",
    snooze: "נודניק",
    dismiss: "סגור",
    ready: "מוכן",
    paused: "מושהה",
    times_up: "הזמן נגמר!",
    timer: "טיימר",
    hour_ago: "לפני {n} שעה",
    hours_ago: "לפני {n} שעות",
    minute_ago: "לפני {n} דקה",
    minutes_ago: "לפני {n} דקות",
    second_ago: "לפני {n} שנייה",
    seconds_ago: "לפני {n} שניות",
    h: "ש׳", m: "דק׳", s: "שנ׳", d: "י׳",
    w_short: "שב׳", mo_short: "חו׳", y_short: "שנה",
    day: "יום", days: "ימים", week: "שבוע", weeks: "שבועות",
    month: "חודש", months: "חודשים", year: "שנה", years: "שנים",
    hour: "שעה", hours: "שעות", minute: "דקה", minutes: "דקות",
    second: "שנייה", seconds: "שניות",
    more_timers: "+{n} נוספים", show_less: "הצג פחות", when_done: "בסיום",
    just_a_timer: "טיימר בלבד", this_card: "הכרטיס הזה", then_action: "ואז {action}", run_command: "פקודה",
    put_on_speaker: "הפעלה על רמקול", choose_speaker: "בחירת רמקול", announce_title: "הכרזה ברמקול", announce_desc: "להשמיע משהו בכל רמקול בסיום", announce_on: "הכרזה ב{speaker}", announce_message: "מה להגיד (לא חובה)", announce_plain: "הטיימר הסתיים", announce_named: "{name} הסתיים",
    search_targets: "חיפוש רמקולים או חדרים",
    speakers: "רמקולים", phones: "טלפונים",
    control_device: "מכשיר", command_placeholder: "למשל: כבה את מטהר האוויר", choose_device: "מכשיר", choose_action: "פעולה",
    needs_companion: "כדי להפעיל פעולות בסיום טיימר יש להתקין את האינטגרציה Simple Timer Card.", timer_start_failed: "לא ניתן להפעיל את הטיימר: {error}", action_not_supported: "הטיימר הזה לא תומך בזה.", group_other: "אחר",
    group_voice: "קולי", group_pinned: "מוצמדים", group_since: "מאז", group_template: "תבנית",
    group_sensors: "חיישנים", group_timers: "טיימרים", since: "לפני {t}",
    add_action: "לעשות משהו בסיום", when_it_ends: "בסיום", control_device_title: "שליטה במכשיר",
    control_device_desc: "הדלקה או כיבוי, פתיחה, נעילה ועוד", run_command_title: "אמירת פקודה", run_command_desc: "כל מה שהיית מבקש מ-Assist, למשל \"כבה את מטהר האוויר\"",
    quick_actions: "פעולות מהירות", search_devices: "חיפוש לפי שם או חדר", what_to_do: "מה לעשות?",
    type_to_search: "יש להקליד שם או חדר כדי למצוא מכשיר", back: "חזרה", done: "סיום",
    close: "סגירה",
  },
  pl: {
    no_timers: "Brak minutników",
    timer_name_optional: "Nazwa minutnika (opcjonalnie)",
    click_to_start: "Kliknij, aby uruchomić",
    no_active_timers: "Brak aktywnych minutników",
    active_timers: "Aktywne minutniki",
    add: "Dodaj",
    custom: "Niestandardowy",
    input_stepper: "Przyciski",
    input_keypad: "Klawiatura",
    duration_input: "Wprowadź czas",
    clear: "Wyczyść",
    backspace: "Usuń ostatnią cyfrę",
    cancel: "Anuluj",
    save: "Zapisz",
    start: "Uruchom",
    snooze: "Drzemka",
    dismiss: "Odrzuć",
    ready: "Gotowy",
    paused: "Wstrzymany",
    times_up: "Czas minął!",
    timer: "Minutnik",
    hour_ago: "{n} godzinę temu",
    hours_ago: "{n} godzin temu",
    minute_ago: "{n} minutę temu",
    minutes_ago: "{n} minut temu",
    second_ago: "{n} sekundę temu",
    seconds_ago: "{n} sekund temu",
    h: "h", m: "m", s: "s", d: "d",
    w_short: "tyg", mo_short: "mies", y_short: "r",
    day: "dzień", days: "dni", week: "tydzień", weeks: "tygodni",
    month: "miesiąc", months: "miesięcy", year: "rok", years: "lat",
    hour: "godzina", hours: "godzin", minute: "minuta", minutes: "minut",
    second: "sekunda", seconds: "sekund",
    more_timers: "+{n} więcej", show_less: "Pokaż mniej", when_done: "Po zakończeniu",
    just_a_timer: "Tylko minutnik", this_card: "Ta karta", then_action: "potem {action}", run_command: "Polecenie",
    put_on_speaker: "Uruchom na głośniku", choose_speaker: "Wybierz głośnik", announce_title: "Ogłoś na głośniku", announce_desc: "Powiedz coś na dowolnym głośniku po zakończeniu", announce_on: "Ogłoś na {speaker}", announce_message: "Co powiedzieć (opcjonalnie)", announce_plain: "Twój minutnik się skończył", announce_named: "{name} – koniec",
    search_targets: "Szukaj głośników lub pomieszczeń",
    speakers: "Głośniki", phones: "Telefony",
    control_device: "Urządzenie", command_placeholder: "np. wyłącz oczyszczacz", choose_device: "Urządzenie", choose_action: "Akcja",
    needs_companion: "Zainstaluj integrację Simple Timer Card, aby uruchamiać akcje po zakończeniu minutników.", timer_start_failed: "Nie udało się uruchomić minutnika: {error}", action_not_supported: "Ten minutnik tego nie obsługuje.", group_other: "Inne",
    group_voice: "Głos", group_pinned: "Przypięte", group_since: "Od", group_template: "Szablon",
    group_sensors: "Czujniki", group_timers: "Minutniki", since: "{t} temu",
    add_action: "Zrób coś po zakończeniu", when_it_ends: "Po zakończeniu", control_device_title: "Steruj urządzeniem",
    control_device_desc: "Włącz lub wyłącz, otwórz, zablokuj i więcej", run_command_title: "Powiedz polecenie", run_command_desc: "Wszystko, o co poprosiłbyś Assist, np. „wyłącz oczyszczacz”",
    quick_actions: "Szybkie akcje", search_devices: "Szukaj po nazwie lub pokoju", what_to_do: "Co ma się stać?",
    type_to_search: "Wpisz nazwę lub pokój, aby znaleźć urządzenie", back: "Wstecz", done: "Gotowe",
    close: "Zamknij",
  },
  nl: {
    no_timers: "Geen timers",
    timer_name_optional: "Timer naam (optioneel)",
    click_to_start: "Klik om te starten",
    no_active_timers: "Geen actieve timers",
    active_timers: "Actieve timers",
    add: "Toevoegen",
    custom: "Aangepast",
    input_stepper: "Knoppen",
    input_keypad: "Toetsenblok",
    duration_input: "Tijdsduur invoeren",
    clear: "Wissen",
    backspace: "Laatste cijfer verwijderen",
    cancel: "Annuleren",
    save: "Opslaan",
    start: "Starten",
    snooze: "Snoozen",
    dismiss: "Sluiten",
    ready: "Klaar",
    paused: "Gepauzeerd",
    times_up: "Tijd is om!",
    timer: "Timer",
    hour_ago: "{n} uur geleden",
    hours_ago: "{n} uur geleden",
    minute_ago: "{n} minuut geleden",
    minutes_ago: "{n} minuten geleden",
    second_ago: "{n} seconde geleden",
    seconds_ago: "{n} seconden geleden",
    h: "u", m: "m", s: "s", d: "d",
    w_short: "w", mo_short: "mnd", y_short: "j",
    day: "dag", days: "dagen", week: "week", weeks: "weken",
    month: "maand", months: "maanden", year: "jaar", years: "jaren",
    hour: "uur", hours: "uren", minute: "minuut", minutes: "minuten",
    second: "seconde", seconds: "seconden",
    more_timers: "+{n} meer", show_less: "Minder tonen", when_done: "Als klaar",
    just_a_timer: "Alleen een timer", this_card: "Deze kaart", then_action: "daarna {action}", run_command: "Opdracht",
    put_on_speaker: "Op een speaker zetten", choose_speaker: "Kies een speaker", announce_title: "Omroepen op een speaker", announce_desc: "Zeg iets op een speaker als hij klaar is", announce_on: "Omroepen op {speaker}", announce_message: "Wat er gezegd moet worden (optioneel)", announce_plain: "Je timer is klaar", announce_named: "{name} is klaar",
    search_targets: "Zoek speakers of ruimtes",
    speakers: "Speakers", phones: "Telefoons",
    control_device: "Apparaat", command_placeholder: "bijv. zet de luchtreiniger uit", choose_device: "Apparaat", choose_action: "Actie",
    needs_companion: "Installeer de Simple Timer Card-integratie om acties uit te voeren als timers aflopen.", timer_start_failed: "Kan de timer niet starten: {error}", action_not_supported: "Deze timer ondersteunt dat niet.", group_other: "Overig",
    group_voice: "Spraak", group_pinned: "Vastgezet", group_since: "Sinds", group_template: "Sjabloon",
    group_sensors: "Sensoren", group_timers: "Timers", since: "{t} geleden",
    add_action: "Iets doen als hij afloopt", when_it_ends: "Als hij afloopt", control_device_title: "Een apparaat bedienen",
    control_device_desc: "Aan of uit, openen, vergrendelen en meer", run_command_title: "Een opdracht zeggen", run_command_desc: "Alles wat je aan Assist zou vragen, bijv. \"zet de luchtreiniger uit\"",
    quick_actions: "Snelle acties", search_devices: "Zoeken op naam of ruimte", what_to_do: "Wat moet er gebeuren?",
    type_to_search: "Typ een naam of ruimte om een apparaat te vinden", back: "Terug", done: "Klaar",
    close: "Sluiten",
  },
  sv: {
    no_timers: "Ingen timer",
    timer_name_optional: "Namn på timer (frivilligt)",
    click_to_start: "Tryck för att starta",
    no_active_timers: "Ingen pågående timer",
    active_timers: "Pågående timers",
    add: "Lägg till",
    custom: "Anpassa",
    input_stepper: "Knappar",
    input_keypad: "Knappsats",
    duration_input: "Ange varaktighet",
    clear: "Rensa",
    backspace: "Ta bort sista siffran",
    cancel: "Avbryt",
    save: "Spara",
    start: "Start",
    snooze: "Snooze",
    dismiss: "Avfärda",
    ready: "Redo",
    paused: "Pausad",
    times_up: "Tiden är ute!",
    timer: "Timer",
    hour_ago: "{n} timme sedan",
    hours_ago: "{n} timmar sedan",
    minute_ago: "{n} minut sedan",
    minutes_ago: "{n} minuter sedan",
    second_ago: "{n} sekund sedan",
    seconds_ago: "{n} sekunder sedan",
    h: "t", m: "m", s: "s", d: "d",
    w_short: "v", mo_short: "må", y_short: "å",
    day: "dag", days: "dagar", week: "vecka", weeks: "veckor",
    month: "månad", months: "månader", year: "år", years: "år",
    hour: "timme", hours: "timmar", minute: "minut", minutes: "minuter",
    second: "sekund", seconds: "sekunder",
    more_timers: "+{n} till", show_less: "Visa mindre", when_done: "När klar",
    just_a_timer: "Bara en timer", this_card: "Det här kortet", then_action: "sedan {action}", run_command: "Kommando",
    put_on_speaker: "Lägg på en högtalare", choose_speaker: "Välj en högtalare", announce_title: "Meddela på en högtalare", announce_desc: "Säg något på valfri högtalare när den är klar", announce_on: "Meddela på {speaker}", announce_message: "Vad som ska sägas (valfritt)", announce_plain: "Din timer är klar", announce_named: "{name} är klar",
    search_targets: "Sök högtalare eller rum",
    speakers: "Högtalare", phones: "Telefoner",
    control_device: "Enhet", command_placeholder: "t.ex. stäng av luftrenaren", choose_device: "Enhet", choose_action: "Åtgärd",
    needs_companion: "Installera integrationen Simple Timer Card för att köra åtgärder när timrar tar slut.", timer_start_failed: "Kunde inte starta timern: {error}", action_not_supported: "Den här timern stöder inte det.", group_other: "Övrigt",
    group_voice: "Röst", group_pinned: "Fästa", group_since: "Sedan", group_template: "Mall",
    group_sensors: "Sensorer", group_timers: "Timrar", since: "för {t} sedan",
    add_action: "Gör något när den är klar", when_it_ends: "När den är klar", control_device_title: "Styr en enhet",
    control_device_desc: "Slå på eller av, öppna, lås och mer", run_command_title: "Säg ett kommando", run_command_desc: "Allt du skulle be Assist om, t.ex. \"stäng av luftrenaren\"",
    quick_actions: "Snabbåtgärder", search_devices: "Sök på namn eller rum", what_to_do: "Vad ska hända?",
    type_to_search: "Skriv ett namn eller rum för att hitta en enhet", back: "Tillbaka", done: "Klar",
    close: "Stäng",
  }
};

console.info(
  `%c SIMPLE-TIMER-CARD %c v${cardVersion} `,
  "color: white; background: #4285f4; font-weight: 700;",
  "color: #4285f4; background: white; font-weight: 700;"
);

class SimpleTimerCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: {},
      _timers: { state: true },
      _ui: { state: true },
      _customSecs: { state: true },
      _activeSecs: { state: true },
      _timerInputMode: { state: true },
      _keypadDigits: { state: true },
      _editingTimerId: { state: true },
      _editDuration: { state: true },
      _targetChoice: { state: true },
      _actionDraft: { state: true },
      _actionWizard: { state: true },
    };
  }

  // New cards use the companion integration when it is installed, so their
  // timers keep running and can act with every dashboard closed. Existing
  // cards keep the storage they were saved with.
  static getStubConfig(hass) {
    const config = { type: "custom:simple-timer-card" };
    const states = hass?.states || {};
    const hasCompanion = Object.keys(states).some((id) => id.startsWith("sensor.") && states[id]?.attributes?.simple_timer_card_api != null);
    if (hasCompanion) config.storage = "integration";
    return config;
  }

  _sanitizeText(text) {
    if (!text || typeof text !== "string") return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.textContent;
  }

  _localize(key) {
    const raw = this._config?.language || this.hass?.language || "en";
    const lang = String(raw).toLowerCase().split(/[-_]/)[0];
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS["en"][key] || key;
  }

  _isRTL() {
    const raw = this._config?.language || this.hass?.language || "en";
    const lang = String(raw).toLowerCase().split(/[-_]/)[0];
    return lang === "he" || lang === "ar" || lang === "fa" || lang === "ur";
  }

  _validateAudioUrl(url) {
    if (!url || typeof url !== "string") return false;
    try {
      const parsed = new URL(url, window.location.origin);
      return ["https:", "http:", "file:"].includes(parsed.protocol) || url.startsWith("/local/") || url.startsWith("/hacsfiles/");
    } catch {
      return false;
    }
  }

  _validateStoredTimerData(data) {
    if (!data || typeof data !== "object") return false;
    if (!Array.isArray(data.timers)) return false;
    for (const timer of data.timers) {
      if (!timer || typeof timer !== "object") return false;
      if (!timer.id || typeof timer.id !== "string") return false;
      if (timer.label != null && typeof timer.label !== "string") return false;
      if (timer.duration != null && typeof timer.duration !== "number") return false;

      if (timer.start_ts != null && typeof timer.start_ts !== "number") return false;
      if (timer.end_ts != null && typeof timer.end_ts !== "number") return false;
      if (timer.remaining_ms != null && typeof timer.remaining_ms !== "number") return false;
      if (timer.start != null && typeof timer.start !== "number" && typeof timer.start !== "string") return false;
      if (timer.end != null && typeof timer.end !== "number") return false;
    }
    return true;
  }

  _validateTimerInput(duration, label) {
    const MAX_DURATION_MS = 24 * 60 * 60 * 1000 * 365;
    const MAX_LABEL_LENGTH = 100;
    if (duration && (typeof duration !== "number" || duration <= 0 || duration > MAX_DURATION_MS)) return { valid: false, error: "Invalid duration" };
    if (label && (typeof label !== "string" || label.length > MAX_LABEL_LENGTH)) return { valid: false, error: "Invalid label" };
    return { valid: true };
  }

  constructor() {
    super();
    this._timers = [];
    this._timerInterval = null;
    this._dismissed = new Set();
    this._ringingTimers = new Set();
    this._activeAudioInstances = new Map();
    this._lastActionTime = new Map();
    this._expirationTimes = new Map();
    this._lastCleanupTime = 0;
    this._mqttShadow = null;
    this._mqttLastLoadSource = "none";
    this._lastTickTs = Date.now();
    this._mqttAwaitingFresh = false;
    this._mqttReconnectedAt = 0;
    this._mqttWakeBaseline = 0;
    this._mqttPublishQueue = Promise.resolve();
    this._mqttPublishContext = null;
    this._mqttPublishBlocked = false;
    this._mqttPublishErrors = new Set();
    this._ui = {
      noTimerHorizontalOpen: false,
      noTimerVerticalOpen: false,
      activeFillOpen: false,
      activeBarOpen: false,
    };
    this._customSecs = { horizontal: 15 * 60, vertical: 15 * 60 };
    this._activeSecs = { fill: 10 * 60, bar: 10 * 60 };
    this._timerInputMode = "stepper";
    this._keypadDigits = {};
    this._initializedDurationInputs = new Set();
    this._showingCustomName = {};
    this._lastSelectedName = {};
    this._storageNamespace = "default";
    this._editingTimerId = null;
    this._editDuration = { h: 0, m: 0, s: 0 };
    this._audioUnlocked = false;
    this._unlockAudioHandler = this._unlockAudio.bind(this);
    this._timerLists = new Map();
    this._timerListMeta = this._loadTimerListMeta();
    this._timerListConn = null;
    this._onTimerListConnectionReady = () => this._resetTimerListSubscriptions();
  }

  _isActionThrottled(actionType, timerId = "global", throttleMs = 1000) {
    const key = `${actionType}-${timerId}`;
    const now = Date.now();
    const lastTime = this._lastActionTime.get(key) || 0;
    if (now - lastTime < throttleMs) return true;
    this._lastActionTime.set(key, now);
    return false;
  }
  _normalizeStringList(value, fallback = []) {
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    if (typeof value === "string") return value.split(",").map(v => v.trim()).filter(Boolean);
    return fallback;
  }

  _normalizeNumberList(value, fallback = []) {
    if (Array.isArray(value)) {
      return value.map(v => (typeof v === "number" ? v : parseFloat(String(v).trim()))).filter(v => Number.isFinite(v));
    }
    if (typeof value === "string") {
      return value.split(",").map(v => parseFloat(v.trim())).filter(v => Number.isFinite(v));
    }
    if (typeof value === "number" && Number.isFinite(value)) return [value];
    return fallback;
  }

  _normalizePresetList(value) {
    const raw = Array.isArray(value) ? value : (typeof value === "string" ? value.split(",") : (typeof value === "number" ? [value] : []));
    const out = [];
    for (const item of raw) {
      if (item === null || item === undefined) continue;
      if (typeof item === "number" && Number.isFinite(item)) { out.push(item); continue; }
      const s = String(item).trim();
      if (!s) continue;
      const n = Number(s);
      if (Number.isFinite(n) && /^-?\d+(?:\.\d+)?$/.test(s)) out.push(n);
      else out.push(s);
    }
    return out;
  }

  _normalizeConfigTypes(cfg) {
    const c = { ...(cfg || {}) };

    if (typeof c.entities === "string") c.entities = [c.entities];
    if (!Array.isArray(c.entities)) c.entities = [];

    c.timer_name_presets = this._normalizeStringList(c.timer_name_presets, Array.isArray(c.timer_name_presets) ? c.timer_name_presets : []);
    c.timer_presets = this._normalizePresetList(c.timer_presets);
    c.minute_buttons = this._normalizePresetList(c.minute_buttons);
    c.time_format_units = this._normalizeStringList(c.time_format_units, Array.isArray(c.time_format_units) ? c.time_format_units : []);
    if (!Array.isArray(c.pinned_timers)) c.pinned_timers = [];
	delete c.alexa_audio_enabled;
    delete c.alexa_audio_file_url;
    delete c.alexa_audio_repeat_count;
    delete c.alexa_audio_play_until_dismissed;
	return c;
  }

  setConfig(config) {
    config = this._normalizeConfigTypes(config);
    const compat = (config.compatibility_mode || config.compat_mode || "2.1.1");
    config.compatibility_mode = compat;
    const requestedStorage = (config.storage || "").toLowerCase();
    // The companion integration is a sensor too, but never MQTT storage.
    const companionTarget = typeof config.default_timer_entity === "string" &&
      (config.default_timer_entity.startsWith("sensor.simple_timer_card_timers") ||
        this.hass?.states?.[config.default_timer_entity]?.attributes?.simple_timer_card_api != null);
    const legacyMqttSensorEntity =
      typeof config.default_timer_entity === "string" &&
      config.default_timer_entity.startsWith("sensor.") && !companionTarget;
    const hasExplicitMqttConfig = !!(
      config.mqtt &&
      (config.mqtt.topic || config.mqtt.sensor_entity || config.mqtt.state_topic || config.mqtt.events_topic || config.mqtt.publish_automation)
    );
    const legacyWantsMqtt =
      legacyMqttSensorEntity &&
      !requestedStorage &&
      !(config.mqtt && config.mqtt.sensor_entity) &&
      !hasExplicitMqttConfig;
    const isMqtt = requestedStorage === "mqtt" || hasExplicitMqttConfig || legacyWantsMqtt;
    const autoStorage =
      requestedStorage === "local" || requestedStorage === "mqtt" || requestedStorage === "integration"
        ? requestedStorage
        : (isMqtt ? "mqtt" : "local");
    const mqttConfig = {
      topic: "simple_timer_card/timers",
      state_topic: "simple_timer_card/timers/state",
      events_topic: "simple_timer_card/events",
      sensor_entity: legacyMqttSensorEntity ? config.default_timer_entity : null,
      ...config.mqtt,
    };
    if (mqttConfig.publish_automation != null && mqttConfig.publish_automation !== "" &&
        (typeof mqttConfig.publish_automation !== "string" || !/^automation\.[a-z0-9_]+$/.test(mqttConfig.publish_automation))) {
      throw new Error("mqtt.publish_automation must be an automation entity ID.");
    }
    const layout = (config.layout || "horizontal").toLowerCase() === "vertical" ? "vertical" : "horizontal";
    const validStyles = CARD_STYLES;
    const style = _normalizeCardStyle(config.style);
    const progressModeOptions = ["drain", "fill", "milestones"];
    const progressMode = progressModeOptions.includes(config.progress_mode) ? config.progress_mode : "drain";
    const firstEntityFromList = Array.isArray(config.entities) && config.entities.length
      ? (typeof config.entities[0] === "string" ? config.entities[0] : config.entities[0]?.entity)
      : null;
    this._storageNamespace =
      config.storage_namespace ||
      config.default_timer_entity ||
      firstEntityFromList ||
      `auto-${_stableConfigHash(config)}`;
    _pruneLegacyInstanceNamespaces();
    const defaultUnits = ["days", "hours", "minutes", "seconds"];
    let timeUnits = defaultUnits;
    if (Array.isArray(config.time_format_units)) {
      timeUnits = config.time_format_units.map((u) => String(u).toLowerCase()).filter((u) => ["years","months","weeks","days","hours","minutes","seconds"].includes(u));
      if (timeUnits.length === 0) timeUnits = defaultUnits;
    } else if (typeof config.time_format_units === "string") {
      timeUnits = config.time_format_units.split(",").map((u) => u.trim().toLowerCase()).filter((u) => ["years","months","weeks","days","hours","minutes","seconds"].includes(u));
      if (timeUnits.length === 0) timeUnits = defaultUnits;
    }
    this._config = {
      layout,
      style,
      snooze_duration: 5,
      timer_presets: [5, 15, 30],
      timer_name_presets: [],
      pinned_timers: [],
      pinned_timers_position: "inline",
      sort_by: "time_left",
      sort_order: "asc",
      show_timer_presets: true,
      show_active_header: true,
      minute_buttons: [1, 5, 10],
      pinned_timers_position: "inline",
      sort_by: "time_left",
      sort_order: "asc",
      default_timer_icon: "mdi:timer-outline",
      default_timer_color: "var(--primary-color)",
      default_timer_entity: null,
      auto_voice_pe: false,
      auto_discover_alexa: false,
      auto_discover_google: false,
      auto_discover_timer_lists: false,
      source_styles: {},
      expire_action: "keep",
      expire_keep_for: 120,
      auto_dismiss_writable: false,
      audio_enabled: false,
      audio_file_url: "",
      audio_repeat_count: 1,
      audio_play_until_dismissed: false,
      audio_completion_delay: 4,
	  expired_subtitle: null,
      keep_timer_visible_when_idle: false,
      progress_mode: progressMode,
      default_new_timer_duration_mins: 15,
      time_format: "hms",
      time_format_units: timeUnits,
      milestone_unit: "auto",
      milestone_pulse: true,
      ...config,
      entities: config.entities || [],
      storage: autoStorage,
      layout,
      style,
      mqtt: mqttConfig,
      time_format_units: timeUnits,
      custom_timer_input: normalizeTimerInput(config.custom_timer_input),
      show_timer_input_selector: config.show_timer_input_selector === true,
    };
    this._timerInputMode = this._config.custom_timer_input;
    // hui-card detaches hidden cards unless they ask to stay connected, which
    // would stop the tick that brings the card back when a timer starts.
    this.connectedWhileHidden = this._config.hide_when_empty === true;
    this._keypadDigits = {};
    this._initializedDurationInputs.clear();
    const defaultDurationSecs = this._defaultCustomTimerSeconds();
    this._customSecs = { horizontal: defaultDurationSecs, vertical: defaultDurationSecs };
    this._activeSecs = { fill: defaultDurationSecs, bar: defaultDurationSecs };
    this._config.source_styles = this._normalizeSourceStyles(this._config.source_styles);
    if (typeof this._config.timer_name_presets === "string") {
      this._config.timer_name_presets = this._config.timer_name_presets.split(",").map((name) => name.trim()).filter((name) => name);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this._startTimerUpdates();
    this.addEventListener("pointerdown", this._unlockAudioHandler, { capture: true, passive: true });
    this.addEventListener("touchend", this._unlockAudioHandler, { capture: true, passive: true });
    this.addEventListener("click", this._unlockAudioHandler, { capture: true, passive: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopTimerUpdates();
    this._teardownTimerLists();
    this.removeEventListener("pointerdown", this._unlockAudioHandler, { capture: true });
    this.removeEventListener("touchend", this._unlockAudioHandler, { capture: true });
    this.removeEventListener("click", this._unlockAudioHandler, { capture: true });
    for (const timerId of this._activeAudioInstances.keys()) this._stopAudioForTimer(timerId);
    this._activeAudioInstances.clear();
    this._ringingTimers.clear();
    this._lastActionTime.clear();
    this._expirationTimes.clear();
    this._dismissed.clear();
  }

  _startTimerUpdates() {
    this._stopTimerUpdates();
    this._updateTimers();
    this._timerInterval = setInterval(() => this._updateTimers(), 250);
  }

  _stopTimerUpdates() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  _getStorageKey() {
    return `simple-timer-card-${this._storageNamespace}`;
  }

  _getStorageAdapter(storage) {
    if (storage === "mqtt") {
      return {
        load: () => this._loadTimersFromStorage_mqtt(),
        save: (timers) => this._saveTimersToStorage_mqtt(timers),
        update: (timerId, updates) => this._updateTimerInStorage_mqtt(timerId, updates),
        remove: (timerId) => this._removeTimerFromStorage_mqtt(timerId),
      };
    }
    if (storage === "local") {
      return {
        load: () => this._loadTimersFromStorage_local(),
        save: (timers) => this._saveTimersToStorage_local(timers),
        update: (timerId, updates) => this._updateTimerInStorage_local(timerId, updates),
        remove: (timerId) => this._removeTimerFromStorage_local(timerId),
      };
    }
    return null;
  }


  _loadTimersFromStorage_local() {
    try {
      const stored = localStorage.getItem(this._getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this._validateStoredTimerData(parsed)) return parsed.timers;
        localStorage.removeItem(this._getStorageKey());
      }
    } catch (e) {
      try { localStorage.removeItem(this._getStorageKey()); } catch (_) {}
    }
    return [];
  }

  _saveTimersToStorage_local(timers) {
    try {
      const data = { timers: timers || [], version: 2, lastUpdated: Date.now() };
      localStorage.setItem(this._getStorageKey(), JSON.stringify(data));
    } catch (e) {}
  }

  _updateTimerInStorage_local(timerId, updates) {
    const timers = this._loadTimersFromStorage_local();
    const index = timers.findIndex((t) => t.id === timerId);
    if (index !== -1) {
      timers[index] = _cleanUndefined({ ...timers[index], ...updates });
      this._saveTimersToStorage_local(timers);
    }
  }

  _removeTimerFromStorage_local(timerId) {
    const timers = this._loadTimersFromStorage_local().filter((t) => t.id !== timerId);
    this._saveTimersToStorage_local(timers);
  }


  _mqttCacheKey() {
    const topic = this._config?.mqtt?.topic || "";
    return topic ? `simple_timer_card_mqtt_${topic}` : "simple_timer_card_mqtt";
  }

  _readMqttCache() {
    return this._readMqttCacheState().timers;
  }

  _readMqttCacheState() {
    try {
      const raw = localStorage.getItem(this._mqttCacheKey());
      if (!raw) return { timers: [], tombstones: [], baseUpdated: 0 };
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { timers: parsed, tombstones: [], baseUpdated: 0 };
      if (parsed && Array.isArray(parsed.timers)) {
        return {
          timers: parsed.timers,
          tombstones: Array.isArray(parsed.tombstones) ? parsed.tombstones : [],
          baseUpdated: Number(parsed.baseUpdated) || 0,
        };
      }
      return { timers: [], tombstones: [], baseUpdated: 0 };
    } catch (e) {
      return { timers: [], tombstones: [], baseUpdated: 0 };
    }
  }

  _writeMqttCache(timers, tombstones = null, baseUpdated = null) {
    try {
      const prev = this._readMqttCacheState();
      localStorage.setItem(this._mqttCacheKey(), JSON.stringify({
        timers: Array.isArray(timers) ? timers : [],
        tombstones: _pruneTombstones(tombstones || prev.tombstones),
        baseUpdated: baseUpdated != null ? baseUpdated : prev.baseUpdated,
      }));
    } catch (e) {}
  }

  _detectWakeFromFreeze() {
    const now = Date.now();
    // The tick runs every 250ms while the page is alive. A much larger gap means
    // the page was frozen, so hass.states may still hold a pre-freeze snapshot.
    if (this._lastTickTs && now - this._lastTickTs > MQTT_WAKE_GAP_MS) {
      this._mqttAwaitingFresh = true;
      this._mqttReconnectedAt = 0;
      // Whatever is visible at this instant predates the freeze, so it becomes
      // the bar a snapshot must beat to prove it came from the broker.
      const sensor = this._config?.mqtt?.sensor_entity;
      this._mqttWakeBaseline = this._mqttSnapshotStamp(sensor ? this.hass?.states?.[sensor] : null);
    }
    this._lastTickTs = now;
  }

  _mqttSnapshotStamp(entity) {
    const attr = Number(entity?.attributes?.lastUpdated);
    if (Number.isFinite(attr) && attr > 0) return attr;
    const parsed = Date.parse(entity?.last_updated || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // A sensor read is only authoritative once we know it reflects the broker
  // rather than state left in memory from before the device went to sleep.
  _isMqttSnapshotFresh(entity) {
    const connected = this.hass?.connected !== false;
    if (!connected) {
      this._mqttReconnectedAt = 0;
      return false;
    }
    if (!this._mqttAwaitingFresh) return true;

    const stamp = this._mqttSnapshotStamp(entity);
    if (stamp > 0 && stamp > this._mqttWakeBaseline) {
      this._mqttAwaitingFresh = false;
      return true;
    }
    if (!this._mqttReconnectedAt) this._mqttReconnectedAt = Date.now();
    if (Date.now() - this._mqttReconnectedAt >= MQTT_RESYNC_GRACE_MS) {
      this._mqttAwaitingFresh = false;
      return true;
    }
    return false;
  }

  _loadTimersFromStorage_mqtt() {
    try {
      this._mqttLastLoadSource = "none";
      const cached = this._readMqttCache();
      const sensor = this._config?.mqtt?.sensor_entity;
      if (!sensor) {
        const usingShadow = Array.isArray(this._mqttShadow?.timers);
        this._mqttLastLoadSource = usingShadow ? "shadow" : "cache";
        return usingShadow ? this._mqttShadow.timers : cached;
      }
      const entity = this.hass?.states?.[sensor];
      const timers = entity?.attributes?.timers;

      if (Array.isArray(timers)) {
        if (!this._isMqttSnapshotFresh(entity)) {
          // Render it so the card does not blank out, but treat it as stale so
          // it cannot ring, expire, or be published back over newer broker state.
          this._mqttLastLoadSource = "stale_sensor";
          return timers;
        }
        this._mqttLastLoadSource = "sensor";
        // Reconcile instead of replacing, so a stale publish from another client
        // cannot resurrect something this client already knows was deleted.
        const cached = this._readMqttCacheState();
        const incomingStamp = this._mqttSnapshotStamp(entity);
        const merged = _mergeMqttState(
          cached,
          { timers, tombstones: Array.isArray(entity?.attributes?.deleted) ? entity.attributes.deleted : [] },
          { acceptOmissions: incomingStamp > cached.baseUpdated },
        );
        this._writeMqttCache(merged.timers, merged.tombstones, Math.max(incomingStamp, cached.baseUpdated));
        if (merged.timers.length !== timers.length) {
          // The retained topic carried a resurrected timer. Heal it for everyone.
          this._saveTimersToStorage_mqtt(merged.timers, merged.tombstones);
        }
        if (this._mqttShadow?.lastUpdated && entity?.attributes?.lastUpdated && entity.attributes.lastUpdated >= this._mqttShadow.lastUpdated) {
          this._mqttShadow = null;
        } else if (this._mqttShadow?.timers) {
          const hasAllShadow = this._mqttShadow.timers.every((t) => t?.id && timers.some((x) => x?.id === t.id));
          if (hasAllShadow) this._mqttShadow = null;
        }
        return merged.timers;
      }

      const usingShadow = Array.isArray(this._mqttShadow?.timers);
      this._mqttLastLoadSource = usingShadow ? "shadow" : "cache";
      return usingShadow ? this._mqttShadow.timers : cached;
    } catch (e) {
      const cached = this._readMqttCache();
      const usingShadow = Array.isArray(this._mqttShadow?.timers);
      this._mqttLastLoadSource = usingShadow ? "shadow" : "cache";
      return usingShadow ? this._mqttShadow.timers : cached;
    }
  }

  _reportMqttPublishError(message) {
    if (this._mqttPublishErrors.has(message)) return;
    this._mqttPublishErrors.add(message);
    console.warn("[simple-timer-card]", message);
    this._toast(message);
  }

  _publishMqtt(operation, payload, event) {
    let serialized;
    try {
      serialized = JSON.stringify(payload);
      if (typeof serialized !== "string") throw new Error("Missing MQTT payload.");
    } catch (error) {
      this._reportMqttPublishError(`MQTT data could not be serialized: ${error.message}`);
      return Promise.resolve(false);
    }
    const hass = this.hass;
    const mqtt = { ...this._config.mqtt };
    const context = JSON.stringify([hass?.user?.id, hass?.user?.is_admin, hass?.config?.version, mqtt]);

    // Serialize writes so one denied request also stops already queued writes.
    this._mqttPublishQueue = this._mqttPublishQueue.then(async () => {
      if (context !== this._mqttPublishContext) {
        this._mqttPublishContext = context;
        this._mqttPublishBlocked = false;
        this._mqttPublishErrors.clear();
      }
      if (this._mqttPublishBlocked) return false;
      const admin = hass?.user?.is_admin;
      if (typeof admin !== "boolean") {
        this._reportMqttPublishError("MQTT publishing is paused until Home Assistant user information is available. Reload the dashboard if this persists.");
        return false;
      }
      const automation = !admin && mqtt.publish_automation;
      const version = /^(\d+)\.(\d+)\./.exec(hass.config?.version || "");
      const legacyPublish = version && (Number(version[1]) < 2026 || (Number(version[1]) === 2026 && Number(version[2]) < 10));
      if (!admin && !automation && !legacyPublish) {
        this._reportMqttPublishError("MQTT changes are not synced: non-admin users need mqtt.publish_automation on Home Assistant 2026.10+. Ask an administrator to install the MQTT relay automation.");
        return false;
      }
      if (automation && hass.states?.[automation]?.state !== "on") {
        this._reportMqttPublishError(`MQTT changes are not synced: ${automation} must exist, be enabled, and be accessible to this user.`);
        return false;
      }
      try {
        if (automation) {
          const request = { operation, payload: JSON.parse(serialized) };
          if (event) request.event = event;
          await hass.callService("automation", "trigger", {
            entity_id: automation,
            skip_condition: false,
            variables: { stc_request: request },
          });
        } else {
          const topic = operation === "store" ? mqtt.topic : operation === "state" ? mqtt.state_topic : `${mqtt.events_topic || "simple_timer_card/events"}/${event}`;
          await hass.callService("mqtt", "publish", { topic, payload: serialized, retain: operation !== "event" });
        }
        return true;
      } catch (error) {
        const unauthorized = /unauthorized|not authorized/i.test(`${error?.code || ""} ${error?.message || error}`);
        if (unauthorized) this._mqttPublishBlocked = true;
        this._reportMqttPublishError(unauthorized
          ? "MQTT publishing was denied. Further writes are paused; check the user's relay permissions and reload the dashboard after fixing them."
          : `MQTT publish request failed; changes may not be synced. Check Home Assistant and the relay trace. ${error?.message || error}`);
        return false;
      }
    });
    return this._mqttPublishQueue;
  }

  _saveTimersToStorage_mqtt(timers, tombstones = null) {
    try {
      const timersArr = Array.isArray(timers) ? timers : [];
      const tombs = _pruneTombstones(tombstones || this._readMqttCacheState().tombstones);
      const lastUpdated = Date.now();
      this._mqttShadow = { timers: timersArr, lastUpdated };
      this._writeMqttCache(timersArr, tombs, lastUpdated);

      const topic = this._config?.mqtt?.topic;
      if (topic) {
        const compat = (this._config?.compatibility_mode || "2.1.1");
        if (compat && compat !== "latest") {
          const payloadObj = { timers: timersArr, version: 1, lastUpdated, deleted: tombs };
          this._publishMqtt("store", payloadObj);
        } else {
          this._publishMqtt("store", timersArr);
        }
      }

      const stateTopic = this._config?.mqtt?.state_topic;
      if (stateTopic) {
        this._publishMqtt("state", { version: (this._config?.compatibility_mode && this._config.compatibility_mode !== "latest") ? 1 : 2, t: lastUpdated });
      }
    } catch (error) {
      this._reportMqttPublishError(`MQTT changes could not be saved: ${error.message}`);
    }
  }

  _updateTimerInStorage_mqtt(timerId, updates) {
    const timers = this._loadTimersFromStorage_mqtt();
    const index = timers.findIndex((t) => t.id === timerId);
    if (index !== -1) {
      const tombs = this._readMqttCacheState().tombstones;
      timers[index] = _cleanUndefined({ ...timers[index], ...updates, rev: _nextMqttRev(timers, tombs) });
      this._saveTimersToStorage_mqtt(timers, tombs);
    }
  }

  _removeTimerFromStorage_mqtt(timerId) {
    const current = this._loadTimersFromStorage_mqtt();
    const tombs = this._readMqttCacheState().tombstones;
    const rev = _nextMqttRev(current, tombs);
    const timers = current.filter((t) => t.id !== timerId);
    this._saveTimersToStorage_mqtt(timers, [...tombs, { id: timerId, rev, ts: Date.now() }]);
  }

  _loadTimersFromStorage(sourceHint = null) {
    const storage = sourceHint || this._cardStorage();
    const adapter = this._getStorageAdapter(storage);
    const rawTimers = adapter ? adapter.load() : [];
    if (!Array.isArray(rawTimers)) return [];

    let changed = false;
    const timers = rawTimers.map((t) => {
      if (!t || typeof t !== "object") return t;
      const c = { ...t };
      const hasOtherAudioFields =
        c.audio_file_url !== undefined ||
        c.audio_repeat_count !== undefined ||
        c.audio_play_until_dismissed !== undefined;
      if (c.audio_enabled === false && !hasOtherAudioFields) {
        delete c.audio_enabled;
        changed = true;
      }
      if (typeof c.start_ts !== "number") {
        if (typeof c.start === "number") {
          c.start_ts = c.start;
          changed = true;
        } else if (typeof c.start === "string") {
          const parsed = Date.parse(c.start);
          if (!isNaN(parsed)) {
            c.start_ts = parsed;
            changed = true;
          }
        }
      }

      if (c.paused) {
        if (typeof c.remaining_ms !== "number") {
          if (typeof c.end === "number") {
            c.remaining_ms = c.end;
            changed = true;
          }
        }
        if (c.end_ts != null) {
          c.end_ts = null;
          changed = true;
        }
      } else {
        if (typeof c.end_ts !== "number") {
          if (typeof c.end === "number") {
            c.end_ts = c.end;
            changed = true;
          }
        }
        if (c.remaining_ms != null) {
          delete c.remaining_ms;
          changed = true;
        }
      }
      if (c.start != null) { delete c.start; changed = true; }
      if (c.end != null) { delete c.end; changed = true; }

      return c;
    });

    if (changed) {
      // Never persist/publish normalized data that came from a stale cache or
      // shadow snapshot. A device waking from background would otherwise write
      // its old timer list back onto the retained MQTT topic and resurrect
      // timers that were already dismissed on another device. Only re-save when
      // the data is authoritative: local storage, or a fresh MQTT sensor read.
      const isMqttNonAuthoritative = storage === "mqtt" && this._mqttLastLoadSource !== "sensor";
      if (!isMqttNonAuthoritative) this._saveTimersToStorage(timers, storage);
    }
    return timers;
  }

  _saveTimersToStorage(timers, sourceHint = null) {
    const storage = sourceHint || this._cardStorage();
    if (storage === "mqtt") return this._saveTimersToStorage_mqtt(timers);
    if (storage === "local") return this._saveTimersToStorage_local(timers);
  }

  _updateTimerInStorage(timerId, updates, sourceHint = null) {
    const storage = sourceHint || this._cardStorage();
    if (storage === "mqtt") return this._updateTimerInStorage_mqtt(timerId, updates);
    if (storage === "local") return this._updateTimerInStorage_local(timerId, updates);
  }

  _removeTimerFromStorage(timerId, sourceHint = null) {
    const storage = sourceHint || this._cardStorage();
    if (storage === "mqtt") return this._removeTimerFromStorage_mqtt(timerId);
    if (storage === "local") return this._removeTimerFromStorage_local(timerId);
  }

  _addTimerToStorage(timer) {
    const storage = timer.source || this._cardStorage();
    const timers = this._loadTimersFromStorage(storage);
    if (storage === "mqtt") {
      const tombs = this._readMqttCacheState().tombstones;
      timer = { ...timer, rev: _nextMqttRev(timers, tombs) };
    }
    timers.push(timer);
    this._saveTimersToStorage(timers, storage);
  }

  // ha-google-home publishes a `timers` array on sensor.<device>_timers. Unlike
  // the Alexa payloads, fire_time is epoch seconds and duration is seconds, and
  // status is lower case, so it needs its own parser rather than the Alexa one.
  _parseGoogle(entityId, entityState, entityConf) {
    const attrs = entityState?.attributes || {};
    const list = Array.isArray(attrs.timers) ? attrs.timers : [];
    if (!list.length) return [];

    const epochToMs = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return n > 1e11 ? n : n * 1000;
    };
    const deviceName = this._sanitizeText(
      attrs.friendly_name ||
      entityId.replace(/^sensor\./, "").replace(/_timers$/, "").replace(/_/g, " ")
    );
    const hasCustomIcon = !!entityConf?.icon;
    const hasCustomColor = !!entityConf?.color;
    const now = Date.now();
    const out = [];

    list.forEach((item, idx) => {
      if (!item || typeof item !== "object") return;
      const status = String(item.status || "").toLowerCase().trim();
      if (status && !["set", "ringing", "paused"].includes(status)) return;

      const paused = status === "paused";
      const ringing = status === "ringing";
      // ha-google-home sends duration as "H:MM:SS", though older builds sent seconds.
      const durationMs = (typeof item.duration === "string" && item.duration.includes(":"))
        ? this._parseHMSToMs(item.duration)
        : Math.max(0, Number(item.duration) || 0) * 1000;
      const endMs = epochToMs(item.fire_time);
      if (!paused && !ringing && !endMs) return;

      const label = this._sanitizeText(item.label || "") || deviceName;
      out.push({
        id: `google-${entityId}-${item.timer_id ?? idx}`,
        source: "google",
        source_entity: entityId,
        google_timer_id: item.timer_id ?? null,
        label,
        icon: hasCustomIcon ? entityConf.icon : (paused ? "mdi:timer-pause" : "mdi:timer"),
        color: hasCustomColor ? entityConf.color : (paused ? "var(--warning-color)" : "var(--primary-color)"),
        // For paused rows the shared normalizer reads `end` as the remaining ms.
        end: paused
          ? Math.max(0, endMs ? endMs - now : durationMs)
          : (ringing ? now : endMs),
        duration: durationMs,
        paused,
      });
    });

    return out;
  }

  // Finds Alexa and Google Home timer entities the user has not listed. Matching
  // is on attributes rather than entity id, so a renamed entity is still found.
  _discoverTimerEntities() {
    const wantAlexa = this._config?.auto_discover_alexa === true;
    const wantGoogle = this._config?.auto_discover_google === true;
    const wantTimerLists = this._config?.auto_discover_timer_lists === true;
    const wantSatellites = this._config?.auto_discover_voice_satellites === true;
    if (!wantAlexa && !wantGoogle && !wantTimerLists && !wantSatellites) return [];
    const states = this.hass?.states;
    if (!states) return [];

    const now = Date.now();
    const cache = this._discoveryCache;
    if (cache && now - cache.at < 2000 && cache.alexa === wantAlexa && cache.google === wantGoogle && cache.timerLists === wantTimerLists && cache.satellites === wantSatellites) {
      return cache.entities;
    }

    const configured = new Set(
      (this._config.entities || [])
        .map((e) => (typeof e === "string" ? e : e?.entity))
        .filter(Boolean)
    );
    if (this._config.default_timer_entity) configured.add(this._config.default_timer_entity);

    const found = [];
    for (const entityId in states) {
      if (configured.has(entityId)) continue;
      if (entityId.startsWith("timer_list.") || (entityId.startsWith("sensor.") && states[entityId]?.attributes?.simple_timer_card_api != null)) {
        if (wantTimerLists) found.push({ entity: entityId, mode: "timer_list" });
        continue;
      }
      if (entityId.startsWith("assist_satellite.")) {
        // Only the Voice Satellite Card integration publishes active_timers.
        if (wantSatellites && Array.isArray(states[entityId]?.attributes?.active_timers)) found.push({ entity: entityId, mode: "voice_satellite" });
        continue;
      }
      if (!entityId.startsWith("sensor.")) continue;
      const attrs = states[entityId]?.attributes;
      if (!attrs) continue;
      // Cheap attribute probe first, since this runs against every state.
      const maybeGoogle = wantGoogle && Array.isArray(attrs.timers);
      const maybeAlexa = wantAlexa && (
        attrs.sorted_active != null || attrs.sorted_all != null ||
        attrs.sorted_paused != null || attrs.next_timer != null ||
        attrs.alarms_brief != null
      );
      if (!maybeGoogle && !maybeAlexa) continue;

      const mode = this._detectMode(entityId, states[entityId], {});
      if (mode === "google" && wantGoogle) found.push({ entity: entityId, mode: "google" });
      else if (mode === "alexa" && wantAlexa) found.push({ entity: entityId, mode: "alexa" });
    }

    this._discoveryCache = { at: now, alexa: wantAlexa, google: wantGoogle, timerLists: wantTimerLists, satellites: wantSatellites, entities: found };
    return found;
  }

  _normalizeSourceStyles(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out = {};
    for (const [source, style] of Object.entries(value)) {
      if (!style || typeof style !== "object" || Array.isArray(style)) continue;
      const entry = {};
      if (typeof style.icon === "string" && style.icon.trim()) entry.icon = style.icon.trim();
      if (typeof style.color === "string" && style.color.trim()) entry.color = style.color.trim();
      if (Object.keys(entry).length) out[String(source).trim().toLowerCase()] = entry;
    }
    return out;
  }

  // Resolved before parsing so the parsers' existing entityConf handling applies
  // it, which keeps per-entity config ahead of the per-source default.
  _applySourceStyle(mode, conf) {
    const style = this._config?.source_styles?.[mode];
    if (!style) return conf;
    const merged = { ...conf };
    if (!merged.icon && style.icon) merged.icon = style.icon;
    if (!merged.color && style.color) merged.color = style.color;
    return merged;
  }

  _detectMode(entityId, entityState, entityConf) {
    if (!entityState) return null;
    if (entityId.startsWith("timer_list.")) return "timer_list";
    if (entityId.startsWith("sensor.") && entityState.attributes?.simple_timer_card_api != null) return "timer_list";
    if (entityId.startsWith("assist_satellite.") && Array.isArray(entityState.attributes?.active_timers)) return "voice_satellite";
    if (entityId.startsWith("timer.")) return "timer";
    if (entityId.startsWith("input_text.") || entityId.startsWith("text.")) return "helper";
    const attrs = entityState.attributes || {};
    // ha-google-home entries carry a timer_id; Alexa payloads never do.
    if (Array.isArray(attrs.timers) && attrs.timers.some((x) => x && typeof x === "object" && x.timer_id !== undefined)) return "google";
    if (
      attrs.alarms_brief != null ||
      attrs.sorted_active != null ||
      attrs.sorted_paused != null ||
      attrs.sorted_all != null ||
      attrs.next_timer != null ||
      attrs.timers != null ||

      ((entityId.includes("next_timer") || entityId.endsWith("_next_timer")) &&
        (attrs.total_active != null || attrs.total_all != null || attrs.status != null || attrs.timer != null || attrs.dismissed != null))
    ) return "alexa";
    if (attrs.device_class === "timestamp") return "timestamp";
    const guessAttr = entityConf?.minutes_attr;
    if (guessAttr && (attrs[guessAttr] ?? null) !== null) return "minutes_attr";
    if (attrs.start_time) return "timestamp";
    const stateVal = entityState.state;
    if (stateVal && stateVal !== "unknown" && stateVal !== "unavailable") {
      if (isNaN(stateVal) && !isNaN(Date.parse(stateVal))) return "timestamp";
    }
    return null;
  }

  _toMs(v) {
    if (v == null) return null;
    if (typeof v === "number") {
      if (v < 1000) return v * 1000;
      if (v > 1e12) return Math.max(0, v - Date.now());
      return v;
    }
    if (typeof v === "string") {
      const n = Number(v);
      if (!Number.isNaN(n)) return this._toMs(n);
      const m = /^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i.exec(v.trim());
      if (m) {
        const h = parseInt(m[1] || "0", 10);
        const min = parseInt(m[2] || "0", 10);
        const s = parseInt(m[3] || "0", 10);
        return ((h * 3600) + (min * 60) + s) * 1000;
      }
    }
    return null;
  }

  _parseAlexa(entityId, entityState, entityConf) {
    const attrs = entityState.attributes;

    let active = attrs.sorted_active;
    let paused = attrs.sorted_paused;
    let all = attrs.sorted_all;

    if ((active == null && paused == null && all == null) && attrs.timers != null) {
      all = attrs.timers;
    }
    if (active == null && attrs.next_timer != null) {
      active = [attrs.next_timer];
    }

    const safeParse = (x) => {
      if (Array.isArray(x)) return x;
      if (typeof x === "string") { try { return JSON.parse(x); } catch { return []; } }
      return Array.isArray(x) ? x : [];
    };

    active = safeParse(active);
    paused = safeParse(paused);
    all = safeParse(all);

    if (active.length === 0 && paused.length === 0 && attrs.alarms_brief) {
      const brief = attrs.alarms_brief;
      const briefActive = Array.isArray(brief.active) ? brief.active : [];

      let anchorTime = Date.now();
      if (attrs.process_timestamp) {
        anchorTime = new Date(attrs.process_timestamp).getTime();
      } else if (entityState.last_updated) {
        anchorTime = new Date(entityState.last_updated).getTime();
      }

      return briefActive.map(t => {
        const isPaused = (t.status === "PAUSED");
        const remaining = t.remainingTime || 0;

        const validAnchor = (attrs.process_timestamp || entityState.last_updated)
          ? anchorTime
          : (t.lastUpdatedDate || Date.now());

        const end = isPaused ? remaining : (validAnchor + remaining);

        let totalDuration = t.originalDuration;

        if (!totalDuration) {
          if (isPaused) {
             totalDuration = remaining;
          } else {
             const startTime = t.lastUpdatedDate || validAnchor;
             const elapsed = Math.max(0, validAnchor - startTime);
             totalDuration = elapsed + remaining;
          }
        }

        let label;
        if (t.timerLabel) {
          label = this._sanitizeText(t.timerLabel);
        } else {
          const cleanedFriendlyName = this._cleanFriendlyName(attrs.friendly_name);
          const baseName = entityConf?.name || cleanedFriendlyName || (isPaused ? "Alexa Timer (Paused)" : "Alexa Timer");
          label = this._sanitizeText(baseName);
        }

        return {
          id: t.id,
          source: "alexa",
          source_entity: entityId,
          label,
          icon: entityConf?.icon || (isPaused ? "mdi:timer-pause" : "mdi:timer"),
          color: entityConf?.color || (isPaused ? "var(--warning-color)" : "var(--primary-color)"),
          end: end,
          duration: totalDuration,
          paused: isPaused,
        };
      });
    }

    const normDuration = (t) =>
      (typeof t?.originalDurationInMillis === "number" && t.originalDurationInMillis) ||
      (typeof t?.originalDurationInSeconds === "number" && t.originalDurationInSeconds * 1000) ||
      this._toMs(t?.originalDuration) || null;

    const mk = (id, t, pausedFlag) => {
      const remainingMs = pausedFlag ? this._toMs(t?.remainingTime) : null;
      const end = pausedFlag ? (remainingMs ?? 0) : Number(t?.triggerTime || 0);
      let label;
      if (t?.timerLabel) {
        label = this._sanitizeText(t.timerLabel);
      } else {
        const cleanedFriendlyName = this._cleanFriendlyName(entityState.attributes.friendly_name);
        const baseName = entityConf?.name || cleanedFriendlyName || (pausedFlag ? "Alexa Timer (Paused)" : "Alexa Timer");
        const originalDuration = normDuration(t);
        const displayTime = originalDuration > 0 ? this._formatDurationDisplay(originalDuration) : "0m";
        if (baseName && baseName !== "Alexa Timer" && baseName !== "Alexa Timer (Paused)") {
          label = this._sanitizeText(`${baseName} - ${displayTime}`);
        } else {
          label = this._sanitizeText(baseName);
        }
      }
      const hasCustomIcon = !!entityConf?.icon;
      const hasCustomColor = !!entityConf?.color;
      return {
        id,
        source: "alexa",
        source_entity: entityId,
        label,
        icon: hasCustomIcon ? entityConf.icon : (pausedFlag ? "mdi:timer-pause" : "mdi:timer"),
        color: hasCustomColor ? entityConf.color : (pausedFlag ? "var(--warning-color)" : "var(--primary-color)"),
        end,
        duration: normDuration(t),
        paused: !!pausedFlag,
      };
    };

    const mapTimerList = (list, isPaused) => {
      if (!Array.isArray(list)) return [];
      return list.map(item => {
        let id, t;
        if (Array.isArray(item)) { [id, t] = item; }
        else { t = item; id = t.id; }
        return mk(id, t, isPaused);
      });
    };

    const activeTimers = mapTimerList(active, false);
    let pausedTimers = mapTimerList(paused, true);

    if (pausedTimers.length === 0 && all.length > 0) {
      pausedTimers = mapTimerList(all, true).filter(pt => pt && String(pt.status).toUpperCase() === "PAUSED");
    }
    return [...activeTimers, ...pausedTimers];
  }

  _parseHelper(entityId, entityState, entityConf) {
    try {
      const data = JSON.parse(entityState.state || "{}");
      if (!this._validateStoredTimerData(data)) return [];
      if (data?.timers?.map) {
        return data.timers.map((timer) => ({
          ...timer,
          source: "helper",
          source_entity: entityId,
          label: this._sanitizeText(timer.label || entityConf?.name || this._localize("timer")),
          icon: timer.icon || entityConf?.icon || "mdi:timer-outline",
          color: timer.color || entityConf?.color || "var(--primary-color)",
        }));
      }
      if (data?.timer && typeof data.timer === "object") {
        const singleTimer = data.timer;
        return [{
          end: singleTimer.e,
          duration: singleTimer.d,
          id: `single-timer-${entityId}`,
          label: this._sanitizeText(entityConf?.name || entityState?.attributes?.friendly_name || this._localize("timer")),
          paused: false,
          source: "helper",
          source_entity: entityId,
          icon: entityConf?.icon || "mdi:timer-outline",
          color: entityConf?.color || "var(--primary-color)",
        }];
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  _parseTimestamp(entityId, entityState, entityConf) {
    const s = entityState.state;
    if (!s || s === "unknown" || s === "unavailable") return [];
    const endMs = Date.parse(s);
    if (isNaN(endMs)) return [];
    let duration = null;
    if (entityConf?.start_time_entity) {
      const startEntityState = this.hass.states[entityConf.start_time_entity];
      if (startEntityState && startEntityState.state && startEntityState.state !== "unknown" && startEntityState.state !== "unavailable") {
        const startMs = Date.parse(startEntityState.state);
        if (!isNaN(startMs) && endMs > startMs) duration = endMs - startMs;
      }
    } else {
      const startTimeAttr = entityConf?.start_time_attr || "start_time";
      const startTimeVal = entityState.attributes[startTimeAttr];
      if (startTimeVal) {
        const startMs = Date.parse(startTimeVal);
        if (!isNaN(startMs) && endMs > startMs) duration = endMs - startMs;
      }
    }
    return [{
      id: `${entityId}-${endMs}`,
      source: "timestamp",
      source_entity: entityId,
      label: entityConf?.name || entityState.attributes.friendly_name || this._localize("timer"),
      icon: entityConf?.icon || "mdi:timer-sand",
      color: entityConf?.color || "var(--primary-color)",
      end: endMs,
      duration: duration
    }];
  }

  _parseMinutesAttr(entityId, entityState, entityConf) {
    const attrName = entityConf?.minutes_attr || "Minutes to arrival";
    const minutes = Number(entityState?.attributes?.[attrName]);
    if (!isFinite(minutes)) return [];
    const endMs = Date.now() + Math.max(0, minutes) * 60000;
    return [{
      id:`${entityId}-eta-${Math.floor(endMs/1000)}`,
      source:"minutes_attr",
      source_entity:entityId,
      label:entityConf?.name||entityState.attributes.friendly_name||"ETA",
      icon:entityConf?.icon || "mdi:timer-outline",
      color:entityConf?.color || "var(--primary-color)",
      end: endMs,
      duration: minutes * 60000
    }];
  }

  _parseTimer(entityId, entityState, entityConf) {
    const state = entityState.state;
    const attrs = entityState.attributes;
    if (!["active", "paused", "idle", "finished"].includes(state)) return [];
    let endMs = null;
    let duration = null;
    let remainingMs = null;
    if (attrs.duration) duration = this._parseHMSToMs(attrs.duration);
    if (state === "idle") {
      const entityIcon = attrs.icon;
      const defaultIcon = entityIcon || "mdi:play";
      return [{
        id: entityId, source: "timer", source_entity: entityId,
        label: entityConf?.name || entityState.attributes.friendly_name || this._localize("timer"),
        icon: entityConf?.icon || defaultIcon,
        color: entityConf?.color || "var(--primary-color)",
        end: null, duration, paused: false, idle: true
      }];
    }
    if (state === "finished") {
      const finishedAt = attrs.finishes_at ? Date.parse(attrs.finishes_at) : Date.now();
      const entityIcon = attrs.icon;
      const defaultIcon = entityIcon || "mdi:timer-check";
      return [{
        id: entityId, source: "timer", source_entity: entityId,
        label: entityConf?.name || entityState.attributes.friendly_name || this._localize("timer"),
        icon: entityConf?.icon || defaultIcon,
        color: entityConf?.color || "var(--success-color)",
        end: finishedAt, duration, paused: false, finished: true, finishedAt
      }];
    }
    if (state === "paused") {
      if (attrs.remaining && attrs.remaining !== "0:00:00") {
        remainingMs = this._parseHMSToMs(attrs.remaining);
        endMs = remainingMs;
      }
    } else if (state === "active") {
      if (attrs.finishes_at) endMs = Date.parse(attrs.finishes_at);
      else if (attrs.remaining && attrs.remaining !== "0:00:00") {
        remainingMs = this._parseHMSToMs(attrs.remaining);
        if (remainingMs > 0) endMs = Date.now() + remainingMs;
      }
    }
    if (!endMs && state !== "idle" && state !== "finished") return [];
    const entityIcon = attrs.icon;
    const defaultIcon = entityIcon || (state === "paused" ? "mdi:timer-pause" : "mdi:timer");
    return [{
      id: entityId, source: "timer", source_entity: entityId,
      label: entityConf?.name || entityState.attributes.friendly_name || this._localize("timer"),
      icon: entityConf?.icon || defaultIcon,
      color: entityConf?.color || (state === "paused" ? "var(--warning-color)" : "var(--primary-color)"),
      end: endMs, duration, paused: state === "paused", idle: state === "idle", finished: state === "finished"
    }];
  }

  _parseVoicePE(entityId, entityState, entityConf) {
    const state = entityState.state;
    const attrs = entityState.attributes || {};
    if (!["active", "paused", "idle", "finished"].includes(state)) return [];

    const controlEntity = (attrs.control_entity && String(attrs.control_entity).trim()) ? String(attrs.control_entity).trim() : null;


    const timerIdRaw =
      attrs.timer_id ??
      attrs.timerId ??
      attrs.id ??
      attrs.timer ??
      attrs.voice_pe_timer_id ??
      attrs.vpe_timer_id ??
      attrs.uuid ??
      null;

    const timerId = (timerIdRaw && String(timerIdRaw).trim()) ? String(timerIdRaw).trim() : null;

    const duration = attrs.duration ? this._parseHMSToMs(attrs.duration) : null;
    const remainingFromAttrs = attrs.remaining ? this._parseHMSToMs(attrs.remaining) : null;

    const isLocalControllable = !!(controlEntity && timerId);


    const label =
      (attrs.display_name && String(attrs.display_name).trim()) ? String(attrs.display_name).trim() :
      (attrs.friendly_name && String(attrs.friendly_name).trim()) ? String(attrs.friendly_name).trim() :
      (entityConf?.name && String(entityConf.name).trim()) ? String(entityConf.name).trim() :
      this._localize("timer");


    const base = {
      id: timerId ? `vpe-${timerId}` : entityId,
      source: "voice_pe",
      source_entity: entityId,
      label,
      name: label,
      duration,
      voice_pe_timer_id: timerId,
      control_entity: controlEntity,

      supports: isLocalControllable
        ? { pause: true, cancel: true, snooze: false, extend: false }
        : { pause: false, cancel: false, snooze: false, extend: false },
    };


    if (state === "idle") {
      const entityIcon = attrs.icon;
      const defaultIcon = entityIcon || "mdi:play";
      return [{
        ...base,
        icon: entityConf?.icon || defaultIcon,
        color: entityConf?.color || "var(--primary-color)",
        end: null,
        paused: false,
        idle: true,
        finished: false,
        state: "idle",
      }];
    }


    if (state === "finished") {
      const finishedAt = attrs.finishes_at ? Date.parse(attrs.finishes_at) : Date.now();
      const entityIcon = attrs.icon;
      const defaultIcon = entityIcon || "mdi:timer-check";
      return [{
        ...base,
        icon: entityConf?.icon || defaultIcon,
        color: entityConf?.color || "var(--success-color)",
        end: finishedAt,
        paused: false,
        idle: false,
        finished: true,
        finishedAt,
        state: "finished",
      }];
    }


    let endMs = null;
    let remainingMs = null;

    if (state === "paused") {
      if (remainingFromAttrs && remainingFromAttrs > 0) {
        remainingMs = remainingFromAttrs;
        endMs = remainingMs;
      }
    } else if (state === "active") {
      if (attrs.finishes_at) {
        endMs = Date.parse(attrs.finishes_at);
      } else if (remainingFromAttrs && remainingFromAttrs > 0) {
        remainingMs = remainingFromAttrs;
        endMs = Date.now() + remainingMs;
      }
    }

    if (!endMs) return [];

    const entityIcon = attrs.icon;
    const defaultIcon = entityIcon || (state === "paused" ? "mdi:timer-pause" : "mdi:timer");

    return [{
      ...base,
      icon: entityConf?.icon || defaultIcon,
      color: entityConf?.color || (state === "paused" ? "var(--warning-color)" : "var(--primary-color)"),
      end: endMs,
      paused: state === "paused",
      idle: false,
      finished: false,
      state,
    }];
  }

  // === Home Assistant timer lists (v3.0.0) ===
  //
  // A timer_list entity holds many timers. Its state is only the active count;
  // the timers themselves come from the timer_list/item/subscribe websocket
  // command, which sends a snapshot and then one change event per update.

  _timerListFeatures(entityState) {
    const raw = Number(entityState?.attributes?.supported_features) || 0;
    const has = (bit) => (raw & bit) === bit;
    return {
      create: has(TIMER_LIST_FEATURE.CREATE),
      pause: has(TIMER_LIST_FEATURE.PAUSE),
      cancel: has(TIMER_LIST_FEATURE.CANCEL) || has(TIMER_LIST_FEATURE.REMOVE),
      cancel_service: has(TIMER_LIST_FEATURE.CANCEL),
      extend: has(TIMER_LIST_FEATURE.ADD_TIME),
      remove: has(TIMER_LIST_FEATURE.REMOVE),
      finish: has(TIMER_LIST_FEATURE.FINISH),
      snooze: has(TIMER_LIST_FEATURE.CREATE) || has(TIMER_LIST_FEATURE.RESTART),
      restart: has(TIMER_LIST_FEATURE.RESTART) || (has(TIMER_LIST_FEATURE.CREATE) && (has(TIMER_LIST_FEATURE.REMOVE) || has(TIMER_LIST_FEATURE.CANCEL))),
      restart_service: has(TIMER_LIST_FEATURE.RESTART),
      actions: has(TIMER_LIST_FEATURE.RUN_ACTIONS),
    };
  }

  _isCompanionList(entityId) {
    return typeof entityId === "string" && entityId.startsWith("sensor.") &&
      this.hass?.states?.[entityId]?.attributes?.simple_timer_card_api != null;
  }

  _isTimerListEntity(entityId) {
    return typeof entityId === "string" && (entityId.startsWith("timer_list.") || this._isCompanionList(entityId));
  }

  // Core timer lists and the companion share one websocket and action contract.
  _timerListApi(entityId) {
    const domain = this._isCompanionList(entityId) ? COMPANION_DOMAIN : "timer_list";
    return { domain, subscribe: `${domain}/item/subscribe` };
  }

  // The companion list that receives timers with an action: the default target
  // if it is one, else a listed one, else the first one Home Assistant has.
  _companionList() {
    const def = this._config?.default_timer_entity;
    if (this._isCompanionList(def)) return def;
    for (const entityConf of Array.isArray(this._config?.entities) ? this._config.entities : []) {
      const entityId = typeof entityConf === "string" ? entityConf : entityConf?.entity;
      if (this._isCompanionList(entityId)) return entityId;
    }
    return Object.keys(this.hass?.states || {}).filter((id) => this._isCompanionList(id)).sort()[0] || null;
  }

  // storage: integration sends every new timer to the companion. Without the
  // companion installed, new timers fall back to this browser.
  _integrationStorageList() {
    return this._config?.storage === "integration" ? this._companionList() : null;
  }

  // The card's own storage backend. With integration storage, an MQTT sensor
  // still configured from before keeps its timers showing until they finish
  // or are moved; otherwise it is this browser.
  _cardStorage() {
    const storage = this._config?.storage;
    if (storage === "mqtt") return "mqtt";
    if (storage === "integration" && this._config?.mqtt?.sensor_entity) return "mqtt";
    return "local";
  }

  _syncTimerListSubscriptions(wanted) {
    for (const entityId of [...this._timerLists.keys()]) {
      if (!wanted.has(entityId)) this._dropTimerList(entityId);
    }
    if (!wanted.size) return;
    const conn = this.hass?.connection;
    if (!conn || typeof conn.subscribeMessage !== "function") return;
    if (this._timerListConn !== conn) {
      this._unwatchTimerListConnection();
      this._timerListConn = conn;
      try { conn.addEventListener?.("ready", this._onTimerListConnectionReady); } catch (_) {}
    }
    const now = Date.now();
    for (const entityId of wanted) {
      const st = this.hass.states?.[entityId];
      let sub = this._timerLists.get(entityId);
      if (!st || st.state === "unavailable" || st.state === "unknown") {
        // Timers live in memory and are lost when the entity is reloaded, and
        // the old subscription stays attached to the removed entity object.
        if (sub) this._dropTimerList(entityId);
        continue;
      }
      if (sub && sub.conn !== conn) {
        this._dropTimerList(entityId);
        sub = null;
      }
      if (sub?.status === "pending") continue;
      if (sub?.status === "error" && now < sub.retryAt) continue;
      if (sub?.status === "ready") {
        const expected = Number(st.state);
        let active = 0;
        for (const item of sub.timers.values()) if (item.status === "active") active++;
        if (!Number.isFinite(expected) || expected === active) {
          sub.mismatchSince = null;
          continue;
        }
        if (sub.mismatchSince == null) sub.mismatchSince = now;
        if (now - sub.mismatchSince < TIMER_LIST_RESYNC_MS) continue;
      }
      this._subscribeTimerList(conn, entityId, sub);
    }
  }

  _subscribeTimerList(conn, entityId, previous) {
    if (previous) this._unsubscribeTimerList(previous);
    // Keep the previous timers until the new snapshot replaces them, so a
    // resync does not make a ringing timer disappear and ring again.
    const sub = { conn, status: "pending", timers: previous?.timers || new Map(), unsub: null, retryAt: 0, mismatchSince: null };
    this._timerLists.set(entityId, sub);
    let pending;
    try {
      pending = conn.subscribeMessage(
        (msg) => this._handleTimerListMessage(entityId, sub, msg),
        { type: this._timerListApi(entityId).subscribe, entity_id: entityId },
        { resubscribe: false }
      );
    } catch (err) {
      pending = Promise.reject(err);
    }
    Promise.resolve(pending).then((unsub) => {
      if (this._timerLists.get(entityId) !== sub) {
        this._safeUnsubscribe(unsub);
        return;
      }
      sub.unsub = unsub;
    }, (err) => {
      if (this._timerLists.get(entityId) !== sub) return;
      sub.status = "error";
      sub.retryAt = Date.now() + TIMER_LIST_RETRY_MS;
      sub.timers = new Map();
      if (!this._timerListWarned) {
        this._timerListWarned = true;
        console.warn(`simple-timer-card: could not subscribe to ${entityId}. This needs a Home Assistant version with timer lists.`, err);
      }
    });
  }

  _handleTimerListMessage(entityId, sub, msg) {
    if (this._timerLists.get(entityId) !== sub || !msg) return;
    const now = Date.now();
    if (msg.type === "timers") {
      const next = new Map();
      for (const raw of Array.isArray(msg.timers) ? msg.timers : []) {
        if (raw && raw.timer_id != null) next.set(String(raw.timer_id), { ...raw, timer_id: String(raw.timer_id), _received_at: now });
      }
      sub.timers = next;
      sub.status = "ready";
      sub.mismatchSince = null;
      this._pruneTimerListMeta(entityId, next);
    } else if (msg.type === "change" && msg.timer && msg.timer.timer_id != null) {
      const timerId = String(msg.timer.timer_id);
      if (msg.event_type === "removed") {
        sub.timers.delete(timerId);
        this._deleteTimerListMeta(entityId, timerId);
      } else {
        const item = { ...msg.timer, timer_id: timerId, _received_at: now };
        if (msg.event_type === "finished") item._ended_local = now;
        sub.timers.set(timerId, item);
      }
    } else {
      return;
    }
    if (this.isConnected) this._updateTimers();
  }

  _unsubscribeTimerList(sub) {
    if (!sub) return;
    const unsub = sub.unsub;
    sub.unsub = null;
    this._safeUnsubscribe(unsub);
  }

  _safeUnsubscribe(unsub) {
    if (typeof unsub !== "function") return;
    try { Promise.resolve(unsub()).catch(() => {}); } catch (_) {}
  }

  _dropTimerList(entityId) {
    const sub = this._timerLists.get(entityId);
    this._timerLists.delete(entityId);
    this._unsubscribeTimerList(sub);
  }

  _resetTimerListSubscriptions() {
    // After a websocket reconnect, server-side subscriptions are gone. Mark
    // every list for an immediate resubscribe while keeping its timers.
    for (const sub of this._timerLists.values()) {
      sub.unsub = null;
      sub.status = "error";
      sub.retryAt = 0;
    }
  }

  _unwatchTimerListConnection() {
    if (!this._timerListConn) return;
    try { this._timerListConn.removeEventListener?.("ready", this._onTimerListConnectionReady); } catch (_) {}
    this._timerListConn = null;
  }

  _teardownTimerLists() {
    for (const entityId of [...this._timerLists.keys()]) this._dropTimerList(entityId);
    this._unwatchTimerListConnection();
    this._dropTemplateSubscription();
  }

  _timerListFinishedWindowMs(entityConf) {
    const action = this._config?.expire_action;
    if (action === "dismiss") return Infinity;
    if (action === "remove") {
      let audio;
      if (entityConf && entityConf.audio_enabled !== undefined) audio = entityConf.audio_enabled === true;
      else audio = this._config?.audio_enabled === true;
      return audio ? (this._config.audio_completion_delay || 4) * 1000 : 0;
    }
    return (parseInt(this._config?.expire_keep_for, 10) || 120) * 1000;
  }

  _timerListBaseName(entityState, entityConf) {
    if (entityConf?.name && String(entityConf.name).trim()) return String(entityConf.name).trim();
    const friendly = entityState?.attributes?.friendly_name;
    if (!friendly) return "";
    return String(friendly).replace(/\s+timers?\s*$/i, "").trim();
  }

  // A browser or MQTT card still starts timers on the companion when they do
  // something at the end, so it follows the ones it started, and only those.
  _ownCompanionList(wanted) {
    if (this._config?.storage === "integration") return null;
    const companion = this._companionList();
    return companion && !wanted.has(companion) ? companion : null;
  }

  _parseTimerList(entityId, entityState, entityConf, { ownOnly = false } = {}) {
    if (entityState?.state === "unavailable" || entityState?.state === "unknown") return [];
    const sub = this._timerLists.get(entityId);
    if (!sub || !sub.timers.size) return [];
    const supports = this._timerListFeatures(entityState);
    const baseName = this._timerListBaseName(entityState, entityConf);
    const finishedWindowMs = this._timerListFinishedWindowMs(entityConf);
    const now = Date.now();
    const out = [];
    for (const item of sub.timers.values()) {
      const status = item.status;
      if (status !== "active" && status !== "paused" && status !== "finished") continue;
      const serverMeta = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
      if (ownOnly && serverMeta.card !== this._storageNamespace) continue;
      const meta = { ...serverMeta, ...(this._timerListMeta.get(this._timerListMetaKey(entityId, item.timer_id)) || {}) };
      const action = item.action && typeof item.action === "object" ? item.action : null;
      const createdMs = Math.max(0, Number(item.created_duration) || 0) * 1000;
      const totalMs = Math.max(createdMs, Math.max(0, Number(item.total_duration) || 0) * 1000);
      const name = item.name != null && String(item.name).trim() ? this._sanitizeText(String(item.name).trim()) : "";
      const durationText = this._formatDurationDisplay(createdMs);
      const actionText = action ? this._actionSummary(action) : "";
      const label = name
        || (actionText ? this._sanitizeText(actionText.charAt(0).toUpperCase() + actionText.slice(1)) : "")
        || (baseName ? this._sanitizeText(`${baseName} - ${durationText}`) : this._formatTimerLabel(Math.round(createdMs / 1000)));
      const timer = {
        id: `timer_list:${entityId}:${item.timer_id}`,
        source: "timer_list",
        source_entity: entityId,
        timer_list_timer_id: item.timer_id,
        timer_list_name: name || null,
        created_duration_ms: createdMs,
        label,
        name: label,
        short_label: name || actionText ? null : this._formatTimerLabel(Math.round(createdMs / 1000)),
        device_base_name: baseName || null,
        timer_action: action,
        action_result: item.action_result || null,
        captured_voice: item.source === "voice",
        icon: meta.icon || item.icon || entityConf?.icon || (item.source === "voice" ? "mdi:microphone-message" : (action ? "mdi:timer-play-outline" : "mdi:timer")),
        color: meta.color || item.color || entityConf?.color || "var(--primary-color)",
        duration: totalMs,
        supports,
        idle: false,
        finished: false,
      };
      for (const key of ["pinned_id", "buttons", "expired_subtitle", "audio_enabled", "audio_file_url", "audio_repeat_count", "audio_play_until_dismissed"]) {
        if (meta[key] !== undefined) timer[key] = meta[key];
      }
      if (status === "paused") {
        const remainingMs = Math.max(0, Number(item.paused_remaining ?? item.remaining) || 0) * 1000;
        out.push({ ...timer, paused: true, end: remainingMs, remaining_ms: remainingMs });
      } else if (status === "active") {
        const remainingMs = Math.max(0, Number(item.remaining) || 0) * 1000;
        out.push({ ...timer, paused: false, end: item._received_at + remainingMs });
      } else {
        const parsedEnd = Date.parse(item.ended_at);
        const endedAt = item._ended_local || (Number.isFinite(parsedEnd) ? parsedEnd : item._received_at);
        if (now - endedAt > finishedWindowMs) continue;
        out.push({ ...timer, paused: false, end: Math.min(endedAt, now) });
      }
    }
    return out;
  }

  _timerListMetaKey(entityId, timerId) {
    return `${entityId}|${timerId}`;
  }

  _loadTimerListMeta() {
    try {
      const parsed = JSON.parse(localStorage.getItem(TIMER_LIST_META_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return new Map(Object.entries(parsed));
    } catch (_) {}
    return new Map();
  }

  _saveTimerListMeta() {
    try {
      if (this._timerListMeta.size) localStorage.setItem(TIMER_LIST_META_KEY, JSON.stringify(Object.fromEntries(this._timerListMeta)));
      else localStorage.removeItem(TIMER_LIST_META_KEY);
    } catch (_) {}
  }

  _setTimerListMeta(entityId, timerId, meta) {
    const clean = _cleanUndefined({ ...meta });
    if (!clean || !Object.keys(clean).length) return;
    this._timerListMeta.set(this._timerListMetaKey(entityId, timerId), clean);
    this._saveTimerListMeta();
  }

  _deleteTimerListMeta(entityId, timerId) {
    if (this._timerListMeta.delete(this._timerListMetaKey(entityId, timerId))) this._saveTimerListMeta();
  }

  _pruneTimerListMeta(entityId, timers) {
    const prefix = `${entityId}|`;
    let changed = false;
    for (const key of [...this._timerListMeta.keys()]) {
      if (key.startsWith(prefix) && !timers.has(key.slice(prefix.length))) {
        this._timerListMeta.delete(key);
        changed = true;
      }
    }
    if (changed) this._saveTimerListMeta();
  }

  // Explicit default_timer_entity first, then a single timer list listed in
  // entities, mirroring how a single native timer.* is picked.
  _resolveTimerListTarget(explicit) {
    if (typeof explicit === "string" && explicit) return this._isTimerListEntity(explicit) ? explicit : null;
    const def = this._config?.default_timer_entity;
    if (typeof def === "string" && def) return this._isTimerListEntity(def) ? def : null;
    const areaId = this._config?.default_timer_area;
    if (typeof areaId === "string" && areaId) {
      const inArea = this._timerListsInArea(areaId);
      if (inArea.length) return inArea[0];
    }
    const integration = this._integrationStorageList();
    if (integration) return integration;
    const lists = [];
    for (const entityConf of Array.isArray(this._config?.entities) ? this._config.entities : []) {
      const entityId = typeof entityConf === "string" ? entityConf : entityConf?.entity;
      const mode = typeof entityConf === "string" ? null : entityConf?.mode;
      if (entityId && this._isTimerListEntity(entityId) && (!mode || mode === "auto" || mode === "timer_list")) lists.push(entityId);
    }
    return lists.length === 1 ? lists[0] : null;
  }

  _timerListsInArea(areaId) {
    const out = [];
    for (const entityId of Object.keys(this.hass?.states || {})) {
      if (!entityId.startsWith("timer_list.")) continue;
      if (this._registryInfo(entityId).areaId !== areaId) continue;
      if (!this._timerListFeatures(this.hass.states[entityId]).create) continue;
      out.push(entityId);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }

  // === Start-on picker (v3.0.0) ===

  _pickerTimerLists() {
    return (this._knownTimerLists || []).filter((id) => this._timerListFeatures(this.hass?.states?.[id]).create);
  }

  // Speakers a timer can be put on: timer lists other than the companion.
  _speakerLists() {
    return this._pickerTimerLists().filter((id) => !this._isCompanionList(id));
  }

  _showTargetPicker() {
    const mode = String(this._config?.target_picker ?? "auto").toLowerCase();
    if (mode === "never" || mode === "false") return false;
    return this._speakerLists().length > 0;
  }

  // The speaker picked in the custom timer panel, if it is still valid.
  _activeTargetChoice() {
    const choice = this._targetChoice;
    if (typeof choice !== "string" || !choice.startsWith("list:")) return null;
    const entity = choice.slice(5);
    return this._speakerLists().includes(entity) ? { kind: "timer_list", entity } : null;
  }

  // The speaker a new timer goes to: the pick, else a default speaker.
  _currentSpeaker() {
    const active = this._activeTargetChoice();
    if (active) return active.entity;
    const list = this._resolveTimerListTarget(null);
    return list && !this._isCompanionList(list) ? list : null;
  }

  _currentTargetValue() {
    const speaker = this._currentSpeaker();
    return speaker ? `list:${speaker}` : "";
  }

  _timerListChipLabel(entityId) {
    return this._deviceNameFor({
      source: "timer_list",
      source_entity: entityId,
      device_base_name: this._timerListBaseName(this.hass?.states?.[entityId], this._getEntityConfig(entityId)),
    });
  }

  _targetDestination(entityId) {
    const info = this._registryInfo(entityId);
    const title = this._timerListChipLabel(entityId);
    const ent = this.hass?.entities?.[entityId];
    const dev = ent?.device_id ? this.hass?.devices?.[ent.device_id] : null;
    const model = dev?.model && !title.toLowerCase().includes(String(dev.model).toLowerCase()) ? dev.model : null;
    const phone = ent?.platform === "mobile_app";
    const icon = phone ? "mdi:cellphone" : ent?.platform === "voip" ? "mdi:phone-classic" : "mdi:speaker";
    return {
      value: `list:${entityId}`, icon, order: phone ? 1 : 0, group: phone ? "phones" : "speakers", title,
      sub: [info.area, model].filter(Boolean).join(" · "), area: info.area || "",
      search: [title, info.area, info.device, model, entityId].filter(Boolean).join(" ").toLowerCase(),
    };
  }

  // Speakers, then phones, sorted by area so a house full of them stays easy to scan.
  _targetDestinations() {
    return this._speakerLists().map((id) => this._targetDestination(id))
      .sort((a, b) => a.order - b.order || String(a.area || "").localeCompare(String(b.area || "")) || a.title.localeCompare(b.title));
  }

  // "Put on a speaker" is optional: a link, or the chosen speaker as a pill.
  // A timer that does something when it ends stays in Home Assistant, so the
  // two choices exclude each other.
  _renderTargetLine(which) {
    if (!this._showTargetPicker()) return "";
    if (this._actionPickerEnabled() && this._actionDraftSpec()) return "";
    const speaker = this._currentSpeaker();
    if (!speaker) {
      return html`
        <div class="action-entry">
          <button type="button" class="action-link" @click=${() => this._openActionWizard(which, "target")}>
            <ha-icon icon="mdi:speaker"></ha-icon>${this._localize("put_on_speaker")}
          </button>
        </div>
      `;
    }
    const dest = this._targetDestination(speaker);
    return html`
      <div class="action-entry">
        <span class="action-pill">
          <button type="button" class="action-pill-main" @click=${() => this._openActionWizard(which, "target")}>
            <ha-icon icon=${dest.icon}></ha-icon><span>${dest.title}</span>
          </button>
          ${this._activeTargetChoice() ? html`
            <button type="button" class="action-pill-clear" aria-label=${this._localize("close")}
              @click=${() => { this._targetChoice = null; }}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>` : ""}
        </span>
      </div>
    `;
  }

  _renderTargetList() {
    const all = this._targetDestinations();
    const query = String(this._targetQuery || "").trim().toLowerCase();
    const current = this._currentTargetValue();
    const shown = query ? all.filter((d) => d.search.includes(query)) : all;
    const pick = (value) => { this._targetChoice = value; this._targetQuery = ""; this._closeActionWizard(true); };
    return html`
      ${all.length > 5 ? html`
        <input class="text-input wizard-input" type="search"
          .value=${this._targetQuery || ""}
          placeholder=${this._localize("search_targets")}
          aria-label=${this._localize("search_targets")}
          @input=${(e) => { this._targetQuery = e.target.value; this.requestUpdate(); }}>` : ""}
      <div class="wizard-list" role="listbox" aria-label=${this._localize("put_on_speaker")}>
        ${shown.map((d, i) => html`
          ${!query && d.group !== shown[i - 1]?.group && new Set(all.map((x) => x.group)).size > 1 ? html`<div class="wizard-section">${this._localize(d.group)}</div>` : ""}
          <button type="button" class="wizard-row ${d.value === current ? "selected" : ""}" role="option"
            aria-selected=${String(d.value === current)} @click=${() => pick(d.value)}>
            <ha-icon class="row-icon" icon=${d.icon}></ha-icon>
            <span class="row-text"><span class="row-title">${d.title}</span>${d.sub ? html`<span class="row-sub">${d.sub}</span>` : ""}</span>
            ${d.value === current ? html`<ha-icon class="row-check" icon="mdi:check"></ha-icon>` : ""}
          </button>
        `)}
      </div>
    `;
  }

  _renderTargetPicker(which) {
    // A speaker timer cannot run an action, so a chosen speaker hides the link.
    return html`${this._activeTargetChoice() ? "" : this._renderActionEntry(which)}${this._renderTargetLine(which)}`;
  }

  // === Action timers via the companion integration (v3.0.0) ===
  //
  // An action spec is { name, icon, command } or { name, icon, actions } where
  // actions is a Home Assistant action list. The companion runs it when the
  // timer ends, in Home Assistant, with no dashboard open.

  _normalizeActionSpec(value) {
    if (!value) return null;
    const conf = typeof value === "string" ? { entity: value } : (typeof value === "object" ? value : null);
    if (!conf) return null;
    const name = conf.name ? String(conf.name) : "";
    const icon = conf.icon ? String(conf.icon) : "";
    if (conf.command != null && String(conf.command).trim()) {
      return { key: `command:${String(conf.command).trim()}`, name, icon, command: String(conf.command).trim() };
    }
    if (Array.isArray(conf.actions) && conf.actions.length) {
      return { key: `actions:${JSON.stringify(conf.actions)}`, name, icon, actions: conf.actions };
    }
    const announce = String(conf.announce || "").trim();
    if (announce) {
      const message = conf.message ? String(conf.message).trim() : "";
      const actions = ENTITY_ID_RE.test(announce) ? this._announceActions(announce, message || this._localize("announce_plain")) : null;
      if (!actions) return null;
      return { key: `announce:${announce}:${message}`, name, icon: icon || "mdi:bullhorn-outline", announce, message, actions };
    }
    const entity = String(conf.entity || conf.entity_id || "").trim();
    if (!ENTITY_ID_RE.test(entity)) return null;
    let service = String(conf.service || conf.action || "turn_off").trim();
    if (!service.includes(".")) service = `${entity.split(".")[0]}.${service}`;
    if (!ENTITY_ID_RE.test(service)) return null;
    const step = { action: service, target: { entity_id: entity } };
    if (conf.data && typeof conf.data === "object") step.data = conf.data;
    return { key: `${entity}:${service}`, name, icon, entity, service, actions: [step] };
  }

  _favoriteActions() {
    const raw = Array.isArray(this._config?.device_timers) ? this._config.device_timers : [];
    return raw.map((entry) => this._normalizeActionSpec(entry)).filter(Boolean);
  }

  _actionPickerEnabled() {
    if (this._config?.action_timers === false) return false;
    return !!this._companionList();
  }

  // === Announce on a speaker (v3.0.0) ===
  //
  // The companion's announce service picks the method when the timer ends:
  // satellites announce natively, Alexa Media Player speakers through
  // notify.alexa_media, other media players through TTS with the preferred
  // Assist pipeline's voice.

  _canAnnounceOn(entityId) {
    const domain = String(entityId || "").split(".")[0];
    if (domain === "assist_satellite") return true;
    if (domain !== "media_player") return false;
    if (this.hass?.entities?.[entityId]?.platform === "alexa_media") return true;
    return Object.keys(this.hass?.states || {}).some((id) => id.startsWith("tts."));
  }

  _announceActions(entityId, message) {
    if (!this._canAnnounceOn(entityId)) return null;
    return [{ action: `${COMPANION_DOMAIN}.announce`, data: { entity_id: entityId, message } }];
  }

  // The speaker an announce step speaks on, or null for other actions.
  _announceTarget(step) {
    const service = step?.action || step?.service;
    let id = null;
    if (service === `${COMPANION_DOMAIN}.announce`) id = step.data?.entity_id;
    else if (service === "assist_satellite.announce") id = step.target?.entity_id ?? step.entity_id;
    else if (service === "notify.alexa_media") id = step.data?.target;
    else if (service === "tts.speak") id = step.data?.media_player_entity_id;
    else return null;
    return Array.isArray(id) ? (id[0] || null) : (id || null);
  }

  _searchAnnounceSpeakers(query) {
    const q = String(query || "").trim().toLowerCase();
    const out = [];
    for (const [id, st] of Object.entries(this.hass?.states || {})) {
      const domain = id.split(".")[0];
      const features = Number(st?.attributes?.supported_features) || 0;
      if (domain === "assist_satellite") {
        if (!(features & 1)) continue;
      } else if (domain === "media_player") {
        if (!(features & 512) || !this._canAnnounceOn(id)) continue;
      } else continue;
      if (this.hass?.entities?.[id]?.hidden) continue;
      const info = this._registryInfo(id);
      if (q && ![this._entityName(id), info.area, info.device, id].filter(Boolean).join(" ").toLowerCase().includes(q)) continue;
      out.push({ id, area: info.area || "\uffff", name: this._entityName(id) });
    }
    return out.sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name)).map((x) => x.id);
  }

  _serviceLabel(service) {
    const [domain, name] = String(service || "").split(".");
    if (!domain || !name) return service || "";
    const localized = this.hass?.localize?.(`component.${domain}.services.${name}.name`);
    if (localized) return localized;
    const described = this.hass?.services?.[domain]?.[name]?.name;
    if (described) return described;
    const words = name.replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  _entityName(entityId) {
    return this.hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
  }

  // Short text for what a timer will do: the command itself, or "Turn off Air purifier".
  _actionSummary(action) {
    if (!action || typeof action !== "object") return "";
    if (action.command) return String(action.command);
    const steps = Array.isArray(action.actions) ? action.actions : [];
    const step = steps[0];
    if (!step || typeof step !== "object") return "";
    const speaker = this._announceTarget(step);
    if (speaker) {
      const said = this._localize("announce_on").replace("{speaker}", this._entityName(speaker));
      return steps.length > 1 ? `${said} +${steps.length - 1}` : said;
    }
    const service = step.action || step.service || "";
    const targets = step.target?.entity_id ?? step.entity_id ?? step.data?.entity_id;
    const ids = Array.isArray(targets) ? targets : (targets ? [targets] : []);
    const names = ids.map((id) => this._entityName(id)).join(", ");
    const text = `${this._serviceLabel(service)}${names ? ` ${names}` : ""}`.trim();
    return steps.length > 1 ? `${text} +${steps.length - 1}` : text;
  }

  // Services the entity's domain offers that need no extra fields, plus the
  // generic on/off/toggle, so any device and most of its actions can be picked.
  _servicesForEntity(entityId) {
    const domain = String(entityId || "").split(".")[0];
    if (!domain) return [];
    const out = [];
    const services = this.hass?.services?.[domain] || {};
    for (const [name, desc] of Object.entries(services)) {
      const fields = desc?.fields || {};
      // Skip domain-wide services such as reload, which take no target.
      if (desc && !desc.target && !fields.entity_id) continue;
      const needsInput = Object.entries(fields).some(([key, f]) => f?.required && key !== "entity_id");
      if (!needsInput) out.push(`${domain}.${name}`);
    }
    for (const generic of ["homeassistant.turn_on", "homeassistant.turn_off", "homeassistant.toggle"]) {
      const short = generic.split(".")[1];
      if (!out.includes(`${domain}.${short}`)) out.push(generic);
    }
    return out;
  }

  // Entities that can be the target of a timer action, best matches first.
  // Uses the card's own search so it works on dashboards where Home
  // Assistant has not loaded its entity picker.
  _searchActionEntities(query, limit = 8) {
    const domains = new Set(["light", "switch", "fan", "cover", "lock", "climate", "media_player", "input_boolean",
      "scene", "script", "vacuum", "valve", "humidifier", "water_heater", "siren", "button", "input_button", "automation", "remote", "lawn_mower"]);
    const q = String(query || "").trim().toLowerCase();
    const out = [];
    for (const [id, st] of Object.entries(this.hass?.states || {})) {
      if (!domains.has(id.split(".")[0]) || st?.state === "unavailable") continue;
      if (!q) break;
      const name = String(st?.attributes?.friendly_name || id).toLowerCase();
      const area = String(this._registryInfo(id).area || "").toLowerCase();
      let score;
      if (name.startsWith(q)) score = 0;
      else if (name.includes(q) || id.includes(q)) score = 1;
      else if (area.includes(q)) score = 2;
      else continue;
      out.push({ id, name, score });
    }
    if (!q) return [];
    out.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
    return out.slice(0, limit).map((e) => e.id);
  }

  _actionDraftSpec() {
    const draft = this._actionDraft;
    if (!draft || !draft.mode || draft.mode === "none") return null;
    if (draft.mode === "command") return this._normalizeActionSpec({ command: draft.command });
    if (draft.mode === "device") return this._normalizeActionSpec({ entity: draft.entity, service: draft.service });
    if (draft.mode === "announce") return draft.speaker ? this._normalizeActionSpec({ announce: draft.speaker, message: draft.message }) : null;
    if (draft.mode.startsWith("fav:")) return this._favoriteActions().find((f) => `fav:${f.key}` === draft.mode) || null;
    return null;
  }

  _setActionDraft(patch) {
    this._actionDraft = { ...(this._actionDraft || { mode: "none" }), ...patch };
  }

  // The custom panel stays simple: one link (or a summary of the chosen
  // action). Everything else happens in a short wizard inside the panel.
  _renderActionEntry(which) {
    if (!this._actionPickerEnabled()) return "";
    const spec = this._actionDraftSpec();
    if (!spec) {
      return html`
        <div class="action-entry">
          <button type="button" class="action-link" @click=${() => this._openActionWizard(which, "type")}>
            <ha-icon icon="mdi:plus-circle-outline"></ha-icon>${this._localize("add_action")}
          </button>
        </div>
      `;
    }
    const draft = this._actionDraft || {};
    const step = { command: "command", device: "action", announce: "announce" }[draft.mode] || "type";
    return html`
      <div class="action-entry">
        <span class="action-pill">
          <button type="button" class="action-pill-main" @click=${() => this._openActionWizard(which, step)}>
            <ha-icon icon=${this._actionIcon(spec)}></ha-icon><span>${this._actionPillText(spec)}</span>
          </button>
          <button type="button" class="action-pill-clear" aria-label=${this._localize("close")}
            @click=${() => { this._actionDraft = { mode: "none" }; }}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </span>
      </div>
    `;
  }

  _openActionWizard(which, step) {
    this._wizardPrev = { ...(this._actionDraft || { mode: "none" }) };
    this._actionWizard = { which, step };
  }

  _closeActionWizard(keep) {
    if (!keep && this._wizardPrev) this._actionDraft = this._wizardPrev;
    this._targetQuery = "";
    this._wizardPrev = null;
    this._actionWizard = null;
  }

  _wizardStep(step) {
    this._actionWizard = { ...this._actionWizard, step };
  }

  _domainIcon(entityId) {
    const icons = {
      light: "mdi:lightbulb", switch: "mdi:toggle-switch-variant", fan: "mdi:fan", cover: "mdi:window-shutter",
      lock: "mdi:lock", climate: "mdi:thermostat", media_player: "mdi:cast", input_boolean: "mdi:toggle-switch-outline",
      scene: "mdi:palette", script: "mdi:script-text-outline", vacuum: "mdi:robot-vacuum", valve: "mdi:valve",
      humidifier: "mdi:air-humidifier", water_heater: "mdi:water-boiler", siren: "mdi:bullhorn", button: "mdi:gesture-tap-button",
      input_button: "mdi:gesture-tap-button", automation: "mdi:robot", remote: "mdi:remote", lawn_mower: "mdi:robot-mower",
    };
    const st = this.hass?.states?.[entityId];
    return st?.attributes?.icon || icons[String(entityId).split(".")[0]] || "mdi:devices";
  }

  _serviceIcon(service) {
    const name = String(service || "").split(".")[1] || "";
    const icons = {
      turn_off: "mdi:power-off", turn_on: "mdi:power", toggle: "mdi:swap-horizontal", open_cover: "mdi:arrow-up-box",
      close_cover: "mdi:arrow-down-box", stop_cover: "mdi:stop", lock: "mdi:lock", unlock: "mdi:lock-open-variant",
      open: "mdi:lock-open-variant", media_pause: "mdi:pause", media_play: "mdi:play", media_stop: "mdi:stop",
      media_play_pause: "mdi:play-pause", start: "mdi:play", stop: "mdi:stop", pause: "mdi:pause",
      return_to_base: "mdi:home-import-outline", press: "mdi:gesture-tap", trigger: "mdi:play", open_valve: "mdi:valve-open",
      close_valve: "mdi:valve-closed", volume_mute: "mdi:volume-off",
    };
    return icons[name] || "mdi:play-circle-outline";
  }

  _actionIcon(spec) {
    if (spec?.icon) return spec.icon;
    if (spec?.command) return "mdi:microphone-message";
    const step = Array.isArray(spec?.actions) ? spec.actions[0] : null;
    return this._serviceIcon(step?.action || step?.service);
  }

  // "Turn off · Air purifier, Living room": the area tells similar names apart.
  _actionPillText(spec) {
    if (spec.name) return spec.name;
    if (spec.command) return `“${spec.command}”`;
    if (spec.announce) {
      const area = this._registryInfo(spec.announce).area;
      return `${this._actionSummary(spec)}${area ? `, ${area}` : ""}`;
    }
    if (spec.entity) {
      const area = this._registryInfo(spec.entity).area;
      return `${this._serviceLabel(spec.service)} · ${this._entityName(spec.entity)}${area ? `, ${area}` : ""}`;
    }
    return this._actionSummary(spec);
  }

  _renderEntityRow(entityId, onClick) {
    const info = this._registryInfo(entityId);
    const name = this._entityName(entityId);
    const ent = this.hass?.entities?.[entityId];
    const model = ent?.device_id ? this.hass?.devices?.[ent.device_id]?.model : null;
    // Area, device and model tell apart entities that share a name, such as
    // an Alexa and a Sonos entity both called after the room.
    const parts = [info.area, info.device, model].filter((part, i, all) => part && part !== name && all.indexOf(part) === i);
    const sub = parts.join(" · ");
    return html`
      <button type="button" class="wizard-row" @click=${onClick}>
        <ha-icon class="row-icon" icon=${this._domainIcon(entityId)}></ha-icon>
        <span class="row-text">
          <span class="row-title">${this._entityName(entityId)}</span>
          ${sub ? html`<span class="row-sub">${sub}</span>` : ""}
          <span class="row-id">${entityId}</span>
        </span>
      </button>
    `;
  }

  _renderActionWizard() {
    const step = this._actionWizard?.step || "type";
    const draft = this._actionDraft || { mode: "none" };
    const back = { device: "type", command: "type", action: "device", speaker: "type", announce: "speaker" }[step];
    const titles = {
      target: this._localize("put_on_speaker"),
      type: this._localize("when_it_ends"),
      device: this._localize("control_device_title"),
      action: this._localize("what_to_do"),
      command: this._localize("run_command_title"),
      speaker: this._localize("choose_speaker"),
      announce: this._localize("announce_title"),
    };
    const head = html`
      <div class="wizard-head">
        ${back ? html`
          <button type="button" class="wizard-icon-btn" aria-label=${this._localize("back")} @click=${() => this._wizardStep(back)}>
            <ha-icon icon=${this._isRTL() ? "mdi:arrow-right" : "mdi:arrow-left"}></ha-icon>
          </button>` : html`<span class="wizard-icon-spacer"></span>`}
        <span class="wizard-title">${titles[step]}</span>
        <button type="button" class="wizard-icon-btn" aria-label=${this._localize("close")} @click=${() => this._closeActionWizard(false)}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
    `;
    let body;
    if (step === "target") {
      body = this._renderTargetList();
    } else if (step === "type") {
      const favorites = this._favoriteActions();
      body = html`
        <div class="wizard-list">
          <button type="button" class="wizard-row" @click=${() => { this._setActionDraft({ mode: "device" }); this._wizardStep(draft.entity ? "action" : "device"); }}>
            <ha-icon class="row-icon" icon="mdi:power-plug-outline"></ha-icon>
            <span class="row-text"><span class="row-title">${this._localize("control_device_title")}</span><span class="row-sub">${this._localize("control_device_desc")}</span></span>
          </button>
          <button type="button" class="wizard-row" @click=${() => { this._setActionDraft({ mode: "command" }); this._wizardStep("command"); }}>
            <ha-icon class="row-icon" icon="mdi:microphone-message"></ha-icon>
            <span class="row-text"><span class="row-title">${this._localize("run_command_title")}</span><span class="row-sub">${this._localize("run_command_desc")}</span></span>
          </button>
          <button type="button" class="wizard-row" @click=${() => { this._setActionDraft({ mode: "announce" }); this._wizardStep(draft.speaker ? "announce" : "speaker"); }}>
            <ha-icon class="row-icon" icon="mdi:bullhorn-outline"></ha-icon>
            <span class="row-text"><span class="row-title">${this._localize("announce_title")}</span><span class="row-sub">${this._localize("announce_desc")}</span></span>
          </button>
          ${favorites.length ? html`
            <div class="wizard-section">${this._localize("quick_actions")}</div>
            ${favorites.map((f) => html`
              <button type="button" class="wizard-row" @click=${() => { this._actionDraft = { mode: `fav:${f.key}` }; this._closeActionWizard(true); }}>
                <ha-icon class="row-icon" icon=${this._actionIcon(f)}></ha-icon>
                <span class="row-text"><span class="row-title">${f.name || this._actionSummary(f)}</span>
                  ${f.name ? html`<span class="row-sub">${this._actionSummary(f)}</span>` : ""}</span>
              </button>
            `)}
          ` : ""}
        </div>
      `;
    } else if (step === "device") {
      const results = this._searchActionEntities(draft.query);
      body = html`
        <input class="text-input wizard-input" type="search" autofocus
          .value=${draft.query || ""}
          placeholder=${this._localize("search_devices")}
          aria-label=${this._localize("search_devices")}
          @input=${(e) => this._setActionDraft({ query: e.target.value })}>
        <div class="wizard-list">
          ${results.length
            ? results.map((id) => this._renderEntityRow(id, () => { this._setActionDraft({ entity: id, service: "", query: "" }); this._wizardStep("action"); }))
            : html`<div class="wizard-hint">${this._localize("type_to_search")}</div>`}
        </div>
      `;
    } else if (step === "action") {
      const services = this._servicesForEntity(draft.entity);
      body = html`
        ${draft.entity ? this._renderEntityRow(draft.entity, () => this._wizardStep("device")) : ""}
        <div class="wizard-list">
          ${services.map((sv) => html`
            <button type="button" class="wizard-row compact" @click=${() => { this._setActionDraft({ mode: "device", service: sv }); this._closeActionWizard(true); }}>
              <ha-icon class="row-icon" icon=${this._serviceIcon(sv)}></ha-icon>
              <span class="row-text"><span class="row-title">${this._serviceLabel(sv)}</span></span>
            </button>
          `)}
        </div>
      `;
    } else if (step === "speaker") {
      const results = this._searchAnnounceSpeakers(draft.speakerQuery);
      body = html`
        <input class="text-input wizard-input" type="search"
          .value=${draft.speakerQuery || ""}
          placeholder=${this._localize("search_targets")}
          aria-label=${this._localize("search_targets")}
          @input=${(e) => this._setActionDraft({ speakerQuery: e.target.value })}>
        <div class="wizard-list">
          ${results.length
            ? results.map((id) => this._renderEntityRow(id, () => { this._setActionDraft({ mode: "announce", speaker: id, speakerQuery: "" }); this._wizardStep("announce"); }))
            : html`<div class="wizard-hint">${this._localize("type_to_search")}</div>`}
        </div>
      `;
    } else if (step === "announce") {
      const finish = () => { this._setActionDraft({ mode: "announce" }); this._closeActionWizard(true); };
      body = html`
        ${draft.speaker ? this._renderEntityRow(draft.speaker, () => this._wizardStep("speaker")) : ""}
        <input class="text-input wizard-input" type="text"
          .value=${draft.message || ""}
          placeholder=${this._localize("announce_plain")}
          aria-label=${this._localize("announce_message")}
          @input=${(e) => this._setActionDraft({ message: e.target.value })}
          @keydown=${(e) => { if (e.key === "Enter") finish(); }}>
        <div class="wizard-hint">${this._localize("announce_message")}</div>
        <div class="picker-actions">
          <button type="button" class="btn btn-primary" ?disabled=${!draft.speaker} @click=${finish}>${this._localize("done")}</button>
        </div>
      `;
    } else {
      const ready = !!String(draft.command || "").trim();
      body = html`
        <input class="text-input wizard-input" type="text" autofocus
          .value=${draft.command || ""}
          placeholder=${this._localize("command_placeholder")}
          aria-label=${this._localize("run_command_title")}
          @input=${(e) => this._setActionDraft({ command: e.target.value })}
          @keydown=${(e) => { if (e.key === "Enter" && String(e.target.value).trim()) { this._setActionDraft({ mode: "command" }); this._closeActionWizard(true); } }}>
        <div class="wizard-hint">${this._localize("run_command_desc")}</div>
        <div class="picker-actions">
          <button type="button" class="btn btn-primary" ?disabled=${!ready}
            @click=${() => { this._setActionDraft({ mode: "command" }); this._closeActionWizard(true); }}>${this._localize("done")}</button>
        </div>
      `;
    }
    return html`<div class="wizard">${head}${body}</div>`;
  }

  // Starts a timer that runs an action. Returns false when it cannot start.
  _createActionTimer(spec, durationMs, label, overrides = {}) {
    const listId = this._companionList();
    if (!listId) {
      this._toast(this._localize("needs_companion"));
      return false;
    }
    if (!spec) return false;
    const name = label && String(label).trim() ? String(label).trim() : (spec.name || "");
    const meta = this._timerListMetaFromOverrides({ ...overrides, icon: overrides.icon || spec.icon || undefined });
    let actions = spec.actions;
    if (spec.announce && !spec.message) {
      const message = name ? this._localize("announce_named").replace("{name}", name) : this._localize("announce_plain");
      actions = this._announceActions(spec.announce, message) || actions;
    }
    const extra = spec.command ? { command: spec.command } : { actions };
    this._createTimerListTimer(listId, durationMs, name, meta, extra);
    this.requestUpdate();
    return true;
  }

  _timerListMetaFromOverrides(overrides = {}) {
    const meta = {};
    for (const key of ["pinned_id", "icon", "color", "expired_subtitle", "audio_enabled", "audio_file_url", "audio_repeat_count", "audio_play_until_dismissed"]) {
      if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== "") meta[key] = overrides[key];
    }
    if (Array.isArray(overrides.buttons) && overrides.buttons.length) meta.buttons = overrides.buttons;
    return meta;
  }

  async _createTimerListTimer(entityId, durationMs, name, meta = {}, extra = {}) {
    if (!this.hass || !entityId) return null;
    const seconds = Math.max(1, Math.ceil(Number(durationMs) / 1000));
    const serviceData = { duration: this._formatDurationForService(seconds) };
    const cleanName = name != null && String(name).trim() ? String(name).trim() : "";
    if (cleanName) serviceData.name = cleanName;
    const { domain } = this._timerListApi(entityId);
    if (domain === COMPANION_DOMAIN) {
      // The companion stores card options with the timer, so every dashboard sees them.
      Object.assign(serviceData, extra);
      // The tag lets a browser or MQTT card find the timers it started.
      const metadata = _cleanUndefined({ ...meta, source: "card", card: this._storageNamespace });
      if (meta.icon) serviceData.icon = meta.icon;
      if (meta.color) serviceData.color = meta.color;
      serviceData.metadata = metadata;
    }
    try {
      let timerId = null;
      if (typeof this.hass.callWS === "function") {
        const result = await this.hass.callWS({
          type: "call_service",
          domain,
          service: "create_timer",
          service_data: serviceData,
          target: { entity_id: entityId },
          return_response: true,
        });
        const response = result?.response?.[entityId] ?? result?.response;
        if (response?.timer_id != null) timerId = String(response.timer_id);
      } else {
        await this.hass.callService(domain, "create_timer", { entity_id: entityId, ...serviceData });
      }
      if (timerId) this._setTimerListMeta(entityId, timerId, meta);
      this._publishTimerEvent("started", { source: "timer_list", source_entity: entityId, label: cleanName || this._formatTimerLabel(seconds), duration: seconds * 1000 });
      return timerId || "";
    } catch (err) {
      this._toast(this._localize("timer_start_failed").replace("{error}", err?.message || "?"));
      return null;
    }
  }

  _callTimerListService(timer, service, data = {}, { notifyOnError = true } = {}) {
    if (!this.hass || !timer?.source_entity || timer.timer_list_timer_id == null) return Promise.resolve();
    try {
      const result = this.hass.callService(
        this._timerListApi(timer.source_entity).domain,
        service,
        { entity_id: timer.source_entity, timer_id: String(timer.timer_list_timer_id), ...data },
        undefined,
        notifyOnError
      );
      // Home Assistant shows its own error toast when notifyOnError is true.
      return Promise.resolve(result).catch(() => {});
    } catch (_) {
      return Promise.resolve();
    }
  }

  _timerListUnsupported() {
    this._toast(this._localize("action_not_supported"));
  }

  // Timer lists have no restart, so snooze and restart start a replacement
  // timer with the same name and card-side options, then drop the old one.
  async _replaceTimerListTimer(timer, durationMs) {
    const metaKey = this._timerListMetaKey(timer.source_entity, timer.timer_list_timer_id);
    const meta = this._timerListMeta.get(metaKey) || {};
    const created = await this._createTimerListTimer(timer.source_entity, durationMs, timer.timer_list_name || "", meta);
    if (created === null) return;
    this._dismissed.add(`${timer.source_entity}:${timer.id}`);
    const features = timer.supports || {};
    if (features.remove) await this._callTimerListService(timer, "remove_timer", {}, { notifyOnError: false });
    else if (features.cancel_service) await this._callTimerListService(timer, "cancel_timer", {}, { notifyOnError: false });
    this.requestUpdate();
  }

  // Browser satellites from the Voice Satellite Card integration mirror their
  // timers into an active_timers attribute on the assist_satellite entity.
  // Finished timers leave the list, and the satellite rings by itself.
  _parseVoiceSatellite(entityId, entityState, entityConf) {
    const raw = entityState?.attributes?.active_timers;
    if (!Array.isArray(raw) || !raw.length) return [];
    const now = Date.now();
    const baseName = (entityConf?.name && String(entityConf.name).trim()) || entityState.attributes?.friendly_name || entityId;
    const out = [];
    raw.forEach((item, index) => {
      const total = Number(item?.total_seconds);
      if (!Number.isFinite(total) || total <= 0) return;
      const startedSec = Number(item?.started_at);
      const startedMs = Number.isFinite(startedSec) && startedSec > 0 ? startedSec * 1000 : now;
      // Older integration versions omit is_active and only list running timers.
      const active = item?.is_active !== false;
      // While paused, total_seconds is the time left and started_at the pause moment.
      const remainingMs = Math.max(0, total * 1000 - (active ? Math.max(0, now - startedMs) : 0));
      const spoken = (Number(item?.start_hours) || 0) * 3600 + (Number(item?.start_minutes) || 0) * 60 + (Number(item?.start_seconds) || 0);
      const durationMs = Math.max(total, spoken) * 1000;
      const name = item?.name && String(item.name).trim() ? this._sanitizeText(String(item.name).trim()) : "";
      const shortLabel = this._formatTimerLabel(Math.round(durationMs / 1000));
      const label = name || this._sanitizeText(`${baseName} - ${this._formatDurationDisplay(durationMs)}`);
      const timer = {
        id: `voice_satellite:${entityId}:${item?.id || index}`,
        source: "voice_satellite",
        source_entity: entityId,
        label,
        name: label,
        short_label: name ? null : shortLabel,
        device_base_name: baseName,
        icon: entityConf?.icon || "mdi:timer",
        color: entityConf?.color || "var(--primary-color)",
        duration: durationMs,
        idle: false,
        finished: false,
      };
      if (active) out.push({ ...timer, paused: false, end: now + remainingMs });
      else out.push({ ...timer, paused: true, end: remainingMs, remaining_ms: remainingMs });
    });
    return out;
  }

  _parseInstant(value) {
    if (value == null || value === "" || value === "unknown" || value === "unavailable") return null;
    if (typeof value === "number" || (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()))) {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return null;
      return n < 1e11 ? n * 1000 : n;
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Elapsed-time rows ("fed 1h 40m ago") from a past timestamp.
  _parseCountUp(entityId, entityState, entityConf) {
    const attrs = entityState?.attributes || {};
    let raw;
    if (entityConf?.attribute) raw = attrs[entityConf.attribute];
    else if (entityConf?.use_last_changed === true) raw = entityState.last_changed;
    else if (entityId.startsWith("input_datetime.") && attrs.timestamp != null && attrs.has_date !== false) raw = Number(attrs.timestamp);
    else raw = entityState?.state;
    const startTs = this._parseInstant(raw);
    if (!startTs || startTs > Date.now() + 1000) return [];
    const goalMs = entityConf?.goal != null && entityConf.goal !== "" ? (this._parseDurationInputToMs(entityConf.goal) || 0) : 0;
    return [{
      id: `count_up:${entityId}`,
      source: "count_up",
      source_entity: entityId,
      count_up: true,
      start_ts: startTs,
      label: this._sanitizeText(entityConf?.name || attrs.friendly_name || entityId),
      icon: entityConf?.icon || attrs.icon || "mdi:history",
      color: entityConf?.color || "var(--primary-color)",
      duration: goalMs,
      paused: false,
      idle: false,
      finished: false,
    }];
  }

  // === Template rows (v3.0.0) ===
  // timers_template is rendered by Home Assistant over render_template and
  // must produce a JSON list of rows.

  _syncTemplateSubscription() {
    const template = typeof this._config?.timers_template === "string" ? this._config.timers_template.trim() : "";
    const conn = this.hass?.connection;
    if (!template || !conn || typeof conn.subscribeMessage !== "function") {
      this._dropTemplateSubscription();
      return;
    }
    if (this._templateSub && this._templateSub.template === template && this._templateSub.conn === conn) return;
    this._dropTemplateSubscription();
    const sub = { template, conn, entries: [], unsub: null, error: null };
    this._templateSub = sub;
    let pending;
    try {
      pending = conn.subscribeMessage((msg) => {
        if (this._templateSub !== sub || !msg) return;
        if ("result" in msg) {
          sub.entries = this._normalizeTemplateResult(msg.result);
          sub.error = null;
        } else if (msg.error) {
          sub.error = msg.error;
          if (!sub.warned) {
            sub.warned = true;
            console.warn("simple-timer-card: timers_template error:", msg.error);
          }
          return;
        }
        if (this.isConnected) this._updateTimers();
      }, { type: "render_template", template, report_errors: true });
    } catch (err) {
      pending = Promise.reject(err);
    }
    Promise.resolve(pending).then((unsub) => {
      if (this._templateSub !== sub) this._safeUnsubscribe(unsub);
      else sub.unsub = unsub;
    }, (err) => {
      if (this._templateSub === sub) sub.error = err;
    });
  }

  _dropTemplateSubscription() {
    const sub = this._templateSub;
    this._templateSub = null;
    if (sub) this._safeUnsubscribe(sub.unsub);
  }

  _normalizeTemplateResult(result) {
    let value = result;
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch (_) { return []; }
    }
    if (!Array.isArray(value)) return [];
    return value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)).slice(0, 50);
  }

  _parseDynamicEntries(entries) {
    const now = Date.now();
    const finishedWindowMs = this._timerListFinishedWindowMs(null);
    const style = this._config?.source_styles?.dynamic || {};
    const out = [];
    entries.forEach((entry, index) => {
      const name = String(entry.name ?? entry.title ?? "").trim();
      const key = entry.id != null ? String(entry.id) : `${index}:${name}`;
      const base = {
        id: `dynamic:${key}`,
        source: "dynamic",
        source_entity: typeof entry.entity === "string" ? entry.entity : "dynamic",
        label: this._sanitizeText(name || this._localize("timer")),
        icon: entry.icon || style.icon || "mdi:timer-outline",
        color: entry.color || style.color || "var(--primary-color)",
        idle: false,
        finished: false,
        paused: false,
      };
      if (entry.expired_subtitle) base.expired_subtitle = String(entry.expired_subtitle);
      const since = this._parseInstant(entry.since ?? (entry.mode === "count_up" ? entry.start : undefined));
      if (since) {
        const goalMs = entry.goal != null ? (this._parseDurationInputToMs(entry.goal) || 0) : 0;
        if (since <= now + 1000) out.push({ ...base, count_up: true, start_ts: since, duration: goalMs });
        return;
      }
      const end = this._parseInstant(entry.end ?? entry.finishes_at ?? entry.target);
      if (!end) return;
      if (end < now && now - end > finishedWindowMs) return;
      const start = this._parseInstant(entry.start);
      const durationMs = start && start < end
        ? end - start
        : (entry.duration != null ? (this._parseDurationInputToMs(entry.duration) || 0) : 0);
      out.push({ ...base, end, duration: durationMs });
    });
    return out;
  }

  _parseHMSToMs(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 3) return (parts[0]*3600 + parts[1]*60 + parts[2]) * 1000;
    if (parts.length === 2) return (parts[0]*60 + parts[1]) * 1000;
    return 0;
  }


  _isLocalVoicePETimer(timer) {
    return timer?.source === "voice_pe"
      && timer?.control_entity
      && String(timer.control_entity).trim()
      && timer?.voice_pe_timer_id
      && String(timer.voice_pe_timer_id).trim()
      && timer.supports?.pause === true;
  }

  async _sendVoicePECommand(controlEntity, command) {
    if (!this.hass) return;
    if (!controlEntity || !command) return;

    const entityId = String(controlEntity).trim();
    const domain = entityId.split(".")[0];
    if (domain !== "text" && domain !== "input_text") {
      this._toast("Invalid control entity for Voice PE timers.");
      return;
    }

    await this.hass.callService(domain, "set_value", {
      entity_id: entityId,
      value: String(command),
    });
  }

  _getVoicePEControlEntity(preferredTimerEntityId) {
    try {
      const st = preferredTimerEntityId ? this.hass?.states?.[preferredTimerEntityId] : null;
      const fromAttr = st?.attributes?.control_entity ? String(st.attributes.control_entity).trim() : "";
      if (fromAttr) return fromAttr;
    } catch (_) {}

    const fromCfg = this._config?.voice_pe_control_entity ? String(this._config.voice_pe_control_entity).trim() : "";
    if (fromCfg) return fromCfg;

    try {
      const states = this.hass?.states || {};
      const candidates = Object.keys(states)
        .filter((id) => (id.startsWith("text.") || id.startsWith("input_text.")) && id.toLowerCase().includes("voice_pe_timer_command"))
        .sort((a, b) => a.localeCompare(b));
      return candidates.length ? candidates[0] : null;
    } catch (_) {
      return null;
    }
  }


  async _sendVoicePEStart(durationMs, name, targetEntityId) {
    const seconds = Math.max(1, Math.ceil(durationMs / 1000));
    const controlEntity = this._getVoicePEControlEntity(targetEntityId);

    if (!controlEntity) {
      this._toast("Voice PE control entity is missing.");
      return;
    }

    let cmd = `start:${seconds}`;
    const cleanName = name && String(name).trim() ? String(name).trim().replace(/:/g, " ") : "";
    if (cleanName) cmd = `${cmd}:${cleanName}`;

    await this._sendVoicePECommand(controlEntity, cmd);
  }


  _updateTimers() {
    this._detectWakeFromFreeze();
    if (!this.hass) return;
    this._ensureAutoVoicePEEntities();
    const collected = [];
    const wantedTimerLists = new Set();
    const deviceSources = new Set();
    const sources = [...this._config.entities, ...this._discoverTimerEntities()];
    const defaultEntity = this._config.default_timer_entity;
    const integrationList = this._integrationStorageList();
    if (integrationList && !sources.some((e) => (typeof e === "string" ? e : e?.entity) === integrationList)) {
      sources.push({ entity: integrationList, mode: "timer_list" });
    }
    // Timers created on a default timer list must show even if it is not listed.
    if (this._isTimerListEntity(defaultEntity) &&
        !sources.some((e) => (typeof e === "string" ? e : e?.entity) === defaultEntity)) {
      sources.push({ entity: defaultEntity, mode: "timer_list" });
    }
    for (const entityConfig of sources) {
      const entityId = typeof entityConfig === "string" ? entityConfig : entityConfig.entity;
      const conf = typeof entityConfig === "string" ? {} : entityConfig;
      const st = this.hass.states[entityId];
      if (!st) continue;
      let mode = conf.mode;
      if (!mode || mode === "auto") {
        mode = this._detectMode(entityId, st, conf);
        if (!mode) continue;
      }
      const styled = this._applySourceStyle(mode, conf);
      try {
        if (mode === "alexa") collected.push(...this._parseAlexa(entityId, st, styled));
        else if (mode === "helper") collected.push(...this._parseHelper(entityId, st, styled));
        else if (mode === "google") collected.push(...this._parseGoogle(entityId, st, styled));
        else if (mode === "timer") collected.push(...this._parseTimer(entityId, st, styled));
        else if (mode === "timer_list") {
          wantedTimerLists.add(entityId);
          deviceSources.add(entityId);
          collected.push(...this._parseTimerList(entityId, st, styled));
        }
        else if (mode === "voice_satellite") {
          deviceSources.add(entityId);
          collected.push(...this._parseVoiceSatellite(entityId, st, styled));
        }
        else if (mode === "count_up") collected.push(...this._parseCountUp(entityId, st, styled));
        else if (mode === "voice_pe") collected.push(...this._parseVoicePE(entityId, st, styled));
        else if (mode === "minutes_attr") collected.push(...this._parseMinutesAttr(entityId, st, styled));
        else if (mode === "timestamp") collected.push(...this._parseTimestamp(entityId, st, styled));
      } catch (e) {}
    }
    const ownCompanion = this._ownCompanionList(wantedTimerLists);
    if (ownCompanion) {
      wantedTimerLists.add(ownCompanion);
      try { collected.push(...this._parseTimerList(ownCompanion, this.hass.states[ownCompanion], { mode: "timer_list" }, { ownOnly: true })); } catch (e) {}
    }
    this._syncTimerListSubscriptions(wantedTimerLists);
    this._deviceSourceCount = deviceSources.size;
    this._knownTimerLists = [...wantedTimerLists].sort((a, b) => a.localeCompare(b));
    this._syncTemplateSubscription();
    if (this._templateSub?.entries?.length) {
      try { collected.push(...this._parseDynamicEntries(this._templateSub.entries)); } catch (e) {}
    }

    if (defaultEntity && (defaultEntity.startsWith("input_text.") || defaultEntity.startsWith("text."))) {
      const stDefault = this.hass.states[defaultEntity];
      if (stDefault) {
        try { collected.push(...this._parseHelper(defaultEntity, stDefault, { mode: "helper" })); } catch (e) {}
      }
    }
    // Integration storage still shows browser timers: ones started before the
    // switch, or while the integration was not installed.
    if (["local", "mqtt", "integration"].includes(this._config.storage)) {
      const storageTimers = this._loadTimersFromStorage(this._cardStorage());
      if (this._cardStorage() === "mqtt" && this._mqttLastLoadSource !== "sensor") {
        // Cache/shadow data can be stale after wake-up. Keep rendering it, but
        // block automatic expiry mutations until a fresh sensor snapshot arrives.
        collected.push(...storageTimers.map((t) => ({ ...t, _mqtt_untrusted: true })));
      } else {
        collected.push(...storageTimers);
      }
    }
    const filtered = collected.filter((t) => !(this._dismissed.has(`${t.source_entity}:${t.id}`)));
    const now = Date.now();
    this._timers = filtered.map((t) => {
      const now3 = now;
      const durationMs = typeof t.duration === "number" ? t.duration : 0;

      const endTs = (typeof t.end_ts === "number")
        ? t.end_ts
        : (!t.paused && typeof t.end === "number" ? t.end : null);

      const startTs = (typeof t.start_ts === "number")
        ? t.start_ts
        : (endTs && durationMs ? (endTs - durationMs) : null);

      let remainingMs;
      if (t.kind === "template") remainingMs = durationMs;
      else if (t.count_up) remainingMs = Math.max(0, now3 - (Number(t.start_ts) || now3));
      else if (t.idle) remainingMs = durationMs;
      else if (t.finished) remainingMs = 0;
      else if (t.paused) remainingMs = (typeof t.remaining_ms === "number" ? t.remaining_ms : (typeof t.end === "number" ? t.end : 0));
      else if (endTs) remainingMs = Math.max(0, endTs - now3);
      else remainingMs = 0;

      const state =
        t.state ||
        (t.count_up ? "counting" : null) ||
        (t.finished ? "finished" : (t.idle ? "idle" : (t.paused ? "paused" : (remainingMs <= 0 ? "expired" : "active"))));

      const supports =
        t.supports || {
          pause: ["helper", "local", "mqtt", "timer"].includes(t.source),
          cancel: ["helper", "local", "mqtt", "timer", "alexa"].includes(t.source),
          snooze: ["helper", "local", "mqtt", "timer", "alexa"].includes(t.source),
          extend: ["helper", "local", "mqtt", "timer"].includes(t.source),
        };

      const percent = t.count_up
        ? (durationMs ? Math.min(100, (remainingMs / durationMs) * 100) : 0)
        : (durationMs && remainingMs >= 0
          ? Math.max(0, Math.min(100, ((durationMs - remainingMs) / durationMs) * 100))
          : 0);

      return {
        ...t,
        name: t.name || t.label,
        duration_ms: durationMs,
        start_ts: startTs,
        end_ts: endTs,
        remaining_ms: remainingMs,
        state,
        supports,

        remaining: remainingMs,
        percent,
      };
    }).sort((a, b) => {
      if (a.finished && !b.finished) return 1;
      if (!a.finished && b.finished) return -1;
      const ar0 = Number(a.remaining_ms ?? a.remaining ?? 0);
      const br0 = Number(b.remaining_ms ?? b.remaining ?? 0);
      const ar = isFinite(ar0) ? ar0 : Number.MAX_SAFE_INTEGER;
      const br = isFinite(br0) ? br0 : Number.MAX_SAFE_INTEGER;
      return ar - br;
    });
    this._applyTimerContext(this._timers);
    for (const timer of this._timers) {
      const wasRinging = this._ringingTimers.has(timer.id);
      if (timer.source === "timer" && timer.idle && wasRinging) {
        timer.idle = false;
        timer.remaining = 0;
      }
      // Untrusted (stale cache/shadow) MQTT timers must not ring, play audio, or
      // emit expired events. A backgrounded device waking up could otherwise
      // re-announce a timer that was already dismissed on another device. Once a
      // fresh sensor snapshot arrives the timer becomes trusted and rings then.
      const isNowRinging = timer.remaining <= 0 && !timer.paused && !timer.idle && !timer.count_up && !(timer.source === "mqtt" && timer._mqtt_untrusted);
      if (isNowRinging && !wasRinging) {
        this._ringingTimers.add(timer.id);
        if (this._ringingInitialized) {
          this._playAudioNotification(timer.id, timer);
          this._publishTimerEvent("expired", timer);
        }
      } else if (!isNowRinging && wasRinging) {
        this._ringingTimers.delete(timer.id);
        this._stopAudioForTimer(timer.id);
      }
    }
    this._ringingInitialized = true;
    const ids = new Set(this._timers.map((t) => t.id));
    for (const r of this._ringingTimers) {
      if (!ids.has(r)) {
        this._ringingTimers.delete(r);
        this._stopAudioForTimer(r);
      }
    }
    const now2 = Date.now();
    const audioDelay = (this._config.audio_completion_delay || 4) * 1000;
    for (const timer of [...this._timers]) {
      if (timer.idle || timer.remaining > 0 || timer.paused || timer.count_up) continue;
      if (timer.source === "mqtt" && timer._mqtt_untrusted) continue;
      // Finished timer-list timers are hidden by _parseTimerList once the
      // expire window passes, so automatic expiry never removes them from HA.
      if (timer.source === "timer_list") continue;
      const action = this._config.expire_action;
      if (action === "dismiss") continue;
      if (action === "keep") {
        const isWritable = ["helper", "local", "mqtt"].includes(timer.source);
        let expiredAt;
        if (isWritable) {
          if (!timer.expiredAt) {
            timer.expiredAt = now2;
            this._updateTimerInStorage(timer.id, { expiredAt: now2 }, timer.source);
          }
          expiredAt = timer.expiredAt;
        } else {
          if (!this._expirationTimes.has(timer.id)) this._expirationTimes.set(timer.id, now2);
          expiredAt = this._expirationTimes.get(timer.id);
        }
        const keepMs = (parseInt(this._config.expire_keep_for, 10) || 120) * 1000;
        if (now2 - expiredAt >= keepMs) {
          if (!timer._isBeingRemoved) {
            timer._isBeingRemoved = true;
            this._handleDismiss(timer);
            if (!isWritable) this._expirationTimes.delete(timer.id);
          }
        }
        continue;
      }
      if (action === "remove") {
        const entityConf=this._getEntityConfig(timer.source_entity);
        let isAudioEnabled;
        if (timer && (timer.audio_enabled===true || timer.audio_enabled===false)) isAudioEnabled=timer.audio_enabled===true;
        else if (entityConf && entityConf.audio_enabled!==undefined) isAudioEnabled=entityConf.audio_enabled===true;
        else isAudioEnabled=this._config.audio_enabled===true;
        if (!timer._isBeingRemoved) {
          timer._isBeingRemoved = true;
          const dismissAction = () => this._handleDismiss(timer);
          if (isAudioEnabled) setTimeout(dismissAction, audioDelay);
          else dismissAction();
        }
      }
    }
    const currentIds = new Set(this._timers.map((t) => t.id));
    for (const id of this._expirationTimes.keys()) {
      if (!currentIds.has(id)) this._expirationTimes.delete(id);
    }
    for (const [timerId, audioData] of this._activeAudioInstances.entries()) {
      if (!this._ringingTimers.has(timerId)) this._stopAudioForTimer(timerId);
    }
    if (!this._lastCleanupTime || Date.now() - this._lastCleanupTime > 10000) {
      this._cleanupThrottleMap();
      this._lastCleanupTime = Date.now();
    }
  }

  _ensureAlarmAudio() {
    if (this._alarmAudio) return this._alarmAudio;
    const a = new Audio();
    a.preload = "auto";
    this._alarmAudio = a;
    return a;
  }

  _unlockAudio() {
    if (this._audioUnlocked) return;
    // iOS Safari and the HA Companion App webview gate audio per HTMLAudioElement:
    // a Web Audio context unlock alone is not enough, because each <audio> element
    // needs its own user-gesture-initiated play() before later programmatic plays
    // succeed. We therefore (1) prime a page-wide Web Audio context, and
    // (2) touch the single shared alarm <audio> element that _playAudioNotification
    // will reuse so later alarms (fired from timer callbacks) are allowed.
    let unlocked = false;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        if (!this._audioCtx) this._audioCtx = new Ctx();
        const ctx = this._audioCtx;
        const playSilent = () => {
          try {
            const buf = ctx.createBuffer(1, 1, 22050);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(0);
          } catch (_) {}
        };
        if (ctx.state === "suspended" && typeof ctx.resume === "function") {
          ctx.resume().then(playSilent).catch(() => {});
        } else {
          playSilent();
        }
        unlocked = true;
      }
    } catch (_) {}
    try {
      const audio = this._ensureAlarmAudio();
      audio.src = "data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA";
      audio.volume = 0;
      const restore = () => {
        try { audio.pause(); audio.currentTime = 0; audio.volume = 1; } catch (_) {}
      };
      const p = audio.play();
      if (p && typeof p.then === "function") {
        // Track the unlock's play promise so _playAudioNotification can wait for it
        // to settle before changing src and starting the real alarm; otherwise the
        // unlock's restore() (which calls audio.pause()) races with the alarm play
        // and produces spurious 'audio failed' signals on the first timer of a session.
        this._audioUnlockPlay = p.then(() => { restore(); }, () => { restore(); });
      } else {
        restore();
        this._audioUnlockPlay = Promise.resolve();
      }
      unlocked = true;
    } catch (_) {}
    this._audioUnlocked = unlocked;
  }

  _resolveNotifyConfig() {
    const n = this._config && this._config.notify;
    if (!n || typeof n !== "object") return null;
    if (!n.service || typeof n.service !== "string") return null;
    return n;
  }

  _notifyContext(timer) {
    const name = (timer && (timer.name || timer.friendly_name)) ||
      ((timer && timer.source_entity) ? String(timer.source_entity).split(".").pop() : "Timer");
    return {
      name,
      entity_id: (timer && (timer.source_entity || timer.entity_id)) || "",
      duration: (timer && timer.duration) || "",
    };
  }

  _formatNotifyText(s, ctx) {
    if (typeof s !== "string") return s;
    return s.replace(/\{(name|entity_id|duration)\}/g, (_, k) => (ctx[k] != null ? String(ctx[k]) : ""));
  }

  _dispatchNotify(notifyConf, timer) {
    try {
      const m = String(notifyConf.service).match(/^([a-z0-9_]+)\.([a-z0-9_]+)$/i);
      if (!m) {
        console.warn("[simple-timer-card] notify.service must be in 'domain.service' form, got:", notifyConf.service);
        return;
      }
      const domain = m[1];
      const service = m[2];
      const ctx = this._notifyContext(timer);
      const payload = {};
      if (notifyConf.message != null) payload.message = this._formatNotifyText(String(notifyConf.message), ctx);
      if (notifyConf.title != null) payload.title = this._formatNotifyText(String(notifyConf.title), ctx);
      if (notifyConf.data && typeof notifyConf.data === "object") {
        payload.data = notifyConf.data;
      }
      if (payload.message == null) payload.message = `Timer ${ctx.name} finished`;
      this.hass.callService(domain, service, payload);
    } catch (e) {
      console.warn("[simple-timer-card] notify service call failed:", e?.message || e);
    }
  }

  _playAudioNotification(timerId,timer){
    const entityId = timer?.source_entity || timer?.entity_id || timer?.id || null;
    const entityConf = this._getEntityConfig(entityId);

    const timerHasOverride =
      timer && (
        timer.audio_enabled === true ||
        timer.audio_enabled === false ||
        timer.audio_file_url !== undefined ||
        timer.audio_repeat_count !== undefined ||
        timer.audio_play_until_dismissed !== undefined
      );

    const entityHasOverride =
      entityConf && (
        entityConf.audio_enabled !== undefined ||
        entityConf.audio_file_url !== undefined ||
        entityConf.audio_repeat_count !== undefined ||
        entityConf.audio_play_until_dismissed !== undefined
      );

    let audioEnabled, audioFileUrl, audioRepeatCount, audioPlayUntilDismissed;

    if (timerHasOverride) {
      if (timer.audio_enabled === false) audioEnabled = false;
      else audioEnabled = timer.audio_enabled === true;
      audioFileUrl = timer.audio_file_url;
      audioRepeatCount = timer.audio_repeat_count;
      audioPlayUntilDismissed = timer.audio_play_until_dismissed;
    } else if (entityHasOverride) {
      audioEnabled = entityConf.audio_enabled;
      audioFileUrl = entityConf.audio_file_url;
      audioRepeatCount = entityConf.audio_repeat_count;
      audioPlayUntilDismissed = entityConf.audio_play_until_dismissed;
    } else {
      audioEnabled = this._config.audio_enabled;
      audioFileUrl = this._config.audio_file_url;
      audioRepeatCount = this._config.audio_repeat_count;
      audioPlayUntilDismissed = this._config.audio_play_until_dismissed;
    }

    const notifyConf = this._resolveNotifyConfig();
    const notifyWhen = (notifyConf && notifyConf.when) || "on_audio_fail";
    const fireNotify = (outcome) => {
      if (!notifyConf) return;
      if (notifyWhen === "on_audio_fail" && outcome === "audio_ok") return;
      if (notifyWhen !== "always" && notifyWhen !== "on_audio_fail") return;
      this._dispatchNotify(notifyConf, timer);
    };

    if (!audioEnabled || !audioFileUrl || !this._validateAudioUrl(audioFileUrl)) {
      fireNotify("no_audio");
      return;
    }
    if (notifyConf && notifyWhen === "always") {
      fireNotify("always");
    }
    this._stopAudioForTimer(timerId);
    try {
      const audio = this._ensureAlarmAudio();
      // Wait for any in-flight unlock play to settle so its async restore()
      // (audio.pause()) cannot race with our alarm playback. Falls through
      // immediately if there is no unlock in flight.
      const unlockSettled = (this._audioUnlockPlay && typeof this._audioUnlockPlay.then === "function")
        ? this._audioUnlockPlay
        : Promise.resolve();
      unlockSettled.then(() => {
        // Bail if the timer was dismissed while we were waiting.
        if (!this._ringingTimers.has(timerId)) return;
        audio.src = audioFileUrl;
        audio.volume = 1;
      let playCount = 0;
      let firstPlayResolved = false;
      const maxPlays = audioPlayUntilDismissed ? Infinity : Math.max(1, Math.min(10, audioRepeatCount || 1));
      const playNext = () => {
        if (this._ringingTimers.has(timerId) && this._activeAudioInstances.has(timerId) && playCount < maxPlays) {
          playCount++;
          try { audio.currentTime = 0; } catch (_) {}
          const isFirstAttempt = playCount === 1;
          let sawPlayingEvent = false;
          let promiseRejected = false;
          let rejectionError = null;
          const onPlayingOnce = () => {
            sawPlayingEvent = true;
            firstPlayResolved = true;
          };
          if (isFirstAttempt) {
            try { audio.addEventListener("playing", onPlayingOnce, { once: true }); } catch (_) {}
          }
          const p = audio.play();
          if (p && typeof p.then === "function") {
            p.then(() => { firstPlayResolved = true; }).catch((err) => {
              promiseRejected = true;
              rejectionError = err;
              if (!isFirstAttempt) return;
              // The play() promise rejection is unreliable on iOS Safari (it can
              // reject with AbortError/NotAllowedError even when playback succeeds).
              // Wait a generous window, then trust the audio element's own state
              // (playing event, !paused, currentTime advanced) as ground truth.
              setTimeout(() => {
                try { audio.removeEventListener("playing", onPlayingOnce); } catch (_) {}
                const audioIsActuallyPlaying =
                  firstPlayResolved ||
                  sawPlayingEvent ||
                  (audio && !audio.paused && audio.currentTime > 0);
                if (audioIsActuallyPlaying) return;
                console.warn("[simple-timer-card] Alarm audio.play() rejected and never started (likely iOS autoplay policy; tap the card once to unlock):", rejectionError?.message || rejectionError);
                fireNotify("audio_fail");
              }, 1500);
            });
          }
        } else {
          this._stopAudioForTimer(timerId);
        }
      };
      const onError = () => {
        // Audio element 'error' fires for various reasons (src reset, network blip,
        // decoder transient). The authoritative signal for "alarm did not play" is
        // the rejected play() promise handled above, so do NOT fire notify from here.
        this._stopAudioForTimer(timerId);
      };
      const audioData = { audio, playNext, onError };
      audio.addEventListener("ended", playNext);
      audio.addEventListener("error", onError);
      this._activeAudioInstances.set(timerId, audioData);
      playNext();
      }).catch(() => { /* unlock promise should never reject visibly */ });
    } catch (e) {
      fireNotify("audio_fail");
    }
  }

  _stopAudioForTimer(timerId) {
    const audioData = this._activeAudioInstances.get(timerId);
    if (audioData) {
      const { audio, playNext, onError } = audioData;
      try { audio.removeEventListener("ended", playNext); } catch (_) {}
      try { if (onError) audio.removeEventListener("error", onError); } catch (_) {}
      try { audio.pause(); audio.currentTime = 0; } catch (_) {}
      this._activeAudioInstances.delete(timerId);
    }
  }

  _cleanupThrottleMap() {
    const now = Date.now();
    const CLEANUP_THRESHOLD = 60000;
    for (const [key, time] of this._lastActionTime.entries()) {
      if (now - time > CLEANUP_THRESHOLD) this._lastActionTime.delete(key);
    }
  }


  _discoverVoicePEEntities() {
    try {
      const states = this.hass?.states || {};
      const out = [];
      for (const [entityId, st] of Object.entries(states)) {
        if (!entityId || !st) continue;
        const state = st.state;
        if (!["active", "paused", "idle", "finished"].includes(state)) continue;
        const attrs = st.attributes || {};
        const controlEntity = attrs.control_entity ? String(attrs.control_entity).trim() : "";
        if (!controlEntity) continue;

        out.push(entityId);
      }
      out.sort((a, b) => a.localeCompare(b));
      return out;
    } catch (_) {
      return [];
    }
  }

  _getDefaultVoicePETargetEntity() {

    try {
      const cfg = Array.isArray(this._config?.entities) ? this._config.entities : [];
      for (const entityConf of cfg) {
        const entityId = typeof entityConf === "string" ? entityConf : entityConf?.entity;
        const mode = typeof entityConf === "string" ? null : entityConf?.mode;
        if (!entityId) continue;
        if (mode === "voice_pe" || (entityId.startsWith("sensor.") && String(entityId).toLowerCase().includes("vpe_timer"))) {
          return entityId;
        }
        const st = this.hass?.states?.[entityId];
        const controlEntity = st?.attributes?.control_entity ? String(st.attributes.control_entity).trim() : "";
        if (controlEntity) return entityId;
      }
    } catch (_) {}

    const discovered = this._discoverVoicePEEntities();
    return discovered.length ? discovered[0] : null;
  }

  _resolveNativeTimerTarget() {
    // Preset chips and the custom picker start a native HA timer.* entity via the
    // timer.start service so timer.started / timer.finished events fire for
    // automations. This resolves which timer to start: an explicit
    // default_timer_entity that is a timer.*, otherwise the single native timer
    // entity configured on the card (ambiguous when there are several).
    const def = this._config?.default_timer_entity;
    if (typeof def === "string" && def.startsWith("timer.")) return def;
    if (this._integrationStorageList()) return null;
    try {
      const cfg = Array.isArray(this._config?.entities) ? this._config.entities : [];
      const nativeTimers = [];
      for (const entityConf of cfg) {
        const entityId = typeof entityConf === "string" ? entityConf : entityConf?.entity;
        const mode = typeof entityConf === "string" ? null : entityConf?.mode;
        if (!entityId) continue;
        if (entityId.startsWith("timer.") && (!mode || mode === "auto" || mode === "timer")) nativeTimers.push(entityId);
      }
      if (nativeTimers.length === 1) return nativeTimers[0];
    } catch (_) {}
    return null;
  }

  _ensureAutoVoicePEEntities() {
    if (this._autoVoicePEInjected) return;
    if (this._config?.auto_voice_pe !== true) return;

    const cfgEntities = Array.isArray(this._config?.entities) ? this._config.entities : [];
    if (cfgEntities.length > 0) {
      this._autoVoicePEInjected = true;
      return;
    }

    const discovered = this._discoverVoicePEEntities();
    if (!discovered.length) return;

    this._config.entities = discovered.map((e) => ({ entity: e, mode: "voice_pe" }));
    this._autoVoicePEInjected = true;
  }

  _publishTimerEvent(event, timer) {
    if (this._config.storage === "mqtt" || (this._config.default_timer_entity?.startsWith("sensor.") && !this._isCompanionList(this._config.default_timer_entity))) {
      const payload = {
        id: timer.id,
        label: timer.label,
        name: timer.name,
        source: timer.source,
        source_entity: timer.source_entity,
        icon: timer.icon,
        color: timer.color,
        voice_pe_timer_id: timer.voice_pe_timer_id,
        control_entity: timer.control_entity,
        timestamp: Date.now(),
        event: event,
        duration: timer.duration,
        remaining: timer.remaining
      };

      if (timer?.pinned_id) payload.pinned_id = timer.pinned_id;


      if (timer?.source === "voice_pe") {
        payload.state = timer.state;
        payload.start_ts = timer.start_ts;
        payload.end_ts = timer.end_ts;
        payload.duration_ms = timer.duration_ms ?? timer.duration;
        payload.remaining_ms = timer.remaining_ms ?? timer.remaining;
      }

      return this._publishMqtt("event", payload, event);
    }
  }


  _getEntityConfig(entityId) {
    if (!entityId || !this._config.entities) return null;
    for (const entityConf of this._config.entities) {
      const confEntityId = typeof entityConf === "string" ? entityConf : entityConf?.entity;
      if (confEntityId === entityId) return typeof entityConf === "string" ? {} : entityConf;
    }
    return null;
  }

  _parseDuration(durationStr) {
    if (!durationStr) return 0;
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(durationStr)) return this._parseHMSToMs(durationStr);
    if (/^\d{1,2}:\d{2}$/.test(durationStr)) {
      const parts = durationStr.split(":").map((p) => parseInt(p, 10));
      return (parts[0] * 60 + parts[1]) * 1000;
    }
    let totalSeconds = 0;
    const hourMatch = durationStr.match(/(\d+)\s*h/);
    const minuteMatch = durationStr.match(/(\d+)\s*m/);
    const secondMatch = durationStr.match(/(\d+)\s*s/);
    const numberOnlyMatch = durationStr.match(/^\d+$/);
    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    if (minuteMatch) totalSeconds += parseInt(minuteMatch[1]) * 60;
    if (secondMatch) totalSeconds += parseInt(secondMatch[1]);
    if (!hourMatch && !minuteMatch && !secondMatch && numberOnlyMatch) totalSeconds = parseInt(numberOnlyMatch[0]) * 60;
    return totalSeconds * 1000;
  }

  _mutateHelper(entityId, mutator) {
    const state = this.hass.states[entityId]?.state ?? '{"timers":[]}';
    let data;
    try {
      data = JSON.parse(state);
      if (!this._validateStoredTimerData(data)) data = { timers: [] };
    } catch {
      data = { timers: [] };
    }
    if (!Array.isArray(data.timers)) data.timers = [];

    data.timers = data.timers.map((t) => {
      if (!t || typeof t !== "object") return t;
      const c = { ...t };

      if (typeof c.start_ts !== "number") {
        if (typeof c.start === "number") c.start_ts = c.start;
        else if (typeof c.start === "string") {
          const parsed = Date.parse(c.start);
          if (!isNaN(parsed)) c.start_ts = parsed;
        }
      }

      if (c.paused) {
        if (typeof c.remaining_ms !== "number" && typeof c.end === "number") c.remaining_ms = c.end;
        c.end_ts = null;
      } else {
        if (typeof c.end_ts !== "number" && typeof c.end === "number") c.end_ts = c.end;
        if (c.remaining_ms != null) delete c.remaining_ms;
      }

      if (c.start != null) delete c.start;
      if (c.end != null) delete c.end;

      return c;
    });

    mutator(data);
    const domain = entityId.split(".")[0];
    this.hass.callService(domain, "set_value", { entity_id: entityId, value: JSON.stringify({ ...data, version: 2 }) });
  }

  _handleCreateTimer(e) {
    const form = e.target;
    const durationStr = form.querySelector('ha-textfield[name="duration"]')?.value?.trim() ?? "";
    const label = form.querySelector('ha-textfield[name="label"]')?.value?.trim() ?? "";
    const targetEntity = form.querySelector('[name="target_entity"]')?.value ?? "";
    const durationMs = this._parseDuration(durationStr);
    let resolvedTargetEntity = targetEntity;
    if (!resolvedTargetEntity) resolvedTargetEntity = this._config.default_timer_entity || "";
    if (this._config.auto_voice_pe === true) {
      const vpeEntity = this._getDefaultVoicePETargetEntity();
      if (vpeEntity) resolvedTargetEntity = vpeEntity;
    }
    if (durationMs <= 0) return;
    const validation = this._validateTimerInput(durationMs, label);
    if (!validation.valid) return;
    const timerListTarget = this._resolveTimerListTarget(resolvedTargetEntity);
    if (timerListTarget) {
      this._createTimerListTimer(timerListTarget, durationMs, label);
      this.requestUpdate();
      return;
    }
    const now = Date.now();
    const endTime = now + durationMs;
    const newTimer = {
      id: `custom-${now}`,
      label: this._sanitizeText(label || this._localize("timer")),
      icon: this._config.default_timer_icon || "mdi:timer-outline",
      color: this._config.default_timer_color || "var(--primary-color)",
      start_ts: now,
      end_ts: endTime,
      duration: durationMs,
      source: "helper",
      paused: false,
    };
    if (resolvedTargetEntity) {
      const ce = this._getVoicePEControlEntity(resolvedTargetEntity);
      if (ce) {
        this._publishTimerEvent("started", { source: "voice_pe", source_entity: resolvedTargetEntity, label: newTimer.label });
        this._sendVoicePEStart(durationMs, "", resolvedTargetEntity);
        this.requestUpdate();
        return;
      }
    }
    if (!resolvedTargetEntity) {
      const now = Date.now();
      const t = {
        id: newTimer.id,
        kind: "active",
        label: newTimer.label,
        name: newTimer.label,
        source: this._config.storage === "mqtt" ? "mqtt" : "local",
        source_entity: this._config.storage === "mqtt" ? this._config.mqtt?.sensor_entity : "local",
        start_ts: now,
        end_ts: now + durationMs,
        state: "active",
        supports: { pause: true, cancel: true, snooze: true, extend: true },
        icon: newTimer.icon,
        color: newTimer.color,
        duration: durationMs,
        paused: false,
        idle: false,
        finished: false,
      };
      this._addTimerToStorage(t);
      this._publishTimerEvent("started", t);
      this.requestUpdate();
      return;
    }
    this._mutateHelper(resolvedTargetEntity, (data) => { data.timers.push(newTimer); });
    this._publishTimerEvent("started", newTimer);
  }
  _parseDurationInputToMs(input) {
    if (input == null) return null;
    if (typeof input === "number") {
      if (!Number.isFinite(input) || input <= 0) return null;
      return Math.round(input * 60000);
    }
    const raw = String(input).trim().toLowerCase();
    const m = raw.match(/^(\d+)\s*([smhd])?$/);
    if (!m) return null;
    const value = parseInt(m[1], 10);
    if (!Number.isFinite(value) || value <= 0) return null;
    const unit = m[2] || "m";
    if (unit === "s") return value * 1000;
    if (unit === "m") return value * 60000;
    if (unit === "h") return value * 3600000;
    if (unit === "d") return value * 86400000;
    return null;
  }

  _formatPresetLabel(preset) {
    const raw = String(preset).trim().toLowerCase();
    const m = raw.match(/^(\d+)\s*([smhd])?$/);
    if (!m) return String(preset);
    return `${m[1]}${this._localize(m[2] || "m")}`;
  }

  _renderDurationValue(value, unit) {
    const direction = this._isRTL() ? "rtl" : "ltr";
    return html`<span class="duration-part" dir=${direction}><bdi class="duration-number" dir="ltr">${value}</bdi><bdi class="duration-unit" dir=${direction}>${unit}</bdi></span>`;
  }

  _renderPresetLabel(preset, sign = "") {
    const parts = String(preset).trim().toLowerCase().match(/^(\d+)\s*([smhd])?$/);
    if (!parts) return html`<bdi dir="auto">${sign}${this._formatPresetLabel(preset)}</bdi>`;
    return this._renderDurationValue(`${sign}${parts[1]}`, this._localize(parts[2] || "m"));
  }

  _createPresetTimer(preset, entity = null, overrides = {}) {
    const durationMs = this._parseDurationInputToMs(preset);
    if (!durationMs) return;

    const label = overrides.label || (() => {
      const raw = typeof preset === "string" ? preset.trim().toLowerCase() : preset;
      if (typeof raw === "string" && raw.endsWith("s")) {
        const seconds = parseInt(raw.slice(0, -1), 10);
        return `${seconds}${this._localize("s")} ${this._localize("timer")}`;
      }
      if (typeof raw === "string" && raw.endsWith("h")) {
        const hours = parseInt(raw.slice(0, -1), 10);
        return `${hours}${this._localize("h")} ${this._localize("timer")}`;
      }
      if (typeof raw === "string" && raw.endsWith("d")) {
        const days = parseInt(raw.slice(0, -1), 10);
        return `${days}${this._localize("d")} ${this._localize("timer")}`;
      }
      const minutes = typeof raw === "string" && raw.endsWith("m") ? parseInt(raw.slice(0, -1), 10) : parseInt(raw, 10);
      if (!isNaN(minutes) && minutes > 0) return this._formatTimerLabel(minutes * 60);
      return this._formatTimerLabel(Math.round(durationMs / 1000));
    })();

    const pinnedAction = this._normalizeActionSpec(overrides?.on_finish);
    if (pinnedAction) {
      this._createActionTimer(pinnedAction, durationMs, overrides.label || label, overrides);
      return;
    }
    // Device actions are chosen per timer in the custom panel only, so a
    // plain preset never inherits one.
    const choice = entity ? null : this._activeTargetChoice();
    if (choice?.kind === "timer_list") {
      const chosenName = overrides?.voice_pe_name && String(overrides.voice_pe_name).trim() ? String(overrides.voice_pe_name).trim() : "";
      this._createTimerListTimer(choice.entity, durationMs, chosenName, this._timerListMetaFromOverrides(overrides));
      this.requestUpdate();
      return;
    }

    let targetEntity = entity;
    if (!targetEntity && this._config.auto_voice_pe === true) {
      targetEntity = this._getDefaultVoicePETargetEntity();
    }
    if (!targetEntity) targetEntity = this._config.default_timer_entity;
    const voicePEEnabled = this._config.auto_voice_pe === true;
    const controlEntityFromCfg = this._config?.voice_pe_control_entity ? String(this._config.voice_pe_control_entity).trim() : "";
    const canStartVoicePE = voicePEEnabled && !!controlEntityFromCfg;

    if (voicePEEnabled && !controlEntityFromCfg) {
      this._toast("Voice PE control entity is not set. Please configure it in the card editor.");
    }

    if (canStartVoicePE) {
      const userProvidedName = !!(overrides?.voice_pe_name && String(overrides.voice_pe_name).trim());
      const nameForCommand = userProvidedName ? String(overrides.voice_pe_name).trim() : "";
      this._publishTimerEvent("started", { source: "voice_pe", source_entity: targetEntity, label });
      this._sendVoicePEStart(durationMs, nameForCommand, targetEntity);
      this.requestUpdate();
      return;
    }

    // Start a native HA timer.* entity through the timer.start service so the
    // standard timer.started / timer.finished events fire for automations.
    const explicitTimerList = this._isTimerListEntity(targetEntity) ? targetEntity : null;
    const nativeTimerTarget = explicitTimerList ? null : ((targetEntity && targetEntity.startsWith("timer.")) ? targetEntity : this._resolveNativeTimerTarget());
    if (nativeTimerTarget) {
      const serviceDuration = this._formatDurationForService(Math.round(durationMs / 1000));
      this.hass.callService("timer", "start", { entity_id: nativeTimerTarget, duration: serviceDuration });
      this._publishTimerEvent("started", { source: "timer", source_entity: nativeTimerTarget, label, duration: durationMs });
      this.requestUpdate();
      return;
    }

    const timerListTarget = this._resolveTimerListTarget(targetEntity);
    if (timerListTarget) {
      const userProvidedName = overrides?.voice_pe_name && String(overrides.voice_pe_name).trim() ? String(overrides.voice_pe_name).trim() : "";
      this._createTimerListTimer(timerListTarget, durationMs, userProvidedName, this._timerListMetaFromOverrides(overrides));
      this.requestUpdate();
      return;
    }

    const now = Date.now();
    const newTimer = {
      id: overrides.id || `preset-${now}`,
      kind: "active",
      label,
      name: label,
      source: "local",
      source_entity: targetEntity || "local",
      start_ts: now,
      end_ts: now + durationMs,
      state: "active",
      supports: { pause: true, cancel: true, snooze: true, extend: true },

      pinned_id: overrides.pinned_id,
      expired_subtitle: overrides.expired_subtitle ?? this._config.expired_subtitle,
      ...(Array.isArray(overrides.buttons) && overrides.buttons.length ? { buttons: overrides.buttons } : {}),
      ...(overrides.audio_enabled !== undefined ? { audio_enabled: overrides.audio_enabled } : {}),
      ...(overrides.audio_file_url !== undefined ? { audio_file_url: overrides.audio_file_url } : {}),
      ...(overrides.audio_repeat_count !== undefined ? { audio_repeat_count: overrides.audio_repeat_count } : {}),
      ...(overrides.audio_play_until_dismissed !== undefined ? { audio_play_until_dismissed: overrides.audio_play_until_dismissed } : {}),

      icon: overrides.icon || this._config.default_timer_icon || "mdi:timer-outline",
      color: overrides.color || this._config.default_timer_color || "var(--primary-color)",
      duration: durationMs,
      paused: false,
      idle: false,
      finished: false,
    };

    if (targetEntity && (targetEntity.startsWith("input_text.") || targetEntity.startsWith("text."))) {
      newTimer.source = "helper";
      newTimer.source_entity = targetEntity;
      if (resolvedTargetEntity) {
      const ce = this._getVoicePEControlEntity(resolvedTargetEntity);
      if (ce) {
        this._publishTimerEvent("started", { source: "voice_pe", source_entity: resolvedTargetEntity, label: newTimer.label });
        this._sendVoicePEStart(durationMs, "", resolvedTargetEntity);
        this.requestUpdate();
        return;
      }
    }
    this._mutateHelper(resolvedTargetEntity, (data) => { data.timers.push(newTimer); });
      this._publishTimerEvent("created", newTimer);
    } else if (this._config.storage === "mqtt") {
      newTimer.source = "mqtt";
      newTimer.source_entity = this._config.mqtt.sensor_entity;
      this._addTimerToStorage(newTimer);
      this._publishTimerEvent("created", newTimer);
    } else {
      newTimer.source = "local";
      newTimer.source_entity = this._config.storage === "mqtt" ? this._config.mqtt.sensor_entity : "local";
      this._addTimerToStorage(newTimer);
      this._publishTimerEvent("created", newTimer);
    }
    this._publishTimerEvent("started", newTimer);
    this.requestUpdate();
  }
  _formatTimerLabel(totalSeconds) {
    if (totalSeconds <= 0) return this._localize("timer");
    const t = this._localize("timer");
    const h = this._localize("h");
    const m = this._localize("m");
    const s = this._localize("s");
    const d = this._localize("d");
    if (totalSeconds < 60) return `${totalSeconds}${s} ${t}`;
    const days = Math.floor(totalSeconds / DAY_IN_SECONDS);
    const remainderAfterDays = totalSeconds % DAY_IN_SECONDS;
    if (days > 0 && remainderAfterDays === 0) return `${days}${d} ${t}`;
    const hours = Math.floor(remainderAfterDays / HOUR_IN_SECONDS);
    const minutes = Math.floor((remainderAfterDays % HOUR_IN_SECONDS) / MINUTE_IN_SECONDS);
    const seconds = remainderAfterDays % MINUTE_IN_SECONDS;
    const parts = [];
    if (days) parts.push(`${days}${d}`);
    if (hours) parts.push(`${hours}${h}`);
    if (minutes) parts.push(`${minutes}${m}`);
    if (seconds && parts.length < 3) parts.push(`${seconds}${s}`);
    return `${parts.join("")} ${t}`;
  }

  _formatDurationDisplay(ms) {
    if (ms <= 0) return `0${this._localize("s")}`;
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}${this._localize("s")}`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (totalSeconds < 3600) return `${minutes}${this._localize("m")}${seconds ? seconds + this._localize("s") : ""}`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours}${this._localize("h")}${remMin ? remMin + this._localize("m") : ""}`;
  }

  _renderTimerNameSelector(inputId, placeholder) {
    const presets = this._config.timer_name_presets || [];
    if (presets.length === 0) {
      return html`<input id="${inputId}" class="text-input" placeholder="${placeholder}" style="margin-top: 12px;" />`;
    }
    const customValue = this._lastSelectedName[inputId];
    const isCustomValue = customValue && !presets.includes(customValue);
    return html`
      <div class="name-selector">
        <div class="name-chips" style="display: ${this._showingCustomName[inputId] ? "none" : "flex"};">
          ${presets.map(name => html`
            <button class="btn btn-preset ${this._lastSelectedName[inputId] === name ? "selected" : ""}"
                    @click=${(e) => this._setTimerName(inputId, name, e)}>
              ${this._sanitizeText(name)}
            </button>
          `)}
          ${isCustomValue ? html`
            <button class="btn btn-preset selected"
                    @click=${(e) => this._editCustomValue(inputId, e)}>
              ${this._sanitizeText(customValue)}
            </button>
          ` : html`
            <button class="btn btn-ghost"
                    @click=${(e) => this._showCustomNameInput(inputId, e)}>
              ${this._localize("custom")}
            </button>
          `}
        </div>
        <input id="${inputId}" class="text-input" placeholder="${placeholder}"
               style="display: ${this._showingCustomName[inputId] ? "block" : "none"};"
               @blur=${(e) => this._handleCustomInputBlur(inputId, e)}
               @keypress=${(e) => e.key === "Enter" && this._handleCustomInputBlur(inputId, e)} />
      </div>
    `;
  }

  _setTimerName(inputId, name, e) {
    e?.stopPropagation();
    const input = this.shadowRoot?.getElementById(inputId);
    if (input) {
      input.value = name;
      this._lastSelectedName[inputId] = name;
      this._showingCustomName[inputId] = false;
      this.requestUpdate();
    }
  }

  _showCustomNameInput(inputId, e) {
    e?.stopPropagation();
    const input = this.shadowRoot?.getElementById(inputId);
    if (input) {
      input.value = "";
      this._showingCustomName[inputId] = true;
      this.requestUpdate();
      setTimeout(() => input.focus(), 10);
    }
  }

  _editCustomValue(inputId, e) {
    e?.stopPropagation();
    const input = this.shadowRoot?.getElementById(inputId);
    if (input) {
      input.value = this._lastSelectedName[inputId] || "";
      this._showingCustomName[inputId] = true;
      this.requestUpdate();
      setTimeout(() => { input.focus(); input.select(); }, 10);
    }
  }

  _handleCustomInputBlur(inputId, e) {
    const input = e.target;
    const value = input.value.trim();
    if (value) {
      this._lastSelectedName[inputId] = value;
      this._showingCustomName[inputId] = false;
    } else {
      this._showingCustomName[inputId] = false;
      this._lastSelectedName[inputId] = null;
    }
    this.requestUpdate();
  }

  _cleanFriendlyName(friendlyName) {
    if (!friendlyName) return friendlyName;
    return friendlyName.replace(/\s*next\s+timer\s*/i, "").trim();
  }

  _handleStart(timer) {
    if (timer?.kind === "template") {
      if (this._isActionThrottled("start_template", timer.pinned_id || timer.id, 500)) return;
      this._createPresetTimer(
        timer.template_preset ?? timer.duration_input ?? timer.preset ?? timer.duration,
        null,
        (() => {
          const overrides = {
            label: timer.label || timer.name,
            voice_pe_name: timer.label || timer.name,
            icon: timer.icon,
            color: timer.color,
            expired_subtitle: timer.expired_subtitle,
            pinned_id: timer.pinned_id || timer.id,
          };
          if (Array.isArray(timer.buttons) && timer.buttons.length) overrides.buttons = timer.buttons;
          if (timer.on_finish) overrides.on_finish = timer.on_finish;
          if (timer.audio_enabled === true || timer.audio_enabled === false) overrides.audio_enabled = timer.audio_enabled;
          if (timer.audio_file_url) overrides.audio_file_url = timer.audio_file_url;
          if (timer.audio_repeat_count !== undefined) overrides.audio_repeat_count = timer.audio_repeat_count;
          if (timer.audio_play_until_dismissed === true || timer.audio_play_until_dismissed === false) overrides.audio_play_until_dismissed = timer.audio_play_until_dismissed;
          return overrides;
        })()
      );
      return;
    }

    if (timer.source === "timer") {
      this._publishTimerEvent("started", timer);
      if (timer.duration) {
        const totalSeconds = Math.ceil(timer.duration / 1000);
        const serviceDuration = this._formatDurationForService(totalSeconds);
        this.hass.callService("timer", "start", { entity_id: timer.source_entity, duration: serviceDuration });
      } else {
        this.hass.callService("timer", "start", { entity_id: timer.source_entity });
      }
    } else {
      this._toast("This timer can't be started from here.");
    }
  }

  _handleCancel(timer) {
    if (this._isActionThrottled("cancel", timer.id)) return;
    this._ringingTimers.delete(timer.id);

    if (timer.source === "voice_pe") {
      if (!this._isLocalVoicePETimer(timer)) {
        this._toast("This timer is read only.");
        return;
      }
      this._publishTimerEvent("cancelled", timer);
      this._sendVoicePECommand(timer.control_entity, `cancel:${String(timer.voice_pe_timer_id).trim()}`);
      return;
    }

    if (timer.source === "timer_list") {
      const features = timer.supports || {};
      if (!features.cancel) return this._timerListUnsupported();
      this._stopAudioForTimer(timer.id);
      this._publishTimerEvent("cancelled", timer);
      // Removing an active timer also cancels it on the satellite.
      this._callTimerListService(timer, features.cancel_service ? "cancel_timer" : "remove_timer");
      return;
    }

    this._publishTimerEvent("cancelled", timer);
    if (timer.source === "helper") {
      this._mutateHelper(timer.source_entity, (data) => { data.timers = data.timers.filter((t) => t.id !== timer.id); });
    } else if (["local", "mqtt"].includes(timer.source)) {
      this._removeTimerFromStorage(timer.id, timer.source);
      this.requestUpdate();
    } else if (timer.source === "timer") {
      this.hass.callService("timer", "cancel", { entity_id: timer.source_entity });
    } else {
      this._toast("This timer can't be cancelled from here.");
    }
  }

  _handlePause(timer) {
    if (timer.source === "voice_pe") {
      if (!this._isLocalVoicePETimer(timer)) {
        this._toast("This timer is read only.");
        return;
      }
      this._publishTimerEvent("paused", timer);
      this._sendVoicePECommand(timer.control_entity, `pause:${String(timer.voice_pe_timer_id).trim()}`);
      return;
    }

    if (timer.source === "timer_list") {
      if (!timer.supports?.pause) return this._timerListUnsupported();
      this._publishTimerEvent("paused", timer);
      this._callTimerListService(timer, "pause_timer");
      return;
    }

    this._publishTimerEvent("paused", timer);
    if (timer.source === "helper") {
      const now = Date.now();
      const updates = _pauseUpdatesFromTimer(timer, now);
      this._mutateHelper(timer.source_entity, (data) => {
        const idx = data.timers.findIndex((t) => t.id === timer.id);
        if (idx !== -1) {
          data.timers[idx].paused = true;
          data.timers[idx].remaining_ms = updates.remaining_ms;
          data.timers[idx].end_ts = null;
          data.timers[idx].state = "paused";
        }
      });
    } else if (["local", "mqtt"].includes(timer.source)) {
      const now = Date.now();
      const updates = _pauseUpdatesFromTimer(timer, now);
      this._updateTimerInStorage(
        timer.id,
        { paused: true, remaining_ms: updates.remaining_ms, end_ts: null, state: "paused" },
        timer.source
      );
      this.requestUpdate();
    } else if (timer.source === "timer") {
      this.hass.callService("timer", "pause", { entity_id: timer.source_entity });
    } else {
      this._toast("This timer can't be paused from here.");
    }
  }

  _handleResume(timer) {
    if (timer.source === "voice_pe") {
      if (!this._isLocalVoicePETimer(timer)) {
        this._toast("This timer is read only.");
        return;
      }
      this._publishTimerEvent("resumed", timer);
      this._sendVoicePECommand(timer.control_entity, `resume:${String(timer.voice_pe_timer_id).trim()}`);
      return;
    }

    if (timer.source === "timer_list") {
      if (!timer.supports?.pause) return this._timerListUnsupported();
      this._publishTimerEvent("resumed", timer);
      this._callTimerListService(timer, "unpause_timer");
      return;
    }

    this._publishTimerEvent("resumed", timer);
    if (timer.source === "helper") {
      const now = Date.now();
      const updates = _resumeUpdatesFromTimer(timer, now);
      this._mutateHelper(timer.source_entity, (data) => {
        const idx = data.timers.findIndex((t) => t.id === timer.id);
        if (idx !== -1) {
          data.timers[idx].paused = false;
          data.timers[idx].start_ts = updates.start_ts;
          data.timers[idx].end_ts = updates.end_ts;
          data.timers[idx].state = "active";
          if (data.timers[idx].remaining_ms != null) delete data.timers[idx].remaining_ms;
        }
      });
    } else if (["local", "mqtt"].includes(timer.source)) {
      const now = Date.now();
      const updates = _resumeUpdatesFromTimer(timer, now);
      this._updateTimerInStorage(
        timer.id,
        updates,
        timer.source
      );
      this.requestUpdate();
    } else if (timer.source === "timer") {
      this.hass.callService("timer", "start", { entity_id: timer.source_entity });
    } else {
      this._toast("This timer can't be resumed from here.");
    }
  }

  _togglePause(t, e) {
    e?.stopPropagation?.();
    if (!["helper", "local", "mqtt", "timer", "timer_list"].includes(t.source)) return;
    t.paused ? this._handleResume(t) : this._handlePause(t);
  }

  // === Action handler infrastructure (v2.6.0) ===
  //
  // Standard HA-style tap / hold / double-tap support on the card root and
  // per row. Resolution for a row action: row config -> card config ->
  // built-in default. Tap opens the inline editor for idle native timers.
  // Other states, hold and double-tap have no built-in default.
  // action: "none" suppresses inheritance and the default.
  _hasAnyRowAction(t) {
    const rowConf = this._getEntityConfig(t.source_entity) || {};
    const c = this._config || {};
    return !!(rowConf.tap_action || rowConf.hold_action || rowConf.double_tap_action
           || c.tap_action || c.hold_action || c.double_tap_action);
  }

  _buildRowActionCtx(t, canEdit) {
    const rowConf = this._getEntityConfig(t.source_entity) || {};
    const cardConf = this._config || {};
    const tapAction = rowConf.tap_action || cardConf.tap_action;
    const holdAction = rowConf.hold_action || cardConf.hold_action;
    const doubleAction = rowConf.double_tap_action || cardConf.double_tap_action;
    return {
      cardLevel: false,
      entityId: t.source_entity,
      timer: t,
      canEdit,
      isIdle: !!t.idle,
      tapAction, holdAction, doubleAction,
      hold: !!(holdAction && holdAction.action && holdAction.action !== "none"),
      double: !!(doubleAction && doubleAction.action && doubleAction.action !== "none"),
      key: `row:${t.source_entity || t.id || ""}`,
    };
  }

  _buildCardActionCtx() {
    const c = this._config || {};
    return {
      cardLevel: true,
      entityId: undefined,
      timer: null,
      canEdit: false,
      tapAction: c.tap_action,
      holdAction: c.hold_action,
      doubleAction: c.double_tap_action,
      hold: !!(c.hold_action && c.hold_action.action && c.hold_action.action !== "none"),
      double: !!(c.double_tap_action && c.double_tap_action.action && c.double_tap_action.action !== "none"),
      key: "card",
    };
  }

  _rowActionHandlers(t, canEdit) {
    const factory = () => this._buildRowActionCtx(t, canEdit);
    return {
      down: (e) => this._onActionPointerDown(factory, e, true),
      up: (e) => this._onActionPointerUp(factory, e, true),
      cancel: () => this._onActionPointerCancel(),
    };
  }

  _cardActionHandlers() {
    const factory = () => this._buildCardActionCtx();
    return {
      down: (e) => this._onActionPointerDown(factory, e, false),
      up: (e) => this._onActionPointerUp(factory, e, false),
      cancel: () => this._onActionPointerCancel(),
    };
  }

  // Ignore events that originate from an interactive descendant. This is
  // what keeps the pause button, snooze/dismiss chips, vertical-circle hot
  // zone and inline-editor inputs from also firing the row/card action.
  _actionEventIsInternal(e) {
    const tgt = e.target;
    if (!tgt || typeof tgt.closest !== "function") return false;
    const sel = "button, ha-icon-button, ha-button, mwc-button, "
              + "ha-textfield, ha-input, ha-select, ha-formfield, input, textarea, "
              + ".vcircle-wrap, .actions, .vactions, .vprogressbar, [data-no-action]";
    return !!tgt.closest(sel);
  }

  _onActionPointerDown(ctxFactory, e, isRow) {
    if (this._actionEventIsInternal(e)) return;
    if (e.button !== undefined && e.button !== 0) return;
    // For card-level: ignore if the event originated inside a row li; the row
    // handler is authoritative there.
    if (!isRow && e.target && typeof e.target.closest === "function" && e.target.closest("li")) return;
    const ctx = ctxFactory();
    this._actionState = { ctx, holdFired: false, holdTimer: null, downAt: Date.now() };
    if (ctx.hold) {
      this._actionState.holdTimer = window.setTimeout(() => {
        if (!this._actionState) return;
        this._actionState.holdFired = true;
        this._dispatchAction(this._actionState.ctx, "hold");
      }, 500);
    }
  }

  _onActionPointerUp(ctxFactory, e, isRow) {
    if (!this._actionState) return;
    if (this._actionEventIsInternal(e)) { this._cancelActionState(); return; }
    if (!isRow && e.target && typeof e.target.closest === "function" && e.target.closest("li")) {
      this._cancelActionState();
      return;
    }
    const state = this._actionState;
    this._actionState = null;
    if (state.holdTimer) clearTimeout(state.holdTimer);
    if (state.holdFired) return;
    const ctx = state.ctx;
    const now = Date.now();
    if (ctx.double && this._lastTap && this._lastTap.key === ctx.key && (now - this._lastTap.at) < 300) {
      if (this._pendingTap) { clearTimeout(this._pendingTap); this._pendingTap = null; }
      this._lastTap = null;
      this._dispatchAction(ctx, "double_tap");
      return;
    }
    this._lastTap = { key: ctx.key, at: now };
    if (ctx.double) {
      this._pendingTap = window.setTimeout(() => {
        this._pendingTap = null;
        this._dispatchAction(ctx, "tap");
      }, 300);
    } else {
      this._dispatchAction(ctx, "tap");
    }
  }

  _onActionPointerCancel() {
    this._cancelActionState();
  }

  _cancelActionState() {
    if (this._actionState && this._actionState.holdTimer) clearTimeout(this._actionState.holdTimer);
    this._actionState = null;
  }

  _dispatchAction(ctx, type) {
    const action = type === "tap" ? ctx.tapAction
                 : type === "hold" ? ctx.holdAction
                 : ctx.doubleAction;
    if (action && action.action === "none") return;
    if (action && action.action) { this._fireAction(action, ctx); return; }
    // Built-in defaults: tap only, row level only.
    //   - Idle HA timer entity (canEdit + isIdle): open inline editor.
    //   - Any other state (paused, running, finished, or non-timer source):
    //     no-op. Configure `tap_action: toggle` to get pause/resume.
    if (type !== "tap") return;
    if (ctx.cardLevel) return;
    if (ctx.canEdit && ctx.isIdle) this._openTimerEditor(ctx.timer);
  }

  _fireAction(action, ctx) {
    if (action.confirmation) {
      const text = (typeof action.confirmation === "object" && action.confirmation.text)
        ? action.confirmation.text
        : "Are you sure?";
      if (!window.confirm(text)) return;
    }
    switch (action.action) {
      case "more-info": {
        const entityId = action.entity || ctx.entityId;
        if (!entityId) return;
        this._fireHassEvent("hass-more-info", { entityId });
        return;
      }
      case "toggle": {
        // For timers managed by this card the HA `toggle` service does not
        // exist (timer.* exposes start/pause/cancel/finish). Route to the
        // most useful per-state action. Prefer the row's own timer object
        // so predefined (template) rows with no source_entity still work.
        let ourTimer = ctx && ctx.timer ? ctx.timer : null;
        const entityId = action.entity || ctx.entityId;
        if (!ourTimer && entityId) {
          ourTimer = (this._timers || []).find(tt => tt && tt.source_entity === entityId) || null;
        }
        if (ourTimer) {
          // Predefined / template row: always start (creates the live timer).
          if (ourTimer.kind === "template" || ourTimer.source === "template") {
            this._handleStart(ourTimer);
            return;
          }
          if (["helper", "local", "mqtt", "timer", "timer_list", "voice_pe"].includes(ourTimer.source)) {
            if (ourTimer.idle) {
              // Idle HA timer.* opens the inline editor (matches the
              // no-tap-action default). Other idle sources start in place.
              if (ourTimer.source === "timer") this._openTimerEditor(ourTimer);
              else this._handleStart(ourTimer);
              return;
            }
            this._togglePause(ourTimer);
            return;
          }
        }
        if (!entityId || !this.hass) return;
        const domain = entityId.split(".")[0];
        this.hass.callService(domain, "toggle", { entity_id: entityId });
        return;
      }
      case "navigate": {
        if (!action.navigation_path) return;
        const replace = !!action.navigation_replace;
        if (replace) window.history.replaceState(null, "", action.navigation_path);
        else window.history.pushState(null, "", action.navigation_path);
        this._fireHassEvent("location-changed", { replace });
        return;
      }
      case "url": {
        if (!action.url_path) return;
        window.open(action.url_path);
        return;
      }
      case "perform-action":
      case "call-service": {
        const svc = action.perform_action || action.service;
        if (!svc || typeof svc !== "string" || !svc.includes(".")) return;
        const [domain, service] = svc.split(".", 2);
        const data = action.data || action.service_data || {};
        const target = action.target || {};
        this.hass.callService(domain, service, data, target);
        return;
      }
      default:
        return;
    }
  }

  _fireHassEvent(type, detail) {
    const event = new Event(type, { bubbles: true, cancelable: false, composed: true });
    event.detail = detail || {};
    this.dispatchEvent(event);
  }

  _handleDismiss(timer) {
    this._ringingTimers.delete(timer.id);
    this._stopAudioForTimer(timer.id);
    if (timer.source === "timer_list") {
      // Hide right away; removing it from Home Assistant clears it on every
      // dashboard. A satellite that is still ringing has to be stopped there.
      this._dismissed.add(`${timer.source_entity}:${timer.id}`);
      if (timer.supports?.remove) this._callTimerListService(timer, "remove_timer", {}, { notifyOnError: false });
      this.requestUpdate();
      return;
    }
    if (timer.source === "helper") {
      this._mutateHelper(timer.source_entity, (data) => { data.timers = data.timers.filter((t) => t.id !== timer.id); });
    } else if (["local", "mqtt"].includes(timer.source)) {
      this._removeTimerFromStorage(timer.id, timer.source); this.requestUpdate();
    } else if (timer.source === "timer") {
      this.hass.callService("timer", "finish", { entity_id: timer.source_entity });
    } else {
      if (timer.source === "google" && timer.google_timer_id && this.hass?.services?.google_home?.delete_timer) {
        Promise.resolve(this.hass.callService("google_home", "delete_timer", {
          entity_id: timer.source_entity,
          timer_id: String(timer.google_timer_id),
        })).catch(() => this._toast("Could not dismiss the timer on Google Home."));
      }
      this._dismissed.add(`${timer.source_entity}:${timer.id}`);
      this.requestUpdate();
    }
  }

  _handleSnooze(timer) {
    if (this._isActionThrottled("snooze", timer.id)) return;
    this._ringingTimers.delete(timer.id);
    this._stopAudioForTimer(timer.id);
    this._publishTimerEvent("snoozed", timer);
    const snoozeMinutes = Number(this._config.snooze_duration ?? 5);
    if (!Number.isFinite(snoozeMinutes) || snoozeMinutes <= 0) {
      this._toast("Invalid snooze_duration setting.");
      return;
    }
    const newDurationMs = snoozeMinutes * 60000;
    const newEndTime = Date.now() + newDurationMs;
    if (timer.source === "timer_list") {
      if (!timer.supports?.snooze) return this._timerListUnsupported();
      if (timer.supports.restart_service) {
        this._callTimerListService(timer, "restart_timer", { duration: this._formatDurationForService(Math.round(newDurationMs / 1000)) });
      } else {
        this._replaceTimerListTimer(timer, newDurationMs);
      }
      return;
    }
    if (timer.source === "helper") {
      const now = Date.now();
      this._mutateHelper(timer.source_entity, (data) => {
        const idx = data.timers.findIndex((t) => t.id === timer.id);
        if (idx !== -1) {
          data.timers[idx].start_ts = now;
          data.timers[idx].end_ts = newEndTime;
          data.timers[idx].duration = newDurationMs;
          data.timers[idx].paused = false;
          data.timers[idx].state = "active";
        }
      });
    } else if (["local", "mqtt"].includes(timer.source)) {
      const now = Date.now();
      this._updateTimerInStorage(
        timer.id,
        {
          start_ts: now,
          end_ts: newEndTime,
          duration: newDurationMs,
          paused: false,
          state: "active",
        },
        timer.source
      );
      this.requestUpdate();
    } else if (timer.source === "timer") {
      const serviceDuration = this._formatDurationForService(snoozeMinutes * 60);
      this.hass.callService("timer", "start", { entity_id: timer.source_entity, duration: serviceDuration });
    } else {
      this._toast("Only helper, local, MQTT, and timer entities can be snoozed here.");
    }
  }

  _handleAddTime(t, deltaSeconds) {
    if (this._isActionThrottled("add_time", t.id, 200)) return;
    const deltaMs = Math.round(Number(deltaSeconds) * 1000);
    if (!Number.isFinite(deltaMs) || deltaMs === 0) return;
    if (t.source === "timer_list") {
      if (!t.supports?.extend) return this._timerListUnsupported();
      const seconds = Math.round(Math.abs(deltaMs) / 1000);
      if (!seconds) return;
      // Subtracting more than is left finishes the timer in Home Assistant.
      this._callTimerListService(t, deltaMs > 0 ? "add_time" : "subtract_time", { duration: this._formatDurationForService(seconds) });
      return;
    }
    const curRemaining = Math.max(0, Number(t.remaining_ms) || 0);
    const newRemaining = curRemaining + deltaMs;
    const now = Date.now();

    // Reducing past the time left finishes the timer.
    if (newRemaining <= 0) {
      this._handleFinish(t);
      return;
    }

    const newDuration = Math.max(0, (Number(t.duration) || 0) + deltaMs);
    if (t.source === "helper") {
      this._mutateHelper(t.source_entity, (data) => {
        const idx = data.timers.findIndex((x) => x.id === t.id);
        if (idx === -1) return;
        const tm = data.timers[idx];
        tm.duration = newDuration;
        if (tm.paused) tm.remaining_ms = newRemaining;
        else tm.end_ts = now + newRemaining;
      });
    } else if (["local", "mqtt"].includes(t.source)) {
      const updates = { duration: newDuration };
      if (t.paused) updates.remaining_ms = newRemaining;
      else updates.end_ts = now + newRemaining;
      this._updateTimerInStorage(t.id, updates, t.source);
      this.requestUpdate();
    } else if (t.source === "timer") {
      // timer.change caps the remaining at the timer's configured duration, so
      // adding above it does nothing. When the new remaining would exceed the
      // configured duration, start the timer with the new value instead. That
      // runs this one session at the larger value without saving it as the
      // helper's default duration.
      const configuredMs = Math.max(0, Number(t.duration) || 0);
      if (newRemaining > configuredMs) {
        const serviceDuration = this._formatDurationForService(Math.round(newRemaining / 1000));
        this.hass.callService("timer", "start", { entity_id: t.source_entity, duration: serviceDuration });
      } else {
        this.hass.callService("timer", "change", { entity_id: t.source_entity, duration: Math.round(deltaMs / 1000) });
      }
    } else {
      this._toast("Time can only be added to helper, local, MQTT, and timer entities.");
    }
  }

  _handleRestart(t) {
    if (this._isActionThrottled("restart", t.id, 300)) return;
    if (t.source === "timer_list") {
      if (!t.supports?.restart) return this._timerListUnsupported();
      const originalMs = Math.max(0, Number(t.created_duration_ms) || Number(t.duration) || 0);
      if (originalMs <= 0) { this._toast("This timer has no duration to restart."); return; }
      this._ringingTimers.delete(t.id);
      this._stopAudioForTimer(t.id);
      if (t.supports.restart_service) this._callTimerListService(t, "restart_timer");
      else this._replaceTimerListTimer(t, originalMs);
      return;
    }
    const durationMs = Math.max(0, Number(t.duration) || 0);
    if (durationMs <= 0) { this._toast("This timer has no duration to restart."); return; }
    const now = Date.now();
    this._ringingTimers.delete(t.id);
    this._stopAudioForTimer(t.id);
    if (t.source === "helper") {
      this._mutateHelper(t.source_entity, (data) => {
        const idx = data.timers.findIndex((x) => x.id === t.id);
        if (idx === -1) return;
        const tm = data.timers[idx];
        tm.start_ts = now;
        tm.end_ts = now + durationMs;
        tm.duration = durationMs;
        tm.paused = false;
        tm.state = "active";
        tm.finished = false;
        tm.idle = false;
        if (tm.remaining_ms != null) delete tm.remaining_ms;
      });
    } else if (["local", "mqtt"].includes(t.source)) {
      this._updateTimerInStorage(
        t.id,
        { start_ts: now, end_ts: now + durationMs, duration: durationMs, paused: false, state: "active", remaining_ms: undefined, finished: false, idle: false },
        t.source
      );
      this.requestUpdate();
    } else if (t.source === "timer") {
      const serviceDuration = this._formatDurationForService(Math.round(durationMs / 1000));
      this.hass.callService("timer", "start", { entity_id: t.source_entity, duration: serviceDuration });
    } else {
      this._toast("Only helper, local, MQTT, and timer entities can be restarted here.");
    }
  }

  _formatTimeAgo(ms) {
    if (ms < 1000) return null;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const fmt = (key, n) => this._localize(key).replace("{n}", n);
    if (hours > 0) return fmt(hours === 1 ? "hour_ago" : "hours_ago", hours);
    if (minutes > 0) return fmt(minutes === 1 ? "minute_ago" : "minutes_ago", minutes);
    return fmt(seconds === 1 ? "second_ago" : "seconds_ago", seconds);
  }

  _formatClock(totalSeconds, includeDays = false) {
    if (totalSeconds <= 0) return "00:00";

    const days = Math.floor(totalSeconds / DAY_IN_SECONDS);
    const remAfterDays = totalSeconds % DAY_IN_SECONDS;
    const hours = Math.floor(remAfterDays / HOUR_IN_SECONDS);
    const minutes = Math.floor((remAfterDays % HOUR_IN_SECONDS) / MINUTE_IN_SECONDS);
    const seconds = remAfterDays % MINUTE_IN_SECONDS;
    const pad = (n, len=2) => String(n).padStart(len, "0");

    if (includeDays) {
      if (days > 0) return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      return `${pad(minutes)}:${pad(seconds)}`;
    }

    const totalHours = days * 24 + hours;
    if (totalHours > 0) {
        return `${pad(totalHours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  _getUnitLabel(key, count, style) {
    if (style === "compact") {
      if (key === "year" || key === "years") return this._localize("y_short");
      if (key === "month" || key === "months") return this._localize("mo_short");
      if (key === "week" || key === "weeks") return this._localize("w_short");
      if (key === "day" || key === "days") return this._localize("d");
      if (key === "hour" || key === "hours") return this._localize("h");
      if (key === "minute" || key === "minutes") return this._localize("m");
      return this._localize("s");
    }

    const translatedLabel = this._localize(key);
    return `${count} ${translatedLabel}`;
  }

  _formatDuration(value, unit = "seconds") {
    let totalSeconds;
    if (unit === "ms") {
      if (value <= 0) return "00:00";
      totalSeconds = Math.ceil(value / 1000);
    } else {
      if (value <= 0) return "00:00";
      totalSeconds = Math.floor(value);
    }
    return this._formatClock(totalSeconds, false);
  }

  _formatDurationHM(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    if (totalSeconds <= 0) return "00";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const pad = (n) => String(n).padStart(2, "0");
    if (hours > 0) return `${pad(hours)}:${pad(minutes)}`;
    return `${pad(minutes)}`;
  }

  _formatDurationSS(ms) {
    if (ms <= 0) return "0";
    return `${Math.ceil(ms / 1000)}`;
  }

  _formatDurationDHMS(ms) {
    return this._formatClock(Math.ceil(ms / 1000), true);
  }

  _formatHumanUnits(ms, style) {
    const unitOrder = this._config.time_format_units && this._config.time_format_units.length
      ? this._config.time_format_units
      : ["days", "hours", "minutes", "seconds"];
    const map = {
      years: YEAR_IN_MS,
      months: 30 * DAY_IN_MS,
      weeks: 7 * DAY_IN_MS,
      days: DAY_IN_MS,
      hours: 3600 * 1000,
      minutes: 60 * 1000,
      seconds: 1000,
    };
    let remaining = ms;
    const parts = [];
    for (const u of unitOrder) {
      const msPer = map[u];
      if (!msPer) continue;
      const count = Math.floor(remaining / msPer);
      if (count > 0 || (u === unitOrder[unitOrder.length - 1] && parts.length === 0)) {
        remaining -= count * msPer;
        const unitKey = count === 1 ? u.slice(0, -1) : u;
        const label = this._getUnitLabel(unitKey, count, style === "natural" ? "short" : style);
        parts.push(style === "compact" ? `${count}${label}` : `${label}`);
      }
    }
    if (style === "compact") return parts.join(" ");
    return parts.join(", ");
  }

  _formatTimeString(t) {
    const tf = this._config.time_format;
    if (tf === "dhms") return this._formatDurationDHMS(t.remaining);
    if (tf === "hm") return this._formatDurationHM(t.remaining);
    if (tf === "ss") return this._formatDurationSS(t.remaining);
    if (tf === "human_compact") return this._formatHumanUnits(t.remaining, "compact");
    if (tf === "human_short") return this._formatHumanUnits(t.remaining, "short");
    if (tf === "human_natural") return this._formatHumanUnits(t.remaining, "natural");
    return this._formatDurationHMS(t.remaining);
  }

  _formatDurationHMS(ms) {
    return this._formatClock(Math.ceil(ms / 1000), false);
  }

  _formatDurationForService(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  _toggleCustom(which) {
    const openKey = `noTimer${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    if (!this._ui[openKey]) this._prepareDurationInput(which);
    this._ui[openKey] = !this._ui[openKey];
    this.requestUpdate();
  }

  _defaultCustomTimerSeconds() {
    if (this._timerInputMode === "keypad") return 0;
    const minutes = parseInt(this._config?.default_new_timer_duration_mins, 10);
    return Math.min(MAX_TIMER_SECONDS, (Number.isFinite(minutes) && minutes >= 0 ? minutes : 15) * 60);
  }

  _durationSeconds(which) {
    return ["horizontal", "vertical"].includes(which) ? this._customSecs[which] : this._activeSecs[which];
  }

  _setDurationSeconds(which, value) {
    if (!Number.isFinite(value)) return;
    const field = ["horizontal", "vertical"].includes(which) ? "_customSecs" : "_activeSecs";
    this[field] = { ...this[field], [which]: Math.min(MAX_TIMER_SECONDS, Math.max(0, Math.floor(value))) };
  }

  _resetDurationInput(which) {
    const seconds = this._defaultCustomTimerSeconds();
    this._setDurationSeconds(which, seconds);
    this._keypadDigits = { ...this._keypadDigits, [which]: secondsToDurationDigits(seconds) };
    this._initializedDurationInputs.delete(which);
  }

  _prepareDurationInput(which) {
    if (this._initializedDurationInputs.has(which)) return;
    this._resetDurationInput(which);
    this._initializedDurationInputs.add(which);
  }

  _setTimerInputMode(which, value) {
    const mode = normalizeTimerInput(value);
    if (mode === this._timerInputMode) return;
    this._initializedDurationInputs.add(which);
    if (mode === "keypad") {
      this._keypadDigits = Object.fromEntries(
        ["horizontal", "vertical", "fill", "bar"].map(input => [input, secondsToDurationDigits(this._durationSeconds(input))])
      );
    }
    this._timerInputMode = mode;
  }

  _durationKey(which, key) {
    if (this._timerInputMode !== "keypad") return;
    const digits = this._keypadDigits[which] ?? secondsToDurationDigits(this._durationSeconds(which));
    const next = editDurationDigits(digits, key);
    if (next === null) return;
    this._initializedDurationInputs.add(which);
    this._keypadDigits = { ...this._keypadDigits, [which]: next };
    this._setDurationSeconds(which, durationDigitsToSeconds(next));
  }

  _durationKeyDown(which, event) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const key = /^\d$/.test(event.key) ? event.key : ({ Backspace: "backspace", Delete: "clear" })[event.key];
    if (key) {
      event.preventDefault();
      event.stopPropagation();
      this._durationKey(which, key);
    } else if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      event.stopPropagation();
      if (["horizontal", "vertical"].includes(which)) this._startFromCustom(which);
      else this._startActive(which);
    }
  }

  _canStartCustomTimer(which) {
    const seconds = this._durationSeconds(which);
    return Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_TIMER_SECONDS;
  }

  _parseAdjustmentToSeconds(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value * 60;
    }
    if (typeof value !== "string") return 0;
    const m = value.trim().toLowerCase().match(/^(\d+)\s*([smhd])?$/);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    switch (m[2]) {
      case "s": return n;
      case "h": return n * 3600;
      case "d": return n * 86400;
      case "m":
      default:  return n * 60;
    }
  }

  _adjust(which, value, sign = +1) {
    const delta = this._parseAdjustmentToSeconds(value);
    if (!Number.isFinite(delta)) return;
    const base = Number(this._customSecs?.[which] ?? 0);
    this._setDurationSeconds(which, base + sign * delta);
  }


  _createAndSaveTimer(secs, label) {
    const secsNum = Number(secs);
    if (!Number.isFinite(secsNum) || secsNum <= 0) return;

    const durationMs = secsNum * 1000;
    const validation = this._validateTimerInput(durationMs, label);
    if (!validation.valid) return;
    if (this._isActionThrottled("create_timer", "global", 500)) return;

    const finalLabel = label && String(label).trim()
      ? this._sanitizeText(String(label).trim())
      : this._formatTimerLabel(secsNum);
    const userLabel = label && String(label).trim() ? this._sanitizeText(String(label).trim()) : "";

    const actionSpec = this._actionPickerEnabled() ? this._actionDraftSpec() : null;
    if (actionSpec) {
      // An action applies to this one timer, so a later plain timer has none.
      const started = this._createActionTimer(actionSpec, durationMs, userLabel);
      if (started) this._actionDraft = { mode: "none" };
      return started;
    }
    const choice = this._activeTargetChoice();
    if (choice?.kind === "timer_list") {
      this._createTimerListTimer(choice.entity, durationMs, userLabel);
      this.requestUpdate();
      return true;
    }

    let targetEntity = this._config.default_timer_entity || "";
    if (this._config.auto_voice_pe === true) {
      const vpeEntity = this._getDefaultVoicePETargetEntity();
      if (vpeEntity) targetEntity = vpeEntity;
    }

    if (targetEntity) {
      const voicePEEnabled = this._config.auto_voice_pe === true;
      const controlEntityFromCfg = this._config?.voice_pe_control_entity ? String(this._config.voice_pe_control_entity).trim() : "";
      const canStartVoicePE = voicePEEnabled && !!controlEntityFromCfg;

      if (voicePEEnabled && !controlEntityFromCfg) {
        this._toast("Voice PE control entity is not set. Please configure it in the card editor.");
      }

      if (canStartVoicePE) {
        this._publishTimerEvent("started", { source: "voice_pe", source_entity: targetEntity, label: finalLabel });
        const userProvidedName = !!(label && String(label).trim());
        const nameForCommand = userProvidedName ? String(label).trim() : "";
        this._sendVoicePEStart(durationMs, nameForCommand, targetEntity);
        this.requestUpdate();
        return true;
      }
    }



    // Start a native HA timer.* entity through the timer.start service so the
    // standard timer.started / timer.finished events fire for automations.
    const explicitTimerList = this._isTimerListEntity(targetEntity) ? targetEntity : null;
    const nativeTimerTarget = explicitTimerList ? null : ((targetEntity && targetEntity.startsWith("timer.")) ? targetEntity : this._resolveNativeTimerTarget());
    if (nativeTimerTarget) {
      const serviceDuration = this._formatDurationForService(Math.round(durationMs / 1000));
      this.hass.callService("timer", "start", { entity_id: nativeTimerTarget, duration: serviceDuration });
      this._publishTimerEvent("started", { source: "timer", source_entity: nativeTimerTarget, label: finalLabel, duration: durationMs });
      this.requestUpdate();
      return true;
    }

    const timerListTarget = this._resolveTimerListTarget(targetEntity);
    if (timerListTarget) {
      const userProvidedName = userLabel;
      this._createTimerListTimer(timerListTarget, durationMs, userProvidedName);
      this.requestUpdate();
      return true;
    }

    if (targetEntity && (targetEntity.startsWith("input_text.") || targetEntity.startsWith("text."))) {
      const now = Date.now();
      const newTimer = {
        id: `custom-${now}`,
        kind: "active",
        state: "active",
        label: finalLabel,
        name: finalLabel,
        icon: this._config.default_timer_icon || "mdi:timer-outline",
        color: this._config.default_timer_color || "var(--primary-color)",
        source: "helper",
        source_entity: targetEntity,
        start_ts: now,
        end_ts: now + durationMs,
        duration: durationMs,
        supports: { pause: true, cancel: true, snooze: true, extend: true },
      };
      this._mutateHelper(targetEntity, (data) => { data.timers.push(newTimer); });
      this._publishTimerEvent("started", newTimer);
      this.requestUpdate();
      return true;
    }


    const now = Date.now();
    const t = {
      id: `custom-${now}`,
      kind: "active",
      label: finalLabel,
      name: finalLabel,
      source: this._config.storage === "mqtt" ? "mqtt" : "local",
      source_entity: this._config.storage === "mqtt" ? this._config.mqtt?.sensor_entity : "local",
      start_ts: now,
      end_ts: now + durationMs,
      state: "active",
      supports: { pause: true, cancel: true, snooze: true, extend: true },
      icon: this._config.default_timer_icon || "mdi:timer-outline",
      color: this._config.default_timer_color || "var(--primary-color)",
      duration: durationMs,
      paused: false,
      idle: false,
      finished: false,
    };
    this._addTimerToStorage(t);
    this._publishTimerEvent("started", t);
    this.requestUpdate();
    return true;
  }

  _startFromCustom(which, label) {
    if (!this._canStartCustomTimer(which)) return;
    const secs = this._customSecs[which];
    const inputId = which === "horizontal" ? "nt-h-name" : "nt-v-name";
    let finalLabel = label || this._lastSelectedName[inputId] || "";
    const input = this.shadowRoot?.getElementById(inputId);
    if (input && input.value) finalLabel = input.value.trim();
    if (!this._createAndSaveTimer(secs, finalLabel)) return;
    this._resetDurationInput(which);
    const openKey = `noTimer${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    this._ui[openKey] = false;
    this._showingCustomName[inputId] = false;
    this._lastSelectedName[inputId] = null;
    if (input) input.value = "";
    this.requestUpdate();
  }

  _startActive(which, label) {
    if (!this._canStartCustomTimer(which)) return;
    const secs = this._activeSecs[which];
    const inputId = which === "bar" ? "add-bar-name" : "add-fill-name";
    let finalLabel = label || this._lastSelectedName[inputId] || "";
    const input = this.shadowRoot?.getElementById(inputId);
    if (input && input.value) finalLabel = input.value.trim();
    if (!this._createAndSaveTimer(secs, finalLabel)) return;
    this._resetDurationInput(which);
    const openKey = `active${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    this._ui[openKey] = false;
    this._showingCustomName[inputId] = false;
    this._lastSelectedName[inputId] = null;
    if (input) input.value = "";
    this.requestUpdate();
  }

  _toggleActivePicker(which) {
    const openKey = `active${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    if (!this._ui[openKey]) this._prepareDurationInput(which);
    this._ui[openKey] = !this._ui[openKey];
    this.requestUpdate();
  }

  _adjustActive(which, value, sign = +1) {
    const delta = this._parseAdjustmentToSeconds(value);
    this._setDurationSeconds(which, this._activeSecs[which] + sign * delta);
  }

  _pickAutoMilestoneUnit(duration) {
    if (!duration || duration <= 0) return "seconds";
    if (duration >= YEAR_IN_MS) return "years";
    if (duration >= 30 * DAY_IN_MS) return "months";
    if (duration >= 7 * DAY_IN_MS) return "weeks";
    if (duration >= DAY_IN_MS) return "days";
    if (duration >= 3600 * 1000) return "hours";
    if (duration >= 60 * 1000) return "minutes";
    return "seconds";
  }

  _renderMilestoneSegments(t, pct) {
    if (this._config.progress_mode !== "milestones") return null;
    if (!["bar_horizontal", "bar_vertical"].includes(this._config.style)) return null;
    const cfgUnit = (this._config.milestone_unit || "auto").toLowerCase();
    const effectiveUnit = cfgUnit === "auto" ? this._pickAutoMilestoneUnit(t.duration) : cfgUnit;
    if (effectiveUnit === "none") return null;
    const unitMsMap = {
      years: YEAR_IN_MS,
      months: 30 * DAY_IN_MS,
      weeks: 7 * DAY_IN_MS,
      days: DAY_IN_MS,
      hours: 3600 * 1000,
      minutes: 60 * 1000,
      seconds: 1000
    };
    const unitMs = unitMsMap[effectiveUnit];
    if (!unitMs || !t.duration || t.duration <= 0) return null;
    const segments = Math.min(100, Math.max(1, Math.ceil(t.duration / unitMs)));
    if (!segments || segments <= 1) return null;
    const filledRaw = pct / 100 * segments;
    const completed = Math.floor(filledRaw);
    const activeIndex = Math.min(segments - 1, Math.max(0, completed));
    const idle = t.idle === true;
    return html`
      <div class="milestone-track ${idle ? "idle" : ""}">
        ${Array.from({ length: segments }).map((_, idx) => {
          if (idle) {
            return html`<div class="segment idle"></div>`;
          }
          const isCompleted = idx < completed;
          const shouldPulse = !t.paused && !t.idle && this._config.milestone_pulse !== false;
          const isActive = idx === activeIndex && shouldPulse;
          const isInactive = idx > completed;
          const cls = [
            "segment",
            isCompleted ? "completed" : "",
            isActive ? "active" : "",
            isInactive ? "inactive" : "",
            this._config.progress_mode === "drain" ? "drain" : "fill"
          ].join(" ");
          return html`<div class="${cls}"></div>`;
        })}
      </div>
    `;
  }

  _renderProgressTrack(t, style, pct, pctLeft) {
    const milestoneTrack = this._renderMilestoneSegments(t, pct);
    if (milestoneTrack) return milestoneTrack;
    return html`
      <div class="track">
        <div class="fill" style="width:${this._config.progress_mode === "drain" ? pctLeft : pct}%"></div>
      </div>
    `;
  }

  _openTimerEditor(t) {
    if (t.source !== "timer") return;
    const ms = t.duration || 0;
    const totalSeconds = Math.floor(ms / 1000);
    this._editDuration = {
      h: Math.floor(totalSeconds / 3600),
      m: Math.floor((totalSeconds % 3600) / 60),
      s: totalSeconds % 60
    };
    this._editingTimerId = t.id;
    this.requestUpdate();
  }

  _cancelEdit() {
    this._editingTimerId = null;
    this.requestUpdate();
  }

  _adjustEditTotal(deltaSeconds) {
    let total = this._editDuration.h * 3600 + this._editDuration.m * 60 + this._editDuration.s;
    total += deltaSeconds;
    if (total < 0) total = 0;
    this._editDuration = {
        h: Math.floor(total / 3600),
        m: Math.floor((total % 3600) / 60),
        s: total % 60
    };
    this.requestUpdate();
  }

  async _saveTimerConfig(t) {
    const { h, m, s } = this._editDuration;
    const durationStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const stateObj = this.hass.states[t.source_entity];
    const name = stateObj.attributes.friendly_name || t.source_entity;

    try {
        await this.hass.callWS({
            type: "timer/update",
            timer_id: t.source_entity.replace("timer.", ""),
            duration: durationStr,
            name: name,
            icon: stateObj.attributes.icon || ""
        });
    } catch(e) {
        if (this.hass.services?.timer?.set_duration) {
            try {
                await this.hass.callService("timer", "set_duration", {
                    entity_id: t.source_entity,
                    duration: durationStr
                });
                return;
            } catch(e2) {
                console.error("Error updating timer via set_duration", e2);
            }
        }
        if (e.code === "not_found") {
            console.warn(`Timer ${t.source_entity} is not registry-managed (likely YAML-defined). Config update skipped.`);
            return;
        }
        console.error("Error updating timer", e);
        this._toast(`Error: ${e.message}`);
        throw e;
    }
  }

  async _startEditTimer(t) {
    try {
        await this._saveTimerConfig(t);

        const { h, m, s } = this._editDuration;
        const durationStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        this.hass.callService("timer", "start", {
            entity_id: t.source_entity,
            duration: durationStr
        });
        this._editingTimerId = null;
        this.requestUpdate();
    } catch (e) {
    }
  }

  async _saveAndClose(t) {
      await this._saveTimerConfig(t);
      this._editingTimerId = null;
      this.requestUpdate();
  }

  _renderInlineEditor(t, style) {
    const isCircle = style === "circle_vertical";
    const baseClasses = style.startsWith("fill_")
      ? "card item editor-row"
      : (isCircle ? "item vtile editor-row" : "item bar editor-row");

    const minuteButtons = this._config.minute_buttons?.length
      ? this._config.minute_buttons
      : [1, 5, 10];

    const totalSeconds = this._editDuration.h * 3600 + this._editDuration.m * 60 + this._editDuration.s;
    const stateObj = t.source_entity ? this.hass.states[t.source_entity] : null;
    const timerName = stateObj?.attributes?.friendly_name || t.label || t.source_entity || "";

    const renderAdjustButtons = (sign) => minuteButtons.map((val) => {
      const delta = this._parseAdjustmentToSeconds(val);
      const isNegative = sign < 0;
      const isClickable = !isNegative || totalSeconds >= delta;
      const displayLabel = this._renderPresetLabel(val, isNegative ? "-" : "+");

      return html`
        <button class="btn btn-ghost ${isClickable ? "" : "disabled"}"
                @click=${() => isClickable && this._adjustEditTotal(sign * delta)}>
          ${displayLabel}
        </button>
      `;
    });

    return html`
      <li class="${baseClasses}" style="--tcolor:${t.color || "var(--primary-color)"}; cursor: default;">
        <div class="editor-container">
          <div class="buttons-grid">
            ${renderAdjustButtons(+1)}
          </div>

          <div class="display" dir="ltr">${this._formatClock(totalSeconds, true)}</div>

          <div class="buttons-grid">
            ${renderAdjustButtons(-1)}
          </div>

          <input class="text-input" placeholder="${this._localize("timer_name_optional")}" readonly style="margin-top: 12px;"
                 .value=${this._sanitizeText(timerName)} />

          <div class="picker-actions">
            <button class="btn btn-ghost" @click=${() => this._cancelEdit()}>${this._localize("cancel")}</button>
            <button class="btn btn-ghost" @click=${() => this._saveAndClose(t)}>${this._localize("save")}</button>
            <button class="btn btn-primary" @click=${() => this._startEditTimer(t)}>${this._localize("start")}</button>
          </div>
        </div>
      </li>
    `;
  }

  _renderItem(t, style) {
    if (this._editingTimerId === t.id) {
        return this._renderInlineEditor(t, style);
    }
    const state = this._getTimerRenderState(t, style);
    const { isPaused, isIdle, isFinished, color, icon, ring, pct, pctLeft, isCircleStyle, isCircleHorizontal, isFillStyle, supportsPause, supportsManualControls, supportsSnooze, timeStr, circleValues, supportsReadOnlyDismiss } = state;
    const isCircleTile = isCircleStyle && !isCircleHorizontal;
    const baseClasses = isFillStyle ? "card item" : (isCircleTile ? "item vtile" : "item bar");
    const finishedClasses = isFillStyle ? "card item finished" : (isCircleTile ? "item vtile" : "card item bar");

    const isRunning = !t.idle && !t.paused && !t.finished;
    const canEdit = t.source === "timer" && !isRunning;

    if (ring) {
      if (isCircleTile) {
        return html`
          <li class="${finishedClasses}${this._ringAnimationClass()}" style="--tcolor:${color}">
            <div class="vcol">
              <div class="vcircle-wrap">
                <svg class="vcircle" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                  <circle class="vc-track ${this._config.progress_mode === "drain" ? "vc-track-drain" : ""}" style="stroke: var(--tcolor, var(--primary-color)); stroke-opacity: 0.22;"
                          cx="32" cy="32" r="${circleValues.radius}"></circle>
                  <circle class="vc-prog ${this._config.progress_mode === "drain" ? "vc-prog-drain done" : "done"}"
                          cx="32" cy="32" r="${circleValues.radius}"
                    stroke-dasharray="${circleValues.circumference} ${circleValues.circumference}"
                    style="stroke: var(--tcolor, var(--primary-color)); stroke-dashoffset: ${this._config.progress_mode === "drain" ? circleValues.circumference : "0"};
                            transition: stroke-dashoffset 0.25s;"></circle>
                </svg>
                <div class="icon-wrap xl"><ha-icon .icon=${icon}></ha-icon></div>
              </div>
              <div class="vtitle">${t.label}</div>
              <div class="vstatus up">${timeStr}</div>
              <div class="vactions">
                ${supportsManualControls ? html`
                  ${supportsSnooze ? html`<button class="chip" @click=${() => this._handleSnooze(t)}>${this._localize("snooze")}</button>` : ""}
                  <button class="chip" @click=${() => this._handleDismiss(t)}>${this._localize("dismiss")}</button>
                ` : supportsReadOnlyDismiss ? html`
                  <button class="chip" @click=${() => this._handleDismiss(t)}>${this._localize("dismiss")}</button>
                ` : ""}
              </div>
            </div>
          </li>
        `;
      }
      return html`
        <li class="${finishedClasses}${this._ringAnimationClass()}" style="--tcolor:${color}">
          ${isFillStyle ? html`<div class="progress-fill" style="width:100%"></div>` : ""}
          <div class="${isFillStyle ? "card-content" : "row"}">
            <div class="icon-wrap"><ha-icon .icon=${icon}></ha-icon></div>
            <div class="info">
              <div class="title">${t.label}</div>
              <div class="status up">${timeStr}</div>
            </div>
            ${supportsManualControls ? html`
              <div class="chips">
                ${supportsSnooze ? html`<button class="chip" @click=${() => this._handleSnooze(t)}>${this._localize("snooze")}</button>` : ""}
                <button class="chip" @click=${() => this._handleDismiss(t)}>${this._localize("dismiss")}</button>
              </div>
            ` : supportsReadOnlyDismiss ? html`
              <div class="chips">
                <button class="chip" @click=${() => this._handleDismiss(t)}>${this._localize("dismiss")}</button>
              </div>
            `: ""}
          </div>
        </li>
      `;
    }

    const acts = this._rowActionHandlers(t, canEdit);
    const rowStyle = (canEdit || this._hasAnyRowAction(t)) ? "cursor: pointer;" : "";

    const fillPct = this._config.progress_mode === "drain" ? pctLeft : pct;
    const fillInlineStyle = `width:${fillPct}%;`;

    if (isFillStyle) {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @pointerdown=${acts.down} @pointerup=${acts.up} @pointercancel=${acts.cancel}>
          <div class="progress-fill" style="${fillInlineStyle}"></div>
          <div class="card-content">
            <div class="icon-wrap"><ha-icon .icon=${icon}></ha-icon></div>
            <div class="info">
              <div class="title">${t.label}</div>
              <div class="status">${timeStr}</div>
            </div>
            <div class="actions" @click=${(e) => e.stopPropagation()}>
              ${this._renderCustomActionButtons(t, state)}
              ${isIdle && supportsManualControls ? html`
                <button class="action-btn" title="${this._localize("start")}" @click=${() => this._handleStart(t)}>
                  <ha-icon icon="mdi:play"></ha-icon>
                </button>
              ` : supportsPause && !ring && supportsManualControls ? html`
                <button class="action-btn" title="${t.paused ? "Resume" : "Pause"}" @click=${() => t.paused ? this._handleResume(t) : this._handlePause(t)}>
                  <ha-icon icon=${t.paused ? "mdi:play" : "mdi:pause"}></ha-icon>
                </button>
              ` : ""}
              ${supportsManualControls && !isIdle ? html`<button class="action-btn" title="${this._localize("cancel")}" @click=${() => this._handleCancel(t)}><ha-icon icon="mdi:close"></ha-icon></button>` : ""}
            </div>
          </div>
        </li>
      `;
    } else if (isCircleHorizontal) {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @pointerdown=${acts.down} @pointerup=${acts.up} @pointercancel=${acts.cancel}>
          <div class="row">
            <div class="icon-wrap"><ha-icon .icon=${icon}></ha-icon></div>
            <div class="info">
              <div class="title">${t.label}</div>
              <div class="status">${timeStr}</div>
            </div>
            <div class="actions" @click=${(e) => e.stopPropagation()}>
              ${this._renderCustomActionButtons(t, state)}
              ${isIdle && supportsManualControls ? html`
                <button class="action-btn" title="${this._localize("start")}" @click=${() => this._handleStart(t)}>
                  <ha-icon icon="mdi:play"></ha-icon>
                </button>
              ` : supportsPause && !ring && supportsManualControls ? html`
                <button class="action-btn" title="${t.paused ? "Resume" : "Pause"}" @click=${() => t.paused ? this._handleResume(t) : this._handlePause(t)}>
                  <ha-icon icon=${t.paused ? "mdi:play" : "mdi:pause"}></ha-icon>
                </button>
              ` : ""}
              ${supportsManualControls && !isIdle ? html`<button class="action-btn" title="${this._localize("cancel")}" @click=${() => this._handleCancel(t)}><ha-icon icon="mdi:close"></ha-icon></button>` : ""}
            </div>
            <div class="hcircle-wrap">
              <svg class="hcircle" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
                <circle class="vc-track ${this._config.progress_mode === "drain" ? "vc-track-drain" : ""}"
                        cx="20" cy="20" r="${circleValues.radius}"></circle>
                <circle class="vc-prog ${this._config.progress_mode === "drain" ? "vc-prog-drain" : ""}"
                        cx="20" cy="20" r="${circleValues.radius}"
                  stroke-dasharray="${circleValues.circumference} ${circleValues.circumference}"
                  style="stroke-dashoffset: ${circleValues.strokeDashoffset}; transition: stroke-dashoffset 0.25s;"></circle>
              </svg>
            </div>
          </div>
        </li>
      `;
    } else if (isCircleTile) {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @pointerdown=${acts.down} @pointerup=${acts.up} @pointercancel=${acts.cancel}>
          ${supportsManualControls && !isIdle ? html`
            <button class="vtile-close" title="${this._localize("cancel")}"
              @click=${(e)=>{ e.stopPropagation(); this._handleCancel(t); }}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          ` : ""}
          ${this._renderCircleCustomButtons(t, state)}
          <div class="vcol">
            <div class="vcircle-wrap"
                 title="${isIdle ? "Start" : (t.paused ? "Resume" : "Pause")}"
                 @click=${(e)=> {
                   e.stopPropagation();
                   if (isIdle && supportsManualControls) this._handleStart(t);
                   else if (supportsPause && supportsManualControls) this._togglePause(t, e);
                 }}>
              <svg class="vcircle" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                <circle class="vc-track ${this._config.progress_mode === "drain" ? "vc-track-drain" : ""}" style="stroke: var(--tcolor, var(--primary-color)); stroke-opacity: 0.22;"
                        cx="32" cy="32" r="${circleValues.radius}"></circle>
                <circle class="vc-prog ${this._config.progress_mode === "drain" ? "vc-prog-drain" : ""}"
                        cx="32" cy="32" r="${circleValues.radius}"
                  stroke-dasharray="${circleValues.circumference} ${circleValues.circumference}"
                  style="stroke: var(--tcolor, var(--primary-color)); stroke-dashoffset: ${circleValues.strokeDashoffset}; transition: stroke-dashoffset 0.25s;"></circle>
              </svg>
              <div class="icon-wrap xl"><ha-icon .icon=${icon}></ha-icon></div>
            </div>
            <div class="vtitle">${t.label}</div>
            <div class="vstatus">${timeStr}</div>
          </div>
        </li>
      `;
    } else {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @pointerdown=${acts.down} @pointerup=${acts.up} @pointercancel=${acts.cancel}>
          <div class="row">
            <div class="icon-wrap"><ha-icon .icon=${icon}></ha-icon></div>
            <div class="info">
              <div class="top">
                <div class="title">${t.label}</div>
                <div class="status">${timeStr}</div>
              </div>
              ${this._renderProgressTrack(t, style, pct, pctLeft)}
            </div>
            <div class="actions" @click=${(e) => e.stopPropagation()}>
              ${this._renderCustomActionButtons(t, state)}
              ${isIdle && supportsManualControls ? html`
                <button class="action-btn" title="${this._localize("start")}" @click=${() => this._handleStart(t)}>
                  <ha-icon icon="mdi:play"></ha-icon>
                </button>
              ` : supportsPause && !ring && supportsManualControls ? html`
                <button class="action-btn" title="${t.paused ? "Resume" : "Pause"}" @click=${() => t.paused ? this._handleResume(t) : this._handlePause(t)}>
                  <ha-icon icon=${t.paused ? "mdi:play" : "mdi:pause"}></ha-icon>
                </button>
              ` : ""}
              ${supportsManualControls && !isIdle ? html`<button class="action-btn" title="${this._localize("cancel")}" @click=${() => this._handleCancel(t)}><ha-icon icon="mdi:close"></ha-icon></button>` : ""}
            </div>
          </div>
        </li>
      `;
    }
  }

  // === Custom action buttons (v2.7.0) ===
  // Opt-in extra buttons rendered alongside the built-in start/pause/cancel
  // controls. Configured via `buttons:` at card level and/or per entity
  // (entity overrides card, matching the tap_action resolution model).
  _getCustomButtons(t) {
    if (!t) return [];
    let raw = Array.isArray(t.buttons) ? t.buttons : null;
    if (!raw) {
      const rowConf = this._getEntityConfig(t.source_entity) || {};
      if (Array.isArray(rowConf.buttons)) raw = rowConf.buttons;
    }
    if (!raw && Array.isArray(this._config.buttons)) raw = this._config.buttons;
    if (!raw || !raw.length) return [];
    return raw.map((b) => this._normalizeCustomButton(b)).filter(Boolean);
  }

  _normalizeCustomButton(b) {
    if (!b || typeof b !== "object") return null;
    const action = b.action;
    const icon = b.icon || this._customButtonPresetIcon(action);
    if (!icon) return null;
    let states = b.show_when;
    if (typeof states === "string") states = states.split(",").map((s) => s.trim());
    if (!Array.isArray(states) || !states.length) states = ["running", "paused"];
    states = states.map((s) => String(s).toLowerCase());
    return {
      icon,
      name: b.name || "",
      color: b.color || "",
      states: new Set(states),
      action,
      amount: b.amount,
    };
  }

  _customButtonPresetIcon(action) {
    if (typeof action !== "string") return "";
    switch (action) {
      case "finish": return "mdi:flag-checkered";
      case "add": return "mdi:plus";
      case "reduce": return "mdi:minus";
      case "restart": return "mdi:restart";
      case "cancel": return "mdi:close";
      case "pause": return "mdi:pause";
      case "resume": return "mdi:play";
      case "snooze": return "mdi:alarm-snooze";
      case "dismiss": return "mdi:bell-off";
      default: return "";
    }
  }

  _customButtonState(state) {
    if (state.isIdle) return "idle";
    if (state.isPaused) return "paused";
    if (state.isFinished || state.ring) return "finished";
    return "running";
  }

  _visibleCustomButtons(t, state) {
    const cur = this._customButtonState(state);
    return this._getCustomButtons(t).filter((b) => b.states.has(cur));
  }

  _renderCustomActionButtons(t, state) {
    const btns = this._visibleCustomButtons(t, state);
    if (!btns.length) return "";
    return btns.map((b) => html`
      <button class="action-btn custom-action-btn" title="${b.name}"
        style=${b.color ? `color:${b.color}` : ""}
        @click=${(e) => this._handleCustomButton(t, b, e)}>
        <ha-icon icon="${b.icon}"></ha-icon>
      </button>
    `);
  }

  _renderCircleCustomButtons(t, state) {
    const btns = this._visibleCustomButtons(t, state);
    if (!btns.length) return "";
    return html`
      <div class="vtile-actions">
        ${btns.map((b) => html`
          <button class="vtile-action" title="${b.name}"
            style=${b.color ? `color:${b.color}` : ""}
            @click=${(e) => this._handleCustomButton(t, b, e)}>
            <ha-icon icon="${b.icon}"></ha-icon>
          </button>
        `)}
      </div>
    `;
  }

  _handleCustomButton(t, btn, e) {
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    const action = btn.action;
    if (typeof action === "string") {
      switch (action) {
        case "finish": return this._handleFinish(t);
        case "add": {
          if (btn.amount == null || btn.amount === "") { this._toast("This button needs an amount of time to add."); return; }
          return this._handleAddTime(t, this._parseAdjustmentToSeconds(btn.amount));
        }
        case "reduce": {
          if (btn.amount == null || btn.amount === "") { this._toast("This button needs an amount of time to reduce."); return; }
          return this._handleAddTime(t, -this._parseAdjustmentToSeconds(btn.amount));
        }
        case "restart": return this._handleRestart(t);
        case "cancel": return this._handleCancel(t);
        case "pause": return this._togglePause(t, e);
        case "resume": return this._handleResume(t);
        case "snooze": return this._handleSnooze(t);
        case "dismiss": return this._handleDismiss(t);
        default: return;
      }
    }
    if (action && typeof action === "object" && action.action) {
      let resolved = action;
      if (action.action === "perform-action" || action.action === "call-service") {
        const hasTarget = action.target && (action.target.entity_id || action.target.area_id || action.target.device_id || action.target.label_id);
        const hasDataEntity = action.data && action.data.entity_id;
        if (!hasTarget && !hasDataEntity && t.source_entity) {
          resolved = { ...action, target: { ...(action.target || {}), entity_id: t.source_entity } };
        }
      }
      this._fireAction(resolved, { cardLevel: false, entityId: t.source_entity, timer: t });
    }
  }

  _handleFinish(t) {
    if (this._isActionThrottled("finish", t.id)) return;
    this._ringingTimers.delete(t.id);
    if (t.source === "voice_pe") {
      if (!this._isLocalVoicePETimer(t)) {
        this._toast("This timer is read only.");
        return;
      }
      this._publishTimerEvent("finished", t);
      this._sendVoicePECommand(t.control_entity, `cancel:${String(t.voice_pe_timer_id).trim()}`);
      return;
    }
    if (t.source === "timer_list") {
      if (!t.supports?.finish) return this._timerListUnsupported();
      this._publishTimerEvent("finished", t);
      this._callTimerListService(t, "finish_timer");
      return;
    }
    this._publishTimerEvent("finished", t);
    if (t.source === "helper") {
      this._mutateHelper(t.source_entity, (data) => { data.timers = data.timers.filter((x) => x.id !== t.id); });
    } else if (["local", "mqtt"].includes(t.source)) {
      this._removeTimerFromStorage(t.id, t.source);
      this.requestUpdate();
    } else if (t.source === "timer") {
      this.hass.callService("timer", "finish", { entity_id: t.source_entity });
    } else {
      this._toast("This timer can't be finished from here.");
    }
  }

  _ringAnimationClass() {
    const value = String(this._config?.ring_animation || "none").toLowerCase();
    return ["pulse", "swing", "shake", "hop"].includes(value) ? ` ring-${value}` : "";
  }

  _calculateCircleValues(radius = 28, pct = 0, mode = "fill") {
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = mode === "drain"
      ? (pct / 100) * circumference
      : circumference - (pct / 100) * circumference;
    return { radius, circumference, strokeDashoffset };
  }

  _getTimerRenderState(t, style) {
    const isPaused = t.paused;
    const isIdle = t.idle;
    const isFinished = t.finished;
    const overGoal = t.count_up && t.duration > 0 && t.remaining > t.duration;
    const color = isPaused || overGoal ? "var(--warning-color)" : (isFinished ? "var(--success-color)" : (t.color || "var(--primary-color)"));
    const icon = isIdle ? (t.icon || "mdi:timer-outline") : (isPaused ? "mdi:timer-pause" : (isFinished ? "mdi:timer-check" : (t.icon || "mdi:timer-outline")));
    const ring = t.remaining <= 0 && !isIdle && !isFinished && !t.count_up;
    const pct = typeof t.percent === "number" ? Math.max(0, Math.min(100, t.percent)) : 0;
    const pctLeft = 100 - pct;
    const isCircleStyle = _isCircleStyle(style);
    const isCircleHorizontal = style === "circle_horizontal";
    const isFillStyle = style.startsWith("fill_");
    const isTimerList = t.source === "timer_list";
    const supportsPause = (["helper", "local", "mqtt", "timer"].includes(t.source) || (t.source === "voice_pe" && !!(t.control_entity && String(t.control_entity).trim() && t.voice_pe_timer_id && String(t.voice_pe_timer_id).trim()))) || (isTimerList && t.supports?.pause === true);
    const entityConf = this._getEntityConfig(t.source_entity);
    const hideTimerActions = entityConf?.hide_timer_actions === true;
    const isTimerSource = t.source === "timer";
    const timerListControls = isTimerList && !hideTimerActions && !!(t.supports && (t.supports.pause || t.supports.cancel || t.supports.finish || t.supports.extend));
    const supportsManualControls = (((["local", "mqtt", "timer", "helper"].includes(t.source)) || t.kind === "template" || t.source === "template") && !(isTimerSource && hideTimerActions)) || (t.source === "voice_pe" && !!(t.control_entity && String(t.control_entity).trim())) || timerListControls;
    const supportsSnooze = supportsManualControls && (!isTimerList || t.supports?.snooze === true);
    const supportsReadOnlyDismiss = ring && (["timestamp", "minutes_attr", "alexa", "google", "voice_satellite", "dynamic"].includes(t.source) || (isTimerList && !supportsManualControls));
    let timeStr;
    if (t.count_up) timeStr = this._localize("since").replace("{t}", this._formatTimeString(t));
    else if (isIdle) timeStr = t.duration ? this._formatDuration(t.duration, "ms") : this._localize("ready");
    else if (isPaused) timeStr = `${this._formatDuration(t.remaining, "ms")} (${this._localize("paused")})`;
    else if (isFinished) {
      const now = Date.now();
      const elapsedSinceFinish = now - (t.finishedAt || t.end_ts || now);
      const elapsedStr = this._formatTimeAgo(elapsedSinceFinish);
      const expiredMessage = t.expired_subtitle || entityConf?.expired_subtitle || this._config.expired_subtitle || this._localize("times_up");
      timeStr = elapsedStr ? `${expiredMessage} - ${elapsedStr}` : expiredMessage;
    } else if (ring) {
      timeStr = t.expired_subtitle || entityConf?.expired_subtitle || this._config.expired_subtitle || this._localize("times_up");
    } else {
      timeStr = this._formatTimeString(t);
    }
    // "then Turn off …" describes what is still to come, so an ended timer drops it.
    if (t.context_label && !(t.context_is_action && (ring || isFinished))) timeStr = `${timeStr} · ${t.context_label}`;
    let circleValues;
    if (isCircleStyle) {
      const progressMode = this._config.progress_mode === "drain" ? "drain" : "fill";
      circleValues = this._calculateCircleValues(isCircleHorizontal ? 17 : 28, pct, progressMode);
    }
    return {
      isPaused, isIdle, isFinished, color, icon, ring, pct, pctLeft,
      isCircleStyle, isCircleHorizontal, isFillStyle,
      supportsPause, supportsManualControls, supportsSnooze, timeStr,
      circleValues, supportsReadOnlyDismiss
    };
  }

  _renderDurationInput(which) {
    const keypad = this._timerInputMode === "keypad";
    const digits = this._keypadDigits[which] ?? secondsToDurationDigits(this._durationSeconds(which));
    const fields = durationDigitFields(digits);
    const units = ["h", "m", "s"];
    const adjust = ["horizontal", "vertical"].includes(which) ? this._adjust.bind(this) : this._adjustActive.bind(this);
    return html`
      <div class="duration-entry" data-input-mode=${this._timerInputMode}>
        ${this._config.show_timer_input_selector ? html`
          <div class="duration-mode" role="group" aria-label=${this._localize("duration_input")}>
            ${["stepper", "keypad"].map(mode => html`
              <button type="button" class="duration-mode-btn" aria-pressed=${String(this._timerInputMode === mode)}
                @click=${() => this._setTimerInputMode(which, mode)}>${this._localize(`input_${mode}`)}</button>
            `)}
          </div>
        ` : ""}
        ${keypad ? html`
          <div class="duration-keypad" role="group" tabindex="0" aria-label=${this._localize("input_keypad")}
            @keydown=${(e) => this._durationKeyDown(which, e)}>
            <div class="duration-display-row">
              <output class="duration-readout" dir="ltr" aria-live="polite" aria-atomic="true">
                ${fields.map((field, index) => this._renderDurationValue(field, this._localize(units[index])))}
              </output>
              <button type="button" class="duration-clear" ?disabled=${!digits}
                @click=${() => this._durationKey(which, "clear")}>${this._localize("clear")}</button>
            </div>
            <div class="duration-key-grid" dir="ltr">
              ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "backspace"].map(key => html`
                <button type="button" class="duration-key" data-key=${key}
                  aria-label=${key === "backspace" ? this._localize("backspace") : key}
                  ?disabled=${key === "backspace" ? !digits : editDurationDigits(digits, key) === null}
                  @click=${() => this._durationKey(which, key)}>
                  ${key === "backspace" ? html`<ha-icon icon="mdi:backspace-outline" aria-hidden="true"></ha-icon>` : key}
                </button>
              `)}
            </div>
          </div>
        ` : html`
          <div class="buttons-grid">${this._renderMinuteButtons(which, adjust, +1)}</div>
          <div class="display" dir="ltr">${this._formatClock(this._durationSeconds(which), true)}</div>
          <div class="buttons-grid">${this._renderMinuteButtons(which, adjust, -1)}</div>
        `}
      </div>
    `;
  }

  _renderCustomTimerPicker(which) {
    const custom = ["horizontal", "vertical"].includes(which);
    const capitalized = which.charAt(0).toUpperCase() + which.slice(1);
    const openKey = custom ? `noTimer${capitalized}Open` : `active${capitalized}Open`;
    const nameId = custom ? (which === "horizontal" ? "nt-h-name" : "nt-v-name") : `add-${which}-name`;
    return html`
      <div class=${custom ? "picker" : "active-picker"} data-duration-picker=${which} data-no-action
        ?inert=${!this._ui[openKey]} aria-hidden=${String(!this._ui[openKey])}
        @click=${(e) => e.stopPropagation()}>
        ${this._actionWizard?.which === which ? this._renderActionWizard() : html`
        ${this._renderDurationInput(which)}
        ${this._renderTimerNameSelector(nameId, this._localize("timer_name_optional"))}
        ${this._renderTargetPicker(which)}
        <div class="picker-actions">
          <button type="button" class="btn btn-ghost"
            @click=${() => { this._ui[openKey] = false; this.requestUpdate(); }}>${this._localize("cancel")}</button>
          <button type="button" class="btn btn-primary" ?disabled=${!this._canStartCustomTimer(which)}
            @click=${() => custom ? this._startFromCustom(which) : this._startActive(which)}>${this._localize("start")}</button>
        </div>
        `}
      </div>
    `;
  }

  _renderMinuteButtons(which, adjustFunction, sign) {
    const minuteButtons = this._config.minute_buttons?.length ? this._config.minute_buttons : [1, 5, 10];
    const target = ["horizontal", "vertical"].includes(which) ? "custom" : "active";
    const whichKey = which === "horizontal" ? "horizontal" : (which === "vertical" ? "vertical" : (which === "fill" ? "fill" : "bar"));
    const currentSecs = this[`_${target}Secs`][whichKey];
    return minuteButtons.map(val => {
      const delta = this._parseAdjustmentToSeconds(val);
      const isNegative = sign < 0;
      const isClickable = !isNegative || (currentSecs >= delta);
      const displayLabel = this._renderPresetLabel(val, isNegative ? "-" : "+");
      return html`
        <button class="btn btn-ghost ${isClickable ? "" : "disabled"}"
          type="button" ?disabled=${!isClickable}
                @click=${() => isClickable && adjustFunction(whichKey, val, sign)}>
                  ${displayLabel}
        </button>
      `;
    });
  }

  _renderItemVertical(t, style) {
    if (this._editingTimerId === t.id) {
        return this._renderInlineEditor(t, style);
    }
    const state = this._getTimerRenderState(t, style);
    const { isPaused, isIdle, isFinished, color, icon, ring, pct, pctLeft, isCircleStyle, isFillStyle, supportsPause, supportsManualControls, supportsSnooze, timeStr, circleValues, supportsReadOnlyDismiss } = state;
    const baseClasses = style.startsWith("fill_") ? "card item vtile" : "item vtile";

    const isRunning = !t.idle && !t.paused && !t.finished;
    const canEdit = t.source === "timer" && !isRunning;
    const acts = this._rowActionHandlers(t, canEdit);
    const rowStyle = (canEdit || this._hasAnyRowAction(t)) ? "cursor: pointer;" : "";

    const fillPct = this._config.progress_mode === "drain" ? pctLeft : pct;
    const fillInlineStyle = `width:${fillPct}%;`;

    if (ring) {
      return html`
        <li class="${baseClasses}${this._ringAnimationClass()}" style="--tcolor:${color}">
          ${style.startsWith("fill_") ? html`<div class="progress-fill" style="width:100%"></div>` : ""}
          <div class="vcol">
            <div class="icon-wrap large"><ha-icon .icon=${icon}></ha-icon></div>
            <div class="vtitle">${t.label}</div>
            <div class="vstatus up">${timeStr}</div>
            <div class="vactions-center">
              ${supportsManualControls ? html`
                ${supportsSnooze ? html`<button class="chip" @click=${() => this._handleSnooze(t)}>${this._localize("snooze")}</button>` : ""}
                <button class="chip" @click=${() => this._handleDismiss(t)}>${this._localize("dismiss")}</button>
              ` : supportsReadOnlyDismiss ? html`
                <button class="chip" @click=${() => this._handleDismiss(t)}>${this._localize("dismiss")}</button>
              ` : ""}
            </div>
          </div>
        </li>
      `;
    }

    if (style === "circle_vertical") {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @pointerdown=${acts.down} @pointerup=${acts.up} @pointercancel=${acts.cancel}>
          ${supportsManualControls && !isIdle ? html`
            <button class="vtile-close" title="${this._localize("cancel")}"
              @click=${(e)=>{ e.stopPropagation(); this._handleCancel(t); }}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          ` : ""}
          ${this._renderCircleCustomButtons(t, state)}
          <div class="vcol">
            <div class="vcircle-wrap"
                 title="${isIdle ? "Start" : (t.paused ? "Resume" : "Pause")}"
                 @click=${(e)=> {
                   e.stopPropagation();
                   if (canEdit) {
                     this._openTimerEditor(t);
                     return;
                   }
                   if (isIdle && supportsManualControls) this._handleStart(t);
                   else if (supportsPause && supportsManualControls) this._togglePause(t, e);
                 }}>
              <svg class="vcircle" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                <circle class="vc-track ${this._config.progress_mode === "drain" ? "vc-track-drain" : ""}"
                        cx="32" cy="32" r="${circleValues.radius}"></circle>
                <circle class="vc-prog ${this._config.progress_mode === "drain" ? "vc-prog-drain" : ""}"
                        cx="32" cy="32" r="${circleValues.radius}"
                  stroke-dasharray="${circleValues.circumference} ${circleValues.circumference}"
                  style="stroke-dashoffset: ${circleValues.strokeDashoffset}; transition: stroke-dashoffset 0.25s;"></circle>
              </svg>
              <div class="icon-wrap xl"><ha-icon .icon=${icon}></ha-icon></div>
            </div>
            <div class="vtitle">${t.label}</div>
            <div class="vstatus">${timeStr}</div>
          </div>
        </li>
      `;
    }

    return html`
      <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @pointerdown=${acts.down} @pointerup=${acts.up} @pointercancel=${acts.cancel}>
        ${style.startsWith("fill_") ? html`<div class="progress-fill" style="${fillInlineStyle}"></div>` : ""}
        <div class="vcol">
          <div class="icon-wrap large"><ha-icon .icon=${icon}></ha-icon></div>
          <div class="vtitle">${t.label}</div>
          <div class="vstatus">${timeStr}</div>
          ${style.startsWith("bar_") ? html`
            <div class="vprogressbar" @click=${(e) => e.stopPropagation()}>
              ${this._renderCustomActionButtons(t, state)}
              ${isIdle && supportsManualControls ? html`
                <button class="action-btn" title="${this._localize("start")}" @click=${() => this._handleStart(t)}>
                  <ha-icon icon="mdi:play"></ha-icon>
                </button>
              ` : supportsPause && supportsManualControls ? html`
                <button class="action-btn"
                  title="${t.paused ? "Resume" : "Pause"}"
                  @click=${() => t.paused ? this._handleResume(t) : this._handlePause(t)}>
                  <ha-icon icon=${t.paused ? "mdi:play" : "mdi:pause"}></ha-icon>
                </button>
              ` : ""}
              ${this._renderMilestoneSegments(t, pct) || html`
                <div class="vtrack small">
                  <div class="vfill" style="width:${this._config.progress_mode === "drain" ? pctLeft : pct}%"></div>
                </div>
              `}
              ${supportsManualControls && !isIdle ? html`
                <button class="action-btn" title="${this._localize("cancel")}" @click=${() => this._handleCancel(t)}>
                  <ha-icon icon="mdi:close"></ha-icon>
                </button>
              ` : ""}
            </div>
          ` : html`

            <div class="vactions" @click=${(e) => e.stopPropagation()}>
              ${this._renderCustomActionButtons(t, state)}
              ${isIdle && supportsManualControls ? html`
                <button class="action-btn" title="${this._localize("start")}" @click=${() => this._handleStart(t)}>
                  <ha-icon icon="mdi:play"></ha-icon>
                </button>
              ` : supportsPause && supportsManualControls ? html`
                <button class="action-btn"
                  title="${t.paused ? "Resume" : "Pause"}"
                  @click=${() => t.paused ? this._handleResume(t) : this._handlePause(t)}>
                  <ha-icon icon=${t.paused ? "mdi:play" : "mdi:pause"}></ha-icon>
                </button>
              ` : ""}
              ${supportsManualControls && !isIdle ? html`
                <button class="action-btn" title="${this._localize("cancel")}" @click=${() => this._handleCancel(t)}>
                  <ha-icon icon="mdi:close"></ha-icon>
                </button>
              ` : ""}
            </div>
          `}
        </div>
      </li>
    `;
  }

  _getPinnedTimers() {
    const pinned = Array.isArray(this._config?.pinned_timers) ? this._config.pinned_timers : [];
    if (pinned.length === 0) return [];
    const ns = this._storageNamespace || "default";
    return pinned.map((p, idx) => {
      const durationInput = (p && typeof p === "object") ? (p.duration ?? p.preset ?? p.minutes ?? p.secs) : p;
      const durationMs = this._parseDurationInputToMs(durationInput);
      if (!durationMs) return null;
      const label = (p && typeof p === "object" && p.name) ? p.name : `#${idx + 1}`;
      const icon = (p && typeof p === "object" && p.icon) ? p.icon : (this._config.default_timer_icon || "mdi:timer-outline");
      const color = (p && typeof p === "object" && p.color) ? p.color : (this._config.default_timer_color || "var(--primary-color)");
      const userId = (p && typeof p === "object" && p.id) ? String(p.id) : null;
      const basePinnedId = userId || `pinned-${idx}`;
      const pinnedId = `${ns}:${basePinnedId}`;
      const templateId = `template:${pinnedId}`;

      return {
        id: templateId,
        pinned_id: pinnedId,
        kind: "template",
        name: label,
        label,
        source: "template",
        source_entity: null,
        start_ts: null,
        end_ts: null,
        state: "idle",
        supports: { pause: false, cancel: false, snooze: false, extend: false },

        template_preset: durationInput,
        duration_input: durationInput,

        icon,
        color,
        buttons: (p && typeof p === "object" && Array.isArray(p.buttons)) ? p.buttons : undefined,
        on_finish: (p && typeof p === "object" && this._normalizeActionSpec(p.on_finish)) || undefined,
        expired_subtitle: (p && typeof p === "object" && p.expired_subtitle) ? p.expired_subtitle : (this._config.expired_subtitle || ""),
        audio_enabled: (p && typeof p === "object" && p.audio_enabled === true) ? true : undefined,
        audio_file_url: (p && typeof p === "object" && p.audio_file_url) ? p.audio_file_url : undefined,
        audio_repeat_count: (p && typeof p === "object" && p.audio_repeat_count != null) ? p.audio_repeat_count : undefined,
        audio_play_until_dismissed: (p && typeof p === "object" && p.audio_play_until_dismissed === true) ? true : undefined,

        duration: durationMs,
        end: durationMs,
        paused: false,
        idle: true,
        finished: false,
        duration_ms: durationMs,
        remaining_ms: durationMs,
        remaining: durationMs,
        percent: 0,
      };
    }).filter(Boolean);
  }


  _compareTimersForDisplay(a, b) {
    if (a.finished && !b.finished) return 1;
    if (!a.finished && b.finished) return -1;

    const sortBy = (this._config?.sort_by || "time_left");
    const sortOrder = (this._config?.sort_order || "asc");
    const dir = sortOrder === "desc" ? -1 : 1;

    const nameA = String(a.name || a.label || "").toLowerCase();
    const nameB = String(b.name || b.label || "").toLowerCase();

    if (sortBy === "name") {
      const c = nameA.localeCompare(nameB);
      if (c !== 0) return c * dir;
    }

    const ar0 = Number(a.remaining_ms ?? a.remaining ?? 0);
    const br0 = Number(b.remaining_ms ?? b.remaining ?? 0);
    const ar = isFinite(ar0) ? ar0 : Number.MAX_SAFE_INTEGER;
    const br = isFinite(br0) ? br0 : Number.MAX_SAFE_INTEGER;
    const diff = ar - br;
    if (diff !== 0) return diff * dir;

    if (sortBy !== "name") {
      const c2 = nameA.localeCompare(nameB);
      if (c2 !== 0) return c2;
    }
    return 0;
  }

  _sortTimersForDisplay(list) {
    return [...(list || [])].sort((a, b) => this._compareTimersForDisplay(a, b));
  }

  _registryInfo(entityId) {
    const ent = entityId ? this.hass?.entities?.[entityId] : null;
    const dev = ent?.device_id ? this.hass?.devices?.[ent.device_id] : null;
    const areaId = ent?.area_id || dev?.area_id || null;
    const area = areaId ? (this.hass?.areas?.[areaId]?.name || null) : null;
    const device = dev ? (dev.name_by_user || dev.name || null) : null;
    return { areaId, area, device };
  }

  _isDeviceSource(t) {
    return t?.source === "timer_list" || t?.source === "voice_satellite";
  }

  _deviceNameFor(t) {
    if (this._isCompanionList(t?.source_entity)) return "";
    const info = this._registryInfo(t.source_entity);
    return info.device || t.device_base_name || this.hass?.states?.[t.source_entity]?.attributes?.friendly_name || t.source_entity || "";
  }

  _sourceDisplayName(source) {
    switch (source) {
      case "timer_list":
      case "voice_satellite":
        return this._localize("group_voice");
      case "alexa": return "Alexa";
      case "google": return "Google Home";
      case "timer": return this._localize("group_timers");
      case "template": return this._localize("group_pinned");
      case "count_up": return this._localize("group_since");
      case "dynamic": return this._localize("group_template");
      case "timestamp":
      case "minutes_attr":
        return this._localize("group_sensors");
      default: return this._localize("this_card");
    }
  }

  _timerGroupKey(t, mode) {
    if (mode === "source") return this._sourceDisplayName(t.source);
    const info = this._registryInfo(this._actionEntity(t) || t.source_entity);
    if (mode === "area") return info.area || this._localize("group_other");
    if (mode === "device") {
      if (this._isDeviceSource(t)) return this._deviceNameFor(t);
      return info.device || this._sourceDisplayName(t.source);
    }
    return null;
  }

  _groupTimersForDisplay(list) {
    const mode = String(this._config?.group_by || "none").toLowerCase();
    if (!["area", "device", "source"].includes(mode)) return list.map((timer) => ({ timer }));
    const groups = new Map();
    for (const timer of list) {
      const key = this._timerGroupKey(timer, mode) || this._localize("group_other");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(timer);
    }
    if (groups.size < 2 && this._config?.group_headers !== "always") return list.map((timer) => ({ timer }));
    const out = [];
    for (const [header, timers] of groups) {
      out.push({ header });
      for (const timer of timers) out.push({ timer });
    }
    return out;
  }

  // Adds the device or area a timer runs on, and the action a device timer
  // performs, to the status line. Runs once per tick on the collected timers.
  _actionEntity(t) {
    const action = t?.timer_action || t?.on_finish;
    const step = Array.isArray(action?.actions) ? action.actions[0] : null;
    const target = this._announceTarget(step) ?? step?.target?.entity_id ?? step?.entity_id;
    return Array.isArray(target) ? target[0] : (target || null);
  }

  _applyTimerContext(list) {
    const mode = String(this._config?.device_label || "auto").toLowerCase();
    const groupBy = String(this._config?.group_by || "none").toLowerCase();
    const show = mode === "device" || mode === "area" ||
      (mode === "auto" && (this._deviceSourceCount || 0) >= 2 && !["device", "area"].includes(groupBy));
    for (const t of list) {
      const action = t.timer_action || t.on_finish;
      if (action) {
        const summary = this._actionSummary(action);
        if (summary && summary.toLowerCase() !== String(t.label || "").toLowerCase()) {
          t.context_label = this._localize("then_action").replace("{action}", summary);
          t.context_is_action = true;
        }
        continue;
      }
      if (!show || mode === "none" || !this._isDeviceSource(t) || this._isCompanionList(t.source_entity)) continue;
      const info = this._registryInfo(t.source_entity);
      t.context_label = mode === "area" ? (info.area || this._deviceNameFor(t)) : this._deviceNameFor(t);
      if (t.short_label) {
        t.label = t.short_label;
        t.name = t.short_label;
      }
    }
  }

  _syncEmptyVisibility() {
    const hide = this._config?.hide_when_empty === true && !this.preview && !this.editMode && (this._renderedTimerCount || 0) === 0;
    if (this.hidden === hide) return;
    this.hidden = hide;
    this.dispatchEvent(new CustomEvent("card-visibility-changed", { detail: { value: !hide }, bubbles: true, composed: true }));
  }

  updated(changedProperties) {
    super.updated?.(changedProperties);
    this._syncEmptyVisibility();
  }


  render() {
    if (!this._config) return html``;
    const presets = this._config.show_timer_presets === false ? [] : (this._config.timer_presets?.length ? this._config.timer_presets : [5, 15, 30]);
    const activeTimers = this._timers.filter(t => {
      if (t.idle && t.source === "voice_pe") return false;
      if (t.idle && t.source === "timer") {
        const entityConfig = this._getEntityConfig(t.source_entity);
        const keepVisible = entityConfig?.keep_timer_visible_when_idle === true;
        if (!keepVisible) return false;
      }
      return true;
    });

    const pinnedTimersRaw = this._getPinnedTimers().filter(pt => !activeTimers.some(t => t.pinned_id && pt.pinned_id && t.pinned_id === pt.pinned_id));

    const pinnedPosition = (this._config.pinned_timers_position || "inline");
    const sortedActiveTimers = this._sortTimersForDisplay(activeTimers);
    const sortedPinnedTimers = this._sortTimersForDisplay(pinnedTimersRaw);

    let timers;
    if (pinnedPosition === "top") {
      timers = [...sortedPinnedTimers, ...sortedActiveTimers];
    } else if (pinnedPosition === "bottom") {
      timers = [...sortedActiveTimers, ...sortedPinnedTimers];
    } else {
      timers = this._sortTimersForDisplay([...sortedPinnedTimers, ...sortedActiveTimers]);
    }
const layout = this._config.layout;
    const style = this._config.style;
    const activeTimersLayout = ["fill_vertical", "bar_vertical", "circle_vertical"].includes((this._config.style || "").toLowerCase()) ? "vertical" : "horizontal";
    const showPresetsInActive = this._config.show_timer_presets !== false && this._config.show_active_header !== false;

    const noTimerCard = layout === "horizontal" ? html`
      <div class="card nt-h ${this._ui.noTimerHorizontalOpen ? "expanded" : ""}">
        <div class="row">
          <div class="card-content" @click=${this._config.show_timer_presets === false ? () => this._toggleCustom("horizontal") : null}>
            <div class="icon-wrap"><ha-icon icon="mdi:timer-off"></ha-icon></div>
            <div>
              <p class="nt-title">${this._localize("no_timers")}</p>
              <p class="nt-sub">${this._localize("click_to_start")}</p>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            ${presets.map((preset) => {
              const label = this._renderPresetLabel(preset);
              return html`<button class="btn btn-preset" @click=${() => this._createPresetTimer(preset)}>${label}</button>`;
            })}
            ${this._config.show_timer_presets === false ? html`
              <button class="btn btn-ghost" @click=${() => this._toggleCustom("horizontal")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            ` : html`
              <button class="btn btn-ghost" @click=${() => this._toggleCustom("horizontal")}>${this._localize("custom")}</button>
            `}
          </div>
        </div>
        ${this._renderCustomTimerPicker("horizontal")}
      </div>
    ` : html`
      <div class="card nt-v ${this._ui.noTimerVerticalOpen ? "expanded" : ""}">
        <div class="col">
          <div class="card-content" style="flex-direction:column;justify-content:center;gap:8px;flex:1;" @click=${this._config.show_timer_presets === false ? () => this._toggleCustom("vertical") : null}>
            <div class="icon-wrap"><ha-icon icon="mdi:timer-off"></ha-icon></div>
            <p class="nt-title">${this._localize("no_active_timers")}</p>
          </div>
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            ${presets.map((preset) => {
              const label = this._renderPresetLabel(preset);
              return html`<button class="btn btn-preset" @click=${() => this._createPresetTimer(preset)}>${label}</button>`;
            })}
            ${this._config.show_timer_presets === false ? html`
              <button class="btn btn-ghost" @click=${() => this._toggleCustom("vertical")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            ` : html`
              <button class="btn btn-ghost" @click=${() => this._toggleCustom("vertical")}>${this._localize("custom")}</button>
            `}
          </div>
        </div>
        ${this._renderCustomTimerPicker("vertical")}
      </div>
    `;
    const renderFn = activeTimersLayout === "vertical"
      ? this._renderItemVertical.bind(this)
      : this._renderItem.bind(this);
    this._renderedTimerCount = timers.length;
    const maxRows = parseInt(this._config.max_rows, 10);
    const truncated = Number.isFinite(maxRows) && maxRows > 0 && timers.length > maxRows;
    const shownTimers = truncated && !this._ui.showAllTimers ? timers.slice(0, maxRows) : timers;
    const listItems = this._groupTimersForDisplay(shownTimers);
    const renderList = () => html`
      ${listItems.map((entry) => entry.header != null
        ? html`<li class="group-head" data-no-action>${entry.header}</li>`
        : renderFn(entry.timer, style))}
    `;
    // max_rows is for cards with little room, so the "+N" chip sits in the
    // header, else the title, and only adds a line below the rows when the
    // card has neither.
    const headerShown = this._config.show_active_header !== false;
    const moreWhere = !truncated ? null : (headerShown ? "header" : (this._config.title ? "title" : "below"));
    const toggleMore = (e) => { e.stopPropagation(); this._ui = { ...this._ui, showAllTimers: !this._ui.showAllTimers }; };
    const moreText = this._ui.showAllTimers ? this._localize("show_less") : this._localize("more_timers").replace("{n}", timers.length - maxRows);
    const moreBadge = html`
      <button type="button" class="more-badge" data-no-action aria-expanded=${String(!!this._ui.showAllTimers)}
        title=${moreText} aria-label=${moreText} @click=${toggleMore}>
        ${this._ui.showAllTimers ? "" : html`<span>+${timers.length - maxRows}</span>`}
        <ha-icon icon=${this._ui.showAllTimers ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
      </button>
    `;
    this._moreInTitle = moreWhere === "title" ? moreBadge : null;
    const moreBelow = moreWhere === "below" ? html`<div class="more-below">${moreBadge}</div>` : "";
    const headTitle = html`<div class="head-title"><h4>${this._localize("active_timers")}</h4>${moreWhere === "header" ? moreBadge : ""}</div>`;
    const useGrid = (activeTimersLayout === "vertical") || (style === "circle_vertical");
    const cols = (useGrid && shownTimers.length > 1) ? 2 : 1;
    const listClass = useGrid ? `list vgrid cols-${cols}` : "list";
    const activeCard = style.startsWith("fill_") ? html`
      <div class="card ${this._ui.activeFillOpen ? "card-show" : ""}">
        ${this._config.show_active_header !== false ? html`
          <div class="active-head">
            ${headTitle}
            ${showPresetsInActive ? html`
              <div class="header-actions">
                ${presets.map((preset) => {
                  const label = this._renderPresetLabel(preset);
                  return html`<button class="btn btn-preset" @click=${() => this._createPresetTimer(preset)}>${label}</button>`;
                })}
                <button class="btn btn-ghost" @click=${() => this._toggleActivePicker("fill")}>${this._localize("custom")}</button>
              </div>
            ` : html`
              <button class="btn btn-add" @click=${() => this._toggleActivePicker("fill")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            `}
          </div>
        ` : ""}
        ${this._renderCustomTimerPicker("fill")}
        <ul class="${listClass}">
          ${renderList()}
        </ul>
        ${moreBelow}
      </div>
    ` : html`
      <div class="card ${this._ui.activeBarOpen ? "card-show" : ""}">
        ${this._config.show_active_header !== false ? html`
          <div class="active-head">
            ${headTitle}
            ${showPresetsInActive ? html`
              <div class="header-actions">
                ${presets.map((preset) => {
                  const label = this._renderPresetLabel(preset);
                  return html`<button class="btn btn-preset" @click=${() => this._createPresetTimer(preset)}>${label}</button>`;
                })}
                <button class="btn btn-ghost" @click=${() => this._toggleActivePicker("bar")}>${this._localize("custom")}</button>
              </div>
            ` : html`
              <button class="btn btn-add" @click=${() => this._toggleActivePicker("bar")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            `}
          </div>
        ` : ""}
        ${this._renderCustomTimerPicker("bar")}
        <ul class="${listClass}">
          ${renderList()}
        </ul>
        ${moreBelow}
      </div>
    `;
    const cardActs = this._cardActionHandlers();
    return html`
      <ha-card dir=${this._isRTL() ? "rtl" : "ltr"} @pointerdown=${cardActs.down} @pointerup=${cardActs.up} @pointercancel=${cardActs.cancel}>
        ${this._config.title ? html`<div class="card-header ${this._moreInTitle ? "with-more" : ""}"><span>${this._config.title}</span>${this._moreInTitle || ""}</div>` : ""}
        ${timers.length === 0 ? html`<div class="grid"><div>${noTimerCard}</div></div>` : html`<div class="grid"><div>${activeCard}</div></div>`}
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host { --stc-chip-radius: 9999px; }
      ha-card { border-radius: var(--ha-card-border-radius, 12px); overflow: hidden; padding: 0; background: var(--ha-card-background, var(--card-background-color)); }
      .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 0; margin: -1px 0; }
      .card { background: transparent; position: relative; padding: 0 8px; box-sizing: border-box; }
      .card-content { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; padding: 0 4px; height: 40px; }
      .progress-fill { position: absolute; inset: 6px 0; height: auto; width: 0; left: 0; z-index: 0; transition: width 1s linear; background: var(--tcolor, var(--primary-color)); opacity: 0.25; border-radius: inherit; }
      .card.finished .progress-fill { width: 100% !important; }
      .nt-h { padding: 0 8px; min-height: 56px; transition: height .3s ease; }
      .nt-h.expanded { height: auto; }
      .nt-h .row { display: flex; align-items: center; justify-content: space-between; min-height: 56px; }
      .nt-v { padding: 0 8px; min-height: 120px; transition: height .3s ease; }
      .nt-v.expanded { height: auto; }
      .nt-v .col { display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 100%; min-height: 120px; }
      .picker, .active-picker { display: none; padding-top: 0; margin-bottom: 0; }
      .card.expanded .picker { display: block; padding: 12px 8px 8px; }
      .card-show .active-picker { display: block; margin-bottom: 8px; padding: 8px 0; }
      .icon-wrap { width: 36px; height: 36px; border-radius: var(--ha-card-border-radius, 50%); background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 18%, var(--ha-card-background, var(--card-background-color))); display: flex; align-items: center; justify-content: center; flex: 0 0 36px; }
      .icon-wrap ha-icon { --mdc-icon-size: 22px; color: var(--tcolor, var(--primary-color)); }
      .nt-title { margin: 0; font-size: 14px; font-weight: 500; line-height: 20px; }
      .nt-sub { margin: 0; font-size: 12px; color: var(--secondary-text-color); line-height: 16px; }
      .btn { font-weight: 600; border-radius: var(--stc-chip-radius); padding: 6px 10px; font-size: 12px; border: none; cursor: pointer; }
      .btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .btn.disabled { opacity: 0.5; pointer-events: none; }
      .btn-preset { background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--primary-text-color); }
      .btn-ghost { background: var(--card-background-color); border: 1px solid var(--divider-color); color: var(--primary-text-color); }
      .btn-primary { background: var(--primary-color); color: var(--text-primary-color, #fff); }
      .btn-add { display: flex; align-items: center; gap: 8px; background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--secondary-text-color); }
      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 220px; margin: 0 auto; }
      .buttons-grid { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: 100%; box-sizing: border-box; }
      .buttons-grid .btn { flex: 0 0 auto; min-width: 68px; }
      .display { text-align: center; font-size: 36px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin: 8px 0; }
      .duration-entry { width: 100%; min-width: 0; }
      .duration-mode { display: flex; width: fit-content; max-width: 100%; padding: 3px; margin: 0 auto 12px; border: 1px solid var(--divider-color); border-radius: var(--stc-chip-radius); gap: 4px; background: var(--secondary-background-color, rgba(0,0,0,.04)); }
      .duration-mode-btn { border: 0; border-radius: inherit; padding: 8px 14px; font: inherit; font-size: 12px; font-weight: 600; color: var(--secondary-text-color); background: transparent; cursor: pointer; }
      .duration-mode-btn[aria-pressed="true"] { color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 14%, transparent); }
      .duration-keypad { max-width: 288px; margin-inline: auto; border-radius: 12px; }
      .duration-display-row { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; margin-block: 4px 12px; }
      .duration-readout { display: inline-flex; justify-content: center; gap: 8px; font-size: 28px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
      .duration-part { display: inline-flex; align-items: baseline; gap: 2px; white-space: nowrap; unicode-bidi: isolate; }
      .duration-readout .duration-unit { font-size: 12px; font-weight: 400; color: var(--secondary-text-color); }
      .duration-clear { border: 0; background: transparent; color: var(--primary-color); padding: 8px; font: inherit; font-size: 12px; cursor: pointer; }
      .duration-key-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .duration-key { min-height: 44px; padding: 8px; border: 0; border-radius: 12px; background: var(--secondary-background-color, rgba(0,0,0,.06)); color: var(--primary-text-color); font: inherit; font-size: 20px; font-variant-numeric: tabular-nums; cursor: pointer; touch-action: manipulation; }
      .duration-key ha-icon { --mdc-icon-size: 22px; }
      .duration-key:hover:not(:disabled) { background: color-mix(in srgb, var(--primary-color) 14%, var(--secondary-background-color, transparent)); }
      .duration-key:active:not(:disabled) { background: color-mix(in srgb, var(--primary-color) 24%, transparent); }
      .duration-key:disabled, .duration-clear:disabled { opacity: 0.4; cursor: not-allowed; }
      .duration-entry :focus-visible, .picker-actions .btn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .picker-actions { display: flex; gap: 12px; width: 100%; margin: 16px auto 0; box-sizing: border-box; }
      .picker-actions .btn { flex: 1; }
      .text-input { width: 90%; text-align: center; padding: 8px 12px; font-size: 14px; border-radius: var(--stc-chip-radius); color: var(--primary-text-color); background: var(--card-background-color); border: 1px solid var(--divider-color); outline: none; margin: 0 auto; display: block; }
      .text-input::placeholder { color: var(--secondary-text-color); }
      .name-selector { display: flex; flex-direction: column; gap: 8px; width: 100%; padding-top: 12px; position: relative; transition: all 0.3s ease; }
      .name-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; animation: fadeIn 0.3s ease; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      .active-head { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; margin-bottom: 6px; flex-wrap: wrap; gap: 8px; }
      .active-head h4 { margin: 0; font-size: 16px; font-weight: 600; color: var(--primary-text-color); }
      .header-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      :host([hidden]) { display: none; }
      .group-head { grid-column: 1 / -1; font-size: 0.8em; font-weight: 600; color: var(--secondary-text-color); padding: 4px 4px 0; }
      .group-head:first-child { padding-top: 0; }
      .head-title { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
      .card-header.with-more { display: flex; align-items: center; gap: 8px; }
      .more-badge { display: inline-flex; align-items: center; justify-content: center; gap: 0; height: 22px; min-width: 28px; padding: 0 8px; border: 0; border-radius: 11px; background: color-mix(in srgb, var(--primary-color) 14%, var(--card-background-color, #fff)); color: var(--primary-color); font: inherit; font-size: 12px; font-weight: 600; line-height: 1; cursor: pointer; flex-shrink: 0; }
      .more-badge ha-icon { --mdc-icon-size: 16px; }
      .more-badge span + ha-icon { margin-inline-start: 1px; margin-inline-end: -4px; }
      .more-below { display: flex; justify-content: center; padding: 2px 0 4px; }
      .more-badge:hover { background: color-mix(in srgb, var(--primary-color) 22%, var(--card-background-color, #fff)); }
      .picker-section { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 12px; }
      .picker-section-label { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
      .segmented { flex-wrap: wrap; justify-content: center; margin: 0 auto; }
      .segmented .duration-mode-btn { padding: 6px 12px; }
      .option-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
      .action-entry { display: flex; justify-content: center; margin-top: 10px; }
      .action-link { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 0; background: none; color: var(--primary-color); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; border-radius: var(--stc-chip-radius); }
      .action-link:hover { background: color-mix(in srgb, var(--primary-color) 10%, transparent); }
      .action-link ha-icon { --mdc-icon-size: 18px; }
      .action-entry + .action-entry { margin-top: 2px; }
      .action-pill { display: inline-flex; align-items: center; max-width: 100%; border-radius: var(--stc-chip-radius); background: color-mix(in srgb, var(--primary-color) 14%, var(--card-background-color)); color: var(--primary-color); }
      .action-pill button { border: 0; background: none; color: inherit; font: inherit; cursor: pointer; display: inline-flex; align-items: center; }
      .action-pill-main { gap: 8px; min-width: 0; padding: 7px 4px 7px 12px; font-size: 13px; font-weight: 600; }
      .action-pill-main span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .action-pill-clear { padding: 7px 10px 7px 6px; }
      .action-pill ha-icon { --mdc-icon-size: 18px; flex: 0 0 auto; }
      .wizard { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; min-width: 0; }
      .grid > div, .card, .picker, .active-picker { min-width: 0; }
      .wizard-head { display: flex; align-items: center; gap: 8px; }
      .wizard-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: 15px; font-weight: 600; color: var(--primary-text-color); }
      .wizard-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; border-radius: 50%; background: none; color: var(--secondary-text-color); cursor: pointer; }
      .wizard-icon-btn:hover { background: var(--secondary-background-color, rgba(0,0,0,.06)); }
      .wizard-icon-spacer { width: 36px; }
      .wizard-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; min-width: 0; }
      .wizard-row { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; box-sizing: border-box; padding: 10px 12px; border: 0; border-radius: 12px; background: var(--secondary-background-color, rgba(0,0,0,.05)); color: var(--primary-text-color); font: inherit; text-align: start; cursor: pointer; }
      .wizard-row.compact { padding: 8px 12px; }
      .wizard-row:hover { background: color-mix(in srgb, var(--primary-color) 12%, var(--secondary-background-color, transparent)); }
      .wizard-row .row-icon { --mdc-icon-size: 22px; color: var(--primary-color); flex: 0 0 auto; }
      .wizard-row.selected { box-shadow: inset 0 0 0 1.5px var(--primary-color); }
      .wizard-row .row-check { --mdc-icon-size: 20px; color: var(--primary-color); flex: 0 0 auto; }
      .row-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
      .row-title { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row-sub { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row-id { font-family: var(--code-font-family, ui-monospace, monospace); font-size: 11px; color: var(--secondary-text-color); opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .wizard-section { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); margin: 6px 4px 0; }
      .wizard-hint { font-size: 12px; color: var(--secondary-text-color); text-align: center; padding: 8px; }
      .wizard-input { width: 100%; box-sizing: border-box; }
      .btn-preset.selected, .btn-preset[aria-pressed="true"] { background: color-mix(in srgb, var(--primary-color) 16%, var(--card-background-color)); color: var(--primary-color); box-shadow: inset 0 0 0 1px var(--primary-color); }
      .action-device { display: flex; flex-direction: column; gap: 8px; width: 90%; }
      .action-device .text-input { width: 100%; box-sizing: border-box; }
      .selected-entity { display: inline-flex; align-items: center; gap: 6px; }
      .item { box-sizing: border-box; position: relative; border-radius: var(--ha-card-border-radius, 12px); overflow: hidden; padding: 8px 0; min-height: 56px; background: var(--stc-item-background, transparent); }
      .item .info { display: flex; flex-direction: column; justify-content: center; height: 36px; flex: 1; overflow: hidden; }
      .item .title { font-size: 14px; font-weight: 500; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
      .item .status { font-size: 12px; color: var(--secondary-text-color); line-height: 16px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
      .item .status.editable { cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
      .item .status.up { color: color-mix(in srgb, var(--tcolor, var(--primary-color)) 70%, white); }
      .item .actions { display: flex; gap: 4px; align-items: center; height: 36px; }
      .item .action-btn { color: var(--secondary-text-color); background: none; border: 0; padding: 4px; cursor: pointer; border-radius: 50%; transition: all 0.2s; }
      .bar .row { display: flex; align-items: center; gap: 12px; height: 40px; }
      .bar .top { display: flex; align-items: center; justify-content: space-between; height: 18px; }
      .track { width: 100%; height: 8px; border-radius: var(--stc-chip-radius); background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 10%, transparent); margin-top: 2px; overflow: hidden; }
      .fill { height: 100%; width: 0%; border-radius: var(--stc-chip-radius); background: var(--tcolor, var(--primary-color)); transition: width 1s linear; }
      .chip { font-weight: 600; color: color-mix(in srgb, var(--tcolor, var(--primary-color)) 70%, white); border-radius: var(--stc-chip-radius); padding: 4px 8px; font-size: 12px; background: none; border: 1px solid color-mix(in srgb, var(--tcolor, var(--primary-color)) 20%, transparent); cursor: pointer; }
      .chip:hover { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 18%, var(--ha-card-background, var(--card-background-color))); }
      .vgrid { display: grid; gap: 8px; padding: 0px; }
      .vgrid.cols-1 { grid-template-columns: 1fr; }
      .vgrid.cols-2 { grid-template-columns: 1fr 1fr; }
      .vtile { position: relative; min-height: 120px; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
      .vtile .vcol { z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
      .vtile-close { position: absolute; top: 4px; inset-inline-end: 4px; border: 0; background: none; padding: 4px; border-radius: 50%; color: var(--secondary-text-color); cursor: pointer; z-index: 3; }
      .vtile-close:hover { background: color-mix(in srgb, var(--primary-color) 10%, transparent); }
      .vtile-actions { position: absolute; top: 4px; inset-inline-start: 4px; display: flex; flex-direction: column; gap: 2px; z-index: 3; }
      .vtile-action { border: 0; background: none; padding: 4px; border-radius: 50%; color: var(--secondary-text-color); cursor: pointer; transition: all 0.2s; }
      .vtile-action:hover { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 12%, transparent); }
      .item .action-btn:hover, .vactions .action-btn:hover, .vprogressbar .action-btn:hover { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 12%, transparent); }
      .icon-wrap.large { width: 36px; height: 36px; flex: 0 0 36px; border-radius: var(--ha-card-border-radius, 50%); background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 18%, var(--ha-card-background, var(--card-background-color))); display: flex; align-items: center; justify-content: center; }
      .vtitle { font-size: 14px; font-weight: 600; line-height: 16px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; }
      .vstatus { font-size: 12px; color: var(--secondary-text-color); line-height: 14px; font-variant-numeric: tabular-nums; margin: 0; margin-bottom: 2px; }
      .vstatus.editable { cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
      .vstatus.up { color: color-mix(in srgb, var(--tcolor, var(--primary-color)) 70%, white); }
      .vtrack.small { flex: 0 0 60%; height: 6px; border-radius: var(--stc-chip-radius); background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 10%, transparent); overflow: hidden; }
      .vfill { height: 100%; background: var(--tcolor, var(--primary-color)); transition: width 1s linear, height 1s linear; border-radius: var(--stc-chip-radius); }
      .vprogressbar { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0px; margin-top: -4px; margin-bottom: -4px; }
      .vprogressbar .milestone-track { flex: 0 0 60%; }
      .vactions { display: flex; gap: 6px; align-items: center; justify-content: center; margin-top: -4px; margin-bottom: -4px; }
      .vcircle-wrap { position: relative; width: 64px; height: 64px; display: grid; place-items: center; }
      .hcircle-wrap { position: relative; width: 40px; height: 40px; flex: 0 0 40px; display: grid; place-items: center; }
      .hcircle { position: absolute; inset: 0; transform: rotate(-90deg); }
      .vcircle { position: absolute; inset: 0; transform: rotate(-90deg); z-index: 0; }
      .vc-track, .vc-prog { fill: none; stroke-width: 4.5px; vector-effect: non-scaling-stroke; }
      .vc-track { stroke: var(--tcolor, var(--primary-color)); stroke-opacity: 0.22; }
      .vc-prog { stroke: var(--tcolor, var(--primary-color)); transition: stroke-dashoffset 1s linear; }
      .vc-prog.done { stroke-dashoffset: 0 !important; }
      .vc-prog-drain { stroke: var(--tcolor, var(--primary-color)); transition: stroke-dashoffset 1s linear; }
      .icon-wrap.xl { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 50%; background: color-mix(in srgb, var(--tcolor, var(--divider-color)) 22%, transparent); display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
      .icon-wrap.xl ha-icon { --mdc-icon-size: 28px; color: var(--tcolor, var(--primary-color)); }
      .milestone-track { display: flex; gap: 1px; width: 100%; height: 8px; margin-top: 2px; }
      .vprogressbar .milestone-track { flex: 0 0 60%; }
      .milestone-track.idle .segment { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 15%, transparent); }
      .segment { flex: 1 1 0; height: 100%; background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 15%, transparent); border-radius: 1px; }
      .segment.completed { background: var(--tcolor, var(--primary-color)); }
      .segment.active { animation: pulseMilestone 1s ease-in-out infinite; }
      .segment.inactive { opacity: 0.35; }
      .segment.drain.completed { opacity: 0.9; }
      .segment.drain.inactive { opacity: 0.2; }
      .segment.idle { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 15%, transparent); }
      @keyframes pulseMilestone { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
      @keyframes stcRingPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
      @keyframes stcRingSwing { 0%, 100% { transform: rotate(0deg); } 20% { transform: rotate(16deg); } 40% { transform: rotate(-12deg); } 60% { transform: rotate(8deg); } 80% { transform: rotate(-4deg); } }
      @keyframes stcRingShake { 0%, 32%, 100% { transform: translateX(0); } 4%, 12%, 20% { transform: translateX(-3px); } 8%, 16%, 24% { transform: translateX(3px); } }
      @keyframes stcRingHop { 0%, 40%, 100% { transform: translateY(0); } 12% { transform: translateY(-6px); } 24% { transform: translateY(0); } 32% { transform: translateY(-3px); } }
      @keyframes stcRingGlow {
        0%, 100% { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 18%, var(--ha-card-background, var(--card-background-color))); }
        50% { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 40%, var(--ha-card-background, var(--card-background-color))); }
      }
      .ring-pulse .icon-wrap { animation: stcRingGlow 1s ease-in-out infinite; }
      .ring-pulse .icon-wrap ha-icon { animation: stcRingPulse 1s ease-in-out infinite; }
      .ring-swing .icon-wrap ha-icon { animation: stcRingSwing 1.2s ease-in-out infinite; transform-origin: 50% 10%; }
      .ring-shake { animation: stcRingShake 2s ease-in-out infinite; }
      .ring-hop { animation: stcRingHop 1.8s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .ring-pulse .icon-wrap, .ring-pulse .icon-wrap ha-icon, .ring-swing .icon-wrap ha-icon, .ring-shake, .ring-hop { animation: none; }
      }
      .editor-row { flex-direction: column; align-items: center; padding: 12px; height: auto !important; min-height: 100px; }
      .editor-container { width: 100%; display: flex; flex-direction: column; align-items: center; }
      .editor-header { font-weight: 700; font-size: 1.1em; margin-bottom: 12px; }
      .time-picker-row { display: flex; justify-content: center; align-items: center; margin-bottom: 16px; }
      .time-slot { display: flex; flex-direction: column; align-items: center; margin: 0 6px; }
      .time-slot ha-icon { cursor: pointer; color: var(--primary-color); --mdc-icon-size: 32px; }
      .time-val { font-size: 2em; font-weight: bold; margin: 4px 0; min-width: 45px; text-align: center; }
      .colon { font-size: 2em; font-weight: bold; margin-top: -15px; }
      .time-label { font-size: 0.75em; color: var(--secondary-text-color); }
    `;
  }

  _toast(msg) {
    const ev = new CustomEvent("hass-notification", { detail: { message: msg }, bubbles: true, composed: true });
    this.dispatchEvent(ev);
  }
}

class SimpleTimerCardEditor extends LitElement {
  static get properties() { return { hass: {}, _config: {}, _expandedSections: { state: true }, _showAdvanced: { state: true }, _searchQuery: { state: true } }; }

  constructor() {
    super();
    this._debounceTimeout = null;
    this._emitTimeout = null;
    this._expandedSections = {
      entities: true,
      appearance: false,
      input: false,
    };
    this._showAdvanced = this._readEditorMode();
    this._searchQuery = "";
  }

  _readEditorMode() {
    try {
      return localStorage.getItem(EDITOR_MODE_STORAGE_KEY) === "advanced";
    } catch {
      return false;
    }
  }

  _setEditorMode(advanced) {
    this._showAdvanced = advanced === true;
    try {
      localStorage.setItem(EDITOR_MODE_STORAGE_KEY, this._showAdvanced ? "advanced" : "simple");
    } catch {}
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._debounceTimeout) { clearTimeout(this._debounceTimeout); this._debounceTimeout = null; }
    if (this._emitTimeout) { clearTimeout(this._emitTimeout); this._emitTimeout = null; }
  }

  updated(changedProperties) {
    super.updated?.(changedProperties);
    // Re-apply the search filter whenever the query changes or the
    // editor re-renders (config edits can add / remove fields).
    this._applySearchFilter();
  }

  _applySearchFilter() {
    const root = this.shadowRoot;
    if (!root) return;
    const q = (this._searchQuery || "").trim().toLowerCase();
    const advancedVisible = this._showAdvanced || !!q;
    let visiblePanels = 0;
    const panels = root.querySelectorAll("ha-expansion-panel");
    panels.forEach((panel) => {
      const body = panel.querySelector(".panel-body");
      if (!body) return;
      const sectionMatches = !q || this._extractSearchableText(panel.querySelector(".panel-header-label")).includes(q);
      const filter = (container, parentMatches = sectionMatches) => {
        let matches = 0;
        for (const el of container.children) {
          const allowed = advancedVisible || !el.classList.contains("advanced");
          const grouped = el.matches(".settings-group, .entity-editor, .entity-options");
          const groupMatches = parentMatches || (!!q && (el.getAttribute("data-search-terms") || "").toLowerCase().includes(q));
          const match = grouped ? filter(el, groupMatches) > 0 : groupMatches || this._extractSearchableText(el).includes(q);
          const visible = allowed && match;
          el.toggleAttribute("data-search-hidden", !!q && !visible);
          if (visible) matches++;
        }
        if (q && matches && container.classList.contains("entity-editor")) {
          const identity = [...container.children].find(el => el.configValue === "entity");
          identity?.removeAttribute("data-search-hidden");
        }
        return matches;
      };
      const matches = filter(body);
      const visible = (advancedVisible || !panel.classList.contains("advanced")) && matches > 0;
      panel.toggleAttribute("data-search-hidden", !!q && !visible);
      if (visible) visiblePanels++;
    });
    const empty = root.querySelector(".search-empty");
    if (empty) empty.hidden = !q || visiblePanels > 0;
  }

  _extractSearchableText(el) {
    if (!el || el.nodeType !== 1) return "";
    const parts = [];
    for (const node of [el, ...el.querySelectorAll("*")]) {
      for (const name of ["label", "helper", "help-text", "title", "data-search-terms"]) {
        const value = node.getAttribute(name);
        if (value) parts.push(value);
      }
      if (typeof node.label === "string") parts.push(node.label);
      if (typeof node.configValue === "string") parts.push(node.configValue);
    }
    if (el.textContent) parts.push(el.textContent);
    return parts.join(" ").toLowerCase();
  }

  setConfig(config) {
    const c = { ...(config || {}) };
    if (typeof c.entities === "string") c.entities = [c.entities];
    if (typeof c.timer_name_presets === "string") c.timer_name_presets = c.timer_name_presets.split(",").map(s => s.trim()).filter(Boolean);
    if (typeof c.timer_presets === "string") c.timer_presets = c.timer_presets.split(",").map(s => s.trim()).filter(Boolean);
    if (typeof c.minute_buttons === "string") c.minute_buttons = c.minute_buttons.split(",").map(s => s.trim()).filter(Boolean);
    if (typeof c.time_format_units === "string") c.time_format_units = c.time_format_units.split(",").map(s => s.trim()).filter(Boolean);
    this._config = { ...c };
    if (!this._expandedSections) {
      this._expandedSections = {
        entities: true, appearance: false, input: false,
      };
    }
    this.requestUpdate();
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue ?? target.dataset?.configValue ?? target.getAttribute?.("configValue");
    if (!key) return;
    const hasChecked = target.checked !== undefined;
    let value = hasChecked ? target.checked : target.value;
    if (key === "timer_presets" && typeof value === "string") {
      value = value.split(",").map(v => v.trim()).filter(v => v).map(v => {
        const m = v.toLowerCase().match(/^(\d+)\s*([smhd])?$/);
        if (!m) return null;
        const n = parseInt(m[1], 10);
        if (!Number.isFinite(n) || n <= 0) return null;
        return m[2] ? `${n}${m[2]}` : n;
      }).filter(v => v !== null);
      if (value.length === 0) value = [5, 15, 30];
    }

    if (key === "minute_buttons" && typeof value === "string") {
      value = value.split(",").map(v => v.trim()).filter(v => v).map(v => {
        const m = v.toLowerCase().match(/^(\d+)\s*([smhd])?$/);
        if (!m) return null;
        const n = parseInt(m[1], 10);
        if (!Number.isFinite(n) || n <= 0) return null;
        return m[2] ? `${n}${m[2]}` : n;
      }).filter(v => v !== null);
      if (value.length === 0) value = [1, 5, 10];
    }
    if (key === "timer_name_presets" && typeof value === "string") {
      value = value.split(",").map(name => name.trim()).filter(name => name);
    }
    if (key === "time_format_units" && typeof value === "string") {
      value = value.split(",").map(u => u.trim().toLowerCase()).filter(u => ["years","months","weeks","days","hours","minutes","seconds"].includes(u));
      if (value.length === 0) value = ["days","hours","minutes","seconds"];
    }
    if (key === "auto_voice_pe" && value !== true) {
      const next = { ...this._config };
      delete next.auto_voice_pe;
      delete next.voice_pe_control_entity;
      this._config = next;
      this._emitChange();
      return;
    }
    if (hasChecked) this._updateConfig({ [key]: value }, true);
    else this._updateConfig({ [key]: value });
  }

  _mqttAutomationChanged(ev) {
    this._mqttFieldChanged("publish_automation", ev);
  }

  _mqttFieldChanged(field, ev) {
    const mqtt = { ...(this._config.mqtt || {}) };
    const value = ev.detail?.value;
    if (value) mqtt[field] = value;
    else delete mqtt[field];
    this._updateConfig({ mqtt }, true);
  }

  // Leaving MQTT keeps the old sensor under mqtt.sensor_entity, so a legacy
  // sensor target does not keep overriding the new storage.
  _storageChanged(ev) {
    if (!this._config) return;
    ev.stopPropagation();
    const target = ev.target;
    let value = ev?.detail?.value;
    if ((value === undefined || value === null) && ev?.detail && typeof ev.detail.index === "number" && Array.isArray(target?.options)) {
      value = target.options[ev.detail.index]?.value;
    }
    if (value === undefined || value === null) value = target.value;
    if (!["local", "mqtt", "integration"].includes(value) || value === this._config.storage) return;
    const patch = { storage: value };
    const def = this._config.default_timer_entity;
    const defIsMqttSensor = typeof def === "string" && def.startsWith("sensor.") &&
      !SimpleTimerCard.prototype._isCompanionList.call(this, def) && !def.startsWith("sensor.simple_timer_card_timers");
    if (value !== "mqtt" && defIsMqttSensor) {
      patch.default_timer_entity = "";
      patch.mqtt = { ...(this._config.mqtt || {}), sensor_entity: def };
    }
    this._updateConfig(patch, true);
  }

  _detailValueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue ?? target.dataset?.configValue ?? target.getAttribute?.("configValue");
    if (!key) return;
    this._updateConfig({ [key]: ev.detail.value });
  }

  _notifyValueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue ?? target.dataset?.configValue ?? target.getAttribute?.("configValue");
    if (!key) return;
    const isSelect = target.tagName && target.tagName.toLowerCase() === "ha-select";
    let value;
    if (isSelect) {
      if (ev.stopPropagation) ev.stopPropagation();
      value = ev?.detail?.value;
      if ((value === undefined || value === null) && ev?.detail && typeof ev.detail.index === "number" && Array.isArray(target?.options)) {
        value = target.options[ev.detail.index]?.value;
      }
      if (value === undefined || value === null) value = target.value;
      if (typeof value !== "string") return;
    } else {
      value = target.checked !== undefined ? target.checked : target.value;
    }
    const notify = { ...(this._config.notify || {}) };
    if (value === "" || value == null) delete notify[key];
    else notify[key] = value;
    if (!notify.service) {
      const next = { ...this._config };
      delete next.notify;
      this._config = next;
      this._emitChange();
      this.requestUpdate();
      return;
    }
    this._updateConfig({ notify });
    this.requestUpdate();
  }

  _notifyCriticalChanged(ev) {
    if (!this._config || !this.hass) return;
    const isOn = !!ev.target.checked;
    const notify = { ...(this._config.notify || {}) };
    if (!notify.service) return;
    const data = { ...(notify.data || {}) };
    const push = { ...(data.push || {}) };
    if (isOn) {
      push.sound = { name: "default", critical: 1, volume: 1.0 };
    } else if (push.sound && typeof push.sound === "object" && push.sound.critical === 1) {
      delete push.sound;
    }
    if (Object.keys(push).length === 0) delete data.push;
    else data.push = push;
    if (Object.keys(data).length === 0) delete notify.data;
    else notify.data = data;
    this._updateConfig({ notify });
    this.requestUpdate();
  }

  _selectChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue ?? target.dataset?.configValue ?? target.getAttribute?.("configValue");
    if (!key) return;
    ev.stopPropagation();
    // HA 2026.x ha-select uses ha-dropdown internally and fires `selected` with
    // ev.detail.value. Older mwc-select fires `selected` with ev.detail.index and
    // only sets target.value after the fact. Resolve in this order: detail.value,
    // detail.index (mapped via target.options), then target.value.
    let value = ev?.detail?.value;
    if ((value === undefined || value === null) && ev?.detail && typeof ev.detail.index === "number" && Array.isArray(target?.options)) {
      value = target.options[ev.detail.index]?.value;
    }
    if (value === undefined || value === null) value = target.value;
    if (typeof value !== "string" || value === "") return;
    if (value === this._config[key]) return;
    if (key === "style") {
      this._updateConfig({ style: _normalizeCardStyle(value) }, true);
    } else if (key === "custom_timer_input") {
      this._updateConfig({ custom_timer_input: normalizeTimerInput(value) }, true);
    } else if (key === "progress_mode") {
      const modes = ["drain", "fill", "milestones"];
      this._updateConfig({ progress_mode: modes.includes(value) ? value : "drain" }, true);
    } else if (key === "time_format") {
      const formats = ["hms","hm","ss","dhms","human_compact","human_short","human_natural","standard"];
      const mapped = value === "standard" ? "hms" : value;
      this._updateConfig({ time_format: formats.includes(mapped) ? mapped : "hms" }, true);
    } else if (key === "milestone_unit") {
      const opts = ["auto","none","years","months","weeks","days","hours","minutes","seconds"];
      this._updateConfig({ milestone_unit: opts.includes(value) ? value : "auto" }, true);
    } else {
      this._updateConfig({ [key]: value }, true);
    }
  }

  _entityValueChanged(e, index) {
    if (!this._config || !this.hass) return;
    if (e.stopPropagation) e.stopPropagation();
    if (index < 0 || index >= (this._config.entities || []).length) return;
    const target = e.target;
    const key = target.configValue ?? target.dataset?.configValue ?? target.getAttribute?.("configValue");
    if (!key) return;
    let value;
    if (target.checked !== undefined) value = target.checked;
    else {
      // HA 2026.2+ ha-select fires `selected` event with ev.detail.value; older mwc-select
      // only sets target.value. Try detail first, then fall back to target.value.
      if (e && e.detail && e.detail.value !== undefined && e.detail.value !== null) value = e.detail.value;
      if (value === undefined && typeof target.selected?.value === "string" && target.selected.value !== "") value = target.selected.value;
      if (value === undefined && target.value !== undefined) value = target.value;
      if (value === undefined) return;
    }
    const newConfig = { ...this._config };
    const entities = [...(newConfig.entities || [])];
    let entityConf;
    if (typeof entities[index] === "string") entityConf = { entity: entities[index] };
    else if (entities[index] && typeof entities[index] === "object") entityConf = { ...entities[index] };
    else entityConf = { entity: "" };
    if (value === "" || value === undefined || value === null) delete entityConf[key];
    else entityConf[key] = value;
    if (Object.keys(entityConf).length === 1 && entityConf.entity) entities[index] = entityConf.entity;
    else if (Object.keys(entityConf).length > 0) entities[index] = entityConf;
    else entities[index] = "";
    newConfig.entities = entities;
    this._updateConfig(newConfig, true);
  }

_addPinnedTimer() {
  const pinned = Array.isArray(this._config.pinned_timers) ? [...this._config.pinned_timers] : [];
  pinned.push({ name: "", duration: "5m" });
  this._config = { ...this._config, pinned_timers: pinned };
  this.requestUpdate();
  this._emitChange();
}

_removePinnedTimer(index) {
  const pinned = Array.isArray(this._config.pinned_timers) ? [...this._config.pinned_timers] : [];
  pinned.splice(index, 1);
  this._config = { ...this._config, pinned_timers: pinned };
  this.requestUpdate();
  this._emitChange();
}

_pinnedTimerValueChanged(ev, index) {
  if (!this._config || !this.hass) return;
  const target = ev.target;
  const key = target.configValue ?? target.dataset?.configValue ?? target.getAttribute?.("configValue");
  if (!key) return;

  let value = target.checked !== undefined ? target.checked : (target.value !== undefined ? target.value : ev?.detail?.value);
  if (key === "audio_repeat_count") {
    const n = parseInt(value, 10);
    value = Number.isFinite(n) && n > 0 ? n : 1;
  }

  const pinned = Array.isArray(this._config.pinned_timers) ? [...this._config.pinned_timers] : [];
  const cur = (pinned[index] && typeof pinned[index] === "object") ? { ...pinned[index] } : {};
  cur[key] = value;

  pinned[index] = cur;
  this._config = { ...this._config, pinned_timers: pinned };
  this._emitChange();
}

  // === Custom action buttons editor (v2.7.0) ===

  // Which preset actions actually work for a given entity mode. Returns a Set of
  // supported preset values, or null when the mode is unknown / not entity-scoped
  // (card-level list applies to every row, so we can't narrow it). Custom actions
  // are always allowed since they call arbitrary HA services.
  _supportedButtonPresets(mode) {
    if (!mode || mode === "auto") return null;
    switch (mode) {
      case "timer":
      case "helper":
      case "local":
      case "mqtt":
        return new Set(["finish", "add", "reduce", "restart", "pause"]);
      case "timer_list":
        // Each preset maps to a timer_list action. Lists that lack the
        // matching supported feature show a notice at run time.
        return new Set(["finish", "add", "reduce", "restart", "pause"]);
      case "voice_pe":
        // Voice PE can finish/pause/resume but has no notion of changing duration.
        return new Set(["finish", "pause"]);
      case "alexa":
      case "timestamp":
      case "minutes_attr":
      default:
        // Read-only or externally-owned timers: presets would under-deliver, so
        // only custom on-screen actions are offered.
        return new Set();
    }
  }

  _renderButtonsEditor(buttons, onChange, mode) {
    const list = Array.isArray(buttons) ? buttons : [];
    const allPresets = [
      { value: "finish", label: "Finish" },
      { value: "add", label: "Add time" },
      { value: "reduce", label: "Reduce time" },
      { value: "restart", label: "Restart" },
      { value: "pause", label: "Pause / resume" },
    ];
    const supported = this._supportedButtonPresets(mode);
    const presetOptions = [
      ...allPresets.filter((o) => supported === null || supported.has(o.value)),
      { value: "__custom", label: "Custom action…" },
    ];
    const presetsHidden = supported !== null && presetOptions.length < allPresets.length + 1;
    return html`
      <div class="buttons-editor">
        ${presetsHidden && presetOptions.length === 1 ? html`
          <div class="helper-text">This entity type only supports custom on-screen actions.</div>
        ` : ""}
        ${list.map((b, i) => {
          const isPreset = typeof b?.action === "string";
          const actionType = isPreset ? b.action : "__custom";
          // Keep an existing (possibly now-unsupported) action visible so the user
          // can see and change it instead of it silently vanishing.
          const rowOptions = (actionType === "__custom" || presetOptions.some((o) => o.value === actionType))
            ? presetOptions
            : [...presetOptions, { value: actionType, label: `${actionType} (unsupported here)` }];
          return html`
            <div class="button-row">
              <div class="row" style="align-items:flex-start;">
                <ha-select label="Action" naturalMenuWidth fixedMenuPosition
                  .value=${actionType} .options=${rowOptions}
                  @selected=${(e) => { e.stopPropagation(); this._buttonActionTypeChanged(e, list, i, onChange); }}
                  @closed=${(e) => e.stopPropagation()}>
                  ${rowOptions.map((o) => html`<mwc-list-item value=${o.value}>${o.label}</mwc-list-item>`)}
                </ha-select>
                <ha-icon-picker label="Icon (optional)" .value=${b?.icon || ""}
                  @value-changed=${(e) => this._buttonFieldChanged(e, list, i, "icon", onChange)}></ha-icon-picker>
                <button class="remove-entity" @click=${() => this._removeButton(list, i, onChange)} title="Remove button">
                  <ha-icon icon="mdi:delete"></ha-icon>
                </button>
              </div>
              ${(actionType === "add" || actionType === "reduce") ? this._renderButtonAmountField(b, list, i, onChange) : ""}
              ${actionType === "__custom" ? html`
                <ha-selector .hass=${this.hass} .label=${"Custom action"}
                  .selector=${{ ui_action: { default_action: "more-info" } }}
                  .value=${isPreset ? undefined : b?.action}
                  @value-changed=${(e) => this._buttonActionChanged(e, list, i, onChange)}></ha-selector>
              ` : ""}
            </div>
          `;
        })}
        <button class="add-button" @click=${() => this._addButton(list, onChange, presetOptions)}>
          <ha-icon icon="mdi:plus"></ha-icon>
          <span>Add button</span>
        </button>
      </div>
    `;
  }

  // Amount input for add/reduce. Uses the same dynamic ha-input (HA 2026.4+) /
  // ha-textfield (older HA) tag selection as the rest of the editor.
  _renderButtonAmountField(b, list, i, onChange) {
    const tag = this._tfTag;
    return shtml`<${tag}
        class="button-amount"
        label="Amount"
        placeholder="5m"
        required
        helper="Required. e.g. 5m, 30s, 1h"
        .value=${b?.amount ?? ""}
        @input=${(e) => this._buttonFieldChanged(e, list, i, "amount", onChange)}
        @change=${(e) => this._buttonFieldChanged(e, list, i, "amount", onChange)}
      ></${tag}>`;
  }

  _resolveSelectValue(e) {
    const target = e?.target;
    let v = e?.detail?.value;
    if ((v === undefined || v === null) && e?.detail && typeof e.detail.index === "number" && Array.isArray(target?.options)) {
      v = target.options[e.detail.index]?.value;
    }
    if (v === undefined || v === null) v = target?.value;
    return v;
  }

  _addButton(list, onChange, presetOptions) {
    // Default to the first supported preset for this entity, falling back to a
    // custom action when no preset applies (e.g. read-only / Alexa timers).
    const firstPreset = Array.isArray(presetOptions)
      ? presetOptions.find((o) => o.value !== "__custom")
      : null;
    const def = firstPreset ? { action: firstPreset.value } : { action: { action: "more-info" } };
    onChange([...(Array.isArray(list) ? list : []), def]);
  }

  _removeButton(list, i, onChange) {
    const next = [...list];
    next.splice(i, 1);
    onChange(next.length ? next : undefined);
  }

  _buttonFieldChanged(e, list, i, key, onChange) {
    const v = e?.detail?.value ?? e?.target?.value;
    const next = list.map((b, idx) => (idx === i ? { ...b } : b));
    if (v === "" || v == null) delete next[i][key];
    else next[i][key] = v;
    onChange(next);
  }

  _buttonActionTypeChanged(e, list, i, onChange) {
    const v = this._resolveSelectValue(e);
    if (typeof v !== "string" || v === "") return;
    const next = list.map((b, idx) => (idx === i ? { ...b } : b));
    if (v === "__custom") {
      if (typeof next[i].action === "string" || !next[i].action) next[i].action = { action: "more-info" };
    } else {
      next[i].action = v;
    }
    if (v !== "add" && v !== "reduce" && next[i].amount !== undefined) delete next[i].amount;
    onChange(next);
  }

  _buttonActionChanged(e, list, i, onChange) {
    const v = e?.detail?.value;
    const next = list.map((b, idx) => (idx === i ? { ...b, action: v } : b));
    onChange(next);
  }

  _renderDeviceTimersEditor() {
    const list = Array.isArray(this._config.device_timers) ? this._config.device_timers : [];
    const card = SimpleTimerCard.prototype;
    const hasCompanion = Object.keys(this.hass?.states || {}).some((id) => card._isCompanionList.call(this, id));
    return html`
      <div class="device-timers" data-search-terms="device_timers action_timers when done command companion">
        <p class="hint">With the Simple Timer Card integration, the custom timer panel offers <strong>Do something when it ends</strong>: control any device, say a command or announce on a speaker. Home Assistant runs it, even with every dashboard closed. Quick actions appear there as one-tap shortcuts.</p>
        ${hasCompanion ? "" : html`<p class="hint warning">The Simple Timer Card integration is not installed, so these options have no effect.</p>`}
        <label class="toggle-row">
          <ha-switch .checked=${this._config.action_timers !== false} @change=${(e) => this._setActionTimers(e.target.checked)}></ha-switch>
          <div class="toggle-text">
            <span class="toggle-title">Offer "Do something when it ends"</span>
          </div>
        </label>
        ${list.length === 0 ? html`<div class="no-entities">No quick actions yet. Add one below.</div>` : ""}
        ${list.map((entry, index) => {
          const conf = typeof entry === "string" ? { entity: entry } : (entry || {});
          return html`
            <div class="entity-editor">
              <div class="entity-options" style="width:100%;">
                ${this._renderFinishActionFields(conf, (next) => this._putDeviceTimer(index, next ? { ...next, name: conf.name } : null), { allowNone: false })}
                ${this._tf({ label: "Label (optional)", value: conf.name, change: (e) => this._setDeviceTimer(index, { name: e.target.value }) })}
              </div>
              <button class="remove-entity" @click=${() => this._removeDeviceTimer(index)} title="Remove quick action">
                <ha-icon icon="mdi:delete"></ha-icon>
              </button>
            </div>
          `;
        })}
        <div class="add-row">
          <button class="add-button" @click=${() => this._putDeviceTimer(list.length, { entity: "" })}>
            <ha-icon icon="mdi:plus"></ha-icon>
            <span>Device action</span>
          </button>
          <button class="add-button" @click=${() => this._putDeviceTimer(list.length, { command: "" })}>
            <ha-icon icon="mdi:plus"></ha-icon>
            <span>Command</span>
          </button>
          <button class="add-button" @click=${() => this._putDeviceTimer(list.length, { announce: "" })}>
            <ha-icon icon="mdi:plus"></ha-icon>
            <span>Announcement</span>
          </button>
        </div>
      </div>
    `;
  }

  _finishActionType(raw) {
    if (typeof raw === "string") return raw ? "device" : "none";
    if (!raw || typeof raw !== "object") return "none";
    if (raw.announce != null) return "announce";
    if (raw.command != null) return "command";
    if (Array.isArray(raw.actions)) return "custom";
    if (raw.entity != null || raw.entity_id != null) return "device";
    return "none";
  }

  // What happens when a timer ends: a device action, a command or an
  // announcement. Shared by quick actions and pinned timers.
  _renderFinishActionFields(raw, onChange, { allowNone = true } = {}) {
    const card = SimpleTimerCard.prototype;
    const conf = typeof raw === "string" ? { entity: raw } : (raw || {});
    const type = this._finishActionType(raw);
    const types = [
      ...(allowNone ? [{ value: "none", label: "Nothing" }] : []),
      { value: "device", label: "Control a device" },
      { value: "command", label: "Say a command" },
      { value: "announce", label: "Announce on a speaker" },
      ...(type === "custom" ? [{ value: "custom", label: "Custom actions (YAML)" }] : []),
    ];
    const blank = { device: { entity: "" }, command: { command: "" }, announce: { announce: "" } };
    const setType = (value) => {
      if (!value || value === type) return;
      onChange(value === "none" ? null : (blank[value] || conf));
    };
    const patch = (changes) => {
      const next = { ...conf, ...changes };
      for (const key of Object.keys(next)) if (next[key] === undefined || (key !== "entity" && key !== "command" && key !== "announce" && next[key] === "")) delete next[key];
      onChange(next);
    };
    const entity = conf.entity || conf.entity_id || "";
    const services = type === "device" && entity ? card._servicesForEntity.call(this, entity) : [];
    const service = conf.service || conf.action;
    const current = service
      ? (String(service).includes(".") ? service : `${String(entity).split(".")[0]}.${service}`)
      : (services.find((sv) => sv.endsWith(".turn_off")) || services[0] || "");
    const serviceOptions = services.map((value) => ({ value, label: card._serviceLabel.call(this, value) }));
    return html`
      <ha-select label="When it ends" naturalMenuWidth fixedMenuPosition .value=${type} .options=${types}
        @selected=${(e) => { e.stopPropagation(); setType(e?.detail?.value ?? e.target.value); }}
        @closed=${(e) => e.stopPropagation()}>
        ${types.map((o) => html`<mwc-list-item value=${o.value}>${o.label}</mwc-list-item>`)}
      </ha-select>
      ${type === "device" ? html`
          <ha-entity-picker
            .hass=${this.hass}
            .value=${entity}
            label="Device"
            allow-custom-entity
            @value-changed=${(e) => patch({ entity: e.detail.value || "", entity_id: undefined, service: undefined, action: undefined })}
          ></ha-entity-picker>
          ${serviceOptions.length ? html`
            <ha-select label="Action" naturalMenuWidth fixedMenuPosition .value=${current} .options=${serviceOptions}
              @selected=${(e) => { e.stopPropagation(); const v = e?.detail?.value ?? e.target.value; if (v && v !== current) patch({ service: v, action: undefined }); }}
              @closed=${(e) => e.stopPropagation()}>
              ${serviceOptions.map((o) => html`<mwc-list-item value=${o.value}>${o.label}</mwc-list-item>`)}
            </ha-select>
          ` : ""}
      ` : ""}
      ${type === "command" ? this._tf({ label: "Command", value: conf.command, placeholder: "turn off the air purifier", helper: "What you would say to Assist.", change: (e) => patch({ command: e.target.value }) }) : ""}
      ${type === "announce" ? html`
          <ha-entity-picker
            .hass=${this.hass}
            .value=${conf.announce || ""}
            .includeDomains=${["media_player", "assist_satellite"]}
            label="Speaker"
            allow-custom-entity
            @value-changed=${(e) => patch({ announce: e.detail.value || "" })}
          ></ha-entity-picker>
          ${this._tf({ label: "Message (optional)", value: conf.message, placeholder: "Your timer is done", helper: "Without a message it says the timer's name, then \"is done\".", change: (e) => patch({ message: e.target.value }) })}
      ` : ""}
      ${type === "custom" ? html`<p class="hint">This action list is edited in YAML.</p>` : ""}
    `;
  }

  _putDeviceTimer(index, next) {
    const list = Array.isArray(this._config.device_timers) ? [...this._config.device_timers] : [];
    if (!next) return;
    const clean = { ...next };
    if (!clean.name) delete clean.name;
    list[index] = clean;
    this._updateConfig({ device_timers: list }, true);
    this.requestUpdate();
  }

  _setPinnedFinish(index, next) {
    const pinned = Array.isArray(this._config.pinned_timers) ? [...this._config.pinned_timers] : [];
    const cur = (pinned[index] && typeof pinned[index] === "object") ? { ...pinned[index] } : {};
    if (next) cur.on_finish = next;
    else delete cur.on_finish;
    pinned[index] = cur;
    this._updateConfig({ pinned_timers: pinned }, true);
    this.requestUpdate();
  }

  _showActionsPanel() {
    const card = SimpleTimerCard.prototype;
    return Object.keys(this.hass?.states || {}).some((id) => card._isCompanionList.call(this, id))
      || Array.isArray(this._config?.device_timers) || this._config?.action_timers === false;
  }

  _setActionTimers(enabled) {
    const cfg = { ...this._config };
    if (enabled) delete cfg.action_timers;
    else cfg.action_timers = false;
    this._config = cfg;
    this._emitChange();
  }

  _setDeviceTimer(index, patch) {
    const list = Array.isArray(this._config.device_timers) ? [...this._config.device_timers] : [];
    const current = typeof list[index] === "string" ? { entity: list[index] } : { ...(list[index] || {}) };
    const next = { ...current, ...patch };
    for (const key of Object.keys(next)) {
      if (next[key] === undefined || (key === "name" && !next[key])) delete next[key];
    }
    list[index] = next;
    this._updateConfig({ device_timers: list });
  }

  _removeDeviceTimer(index) {
    const list = Array.isArray(this._config.device_timers) ? [...this._config.device_timers] : [];
    list.splice(index, 1);
    const cfg = { ...this._config };
    if (list.length) cfg.device_timers = list;
    else delete cfg.device_timers;
    this._config = cfg;
    this._emitChange();
  }

  _setCardButtons(next) {
    const cfg = { ...this._config };
    if (!next || !next.length) delete cfg.buttons;
    else cfg.buttons = next;
    this._config = cfg;
    this._emitChange();
    this.requestUpdate();
  }

  _setEntityButtons(index, next) {
    const entities = [...(this._config.entities || [])];
    let conf = typeof entities[index] === "string" ? { entity: entities[index] } : { ...(entities[index] || {}) };
    if (!next || !next.length) delete conf.buttons;
    else conf.buttons = next;
    if (Object.keys(conf).length === 1 && conf.entity) entities[index] = conf.entity;
    else entities[index] = conf;
    this._config = { ...this._config, entities };
    this._emitChange();
    this.requestUpdate();
  }

  _setPinnedButtons(index, next) {
    const pinned = Array.isArray(this._config.pinned_timers) ? [...this._config.pinned_timers] : [];
    const cur = (pinned[index] && typeof pinned[index] === "object") ? { ...pinned[index] } : {};
    if (!next || !next.length) delete cur.buttons;
    else cur.buttons = next;
    pinned[index] = cur;
    this._config = { ...this._config, pinned_timers: pinned };
    this._emitChange();
    this.requestUpdate();
  }

  _addEntity() {
    if (!this._config) return;
    const newConfig = { ...this._config };
    const entities = [...(newConfig.entities || [])];
    entities.push("");
    newConfig.entities = entities;
    this._updateConfig(newConfig, true);
  }

  _removeEntity(i) {
    if (!this._config || i < 0 || i >= (this._config.entities || []).length) return;
    const newConfig = { ...this._config };
    const entities = [...newConfig.entities];
    entities.splice(i, 1);
    newConfig.entities = entities;
    this._updateConfig(newConfig, true);
  }

  _updateConfig(changes, immediate = false) {
    if (!this._config) return;
    if (typeof changes === "object" && changes !== null) {
      if (changes.entities !== undefined) this._config = changes;
      else this._config = { ...this._config, ...changes };
    }
    if (immediate) this._emitChange();
    else {
      if (this._emitTimeout) clearTimeout(this._emitTimeout);
      this._emitTimeout = setTimeout(() => { this._emitChange(); this._emitTimeout = null; }, 50);
    }
  }

  _emitChange() {
    if (!this._config) return;
    try {
      const cleanedConfig = this._removeDefaultValues(this._config);
      const event = new CustomEvent("config-changed", { detail: { config: cleanedConfig }, bubbles: true, composed: true });
      this.dispatchEvent(event);
    } catch (error) {}
  }

  _removeDefaultValues(config) {
    const defaults = {
      layout: "horizontal",
      style: "bar_horizontal",
      progress_mode: "drain",
      show_timer_presets: true,
      timer_presets: [5, 15, 30],
      timer_name_presets: [],
      snooze_duration: 5,
      show_active_header: true,
      minute_buttons: [1, 5, 10],
      pinned_timers_position: "inline",
      sort_by: "time_left",
      sort_order: "asc",
      default_new_timer_duration_mins: 15,
      custom_timer_input: "stepper",
      show_timer_input_selector: false,
      time_format: "hms",
      time_format_units: ["days","hours","minutes","seconds"],
      expire_action: "keep",
      expire_keep_for: 120,
      auto_dismiss_writable: false,
      audio_enabled: false,
      audio_file_url: "",
      audio_repeat_count: 1,
      audio_play_until_dismissed: false,
      audio_completion_delay: 4,
      expired_subtitle: null,
      default_timer_icon: "mdi:timer-outline",
      default_timer_color: "var(--primary-color)",
      default_timer_entity: null,
      keep_timer_visible_when_idle: false,
      milestone_unit: "auto",
      milestone_pulse: true,
      ring_animation: "none",
      hide_when_empty: false,
      group_by: "none",
      device_label: "auto",
      target_picker: "auto",
    };

    const cleaned = { ...(config || {}) };

    delete cleaned.alexa_audio_enabled;
    delete cleaned.alexa_audio_file_url;
    delete cleaned.alexa_audio_repeat_count;
    delete cleaned.alexa_audio_play_until_dismissed;

    const normCsv = (v) => {
      if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
      if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean);
      return [];
    };

    if (typeof cleaned.entities === "string") cleaned.entities = [cleaned.entities];
    if (!Array.isArray(cleaned.entities)) delete cleaned.entities;
    if (Array.isArray(cleaned.entities) && cleaned.entities.filter((e) => String(e || "").trim()).length === 0) delete cleaned.entities;

    if (!Array.isArray(cleaned.pinned_timers) || cleaned.pinned_timers.length === 0) delete cleaned.pinned_timers;

    if (cleaned.timer_name_presets !== undefined) cleaned.timer_name_presets = normCsv(cleaned.timer_name_presets);
    if (cleaned.time_format_units !== undefined) cleaned.time_format_units = normCsv(cleaned.time_format_units);

    if (cleaned.timer_presets !== undefined) {
      const raw = Array.isArray(cleaned.timer_presets) ? cleaned.timer_presets : (typeof cleaned.timer_presets === "string" ? cleaned.timer_presets.split(",") : []);
      cleaned.timer_presets = raw.map((x) => (typeof x === "number" ? x : String(x).trim())).filter((x) => x !== "");
    }

    if (cleaned.minute_buttons !== undefined) {
      const raw = Array.isArray(cleaned.minute_buttons) ? cleaned.minute_buttons : (typeof cleaned.minute_buttons === "string" ? cleaned.minute_buttons.split(",") : []);
      cleaned.minute_buttons = raw.map((v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
        const s = String(v).trim().toLowerCase();
        if (!s) return null;
        const m = s.match(/^(\d+)\s*([smhd])?$/);
        if (!m) return null;
        const n = parseInt(m[1], 10);
        if (!Number.isFinite(n) || n <= 0) return null;
        return m[2] ? `${n}${m[2]}` : n;
      }).filter((x) => x !== null);
    }

    const stripIfEmpty = (k) => {
      if (cleaned[k] === "" || cleaned[k] === null || cleaned[k] === undefined) delete cleaned[k];
      if (Array.isArray(cleaned[k]) && cleaned[k].length === 0) delete cleaned[k];
    };

    stripIfEmpty("audio_file_url");
    stripIfEmpty("expired_subtitle");
    stripIfEmpty("title");
    stripIfEmpty("default_timer_entity");
    stripIfEmpty("default_timer_area");
    stripIfEmpty("timers_template");
    stripIfEmpty("device_timers");
    if (cleaned.max_rows !== undefined) {
      const n = parseInt(cleaned.max_rows, 10);
      if (Number.isFinite(n) && n > 0) cleaned.max_rows = n;
      else delete cleaned.max_rows;
    }

    const isEqualArray = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

    for (const [key, def] of Object.entries(defaults)) {
      if (!(key in cleaned)) continue;
      const val = cleaned[key];
      if (Array.isArray(def)) {
        if (isEqualArray(val, def)) delete cleaned[key];
      } else if (val === def) {
        delete cleaned[key];
      }
    }

    if (cleaned.mqtt && typeof cleaned.mqtt === "object") {
      if (Object.keys(cleaned.mqtt).length === 0) delete cleaned.mqtt;
    }

    if (cleaned.notify && typeof cleaned.notify === "object" && !cleaned.notify.service) {
      delete cleaned.notify;
    }

    return cleaned;
  }


  async firstUpdated() {
    // Note: ha-input is the new (2026.4+) successor of ha-textfield. ha-textfield
    // is migrated to use ha-input internally and is scheduled for removal in 2026.5.
    // We wait for either to be defined so our render() can pick the right tag.
    const tags = ["ha-entity-picker","ha-select","ha-textfield","ha-input","ha-icon-picker","ha-form","mwc-list-item"];
    tags.forEach((t) => { customElements.whenDefined(t).then(() => this.requestUpdate()).catch(() => {}); });
    this._ensureHACommonsLoaded();
    this.requestUpdate();
  }

  // Choose between ha-input (HA 2026.4+) and ha-textfield (older HA). ha-input
  // is loaded by ha-form's text/number selectors in 2026.4+; ha-textfield is
  // loaded by the same selectors on older HA. We pick whichever is currently
  // upgraded so the visible element always matches a defined custom element.
  get _tfTag() {
    if (customElements.get("ha-input")) return literal`ha-input`;
    return literal`ha-textfield`;
  }

  // Render a text/number input using the chosen tag. Returns a static-html
  // template so the tag itself can be interpolated. All call sites in the
  // editor go through this helper so a single switch flips the entire UI.
  // Toolbar search input. Uses the same dynamic tag selection as _tf so
  // it picks ha-input on HA 2026.4+ (where ha-textfield is a compat shim
  // that can render empty) and ha-textfield on older HA.
  _renderSearchInput() {
    const tag = this._tfTag;
    return shtml`<${tag}
        class="editor-search"
        outlined
        label="Search settings"
        .value=${this._searchQuery || ""}
        @input=${(e) => { this._searchQuery = e.target.value || ""; }}
      ></${tag}>`;
  }

  _tf({ label, value, configValue, type, min, max, step, helper, placeholder, change, cls }) {
    const tag = this._tfTag;
    return shtml`<${tag}
        class=${ifDefined(cls)}
        label=${label ?? ""}
        .value=${value ?? ""}
        .configValue=${configValue ?? ""}
        type=${type ?? "text"}
        min=${ifDefined(min)}
        max=${ifDefined(max)}
        step=${ifDefined(step)}
        helper=${ifDefined(helper)}
        placeholder=${ifDefined(placeholder)}
        @input=${change}
        @change=${change}
      ></${tag}>`;
  }

  // Force-load HA's lazy-loaded editor components. In HA 2026.x the main app
  // doesn't define `ha-textfield` / `ha-input` / `ha-entity-picker` /
  // `ha-icon-picker` until something on screen actually needs them. A card
  // editor opened from the dashboard sometimes mounts before HA has had a
  // reason to import those chunks, so our custom elements stay un-upgraded
  // (empty inline elements with no shadow root - no label, no input visible).
  //
  // `ha-form` lazy-loads each selector's underlying component on demand. By
  // mounting a hidden form with text/number/entity/icon selectors we trigger
  // HA's loader for everything we use in the editor, then remove the form.
  // In HA 2026.4+ the text/number selectors load `ha-input`; in older HA they
  // load `ha-textfield`. The whenDefined hooks in firstUpdated() catch either
  // case and re-render.
  _ensureHACommonsLoaded() {
    const needText = !customElements.get("ha-textfield") && !customElements.get("ha-input");
    const needEntity = !customElements.get("ha-entity-picker");
    const needIcon = !customElements.get("ha-icon-picker");
    if (!needText && !needEntity && !needIcon) return;
    try {
      const loader = document.createElement("ha-form");
      loader.style.display = "none";
      loader.schema = [
        { name: "_t", selector: { text: {} } },
        { name: "_n", selector: { number: { min: 0, mode: "box" } } },
        { name: "_e", selector: { entity: {} } },
        { name: "_i", selector: { icon: {} } },
      ];
      loader.data = { _t: "", _n: 0, _e: "", _i: "" };
      loader.hass = this.hass;
      this.shadowRoot?.appendChild(loader);
      // Keep the loader briefly so HA can finish dynamic-importing the
      // components. Removing it immediately is fine - the imports proceed -
      // but a small delay also makes diagnostics easier.
      setTimeout(() => { try { loader.remove(); } catch (_) {} }, 0);
    } catch (_) {}
  }

  // Backward-compatible alias - keep in case anything else in the file
  // references the old name.
  _ensureEntityPickerLoaded() { this._ensureHACommonsLoaded(); }

  _getDisplayStyleValue() {
    return _normalizeCardStyle(this._config.style);
  }

  _sourceStyleChanged(source, field, ev) {
    ev?.stopPropagation?.();
    const raw = ev?.detail?.value ?? ev?.target?.value ?? "";
    const value = typeof raw === "string" ? raw.trim() : "";
    const styles = { ...(this._config?.source_styles || {}) };
    const entry = { ...(styles[source] || {}) };
    if (value) entry[field] = value;
    else delete entry[field];
    if (Object.keys(entry).length) styles[source] = entry;
    else delete styles[source];
    this._updateConfig({ source_styles: styles });
  }

  _renderSourceStyleRows() {
    const sources = [
      { key: "alexa", label: "Alexa" },
      { key: "google", label: "Google Home" },
      { key: "timer_list", label: "Timer list (voice timers)" },
      { key: "voice_satellite", label: "Browser voice satellite" },
      { key: "count_up", label: "Count up" },
      { key: "dynamic", label: "Template rows" },
      { key: "voice_pe", label: "Voice PE (legacy)" },
      { key: "timer", label: "Native timer" },
      { key: "helper", label: "Helper" },
      { key: "timestamp", label: "Timestamp sensor" },
      { key: "minutes_attr", label: "Minutes attribute" },
    ];
    const styles = this._config?.source_styles || {};
    return sources.map((s) => html`
      <div class="row" data-search-terms=${`source_styles ${s.key}`}>
        <ha-icon-picker
          label="${s.label} icon"
          .value=${styles[s.key]?.icon || ""}
          @value-changed=${(e) => this._sourceStyleChanged(s.key, "icon", e)}
        ></ha-icon-picker>
        ${this._tf({
          label: `${s.label} color`,
          placeholder: "var(--primary-color)",
          value: styles[s.key]?.color || "",
          change: (e) => this._sourceStyleChanged(s.key, "color", e),
        })}
      </div>
    `);
  }

  _detectMode(entityId, entityState, entityConf) {
    return SimpleTimerCard.prototype._detectMode.call(this, entityId, entityState, entityConf);
  }

  _toggleSection(key) {
    this._expandedSections = { ...(this._expandedSections || {}), [key]: !this._expandedSections?.[key] };
  }

  render() {
    if (!this.hass || !this._config) return html``;
    const entityPickerReady = !!customElements.get("ha-entity-picker");
    const target = this._config.default_timer_entity || "";
    const storage = String(this._config.storage || "").toLowerCase();
    const hasMqtt = !!(this._config.mqtt && ["topic", "sensor_entity", "state_topic", "events_topic", "publish_automation"].some(key => this._config.mqtt[key]));
    const companionInstalled = Object.keys(this.hass.states || {}).some((id) => SimpleTimerCard.prototype._isCompanionList.call(this, id));
    const targetIsCompanion = SimpleTimerCard.prototype._isCompanionList.call(this, target) || target.startsWith("sensor.simple_timer_card_timers");
    const storageChoice = storage === "integration" ? "integration"
      : storage === "local" ? "local"
      : storage === "mqtt" || hasMqtt || (target.startsWith("sensor.") && !targetIsCompanion) ? "mqtt" : "local";
    const storageType = (storage === "integration" && (!target || targetIsCompanion)) ? "integration"
      : target.startsWith("timer.") ? "timer"
      : (target.startsWith("timer_list.") || targetIsCompanion) ? "timer_list"
      : target.startsWith("input_text.") || target.startsWith("text.") ? "helper"
      : storage === "local" ? "local"
      : storageChoice;
    const showMilestonesSection = this._config.progress_mode === "milestones";
    const stepperAvailable = normalizeTimerInput(this._config.custom_timer_input) === "stepper" || this._config.show_timer_input_selector === true;

    // HA 2026.x rewrote ha-select to use ha-dropdown internally; that variant
    // renders ONLY from the .options property and ignores slotted <mwc-list-item>
    // children. We set both .options and keep the slotted items as a fallback
    // for older HA. Keep these in sync with the slotted items below.
    const SELECT_OPTIONS = {
      custom_timer_input: [
        { value: "stepper", label: "Buttons (+ / -)" },
        { value: "keypad", label: "Keypad" },
      ],
      layout: [
        { value: "horizontal", label: "Horizontal" },
        { value: "vertical", label: "Vertical" },
      ],
      style: [
        { value: "fill_vertical", label: "Background fill (vertical)" },
        { value: "fill_horizontal", label: "Background fill (horizontal)" },
        { value: "bar_vertical", label: "Progress bar (vertical)" },
        { value: "bar_horizontal", label: "Progress bar (horizontal)" },
        { value: "circle_vertical", label: "Circle (vertical)" },
        { value: "circle_horizontal", label: "Circle (horizontal)" },
      ],
      progress_mode: [
        { value: "drain", label: "Drain" },
        { value: "fill", label: "Fill" },
        { value: "milestones", label: "Milestones (bar styles only)" },
      ],
      language: [
        { value: "da", label: "Dansk" },
        { value: "de", label: "Deutsch" },
        { value: "en", label: "English" },
        { value: "es", label: "Español" },
        { value: "fr", label: "Français" },
        { value: "it", label: "Italiano" },
        { value: "nl", label: "Nederlands" },
        { value: "pl", label: "Polski" },
        { value: "sv", label: "Svenska" },
        { value: "he", label: "עברית" },
      ],
      sort_by: [
        { value: "time_left", label: "Time left" },
        { value: "name", label: "Name" },
      ],
      sort_order: [
        { value: "asc", label: "Ascending" },
        { value: "desc", label: "Descending" },
      ],
      pinned_timers_position: [
        { value: "inline", label: "Mixed with timers" },
        { value: "top", label: "Top" },
        { value: "bottom", label: "Bottom" },
      ],
      time_format: [
        { value: "hms", label: "HH:MM:SS" },
        { value: "hm", label: "HH:MM" },
        { value: "ss", label: "Seconds only" },
        { value: "dhms", label: "DD:HH:MM:SS" },
        { value: "human_compact", label: "Unit style, compact" },
        { value: "human_short", label: "Unit style, short labels" },
        { value: "human_natural", label: "Unit style, natural language" },
      ],
      milestone_unit: [
        { value: "auto", label: "Auto (default)" },
        { value: "none", label: "None" },
        { value: "years", label: "Years" },
        { value: "months", label: "Months" },
        { value: "weeks", label: "Weeks" },
        { value: "days", label: "Days" },
        { value: "hours", label: "Hours" },
        { value: "minutes", label: "Minutes" },
        { value: "seconds", label: "Seconds" },
      ],
      expire_action: [
        { value: "keep", label: "Keep visible" },
        { value: "dismiss", label: "Dismiss" },
        { value: "remove", label: "Remove" },
      ],
      ring_animation: [
        { value: "none", label: "None" },
        { value: "pulse", label: "Pulse icon" },
        { value: "swing", label: "Swing icon" },
        { value: "shake", label: "Shake row" },
        { value: "hop", label: "Hop row" },
      ],
      group_by: [
        { value: "none", label: "No grouping" },
        { value: "device", label: "Device" },
        { value: "area", label: "Area" },
        { value: "source", label: "Source" },
      ],
      device_label: [
        { value: "auto", label: "Auto (when several devices)" },
        { value: "device", label: "Device name" },
        { value: "area", label: "Area name" },
        { value: "none", label: "Hidden" },
      ],
      storage: [
        { value: "local", label: "This browser" },
        { value: "mqtt", label: "MQTT" },
        { value: "integration", label: "Simple Timer Card integration" },
      ],
      target_picker: [
        { value: "auto", label: "Auto (when a speaker supports timers)" },
        { value: "always", label: "Always" },
        { value: "never", label: "Never" },
      ],
      entity_mode: [
        { value: "auto", label: "Auto (Default)" },
        { value: "alexa", label: "Alexa" },
        { value: "google", label: "Google Home" },
        { value: "timer", label: "Timer" },
        { value: "timer_list", label: "Timer list (voice timers)" },
        { value: "voice_satellite", label: "Browser voice satellite" },
        { value: "count_up", label: "Count up (time since)" },
        { value: "voice_pe", label: "Voice PE (legacy)" },
        { value: "helper", label: "Helper (input_text/text)" },
        { value: "timestamp", label: "Timestamp sensor" },
        { value: "minutes_attr", label: "Minutes attribute" },
      ],
    };

    const appearanceContent = html`
      ${this._tf({ label: "Title", placeholder: "Optional", helper: "Shown above the timer list at the top of the card.", value: this._config.title, configValue: "title", change: this._valueChanged })}

      <ha-select label="Style" helper="Appearance and arrangement of active timers." naturalMenuWidth fixedMenuPosition .value=${this._getDisplayStyleValue()} .configValue=${"style"} .options=${SELECT_OPTIONS.style} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
        <mwc-list-item value="fill_vertical">Background fill (vertical)</mwc-list-item>
        <mwc-list-item value="fill_horizontal">Background fill (horizontal)</mwc-list-item>
        <mwc-list-item value="bar_vertical">Progress bar (vertical)</mwc-list-item>
        <mwc-list-item value="bar_horizontal">Progress bar (horizontal)</mwc-list-item>
        <mwc-list-item value="circle_vertical">Circle (vertical)</mwc-list-item>
        <mwc-list-item value="circle_horizontal">Circle (horizontal)</mwc-list-item>
      </ha-select>
    `;

    const displayContent = html`
      <ha-select label="Empty-card layout" helper="Layout of the card when no timers are running. Active timers use the selected Style."
        naturalMenuWidth fixedMenuPosition .value=${this._config.layout || "horizontal"} .configValue=${"layout"} .options=${SELECT_OPTIONS.layout}
        @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
        <mwc-list-item value="horizontal">Horizontal</mwc-list-item>
        <mwc-list-item value="vertical">Vertical</mwc-list-item>
      </ha-select>
      <div class="row">
        <ha-select label="Progress mode" helper="How the progress bar fills as time runs out." naturalMenuWidth fixedMenuPosition .value=${this._config.progress_mode || "drain"} .configValue=${"progress_mode"} .options=${SELECT_OPTIONS.progress_mode} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
          <mwc-list-item value="drain">Drain</mwc-list-item>
          <mwc-list-item value="fill">Fill</mwc-list-item>
          <mwc-list-item value="milestones">Milestones (bar styles only)</mwc-list-item>
        </ha-select>

        <ha-select label="Language" helper="Override the auto-detected display language." naturalMenuWidth fixedMenuPosition .value=${(String(this._config.language || this.hass?.language || "en").toLowerCase().split(/[-_]/)[0])} .configValue=${"language"} .options=${SELECT_OPTIONS.language} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
          <mwc-list-item value="en">English</mwc-list-item>
          <mwc-list-item value="de">Deutsch</mwc-list-item>
          <mwc-list-item value="es">Español</mwc-list-item>
          <mwc-list-item value="da">Dansk</mwc-list-item>
          <mwc-list-item value="it">Italiano</mwc-list-item>
          <mwc-list-item value="fr">Français</mwc-list-item>
          <mwc-list-item value="he">עברית</mwc-list-item>
          <mwc-list-item value="pl">Polski</mwc-list-item>
          <mwc-list-item value="nl">Nederlands</mwc-list-item>
          <mwc-list-item value="sv">Svenska</mwc-list-item>
        </ha-select>
      </div>

      <label class="toggle-row">
        <ha-switch .checked=${this._config.show_active_header !== false} .configValue=${"show_active_header"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Show "Active Timers" heading</span>
          <span class="toggle-desc">Show the heading and Add/Custom controls above running timers.</span>
        </div>
      </label>

      <label class="toggle-row advanced">
        <ha-switch .checked=${this._config.hide_when_empty === true} .configValue=${"hide_when_empty"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Hide the card when there are no timers</span>
          <span class="toggle-desc">The card reappears when a timer starts. Pinned timers keep it visible. Always shown while editing.</span>
        </div>
      </label>

      <div class="row advanced">
        ${this._tf({ label: "Maximum rows", type: "number", min: "0", helper: "Show this many timers. A +N next to the header shows the rest. Empty shows all.", value: this._config.max_rows ?? "", configValue: "max_rows", change: this._valueChanged })}
        <ha-select label="Group timers by" naturalMenuWidth fixedMenuPosition .value=${this._config.group_by || "none"} .configValue=${"group_by"} .options=${SELECT_OPTIONS.group_by} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
          ${SELECT_OPTIONS.group_by.map((o) => html`<mwc-list-item value=${o.value}>${o.label}</mwc-list-item>`)}
        </ha-select>
        <ha-select label="Device label on voice timers" naturalMenuWidth fixedMenuPosition .value=${this._config.device_label || "auto"} .configValue=${"device_label"} .options=${SELECT_OPTIONS.device_label} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
          ${SELECT_OPTIONS.device_label.map((o) => html`<mwc-list-item value=${o.value}>${o.label}</mwc-list-item>`)}
        </ha-select>
      </div>
    `;

    const sortingContent = html`
      <div class="row">
        <ha-select label="Sort by" helper="Field used to order the timer list." naturalMenuWidth fixedMenuPosition .value=${this._config.sort_by || "time_left"} .configValue=${"sort_by"} .options=${SELECT_OPTIONS.sort_by} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
          <mwc-list-item value="time_left">Time left</mwc-list-item>
          <mwc-list-item value="name">Name</mwc-list-item>
        </ha-select>

        <ha-select label="Sort order" helper="Ascending or descending." naturalMenuWidth fixedMenuPosition .value=${this._config.sort_order || "asc"} .configValue=${"sort_order"} .options=${SELECT_OPTIONS.sort_order} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
          <mwc-list-item value="asc">Ascending</mwc-list-item>
          <mwc-list-item value="desc">Descending</mwc-list-item>
        </ha-select>
      </div>

      <ha-select label="Pinned timers position" helper="Where pinned-timer buttons sit relative to the list." naturalMenuWidth fixedMenuPosition .value=${this._config.pinned_timers_position || "inline"} .configValue=${"pinned_timers_position"} .options=${SELECT_OPTIONS.pinned_timers_position} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
        <mwc-list-item value="inline">Mixed with timers</mwc-list-item>
        <mwc-list-item value="top">Top</mwc-list-item>
        <mwc-list-item value="bottom">Bottom</mwc-list-item>
      </ha-select>
    `;

    const timeFormatContent = html`
      <ha-select label="Time format" helper="Layout for the countdown digits." naturalMenuWidth fixedMenuPosition .value=${this._config.time_format || "hms"} .configValue=${"time_format"} .options=${SELECT_OPTIONS.time_format} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
        <mwc-list-item value="hms">HH:MM:SS</mwc-list-item>
        <mwc-list-item value="hm">HH:MM</mwc-list-item>
        <mwc-list-item value="ss">Seconds only</mwc-list-item>
        <mwc-list-item value="dhms">DD:HH:MM:SS</mwc-list-item>
        <mwc-list-item value="human_compact">Unit style, compact</mwc-list-item>
        <mwc-list-item value="human_short">Unit style, short labels</mwc-list-item>
        <mwc-list-item value="human_natural">Unit style, natural language</mwc-list-item>
      </ha-select>

      ${this._tf({ label: "Unit order (comma-separated)", helper: "years,months,weeks,days,hours,minutes,seconds", value: (this._config.time_format_units || ["days","hours","minutes","seconds"]).join(","), configValue: "time_format_units", change: this._valueChanged })}

      ${showMilestonesSection ? html`
        <div class="settings-group" data-search-terms="progress milestones">
        <div class="subsection-title">Progress milestones</div>
        <div class="row" style="align-items:flex-start;">
          <ha-select label="Milestone unit" helper="Unit highlighted as the active milestone." naturalMenuWidth fixedMenuPosition .value=${this._config.milestone_unit || "auto"} .configValue=${"milestone_unit"} .options=${SELECT_OPTIONS.milestone_unit} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
            <mwc-list-item value="auto">Auto (default)</mwc-list-item>
            <mwc-list-item value="none">None</mwc-list-item>
            <mwc-list-item value="years">Years</mwc-list-item>
            <mwc-list-item value="months">Months</mwc-list-item>
            <mwc-list-item value="weeks">Weeks</mwc-list-item>
            <mwc-list-item value="days">Days</mwc-list-item>
            <mwc-list-item value="hours">Hours</mwc-list-item>
            <mwc-list-item value="minutes">Minutes</mwc-list-item>
            <mwc-list-item value="seconds">Seconds</mwc-list-item>
          </ha-select>
          <label class="toggle-row">
            <ha-switch .checked=${this._config.milestone_pulse !== false} .configValue=${"milestone_pulse"} @change=${this._valueChanged}></ha-switch>
            <div class="toggle-text"><span class="toggle-title">Pulse active milestone</span></div>
          </label>
        </div>
        </div>
      ` : ""}
    `;

    const inputContent = html`
      <ha-select label="Custom timer input" helper="Choose buttons or a numeric keypad for entering a new timer."
        naturalMenuWidth fixedMenuPosition .value=${normalizeTimerInput(this._config.custom_timer_input)}
        .configValue=${"custom_timer_input"} .options=${SELECT_OPTIONS.custom_timer_input}
        @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
        <mwc-list-item value="stepper">Buttons (+ / -)</mwc-list-item>
        <mwc-list-item value="keypad">Keypad</mwc-list-item>
      </ha-select>
      <label class="toggle-row">
        <ha-switch .checked=${this._config.show_timer_input_selector === true} .configValue=${"show_timer_input_selector"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Show input switch on card</span>
          <span class="toggle-desc">Let users switch between Buttons and Keypad while entering a timer.</span>
        </div>
      </label>
      <div class="settings-group ${stepperAvailable ? "" : "advanced"}" data-search-terms="stepper increments">
        ${this._tf({ label: "Default duration (minutes)", type: "number", min: "0", helper: "Starting value for the +/- buttons. Keypad entry starts at zero.", value: this._config.default_new_timer_duration_mins ?? 15, configValue: "default_new_timer_duration_mins", change: this._valueChanged })}
        ${this._tf({ label: "Adjustment buttons", helper: "Increments for the +/- input and native timer editing. Examples: 1, 5, 30s, 2h. Numbers are minutes.", value: (this._config.minute_buttons || [1, 5, 10]).join(", "), configValue: "minute_buttons", change: this._valueChanged })}
      </div>
      ${this._tf({ label: "Timer name presets", helper: "Optional comma-separated name suggestions. Independent of quick-start buttons.", value: (this._config.timer_name_presets || []).join(", "), configValue: "timer_name_presets", change: this._valueChanged, cls: "advanced" })}
      <label class="toggle-row">
        <ha-switch .checked=${this._config.show_timer_presets !== false} .configValue=${"show_timer_presets"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Show quick-start buttons</span>
          <span class="toggle-desc">Start a preset duration with one tap, without opening Custom.</span>
        </div>
      </label>
      ${this._config.show_timer_presets !== false ? html`
        ${this._tf({ label: "Timer presets", helper: "Seconds, minutes, hours, or days. Examples: 5, 15, 90s, 2h.", value: (this._config.timer_presets || [5, 15, 30]).join(", "), configValue: "timer_presets", change: this._valueChanged })}
      ` : ""}
    `;

    const stylingContent = html`
      <div class="row">
        <ha-icon-picker label="Default timer icon" helper="Used when a timer does not specify its own icon." .value=${this._config.default_timer_icon || "mdi:timer-outline"} .configValue=${"default_timer_icon"} @value-changed=${this._detailValueChanged}></ha-icon-picker>
        ${this._tf({ label: "Default timer color", helper: "CSS color or var() used as the progress accent.", value: this._config.default_timer_color || "var(--primary-color)", configValue: "default_timer_color", change: this._valueChanged })}
      </div>

      <div class="divider"></div>

      <p class="hint">Per-source icon and color. Useful for auto-discovered timers, which have no per-entity settings. An entity listed under Entities with its own icon still wins. Paused and finished timers keep their state icon and color.</p>
      ${this._renderSourceStyleRows()}
    `;

    const defaultsContent = html`
      ${this._tf({ label: "Snooze duration (minutes)", type: "number", min: "0", helper: "Minutes added when the user taps Snooze on an expired timer.", value: this._config.snooze_duration ?? 5, configValue: "snooze_duration", change: this._valueChanged })}
      ${this._tf({ label: "Timer expired message", helper: "Shown under each timer once it reaches zero.", value: this._config.expired_subtitle, configValue: "expired_subtitle", placeholder: "Time's up!", change: this._valueChanged })}

      <div class="divider"></div>

      <div class="row">
        <ha-select label="When a timer reaches 0" helper="Default action when the countdown hits zero. Per-entity overrides also apply." naturalMenuWidth fixedMenuPosition .value=${this._config.expire_action || "keep"} .configValue=${"expire_action"} .options=${SELECT_OPTIONS.expire_action} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
          <mwc-list-item value="keep">Keep visible</mwc-list-item>
          <mwc-list-item value="dismiss">Dismiss</mwc-list-item>
          <mwc-list-item value="remove">Remove</mwc-list-item>
        </ha-select>
        ${(this._config.expire_action || "keep") === "keep" ? this._tf({ label: "Keep-visible duration (seconds)", type: "number", min: "0", helper: "How long an expired timer stays on screen before disappearing.", value: this._config.expire_keep_for ?? 120, configValue: "expire_keep_for", change: this._valueChanged }) : ""}
      </div>

      <ha-select label="Ringing animation" helper="Draw attention to a ringing timer. Respects the system's reduced-motion setting." naturalMenuWidth fixedMenuPosition .value=${this._config.ring_animation || "none"} .configValue=${"ring_animation"} .options=${SELECT_OPTIONS.ring_animation} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
        ${SELECT_OPTIONS.ring_animation.map((o) => html`<mwc-list-item value=${o.value}>${o.label}</mwc-list-item>`)}
      </ha-select>

      <label class="toggle-row advanced">
        <ha-switch .checked=${this._config.auto_dismiss_writable === true} .configValue=${"auto_dismiss_writable"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Auto-dismiss helper timers at 0</span>
          <span class="toggle-desc">For helper-backed timers (input_text/text), clear the entity when the timer hits zero instead of keeping the expired value.</span>
        </div>
      </label>
    `;

    const hasCompanion = Object.keys(this.hass?.states || {}).some((id) => SimpleTimerCard.prototype._isCompanionList.call(this, id));
    const pinnedContent = html`
      <p class="hint">One-tap reusable timers shown in the empty state. They hide while running.${hasCompanion ? " Each can do something when it ends: control a device, say a command or announce on a speaker." : ""}</p>

      ${(Array.isArray(this._config.pinned_timers) ? this._config.pinned_timers : []).length === 0
        ? html`<div class="no-entities">No pinned timers configured. Use the button below to add one.</div>`
        : (this._config.pinned_timers || []).map((t, index) => html`
            <div class="entity-editor">
              <div class="entity-options" style="width:100%;">
                <div class="row">
                  ${this._tf({ label: "Name", value: t?.name, configValue: "name", change: (e) => this._pinnedTimerValueChanged(e, index) })}
                  ${this._tf({ label: "Duration", helper: "Examples: 5m, 90s, 1h", value: t?.duration ?? t?.preset ?? "5m", configValue: "duration", change: (e) => this._pinnedTimerValueChanged(e, index) })}
                </div>

                <div class="row">
                  <ha-icon-picker label="Icon" .value=${t?.icon || ""} .configValue=${"icon"} @value-changed=${(e) => { e.target.configValue = "icon"; this._pinnedTimerValueChanged(e, index); }}></ha-icon-picker>
                  ${this._tf({ label: "Color", value: t?.color, configValue: "color", change: (e) => this._pinnedTimerValueChanged(e, index) })}
                </div>

                ${this._tf({ label: "Expired message", value: t?.expired_subtitle, configValue: "expired_subtitle", change: (e) => this._pinnedTimerValueChanged(e, index) })}

                ${hasCompanion || t?.on_finish ? html`
                  <div class="finish-action">
                    ${this._renderFinishActionFields(t?.on_finish, (next) => this._setPinnedFinish(index, next))}
                    ${hasCompanion ? "" : html`<p class="hint warning">Needs the Simple Timer Card integration.</p>`}
                  </div>
                ` : ""}

                <label class="toggle-row">
                  <ha-switch .checked=${t?.audio_enabled === true} .configValue=${"audio_enabled"} @change=${(e) => this._pinnedTimerValueChanged(e, index)}></ha-switch>
                  <div class="toggle-text"><span class="toggle-title">Enable specific audio</span></div>
                </label>

                ${t?.audio_enabled ? html`
                  <div class="row">
                    ${this._tf({ label: "Audio file URL", value: t?.audio_file_url, configValue: "audio_file_url", change: (e) => this._pinnedTimerValueChanged(e, index) })}
                    ${this._tf({ label: "Repeat count", type: "number", min: "1", max: "10", value: t?.audio_repeat_count ?? 1, configValue: "audio_repeat_count", change: (e) => this._pinnedTimerValueChanged(e, index) })}
                  </div>

                  <label class="toggle-row">
                    <ha-switch .checked=${t?.audio_play_until_dismissed === true} .configValue=${"audio_play_until_dismissed"} @change=${(e) => this._pinnedTimerValueChanged(e, index)}></ha-switch>
                    <div class="toggle-text"><span class="toggle-title">Play until dismissed or snoozed</span></div>
                  </label>
                ` : ""}

                <div class="row-actions-label">Custom action buttons</div>
                ${this._renderButtonsEditor(t?.buttons, (next) => this._setPinnedButtons(index, next))}
              </div>

              <button class="remove-entity" @click=${() => this._removePinnedTimer(index)} title="Remove pinned timer">
                <ha-icon icon="mdi:delete"></ha-icon>
              </button>
            </div>
          `)}

      <button class="add-button" @click=${this._addPinnedTimer}>
        <ha-icon icon="mdi:plus"></ha-icon>
        <span>Add pinned timer</span>
      </button>
    `;

    const audioContent = html`
      <label class="toggle-row">
        <ha-switch .checked=${this._config.audio_enabled === true} .configValue=${"audio_enabled"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Enable audio notifications</span>
          <span class="toggle-desc">Play a sound when any timer expires (per-entity overrides also apply).</span>
        </div>
      </label>

      ${this._config.audio_enabled ? html`
        ${this._tf({ label: "Audio file URL or path", helper: "URL or /local/... path to an mp3, wav, or ogg file.", value: this._config.audio_file_url, configValue: "audio_file_url", placeholder: "/local/sounds/done.mp3", change: this._valueChanged })}
        <div class="row">
          ${this._tf({ label: "Completion delay (seconds)", type: "number", min: "1", max: "30", value: this._config.audio_completion_delay ?? 4, configValue: "audio_completion_delay", change: this._valueChanged, cls: "advanced" })}
          ${this._tf({ label: "Number of times to play", type: "number", min: "1", max: "10", helper: "Ignored when 'Play until dismissed' is on.", value: this._config.audio_repeat_count ?? 1, configValue: "audio_repeat_count", change: this._valueChanged })}
        </div>
        <label class="toggle-row">
          <ha-switch .checked=${this._config.audio_play_until_dismissed === true} .configValue=${"audio_play_until_dismissed"} @change=${this._valueChanged}></ha-switch>
          <div class="toggle-text">
            <span class="toggle-title">Play until dismissed or snoozed</span>
            <span class="toggle-desc">Override the repeat count and keep playing until the user acts on the timer.</span>
          </div>
        </label>
      ` : ""}
    `;

    const notifyServices = Object.keys(this.hass?.services?.notify || {})
      .map((s) => "notify." + s)
      .sort();
    const notifyServiceOptions = [
      { value: "", label: "(none)" },
      ...notifyServices.map((s) => ({ value: s, label: s })),
    ];
    const notifyWhenOptions = [
      { value: "on_audio_fail", label: "Only when audio fails (recommended)" },
      { value: "always", label: "Always (alongside in-page audio)" },
    ];
    const nConf = this._config.notify || {};
    const criticalOn = !!(nConf?.data?.push?.sound &&
      typeof nConf.data.push.sound === "object" &&
      nConf.data.push.sound.critical === 1);
    const notifyContent = html`
      <p class="hint">Optional push-notification fallback. Fires any HA <code>notify.*</code> service when a timer ends. Useful when in-page audio is blocked (locked screen, backgrounded tab, cold-loaded dashboard on iOS).</p>

      <ha-select
        label="Notify service"
        naturalMenuWidth
        fixedMenuPosition
        .value=${nConf.service || ""}
        .configValue=${"service"}
        .options=${notifyServiceOptions}
        @selected=${this._notifyValueChanged}
        @closed=${(e) => e.stopPropagation()}
      ></ha-select>

      ${nConf.service ? html`
        <ha-select
          label="When to fire"
          naturalMenuWidth
          fixedMenuPosition
          .value=${nConf.when || "on_audio_fail"}
          .configValue=${"when"}
          .options=${notifyWhenOptions}
          @selected=${this._notifyValueChanged}
          @closed=${(e) => e.stopPropagation()}
        ></ha-select>

        ${this._tf({ label: "Message", helper: "Placeholders: {name}, {entity_id}, {duration}. Defaults to 'Timer {name} finished'.", value: nConf.message, configValue: "message", placeholder: "Timer {name} finished", change: this._notifyValueChanged })}
        ${this._tf({ label: "Title", helper: "Optional title shown above the message.", value: nConf.title, configValue: "title", change: this._notifyValueChanged })}

        <label class="toggle-row">
          <ha-switch .checked=${criticalOn} @change=${this._notifyCriticalChanged}></ha-switch>
          <div class="toggle-text">
            <span class="toggle-title">iOS critical alert</span>
            <span class="toggle-desc">Plays the alert even when the device is in Focus/Silent mode. iPhone/iPad only; requires the HA Companion app to have critical-alerts permission granted.</span>
          </div>
        </label>

        <p class="hint advanced">For custom sounds, Android channels, or other push payload fields, edit <code>notify.data:</code> directly in YAML. See <a href="https://github.com/eyalgal/simple-timer-card/blob/main/CONFIGURATION.md#-push-notification-fallback" target="_blank" rel="noopener">CONFIGURATION.md</a>.</p>
      ` : ""}
    `;

    const storageContent = html`
      <ha-select label="Save new timers in" naturalMenuWidth fixedMenuPosition .value=${storageChoice} .configValue=${"storage"} .options=${SELECT_OPTIONS.storage} @selected=${this._storageChanged} @closed=${(e) => e.stopPropagation()}>
        ${SELECT_OPTIONS.storage.map((o) => html`<mwc-list-item value=${o.value}>${o.label}</mwc-list-item>`)}
      </ha-select>
      ${storageChoice === "integration" && !companionInstalled ? html`
        <p class="hint warning">The Simple Timer Card integration is not installed, so new timers are saved in this browser for now. See <a href="https://github.com/eyalgal/simple-timer-card/blob/main/CONFIGURATION.md#-companion-integration" target="_blank" rel="noopener">how to install it</a>.</p>
      ` : ""}
      ${storageChoice === "integration" && companionInstalled ? this._renderMqttMove() : ""}
      ${storageChoice === "mqtt" && !target.startsWith("sensor.") ? html`
        <ha-entity-picker
          .hass=${this.hass}
          .value=${this._config.mqtt?.sensor_entity || ""}
          .includeDomains=${["sensor"]}
          @value-changed=${(ev) => this._mqttFieldChanged("sensor_entity", ev)}
          label="MQTT sensor"
          help-text="The sensor that holds the timers. See the MQTT guide to create it."
          allow-custom-entity
        ></ha-entity-picker>
      ` : ""}
      <ha-entity-picker
        .hass=${this.hass}
        .value=${this._config.default_timer_entity || ""}
        .configValue=${"default_timer_entity"}
        @value-changed=${this._detailValueChanged}
        label="New timer target (optional)"
        help-text="Overrides the storage above: a native timer, a speaker's timer list or a text helper. Leave empty to use the storage above."
        allow-custom-entity
        .includeDomains=${["timer", "timer_list", "input_text", "text", "sensor"]}
      ></ha-entity-picker>

      <div class="row advanced">
        <ha-selector
          .hass=${this.hass}
          .label=${"Default area for new timers"}
          .helper=${"Start new timers on the timer list in this area, such as the Voice PE in the kitchen."}
          .selector=${{ area: {} }}
          .value=${this._config.default_timer_area || ""}
          .configValue=${"default_timer_area"}
          @value-changed=${this._detailValueChanged}
        ></ha-selector>
        <ha-select label="Put on a speaker" helper="Let users put a new timer on a voice speaker that supports timers." naturalMenuWidth fixedMenuPosition .value=${this._config.target_picker || "auto"} .configValue=${"target_picker"} .options=${SELECT_OPTIONS.target_picker} @selected=${this._selectChanged} @closed=${(e) => e.stopPropagation()}>
          ${SELECT_OPTIONS.target_picker.map((o) => html`<mwc-list-item value=${o.value}>${o.label}</mwc-list-item>`)}
        </ha-select>
      </div>

      <div class="storage-info">
        <span class="storage-label">Storage type: <strong>${this._getStorageDisplayName(storageType)}</strong></span>
        <small class="storage-description">${this._getStorageDescription(storageType)}</small>
      </div>

      ${storageType === "mqtt" ? html`
        <ha-entity-picker
          .hass=${this.hass}
          .value=${this._config.mqtt?.publish_automation || ""}
          .configValue=${"mqtt.publish_automation"}
          .includeDomains=${["automation"]}
          @value-changed=${this._mqttAutomationChanged}
          label="MQTT publish automation (non-admin users)"
          help-text="Install the relay from the MQTT guide first. Administrators still publish directly."
          allow-custom-entity
        ></ha-entity-picker>
      ` : ""}
      <p class="hint advanced">Custom MQTT topics, storage namespaces and compatibility options can be set in YAML. See the configuration guide for storage setup.</p>
      ${this._config.auto_voice_pe === true ? html`
        <ha-entity-picker
          class="advanced"
          .hass=${this.hass}
          .value=${this._config.voice_pe_control_entity || ""}
          .configValue=${"voice_pe_control_entity"}
          .includeDomains=${["text", "input_text"]}
          allow-custom-entity
          label="Voice PE control entity"
          help-text="Text/input_text entity that receives commands for local Voice PE timers."
          @value-changed=${this._detailValueChanged}
        ></ha-entity-picker>
      ` : ""}
    `;

    const discoveryContent = html`
      <label class="toggle-row">
        <ha-switch .checked=${this._config.auto_discover_alexa === true} .configValue=${"auto_discover_alexa"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Auto-discover Alexa timers</span>
          <span class="toggle-desc">Requires the Alexa Media Player integration.</span>
        </div>
      </label>

      <label class="toggle-row">
        <ha-switch .checked=${this._config.auto_discover_google === true} .configValue=${"auto_discover_google"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Auto-discover Google Home timers</span>
          <span class="toggle-desc">Requires the Google Home integration.</span>
        </div>
      </label>

      <label class="toggle-row">
        <ha-switch .checked=${this._config.auto_discover_timer_lists === true} .configValue=${"auto_discover_timer_lists"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Auto-discover voice timers</span>
          <span class="toggle-desc">Voice PE and other voice satellites, plus the Simple Timer Card integration.</span>
        </div>
      </label>

      <label class="toggle-row advanced">
        <ha-switch .checked=${this._config.auto_discover_voice_satellites === true} .configValue=${"auto_discover_voice_satellites"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Auto-discover browser voice satellites</span>
          <span class="toggle-desc">Read-only timers from the Voice Satellite Card integration on wall tablets.</span>
        </div>
      </label>

      <div class="advanced" data-search-terms="timers_template template rows jinja">
        <ha-selector
          .hass=${this.hass}
          .label=${"Template rows (optional)"}
          .helper=${"A Jinja template returning a JSON list of rows with name and end, or name and since. See the configuration guide."}
          .selector=${{ template: {} }}
          .value=${this._config.timers_template || ""}
          .configValue=${"timers_template"}
          @value-changed=${this._detailValueChanged}
        ></ha-selector>
      </div>

      <label class="toggle-row advanced">
        <ha-switch .checked=${this._config.auto_voice_pe === true} .configValue=${"auto_voice_pe"} @change=${this._valueChanged}></ha-switch>
        <div class="toggle-text">
          <span class="toggle-title">Legacy Voice PE sensors</span>
          <span class="toggle-desc">Only for the custom ESPHome firmware setup. Not needed when your satellite has a timer list.</span>
        </div>
      </label>
    `;

    const entitiesContent = html`
      <p class="hint">Leave empty for timers created in this browser, or select existing Home Assistant timer entities. Use the toggles below to discover speaker timers.</p>

      ${(this._config.entities || []).length === 0
        ? ""
        : (this._config.entities || []).map((entityConf, index) => {
            const entityId = typeof entityConf === "string" ? entityConf : (entityConf?.entity || "");
            const conf = typeof entityConf === "string" ? {} : (entityConf || {});
            const st = this.hass.states[entityId];
            const detectedMode = this._detectMode(entityId, st, conf);
            const isAuto = !conf.mode || conf.mode === "auto";
            const isTimestampMode = conf.mode === "timestamp" || (isAuto && detectedMode === "timestamp");
            return html`
              <div class="entity-editor" data-search-terms=${entityId}>
                ${entityPickerReady ? html`
                  <ha-entity-picker
                    .hass=${this.hass}
                    .value=${entityId}
                    .configValue=${"entity"}
                    label="Timer entity"
                    allow-custom-entity
                    @value-changed=${(e) => this._entityValueChanged(e, index)}
                  ></ha-entity-picker>
                ` : html`
                  ${this._tf({ label: "Entity (type while picker loads)", value: entityId, configValue: "entity", change: (e) => this._entityValueChanged(e, index) })}
                `}
                <div class="entity-options advanced">
                  <div class="mode-field">
                      <ha-select label="Mode" naturalMenuWidth fixedMenuPosition .value=${conf.mode || "auto"} .configValue=${"mode"} .options=${SELECT_OPTIONS.entity_mode}
                        @selected=${(e) => { e.stopPropagation(); this._entityValueChanged(e, index); }} @closed=${(e) => e.stopPropagation()}>
                        <mwc-list-item value="auto">Auto (Default)</mwc-list-item>
                        <mwc-list-item value="alexa">Alexa</mwc-list-item>
                        <mwc-list-item value="google">Google Home</mwc-list-item>
                        <mwc-list-item value="timer">Timer</mwc-list-item>
                        <mwc-list-item value="timer_list">Timer list (voice timers)</mwc-list-item>
                        <mwc-list-item value="voice_satellite">Browser voice satellite</mwc-list-item>
                        <mwc-list-item value="count_up">Count up (time since)</mwc-list-item>
                        <mwc-list-item value="voice_pe">Voice PE (legacy)</mwc-list-item>
                        <mwc-list-item value="helper">Helper (input_text/text)</mwc-list-item>
                        <mwc-list-item value="timestamp">Timestamp sensor</mwc-list-item>
                        <mwc-list-item value="minutes_attr">Minutes attribute</mwc-list-item>
                      </ha-select>
                      ${isAuto && detectedMode ? html`
                        <div class="helper-text">
                          Detected mode: <strong>${detectedMode === "unknown" ? "Unknown" : (detectedMode.charAt(0).toUpperCase() + detectedMode.slice(1)).replace(/_/g, " ")}</strong>
                        </div>
                      ` : ""}
                  </div>

                  ${conf.mode === "minutes_attr" || conf.mode === "count_up" || isTimestampMode ? html`<div class="row">
                    ${conf.mode === "minutes_attr" ? html`
                      ${this._tf({ label: "Minutes attribute", value: conf.minutes_attr, configValue: "minutes_attr", change: (e) => this._entityValueChanged(e, index) })}
                    ` : ""}
                    ${conf.mode === "count_up" ? html`
                      ${this._tf({ label: "Goal (optional)", value: conf.goal, configValue: "goal", placeholder: "3h", helper: "Shows progress and turns the row amber once this much time has passed.", change: (e) => this._entityValueChanged(e, index) })}
                      ${this._tf({ label: "Timestamp attribute (optional)", value: conf.attribute, configValue: "attribute", helper: "Read the start time from this attribute instead of the state.", change: (e) => this._entityValueChanged(e, index) })}
                    ` : ""}

                    ${isTimestampMode ? html`
                      <ha-entity-picker
                          .hass=${this.hass}
                          .value=${conf.start_time_entity || ""}
                          .configValue=${"start_time_entity"}
                          @value-changed=${(e) => this._entityValueChanged(e, index)}
                          label="Start time entity"
                          allow-custom-entity
                      ></ha-entity-picker>
                    ` : ""}
                  </div>` : ""}

                  ${isTimestampMode ? html`
                    ${this._tf({ label: "Start time attribute (optional)", value: conf.start_time_attr, configValue: "start_time_attr", helper: "Attribute on this entity containing the start timestamp (e.g., 'last_triggered').", change: (e) => this._entityValueChanged(e, index), cls: "advanced" })}
                  ` : ""}

                  <div class="row">
                    ${this._tf({ label: "Name override", value: conf.name, configValue: "name", change: (e) => this._entityValueChanged(e, index) })}
                    <ha-icon-picker label="Icon override" .value=${conf.icon || ""} .configValue=${"icon"} @value-changed=${(e) => this._entityValueChanged(e, index)}></ha-icon-picker>
                  </div>
                  <div class="row">
                    ${this._tf({ label: "Color override", value: conf.color, configValue: "color", change: (e) => this._entityValueChanged(e, index) })}
                    ${this._tf({ label: "Expired message override", value: conf.expired_subtitle, configValue: "expired_subtitle", change: (e) => this._entityValueChanged(e, index) })}
                  </div>

                  <div class="row-actions-label">Custom action buttons (override card-level)</div>
                  ${this._renderButtonsEditor(
                    conf.buttons,
                    (next) => this._setEntityButtons(index, next),
                    (conf.mode && conf.mode !== "auto") ? conf.mode : ((detectedMode && detectedMode !== "unknown") ? detectedMode : null)
                  )}

                  <label class="toggle-row">
                    <ha-switch .checked=${conf.audio_enabled === true} .configValue=${"audio_enabled"} @change=${(e) => this._entityValueChanged(e, index)}></ha-switch>
                    <div class="toggle-text"><span class="toggle-title">Enable entity-specific audio</span></div>
                  </label>

                  ${conf.audio_enabled ? html`
                    <div class="row">
                      ${this._tf({ label: "Audio file URL", value: conf.audio_file_url, configValue: "audio_file_url", change: (e) => this._entityValueChanged(e, index) })}
                      ${this._tf({ label: "Audio repeat count", type: "number", min: "1", max: "10", value: conf.audio_repeat_count ?? 1, configValue: "audio_repeat_count", change: (e) => this._entityValueChanged(e, index) })}
                    </div>
                  ` : ""}

                  ${(conf.mode === "timer" || (isAuto && detectedMode === "timer")) ? html`
                    <div class="advanced">
                    <label class="toggle-row">
                      <ha-switch .checked=${conf.keep_timer_visible_when_idle === true} .configValue=${"keep_timer_visible_when_idle"} @change=${(e) => this._entityValueChanged(e, index)}></ha-switch>
                      <div class="toggle-text"><span class="toggle-title">Keep visible when idle</span></div>
                    </label>
                    <label class="toggle-row">
                      <ha-switch .checked=${conf.hide_timer_actions === true} .configValue=${"hide_timer_actions"} @change=${(e) => this._entityValueChanged(e, index)}></ha-switch>
                      <div class="toggle-text"><span class="toggle-title">Hide action buttons</span></div>
                    </label>
                    </div>
                  ` : ""}
                  ${(conf.mode === "timer_list" || (isAuto && detectedMode === "timer_list")) ? html`
                    <div class="advanced">
                    <label class="toggle-row">
                      <ha-switch .checked=${conf.hide_timer_actions === true} .configValue=${"hide_timer_actions"} @change=${(e) => this._entityValueChanged(e, index)}></ha-switch>
                      <div class="toggle-text"><span class="toggle-title">Hide action buttons</span></div>
                    </label>
                    </div>
                  ` : ""}
                  <div class="advanced">
                    <div class="row-actions-label">Per-row actions (override card-level)</div>
                    <ha-selector
                      .hass=${this.hass}
                      .label=${"Tap action"}
                      .selector=${{ ui_action: { default_action: "none" } }}
                      .value=${conf.tap_action}
                      .configValue=${"tap_action"}
                      @value-changed=${(e) => this._entityValueChanged(e, index)}
                    ></ha-selector>
                    <ha-selector
                      .hass=${this.hass}
                      .label=${"Hold action"}
                      .selector=${{ ui_action: { default_action: "none" } }}
                      .value=${conf.hold_action}
                      .configValue=${"hold_action"}
                      @value-changed=${(e) => this._entityValueChanged(e, index)}
                    ></ha-selector>
                    <ha-selector
                      .hass=${this.hass}
                      .label=${"Double-tap action"}
                      .selector=${{ ui_action: { default_action: "none" } }}
                      .value=${conf.double_tap_action}
                      .configValue=${"double_tap_action"}
                      @value-changed=${(e) => this._entityValueChanged(e, index)}
                    ></ha-selector>
                  </div>

                </div>

                <button class="remove-entity" @click=${() => this._removeEntity(index)} title="Remove entity"><ha-icon icon="mdi:delete"></ha-icon></button>
              </div>
            `;
          })
      }

      <button class="add-button" @click=${this._addEntity}>
        <ha-icon icon="mdi:plus"></ha-icon>
        <span>Add timer entity</span>
      </button>
      ${discoveryContent}
    `;

    const actionsContent = html`
      <p class="hint">
        Supported Home Assistant-style actions. Entity-row actions override card-level. Leave blank to inherit, or pick "No action" to suppress the default. An idle native timer opens its duration editor on tap; set Toggle explicitly for pause/resume on supported timers.
      </p>
      <ha-selector
        .hass=${this.hass}
        .label=${"Tap action"}
        .selector=${{ ui_action: { default_action: "none" } }}
        .value=${this._config?.tap_action}
        .configValue=${"tap_action"}
        @value-changed=${this._detailValueChanged}
      ></ha-selector>
      <ha-selector
        .hass=${this.hass}
        .label=${"Hold action"}
        .selector=${{ ui_action: { default_action: "none" } }}
        .value=${this._config?.hold_action}
        .configValue=${"hold_action"}
        @value-changed=${this._detailValueChanged}
      ></ha-selector>
      <ha-selector
        .hass=${this.hass}
        .label=${"Double-tap action"}
        .selector=${{ ui_action: { default_action: "none" } }}
        .value=${this._config?.double_tap_action}
        .configValue=${"double_tap_action"}
        @value-changed=${this._detailValueChanged}
      ></ha-selector>
      <div class="row-actions-label" style="margin-top:8px;">Custom action buttons</div>
      <p class="hint">Extra icon buttons shown next to the built-in start / pause / cancel controls. Per-entity and per-pinned buttons override these.</p>
      ${this._renderButtonsEditor(this._config?.buttons, (next) => this._setCardButtons(next))}
    `;

    const isSearching = !!this._searchQuery?.trim();
    const panel = (key, header, icon, content, opts = {}) => {
      const expanded = isSearching || !!this._expandedSections?.[key];
      const panelCls = opts.advanced ? "advanced" : "";
      return html`
        <ha-expansion-panel
          class=${panelCls}
          data-section=${key}
          outlined
          ?expanded=${live(expanded)}
          @expanded-changed=${(e) => {
            if (isSearching || e.target !== e.currentTarget) return;
            const value = !!e.detail?.expanded;
            if (!!this._expandedSections?.[key] !== value) this._expandedSections = { ...this._expandedSections, [key]: value };
          }}
        >
          <div slot="header" class="panel-header">
            <ha-icon class="panel-header-icon" icon=${icon}></ha-icon>
            <span class="panel-header-label">${header}</span>
            ${opts.advanced ? html`<span class="advanced-badge">Advanced</span>` : ""}
          </div>
          <div class="panel-body">${content}</div>
        </ha-expansion-panel>
      `;
    };

    return html`
      <div class="editor-toolbar">
        ${this._renderSearchInput()}
        <label class="advanced-toggle" title="Remembered in this browser">
          <span>Advanced</span>
          <ha-switch
            data-editor-advanced
            aria-label="Advanced editor options"
            .checked=${this._showAdvanced}
            @change=${(e) => this._setEditorMode(!!e.target.checked)}
          ></ha-switch>
        </label>
      </div>
      <p class="editor-mode-hint">${isSearching ? "Searching all settings, including advanced options." : this._showAdvanced ? "All settings shown. Switch off Advanced for the essentials." : "Essentials only. Advanced settings stay active when hidden."}</p>
      <p class="hint search-empty" role="status" hidden>No matching settings. Try a section name or enable the related feature first.</p>
      <div class="card-config ${this._showAdvanced ? "show-advanced" : ""} ${isSearching ? "is-searching" : ""}">
        ${panel("entities", "Timer sources", "mdi:format-list-bulleted", entitiesContent)}
        ${panel("storage", "Timer storage", "mdi:database-outline", storageContent)}
        ${panel("appearance", "Appearance", "mdi:palette", html`${appearanceContent}${displayContent}${timeFormatContent}${sortingContent}`)}
        ${panel("input", "Timer input", "mdi:dialpad", inputContent)}
        ${panel("styling", "Icons & colors", "mdi:palette-outline", stylingContent, { advanced: true })}
        ${panel("defaults", "When timers finish", "mdi:timer-check-outline", defaultsContent, { advanced: true })}
        ${panel("pinned", "Pinned timers", "mdi:pin-outline", pinnedContent, { advanced: true })}
        ${this._showActionsPanel() ? panel("timer_actions", "Actions when timers end", "mdi:timer-play-outline", this._renderDeviceTimersEditor(), { advanced: true }) : ""}
        ${panel("audio", "Audio notifications", "mdi:volume-high", audioContent, { advanced: true })}
        ${panel("notify", "Push notifications", "mdi:bell-ring-outline", notifyContent, { advanced: true })}
        ${panel("actions", "Actions", "mdi:gesture-tap", actionsContent, { advanced: true })}
      </div>
    `;
  }

  // === Moving MQTT timers to the integration (v3.0.0) ===

  _mqttMoveSensor() {
    const card = SimpleTimerCard.prototype;
    const def = this._config?.default_timer_entity;
    const legacy = typeof def === "string" && def.startsWith("sensor.") && !card._isCompanionList.call(this, def) ? def : null;
    const sensor = this._config?.mqtt?.sensor_entity || legacy;
    return sensor && this.hass?.states?.[sensor] ? sensor : null;
  }

  // Read straight from the sensor so rendering never publishes anything.
  _mqttTimersWaiting() {
    const sensor = this._mqttMoveSensor();
    const timers = sensor ? this.hass.states[sensor]?.attributes?.timers : null;
    if (!Array.isArray(timers)) return 0;
    const now = Date.now();
    return timers.filter((t) => t && (t.paused ? Number(t.remaining_ms) > 0 : Number(t.end_ts) > now)).length;
  }

  _renderMqttMove() {
    const waiting = this._mqttTimersWaiting();
    if (this._mqttMoveResult != null) {
      return html`<p class="hint">Moved ${this._mqttMoveResult} timer${this._mqttMoveResult === 1 ? "" : "s"} from MQTT to the integration.</p>`;
    }
    if (!waiting) return "";
    return html`
      <div class="mqtt-move">
        <p class="hint">${waiting} timer${waiting === 1 ? " is" : "s are"} still running in MQTT. Move ${waiting === 1 ? "it" : "them"} to the integration, keeping the time left, or let ${waiting === 1 ? "it" : "them"} finish there.</p>
        <button class="add-button" ?disabled=${this._mqttMoving} @click=${() => this._moveMqttTimers()}>
          <ha-icon icon="mdi:swap-horizontal"></ha-icon>
          <span>${this._mqttMoving ? "Moving…" : `Move ${waiting} timer${waiting === 1 ? "" : "s"} from MQTT`}</span>
        </button>
      </div>
    `;
  }

  // Uses a card that is never shown, so the MQTT rules (merging, deletion
  // markers, the relay for non-admins) are the card's own.
  async _moveMqttTimers() {
    const card = SimpleTimerCard.prototype;
    const sensor = this._mqttMoveSensor();
    const companion = Object.keys(this.hass?.states || {}).find((id) => card._isCompanionList.call(this, id));
    if (!sensor || !companion || this._mqttMoving) return;
    this._mqttMoving = true;
    this.requestUpdate();
    let moved = 0;
    try {
      const helper = document.createElement("simple-timer-card");
      const cfg = { ...this._config, storage: "mqtt", mqtt: { ...(this._config.mqtt || {}), sensor_entity: sensor } };
      delete cfg.default_timer_entity;
      helper.setConfig(cfg);
      helper.hass = this.hass;
      // Moving is not a new timer, so MQTT automations should not hear "started".
      helper._publishTimerEvent = () => {};
      const now = Date.now();
      for (const t of helper._loadTimersFromStorage("mqtt")) {
        const ms = t?.paused ? Number(t.remaining_ms) : Number(t?.end_ts) - now;
        if (!(ms > 0)) continue;
        const meta = helper._timerListMetaFromOverrides(t);
        const timerId = await helper._createTimerListTimer(companion, ms, t.name || t.label || "", meta);
        if (timerId == null) continue;
        if (t.paused && timerId) {
          await this.hass.callService(COMPANION_DOMAIN, "pause_timer", { entity_id: companion, timer_id: timerId });
        }
        helper._removeTimerFromStorage(t.id, "mqtt");
        moved += 1;
      }
      await helper._mqttPublishQueue;
    } finally {
      this._mqttMoving = false;
      this._mqttMoveResult = moved;
      this.requestUpdate();
    }
  }

  _getStorageDisplayName(storage) {
    switch (storage) {
      case "timer": return "Native Home Assistant Timer";
      case "timer_list": return "Home Assistant Timer List or Simple Timer Card integration";
      case "integration": return "Simple Timer Card integration";
      case "local": return "Local Browser Storage";
      case "helper": return "Helper Entities";
      case "mqtt": return "MQTT";
      default: return "Unknown";
    }
  }

  _getStorageDescription(storage) {
    switch (storage) {
      case "timer": return "New timers use timer.start on the selected Home Assistant timer entity.";
      case "integration": return "Timers are kept in Home Assistant, so they keep running with no dashboard open, survive restarts and can do something when they end.";
      case "timer_list": return "New timers are created on the selected timer list. On a voice satellite they show and ring on the device. The Simple Timer Card integration keeps them in Home Assistant across restarts.";
      case "local": return "Timers are stored locally in your browser and persist across sessions.";
      case "helper": return "Timers are stored in Home Assistant helper entities (input_text/text).";
      case "mqtt": return "Timers are stored via MQTT for cross-device sync. The selected MQTT sensor or YAML topic configuration is used.";
      default: return "";
    }
  }

  static get styles() {
    return css`
      :host { display: block; }

      .card-config { display: flex; flex-direction: column; gap: 12px; }

      .editor-toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 0 4px;
        margin-bottom: 8px;
      }
      .editor-toolbar .editor-search {
        flex: 1;
        min-width: 0;
        max-width: 320px;
      }
      .row-actions-label {
        font-size: 0.85em;
        color: var(--secondary-text-color);
        font-weight: 500;
        margin-top: 4px;
      }
      .buttons-editor { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
      .button-row { border: 1px solid var(--divider-color); border-radius: 8px; padding: 8px; padding-inline-end: 44px; display: flex; flex-direction: column; gap: 8px; position: relative; }
      .editor-toolbar .advanced-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--primary-text-color);
        flex-shrink: 0;
        cursor: pointer;
      }

      .card-config:not(.show-advanced):not(.is-searching) .advanced { display: none !important; }
      [data-search-hidden], [hidden] { display: none !important; }
      .editor-mode-hint { margin: 0 4px 12px; font-size: 12px; color: var(--secondary-text-color); }
      .search-empty { margin: 16px 4px; }
      .advanced-badge { font-size: 10px; font-weight: 500; color: var(--secondary-text-color); border: 1px solid var(--divider-color); border-radius: 10px; padding: 1px 6px; }
      .settings-group { display: flex; flex-direction: column; gap: 16px; }

      ha-expansion-panel {
        --expansion-panel-summary-padding: 0 16px;
        --expansion-panel-content-padding: 0;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        background: var(--card-background-color);
        overflow: hidden;
      }

      .panel-body {
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .panel-header {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px 0;
      }
      .panel-header-icon {
        --mdc-icon-size: 20px;
        color: var(--secondary-text-color);
        flex-shrink: 0;
      }
      .panel-header-label {
        font-size: 14px;
        font-weight: 500;
        color: var(--primary-text-color);
        flex: 1;
        min-width: 0;
      }

      .row,
      .side-by-side {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .row > *,
      .side-by-side > * { flex: 1 1 150px; min-width: 0; }
      .mode-field { display: flex; flex-direction: column; gap: 4px; }
      .mode-field > ha-select { width: 100%; }
      .finish-action { display: flex; flex-direction: column; gap: 8px; }
      .finish-action > ha-select,
      .finish-action > ha-entity-picker,
      .finish-action > ha-textfield,
      .finish-action > ha-input { width: 100%; }

      /* DO NOT force display:block on these. HA's ha-textfield uses
         :host { display: inline-flex } internally; overriding it breaks its
         internal layout and collapses the field to 0 height when used as a
         flex child of .row / .side-by-side. Flex-column parents already
         stretch their direct children to full width via align-items:stretch. */
      .panel-body > ha-textfield,
      .panel-body > ha-input,
      .panel-body > ha-entity-picker,
      .panel-body > ha-icon-picker,
      .panel-body > ha-select,
      .panel-body > ha-form,
      .entity-options > ha-textfield,
      .entity-options > ha-input,
      .entity-options > ha-entity-picker,
      .entity-options > ha-icon-picker,
      .entity-options > ha-select,
      .entity-options > ha-form { width: 100%; }

      .toggle-row {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 4px 0;
        cursor: pointer;
        user-select: none;
      }
      .toggle-row ha-switch { flex-shrink: 0; }
      .toggle-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
      .toggle-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      .toggle-desc {
        font-size: 12px;
        line-height: 1.4;
        color: var(--secondary-text-color);
        margin-top: 2px;
      }

      .hint {
        font-size: 12px;
        line-height: 1.4;
        color: var(--secondary-text-color);
        margin: 0;
      }
      .hint code {
        background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.08);
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 11px;
      }

      .subsection-title {
        font-weight: 600;
        margin-top: 4px;
        margin-bottom: -4px;
        color: var(--primary-text-color);
        font-size: 0.9rem;
      }

      .divider {
        height: 1px;
        background: var(--divider-color);
        margin: 4px 0;
      }

      .storage-info {
        padding: 12px;
        background: rgba(var(--rgb-primary-text-color), 0.02);
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .storage-label { font-size: 0.9rem; color: var(--primary-text-color); }
      .storage-description { color: var(--secondary-text-color); font-size: 0.8rem; line-height: 1.2; }

      .no-entities {
        text-align: center;
        color: var(--secondary-text-color);
        padding: 16px;
        font-style: italic;
        border: 2px dashed var(--divider-color);
        border-radius: 8px;
      }

      .entity-editor {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 12px;
        padding-inline-end: 48px;
        position: relative;
      }
      .entity-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
      }
      .remove-entity {
        position: absolute;
        top: 6px;
        inset-inline-end: 6px;
        background: var(--error-color, #f44336);
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: white;
      }

      .add-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px 14px;
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font: inherit;
        font-weight: 500;
        align-self: flex-start;
      }
      .add-button:hover { filter: brightness(1.08); }
      .add-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .add-button ha-icon { --mdc-icon-size: 18px; }

      .helper-text {
        font-size: 11px;
        color: var(--secondary-text-color);
        margin-top: 4px;
        margin-inline-start: 4px;
      }
    `;
  }
}

if (!customElements.get("simple-timer-card")) customElements.define("simple-timer-card", SimpleTimerCard);
const stcRegisterEditor = () => { if (!customElements.get("simple-timer-card-editor"))
customElements.define("simple-timer-card-editor", SimpleTimerCardEditor); };
stcRegisterEditor();
window.addEventListener("location-changed", () => { setTimeout(stcRegisterEditor, 100); });

SimpleTimerCard.getConfigElement = function () {
  stcRegisterEditor();
  if (customElements.get("simple-timer-card-editor")) return document.createElement("simple-timer-card-editor");
  const placeholder = document.createElement("div");
  placeholder.innerHTML = "Loading editor...";
  const checkInterval = setInterval(() => {
    if (customElements.get("simple-timer-card-editor")) {
      clearInterval(checkInterval);
      const editor = document.createElement("simple-timer-card-editor");
      placeholder.replaceWith(editor);
      if (placeholder._config) editor.setConfig(placeholder._config);
      if (placeholder._hass) editor.hass = placeholder._hass;
    }
  }, 100);
  const originalSetConfig = placeholder.setConfig;
  placeholder.setConfig = function (config) {
    placeholder._config = config;
    if (originalSetConfig) originalSetConfig.call(placeholder, config);
  };
  Object.defineProperty(placeholder, "hass", {
    set: function (hass) { placeholder._hass = hass; },
    get: function () { return placeholder._hass; }
  });
  return placeholder;
};

setTimeout(() => {
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "simple-timer-card",
    name: "Simple Timer Card",
    preview: true,
    description: "Pick a layout (horizontal/vertical) and a style (progress bar/background fill). Uses HA theme & native elements.",
    editor: "simple-timer-card-editor",
    getEntitySuggestion: (hass, entityId) => {
      if (!entityId || typeof entityId !== "string") return null;
      const [domain, objectId] = entityId.split(".");
      if (domain !== "timer" && !(objectId || "").toLowerCase().includes("timer")) return null;
      return { config: { type: "custom:simple-timer-card", entities: [entityId] } };
    },
  });
}, 0);
