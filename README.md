# Simple M3U8 Player

A lightweight, modern, and responsive web-based HLS (`.m3u8`) video player built with Vanilla JavaScript, HTML5, CSS, and [Hls.js](https://github.com/video-dev/hls.js/).

## ✨ Features

- **Cross-Browser HLS Playback**:
  - Uses [Hls.js](https://github.com/video-dev/hls.js/) (Media Source Extensions) for Chrome, Firefox, Edge, and Android.
  - Automatic fallback to native Apple HLS for Safari and iOS.
- **Adaptive Bitrate & Manual Quality Switcher**:
  - Automatically switches stream quality based on network bandwidth.
  - Allows manual switching between resolution levels (1080p, 720p, 480p, etc.).
- **Audio Track Selection**: Multi-language or alternate audio track switching when available in the stream manifest.
- **Playback Controls**: Speed control (0.5× to 2.0×), Picture-in-Picture (PiP), and full-screen support.
- **Stream Diagnostics & Real-Time Metrics**: Real-time monitoring of active resolution, bitrate, forward buffer health, dropped frames, and Live vs VOD indicators.
- **Stream History**: Stores your recently played streams in `localStorage` for quick one-click playback.
- **Pre-Configured Test Streams**: Quick-load chips for multi-bitrate test streams (Big Buck Bunny, Tears of Steel, and Akamai Live).
- **Keyboard Shortcuts**:
  - `Space` / `K`: Play / Pause
  - `←` / `→`: Seek backward / forward 5 seconds
  - `↑` / `↓`: Volume up / down 10%
  - `M`: Mute / Unmute
  - `F`: Toggle Fullscreen
- **Zero Dependencies**: Pure HTML, CSS, and JS with a lightweight zero-dependency Node.js server.

---

## 🚀 Quick Start

### Option 1: Using Node.js (Recommended)
Run the built-in HTTP server:
```bash
npm start
```
or
```bash
node server.js
```
Then open [http://localhost:3000](http://localhost:3000) in your web browser.

### Option 2: Using Python
```bash
python3 -m http.server 3000
```
Then open [http://localhost:3000](http://localhost:3000).

---

## 📁 File Structure

```
├── index.html   # Main HTML structure, player controls, and diagnostics panel
├── style.css    # Modern dark-mode styling and responsive layout
├── app.js       # Player logic, Hls.js initialization, events, metrics & history
├── server.js    # Zero-dependency local development web server
├── package.json # npm configuration and start script
└── README.md    # Documentation and usage guide
```

---

## ⚠️ Notes on CORS (Cross-Origin Resource Sharing)

HLS streaming requires the media server hosting the `.m3u8` manifest and `.ts`/`.m4s` video segments to send permissive CORS headers:
```http
Access-Control-Allow-Origin: *
```
If an external stream fails to load with a `Network / CORS Error`, the stream host is restricting browser-based playback from other origins.
