# Game Progress Bridge System

A robust JavaScript bridge system for fetching and syncing player game progress across Web and React Native platforms.

## 📋 Overview

This system provides:

- **Progress Bridge** - Fetches player progress from server (GET requests)
- **Storage Manager** - Handles local persistence (localStorage / AsyncStorage)
- **Validator** - Validates data integrity and type safety
- **Game Manager** - Coordinates sync between API, local storage, and analytics

**Important:** This system is designed to work alongside your existing Analytics Bridge without modifying it.

## 🎯 Features

✅ **Cross-Platform** - Works in Web browsers and React Native  
✅ **Offline Support** - Falls back to local storage when API unavailable  
✅ **Type Safety** - Ensures `highestLevelPlayed` and `levelId` are always numbers  
✅ **Smart Sync** - Keeps local, API, and analytics in sync  
✅ **Robust Error Handling** - Handles edge cases gracefully  
✅ **Retry Logic** - Automatic retry with exponential backoff  
✅ **Caching** - Reduces unnecessary API calls

## 📦 Files

```
├── config.js                   # Configuration settings
├── progressBridge.js           # Progress bridge (API or backend payload)
├── storageManager.js           # Local storage management
├── validator.js                # Data validation
├── gameManager.js              # Main coordinator
├── backend-example.html        # Backend payload example (RECOMMENDED)
├── index.html                  # Full demo with mock API
├── ReactNativeQuickStart.js    # React Native copy-paste example
└── REACT_NATIVE_GUIDE.md       # Complete React Native documentation
```

## 🚀 Quick Start

### Option 1: Backend Provides Payload (Recommended - No API Calls)

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Game</title>
</head>
<body>
    <!-- Load scripts -->
    <script src="config.js"></script>
    <script src="progressBridge.js"></script>
    <script src="storageManager.js"></script>
    <script src="validator.js"></script>
    <script src="gameManager.js"></script>

    <script>
        // Backend provides this payload
        const BACKEND_PAYLOAD = {
            userId: "65f04a6a2d9b9d6a3c7a1e21",
            gameId: "65f04b1c2d9b9d6a3c7a1e45",
            highestLevelPlayed: 5,
            totalXp: 15800,
            totalPlayTime: 7200,
            sessionsCount: 12
        };

        // Your existing Analytics Bridge (DO NOT MODIFY)
        const AnalyticsBridge = { /* your bridge */ };

        let gameManager;

        async function initGame() {
            // Create components
            const progressBridge = new ProgressBridge({
                useProvidedPayload: true  // Use backend payload
            });

            const storageManager = new StorageManager({
                storageKey: 'gameProgress'
            });

            const validator = new Validator({
                minLevel: 1,
                maxLevel: 100
            });

            // Create Game Manager
            gameManager = new GameManager({
                progressBridge,
                storageManager,
                validator,
                analyticsBridge: AnalyticsBridge,
                config: CONFIG
            });

            // Initialize with backend payload
            const result = await gameManager.initialize(BACKEND_PAYLOAD);
            console.log('Started at level:', result.startLevel);  // Will be 5
        }

        // When player clicks "Play"
        function onPlayButtonClick() {
            const startLevel = gameManager.getStartLevel();
            startGame(startLevel);  // Starts from level 5
        }

        // When player completes a level
        async function onLevelComplete(level) {
            await gameManager.handleLevelComplete(level, {
                xpEarned: 100,
                timeTaken: 5000
            });
        }

        // Initialize on page load
        initGame();
    </script>
</body>
</html>
```

### Option 2: Fetch from API

```javascript
// If you need to fetch from API instead
const progressBridge = new ProgressBridge({
    apiUrl: 'https://api.yourgame.com/player/progress',
    timeout: 5000,
    useProvidedPayload: false  // Fetch from API
});

