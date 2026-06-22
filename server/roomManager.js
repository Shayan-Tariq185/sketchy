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
    roundRecaps: [] // { word, drawerId, strokes, guessers } for replay after game
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
  const color = AVATAR_PALETTE[room.players.size % AVATAR_PALETTE.length];

  const player = {
    id: playerId,
    name: name.slice(0, 18),
    color,
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
}

export function maskedWord(word) {
  if (!word) return '';
  return word
    .split(' ')
    .map((part) => part.split('').map(() => '_').join(' '))
    .join('   ');
}

export function timeLeftSeconds(room) {
  if (!room.roundEndsAt) return room.settings.drawTime;
  return Math.max(0, Math.round((room.roundEndsAt - Date.now()) / 1000));
}

// Levenshtein-ish closeness score used for the "heat" hint feature, without
// revealing the actual word to guessers.
export function guessHeat(guess, word) {
  const a = guess.trim().toLowerCase();
  const b = word.trim().toLowerCase();
  if (!a) return 0;
  if (a === b) return 100;

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
  const isCorrect = text.trim().toLowerCase() === (word || '').trim().toLowerCase();
  const alreadyCorrect = room.correctGuessersThisRound.has(player.id);

  const entry = {
    id: nanoid(8),
    playerId: player.id,
    playerName: player.name,
    color: player.color,
    text,
    correct: isCorrect,
    system: false,
    createdAt: Date.now()
  };

  let pointsAwarded = 0;
  let streakInfo = null;

  if (isCorrect && !alreadyCorrect) {
    room.correctGuessersThisRound.add(player.id);

    const elapsedRatio = room.roundEndsAt
      ? Math.max(0, (room.roundEndsAt - Date.now()) / (room.settings.drawTime * 1000))
      : 0.5;
    // faster guesses = more points. Base 50, up to +150 for instant guesses.
    const speedBonus = Math.round(150 * elapsedRatio);
    const basePoints = 50 + speedBonus;

    const currentStreak = (room.streaks.get(player.id) || 0) + 1;
    room.streaks.set(player.id, currentStreak);
    const streakMultiplier = 1 + Math.min(currentStreak - 1, 4) * 0.15; // up to +60% at 5 streak
    pointsAwarded = Math.round(basePoints * streakMultiplier);

    room.scores.set(player.id, (room.scores.get(player.id) || 0) + pointsAwarded);

    // drawer gets a flat reward per correct guesser too
    if (drawerId) {
      room.scores.set(drawerId, (room.scores.get(drawerId) || 0) + 25);
    }

    streakInfo = { streak: currentStreak, pointsAwarded, multiplier: streakMultiplier };
    entry.text = text; // keep guess visible as correct, client will redact others' view if needed
  } else if (!isCorrect) {
    room.streaks.set(player.id, 0);
  }

  room.guesses.push(entry);
  room.guesses = room.guesses.slice(-50);

  return { entry, isCorrect: isCorrect && !alreadyCorrect, pointsAwarded, streakInfo };
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
    maskedWord: room.currentWord ? maskedWord(room.currentWord) : '',
    wordLength: room.currentWord ? room.currentWord.replace(/\s/g, '').length : 0,
    timeLeft: timeLeftSeconds(room),
    drawTime: room.settings.drawTime,
    players: leaderboard(room),
    guesses: room.guesses,
    correctGuessers: [...room.correctGuessersThisRound]
  };
}

export { rooms };
