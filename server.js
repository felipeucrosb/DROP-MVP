
const express=require("express"),http=require("http"),path=require("path");
const {Server}=require("socket.io");
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));

const HOST_KEY=process.env.HOST_KEY || "DROPADMIN";
const GAMES=["button","stack","flappy","reaction","center","taprush","catcher","memory","slider","balance","aim","stoplight"];
let gameBag=[],lastGame=null;

let s={
  phase:"closed", // closed | lobby | reveal | playing | cut | finished
  players:{},
  lobbyDeadline:0,
  game:null,
  startedAt:0,
  round:0,
  activeIds:[],
  results:[],
  roundResults:[],
  dropNo:1,
  prize:1000,
  hostSockets:{}
};
let lobbyTimer=null,revealTimer=null,cutTimer=null,roundHardTimer=null;

const allPlayers=()=>Object.entries(s.players).map(([id,p])=>({id,...p}));
const activePlayers=()=>s.activeIds.map(id=>[id,s.players[id]]).filter(x=>x[1]);

function nextGame(){
  // Shuffle-bag: use every game once before repeating.
  // When refilling, ensure the first game is not the same as the previous game.
  if(!gameBag.length){
    gameBag=GAMES.slice().sort(()=>Math.random()-.5);
    if(lastGame && gameBag[0]===lastGame && gameBag.length>1){
      [gameBag[0],gameBag[1]]=[gameBag[1],gameBag[0]];
    }
  }
  let g=gameBag.shift();
  if(g===lastGame && gameBag.length){
    const alt=gameBag.shift();
    gameBag.push(g);
    g=alt;
  }
  lastGame=g;
  return g;
}

function publicState(){
  const players={};
  for(const [id,p] of Object.entries(s.players)){
    players[id]={
      name:p.name,
      status:p.status,
      score:p.score,
      roundScore:p.roundScore
    };
  }
  return {
    phase:s.phase,
    players,
    playerCount:Object.keys(players).length,
    lobbyDeadline:s.lobbyDeadline,
    game:s.game,
    startedAt:s.startedAt,
    round:s.round,
    activeIds:s.activeIds,
    activeCount:s.activeIds.length,
    results:s.results,
    roundResults:s.roundResults,
    dropNo:s.dropNo,
    prize:s.prize
  };
}
const emit=()=>io.emit("state",publicState());

function clearTimers(){clearTimeout(lobbyTimer);clearTimeout(revealTimer);clearTimeout(cutTimer);clearTimeout(roundHardTimer)}

