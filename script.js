// --- DEV FEATURE FLAG ---
// Set to true to enable developer features (e.g., press 'C' to complete a level)
const DEV_MODE = false;

// --- DOM Elements ---
const startScreen = document.querySelector(".start-screen");
const gameContainer = document.querySelector(".game-container");
const winScreen = document.querySelector(".win-screen");

const pauseMenu = document.querySelector('.pause-menu');
const pauseTutorial = document.querySelector('.pause-tutorial');
const pauseButton = document.getElementById('pause-button');
const tutorialButton = document.getElementById('tutorial-button');
const resumeButton = document.getElementById('resume-button');
const exitButton = document.getElementById('exit-button');
const closeTutorialButton = document.getElementById('close-tutorial-button');
const startCampaignButton = document.getElementById("start-campaign-button");

const startReflexButton = document.getElementById("start-reflex-button");
const nextActionButton = document.getElementById("next-action-button");
const cardGrid = document.querySelector(".card-grid");
const levelDisplay = document.getElementById("level-display");
const turnsContainer = document.getElementById("turns-container");
const turnsDisplay = document.getElementById("turns");
const timerContainer = document.getElementById("timer-container");
const timerDisplay = document.getElementById("timer");
const winTitle = document.getElementById("win-title");
const winStatsLabel = document.getElementById("win-stats-label");
const winStatsValue = document.getElementById("win-stats-value");
const winXpContainer = document.getElementById("win-xp-container");
const winXpDisplay = document.getElementById("win-xp");
const winStarsContainer = document.getElementById("win-stars-container");

const finalScoreScreen = document.querySelector(".final-score-screen");
const finalTurnsDisplay = document.getElementById("final-turns-value");
const finalXpDisplay = document.getElementById("final-xp-value");
// const mainMenuButton = document.getElementById('main-menu-button');
const finalStarsContainer = document.getElementById("final-stars-container");
const mainMenuButton = document.getElementById("main-menu-button");

const turnsLabel = document.getElementById("turns-label");

const peekTimer = document.querySelector(".peek-timer");
const peekTimerTextElements = peekTimer.querySelectorAll(".timer-countdown");
const peekTimerProgress = peekTimer.querySelector(".timer-progress");

// --- Sound Elements ---
const sounds = {
  correct: document.getElementById("correct-sound"),
  incorrect: document.getElementById("incorrect-sound"),
  flip: document.getElementById("flip-sound"),
  reflex: document.getElementById("reflex-sound"),
  backgroundMusic: document.getElementById("background-music"),
  levelComplete: document.getElementById("level-complete-sound"),
  campaignComplete: document.getElementById("campaign-complete-sound"),
};

// Function to handle background music
function startBackgroundMusic() {
  if (sounds.backgroundMusic) {
    sounds.backgroundMusic.volume = 0.3; // Set volume to 30%
    sounds.backgroundMusic.play().catch((e) => {});
  }
}

function stopBackgroundMusic() {
  if (sounds.backgroundMusic) {
    sounds.backgroundMusic.pause();
    sounds.backgroundMusic.currentTime = 0;
  }
}

// --- Game Content ---
let gameContent = null;

// --- Progress Save System Integration ---
let gameManager = null;
let highestLevelPlayed = 1; // Default to level 1
const MAX_GAME_LEVEL = 3;
const TUTORIAL_STORAGE_KEY = "brainmatch_clock_match_tutorial_seen";
const GAME_STORAGE_KEY = "brainMatch-clock-match_progress";

