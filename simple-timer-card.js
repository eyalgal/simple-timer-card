/*
 * Simple Timer Card (Adapterized)
 * v1.3.3 — Editor and service call fixes
 *
 * - Alexa timers (read-only)
 * - device_class: timestamp sensors (completion times)
 * - sensors with a numeric "minutes to arrival" attribute (ETA)
 * - input_text helper (JSON store) for fully controllable shared timers
 */
import { LitElement, html, css } from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

const cardVersion = "1.3.3";
console.info(`%c SIMPLE-TIMER-CARD %c v${cardVersion} `, "color: white; background: #4285f4; font-weight: 700;", "color: #4285f4; background: white; font-weight: 700;");

class SimpleTimerCard extends LitElement {
  static get properties() {
    return { hass: {}, _config: {}, _timers: { state: true }, _isAdding: { state: true }, _localTimers: { state: true }, _presetTarget: { state: true } };
  }

  constructor() {
    super();
    this._timers = [];
    this._timerInterval = null;
    this._isAdding = false;
    this._dismissed = new Set(); // local UI dismissal for read-only sources (e.g., Alexa)
    this._localTimers = []; // local timers when no entity is specified
    this._presetTarget = null;
  }

  setConfig(config) {
    // Allow empty entities array when timer presets are enabled
    if (!config.entities && !config.show_timer_presets) {
      throw new Error("You need to define an array of entities or enable timer presets.");
    }
    
    this._config = {
      layout: "vertical",               // 'vertical' | 'horizontal'
      style: "bar",                     // 'bar' | 'circle' | 'chip'
      snooze_duration: 5,               // minutes
      show_add_timer: false,
      timer_presets: [15, 30, 60, 120],   // preset durations in minutes
      show_timer_presets: true,         // show preset buttons
      default_timer_entity: null,       // default entity for timer storage
      expire_action: "keep",            // 'keep' | 'dismiss' | 'remove'
      expire_keep_for: 120,             // seconds to keep a rung timer visible
      auto_dismiss_writable: false,     // auto-dismiss helper timers when 0
      show_progress_when_unknown: false,  // show an empty track if duration unknown
      ...config,
      entities: config.entities || [],    // ensure entities is always an array
    };
    
    this._presetTarget = this._config.default_timer_entity || null;
  }

