import { nanoid } from 'nanoid';
import { pickWord, pickWordChoices } from './wordBank.js';
import { bonusPublicSlice } from './bonusRound.js';

// In-memory room store. Fine for a self-hosted / small-scale party game —
// no database needed. Rooms are garbage collected when empty for a while.
const rooms = new Map();
// Safety cap: prevents unbounded memory growth if this gets shared widely.
const MAX_ACTIVE_ROOMS = 150;

export function isAtCapacity() {
  return rooms.size >= MAX_ACTIVE_ROOMS;
}

const ROUND_DEFAULTS = {
  maxRounds: 3,       // number of FULL rounds (each player draws once per round)
  drawTime: 80,
  wordPack: 'Classic',
  difficulty: 'Medium',
  choiceMode: true,
  hints: false,       // reveal random letters on a timer
  bonusRound: false,  // simultaneous draw + attribution round (5+ players)
  teamMode: false,    // team vs team mode (exactly 2 teams, 4+ players required)
};

export const MIN_TEAM_MODE_PLAYERS = 4;

const AVATAR_PALETTE = ['#FF5D5D', '#3DDC97', '#FFC93C', '#4D6BFE', '#B26BFF', '#FF8FB1', '#33C9C9', '#FF9F4D'];
const ANIMAL_AVATARS = ['🦊', '🐻', '🐧', '🐼', '🐸', '🐰', '🦁', '🦆', '🐨', '🦝', '🦉', '🐺'];

function makeRoomCode() {
  return nanoid(5).toUpperCase().replace(/[^A-Z0-9]/g, () => 'X');
}

function uniqueRoomCode() {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  return code;
}

// Initialise a blank per-player stats entry
function blankStats() {
  return {
    totalStrokes: 0,        // strokes drawn (only when this player is drawer)
    colorSwitches: 0,       // number of mid-drawing color changes (drawer only)
    fastestGuessMs: null,   // best guess time in ms (null = never guessed correctly)
    thinkTimeSamples: [],   // array of ms durations from word reveal → first stroke
    wrongGuesses: 0,        // wrong guesses submitted
    drawerChatMessages: 0,  // chat messages sent while drawing
    drawerChatPenaltyTotal: 0,
    predictionAttempts: 0,
    predictionHits: 0,
    bonusCorrectGuesses: 0,
    // transient, reset each drawing turn
    _lastColor: null,
    _firstStrokeThisTurn: true,
    _wordRevealedAt: null,
  };
}

export function createRoom(hostSocketId, hostName) {
  const code = uniqueRoomCode();
  const hostId = nanoid(10);

  const room = {
    code,
    hostId,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    status: 'lobby',
    settings: { ...ROUND_DEFAULTS },
    players: new Map(),
    socketToPlayer: new Map(),
    // ---- Round / drawer tracking ----
    // "round" here = full round number (1-based).
    // "turnIndex" = how many individual drawing turns have happened total.
    // A full round completes when every player has drawn once:
    //   turnIndex % drawerOrder.length === 0  (after first full lap)
    round: 0,
    turnIndex: 0,           // total drawing turns elapsed across all rounds
    drawerOrder: [],
    drawerIndex: -1,
    currentWord: null,
    wordChoices: [],
    usedWords: [],
    roundStartedAt: null,
    roundEndsAt: null,
    timer: null,
    strokes: [],
    guesses: [],
    correctGuessersThisRound: new Set(),
    scores: new Map(),
    streaks: new Map(),
    roundRecaps: [],
    revealedLetterIndices: [],
    hintGiven: false,
    drawerPrediction: null,
    // ---- Per-player stats map ----
    playerStats: new Map(),  // playerId -> stats object
    teams: null,             // null in solo mode, array of team objects in team mode
    bonusWord: null,
    bonusSubmissions: null,
    bonusGuesses: null,
    bonusDisplayOrder: null,
    bonusEndsAt: null,
    lastGameResult: null,    // badges/roast/leaderboard snapshot from the most recent finishGame(), for rejoin
  };

  addPlayer(room, hostSocketId, hostName, hostId, true);
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get((code || '').toUpperCase());
}

export function addPlayer(room, socketId, name, forcedId, isHost = false) {
  const playerId = forcedId || nanoid(10);
  const slotIndex = room.players.size;
  const color = AVATAR_PALETTE[slotIndex % AVATAR_PALETTE.length];
  const animal = ANIMAL_AVATARS[slotIndex % ANIMAL_AVATARS.length];

  const player = {
    id: playerId,
    name: name.slice(0, 18),
    color,
    animal,
    isHost,
    connected: true,
    socketId
  };

  room.players.set(playerId, player);
  room.socketToPlayer.set(socketId, playerId);
  if (!room.scores.has(playerId)) room.scores.set(playerId, 0);
  if (!room.streaks.has(playerId)) room.streaks.set(playerId, 0);
  if (!room.playerStats.has(playerId)) room.playerStats.set(playerId, blankStats());
  room.lastActiveAt = Date.now();
  return player;
}

