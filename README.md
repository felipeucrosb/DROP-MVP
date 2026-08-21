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

## V2.0 — Survivors / Eliminated Boards
- Every Drop now starts with 10 clearly-labeled CPU bots.
- Bots are progressively removed across the first three levels:
  - Level 1: 10 -> ~7
  - Level 2: ~7 -> ~4
  - Level 3: all remaining CPUs are eliminated
- Level 4 starts with human players only.
- CPU bots can never reach the Top 2 or win the Drop.
- After EVERY completed level, the transition screen always shows two independent cumulative boards:
  - SURVIVORS — everyone still alive, humans + CPU bots
  - ELIMINATED — everyone eliminated since the beginning of the Drop
- The ELIMINATED count is cumulative and grows every level.
- Each eliminated username shows the level where they were eliminated.
- Most recently eliminated players appear first.
- The old post-round Cut Line layout has been removed.

## V2.1 — Mobile UX fixes
- Persistent lobby warning tells players not to close, refresh, switch tabs/browsers, or leave during the Drop.
- Tap Rush now uses pointer events and a large no-zoom tap zone for iPhone/mobile.
- Game controls disable browser touch gestures where appropriate.
- Balance no longer follows the finger position. It now uses explicit LEFT and RIGHT hold controls, matching the mental model of balancing a moving ball.
- Balance still ramps difficulty progressively.

## V2.2 — Final Results + Next Drop
- DROP COMPLETE now has a stronger winner hero treatment.
- Full final standings show every participant, not just the top 20/30.
- Top 3 receive podium-style visual markers.
- Final participant count is shown.
- New CTA: WAIT FOR THE NEXT DROP.
- CTA returns the player to the lobby/waiting experience so the next prize opportunity stays front and center.

## V2.3 — Flappy difficulty ramp
- Flappy begins significantly slower.
- Initial pipe gap increased from 145px to ~190px.
- Lower starting gravity and slightly softer flap.
- Pipe speed ramps from 1.75 to 3.30 over ~18 seconds.
- Pipe gap progressively tightens back toward the original difficulty.
- First obstacle is delayed briefly so the player can understand the control.
