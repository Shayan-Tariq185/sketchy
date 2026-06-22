import { nanoid } from 'nanoid';
import { pickWord, pickWordChoices } from './wordBank.js';

// In-memory room store. Fine for a self-hosted / small-scale party game —
// no database needed. Rooms are garbage collected when empty for a while.
const rooms = new Map();
// Safety cap: prevents unbounded memory growth if this gets shared widely.
// Each room is small in memory, but this keeps things predictable on a
// free-tier instance with limited RAM.
const MAX_ACTIVE_ROOMS = 150;

export function isAtCapacity() {
  return rooms.size >= MAX_ACTIVE_ROOMS;
}

const ROUND_DEFAULTS = {
  maxRounds: 6,
  drawTime: 80,
  wordPack: 'Classic',
  difficulty: 'Medium',
  choiceMode: true // drawer picks from 3 word choices instead of a forced word
};

const AVATAR_PALETTE = ['#FF5D5D', '#3DDC97', '#FFC93C', '#4D6BFE', '#B26BFF', '#FF8FB1', '#33C9C9', '#FF9F4D'];

// Cute animal emojis assigned per player slot
const ANIMAL_AVATARS = ['🦊', '🐻', '🐧', '🐼', '🐸', '🐰', '🦁', '🦆', '🐨', '🦝', '🦉', '🐺'];

function makeRoomCode() {
  // 5-char codes, uppercase letters + digits, vowel-light to avoid accidental words
  return nanoid(5).toUpperCase().replace(/[^A-Z0-9]/g, () => 'X');
}

function uniqueRoomCode() {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  return code;
}