export function reconnectPlayer(room, socketId, playerId) {
  const player = room.players.get(playerId);
  if (!player) return null;
  for (const [sid, pid] of room.socketToPlayer.entries()) {
    if (pid === playerId) room.socketToPlayer.delete(sid);
  }
  player.socketId = socketId;
  player.connected = true;
  room.socketToPlayer.set(socketId, playerId);
  room.lastActiveAt = Date.now();
  return player;
}

export function getPlayerBySocket(room, socketId) {
  const playerId = room.socketToPlayer.get(socketId);
  return playerId ? room.players.get(playerId) : null;
}

export function markDisconnected(room, socketId) {
  const player = getPlayerBySocket(room, socketId);
  if (!player) return null;
  player.connected = false;
  room.socketToPlayer.delete(socketId);
  room.lastActiveAt = Date.now();
  return player;
}

export function removePlayer(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) return;
  room.players.delete(playerId);
  room.scores.delete(playerId);
  room.streaks.delete(playerId);
  room.playerStats.delete(playerId);
  for (const [sid, pid] of room.socketToPlayer.entries()) {
    if (pid === playerId) room.socketToPlayer.delete(sid);
  }
  room.drawerOrder = room.drawerOrder.filter((id) => id !== playerId);

  if (room.hostId === playerId) {
    const next = room.players.values().next().value;
    if (next) {
      room.hostId = next.id;
      next.isHost = true;
    }
  }
}

export function connectedPlayers(room) {
  return [...room.players.values()].filter((p) => p.connected);
}

export function isRoomEmpty(room) {
  return connectedPlayers(room).length === 0;
}

export function deleteRoom(code) {
  const room = rooms.get(code);
  if (room?.timer) clearInterval(room.timer);
  rooms.delete(code);
}

export function activeRoomCount() {
  return rooms.size;
}

// ---------- Game flow ----------

export function buildDrawerOrder(room) {
  room.drawerOrder = [...room.players.keys()].sort(() => Math.random() - 0.5);
}

export function nextDrawer(room) {
  if (room.drawerOrder.length === 0) buildDrawerOrder(room);
  room.drawerIndex = (room.drawerIndex + 1) % room.drawerOrder.length;
  const drawerId = room.drawerOrder[room.drawerIndex];
  if (!room.players.get(drawerId)?.connected) {
    if (connectedPlayers(room).length === 0) return null;
    return nextDrawer(room);
  }
  return drawerId;
}

export function currentDrawerId(room) {
  return room.drawerOrder[room.drawerIndex] || null;
}

/**
 * startRound — advances one drawing TURN.
 *
 * A full "round" = all players have drawn once.
 * room.round tracks full rounds (1-based).
 * room.turnIndex counts individual drawing turns (0-based before increment).
 *
 * After this call room.round has been updated if a new full round just started.
 */
/**
 * isGameComplete — true if every player has already drawn maxRounds times,
 * i.e. the NEXT turn (turnIndex + 1) would belong to a round beyond
 * maxRounds. This must be checked BEFORE calling startRound() for the next
 * turn, since startRound() both advances turnIndex and recomputes
 * room.round as a side effect — checking room.round *after* a turn ends
 * only tells you about the turn that just finished, not whether another
 * turn is about to start. Checking here, with no side effects, lets the
 * caller decide whether to begin another turn at all.
 */
export function isGameComplete(room) {
  const playerCount = room.drawerOrder.length || 1;
  const nextTurnIndex = room.turnIndex + 1;
  const nextRound = Math.ceil(nextTurnIndex / playerCount);
  return nextRound > room.settings.maxRounds;
}

export function isStartingNewRound(room) {
  const playerCount = room.drawerOrder.length || 1;
  const nextTurnIndex = room.turnIndex + 1;
  const nextRound = Math.ceil(nextTurnIndex / playerCount);
  return nextRound > room.round;
}

export function startRound(room) {
  room.turnIndex += 1;
  const playerCount = room.drawerOrder.length || 1;

  // A new full round begins when we start the first turn of a new lap.
  // Lap 1: turns 1..N → round 1
  // Lap 2: turns N+1..2N → round 2   etc.
  room.round = Math.ceil(room.turnIndex / playerCount);

  const drawerId = nextDrawer(room);

  room.strokes = [];
  room.guesses = [];
  room.correctGuessersThisRound = new Set();
  room.roundStartedAt = null;
  room.roundEndsAt = null;
  room.revealedLetterIndices = [];
  room.hintGiven = false;
  room.drawerPrediction = null;

  // Reset per-turn transient drawer stats
  if (drawerId) {
    const stats = room.playerStats.get(drawerId);
    if (stats) {
      stats._lastColor = null;
      stats._firstStrokeThisTurn = true;
      stats._wordRevealedAt = null;
    }
  }

  if (room.settings.choiceMode) {
    room.status = 'choosing';
    room.currentWord = null;
    room.wordChoices = pickWordChoices(room.settings.wordPack, room.settings.difficulty, room.usedWords, 3);
  } else {
    room.status = 'predicting';
    room.currentWord = pickWord(room.settings.wordPack, room.settings.difficulty, room.usedWords);
    room.usedWords.push(room.currentWord);
  }

  return drawerId;
}

