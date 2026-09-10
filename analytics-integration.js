/**
 * Analytics Integration for BrainMatch Game
 * 
 * This module integrates the AnalyticsManager bridge with the existing game
 * without modifying the original script.js file. It uses monkey-patching to
 * hook into game functions and track analytics events.
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize Analytics Manager (from analytics-bridge.js)
// Using singleton pattern with getInstance() for the new analytics system
const analytics = AnalyticsManager.getInstance();

// ============================================================================
// ANALYTICS HELPER FUNCTIONS
// ============================================================================

// Track level start time for duration calculation
let levelStartTime = null;
let currentLevelId = null;
let currentRunId = '';
const submittedLevelsByRun = new Map();

function createRunId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `brainmatch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function ensureCampaignRun(level) {
  const submittedLevels = currentRunId ? submittedLevelsByRun.get(currentRunId) : null;
  const isReplayAfterSubmit = Boolean(submittedLevels && submittedLevels.has(level));

  if (!currentRunId || level === 1 || isReplayAfterSubmit) {
    const previousRunId = currentRunId;
    currentRunId = createRunId();
    submittedLevelsByRun.set(currentRunId, new Set());
    analytics.initialize('BrainMatch', currentRunId);
    console.log('[Analytics] Started campaign run:', currentRunId);
    if (isReplayAfterSubmit) {
      console.log('[Analytics] Restarted campaign run for submitted level replay:', { previousRunId, currentRunId, level });
    }
  }
}

function submitCompletedCampaignLevel(level, xp) {
  if (!currentRunId) {
    console.warn('[Analytics] Missing runId; level submit skipped.');
    return;
  }

  const submittedLevels = submittedLevelsByRun.get(currentRunId) || new Set();
  if (submittedLevels.has(level)) {
    console.warn(`[Analytics] Duplicate submit skipped for run ${currentRunId}, level ${level}`);
    return;
  }

  const result = analytics.submitLevel(level, { runId: currentRunId });
  if (result && result.success === false) {
    console.error('[Analytics] Level submit rejected:', result.errors);
    return;
  }

  try {
    window.parent.postMessage(result, '*');
  } catch (_error) {
    // The bridge already attempted delivery; this fallback is only for local harness visibility.
  }

  submittedLevels.add(level);
  submittedLevelsByRun.set(currentRunId, submittedLevels);
  console.log(`[Analytics] Level ${level} submitted for run ${currentRunId}, XP: ${xp}`);
}

// Replicate XP calculation from script.js
function calculateXP(level, turns) {
  switch (level) {
    case 1:
      if (turns <= 12) return 40;
      if (turns <= 16) return 35;
      return 30;
    case 2:
      if (turns <= 14) return 60;
      if (turns <= 18) return 50;
      return 40;
    case 3:
      if (turns <= 16) return 100;
      if (turns <= 20) return 80;
      return 60;
    default:
      return 0;
  }
}

// ============================================================================
// MONKEY-PATCHING: LEVEL START
// ============================================================================

// Hook into Campaign Mode - startGame()
const originalStartGame = window.startGame;
window.startGame = function(level) {
  ensureCampaignRun(level);

  // Track level start - Use numeric levelId to ensure it's stored as a number
  currentLevelId = level; // Store as number for proper tracking
  levelStartTime = Date.now();
  
  analytics.startLevel(currentLevelId, { levelNumber: level });
  console.log(`[Analytics] Started Level: ${currentLevelId}`);
  
  // Call original function
  originalStartGame.apply(this, arguments);
};
startGame = window.startGame;

// Hook into Reflex Mode - startReflexMode()
const originalStartReflexMode = window.startReflexMode;
window.startReflexMode = function() {
  // Track reflex mode start - Use 0 for reflex mode as a special level
  currentLevelId = 0; // Special numeric ID for reflex mode
  levelStartTime = Date.now();
  currentRunId = '';
  
  analytics.initialize('BrainMatch', createRunId());
  analytics.startLevel(currentLevelId, { levelNumber: 0 });
  console.log(`[Analytics] Started Reflex Mode (Level: ${currentLevelId})`);
  
  // Call original function
  originalStartReflexMode.apply(this, arguments);
};
startReflexMode = window.startReflexMode;

// ============================================================================
// MONKEY-PATCHING: LEVEL END (Success Cases)
// ============================================================================

// Hook into Campaign Win - handleCampaignWin()
const originalHandleCampaignWin = window.handleCampaignWin;
window.handleCampaignWin = function() {
  try {
    // Capture data BEFORE calling original function
    // gameState is let-scoped in script.js — accessible as bare name, not via window
    const level = gameState.currentCampaignLevel || 1;
    const turns = gameState.turns || 0;
    const xp = calculateXP(level, turns);
    const timeTaken = levelStartTime ? Date.now() - levelStartTime : 0;
    
    // Track level completion
    analytics.endLevel(currentLevelId, true, timeTaken, xp);
    
    // Add raw metrics
    analytics.addRawMetric('level', level.toString());
    analytics.addRawMetric('turns', turns.toString());
    analytics.addRawMetric('xp_earned', xp.toString());
    submitCompletedCampaignLevel(level, xp);
    
    console.log(`[Analytics] Completed Level: ${currentLevelId}, Success: true, Time: ${timeTaken}ms, XP: ${xp}`);
  } catch (error) {
    console.error('[Analytics] Error in handleCampaignWin:', error);
  }
  
  // Always call original function
  return originalHandleCampaignWin.call(this);
};
handleCampaignWin = window.handleCampaignWin;

// Hook into Reflex Mode End - handleReflexModeEnd()
const originalHandleReflexModeEnd = window.handleReflexModeEnd;
window.handleReflexModeEnd = function() {
  try {
    // gameState is let-scoped in script.js — accessible as bare name, not via window
    const moves = gameState.turns || 0;
    const timeTaken = levelStartTime ? Date.now() - levelStartTime : 0;
    
    // Add raw metrics
    analytics.addRawMetric('total_moves', moves.toString());
    
    console.log(`[Analytics] Completed Reflex Mode, Success: true, Time: ${timeTaken}ms, Moves: ${moves}`);
    console.log('[Analytics] Reflex mode is telemetry-only; no level XP payload submitted.');
  } catch (error) {
    console.error('[Analytics] Error in handleReflexModeEnd:', error);
  }
  
  // Always call original function
  return originalHandleReflexModeEnd.call(this);
};
handleReflexModeEnd = window.handleReflexModeEnd;

// ============================================================================
// MONKEY-PATCHING: LEVEL END (Failure Cases)
// ============================================================================

// Hook into Timer Failure - startTimer()
// We need to intercept the failure condition inside the timer
const originalStartTimer = window.startTimer;
window.startTimer = function(duration) {
  // Call original function first
  originalStartTimer.apply(this, arguments);
  
  // Replace the interval with our wrapped version
  clearInterval(gameState.timerId);
  
  gameState.timerId = setInterval(() => {
    if (gameState.isPaused) return;
    
    gameState.timeRemaining--;
    if (typeof timerDisplay !== 'undefined') timerDisplay.textContent = gameState.timeRemaining;
    
    if (gameState.timeRemaining <= 0) {
      window.clearAllTimers();
      
      // Track level failure
      const timeTaken = levelStartTime ? Date.now() - levelStartTime : 0;
      const turns = gameState.turns;
      
      analytics.addRawMetric('failure_reason', 'timeout');
      analytics.addRawMetric('turns_before_failure', turns.toString());

      console.log(`[Analytics] Level Failed: ${currentLevelId}, Reason: timeout, Time: ${timeTaken}ms`);
      console.log('[Analytics] Failed attempts are telemetry-only; no level XP payload submitted.');
      
      // Original failure handling
      alert("Time's Up! Try again.");
      window.showStartScreen();
    }
  }, 1000);
};
startTimer = window.startTimer;

// ============================================================================
// MONKEY-PATCHING: TASK RECORDING
// ============================================================================

// Hook into Correct Match - handleCorrectMatch()
const originalHandleCorrectMatch = window.handleCorrectMatch;
window.handleCorrectMatch = function() {
  // Wrap analytics in try-catch to prevent breaking game flow
  try {
    // IMPORTANT: Capture flipped cards BEFORE calling original function
    // because the original function may clear the flippedCards array
    const flippedCards = gameState && gameState.flippedCards;
    
    if (flippedCards && flippedCards.length >= 2) {
      const [first, second] = flippedCards;
      const card1Value = first.dataset.value;
      const card2Value = second.dataset.value;
      
      // Get the display value (extract filename if it's an image path)
      const getDisplayValue = (val) => {
        if (val.includes('/') || val.includes('\\')) {
          // Extract filename from path
          return val.split('/').pop().split('\\').pop();
        }
        return val;
      };
      
      const question = `Match: ${getDisplayValue(card1Value)}`;
      const correctAnswer = getDisplayValue(card2Value);
      const userAnswer = getDisplayValue(card2Value);
      
      // Record task (we don't have exact timing per card, so use 0)
      // XP is awarded at level end, not per task
      analytics.recordTask(
        currentLevelId,
        `task_${gameState.turns}`,
        question,
        correctAnswer,
        userAnswer,
        0,
        0
      );
      
      console.log(`[Analytics] Task Recorded - Correct Match: ${question} -> ${correctAnswer}`);
    }
  } catch (error) {
    console.error('[Analytics] Error tracking correct match:', error);
  }
  
  // Always call original function regardless of analytics errors
  return originalHandleCorrectMatch.call(this);
};
handleCorrectMatch = window.handleCorrectMatch;

// Hook into Incorrect Match - handleIncorrectMatch()
const originalHandleIncorrectMatch = window.handleIncorrectMatch;
window.handleIncorrectMatch = function() {
  // Wrap analytics in try-catch to prevent breaking game flow
  try {
    // IMPORTANT: Capture flipped cards BEFORE calling original function
    const flippedCards = gameState && gameState.flippedCards;
    
    if (flippedCards && flippedCards.length >= 2) {
      const [first, second] = flippedCards;
      const card1Value = first.dataset.value;
      const card2Value = second.dataset.value;
      
      // Get the display value
      const getDisplayValue = (val) => {
        if (val.includes('/') || val.includes('\\')) {
          return val.split('/').pop().split('\\').pop();
        }
        return val;
      };
      
      const question = `Match: ${getDisplayValue(card1Value)}`;
      const correctAnswer = getDisplayValue(first.dataset.match);
      const userAnswer = getDisplayValue(card2Value);
      
      // Record failed task
      analytics.recordTask(
        currentLevelId,
        `task_${gameState.turns}`,
        question,
        correctAnswer,
        userAnswer,
        0,
        0
      );
      
      console.log(`[Analytics] Task Recorded - Incorrect Match: ${question}, Expected: ${correctAnswer}, Got: ${userAnswer}`);
    }
  } catch (error) {
    console.error('[Analytics] Error tracking incorrect match:', error);
  }
  
  // Always call original function regardless of analytics errors
  return originalHandleIncorrectMatch.call(this);
};
handleIncorrectMatch = window.handleIncorrectMatch;

// Hook into Reflex Timeout - handleReflexTimeout()
const originalHandleReflexTimeout = window.handleReflexTimeout;
window.handleReflexTimeout = function() {
  try {
    // gameState is let-scoped in script.js — accessible as bare name, not via window
    if (!gameState.isReflexActive) {
      return originalHandleReflexTimeout.call(this);
    }
    
    const reflexCard = gameState.reflexCard;
    const cardValue = reflexCard ? reflexCard.dataset.value : 'unknown';
    
    const getDisplayValue = (val) => {
      if (val && (val.includes('/') || val.includes('\\'))) {
        return val.split('/').pop().split('\\').pop();
      }
      return val || 'unknown';
    };
    
    const question = `Reflex: ${getDisplayValue(cardValue)}`;
    const correctAnswer = reflexCard ? getDisplayValue(reflexCard.dataset.match) : 'unknown';
    
    // Record timeout as failed task
    analytics.recordTask(
      currentLevelId,
      `task_${gameState.turns || 0}_timeout`,
      question,
      correctAnswer,
      'TIMEOUT',
      0,
      0
    );
    
    console.log(`[Analytics] Task Recorded - Reflex Timeout: ${question}`);
  } catch (error) {
    console.error('[Analytics] Error in handleReflexTimeout:', error);
  }
  
  // Always call original function
  return originalHandleReflexTimeout.call(this);
};
handleReflexTimeout = window.handleReflexTimeout;

// ============================================================================
// HOOK: FINAL SCORE SCREEN — single submit with full campaign XP
// ============================================================================

const originalShowFinalScoreScreen = window.showFinalScoreScreen;
window.showFinalScoreScreen = function() {
  try {
    const totalXP = analytics._reportData.xpEarnedTotal || 0;

    let finalStars = 1;
    if (totalXP >= 150) finalStars = 3;
    else if (totalXP >= 70) finalStars = 2;

    analytics.addRawMetric('campaign_complete', 'true');
    analytics.addRawMetric('total_campaign_xp', totalXP.toString());
    analytics.addRawMetric('final_stars', finalStars.toString());

    console.log(`[Analytics] Campaign complete — levels were submitted individually. Total XP: ${totalXP}, Stars: ${finalStars}`);
  } catch (error) {
    console.error('[Analytics] Error in showFinalScoreScreen hook:', error);
  }

  return originalShowFinalScoreScreen.call(this);
};
showFinalScoreScreen = window.showFinalScoreScreen;

// ============================================================================
// ADDITIONAL RAW METRICS
// ============================================================================

// Track when user returns to main menu (optional)
const originalShowStartScreen = window.showStartScreen;
window.showStartScreen = function() {
  console.log('[Analytics] Returned to main menu');
  currentRunId = '';
  
  // Call original function
  originalShowStartScreen.apply(this, arguments);
};
showStartScreen = window.showStartScreen;

console.log('[Analytics] Integration script loaded successfully');
