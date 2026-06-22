# Sketchy 🎨

A private, friends-only drawing & guessing party game — built with React, Vite, Node.js, and Socket.IO.

No sign-up. No public matchmaking. No strangers. Make a room, share the 5-letter code with your group chat, and start sketching.

![Status](https://img.shields.io/badge/status-fully%20functional-3DDC97)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Vite%20%2B%20Socket.IO-4D6BFE)

---

## Why this isn't just another Skribbl clone

| Feature | What it does |
|---|---|
| **Private rooms only** | There is no public lobby, no matchmaking queue, and no way to stumble into a stranger's game. The only way in is a room code your host shares with you directly. |
| **Word-choice mode** | The drawer picks from 3 random words each round instead of being forced into one (toggleable by the host). |
| **Heat-meter guessing** | Wrong guesses get a private "cold → so close!" proximity meter (powered by a Levenshtein-distance similarity score) — without ever leaking the actual word. |
| **Streak multiplier scoring** | Consecutive correct guesses build a streak that multiplies your points (up to +60% at a 5-streak), on top of speed-based bonus points for guessing fast. |
| **Drawing replay / timelapse** | Every round's strokes are recorded and replayed as an animated timelapse at round-end — and the full set is browsable again from the results screen at the end of the game. |
| **Host controls** | Word packs, difficulty, round count, draw-time, and choice-mode are all host-adjustable; the host can also kick disruptive players. |
| **Reconnect-safe** | If someone's wifi drops mid-round, refreshing the page reconnects them straight back into their seat, with the canvas and round state restored. |

---

## Project structure

```
sketchy/
├── server/              # Node.js + Express + Socket.IO backend
│   ├── index.js         # Socket event handlers, game loop, timers
│   ├── roomManager.js   # Room/player state, scoring, round logic
│   ├── wordBank.js      # Word packs (Classic, Movies, Food, Tech)
│   └── package.json
│
└── client/              # React + Vite frontend
    ├── src/
    │   ├── screens/      # HomeScreen, LobbyScreen, GameScreen, ResultsScreen
    │   ├── components/   # Canvas, guess feed, replay overlay, etc.
    │   ├── context/       # GameContext — global state wired to sockets
    │   ├── hooks/          # useCanvasDrawing — stroke capture & sync
    │   ├── styles/         # Design system (tokens, components, per-screen)
    │   └── socket.js       # Socket.IO client singleton + session persistence
    └── package.json
```

There's no database — everything lives in server memory, which is plenty for a game you play live with friends. Rooms are cleaned up automatically a few minutes after everyone leaves.

---

## Running it locally

You need [Node.js](https://nodejs.org) 18+ installed.

### 1. Start the backend

```bash
cd server
npm install
npm start
```

This runs the Socket.IO server on **http://localhost:4000**.

### 2. Start the frontend

In a second terminal:

```bash
cd client
npm install
npm run dev
```

This runs the Vite dev server on **http://localhost:5173**, already configured to proxy `/socket.io` requests to your local backend.

### 3. Play

Open `http://localhost:5173` in one browser tab, create a room, and open it in a **second tab (or your phone, or a friend's laptop on the same network)** to join with the code. You need at least 2 connected players to start a game.

---

## Deploying it for real (so friends anywhere can join)

Right now, "localhost" only works for people on your machine. To actually share this with friends over the internet, you need to deploy both pieces:

### Backend (pick one — all have free tiers)
- **[Render](https://render.com)** — easiest for a long-running Node/Socket.IO server. Create a new "Web Service", point it at the `server/` folder, build command `npm install`, start command `npm start`.
- **[Railway](https://railway.app)** — similar one-click deploy from a GitHub repo.
- **Fly.io** — works well if you want more control.

> Avoid purely serverless platforms (like plain Vercel functions) for the backend — Socket.IO needs a persistent, long-running process to hold WebSocket connections.

After deploying, note your backend's public URL, e.g. `https://sketchy-server.onrender.com`.

### Frontend
- **[Vercel](https://vercel.com)** or **[Netlify](https://netlify.com)** — both deploy a Vite app from a GitHub repo in a couple of clicks.
- Set one environment variable before building: `VITE_SERVER_URL=https://sketchy-server.onrender.com` (your backend's URL from above).
- Also set `CLIENT_ORIGIN` on your **backend's** environment variables to your frontend's deployed URL, e.g. `https://sketchy.vercel.app`, so CORS allows it.

Once both are deployed, share your frontend URL with friends — they don't need to install anything.

---

## Tech stack

- **Frontend:** React 18, Vite, Socket.IO client, lucide-react icons, plain CSS (no framework — a custom hand-drawn-inspired design system)
- **Backend:** Node.js, Express, Socket.IO, nanoid
- **Realtime sync:** WebSocket-based stroke streaming, server-authoritative scoring and round timers

---

## License

This project is yours to use, modify, and ship however you like.
