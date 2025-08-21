
/*
 * Simple Timer Card (Adapterized)
 * v1.3.1 — editor stability fixes
 *
 * - Alexa timers (read-only)
 * - device_class: timestamp sensors (completion times)
 * - sensors with a numeric "minutes to arrival" attribute (ETA)
 * - input_text helper (JSON store) for fully controllable shared timers
 */
import { LitElement, html, css } from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

const cardVersion = "1.3.1";
console.info(`%c SIMPLE-TIMER-CARD %c v${cardVersion} `, "color: white; background: #4285f4; font-weight: 700;", "color: #4285f4; background: white; font-weight: 700;");

class SimpleTimerCard extends LitElement {
  static get properties() {
    return { hass: {}, _config: {}, _timers: { state: true }, _isAdding: { state: true } };
  }

  constructor() {
    super();
    this._timers = [];
    this._timerInterval = null;
    this._isAdding = false;
    this._dismissed = new Set(); // local UI dismissal for read-only sources (e.g., Alexa)
  }

  setConfig(config) {
    if (!config.entities || !Array.isArray(config.entities)) {
      throw new Error("You need to define an array of entities.");
    }
    this._config = {
      layout: "vertical",                  // 'vertical' | 'horizontal'
      style: "bar",                        // 'bar' | 'circle' | 'chip'
      snooze_duration: 5,                  // minutes
      show_add_timer: false,
      expire_action: "keep",               // 'keep' | 'dismiss' | 'remove'
      expire_keep_for: 120,                // seconds to keep a rung timer visible
      auto_dismiss_writable: false,        // auto-dismiss helper timers when 0
      show_progress_when_unknown: false,   // show an empty track if duration unknown
      ...config,
    };
  }

