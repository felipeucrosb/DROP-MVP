
const express=require("express"),http=require("http"),path=require("path");
const {Server}=require("socket.io");
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));

const GAMES=["button","stack","flappy"];
let s={phase:"idle",host:null,players:{},lobbyDeadline:0,game:null,startedAt:0,results:[],dropNo:1,prize:1000};
let lobbyTimer=null,revealTimer=null;
const arr=()=>Object.entries(s.players).map(([id,p])=>({id,...p}));
const pub=()=>({...s,playerCount:Object.keys(s.players).length});
const emit=()=>io.emit("state",pub());

function reset(){clearTimeout(lobbyTimer);clearTimeout(revealTimer);s={phase:"idle",host:null,players:{},lobbyDeadline:0,game:null,startedAt:0,results:[],dropNo:s.dropNo,prize:1000}}
function openLobby(){s.phase="lobby";s.lobbyDeadline=Date.now()+60000;lobbyTimer=setTimeout(()=>{if(s.phase==="lobby"&&arr().length)reveal()},60100);emit()}
function reveal(){if(s.phase!=="lobby")return;clearTimeout(lobbyTimer);s.game=GAMES[Math.floor(Math.random()*GAMES.length)];s.phase="reveal";emit();revealTimer=setTimeout(()=>{s.phase="playing";s.startedAt=Date.now();emit()},3200)}
function finish(){
  if(s.phase!=="playing")return;
  const rows=arr().map(p=>({id:p.id,name:p.name,score:p.score??null,finished:p.finished}));
  if(s.game==="button")rows.sort((a,b)=>(a.score??999999)-(b.score??999999));
  else rows.sort((a,b)=>(b.score??-1)-(a.score??-1));
  s.results=rows;s.phase="finished";emit();
}
function submit(id,score){
  const p=s.players[id];if(!p||s.phase!=="playing"||p.finished)return;
  score=Number(score);if(!Number.isFinite(score))return;
  if(s.game==="button")score=Math.max(0,Math.min(score,15000));
  else score=Math.max(0,Math.min(Math.floor(score),100000));
  p.score=score;p.finished=true;emit();
  if(arr().every(x=>x.finished))finish();
}

io.on("connection",sock=>{
  sock.emit("state",pub());
  sock.on("join",({name})=>{
    name=String(name||"").trim().slice(0,24);
    if(!name)return sock.emit("join-error","Choose a username.");
    if(!["idle","lobby"].includes(s.phase))return sock.emit("join-error","This Drop already started.");
    s.players[sock.id]={name,finished:false,score:null};
    if(!s.host)s.host=sock.id;
    if(s.phase==="idle")openLobby();
    sock.emit("joined",{id:sock.id});emit();
  });
  sock.on("start-now",()=>{if(sock.id===s.host)reveal()});
  sock.on("result",({score})=>submit(sock.id,score));
  sock.on("finish-drop",()=>{if(sock.id===s.host)finish()});
  sock.on("new-drop",()=>{if(sock.id!==s.host||s.phase!=="finished")return;s.dropNo++;reset();emit()});
  sock.on("disconnect",()=>{
    const wasHost=s.host===sock.id;delete s.players[sock.id];
    if(wasHost)s.host=Object.keys(s.players)[0]||null;
    if(!Object.keys(s.players).length&&s.phase!=="finished")reset();
    emit();
  });
});
server.listen(process.env.PORT||3000,()=>console.log("DROP MVP ready"));
