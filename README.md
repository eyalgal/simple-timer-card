# ⏱️ Simple Timer Card for Home Assistant

[![GitHub Release](https://img.shields.io/github/v/release/eyalgal/simple-timer-card)](https://github.com/eyalgal/simple-timer-card/releases)
[![Downloads](https://img.shields.io/github/downloads/eyalgal/simple-timer-card/total.svg)](https://github.com/eyalgal/simple-timer-card/releases)
[![Community Forum](https://img.shields.io/badge/Community-Forum-5294E2.svg)](https://community.home-assistant.io/t/simple-timer-card-a-clean-way-to-track-timers-in-home-assistant/928813)
[![Buy Me A Coffee](https://img.shields.io/badge/buy_me_a-coffee-yellow)](https://www.buymeacoffee.com/eyalgal)

<img width="1000" alt="hero image" src="https://raw.githubusercontent.com/eyalgal/simple-timer-card/main/assets/readme-hero.png" />


A **clean, powerful timer card for Home Assistant** that shows every timer you have in one place, whether it comes from a native `timer.*`, Alexa, Google Home, Voice PE, a helper, MQTT, or the card itself.

No dashboard clutter. No duplicated cards. Just timers.

---

## 🚀 Highlights

* **Every timer in one card**: Native `timer.*`, Alexa, Google Home, Voice PE, helpers, MQTT, timestamps, and local timers
* **Auto-discovery**: Optionally pick up Alexa and Google Home timers without listing every speaker entity
* **Quick actions**: Presets, pinned one‑tap timers, and custom timers with switchable keypad or +/- buttons
* **Visual progress styles**: Bars, fills, and circles (vertical or horizontal) with drain, fill, or milestone modes
* **Persistent storage**: Local or MQTT based, survives reloads and syncs across devices
* **Audio & notifications**: Optional sounds, snooze, auto dismiss, plus a `notify` fallback so phones ring even when in-page audio cannot
* **Theme aware & multilingual**: Matches your Home Assistant theme; English, German, Spanish, Danish, Italian, French, Hebrew (RTL), Polish, Dutch, and Swedish
* **[Spook](https://spook.boo/) fallback**: Automatically falls back to Spook's `timer.set_duration` for non-admin users

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

## 🚦 Quick start

Add the card with no options and it keeps local timers in the browser:

```yaml
type: custom:simple-timer-card
```

To follow timers that already exist in Home Assistant, list them:

```yaml
type: custom:simple-timer-card
entities:
  - timer.kitchen
  - timer.laundry
```

---

## 📝 Configuration

Everything else, including styles, presets, pinned timers, storage, audio, notifications and tap actions, is in [`CONFIGURATION.md`](CONFIGURATION.md).

**Guides:** [Voice PE](voice-pe/voice-pe.md) and [Voice PE with ESPHome](voice-pe/voice-pe-esphome.md) · [MQTT hybrid storage](mqtt-hybrid-model.md)

---

## 🔒 Security

Input validation and sanitization, safe audio URL handling, rate limiting for actions, and graceful handling of corrupted storage. See [`SECURITY.md`](SECURITY.md) for details.

---

## 🙏 Credits

The `circle_horizontal` layout was inspired by the compact style in
[TimeFlow Card](https://github.com/Rishi8078/TimeFlow-Card) by
[@Rishi8078](https://github.com/Rishi8078). Worth a look if you want countdowns
to dates and events rather than timers.

---

## ❤️ Support

If you enjoy this card and want to support its development:

<a href="https://coff.ee/eyalgal" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60">
</a>
