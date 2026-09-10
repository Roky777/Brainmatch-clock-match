/**
 * Storage Manager - Handles local storage persistence
 * Works for Web (localStorage) and React Native (AsyncStorage)
 */

class StorageManager {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'brainMatch-which-season_progress';
    this.useAsyncStorage = options.useAsyncStorage || false;
    this.asyncStorage = options.asyncStorage || null;
  }

  /**
   * Save highest level played to local storage
   * @param {number} level - Level to save
   * @returns {Promise<boolean>} Success status
   */
  async saveHighestLevel(level) {
    try {
      if (typeof level !== 'number' || isNaN(level)) {
        console.error('[StorageManager] Invalid level type:', typeof level);
        return false;
      }

      const data = {
        highestLevelPlayed: level,
        lastUpdated: Date.now(),
        version: 1,
      };

      if (this.useAsyncStorage && this.asyncStorage) {
        // React Native AsyncStorage
        await this.asyncStorage.setItem(this.storageKey, JSON.stringify(data));
      } else {
        // Web localStorage
        if (typeof localStorage === 'undefined') {
          console.warn('[StorageManager] localStorage not available');
          return false;
        }
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      }

      console.log(`[StorageManager] Saved level ${level} to storage`);
      return true;
    } catch (error) {
      console.error('[StorageManager] Error saving level:', error.message);
      return false;
    }
  }

  /**
   * Load highest level played from local storage
   * @returns {Promise<number|null>} Saved level or null
   */
  async loadHighestLevel() {
    try {
      let dataStr = null;

      if (this.useAsyncStorage && this.asyncStorage) {
        // React Native AsyncStorage
        dataStr = await this.asyncStorage.getItem(this.storageKey);
      } else {
        // Web localStorage
        if (typeof localStorage === 'undefined') {
          console.warn('[StorageManager] localStorage not available');
          return null;
        }
        dataStr = localStorage.getItem(this.storageKey);
      }

      if (!dataStr) {
        console.log('[StorageManager] No saved data found');
        return null;
      }

      const data = JSON.parse(dataStr);
      
      if (typeof data.highestLevelPlayed !== 'number') {
        console.warn('[StorageManager] Invalid saved level type');
        return null;
      }

      console.log(`[StorageManager] Loaded level ${data.highestLevelPlayed} from storage`);
      return data.highestLevelPlayed;
    } catch (error) {
      console.error('[StorageManager] Error loading level:', error.message);
      return null;
    }
  }

  /**
   * Save complete game progress
   * @param {Object} progress - Progress data
   * @returns {Promise<boolean>}
   */
  async saveProgress(progress) {
    try {
      const data = {
        ...progress,
        lastUpdated: Date.now(),
        version: 1,
      };

      if (this.useAsyncStorage && this.asyncStorage) {
        await this.asyncStorage.setItem(this.storageKey, JSON.stringify(data));
      } else {
        if (typeof localStorage === 'undefined') {
          return false;
        }
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      }

      console.log('[StorageManager] Progress saved successfully');
      return true;
    } catch (error) {
      console.error('[StorageManager] Error saving progress:', error.message);
      return false;
    }
  }

  /**
   * Load complete game progress
   * @returns {Promise<Object|null>}
   */
  async loadProgress() {
    try {
      let dataStr = null;

      if (this.useAsyncStorage && this.asyncStorage) {
        dataStr = await this.asyncStorage.getItem(this.storageKey);
      } else {
        if (typeof localStorage === 'undefined') {
          return null;
        }
        dataStr = localStorage.getItem(this.storageKey);
      }

      if (!dataStr) {
        return null;
      }

      return JSON.parse(dataStr);
    } catch (error) {
      console.error('[StorageManager] Error loading progress:', error.message);
      return null;
    }
  }

  /**
   * Clear all saved progress data
   * @returns {Promise<boolean>}
   */
  async clearProgress() {
    try {
      if (this.useAsyncStorage && this.asyncStorage) {
        await this.asyncStorage.removeItem(this.storageKey);
      } else {
        if (typeof localStorage === 'undefined') {
          return false;
        }
        localStorage.removeItem(this.storageKey);
      }

      console.log('[StorageManager] Progress cleared');
      return true;
    } catch (error) {
      console.error('[StorageManager] Error clearing progress:', error.message);
      return false;
    }
  }

  /**
   * Check if storage is available
   * @returns {boolean}
   */
  isAvailable() {
    if (this.useAsyncStorage) {
      return this.asyncStorage !== null;
    }
    return typeof localStorage !== 'undefined';
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}

if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
