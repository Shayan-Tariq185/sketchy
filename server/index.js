import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  activeRoomCount,
  addPlayer,
  allNonDrawersGuessedCorrectly,
  applyDrawerChatPenalty,
  assignBadges,
  buildDrawerOrder,
  buildRoastRecap,
  confirmWordChoice,
  connectedPlayers,
  createRoom,
  currentDrawerId,
  deleteRoom,
  endRound,
  getPlayerBySocket,
  getRoom,
  guessHeat,
  isAtCapacity,
  isGameComplete,
  isRoomEmpty,
  markDisconnected,
  publicRoomState,
  reconnectPlayer,
  registerGuess,
  removePlayer,
  resetForReplay,
  revealHintLetter,
  startDrawingPhase,
  startRound,
  timeLeftSeconds,
  trackDrawerPrediction,
  trackDrawerStroke,
} from './roomManager.js';
import {
  allBonusDrawingsSubmitted,
  allBonusGuessesSubmitted,
  bonusTimeLeftSeconds,
  canRunBonusRound,
  clearBonusState,
  initBonusRound,
  resolveAnonId,
  scoreBonusRound,
  startBonusDrawingPhase,
  startBonusGuessingPhase,
} from './bonusRound.js';
import { generateSmartHint } from './smartHints.js';

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: activeRoomCount() });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] }
});

const MAX_PLAYERS = 12;
const ROUND_END_PAUSE_MS = 4200;
const BONUS_RESULTS_PAUSE_MS = 6000;
const EMPTY_ROOM_GRACE_MS = 5 * 60 * 1000;

function emitRoomState(code) {
  const room = getRoom(code);
  if (!room) return;
  io.to(code).emit('room:state', publicRoomState(room));
}

function emitToPlayer(room, playerId, event, payload) {
  const player = room.players.get(playerId);
  if (!player?.socketId) return;
  io.to(player.socketId).emit(event, payload);
}

function clearRoomTimer(room) {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
}

function maybeTriggerHints(code, room) {
  if (!room.roundEndsAt || room.status !== 'drawing') return;

  const totalMs = room.settings.drawTime * 1000;
  const elapsed = Date.now() - (room.roundEndsAt - totalMs);
  const ratio = elapsed / totalMs;

  if (room.settings.smartHints) {
    const stages = [
      { at: 0.5, stage: 0 },
      { at: 0.7, stage: 1 },
      { at: 0.85, stage: 2 }
    ];
    for (const { at, stage } of stages) {
      if (ratio >= at && !room.smartHintsGiven.has(stage)) {
        room.smartHintsGiven.add(stage);
        const text = generateSmartHint(
          room.currentWord,
          room.settings.wordPack,
          room.settings.difficulty,
          stage
        );
        room.narratorHints = [...(room.narratorHints || []), text];
        room.hintGiven = true;
        io.to(code).emit('hint:narrator', { text, stage });
        emitRoomState(code);
      }
    }
    return;
  }

  // Classic letter hint at 50%
  if (!room.hintGiven && ratio >= 0.5) {
    const revealed = revealHintLetter(room);
    if (revealed) {
      const state = publicRoomState(room);
      io.to(code).emit('hint:letter', {
        maskedWord: state.maskedWord,
        revealedCount: state.revealedCount
      });
      emitRoomState(code);
    }
  }
}

function tickRoom(code) {
  const room = getRoom(code);
  if (!room || room.status !== 'drawing') return;

  const left = timeLeftSeconds(room);
  io.to(code).emit('round:tick', { timeLeft: left });

  maybeTriggerHints(code, room);

  if (left <= 0) {
    finishRound(code, { type: 'timeout', word: room.currentWord });
  }
}

function tickBonusRound(code) {
  const room = getRoom(code);
  if (!room || !room.status?.startsWith('bonus')) return;

  const left = bonusTimeLeftSeconds(room);
  io.to(code).emit('bonus:tick', { timeLeft: left });

  if (room.status === 'bonus-drawing') {
    if (left <= 0 || allBonusDrawingsSubmitted(room)) {
      transitionBonusToGuessing(code);
    }
  } else if (room.status === 'bonus-guessing') {
    if (left <= 0 || allBonusGuessesSubmitted(room)) {
      finishBonusRound(code);
    }
  }
}