  static async getConfigElement() {
    return document.createElement("simple-timer-card-editor");
  }
  static getStubConfig() {
    return { title: "Timers", entities: [] };
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
    if (entityId.startsWith("input_text.")) return "helper";
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

    // Expiration policy for helper timers
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
    this.hass.callService("input_text", "set_value", {
      target: { entity_id: entityId },
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

  _handleCancel(timer) {
    if (timer.source === "helper") {
      this._mutateHelper(timer.source_entity, (data) => {
        data.timers = data.timers.filter((t) => t.id !== timer.id);
      });
    } else {
      this._toast?.("This timer can't be cancelled from here.");
    }
  }

  _handleDismiss(timer) {
    if (timer.source === "helper") {
      this._mutateHelper(timer.source_entity, (data) => {
        data.timers = data.timers.filter((t) => t.id !== timer.id);
      });
    } else {
      this._dismissed.add(`${timer.source_entity}:${timer.id}`);
    }
  }

  _handleSnooze(timer) {
    if (timer.source !== "helper") {
      this._toast?.("Only helper timers can be snoozed here.");
      return;
    }
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
      .filter((id) => id && id.startsWith("input_text."));

    return html`
      <ha-card>
        <div class="card-header">
          <span>${this._config.title || "Timers"}</span>
          ${this._config.show_add_timer && helperEntities.length > 0
            ? html`<ha-icon-button icon="mdi:plus" @click=${() => (this._isAdding = !this._isAdding)} .title=${"Add timer"}></ha-icon-button>`
            : ""}
        </div>

        ${this._isAdding ? this._renderAddTimerForm(helperEntities) : ""}

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

  _renderTimer(timer) {
    const isRinging = timer.remaining <= 0;
    const isHelper = timer.source === "helper";
    const isAlexa = timer.source === "alexa";

    const canCancel = isHelper;
    const canSnooze = isHelper;
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

  setConfig(config) {
    this._config = { ...config, entities: [...(config.entities || [])] };
  }

  // Generic handler for text/switch
  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue;
    if (!key) return;

    // Determine value
    const hasChecked = target.checked !== undefined;
    const value = hasChecked ? target.checked : target.value;

    // Ignore undefined (e.g., transient ha-select events)
    if (value === undefined) return;

    const newConfig = { ...this._config };
    newConfig[key] = value;
    this._config = newConfig;
    this._emitChange();
  }

  // Dedicated handler for ha-select to avoid crashes
  _selectChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue;
    if (!key) return;

    // ha-select emits several events while opening/closing.
    // Only commit when we actually have a string value.
    const value = target.value;
    if (value === undefined || value === null) return;

    this._config = { ...this._config, [key]: value };
    this._emitChange();
  }

  _entityValueChanged(e, index) {
    if (!this._config || !this.hass) return;

    const newConfig = { ...this._config };
    const entities = [...newConfig.entities];
    const target = e.target;
    const key = target.configValue;
    const value = e.detail?.value !== undefined ? e.detail.value : target.value;

    if (!key) return;

    let entityConf = { ...(typeof entities[index] === "string" ? { entity: entities[index] } : entities[index]) };

    if (value === "" || value === undefined) delete entityConf[key];
    else entityConf[key] = value;

    if (Object.keys(entityConf).length === 1 && entityConf.entity) entities[index] = entityConf.entity;
    else entities[index] = entityConf;

    newConfig.entities = entities;
    this._config = newConfig;
    this._emitChange();
  }

  _addEntity() {
    const newConfig = { ...this._config };
    const entities = [...(newConfig.entities || [])];
    entities.push("");
    newConfig.entities = entities;
    this._config = newConfig;
    this._emitChange();
  }

  _removeEntity(i) {
    const newConfig = { ...this._config };
    const entities = [...newConfig.entities];
    entities.splice(i, 1);
    newConfig.entities = entities;
    this._config = newConfig;
    this._emitChange();
  }

  _emitChange() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config } }));
  }

  render() {
    if (!this.hass || !this._config) return html``;

    return html`
      <div class="card-config">
        <ha-textfield label="Title (Optional)" .value=${this._config.title || ""} .configValue=${"title"} @input=${this._valueChanged}></ha-textfield>

        <div class="side-by-side">
          <ha-select label="Layout" .value=${this._config.layout || "vertical"} .configValue=${"layout"}
            @selected=${this._selectChanged} @closed=${this._selectChanged}>
            <mwc-list-item value="vertical">Vertical</mwc-list-item>
            <mwc-list-item value="horizontal">Horizontal</mwc-list-item>
          </ha-select>

          <ha-select label="Style" .value=${this._config.style || "bar"} .configValue=${"style"}
            @selected=${this._selectChanged} @closed=${this._selectChanged}>
            <mwc-list-item value="bar">Bar</mwc-list-item>
            <mwc-list-item value="circle">Circle</mwc-list-item>
            <mwc-list-item value="chip">Chip</mwc-list-item>
          </ha-select>
        </div>

        <div class="side-by-side">
          <ha-textfield label="Snooze Duration (minutes)" type="number" .value=${this._config.snooze_duration ?? 5}
            .configValue=${"snooze_duration"} @input=${this._valueChanged}></ha-textfield>

          <ha-select label="When timer reaches 0" .value=${this._config.expire_action || "keep"} .configValue=${"expire_action"}
            @selected=${this._selectChanged} @closed=${this._selectChanged}>
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

        <ha-formfield label="Show progress track when duration unknown">
          <ha-switch .checked=${this._config.show_progress_when_unknown === true} .configValue=${"show_progress_when_unknown"} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>

        <div class="entities-header">
          <h3>Timer Entities</h3>
          <ha-icon-button icon="mdi:plus" @click=${this._addEntity}></ha-icon-button>
        </div>

        ${(this._config.entities || []).map((entityConf, index) => {
          const entityId = typeof entityConf === "string" ? entityConf : entityConf.entity;
          const conf = typeof entityConf === "string" ? {} : entityConf;

          return html`
            <div class="entity-editor">
              <ha-entity-picker .hass=${this.hass} .value=${entityId} .configValue=${"entity"} allow-custom-entity
                @value-changed=${(e) => this._entityValueChanged(e, index)}></ha-entity-picker>

              <div class="entity-options">
                <div class="side-by-side">
                  <ha-select label="Mode" .value=${conf.mode || "auto"} .configValue=${"mode"}
                    @selected=${(e) => this._entityValueChanged(e, index)} @closed=${(e) => this._entityValueChanged(e, index)}>
                    <mwc-list-item value="auto">Auto</mwc-list-item>
                    <mwc-list-item value="alexa">Alexa</mwc-list-item>
                    <mwc-list-item value="helper">Helper (input_text)</mwc-list-item>
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

              <ha-icon-button class="remove-entity" icon="mdi:delete" @click=${() => this._removeEntity(index)}></ha-icon-button>
            </div>
          `;
        })}
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
      .entity-editor { border: 1px solid var(--divider-color); border-radius: 8px; padding: 12px; position: relative; }
      .entity-options { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
      .remove-entity { position: absolute; top: 4px; right: 4px; }
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