export function confirmWordChoice(room, word) {
  room.currentWord = word;
  room.usedWords.push(word);
  room.status = 'predicting';
  room.revealedLetterIndices = [];
  room.hintGiven = false;
  room.drawerPrediction = null;
}

export function startDrawingPhase(room) {
  room.status = 'drawing';
  room.roundStartedAt = Date.now();
  room.roundEndsAt = Date.now() + room.settings.drawTime * 1000;

  // Record when word was revealed to the drawer (for think-time tracking)
  const drawerId = currentDrawerId(room);
  if (drawerId) {
    const stats = room.playerStats.get(drawerId);
    if (stats) stats._wordRevealedAt = Date.now();
  }
}

// ---------- Stats tracking ----------

/**
 * Called from index.js canvas:stroke handler BEFORE pushing to room.strokes.
 * Tracks: total strokes, color switches, first-stroke think time.
 */
export function trackDrawerStroke(room, stroke) {
  const drawerId = currentDrawerId(room);
  if (!drawerId) return;
  const stats = room.playerStats.get(drawerId);
  if (!stats) return;

  stats.totalStrokes += 1;

  // Think time: time from word reveal to first stroke
  if (stats._firstStrokeThisTurn && stats._wordRevealedAt) {
    const thinkMs = Date.now() - stats._wordRevealedAt;
    stats.thinkTimeSamples.push(thinkMs);
    stats._firstStrokeThisTurn = false;
  }

  // Color switch: if drawer changed color from previous stroke
  const strokeColor = stroke.color;
  if (stats._lastColor !== null && strokeColor !== stats._lastColor) {
    stats.colorSwitches += 1;
  }
  stats._lastColor = strokeColor;
}

/**
 * Called from index.js chat:guess handler for wrong guesses.
 */
export function trackWrongGuess(room, playerId) {
  const stats = room.playerStats.get(playerId);
  if (stats) stats.wrongGuesses += 1;
}

/**
 * Called from index.js when a correct guess lands. Tracks fastest guess time.
 * roundStartedAt is when drawing phase began.
 */
export function trackCorrectGuess(room, playerId) {
  if (!room.roundStartedAt) return;
  const stats = room.playerStats.get(playerId);
  if (!stats) return;
  const elapsed = Date.now() - room.roundStartedAt;
  if (stats.fastestGuessMs === null || elapsed < stats.fastestGuessMs) {
    stats.fastestGuessMs = elapsed;
  }
}

// ---------- Badge assignment ----------

/**
 * Compute personality badges for all players at game end.
 * Returns a Map: playerId -> { badge, description, statValue }
 */
