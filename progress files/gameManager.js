/**
 * Game Manager - Coordinates game progress, storage, and analytics
 * Keeps local storage, API data, and analytics bridge in sync
 * 
 * NOTE: This assumes your existing Analytics Bridge is available globally
 * and has a method to send data (e.g., AnalyticsBridge.sendEvent(payload))
 */

class GameManager {
  constructor(options = {}) {
    // Initialize components
    this.progressBridge = options.progressBridge || null;
    this.storageManager = options.storageManager || null;
    this.validator = options.validator || null;
    this.analyticsBridge = options.analyticsBridge || null;
    
    // Configuration
    this.config = options.config || {};
    
    // State
    this.currentLevel = null;
    this.highestLevelPlayed = null;
    this.initialized = false;
    this.apiAvailable = false;
    
    // Bind methods
    this.handleLevelComplete = this.handleLevelComplete.bind(this);
  }

  /**
   * Initialize the game manager
   * Fetches progress from API and local storage
   * @param {Object} backendPayload - Optional: Payload from backend
   * @returns {Promise<Object>} {success: boolean, startLevel: number, source: string}
   */
  async initialize(backendPayload = null) {
    if (this.initialized) {
      console.log('[GameManager] Already initialized');
      return {
        success: true,
        startLevel: this.highestLevelPlayed,
        source: 'cache',
      };
    }

    console.log('[GameManager] Initializing...');

    try {
      // Step 1: Initialize Progress Bridge (with optional backend payload)
      if (this.progressBridge) {
        this.apiAvailable = await this.progressBridge.initialize(backendPayload);
      }

      // Step 2: Fetch level from API
      let apiLevel = null;
      if (this.apiAvailable && this.progressBridge) {
        apiLevel = await this.progressBridge.getHighestLevelPlayed();
        console.log('[GameManager] API level:', apiLevel);
      }

      // Step 3: Load level from local storage
      let localLevel = null;
      if (this.storageManager) {
        localLevel = await this.storageManager.loadHighestLevel();
        console.log('[GameManager] Local level:', localLevel);
      }

      // Step 4: Determine which level to use
      const result = await this._resolveStartLevel(apiLevel, localLevel);
      
      this.highestLevelPlayed = result.startLevel;
      this.currentLevel = result.startLevel;
      this.initialized = true;

      console.log(`[GameManager] Initialized - Starting at level ${result.startLevel} (source: ${result.source})`);
      
      return result;
    } catch (error) {
      console.error('[GameManager] Initialization error:', error.message);
      
      // Fallback to default level
      const defaultLevel = this.validator?.getDefaultLevel() || 1;
      this.highestLevelPlayed = defaultLevel;
      this.currentLevel = defaultLevel;
      this.initialized = true;

      return {
        success: false,
        startLevel: defaultLevel,
        source: 'default',
        error: error.message,
      };
    }
  }

  /**
   * Get the starting level for the game
   * Call this when player presses "Play"
   * @returns {number}
   */
  getStartLevel() {
    if (!this.initialized) {
      console.warn('[GameManager] Not initialized, returning default level');
      return this.validator?.getDefaultLevel() || 1;
    }

    return this.highestLevelPlayed;
  }

  /**
   * Handle level completion
   * Updates progress and syncs with storage and analytics
   * @param {number} completedLevel - Level that was completed
   * @param {Object} levelData - Additional level data (xp, time, etc.)
   * @returns {Promise<boolean>}
   */
  async handleLevelComplete(completedLevel, levelData = {}) {
    console.log(`[GameManager] Level ${completedLevel} completed`);

    // Validate the completed level
    const validation = this.validator?.validateLevel(completedLevel);
    if (!validation || !validation.valid) {
      console.error('[GameManager] Invalid completed level:', validation?.reason);
      return false;
    }

    const validLevel = validation.value;
    const nextLevel = validLevel + 1;

    try {
      // Check if this is a new highest level
      const isNewHighest = this.highestLevelPlayed === null || validLevel >= this.highestLevelPlayed;

      if (isNewHighest) {
        console.log(`[GameManager] New highest level: ${nextLevel}`);
        this.highestLevelPlayed = nextLevel;
        
        // Update local storage
        if (this.storageManager) {
          await this.storageManager.saveHighestLevel(nextLevel);
          console.log('[GameManager] Saved to local storage');
        }

        // Send to analytics bridge
        if (this.analyticsBridge && this.config.sync?.sendAnalytics !== false) {
          await this._sendAnalytics(validLevel, nextLevel, levelData);
        }
      }

      // Update current level
      this.currentLevel = nextLevel;

      return true;
    } catch (error) {
      console.error('[GameManager] Error handling level completion:', error.message);
      return false;
    }
  }