// Load game content from JSON file
async function loadGameContent() {
  try {
    const response = await fetch("gameContent.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    gameContent = await response.json();
    
    // Initialize GameManager and fetch highest level
    await initializeGameManager();
    
    // Enable start button once content is loaded
    startCampaignButton.disabled = false;
  } catch (error) {
    console.error("Error loading game content:", error);
    alert("Error loading game content. Please refresh the page.");
  }
}

// Initialize the GameManager and fetch player progress
async function initializeGameManager() {
  try {
    console.log('[Game] Initializing GameManager...');
    
    // Update CONFIG with game-specific settings
    CONFIG.levels.maxLevel = MAX_GAME_LEVEL;
    
    // Create ProgressBridge
    const progressBridge = new ProgressBridge({
      useProvidedPayload: CONFIG.api.useProvidedPayload,
      apiUrl: CONFIG.api.progressUrl,
      timeout: CONFIG.api.timeout,
      retryAttempts: CONFIG.api.retryAttempts,
      cacheDuration: CONFIG.api.cacheDuration,
    });
    
    // Create StorageManager
    const storageManager = new StorageManager({
      storageKey: GAME_STORAGE_KEY,
      useAsyncStorage: CONFIG.storage.useAsyncStorage,
    });
    
    // Create Validator
    const validator = new Validator({
      minLevel: CONFIG.levels.minLevel,
      maxLevel: CONFIG.levels.maxLevel,
    });
    
    // Get AnalyticsManager if available (global set by analytics-bridge.js)
    const analyticsBridge = typeof AnalyticsManager !== 'undefined' ? AnalyticsManager.getInstance() : null;
    
    // Create GameManager
    gameManager = new GameManager({
      progressBridge,
      storageManager,
      validator,
      analyticsBridge: null, // level-wise analytics payloads are handled by analytics-integration.js
      config: CONFIG,
    });
    
    // Initialize GameManager
    // Read injected userInfo from React Native WebView (keys are remapped to match validator requirements)
    const userInfo = window.userInfo;
    const backendPayload = (userInfo && userInfo.UserID && userInfo.GameID)
      ? {
          userId: userInfo.UserID,
          gameId: userInfo.GameID,
          highestLevelPlayed: typeof userInfo.highestLevelPlayed === 'number' ? userInfo.highestLevelPlayed : 1,
        }
      : null;
    const result = await gameManager.initialize(backendPayload);
    
    highestLevelPlayed = result.startLevel;
    
    console.log(`[Game] GameManager initialized - Starting at level ${highestLevelPlayed} (source: ${result.source})`);
    
  } catch (error) {
    console.error('[Game] GameManager initialization failed:', error);
    // Fall back to default level
    highestLevelPlayed = 1;
  }
}

// --- Game State ---
let gameState = {};
let totalCampaignTurns = 0;
let totalCampaignXP = 0;

function resetGameState() {
  clearAllTimers();
  gameState = {
    gameMode: null,
    currentCampaignLevel: 1,
    flippedCards: [],
    lockBoard: false,
    turns: 0,
    timeRemaining: 0,
    timerId: null,
    matchedPairs: 0,
    totalPairs: 0,
    isReflexActive: false,
    reflexCard: null,
    reflexTimeoutId: null,
    isPaused: false,
  };
}

// --- Scoring and Feedback ---
// Every campaign has a 200-XP perfect-play cap, regardless of its level count.
const XP_SCHEDULES = {
  1: [200],
  2: [80, 120],
  3: [40, 60, 100],
  4: [30, 40, 50, 80],
  5: [20, 30, 40, 50, 60],
  6: [15, 20, 30, 35, 45, 55],
  7: [10, 15, 20, 30, 35, 40, 50],
  8: [10, 15, 20, 20, 25, 30, 35, 45],
  9: [8, 12, 16, 18, 20, 22, 25, 34, 45],
};

function getLevelXPRewards(level) {
  const pairCount = gameContent?.content?.science?.[`level${level}`]?.pairs?.length || 4;
  // A perfect game needs exactly one turn per pair. Two extra turns form the medium tier.
  const perfectTurns = pairCount;
  const mediumTurns = pairCount + 2;
  // A one-level game is a complete 200-XP campaign by itself.
  if (MAX_GAME_LEVEL === 1) {
    return { maxXP: 200, mediumXP: 160, lowXP: 120, perfectTurns, mediumTurns };
  }
  const rewards = XP_SCHEDULES[MAX_GAME_LEVEL] || [];
  const maxXP = rewards[level - 1] || 0;
  return {
    maxXP,
    mediumXP: Math.round(maxXP * 0.8),
    lowXP: Math.round(maxXP * 0.6),
    perfectTurns,
    mediumTurns,
  };
}

// Deliberately scoped with a game-specific name. The protected analytics
// integration also declares calculateXP(), so a generic global name causes it
// to replace the game's current 200-XP rules after this script loads.
function calculateGameXP(level, turns) {
  const rewards = getLevelXPRewards(level);
  if (turns <= rewards.perfectTurns) return rewards.maxXP;
  if (turns <= rewards.mediumTurns) return rewards.mediumXP;
  return rewards.lowXP;
}

function calculateCampaignStars(level, turns) {
  const rewards = getLevelXPRewards(level);
  if (turns <= rewards.perfectTurns) return 3;
  if (turns <= rewards.mediumTurns) return 2;
  return 1;
}

// Keep the inherited analytics integration source untouched while ensuring its
// submitted XP uses this game's GDD-aware turn thresholds.
if (typeof AnalyticsManager !== "undefined" && !AnalyticsManager.prototype.__clockMatchXpPatched) {
  const originalEndLevel = AnalyticsManager.prototype.endLevel;
  AnalyticsManager.prototype.endLevel = function(levelId, success, timeTaken, xp) {
    const level = Number(levelId);
    const correctedXp = success && gameState.gameMode === "campaign"
      ? calculateGameXP(level, gameState.turns)
      : xp;
    return originalEndLevel.call(this, levelId, success, timeTaken, correctedXp);
  };
  AnalyticsManager.prototype.__clockMatchXpPatched = true;
}

function calculateReflexStars(moves) {
  if (moves === 8) return 3;
  if (moves <= 12) return 2;
  return 1;
}

// --- Core Game Logic ---
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getTextCardType(value) {
  if (/^(?:1[0-2]|[1-9]):00$/.test(value)) return "time";
  if (/^\d$/.test(value)) return "number";
  if (/^₹\d+$/.test(value)) return "money";
  if (/^[A-Z]$/.test(value)) return "letter";
  if (value.length > 7) return "long-word";
  return "word";
}

// --- Board Creation with Multiple Content Types Support ---
function createBoard(pairs) {
  // Use every pair defined by the GDD: 8 cards for Levels 1–2 and 16 for Level 3.
  const boardPairs = pairs;
  cardGrid.innerHTML = "";
  cardGrid.classList.toggle("card-grid--two-by-two", boardPairs.length === 2);
  const cardArray = [];
  gameState.totalPairs = boardPairs.length;

  boardPairs.forEach((pair) => {
    if (pair.a !== undefined) {
      // Text to Text mode
      if (pair.b !== undefined) {
        cardArray.push({ value: pair.a, match: pair.b, type: getTextCardType(pair.a) });
        cardArray.push({ value: pair.b, match: pair.a, type: getTextCardType(pair.b) });
      }
      // Text to Image mode
      else if (pair.image !== undefined) {
        cardArray.push({ value: pair.a, match: pair.image, type: getTextCardType(pair.a) });
        cardArray.push({
          value: pair.image,
          match: pair.a,
          type: "image",
          alt: pair.imageAlt,
          imageClass: pair.imageClass,
        });
      }
    }
    // Image to Image mode
    else if (pair.firstImage !== undefined) {
      cardArray.push({
        value: pair.firstImage,
        match: pair.secondImage,
        type: "image",
        alt: pair.firstImageAlt,
        imageClass: pair.firstImageClass,
      });
      cardArray.push({
        value: pair.secondImage,
        match: pair.firstImage,
        type: "image",
        alt: pair.secondImageAlt,
        imageClass: pair.secondImageClass,
      });
    }
  });

  shuffle(cardArray).forEach((item) => {
    const card = document.createElement("div");
    card.classList.add("card");
    card.dataset.value = item.value;
    card.dataset.match = item.match;

    const frontFaceContent =
      item.type === "image"
        ? `<img class="${item.imageClass || ""}" src="${item.value}" alt="${item.alt || ""}" />`
        : item.value;

    card.innerHTML = `
            <div class="front-face${item.type === "time" ? " time-card" : item.type === "number" ? " number-card" : item.type === "money" ? " money-card" : item.type === "letter" ? " letter-card" : item.type === "long-word" ? " word-card long-word" : item.type === "word" ? " word-card" : ""}">${frontFaceContent}</div>
            <div class="back-face"></div>
        `;

    card.addEventListener("click", flipCard);
    cardGrid.appendChild(card);
  });
}

function flipCard() {
  if (
    (gameState.lockBoard && !gameState.isReflexActive) ||
    this.classList.contains("flipped") ||
    gameState.isPaused
  )
    return;
  if (gameState.isReflexActive) {
    handleReflexResponse(this);
  } else {
    handleNormalFlip(this);
  }
}

function handleNormalFlip(card) {
  if (sounds.flip) {
    sounds.flip.play().catch((e) => {});
  }
  card.classList.add("flipped");
  gameState.flippedCards.push(card);
  if (gameState.flippedCards.length === 2) {
    gameState.lockBoard = true;
    updateTurns();
    checkForMatch();
  }
}

function checkForMatch() {
  const [first, second] = gameState.flippedCards;
  first.dataset.value === second.dataset.match
    ? handleCorrectMatch()
    : handleIncorrectMatch();
}

function handleCorrectMatch() {
  const [first, second] = gameState.flippedCards;
  first.removeEventListener("click", flipCard);
  second.removeEventListener("click", flipCard);
  first.classList.add("correct");
  second.classList.add("correct");
  if (sounds.correct) {
    sounds.correct.play().catch((e) => {});
  }
  gameState.matchedPairs++;
  resetTurnState();
  if (gameState.matchedPairs === gameState.totalPairs) {
    if (gameState.gameMode === "campaign") handleCampaignWin();
    if (gameState.gameMode === "reflex") handleReflexModeEnd();
  } else if (gameState.gameMode === "reflex") {
    setTimeout(triggerNextReflexChallenge, 500);
  }
}

// Find this function in your script.js
function handleIncorrectMatch() {
  const [first, second] = gameState.flippedCards;
  // Only play sound if the audio element exists
  if (sounds.incorrect) {
    sounds.incorrect.play().catch((e) => {});
  }
  if (navigator.vibrate) navigator.vibrate(200);

  // --- MODIFY THE NEXT TWO SECTIONS ---

  // 1. ADD the 'incorrect' class along with 'shake'
  setTimeout(() => {
    first.classList.add("shake", "incorrect");
    second.classList.add("shake", "incorrect");
  }, 200);

  // 2. REMOVE the 'incorrect' class when the cards flip back
  setTimeout(() => {
    first.classList.remove("flipped", "shake", "incorrect");
    second.classList.remove("flipped", "shake", "incorrect");
    resetTurnState();
    if (gameState.gameMode === "reflex") {
      setTimeout(triggerNextReflexChallenge, 500);
    }
  }, 1200);
}

// function handleIncorrectMatch() {
//     const [first, second] = gameState.flippedCards;
//     // Only play sound if the audio element exists
//     if (sounds.incorrect) {
//         sounds.incorrect.play().catch(e => {});
//     }
//     if (navigator.vibrate) navigator.vibrate(200);
//     setTimeout(() => { first.classList.add('shake'); second.classList.add('shake'); }, 200);
//     setTimeout(() => {
//         first.classList.remove('flipped', 'shake'); second.classList.remove('flipped', 'shake');
//         resetTurnState();
//         if (gameState.gameMode === 'reflex') { setTimeout(triggerNextReflexChallenge, 500); }
//     }, 1200);
// }

function resetTurnState() {
  if (gameState.reflexCard)
    gameState.reflexCard.classList.remove("reflex-active");
  gameState.flippedCards = [];
  gameState.lockBoard = false;
  gameState.isReflexActive = false;
  gameState.reflexCard = null;
}

// --- Specific Game Mode Logic ---
function updateTurns() {
  gameState.turns++;
  turnsDisplay.textContent = gameState.turns;
}

function triggerNextReflexChallenge() {
  if (
    gameState.matchedPairs === gameState.totalPairs ||
    gameState.isReflexActive
  )
    return;
  const unmatchedCards = Array.from(
    document.querySelectorAll(".card:not(.correct)")
  );
  if (unmatchedCards.length < 2) return;
  gameState.isReflexActive = true;
  gameState.lockBoard = true;
  sounds.reflex.play().catch((e) => {});
  gameState.reflexCard =
    unmatchedCards[Math.floor(Math.random() * unmatchedCards.length)];
  gameState.reflexCard.classList.add("flipped", "reflex-active");
  gameState.reflexTimeoutId = setTimeout(handleReflexTimeout, 4000);
}

function handleReflexResponse(playerCard) {
  clearTimeout(gameState.reflexTimeoutId);
  if (playerCard === gameState.reflexCard) return;
  updateTurns(); // A player's response counts as a move
  playerCard.classList.add("flipped");
  gameState.flippedCards = [gameState.reflexCard, playerCard];
  checkForMatch();
}

function handleReflexTimeout() {
  if (!gameState.isReflexActive) return;
  updateTurns(); // Timing out also counts as a move
  sounds.incorrect.play().catch((e) => {});
  gameState.reflexCard.classList.remove("flipped", "reflex-active");
  resetTurnState();
  setTimeout(triggerNextReflexChallenge, 500);
}

// --- Game Flow & Screen Management ---
function peekAtStart(duration, callback) {
    gameState.lockBoard = true;
    gameContainer.classList.add("is-peeking");
    const cards = document.querySelectorAll(".card");
    const blocks = document.querySelectorAll('.timer-block');
    // The 'countdownText' variable has been removed
    const flipOpenDelay = 100;
    const flipAnimationTime = 600;

    let timeLeft = duration / 1000;

    // Set initial state
    peekTimer.classList.remove('hidden');
    // Line to update text content has been removed

    const timerInterval = setInterval(() => {
        // Find the correct block to hide.
        const blockToHide = blocks[timeLeft - 1];
        if (blockToHide) {
            blockToHide.classList.add('inactive');
        }

        timeLeft--;
        // Line to update text content has been removed

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);

    // --- Card flipping timeouts remain the same ---
    setTimeout(() => {
        cards.forEach((card) => card.classList.add("flipped"));
    }, flipOpenDelay);

    setTimeout(() => {
        cards.forEach((card) => card.classList.remove("flipped"));
    }, duration + flipOpenDelay);

    setTimeout(() => {
        gameState.lockBoard = false;
        gameContainer.classList.remove("is-peeking");
        peekTimer.classList.add('hidden');
        // Reset blocks for the next round
        blocks.forEach(block => block.classList.remove('inactive'));
        if (callback) {
            callback();
        }
    }, duration + flipOpenDelay + flipAnimationTime);
}
function createPeekTimerBlocks(seconds) {
    const container = document.querySelector('.timer-blocks-container');
    container.innerHTML = ''; // Clear any blocks from the previous game
    for (let i = 0; i < seconds; i++) {
        const block = document.createElement('div');
        block.classList.add('timer-block');
        container.appendChild(block);
    }
}
function startGame(level) {
  if (!gameContent) {
    alert("Game content not loaded. Please refresh the page.");
    return;
  }
  if (level === 1) {
    totalCampaignTurns = 0;
    totalCampaignXP = 0;
  }
  resetGameState();
  startBackgroundMusic();
  gameState.gameMode = "campaign";
  gameState.currentCampaignLevel = level;
  const levelData = gameContent.content.science[`level${level}`];
  startScreen.classList.add("hidden");
  winScreen.classList.add("hidden");
  gameContainer.classList.remove("hidden");
  levelDisplay.textContent = `LEVEL ${level}`;
  turnsDisplay.textContent = "0";
  timerContainer.classList.toggle("hidden", !levelData.timer);
  turnsLabel.textContent = "TURNS";
  createBoard(levelData.pairs);



  const peekDurationSeconds = 5; // Define duration in seconds
  createPeekTimerBlocks(peekDurationSeconds); // Create the blocks
  peekAtStart(peekDurationSeconds * 1000, () => { // Pass duration in ms
      if (levelData.timer) startTimer(levelData.timer);
  });
}

function startReflexMode() {
  resetGameState();
  gameState.gameMode = "reflex";
  const allPairs = Array.from({ length: MAX_GAME_LEVEL }, (_, index) =>
    gameContent.content.science[`level${index + 1}`].pairs
  ).flat();
  const reflexPairs = shuffle(allPairs).slice(0, 8);
  startScreen.classList.add("hidden");
  winScreen.classList.add("hidden");
  gameContainer.classList.remove("hidden");
  levelDisplay.textContent = "REFLEX MODE";
  turnsDisplay.textContent = "0";
  timerContainer.classList.add("hidden");
  turnsLabel.textContent = "MOVES";
  createBoard(reflexPairs);

  const peekDurationSeconds = 2; // Shorter duration for reflex mode
  createPeekTimerBlocks(peekDurationSeconds); // Create the blocks
  peekAtStart(peekDurationSeconds * 1000, () => { // Pass duration in ms
      setTimeout(triggerNextReflexChallenge, 1000);
  });
}

function handleCampaignWin() {
  clearAllTimers();
  const level = gameState.currentCampaignLevel;
  console.log(`handleCampaignWin called for level: ${level}`);
  const levelRewards = getLevelXPRewards(level);
  const xp = Math.min(levelRewards.maxXP, Math.max(0, calculateGameXP(level, gameState.turns)));
  const stars = calculateCampaignStars(level, gameState.turns);
  totalCampaignTurns += gameState.turns;
  totalCampaignXP = Math.min(200, totalCampaignXP + xp);
  
  // Update highest level played using GameManager
  if (gameManager) {
    const levelData = {
      xpEarned: xp,
      timeTaken: 0, // Add timer tracking if needed
      turns: gameState.turns,
      stars: stars,
    };
    
    gameManager.handleLevelComplete(level, levelData).then(success => {
      if (success) {
        highestLevelPlayed = gameManager.getState().highestLevelPlayed;
        console.log('[Game] Progress saved successfully');
      }
    }).catch(error => {
      console.error('[Game] Error saving progress:', error);
    });
  }
  
  setTimeout(() => {
    // --- ADDED: Trigger Confetti ---
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 }
        });
    }
    
    gameContainer.classList.add("hidden");
    winScreen.classList.remove("hidden");
    winStarsContainer.classList.remove("hidden");
    winXpContainer.classList.remove("hidden");
    console.log(`Playing sound for level: ${level}`);
    winTitle.textContent =
      level < MAX_GAME_LEVEL ? `LEVEL ${level} COMPLETE!` : "GAME COMPLETE!";
    winStatsLabel.textContent = "TURNS";
    winStatsValue.textContent = gameState.turns;
    winXpDisplay.textContent = `${xp} / ${levelRewards.maxXP}`;
    const starElements = winStarsContainer.querySelectorAll(".star");
    starElements.forEach((star, index) =>
      star.classList.toggle("filled", index < stars)
    );

    // Play appropriate completion sound
    if (level === MAX_GAME_LEVEL) {
      if (sounds.campaignComplete) {
        sounds.campaignComplete.play().catch((e) => {});
      }
    } else {
      if (sounds.levelComplete) {
        sounds.levelComplete.play().catch((e) => {});
      }
    }

    if (level < MAX_GAME_LEVEL) {
      nextActionButton.textContent = "Next Level";
      nextActionButton.onclick = () => startGame(level + 1);
    } else {
      nextActionButton.textContent = "See Final Score"; // Change button text
      nextActionButton.onclick = showFinalScoreScreen; // Change button action
    }
  }, 800);
}

