# BrainMatch - Clock Match

A Grade 2 memory game that teaches whole-hour analog clocks by matching each clock face to its digital time.

## 🎮 Game Modes

### Campaign Mode
Progress through 3 levels of increasing difficulty:
- **Level 1**: 4 pairs - 6:00, 7:00, 8:00 and 9:00
- **Level 2**: 4 pairs - 1:00, 2:00, 4:00 and 10:00
- **Level 3**: all 8 pairs on a 4 x 4 board

### Reflex Mode
Fast-paced matching with a 2-second timer per card reveal.

## 🚀 Quick Start

### Play the Game
1. Open `index.html` in a web browser
2. Click "Start Campaign" or "Start Reflex Mode"
3. Match all pairs to complete the level

### Development
No build process required! Just open `index.html` in your browser.

## 📊 Analytics Integration

BrainMatch includes **non-invasive analytics** that tracks player performance without modifying the core game code.

### Files
- `js-analytics-bridge/analytics-bridge.js` - Analytics library
- `analytics-integration.js` - Game-specific integration hooks
- `ANALYTICS_IMPLEMENTATION.md` - Detailed implementation guide
- `PAYLOAD_FORMAT.md` - Complete payload documentation

### What's Tracked
- ✅ Session details (ID, timestamp, game ID)
- ✅ Level attempts (successes, failures, time taken)
- ✅ XP earned and progression
- ✅ Individual card matches (correct/incorrect)
- ✅ Detailed diagnostics (all level attempts with tasks)
- ✅ Highest level reached

### Integration
```html
<!-- Add to index.html -->
<script src="js-analytics-bridge/analytics-bridge.js"></script>
<script src="script.js"></script>
<script src="analytics-integration.js"></script>
```

Analytics automatically submits data to:
- React Native WebView (`window.ReactNativeWebView.postMessage`)
- Parent frames (`window.parent.postMessage`)
- Custom bridges (`window.myJsAnalytics.trackGameSession`)

### Accessing Analytics Data

```javascript
// Get current session data
const report = analytics.getReportData();

// View in console
console.log('Session:', report.sessionId);
console.log('Total XP:', report.xpEarnedTotal);
console.log('Highest Level:', report.highestLevelPlayed);
console.log('Level Attempts:', report.diagnostics.levels);
```

See [PAYLOAD_FORMAT.md](PAYLOAD_FORMAT.md) for complete payload structure.

## 📁 Project Structure

```
BrainMatch/
├── index.html                      # Main game page
├── script.js                       # Core game logic
├── style.css                       # Game styles
├── gameContent.json                # Clock-and-time level content
├── analytics-integration.js        # Analytics hooks
├── js-analytics-bridge/
│   ├── analytics-bridge.js         # Analytics library
│   ├── analytics-bridge.min.js     # Minified version
│   └── analytics-bridge.esm.js     # ES Module version
├── images/                         # Game assets
├── ANALYTICS_IMPLEMENTATION.md     # Implementation guide
├── PAYLOAD_FORMAT.md               # Payload documentation
└── README.md                       # This file
```

## 🎯 XP Scoring

### Campaign Mode
XP is awarded based on turns taken:

**Level 1**
- 4 turns: 40 XP
- 5-6 turns: 32 XP
- 7+ turns: 24 XP

**Level 2**
- 4 turns: 60 XP
- 5-6 turns: 48 XP
- 7+ turns: 36 XP

**Level 3**
- 8 turns: 100 XP
- 9-10 turns: 80 XP
- 11+ turns: 60 XP

### Reflex Mode
No XP awarded (focuses on speed and accuracy).

## 🛠️ Customization

### Adding New Levels
Edit `gameContent.json`:

```json
{
  "level": 4,
  "pairs": 9,
  "time": 90,
  "animals": ["lion", "tiger", "bear", ...]
}
```

### Changing Analytics
See [ANALYTICS_IMPLEMENTATION.md](ANALYTICS_IMPLEMENTATION.md) for:
- Adding custom metrics
- Tracking new events
- Modifying payload structure
- Adapting for other games