export function createRoom(hostSocketId, hostName) {
  const code = uniqueRoomCode();
  const hostId = nanoid(10);

  const room = {
    code,
    hostId,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    status: 'lobby', // lobby | choosing | drawing | round-end | finished
    settings: { ...ROUND_DEFAULTS },
    players: new Map(), // playerId -> player
    socketToPlayer: new Map(), // socketId -> playerId
    round: 0,
    drawerOrder: [],
    drawerIndex: -1,
    currentWord: null,
    wordChoices: [],
    usedWords: [],
    roundStartedAt: null,
    roundEndsAt: null,
    timer: null,
    strokes: [], // current canvas stroke log, for replay capture
    guesses: [],
    correctGuessersThisRound: new Set(),
    scores: new Map(), // playerId -> score
    streaks: new Map(), // playerId -> consecutive correct-guess streak
    roundRecaps: [], // { word, drawerId, strokes, guessers } for replay after game
    // Hint system
    revealedLetterIndices: [], // letter positions revealed so far this round
    hintGiven: false            // whether the auto-hint fired this round
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
  room.lastActiveAt = Date.now();
  return player;
}

export function reconnectPlayer(room, socketId, playerId) {
  const player = room.players.get(playerId);
  if (!player) return null;
  // drop stale socket mapping if present
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
  for (const [sid, pid] of room.socketToPlayer.entries()) {
    if (pid === playerId) room.socketToPlayer.delete(sid);
  }
  room.drawerOrder = room.drawerOrder.filter((id) => id !== playerId);

  // reassign host if the host left
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
  // skip disconnected players
  if (!room.players.get(drawerId)?.connected) {
    if (connectedPlayers(room).length === 0) return null;
    return nextDrawer(room);
  }
  return drawerId;
}

export function currentDrawerId(room) {
  return room.drawerOrder[room.drawerIndex] || null;
}

export function startRound(room) {
  room.round += 1;
  const drawerId = nextDrawer(room);
  room.strokes = [];
  room.guesses = [];
  room.correctGuessersThisRound = new Set();
  room.roundStartedAt = null;
  room.roundEndsAt = null;
  // Reset hint state for new round
  room.revealedLetterIndices = [];
  room.hintGiven = false;

  if (room.settings.choiceMode) {
    room.status = 'choosing';
    room.currentWord = null;
    room.wordChoices = pickWordChoices(room.settings.wordPack, room.settings.difficulty, room.usedWords, 3);
  } else {
    room.status = 'drawing';
    room.currentWord = pickWord(room.settings.wordPack, room.settings.difficulty, room.usedWords);
    room.usedWords.push(room.currentWord);
    room.roundStartedAt = Date.now();
    room.roundEndsAt = Date.now() + room.settings.drawTime * 1000;
  }

  return drawerId;
}

export function confirmWordChoice(room, word) {
  room.currentWord = word;
  room.usedWords.push(word);
  room.status = 'drawing';
  room.roundStartedAt = Date.now();
  room.roundEndsAt = Date.now() + room.settings.drawTime * 1000;
  // Reset hints when word is locked in
  room.revealedLetterIndices = [];
  room.hintGiven = false;
}

// Returns the word masked with underscores, respecting revealed letter positions.
// Spaces in multi-word answers are kept as wide gaps.
export function maskedWord(word, revealedIndices = []) {
  if (!word) return '';
  // Build a flat char list (letters only, ignoring spaces)
  const chars = word.split('');
  let letterIdx = 0;
  return chars
    .map((ch) => {
      if (ch === ' ') return '   '; // wide gap for word separator
      const reveal = revealedIndices.includes(letterIdx);
      letterIdx++;
      return reveal ? ch : '_';
    })
    .join(' ');
}

export function timeLeftSeconds(room) {
  if (!room.roundEndsAt) return room.settings.drawTime;
  return Math.max(0, Math.round((room.roundEndsAt - Date.now()) / 1000));
}

// ---------- Hint system ----------

// Reveal one random non-first, non-space letter from the current word.
// Returns the updated list of revealed indices, or null if nothing new to reveal.
export function revealHintLetter(room) {
  const word = room.currentWord;
  if (!word) return null;

  // Build eligible flat letter indices (skip index 0 — first letter always hidden until end)
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

  // Pick a random eligible index
  const pick = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
  room.revealedLetterIndices = [...room.revealedLetterIndices, pick];
  room.hintGiven = true;
  return room.revealedLetterIndices;
}

// ---------- Guess matching ----------

// Normalise text for comparison: lowercase + collapse all whitespace
function normaliseGuess(text) {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}

// Levenshtein-ish closeness score used for the "heat" hint feature, without
// revealing the actual word to guessers.
export function guessHeat(guess, word) {
  const a = guess.trim().toLowerCase();
  const b = word.trim().toLowerCase();
  if (!a) return 0;
  if (normaliseGuess(a) === normaliseGuess(b)) return 100;

  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const similarity = 1 - dist / maxLen;

  // Bonus for shared first letter / substring containment, feels more "warm/cold"
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
  // FIX: normalise spaces so "sword fish" matches "swordfish", and case-insensitive
  const isCorrect = normaliseGuess(text) === normaliseGuess(word || '');
  const alreadyCorrect = room.correctGuessersThisRound.has(player.id);

  // FIX: block already-correct players from polluting the guess feed
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

    // FIX: cap elapsedRatio to [0, 1] — server clock drift could push it above 1
    const elapsedRatio = room.roundEndsAt
      ? Math.min(1, Math.max(0, (room.roundEndsAt - Date.now()) / (room.settings.drawTime * 1000)))
      : 0.5;
    
    // Standard scoring: 50 to 500 points based on speed
    const speedBonus = Math.round(450 * elapsedRatio);
    pointsAwarded = 50 + speedBonus;

    // First person to guess gets a 50 point bonus
    if (room.correctGuessersThisRound.size === 1) {
      pointsAwarded += 50;
    }

    // Keep streak for UI/visuals, but don't multiply points (keeps game balanced)
    const currentStreak = (room.streaks.get(player.id) || 0) + 1;
    room.streaks.set(player.id, currentStreak);

    room.scores.set(player.id, (room.scores.get(player.id) || 0) + pointsAwarded);

    // Standard drawer logic: Drawer gets 50% of the guesser's points
    // This rewards the drawer for drawing quickly and clearly!
    if (drawerId && drawerId !== player.id) {
      const drawerShare = Math.round(pointsAwarded / 2);
      room.scores.set(drawerId, (room.scores.get(drawerId) || 0) + drawerShare);
    }

    streakInfo = { streak: currentStreak, pointsAwarded, multiplier: 1 };
    entry.text = text;
  } else {
    // Wrong guess resets streak
    room.streaks.set(player.id, 0);
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
  room.roundRecaps.push({
    round: room.round,
    word: room.currentWord,
    drawerId,
    drawerName: room.players.get(drawerId)?.name || 'Unknown',
    strokes: room.strokes,
    guessers: [...room.correctGuessersThisRound]
  });
  // cap stored recaps to last 12 rounds to bound memory
  room.roundRecaps = room.roundRecaps.slice(-12);
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
  room.drawerIndex = -1;
  room.currentWord = null;
  room.wordChoices = [];
  room.usedWords = [];
  room.strokes = [];
  room.guesses = [];
  room.correctGuessersThisRound = new Set();
  room.roundRecaps = [];
  room.revealedLetterIndices = [];
  room.hintGiven = false;
  for (const id of room.scores.keys()) room.scores.set(id, 0);
  for (const id of room.streaks.keys()) room.streaks.set(id, 0);
}

export function publicRoomState(room) {
  return {
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
    revealedCount: room.revealedLetterIndices.length
  };
}

export { rooms };
