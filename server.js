
const express=require("express"),http=require("http"),path=require("path");
const {Server}=require("socket.io");
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));

const HOST_KEY=process.env.HOST_KEY || "DROPADMIN";
const MIN_BOTS=5;
const LOBBY_MS=180000;
const GAMES=["button","stack","flappy","reaction","center","taprush","catcher","memory","slider","balance","aim","stoplight"];

let gameBag=[],lastGame=null;
let timers={lobby:null,reveal:null,cut:null,hard:null};

let s={
  phase:"closed",
  players:{},
  lobbyDeadline:0,
  game:null,
  startedAt:0,
  round:0,
  activeIds:[],
  roundResults:[],
  results:[],
  dropNo:1,
  prize:10,
  hostSockets:{}
};

function clearTimers(){
  for(const k of Object.keys(timers)){
    clearTimeout(timers[k]); clearInterval(timers[k]); timers[k]=null;
  }
}
function nextGame(){
  if(!gameBag.length){
    gameBag=GAMES.slice().sort(()=>Math.random()-.5);
    if(lastGame && gameBag[0]===lastGame && gameBag.length>1){
      [gameBag[0],gameBag[1]]=[gameBag[1],gameBag[0]];
    }
  }
  let g=gameBag.shift();
  if(g===lastGame && gameBag.length){
    const alt=gameBag.shift(); gameBag.push(g); g=alt;
  }
  lastGame=g; return g;
}
function randomBotName(used){
  const a=["Turbo","Pixel","Goal","Rapid","Lucky","Mega","Neon","Rocket","Ghost","Ninja","Quick","Hyper","Frost","Solar","Mango","Panda","Falcon","Viper","Tiger","Comet"];
  const b=["Ace","Leo","Max","Fox","Zed","Milo","Kai","Nova","Dash","Rex","Finn","Bolt","Rio","Jax","Wolf","Sky","Jay","Luca","Sam","Ben"];
  for(let i=0;i<100;i++){
    const n=a[Math.floor(Math.random()*a.length)]+b[Math.floor(Math.random()*b.length)]+Math.floor(Math.random()*90+10);
    if(!used.has(n)) return n;
  }
  return "Bot"+Math.floor(Math.random()*99999);
}
function addBots(){
  const used=new Set(Object.values(s.players).map(p=>p.name));
  for(let i=0;i<MIN_BOTS;i++){
    const id="BOT_"+Date.now()+"_"+i+"_"+Math.random().toString(36).slice(2,8);
    const name=randomBotName(used); used.add(name);
    s.players[id]={name,isBot:true,status:"waiting",score:0,roundScore:null,finished:false,liveScore:null};
  }
}
function publicState(){
  const ps={};
  for(const [id,p] of Object.entries(s.players)){
    ps[id]={name:p.name,isBot:!!p.isBot,status:p.status,score:p.score||0,roundScore:p.roundScore,finished:!!p.finished,liveScore:p.liveScore};
  }
  return {
    phase:s.phase,players:ps,playerCount:Object.keys(ps).length,
    humanCount:Object.values(ps).filter(p=>!p.isBot).length,
    botCount:Object.values(ps).filter(p=>p.isBot).length,
    lobbyDeadline:s.lobbyDeadline,game:s.game,startedAt:s.startedAt,
    round:s.round,activeIds:s.activeIds,activeCount:s.activeIds.length,
    roundResults:s.roundResults,results:s.results,dropNo:s.dropNo,prize:s.prize
  };
}
const emit=()=>io.emit("state",publicState());
const isHost=sock=>!!s.hostSockets[sock.id];
const lowerIsBetter=g=>["button","reaction","center","slider","stoplight"].includes(g);

