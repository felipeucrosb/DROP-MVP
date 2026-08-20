# DROP MVP

Functional multiplayer web prototype.

Features:
- Username entry
- 60-second lobby
- Host can START NOW
- Mystery game reveal
- 3 random skill games: THE BUTTON, STACK, FLAPPY
- One attempt per player
- $1,000 prize presentation
- Final leaderboard

Render:
Build command: npm install
Start command: npm start

Important: this is an MVP prototype only. It does not yet include real accounts, prize fulfillment, legal rules, databases, anti-cheat infrastructure, bot protection, or multi-server scaling.


## V1.1 fix
- PLAY AGAIN is always available after a Drop ends.
- Any participant can reset a finished Drop and open a fresh lobby.
- Fixes refresh/reconnect cases where the old host identity was lost.