function calculateFinalStars(totalXP) {
  if (totalXP >= 200) {
    return 3;
  } else if (totalXP >= 160) {
    return 2;
  }
  return 1;
}

function showFinalScoreScreen
() {
  winScreen.classList.add("hidden"); // Hide the level 3 win screen

  const stars = calculateFinalStars(totalCampaignXP);
  const starElements = finalStarsContainer.querySelectorAll(".star");
  starElements.forEach((star, index) => {
    star.classList.toggle("filled", index < stars);
  });

  // Update the values on the final screen
  finalTurnsDisplay.textContent = totalCampaignTurns;
  finalXpDisplay.textContent = `${totalCampaignXP} / 200`;

  finalScoreScreen.classList.remove("hidden"); // Show the final score screen
}

function handleReflexModeEnd() {
  clearAllTimers();
  const stars = calculateReflexStars(gameState.turns);
  setTimeout(() => {
    // --- ADDED: Trigger Confetti ---
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 }
        });
    }

    gameContainer.classList.add("hidden");
    winScreen.classList.remove("hidden");
    winTitle.textContent = "REFLEX COMPLETE!";
    winStatsLabel.textContent = "TOTAL MOVES";
    winStatsValue.textContent = gameState.turns;
    winXpContainer.classList.add("hidden");
    winStarsContainer.classList.remove("hidden");
    const starElements = winStarsContainer.querySelectorAll(".star");
    starElements.forEach((star, index) =>
      star.classList.toggle("filled", index < stars)
    );
    nextActionButton.textContent = "Main Menu";
    nextActionButton.onclick = showStartScreen;
  }, 500);
}

