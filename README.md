# DROP V1.6 — Bots + Protected Rounds + Live Spectator

Confirmed test-feedback changes:
- 3-minute lobby.
- Only the host can open/start a Drop.
- Minimum 2 human players required.
- 5 CPU bots are generated automatically for every Drop.
- Bot usernames change every Drop and are clearly labeled CPU.
- Level 1: every human is safe; roughly half the bots are randomly eliminated.
- Level 2: every human is safe; all remaining bots are eliminated.
- Level 3 onward: top 50% of human survivors advance, bottom 50% are eliminated.
- Survivor leaderboard after every level.
- Screen shows survivors remaining and players eliminated that level.
- Eliminated humans remain in LIVE SPECTATOR mode.
- Spectators see a live leaderboard and live cut line for remaining human players.
- 12 random microgames.
- Games use a shuffle bag and can never play twice in a row.
- Server hard timeout prevents one missing score from freezing a level.
- Current beta prize display: $10.

Render:
Build Command: npm install
Start Command: npm start

Environment variable:
HOST_KEY = your secret password

Default HOST_KEY if you do not set one:
DROPADMIN