function finishGame(code) {
  const room = getRoom(code);
  if (!room) return;
  clearRoomTimer(room);
  clearBonusState(room);
  room.status = 'finished';

  const badgeMap = assignBadges(room);
  const playerBadges = {};
  for (const [pid, info] of badgeMap.entries()) {
    playerBadges[pid] = info;
  }

  const roastRecap = buildRoastRecap(room);

  io.to(code).emit('game:finished', {
    leaderboard: publicRoomState(room).players,
    recaps: room.roundRecaps,
    playerBadges,
    roastRecap,
  });
  emitRoomState(code);
}

function beginBonusRound(code) {
  const room = getRoom(code);
  if (!room || !canRunBonusRound(room)) {
    finishGame(code);
    return;
  }

  initBonusRound(room);
  startBonusDrawingPhase(room);
  emitRoomState(code);

  // Everyone gets the bonus word
  io.to(code).emit('bonus:word', { word: room.bonusWord });

  clearRoomTimer(room);
  room.timer = setInterval(() => tickBonusRound(code), 1000);
}

function transitionBonusToGuessing(code) {
  const room = getRoom(code);
  if (!room || room.status !== 'bonus-drawing') return;

  startBonusGuessingPhase(room);
  emitRoomState(code);
  io.to(code).emit('bonus:phase', { phase: 'guessing' });
}

function finishBonusRound(code) {
  const room = getRoom(code);
  if (!room || room.status !== 'bonus-guessing') return;

  clearRoomTimer(room);
  const results = scoreBonusRound(room);
  room.status = 'bonus-results';

  const reveal = room.bonusDisplayOrder.map((playerId, index) => ({
    anonId: `drawing-${index}`,
    label: String.fromCharCode(65 + index),
    playerId,
    playerName: room.players.get(playerId)?.name || 'Unknown',
    strokes: room.bonusSubmissions.get(playerId)?.strokes || []
  }));

  emitRoomState(code);

  io.to(code).emit('bonus:results', {
    word: room.bonusWord,
    results,
    reveal,
    leaderboard: publicRoomState(room).players
  });

  setTimeout(() => {
    const stillRoom = getRoom(code);
    if (!stillRoom || stillRoom.status !== 'bonus-results') return;
    finishGame(code);
  }, BONUS_RESULTS_PAUSE_MS);
}

function finishRound(code, resultPayload) {
  const room = getRoom(code);
  if (!room) return;
  clearRoomTimer(room);

  // Calculate prediction bonus before endRound() resets statuses
  let predictionInfo = null;
  if (room.drawerPrediction !== null) {
    const actualCorrect = room.correctGuessersThisRound.size;
    const hit = room.drawerPrediction === actualCorrect;
    let bonus = 0;
    if (hit) {
      bonus = 50;
      const drawerId = currentDrawerId(room);
      if (drawerId) {
        room.scores.set(drawerId, (room.scores.get(drawerId) || 0) + bonus);
        trackDrawerPrediction(room, drawerId, true);
      }
    } else {
      const drawerId = currentDrawerId(room);
      if (drawerId) trackDrawerPrediction(room, drawerId, false);
    }
    predictionInfo = { predicted: room.drawerPrediction, actual: actualCorrect, hit, bonus };
  }

  endRound(room);
  resultPayload.predictionInfo = predictionInfo;

  // Add a system chat message revealing the word
  const systemMsg = {
    id: `sys-${Date.now()}`,
    playerId: 'system',
    playerName: 'System',
    color: '#8b8b9c', // faint ink
    text: `The word was: ${room.currentWord}`,
    system: true,
    createdAt: Date.now()
  };
  room.guesses.push(systemMsg);
  room.guesses = room.guesses.slice(-50);
  io.to(code).emit('chat:message', systemMsg);

  io.to(code).emit('round:end', {
    result: resultPayload,
    word: room.currentWord,
    drawerId: currentDrawerId(room),
    leaderboard: publicRoomState(room).players,
    strokes: room.strokes
  });
  emitRoomState(code);

  setTimeout(() => {
    const stillRoom = getRoom(code);
    if (!stillRoom || stillRoom.status !== 'round-end') return;

    // Game ends once every player has drawn maxRounds times. We must check
    // this BEFORE starting another turn -- checking room.round here only
    // reflects the turn that just finished, which is one turn too late and
    // lets an extra (maxRounds*playerCount + 1)-th turn slip through.
    if (isGameComplete(stillRoom)) {
      if (canRunBonusRound(stillRoom)) {
        beginBonusRound(code);
      } else {
        finishGame(code);
      }
    } else {
      beginRound(code);
    }
  }, ROUND_END_PAUSE_MS);
}

