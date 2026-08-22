
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 20000,
  pingInterval: 10000,
});

app.use(express.static(path.join(__dirname, "public")));

const HOST_KEY = process.env.HOST_KEY || "DROPADMIN";
const LOBBY_MS = 3 * 60 * 1000;
const MIN_HUMANS_TO_START = 2;
const BOT_COUNT = 10;
const ROUND_HARD_TIMEOUT_MS = 30000;
const CUT_SCREEN_MS = 6500;
const REVEAL_MS = 2600;

const GAMES = [
  "button", "stack", "flappy", "reaction", "center", "taprush",
  "catcher", "memory", "slider", "balance", "aim", "stoplight"
];

let gameBag = [];
let lastGame = null;
let timers = { lobby: null, reveal: null, hard: null, cut: null };

let state = freshState();

function freshState() {
  return {
    phase: "closed", // closed | lobby | reveal | playing | cut | finished
    dropNo: 1,
    prize: 10,
    lobbyDeadline: 0,
    round: 0,
    game: null,
    startedAt: 0,
    players: {},
    activeIds: [],
    roundResults: [],
    results: [],
    hostSockets: new Set(),
  };
}

function clearTimer(name) {
  if (timers[name]) {
    clearTimeout(timers[name]);
    clearInterval(timers[name]);
    timers[name] = null;
  }
}
function clearAllTimers() {
  Object.keys(timers).forEach(clearTimer);
}

function lowerIsBetter(game) {
  return ["button", "reaction", "center", "slider", "stoplight"].includes(game);
}

function nextGame() {
  if (!gameBag.length) {
    gameBag = GAMES.slice().sort(() => Math.random() - 0.5);
    if (lastGame && gameBag[0] === lastGame && gameBag.length > 1) {
      [gameBag[0], gameBag[1]] = [gameBag[1], gameBag[0]];
    }
  }
  let g = gameBag.shift();
  if (g === lastGame && gameBag.length) {
    const alt = gameBag.shift();
    gameBag.push(g);
    g = alt;
  }
  lastGame = g;
  return g;
}

function cleanName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function uniqueBotName(used) {
  const first = ["Turbo","Pixel","Ghost","Rapid","Neon","Rocket","Ninja","Quick","Hyper","Frost","Solar","Mango","Panda","Falcon","Viper","Tiger","Comet","Nova","Blitz","Lucky"];
  const second = ["Ace","Leo","Max","Fox","Zed","Milo","Kai","Dash","Rex","Finn","Bolt","Rio","Jax","Wolf","Sky","Jay","Luca","Sam","Ben","Zero"];
  for (let i = 0; i < 200; i++) {
    const n = first[Math.floor(Math.random()*first.length)] +
              second[Math.floor(Math.random()*second.length)] +
              Math.floor(Math.random()*90+10);
    if (!used.has(n)) return n;
  }
  return "CPU" + Math.floor(Math.random()*99999);
}

function addBots() {
  const used = new Set(Object.values(state.players).map(p => p.name));
  for (let i = 0; i < BOT_COUNT; i++) {
    const id = `BOT_${Date.now()}_${i}_${Math.random().toString(36).slice(2,8)}`;
    const name = uniqueBotName(used);
    used.add(name);
    state.players[id] = {
      name,
      isBot: true,
      status: "waiting",
      score: 0,
      roundScore: null,
      liveScore: null,
      finished: false,
      eliminatedRound: null,
      disconnected: false,
    };
  }
}

function playerPublic(p) {
  return {
    name: p.name,
    isBot: !!p.isBot,
    status: p.status,
    score: p.score || 0,
    roundScore: p.roundScore,
    liveScore: p.liveScore,
    finished: !!p.finished,
    eliminatedRound: p.eliminatedRound,
    disconnected: !!p.disconnected,
  };
}

function publicState() {
  const players = {};
  for (const [id,p] of Object.entries(state.players)) players[id] = playerPublic(p);
  return {
    phase: state.phase,
    dropNo: state.dropNo,
    prize: state.prize,
    lobbyDeadline: state.lobbyDeadline,
    round: state.round,
    game: state.game,
    startedAt: state.startedAt,
    players,
    playerCount: Object.keys(players).length,
    humanCount: Object.values(players).filter(p => !p.isBot).length,
    botCount: Object.values(players).filter(p => p.isBot).length,
    activeIds: state.activeIds,
    activeCount: state.activeIds.length,
    roundResults: state.roundResults,
    results: state.results,
  };
}