export function assignBadges(room) {
  const players = [...room.players.values()];
  const badges = new Map();

  if (players.length === 0) return badges;

  // Collect stat summaries per player
  const summaries = players.map((p) => {
    const s = room.playerStats.get(p.id) || blankStats();
    const avgThinkMs =
      s.thinkTimeSamples.length > 0
        ? s.thinkTimeSamples.reduce((a, b) => a + b, 0) / s.thinkTimeSamples.length
        : null;
    return {
      id: p.id,
      totalStrokes: s.totalStrokes,
      colorSwitches: s.colorSwitches,
      fastestGuessMs: s.fastestGuessMs,
      avgThinkMs,
      wrongGuesses: s.wrongGuesses,
    };
  });

  // For each badge category, find the most distinctive player.
  // We use a priority queue approach: assign to the player who wins their
  // category by the largest relative margin, to avoid ties looking random.

  const categoryWinners = [];

  // 1. Minimalist: fewest total strokes (among players who drew at least once)
  const drew = summaries.filter((s) => s.totalStrokes > 0);
  if (drew.length > 0) {
    const min = Math.min(...drew.map((s) => s.totalStrokes));
    const candidates = drew.filter((s) => s.totalStrokes === min);
    const runnerUp = drew.length > candidates.length
      ? Math.min(...drew.filter((s) => s.totalStrokes !== min).map((s) => s.totalStrokes))
      : null;
    categoryWinners.push({
      playerId: candidates[0].id,
      badge: 'The Minimalist',
      description: 'Barely lifted the pen all game — efficiency is an art form.',
      priority: runnerUp !== null ? (runnerUp - min) / (runnerUp || 1) : 1,
    });
  }

  // 2. Colorful Chaos: most color switches
  const maxSwitches = Math.max(...summaries.map((s) => s.colorSwitches));
  if (maxSwitches > 0) {
    const candidates = summaries.filter((s) => s.colorSwitches === maxSwitches);
    categoryWinners.push({
      playerId: candidates[0].id,
      badge: 'Colorful Chaos',
      description: `Switched colors ${maxSwitches} time${maxSwitches === 1 ? '' : 's'} — a true palette adventurer.`,
      priority: maxSwitches / (summaries.reduce((a, s) => a + s.colorSwitches, 0) / summaries.length || 1),
    });
  }

  // 3. Speedrunner: fastest correct guess
  const guessers = summaries.filter((s) => s.fastestGuessMs !== null);
  if (guessers.length > 0) {
    const minMs = Math.min(...guessers.map((s) => s.fastestGuessMs));
    const candidates = guessers.filter((s) => s.fastestGuessMs === minMs);
    const secs = (minMs / 1000).toFixed(1);
    const runnerUpMs = guessers.length > candidates.length
      ? Math.min(...guessers.filter((s) => s.fastestGuessMs !== minMs).map((s) => s.fastestGuessMs))
      : null;
    categoryWinners.push({
      playerId: candidates[0].id,
      badge: 'The Speedrunner',
      description: `Guessed correctly in ${secs}s — blink and you'd miss it.`,
      priority: runnerUpMs !== null ? (runnerUpMs - minMs) / (runnerUpMs || 1) : 1,
    });
  }

  // 4. Overthinker: longest average think time (players who drew)
  const drewWithThink = summaries.filter((s) => s.avgThinkMs !== null);
  if (drewWithThink.length > 0) {
    const maxThink = Math.max(...drewWithThink.map((s) => s.avgThinkMs));
    const candidates = drewWithThink.filter((s) => s.avgThinkMs === maxThink);
    const secs = (maxThink / 1000).toFixed(1);
    const runnerUp = drewWithThink.length > candidates.length
      ? Math.max(...drewWithThink.filter((s) => s.avgThinkMs !== maxThink).map((s) => s.avgThinkMs))
      : null;
    categoryWinners.push({
      playerId: candidates[0].id,
      badge: 'The Overthinker',
      description: `Averaged ${secs}s before the first stroke — great things take time.`,
      priority: runnerUp !== null ? (maxThink - runnerUp) / maxThink : 1,
    });
  }

  // 5. Creative Interpretation: most wrong guesses
  const maxWrong = Math.max(...summaries.map((s) => s.wrongGuesses));
  if (maxWrong > 0) {
    const candidates = summaries.filter((s) => s.wrongGuesses === maxWrong);
    categoryWinners.push({
      playerId: candidates[0].id,
      badge: 'Creative Interpretation Award',
      description: `${maxWrong} unique guess${maxWrong === 1 ? '' : 'es'} — boldly seeing what others missed.`,
      priority: maxWrong / (summaries.reduce((a, s) => a + s.wrongGuesses, 0) / summaries.length || 1),
    });
  }

  // Assign badges: sort by priority desc, each player gets at most one badge.
  const assigned = new Set();
  categoryWinners.sort((a, b) => b.priority - a.priority);

  for (const winner of categoryWinners) {
    if (!assigned.has(winner.playerId)) {
      assigned.add(winner.playerId);
      badges.set(winner.playerId, { badge: winner.badge, description: winner.description });
    }
  }

  // Players with no badge get a friendly fallback
  for (const p of players) {
    if (!badges.has(p.id)) {
      badges.set(p.id, {
        badge: 'All-Round Sketcher',
        description: 'Solid performance across the board — the glue of every great game.',
      });
    }
  }

  return badges;
}

/**
 * End-of-game "roast recap" highlights — fun stat callouts alongside badges.
 */
