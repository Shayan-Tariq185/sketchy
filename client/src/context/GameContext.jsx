import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { clearSession, loadSession, saveSession, socket } from '../socket';

const GameContext = createContext(null);

const initialRoomState = {
  code: '',
  hostId: '',
  status: 'idle', // idle | lobby | choosing | drawing | round-end | finished
  settings: { maxRounds: 6, drawTime: 80, wordPack: 'Classic', difficulty: 'Medium', choiceMode: true },
  round: 0,
  maxRounds: 6,
  drawerId: null,
  wordChoices: [],
  maskedWord: '',
  wordLength: 0,
  timeLeft: 0,
  drawTime: 80,
  players: [],
  guesses: [],
  correctGuessers: []
};

export function GameProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [room, setRoom] = useState(initialRoomState);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [secretWord, setSecretWord] = useState('');
  const [heat, setHeat] = useState(null);
  const [lastCorrect, setLastCorrect] = useState(null);
  const [roundEndInfo, setRoundEndInfo] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [view, setView] = useState('home'); // home | lobby | game | results

  const strokeListeners = useRef(new Set());

  const pushToast = useCallback((text) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  useEffect(() => {
    socket.connect();

    function onConnect() {
      setConnected(true);
      setConnecting(false);

      const session = loadSession();
      if (session?.code && session?.playerId) {
        socket.emit('room:rejoin', { code: session.code, playerId: session.playerId }, (res) => {
          if (res?.ok) {
            setPlayerId(res.playerId);
            setPlayerName(session.name || '');
            applyRoomState(res.state);
            setView(res.state.status === 'lobby' ? 'lobby' : res.state.status === 'finished' ? 'results' : 'game');
          } else {
            clearSession();
          }
        });
      }
    }

    function onDisconnect() {
      setConnected(false);
    }

    function applyRoomState(state) {
      setRoom((prev) => ({ ...prev, ...state }));
    }

    function onRoomState(state) {
      applyRoomState(state);
    }

    function onPlayerJoined({ name }) {
      pushToast(`${name} joined the room.`);
    }

    function onPlayerLeft({ name }) {
      pushToast(`${name} disconnected.`);
    }

    function onWordChoices() {
      // handled by Game screen directly via a dedicated listener too,
      // but we clear any stale secret word here.
      setSecretWord('');
    }

    function onWordReveal({ word }) {
      setSecretWord(word);
    }

    function onRoundEnd(payload) {
      setRoundEndInfo(payload);
      setSecretWord('');
      setHeat(null);
    }

    function onGameFinished(payload) {
      setGameResult(payload);
      setView('results');
    }

    function onGamePaused({ reason }) {
      pushToast(reason);
      setView('lobby');
    }

    function onChatHeat({ heat: h }) {
      setHeat(h);
      setTimeout(() => setHeat((curr) => (curr === h ? null : curr)), 1800);
    }

    function onChatCorrect(payload) {
      setLastCorrect(payload);
      setTimeout(() => setLastCorrect((curr) => (curr === payload ? null : curr)), 2400);
    }

    function onPlayerKicked() {
      clearSession();
      pushToast("You've been removed from the room.");
      setView('home');
      setRoom(initialRoomState);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('player:joined', onPlayerJoined);
    socket.on('player:left', onPlayerLeft);
    socket.on('word:choices', onWordChoices);
    socket.on('word:reveal', onWordReveal);
    socket.on('round:end', onRoundEnd);
    socket.on('game:finished', onGameFinished);
    socket.on('game:paused', onGamePaused);
    socket.on('chat:heat', onChatHeat);
    socket.on('chat:correct', onChatCorrect);
    socket.on('player:kicked', onPlayerKicked);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('player:joined', onPlayerJoined);
      socket.off('player:left', onPlayerLeft);
      socket.off('word:choices', onWordChoices);
      socket.off('word:reveal', onWordReveal);
      socket.off('round:end', onRoundEnd);
      socket.off('game:finished', onGameFinished);
      socket.off('game:paused', onGamePaused);
      socket.off('chat:heat', onChatHeat);
      socket.off('chat:correct', onChatCorrect);
      socket.off('player:kicked', onPlayerKicked);
    };
  }, [pushToast]);

  const createRoom = useCallback((name) => {
    return new Promise((resolve) => {
      socket.emit('room:create', { name }, (res) => {
        if (res?.ok) {
          setPlayerId(res.playerId);
          setPlayerName(name);
          setRoom((prev) => ({ ...prev, ...res.state }));
          saveSession({ code: res.code, playerId: res.playerId, name });
          setView('lobby');
          setError('');
        } else {
          setError(res?.error || 'Could not create room.');
        }
        resolve(res);
      });
    });
  }, []);

  const joinRoom = useCallback((code, name) => {
    return new Promise((resolve) => {
      socket.emit('room:join', { code, name }, (res) => {
        if (res?.ok) {
          setPlayerId(res.playerId);
          setPlayerName(name);
          setRoom((prev) => ({ ...prev, ...res.state }));
          saveSession({ code: res.code, playerId: res.playerId, name });
          setView('lobby');
          setError('');
        } else {
          setError(res?.error || 'Could not join room.');
        }
        resolve(res);
      });
    });
  }, []);

  const leaveRoom = useCallback(() => {
    socket.emit('room:leave', { code: room.code });
    clearSession();
    setRoom(initialRoomState);
    setView('home');
    setGameResult(null);
    setRoundEndInfo(null);
  }, [room.code]);

  const updateSettings = useCallback(
    (settings) => {
      socket.emit('room:updateSettings', { code: room.code, settings });
    },
    [room.code]
  );

  const startGame = useCallback(() => {
    setGameResult(null);
    setView('game');
    socket.emit('room:start', { code: room.code });
  }, [room.code]);

  const chooseWord = useCallback(
    (word) => {
      socket.emit('word:choose', { code: room.code, word });
    },
    [room.code]
  );

  const sendStroke = useCallback(
    (stroke) => {
      socket.emit('canvas:stroke', { code: room.code, stroke });
    },
    [room.code]
  );

  const clearCanvas = useCallback(() => {
    socket.emit('canvas:clear', { code: room.code });
  }, [room.code]);

  const undoStroke = useCallback(() => {
    socket.emit('canvas:undo', { code: room.code });
  }, [room.code]);

  const sendGuess = useCallback(
    (text) => {
      socket.emit('chat:guess', { code: room.code, text });
    },
    [room.code]
  );

  const sendChat = useCallback(
    (text) => {
      socket.emit('chat:message', { code: room.code, text });
    },
    [room.code]
  );

  const kickPlayer = useCallback(
    (id) => {
      socket.emit('host:kick', { code: room.code, playerId: id });
    },
    [room.code]
  );

  useEffect(() => {
    if (room.status === 'choosing' || room.status === 'drawing') {
      setView('game');
    }
  }, [room.status]);

  const value = {
    connected,
    connecting,
    playerId,
    playerName,
    room,
    error,
    setError,
    toasts,
    pushToast,
    secretWord,
    heat,
    lastCorrect,
    roundEndInfo,
    setRoundEndInfo,
    gameResult,
    setGameResult,
    view,
    setView,
    createRoom,
    joinRoom,
    leaveRoom,
    updateSettings,
    startGame,
    chooseWord,
    sendStroke,
    clearCanvas,
    undoStroke,
    sendGuess,
    sendChat,
    kickPlayer,
    strokeListeners
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