function startTimer(duration) {
  timerContainer.classList.remove("hidden");
  gameState.timeRemaining = duration;
  timerDisplay.textContent = duration;
  gameState.timerId = setInterval(() => {
    if (gameState.isPaused) return;
    gameState.timeRemaining--;
    timerDisplay.textContent = gameState.timeRemaining;
    if (gameState.timeRemaining <= 0) {
      clearAllTimers();
      alert("Time's Up! Try again.");
      showStartScreen();
    }
  }, 1000);
}

function showStartScreen() {
  winScreen.classList.add("hidden");
  gameContainer.classList.add("hidden");
  finalScoreScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");

  stopBackgroundMusic();
}

function clearAllTimers() {
  clearTimeout(gameState.reflexTimeoutId);
  clearInterval(gameState.timerId);
}

// --- How to Play Tutorial ---
function renderTutorialPair(pair, card1Front, card2Front) {
  card1Front.classList.remove("number-card");
  card1Front.classList.remove("money-card");
  card1Front.classList.remove("letter-card");
  card2Front.classList.remove("number-card");
  card2Front.classList.remove("money-card");
  card2Front.classList.remove("letter-card");
  card1Front.innerHTML = "";
  card2Front.innerHTML = "";

  if (pair.a !== undefined && pair.b !== undefined) {
    card1Front.textContent = pair.a;
    card2Front.textContent = pair.b;
  } else if (pair.a !== undefined && pair.image !== undefined) {
    card1Front.textContent = pair.a;
    const textCardType = getTextCardType(pair.a);
    if (textCardType === "number") card1Front.classList.add("number-card");
    if (textCardType === "money") card1Front.classList.add("money-card");
    if (textCardType === "letter") card1Front.classList.add("letter-card");
    card2Front.innerHTML = `<img src="${pair.image}" alt="${pair.imageAlt || ""}">`;
  } else if (pair.firstImage !== undefined) {
    card1Front.innerHTML = `<img src="${pair.firstImage}" alt="${pair.firstImageAlt || ""}">`;
    card2Front.innerHTML = `<img src="${pair.secondImage}" alt="${pair.secondImageAlt || ""}">`;
  }
}

