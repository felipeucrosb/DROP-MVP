
const socket = io();
const $ = id => document.getElementById(id);

let me = null;
let state = null;
let isHost = false;
let currentGameToken = null;
let localDone = false;
let lobbyTimer = null;

const titles = {
  button:"THE BUTTON", stack:"STACK", flappy:"FLAPPY", reaction:"REACTION",
  center:"THE CENTER", taprush:"TAP RUSH", catcher:"CATCH", memory:"MEMORY",
  slider:"THE LINE", balance:"BASKET", aim:"AIM", stoplight:"GREEN LIGHT"
};

const rules = {
  button:"Stop as close to 5.000 seconds as possible.",
  stack:"Build the tallest stack. One miss and you're out.",
  flappy:"Tap to fly through the gaps. One life.",
  reaction:"Wait for GO. Tap as fast as possible.",
  center:"Stop the moving dot exactly in the center.",
  taprush:"Tap as many times as possible in 10 seconds.",
  catcher:"Move the basket and catch as many drops as possible.",
  memory:"Repeat the growing sequence for as long as you can.",
  slider:"Stop the moving line as close to the target as possible.",
  balance:"Drag the basket left and right to catch as many falling balls as possible.",
  aim:"Hit as many targets as possible in 12 seconds.",
  stoplight:"Tap the instant the light turns green."
};

const tutorials = {
  button:["⏱","Hold and release as close to 5.000 seconds as possible."],
  stack:["▰","Tap to drop each moving block."],
  flappy:["●","Tap to flap through the gaps."],
  reaction:["⚡","Wait for GO, then tap immediately."],
  center:["◎","Stop the moving dot in the center."],
  taprush:["☝","Tap the zone as fast as you can."],
  catcher:["⌄","Move the basket to catch falling dots."],
  memory:["◆","Watch the sequence, then repeat it."],
  slider:["│","Stop the line on the target."],
  balance:["🧺","Drag the basket left and right to catch the falling balls."],
  aim:["⊙","Hit every target before time runs out."],
  stoplight:["●","Wait on red. Tap on green."]
};

const screens = ["home","lobby","reveal","game","wait","cut","spectate","finished"];
function show(id){screens.forEach(x=>$(x).classList.toggle("hidden",x!==id))}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

$("joinBtn").onclick = () => socket.emit("join",{name:$("username").value});
$("adminToggle").onclick = () => $("adminPanel").classList.toggle("hidden");
$("authHost").onclick = () => socket.emit("host-auth",{key:$("hostKey").value});
$("openDrop").onclick = () => socket.emit("host-open");
$("startDrop").onclick = () => socket.emit("host-start");
$("closeDrop").onclick = () => socket.emit("host-close");

socket.on("joined", d => { me = d.id; });
socket.on("join-error", msg => $("error").textContent = msg);
socket.on("host-message", msg => $("hostMsg").textContent = msg);
socket.on("host-auth-result", d => {
  isHost = !!d.ok;
  $("hostMsg").textContent = d.ok ? "HOST UNLOCKED" : "Wrong host key";
  renderHostControls();
});
socket.on("state", s => {
  state = s;
  render();
  renderHostControls();
});

function renderHostControls(){
  if(!state)return;
  $("openDrop").classList.toggle("hidden", !isHost || !["closed","finished"].includes(state.phase));
  $("startDrop").classList.toggle("hidden", !isHost || state.phase!=="lobby");
  $("closeDrop").classList.toggle("hidden", !isHost || state.phase==="closed");
}

function joinedPlayer(){
  return me && state?.players?.[me] ? state.players[me] : null;
}

