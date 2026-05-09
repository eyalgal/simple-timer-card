# ⏱️ Simple Timer Card for Home Assistant

[![GitHub Release](https://img.shields.io/github/v/release/eyalgal/simple-timer-card)](https://github.com/eyalgal/simple-timer-card/releases)
[![Community Forum](https://img.shields.io/badge/Community-Forum-5294E2.svg)](https://community.home-assistant.io/t/simple-timer-card-a-clean-way-to-track-timers-in-home-assistant/928813)
[![Buy Me A Coffee](https://img.shields.io/badge/buy_me_a-coffee-yellow)](https://www.buymeacoffee.com/eyalgal)

<img width="1000" alt="hero image" src="https://raw.githubusercontent.com/eyalgal/simple-timer-card/main/assets/readme-hero.png" />


A **clean, powerful timer card for Home Assistant** that works seamlessly with native timers, Alexa, Voice PE, helpers, MQTT, and local UI timers.

---

## ✨ Why Simple Timer Card

Simple Timer Card focuses on doing one thing extremely well: **making timers easy to see, start, and manage**, no matter where they come from.

**What you get:**

* One card for **all your timers**
* Works with **native HA timers, Alexa, Voice PE, helpers, MQTT, and local UI timers**
* Clean UI that scales from one timer to many
* Persistent timers that survive reloads and sync across devices

No dashboards clutter. No duplicated cards. Just timers.

---

## 🚀 Highlights

* **Multiple timer sources**: Native `timer.*`, Alexa, Voice PE, helpers, MQTT, timestamps, and more
* **Quick actions**: Presets, pinned one‑tap timers, and custom timers
* **Visual progress styles**: Bars, fills, and circles with drain, fill, or milestone modes
* **Sorting & layout control**: Sort by time or name, pin timers inline, top, or bottom
* **Persistent storage**: Local or MQTT based, survives reloads and syncs across devices
* **Audio & expiry actions**: Optional sounds, snooze, auto dismiss, and expiry behavior
* **Theme aware**: Automatically matches your Home Assistant theme
* **🌍 Multi-language support**: English, German, Spanish, Danish, Italian, French, and Hebrew (RTL)
* **[Spook](https://spook.boo/) fallback**: Automatically falls back to Spook's `timer.set_duration` for non-admin users

---

## 🔌 Integrations & Guides

Simple Timer Card works with a wide range of timer sources, from native Home Assistant timers to advanced setups.

- **Voice PE**
  - Mirror Voice PE timers or fully control them from the UI
  - Supports ESPHome-based local timers
  - 📖 Docs: [Voice PE overview](voice-pe/voice-pe.md)  
    📖 Advanced: [Voice PE + ESPHome](voice-pe/voice-pe-esphome.md)

- **MQTT (Persistent Timers)**
  - Timers survive reloads and sync across devices
  - Hybrid MQTT model with local fallback
  - 📖 Docs: [MQTT Hybrid Storage Model](mqtt-hybrid-model.md)

---

## 📦 Installation

### HACS (recommended)

Simple Timer Card is available in **HACS**.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=eyalgal&repository=simple-timer-card)

### Manual

1. Download `simple-timer-card.js` from the latest release
2. Copy it to `config/www`
3. Add it to Lovelace resources:

```yaml
resources:
  - url: /local/simple-timer-card.js
    type: module
```

---

## 📝 Configuration

Configuration has grown over time, so it now lives in its own dedicated document.

➡️ **See full configuration reference:**

👉 [`CONFIGURATION.md`](CONFIGURATION.md)

---

## 🔒 Security

The card includes built‑in safeguards:

* Input validation and sanitization
* Safe audio URL handling
* Rate limiting for actions
* Graceful handling of corrupted storage

See [`SECURITY.md`](SECURITY.md) for details.

---

## ❤️ Support

If you enjoy this card and want to support its development:

<a href="https://coff.ee/eyalgal" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60">
</a>
