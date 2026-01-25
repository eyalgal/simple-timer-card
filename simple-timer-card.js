/*
 * Simple Timer Card
 *
 * A versatile and highly customizable timer card for Home Assistant Lovelace, offering multiple display styles and support for various timer sources.
 *
 * Author: eyalgal
 * License: MIT
 * Version: 2.1.0
 * For more information, visit: https:
 */

import { LitElement, html, css } from "https://unpkg.com/lit@3.1.0/index.js?module";

const cardVersion="2.1.0";

const DAY_IN_MS = 86400000;
const YEAR_IN_MS = 365 * DAY_IN_MS;
const HOUR_IN_SECONDS = 3600;
const MINUTE_IN_SECONDS = 60;
const DAY_IN_SECONDS = 86400;

const TRANSLATIONS = {
  en: {
    no_timers: "No Timers",
    click_to_start: "Click to start",
    no_active_timers: "No Active Timers",
    active_timers: "Active Timers",
    add: "Add",
    custom: "Custom",
    cancel: "Cancel",
    save: "Save",
    start: "Start",
    snooze: "Snooze",
    dismiss: "Dismiss",
    ready: "Ready",
    paused: "Paused",
    times_up: "Time's up!",
    timer: "Timer",
    hour_ago: "hour ago",
    hours_ago: "hours ago",
    minute_ago: "minute ago",
    minutes_ago: "minutes ago",
    second_ago: "second ago",
    seconds_ago: "seconds ago",
    h: "h", m: "m", s: "s", d: "d",
    w_short: "w", mo_short: "mo", y_short: "y",
    day: "day", days: "days", week: "week", weeks: "weeks",
    month: "month", months: "months", year: "year", years: "years",
    hour: "hour", hours: "hours", minute: "minute", minutes: "minutes",
    second: "second", seconds: "seconds",
  },
  de: {
    no_timers: "Keine Timer",
    click_to_start: "Zum Starten klicken",
    no_active_timers: "Keine aktiven Timer",
    active_timers: "Aktive Timer",
    add: "Hinzufügen",
    custom: "Benutzerdefiniert",
    cancel: "Abbrechen",
    save: "Speichern",
    start: "Starten",
    snooze: "Schlummern",
    dismiss: "Verwerfen",
    ready: "Bereit",
    paused: "Pausiert",
    times_up: "Zeit abgelaufen!",
    timer: "Timer",
    hour_ago: "Stunde her",
    hours_ago: "Stunden her",
    minute_ago: "Minute her",
    minutes_ago: "Minuten her",
    second_ago: "Sekunde her",
    seconds_ago: "Sekunden her",
    h: "h", m: "m", s: "s", d: "T",
    w_short: "W", mo_short: "Mo", y_short: "J",
    day: "Tag", days: "Tage", week: "Woche", weeks: "Wochen",
    month: "Monat", months: "Monate", year: "Jahr", years: "Jahre",
    hour: "Stunde", hours: "Stunden", minute: "Minute", minutes: "Minuten",
    second: "Sekunde", seconds: "Sekunden",
  },
  es: {
    no_timers: "Sin Temporizadores",
    click_to_start: "Clic para iniciar",
    no_active_timers: "Sin Temporizadores Activos",
    active_timers: "Temporizadores Activos",
    add: "Añadir",
    custom: "Personalizado",
    cancel: "Cancelar",
    save: "Guardar",
    start: "Iniciar",
    snooze: "Posponer",
    dismiss: "Descartar",
    ready: "Listo",
    paused: "Pausado",
    times_up: "¡Se acabó el tiempo!",
    timer: "Temporizador",
    hour_ago: "hora atrás",
    hours_ago: "horas atrás",
    minute_ago: "minuto atrás",
    minutes_ago: "minutos atrás",
    second_ago: "segundo atrás",
    seconds_ago: "segundos atrás",
    h: "h", m: "m", s: "s", d: "d",
    w_short: "sem", mo_short: "mes", y_short: "a",
    day: "día", days: "días", week: "semana", weeks: "semanas",
    month: "mes", months: "meses", year: "año", years: "años",
    hour: "hora", hours: "horas", minute: "minuto", minutes: "minutos",
    second: "segundo", seconds: "segundos",
  },
  da: {
    no_timers: "Ingen timere",
    click_to_start: "Tryk for at starte",
    no_active_timers: "Ingen aktive timere",
    active_timers: "Aktive Timere",
    add: "Tilføj",
    custom: "Tilpasset",
    cancel: "Annuller",
    save: "Gem",
    start: "Start",
    snooze: "Snooze",
    dismiss: "Afvis",
    ready: "Klar",
    paused: "På pause",
    times_up: "Tid udløbet!",
    timer: "Timer",
    hour_ago: "time siden",
    hours_ago: "timer siden",
    minute_ago: "minut siden",
    minutes_ago: "minutter siden",
    second_ago: "sekund siden",
    seconds_ago: "sekunder siden",
    h: "t", m: "m", s: "s", d: "d",
    w_short: "u", mo_short: "må", y_short: "å",
    day: "dag", days: "dage", week: "uge", weeks: "uger",
    month: "måned", months: "måneder", year: "år", years: "år",
    hour: "time", hours: "timer", minute: "minut", minutes: "minutter",
    second: "sekund", seconds: "sekunder",
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
      _editingTimerId: { state: true },
      _editDuration: { state: true },
    };
  }

  static getStubConfig() {
    return { type: "custom:simple-timer-card" };
  }

  _sanitizeText(text) {
    if (!text || typeof text !== "string") return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.textContent;
  }

  _localize(key) {
    const lang = this._config?.language || "en";
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS["en"][key] || key;
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
      if (timer.label && typeof timer.label !== "string") return false;
      if (timer.duration && typeof timer.duration !== "number") return false;
      if (timer.end && typeof timer.end !== "number") return false;
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
    this._ui = {
      noTimerHorizontalOpen: false,
      noTimerVerticalOpen: false,
      activeFillOpen: false,
      activeBarOpen: false,
    };
    this._customSecs = { horizontal: 15 * 60, vertical: 15 * 60 };
    this._activeSecs = { fill: 10 * 60, bar: 10 * 60 };
    this._showingCustomName = {};
    this._lastSelectedName = {};
    this._storageNamespace = "default";
    this._editingTimerId = null;
    this._editDuration = { h: 0, m: 0, s: 0 };
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
    c.minute_buttons = this._normalizeNumberList(c.minute_buttons, Array.isArray(c.minute_buttons) ? c.minute_buttons : []);
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
    const isMqtt = config.default_timer_entity && config.default_timer_entity.startsWith("sensor.");
    const autoStorage = isMqtt ? "mqtt" : "local";
    const mqttSensorEntity = isMqtt ? config.default_timer_entity : null;
    const mqttConfig = {
      topic: "simple_timer_card/timers",
      state_topic: "simple_timer_card/timers/state",
      events_topic: "simple_timer_card/events",
      sensor_entity: mqttSensorEntity,
      ...config.mqtt,
    };
    const layout = (config.layout || "horizontal").toLowerCase() === "vertical" ? "vertical" : "horizontal";
    const validStyles = ["fill_vertical", "fill_horizontal", "bar_vertical", "bar_horizontal", "circle"];
    const style = validStyles.includes((config.style || "").toLowerCase()) ? (config.style || "").toLowerCase() : "bar_horizontal";
    const progressModeOptions = ["drain", "fill", "milestones"];
    const progressMode = progressModeOptions.includes(config.progress_mode) ? config.progress_mode : "drain";
    this._storageNamespace = config.storage_namespace || config.default_timer_entity || "default";
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
      language: "en",
      snooze_duration: 5,
      timer_presets: [5, 15, 30],
      timer_name_presets: [],
      pinned_timers: [],
      show_timer_presets: true,
      show_active_header: true,
      minute_buttons: [1, 5, 10],
      default_timer_icon: "mdi:timer-outline",
      default_timer_color: "var(--primary-color)",
      default_timer_entity: null,
      auto_voice_pe: false,
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
    };
    const defaultDurationSecs = (parseInt(this._config.default_new_timer_duration_mins, 10) || 15) * 60;
    this._customSecs = { horizontal: defaultDurationSecs, vertical: defaultDurationSecs };
    this._activeSecs = { fill: defaultDurationSecs, bar: defaultDurationSecs };
    if (typeof this._config.timer_name_presets === "string") {
      this._config.timer_name_presets = this._config.timer_name_presets.split(",").map((name) => name.trim()).filter((name) => name);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this._startTimerUpdates();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopTimerUpdates();
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
      const data = { timers: timers || [], version: 1, lastUpdated: Date.now() };
      localStorage.setItem(this._getStorageKey(), JSON.stringify(data));
    } catch (e) {}
  }

  _updateTimerInStorage_local(timerId, updates) {
    const timers = this._loadTimersFromStorage_local();
    const index = timers.findIndex((t) => t.id === timerId);
    if (index !== -1) {
      timers[index] = { ...timers[index], ...updates };
      this._saveTimersToStorage_local(timers);
    }
  }

  _removeTimerFromStorage_local(timerId) {
    const timers = this._loadTimersFromStorage_local().filter((t) => t.id !== timerId);
    this._saveTimersToStorage_local(timers);
  }

  _loadTimersFromStorage_mqtt() {
    try {
      const sensor = this._config?.mqtt?.sensor_entity;
      if (!sensor) return [];
      const entity = this.hass?.states?.[sensor];
      const timers = entity?.attributes?.timers;
      return Array.isArray(timers) ? timers : [];
    } catch (e) {
      return [];
    }
  }

  _saveTimersToStorage_mqtt(timers) {
    try {
      const payload = { timers: timers || [], version: 1, lastUpdated: Date.now() };
      this.hass.callService("mqtt", "publish", {
        topic: this._config?.mqtt?.topic,
        payload: JSON.stringify(payload),
        retain: true,
      });
      this.hass.callService("mqtt", "publish", {
        topic: this._config?.mqtt?.state_topic,
        payload: JSON.stringify({ version: payload.version, t: payload.lastUpdated }),
        retain: true,
      });
    } catch (e) {}
  }

  _updateTimerInStorage_mqtt(timerId, updates) {
    const timers = this._loadTimersFromStorage_mqtt();
    const index = timers.findIndex((t) => t.id === timerId);
    if (index !== -1) {
      timers[index] = { ...timers[index], ...updates };
      this._saveTimersToStorage_mqtt(timers);
    }
  }

  _removeTimerFromStorage_mqtt(timerId) {
    const timers = this._loadTimersFromStorage_mqtt().filter((t) => t.id !== timerId);
    this._saveTimersToStorage_mqtt(timers);
  }

  _loadTimersFromStorage(sourceHint = null) {
    const storage = sourceHint || this._config.storage;
    const timers =
      storage === "mqtt"
        ? this._loadTimersFromStorage_mqtt()
        : (storage === "local" ? this._loadTimersFromStorage_local() : []);
    if (!Array.isArray(timers)) return [];
    return timers.map((t) => {
      if (!t || typeof t !== "object") return t;
      const hasOtherAudioFields =
        t.audio_file_url !== undefined ||
        t.audio_repeat_count !== undefined ||
        t.audio_play_until_dismissed !== undefined;
      if (t.audio_enabled === false && !hasOtherAudioFields) {
        const c = { ...t };
        delete c.audio_enabled;
        return c;
      }
      return t;
    });
  }

  _saveTimersToStorage(timers, sourceHint = null) {
    const storage = sourceHint || this._config.storage;
    if (storage === "mqtt") return this._saveTimersToStorage_mqtt(timers);
    if (storage === "local") return this._saveTimersToStorage_local(timers);
  }

  _updateTimerInStorage(timerId, updates, sourceHint = null) {
    const storage = sourceHint || this._config.storage;
    if (storage === "mqtt") return this._updateTimerInStorage_mqtt(timerId, updates);
    if (storage === "local") return this._updateTimerInStorage_local(timerId, updates);
  }

  _removeTimerFromStorage(timerId, sourceHint = null) {
    const storage = sourceHint || this._config.storage;
    if (storage === "mqtt") return this._removeTimerFromStorage_mqtt(timerId);
    if (storage === "local") return this._removeTimerFromStorage_local(timerId);
  }

  _addTimerToStorage(timer) {
    const storage = timer.source || this._config.storage;
    const timers = this._loadTimersFromStorage(storage);
    timers.push(timer);
    this._saveTimersToStorage(timers, storage);
  }

  _detectMode(entityId, entityState, entityConf) {
    if (!entityState) return null;
    if (entityId.startsWith("timer.")) return "timer";
    if (entityId.startsWith("input_text.") || entityId.startsWith("text.")) return "helper";
    const attrs = entityState.attributes || {};
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
    if (!this.hass) return;
    this._ensureAutoVoicePEEntities();
    const collected = [];
    for (const entityConfig of this._config.entities) {
      const entityId = typeof entityConfig === "string" ? entityConfig : entityConfig.entity;
      const conf = typeof entityConfig === "string" ? {} : entityConfig;
      const st = this.hass.states[entityId];
      if (!st) continue;
      let mode = conf.mode;
      if (!mode || mode === "auto") {
        mode = this._detectMode(entityId, st, conf);
        if (!mode) continue;
      }
      try {
        if (mode === "alexa") collected.push(...this._parseAlexa(entityId, st, conf));
        else if (mode === "helper") collected.push(...this._parseHelper(entityId, st, conf));
        else if (mode === "timer") collected.push(...this._parseTimer(entityId, st, conf));
        else if (mode === "voice_pe") collected.push(...this._parseVoicePE(entityId, st, conf));
        else if (mode === "minutes_attr") collected.push(...this._parseMinutesAttr(entityId, st, conf));
        else if (mode === "timestamp") collected.push(...this._parseTimestamp(entityId, st, conf));
      } catch (e) {}
    }
    if (this._config.storage === "local" || this._config.storage === "mqtt") {
      collected.push(...this._loadTimersFromStorage());
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
      else if (t.idle) remainingMs = durationMs;
      else if (t.finished) remainingMs = 0;
      else if (t.paused) remainingMs = (typeof t.remaining_ms === "number" ? t.remaining_ms : (typeof t.end === "number" ? t.end : 0));
      else if (endTs) remainingMs = Math.max(0, endTs - now3);
      else remainingMs = 0;

      const state =
        t.state ||
        (t.finished ? "finished" : (t.idle ? "idle" : (t.paused ? "paused" : (remainingMs <= 0 ? "expired" : "active"))));

      const supports =
        t.supports || {
          pause: ["helper", "local", "mqtt", "timer"].includes(t.source),
          cancel: ["helper", "local", "mqtt", "timer", "alexa"].includes(t.source),
          snooze: ["helper", "local", "mqtt", "timer", "alexa"].includes(t.source),
          extend: ["helper", "local", "mqtt", "timer"].includes(t.source),
        };

      const percent = durationMs && remainingMs >= 0
        ? Math.max(0, Math.min(100, ((durationMs - remainingMs) / durationMs) * 100))
        : 0;

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
    for (const timer of this._timers) {
      const wasRinging = this._ringingTimers.has(timer.id);
      if (timer.source === "timer" && timer.idle && wasRinging) {
        timer.idle = false;
        timer.remaining = 0;
      }
      const isNowRinging = timer.remaining <= 0 && !timer.paused && !timer.idle;
      if (isNowRinging && !wasRinging) {
        this._ringingTimers.add(timer.id);
        this._playAudioNotification(timer.id, timer);
        this._publishTimerEvent("expired", timer);
      } else if (!isNowRinging && wasRinging) {
        this._ringingTimers.delete(timer.id);
        this._stopAudioForTimer(timer.id);
      }
    }
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
      if (timer.idle || timer.remaining > 0 || timer.paused) continue;
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
if (!audioEnabled || !audioFileUrl || !this._validateAudioUrl(audioFileUrl)) return;
    this._stopAudioForTimer(timerId);
    try {
      const audio = new Audio(audioFileUrl);
      let playCount = 0;
      const maxPlays = audioPlayUntilDismissed ? Infinity : Math.max(1, Math.min(10, audioRepeatCount || 1));
      const playNext = () => {
        if (this._ringingTimers.has(timerId) && playCount < maxPlays) {
          playCount++;
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          this._stopAudioForTimer(timerId);
        }
      };
      const audioData = { audio, playNext };
      audio.addEventListener("ended", playNext);
      audio.addEventListener("error", () => this._stopAudioForTimer(timerId));
      this._activeAudioInstances.set(timerId, audioData);
      playNext();
    } catch (e) {}
  }

  _stopAudioForTimer(timerId) {
    const audioData = this._activeAudioInstances.get(timerId);
    if (audioData) {
      const { audio, playNext } = audioData;
      audio.removeEventListener("ended", playNext);
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
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
    if (this._config.storage === "mqtt" || this._config.default_timer_entity?.startsWith("sensor.")) {
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

      this.hass.callService("mqtt", "publish", {
        topic: `${this._config?.mqtt?.events_topic || "simple_timer_card/events"}/${event}`,
        payload: JSON.stringify(payload),
        retain: false,
      });
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
    mutator(data);
    const domain = entityId.split(".")[0];
    this.hass.callService(domain, "set_value", { entity_id: entityId, value: JSON.stringify({ ...data, version: 1 }) });
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
    const endTime = Date.now() + durationMs;
    const newTimer = {
      id: `custom-${Date.now()}`,
      label: this._sanitizeText(label || this._localize("timer")),
      icon: this._config.default_timer_icon || "mdi:timer-outline",
      color: this._config.default_timer_color || "var(--primary-color)",
      end: endTime,
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
        end: now + durationMs,
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

  _createPresetTimer(preset, entity = null, overrides = {}) {
    const durationMs = this._parseDurationInputToMs(preset);
    if (!durationMs) return;

    const label = overrides.label || (() => {
      const raw = typeof preset === "string" ? preset.trim().toLowerCase() : preset;
      if (typeof raw === "string" && raw.endsWith("s")) {
        const seconds = parseInt(raw.slice(0, -1), 10);
        return `${seconds}s ${this._localize("timer")}`;
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
      ...(overrides.audio_enabled !== undefined ? { audio_enabled: overrides.audio_enabled } : {}),
      ...(overrides.audio_file_url !== undefined ? { audio_file_url: overrides.audio_file_url } : {}),
      ...(overrides.audio_repeat_count !== undefined ? { audio_repeat_count: overrides.audio_repeat_count } : {}),
      ...(overrides.audio_play_until_dismissed !== undefined ? { audio_play_until_dismissed: overrides.audio_play_until_dismissed } : {}),

      icon: overrides.icon || this._config.default_timer_icon || "mdi:timer-outline",
      color: overrides.color || this._config.default_timer_color || "var(--primary-color)",
      end: now + durationMs,
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

    this._publishTimerEvent("paused", timer);
    if (timer.source === "helper") {
      const remaining = timer.remaining;
      this._mutateHelper(timer.source_entity, (data) => {
        const idx = data.timers.findIndex((t) => t.id === timer.id);
        if (idx !== -1) { data.timers[idx].paused = true; data.timers[idx].end = remaining; }
      });
    } else if (["local", "mqtt"].includes(timer.source)) {
      const remaining = timer.remaining;
      this._updateTimerInStorage(timer.id, { paused: true, end: remaining }, timer.source);
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

    this._publishTimerEvent("resumed", timer);
    if (timer.source === "helper") {
      const newEndTime = Date.now() + timer.remaining;
      this._mutateHelper(timer.source_entity, (data) => {
        const idx = data.timers.findIndex((t) => t.id === timer.id);
        if (idx !== -1) { data.timers[idx].paused = false; data.timers[idx].end = newEndTime; }
      });
    } else if (["local", "mqtt"].includes(timer.source)) {
      const newEndTime = Date.now() + timer.remaining;
      this._updateTimerInStorage(timer.id, { paused: false, end: newEndTime }, timer.source);
      this.requestUpdate();
    } else if (timer.source === "timer") {
      this.hass.callService("timer", "start", { entity_id: timer.source_entity });
    } else {
      this._toast("This timer can't be resumed from here.");
    }
  }

  _togglePause(t, e) {
    e?.stopPropagation?.();
    if (!["helper", "local", "mqtt", "timer"].includes(t.source)) return;
    t.paused ? this._handleResume(t) : this._handlePause(t);
  }

  _handleDismiss(timer) {
    this._ringingTimers.delete(timer.id);
    this._stopAudioForTimer(timer.id);
    if (timer.source === "helper") {
      this._mutateHelper(timer.source_entity, (data) => { data.timers = data.timers.filter((t) => t.id !== timer.id); });
    } else if (["local", "mqtt"].includes(timer.source)) {
      this._removeTimerFromStorage(timer.id, timer.source); this.requestUpdate();
    } else if (timer.source === "timer") {
      this.hass.callService("timer", "finish", { entity_id: timer.source_entity });
    } else {
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
    if (timer.source === "helper") {
      const now = Date.now();
      this._mutateHelper(timer.source_entity, (data) => {
        const idx = data.timers.findIndex((t) => t.id === timer.id);
        if (idx !== -1) {
          data.timers[idx].start_ts = now;
          data.timers[idx].end_ts = newEndTime;
          data.timers[idx].end = newEndTime;
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
          end: newEndTime,
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

  _formatTimeAgo(ms) {
    if (ms < 1000) return null;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return hours === 1 ? `1 ${this._localize("hour_ago")}` : `${hours} ${this._localize("hours_ago")}`;
    if (minutes > 0) return minutes === 1 ? `1 ${this._localize("minute_ago")}` : `${minutes} ${this._localize("minutes_ago")}`;
    return seconds === 1 ? `1 ${this._localize("second_ago")}` : `${seconds} ${this._localize("seconds_ago")}`;
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
    this._ui[openKey] = !this._ui[openKey];
    this.requestUpdate();
  }

  _parseAdjustmentToSeconds(value) {
    let seconds = 0;
    if (typeof value === "string" && value.toLowerCase().endsWith("s")) {
      const parsedSeconds = parseInt(value.slice(0, -1), 10);
      if (!isNaN(parsedSeconds)) seconds = parsedSeconds;
    } else {
      const parsedMinutes = parseInt(value, 10);
      if (!isNaN(parsedMinutes)) seconds = parsedMinutes * 60;
    }
    return seconds;
  }

  _adjust(which, value, sign = +1) {
    const delta = this._parseAdjustmentToSeconds(value);
    this._customSecs = { ...this._customSecs, [which]: Math.max(0, this._customSecs[which] + sign * delta) };
  }

  _createAndSaveTimer(secs, label) {
    if (this._isActionThrottled("create_timer", "global", 500)) return;
    if (secs <= 0) return;
    const validation = this._validateTimerInput(secs * 1000, label);
    if (!validation.valid) return;
    const finalLabel = label && label.trim() ? this._sanitizeText(label.trim()) : this._formatTimerLabel(secs);
    const newTimer = {
      id: `custom-${Date.now()}`,
      label: finalLabel,
      icon: this._config.default_timer_icon || "mdi:timer-outline",
      color: this._config.default_timer_color || "var(--primary-color)",
      end: Date.now() + secs * 1000,
      duration: secs * 1000,
      paused: false,
    };
    let targetEntity = this._config.default_timer_entity;
    if (this._config.auto_voice_pe === true) {
      const vpeEntity = this._getDefaultVoicePETargetEntity();
      if (vpeEntity) targetEntity = vpeEntity;
    }
    const hasVoicePEControl = !!this._getVoicePEControlEntity(targetEntity);
    if (hasVoicePEControl) {

      const userProvidedName = !!(label && String(label).trim());
      const nameForCommand = userProvidedName ? String(label).trim() : "";
      this._sendVoicePEStart(secs * 1000, nameForCommand, targetEntity);
      this.requestUpdate();
      return;
    }

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
      this._publishTimerEvent("started", newTimer);
    } else {
      newTimer.source = this._config.storage;
      newTimer.source_entity = this._config.storage === "mqtt" ? this._config.mqtt.sensor_entity : "local";
      this._addTimerToStorage(newTimer);
      this._publishTimerEvent("started", newTimer);
    }
  }

  _startFromCustom(which, label) {
    const secs = this._customSecs[which];
    const inputId = which === "horizontal" ? "nt-h-name" : "nt-v-name";
    let finalLabel = label || this._lastSelectedName[inputId] || "";
    const input = this.shadowRoot?.getElementById(inputId);
    if (input && input.value) finalLabel = input.value.trim();
    this._createAndSaveTimer(secs, finalLabel);
    const defaultDurationSecs = (parseInt(this._config.default_new_timer_duration_mins, 10) || 15) * 60;
    this._customSecs = { ...this._customSecs, [which]: defaultDurationSecs };
    const openKey = `noTimer${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    this._ui[openKey] = false;
    this._showingCustomName[inputId] = false;
    this._lastSelectedName[inputId] = null;
    if (input) input.value = "";
    this.requestUpdate();
  }

  _startActive(which, label) {
    const secs = this._activeSecs[which];
    const inputId = which === "bar" ? "add-bar-name" : "add-fill-name";
    let finalLabel = label || this._lastSelectedName[inputId] || "";
    const input = this.shadowRoot?.getElementById(inputId);
    if (input && input.value) finalLabel = input.value.trim();
    this._createAndSaveTimer(secs, finalLabel);
    const defaultDurationSecs = (parseInt(this._config.default_new_timer_duration_mins, 10) || 15) * 60;
    this._activeSecs = { ...this._activeSecs, [which]: defaultDurationSecs };
    const openKey = `active${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    this._ui[openKey] = false;
    this._showingCustomName[inputId] = false;
    this._lastSelectedName[inputId] = null;
    if (input) input.value = "";
    this.requestUpdate();
  }

  _toggleActivePicker(which) {
    const openKey = `active${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    this._ui[openKey] = !this._ui[openKey];
    this.requestUpdate();
  }

  _adjustActive(which, value, sign = +1) {
    const delta = this._parseAdjustmentToSeconds(value);
    this._activeSecs = { ...this._activeSecs, [which]: Math.max(0, this._activeSecs[which] + sign * delta) };
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
    const isCircle = style === "circle";
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
      const displayLabel = (typeof val === "string" && val.toLowerCase().endsWith("s"))
        ? val.toLowerCase()
        : `${val}${this._localize("m")}`;

      return html`
        <button class="btn btn-ghost ${isClickable ? "" : "disabled"}"
                @click=${() => isClickable && this._adjustEditTotal(sign * delta)}>
          ${isNegative ? "-" : "+"}${displayLabel}
        </button>
      `;
    });

    return html`
      <li class="${baseClasses}" style="--tcolor:${t.color || "var(--primary-color)"}; cursor: default;">
        <div class="editor-container">
          <div class="buttons-grid">
            ${renderAdjustButtons(+1)}
          </div>

          <div class="display">${this._formatDuration(totalSeconds, "seconds")}</div>

          <div class="buttons-grid">
            ${renderAdjustButtons(-1)}
          </div>

          <input class="text-input" placeholder="Timer Name (Optional)" readonly style="margin-top: 12px;"
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
    const { isPaused, isIdle, isFinished, color, icon, ring, pct, pctLeft, isCircleStyle, isFillStyle, supportsPause, supportsManualControls, timeStr, circleValues, supportsReadOnlyDismiss } = state;
    const baseClasses = isFillStyle ? "card item" : (isCircleStyle ? "item vtile" : "item bar");
    const finishedClasses = isFillStyle ? "card item finished" : (isCircleStyle ? "item vtile" : "card item bar");

    const isRunning = !t.idle && !t.paused && !t.finished;
    const canEdit = t.source === "timer" && !isRunning;

    if (ring) {
      if (isCircleStyle) {
        return html`
          <li class="${finishedClasses}" style="--tcolor:${color}">
            <div class="vcol">
              <div class="vcircle-wrap">
                <svg class="vcircle" width="64" height="64" viewBox="0 0 64" aria-hidden="true">
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
                  <button class="chip" @click=${() => this._handleSnooze(t)}>${this._localize("snooze")}</button>
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
        <li class="${finishedClasses}" style="--tcolor:${color}">
          ${isFillStyle ? html`<div class="progress-fill" style="width:100%"></div>` : ""}
          <div class="${isFillStyle ? "card-content" : "row"}">
            <div class="icon-wrap"><ha-icon .icon=${icon}></ha-icon></div>
            <div class="info">
              <div class="title">${t.label}</div>
              <div class="status up">${timeStr}</div>
            </div>
            ${supportsManualControls ? html`
              <div class="chips">
                <button class="chip" @click=${() => this._handleSnooze(t)}>${this._localize("snooze")}</button>
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

    const clickHandler = canEdit ? () => this._openTimerEditor(t) : null;
    const rowStyle = canEdit ? "cursor: pointer;" : "";

    const fillPct = this._config.progress_mode === "drain" ? pctLeft : pct;
    const fillInlineStyle = `width:${fillPct}%;`;

    if (isFillStyle) {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @click=${clickHandler}>
          <div class="progress-fill" style="${fillInlineStyle}"></div>
          <div class="card-content">
            <div class="icon-wrap"><ha-icon .icon=${icon}></ha-icon></div>
            <div class="info">
              <div class="title">${t.label}</div>
              <div class="status">${timeStr}</div>
            </div>
            <div class="actions" @click=${(e) => e.stopPropagation()}>
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
    } else if (isCircleStyle) {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @click=${clickHandler}>
          ${supportsManualControls && !isIdle ? html`
            <button class="vtile-close" title="${this._localize("cancel")}"
              @click=${(e)=>{ e.stopPropagation(); this._handleCancel(t); }}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          ` : ""}
          <div class="vcol">
            <div class="vcircle-wrap"
                 title="${isIdle ? "Start" : (t.paused ? "Resume" : "Pause")}"
                 @click=${(e)=> {
                   e.stopPropagation();
                   if (isIdle && supportsManualControls) this._handleStart(t);
                   else if (supportsPause && supportsManualControls) this._togglePause(t, e);
                 }}>
              <svg class="vcircle" width="64" height="64" viewBox="0 0 64" aria-hidden="true">
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
        <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @click=${clickHandler}>
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
    const color = isPaused ? "var(--warning-color)" : (isFinished ? "var(--success-color)" : (t.color || "var(--primary-color)"));
    const icon = isIdle ? (t.icon || "mdi:timer-outline") : (isPaused ? "mdi:timer-pause" : (isFinished ? "mdi:timer-check" : (t.icon || "mdi:timer-outline")));
    const ring = t.remaining <= 0 && !isIdle && !isFinished;
    const pct = typeof t.percent === "number" ? Math.max(0, Math.min(100, t.percent)) : 0;
    const pctLeft = 100 - pct;
    const isCircleStyle = style === "circle";
    const isFillStyle = style.startsWith("fill_");
    const supportsPause = ["helper", "local", "mqtt", "timer"].includes(t.source) || (t.source === "voice_pe" && !!(t.control_entity && String(t.control_entity).trim() && t.voice_pe_timer_id && String(t.voice_pe_timer_id).trim()));
    const entityConf = this._getEntityConfig(t.source_entity);
    const hideTimerActions = entityConf?.hide_timer_actions === true;
    const isTimerSource = t.source === "timer";
    const supportsManualControls = (((["local", "mqtt", "timer", "helper"].includes(t.source)) || t.kind === "template" || t.source === "template") && !(isTimerSource && hideTimerActions)) || (t.source === "voice_pe" && !!(t.control_entity && String(t.control_entity).trim()));
    const supportsReadOnlyDismiss = ring && ["timestamp", "minutes_attr", "alexa"].includes(t.source);
    let timeStr;
    if (isIdle) timeStr = t.duration ? this._formatDuration(t.duration, "ms") : this._localize("ready");
    else if (isPaused) timeStr = `${this._formatDuration(t.remaining, "ms")} (${this._localize("paused")})`;
    else if (isFinished) {
      const now = Date.now();
      const elapsedSinceFinish = now - (t.finishedAt || t.end || now);
      const elapsedStr = this._formatTimeAgo(elapsedSinceFinish);
      const expiredMessage = t.expired_subtitle || entityConf?.expired_subtitle || this._config.expired_subtitle || this._localize("times_up");
      timeStr = elapsedStr ? `${expiredMessage} - ${elapsedStr}` : expiredMessage;
    } else if (ring) {
      timeStr = t.expired_subtitle || entityConf?.expired_subtitle || this._config.expired_subtitle || this._localize("times_up");
    } else {
      timeStr = this._formatTimeString(t);
    }
    let circleValues;
    if (isCircleStyle) {
      const progressMode = this._config.progress_mode === "drain" ? "drain" : "fill";
      circleValues = this._calculateCircleValues(28, pct, progressMode);
    }
    return {
      isPaused, isIdle, isFinished, color, icon, ring, pct, pctLeft,
      isCircleStyle, isFillStyle,
      supportsPause, supportsManualControls, timeStr,
      circleValues, supportsReadOnlyDismiss
    };
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
      const displayLabel = typeof val === "string" && val.toLowerCase().endsWith("s") ? val.toLowerCase() : `${val}${this._localize("m")}`;
      return html`
        <button class="btn btn-ghost ${isClickable ? "" : "disabled"}"
                @click=${() => isClickable && adjustFunction(whichKey, val, sign)}>
          ${isNegative ? "-" : "+"}${displayLabel}
        </button>
      `;
    });
  }

  _renderItemVertical(t, style) {
    if (this._editingTimerId === t.id) {
        return this._renderInlineEditor(t, style);
    }
    const state = this._getTimerRenderState(t, style);
    const { isPaused, isIdle, isFinished, color, icon, ring, pct, pctLeft, isCircleStyle, isFillStyle, supportsPause, supportsManualControls, timeStr, circleValues, supportsReadOnlyDismiss } = state;
    const baseClasses = style.startsWith("fill_") ? "card item vtile" : "item vtile";

    const isRunning = !t.idle && !t.paused && !t.finished;
    const canEdit = t.source === "timer" && !isRunning;
    const clickHandler = canEdit ? () => this._openTimerEditor(t) : null;
    const rowStyle = canEdit ? "cursor: pointer;" : "";

    const fillPct = this._config.progress_mode === "drain" ? pctLeft : pct;
    const fillInlineStyle = `width:${fillPct}%;`;

    if (ring) {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}">
          ${style.startsWith("fill_") ? html`<div class="progress-fill" style="width:100%"></div>` : ""}
          <div class="vcol">
            <div class="icon-wrap large"><ha-icon .icon=${icon}></ha-icon></div>
            <div class="vtitle">${t.label}</div>
            <div class="vstatus up">${timeStr}</div>
            <div class="vactions-center">
              ${supportsManualControls ? html`
                <button class="chip" @click=${() => this._handleSnooze(t)}>${this._localize("snooze")}</button>
                <button class="chip" @click=${() => this._handleDismiss(t)}>${this._localize("dismiss")}</button>
              ` : supportsReadOnlyDismiss ? html`
                <button class="chip" @click=${() => this._handleDismiss(t)}>${this._localize("dismiss")}</button>
              ` : ""}
            </div>
          </div>
        </li>
      `;
    }

    if (style === "circle") {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @click=${clickHandler}>
          ${supportsManualControls && !isIdle ? html`
            <button class="vtile-close" title="${this._localize("cancel")}"
              @click=${(e)=>{ e.stopPropagation(); this._handleCancel(t); }}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          ` : ""}
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
              <svg class="vcircle" width="64" height="64" viewBox="0 0 64" aria-hidden="true">
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
      <li class="${baseClasses}" style="--tcolor:${color}; ${rowStyle}" @click=${clickHandler}>
        ${style.startsWith("fill_") ? html`<div class="progress-fill" style="${fillInlineStyle}"></div>` : ""}
        <div class="vcol">
          <div class="icon-wrap large"><ha-icon .icon=${icon}></ha-icon></div>
          <div class="vtitle">${t.label}</div>
          <div class="vstatus">${timeStr}</div>
          ${style.startsWith("bar_") ? html`
            <div class="vprogressbar" @click=${(e) => e.stopPropagation()}>
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
    return pinned.map((p, idx) => {
      const durationInput = (p && typeof p === "object") ? (p.duration ?? p.preset ?? p.minutes ?? p.secs) : p;
      const durationMs = this._parseDurationInputToMs(durationInput);
      if (!durationMs) return null;
      const label = (p && typeof p === "object" && p.name) ? p.name : `#${idx + 1}`;
      const icon = (p && typeof p === "object" && p.icon) ? p.icon : (this._config.default_timer_icon || "mdi:timer-outline");
      const color = (p && typeof p === "object" && p.color) ? p.color : (this._config.default_timer_color || "var(--primary-color)");
      const now = Date.now();
      return {
        id: `pinned-${idx}`,
        pinned_id: `pinned-${idx}`,
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

    const pinnedTimers = this._getPinnedTimers().filter(pt => !activeTimers.some(t => t.pinned_id && pt.pinned_id && t.pinned_id === pt.pinned_id));

    const timers = [...pinnedTimers, ...activeTimers].sort((a, b) => {
      if (a.finished && !b.finished) return 1;
      if (!a.finished && b.finished) return -1;
      const ar0 = Number(a.remaining_ms ?? a.remaining ?? 0);
      const br0 = Number(b.remaining_ms ?? b.remaining ?? 0);
      const ar = isFinite(ar0) ? ar0 : Number.MAX_SAFE_INTEGER;
      const br = isFinite(br0) ? br0 : Number.MAX_SAFE_INTEGER;
      return ar - br;
    });
    const layout = this._config.layout;
    const style = this._config.style;
    const activeTimersLayout = ["fill_vertical", "bar_vertical", "circle"].includes((this._config.style || "").toLowerCase()) ? "vertical" : "horizontal";
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
              const label = typeof preset === "string" && preset.toLowerCase().endsWith("s")
                ? preset.toLowerCase()
                : `${preset}${this._localize("m")}`;
              return html`<button class="btn btn-preset" @click=${() => this._createPresetTimer(preset)}>${label}</button>`;
            })}
            ${this._config.show_timer_presets === false ? html`
              <button class="btn btn-ghost" @click=${() => this._toggleCustom("horizontal")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            ` : html`
              <button class="btn btn-ghost" @click=${() => this._toggleCustom("horizontal")}>${this._localize("custom")}</button>
            `}
          </div>
        </div>
        <div class="picker">
          <div class="buttons-grid">
            ${this._renderMinuteButtons("horizontal", (which, m, sign) => this._adjust(which, m, sign), +1)}
          </div>
          <div class="display">${this._formatDuration(this._customSecs.horizontal, "seconds")}</div>
          <div class="buttons-grid">
            ${this._renderMinuteButtons("horizontal", (which, m, sign) => this._adjust(which, m, sign), -1)}
          </div>
          ${this._renderTimerNameSelector("nt-h-name", "Timer Name (Optional)")}

          <div class="picker-actions">
            <button class="btn btn-ghost" @click=${() => (this._ui.noTimerHorizontalOpen = false)}>${this._localize("cancel")}</button>
            <button class="btn btn-primary" @click=${() => this._startFromCustom("horizontal")}>${this._localize("start")}</button>
          </div>
        </div>
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
              const label = typeof preset === "string" && preset.toLowerCase().endsWith("s")
                ? preset.toLowerCase()
                : `${preset}${this._localize("m")}`;
              return html`<button class="btn btn-preset" @click=${() => this._createPresetTimer(preset)}>${label}</button>`;
            })}
            ${this._config.show_timer_presets === false ? html`
              <button class="btn btn-ghost" @click=${() => this._toggleCustom("vertical")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            ` : html`
              <button class="btn btn-ghost" @click=${() => this._toggleCustom("vertical")}>${this._localize("custom")}</button>
            `}
          </div>
        </div>
        <div class="picker">
          <div class="buttons-grid">
            ${this._renderMinuteButtons("vertical", (which, m, sign) => this._adjust(which, m, sign), +1)}
          </div>
          <div class="display">${this._formatDuration(this._customSecs.vertical, "seconds")}</div>
          <div class="buttons-grid">
            ${this._renderMinuteButtons("vertical", (which, m, sign) => this._adjust(which, m, sign), -1)}
          </div>
          ${this._renderTimerNameSelector("nt-v-name", "Timer Name (Optional)")}
          <div class="picker-actions">
            <button class="btn btn-ghost" @click=${() => (this._ui.noTimerVerticalOpen = false)}>${this._localize("cancel")}</button>
            <button class="btn btn-primary" @click=${() => this._startFromCustom("vertical")}>${this._localize("start")}</button>
          </div>
        </div>
      </div>
    `;
    const renderFn = activeTimersLayout === "vertical"
      ? this._renderItemVertical.bind(this)
      : this._renderItem.bind(this);
    const useGrid = (activeTimersLayout === "vertical") || (style === "circle");
    const cols = (useGrid && timers.length > 1) ? 2 : 1;
    const listClass = useGrid ? `list vgrid cols-${cols}` : "list";
    const activeCard = style.startsWith("fill_") ? html`
      <div class="card ${this._ui.activeFillOpen ? "card-show" : ""}">
        ${this._config.show_active_header !== false ? html`
          <div class="active-head">
            <h4>${this._localize("active_timers")}</h4>
            ${showPresetsInActive ? html`
              <div class="header-actions">
                ${presets.map((preset) => {
                  const label = typeof preset === "string" && preset.toLowerCase().endsWith("s")
                    ? preset.toLowerCase()
                    : `${preset}${this._localize("m")}`;
                  return html`<button class="btn btn-preset" @click=${() => this._createPresetTimer(preset)}>${label}</button>`;
                })}
                <button class="btn btn-ghost" @click=${() => this._toggleActivePicker("fill")}>${this._localize("custom")}</button>
              </div>
            ` : html`
              <button class="btn btn-add" @click=${() => this._toggleActivePicker("fill")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            `}
          </div>
        ` : ""}
        <div class="active-picker">
          <div class="buttons-grid">
            ${this._renderMinuteButtons("fill", (which, m, sign) => this._adjustActive(which, m, sign), +1)}
          </div>
          <div class="display">${this._formatDuration(this._activeSecs.fill, "seconds")}</div>
          <div class="buttons-grid">
            ${this._renderMinuteButtons("fill", (which, m, sign) => this._adjustActive(which, m, sign), -1)}
          </div>
          ${this._renderTimerNameSelector("add-fill-name", "Timer Name (Optional)")}
          <div class="picker-actions">
            <button class="btn btn-ghost" @click=${() => (this._ui.activeFillOpen = false)}>${this._localize("cancel")}</button>
            <button class="btn btn-primary" @click=${() => this._startActive("fill")}>${this._localize("start")}</button>
          </div>
        </div>
        <ul class="${listClass}">
          ${timers.map((t) => renderFn(t, style))}
        </ul>
      </div>
    ` : html`
      <div class="card ${this._ui.activeBarOpen ? "card-show" : ""}">
        ${this._config.show_active_header !== false ? html`
          <div class="active-head">
            <h4>${this._localize("active_timers")}</h4>
            ${showPresetsInActive ? html`
              <div class="header-actions">
                ${presets.map((preset) => {
                  const label = typeof preset === "string" && preset.toLowerCase().endsWith("s")
                    ? preset.toLowerCase()
                    : `${preset}${this._localize("m")}`;
                  return html`<button class="btn btn-preset" @click=${() => this._createPresetTimer(preset)}>${label}</button>`;
                })}
                <button class="btn btn-ghost" @click=${() => this._toggleActivePicker("bar")}>${this._localize("custom")}</button>
              </div>
            ` : html`
              <button class="btn btn-add" @click=${() => this._toggleActivePicker("bar")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            `}
          </div>
        ` : ""}
        <div class="active-picker">
          <div class="buttons-grid">
            ${this._renderMinuteButtons("bar", (which, m, sign) => this._adjustActive(which, m, sign), +1)}
          </div>
          <div class="display">${this._formatDuration(this._activeSecs.bar, "seconds")}</div>
          <div class="buttons-grid">
            ${this._renderMinuteButtons("bar", (which, m, sign) => this._adjustActive(which, m, sign), -1)}
          </div>
          ${this._renderTimerNameSelector("add-bar-name", "Timer Name (Optional)")}
          <div class="picker-actions">
            <button class="btn btn-ghost" @click=${() => (this._ui.activeBarOpen = false)}>${this._localize("cancel")}</button>
            <button class="btn btn-primary" @click=${() => this._startActive("bar")}>${this._localize("start")}</button>
          </div>
        </div>
        <ul class="${listClass}">
          ${timers.map((t) => renderFn(t, style))}
        </ul>
      </div>
    `;
    return html`
      <ha-card>
        ${this._config.title ? html`<div class="card-header"><span>${this._config.title}</span></div>` : ""}
        ${timers.length === 0 ? html`<div class="grid"><div>${noTimerCard}</div></div>` : html`<div class="grid"><div>${activeCard}</div></div>`}
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host { --stc-chip-radius: 9999px; }
      ha-card { border-radius: var(--ha-card-border-radius, 12px); overflow: hidden; padding: 0; background: var(--ha-card-background, var(--card-background-color)); }
      .grid { display: grid; grid-template-columns: 1fr; gap: 12px; padding: 0; margin: -1px 0; }
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
      .picker, .active-picker { max-height: 0; opacity: 0; overflow: hidden; transition: max-height .5s ease, opacity .3s ease, padding-top .5s ease, margin-bottom .3s ease; padding-top: 0; margin-bottom: 0; }
      .card.expanded .picker { max-height: 450px; opacity: 1; padding: 12px 8px 8px; }
      .card-show .active-picker { max-height: 450px; opacity: 1; margin-bottom: 8px; padding: 8px 0; }
      .icon-wrap { width: 36px; height: 36px; border-radius: var(--ha-card-border-radius, 50%); background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 18%, var(--ha-card-background, var(--card-background-color))); display: flex; align-items: center; justify-content: center; flex: 0 0 36px; }
      .icon-wrap ha-icon { --mdc-icon-size: 22px; color: var(--tcolor, var(--primary-color)); }
      .nt-title { margin: 0; font-size: 14px; font-weight: 500; line-height: 20px; }
      .nt-sub { margin: 0; font-size: 12px; color: var(--secondary-text-color); line-height: 16px; }
      .btn { font-weight: 600; border-radius: var(--stc-chip-radius); padding: 6px 10px; font-size: 12px; border: none; cursor: pointer; }
      .btn.disabled { opacity: 0.5; pointer-events: none; }
      .btn-preset { background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--primary-text-color); }
      .btn-ghost { background: var(--card-background-color); border: 1px solid var(--divider-color); color: var(--primary-text-color); }
      .btn-primary { background: var(--primary-color); color: var(--text-primary-color, #fff); }
      .btn-add { display: flex; align-items: center; gap: 8px; background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--secondary-text-color); }
      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 220px; margin: 0 auto; }
      .buttons-grid { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: 100%; box-sizing: border-box; }
      .buttons-grid .btn { flex: 0 0 auto; min-width: 68px; }
      .display { text-align: center; font-size: 36px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin: 8px 0; }
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
      .item { box-sizing: border-box; position: relative; border-radius: var(--ha-card-border-radius, 12px); overflow: hidden; padding: 8px 0; min-height: 56px; background: var(--stc-item-background, transparent); }
      .item .info { display: flex; flex-direction: column; justify-content: center; height: 36px; flex: 1; overflow: hidden; }
      .item .title { font-size: 14px; font-weight: 500; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .item .status { font-size: 12px; color: var(--secondary-text-color); line-height: 16px; font-variant-numeric: tabular-nums; }
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
      .vtile-close { position: absolute; top: 4px; right: 4px; border: 0; background: none; padding: 4px; border-radius: 50%; color: var(--secondary-text-color); cursor: pointer; z-index: 3; }
      .vtile-close:hover { background: color-mix(in srgb, var(--primary-color) 10%, transparent); }
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
  static get properties() { return { hass: {}, _config: {}, _expandedSections: { state: true } }; }

  constructor() {
    super();
    this._debounceTimeout = null;
    this._emitTimeout = null;
    this._expandedSections = {
      basics: true,
      layout: false,
      presets: false,
      pinned: false,
      storage: false,
      entities: true,
    };
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._debounceTimeout) { clearTimeout(this._debounceTimeout); this._debounceTimeout = null; }
    if (this._emitTimeout) { clearTimeout(this._emitTimeout); this._emitTimeout = null; }
  }

  setConfig(config) {
    const c = { ...(config || {}) };
    if (typeof c.timer_name_presets === "string") c.timer_name_presets = c.timer_name_presets.split(",").map(s => s.trim()).filter(Boolean);
    if (typeof c.timer_presets === "string") c.timer_presets = c.timer_presets.split(",").map(s => s.trim()).filter(Boolean);
    if (typeof c.minute_buttons === "string") c.minute_buttons = c.minute_buttons.split(",").map(s => s.trim()).filter(Boolean);
    if (typeof c.time_format_units === "string") c.time_format_units = c.time_format_units.split(",").map(s => s.trim()).filter(Boolean);
    this._config = { ...c };
    if (!this._expandedSections) {
      this._expandedSections = { basic: true, time: false, general: false, presets: false, pinned: false, storage: false, audio: false, entities: true };
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
        if (v.toLowerCase().endsWith("s")) {
          const seconds = parseInt(v.slice(0, -1), 10);
          if (!isNaN(seconds) && seconds > 0) return `${seconds}s`;
        }
        const minutes = parseInt(v, 10);
        if (!isNaN(minutes) && minutes > 0) return minutes;
        return null;
      }).filter(v => v !== null);
      if (value.length === 0) value = [5, 15, 30];
    }
    if (key === "minute_buttons" && typeof value === "string") {
      value = value.split(",").map(v => v.trim()).filter(v => v).map(v => {
        if (v.toLowerCase().endsWith("s")) {
          const seconds = parseInt(v.slice(0, -1), 10);
          if (!isNaN(seconds) && seconds > 0) return `${seconds}s`;
        }
        const minutes = parseInt(v, 10);
        if (!isNaN(minutes) && minutes > 0) return minutes;
        return null;
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

  _detailValueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue ?? target.dataset?.configValue ?? target.getAttribute?.("configValue");
    if (!key) return;
    this._updateConfig({ [key]: ev.detail.value });
  }

  _selectChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue ?? target.dataset?.configValue ?? target.getAttribute?.("configValue");
    if (!key) return;
    ev.stopPropagation();
    const value = ev.detail?.value !== undefined ? ev.detail.value : target.value;
    if (typeof value !== "string" || value === "") return;
    if (key === "style") {
      const styleValue = value.toLowerCase();
      const validStyles = ["fill_vertical", "fill_horizontal", "bar_vertical", "bar_horizontal", "circle"];
      const normalizedStyle = validStyles.includes(styleValue) ? styleValue : "bar_horizontal";
      this._updateConfig({ style: normalizedStyle }, true);
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
    else if (e.detail && e.detail.value !== undefined) value = e.detail.value;
    else if (target.value !== undefined) value = target.value;
    else return;
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
  this._emitChange();
}

_removePinnedTimer(index) {
  const pinned = Array.isArray(this._config.pinned_timers) ? [...this._config.pinned_timers] : [];
  pinned.splice(index, 1);
  this._config = { ...this._config, pinned_timers: pinned };
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
      default_new_timer_duration_mins: 15,
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
      language: "en",
      milestone_unit: "auto",
      milestone_pulse: true,
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
      cleaned.minute_buttons = raw.map((x) => Number(String(x).trim())).filter((x) => Number.isFinite(x));
    }

    const stripIfEmpty = (k) => {
      if (cleaned[k] === "" || cleaned[k] === null || cleaned[k] === undefined) delete cleaned[k];
      if (Array.isArray(cleaned[k]) && cleaned[k].length === 0) delete cleaned[k];
    };

    stripIfEmpty("audio_file_url");
    stripIfEmpty("expired_subtitle");
    stripIfEmpty("title");
    stripIfEmpty("default_timer_entity");

    if (!cleaned.audio_enabled) {
      delete cleaned.audio_file_url;
      delete cleaned.audio_repeat_count;
      delete cleaned.audio_play_until_dismissed;
      delete cleaned.audio_completion_delay;
    }

    if (cleaned.show_timer_presets === false) {
      delete cleaned.timer_presets;
      delete cleaned.timer_name_presets;
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

    return cleaned;
  }


  async firstUpdated() {
    const tags = ["ha-entity-picker","ha-select","ha-textfield","ha-icon-picker","ha-form","mwc-list-item"];
    tags.forEach((t) => { customElements.whenDefined(t).then(() => this.requestUpdate()).catch(() => {}); });
    this._ensureEntityPickerLoaded();
    this.requestUpdate();
  }

  _ensureEntityPickerLoaded() {
    if (customElements.get("ha-entity-picker")) return;
    try {
      const loader = document.createElement("ha-form");
      loader.style.display = "none";
      loader.schema = [{ name: "e", selector: { entity: {} } }];
      loader.data = {};
      loader.hass = this.hass;
      this.shadowRoot?.appendChild(loader);
      setTimeout(() => loader.remove(), 0);
    } catch (_) {}
  }

  _getDisplayStyleValue() {
    return this._config.style || "bar_horizontal";
  }

  _detectMode(entityId, entityState, entityConf) {
    if (!entityState) return null;
    if (entityId.startsWith("timer.")) return "timer";
    if (entityId.startsWith("input_text.") || entityId.startsWith("text.")) return "helper";
    const attrs = entityState.attributes || {};
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

  _toggleSection(key) {
    this._expandedSections = { ...(this._expandedSections || {}), [key]: !this._expandedSections?.[key] };
  }

  render() {
    if (!this.hass || !this._config) return html``;
    const entityPickerReady = !!customElements.get("ha-entity-picker");
    const storageType = this._config.default_timer_entity?.startsWith("sensor.") ? "mqtt" : "local";
    const showMilestonesSection = this._config.progress_mode === "milestones";

    const section = (key, title, content) => html`
      <div class="section">
        <div class="section-header" @click=${() => this._toggleSection(key)}>
          <span class="section-title">${title}</span>
          <ha-icon icon=${this._expandedSections?.[key] ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
        </div>
        ${this._expandedSections?.[key] ? html`<div class="section-content">${content}</div>` : ""}
      </div>
    `;

    const basicContent = html`
      <ha-textfield label="Title (Optional)" .value=${this._config.title || ""} .configValue=${"title"} @input=${this._valueChanged}></ha-textfield>

      <div class="side-by-side">
        <ha-select label="Layout" .value=${this._config.layout || "horizontal"} .configValue=${"layout"} @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
          <mwc-list-item value="horizontal">Horizontal</mwc-list-item>
          <mwc-list-item value="vertical">Vertical</mwc-list-item>
        </ha-select>

        <ha-select label="Style" .value=${this._getDisplayStyleValue()} .configValue=${"style"} @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
          <mwc-list-item value="fill_vertical">Background fill (vertical)</mwc-list-item>
          <mwc-list-item value="fill_horizontal">Background fill (horizontal)</mwc-list-item>
          <mwc-list-item value="bar_vertical">Progress bar (vertical)</mwc-list-item>
          <mwc-list-item value="bar_horizontal">Progress bar (horizontal)</mwc-list-item>
          <mwc-list-item value="circle">Circle</mwc-list-item>
        </ha-select>
      </div>

      <div class="side-by-side">
        <ha-select label="Progress Mode" .value=${this._config.progress_mode || "drain"} .configValue=${"progress_mode"} @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
          <mwc-list-item value="drain">Drain</mwc-list-item>
          <mwc-list-item value="fill">Fill</mwc-list-item>
          <mwc-list-item value="milestones">Milestones (bar styles only)</mwc-list-item>
        </ha-select>

        <ha-select label="Language" .value=${this._config.language || "en"} .configValue=${"language"} @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
          <mwc-list-item value="en">English</mwc-list-item>
          <mwc-list-item value="de">Deutsch</mwc-list-item>
          <mwc-list-item value="es">Español</mwc-list-item>
		  <mwc-list-item value="da">Dansk</mwc-list-item>
        </ha-select>
      </div>
    `;

    const timeContent = html`
      <ha-select label="Time format" .value=${this._config.time_format || "hms"} .configValue=${"time_format"} @selected=${this._selectChanged} @closed=${(e)=>{e.stopPropagation();this._selectChanged(e); }}>
        <mwc-list-item value="hms">HH:MM:SS</mwc-list-item>
        <mwc-list-item value="hm">HH:MM</mwc-list-item>
        <mwc-list-item value="ss">Seconds only</mwc-list-item>
        <mwc-list-item value="dhms">DD:HH:MM:SS</mwc-list-item>
        <mwc-list-item value="human_compact">Unit style, compact</mwc-list-item>
        <mwc-list-item value="human_short">Unit style, short labels</mwc-list-item>
        <mwc-list-item value="human_natural">Unit style, natural language</mwc-list-item>
      </ha-select>

      <ha-textfield label="Unit order (comma-separated)" helper="years,months,weeks,days,hours,minutes,seconds" .value=${(this._config.time_format_units || ["days","hours","minutes","seconds"]).join(",")} .configValue=${"time_format_units"} @input=${this._valueChanged}></ha-textfield>

      ${showMilestonesSection ? html`
        <div class="subsection-title">Progress milestones</div>
        <div class="side-by-side" style="align-items:flex-start;">
          <ha-select label="Milestone unit" .value=${this._config.milestone_unit || "auto"} .configValue=${"milestone_unit"} @selected=${this._selectChanged} @closed=${(e)=>{e.stopPropagation();this._selectChanged(e); }}>
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
          <ha-formfield label="Pulse active milestone">
            <ha-switch .checked=${this._config.milestone_pulse !== false} .configValue=${"milestone_pulse"} @change=${this._valueChanged}></ha-switch>
          </ha-formfield>
        </div>
      ` : ""}
    `;

    const generalContent = html`
      <ha-formfield label="Show 'Active Timers' header">
        <ha-switch .checked=${this._config.show_active_header !== false} .configValue=${"show_active_header"} @change=${this._valueChanged}></ha-switch>
      </ha-formfield>

      <div class="side-by-side">
        <ha-textfield label="Default Duration (minutes)" type="number" .value=${this._config.default_new_timer_duration_mins ?? 15} .configValue=${"default_new_timer_duration_mins"} @input=${this._valueChanged}></ha-textfield>
        <ha-textfield label="Snooze Duration (minutes)" type="number" .value=${this._config.snooze_duration ?? 5} .configValue=${"snooze_duration"} @input=${this._valueChanged}></ha-textfield>
      </div>

      <div class="side-by-side">
        <ha-select label="When timer reaches 0" .value=${this._config.expire_action || "keep"} .configValue=${"expire_action"} @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
          <mwc-list-item value="keep">Keep visible</mwc-list-item>
          <mwc-list-item value="dismiss">Dismiss</mwc-list-item>
          <mwc-list-item value="remove">Remove</mwc-list-item>
        </ha-select>
        <ha-textfield label="Keep-visible duration (seconds)" type="number" .value=${this._config.expire_keep_for ?? 120} .configValue=${"expire_keep_for"} @input=${this._valueChanged}></ha-textfield>
      </div>

      <ha-formfield label="Auto-dismiss helper timers at 0">
        <ha-switch .checked=${this._config.auto_dismiss_writable === true} .configValue=${"auto_dismiss_writable"} @change=${this._valueChanged}></ha-switch>
      </ha-formfield>

      <div class="side-by-side">
        <ha-icon-picker label="Default timer icon" .value=${this._config.default_timer_icon || "mdi:timer-outline"} .configValue=${"default_timer_icon"} @value-changed=${this._detailValueChanged}></ha-icon-picker>
        <ha-textfield label="Default timer color" .value=${this._config.default_timer_color || "var(--primary-color)"} .configValue=${"default_timer_color"} @input=${this._valueChanged}></ha-textfield>
      </div>

      <ha-textfield label="Timer expired message" .value=${this._config.expired_subtitle || ""} .configValue=${"expired_subtitle"} @input=${this._valueChanged} placeholder="Time's up!"></ha-textfield>
    `;

    const presetsContent = html`
      <ha-formfield label="Show timer preset buttons">
        <ha-switch .checked=${this._config.show_timer_presets !== false} .configValue=${"show_timer_presets"} @change=${this._valueChanged}></ha-switch>
      </ha-formfield>

      ${this._config.show_timer_presets !== false ? html`
        <ha-textfield label="Timer presets (minutes or secs, e.g. 5, 90s)" .value=${(this._config.timer_presets || [5, 15, 30]).join(", ")} .configValue=${"timer_presets"} @input=${this._valueChanged}></ha-textfield>
        <ha-textfield label="Timer name presets (comma-separated)" .value=${(this._config.timer_name_presets || []).join(", ")} .configValue=${"timer_name_presets"} @input=${this._valueChanged}></ha-textfield>
      ` : ""}

      <ha-textfield label="Minute adjustment buttons (comma-separated)" .value=${(this._config.minute_buttons || [1, 5, 10]).join(", ")} .configValue=${"minute_buttons"} @input=${this._valueChanged}></ha-textfield>
    `;

    const pinnedContent = html`
  <div class="entities-header">
    <h3>Pinned timers</h3>
    <button class="add-entity-button" @click=${this._addPinnedTimer} title="Add pinned timer">
      <ha-icon icon="mdi:plus"></ha-icon>
    </button>
  </div>

  ${(Array.isArray(this._config.pinned_timers) ? this._config.pinned_timers : []).length === 0
    ? html`<div class="no-entities">No pinned timers configured. Click the + button above to add one.</div>`
    : (this._config.pinned_timers || []).map((t, index) => html`
        <div class="entity-editor">
          <div class="entity-options" style="width:100%;">
            <div class="side-by-side">
              <ha-textfield
                label="Name"
                .value=${t?.name || ""}
                .configValue=${"name"}
                @input=${(e) => this._pinnedTimerValueChanged(e, index)}
              ></ha-textfield>

              <ha-textfield
                label="Duration"
                .value=${t?.duration ?? t?.preset ?? "5m"}
                .configValue=${"duration"}
                @input=${(e) => this._pinnedTimerValueChanged(e, index)}
                helper-text="Examples: 5m, 90s, 1h"
              ></ha-textfield>
            </div>

            <div class="side-by-side">
              <ha-icon-picker
                label="Icon"
                .value=${t?.icon || ""}
                .configValue=${"icon"}
                @value-changed=${(e) => { e.target.configValue = "icon"; this._pinnedTimerValueChanged(e, index); }}
              ></ha-icon-picker>

              <ha-textfield
                label="Color"
                .value=${t?.color || ""}
                .configValue=${"color"}
                @input=${(e) => this._pinnedTimerValueChanged(e, index)}
              ></ha-textfield>
            </div>

            <ha-textfield
              label="Expired message"
              .value=${t?.expired_subtitle || ""}
              .configValue=${"expired_subtitle"}
              @input=${(e) => this._pinnedTimerValueChanged(e, index)}
            ></ha-textfield>

            <ha-formfield label="Enable specific audio">
              <ha-switch
                .checked=${t?.audio_enabled === true}
                .configValue=${"audio_enabled"}
                @change=${(e) => this._pinnedTimerValueChanged(e, index)}
              ></ha-switch>
            </ha-formfield>

            ${t?.audio_enabled ? html`
              <div class="side-by-side">
                <ha-textfield
                  label="Audio file URL"
                  .value=${t?.audio_file_url || ""}
                  .configValue=${"audio_file_url"}
                  @input=${(e) => this._pinnedTimerValueChanged(e, index)}
                ></ha-textfield>

                <ha-textfield
                  label="Repeat count"
                  type="number"
                  min="1"
                  max="10"
                  .value=${t?.audio_repeat_count ?? 1}
                  .configValue=${"audio_repeat_count"}
                  @input=${(e) => this._pinnedTimerValueChanged(e, index)}
                ></ha-textfield>
              </div>

              <ha-formfield label="Play until dismissed or snoozed">
                <ha-switch
                  .checked=${t?.audio_play_until_dismissed === true}
                  .configValue=${"audio_play_until_dismissed"}
                  @change=${(e) => this._pinnedTimerValueChanged(e, index)}
                ></ha-switch>
              </ha-formfield>
            ` : ""}
          </div>

          <button class="remove-entity" @click=${() => this._removePinnedTimer(index)} title="Remove pinned timer">
            <ha-icon icon="mdi:delete"></ha-icon>
          </button>
        </div>
      `)}
`;

const storageContent = html`
      <ha-entity-picker
        .hass=${this.hass}
        .value=${this._config.default_timer_entity || ""}
        .configValue=${"default_timer_entity"}
        @value-changed=${this._detailValueChanged}
        label="Default Timer Storage (Optional)"
        help-text="Select a helper (input_text) or an MQTT sensor to store timers."
        allow-custom-entity
        .includeDomains=${["input_text", "text", "sensor"]}
      ></ha-entity-picker>
      <ha-formfield label="Auto use Voice PE (if available)">
        <ha-switch .checked=${this._config.auto_voice_pe === true} .configValue=${"auto_voice_pe"} @change=${this._valueChanged}></ha-switch>
      </ha-formfield>

      ${this._config.auto_voice_pe === true
        ? html`
            <ha-entity-picker
              .hass=${this.hass}
              .value=${this._config.voice_pe_control_entity || ""}
              .configValue=${"voice_pe_control_entity"}
              .includeDomains=${["text", "input_text"]}
              allow-custom-entity
              label="Voice PE control entity"
              @value-changed=${this._valueChanged}
            ></ha-entity-picker>
          `
        : ""}

      <div class="storage-info">
        <span class="storage-label">Storage type: <strong>${this._getStorageDisplayName(storageType)}</strong></span>
        <small class="storage-description">${this._getStorageDescription(storageType)}</small>
      </div>
    `;

    const audioContent = html`
      <ha-formfield label="Enable audio notifications">
        <ha-switch .checked=${this._config.audio_enabled === true} .configValue=${"audio_enabled"} @change=${this._valueChanged}></ha-switch>
      </ha-formfield>
      ${this._config.audio_enabled ? html`
        <ha-textfield label="Audio file URL or path" .value=${this._config.audio_file_url || ""} .configValue=${"audio_file_url"} @input=${this._valueChanged}></ha-textfield>
        <ha-textfield label="Audio completion delay (seconds)" type="number" min="1" max="30" .value=${this._config.audio_completion_delay ?? 4} .configValue=${"audio_completion_delay"} @input=${this._valueChanged}></ha-textfield>
        <ha-textfield label="Number of times to play" type="number" min="1" max="10" .value=${this._config.audio_repeat_count ?? 1} .configValue=${"audio_repeat_count"} @input=${this._valueChanged}></ha-textfield>
        <ha-formfield label="Play audio until timer is dismissed or snoozed">
          <ha-switch .checked=${this._config.audio_play_until_dismissed === true} .configValue=${"audio_play_until_dismissed"} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>
      ` : ""}
    `;

    const entitiesContent = html`
      <div class="entities-header">
        <h3>Entities</h3>
        <button class="add-entity-button" @click=${this._addEntity} title="Add timer entity"><ha-icon icon="mdi:plus"></ha-icon></button>
      </div>

      ${(this._config.entities || []).length === 0
        ? html`<div class="no-entities">No entities configured. Click the + button above to add timer entities.</div>`
        : (this._config.entities || []).map((entityConf, index) => {
            const entityId = typeof entityConf === "string" ? entityConf : (entityConf?.entity || "");
            const conf = typeof entityConf === "string" ? {} : (entityConf || {});
            const st = this.hass.states[entityId];
            const detectedMode = this._detectMode(entityId, st, conf);
            const isAuto = !conf.mode || conf.mode === "auto";
            const isTimestampMode = conf.mode === "timestamp" || (isAuto && detectedMode === "timestamp");
            return html`
              <div class="entity-editor">
                ${entityPickerReady ? html`
                  <ha-entity-picker
                    .hass=${this.hass}
                    .value=${entityId}
                    .configValue=${"entity"}
                    allow-custom-entity
                    @value-changed=${(e) => this._entityValueChanged(e, index)}
                  ></ha-entity-picker>
                ` : html`
                  <ha-textfield
                    label="Entity (type while picker loads)"
                    .value=${entityId}
                    .configValue=${"entity"}
                    @input=${(e) => this._entityValueChanged(e, index)}
                  ></ha-textfield>
                `}
                <div class="entity-options">
                  <div class="side-by-side" style="align-items:flex-start;">
                    <div style="flex:1;">
                      <ha-select label="Mode" .value=${conf.mode || "auto"} .configValue=${"mode"}
                        @selected=${(e) => { e.stopPropagation(); this._entityValueChanged(e, index); }} @closed=${(e) => { e.stopPropagation(); this._entityValueChanged(e, index); }}>
                        <mwc-list-item value="auto">Auto (Default)</mwc-list-item>
                        <mwc-list-item value="alexa">Alexa</mwc-list-item>
                        <mwc-list-item value="timer">Timer</mwc-list-item>
                        <mwc-list-item value="voice_pe">Voice PE</mwc-list-item>
                        <mwc-list-item value="helper">Helper (input_text/text)</mwc-list-item>
                        <mwc-list-item value="timestamp">Timestamp sensor</mwc-list-item>
                        <mwc-list-item value="minutes_attr">Minutes attribute</mwc-list-item>
                      </ha-select>
                      ${isAuto && detectedMode ? html`
                        <div class="helper-text">
                          Detected mode: <strong>${detectedMode === "unknown" ? "Unknown" : detectedMode.charAt(0).toUpperCase() + detectedMode.slice(1)}</strong>
                        </div>
                      ` : ""}
                    </div>

                    ${conf.mode === "minutes_attr" ? html`
                      <ha-textfield label="Minutes attribute" .value=${conf.minutes_attr || ""} .configValue=${"minutes_attr"} @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>
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
                  </div>

                  ${isTimestampMode ? html`
                    <ha-textfield
                      label="Start time attribute (Optional)"
                      .value=${conf.start_time_attr || ""}
                      .configValue=${"start_time_attr"}
                      @input=${(e) => this._entityValueChanged(e, index)}
                      helper-text="Attribute on this entity containing the start timestamp (e.g., 'last_triggered')."
                    ></ha-textfield>
                  ` : ""}

                  <div class="side-by-side">
                    <ha-textfield label="Name Override" .value=${conf.name || ""} .configValue=${"name"} @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>
                    <ha-icon-picker label="Icon Override" .value=${conf.icon || ""} .configValue=${"icon"} @value-changed=${(e) => this._entityValueChanged(e, index)}></ha-icon-picker>
                    <ha-textfield label="Color Override" .value=${conf.color || ""} .configValue=${"color"} @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>
                  </div>

                  <ha-textfield label="Expired message override" .value=${conf.expired_subtitle || ""} .configValue=${"expired_subtitle"} @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>

                  <ha-formfield label="Enable entity-specific audio">
                    <ha-switch .checked=${conf.audio_enabled === true} .configValue=${"audio_enabled"} @change=${(e) => this._entityValueChanged(e, index)}></ha-switch>
                  </ha-formfield>

                  ${conf.audio_enabled ? html`
                    <div class="side-by-side">
                      <ha-textfield label="Audio file URL" .value=${conf.audio_file_url || ""} .configValue=${"audio_file_url"} @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>
                      <ha-textfield label="Audio repeat count" type="number" min="1" max="10" .value=${conf.audio_repeat_count ?? 1} .configValue=${"audio_repeat_count"} @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>
                    </div>
                  ` : ""}

                  ${(conf.mode === "timer" || (isAuto && detectedMode === "timer")) ? html`
                    <ha-formfield label="Keep visible when idle">
                      <ha-switch .checked=${conf.keep_timer_visible_when_idle === true} .configValue=${"keep_timer_visible_when_idle"} @change=${(e) => this._entityValueChanged(e, index)}></ha-switch>
                    </ha-formfield>
                    <ha-formfield label="Hide action buttons">
                      <ha-switch .checked=${conf.hide_timer_actions === true} .configValue=${"hide_timer_actions"} @change=${(e) => this._entityValueChanged(e, index)}></ha-switch>
                    </ha-formfield>
                  ` : ""}
                </div>

                <button class="remove-entity" @click=${() => this._removeEntity(index)} title="Remove entity"><ha-icon icon="mdi:delete"></ha-icon></button>
              </div>
            `;
          })
      }
    `;

    return html`
      <div class="card-config">
        ${section("basics", "Basics", html`${basicContent}<div class="divider"></div>${timeContent}<div class="divider"></div>${audioContent}`)}
        ${section("layout", "Layout", generalContent)}
        ${section("presets", "Presets", presetsContent)}
        ${section("pinned", "Pinned timers", pinnedContent)}
        ${section("storage", "Storage", storageContent)}
        ${section("entities", "Entities", entitiesContent)}
      </div>
    `;
  }

  _getStorageDisplayName(storage) {
    switch (storage) {
      case "local": return "Local Browser Storage";
      case "helper": return "Helper Entities";
      case "mqtt": return "MQTT";
      default: return "Unknown";
    }
  }

  _getStorageDescription(storage) {
    switch (storage) {
      case "local": return "Timers are stored locally in your browser and persist across sessions.";
      case "helper": return "Timers are stored in Home Assistant helper entities (input_text/text).";
      case "mqtt": return "Timers are stored via MQTT for cross-device sync. Select your MQTT sensor in 'Default Timer Storage'.";
      default: return "";
    }
  }

  static get styles() {
    return css`
      .card-config { display: flex; flex-direction: column; gap: 4px; }

      .section { background: var(--card-background-color); border-radius: 8px; overflow: visible; margin-bottom: 4px; }
      .section-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; user-select: none; transition: background-color 0.2s; }
      .section-header:hover { background: rgba(var(--rgb-primary-text-color), 0.04); }
      .section-title { font-weight: 600; font-size: 14px; color: var(--primary-text-color); margin: 0; }
      .section-header ha-icon { color: var(--secondary-text-color); }
      .section-content { padding: 0 16px 16px 16px; display: flex; flex-direction: column; gap: 12px; animation: slideDown 0.2s ease-out; }

      @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

      .subsection-title { font-weight: 600; margin-top: 8px; margin-bottom: -4px; color: var(--primary-text-color); font-size: 0.9rem; }
      .side-by-side { display: flex; gap: 12px; }
      .side-by-side > * { flex: 1; min-width: 0; }

      .divider { height: 1px; background: var(--divider-color); margin: 8px 0; }

      .storage-info { padding: 12px; background: rgba(var(--rgb-primary-text-color), 0.02); border: 1px solid var(--divider-color); border-radius: 8px; display: flex; flex-direction: column; gap: 4px; }
      .storage-label { font-size: 0.9rem; color: var(--primary-text-color); }
      .storage-description { color: var(--secondary-text-color); font-size: 0.8rem; line-height: 1.2; }

      .entities-header { display: flex; justify-content: space-between; align-items: center; }
      .entities-header h3 { margin: 0; font-size: 14px; font-weight: 600; }
      .add-entity-button { background: var(--primary-color); border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-primary-color, #fff); }
      .no-entities { text-align: center; color: var(--secondary-text-color); padding: 16px; font-style: italic; border: 2px dashed var(--divider-color); border-radius: 8px; margin: 8px 0; }

      .entity-editor { border: 1px solid var(--divider-color); border-radius: 8px; padding: 12px; position: relative; }
      .entity-options { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
      .remove-entity { position: absolute; top: 6px; right: 6px; background: var(--error-color, #f44336); border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; }

      .helper-text { font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; margin-left: 4px; }
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
  });
}, 0);