function render(){
  if(!state)return;
  $("dropNo").textContent = `DROP #${state.dropNo}`;
  $("waitingCount").textContent = state.playerCount;

  const p = joinedPlayer();

  if(state.phase==="closed"){
    show("home");
    $("homeTitle").textContent="The Drop is closed.";
    $("homeCopy").textContent="Wait for the host to open the next Drop.";
    $("joinBox").classList.add("hidden");
    return;
  }

  if(state.phase==="lobby"){
    if(!p){
      show("home");
      $("homeTitle").textContent=`$${state.prize} Drop is OPEN.`;
      $("homeCopy").textContent="You have 3 minutes. Enter now.";
      $("joinBox").classList.remove("hidden");
      return;
    }
    show("lobby");
    $("lobbyTotal").textContent=state.playerCount;
    $("humanCount").textContent=state.humanCount;
    $("botCount").textContent=state.botCount;
    $("playerChips").innerHTML=Object.values(state.players).map(x=>`<span class="chip ${x.isBot?"botchip":""}">@${esc(x.name)}${x.isBot?" · CPU":""}</span>`).join("");
    runLobbyClock();
    return;
  }

  if(!p){
    show("home");
    $("homeTitle").textContent="This Drop already started.";
    $("homeCopy").textContent="Wait for the next one.";
    $("joinBox").classList.add("hidden");
    return;
  }

  if(state.phase==="reveal"){
    if(["eliminated","disconnected"].includes(p.status)){renderSpectator();return}
    show("reveal");
    $("revealRound").textContent=state.round;
    $("revealAlive").textContent=state.activeCount;
    const d=DropGames.difficultyForRound(state.round);
    $("difficulty").textContent=d.name;
    $("difficulty").className = d.name==="EASY"?"diffEasy":d.name==="MEDIUM"?"diffMedium":d.name==="HARD"?"diffHard":"diffExtreme";
    $("protectedMsg").textContent=state.round<=3?"HUMANS ARE SAFE · CPU ELIMINATIONS ONLY":"TOP 50% SURVIVE";
    $("gameName").textContent=titles[state.game]||state.game;
    $("gameRule").textContent=rules[state.game]||"";
    return;
  }

  if(state.phase==="playing"){
    if(!state.activeIds.includes(me)){renderSpectator();return}
    if(p.finished){show("wait");return}
    show("game");
    startGame();
    return;
  }

  if(state.phase==="cut"){
    renderCut();
    return;
  }

  if(state.phase==="finished"){
    renderFinal();
    return;
  }
}

function runLobbyClock(){
  clearInterval(lobbyTimer);
  lobbyTimer=setInterval(()=>{
    if(!state||state.phase!=="lobby"){clearInterval(lobbyTimer);return}
    const n=Math.max(0,Math.ceil((state.lobbyDeadline-Date.now())/1000));
    $("lobbyTimer").textContent=String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
  },200);
}

function tutorialThenStart(game, cb){
  const info=tutorials[game]||["●","Get ready."];
  let n=3,started=false;
  $("area").innerHTML=`<div><div class="instruction">${esc(info[1])}</div><div class="huge" id="inlineCountdown">3</div></div>`;
  const launch=()=>{
    if(started)return;
    started=true;
    try{ cb(); }
    catch(err){
      console.error("Game startup error",game,err);
      $("area").innerHTML=`<div><h2 style="color:#ff6259">GAME ERROR</h2><p class="mini">Stay on this page. The round will advance automatically.</p></div>`;
      setTimeout(()=>submitResult(0,"Game load error"),1000);
    }
  };
  const iv=setInterval(()=>{
    n--;
    const el=$("inlineCountdown");
    if(!el){clearInterval(iv);launch();return}
    if(n>0){el.textContent=n;return}
    if(n===0){el.textContent="GO!";return}
    clearInterval(iv);launch();
  },650);
  setTimeout(()=>{clearInterval(iv);launch()},3000);
}

function startGame(){
  const token=`${state.startedAt}-${state.round}-${state.game}`;
  if(currentGameToken===token)return;
  currentGameToken=token;
  localDone=false;
  $("gameRound").textContent=state.round;
  $("gameLabel").textContent=titles[state.game]||state.game;
  $("aliveCount").textContent=state.activeCount;
  $("gameStatus").textContent="CONNECTED";

  const starter=DropGames.registry[state.game];
  tutorialThenStart(state.game,()=>starter({
    area:$("area"),
    round:state.round,
    submit:submitResult,
    live:score=>socket.emit("live-score",{score})
  }));
}

function submitResult(score,label){
  if(localDone)return;
  localDone=true;
  socket.emit("result",{score});
  show("wait");
  $("scoreText").textContent=label;
}