function emitState() {
  io.emit("state", publicState());
}

function hostAuthorized(socket) {
  return state.hostSockets.has(socket.id);
}

function closeDrop() {
  clearAllTimers();
  const dropNo = state.dropNo;
  const hosts = state.hostSockets;
  state = freshState();
  state.dropNo = dropNo;
  state.hostSockets = hosts;
  emitState();
}

function openLobby() {
  clearAllTimers();
  const dropNo = state.dropNo;
  const hosts = state.hostSockets;
  state = freshState();
  state.dropNo = dropNo;
  state.hostSockets = hosts;
  addBots();
  state.phase = "lobby";
  state.lobbyDeadline = Date.now() + LOBBY_MS;

  timers.lobby = setTimeout(() => {
    if (state.phase !== "lobby") return;
    const humans = Object.values(state.players).filter(p => !p.isBot).length;
    if (humans >= MIN_HUMANS_TO_START) startTournament();
    else closeDrop();
  }, LOBBY_MS + 250);

  emitState();
}

function startTournament() {
  if (state.phase !== "lobby") return false;
  const humanIds = Object.entries(state.players).filter(([,p]) => !p.isBot).map(([id]) => id);
  if (humanIds.length < MIN_HUMANS_TO_START) return false;

  clearTimer("lobby");
  state.activeIds = Object.keys(state.players);
  for (const id of state.activeIds) {
    const p = state.players[id];
    p.status = "alive";
    p.score = 0;
    p.roundScore = null;
    p.liveScore = null;
    p.finished = false;
    p.eliminatedRound = null;
    p.disconnected = false;
  }
  state.round = 1;
  startRoundReveal();
  return true;
}

function startRoundReveal() {
  const humanAlive = state.activeIds.filter(id => state.players[id] && !state.players[id].isBot).length;
  if (humanAlive <= 1 && state.round >= 4) {
    finishTournament();
    return;
  }

  state.game = nextGame();
  state.roundResults = [];

  for (const id of state.activeIds) {
    const p = state.players[id];
    if (!p) continue;
    p.finished = false;
    p.roundScore = null;
    p.liveScore = null;
    p.status = "alive";
  }

  state.phase = "reveal";
  emitState();

  timers.reveal = setTimeout(() => {
    if (state.phase !== "reveal") return;
    state.phase = "playing";
    state.startedAt = Date.now();
    emitState();
    scheduleBots();

    timers.hard = setTimeout(() => {
      if (state.phase !== "playing") return;
      for (const id of state.activeIds) {
        const p = state.players[id];
        if (!p || p.finished) continue;
        p.finished = true;
        p.roundScore = lowerIsBetter(state.game) ? 999999 : -1;
        p.liveScore = p.roundScore;
        if (!p.isBot) p.status = "timeout";
      }
      cutRound();
    }, ROUND_HARD_TIMEOUT_MS);
  }, REVEAL_MS);
}

function botScore(game) {
  if (lowerIsBetter(game)) {
    if (game === "button") return Math.round(20 + Math.random()*1400);
    if (game === "reaction" || game === "stoplight") return Math.round(180 + Math.random()*900);
    return +(Math.random()*180).toFixed(2);
  }
  if (game === "taprush") return Math.round(25 + Math.random()*70);
  if (game === "aim") return Math.round(Math.random()*18);
  if (game === "memory") return Math.round(Math.random()*8);
  if (game === "stack") return Math.round(2 + Math.random()*14);
  if (game === "catcher") return Math.round(Math.random()*18);
  if (game === "balance") return Math.round(1000 + Math.random()*10000);
  return Math.round(Math.random()*14);
}

