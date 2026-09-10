/**
 * ProgressBridge - Fetches player progress from API (GET requests)
 * 
 * This bridge is separate from the analytics POST bridge and handles
 * fetching player data from the server/client to track highestLevelPlayed.
 * 
 * Works for both Web and React Native environments.
 */
class ProgressBridge {
  constructor() {
    if (ProgressBridge.instance) {
      return ProgressBridge.instance;
    }

    this._isInitialized = false;
    this._apiBaseUrl = '';
    this._userId = '';
    this._gameId = '';
    this._lastFetchedProgress = null;
    this._fetchInProgress = false;
    
    ProgressBridge.instance = this;
  }
  
  static getInstance() {
    if (!ProgressBridge.instance) {
      ProgressBridge.instance = new ProgressBridge();
    }
    return ProgressBridge.instance;
  }
  
  /**
   * Initialize the progress bridge
   * @param {string} apiBaseUrl - Base API URL (e.g., 'https://api.example.com')
   * @param {string} userId - User identifier
   * @param {string} gameId - Game identifier
   */
  initialize(apiBaseUrl, userId, gameId) {
    this._apiBaseUrl = apiBaseUrl;
    this._userId = userId;
    this._gameId = gameId;
    this._isInitialized = true;
    
    console.log('[ProgressBridge] Initialized:', {
      apiBaseUrl: this._apiBaseUrl,
      userId: this._userId,
      gameId: this._gameId
    });
  }
  
  /**
   * Fetch player progress from the API
   * @returns {Promise<Object>} Player progress data
   */
  async fetchProgress() {
    if (!this._isInitialized) {
      console.warn('[ProgressBridge] Not initialized. Using offline mode.');
      return this._handleOfflineMode();
    }
    
    // Prevent concurrent fetch calls
    if (this._fetchInProgress) {
      console.log('[ProgressBridge] Fetch already in progress, waiting...');
      await new Promise(resolve => setTimeout(resolve, 500));
      return this._lastFetchedProgress || this._handleOfflineMode();
    }
    
    this._fetchInProgress = true;
    
    try {
      const endpoint = `${this._apiBaseUrl}/api/player-progress/${this._userId}/${this._gameId}`;
      console.log('[ProgressBridge] Fetching from:', endpoint);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[ProgressBridge] Fetched data:', data);
      
      // Validate the response structure
      if (!this._validateProgressData(data)) {
        console.warn('[ProgressBridge] Invalid data structure, using offline mode');
        return this._handleOfflineMode();
      }
      
      this._lastFetchedProgress = data;
      return data;
      
    } catch (error) {
      console.error('[ProgressBridge] Fetch failed:', error.message);
      console.log('[ProgressBridge] Falling back to offline mode');
      return this._handleOfflineMode();
    } finally {
      this._fetchInProgress = false;
    }
  }
  
  /**
   * Validate the progress data structure
   * @param {Object} data - Data to validate
   * @returns {boolean} True if valid
   */
  _validateProgressData(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    // Check that highestLevelPlayed exists and is a number
    if (!('highestLevelPlayed' in data)) {
      return false;
    }
    
    if (typeof data.highestLevelPlayed !== 'number') {
      return false;
    }
    
    return true;
  }
  
  /**
   * Handle offline mode by returning local storage data
   * @returns {Object} Offline progress data
   */
  _handleOfflineMode() {
    const localLevel = this._getLocalHighestLevel();
    
    return {
      userId: this._userId || 'offline',
      gameId: this._gameId || 'BrainMatch',
      highestLevelPlayed: localLevel,
      totalXp: 0,
      totalPlayTime: 0,
      sessionsCount: 0,
      _offline: true
    };
  }
  
  /**
   * Get the highest level from local storage
   * @returns {number} Highest level (default: 1)
   */
  _getLocalHighestLevel() {
    try {
      const stored = localStorage.getItem('brainmatch_highest_level');
      if (stored) {
        const level = parseInt(stored, 10);
        if (!isNaN(level) && level >= 1) {
          return level;
        }
      }
    } catch (error) {
      console.error('[ProgressBridge] localStorage access failed:', error);
    }
    
    return 1; // Default to level 1
  }
  
  /**
   * Save the highest level to local storage
   * @param {number} level - Level to save
   */
  _saveLocalHighestLevel(level) {
    if (typeof level !== 'number' || level < 1) {
      console.warn('[ProgressBridge] Invalid level:', level);
      return;
    }
    
    try {
      localStorage.setItem('brainmatch_highest_level', level.toString());
      console.log('[ProgressBridge] Saved local level:', level);
    } catch (error) {
      console.error('[ProgressBridge] localStorage save failed:', error);
    }
  }
  
  /**
   * Get the highest level the player can start from
   * @param {number} maxLevel - Maximum level in the game (default: 3)
   * @returns {Promise<number>} Validated highest level
   */
  async getHighestLevelPlayed(maxLevel = 3) {
    const progress = await this.fetchProgress();
    
    let highestLevel = progress.highestLevelPlayed || 1;
    
    // Ensure it's a number
    if (typeof highestLevel !== 'number') {
      console.warn('[ProgressBridge] highestLevelPlayed is not a number:', highestLevel);
      highestLevel = 1;
    }
    
    // Ensure it's within valid range
    if (highestLevel < 1) {
      console.warn('[ProgressBridge] highestLevelPlayed < 1:', highestLevel);
      highestLevel = 1;
    }
    
    if (highestLevel > maxLevel) {
      console.warn('[ProgressBridge] highestLevelPlayed > maxLevel:', highestLevel, '>', maxLevel);
      highestLevel = maxLevel;
    }
    
    // Save to local storage for offline use
    this._saveLocalHighestLevel(highestLevel);
    
    console.log('[ProgressBridge] Validated highestLevelPlayed:', highestLevel);
    return highestLevel;
  }
  
  /**
   * Update the highest level locally
   * This is called when the player completes a higher level
   * @param {number} level - New highest level
   */
  updateLocalLevel(level) {
    if (typeof level !== 'number' || level < 1) {
      console.warn('[ProgressBridge] Invalid level to update:', level);
      return;
    }
    
    const currentLocal = this._getLocalHighestLevel();
    
    // Only update if the new level is higher
    if (level > currentLocal) {
      this._saveLocalHighestLevel(level);
      console.log('[ProgressBridge] Updated local level from', currentLocal, 'to', level);
    }
  }
  
  /**
   * Get cached progress data (doesn't make a new API call)
   * @returns {Object|null} Last fetched progress or null
   */
  getCachedProgress() {
    return this._lastFetchedProgress;
  }
  
  /**
   * Check if the bridge is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this._isInitialized;
  }
}

// Export for ES modules and global window scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressBridge;
}

if (typeof window !== 'undefined') {
  window.ProgressBridge = ProgressBridge;
}