function showHowToPlay() {
  try {
    if (localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true") {
      startGame(highestLevelPlayed);
      return;
    }
  } catch (_error) {
    // The tutorial will appear again if persistent browser storage is unavailable.
  }

  const howToPlay = document.querySelector(".how-to-play");
  const startGameButton = document.getElementById("start-game-button");
  const tutorialCards = howToPlay.querySelectorAll(".tutorial-card");

  // Get first pair from level 1 for the tutorial
  const tutorialPair = gameContent.content.science.level1.pairs[0];
  const card1Front = document.querySelector("#tutorial-card-1 .tutorial-front");
  const card2Front = document.querySelector("#tutorial-card-2 .tutorial-front");

  renderTutorialPair(tutorialPair, card1Front, card2Front);

  howToPlay.classList.remove("hidden");
  startGameButton.disabled = true;

  // Demonstrate card flipping
  let flipIndex = 0;
  function flipNextCard() {
    if (flipIndex < tutorialCards.length) {
      tutorialCards[flipIndex].classList.add("flipped");

      // Add correct class after second card is flipped
      if (flipIndex === 1) {
        setTimeout(() => {
          tutorialCards.forEach((card) => {
            card.classList.add("correct");
          });
        }, 600);
      }

      flipIndex++;
      setTimeout(flipNextCard, 1500);
    } else {
      setTimeout(() => {
        tutorialCards.forEach((card) => {
          card.classList.remove("flipped", "correct");
        });
        flipIndex = 0;
        setTimeout(flipNextCard, 2000);
      }, 1000);
    }
  }

  flipNextCard();

  setTimeout(() => {
    startGameButton.disabled = false;
  }, 2600);

  // Start game when "Got it!" is clicked
  startGameButton.onclick = () => {
    if (startGameButton.disabled) return;
    howToPlay.classList.add("hidden");
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    } catch (_error) {
      // The game remains playable if persistent browser storage is unavailable.
    }
    // Start from the highest level played (fetched from API or local storage)
    startGame(highestLevelPlayed);
  };
}

