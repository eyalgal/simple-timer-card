# ⏱️ Simple Timer Card for Home Assistant

[![GitHub Release](https://img.shields.io/github/v/release/eyalgal/simple-timer-card)](https://github.com/eyalgal/simple-timer-card/releases)
[![Downloads](https://img.shields.io/github/downloads/eyalgal/simple-timer-card/total.svg)](https://github.com/eyalgal/simple-timer-card/releases)
[![Community Forum](https://img.shields.io/badge/Community-Forum-5294E2.svg)](https://community.home-assistant.io/t/simple-timer-card-a-clean-way-to-track-timers-in-home-assistant/928813)
[![Buy Me A Coffee](https://img.shields.io/badge/buy_me_a-coffee-yellow)](https://www.buymeacoffee.com/eyalgal)

<img width="1000" alt="hero image" src="https://raw.githubusercontent.com/eyalgal/simple-timer-card/main/assets/readme-hero.png" />


A **clean, powerful timer card for Home Assistant** that shows every timer you have in one place, whether it comes from a native `timer.*`, a voice satellite such as Voice PE, Alexa, Google Home, a helper, MQTT, or the card itself.

No dashboard clutter. No duplicated cards. Just timers.

---

## 🚀 Highlights

* **Every timer in one card**: Native `timer.*`, voice timers (timer lists), Alexa, Google Home, helpers, MQTT, timestamps, and local timers
* **Voice timers**: Show, start, pause, extend and cancel Voice PE and other voice satellite timers, with no custom firmware
* **Optional [companion integration](https://github.com/eyalgal/simple-timer-card-integration)**: Timers kept in Home Assistant that can run any action when they end ("turn off the air purifier in 30 minutes"), plus delayed voice commands shown as timers
* **Auto-discovery**: Optionally pick up voice satellite, Alexa and Google Home timers without listing every device
* **Quick actions**: Presets, pinned one‑tap timers, and custom timers with a keypad or +/- buttons, plus an optional on-card input switch
* **Visual progress styles**: Bars, fills, and circles (vertical or horizontal) with drain, fill, or milestone modes
* **Simple editor**: Sources, storage, appearance, and timer input in one place, with a remembered Advanced mode for specialist settings
* **Persistent storage**: Local timers survive reloads in the same browser; MQTT or the companion integration share timers across devices
* **Audio & notifications**: Optional sounds, snooze, cleanup, and push notifications while the card is running; a backend monitor is needed when all dashboards are closed
* **Theme aware & multilingual**: Matches your Home Assistant theme; English, German, Spanish, Danish, Italian, French, Hebrew (RTL), Polish, Dutch, and Swedish
* **[Spook](https://spook.boo/) fallback**: Automatically falls back to Spook's `timer.set_duration` for non-admin users

---

## 📦 Installation

### Marketplace (fka HACS) (recommended)

Simple Timer Card is available in **Marketplace (fka HACS)**.

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

### Updating to v3.0.0

v3.0.0 adds **voice timers**. Home Assistant now keeps the timers on each voice
satellite, such as Voice PE, in a timer list entity (`timer_list.*`). The card
shows these timers and can start, pause, resume, add time to, finish, cancel,
snooze and dismiss them, with stock firmware and no template sensors. Turn on
**Auto-discover voice timers** in the editor, or see
[Voice timers](CONFIGURATION.md#-voice-timers-timer-lists).

v3.0.0 also adds:

* An optional **[companion integration](https://github.com/eyalgal/simple-timer-card-integration)** keeps timers in Home Assistant, runs a
  command or any device action when a timer ends ("turn off the air purifier in
  30 minutes") with every dashboard closed, and shows delayed voice commands as
  timers. Choose it with `storage: integration`, next to browser and MQTT
  storage, which keep working unchanged. Install it from its
  [own repository](https://github.com/eyalgal/simple-timer-card-integration), then see
  [Companion integration](CONFIGURATION.md#-companion-integration).
* **Put on a speaker** and **default area** for running a timer on a voice
  speaker, and **Announce on a speaker** (Sonos, Echo, Nest…) when a timer
  ends, plus device or area labels and `group_by`.
* **Browser voice satellites** (Voice Satellite Card integration), **count-up
  rows** ("fed 1h 40m ago") and **template rows** from Jinja.
* `ring_animation`, `hide_when_empty` and `max_rows` for wall tablets.
* A [blueprint](blueprints/automation/simple_timer_card/timer_list_event.yaml)
  for automations on voice timer events.

Voice timers need a Home Assistant version in which your satellite has a timer
list. Existing configurations keep working unchanged. The custom-firmware Voice PE
setup (`mode: voice_pe`, `auto_voice_pe`) is now legacy; follow the
[migration steps](CONFIGURATION.md#moving-from-the-legacy-voice-pe-setup) once
your satellite has a timer list.

### Updating to v2.9.2

v2.9.2 makes **Dismiss** on a ringing Google Home timer also call
`google_home.delete_timer`, so the speaker stops ringing instead of only hiding
the timer on the card ([#119](https://github.com/eyalgal/simple-timer-card/issues/119)).
No configuration changes are needed. Alexa timers are still dismissed on the
card only.

v2.9.2 is the stable release. Update through Marketplace (fka HACS) or use the
release asset, then fully reload the dashboard. If you already run the v2.9.2
pre-release, the card build is unchanged.

### Updating to v2.9.1

v2.9.1 adds an optional MQTT publish relay for non-admin users on Home Assistant
2026.10+. Administrators keep the existing direct publish path. Non-admin users
need an administrator to install the example automation and set
`mqtt.publish_automation` in the card. **Updating the card alone is not enough.**
See [non-admin MQTT setup and testing](mqtt-hybrid-model.md#non-admin-users-ha-202610).

### Updating to v2.9.0

Existing cards keep their +/- input and discovery remains opt-in. The old
`style: circle` value still works as the vertical circle layout. If you tested
a v2.9.0 pre-release, redownload v2.9.0 in Marketplace (fka HACS) and fully reload the dashboard:
the version number is unchanged, so an update notice may not appear.

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

To show and control the timers on your voice satellites:

```yaml
type: custom:simple-timer-card
auto_discover_timer_lists: true
```

---

## 📝 Configuration

Everything else, including styles, presets, pinned timers, storage, audio, notifications and tap actions, is in [`CONFIGURATION.md`](CONFIGURATION.md).

**Guides:** [Voice timers](CONFIGURATION.md#-voice-timers-timer-lists) · [MQTT hybrid storage](mqtt-hybrid-model.md) · Legacy: [Voice PE](voice-pe/voice-pe.md) and [Voice PE with ESPHome](voice-pe/voice-pe-esphome.md)

---

## 🔒 Security

Input validation and sanitization, safe audio URL handling, rate limiting for actions, and graceful handling of corrupted storage. See [`SECURITY.md`](SECURITY.md) for details.

---

## ❤️ Support

If you enjoy this card and want to support its development:

<a href="https://coff.ee/eyalgal" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60">
</a>