export function buildRoastRecap(room) {
  const players = [...room.players.values()];
  const highlights = [];

  const summaries = players.map((p) => {
    const s = room.playerStats.get(p.id) || blankStats();
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      wrongGuesses: s.wrongGuesses,
      fastestGuessMs: s.fastestGuessMs,
      totalStrokes: s.totalStrokes,
      drawerChatPenaltyTotal: s.drawerChatPenaltyTotal || 0,
      drawerChatMessages: s.drawerChatMessages || 0,
      predictionHits: s.predictionHits || 0,
      predictionAttempts: s.predictionAttempts || 0,
      bonusCorrectGuesses: s.bonusCorrectGuesses || 0,
    };
  });

  const maxWrong = Math.max(...summaries.map((s) => s.wrongGuesses));
  if (maxWrong > 0) {
    const p = summaries.find((s) => s.wrongGuesses === maxWrong);
    highlights.push({
      emoji: '🎯',
      title: 'Chaos Guesser',
      playerId: p.id,
      playerName: p.name,
      line: `${p.name} fired off ${maxWrong} wrong guess${maxWrong === 1 ? '' : 'es'} — bold energy.`
    });
  }

  const speedsters = summaries.filter((s) => s.fastestGuessMs !== null);
  if (speedsters.length > 0) {
    const minMs = Math.min(...speedsters.map((s) => s.fastestGuessMs));
    const p = speedsters.find((s) => s.fastestGuessMs === minMs);
    highlights.push({
      emoji: '⚡',
      title: 'Lightning Fingers',
      playerId: p.id,
      playerName: p.name,
      line: `${p.name} guessed correctly in ${(minMs / 1000).toFixed(1)}s — blink and you miss it.`
    });
  }

  const chatty = summaries.filter((s) => s.drawerChatMessages > 0);
  if (chatty.length > 0) {
    const p = chatty.reduce((a, b) => (b.drawerChatPenaltyTotal > a.drawerChatPenaltyTotal ? b : a));
    highlights.push({
      emoji: '💸',
      title: 'Chatty Drawer',
      playerId: p.id,
      playerName: p.name,
      line: `${p.name} typed ${p.drawerChatMessages} time${p.drawerChatMessages === 1 ? '' : 's'} while drawing and lost ${p.drawerChatPenaltyTotal} pts.`
    });
  }

  const predictors = summaries.filter((s) => s.predictionAttempts > 0);
  if (predictors.length > 0) {
    const p = predictors.reduce((a, b) => (b.predictionHits > a.predictionHits ? b : a));
    if (p.predictionHits > 0) {
      highlights.push({
        emoji: '🔮',
        title: 'Mind Reader',
        playerId: p.id,
        playerName: p.name,
        line: `${p.name} nailed ${p.predictionHits} drawer prediction${p.predictionHits === 1 ? '' : 's'}.`
      });
    }
  }

  const minimalists = summaries.filter((s) => s.totalStrokes > 0);
  if (minimalists.length > 0) {
    const minStrokes = Math.min(...minimalists.map((s) => s.totalStrokes));
    const p = minimalists.find((s) => s.totalStrokes === minStrokes);
    highlights.push({
      emoji: '✏️',
      title: 'One-Line Wonder',
      playerId: p.id,
      playerName: p.name,
      line: `${p.name} drew a masterpiece with barely any pen movement.`
    });
  }

  const bonusStars = summaries.filter((s) => s.bonusCorrectGuesses > 0);
  if (bonusStars.length > 0) {
    const p = bonusStars.reduce((a, b) => (b.bonusCorrectGuesses > a.bonusCorrectGuesses ? b : a));
    highlights.push({
      emoji: '🕵️',
      title: 'Art Detective',
      playerId: p.id,
      playerName: p.name,
      line: `${p.name} spotted ${p.bonusCorrectGuesses} drawing${p.bonusCorrectGuesses === 1 ? '' : 's'} correctly in the bonus round.`
    });
  }

  return { highlights: highlights.slice(0, 6) };
}

export function trackDrawerPrediction(room, drawerId, hit) {
  const stats = room.playerStats.get(drawerId);
  if (!stats) return;
  stats.predictionAttempts = (stats.predictionAttempts || 0) + 1;
  if (hit) stats.predictionHits = (stats.predictionHits || 0) + 1;
}

export function applyDrawerChatPenalty(room, drawerId) {
  const PENALTY = 20;
  const current = room.scores.get(drawerId) || 0;
  room.scores.set(drawerId, Math.max(0, current - PENALTY));
  const stats = room.playerStats.get(drawerId);
  if (stats) {
    stats.drawerChatMessages = (stats.drawerChatMessages || 0) + 1;
    stats.drawerChatPenaltyTotal = (stats.drawerChatPenaltyTotal || 0) + PENALTY;
  }
  return PENALTY;
}

// ---------- Word masking ----------

export function maskedWord(word, revealedIndices = []) {
  if (!word) return '';
  const wordParts = word.split(' '); // split into actual words first
  let letterIdx = 0;

  const renderedParts = wordParts.map((part) => {
    const letters = part.split('').map((ch) => {
      const reveal = revealedIndices.includes(letterIdx);
      letterIdx++;
      return reveal ? ch : '_';
    });
    return letters.join(' '); // single-space between letters within a word
  });

  return renderedParts.join('   '); // exactly one triple-space between words
}

export function timeLeftSeconds(room) {
  if (!room.roundEndsAt) return room.settings.drawTime;
  return Math.max(0, Math.round((room.roundEndsAt - Date.now()) / 1000));
}

// ---------- Hint system ----------

