/**
 * Configuration - Game and bridge settings
 */

const CONFIG = {
  // API Configuration
  api: {
    // Set to null if backend provides payload directly
    progressUrl: null,
    timeout: 5000,
    retryAttempts: 2,
    cacheDuration: 60000, // 1 minute
    // If true, expects payload from backend instead of fetching
    useProvidedPayload: true,
  },

  // Level Configuration
  levels: {
    minLevel: 1,
    maxLevel: 100,
    defaultLevel: 1,
  },

  // Storage Configuration
  storage: {
    storageKey: 'brainMatch-which-season_progress',
    useAsyncStorage: false, // Set to true for React Native
  },

  // Sync Configuration
  sync: {
    // How often to sync progress (in milliseconds)
    syncInterval: 300000, // 5 minutes
    
    // Auto-save after level completion
    autoSave: true,
    
    // Send analytics after level completion
    sendAnalytics: true,
  },

  // Feature Flags
  features: {
    // Enable offline play
    offlineMode: true,
    
    // Prefer API data over local storage when both available
    preferApiData: true,
    
    // Validate all data before using
    strictValidation: true,
  },

  // Logging
  logging: {
    enabled: true,
    logLevel: 'info', // 'debug', 'info', 'warn', 'error'
  },
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