## 🎨 Features

- ✨ Smooth card flip animations
- 🔊 Sound effects for matches and errors
- 🎵 Background music
- ⏸️ Pause/resume functionality
- 📖 In-game tutorial
- 📊 Live turn counter and timer
- ⭐ Star rating system
- 🏆 Final score screen

## 🔧 Developer Mode

Set `DEV_MODE = true` in `script.js` to enable:
- Press **'C'** to instantly complete a level
- Useful for testing analytics without playing

## 📄 License

Open source - feel free to use and modify!

## 🤝 Contributing

Want to add features or improve analytics?
1. See `ANALYTICS_IMPLEMENTATION.md` for architecture
2. All analytics code uses **monkey-patching** (no game code changes)
3. Test with browser console open to verify events

## 📞 Support

For analytics integration questions, see:
- [ANALYTICS_IMPLEMENTATION.md](ANALYTICS_IMPLEMENTATION.md) - How it works
- [PAYLOAD_FORMAT.md](PAYLOAD_FORMAT.md) - Data structure reference

---

## 🐛 Bug Fixes & Changelog

### Auto-Save Payload Fix (May 4, 2026)

**Problem:** After a campaign level was completed, the auto-save progress payload was silently dropped — it never reached any analytics bridge or parent frame.

Two bugs caused this:

---

#### Bug 1 — Wrong Global Variable Name

**File:** `script.js`

```js
// BEFORE — AnalyticsBridge is never defined, so this always returned null
const analyticsBridge = typeof AnalyticsBridge !== 'undefined' ? AnalyticsBridge : null;

// AFTER — Correct global registered by analytics-bridge.js
const analyticsBridge = typeof AnalyticsManager !== 'undefined' ? AnalyticsManager.getInstance() : null;
```

`analytics-bridge.js` registers `window.AnalyticsManager` as its global, not `window.AnalyticsBridge`. Because the name was wrong, `analyticsBridge` was always `null` and `GameManager._sendAnalytics()` never had a bridge to send through.

---

#### Bug 2 — Missing `sendEvent` Method

**Files:** `js-analytics-bridge/analytics-bridge.js` · `js-analytics-bridge/analytics-bridge.esm.js`

`GameManager._sendAnalytics()` calls `this.analyticsBridge.sendEvent(payload)` (or `.send()`), but `AnalyticsManager` only had `submitReport()` — which builds a full session payload of its own. There was no `sendEvent` method, so the code fell through to:

```js
console.warn('[GameManager] Analytics bridge not configured properly');
```

**Fix:** Added `sendEvent(payload)` to both bridge files. The method uses the same delivery chain as `submitReport()`:

1. `window.myJsAnalytics.trackGameSession(payload)` — site-local bridge
2. `window.ReactNativeWebView.postMessage(JSON.stringify(payload))` — React Native WebView
3. `window.parent.postMessage(payload, target)` — iframe parent
4. Falls back to `localStorage` queue (`ignite_pending_sessions_jsplugin`) if all channels are unavailable

---

#### Auto-Save Payload Structure

The exact payload sent on every campaign level completion:

```json
{
  "highestLevelPlayed": 2,
  "xpEarnedTotal": 40,
  "name": "Level Complete",
  "diagnostics": {
    "levels": [
      {
        "levelId": 1,
        "timeTaken": 0
      }
    ]
  }
}
```

| Field | Value |
|---|---|
| `highestLevelPlayed` | `completedLevel + 1` (next unlocked level) |
| `xpEarnedTotal` | XP earned on the completed level |
| `name` | Always `"Level Complete"` for auto-save events |
| `diagnostics.levels[0].levelId` | The level that was just completed |
| `diagnostics.levels[0].timeTaken` | `0` — can be wired to actual elapsed time if needed |

> **Note:** `timeTaken` is `0` because `handleCampaignWin()` in `script.js` does not currently pass elapsed time into `levelData.timeTaken`. To enable it, calculate `Date.now() - levelStartTime` and pass it in the `levelData` object.

---

**Enjoy the game! 🎮**