export function revealHintLetter(room) {
  const word = room.currentWord;
  if (!word) return null;

  const letters = word.split('');
  const eligibleIndices = [];
  let letterIdx = 0;
  for (const ch of letters) {
    if (ch !== ' ') {
      if (letterIdx > 0 && !room.revealedLetterIndices.includes(letterIdx)) {
        eligibleIndices.push(letterIdx);
      }
      letterIdx++;
    }
  }

  if (eligibleIndices.length === 0) return null;

  const pick = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
  room.revealedLetterIndices = [...room.revealedLetterIndices, pick];
  room.hintGiven = true;
  return room.revealedLetterIndices;
}

// ---------- Guess matching ----------

function normaliseGuess(text) {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}

export function guessHeat(guess, word) {
  const a = guess.trim().toLowerCase();
  const b = word.trim().toLowerCase();
  if (!a) return 0;
  if (normaliseGuess(a) === normaliseGuess(b)) return 100;

  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const similarity = 1 - dist / maxLen;

  let bonus = 0;
  if (b.includes(a) || a.includes(b)) bonus += 0.15;
  if (a[0] === b[0]) bonus += 0.1;

  return Math.max(0, Math.min(99, Math.round((similarity + bonus) * 100)));
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function registerGuess(room, player, text, drawerId) {
  const word = room.currentWord;
  const isCorrect = normaliseGuess(text) === normaliseGuess(word || '');
  const alreadyCorrect = room.correctGuessersThisRound.has(player.id);

  if (alreadyCorrect) {
    return { entry: null, isCorrect: false, pointsAwarded: 0, streakInfo: null };
  }

  const entry = {
    id: nanoid(8),
    playerId: player.id,
    playerName: player.name,
    color: player.color,
    animal: player.animal,
    text,
    correct: isCorrect,
    system: false,
    createdAt: Date.now()
  };

  let pointsAwarded = 0;
  let streakInfo = null;

  if (isCorrect) {
    room.correctGuessersThisRound.add(player.id);

    // Track fastest guess for this player
    trackCorrectGuess(room, player.id);

    const elapsedRatio = room.roundEndsAt
      ? Math.min(1, Math.max(0, (room.roundEndsAt - Date.now()) / (room.settings.drawTime * 1000)))
      : 0.5;

    const speedBonus = Math.round(450 * elapsedRatio);
    pointsAwarded = 50 + speedBonus;

    if (room.correctGuessersThisRound.size === 1) {
      pointsAwarded += 50;
    }

    const currentStreak = (room.streaks.get(player.id) || 0) + 1;
    room.streaks.set(player.id, currentStreak);

    room.scores.set(player.id, (room.scores.get(player.id) || 0) + pointsAwarded);

    if (drawerId && drawerId !== player.id) {
      const drawerShare = Math.round(pointsAwarded / 2);
      room.scores.set(drawerId, (room.scores.get(drawerId) || 0) + drawerShare);
    }

    streakInfo = { streak: currentStreak, pointsAwarded, multiplier: 1 };
    entry.text = text;
  } else {
    room.streaks.set(player.id, 0);
    // Track wrong guess
    trackWrongGuess(room, player.id);
  }

  room.guesses.push(entry);
  room.guesses = room.guesses.slice(-50);

  return { entry, isCorrect, pointsAwarded, streakInfo };
}

export function allNonDrawersGuessedCorrectly(room, drawerId) {
  const guessers = connectedPlayers(room).filter((p) => p.id !== drawerId);
  if (guessers.length === 0) return false;
  return guessers.every((p) => room.correctGuessersThisRound.has(p.id));
}

export function endRound(room, reason) {
  const drawerId = currentDrawerId(room);
  room.status = 'round-end';
  room.roundEndedAt = Date.now();
  room.roundRecaps.push({
    round: room.round,
    word: room.currentWord,
    drawerId,
    drawerName: room.players.get(drawerId)?.name || 'Unknown',
    strokes: room.strokes,
    guessers: [...room.correctGuessersThisRound]
  });
  room.roundRecaps = room.roundRecaps.slice(-24);
  return reason;
}

export function leaderboard(room) {
  return [...room.players.values()]
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      animal: p.animal,
      connected: p.connected,
      isHost: p.isHost,
      score: room.scores.get(p.id) || 0,
      streak: room.streaks.get(p.id) || 0
    }))
    .sort((a, b) => b.score - a.score);
}

export function resetForReplay(room) {
  room.status = 'lobby';
  room.round = 0;
  room.turnIndex = 0;
  room.drawerIndex = -1;
  room.currentWord = null;
  room.wordChoices = [];
  room.drawerPrediction = null;
  room.usedWords = [];
  room.strokes = [];
  room.guesses = [];
  room.correctGuessersThisRound = new Set();
  room.roundRecaps = [];
  room.revealedLetterIndices = [];
  room.hintGiven = false;
  for (const id of room.scores.keys()) room.scores.set(id, 0);
  for (const id of room.streaks.keys()) room.streaks.set(id, 0);
  room.teams = null;
  room.bonusWord = null;
  room.bonusSubmissions = null;
  room.bonusGuesses = null;
  room.bonusDisplayOrder = null;
  room.bonusEndsAt = null;
  room.lastGameResult = null;
  // Reset stats too
  for (const id of room.playerStats.keys()) room.playerStats.set(id, blankStats());
}

