import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { clearSession, loadSession, saveSession, socket } from '../socket';
import { clearInviteRoomParam } from '../utils/roomLink';

const GameContext = createContext(null);

const initialRoomState = {
  code: '',
  hostId: '',
  status: 'idle', // idle | lobby | choosing | drawing | round-end | finished
  settings: { maxRounds: 6, drawTime: 80, wordPack: 'Classic', difficulty: 'Medium', choiceMode: true, smartHints: false, bonusRound: false },
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
  correctGuessers: [],
  hintGiven: false,
  revealedCount: 0,
  narratorHints: [],
  bonusWord: '',
  bonusTimeLeft: 0,
  bonusDrawings: [],
  bonusSubmittedCount: 0,
  bonusTotalPlayers: 0,
  bonusGuessesSubmittedCount: 0
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
  const [bonusWord, setBonusWord] = useState('');
  const [bonusResults, setBonusResults] = useState(null);
  const [view, setView] = useState('home'); // home | lobby | game | results

  const strokeListeners = useRef(new Set());
  // Smooth client-side timer state
  const clientTimerRef = useRef(null);
  const serverTimeLeftRef = useRef(0);

  const pushToast = useCallback((text) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  // ---------- Smooth client-side timer ----------
  // Runs a 100ms interval that interpolates timeLeft locally, syncing
  // to the authoritative server value whenever round:tick fires.
  const startClientTimer = useCallback((initialSeconds) => {
    if (clientTimerRef.current) clearInterval(clientTimerRef.current);
    serverTimeLeftRef.current = initialSeconds;

    // Update the room timeLeft locally at 100ms resolution
    const startedAt = Date.now();
    const startSeconds = initialSeconds;

    clientTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const computed = Math.max(0, startSeconds - elapsed);
      setRoom((prev) => {
        if (prev.status !== 'drawing') return prev;
        return { ...prev, timeLeft: computed };
      });
    }, 100);
  }, []);

  const stopClientTimer = useCallback(() => {
    if (clientTimerRef.current) {
      clearInterval(clientTimerRef.current);
      clientTimerRef.current = null;
    }
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
            // Resume smooth timer if rejoining mid-drawing
            if (res.state.status === 'drawing' && res.state.timeLeft > 0) {
              startClientTimer(res.state.timeLeft);
            }
          } else {
            clearSession();
          }
        });
      }
    }

    function onDisconnect() {
      setConnected(false);
      stopClientTimer();
    }

    function applyRoomState(state) {
      setRoom((prev) => ({ ...prev, ...state }));
    }

    function onRoomState(state) {
      applyRoomState(state);
      // If the status just became drawing, start or reset the client-side smooth timer
      if (state.status === 'drawing' && state.timeLeft > 0) {
        startClientTimer(state.timeLeft);
      } else if (state.status !== 'drawing') {
        stopClientTimer();
      }
    }

    // Server's authoritative tick — sync the local timer reference
    function onRoundTick({ timeLeft }) {
      serverTimeLeftRef.current = timeLeft;
      // Restart the smooth timer anchored to this authoritative value
      startClientTimer(timeLeft);
    }

    function onPlayerJoined({ name }) {
      pushToast(`${name} joined the room.`);
    }

    function onPlayerLeft({ name }) {
      pushToast(`${name} disconnected.`);
    }

    function onWordChoices() {
      setSecretWord('');
    }

    function onWordReveal({ word }) {
      setSecretWord(word);
    }

    function onRoundEnd(payload) {
      setRoundEndInfo(payload);
      setSecretWord('');
      setHeat(null);
      stopClientTimer();
    }

    function onGameFinished(payload) {
      setGameResult(payload);
      setView('results');
      stopClientTimer();
    }

    function onGamePaused({ reason }) {
      pushToast(reason);
      setView('lobby');
      stopClientTimer();
    }

    function onChatHeat({ heat: h }) {
      setHeat(h);
      setTimeout(() => setHeat((curr) => (curr === h ? null : curr)), 3500);
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
      stopClientTimer();
    }

    // FIX: listen to chat:message events (incorrect guesses + drawer free chat)
    // and append them directly to room.guesses so the feed updates in real-time.
    function onChatMessage(msg) {
      setRoom((prev) => ({
        ...prev,
        guesses: [...(prev.guesses || []), msg].slice(-50)
      }));
    }

    // Hint letter reveal — update the masked word without a full room:state round-trip
    function onHintLetter({ maskedWord: mw, revealedCount }) {
      setRoom((prev) => ({ ...prev, maskedWord: mw, hintGiven: true, revealedCount }));
      pushToast('💡 A letter has been revealed!');
    }

    function onHintNarrator({ text }) {
      setRoom((prev) => ({
        ...prev,
        hintGiven: true,
        narratorHints: [...(prev.narratorHints || []), text]
      }));
      pushToast(text);
    }

    function onBonusWord({ word }) {
      setBonusWord(word);
    }

    function onBonusTick({ timeLeft }) {
      setRoom((prev) => ({ ...prev, bonusTimeLeft: timeLeft }));
    }

    function onBonusResults(payload) {
      setBonusResults(payload);
      setRoom((prev) => ({ ...prev, players: payload.leaderboard || prev.players }));
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('round:tick', onRoundTick);
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
    socket.on('chat:message', onChatMessage);
    socket.on('hint:letter', onHintLetter);
    socket.on('hint:narrator', onHintNarrator);
    socket.on('bonus:word', onBonusWord);
    socket.on('bonus:tick', onBonusTick);
    socket.on('bonus:results', onBonusResults);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('round:tick', onRoundTick);
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
      socket.off('chat:message', onChatMessage);
      socket.off('hint:letter', onHintLetter);
      socket.off('hint:narrator', onHintNarrator);
      socket.off('bonus:word', onBonusWord);
      socket.off('bonus:tick', onBonusTick);
      socket.off('bonus:results', onBonusResults);
      stopClientTimer();
    };
  }, [pushToast, startClientTimer, stopClientTimer]);

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
          clearInviteRoomParam();
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
    setBonusWord('');
    setBonusResults(null);
    setRoundEndInfo(null);
    stopClientTimer();
  }, [room.code, stopClientTimer]);

  const updateSettings = useCallback(
    (settings) => {
      socket.emit('room:updateSettings', { code: room.code, settings });
    },
    [room.code]
  );

  const startGame = useCallback(() => {
    setGameResult(null);
    setBonusWord('');
    setBonusResults(null);
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

  const sendPrediction = useCallback(
    (prediction) => {
      socket.emit('word:predict', { code: room.code, prediction });
    },
    [room.code]
  );

  const submitBonusGuess = useCallback(
    (assignments) => {
      socket.emit('bonus:guess', { code: room.code, assignments });
    },
    [room.code]
  );

  useEffect(() => {
    if (room.status === 'choosing' || room.status === 'predicting' || room.status === 'drawing' || room.status?.startsWith('bonus')) {
      setView('game');
    }
  }, [room.status]);

  // Team helpers — derived from room state so always fresh
  const myTeam = room.teams?.find((t) => t.playerIds?.includes(playerId)) || null;
  const drawerTeam = room.teams?.find((t) => t.playerIds?.includes(room.drawerId)) || null;
  const isMyTeamDrawing = !!(myTeam && drawerTeam && myTeam.id === drawerTeam.id);

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
    bonusWord,
    bonusResults,
    submitBonusGuess,
    view,
    setView,
    createRoom,
    joinRoom,
    leaveRoom,
    updateSettings,
    startGame,
    chooseWord,
    sendPrediction,
    sendStroke,
    clearCanvas,
    undoStroke,
    sendGuess,
    sendChat,
    kickPlayer,
    strokeListeners,
    // Team mode
    myTeam,
    drawerTeam,
    isMyTeamDrawing,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}