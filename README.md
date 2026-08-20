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

## V1.7 — Full Round Leaderboard Fix
- After every level, ALL participants see the same round leaderboard before the next level.
- The leaderboard now includes both survivors and eliminated players.
- A red CUT LINE separates players advancing from players eliminated.
- Survivors show SAFE / SURVIVED.
- Eliminated players show ELIMINATED.
- Players who were just eliminated remain on the round-results screen for the full transition, then move to live spectator mode on the next level.

## V1.8 — Progressive Bots
- Bots now remain in the tournament for the first 3 levels.
- Human players are protected from elimination in Levels 1, 2 and 3.
- Bots are eliminated progressively:
  - Level 1: roughly one-third of bots are removed.
  - Level 2: roughly half of the remaining bots are removed.
  - Level 3: all remaining bots are removed.
- Level 4 begins with human players only.
- From Level 4 onward, the bottom 50% of human players is eliminated each round.
- Full round leaderboards still show both survivors and eliminated players.

## V1.9 — Progressive Difficulty
- Levels 1–5: EASY
- Levels 6–7: MEDIUM
- Levels 8–9: HARD
- Level 10+: EXTREME
- Every minigame gets a visual instruction plus 3–2–1–GO before scoring.
- Every minigame starts forgiving even in late rounds, then ramps toward that round's difficulty.
- AIM targets shrink progressively.
- STACK acceleration ramps progressively.
- FLAPPY speed ramps progressively.
- CATCH speed ramps progressively.
- Server hard timeout extended for tutorial/countdown.