export function publicRoomState(room) {
  const playerCount = room.drawerOrder.length || room.players.size || 1;
  const base = {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    settings: room.settings,
    round: room.round,
    maxRounds: room.settings.maxRounds,
    drawerId: currentDrawerId(room),
    wordChoices: room.status === 'choosing' ? room.wordChoices : [],
    maskedWord: room.currentWord ? (room.status === 'round-end' ? room.currentWord : maskedWord(room.currentWord, room.revealedLetterIndices)) : '',
    wordLength: room.currentWord ? room.currentWord.replace(/\s/g, '').length : 0,
    timeLeft: timeLeftSeconds(room),
    drawTime: room.settings.drawTime,
    players: leaderboard(room),
    guesses: room.guesses,
    correctGuessers: [...room.correctGuessersThisRound],
    hintGiven: room.hintGiven,
    revealedCount: room.revealedLetterIndices.length,
    // Show progress as turns within current round
    turnInRound: room.drawerOrder.length > 0 ? ((room.drawerIndex + 1) % room.drawerOrder.length) || room.drawerOrder.length : 0,
    playersInRound: playerCount,
    teams: publicTeams(room),
  };

  if (room.status?.startsWith('bonus')) {
    Object.assign(base, bonusPublicSlice(room));
  }

  return base;
}

export { rooms };
// ===== TEAM MODE =====

const TEAM_COLORS = ['#FF5D5D', '#4D6BFE']; // Team Red, Team Blue
const TEAM_NAMES  = ['Team Red', 'Team Blue'];

/**
 * Initialise exactly two teams on the room. Called from index.js before
 * buildTeamDrawerOrder, only when teamMode is on (which itself requires
 * MIN_TEAM_MODE_PLAYERS connected players — enforced in index.js).
 * Players are split as evenly as possible via round-robin, so neither
 * team can end up empty as long as there are at least 2 players.
 */
export function initTeams(room) {
  room.teams = Array.from({ length: 2 }, (_, i) => ({
    id: `team-${i}`,
    name: TEAM_NAMES[i],
    color: TEAM_COLORS[i],
    playerIds: [],
    score: 0,
  }));
  // Auto-assign connected players round-robin by current order.
  const playerIds = connectedPlayers(room).map((p) => p.id);
  playerIds.forEach((pid, idx) => {
    room.teams[idx % 2].playerIds.push(pid);
  });
}

/**
 * Override team assignments sent from the client lobby.
 * assignments = [ { teamId: 'team-0', playerIds: [...] }, { teamId: 'team-1', playerIds: [...] } ]
 *
 * Validated defensively: only known, currently-connected players are kept,
 * and any connected player missing from the assignment payload (e.g. they
 * joined after the host last dragged teams around) is appended to whichever
 * team currently has fewer players, so nobody is silently dropped from play.
 */
export function applyTeamAssignments(room, assignments) {
  if (!room.teams || !Array.isArray(assignments)) return;

  for (const t of room.teams) t.playerIds = [];

  const seen = new Set();
  for (const { teamId, playerIds } of assignments) {
    const team = room.teams.find((t) => t.id === teamId);
    if (!team || !Array.isArray(playerIds)) continue;
    for (const pid of playerIds) {
      if (room.players.has(pid) && !seen.has(pid)) {
        team.playerIds.push(pid);
        seen.add(pid);
      }
    }
  }

  // Safety net: any connected player not covered by the assignment payload
  // (new joiner, stale client state, etc.) goes to the smaller team so both
  // teams stay populated and nobody becomes an un-drawable ghost.
  for (const player of connectedPlayers(room)) {
    if (seen.has(player.id)) continue;
    const smaller = room.teams[0].playerIds.length <= room.teams[1].playerIds.length ? 0 : 1;
    room.teams[smaller].playerIds.push(player.id);
    seen.add(player.id);
  }

  // If either team still ended up empty (e.g. all assignments pointed at one
  // team), rebalance from scratch rather than risk a divide-by-zero later.
  if (room.teams[0].playerIds.length === 0 || room.teams[1].playerIds.length === 0) {
    initTeams(room);
  }
}

/**
 * Returns the team object for a given playerId, or null in solo mode.
 */
export function getPlayerTeam(room, playerId) {
  if (!room.teams) return null;
  return room.teams.find((t) => t.playerIds.includes(playerId)) || null;
}

/**
 * Build the drawer order so it alternates between teams each turn.
 * Within each team, drawers rotate in join order.
 * Must be called AFTER initTeams().
 */