function scheduleBots() {
  for (const id of state.activeIds) {
    const p = state.players[id];
    if (!p?.isBot) continue;
    const delay = 1200 + Math.random()*6500;
    setTimeout(() => {
      if (state.phase !== "playing" || p.finished || !state.activeIds.includes(id)) return;
      const score = botScore(state.game);
      p.roundScore = score;
      p.liveScore = score;
      p.finished = true;
      emitState();
      if (state.activeIds.every(pid => state.players[pid]?.finished)) cutRound();
    }, delay);
  }
}

function sanitizeScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  if (lowerIsBetter(state.game)) return Math.max(0, Math.min(n, 999999));
  return Math.max(0, Math.min(Math.floor(n), 1000000));
}

function submitScore(id, score) {
  const p = state.players[id];
  if (!p || p.isBot || state.phase !== "playing" || !state.activeIds.includes(id) || p.finished) return;
  const clean = sanitizeScore(score);
  if (clean === null) return;
  p.roundScore = clean;
  p.liveScore = clean;
  p.finished = true;
  emitState();
  if (state.activeIds.every(pid => state.players[pid]?.finished)) cutRound();
}

function updateLiveScore(id, score) {
  const p = state.players[id];
  if (!p || p.isBot || state.phase !== "playing" || !state.activeIds.includes(id) || p.finished) return;
  const clean = sanitizeScore(score);
  if (clean === null) return;
  p.liveScore = clean;
  emitState();
}

