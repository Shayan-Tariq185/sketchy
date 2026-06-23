import { pickWord } from './wordBank.js';

export const BONUS_MIN_PLAYERS = 5;
export const BONUS_DRAW_SEC = 75;
export const BONUS_GUESS_SEC = 90;
export const BONUS_POINTS_PER_MATCH = 100;

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function connectedPlayers(room) {
  return [...room.players.values()].filter((p) => p.connected);
}

export function canRunBonusRound(room) {
  return !!room.settings.bonusRound && connectedPlayers(room).length >= BONUS_MIN_PLAYERS;
}

export function initBonusRound(room) {
  const players = connectedPlayers(room);
  room.bonusWord = pickWord(room.settings.wordPack, room.settings.difficulty, room.usedWords || []);
  room.bonusSubmissions = new Map();
  room.bonusGuesses = new Map();
  room.bonusDisplayOrder = shuffle(players.map((p) => p.id));
  room.bonusEndsAt = null;

  for (const p of players) {
    room.bonusSubmissions.set(p.id, { strokes: [], submitted: false, submittedAt: null });
  }
}

export function startBonusDrawingPhase(room) {
  room.status = 'bonus-drawing';
  room.bonusEndsAt = Date.now() + BONUS_DRAW_SEC * 1000;
}

export function startBonusGuessingPhase(room) {
  room.status = 'bonus-guessing';
  room.bonusEndsAt = Date.now() + BONUS_GUESS_SEC * 1000;

  // Auto-submit empty drawings for anyone who didn't finish
  for (const [, sub] of room.bonusSubmissions) {
    if (!sub.submitted) {
      sub.submitted = true;
      sub.submittedAt = Date.now();
    }
  }
}

export function bonusTimeLeftSeconds(room) {
  if (!room.bonusEndsAt) return 0;
  return Math.max(0, Math.ceil((room.bonusEndsAt - Date.now()) / 1000));
}

export function allBonusDrawingsSubmitted(room) {
  const players = connectedPlayers(room);
  return players.every((p) => room.bonusSubmissions.get(p.id)?.submitted);
}

export function allBonusGuessesSubmitted(room) {
  const players = connectedPlayers(room);
  return players.every((p) => room.bonusGuesses.has(p.id));
}

export function getAnonymousDrawings(room) {
  return room.bonusDisplayOrder.map((playerId, index) => ({
    anonId: `drawing-${index}`,
    label: String.fromCharCode(65 + index),
    strokes: room.bonusSubmissions.get(playerId)?.strokes || []
  }));
}

export function resolveAnonId(room, anonId) {
  const index = Number(String(anonId).replace('drawing-', ''));
  if (Number.isNaN(index) || index < 0 || index >= room.bonusDisplayOrder.length) return null;
  return room.bonusDisplayOrder[index];
}

export function scoreBonusRound(room) {
  const results = [];
  const players = connectedPlayers(room);

  for (const voter of players) {
    const assignments = room.bonusGuesses.get(voter.id);
    if (!assignments) continue;

    let correct = 0;
    const details = [];

    for (const [anonId, guessedPlayerId] of Object.entries(assignments)) {
      const actualPlayerId = resolveAnonId(room, anonId);
      if (!actualPlayerId) continue;
      const hit = guessedPlayerId === actualPlayerId;
      if (hit) correct += 1;
      details.push({
        anonId,
        label: getAnonymousDrawings(room).find((d) => d.anonId === anonId)?.label,
        guessedPlayerId,
        actualPlayerId,
        hit
      });
    }

    const points = correct * BONUS_POINTS_PER_MATCH;
    if (points > 0) {
      room.scores.set(voter.id, (room.scores.get(voter.id) || 0) + points);
    }
    const stats = room.playerStats.get(voter.id);
    if (stats) stats.bonusCorrectGuesses = correct;

    results.push({
      voterId: voter.id,
      voterName: voter.name,
      correct,
      total: room.bonusDisplayOrder.length,
      points,
      details
    });
  }

  return results;
}

export function clearBonusState(room) {
  room.bonusWord = null;
  room.bonusSubmissions = null;
  room.bonusGuesses = null;
  room.bonusDisplayOrder = null;
  room.bonusEndsAt = null;
}

export function bonusPublicSlice(room) {
  if (!room.status?.startsWith('bonus')) return {};

  const players = connectedPlayers(room);
  const submittedCount = players.filter((p) => room.bonusSubmissions?.get(p.id)?.submitted).length;

  const base = {
    bonusWord: room.bonusWord,
    bonusTimeLeft: bonusTimeLeftSeconds(room),
    bonusSubmittedCount: submittedCount,
    bonusTotalPlayers: players.length,
    bonusGuessesSubmittedCount: room.bonusGuesses?.size || 0
  };

  if (room.status === 'bonus-guessing') {
    base.bonusDrawings = getAnonymousDrawings(room);
  }

  return base;
}