  /**
   * Manually sync progress with API and analytics
   * @returns {Promise<boolean>}
   */
  async syncProgress() {
    if (!this.initialized) {
      console.warn('[GameManager] Cannot sync - not initialized');
      return false;
    }

    console.log('[GameManager] Syncing progress...');

    try {
      // Fetch latest from API
      if (this.apiAvailable && this.progressBridge) {
        const apiLevel = await this.progressBridge.getHighestLevelPlayed(true); // Force refresh
        
        if (apiLevel !== null) {
          const validation = this.validator?.validateLevel(apiLevel);
          
          if (validation && validation.valid) {
            // Check if API has higher level than local
            if (apiLevel > this.highestLevelPlayed) {
              console.log(`[GameManager] API has higher level (${apiLevel} > ${this.highestLevelPlayed})`);
              this.highestLevelPlayed = apiLevel;
              
              // Update local storage
              if (this.storageManager) {
                await this.storageManager.saveHighestLevel(apiLevel);
              }
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('[GameManager] Sync error:', error.message);
      return false;
    }
  }

  /**
   * Reset progress (for testing or new game)
   * @returns {Promise<boolean>}
   */
  async resetProgress() {
    console.log('[GameManager] Resetting progress...');

    try {
      const defaultLevel = this.validator?.getDefaultLevel() || 1;
      
      this.highestLevelPlayed = defaultLevel;
      this.currentLevel = defaultLevel;

      if (this.storageManager) {
        await this.storageManager.clearProgress();
      }

      if (this.progressBridge) {
        this.progressBridge.clearCache();
      }

      console.log('[GameManager] Progress reset complete');
      return true;
    } catch (error) {
      console.error('[GameManager] Reset error:', error.message);
      return false;
    }
  }

  /**
   * Get current game state
   * @returns {Object}
   */
  getState() {
    return {
      initialized: this.initialized,
      currentLevel: this.currentLevel,
      highestLevelPlayed: this.highestLevelPlayed,
      apiAvailable: this.apiAvailable,
    };
  }

  /**
   * Resolve which level to use when starting the game
   * @private
   */
  async _resolveStartLevel(apiLevel, localLevel) {
    const defaultLevel = this.validator?.getDefaultLevel() || 1;

    // Validate API level
    let validApiLevel = null;
    if (apiLevel !== null) {
      const apiValidation = this.validator?.validateLevel(apiLevel);
      if (apiValidation && apiValidation.valid) {
        validApiLevel = apiValidation.value;
      } else {
        console.warn('[GameManager] API level invalid:', apiValidation?.reason);
      }
    }

    // Validate local level
    let validLocalLevel = null;
    if (localLevel !== null) {
      const localValidation = this.validator?.validateLevel(localLevel);
      if (localValidation && localValidation.valid) {
        validLocalLevel = localValidation.value;
      } else {
        console.warn('[GameManager] Local level invalid:', localValidation?.reason);
      }
    }

    // Decision logic
    let startLevel = defaultLevel;
    let source = 'default';

    if (validApiLevel !== null && validLocalLevel !== null) {
      // Both available - use the higher one or prefer API based on config
      if (this.config.features?.preferApiData) {
        startLevel = validApiLevel;
        source = 'api';
        
        // But if local is higher, use that and sync to analytics
        if (validLocalLevel > validApiLevel) {
          startLevel = validLocalLevel;
          source = 'local';
          console.log('[GameManager] Local level higher than API, using local');
        }
      } else {
        startLevel = Math.max(validApiLevel, validLocalLevel);
        source = startLevel === validApiLevel ? 'api' : 'local';
      }

      // Save to local storage if using API data
      if (source === 'api' && this.storageManager) {
        await this.storageManager.saveHighestLevel(validApiLevel);
        console.log('[GameManager] Synced API level to local storage');
      }
    } else if (validApiLevel !== null) {
      // Only API available
      startLevel = validApiLevel;
      source = 'api';
      
      // Save to local storage
      if (this.storageManager) {
        await this.storageManager.saveHighestLevel(validApiLevel);
      }
    } else if (validLocalLevel !== null) {
      // Only local available
      startLevel = validLocalLevel;
      source = 'local';
    }

    return {
      success: true,
      startLevel,
      source,
    };
  }

  /**
   * Send analytics data through existing analytics bridge
   * @private
   */
  async _sendAnalytics(completedLevel, newHighestLevel, levelData) {
    try {
      // Build analytics payload
      const payload = {
        highestLevelPlayed: newHighestLevel,
        xpEarnedTotal: levelData.xpEarned || 0,
        name: 'Level Complete',
        diagnostics: {
          levels: [
            {
              levelId: completedLevel,
              timeTaken: levelData.timeTaken || 0,
            },
          ],
        },
      };

      // Validate payload
      if (this.validator) {
        const validation = this.validator.validateAnalyticsPayload(payload);
        
        if (!validation.valid) {
          console.error('[GameManager] Invalid analytics payload:', validation.errors);
          return false;
        }

        // Use cleaned payload
        if (validation.cleaned) {
          Object.assign(payload, validation.cleaned);
        }
      }

      console.log('[GameManager] Sending analytics:', payload);

      // Send through existing analytics bridge
      // Adjust this based on your actual analytics bridge API
      if (this.analyticsBridge && typeof this.analyticsBridge.sendEvent === 'function') {
        await this.analyticsBridge.sendEvent(payload);
        console.log('[GameManager] Analytics sent successfully');
      } else if (this.analyticsBridge && typeof this.analyticsBridge.send === 'function') {
        await this.analyticsBridge.send(payload);
        console.log('[GameManager] Analytics sent successfully');
      } else {
        console.warn('[GameManager] Analytics bridge not configured properly');
      }

      return true;
    } catch (error) {
      console.error('[GameManager] Error sending analytics:', error.message);
      return false;
    }
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameManager;
}

if (typeof window !== 'undefined') {
  window.GameManager = GameManager;
}