// --- Pause Menu Functions ---
// function showPauseMenu() {
//   gameState.isPaused = true;
//   gameState.lockBoard = true;
//   pauseMenu.classList.remove("hidden");

//   // Set up tutorial cards in pause menu
//   const tutorialPair = gameContent.content.science.level1.pairs[0];
//   const card1Front = document.querySelector(
//     "#pause-tutorial-card-1 .tutorial-front"
//   );
//   const card2Front = document.querySelector(
//     "#pause-tutorial-card-2 .tutorial-front"
//   );

//   if (gameContent.gameMode === "textToText") {
//     card1Front.textContent = tutorialPair.a;
//     card2Front.textContent = tutorialPair.b;
//   } else if (gameContent.gameMode === "textToImage") {
//     card1Front.textContent = tutorialPair.a;
//     card2Front.innerHTML = `<img src="${tutorialPair.image}" alt="${tutorialPair.imageAlt}">`;
//   } else if (gameContent.gameMode === "imageToImage") {
//     card1Front.innerHTML = `<img src="${tutorialPair.firstImage}" alt="${tutorialPair.firstImageAlt}">`;
//     card2Front.innerHTML = `<img src="${tutorialPair.secondImage}" alt="${tutorialPair.secondImageAlt}">`;
//   }

//   // Start tutorial animation
//   const tutorialCards = document.querySelectorAll(".pause-tutorial-card");
//   let flipIndex = 0;

