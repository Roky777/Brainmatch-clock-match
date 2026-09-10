/**
 * Validator - Validates game data and progress
 */

class Validator {
  constructor(config = {}) {
    this.minLevel = config.minLevel || 1;
    this.maxLevel = config.maxLevel || 100;
  }

  /**
   * Validate highest level played
   * @param {*} level - Level to validate
   * @returns {Object} {valid: boolean, value: number|null, reason: string}
   */
  validateLevel(level) {
    // Check if it exists
    if (level === null || level === undefined) {
      return {
        valid: false,
        value: null,
        reason: 'Level is null or undefined',
      };
    }

    // Check if it's a number
    if (typeof level !== 'number') {
      console.warn('[Validator] Level is not a number:', typeof level);
      
      // Try to convert string to number
      if (typeof level === 'string' && !isNaN(Number(level))) {
        const converted = Number(level);
        console.log(`[Validator] Converted string "${level}" to number ${converted}`);
        level = converted;
      } else {
        return {
          valid: false,
          value: null,
          reason: `Invalid type: ${typeof level}`,
        };
      }
    }

    // Check if it's NaN
    if (isNaN(level)) {
      return {
        valid: false,
        value: null,
        reason: 'Level is NaN',
      };
    }

    // Check if it's an integer
    if (!Number.isInteger(level)) {
      console.warn('[Validator] Level is not an integer:', level);
      level = Math.floor(level);
      console.log(`[Validator] Rounded to ${level}`);
    }

    // Check if it's within valid range
    if (level < this.minLevel || level > this.maxLevel) {
      return {
        valid: false,
        value: level,
        reason: `Level ${level} out of range [${this.minLevel}, ${this.maxLevel}]`,
      };
    }

    return {
      valid: true,
      value: level,
      reason: 'Valid',
    };
  }

  /**
   * Validate analytics payload before sending
   * Ensures highestLevelPlayed and levelId are numbers
   * @param {Object} payload - Analytics payload
   * @returns {Object} {valid: boolean, cleaned: Object|null, errors: Array}
   */
  validateAnalyticsPayload(payload) {
    const errors = [];
    const cleaned = JSON.parse(JSON.stringify(payload)); // Deep clone

    // Validate highestLevelPlayed
    if ('highestLevelPlayed' in cleaned) {
      const levelValidation = this.validateLevel(cleaned.highestLevelPlayed);
      
      if (!levelValidation.valid) {
        errors.push(`highestLevelPlayed: ${levelValidation.reason}`);
      } else {
        cleaned.highestLevelPlayed = levelValidation.value;
      }
    }

    // Validate diagnostics.levels[].levelId
    if (cleaned.diagnostics && Array.isArray(cleaned.diagnostics.levels)) {
      cleaned.diagnostics.levels = cleaned.diagnostics.levels.map((level, index) => {
        if ('levelId' in level) {
          const levelIdValidation = this.validateLevel(level.levelId);
          
          if (!levelIdValidation.valid) {
            errors.push(`diagnostics.levels[${index}].levelId: ${levelIdValidation.reason}`);
          } else {
            level.levelId = levelIdValidation.value;
          }
        }
        return level;
      });
    }

    return {
      valid: errors.length === 0,
      cleaned: errors.length === 0 ? cleaned : null,
      errors,
    };
  }

  /**
   * Validate player stats from API
   * @param {Object} stats - Player stats object
   * @returns {Object} {valid: boolean, errors: Array}
   */
  validatePlayerStats(stats) {
    const errors = [];

    if (!stats || typeof stats !== 'object') {
      errors.push('Stats is not an object');
      return { valid: false, errors };
    }

    // Check required fields
    const requiredFields = {
      userId: 'string',
      gameId: 'string',
      highestLevelPlayed: 'number',
    };

    for (const [field, expectedType] of Object.entries(requiredFields)) {
      if (!(field in stats)) {
        errors.push(`Missing field: ${field}`);
      } else if (typeof stats[field] !== expectedType) {
        errors.push(`Invalid type for ${field}: expected ${expectedType}, got ${typeof stats[field]}`);
      }
    }

    // Validate level if present
    if ('highestLevelPlayed' in stats) {
      const levelValidation = this.validateLevel(stats.highestLevelPlayed);
      if (!levelValidation.valid) {
        errors.push(`highestLevelPlayed: ${levelValidation.reason}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default level (fallback)
   * @returns {number}
   */
  getDefaultLevel() {
    return this.minLevel;
  }

  /**
   * Update level range
   * @param {number} minLevel
   * @param {number} maxLevel
   */
  setLevelRange(minLevel, maxLevel) {
    this.minLevel = minLevel;
    this.maxLevel = maxLevel;
    console.log(`[Validator] Level range updated to [${minLevel}, ${maxLevel}]`);
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Validator;
}

if (typeof window !== 'undefined') {
  window.Validator = Validator;
}
