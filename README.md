# DROP MVP V1.3 — Survivor Mode

Major changes:
- Only the owner/host can open or start a Drop.
- Public visitors cannot accidentally create a Drop.
- Host opens a 60-second lobby, then shares the normal public URL.
- Host can START NOW or let the 60-second lobby auto-start.
- Survivor tournament format:
  - Everyone plays Round 1.
  - Top 50% advance.
  - Bottom 50% are eliminated.
  - Repeat until only one winner remains.
  - Odd player counts use ceil(N/2), e.g. 5 -> 3 -> 2 -> 1.
- Eliminated players stay as spectators and can watch survivor counts/results.
- 12 microgames.
- Shuffle-bag game selection:
  - Games do not repeat until the full 12-game pool is used.
  - A game can NEVER appear twice in a row.
- Host control panel uses HOST_KEY.

## Render setup
Build Command:
npm install

Start Command:
npm start

Add an Environment Variable in Render:
HOST_KEY = choose-a-secret-password

If HOST_KEY is not set, the prototype defaults to:
DROPADMIN

## Recommended flow
1. Owner opens public website.
2. Click HOST.
3. Enter HOST_KEY.
4. Click OPEN 60s LOBBY.
5. Share the normal public URL.
6. Players join.
7. At 0:00 the tournament starts automatically, or owner can click START NOW.
8. Every level eliminates 50% until one winner remains.

This is still an MVP. Production use with large prizes needs persistent accounts, database, anti-cheat, server-authoritative games, bot protection, identity verification, scaling, official rules and prize fulfillment.

## V1.4 — Survivor Leaderboard
After every level, all players see a dedicated SURVIVOR LEADERBOARD before the next game reveal.
- Only surviving players are shown.
- Survivors are ranked by that round's score.
- The screen shows how many players remain.
- Eliminated players can also see who survived.
- After the leaderboard pause, the next level begins automatically.