function resetClosed(){
  clearTimers();
  s.phase="closed";s.players={};s.lobbyDeadline=0;s.game=null;s.startedAt=0;s.round=0;s.activeIds=[];s.roundResults=[];s.results=[];
  emit();
}
function openLobby(){
  clearTimers();
  s.players={};s.activeIds=[];s.roundResults=[];s.results=[];s.round=0;s.game=null;
  addBots();
  s.phase="lobby";s.lobbyDeadline=Date.now()+LOBBY_MS;
  timers.lobby=setTimeout(()=>{
    if(s.phase!=="lobby") return;
    const humans=Object.values(s.players).filter(p=>!p.isBot).length;
    if(humans>=2) startTournament(); else resetClosed();
  },LOBBY_MS+100);
  emit();
}
function startTournament(){
  if(s.phase!=="lobby") return;
  const humans=Object.values(s.players).filter(p=>!p.isBot).length;
  if(humans<2) return;
  clearTimeout(timers.lobby);
  s.activeIds=Object.keys(s.players);
  for(const id of s.activeIds){
    const p=s.players[id]; p.status="alive";p.score=0;p.roundScore=null;p.finished=false;p.liveScore=null;
  }
  s.round=1; startRoundReveal();
}
function startRoundReveal(){
  const humanAlive=s.activeIds.filter(id=>s.players[id]&&!s.players[id].isBot).length;
  if(humanAlive<=1 && s.round>=4){finishTournament();return}
  s.game=nextGame(); s.roundResults=[];
  for(const id of s.activeIds){
    const p=s.players[id]; if(!p)continue;
    p.finished=false;p.roundScore=null;p.liveScore=null;p.status="alive";
  }
  s.phase="reveal"; emit();
  timers.reveal=setTimeout(()=>{
    s.phase="playing";s.startedAt=Date.now();emit();scheduleBots();
    clearTimeout(timers.hard);
    timers.hard=setTimeout(()=>{
      if(s.phase!=="playing")return;
      for(const id of s.activeIds){
        const p=s.players[id]; if(!p||p.finished)continue;
        p.finished=true;p.roundScore=lowerIsBetter(s.game)?99999:-1;p.liveScore=p.roundScore;
        if(!p.isBot)p.status="timeout";
      }
      cutRound();
    },26000);
  },3200);
}
function botScore(){
  if(lowerIsBetter(s.game)){
    if(s.game==="button")return Math.round(20+Math.random()*1200);
    if(s.game==="reaction"||s.game==="stoplight")return Math.round(180+Math.random()*850);
    return +(Math.random()*180).toFixed(2);
  }
  if(s.game==="taprush")return Math.round(25+Math.random()*65);
  if(s.game==="aim")return Math.round(Math.random()*18);
  if(s.game==="memory")return Math.round(Math.random()*8);
  if(s.game==="stack")return Math.round(2+Math.random()*14);
  if(s.game==="catcher")return Math.round(Math.random()*16);
  if(s.game==="balance")return Math.round(1000+Math.random()*10000);
  return Math.round(Math.random()*12);
}
function scheduleBots(){
  for(const id of s.activeIds){
    const p=s.players[id]; if(!p?.isBot)continue;
    const delay=1200+Math.random()*6000;
    setTimeout(()=>{
      if(s.phase!=="playing"||p.finished||!s.activeIds.includes(id))return;
      const score=botScore();p.liveScore=score;p.roundScore=score;p.finished=true;emit();
      if(s.activeIds.every(pid=>s.players[pid]?.finished))cutRound();
    },delay);
  }
}
function sanitizeScore(score){
  score=Number(score); if(!Number.isFinite(score))return null;
  if(lowerIsBetter(s.game))return Math.max(0,Math.min(score,100000));
  return Math.max(0,Math.min(Math.floor(score),1000000));
}
function submit(id,score){
  const p=s.players[id];
  if(!p||p.isBot||s.phase!=="playing"||!s.activeIds.includes(id)||p.finished)return;
  score=sanitizeScore(score);if(score===null)return;
  p.roundScore=score;p.liveScore=score;p.finished=true;emit();
  if(s.activeIds.every(pid=>s.players[pid]?.finished))cutRound();
}
function liveScore(id,score){
  const p=s.players[id];
  if(!p||p.isBot||s.phase!=="playing"||!s.activeIds.includes(id)||p.finished)return;
  score=sanitizeScore(score);if(score===null)return;
  p.liveScore=score;emit();
}
function sortedRoundRows(){
  const rows=s.activeIds.map(id=>({id,name:s.players[id].name,isBot:s.players[id].isBot,score:s.players[id].roundScore}));
  if(lowerIsBetter(s.game))rows.sort((a,b)=>(a.score??999999)-(b.score??999999)||a.name.localeCompare(b.name));
  else rows.sort((a,b)=>(b.score??-1)-(a.score??-1)||a.name.localeCompare(b.name));
  return rows;
}
function cutRound(){
  if(s.phase!=="playing")return;
  clearTimeout(timers.hard);
  const rows=sortedRoundRows();

  if(s.round<=3){
    // Rounds 1–3 are protected for humans.
    // Bots disappear progressively so Round 4 begins with humans only.
    const humanIds=rows.filter(r=>!r.isBot).map(r=>r.id);
    const botIds=rows.filter(r=>r.isBot).map(r=>r.id);

    let botsToEliminate=0;
    if(s.round===1){
      // Eliminate about one third of the bots.
      botsToEliminate=Math.max(1,Math.ceil(botIds.length/3));
    }else if(s.round===2){
      // Eliminate about half of the bots that remain.
      botsToEliminate=Math.max(1,Math.ceil(botIds.length/2));
    }else{
      // Round 3 removes every remaining bot.
      botsToEliminate=botIds.length;
    }

    const shuffled=botIds.slice().sort(()=>Math.random()-.5);
    const eliminatedBots=new Set(shuffled.slice(0,botsToEliminate));
    const survivors=[...humanIds,...botIds.filter(id=>!eliminatedBots.has(id))];

    for(const id of survivors){
      s.players[id].status="survived";
      s.players[id].score=(s.players[id].score||0)+1;
    }
    for(const id of eliminatedBots)s.players[id].status="eliminated";

    s.activeIds=survivors;
    s.roundResults=rows.map((r,i)=>({
      ...r,
      rank:i+1,
      survived:survivors.includes(r.id),
      eliminated:eliminatedBots.has(r.id),
      protected:!r.isBot
    }));
  }else{
    const humanRows=rows.filter(r=>!r.isBot);
    if(humanRows.length<=1){finishTournament();return}
    const surviveCount=Math.max(1,Math.ceil(humanRows.length/2));
    const survivorRows=humanRows.slice(0,surviveCount);
    const survivorIds=new Set(survivorRows.map(r=>r.id));
    for(const r of humanRows){
      const p=s.players[r.id];
      if(survivorIds.has(r.id)){p.status="survived";p.score=(p.score||0)+1}
      else p.status="eliminated";
    }
    s.activeIds=survivorRows.map(r=>r.id);
    s.roundResults=humanRows.map((r,i)=>({...r,rank:i+1,survived:survivorIds.has(r.id),eliminated:!survivorIds.has(r.id),protected:false}));
  }

  s.phase="cut";emit();
  timers.cut=setTimeout(()=>{
    const humans=s.activeIds.filter(id=>s.players[id]&&!s.players[id].isBot).length;
    if(humans<=1 && s.round>=3)finishTournament();
    else{s.round+=1;startRoundReveal()}
  },6000);
}
function finishTournament(){
  clearTimers();s.phase="finished";
  const humanAlive=s.activeIds.filter(id=>s.players[id]&&!s.players[id].isBot);
  const winnerId=humanAlive[0]||s.roundResults.find(r=>!r.isBot&&r.survived)?.id||null;
  if(winnerId&&s.players[winnerId])s.players[winnerId].status="winner";
  s.results=Object.entries(s.players).filter(([id,p])=>!p.isBot).map(([id,p])=>({id,name:p.name,status:p.status,roundsSurvived:p.score||0}))
    .sort((a,b)=>a.status==="winner"?-1:b.status==="winner"?1:b.roundsSurvived-a.roundsSurvived||a.name.localeCompare(b.name));
  emit();
}

