import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  activeRoomCount,
  addPlayer,
  allNonDrawersGuessedCorrectly,
  buildDrawerOrder,
  confirmWordChoice,
  connectedPlayers,
  createRoom,
  currentDrawerId,
  deleteRoom,
  endRound,
  getPlayerBySocket,
  getRoom,
  guessHeat,
  isRoomEmpty,
  markDisconnected,
  publicRoomState,
  reconnectPlayer,
  registerGuess,
  removePlayer,
  resetForReplay,
  startRound,
  timeLeftSeconds
} from './roomManager.js';

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

function tickRoom(code) {
  const room = getRoom(code);
  if (!room || room.status !== 'drawing') return;

  const left = timeLeftSeconds(room);
  io.to(code).emit('round:tick', { timeLeft: left });

  if (left <= 0) {
    finishRound(code, { type: 'timeout', word: room.currentWord });
  }
}

function finishRound(code, resultPayload) {
  const room = getRoom(code);
  if (!room) return;
  clearRoomTimer(room);
  endRound(room);

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

    if (stillRoom.round >= stillRoom.settings.maxRounds) {
      stillRoom.status = 'finished';
      io.to(code).emit('game:finished', {
        leaderboard: publicRoomState(stillRoom).players,
        recaps: stillRoom.roundRecaps
      });
      emitRoomState(code);
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
      kickOffDrawing(code);
    }, 12000);
  } else {
    kickOffDrawing(code);
  }
}

function kickOffDrawing(code) {
  const room = getRoom(code);
  if (!room) return;
  clearRoomTimer(room);

  emitRoomState(code);
  const drawerId = currentDrawerId(room);
  emitToPlayer(room, drawerId, 'word:reveal', { word: room.currentWord });

  room.timer = setInterval(() => tickRoom(code), 1000);
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ name }, callback) => {
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
    const drawerId = currentDrawerId(room);
    if (!player || player.id !== drawerId) return;
    if (!room.wordChoices.includes(word)) return;

    confirmWordChoice(room, word);
    kickOffDrawing(code);
  });

  socket.on('canvas:stroke', ({ code, stroke }) => {
    const room = getRoom(code);
    if (!room || room.status !== 'drawing') return;
    const player = getPlayerBySocket(room, socket.id);
    const drawerId = currentDrawerId(room);
    if (!player || player.id !== drawerId) return;

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

    const { entry, isCorrect, pointsAwarded, streakInfo } = registerGuess(room, player, text, drawerId);

    if (isCorrect) {
      io.to(code).emit('chat:correct', {
        playerId: player.id,
        playerName: player.name,
        color: player.color,
        pointsAwarded,
        streak: streakInfo?.streak || 1
      });
      emitRoomState(code);

      if (allNonDrawersGuessedCorrectly(room, drawerId)) {
        finishRound(code, { type: 'all-correct', word: room.currentWord });
      }
    } else {
      // Heat hint goes only to the guesser, never reveals the word
      const heat = guessHeat(text, room.currentWord || '');
      io.to(code).emit('chat:message', entry);
      socket.emit('chat:heat', { heat });
    }
  });

  socket.on('chat:message', ({ code, text }) => {
    // free chat (no guessing implications) usable in lobby / between rounds
    const room = getRoom(code);
    if (!room || !text?.trim()) return;
    const player = getPlayerBySocket(room, socket.id);
    if (!player) return;
    io.to(code).emit('chat:message', {
      id: `${Date.now()}-${player.id}`,
      playerId: player.id,
      playerName: player.name,
      color: player.color,
      text: text.trim().slice(0, 200),
      correct: false,
      system: false,
      createdAt: Date.now()
    });
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
