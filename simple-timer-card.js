/*
 * Simple Timer Card
 *
 * Author: eyalgal
 * License: MIT
 * Version: 1.0.0
 * For more information, visit: https://github.com/eyalgal/simple-timer-card								   
 */	
import { LitElement, html, css } from "https://unpkg.com/lit@2.8.0/index.js?module";

const cardVersion = "1.0.0";
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
    };
  }

  constructor() {
    super();
    this._timers = [];
    this._timerInterval = null;
    this._dismissed = new Set();
    this._ringingTimers = new Set();

    this._ui = {
      noTimerHorizontalOpen: false,
      noTimerVerticalOpen: false,
      activeFillOpen: false,
      activeBarOpen: false,
    };
    this._customSecs = { horizontal: 15 * 60, vertical: 15 * 60 };
    this._activeSecs = { fill: 10 * 60, bar: 10 * 60 };
  }

  setConfig(config) {
    if (!config.entities && !config.show_timer_presets) {
      throw new Error("You need to define an array of entities or enable timer presets.");
    }

    const mqttDefaults = {
      topic: "simple_timer_card/timers",
      state_topic: "simple_timer_card/timers/state",
      sensor_entity: "sensor.simple_timer_store",
    };

    let autoStorage = config.storage || "local";
    if (!config.storage) {
      const entities = config.entities || [];
      const defaultEntity = config.default_timer_entity;
      const mqttSensorEntity = config.mqtt?.sensor_entity || mqttDefaults.sensor_entity;

      const hasConfiguredMqttSensor =
        defaultEntity === mqttSensorEntity ||
        entities.some((e) => (typeof e === "string" ? e : e.entity) === mqttSensorEntity);

      const hasHelperEntities =
        (defaultEntity && (defaultEntity.startsWith("input_text.") || defaultEntity.startsWith("text."))) ||
        entities.some((e) => {
          const id = typeof e === "string" ? e : e.entity;
          return id && (id.startsWith("input_text.") || id.startsWith("text."));
        });

      if (hasConfiguredMqttSensor) autoStorage = "mqtt";
      else if (hasHelperEntities) autoStorage = "helper";
    }

    const normLayout = (config.layout || "horizontal").toLowerCase();
    const layout = normLayout === "vertical" ? "vertical" : "horizontal";

    const rawStyle = (config.style || "bar").toLowerCase();
    const style =
      rawStyle === "fill" || rawStyle === "background" || rawStyle === "background_fill"
        ? "fill"
        : "bar";

    this._config = {
      layout,
      style,
      snooze_duration: 5,
      show_time_selector: false,
      timer_presets: [5, 15, 30],
      show_timer_presets: true,
      show_active_header: true,
      minute_buttons: [1, 5, 10],
      default_timer_icon: "mdi:timer-outline",
      default_timer_color: "var(--primary-color)",
      default_timer_entity: null,
      expire_action: "keep",
      expire_keep_for: 120,
      auto_dismiss_writable: false,
      show_progress_when_unknown: false,
      storage: autoStorage,
      mqtt: mqttDefaults,
      audio_enabled: false,
      audio_file_url: "",
      audio_repeat_count: 1,
      ...config,
      entities: config.entities || [],
      storage: autoStorage,
      layout,
      style,
      mqtt: { ...mqttDefaults, ...(config.mqtt || {}) },
    };
  }

  static getStubConfig() {
    return {
      entities: [],
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this._startTimerUpdates();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopTimerUpdates();
  }
  _startTimerUpdates() {
    this._stopTimerUpdates();
    this._updateTimers();
    this._timerInterval = setInterval(() => this._updateTimers(), 1000);
  }
  _stopTimerUpdates() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  _getStorageKey() {
    return `simple-timer-card-timers-${this._config?.title || "default"}`;
  }
  _loadTimersFromStorage_local() {
    try {
      const stored = localStorage.getItem(this._getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed.timers) ? parsed.timers : [];
      }
    } catch (e) {
      console.warn("Failed to load timers from storage:", e);
    }
    return [];
  }
  _saveTimersToStorage_local(timers) {
    try {
      const data = { timers: timers || [], version: 1, lastUpdated: Date.now() };
      localStorage.setItem(this._getStorageKey(), JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save timers to storage:", e);
    }
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
      const entity = this.hass?.states?.[this._config.mqtt.sensor_entity];
      const timers = entity?.attributes?.timers;
      return Array.isArray(timers) ? timers : [];
    } catch (e) {
      console.warn("Failed to load timers from MQTT storage:", e);
      return [];
    }
  }
  _saveTimersToStorage_mqtt(timers) {
    try {
      const payload = { timers: timers || [], version: 1, lastUpdated: Date.now() };
      this.hass.callService("mqtt", "publish", {
        topic: this._config.mqtt.topic,
        payload: JSON.stringify(payload),
        retain: true,
      });
      if (this._config.mqtt.state_topic) {
        this.hass.callService("mqtt", "publish", {
          topic: this._config.mqtt.state_topic,
          payload: JSON.stringify({ version: payload.version, t: payload.lastUpdated }),
          retain: true,
        });
      }
    } catch (e) {
      console.warn("Failed to save timers to MQTT storage:", e);
    }
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
    if (storage === "mqtt") return this._loadTimersFromStorage_mqtt();
    if (storage === "local") return this._loadTimersFromStorage_local();
    return [];
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
    if (entityId.startsWith("input_text.") || entityId.startsWith("text.")) return "helper";
    if (entityId.startsWith("timer.")) return "timer";
    if (entityId.startsWith("sensor.") && entityState?.attributes?.sorted_active) return "alexa";
    if (entityState?.attributes?.device_class === "timestamp") return "timestamp";
    const guessAttr = entityConf?.minutes_attr || "Minutes to arrival";
    if (entityState?.attributes && (entityState.attributes[guessAttr] ?? null) !== null) return "minutes_attr";
    return "timestamp";
  }
  // Normalize a "duration-ish" value to milliseconds
  _toMs(v) {
    if (v == null) return null;

    // Already a number?
    if (typeof v === "number") {
      // Heuristic: if it's tiny, assume seconds; if very large, assume epoch (we only need duration)
      if (v < 1000) return v * 1000;            // seconds -> ms
      if (v > 1e12) return Math.max(0, v - Date.now()); // epoch ms -> remaining ms
      return v;                                  // looks like ms
    }

    // Numeric string?
    if (typeof v === "string") {
      const n = Number(v);
      if (!Number.isNaN(n)) return this._toMs(n);

      // ISO-8601 duration like PT1H2M3S
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
    let active = entityState.attributes.sorted_active;
    let paused = entityState.attributes.sorted_paused;
    let all    = entityState.attributes.sorted_all;

    // Attributes may be JSON strings in some integrations
    const safeParse = (x) => {
      if (Array.isArray(x)) return x;
      if (typeof x === "string") { try { return JSON.parse(x); } catch { return []; } }
      return Array.isArray(x) ? x : [];
    };
    active = safeParse(active);
    paused = safeParse(paused);
    all    = safeParse(all);

    // Normalize duration fields
    const normDuration = (t) =>
      (typeof t?.originalDurationInMillis === "number" && t.originalDurationInMillis) ||
      (typeof t?.originalDurationInSeconds === "number" && t.originalDurationInSeconds * 1000) ||
      this._toMs(t?.originalDuration) || null;

    const mk = (id, t, pausedFlag) => {
      // Active uses absolute trigger time; paused uses remainingTime (duration-ish)
      const remainingMs = pausedFlag ? this._toMs(t?.remainingTime) : null;
      const end = pausedFlag
        ? (remainingMs ?? 0)               // store remaining directly for paused
        : Number(t?.triggerTime || 0);     // epoch ms when running

      return {
        id,
        source: "alexa",
        source_entity: entityId,
        label: t?.timerLabel || entityConf?.name || entityState.attributes.friendly_name || (pausedFlag ? "Alexa Timer (Paused)" : "Alexa Timer"),
        icon: entityConf?.icon || (pausedFlag ? "mdi:timer-pause" : "mdi:timer-outline"),
        color: entityConf?.color || (pausedFlag ? "var(--warning-color)" : "#31C4F3"),
        end,
        duration: normDuration(t),
        paused: !!pausedFlag,
      };
    };

    const activeTimers = active.map(([id, t]) => mk(id, t, false));

    let pausedTimers = paused.map(([id, t]) => mk(id, t, true));

    // Some installs only expose paused timers via sorted_all
    if (pausedTimers.length === 0 && all.length > 0) {
      pausedTimers = all
        .filter(([id, t]) => t && String(t.status).toUpperCase() === "PAUSED")
        .map(([id, t]) => mk(id, t, true));
    }

    return [...activeTimers, ...pausedTimers];
  }
  _parseHelper(entityId, entityState, entityConf) {
    try {
      const data = JSON.parse(entityState.state || '{"timers":[]}');
      if (!data?.timers?.map) return [];
      return data.timers.map((timer) => ({
        ...timer,
        source: "helper",
        source_entity: entityId,
        label: timer.label || entityConf?.name || "Timer",
        icon: timer.icon || entityConf?.icon || "mdi:timer-outline",
        color: timer.color || entityConf?.color || "var(--primary-color)",
      }));
    } catch { return []; }
  }
  _parseTimestamp(entityId, entityState, entityConf) {
    const s = entityState.state; if (!s || s === "unknown" || s === "unavailable") return [];
    const endMs = Date.parse(s); if (isNaN(endMs)) return [];
    return [{ id:`${entityId}-${endMs}`, source:"timestamp", source_entity:entityId, label:entityConf?.name||entityState.attributes.friendly_name||"Timer", icon:entityConf?.icon||"mdi:timer-sand", color:entityConf?.color||"var(--primary-color)", end:endMs, duration:null }];
  }
  _parseMinutesAttr(entityId, entityState, entityConf) {
    const attrName = entityConf?.minutes_attr || "Minutes to arrival";
    const minutes = Number(entityState?.attributes?.[attrName]); if (!isFinite(minutes)) return [];
    const endMs = Date.now() + Math.max(0, minutes) * 60000;
    return [{ id:`${entityId}-eta-${Math.floor(endMs/1000)}`, source:"minutes_attr", source_entity:entityId, label:entityConf?.name||entityState.attributes.friendly_name||"ETA", icon:entityConf?.icon||"mdi:clock-outline", color:entityConf?.color||"var(--primary-color)", end:endMs, duration:null }];
  }
  _parseTimer(entityId, entityState, entityConf) {
    const state = entityState.state; const attrs = entityState.attributes;
    if (state !== "active" && state !== "paused") return [];
    let endMs = null; let duration = null;
    if (attrs.finishes_at) endMs = Date.parse(attrs.finishes_at);
    else if (attrs.remaining && attrs.remaining !== "0:00:00") {
      const remaining = this._parseHMSToMs(attrs.remaining); if (remaining > 0) endMs = Date.now() + remaining;
    }
    if (attrs.duration) duration = this._parseHMSToMs(attrs.duration);
    if (!endMs) return [];
    return [{
      id: `${entityId}-${state}`, source: "timer", source_entity: entityId,
      label: entityConf?.name || entityState.attributes.friendly_name || "Timer",
      icon: entityConf?.icon || (state === "paused" ? "mdi:timer-pause" : "mdi:timer"),
      color: entityConf?.color || (state === "paused" ? "var(--warning-color)" : "var(--primary-color)"),
      end: endMs, duration, paused: state === "paused"
    }];
  }
  _parseHMSToMs(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 3) return (parts[0]*3600 + parts[1]*60 + parts[2]) * 1000;
    if (parts.length === 2) return (parts[0]*60 + parts[1]) * 1000;
    return 0;
  }

  _updateTimers() {
    if (!this.hass) return;

    const collected = [];
    for (const entityConfig of this._config.entities) {
      const entityId = typeof entityConfig === "string" ? entityConfig : entityConfig.entity;
      const conf = typeof entityConfig === "string" ? {} : entityConfig;
      const st = this.hass.states[entityId];
      if (!st) { console.warn(`Entity not found: ${entityId}`); continue; }
      const mode = conf.mode || this._detectMode(entityId, st, conf);

      try {
        if (mode === "alexa") collected.push(...this._parseAlexa(entityId, st, conf));
        else if (mode === "helper") collected.push(...this._parseHelper(entityId, st, conf));
        else if (mode === "timer") collected.push(...this._parseTimer(entityId, st, conf));
        else if (mode === "minutes_attr") collected.push(...this._parseMinutesAttr(entityId, st, conf));
        else if (mode === "timestamp") collected.push(...this._parseTimestamp(entityId, st, conf));
      } catch (e) { console.error(`Failed to parse ${entityId} (${mode})`, e); }
    }

    if (this._config.storage === "local" || this._config.storage === "mqtt") {
      collected.push(...this._loadTimersFromStorage());
    }

    const filtered = collected.filter(
      (t) => !(t.source === "alexa" && this._dismissed.has(`${t.source_entity}:${t.id}`))
    );

    const now = Date.now();
    this._timers = filtered
      .map((t) => {
        let remaining;
        if (t.paused) {
          if (t.end > 0 && t.end < 86400000) {
            remaining = t.end;
          } else if (t.end > 0 && t.end > now && t.end < (now + 86400000)) {
            remaining = Math.max(0, t.end - now);
          } else if (t.duration && t.duration > 0) {
            remaining = Math.min(t.duration, t.end > 0 ? t.end : t.duration * 0.5);
          } else {
            remaining = t.end > 0 ? t.end : 60000;
          }
        } else {
          remaining = Math.max(0, t.end - now);
        }
        const percent = t.duration && !t.paused ? ((t.duration - remaining) / t.duration) * 100 : null;
        return { ...t, remaining, percent };
      })
      .sort((a, b) => a.remaining - b.remaining);

    for (const timer of this._timers) {
      const isNowRinging = timer.remaining <= 0 && !timer.paused;
      const wasRinging = this._ringingTimers.has(timer.id);
      if (isNowRinging && !wasRinging) { this._ringingTimers.add(timer.id); this._playAudioNotification(); }
      else if (!isNowRinging && wasRinging) { this._ringingTimers.delete(timer.id); }
    }
    const ids = new Set(this._timers.map((t) => t.id));
    for (const r of this._ringingTimers) if (!ids.has(r)) this._ringingTimers.delete(r);

    const now2 = Date.now();
    for (const timer of [...this._timers]) {
      if (timer.remaining > 0 || timer.paused) continue;
      if (timer.source === "helper") {
        if (this._config.auto_dismiss_writable || this._config.expire_action === "dismiss") {
          this._handleDismiss(timer);
        } else if (this._config.expire_action === "remove") {
          this._handleCancel(timer);
        } else if (this._config.expire_action === "keep") {
          timer.expiredAt ??= now2;
          const keepMs = (this._config.expire_keep_for || 0) * 1000;
          if (keepMs > 0 && now2 - timer.expiredAt > keepMs) this._handleDismiss(timer);
        }
      } else if (timer.source === "local" || timer.source === "mqtt") {
        if (this._config.expire_action === "dismiss" || this._config.expire_action === "remove") {
          this._removeTimerFromStorage(timer.id, timer.source);
        } else if (this._config.expire_action === "keep") {
          timer.expiredAt ??= now2;
          const keepMs = (this._config.expire_keep_for || 0) * 1000;
          if (keepMs > 0 && now2 - timer.expiredAt > keepMs) this._removeTimerFromStorage(timer.id, timer.source);
        }
      }
    }
  }

  _playAudioNotification() {
    if (!this._config.audio_enabled || !this._config.audio_file_url) return;
    try {
      const audio = new Audio(this._config.audio_file_url);
      let playCount = 0;
      const maxPlays = Math.max(1, Math.min(10, this._config.audio_repeat_count || 1));
      const playNext = () => {
        if (playCount < maxPlays) { playCount++; audio.currentTime = 0; audio.play().catch(() => {}); }
      };
      audio.addEventListener("ended", playNext);
      playNext();
    } catch {}
  }

  _parseDuration(durationStr) {
    if (!durationStr) return 0;
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
    let data; try { data = JSON.parse(state); } catch { data = { timers: [] }; }
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
    if (durationMs <= 0) return;
    const endTime = Date.now() + durationMs;

    this._mutateHelper(targetEntity, (data) => {
      const newTimer = {
        id: `custom-${Date.now()}`,
        label: label || "Timer",
        icon: this._config.default_timer_icon || "mdi:timer-outline",
        color: this._config.default_timer_color || "var(--primary-color)",
        end: endTime,
        duration: durationMs,
        source: "helper",
      };
      data.timers.push(newTimer);
    });
  }

  _createPresetTimer(minutes, entity = null) {
    const durationMs = minutes * 60000;
    const label = this._formatTimerLabel(minutes);
    
    if (entity) {
      const newTimer = { id: `preset-${Date.now()}`, label, icon: this._config.default_timer_icon || "mdi:timer-outline", color: this._config.default_timer_color || "var(--primary-color)", end: Date.now() + durationMs, duration: durationMs };

      if (entity.startsWith("input_text.") || entity.startsWith("text.")) {
        newTimer.source = "helper"; newTimer.source_entity = entity;
        this._mutateHelper(entity, (data) => { data.timers.push(newTimer); });
      } else if (entity === this._config.mqtt?.sensor_entity) {
        newTimer.source = "mqtt"; newTimer.source_entity = entity; this._addTimerToStorage(newTimer); this.requestUpdate();
      } else {
        newTimer.source = this._config.storage; newTimer.source_entity = this._config.storage === "mqtt" ? this._config.mqtt.sensor_entity : "local";
        this._addTimerToStorage(newTimer); this.requestUpdate();
      }
    } else {
      this._createAndSaveTimer(durationMs / 1000, label);
      this.requestUpdate();
    }
  }

  _formatTimerLabel(minutes) {
    if (minutes < 60) return `${minutes}m Timer`;
    if (minutes === 60) return "1h Timer";
    if (minutes % 60 === 0) return `${minutes / 60}h Timer`;
    return `${Math.floor(minutes / 60)}h${minutes % 60}m Timer`;
  }

  _handleCancel(timer) {
    this._ringingTimers.delete(timer.id);
    if (timer.source === "helper") {
      this._mutateHelper(timer.source_entity, (data) => { data.timers = data.timers.filter((t) => t.id !== timer.id); });
    } else if (timer.source === "local" || timer.source === "mqtt") {
      this._removeTimerFromStorage(timer.id, timer.source);
      this.requestUpdate();
    } else if (timer.source === "timer") {
      this.hass.callService("timer", "cancel", { entity_id: timer.source_entity });
    } else {
      this._toast?.("This timer can't be cancelled from here.");
    }
  }
  _handleDismiss(timer) {
    this._ringingTimers.delete(timer.id);
    if (timer.source === "helper") {
      this._mutateHelper(timer.source_entity, (data) => { data.timers = data.timers.filter((t) => t.id !== timer.id); });
    } else if (timer.source === "local" || timer.source === "mqtt") {
      this._removeTimerFromStorage(timer.id, timer.source); this.requestUpdate();
    } else if (timer.source === "timer") {
      this.hass.callService("timer", "finish", { entity_id: timer.source_entity });
    } else {
      this._dismissed.add(`${timer.source_entity}:${timer.id}`);
    }
  }
  _handleSnooze(timer) {
    this._ringingTimers.delete(timer.id);
    const snoozeMinutes = this._config.snooze_duration;
    const newDurationMs = snoozeMinutes * 60000;
    const newEndTime = Date.now() + newDurationMs;

    if (timer.source === "helper") {
      this._mutateHelper(timer.source_entity, (data) => {
        const idx = data.timers.findIndex((t) => t.id === timer.id);
        if (idx !== -1) { data.timers[idx].end = newEndTime; data.timers[idx].duration = newDurationMs; }
      });
    } else if (timer.source === "local" || timer.source === "mqtt") {
      this._updateTimerInStorage(timer.id, { end: newEndTime, duration: newDurationMs }, timer.source);
      this.requestUpdate();
    } else if (timer.source === "timer") {
      const str = this._formatDurationForTimer(snoozeMinutes * 60);
      this.hass.callService("timer", "start", { entity_id: timer.source_entity, duration: str });
    } else {
      this._toast?.("Only helper, local, MQTT, and timer entities can be snoozed here.");
    }
  }
  _formatDurationForTimer(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  _formatTime(ms) {
    if (ms <= 0) return "00:00";
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  _formatSecs(secs) {
    if (secs <= 0) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  _toggleCustom(which) {
    const openKey = `noTimer${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    this._ui[openKey] = !this._ui[openKey];
  }
  _adjust(which, minutes, sign = +1) {
    const delta = Math.max(0, (minutes | 0) * 60);
    this._customSecs = { ...this._customSecs, [which]: Math.max(0, this._customSecs[which] + sign * delta) };
  }
  _createAndSaveTimer(secs, label, useDefaultEntity = true) {
    if (secs <= 0) return;

    const helperEntities = useDefaultEntity ? (this._config.entities || [])
      .map((e) => (typeof e === "string" ? e : e.entity))
      .filter((id) => id && (id.startsWith("input_text.") || id.startsWith("text."))) : [];
    const targetEntity = useDefaultEntity ? 
      (this._config.default_timer_entity || (helperEntities.length === 1 ? helperEntities[0] : null)) : null;

    const newTimer = {
      id: `custom-${Date.now()}`, label: label || "Timer", icon: this._config.default_timer_icon || "mdi:timer-outline",
      color: this._config.default_timer_color || "var(--primary-color)", end: Date.now() + secs * 1000, duration: secs * 1000,
    };

    if (targetEntity) {
      if (targetEntity.startsWith("input_text.") || targetEntity.startsWith("text.")) {
        newTimer.source = "helper"; newTimer.source_entity = targetEntity;
        this._mutateHelper(targetEntity, (data) => { data.timers.push(newTimer); });
      } else if (targetEntity === this._config.mqtt?.sensor_entity) {
        newTimer.source = "mqtt"; newTimer.source_entity = targetEntity; this._addTimerToStorage(newTimer);
      } else {
        newTimer.source = this._config.storage; newTimer.source_entity = this._config.storage === "mqtt" ? this._config.mqtt.sensor_entity : "local";
        this._addTimerToStorage(newTimer);
      }
    } else {
      newTimer.source = this._config.storage; newTimer.source_entity = this._config.storage === "mqtt" ? this._config.mqtt.sensor_entity : "local";
      this._addTimerToStorage(newTimer);
    }
  }

  _startFromCustom(which, label) {
    const secs = this._customSecs[which];
    this._createAndSaveTimer(secs, label);
    this._customSecs = { ...this._customSecs, [which]: 15 * 60 };
    const openKey = `noTimer${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    this._ui[openKey] = false;
  }
  _toggleActivePicker(which) {
    const openKey = `active${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    this._ui[openKey] = !this._ui[openKey];
  }
  _adjustActive(which, minutes, sign = +1) {
    const delta = Math.max(0, (minutes | 0) * 60);
    this._activeSecs = { ...this._activeSecs, [which]: Math.max(0, this._activeSecs[which] + sign * delta) };
  }
  _startActive(which, label) {
    const secs = this._activeSecs[which];
    this._createAndSaveTimer(secs, label);
    this._activeSecs = { ...this._activeSecs, [which]: 10 * 60 };
    const openKey = `active${which.charAt(0).toUpperCase() + which.slice(1)}Open`;
    this._ui[openKey] = false;
  }

  _renderItem(t, style) {
    const color = t.color || "var(--primary-color)";
    const ring = t.remaining <= 0;
    const pct = typeof t.percent === "number" ? Math.max(0, Math.min(100, t.percent)) : 0;
    const pctLeft = 100 - pct;

    const isFillStyle = style === "fill";
    const baseClasses = isFillStyle ? "card item" : "item bar";
    const finishedClasses = isFillStyle ? "card item finished" : "card item bar";

    if (ring) {
      return html`
        <li class="${finishedClasses}" style="--tcolor:${color}">
          ${isFillStyle ? html`<div class="progress-fill" style="width:100%"></div>` : ""}
          <div class="${isFillStyle ? "card-content" : "row"}">
            <div class="icon-wrap"><ha-icon .icon=${t.icon || "mdi:timer-outline"}></ha-icon></div>
            <div class="info">
              <div class="title">${t.label}</div>
              <div class="status up">Time's up!</div>
            </div>
            ${t.source !== "alexa" ? html`
              <div class="chips">
                <button class="chip" @click=${() => this._handleSnooze(t)}>Snooze</button>
                <button class="chip" @click=${() => this._handleDismiss(t)}>Dismiss</button>
              </div>
            ` : ""}
          </div>
        </li>
      `;
    }

    if (isFillStyle) {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}">
          <div class="progress-fill" style="width:${pct}%"></div>
          <div class="card-content">
            <div class="icon-wrap"><ha-icon .icon=${t.icon || "mdi:timer-outline"}></ha-icon></div>
            <div class="info">
              <div class="title">${t.label}</div>
              <div class="status">${t.paused ? `${this._formatTime(t.remaining)} (Paused)` : this._formatTime(t.remaining)}</div>
            </div>
            ${t.source !== "alexa" ? html`<button class="x" title="Cancel" @click=${() => this._handleCancel(t)}><ha-icon icon="mdi:close"></ha-icon></button>` : ""}
          </div>
        </li>
      `;
    } else {
      return html`
        <li class="${baseClasses}" style="--tcolor:${color}">
          <div class="row">
            <div class="icon-wrap"><ha-icon .icon=${t.icon || "mdi:timer-outline"}></ha-icon></div>
            <div class="info">
              <div class="top">
                <div class="title">${t.label}</div>
                <div class="status">${t.paused ? `${this._formatTime(t.remaining)} (Paused)` : this._formatTime(t.remaining)}</div>
              </div>
              <div class="track"><div class="fill" style="width:${pctLeft}%"></div></div>
            </div>
            ${t.source !== "alexa" ? html`<button class="x" title="Cancel" @click=${() => this._handleCancel(t)}><ha-icon icon="mdi:close"></ha-icon></button>` : ""}
          </div>
        </li>
      `;
    }
  }

  render() {
    if (!this._config) return html``;

    const presets = this._config.show_timer_presets === false
      ? []
      : (this._config.timer_presets && this._config.timer_presets.length ? this._config.timer_presets : [5, 15, 30]);

    const minuteButtons = this._config.minute_buttons && this._config.minute_buttons.length ? this._config.minute_buttons : [1, 5, 10];

    const timers = this._timers;
    const layout = this._config.layout;
    const style = this._config.style;

    const noTimerCard = layout === "horizontal" ? html`
      <div class="card nt-h ${this._ui.noTimerHorizontalOpen ? "expanded" : ""}">
        <div class="row">
          <div class="card-content">
            <div class="icon-wrap"><ha-icon icon="mdi:timer-off"></ha-icon></div>
            <div>
              <p class="nt-title">No Timers</p>
              <p class="nt-sub">Click to start</p>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            ${presets.map((m) => html`
              <button class="btn btn-preset" @click=${() => this._createPresetTimer(m, this._config.default_timer_entity)}>${m}m</button>
            `)}
            <button class="btn btn-ghost" @click=${() => this._toggleCustom("horizontal")}>Custom</button>
          </div>
        </div>

        <div class="picker">
          <div class="grid-3">
            ${minuteButtons.map(m => html`<button class="btn btn-ghost" @click=${() => this._adjust("horizontal", m, +1)}>+${m}m</button>`)}
          </div>
          <div class="display">${this._formatSecs(this._customSecs.horizontal)}</div>
          <div class="grid-3">
            ${minuteButtons.map(m => html`<button class="btn btn-ghost" @click=${() => this._adjust("horizontal", m, -1)}>-${m}m</button>`)}
          </div>
          <input id="nt-h-name" class="text-input" placeholder="Timer Name (Optional)" />
          <div class="actions">
            <button class="btn btn-ghost" @click=${() => (this._ui.noTimerHorizontalOpen = false)}>Cancel</button>
            <button class="btn btn-primary" @click=${() => this._startFromCustom("horizontal", this.shadowRoot?.getElementById("nt-h-name")?.value?.trim())}>Start</button>
          </div>
        </div>
      </div>
    ` : html`
      <div class="card nt-v ${this._ui.noTimerVerticalOpen ? "expanded" : ""}">
        <div class="col">
          <div class="card-content" style="flex-direction:column;justify-content:center;gap:8px;flex:1;">
            <div class="icon-wrap"><ha-icon icon="mdi:timer-off"></ha-icon></div>
            <p class="nt-title">No Active Timers</p>
          </div>
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            ${presets.map((m) => html`
              <button class="btn btn-preset" @click=${() => this._createPresetTimer(m, this._config.default_timer_entity)}>${m}m</button>
            `)}
            <button class="btn btn-ghost" @click=${() => this._toggleCustom("vertical")}>Custom</button>
          </div>
        </div>

        <div class="picker">
          <div class="grid-3">
            ${minuteButtons.map(m => html`<button class="btn btn-ghost" @click=${() => this._adjust("vertical", m, +1)}>+${m}m</button>`)}
          </div>
          <div class="display">${this._formatSecs(this._customSecs.vertical)}</div>
          <div class="grid-3">
            ${minuteButtons.map(m => html`<button class="btn btn-ghost" @click=${() => this._adjust("vertical", m, -1)}>-${m}m</button>`)}
          </div>
          <input id="nt-v-name" class="text-input" placeholder="Timer Name (Optional)" />
          <div class="actions">
            <button class="btn btn-ghost" @click=${() => (this._ui.noTimerVerticalOpen = false)}>Cancel</button>
            <button class="btn btn-primary" @click=${() => this._startFromCustom("vertical", this.shadowRoot?.getElementById("nt-v-name")?.value?.trim())}>Start</button>
          </div>
        </div>
      </div>
    `;

    const activeCard = style === "fill" ? html`
      <div class="card ${this._ui.activeFillOpen ? "card-show" : ""}">
        ${this._config.show_active_header !== false ? html`
          <div class="active-head">
            <h4>Active Timers</h4>
            <button class="btn btn-add" @click=${() => this._toggleActivePicker("fill")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> Add</button>
          </div>
        ` : ""}

        <div class="active-picker">
          <div class="grid-3">
            ${minuteButtons.map(m => html`<button class="btn btn-ghost" @click=${() => this._adjustActive("fill", m, +1)}>+${m}m</button>`)}
          </div>
          <div class="display" style="font-size:30px;">${this._formatSecs(this._activeSecs.fill)}</div>
          <div class="grid-3">
            ${minuteButtons.map(m => html`<button class="btn btn-ghost" @click=${() => this._adjustActive("fill", m, -1)}>-${m}m</button>`)}
          </div>
          <input id="add-fill-name" class="text-input" placeholder="Timer Name (Optional)" />
          <div class="actions">
            <button class="btn btn-ghost" @click=${() => (this._ui.activeFillOpen = false)}>Cancel</button>
            <button class="btn btn-primary" @click=${() => this._startActive("fill", this.shadowRoot?.getElementById("add-fill-name")?.value?.trim())}>Start</button>
          </div>
        </div>

        <ul class="list">
          ${timers.map((t) => this._renderItem(t, style))}
        </ul>
      </div>
    ` : html`
      <div class="card ${this._ui.activeBarOpen ? "card-show" : ""}">
        ${this._config.show_active_header !== false ? html`
          <div class="active-head">
            <h4>Active Timers</h4>
            <button class="btn btn-add" @click=${() => this._toggleActivePicker("bar")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> Add</button>
          </div>
        ` : ""}

        <div class="active-picker">
          <div class="grid-3">
            ${minuteButtons.map(m => html`<button class="btn btn-ghost" @click=${() => this._adjustActive("bar", m, +1)}>+${m}m</button>`)}
          </div>
          <div class="display" style="font-size:30px;">${this._formatSecs(this._activeSecs.bar)}</div>
          <div class="grid-3">
            ${minuteButtons.map(m => html`<button class="btn btn-ghost" @click=${() => this._adjustActive("bar", m, -1)}>-${m}m</button>`)}
          </div>
          <input id="add-bar-name" class="text-input" placeholder="Timer Name (Optional)" />
          <div class="actions">
            <button class="btn btn-ghost" @click=${() => (this._ui.activeBarOpen = false)}>Cancel</button>
            <button class="btn btn-primary" @click=${() => this._startActive("bar", this.shadowRoot?.getElementById("add-bar-name")?.value?.trim())}>Start</button>
          </div>
        </div>

        <ul class="list">
          ${timers.map((t) => this._renderItem(t, style))}
        </ul>
      </div>
    `;

    return html`
      <ha-card>
        ${this._config.title ? html`<div class="card-header"><span>${this._config.title}</span></div>` : ""}

        ${timers.length === 0 ? html`
          <div class="grid"><div>${noTimerCard}</div></div>
        ` : html`
          <div class="grid"><div>${activeCard}</div></div>
        `}
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host { --stc-radius: 24px; --stc-chip-radius: 9999px; }
      ha-card { border-radius: 16px; }

      .section { padding: 12px 16px 0; }
      .section h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 600; }

      .grid { display: grid; grid-template-columns: 1fr; gap: 12px; padding: 0; }

      .card {
        background: var(--ha-card-background, var(--card-background-color));
        border-radius: var(--stc-radius);
        position: relative; overflow: hidden;
        padding: 8px;
        box-sizing: border-box;
      }
      .card-content { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; }
      .progress-fill {
        position: absolute; top: 0; left: 0; height: 100%;
        width: 0%; border-radius: var(--stc-radius); z-index: 0; transition: width 1s linear;
        background: var(--tcolor, var(--primary-color)); opacity: 0.28;
      }
      .card.finished .progress-fill { width: 100% !important; }

      .nt-h { padding: 0 8px; height: 56px; transition: height .3s ease; }
      .nt-h.expanded { height: auto; }
      .nt-h .row { display: flex; align-items: center; justify-content: space-between; height: 56px; }

      .nt-v { padding: 0 12px; height: 120px; transition: height .3s ease; }
      .nt-v.expanded { height: auto; }
      .nt-v .col { display: flex; flex-direction: column; align-items: center; justify-content: space-between; height: 120px; width: 100%; }

      .picker, .active-picker { 
        max-height: 0; opacity: 0; overflow: hidden; 
        transition: max-height .5s ease, opacity .3s ease, padding-top .5s ease, margin-bottom .3s ease; 
        padding-top: 0; margin-bottom: 0; 
      }
      .card.expanded .picker { max-height: 320px; opacity: 1; padding: 12px 8px 8px; }
      .card-show .active-picker { max-height: 320px; opacity: 1; margin-bottom: 8px; }

      .icon-wrap {
        width: 36px; height: 36px; border-radius: 50%;
        background: var(--tcolor, var(--divider-color)); opacity: 0.5;
        display: flex; align-items: center; justify-content: center; flex: 0 0 36px;
      }
      .icon-wrap ha-icon { --mdc-icon-size: 22px; color: var(--primary-text-color); }

      .nt-title { margin: 0; font-size: 14px; font-weight: 500; line-height: 20px; }
      .nt-sub { margin: 0; font-size: 12px; color: var(--secondary-text-color); line-height: 16px; }

      .btn { font-weight: 600; border-radius: var(--stc-chip-radius); padding: 6px 10px; font-size: 12px; border: none; cursor: pointer; }
      .btn-preset { background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--primary-text-color); }
      .btn-preset:hover, .btn-add:hover { filter: brightness(1.1); }
      .btn-ghost { background: var(--card-background-color); border: 1px solid var(--divider-color); color: var(--primary-text-color); }
      .btn-ghost:hover { background: var(--secondary-background-color); }
      .btn-primary { background: var(--primary-color); color: var(--text-primary-color, #fff); }
      .btn-primary:hover { filter: brightness(0.95); }
      .btn-add { display: flex; align-items: center; gap: 8px; background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--secondary-text-color); }
      .btn-add:hover { color: var(--primary-text-color); }

      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 220px; margin: 0 auto; }
      .display { text-align: center; font-size: 36px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin: 8px 0; }
      .actions { display: flex; gap: 12px; max-width: 280px; margin: 10px auto 0; }
      .actions .btn { flex: 1; }

      .text-input {
        margin-top: 10px; width: 90%; text-align: center; padding: 8px 12px; font-size: 14px;
        border-radius: var(--stc-chip-radius);
        color: var(--primary-text-color); background: var(--card-background-color); border: 1px solid var(--divider-color);
        outline: none; margin-left: auto; margin-right: auto; display: block;
      }
      .text-input::placeholder { color: var(--secondary-text-color); }
      .text-input:focus { box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 40%, transparent); }

      .active-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
      .active-head h4 { margin: 0; font-size: 16px; font-weight: 600; color: var(--primary-text-color); }

      .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }

      .item { box-sizing: border-box; position: relative; border-radius: 16px; padding: 8px; height: 56px; background: var(--ha-card-background, var(--card-background-color)); }
      .item .icon-wrap { background: var(--tcolor, var(--divider-color)); opacity: 0.45; }
      .item .info { display: flex; flex-direction: column; justify-content: center; height: 36px; flex: 1; overflow: hidden; }
      .item .title { font-size: 14px; font-weight: 500; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .item .status { font-size: 12px; color: var(--secondary-text-color); line-height: 16px; font-variant-numeric: tabular-nums; }
      .item .status.up { color: color-mix(in srgb, var(--tcolor, var(--primary-color)) 70%, white); }
      .item .x { color: var(--secondary-text-color); background: none; border: 0; padding: 4px; cursor: pointer; }
      .item .x:hover { color: var(--primary-text-color); }

      .bar .row { display: flex; align-items: center; gap: 12px; }
      .bar .top { display: flex; align-items: center; justify-content: space-between; height: 18px; }
      .track { width: 100%; height: 8px; border-radius: var(--stc-chip-radius); background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 10%, transparent); margin-top: 2px; overflow: hidden; }
      .fill { height: 100%; width: 0%; border-radius: var(--stc-chip-radius); background: var(--tcolor, var(--primary-color)); transition: width 1s linear; }

      .chips { display: flex; gap: 6px; }
      .chip { font-weight: 600; color: color-mix(in srgb, var(--tcolor, var(--primary-color)) 70%, white); border-radius: var(--stc-chip-radius); padding: 4px 8px; font-size: 12px; background: none; border: 0; cursor: pointer; }
      .chip:hover { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 18%, transparent); }
    `;
  }

  _toast(msg) {
    const ev = new Event("hass-notification", { bubbles: true, composed: true });
    ev.detail = { message: msg };
    this.dispatchEvent(ev);
  }
}

/* ---------------- Editor ---------------- */
class SimpleTimerCardEditor extends LitElement {
  static get properties() { return { hass: {}, _config: {} }; }

  constructor() {
    super();
    this._debounceTimeout = null;
    this._emitTimeout = null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._debounceTimeout) { clearTimeout(this._debounceTimeout); this._debounceTimeout = null; }
    if (this._emitTimeout) { clearTimeout(this._emitTimeout); this._emitTimeout = null; }
  }

  setConfig(config) {
    this._config = { ...config, entities: Array.isArray(config.entities) ? [...config.entities] : [] };
    this.requestUpdate();
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue;
    if (!key) return;

    const hasChecked = target.checked !== undefined;
    let value = hasChecked ? target.checked : target.value;

    if (key === "timer_presets" && typeof value === "string") {
      value = value.split(",").map((v) => parseInt(v.trim())).filter((v) => !isNaN(v) && v > 0);
      if (value.length === 0) value = [5, 15, 30];
    }
    if (key === "minute_buttons" && typeof value === "string") {
      value = value.split(",").map((v) => parseInt(v.trim())).filter((v) => !isNaN(v) && v > 0);
      if (value.length === 0) value = [1, 5, 10];
    }
    if (value === undefined || value === null) return;
    this._updateConfig({ [key]: value });
  }
  _detailValueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target; const key = target.configValue; if (!key) return;
    this._updateConfig({ [key]: ev.detail.value });
  }
  _selectChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target; const key = target.configValue; if (!key) return;
    ev.stopPropagation();
    const value = ev.detail?.value !== undefined ? ev.detail.value : target.value;
    if (typeof value !== "string" || value === "") return;
    this._updateConfig({ [key]: value }, true);
  }
  _entityValueChanged(e, index) {
    if (!this._config || !this.hass) return;
    if (e.stopPropagation) e.stopPropagation();
    if (index < 0 || index >= (this._config.entities || []).length) return;

    const target = e.target; const key = target.configValue; if (!key) return;
    let value; if (e.detail && e.detail.value !== undefined) value = e.detail.value;
    else if (target.value !== undefined) value = target.value; else return;

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
  _debouncedUpdate(changes) {
    if (this._debounceTimeout) clearTimeout(this._debounceTimeout);
    this._debounceTimeout = setTimeout(() => { this._updateConfig(changes); this._debounceTimeout = null; }, 100);
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
    } catch (error) { console.error("Error emitting config change:", error); }
  }

  _removeDefaultValues(config) {
    const defaults = {
      layout: "horizontal",
      style: "bar",
      show_timer_presets: true,
      timer_presets: [5, 15, 30],
      expire_action: "keep",
      snooze_duration: 5,
      show_active_header: true,
      minute_buttons: [1, 5, 10],
      default_timer_icon: "mdi:timer-outline",
      default_timer_color: "var(--primary-color)",
      expire_keep_for: 120,
      auto_dismiss_writable: false,
      show_progress_when_unknown: false,
      audio_enabled: false,
      audio_file_url: "",
      audio_repeat_count: 1,
      show_time_selector: false,
      default_timer_entity: null
    };

    const cleaned = { ...config };

    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (key in cleaned) {
        if (Array.isArray(defaultValue)) {
          if (Array.isArray(cleaned[key]) && 
              cleaned[key].length === defaultValue.length &&
              cleaned[key].every((val, index) => val === defaultValue[index])) {
            delete cleaned[key];
          }
        } else if (cleaned[key] === defaultValue) {
          delete cleaned[key];
        }
      }
    }

    return cleaned;
  }
  _mqttValueChanged(ev) {
    if (!this._config || !this.hass) return;
    const key = ev.target.configValue; if (!key) return;
    const value = ev.target.value || "";
    const mqttKey = key.replace("mqtt_", "");
    const newMqttConfig = { ...this._config.mqtt, [mqttKey]: value };
    this._updateConfig({ mqtt: newMqttConfig });
  }
  _mqttDetailValueChanged(ev) {
    if (!this._config || !this.hass) return;
    const key = ev.target.configValue; if (!key) return;
    const value = ev.detail.value || "";
    const mqttKey = key.replace("mqtt_", "");
    const newMqttConfig = { ...this._config.mqtt, [mqttKey]: value };
    this._updateConfig({ mqtt: newMqttConfig });
  }

  async firstUpdated() {
    const tags = [
      "ha-entity-picker",
      "ha-select",
      "ha-textfield",
      "ha-icon-picker",
      "ha-form",
      "mwc-list-item"
    ];
    await Promise.all(tags.map(t => customElements.whenDefined(t).catch(() => {})));
    this.requestUpdate();
  }

  render() {
    if (!this.hass || !this._config) return html``;

    return html`
      <div class="card-config">
        <ha-textfield label="Title (Optional)" .value=${this._config.title || ""} .configValue=${"title"} @input=${this._valueChanged}></ha-textfield>

        <div class="side-by-side">
          <ha-select label="Layout" .value=${this._config.layout || "horizontal"} .configValue=${"layout"} @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
            <mwc-list-item value="horizontal">Horizontal</mwc-list-item>
            <mwc-list-item value="vertical">Vertical</mwc-list-item>
          </ha-select>

          <ha-select label="Style" .value=${this._config.style || "bar"} .configValue=${"style"} @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
            <mwc-list-item value="fill">Background fill</mwc-list-item>
            <mwc-list-item value="bar">Progress bar</mwc-list-item>
          </ha-select>
        </div>

        ${this._config.storage && this._config.storage !== "unknown" ? html`
          <div class="storage-info">
            <span class="storage-label">Storage type: <strong>${this._getStorageDisplayName(this._config.storage)}</strong></span>
            <small class="storage-description">${this._getStorageDescription(this._config.storage)}</small>
          </div>
        ` : ""}

        ${this._config.storage === "mqtt" ? html`
          <div class="mqtt-config">
            <ha-textfield label="Topic" .value=${this._config.mqtt?.topic || "simple_timer_card/timers"} .configValue=${"mqtt_topic"} @input=${this._mqttValueChanged}></ha-textfield>
            <ha-textfield label="State topic (optional)" .value=${this._config.mqtt?.state_topic || "simple_timer_card/timers/state"} .configValue=${"mqtt_state_topic"} @input=${this._mqttValueChanged}></ha-textfield>
            <ha-entity-picker .hass=${this.hass} .value=${this._config.mqtt?.sensor_entity || "sensor.simple_timer_store"} .configValue=${"mqtt_sensor_entity"} @value-changed=${this._mqttDetailValueChanged} label="Sensor entity" allow-custom-entity .includeDomains=${["sensor"]}></ha-entity-picker>
          </div>
        ` : ""}

        <div class="side-by-side">
          <ha-textfield label="Snooze Duration (minutes)" type="number" .value=${this._config.snooze_duration ?? 5} .configValue=${"snooze_duration"} @input=${this._valueChanged}></ha-textfield>

          <ha-select label="When timer reaches 0" .value=${this._config.expire_action || "keep"} .configValue=${"expire_action"} @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
            <mwc-list-item value="keep">Keep visible</mwc-list-item>
            <mwc-list-item value="dismiss">Dismiss</mwc-list-item>
            <mwc-list-item value="remove">Remove</mwc-list-item>
          </ha-select>
        </div>

        <div class="side-by-side">
          <ha-textfield label="Keep-visible duration (seconds)" type="number" .value=${this._config.expire_keep_for ?? 120} .configValue=${"expire_keep_for"} @input=${this._valueChanged}></ha-textfield>

          <ha-formfield label="Auto-dismiss helper timers at 0">
            <ha-switch .checked=${this._config.auto_dismiss_writable === true} .configValue=${"auto_dismiss_writable"} @change=${this._valueChanged}></ha-switch>
          </ha-formfield>
        </div>

        <ha-formfield label="Show timer preset buttons">
          <ha-switch .checked=${this._config.show_timer_presets !== false} .configValue=${"show_timer_presets"} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>

        ${this._config.show_timer_presets !== false ? html`
          <ha-textfield label="Timer presets (minutes, comma-separated)" .value=${(this._config.timer_presets || [5, 15, 30]).join(", ")} .configValue=${"timer_presets"} @input=${this._valueChanged}></ha-textfield>
          <ha-entity-picker .hass=${this.hass} .value=${this._config.default_timer_entity || ""} .configValue=${"default_timer_entity"} @value-changed=${this._detailValueChanged} label="Default timer entity (optional)" allow-custom-entity .includeDomains=${["input_text", "text", "timer", "sensor"]}></ha-entity-picker>
        ` : ""}

        <ha-formfield label="Show 'Active Timers' header">
          <ha-switch .checked=${this._config.show_active_header !== false} .configValue=${"show_active_header"} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>

        <ha-textfield label="Minute adjustment buttons (comma-separated)" .value=${(this._config.minute_buttons || [1, 5, 10]).join(", ")} .configValue=${"minute_buttons"} @input=${this._valueChanged}></ha-textfield>

        <div class="side-by-side">
          <ha-icon-picker label="Default timer icon" .value=${this._config.default_timer_icon || "mdi:timer-outline"} .configValue=${"default_timer_icon"} @value-changed=${this._detailValueChanged}></ha-icon-picker>
          <ha-textfield label="Default timer color" .value=${this._config.default_timer_color || "var(--primary-color)"} .configValue=${"default_timer_color"} @input=${this._valueChanged}></ha-textfield>
        </div>

        <ha-formfield label="Enable audio notifications">
          <ha-switch .checked=${this._config.audio_enabled === true} .configValue=${"audio_enabled"} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>

        ${this._config.audio_enabled ? html`
          <ha-textfield label="Audio file URL or path" .value=${this._config.audio_file_url || ""} .configValue=${"audio_file_url"} @input=${this._valueChanged}></ha-textfield>
          <ha-textfield label="Number of times to play" type="number" min="1" max="10" .value=${this._config.audio_repeat_count ?? 1} .configValue=${"audio_repeat_count"} @input=${this._valueChanged}></ha-textfield>
        ` : ""}

        <div class="entities-header">
          <h3>Timer Entities</h3>
          <button class="add-entity-button" @click=${this._addEntity} title="Add timer entity"><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>

        ${(this._config.entities || []).length === 0
          ? html`<div class="no-entities">No entities configured. Click the + button above to add timer entities.</div>`
          : (this._config.entities || []).map((entityConf, index) => {
              const entityId = typeof entityConf === "string" ? entityConf : (entityConf?.entity || "");
              const conf = typeof entityConf === "string" ? {} : (entityConf || {});
              return html`
                <div class="entity-editor">
                  <ha-entity-picker .hass=${this.hass} .value=${entityId} .configValue=${"entity"} allow-custom-entity
                    @value-changed=${(e) => this._entityValueChanged(e, index)}></ha-entity-picker>

                  <div class="entity-options">
                    <div class="side-by-side">
                      <ha-select label="Mode" .value=${conf.mode || "auto"} .configValue=${"mode"}
                        @selected=${(e) => { e.stopPropagation(); this._entityValueChanged(e, index); }} @closed=${(e) => { e.stopPropagation(); this._entityValueChanged(e, index); }}>
                        <mwc-list-item value="auto">Auto</mwc-list-item>
                        <mwc-list-item value="alexa">Alexa</mwc-list-item>
                        <mwc-list-item value="helper">Helper (input_text/text)</mwc-list-item>
                        <mwc-list-item value="timestamp">Timestamp sensor</mwc-list-item>
                        <mwc-list-item value="minutes_attr">Minutes attribute</mwc-list-item>
                      </ha-select>

                      <ha-textfield label="Minutes attribute (for minutes_attr)" .value=${conf.minutes_attr || ""} .configValue=${"minutes_attr"} @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>
                    </div>

                    <div class="side-by-side">
                      <ha-textfield label="Name Override" .value=${conf.name || ""} .configValue=${"name"} @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>
                      <ha-icon-picker label="Icon Override" .value=${conf.icon || ""} .configValue=${"icon"} @value-changed=${(e) => this._entityValueChanged(e, index)}></ha-icon-picker>
                      <ha-textfield label="Color Override" .value=${conf.color || ""} .configValue=${"color"} @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>
                    </div>
                  </div>

                  <button class="remove-entity" @click=${() => this._removeEntity(index)} title="Remove entity"><ha-icon icon="mdi:delete"></ha-icon></button>
                </div>
              `;
            })
        }
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
      case "local": return "Timers are stored locally in your browser and persist across sessions";
      case "helper": return "Timers are stored in Home Assistant helper entities (input_text/text)";
      case "mqtt": return "Timers are stored in MQTT for cross-device synchronization";
      default: return "";
    }
  }

  static get styles() {
    return css`
      .card-config { display: flex; flex-direction: column; gap: 12px; }
      .side-by-side { display: flex; gap: 12px; }
      .side-by-side > * { flex: 1; min-width: 0; }
      .storage-info { padding: 12px; background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 8px; display: flex; flex-direction: column; gap: 4px; }
      .storage-label { font-size: 0.9rem; color: var(--primary-text-color); }
      .storage-description { color: var(--secondary-text-color); font-size: 0.8rem; line-height: 1.2; }
      .mqtt-config { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--divider-color); border-radius: 8px; background: var(--card-background-color); }
      .entities-header { display: flex; justify-content: space-between; align-items: center; }
      .entities-header h3 { margin: 0; }
      .add-entity-button { background: var(--primary-color); border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; transition: filter .2s; }
      .add-entity-button:hover { filter: brightness(.9); }
      .add-entity-button ha-icon { --mdc-icon-size: 24px; }
      .no-entities { text-align: center; color: var(--secondary-text-color); padding: 16px; font-style: italic; border: 2px dashed var(--divider-color); border-radius: 8px; margin: 8px 0; }
      .entity-editor { border: 1px solid var(--divider-color); border-radius: 8px; padding: 12px; position: relative; }
      .entity-options { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
      .remove-entity { position: absolute; top: 4px; right: 4px; background: var(--error-color, #f44336); border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; transition: filter .2s; }
      .remove-entity:hover { filter: brightness(.9); }
      .remove-entity ha-icon { --mdc-icon-size: 20px; }
    `;
  }
}

/* ---- Register the card ---- */
if (!customElements.get("simple-timer-card")) {
  customElements.define("simple-timer-card", SimpleTimerCard);
}

/* ---- Hatch-style editor registration & placeholder swapping ---- */
const stcRegisterEditor = () => {
  const ready = !!(
    customElements.get("ha-entity-picker") ||
    customElements.get("ha-select") ||
    customElements.get("ha-textfield") ||
    customElements.get("ha-form")
  );
  if (ready && !customElements.get("simple-timer-card-editor")) {
    customElements.define("simple-timer-card-editor", SimpleTimerCardEditor);
  } else if (!ready) {
    setTimeout(stcRegisterEditor, 100);
  }
};

stcRegisterEditor();

window.addEventListener("location-changed", () => {
  setTimeout(stcRegisterEditor, 100);
});

/* Replace static getConfigElement with the placeholder-swapping version */
SimpleTimerCard.getConfigElement = function () {
  stcRegisterEditor(); 
  
  if (customElements.get("simple-timer-card-editor")) {
    return document.createElement("simple-timer-card-editor");
  } else {
    const placeholder = document.createElement("div");
    placeholder.innerHTML = "Loading editor...";
    
    const checkInterval = setInterval(() => {
      if (customElements.get("simple-timer-card-editor")) {
        clearInterval(checkInterval);
        const editor = document.createElement("simple-timer-card-editor");
        placeholder.replaceWith(editor);
        if (placeholder._config) {
          editor.setConfig(placeholder._config);
        }
        if (placeholder._hass) {
          editor.hass = placeholder._hass;
        }
      }
    }, 100);
    
    const originalSetConfig = placeholder.setConfig;
    placeholder.setConfig = function (config) {
      placeholder._config = config;
      if (originalSetConfig) originalSetConfig.call(placeholder, config);
    };
    
    Object.defineProperty(placeholder, 'hass', {
      set: function(hass) { placeholder._hass = hass; },
      get: function() { return placeholder._hass; }
    });
    
    return placeholder;
  }
};

/* ---- HA card registry entry ---- */
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