function sortedRoundRows() {
  const rows = state.activeIds.map(id => ({
    id,
    name: state.players[id].name,
    isBot: state.players[id].isBot,
    score: state.players[id].roundScore,
  }));

  rows.sort((a,b) => {
    const av = a.score ?? (lowerIsBetter(state.game) ? 999999 : -1);
    const bv = b.score ?? (lowerIsBetter(state.game) ? 999999 : -1);
    if (av !== bv) return lowerIsBetter(state.game) ? av-bv : bv-av;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

function cutRound() {
  if (state.phase !== "playing") return;
  clearTimer("hard");

  const rows = sortedRoundRows();

  if (state.round <= 3) {
    const humanIds = rows.filter(r => !r.isBot).map(r => r.id);
    const botIds = rows.filter(r => r.isBot).map(r => r.id);

    let botsToEliminate = 0;
    if (state.round === 1) botsToEliminate = Math.min(3, botIds.length);       // 10 -> 7
    else if (state.round === 2) botsToEliminate = Math.min(3, botIds.length);  // 7 -> 4
    else botsToEliminate = botIds.length;                                      // 4 -> 0

    const shuffled = botIds.slice().sort(() => Math.random() - 0.5);
    const eliminatedSet = new Set(shuffled.slice(0, botsToEliminate));
    const survivorIds = [...humanIds, ...botIds.filter(id => !eliminatedSet.has(id))];

    for (const id of survivorIds) {
      const p = state.players[id];
      p.status = "survived";
      p.score = (p.score || 0) + 1;
    }
    for (const id of eliminatedSet) {
      const p = state.players[id];
      p.status = "eliminated";
      p.eliminatedRound = state.round;
    }

    state.activeIds = survivorIds;
    state.roundResults = rows.map((r,i) => ({
      ...r,
      rank: i+1,
      survived: survivorIds.includes(r.id),
      eliminated: eliminatedSet.has(r.id),
      protected: !r.isBot,
    }));
  } else {
    const humanRows = rows.filter(r => !r.isBot);
    if (humanRows.length <= 1) {
      finishTournament();
      return;
    }

    const surviveCount = Math.max(1, Math.ceil(humanRows.length / 2));
    const survivorRows = humanRows.slice(0, surviveCount);
    const survivorSet = new Set(survivorRows.map(r => r.id));

    for (const r of humanRows) {
      const p = state.players[r.id];
      if (survivorSet.has(r.id)) {
        p.status = "survived";
        p.score = (p.score || 0) + 1;
      } else {
        p.status = "eliminated";
        p.eliminatedRound = state.round;
      }
    }

    state.activeIds = survivorRows.map(r => r.id);
    state.roundResults = humanRows.map((r,i) => ({
      ...r,
      rank: i+1,
      survived: survivorSet.has(r.id),
      eliminated: !survivorSet.has(r.id),
      protected: false,
    }));
  }

  state.phase = "cut";
  emitState();

  timers.cut = setTimeout(() => {
    const humanAlive = state.activeIds.filter(id => state.players[id] && !state.players[id].isBot).length;
    if (humanAlive <= 1 && state.round >= 3) finishTournament();
    else {
      state.round += 1;
      startRoundReveal();
    }
  }, CUT_SCREEN_MS);
}

function finishTournament() {
  clearAllTimers();

  const humanAlive = state.activeIds.filter(id => state.players[id] && !state.players[id].isBot);
  let winnerId = humanAlive[0] || null;

  if (!winnerId) {
    const possible = state.roundResults.find(r => !r.isBot && r.survived);
    winnerId = possible?.id || null;
  }

  if (winnerId && state.players[winnerId]) state.players[winnerId].status = "winner";

  state.results = Object.entries(state.players)
    .filter(([,p]) => !p.isBot)
    .map(([id,p]) => ({
      id,
      name: p.name,
      status: p.status,
      roundsSurvived: p.score || 0,
      eliminatedRound: p.eliminatedRound,
    }))
    .sort((a,b) => {
      if (a.status === "winner") return -1;
      if (b.status === "winner") return 1;
      if (b.roundsSurvived !== a.roundsSurvived) return b.roundsSurvived - a.roundsSurvived;
      return a.name.localeCompare(b.name);
    });

  state.phase = "finished";
  emitState();
}

io.on("connection", socket => {
  socket.emit("state", publicState());

  socket.on("host-auth", ({ key }) => {
    if (String(key || "") !== HOST_KEY) {
      socket.emit("host-auth-result", { ok: false });
      return;
    }
    state.hostSockets.add(socket.id);
    socket.emit("host-auth-result", { ok: true });
  });

  socket.on("host-open", () => {
    if (!hostAuthorized(socket) || !["closed","finished"].includes(state.phase)) return;
    if (state.phase === "finished") state.dropNo += 1;
    openLobby();
  });

  socket.on("host-start", () => {
    if (!hostAuthorized(socket) || state.phase !== "lobby") return;
    const humans = Object.values(state.players).filter(p => !p.isBot).length;
    if (humans < MIN_HUMANS_TO_START) {
      socket.emit("host-message", `Need at least ${MIN_HUMANS_TO_START} human players.`);
      return;
    }
    startTournament();
  });

  socket.on("host-close", () => {
    if (hostAuthorized(socket)) closeDrop();
  });

  socket.on("join", ({ name }) => {
    const clean = cleanName(name);
    if (!clean) {
      socket.emit("join-error", "Choose a username.");
      return;
    }
    if (state.phase !== "lobby") {
      socket.emit("join-error", "The Drop is not open.");
      return;
    }
    const duplicate = Object.values(state.players).some(p => p.name.toLowerCase() === clean.toLowerCase());
    if (duplicate) {
      socket.emit("join-error", "That username is already taken in this Drop.");
      return;
    }

    state.players[socket.id] = {
      name: clean,
      isBot: false,
      status: "waiting",
      score: 0,
      roundScore: null,
      liveScore: null,
      finished: false,
      eliminatedRound: null,
      disconnected: false,
    };

    socket.emit("joined", { id: socket.id });
    emitState();
  });

  socket.on("result", ({ score }) => submitScore(socket.id, score));
  socket.on("live-score", ({ score }) => updateLiveScore(socket.id, score));

  socket.on("disconnect", () => {
    state.hostSockets.delete(socket.id);
    const p = state.players[socket.id];
    if (!p) return;

    if (state.phase === "lobby") {
      delete state.players[socket.id];
      emitState();
      return;
    }

    if (state.activeIds.includes(socket.id)) {
      p.disconnected = true;
      p.finished = true;
      p.roundScore = lowerIsBetter(state.game) ? 999999 : -1;
      p.liveScore = p.roundScore;
      p.status = "disconnected";
      p.eliminatedRound = state.round;

      if (state.phase === "playing" && state.activeIds.every(pid => state.players[pid]?.finished)) {
        cutRound();
      } else {
        emitState();
      }
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("DROP V3.1 Basket + Faster Stack ready");
});
