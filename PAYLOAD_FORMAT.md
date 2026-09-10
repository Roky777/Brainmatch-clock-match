# Analytics Payload Format

## Overview

This document describes the complete structure of the analytics payload sent by BrainMatch to the parent application or analytics endpoint.

## Complete Payload Structure

```json
{
  "gameId": "BrainMatch",
  "sessionId": "session_1769688502_abc123xyz",
  "timestamp": "2026-02-25T10:30:45.123Z",
  "name": "session_1769688502_abc123xyz",
  
  "xpEarnedTotal": 140,
  "xpEarned": 140,
  "xpTotal": 140,
  "bestXp": 140,
  
  "highestLevelPlayed": 3,
  
  "rawData": [
    { "key": "level", "value": "3" },
    { "key": "turns", "value": "14" },
    { "key": "xp_earned", "value": "40" }
  ],
  
  "diagnostics": {
    "levels": [
      {
        "levelId": "campaign_level_1",
        "successful": false,
        "timeTaken": 25000,
        "timeDirection": false,
        "xpEarned": 0,
        "tasks": [
          {
            "taskId": "task_1",
            "question": "Match: Elephant",
            "options": "[]",
            "correctChoice": "Elephant",
            "choiceMade": "Lion",
            "successful": false,
            "timeTaken": 0,
            "xpEarned": 0
          }
        ]
      },
      {
        "levelId": "campaign_level_1",
        "successful": true,
        "timeTaken": 20000,
        "timeDirection": false,
        "xpEarned": 40,
        "tasks": [
          {
            "taskId": "task_1",
            "question": "Match: Cat",
            "options": "[]",
            "correctChoice": "Cat",
            "choiceMade": "Cat",
            "successful": true,
            "timeTaken": 0,
            "xpEarned": 0
          },
          {
            "taskId": "task_2",
            "question": "Match: Dog",
            "options": "[]",
            "correctChoice": "Dog",
            "choiceMade": "Dog",
            "successful": true,
            "timeTaken": 0,
            "xpEarned": 0
          }
        ]
      },
      {
        "levelId": "campaign_level_2",
        "successful": true,
        "timeTaken": 38000,
        "timeDirection": false,
        "xpEarned": 60,
        "tasks": [...]
      },
      {
        "levelId": "campaign_level_3",
        "successful": true,
        "timeTaken": 42000,
        "timeDirection": false,
        "xpEarned": 40,
        "tasks": [...]
      }
    ]
  }
}
```

## Field Descriptions

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `gameId` | string | Game identifier (always "BrainMatch") |
| `sessionId` | string | Unique session identifier generated on init |
| `timestamp` | string | ISO 8601 timestamp when report submitted |
| `name` | string | Session name (same as sessionId) |
| `xpEarnedTotal` | number | Total XP earned during session |
| `xpEarned` | number | Alias for xpEarnedTotal |
| `xpTotal` | number | Alias for xpEarnedTotal |
| `bestXp` | number | Alias for xpEarnedTotal |
| `highestLevelPlayed` | number | Highest numeric level reached, extracted from level IDs (e.g., 3 from "campaign_level_3") |

### Raw Data

`rawData` is an array of key-value pairs for additional metrics:

```json
[
  { "key": "level", "value": "3" },
  { "key": "turns", "value": "14" },
  { "key": "xp_earned", "value": "40" }
]
```

### Diagnostics

`diagnostics.levels` contains detailed information about each level attempt:

| Field | Type | Description |
|-------|------|-------------|
| `levelId` | string | Level identifier (e.g., "campaign_level_1") |
| `successful` | boolean | Whether the level was completed successfully |
| `timeTaken` | number | Time taken in milliseconds |
| `timeDirection` | boolean | Reserved for future use |
| `xpEarned` | number | XP earned for this attempt |
| `tasks` | array | Array of individual tasks/actions within the level |

#### Task Object

Each task in the `tasks` array contains:

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | Task identifier (e.g., "task_1") |
| `question` | string | Question or action description |
| `options` | string | Available options (currently always "[]") |
| `correctChoice` | string | Correct answer |
| `choiceMade` | string | User's answer |
| `successful` | boolean | Whether the task was completed correctly |
| `timeTaken` | number | Time taken for this task (milliseconds) |
| `xpEarned` | number | XP earned for this task |

## Usage Examples

### Accessing Session Summary
```javascript
const totalXP = payload.xpEarnedTotal;
const highestLevel = payload.highestLevelPlayed;
const sessionId = payload.sessionId;
```

### Analyzing Level Performance from Diagnostics
```javascript
const level1Attempts = payload.diagnostics.levels.filter(l => l.levelId === 'campaign_level_1');
const successfulAttempts = level1Attempts.filter(l => l.successful);
const successRate = (successfulAttempts.length / level1Attempts.length) * 100;
```

### Getting Detailed Task Data
```javascript
const allLevelAttempts = payload.diagnostics.levels;
const successfulAttempts = allLevelAttempts.filter(l => l.successful);
const allTasks = allLevelAttempts.flatMap(l => l.tasks);
const correctTasks = allTasks.filter(t => t.successful);
```

## Delivery Methods

The payload is automatically sent via multiple channels (best-effort):

1. **React Native WebView**: `window.ReactNativeWebView.postMessage(JSON.stringify(payload))`
2. **Custom Site Bridge**: `window.myJsAnalytics.trackGameSession(payload)`
3. **Parent Frame**: `window.parent.postMessage(payload, origin)`
4. **Console Fallback**: `console.log('Payload:', JSON.stringify(payload))`

Payloads are also queued in localStorage if delivery fails and auto-submitted when connection is restored.