io.on("connection",sock=>{
  sock.emit("state",publicState());
  sock.on("host-auth",({key})=>{
    if(String(key||"")!==HOST_KEY)return sock.emit("host-auth-result",{ok:false});
    s.hostSockets[sock.id]=true;sock.emit("host-auth-result",{ok:true});sock.emit("state",publicState());
  });
  sock.on("host-open",()=>{
    if(!isHost(sock)||!["closed","finished"].includes(s.phase))return;
    if(s.phase==="finished")s.dropNo+=1;
    openLobby();
  });
  sock.on("host-start",()=>{
    if(!isHost(sock)||s.phase!=="lobby")return;
    const humans=Object.values(s.players).filter(p=>!p.isBot).length;
    if(humans<2)return sock.emit("host-message","Need at least 2 human players.");
    startTournament();
  });
  sock.on("host-close",()=>{if(isHost(sock))resetClosed()});
  sock.on("join",({name})=>{
    name=String(name||"").trim().slice(0,24);
    if(!name)return sock.emit("join-error","Choose a username.");
    if(s.phase!=="lobby")return sock.emit("join-error","The Drop is not open.");
    s.players[sock.id]={name,isBot:false,status:"waiting",score:0,roundScore:null,finished:false,liveScore:null};
    sock.emit("joined",{id:sock.id});emit();
  });
  sock.on("result",({score})=>submit(sock.id,score));
  sock.on("live-score",({score})=>liveScore(sock.id,score));
  sock.on("disconnect",()=>{
    delete s.hostSockets[sock.id];
    const p=s.players[sock.id];if(!p)return;
    if(s.phase==="lobby")delete s.players[sock.id];
    else if(s.activeIds.includes(sock.id)){
      p.finished=true;p.roundScore=lowerIsBetter(s.game)?99999:-1;p.liveScore=p.roundScore;p.status="disconnected";
      if(s.phase==="playing"&&s.activeIds.every(pid=>s.players[pid]?.finished))cutRound();
    }
    emit();
  });
});
server.listen(process.env.PORT||3000,()=>console.log("DROP V1.9 Progressive Difficulty ready"));