function renderCut(){
  show("cut");
  $("cutRound").textContent=state.round;

  const survivors=Object.entries(state.players)
    .filter(([id])=>state.activeIds.includes(id))
    .map(([id,p])=>({id,...p}))
    .sort((a,b)=>{
      if(a.isBot!==b.isBot)return a.isBot?1:-1;
      return a.name.localeCompare(b.name);
    });

  const eliminated=Object.entries(state.players)
    .filter(([,p])=>["eliminated","disconnected"].includes(p.status))
    .map(([id,p])=>({id,...p}))
    .sort((a,b)=>{
      const ar=a.eliminatedRound??-1, br=b.eliminatedRound??-1;
      if(ar!==br)return br-ar;
      if(a.isBot!==b.isBot)return a.isBot?1:-1;
      return a.name.localeCompare(b.name);
    });

  $("survivorCount").textContent=survivors.length;
  $("eliminatedCount").textContent=eliminated.length;

  $("survivorRows").innerHTML=survivors.map((p,i)=>`
    <div class="row">
      <span>#${i+1}</span>
      <span>@${esc(p.name)}${p.isBot?'<span class="bot">CPU</span>':''}</span>
      <span>${p.isBot?"CPU":"PLAYER"}</span>
      <span class="survive">SURVIVED</span>
    </div>`).join("")||'<p class="mini">No survivors.</p>';

  $("eliminatedRows").innerHTML=eliminated.map(p=>`
    <div class="row">
      <span>☠</span>
      <span>@${esc(p.name)}${p.isBot?'<span class="bot">CPU</span>':''}</span>
      <span>LEVEL ${p.eliminatedRound??"—"}</span>
      <span class="eliminate">ELIMINATED</span>
    </div>`).join("")||'<p class="mini">Nobody eliminated yet.</p>';
}

function renderSpectator(){
  show("spectate");
  const active=state.activeIds.map(id=>({id,...state.players[id]})).filter(p=>p&&!p.isBot);
  const lower=["button","reaction","center","slider","stoplight"].includes(state.game);
  active.sort((a,b)=>{
    const av=a.liveScore??(lower?999999:-1),bv=b.liveScore??(lower?999999:-1);
    return lower?av-bv:bv-av;
  });
  $("spectatorAlive").textContent=active.length;
  $("liveRows").innerHTML=active.map((p,i)=>{
    const val=p.liveScore==null?"PLAYING":formatScore(p.liveScore,state.game);
    return `<div class="row"><span>#${i+1}</span><span>@${esc(p.name)}</span><span>${val}</span><span class="survive">LIVE</span></div>`;
  }).join("")||'<p class="mini">Waiting for survivor scores...</p>';
}

function formatScore(v,game){
  if(game==="button"||game==="reaction"||game==="stoplight")return `${Math.round(v)} ms`;
  if(game==="center"||game==="slider")return `${Number(v).toFixed(1)} px`;
  if(game==="stack")return `${v} blocks`;
  if(game==="balance")return `${v} catches`;
  if(game==="memory")return `${v} rounds`;
  if(game==="catcher")return `${v} catches`;
  if(game==="aim")return `${v} hits`;
  if(game==="taprush")return `${v} taps`;
  return `${v} pts`;
}

function renderFinal(){
  show("finished");
  const rows=state.results||[];
  $("winner").textContent=rows[0]?`@${rows[0].name} WON THE DROP`:"DROP COMPLETE";
  $("finalCount").textContent=rows.length;
  const medal=i=>i===0?"🏆":i===1?"🥈":i===2?"🥉":`#${i+1}`;
  $("finalRows").innerHTML=rows.map((r,i)=>`
    <div class="row">
      <span>${medal(i)}</span>
      <span>@${esc(r.name)}</span>
      <span>${r.roundsSurvived} levels</span>
      <span class="${i===0?"survive":""}">${i===0?"WINNER":i===1?"2ND":i===2?"3RD":""}</span>
    </div>`).join("");

  $("nextDropBtn").onclick=()=>{
    $("finished").classList.add("hidden");
    show("home");
    $("homeTitle").textContent="Waiting for the next Drop.";
    $("homeCopy").textContent="Stay ready. The host will open the next lobby.";
    $("joinBox").classList.add("hidden");
  };
}