function beginRound(code) {
  const room = getRoom(code);
  if (!room) return;
  if (connectedPlayers(room).length < 2) {
    io.to(code).emit('game:paused', { reason: 'Need at least 2 players to continue.' });
    room.status = 'lobby';
    emitRoomState(code);
    return;
  }

  const drawerId = startRound(room);
  if (!drawerId) return;

  emitRoomState(code);

  if (room.settings.choiceMode) {
    emitToPlayer(room, drawerId, 'word:choices', { choices: room.wordChoices });
    // auto-pick after 12s if drawer doesn't choose
    room.timer = setTimeout(() => {
      const r = getRoom(code);
      if (!r || r.status !== 'choosing') return;
      const auto = r.wordChoices[0];
      confirmWordChoice(r, auto);
      kickOffPrediction(code);
    }, 12000);
  } else {
    kickOffPrediction(code);
  }
}

function kickOffPrediction(code) {
  const room = getRoom(code);
  if (!room) return;
  clearRoomTimer(room);

  emitRoomState(code);
  const drawerId = currentDrawerId(room);
  emitToPlayer(room, drawerId, 'word:reveal', { word: room.currentWord });

  // 6 second auto-skip for prediction
  room.timer = setTimeout(() => {
    const r = getRoom(code);
    if (!r || r.status !== 'predicting') return;
    kickOffDrawing(code);
  }, 6000);
}

function kickOffDrawing(code) {
  const room = getRoom(code);
  if (!room) return;
  clearRoomTimer(room);

  startDrawingPhase(room);
  emitRoomState(code);

  room.timer = setInterval(() => tickRoom(code), 1000);
}

const lastRoomCreateByIp = new Map();
const ROOM_CREATE_COOLDOWN_MS = 8000;

setInterval(() => {
  const cutoff = Date.now() - ROOM_CREATE_COOLDOWN_MS * 4;
  for (const [ip, ts] of lastRoomCreateByIp.entries()) {
    if (ts < cutoff) lastRoomCreateByIp.delete(ip);
  }
}, 10 * 60 * 1000);