  static async getConfigElement() {
    return document.createElement("simple-timer-card-editor");
  }
  static getStubConfig() {
    return { 
      entities: [],
      show_timer_presets: true,
      timer_presets: [15, 30, 60, 120]
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

  // --------- Adapters ----------
  _detectMode(entityId, entityState, entityConf) {
    if (entityId.startsWith("input_text.") || entityId.startsWith("text.")) return "helper";
    if (entityId.startsWith("sensor.") && entityState?.attributes?.sorted_active) return "alexa";
    if (entityState?.attributes?.device_class === "timestamp") return "timestamp";
    const guessAttr = entityConf?.minutes_attr || "Minutes to arrival";
    if (entityState?.attributes && (entityState.attributes[guessAttr] ?? null) !== null) return "minutes_attr";
    return "timestamp";
  }

  _parseAlexa(entityId, entityState, entityConf) {
    let active = entityState.attributes.sorted_active;
    if (typeof active === "string") {
      try { active = JSON.parse(active); } catch { active = []; }
    }
    if (!Array.isArray(active)) return [];

    return active.map(([id, t]) => ({
      id,
      source: "alexa",
      source_entity: entityId,
      label: t.timerLabel || entityConf?.name || entityState.attributes.friendly_name || "Alexa Timer",
      icon: entityConf?.icon || "mdi:amazon-alexa",
      color: entityConf?.color || "var(--primary-color)",
      end: Number(t.triggerTime),
      duration: Number(t.originalDurationInMillis) || null,
    }));
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
    } catch {
      return [];
    }
  }

  _parseTimestamp(entityId, entityState, entityConf) {
    const s = entityState.state;
    if (!s || s === "unknown" || s === "unavailable") return [];
    const endMs = Date.parse(s);
    if (isNaN(endMs)) return [];
    return [
      {
        id: `${entityId}-${endMs}`,
        source: "timestamp",
        source_entity: entityId,
        label: entityConf?.name || entityState.attributes.friendly_name || "Timer",
        icon: entityConf?.icon || "mdi:timer-sand",
        color: entityConf?.color || "var(--primary-color)",
        end: endMs,
        duration: null,
      },
    ];
  }

  _parseMinutesAttr(entityId, entityState, entityConf) {
    const attrName = entityConf?.minutes_attr || "Minutes to arrival";
    const minutes = Number(entityState?.attributes?.[attrName]);
    if (!isFinite(minutes)) return [];
    const endMs = Date.now() + Math.max(0, minutes) * 60000;
    return [
      {
        id: `${entityId}-eta-${Math.floor(endMs / 1000)}`,
        source: "minutes_attr",
        source_entity: entityId,
        label: entityConf?.name || entityState.attributes.friendly_name || "ETA",
        icon: entityConf?.icon || "mdi:clock-outline",
        color: entityConf?.color || "var(--primary-color)",
        end: endMs,
        duration: null,
      },
    ];
  }
  // -----------------------------

  _updateTimers() {
    if (!this.hass) return;

    const collected = [];

    for (const entityConfig of this._config.entities) {
      const entityId = typeof entityConfig === "string" ? entityConfig : entityConfig.entity;
      const conf = typeof entityConfig === "string" ? {} : entityConfig;
      const st = this.hass.states[entityId];
      if (!st) {
        console.warn(`Entity not found: ${entityId}`);
        continue;
      }
      const mode = conf.mode || this._detectMode(entityId, st, conf);

      try {
        if (mode === "alexa") collected.push(...this._parseAlexa(entityId, st, conf));
        else if (mode === "helper") collected.push(...this._parseHelper(entityId, st, conf));
        else if (mode === "minutes_attr") collected.push(...this._parseMinutesAttr(entityId, st, conf));
        else if (mode === "timestamp") collected.push(...this._parseTimestamp(entityId, st, conf));
        else console.warn(`Unknown mode '${mode}' for ${entityId}`);
      } catch (e) {
        console.error(`Failed to parse ${entityId} (${mode})`, e);
      }
    }

    // Add local timers
    collected.push(...this._localTimers);

    // Hide locally dismissed Alexa timers until the sensor list changes
    const filtered = collected.filter(
      (t) => !(t.source === "alexa" && this._dismissed.has(`${t.source_entity}:${t.id}`))
    );

    const now = Date.now();
    this._timers = filtered
      .map((t) => {
        const remaining = Math.max(0, t.end - now);
        const percent = t.duration ? ((t.duration - remaining) / t.duration) * 100 : null;
        return { ...t, remaining, percent };
      })
      .sort((a, b) => a.remaining - b.remaining);

    // Expiration policy for helper and local timers
    for (const timer of [...this._timers]) {
      if (timer.remaining > 0) continue;

      if (timer.source === "helper") {
        if (this._config.auto_dismiss_writable || this._config.expire_action === "dismiss") {
          this._handleDismiss(timer);
        } else if (this._config.expire_action === "remove") {
          this._handleCancel(timer);
        } else if (this._config.expire_action === "keep") {
          timer.expiredAt ??= now;
          const keepMs = (this._config.expire_keep_for || 0) * 1000;
          if (keepMs > 0 && now - timer.expiredAt > keepMs) {
            this._handleDismiss(timer);
          }
        }
      } else if (timer.source === "local") {
        // Handle local timer expiration
        if (this._config.expire_action === "dismiss" || this._config.expire_action === "remove") {
          this._localTimers = this._localTimers.filter(t => t.id !== timer.id);
        } else if (this._config.expire_action === "keep") {
          timer.expiredAt ??= now;
          const keepMs = (this._config.expire_keep_for || 0) * 1000;
          if (keepMs > 0 && now - timer.expiredAt > keepMs) {
            this._localTimers = this._localTimers.filter(t => t.id !== timer.id);
          }
        }
      }
    }
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

    if (!hourMatch && !minuteMatch && !secondMatch && numberOnlyMatch) {
      totalSeconds = parseInt(numberOnlyMatch[0]) * 60;
    }

    return totalSeconds * 1000;
  }

  _mutateHelper(entityId, mutator) {
    const state = this.hass.states[entityId]?.state ?? '{"timers":[]}';
    let data;
    try { data = JSON.parse(state); } catch { data = { timers: [] }; }
    if (!Array.isArray(data.timers)) data.timers = [];
    mutator(data);
    
    const domain = entityId.split('.')[0];
    
    // **FIX**: Use the simpler and more reliable `entity_id` format for the service call.
    this.hass.callService(domain, "set_value", {
      entity_id: entityId,
      value: JSON.stringify({ ...data, version: 1 }),
    });
  }

  _handleCreateTimer(e) {
    const form = e.target;
    const durationStr = form.elements.duration.value;
    const label = form.elements.label.value;
    const targetEntity = form.elements.target_entity.value;

    const durationMs = this._parseDuration(durationStr);
    if (durationMs <= 0) {
      console.error("Invalid duration provided.");
      return;
    }
    const endTime = Date.now() + durationMs;

    this._mutateHelper(targetEntity, (data) => {
      const newTimer = {
        id: `custom-${Date.now()}`,
        label: label || "Timer",
        icon: "mdi:timer-outline",
        color: "var(--primary-color)",
        end: endTime,
        duration: durationMs,
        source: "helper",
      };
      data.timers.push(newTimer);
    });

    this._isAdding = false;
  }

  _createPresetTimer(minutes, entity = null) {
    const durationMs = minutes * 60000;
    const endTime = Date.now() + durationMs;
    const label = this._formatTimerLabel(minutes);

    const newTimer = {
      id: `preset-${Date.now()}`,
      label,
      icon: "mdi:timer-outline",
      color: "var(--primary-color)",
      end: endTime,
      duration: durationMs,
      source: entity ? "helper" : "local",
    };

    if (entity) {
      // Store in helper entity
      newTimer.source_entity = entity;
      this._mutateHelper(entity, (data) => {
        data.timers.push(newTimer);
      });
    } else {
      // Store locally
      newTimer.source_entity = "local"; // For consistency in timer handling
      this._localTimers.push(newTimer);
      this.requestUpdate();
    }

    this._isAdding = false;
  }

  _formatTimerLabel(minutes) {
    if (minutes < 60) {
      return `${minutes}m Timer`;
    } else if (minutes === 60) {
      return "1h Timer";
    } else if (minutes % 60 === 0) {
      return `${minutes / 60}h Timer`;
    } else {
      return `${Math.floor(minutes / 60)}h${minutes % 60}m Timer`;
    }
  }

  _handleCancel(timer) {
    if (timer.source === "helper") {
      this._mutateHelper(timer.source_entity, (data) => {
        data.timers = data.timers.filter((t) => t.id !== timer.id);
      });
    } else if (timer.source === "local") {
      this._localTimers = this._localTimers.filter((t) => t.id !== timer.id);
      this.requestUpdate();
    } else {
      this._toast?.("This timer can't be cancelled from here.");
    }
  }

  _handleDismiss(timer) {
    if (timer.source === "helper") {
      this._mutateHelper(timer.source_entity, (data) => {
        data.timers = data.timers.filter((t) => t.id !== timer.id);
      });
    } else if (timer.source === "local") {
      this._localTimers = this._localTimers.filter((t) => t.id !== timer.id);
      this.requestUpdate();
    } else {
      this._dismissed.add(`${timer.source_entity}:${timer.id}`);
    }
  }

  _handleSnooze(timer) {
    if (timer.source === "helper") {
      const snoozeMinutes = this._config.snooze_duration;
      const newDurationMs = snoozeMinutes * 60000;
      const newEndTime = Date.now() + newDurationMs;

      this._mutateHelper(timer.source_entity, (data) => {
        const idx = data.timers.findIndex((t) => t.id === timer.id);
        if (idx !== -1) {
          data.timers[idx].end = newEndTime;
          data.timers[idx].duration = newDurationMs;
        }
      });
    } else if (timer.source === "local") {
      const snoozeMinutes = this._config.snooze_duration;
      const newDurationMs = snoozeMinutes * 60000;
      const newEndTime = Date.now() + newDurationMs;

      const idx = this._localTimers.findIndex((t) => t.id === timer.id);
      if (idx !== -1) {
        this._localTimers[idx].end = newEndTime;
        this._localTimers[idx].duration = newDurationMs;
        this.requestUpdate();
      }
    } else {
      this._toast?.("Only helper and local timers can be snoozed here.");
    }
  }

  _formatTime(ms) {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  render() {
    if (!this._config) return html``;

    const helperEntities = (this._config.entities || [])
      .map((e) => (typeof e === "string" ? e : e.entity))
      .filter((id) => id && (id.startsWith("input_text.") || id.startsWith("text.")));

    const showAddButton = this._config.show_add_timer && (helperEntities.length > 0 || this._config.show_timer_presets);
    const showPresets = this._config.show_timer_presets !== false && this._config.timer_presets && this._config.timer_presets.length > 0;

    return html`
      <ha-card>
        ${this._config.title || showAddButton ? html`
        <div class="card-header">
          ${this._config.title ? html`<span>${this._config.title}</span>` : html`<span></span>`}
          ${showAddButton
            ? html`<ha-icon-button icon="mdi:plus" @click=${() => (this._isAdding = !this._isAdding)} .title=${"Add timer"}></ha-icon-button>`
            : ""}
        </div>` : ""}

        ${this._isAdding ? this._renderAddTimerForm(helperEntities) : ""}
        
        ${showPresets && !this._isAdding ? this._renderTimerPresets(helperEntities) : ""}

        <div class="timers-container ${this._config.layout}">
          ${this._timers.length === 0 ? html`<div class="no-timers">No active timers</div>` : this._timers.map((t) => this._renderTimer(t))}
        </div>
      </ha-card>
    `;
  }

  _renderAddTimerForm(helperEntities) {
    if (!this.hass) return html``;
    return html`
      <form class="add-timer-form" @submit=${(e) => { e.preventDefault(); this._handleCreateTimer(e); }}>
        <ha-textfield name="duration" label="Duration (e.g., 15m, 1h, 45s)" required></ha-textfield>
        <ha-textfield name="label" label="Label (Optional)"></ha-textfield>

        ${helperEntities.length > 1
          ? html`<ha-select name="target_entity" label="Add to..." required @selected=${(e) => (e.target.reportValidity?.(), 0)} @closed=${(e) => (e.target.reportValidity?.(), 0)}>
              ${helperEntities.map(
                (id) =>
                  html`<mwc-list-item value=${id}>${this.hass.states[id]?.attributes?.friendly_name || id}</mwc-list-item>`
              )}
            </ha-select>`
          : html`<input type="hidden" name="target_entity" value=${helperEntities[0]} />`}

        <div class="add-timer-actions">
          <mwc-button type="submit">Start</mwc-button>
        </div>
      </form>
    `;
  }

  _renderTimerPresets(helperEntities) {
    if (!this.hass || !this._config.timer_presets) return html``;
    
    const targetEntity = this._presetTarget
      || this._config.default_timer_entity
      || (helperEntities.length === 1 ? helperEntities[0] : null);

    return html`
      <div class="timer-presets">
        <div class="presets-header">
          <span>Quick Timer</span>
        </div>
        ${helperEntities.length > 1 ? html`
          <div class="preset-target">
            <ha-select
              label="Store preset timers in…"
              .value=${this._presetTarget || ""}
              @selected=${(e) => {
                e.stopPropagation();
                const v = e.detail?.value ?? e.target?.value ?? "";
                this._presetTarget = v || null; // runtime-only; does not mutate saved config
              }}
              @closed=${(e) => {
                e.stopPropagation();
                const v = e.detail?.value ?? e.target?.value ?? "";
                this._presetTarget = v || null;
              }}
            >
              <mwc-list-item value="">(Store locally)</mwc-list-item>
              ${helperEntities.map(id => html`
                <mwc-list-item value=${id}>
                  ${this.hass.states[id]?.attributes?.friendly_name || id}
                </mwc-list-item>
              `)}
            </ha-select>
          </div>
        ` : ""}
        <div class="preset-buttons">
          ${this._config.timer_presets.map(minutes => html`
            <button 
              class="preset-button"
              @click=${() => this._createPresetTimer(minutes, targetEntity)}
              title="Start ${this._formatTimerLabel(minutes)}"
            >
              ${this._formatPresetLabel(minutes)}
            </button>
          `)}
        </div>
        <div class="entity-note">
          <small>
            Timers will be stored
            ${targetEntity
              ? 'in ' + (this.hass.states[targetEntity]?.attributes?.friendly_name || targetEntity)
              : 'locally'}
          </small>
        </div>
      </div>
    `;
  }

  _formatPresetLabel(minutes) {
    if (minutes < 60) {
      return `${minutes}m`;
    } else if (minutes === 60) {
      return "1h";
    } else if (minutes % 60 === 0) {
      return `${minutes / 60}h`;
    } else {
      return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
    }
  }

  _renderTimer(timer) {
    const isRinging = timer.remaining <= 0;
    const isHelper = timer.source === "helper";
    const isLocal = timer.source === "local";
    const isAlexa = timer.source === "alexa";

    const canCancel = isHelper || isLocal;
    const canSnooze = isHelper || isLocal;
    const canDismiss = true;

    const containerClass = `timer-item ${this._config.layout} ${isRinging ? "ringing" : ""}`;

    const mainLine = html`
      <div class="timer-info">
        <ha-icon .icon=${timer.icon} style="color: ${timer.color};"></ha-icon>
        <span class="timer-label" title=${timer.label}>${timer.label}</span>
        <span class="timer-remaining" aria-live="polite">${this._formatTime(timer.remaining)}</span>
      </div>
    `;

    let viz = html``;
    if (this._config.style === "bar") viz = this._renderBar(timer);
    else if (this._config.style === "circle") viz = this._renderCircle(timer);
    else viz = this._renderChip(timer);

    const actions = html`
      <div class="timer-actions">
        ${!isRinging
          ? html`
              ${canCancel ? html`<mwc-button outlined @click=${() => this._handleCancel(timer)}>Cancel</mwc-button>` : ""}
              ${isAlexa && !canCancel
                ? html`<mwc-button disabled title="Alexa timers are read-only">Cancel</mwc-button>`
                : ""}
            `
          : html`
              ${canSnooze ? html`<mwc-button @click=${() => this._handleSnooze(timer)}>Snooze</mwc-button>` : ""}
              ${canDismiss ? html`<mwc-button unelevated @click=${() => this._handleDismiss(timer)}>Dismiss</mwc-button>` : ""}
            `}
      </div>
    `;

    return html`<div class="${containerClass}">${this._config.style === "chip" ? viz : html`${mainLine}${viz}${actions}`}</div>`;
  }

  _renderBar(timer) {
    const hasProgress = typeof timer.percent === "number";
    if (!hasProgress && !this._config.show_progress_when_unknown) return html``;
    const pct = Math.max(0, Math.min(100, hasProgress ? timer.percent : 0));
    return html`
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${pct}%; background-color: ${timer.color};"></div>
      </div>
    `;
  }

  _renderCircle(timer) {
    const hasProgress = typeof timer.percent === "number";
    const circumference = 2 * Math.PI * 18; // r=18
    const pct = hasProgress ? Math.max(0, Math.min(100, timer.percent)) : 0;
    const offset = circumference - (pct / 100) * circumference;

    return html`
      <div class="progress-circle-container" role="img" aria-label="${timer.label}">
        <svg class="progress-ring" width="40" height="40">
          <circle class="progress-ring-bg" stroke-width="4" fill="transparent" r="18" cx="20" cy="20"></circle>
          ${hasProgress || this._config.show_progress_when_unknown
            ? html`<circle
                class="progress-ring-circle"
                stroke-width="4"
                fill="transparent"
                r="18"
                cx="20"
                cy="20"
                style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; stroke: ${timer.color};"
              ></circle>`
            : ""}
        </svg>
      </div>
    `;
  }

  _renderChip(timer) {
    const hasProgress = typeof timer.percent === "number";
    const pct = Math.max(0, Math.min(100, hasProgress ? timer.percent : 0));
    return html`
      <div class="chip" title=${timer.label} style="--chip-color:${timer.color}">
        <ha-icon .icon=${timer.icon}></ha-icon>
        <span class="chip-label">${timer.label}</span>
        <span class="chip-remaining">${this._formatTime(timer.remaining)}</span>
        ${hasProgress || this._config.show_progress_when_unknown
          ? html`<div class="chip-track"><div class="chip-fill" style="width:${pct}%"></div></div>`
          : ""}
      </div>
    `;
  }

  _toast(msg) {
    const ev = new Event("hass-notification", { bubbles: true, composed: true });
    ev.detail = { message: msg };
    this.dispatchEvent(ev);
  }

  static get styles() {
    return css`
      ha-card { border-radius: 16px; }
      .card-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; font-size: 20px; font-weight: 500; }

      .add-timer-form { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 8px; }
      .add-timer-actions { display: flex; justify-content: flex-end; margin-top: 8px; }

      .timer-presets { padding: 0 16px 16px; }
      .presets-header { font-weight: 500; font-size: 14px; color: var(--primary-text-color); margin-bottom: 8px; }
      .preset-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
      .preset-button { 
        flex: 1; 
        min-width: 60px;
        padding: 8px 12px; 
        border: 1px solid var(--divider-color); 
        border-radius: 8px; 
        background: transparent; 
        color: var(--primary-text-color); 
        font-size: 0.875rem; 
        cursor: pointer; 
        transition: all 0.2s; 
      }
      .preset-button:hover { 
        background: var(--primary-color); 
        color: white; 
        border-color: var(--primary-color); 
      }
      .entity-note { 
        margin-top: 8px; 
        text-align: center; 
        opacity: 0.7; 
      }
      .preset-target { margin-bottom: 8px; }
      .timers-container { padding: 8px 16px 16px 16px; display: flex; flex-direction: column; gap: 12px; }
      .timers-container.horizontal { flex-direction: row; flex-wrap: wrap; gap: 12px; }

      .no-timers { text-align: center; color: var(--secondary-text-color); padding: 16px; }

      .timer-item { display: flex; align-items: center; gap: 12px; }
      .timer-item.vertical { flex-direction: column; align-items: stretch; padding: 12px 14px; border: 1px solid var(--divider-color); border-radius: 16px; }
      .timer-item.horizontal { width: 100%; }

      .timer-info { display: flex; align-items: center; gap: 8px; flex-grow: 1; }
      .timer-label { flex-grow: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .timer-remaining { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 1.1em; }

      .timer-actions { display: flex; gap: 8px; }
      .timer-item.vertical .timer-actions { margin-top: 8px; justify-content: flex-end; }

      .progress-bar-container { width: 100%; height: 6px; background-color: var(--ha-card-border-color, var(--divider-color)); border-radius: 999px; overflow: hidden; margin-top: 4px; }
      .timer-item.horizontal .progress-bar-container { display: none; }
      .progress-bar { height: 100%; border-radius: 999px; transition: width 0.2s; }

      .progress-circle-container { position: relative; width: 40px; height: 40px; }
      .timer-item.vertical .progress-circle-container { align-self: center; margin: 8px 0; }
      .progress-ring { transform: rotate(-90deg); }
      .progress-ring-bg { stroke: var(--ha-card-border-color, var(--divider-color)); opacity: 0.6; }
      .progress-ring-circle { transition: stroke-dashoffset 0.2s; }

      .chip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: var(--card-background-color); border: 1px solid var(--ha-card-border-color, var(--divider-color)); box-sizing: border-box; width: 100%; }
      .chip-label { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 500; }
      .chip-remaining { font-variant-numeric: tabular-nums; font-weight: 600; }
      .chip-track { position: relative; height: 4px; width: 100%; border-radius: 999px; background: var(--ha-card-border-color, var(--divider-color)); overflow: hidden; }
      .chip-fill { position: absolute; inset: 0 0 0 0; width: 0%; background: var(--chip-color, var(--primary-color)); border-radius: 999px; transition: width 0.2s; }

      .ringing { animation: pulse 1.8s ease-in-out infinite; }
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(var(--rgb-primary-color), .12); }
        70% { box-shadow: 0 0 0 10px rgba(var(--rgb-primary-color), 0); }
        100% { box-shadow: 0 0 0 0 rgba(var(--rgb-primary-color), 0); }
      }
    `;
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
    // Clean up any pending timeouts
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
      this._debounceTimeout = null;
    }
    if (this._emitTimeout) {
      clearTimeout(this._emitTimeout);
      this._emitTimeout = null;
    }
  }

  setConfig(config) {
    // Ensure we always have a valid entities array
    this._config = { 
      ...config, 
      entities: Array.isArray(config.entities) ? [...config.entities] : []
    };
  }

  // Generic handler for text/switch
  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue;
    if (!key) return;

    // Determine value
    const hasChecked = target.checked !== undefined;
    let value = hasChecked ? target.checked : target.value;

    // Special handling for timer_presets
    if (key === "timer_presets" && typeof value === "string") {
      value = value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v) && v > 0);
      if (value.length === 0) value = [15, 30, 60, 120]; // default
    }

    // Ignore undefined/null values that could cause issues
    if (value === undefined || value === null) return;

    // Use a more defensive approach to config updates
    this._updateConfig({ [key]: value });
  }

  // **FIX**: Add a dedicated handler for components that use event.detail.value
  _detailValueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue;
    if (!key) return;
    this._updateConfig({ [key]: ev.detail.value });
  }

  // Dedicated handler for ha-select to avoid crashes
  _selectChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue;
    if (!key) return;

    // Stop event propagation to prevent issues
    ev.stopPropagation();

    // ha-select emits several events while opening/closing.
    // Only commit when we actually have a valid string value.
    const value = ev.detail?.value !== undefined ? ev.detail.value : target.value;
    if (typeof value !== 'string' || value === '') return;

    // Use the unified update method with immediate processing
    this._updateConfig({ [key]: value }, true);
  }

  _entityValueChanged(e, index) {
    if (!this._config || !this.hass) return;
    
    // Stop event propagation to prevent issues
    if (e.stopPropagation) e.stopPropagation();
    
    // Validate index bounds
    if (index < 0 || index >= (this._config.entities || []).length) return;

    const target = e.target;
    const key = target.configValue;
    if (!key) return;

    // Get value from different event types, being more robust
    let value;
    if (e.detail && e.detail.value !== undefined) {
      value = e.detail.value;
    } else if (target.value !== undefined) {
      value = target.value;
    } else {
      return; // No valid value found
    }

    // Create a safe copy of the config
    const newConfig = { ...this._config };
    const entities = [...(newConfig.entities || [])];
    
    // Ensure we have a valid entity config object
    let entityConf;
    if (typeof entities[index] === "string") {
      entityConf = { entity: entities[index] };
    } else if (entities[index] && typeof entities[index] === "object") {
      entityConf = { ...entities[index] };
    } else {
      entityConf = { entity: "" };
    }

    // Update the specific property
    if (value === "" || value === undefined || value === null) {
      delete entityConf[key];
    } else {
      entityConf[key] = value;
    }

    // Simplify to string if only entity is set, otherwise keep as object
    if (Object.keys(entityConf).length === 1 && entityConf.entity) {
      entities[index] = entityConf.entity;
    } else if (Object.keys(entityConf).length > 0) {
      entities[index] = entityConf;
    } else {
      entities[index] = "";
    }

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

  // Helper method for debounced config updates
  _debouncedUpdate(changes) {
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
    }
    
    this._debounceTimeout = setTimeout(() => {
      this._updateConfig(changes);
      this._debounceTimeout = null;
    }, 100); // 100ms debounce
  }

  // Unified config update method
  _updateConfig(changes, immediate = false) {
    if (!this._config) return;
    
    if (typeof changes === 'object' && changes !== null) {
      if (changes.entities !== undefined) {
        // Full config replacement
        this._config = changes;
      } else {
        // Partial config update
        this._config = { ...this._config, ...changes };
      }
    }
    
    if (immediate) {
      this._emitChange();
    } else {
      // Debounce the emit for rapid changes
      if (this._emitTimeout) {
        clearTimeout(this._emitTimeout);
      }
      this._emitTimeout = setTimeout(() => {
        this._emitChange();
        this._emitTimeout = null;
      }, 50);
    }
  }

  _emitChange() {
    if (!this._config) return;
    
    try {
      const event = new CustomEvent("config-changed", { 
        detail: { config: this._config },
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(event);
    } catch (error) {
      console.error('Error emitting config change:', error);
    }
  }

  render() {
    if (!this.hass || !this._config) return html``;

    return html`
      <div class="card-config">
        <ha-textfield label="Title (Optional)" .value=${this._config.title || ""} .configValue=${"title"} @input=${this._valueChanged}></ha-textfield>

        <div class="side-by-side">
          <ha-select label="Layout" .value=${this._config.layout || "vertical"} .configValue=${"layout"}
            @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
            <mwc-list-item value="vertical">Vertical</mwc-list-item>
            <mwc-list-item value="horizontal">Horizontal</mwc-list-item>
          </ha-select>

          <ha-select label="Style" .value=${this._config.style || "bar"} .configValue=${"style"}
            @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
            <mwc-list-item value="bar">Bar</mwc-list-item>
            <mwc-list-item value="circle">Circle</mwc-list-item>
            <mwc-list-item value="chip">Chip</mwc-list-item>
          </ha-select>
        </div>

        <div class="side-by-side">
          <ha-textfield label="Snooze Duration (minutes)" type="number" .value=${this._config.snooze_duration ?? 5}
            .configValue=${"snooze_duration"} @input=${this._valueChanged}></ha-textfield>

          <ha-select label="When timer reaches 0" .value=${this._config.expire_action || "keep"} .configValue=${"expire_action"}
            @selected=${this._selectChanged} @closed=${(e) => { e.stopPropagation(); this._selectChanged(e); }}>
            <mwc-list-item value="keep">Keep visible</mwc-list-item>
            <mwc-list-item value="dismiss">Dismiss</mwc-list-item>
            <mwc-list-item value="remove">Remove</mwc-list-item>
          </ha-select>
        </div>

        <div class="side-by-side">
          <ha-textfield label="Keep-visible duration (seconds)" type="number" .value=${this._config.expire_keep_for ?? 120}
            .configValue=${"expire_keep_for"} @input=${this._valueChanged}></ha-textfield>

          <ha-formfield label="Auto-dismiss helper timers at 0">
            <ha-switch .checked=${this._config.auto_dismiss_writable === true} .configValue=${"auto_dismiss_writable"}
              @change=${this._valueChanged}></ha-switch>
          </ha-formfield>
        </div>

        <ha-formfield label="Show 'Add Timer' Button">
          <ha-switch .checked=${this._config.show_add_timer === true} .configValue=${"show_add_timer"} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>

        <ha-formfield label="Show timer preset buttons">
          <ha-switch .checked=${this._config.show_timer_presets !== false} .configValue=${"show_timer_presets"} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>

        ${this._config.show_timer_presets !== false ? html`
          <ha-textfield 
            label="Timer presets (minutes, comma-separated)" 
            .value=${(this._config.timer_presets || [15, 30, 60, 120]).join(', ')} 
            .configValue=${"timer_presets"} 
            @input=${this._valueChanged}
            helper="e.g., 15, 30, 60, 120"
          ></ha-textfield>

          <ha-entity-picker
            .hass=${this.hass}
            .value=${this._config.default_timer_entity || ""}
            .configValue=${"default_timer_entity"}
            @value-changed=${this._detailValueChanged}
            label="Default timer entity (optional)"
            allow-custom-entity
            .includeDomains=${["input_text", "text"]}
            helper="Default entity for preset timers. Leave empty for local timers."
          ></ha-entity-picker>
        ` : ''}

        <ha-formfield label="Show progress track when duration unknown">
          <ha-switch .checked=${this._config.show_progress_when_unknown === true} .configValue=${"show_progress_when_unknown"} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>

        <div class="entities-header">
          <h3>Timer Entities</h3>
          <button class="add-entity-button" @click=${this._addEntity} title="Add timer entity">
            <ha-icon icon="mdi:plus"></ha-icon>
          </button>
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

                    <ha-textfield label="Minutes attribute (for minutes_attr)" .value=${conf.minutes_attr || ""} .configValue=${"minutes_attr"}
                      @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>
                  </div>

                  <div class="side-by-side">
                    <ha-textfield label="Name Override" .value=${conf.name || ""} .configValue=${"name"}
                      @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>

                    <ha-icon-picker label="Icon Override" .value=${conf.icon || ""} .configValue=${"icon"}
                      @value-changed=${(e) => this._entityValueChanged(e, index)}></ha-icon-picker>

                    <ha-textfield label="Color Override" .value=${conf.color || ""} .configValue=${"color"}
                      @input=${(e) => this._entityValueChanged(e, index)}></ha-textfield>
                  </div>
                </div>

                <button class="remove-entity" @click=${() => this._removeEntity(index)} title="Remove entity">
                  <ha-icon icon="mdi:delete"></ha-icon>
                </button>
              </div>
            `;
          })
        }
      </div>
    `;
  }

  static get styles() {
    return css`
      .card-config { display: flex; flex-direction: column; gap: 12px; }
      .side-by-side { display: flex; gap: 12px; }
      .side-by-side > * { flex: 1; min-width: 0; }
      .entities-header { display: flex; justify-content: space-between; align-items: center; }
      .entities-header h3 { margin: 0; }
      .add-entity-button {
        background: var(--primary-color);
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: white;
        transition: background-color 0.2s;
      }
      .add-entity-button:hover {
        background: var(--primary-color-dark, var(--primary-color));
        filter: brightness(0.9);
      }
      .add-entity-button ha-icon {
        --mdc-icon-size: 24px;
      }
      .no-entities { 
        text-align: center; 
        color: var(--secondary-text-color); 
        padding: 16px; 
        font-style: italic;
        border: 2px dashed var(--divider-color);
        border-radius: 8px;
        margin: 8px 0;
      }
      .entity-editor { border: 1px solid var(--divider-color); border-radius: 8px; padding: 12px; position: relative; }
      .entity-options { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
      .remove-entity { 
        position: absolute; 
        top: 4px; 
        right: 4px; 
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
        transition: background-color 0.2s;
      }
      .remove-entity:hover {
        background: var(--error-color-dark, #d32f2f);
        filter: brightness(0.9);
      }
      .remove-entity ha-icon {
        --mdc-icon-size: 20px;
      }
    `;
  }
}

/* ---- Register ---- */
customElements.define("simple-timer-card", SimpleTimerCard);
customElements.define("simple-timer-card-editor", SimpleTimerCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "simple-timer-card",
  name: "Simple Timer Card",
  preview: true,
  description:
    "Aggregate timers from Alexa, helpers, timestamps, and ETA attributes with minimal, mushroom-like UI.",
});