// Initialize without payload (will fetch)
await gameManager.initialize();
```

### React Native Example

```javascript
import React, { useEffect, useState } from 'react';
import { View, Button, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GameScreen = () => {
    const [gameManager, setGameManager] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        initGame();
    }, []);

    const initGame = async () => {
        // 1. Fetch payload from your API
        const response = await fetch('https://api.yourgame.com/player/progress');
        const apiPayload = await response.json();

        // 2. Create Game Manager
        const progressBridge = new ProgressBridge({
            useProvidedPayload: true
        });

        const storageManager = new StorageManager({
            storageKey: 'gameProgress',
            useAsyncStorage: true,
            asyncStorage: AsyncStorage
        });

        const validator = new Validator({
            minLevel: 1,
            maxLevel: 100
        });

        const manager = new GameManager({
            progressBridge,
            storageManager,
            validator,
            analyticsBridge: YourAnalyticsBridge,
            config: CONFIG
        });

        // 3. Initialize with API payload
        await manager.initialize(apiPayload);
        
        setGameManager(manager);
        setLoading(false);
    };

    const handlePlay = () => {
        const level = gameManager.getStartLevel();
        // Start game from this level
    };

    if (loading) return <ActivityIndicator />;

    return (
        <View>
            <Button title="Play" onPress={handlePlay} />
        </View>
    );
};
```

**📱 See [REACT_NATIVE_GUIDE.md](REACT_NATIVE_GUIDE.md) for complete React Native documentation.**

## 🔧 Configuration

Edit `config.js` to customize:

```javascript
const CONFIG = {
    api: {
        progressUrl: 'https://api.yourgame.com/player/progress',
        timeout: 5000,
        retryAttempts: 2,
        cacheDuration: 60000 // 1 minute
    },
    
    levels: {
        minLevel: 1,
        maxLevel: 100,
        defaultLevel: 1
    },
    
    features: {
        offlineMode: true,
        preferApiData: true,
        strictValidation: true
    }
};
```

## 📖 API Documentation

### GameManager

#### `initialize()`

Initializes the game manager. Call this early when the game starts.

```javascript
const result = await gameManager.initialize();
// Returns: { success: boolean, startLevel: number, source: string }
```

**Source values:**
- `'api'` - Loaded from API
- `'local'` - Loaded from local storage
- `'default'` - Fallback to level 1

#### `getStartLevel()`

Gets the level to start from. Call this when player presses "Play".

```javascript
const level = gameManager.getStartLevel();
```

#### `handleLevelComplete(level, data)`

Call this when player completes a level. Automatically:
- Updates local storage
- Sends to analytics bridge
- Syncs progress

```javascript
await gameManager.handleLevelComplete(5, {
    xpEarned: 100,
    timeTaken: 5000
});
```

#### `syncProgress()`

Manually sync progress with API.

```javascript
await gameManager.syncProgress();
```

#### `getState()`

Get current game state.

```javascript
const state = gameManager.getState();
// Returns: { initialized, currentLevel, highestLevelPlayed, apiAvailable }
```

### ProgressBridge

#### `initialize()`

Initialize and fetch initial progress.

```javascript
await progressBridge.initialize();
```

#### `getHighestLevelPlayed()`

Get highest level from API.

```javascript
const level = await progressBridge.getHighestLevelPlayed();
```

#### `getPlayerStats()`

Get complete player stats.

```javascript
const stats = await progressBridge.getPlayerStats();
// Returns full API response
```

### StorageManager

#### `saveHighestLevel(level)`

Save level to local storage.

```javascript
await storageManager.saveHighestLevel(10);
```

#### `loadHighestLevel()`

Load saved level.

```javascript
const level = await storageManager.loadHighestLevel();
```

### Validator

#### `validateLevel(level)`

Validate a level value.

```javascript
const result = validator.validateLevel(5);
// Returns: { valid: boolean, value: number|null, reason: string }
```

#### `validateAnalyticsPayload(payload)`

Validate analytics payload before sending.

```javascript
const result = validator.validateAnalyticsPayload({
    highestLevelPlayed: "5", // Will be converted to number
    diagnostics: {
        levels: [{ levelId: "3" }] // Will be converted
    }
});
```

## 🔄 How It Works

### 1. Game Initialization

```
┌─────────────┐
│ Game Starts │
└──────┬──────┘
       │
       v
┌──────────────────┐
│ Initialize Mgr   │
└──────┬───────────┘
       │
       v
┌──────────────────┐     ┌─────────────────┐
│ Fetch from API   │────>│ Validate Data   │
└──────┬───────────┘     └─────────┬───────┘
       │                           │
       v                           v
┌──────────────────┐     ┌─────────────────┐
│ Load from Local  │────>│ Resolve Level   │
└──────────────────┘     └─────────┬───────┘
                                   │
                                   v
                         ┌─────────────────┐
                         │ Save to Local   │
                         └─────────────────┘
```

### 2. Level Selection Logic

**When both API and local storage have data:**

```javascript
if (CONFIG.features.preferApiData) {
    // Use API level
    // But if local is higher, use local
    level = Math.max(apiLevel, localLevel);
} else {
    // Use whichever is higher
    level = Math.max(apiLevel, localLevel);
}
```

### 3. Level Completion Flow

```
┌─────────────────┐
│ Level Complete  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Validate Level  │
└────────┬────────┘
         │
         v
    ┌────┴────┐
    │ Is New  │
    │ Highest?│
    └────┬────┘
         │ Yes
         v
