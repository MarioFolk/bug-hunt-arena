# Bug Hunt Arena

**Live demo:** https://joyful-begonia-479870.netlify.app
**GitHub repository:** https://github.com/MarioFolk/bug-hunt-arena

Bug Hunt Arena is a browser-based multiplayer technology quiz for 2–8 players. Players create or join a room, answer technical and logic questions, earn points for correct and fast answers, and compete for the highest final score.

## Highlights

- Multiplayer rooms with a shareable room code
- Host-controlled match start; 2–8 players
- Six-round match format: Bug Hunt, Logic Battle and Speed Quiz
- Four answer choices per question
- 20-second question timer
- Correct-answer points plus a speed bonus
- Round results, explanations, player profiles and match history
- Global leaderboard
- Responsive dark/neon interface
- 100-question bank across programming, Linux, SQL, Git, APIs, debugging, QA and algorithms

## Live demo

Open the deployed game: **https://joyful-begonia-479870.netlify.app**

To try multiplayer, open the link in two separate browser sessions. Create a room in the first session, join it from the second session using the room code, and start the match as the host.

## Netlify deployment architecture

The deployed Netlify edition uses:

- Frontend: HTML, CSS and JavaScript
- Backend: Netlify Function at `/.netlify/functions/game`
- Shared state: Netlify Blobs store `bug-hunt-arena-state`
- Transport: HTTP requests and browser polling (rather than a continuously running Socket.IO server)
- Concurrency: strong-consistency reads and ETag conditional writes for the shared state record

The Netlify edition preserves the game's core interface and gameplay while replacing the original persistent Node.js/Socket.IO backend with a serverless implementation suitable for Netlify Functions.

## Testing

The deployed version was manually tested in two separate browser sessions:

- Room creation — passed
- Joining as a second player — passed
- Host starting the match — passed
- Playing through the match — passed
- Profile showing the completed match and statistics — passed
- Match/profile data remaining after a page refresh — passed

The Netlify package also includes an automated game-engine test suite covering a two-player match through six rounds, scoring and winner calculation, host-only start, answer locking, and profile/leaderboard aggregation. Automated tests are not a substitute for monitoring the live deployment.

**Not separately confirmed in the live manual test:** the visible Global Leaderboard display for both players. The profile persistence check was confirmed.

## Repository and deployment note

The GitHub repository contains the Netlify serverless edition deployed at the live demo URL. The original Express, Socket.IO and SQLite implementation is retained in the Git history before the serverless migration. The current source uses Netlify Functions and Netlify Blobs.

## Project status

A working portfolio prototype with a live public deployment and a manually verified two-player game flow. It is not presented as a production-hardened commercial service. Player/profile identifiers are not account authentication, and the shared Blobs record is designed for a small prototype rather than high-throughput transactional workloads.

## Author

**Mario Folk**
GitHub: https://github.com/MarioFolk