//   function flipNextCard() {
//     if (flipIndex < tutorialCards.length) {
//       tutorialCards[flipIndex].classList.add("flipped");

//       if (flipIndex === 1) {
//         setTimeout(() => {
//           tutorialCards.forEach((card) => {
//             card.classList.add("correct");
//           });
//         }, 600);
//       }

//       flipIndex++;
//       setTimeout(flipNextCard, 1500);
//     } else {
//       setTimeout(() => {
//         tutorialCards.forEach((card) => {
//           card.classList.remove("flipped", "correct");
//         });
//         flipIndex = 0;
//         if (gameState.isPaused) {
//           setTimeout(flipNextCard, 2000);
//         }
//       }, 1000);
//     }
//   }

//   flipNextCard();
// }

function showPauseMenu() {
    gameState.isPaused = true;
    gameState.lockBoard = true;
    pauseMenu.classList.remove('hidden');
}

function hidePauseMenu() {
  gameState.isPaused = false;
  gameState.lockBoard = false;
  pauseMenu.classList.add("hidden");
}

function showPauseTutorial() {
    pauseTutorial.classList.remove('hidden');
    
    // Set up tutorial cards
    const tutorialPair = gameContent.content.science.level1.pairs[0];
    const card1Front = document.querySelector('#pause-tutorial-card-1 .tutorial-front');
    const card2Front = document.querySelector('#pause-tutorial-card-2 .tutorial-front');

    renderTutorialPair(tutorialPair, card1Front, card2Front);

    // Start tutorial animation
    const tutorialCards = document.querySelectorAll('.pause-tutorial-card');
    let flipIndex = 0;
    
    function flipNextCard() {
        if (flipIndex < tutorialCards.length) {
            tutorialCards[flipIndex].classList.add('flipped');
            
            if (flipIndex === 1) {
                setTimeout(() => {
                    tutorialCards.forEach(card => {
                        card.classList.add('correct');
                    });
                }, 600);
            }
            
            flipIndex++;
            setTimeout(flipNextCard, 1500);
        } else {
            setTimeout(() => {
                tutorialCards.forEach(card => {
                    card.classList.remove('flipped', 'correct');
                });
                flipIndex = 0;
                if (!pauseTutorial.classList.contains('hidden')) {
                    setTimeout(flipNextCard, 2000);
                }
            }, 1000);
        }
    }

    flipNextCard();
}