┌─────────────────┐     ┌──────────────────┐
│ Save to Local   │────>│ Send Analytics   │
└─────────────────┘     └──────────────────┘
```

## 🛡️ Data Validation

The system ensures:

1. **Type Safety** - All levels are converted to numbers
2. **Range Checking** - Levels must be within min/max range
3. **Null Handling** - Graceful fallback when data is missing
4. **String Conversion** - Automatically converts string numbers

### Example Validation

```javascript
// Input: "5" (string)
// Output: 5 (number)

// Input: 150 (out of range)
// Output: null (invalid)

// Input: null
// Output: null (fallback to default)
```

## 📊 Edge Cases Handled

✅ **API unavailable** - Falls back to local storage  
✅ **Local storage cleared** - Uses API data  
✅ **Both unavailable** - Starts at level 1  
✅ **Invalid data types** - Validates and converts  
✅ **Network timeout** - Retries with backoff  
✅ **Corrupted local data** - Validates before use  
✅ **Out of range levels** - Rejects invalid values  
✅ **Offline play** - Saves locally, syncs later

## 🔗 Integration with Analytics Bridge

The system sends data through your **existing analytics bridge** without modifying it.

### Expected Analytics Bridge API

Your bridge should have one of these methods:

```javascript
// Option 1
AnalyticsBridge.sendEvent(payload)

// Option 2
AnalyticsBridge.send(payload)
```

### Payload Format

```javascript
{
    "highestLevelPlayed": 6,        // Always a number
    "xpEarnedTotal": 100,
    "name": "Level Complete",
    "diagnostics": {
        "levels": [
            {
                "levelId": 5,       // Always a number
                "timeTaken": 5000
            }
        ]
    }
}
```

### Backend Payload Mode (Recommended)

Open `backend-example.html` in a browser to test with backend payload:

1. **Initialize** - Uses backend payload directly (no API call)
2. **Play** - Starts from level 5 (from backend payload)
3. **Complete Level** - Increments level and sends analytics
4. **Reset** - Clear all progress (testing only)

### Full Demo with Mock API

## 🧪 Testing

Open `index.html` in a browser to test:

1. **Initialize** - Fetches progress and loads from storage
2. **Play** - Starts from correct level
3. **Complete Level** - Increments level and sends analytics
4. **Sync** - Manually sync with API
5. **Reset** - Clear all progress (testing only)

Check the browser console and on-screen log for detailed output.

## 🐛 Debugging

Enable detailed logging in `config.js`:

```javascript
logging: {
    enabled: true,
    logLevel: 'debug'  // 'debug', 'info', 'warn', 'error'
}
```

All components prefix their logs:

- `[ProgressBridge]` - API requests
- `[StorageManager]` - Local storage operations
- `[Validator]` - Data validation
- `[GameManager]` - Coordination logic

## ⚠️ Important Notes

### DO NOT MODIFY

- Your existing Analytics Bridge plugin
- The existing POST request implementation

### DO CONFIGURE

- `config.js` - Update API URL
- Level ranges (min/max)
- Timeout and retry settings

### API Response Format

Your API should return:

```json
{
    "userId": "string",
    "gameId": "string",
    "highestLevelPlayed": number,
    "totalXp": number,
    "totalPlayTime": number,
    "sessionsCount": number
}
```

### Required Fields

- `userId` (string)
- `gameId` (string)
- `highestLevelPlayed` (number)

## 🎮 Example Workflow

```javascript
// 1. Initialize on game startup
const gameManager = await initializeGameManager();

// 2. When player presses "Play"
function startGame() {
    const level = gameManager.getStartLevel();
    loadLevel(level);
}

// 3. When level is completed
async function onLevelWin() {
    const levelData = {
        xpEarned: 100,
        timeTaken: Date.now() - levelStartTime
    };
    
    await gameManager.handleLevelComplete(currentLevel, levelData);
    
    // Move to next level
    currentLevel++;
    loadLevel(currentLevel);
}

// 4. Periodic sync (optional)
setInterval(() => {
    gameManager.syncProgress();
}, 300000); // Every 5 minutes
```

## 🔒 Security Considerations

- Validate all API responses
- Sanitize user data before storage
- Use HTTPS for API calls
- Implement authentication if needed
- Don't expose sensitive data in logs

## 📝 License

ISC

## 🤝 Support

For issues or questions, check the logs first. All components provide detailed logging to help diagnose problems.

---

**Built for robust, cross-platform game progress management** 🎮
