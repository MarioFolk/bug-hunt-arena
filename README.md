# Bug Hunt Arena

A real-time multiplayer technology party game for 2–8 players. English-only MVP built with Node.js, Express and Socket.IO.

## Features

- Create a room and share a six-character room code.
- Join from separate devices on the same network or a deployed server.
- Host-controlled start; minimum 2, maximum 8 players.
- Six fixed rounds: 2 Bug Hunt, 2 Logic Battle, 2 Speed Quiz.
- Adaptive difficulty from Easy to Expert.
- Four multiple-choice answers per question.
- 20-second synchronized question timer.
- 100 points for a correct answer plus up to 50 speed-bonus points.
- Live answer counts, scores, round reveal and final leaderboard.
- Shared victory when players tie.
- Responsive dark neon interface.

## Requirements

- Node.js 18+ (Node.js 22 is recommended).
- npm.
- Internet connection for the Google Fonts stylesheet (the game still works without it).

## Run locally on Linux

```bash
unzip bug-hunt-arena.zip
cd bug-hunt-arena
npm install
npm start
```

Open http://localhost:3000.

## Test with two players

1. Open the URL in two separate browser windows (or one normal and one private window).
2. In the first window, create a room.
3. Copy the room code.
4. In the second window, enter a different player name and join with that code.
5. Start the match from the host window.

## Test on phones on the same Wi-Fi

Find your computer's LAN IP address:

```bash
hostname -I
```

On each phone, open `http://YOUR_LAN_IP:3000`. Allow port 3000 through the computer firewall if needed. Both devices must be on the same network.

## Deploy for remote players

Deploy this Node.js app to a host that supports persistent Node processes and WebSockets (for example, Render, Railway or Fly.io). Set the start command to `npm start`. Do not use a static-only hosting target such as GitHub Pages for the multiplayer server.

## Important MVP notes

- Rooms live in server memory; restarting the server clears active rooms.
- The question set is a small starter library of six curated questions. Expanding it is the next content task.
- A disconnected player remains represented during an active match, but this first MVP does not yet implement secure session-based reconnection.
- This is a playable prototype, not a production-hardened service. Before public launch, add rate limiting, input validation, room expiry, persistent sessions and automated tests.
- The six-question adaptive sequence is fixed for this MVP. Later versions can select questions from a larger tagged question bank.

## Project structure

```text
bug-hunt-arena/
├── server.js
├── package.json
├── README.md
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```
