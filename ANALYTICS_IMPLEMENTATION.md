# Analytics Integration Implementation Guide

This guide explains how the JavaScript Analytics Bridge was integrated into the BrainMatch game using a **non-invasive, modular approach** that requires zero changes to the existing game codebase.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Implementation Approach](#implementation-approach)
4. [Step-by-Step Integration](#step-by-step-integration)
5. [Key Concepts](#key-concepts)
6. [Analytics Events Tracked](#analytics-events-tracked)
7. [Testing & Verification](#testing--verification)
8. [Adapting for Other Games](#adapting-for-other-games)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What Was Done
- **Zero modifications** to existing game code (`script.js`, `index.html` game logic)
- Created a separate integration script that "hooks" into game functions
- Used **monkey-patching** to intercept function calls without modifying originals
- Full analytics tracking with session management, level tracking, and task recording

### Architecture
```
┌─────────────────────┐
│   index.html        │
└─────────────────────┘
          │
          ├─── 1. Load analytics-bridge.js (Library)
          ├─── 2. Load script.js (Game Code)
          └─── 3. Load analytics-integration.js (Hooks)
                      │
                      └─── Wraps game functions
                           without modifying them
```

---

## Prerequisites

### Files Needed
1. **Analytics Bridge Library**
   - `js-analytics-bridge/analytics-bridge.js` (or `.min.js`)
   - Provides `AnalyticsManager` class
   - [Source](https://github.com/your-repo/js-analytics-bridge)

2. **Your Game Files**
   - `script.js` - Main game logic
   - `index.html` - HTML structure

---

## Implementation Approach

### Monkey-Patching Pattern
Instead of modifying game code, we **wrap** existing functions:

```javascript
// Original function in game
function startGame(level) {
  // Game logic...
}

// Our integration wraps it
const originalStartGame = window.startGame;
window.startGame = function(level) {
  // [ANALYTICS] Track level start
  analytics.startLevel(`level_${level}`);
  
  // Call original game function
  return originalStartGame.call(this, level);
};
```

**Benefits:**
- ✅ No changes to game code
- ✅ Easy to add/remove
- ✅ Game still works if analytics fails
- ✅ Can be disabled by removing one script tag

---

## Step-by-Step Integration

### Step 1: Identify Analytics Events

Map game events to analytics events:

| Game Event | Analytics Event | Where It Happens |
|------------|----------------|------------------|
| Start a level | `startLevel()` | `startGame()`, `startReflexMode()` |
| Complete level | `endLevel(success)` | `handleCampaignWin()`, `handleReflexModeEnd()` |
| Fail level | `endLevel(fail)` | `startTimer()` (timeout) |
| Card match | `recordTask()` | `handleCorrectMatch()`, `handleIncorrectMatch()` |
| Submit data | `submitReport()` | After level ends |

### Step 2: Create Integration Script

**File:** `analytics-integration.js`

**Structure:**
```javascript
// 1. INITIALIZATION
const sessionID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const analytics = AnalyticsManager.getInstance();
analytics.initialize('YourGameID', sessionID);

// 2. HELPER FUNCTIONS
let levelStartTime = null;
let currentLevelId = null;

// 3. HOOK: LEVEL START
const originalStartGame = window.startGame;
window.startGame = function(level) {
  currentLevelId = `level_${level}`;
  levelStartTime = Date.now();
  analytics.startLevel(currentLevelId);
  
  return originalStartGame.call(this, level);
};

// 4. HOOK: LEVEL END (Success)
const originalWinFunction = window.handleWin;
window.handleWin = function() {
  try {
    const timeTaken = Date.now() - levelStartTime;
    const score = window.gameState.score;
    
    analytics.endLevel(currentLevelId, true, timeTaken, score);
    analytics.submitReport();
  } catch (error) {
    console.error('[Analytics] Error:', error);
  }
  
  return originalWinFunction.call(this);
};

// 5. HOOK: TASK RECORDING
const originalCheckAnswer = window.checkAnswer;
window.checkAnswer = function(userAnswer) {
  try {
    // Capture data BEFORE original function runs
    const question = window.currentQuestion;
    const correctAnswer = window.correctAnswer;
    
    analytics.recordTask(
      currentLevelId,
      `task_${taskId++}`,
      question,
      correctAnswer,
      userAnswer,
      0, // timeTaken
      0  // xpEarned
    );
  } catch (error) {
    console.error('[Analytics] Error:', error);
  }
  
  return originalCheckAnswer.call(this, userAnswer);
};
```

### Step 3: Update HTML

**File:** `index.html`

Add scripts **in this exact order**:

```html
<!-- 1. Analytics Library (FIRST) -->
<script src="js-analytics-bridge/analytics-bridge.js"></script>

<!-- 2. Game Code (SECOND) -->
<script src="script.js"></script>

<!-- 3. Analytics Integration (LAST) -->
<script src="analytics-integration.js"></script>
```

**Critical:** Integration script must load AFTER game script to access its functions.

---

## Key Concepts

### 1. Function Wrapping Pattern

```javascript
// Save reference to original
const original = window.functionName;

// Replace with wrapper
window.functionName = function(...args) {
  try {
    // Analytics logic
    trackEvent();
  } catch (error) {
    // Never break game
    console.error(error);
  }
  
  // Always call original
  return original.call(this, ...args);
};
```

### 2. Error Isolation

Always wrap analytics in try-catch:

```javascript
try {
  analytics.track(...);
} catch (error) {
  console.error('[Analytics] Error:', error);
  // Game continues normally
}

// Always execute game logic
return originalFunction.call(this);
```

### 3. Timing Capture

Track level duration:

```javascript
let levelStartTime = null;

// On level start
levelStartTime = Date.now();

// On level end
const duration = Date.now() - levelStartTime;
analytics.endLevel(levelId, success, duration, xp);
```

### 4. State Capture

Capture state BEFORE calling original function (which may clear it):

```javascript
window.handleMatch = function() {
  // ❌ WRONG - Data might be cleared
  originalFunction.call(this);
  const data = window.gameState.data; // May be undefined!
  
  // ✅ CORRECT - Capture first
  const data = window.gameState.data;
  analytics.track(data);
  return originalFunction.call(this);
};
```

---

## Analytics Events Tracked

### Complete BrainMatch Implementation

#### 1. Session Initialization
```javascript
const sessionID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
analytics.initialize('BrainMatch', sessionID);
```

**Console Output:**
```
[Analytics] Initialized with Session ID: session_1769688368502_7kx36ciu7
```

#### 2. Level Start
```javascript
analytics.startLevel('campaign_level_1');
```

**Console Output:**
```
[Analytics] Started Level: campaign_level_1
```

#### 3. Task Recording (Card Matches)
```javascript
analytics.recordTask(
  'campaign_level_1',        // levelId
  'task_12',                 // taskId
  'Match: Lion',             // question
  'Lion',                    // correctAnswer
  'Tiger',                   // userAnswer (wrong)
  0,                         // timeTakenMs
  0                          // xpEarned
);
```

**Console Output:**
```
[Analytics] Task Recorded - Incorrect Match: Match: Lion, Expected: Lion, Got: Tiger
```

#### 4. Level Completion
```javascript
analytics.endLevel('campaign_level_1', true, 46506, 40);
analytics.addRawMetric('level', '1');
analytics.addRawMetric('turns', '12');
analytics.addRawMetric('xp_earned', '40');
analytics.submitReport();
```

**Console Output:**
```
[Analytics] Completed Level: campaign_level_1, Success: true, Time: 46506ms, XP: 40
[Analytics] Report submitted
```

## Payload Structure

The analytics report includes comprehensive session and per-level data:

### Key Fields

- **`gameId`**: Game identifier (e.g., "BrainMatch")
- **`sessionId`**: Unique session identifier
- **`xpEarnedTotal`**: Total XP earned in the session
- **`highestLevelPlayed`**: The highest numeric level reached (e.g., 3)
- **`diagnostics.levels`**: Detailed array of all level attempts with tasks

### Example Payload

```json
{
  "gameId": "BrainMatch",
  "sessionId": "session_...",
  "name": "session_...",
  "xpEarnedTotal": 120,
  "highestLevelPlayed": 3,
  "diagnostics": {
    "levels": [
      {
        "levelId": "campaign_level_1",
        "successful": false,
        "timeTaken": 25000,
        "xpEarned": 0,
        "tasks": [...]
      },
      {
        "levelId": "campaign_level_1",
        "successful": true,
        "timeTaken": 20000,
        "xpEarned": 40,
        "tasks": [...]
      },
      {
        "levelId": "campaign_level_2",
        "successful": true,
        "timeTaken": 38000,
        "xpEarned": 60,
        "tasks": [...]
      }
    ]
  },
  "rawData": [
    { "key": "level", "value": "3" },
    { "key": "turns", "value": "14" }
  ]
}
```

---

## Testing & Verification

### Browser Console Testing

1. **Open Developer Console** (F12)
2. **Start playing the game**
3. **Look for console logs:**

```
[Analytics] Initialized with Session ID: session_...
[Analytics] Started Level: level_1
[Analytics] Task Recorded - Correct Match: ...
[Analytics] Completed Level: level_1, Success: true, Time: 45000ms, XP: 100
[Analytics] Report submitted
```

### Network Inspection (React Native WebView)

In the **Network** tab, look for:
- `postMessage` calls to React Native
- JSON payloads with analytics data

### Verify Data Structure

Check what's being sent:

```javascript
// Temporarily log the report
const originalSubmit = analytics.submitReport;
analytics.submitReport = function() {
  console.log('Analytics Report:', this._sessionData);
  return originalSubmit.call(this);
};
```

---

## Adapting for Other Games

### Step 1: Analyze Your Game

**Questions to Answer:**

| Question | Example Answer |
|----------|----------------|
| How does a level/game start? | `function startLevel(id)` |
| How does a level/game end? | `function onLevelComplete()` |
| How are player actions tracked? | `function onButtonClick()` |
| Where is game state stored? | `window.gameState` or local variable |
| Are functions global or in a module? | Global (`window.function`) |

### Step 2: Find Hook Points

Use browser console to inspect:

```javascript
// List all global functions
Object.keys(window).filter(key => typeof window[key] === 'function');

// Check if game state is accessible
console.log(window.gameState);
console.log(window.game);
console.log(window.app);
```

### Step 3: Map Events

Create a mapping table:

| Analytics Event | Game Function | Parameters Needed |
|----------------|---------------|-------------------|
| `startLevel()` | `game.startLevel()` | Level ID |
| `endLevel()` | `game.complete()` | Success, Time, Score |
| `recordTask()` | `game.checkAnswer()` | Question, Answer |
| `submitReport()` | After `endLevel()` | - |

### Step 4: Write Integration Script

Follow the pattern:

```javascript
// 1. Initialize
const analytics = AnalyticsManager.getInstance();
analytics.initialize('GameName', sessionID);

// 2. Hook into start
const originalStart = window.game.start;
window.game.start = function(level) {
  analytics.startLevel(`level_${level}`);
  return originalStart.call(this, level);
};

// 3. Hook into end
const originalEnd = window.game.end;
window.game.end = function(success) {
  analytics.endLevel(levelId, success, timeTaken, score);
  analytics.submitReport();
  return originalEnd.call(this, success);
};

// 4. Hook into interactions
// ... similar pattern
```

### Common Game Patterns

#### Pattern 1: Class-Based Game
```javascript
class Game {
  start() { /* ... */ }
  checkAnswer() { /* ... */ }
}

const game = new Game();

// Hook into class methods
const originalStart = game.start.bind(game);
game.start = function() {
  analytics.startLevel('level_1');
  return originalStart();
};
```

#### Pattern 2: Event-Driven Game
```javascript
// Game uses custom events
document.addEventListener('levelStart', (e) => {
  analytics.startLevel(e.detail.levelId);
});

document.addEventListener('levelComplete', (e) => {
  analytics.endLevel(e.detail.levelId, e.detail.success, e.detail.time, e.detail.score);
  analytics.submitReport();
});
```

#### Pattern 3: Framework-Based (Phaser, Unity WebGL)
```javascript
// Phaser 3
class GameScene extends Phaser.Scene {
  create() {
    this.analytics = AnalyticsManager.getInstance();
    this.analytics.initialize('PhaserGame', sessionID);
  }
  
  startLevel(id) {
    this.analytics.startLevel(id);
    // Game logic...
  }
}
```

---

## Troubleshooting

### Issue 1: "Cannot read property of undefined"

**Problem:** Accessing game state that's already cleared.

**Solution:** Capture state BEFORE calling original function:

```javascript
// ❌ Wrong
window.endLevel = function() {
  originalEndLevel.call(this);
  const score = gameState.score; // undefined!
};

// ✅ Correct
window.endLevel = function() {
  const score = gameState.score; // Capture first
  analytics.endLevel(levelId, true, time, score);
  return originalEndLevel.call(this);
};
```

### Issue 2: Game Freezes

**Problem:** Analytics error breaks game flow.

**Solution:** Always wrap in try-catch and call original:

```javascript
window.gameFunction = function() {
  try {
    analytics.track();
  } catch (error) {
    console.error('[Analytics]', error);
  }
  
  // ALWAYS call this
  return originalFunction.call(this);
};
```

### Issue 3: Function Not Found

**Problem:** Integration loads before game script.

**Solution:** Check script order in HTML:

```html
<!-- CORRECT ORDER -->
<script src="analytics-bridge.js"></script>
<script src="game.js"></script>           <!-- Game first -->
<script src="analytics-integration.js"></script> <!-- Integration last -->
```

### Issue 4: Data Not Sending

**Problem:** `submitReport()` not being called.

**Solution:** Add logging:

```javascript
analytics.submitReport = function() {
  console.log('[Analytics] Submitting report...');
  // Original submit logic
};
```

Check console for "Report submitted" messages.

### Issue 5: Wrong Data Values

**Problem:** XP/Score calculations don't match game.

**Solution:** Replicate game logic in integration script:

```javascript
// Copy game's scoring function
function calculateScore(moves, time) {
  if (moves <= 10) return 100;
  if (moves <= 15) return 75;
  return 50;
}

// Use in analytics
const score = calculateScore(gameState.moves, gameState.time);
analytics.endLevel(levelId, true, time, score);
```

---

## Best Practices

### ✅ DO

1. **Always use try-catch** around analytics code
2. **Capture state before** calling original functions
3. **Use descriptive level IDs** (`campaign_level_1`, not just `1`)
4. **Log analytics events** to console for debugging
5. **Test with browser console open** to catch errors early
6. **Submit reports** after level completion
7. **Use unique session IDs** per game session

### ❌ DON'T

1. **Modify existing game files** (keep it modular)
2. **Let analytics errors break the game**
3. **Access state after it's cleared**
4. **Skip error handling**
5. **Forget to call original functions**
6. **Hard-code session IDs**
7. **Over-track** (avoid tracking every frame/tick)

---

## File Checklist

After integration, you should have:

```
your-game/
├── index.html                    (✏️ Modified - added script tags)
├── script.js                     (✅ Unchanged)
├── style.css                     (✅ Unchanged)
├── analytics-integration.js      (🆕 New file)
└── js-analytics-bridge/
    ├── analytics-bridge.js       (📦 Library)
    ├── analytics-bridge.min.js
    └── analytics-bridge.esm.js
```

**Changes Summary:**
- **1 new file:** `analytics-integration.js`
- **1 modified file:** `index.html` (3 script tags added)
- **0 game logic changes**

---

## Quick Reference

### Minimal Integration Template

```javascript
// analytics-integration.js

// 1. Init
const sessionID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const analytics = AnalyticsManager.getInstance();
analytics.initialize('YourGameName', sessionID);

let levelStartTime = null;
let currentLevelId = null;

// 2. Hook Start
const originalStart = window.startGameFunction;
window.startGameFunction = function(levelId) {
  currentLevelId = levelId;
  levelStartTime = Date.now();
  analytics.startLevel(levelId);
  return originalStart.call(this, levelId);
};

// 3. Hook End
const originalEnd = window.endGameFunction;
window.endGameFunction = function(success) {
  try {
    const time = Date.now() - levelStartTime;
    const score = window.gameState.score;
    analytics.endLevel(currentLevelId, success, time, score);
    analytics.submitReport();
  } catch (error) {
    console.error('[Analytics]', error);
  }
  return originalEnd.call(this, success);
};

// 4. Hook Interactions (optional)
const originalAction = window.playerAction;
window.playerAction = function(action) {
  try {
    analytics.recordTask(currentLevelId, `task_${taskId++}`, action, 'expected', 'actual', 0, 0);
  } catch (error) {
    console.error('[Analytics]', error);
  }
  return originalAction.call(this, action);
};

console.log('[Analytics] Integration loaded');
```

---

## Support & Resources

- **Analytics Bridge Docs:** [README.md](js-analytics-bridge/README.md)
- **BrainMatch Implementation:** [analytics-integration.js](analytics-integration.js)
- **Issues:** Check browser console for `[Analytics]` logs

---

**Last Updated:** January 2026  
**BrainMatch Version:** 1.0  
**Analytics Bridge Version:** 1.0
