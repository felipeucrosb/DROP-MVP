# DROP V3 — Clean Rebuild

This version was rebuilt from zero instead of patching the prior frontend.

## Architecture
- `server.js` — multiplayer state, host controls, rounds, bots, elimination logic
- `public/index.html` — markup only
- `public/styles.css` — styles only
- `public/games.js` — exactly one implementation of each minigame
- `public/app.js` — exactly one UI/state controller

## Current game rules
- 3-minute lobby
- Only host can open/start
- Default host key: `DROPADMIN` unless `HOST_KEY` is set in Render
- Minimum 2 human players to start
- 10 clearly-labeled CPU bots
- Levels 1–3 protect all humans
- Bots eliminate progressively: 10 -> 7 -> 4 -> 0
- Level 4+ eliminates bottom 50% of humans
- Bots never reach the human final / Top 2
- 12 minigames with shuffle-bag selection and no immediate repeat
- Levels 1–5 EASY; 6–7 MEDIUM; 8–9 HARD; 10+ EXTREME
- Each minigame begins with a short inline 3-2-1-GO tutorial
- Full cumulative SURVIVORS and ELIMINATED lists after every level
- Eliminated players enter live spectator mode
- Final screen shows full human standings
- `WAIT FOR THE NEXT DROP` CTA
- Persistent lobby warning not to close/refresh/switch tabs
- Mobile-safe Tap Rush and Balance controls
- Flappy starts slow and progressively becomes harder
- Server hard timeout prevents one missing score from freezing a round

## Render
Build command:
`npm install`

Start command:
`npm start`

Recommended environment variable:
`HOST_KEY=your-private-password`

## Important
This is still an MVP. Before meaningful public prizes or large-scale traffic, add:
persistent accounts, database, server-authoritative game validation, anti-cheat, rate limiting, bot protection, reconnect/session recovery, load testing, monitoring, winner verification, and official prize rules.

## V3.1 — Basket + Faster Stack
- Replaced BALANCE with BASKET.
- BASKET is controlled like a horizontal slider: drag left/right anywhere in the game area to position the basket.
- Catch falling balls for 15 seconds; speed and spawn rate increase progressively.
- STACK now starts substantially faster and accelerates more aggressively after every successful block.

## V3.2 — Responsive Mobile
- Game surfaces scale to browser width and height.
- Compact-phone and short-screen breakpoints.
- Flappy, Basket, Catch, Aim, Stack, Tap Rush, Memory and large controls scale automatically.
- Flappy geometry and Catch collision logic now use rendered dimensions.
- Gameplay screens are constrained to reduce scrolling during rounds.