function resetForClosed(){
  clearTimers();
  s.phase="closed";
  s.players={};
  s.lobbyDeadline=0;
  s.game=null;
  s.startedAt=0;
  s.round=0;
  s.activeIds=[];
  s.results=[];
  s.roundResults=[];
  emit();
}
function openLobby(){
  clearTimers();
  s.players={};
  s.activeIds=[];
  s.results=[];
  s.roundResults=[];
  s.round=0;
  s.game=null;
  s.phase="lobby";
  s.lobbyDeadline=Date.now()+60000;
  lobbyTimer=setTimeout(()=>{
    if(s.phase==="lobby"){
      if(Object.keys(s.players).length>0) startTournament();
      else resetForClosed();
    }
  },60100);
  emit();
}
function startTournament(){
  if(s.phase!=="lobby" || !Object.keys(s.players).length)return;
  clearTimeout(lobbyTimer);
  s.activeIds=Object.keys(s.players);
  for(const id of s.activeIds){
    s.players[id].status="alive";
    s.players[id].score=0;
    s.players[id].roundScore=null;
    s.players[id].finished=false;
  }
  s.round=1;
  startRoundReveal();
}
function startRoundReveal(){
  if(s.activeIds.length<=1){finishTournament();return}
  s.game=nextGame();
  s.roundResults=[];
  for(const id of s.activeIds){
    if(s.players[id]){
      s.players[id].finished=false;
      s.players[id].roundScore=null;
      s.players[id].status="alive";
    }
  }
  s.phase="reveal";
  emit();
  clearTimeout(revealTimer);
  revealTimer=setTimeout(()=>{
    s.phase="playing";
    s.startedAt=Date.now();
    emit();

    // HARD ROUND DEADLINE:
    // If any browser fails to submit (lost focus, mobile sleep, game bug, disconnect),
    // automatically assign the worst score and advance the tournament.
    clearTimeout(roundHardTimer);
    roundHardTimer=setTimeout(()=>{
      if(s.phase!=="playing")return;
      for(const id of s.activeIds){
        const p=s.players[id];
        if(!p || p.finished)continue;
        p.finished=true;
        // Worst possible score depends on the scoring direction.
        p.roundScore=lowerIsBetter(s.game)?99999:-1;
        if(p.status!=="disconnected")p.status="timeout";
      }
      cutRound();
    },22000);
  },3200);
}
function lowerIsBetter(game){
  return ["button","reaction","center","slider","stoplight"].includes(game);
}
function sanitizeScore(score){
  score=Number(score);
  if(!Number.isFinite(score))return null;
  if(lowerIsBetter(s.game))return Math.max(0,Math.min(score,100000));
  return Math.max(0,Math.min(Math.floor(score),1000000));
}
function submit(id,score){
  const p=s.players[id];
  if(!p || s.phase!=="playing" || !s.activeIds.includes(id) || p.finished)return;
  score=sanitizeScore(score);if(score===null)return;
  p.roundScore=score;
  p.finished=true;
  emit();
  const everyone=s.activeIds.every(pid=>s.players[pid]?.finished);
  if(everyone)cutRound();
}
function cutRound(){
  if(s.phase!=="playing")return;
  clearTimeout(roundHardTimer);
  const rows=s.activeIds.map(id=>({
    id,
    name:s.players[id].name,
    score:s.players[id].roundScore
  }));
  if(lowerIsBetter(s.game)) rows.sort((a,b)=>(a.score??999999)-(b.score??999999)||a.name.localeCompare(b.name));
  else rows.sort((a,b)=>(b.score??-1)-(a.score??-1)||a.name.localeCompare(b.name));

  const surviveCount=Math.max(1,Math.ceil(rows.length/2));
  const survivors=rows.slice(0,surviveCount);
  const eliminated=rows.slice(surviveCount);

  for(const r of survivors){
    s.players[r.id].status="survived";
    s.players[r.id].score=(s.players[r.id].score||0)+1;
  }
  for(const r of eliminated)s.players[r.id].status="eliminated";

  s.roundResults=rows.map((r,i)=>({...r,rank:i+1,survived:i<surviveCount}));
  s.activeIds=survivors.map(r=>r.id);
  s.phase="cut";
  emit();

  clearTimeout(cutTimer);
  cutTimer=setTimeout(()=>{
    if(s.activeIds.length<=1)finishTournament();
    else{
      s.round+=1;
      startRoundReveal();
    }
  },5500);
}
function finishTournament(){
  clearTimers();
  s.phase="finished";
  const winnerId=s.activeIds[0] || s.roundResults?.[0]?.id || null;
  if(winnerId && s.players[winnerId])s.players[winnerId].status="winner";

  // Final order: winner first, then most recently eliminated, then others.
  const eliminationRank={};
  for(const [id,p] of Object.entries(s.players)){
    eliminationRank[id]=p.status==="winner"?9999:(p.score||0);
  }
  s.results=Object.entries(s.players).map(([id,p])=>({
    id,name:p.name,status:p.status,roundsSurvived:p.score||0
  })).sort((a,b)=>{
    if(a.status==="winner")return -1;
    if(b.status==="winner")return 1;
    return b.roundsSurvived-a.roundsSurvived || a.name.localeCompare(b.name);
  });
  emit();
}
function isHost(sock){return !!s.hostSockets[sock.id]}

io.on("connection",sock=>{
  sock.emit("state",publicState());

  sock.on("host-auth",({key})=>{
    if(String(key||"")!==HOST_KEY)return sock.emit("host-auth-result",{ok:false});
    s.hostSockets[sock.id]=true;
    sock.emit("host-auth-result",{ok:true});
    sock.emit("state",publicState());
  });

  sock.on("host-open",()=>{
    if(!isHost(sock) || !["closed","finished"].includes(s.phase))return;
    if(s.phase==="finished")s.dropNo+=1;
    openLobby();
  });

  sock.on("host-start",()=>{
    if(isHost(sock) && s.phase==="lobby" && Object.keys(s.players).length>0)startTournament();
  });

  sock.on("host-close",()=>{
    if(isHost(sock))resetForClosed();
  });

  sock.on("join",({name})=>{
    name=String(name||"").trim().slice(0,24);
    if(!name)return sock.emit("join-error","Choose a username.");
    if(s.phase!=="lobby")return sock.emit("join-error","The Drop is not open yet.");
    s.players[sock.id]={name,status:"waiting",score:0,roundScore:null,finished:false};
    sock.emit("joined",{id:sock.id});
    emit();
  });

  sock.on("result",({score})=>submit(sock.id,score));

  sock.on("disconnect",()=>{
    delete s.hostSockets[sock.id];
    if(s.players[sock.id]){
      // During lobby remove disconnected players.
      if(s.phase==="lobby"){
        delete s.players[sock.id];
      }else if(s.activeIds.includes(sock.id)){
        // During tournament disconnected active players get worst possible result.
        const p=s.players[sock.id];
        p.finished=true;
        p.roundScore=lowerIsBetter(s.game)?99999:-1;
        p.status="disconnected";
        if(s.phase==="playing" && s.activeIds.every(pid=>s.players[pid]?.finished))cutRound();
      }
    }
    emit();
  });
});

server.listen(process.env.PORT||3000,()=>console.log("DROP Survivor V1.3 ready"));
