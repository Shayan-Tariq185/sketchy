import { io } from 'socket.io-client';

// In dev, Vite proxies /socket.io to the local server (see vite.config.js).
// In production, set VITE_SERVER_URL to your deployed backend's URL.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});

const SESSION_KEY = 'sketchy_session_v1';

export function saveSession({ code, playerId, name }) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code, playerId, name }));
  } catch {
    /* storage unavailable, ignore */
  }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
