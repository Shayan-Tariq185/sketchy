# Posting Sketchy to GitHub & LinkedIn

A short, practical guide for turning this project into something that helps your CV and freelancing profile — not just a folder on your laptop.

---

## Part 1 — GitHub

### 1. Create the repo

1. Go to [github.com/new](https://github.com/new)
2. Name it something clean and searchable, e.g. `sketchy-drawing-game` or `sketchy-realtime-pictionary`
3. Set it to **Public** (private repos don't help your portfolio)
4. Don't initialize with a README — you already have one

### 2. Push your code

From the `sketchy/` folder:

```bash
git init
git add .
git commit -m "Initial commit: real-time multiplayer drawing & guessing game"
git branch -M main
git remote add origin https://github.com/<your-username>/sketchy-drawing-game.git
git push -u origin main
```

### 3. Add a screenshot or short clip to the README

This matters more than people think — recruiters and clients skim. Take 2–3 screenshots (home screen, a drawing round, the results screen) or record a 15–20 second screen capture, drop them in a `docs/` folder, and embed them near the top of your `README.md`:

```markdown
![Sketchy gameplay](docs/gameplay.png)
```

A short GIF of an actual round being played is even better than static screenshots — it proves the multiplayer sync works.

### 4. Deploy it and link the live demo

A repo people can *read* is good. A repo people can *click and immediately play* is much better. Follow the **"Deploying it for real"** section in the main `README.md` to put this on Render (backend) + Vercel (frontend) for free, then add the live link to the very top of your repo and to your GitHub profile's pinned repos.

### 5. Pin it

On your GitHub profile, go to **Customize your pins** and pin this repo so it's the first thing visitors see.

---

## Part 2 — LinkedIn

Don't just drop a link — tell the story of what you built and what you learned. Here's a structure that works well for student/early-career portfolio posts:

### Suggested post structure

1. **Hook (1 line):** what it is, in plain language.
2. **The problem you solved:** what was the gap or limitation, briefly.
3. **What's technically interesting:** 2–3 specific things (real-time sync, scoring logic, etc.) — specificity signals you actually built it, not copy-pasted it.
4. **Call to action:** live link + GitHub link.
5. **Relevant hashtags.**

### Example draft (edit to sound like you)

> Built a real-time multiplayer drawing & guessing game from scratch — React + Vite on the frontend, Node.js + Socket.IO on the backend.
>
> Unlike most online Pictionary-style games, this one only works with a private room code — no public matchmaking, no strangers, just whoever you share the code with.
>
> A few things I focused on:
> 🎯 Server-authoritative game state (rounds, timers, scoring) so the canvas and gameplay stay in sync across every connected player in real time
> 🔥 A streak-multiplier scoring system and a "heat" proximity hint for wrong guesses, calculated server-side with a Levenshtein-distance similarity score — without ever leaking the actual word to the client
> 🎬 Every round's drawing is captured stroke-by-stroke and replayed as an animated timelapse afterward
>
> Try it live: [your deployed link]
> Code: [your GitHub link]
>
> #WebDevelopment #ReactJS #NodeJS #SocketIO #SoftwareEngineering #BuildInPublic #StudentDeveloper

### Tips that actually move the needle

- **Post the live link, not just GitHub.** Recruiters rarely clone repos to test things; they click links. Make sure clicking it works on first try.
- **Tag it as a personal/side project explicitly** if you're publishing it during your semester break — context like "built during my semester break to learn full-stack real-time apps" is good signal for internship/freelance conversations.
- **Reply to your own comments** with a short technical detail if anyone asks "how does the multiplayer work" — that's where deeper engagement (and profile visits) comes from.
- **Cross-post to your CV/portfolio site** if you have one, with the same live + GitHub links.

---

## Part 3 — Using this for freelancing (Fiverr/Upwork)

Since you mentioned freelancing goals: this project is a strong **portfolio piece for "real-time app development"** gigs specifically — a lot of clients ask for live chat features, multiplayer games, collaborative tools, or live dashboards, and this demonstrates exactly that skill set (WebSockets, shared state sync, room-based access control).

When listing it in a portfolio or gig profile:
- Call out the **real-time sync** and **room-based private access** explicitly — those are the technically hard parts clients pay for.
- Link the **live demo** front and center; a working demo outperforms a paragraph of description every time.