function hidePauseTutorial() {
    pauseTutorial.classList.add('hidden');
}

// --- Initial Event Listeners ---
// Keep the protected analytics wrapper on the same scorer after it has loaded.
// This changes no analytics payload fields; it only gives them the correct XP.
window.addEventListener("load", () => {
  window.calculateXP = calculateGameXP;
});

// Disable start button until content is loaded
startCampaignButton.disabled = true;

// Load game content when page loads
document.addEventListener("DOMContentLoaded", loadGameContent);

startCampaignButton.addEventListener("click", showHowToPlay);
startReflexButton.addEventListener("click", startReflexMode);

mainMenuButton.addEventListener("click", showStartScreen);

// --- [NEW] DEV FEATURE: AUTO-COMPLETE LEVEL ---
window.addEventListener("keydown", (e) => {
  // Check if DEV_MODE is on, the 'c' key was pressed, and the main game screen is active
  if (
    DEV_MODE &&
    e.key.toLowerCase() === "c" &&
    !gameContainer.classList.contains("hidden")
  ) {
    // Ensure it only works for the campaign mode
    if (gameState.gameMode === "campaign") {
      console.log("DEV: Auto-completing campaign level...");
      handleCampaignWin();
    }
  }
});

// Pause button event listeners
pauseButton.addEventListener('click', showPauseMenu);
tutorialButton.addEventListener('click', showPauseTutorial);
closeTutorialButton.addEventListener('click', hidePauseTutorial);
resumeButton.addEventListener('click', hidePauseMenu);
exitButton.addEventListener('click', () => {
    hidePauseMenu();
    showStartScreen();
});
