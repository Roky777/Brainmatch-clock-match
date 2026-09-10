# WebView Integration Guide — React Native `userInfo` Injection

This guide explains **all changes required** in any game template that uses the **Progress Bridge System** and needs to auto-start from the player's highest played level when launched from a React Native WebView.

---

## Table of Contents

1. [How It Works — End-to-End Flow](#1-how-it-works--end-to-end-flow)
2. [Payloads — Both Ends](#2-payloads--both-ends)
3. [Why a Fix Is Needed](#3-why-a-fix-is-needed)
4. [Step-by-Step Fix for Any Game Template](#4-step-by-step-fix-for-any-game-template)
5. [Files That Do NOT Need Changes](#5-files-that-do-not-need-changes)
6. [Fallback Behaviour](#6-fallback-behaviour)
7. [Key Mapping Reference](#7-key-mapping-reference)
8. [Checklist](#8-checklist)

---

## 1. How It Works — End-to-End Flow

```
React Native App
       │
       │  injects window.userInfo via postMessage
       ▼
  WebView (game HTML)
       │
       │  script.js reads window.userInfo
       │  remaps keys → backendPayload
       ▼
  GameManager.initialize(backendPayload)
       │
       │  ProgressBridge.setPayload(backendPayload)
       │  extracts highestLevelPlayed
       ▼
  game starts at correct level
```

---

## 2. Payloads — Both Ends

### React Native Side — What It Sends

The React Native app injects this into the WebView:

```json
{
  "type": "USER_INFO_INJECTED",
  "userInfo": {
    "GameID": "69426f800b2e962300e09b1b",
    "Name": "Aditya",
    "UserID": "69c171fa6876575ab57d4b2f",
    "highestLevelPlayed": 2
  }
}
```

This sets `window.userInfo` on the game page. The `type` field is used by the React Native bridge handler; the game only needs to read `window.userInfo`.

**Key facts about this payload:**
- `UserID` — MongoDB ObjectId string of the player
- `GameID` — MongoDB ObjectId string of the game
- `Name` — Player display name (not used by the game engine)
- `highestLevelPlayed` — **integer**, the level to start from (e.g. `2` means start at level 2)

---

### Game Side — What `ProgressBridge` Expects

The `ProgressBridge` validator (`progressBridge.js`) requires this exact structure:

```json
{
  "userId": "69c171fa6876575ab57d4b2f",
  "gameId": "69426f800b2e962300e09b1b",
  "highestLevelPlayed": 2
}
```

**Key facts about this payload:**
- `userId` — camelCase, string
- `gameId` — camelCase, string
- `highestLevelPlayed` — **must be a `number`** (not a string), minimum `1`
- Additional fields (`totalXp`, `totalPlayTime`, `sessionsCount`) are optional

The mismatch between `UserID`/`GameID` (React Native) and `userId`/`gameId` (game) is why the fix is needed.

---

## 3. Why a Fix Is Needed

| Issue | Detail |
|-------|--------|
| **Data is never read** | The default `initialize()` call passes no payload, ignoring `window.userInfo` entirely |
| **Key name mismatch** | React Native sends `UserID` / `GameID` (PascalCase), but `ProgressBridge` requires `userId` / `gameId` (camelCase) — validation fails silently and falls back to level 1 |

---

## 4. Step-by-Step Fix for Any Game Template

### Step 1 — Confirm the Progress Bridge System files are present

Your game template must include these files (copy from BrainMatch if missing):

```
config.js
progressBridge.js
storageManager.js
validator.js
gameManager.js
```

And all five must be loaded in `index.html` **before** your main `script.js`:

```html
<!-- Progress Bridge System -->
<script src="config.js"></script>
<script src="progressBridge.js"></script>
<script src="storageManager.js"></script>
<script src="validator.js"></script>
<script src="gameManager.js"></script>

<!-- Main game script -->
<script src="script.js"></script>
```

---

### Step 2 — Confirm `config.js` has `useProvidedPayload: true`

Open `config.js` and ensure:

```js
api: {
  progressUrl: null,        // no API URL needed when payload is injected
  useProvidedPayload: true, // ✅ must be true
  timeout: 5000,
  retryAttempts: 2,
  cacheDuration: 60000,
},
```

If `useProvidedPayload` is `false`, the bridge will try to fetch from an API URL instead of using the injected data.

---

### Step 3 — Confirm `ProgressBridge` is created with `useProvidedPayload`

In `script.js`, inside `initializeGameManager()`, the `ProgressBridge` must be created like this:

```js
const progressBridge = new ProgressBridge({
  useProvidedPayload: CONFIG.api.useProvidedPayload, // must resolve to true
  apiUrl: CONFIG.api.progressUrl,
  timeout: CONFIG.api.timeout,
  retryAttempts: CONFIG.api.retryAttempts,
  cacheDuration: CONFIG.api.cacheDuration,
});
```

This should already be correct if you copied the template. No change needed here.

---

### Step 4 — Replace the `gameManager.initialize()` call ✅ (THE KEY CHANGE)

Locate this line in `script.js`:

```js
// BEFORE — ignores window.userInfo completely
const result = await gameManager.initialize();
```

Replace it with:

```js
// AFTER — reads window.userInfo injected by React Native WebView
const userInfo = window.userInfo;
const backendPayload = (userInfo && userInfo.UserID && userInfo.GameID)
  ? {
      userId: userInfo.UserID,
      gameId: userInfo.GameID,
      highestLevelPlayed: typeof userInfo.highestLevelPlayed === 'number' ? userInfo.highestLevelPlayed : 1,
    }
  : null;
const result = await gameManager.initialize(backendPayload);
```

Full context of the surrounding function for reference:

```js
async function initializeGameManager() {
  try {
    CONFIG.levels.maxLevel = MAX_GAME_LEVEL;

    const progressBridge = new ProgressBridge({
      useProvidedPayload: CONFIG.api.useProvidedPayload,
      apiUrl: CONFIG.api.progressUrl,
      timeout: CONFIG.api.timeout,
      retryAttempts: CONFIG.api.retryAttempts,
      cacheDuration: CONFIG.api.cacheDuration,
    });

    const storageManager = new StorageManager({
      storageKey: CONFIG.storage.storageKey,
      useAsyncStorage: CONFIG.storage.useAsyncStorage,
    });

    const validator = new Validator({
      minLevel: CONFIG.levels.minLevel,
      maxLevel: CONFIG.levels.maxLevel,
    });

    const analyticsBridge = typeof AnalyticsManager !== 'undefined'
      ? AnalyticsManager.getInstance()
      : null;

    gameManager = new GameManager({
      progressBridge,
      storageManager,
      validator,
      analyticsBridge,
      config: CONFIG,
    });

    // ✅ READ window.userInfo AND REMAP KEYS
    const userInfo = window.userInfo;
    const backendPayload = (userInfo && userInfo.UserID && userInfo.GameID)
      ? {
          userId: userInfo.UserID,
          gameId: userInfo.GameID,
          highestLevelPlayed: typeof userInfo.highestLevelPlayed === 'number' ? userInfo.highestLevelPlayed : 1,
        }
      : null;
    const result = await gameManager.initialize(backendPayload);
    // ✅ END

    highestLevelPlayed = result.startLevel;
    console.log(`[Game] GameManager initialized - Starting at level ${highestLevelPlayed} (source: ${result.source})`);

  } catch (error) {
    console.error('[Game] GameManager initialization failed:', error);
    highestLevelPlayed = 1;
  }
}
```

---

### Step 5 — Ensure `highestLevelPlayed` variable is used when starting the game

When the player presses Play / Start Campaign, your game must use `highestLevelPlayed` as the starting level, not a hardcoded `1`. For example:

```js
// CORRECT — uses the resolved level
gameState.currentCampaignLevel = highestLevelPlayed;

// WRONG — ignores injected data
gameState.currentCampaignLevel = 1;
```

Search your `script.js` for wherever `currentCampaignLevel` (or equivalent) is first set on game start, and confirm it uses `highestLevelPlayed`.

---

## 5. Files That Do NOT Need Changes

| File | Reason |
|------|--------|
| `progressBridge.js` | Already supports `setPayload()` for injected data |
| `gameManager.js` | Already accepts `backendPayload` in `initialize()` |
| `storageManager.js` | No change needed |
| `validator.js` | No change needed |
| `config.js` | Only verify `useProvidedPayload: true` (Step 2) |
| `index.html` | Only verify script load order (Step 1) |

Only **`script.js`** needs the code change (Step 4).

---

## 6. Fallback Behaviour

| Scenario | Result |
|----------|--------|
| `window.userInfo` is set with valid data | Starts from `highestLevelPlayed` provided by React Native |
| `window.userInfo` is missing (e.g., opened in browser) | `backendPayload` is `null` → falls back to API fetch or localStorage |
| `highestLevelPlayed` is missing or not a number | Defaults to level `1` |
| `UserID` or `GameID` is missing | `backendPayload` is `null` → falls back gracefully |
| API and localStorage both unavailable | Defaults to level `1` |

---

## 7. Key Mapping Reference

| React Native sends | Game (`ProgressBridge`) expects | Notes |
|--------------------|---------------------------------|-------|
| `UserID` | `userId` | PascalCase → camelCase |
| `GameID` | `gameId` | PascalCase → camelCase |
| `highestLevelPlayed` | `highestLevelPlayed` | Same — but must be a `number` |
| `Name` | *(not used)* | Safe to ignore |

---

## 8. Checklist

Apply this checklist to every game template:

- [ ] **Step 1** — All 5 Progress Bridge files are present and loaded in `index.html` before `script.js`
- [ ] **Step 2** — `config.js` has `useProvidedPayload: true` and `progressUrl: null`
- [ ] **Step 3** — `ProgressBridge` is constructed with `useProvidedPayload: CONFIG.api.useProvidedPayload`
- [ ] **Step 4** — `gameManager.initialize()` replaced with the `window.userInfo` block that remaps keys
- [ ] **Step 5** — Game start logic uses `highestLevelPlayed` variable, not a hardcoded `1`
- [ ] **Test in browser** — `window.userInfo` absent → game starts at level 1 or from localStorage ✅
- [ ] **Test in WebView** — `window.userInfo` injected → game starts at correct `highestLevelPlayed` ✅

---

## Key Mapping Reference

| React Native key | ProgressBridge expected key |
|------------------|-----------------------------|
| `UserID` | `userId` |
| `GameID` | `gameId` |
| `highestLevelPlayed` | `highestLevelPlayed` *(same)* |

> `Name` is not used by the game engine and can be safely ignored.

---

## Checklist for Each Game Template

- [ ] Open `script.js` (or the main game script)
- [ ] Find the `gameManager.initialize()` call
- [ ] Replace with the block above that reads `window.userInfo`
- [ ] Test in browser (no `window.userInfo`) — should start at level 1 or from localStorage
- [ ] Test in WebView with injected data — should start from `highestLevelPlayed`