function getClientIp(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return socket.handshake.address;
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ name }, callback) => {
    const ip = getClientIp(socket);
    const lastCreate = lastRoomCreateByIp.get(ip) || 0;
    if (Date.now() - lastCreate < ROOM_CREATE_COOLDOWN_MS) {
      callback?.({ ok: false, error: 'Please wait a few seconds before creating another room.' });
      return;
    }
    if (isAtCapacity()) {
      callback?.({ ok: false, error: 'Sketchy is at capacity right now — please try again in a few minutes.' });
      return;
    }

    lastRoomCreateByIp.set(ip, Date.now());
    const cleanName = (name || 'Player').trim().slice(0, 18) || 'Player';
    const room = createRoom(socket.id, cleanName);
    socket.join(room.code);
    const player = getPlayerBySocket(room, socket.id);
    callback?.({ ok: true, code: room.code, playerId: player.id, state: publicRoomState(room) });
  });

  socket.on('room:join', ({ code, name }, callback) => {
    const room = getRoom(code);
    if (!room) {
      callback?.({ ok: false, error: 'Room not found. Double-check the code with your host.' });
      return;
    }
    if (connectedPlayers(room).length >= MAX_PLAYERS) {
      callback?.({ ok: false, error: 'This room is full (12 players max).' });
      return;
    }
    if (room.status !== 'lobby') {
      callback?.({ ok: false, error: 'This game already started. Ask your host for a new round, or wait for the next one.' });
      return;
    }

    const cleanName = (name || 'Player').trim().slice(0, 18) || 'Player';
    const room2 = room;
    socket.join(room2.code);
    const player = addPlayer(room2, socket.id, cleanName, null, false);

    callback?.({ ok: true, code: room2.code, playerId: player.id, state: publicRoomState(room2) });
    socket.to(room2.code).emit('player:joined', { name: player.name });
    emitRoomState(room2.code);
  });

  socket.on('room:rejoin', ({ code, playerId }, callback) => {
    const room = getRoom(code);
    if (!room || !room.players.has(playerId)) {
      callback?.({ ok: false, error: 'Session expired. Please rejoin with the room code.' });
      return;
    }
    socket.join(room.code);
    reconnectPlayer(room, socket.id, playerId);
    callback?.({ ok: true, code: room.code, playerId, state: publicRoomState(room) });

    const drawerId = currentDrawerId(room);
    if (drawerId === playerId && room.currentWord) {
      socket.emit('word:reveal', { word: room.currentWord });
    }
    if (room.strokes.length) {
      socket.emit('canvas:bulk', { strokes: room.strokes });
    }
    emitRoomState(room.code);
  });

  socket.on('room:updateSettings', ({ code, settings }) => {
    const room = getRoom(code);
    if (!room) return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player?.isHost || room.status !== 'lobby') return;

    const next = { ...room.settings };
    if (settings.maxRounds) next.maxRounds = Math.min(20, Math.max(2, Number(settings.maxRounds)));
    if (settings.drawTime) next.drawTime = Math.min(180, Math.max(30, Number(settings.drawTime)));
    if (settings.wordPack) next.wordPack = settings.wordPack;
    if (settings.difficulty) next.difficulty = settings.difficulty;
    if (typeof settings.choiceMode === 'boolean') next.choiceMode = settings.choiceMode;
    if (typeof settings.smartHints === 'boolean') next.smartHints = settings.smartHints;
    if (typeof settings.bonusRound === 'boolean') {
      const count = connectedPlayers(room).length;
      next.bonusRound = settings.bonusRound && count >= 5;
    }
    room.settings = next;
    emitRoomState(code);
  });

  socket.on('room:start', ({ code }) => {
    const room = getRoom(code);
    if (!room) return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player?.isHost) return;
    if (connectedPlayers(room).length < 2) return;

    buildDrawerOrder(room);
    resetForReplay(room);
    room.status = 'lobby';
    beginRound(code);
  });

  socket.on('word:choose', ({ code, word }) => {
    const room = getRoom(code);
    if (!room || room.status !== 'choosing') return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player || player.id !== currentDrawerId(room)) return;
    confirmWordChoice(room, word);
    kickOffPrediction(code);
  });

  socket.on('word:predict', ({ code, prediction }) => {
    const room = getRoom(code);
    if (!room || room.status !== 'predicting') return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player || player.id !== currentDrawerId(room)) return;
    room.drawerPrediction = prediction;
    kickOffDrawing(code);
  });

  socket.on('canvas:stroke', ({ code, stroke }) => {
    const room = getRoom(code);
    if (!room || room.status !== 'drawing') return;
    const player = getPlayerBySocket(room, socket.id);
    const drawerId = currentDrawerId(room);
    if (!player || player.id !== drawerId) return;

    // Track stats before pushing stroke
    trackDrawerStroke(room, stroke);

    room.strokes.push(stroke);
    socket.to(code).emit('canvas:stroke', stroke);
  });

  socket.on('canvas:clear', ({ code }) => {
    const room = getRoom(code);
    if (!room || room.status !== 'drawing') return;
    const player = getPlayerBySocket(room, socket.id);
    const drawerId = currentDrawerId(room);
    if (!player || player.id !== drawerId) return;

    room.strokes = [];
    socket.to(code).emit('canvas:clear');
  });

  socket.on('canvas:undo', ({ code }) => {
    const room = getRoom(code);
    if (!room || room.status !== 'drawing') return;
    const player = getPlayerBySocket(room, socket.id);
    const drawerId = currentDrawerId(room);
    if (!player || player.id !== drawerId) return;

    room.strokes.pop();
    io.to(code).emit('canvas:bulk', { strokes: room.strokes });
  });

  socket.on('chat:guess', ({ code, text }) => {
    const room = getRoom(code);
    if (!room || !text?.trim()) return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player) return;
    const drawerId = currentDrawerId(room);
    if (player.id === drawerId) return; // drawer can't guess
    if (room.status !== 'drawing') return;
    // Guard: already-correct players cannot keep guessing
    if (room.correctGuessersThisRound.has(player.id)) return;

    const { entry, isCorrect, pointsAwarded, streakInfo } = registerGuess(room, player, text, drawerId);

    if (isCorrect) {
      io.to(code).emit('chat:correct', {
        guessId: entry.id,
        playerId: player.id,
        playerName: player.name,
        color: player.color,
        animal: player.animal,
        pointsAwarded,
        streak: streakInfo?.streak || 1
      });
      emitRoomState(code);

      if (allNonDrawersGuessedCorrectly(room, drawerId)) {
        finishRound(code, { type: 'all-correct', word: room.currentWord });
      }
    } else if (entry) {
      // Heat hint goes only to the guesser, never reveals the word
      const heat = guessHeat(text, room.currentWord || '');
      io.to(code).emit('chat:message', entry);
      socket.emit('chat:heat', { heat });
    }
  });

  socket.on('chat:message', ({ code, text }) => {
    const room = getRoom(code);
    if (!room || !text?.trim()) return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player) return;

    const drawerId = currentDrawerId(room);
    let penalty = 0;
    if (player.id === drawerId && room.status === 'drawing') {
      penalty = applyDrawerChatPenalty(room, drawerId);
      emitRoomState(code);
    }

    io.to(code).emit('chat:message', {
      id: `${Date.now()}-${player.id}`,
      playerId: player.id,
      playerName: player.name,
      color: player.color,
      animal: player.animal,
      text: text.trim().slice(0, 200),
      correct: false,
      system: false,
      drawerPenalty: penalty > 0 ? penalty : undefined,
      createdAt: Date.now()
    });
  });

  socket.on('bonus:stroke', ({ code, stroke }) => {
    const room = getRoom(code);
    if (!room || room.status !== 'bonus-drawing') return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player) return;

    const sub = room.bonusSubmissions?.get(player.id);
    if (!sub || sub.submitted) return;

    sub.strokes.push(stroke);
    // Strokes stay private until the guessing phase — no broadcast to other players.
  });

  socket.on('bonus:submit', ({ code }) => {
    const room = getRoom(code);
    if (!room || room.status !== 'bonus-drawing') return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player) return;

    const sub = room.bonusSubmissions?.get(player.id);
    if (!sub || sub.submitted) return;

    sub.submitted = true;
    sub.submittedAt = Date.now();
    emitRoomState(code);

    if (allBonusDrawingsSubmitted(room)) {
      transitionBonusToGuessing(code);
    }
  });

  socket.on('bonus:guess', ({ code, assignments }) => {
    const room = getRoom(code);
    if (!room || room.status !== 'bonus-guessing') return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player || room.bonusGuesses.has(player.id)) return;
    if (!assignments || typeof assignments !== 'object') return;

    const cleaned = {};
    for (const [anonId, guessedPlayerId] of Object.entries(assignments)) {
      const actualOwner = resolveAnonId(room, anonId);
      if (!actualOwner || !room.players.has(guessedPlayerId)) continue;
      cleaned[anonId] = guessedPlayerId;
    }

    const expectedAnonIds = room.bonusDisplayOrder.map((_, i) => `drawing-${i}`);
    if (expectedAnonIds.some((id) => !cleaned[id])) return;

    room.bonusGuesses.set(player.id, cleaned);
    emitRoomState(code);

    if (allBonusGuessesSubmitted(room)) {
      finishBonusRound(code);
    }
  });

  socket.on('host:kick', ({ code, playerId }) => {
    const room = getRoom(code);
    if (!room) return;
    const requester = getPlayerBySocket(room, socket.id);
    if (!requester?.isHost) return;
    const target = room.players.get(playerId);
    if (!target) return;

    io.to(target.socketId).emit('player:kicked');
    io.sockets.sockets.get(target.socketId)?.leave(code);
    removePlayer(room, playerId);
    emitRoomState(code);
  });

  socket.on('room:leave', ({ code }) => {
    handleLeave(socket, code);
  });

  socket.on('disconnect', () => {
    for (const code of socket.rooms) {
      if (code !== socket.id) handleLeave(socket, code);
    }
  });

  function handleLeave(socket, code) {
    const room = getRoom(code);
    if (!room) return;
    const player = markDisconnected(room, socket.id);
    socket.leave(code);
    if (player) {
      io.to(code).emit('player:left', { name: player.name });
      emitRoomState(code);
    }

    if (isRoomEmpty(room)) {
      clearRoomTimer(room);
      setTimeout(() => {
        const r = getRoom(code);
        if (r && isRoomEmpty(r)) deleteRoom(code);
      }, EMPTY_ROOM_GRACE_MS);
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`Sketchy server listening on port ${PORT}`);
});