/**
 * Progress Bridge - Fetches player progress from server
 * Separate from Analytics Bridge (GET requests only)
 * Works for Web and React Native environments
 */

class ProgressBridge {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || '';
    this.timeout = config.timeout || 5000;
    this.retryAttempts = config.retryAttempts || 2;
    this.initialized = false;
    this.cachedProgress = null;
    this.lastFetchTime = null;
    this.cacheDuration = config.cacheDuration || 60000; // 1 minute default
    this.useProvidedPayload = config.useProvidedPayload || false;
    this.providedPayload = null;
  }

  /**
   * Set payload provided by backend
   * @param {Object} payload - Player progress payload from backend
   */
  setPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      console.error('[ProgressBridge] Invalid payload provided');
      return false;
    }

    if (!this._validateResponse(payload)) {
      console.error('[ProgressBridge] Payload validation failed');
      return false;
    }

    this.providedPayload = payload;
    this.cachedProgress = payload;
    this.lastFetchTime = Date.now();
    console.log('[ProgressBridge] Payload set successfully');
    return true;
  }

  /**
   * Initialize the bridge early in game startup
   * @param {Object} payload - Optional: Backend-provided payload
   * @returns {Promise<boolean>} Success status
   */
  async initialize(payload = null) {
    if (this.initialized) {
      console.log('[ProgressBridge] Already initialized');
      return true;
    }

    try {
      console.log('[ProgressBridge] Initializing...');
      
      // If payload provided, use it directly
      if (payload) {
        this.setPayload(payload);
        this.initialized = true;
        console.log('[ProgressBridge] Initialized with provided payload');
        return true;
      }
      
      // If using provided payload mode but no payload given yet
      if (this.useProvidedPayload) {
        console.log('[ProgressBridge] Waiting for backend payload...');
        this.initialized = false;
        return false;
      }
      
      // Otherwise fetch from API
      await this.fetchPlayerProgress();
      this.initialized = true;
      console.log('[ProgressBridge] Initialized successfully');
      return true;
    } catch (error) {
      console.warn('[ProgressBridge] Initialization failed:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Fetch player progress from server
   * @param {boolean} forceRefresh - Skip cache if true
   * @returns {Promise<Object|null>} Player progress data
   */
  async fetchPlayerProgress(forceRefresh = false) {
    // If using provided payload, return it
    if (this.useProvidedPayload && this.providedPayload) {
      console.log('[ProgressBridge] Using backend-provided payload');
      return this.providedPayload;
    }

    // Return cached data if still valid
    if (!forceRefresh && this.cachedProgress && this._isCacheValid()) {
      console.log('[ProgressBridge] Returning cached progress');
      return this.cachedProgress;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[ProgressBridge] Retry attempt ${attempt}/${this.retryAttempts}`);
          await this._delay(1000 * attempt); // Exponential backoff
        }

        const progressData = await this._makeRequest();
        
        if (progressData) {
          this.cachedProgress = progressData;
          this.lastFetchTime = Date.now();
          console.log('[ProgressBridge] Progress fetched successfully');
          return progressData;
        }
      } catch (error) {
        lastError = error;
        console.warn(`[ProgressBridge] Fetch attempt ${attempt + 1} failed:`, error.message);
      }
    }

    console.error('[ProgressBridge] All fetch attempts failed:', lastError?.message || 'Unknown error');
    return null;
  }

  /**
   * Get highest level played from fetched progress
   * @returns {Promise<number|null>} Highest level or null if unavailable
   */
  async getHighestLevelPlayed() {
    try {
      const progress = await this.fetchPlayerProgress();
      
      if (!progress) {
        console.warn('[ProgressBridge] No progress data available');
        return null;
      }

      const level = progress.highestLevelPlayed;

      // Validate it's a number
      if (typeof level !== 'number' || isNaN(level)) {
        console.warn('[ProgressBridge] Invalid level type:', typeof level);
        return null;
      }

      return level;
    } catch (error) {
      console.error('[ProgressBridge] Error getting highest level:', error.message);
      return null;
    }
  }

  /**
   * Get full player stats
   * @returns {Promise<Object|null>} Complete player stats
   */
  async getPlayerStats() {
    return await this.fetchPlayerProgress();
  }

  /**
   * Clear cached progress data
   */
  clearCache() {
    this.cachedProgress = null;
    this.lastFetchTime = null;
    console.log('[ProgressBridge] Cache cleared');
  }

  /**
   * Check if instance is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Make HTTP GET request (works in Web and React Native)
   * @private
   */
  async _makeRequest() {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.timeout);

      // Use fetch API (available in modern browsers and React Native)
      fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(response => {
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.json();
        })
        .then(data => {
          // Validate response structure
          if (!this._validateResponse(data)) {
            throw new Error('Invalid response structure');
          }

          resolve(data);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Validate API response structure
   * @private
   */
  _validateResponse(data) {
    if (!data || typeof data !== 'object') {
      console.warn('[ProgressBridge] Response is not an object');
      return false;
    }

    // Check required fields
    const requiredFields = ['userId', 'gameId', 'highestLevelPlayed'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        console.warn(`[ProgressBridge] Missing required field: ${field}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Check if cached data is still valid
   * @private
   */
  _isCacheValid() {
    if (!this.lastFetchTime) return false;
    return (Date.now() - this.lastFetchTime) < this.cacheDuration;
  }

  /**
   * Delay helper for retry logic
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressBridge;
}

if (typeof window !== 'undefined') {
  window.ProgressBridge = ProgressBridge;
}