export function buildTeamDrawerOrder(room) {
  if (!room.teams || room.teams.some((t) => t.playerIds.length === 0)) {
    // Either team mode isn't active, or (shouldn't happen, but just in case)
    // a team ended up empty — fall back to a flat order rather than divide
    // by zero below.
    buildDrawerOrder(room);
    return;
  }
  // drawerCursor per team: which player in the team draws next
  const cursors = room.teams.map(() => 0);
  const order = [];
  const totalSlots = room.teams.reduce((s, t) => s + t.playerIds.length, 0);
  // interleave: team 0 picks, team 1 picks, team 0 picks, ...
  // repeat until every player has had at least one slot
  let lap = 0;
  while (order.length < totalSlots) {
    for (let ti = 0; ti < room.teams.length; ti++) {
      const team = room.teams[ti];
      const pidIdx = cursors[ti] % team.playerIds.length;
      const pid = team.playerIds[pidIdx];
      if (pid && !order.includes(pid)) {
        order.push(pid);
        cursors[ti]++;
      }
    }
    lap++;
    if (lap > totalSlots) break; // safety
  }
  room.drawerOrder = order;
}

/**
 * Serialise teams for the public room state.
 */
export function publicTeams(room) {
  if (!room.teams) return null;
  return room.teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    playerIds: t.playerIds,
    score: t.score,
  }));
}

/**
 * Team-aware registerGuess wrapper.
 * If teamMode is active:
 *   - a player on the DRAWER'S team cannot score (they can still see the chat)
 *   - points go to the TEAM score, not the individual
 *   - drawer still earns their team-share bonus via team score
 */
export function registerGuessTeam(room, player, text, drawerId) {
  if (!room.settings.teamMode || !room.teams) {
    return registerGuess(room, player, text, drawerId);
  }

  const word = room.currentWord;
  const isCorrect = normaliseGuess(text) === normaliseGuess(word || '');
  const alreadyCorrect = room.correctGuessersThisRound.has(player.id);

  // In team mode: members of the drawing team cannot score
  const drawerTeam = getPlayerTeam(room, drawerId);
  const guesserTeam = getPlayerTeam(room, player.id);
  const isDrawerTeam = drawerTeam && guesserTeam && drawerTeam.id === guesserTeam.id;

  if (alreadyCorrect || isDrawerTeam) {
    // Still allow the message to appear in chat; just no points
    if (isDrawerTeam && !alreadyCorrect) {
      trackWrongGuess(room, player.id); // count as wasted guess for stats
      const entry = {
        id: nanoid(8),
        playerId: player.id,
        playerName: player.name,
        color: player.color,
        animal: player.animal,
        text,
        correct: false,
        system: false,
        blockedByTeam: true,
        createdAt: Date.now(),
      };
      room.guesses.push(entry);
      room.guesses = room.guesses.slice(-50);
      return { entry, isCorrect: false, pointsAwarded: 0, streakInfo: null };
    }
    return { entry: null, isCorrect: false, pointsAwarded: 0, streakInfo: null };
  }

  // Standard guess logic (tweaked to credit team score)
  const entry = {
    id: nanoid(8),
    playerId: player.id,
    playerName: player.name,
    color: player.color,
    animal: player.animal,
    text,
    correct: isCorrect,
    system: false,
    createdAt: Date.now(),
  };

  let pointsAwarded = 0;
  let streakInfo = null;

  if (isCorrect) {
    room.correctGuessersThisRound.add(player.id);
    trackCorrectGuess(room, player.id);

    const elapsedRatio = room.roundEndsAt
      ? Math.min(1, Math.max(0, (room.roundEndsAt - Date.now()) / (room.settings.drawTime * 1000)))
      : 0.5;

    const speedBonus = Math.round(450 * elapsedRatio);
    pointsAwarded = 50 + speedBonus;
    if (room.correctGuessersThisRound.size === 1) pointsAwarded += 50;

    const currentStreak = (room.streaks.get(player.id) || 0) + 1;
    room.streaks.set(player.id, currentStreak);

    // Credit team score (not individual player score)
    if (guesserTeam) {
      guesserTeam.score += pointsAwarded;
    }
    // Also mirror to individual so leaderboard shows something meaningful
    room.scores.set(player.id, (room.scores.get(player.id) || 0) + pointsAwarded);

    // Drawer team gets a share for enabling the correct guess
    if (drawerId && drawerId !== player.id && drawerTeam) {
      const drawerShare = Math.round(pointsAwarded / 2);
      drawerTeam.score += drawerShare;
      room.scores.set(drawerId, (room.scores.get(drawerId) || 0) + drawerShare);
    }

    streakInfo = { streak: currentStreak, pointsAwarded, multiplier: 1 };
  } else {
    room.streaks.set(player.id, 0);
    trackWrongGuess(room, player.id);
  }

  room.guesses.push(entry);
  room.guesses = room.guesses.slice(-50);

  return { entry, isCorrect, pointsAwarded, streakInfo };
}