
window.DropGames = (() => {
  const $ = id => document.getElementById(id);

  function difficultyForRound(round) {
    if (round <= 5) return { name:"EASY", mult:1 };
    if (round <= 7) return { name:"MEDIUM", mult:1.25 };
    if (round <= 9) return { name:"HARD", mult:1.55 };
    return { name:"EXTREME", mult:1.9 };
  }

  function ramp(round, progress) {
    const mult = difficultyForRound(round).mult;
    return 1 + (mult - 1) * Math.max(0, Math.min(1, progress));
  }

  function button(ctx) {
    let running=false,start=0,raf=null;
    ctx.area.innerHTML=`<div><div class="instruction">Hold. Release as close to <b>5.000</b> seconds as possible.</div><div id="time" class="huge">0.000</div><br><button id="hold" class="hold">HOLD</button></div>`;
    const time=$("time"), hold=$("hold");
    const loop=()=>{if(!running)return;time.textContent=((performance.now()-start)/1000).toFixed(3);raf=requestAnimationFrame(loop)};
    const down=e=>{e.preventDefault();if(running)return;running=true;start=performance.now();loop()};
    const up=e=>{if(!running)return;e.preventDefault();running=false;cancelAnimationFrame(raf);const elapsed=performance.now()-start,diff=Math.abs(5000-elapsed);time.textContent=(elapsed/1000).toFixed(3);ctx.submit(diff,`${(elapsed/1000).toFixed(3)} sec · ${Math.round(diff)}ms away`)};
    hold.addEventListener("pointerdown",down,{passive:false});
    window.addEventListener("pointerup",up,{once:true,passive:false});
  }

  function stack(ctx) {
    ctx.area.innerHTML=`<div><div class="instruction">Tap to drop each block. It starts quick and gets faster every level.</div><div id="stack" class="stack"></div></div>`;
    const box=$("stack");
    // Faster than V3: starts at 3.25 instead of 2.1 and accelerates harder.
    let level=0,w=190,x=0,lastX=0,dir=1,speed=3.25,cur=null,raf=null,dead=false;
    function spawn(){
      cur=document.createElement("div");
      cur.className="block";
      cur.style.width=w+"px";
      cur.style.bottom=(level*29)+"px";
      box.appendChild(cur);
      x=dir>0?0:Math.max(0,box.clientWidth-w);
      move();
    }
    function move(){
      if(dead)return;
      x+=speed*dir;
      if(x<0){x=0;dir=1}
      if(x+w>box.clientWidth){x=box.clientWidth-w;dir=-1}
      cur.style.left=x+"px";
      raf=requestAnimationFrame(move);
    }
    box.addEventListener("pointerdown",e=>{
      e.preventDefault();
      if(dead)return;
      cancelAnimationFrame(raf);

      if(level===0){
        lastX=x;
        level++;
        ctx.live(level);
        speed+=0.22;
        spawn();
        return;
      }

      const L=Math.max(x,lastX);
      const R=Math.min(x+w,lastX+w);
      const overlap=R-L;

      if(overlap<=3){
        dead=true;
        ctx.submit(level,`Stack height: ${level}`);
        return;
      }

      w=overlap;
      lastX=L;
      cur.style.left=L+"px";
      cur.style.width=w+"px";
      level++;
      ctx.live(level);

      // Faster acceleration, while still respecting the tournament difficulty tier.
      speed+=0.24*ramp(ctx.round,Math.min(1,level/9));

      if(level>=18){
        dead=true;
        ctx.submit(level,`Stack height: ${level}`);
        return;
      }
      spawn();
    },{passive:false});
    spawn();
  }

  function flappy(ctx) {
    ctx.area.innerHTML=`<div><div class="instruction">Tap to flap. Starts slow, then speeds up. One life.</div><div id="flap" class="flap"><div id="bird" class="bird"></div><div class="ground"></div></div></div>`;
    const box=$("flap"),bird=$("bird");
    let y=230,vy=0,score=0,dead=false,last=performance.now(),spawnClock=0,pipes=[],start=performance.now();
    function addPipe(){
      const elapsed=(performance.now()-start)/1000;
      const gap=Math.max(145,190-Math.min(elapsed,18)*2.5);
      const top=50+Math.random()*(box.clientHeight-gap-120);
      const a=document.createElement("div"),b=document.createElement("div");
      a.className=b.className="pipe";a.style.height=top+"px";a.style.top="0";b.style.height=(box.clientHeight-top-gap)+"px";b.style.bottom="18px";
      box.append(a,b);pipes.push({x:box.clientWidth+10,top,gap,a,b,passed:false});
    }
    const flap=e=>{if(e)e.preventDefault();if(!dead)vy=-7.0};
    box.addEventListener("pointerdown",flap,{passive:false});
    window.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();flap()}});
    function die(){if(dead)return;dead=true;ctx.submit(score,`Distance: ${score}`)}
    function frame(now){
      if(dead)return;
      const dt=Math.min(30,now-last)/16.67;last=now;
      const elapsed=(now-start)/1000,progress=Math.min(1,elapsed/18);
      const gravity=.32+.10*progress;
      const speed=(1.75+1.55*progress)*ramp(ctx.round,Math.min(1,score/8));
      const spawnAt=125-30*progress;
      vy+=gravity*dt;y+=vy*dt;bird.style.top=y+"px";
      spawnClock+=dt;if(spawnClock>spawnAt){spawnClock=0;addPipe()}
      pipes.forEach(p=>{
        p.x-=speed*dt;p.a.style.left=p.x+"px";p.b.style.left=p.x+"px";
        if(!p.passed&&p.x+70<90){p.passed=true;score++;ctx.live(score)}
        if(p.x<124&&p.x+70>90&&(y<p.top||y+34>p.top+p.gap))die();
      });
      pipes=pipes.filter(p=>{if(p.x<-90){p.a.remove();p.b.remove();return false}return true});
      if(y<0||y+34>box.clientHeight-18)die();
      requestAnimationFrame(frame);
    }
    setTimeout(()=>{if(!dead)addPipe()},900);
    requestAnimationFrame(frame);
  }

  function reaction(ctx) {
    ctx.area.innerHTML=`<div><div class="instruction">WAIT. Tap only when the button says GO.</div><button id="react" class="hold" style="background:#222">WAIT</button></div>`;
    const b=$("react");let ready=false,shown=0,finished=false;
    const delay=1200+Math.random()*3200;
    const to=setTimeout(()=>{if(finished)return;ready=true;shown=performance.now();b.textContent="GO!";b.style.background="var(--green)"},delay);
    b.addEventListener("pointerdown",e=>{
      e.preventDefault();if(finished)return;
      if(!ready){finished=true;clearTimeout(to);ctx.submit(99999,"False start");return}
      finished=true;const ms=performance.now()-shown;ctx.submit(ms,`${Math.round(ms)} ms reaction`);
    },{passive:false});
  }

  function center(ctx) {
    ctx.area.innerHTML=`<div style="width:min(760px,92vw)"><div class="instruction">Tap once. Stop the dot as close to the center as possible.</div><div id="track" style="height:90px;position:relative;border:1px solid #333;border-radius:18px;background:#080808;touch-action:none"><div style="position:absolute;left:50%;top:0;bottom:0;width:3px;background:var(--green)"></div><div id="dot" style="position:absolute;top:27px;width:36px;height:36px;border-radius:50%;background:var(--red)"></div></div></div>`;
    const tr=$("track"),dot=$("dot");let x=0,d=1,raf=null,finished=false,start=performance.now();
    function frame(now){
      if(finished)return;
      const prog=Math.min(1,(now-start)/7000);
      x+=5*d*ramp(ctx.round,prog);
      if(x<0){x=0;d=1}
      if(x>tr.clientWidth-36){x=tr.clientWidth-36;d=-1}
      dot.style.left=x+"px";raf=requestAnimationFrame(frame);
    }
    tr.addEventListener("pointerdown",e=>{
      e.preventDefault();if(finished)return;finished=true;cancelAnimationFrame(raf);
      const diff=Math.abs(tr.clientWidth/2-(x+18));ctx.submit(diff,`${diff.toFixed(1)} px from center`);
    },{passive:false});
    requestAnimationFrame(frame);
  }

  function taprush(ctx) {
    let taps=0,ended=false,lastTap=0;
    ctx.area.innerHTML=`<div><div class="instruction">10 seconds. Tap the zone as fast as you can.</div><div class="huge"><span id="taps">0</span></div><button id="tapbtn" class="tapZone">TAP TAP TAP</button><p class="mini"><span id="tapleft">10.0</span>s left</p></div>`;
    const st=performance.now(),b=$("tapbtn");
    b.addEventListener("pointerdown",e=>{
      e.preventDefault();if(ended)return;const now=performance.now();if(now-lastTap<18)return;lastTap=now;
      taps++;$("taps").textContent=taps;ctx.live(taps);
    },{passive:false});
    const iv=setInterval(()=>{
      const left=Math.max(0,10-(performance.now()-st)/1000);$("tapleft").textContent=left.toFixed(1);
      if(left<=0){clearInterval(iv);ended=true;ctx.submit(taps,`${taps} taps`)}
    },50);
  }

  function catcher(ctx) {
    ctx.area.innerHTML=`<div><div class="instruction">Move the basket and catch falling dots for 15 seconds.</div><div id="catchbox" style="width:min(700px,94vw);height:500px;position:relative;overflow:hidden;border:1px solid #333;border-radius:18px;background:#081018;touch-action:none"><div id="basket" style="position:absolute;bottom:15px;width:90px;height:20px;border-radius:10px;background:var(--green)"></div></div></div>`;
    const box=$("catchbox"),basket=$("basket");let bx=box.clientWidth/2-45,score=0,drops=[],done=false,start=performance.now(),lastSpawn=0;
    function move(clientX){const r=box.getBoundingClientRect();bx=Math.max(0,Math.min(box.clientWidth-90,clientX-r.left-45));basket.style.left=bx+"px"}
    box.addEventListener("pointermove",e=>{e.preventDefault();move(e.clientX)},{passive:false});
    box.addEventListener("pointerdown",e=>{e.preventDefault();move(e.clientX)},{passive:false});
    function spawn(){
      const el=document.createElement("div");el.style.cssText="position:absolute;width:24px;height:24px;border-radius:50%;background:var(--gold);top:-25px";
      box.appendChild(el);drops.push({el,x:Math.random()*(box.clientWidth-24),y:-25,v:3.1+Math.random()*1.3});
    }
    function frame(now){
      if(done)return;
      const elapsed=(now-start)/1000;if(elapsed>=15){done=true;ctx.submit(score,`${score} catches`);return}
      if(now-lastSpawn>520){lastSpawn=now;spawn()}
      const diff=ramp(ctx.round,Math.min(1,score/10));
      drops.forEach(o=>{
        o.y+=o.v*diff;o.el.style.left=o.x+"px";o.el.style.top=o.y+"px";
        if(o.y>450&&o.y<485&&o.x+24>bx&&o.x<bx+90){score++;ctx.live(score);o.y=999}
      });
      drops=drops.filter(o=>{if(o.y>520){o.el.remove();return false}return true});
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function memory(ctx) {
    const colors=["#ff3b30","#2bd67b","#f3c44e","#4c8dff"];
    let seq=[],input=[],level=0,busy=true,dead=false;
    ctx.area.innerHTML=`<div><div class="instruction">Watch the sequence. Then repeat it.</div><div id="mem" style="display:grid;grid-template-columns:repeat(2,150px);gap:12px;justify-content:center"></div><p>Round <b id="ml">0</b></p></div>`;
    const mem=$("mem");
    colors.forEach((c,i)=>{
      const b=document.createElement("button");b.style.cssText=`width:150px;height:150px;border:0;border-radius:22px;background:${c};opacity:.45;touch-action:none`;
      b.addEventListener("pointerdown",e=>{e.preventDefault();press(i)},{passive:false});mem.appendChild(b);
    });
    const btns=[...mem.children];
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    async function flash(i,ms){btns[i].style.opacity="1";await wait(ms);btns[i].style.opacity=".45";await wait(100)}
    async function next(){
      level++;$("ml").textContent=level;ctx.live(Math.max(0,level-1));seq.push(Math.floor(Math.random()*4));input=[];busy=true;await wait(300);
      const speed=Math.max(180,380/ramp(ctx.round,Math.min(1,level/8)));
      for(const i of seq)await flash(i,speed);
      busy=false;
    }
    function press(i){
      if(busy||dead)return;
      input.push(i);flash(i,120);
      const pos=input.length-1;
      if(seq[pos]!==i){dead=true;ctx.submit(level-1,`${level-1} rounds completed`);return}
      if(input.length===seq.length){
        busy=true;
        if(level>=12){dead=true;ctx.submit(level,`${level} rounds completed`)}
        else setTimeout(next,450);
      }
    }
    next();
  }

  function slider(ctx) {
    ctx.area.innerHTML=`<div style="width:min(760px,92vw)"><div class="instruction">Tap to stop the line inside the target.</div><div id="sltrack" style="height:100px;position:relative;border:1px solid #333;border-radius:18px;background:#080808;touch-action:none"><div id="target" style="position:absolute;left:62%;top:0;bottom:0;width:24px;background:#163d28"></div><div id="line" style="position:absolute;top:10px;bottom:10px;width:5px;background:var(--red)"></div></div></div>`;
    const tr=$("sltrack"),line=$("line");let x=0,d=1,dead=false,raf=null,start=performance.now();
    function frame(now){
      if(dead)return;
      x+=6*d*ramp(ctx.round,Math.min(1,(now-start)/7000));
      if(x<0){x=0;d=1}
      if(x>tr.clientWidth-5){x=tr.clientWidth-5;d=-1}
      line.style.left=x+"px";raf=requestAnimationFrame(frame);
    }
    tr.addEventListener("pointerdown",e=>{
      e.preventDefault();if(dead)return;dead=true;cancelAnimationFrame(raf);
      const targetCenter=tr.clientWidth*.62+12;const diff=Math.abs((x+2.5)-targetCenter);ctx.submit(diff,`${diff.toFixed(1)} px from target`);
    },{passive:false});
    requestAnimationFrame(frame);
  }

  function balance(ctx) {
    ctx.area.innerHTML=`<div>
      <div class="instruction">Drag the basket left and right to catch the falling balls.</div>
      <div id="basketGame" style="width:min(700px,94vw);height:480px;position:relative;overflow:hidden;border:1px solid #333;border-radius:18px;background:#080d10;touch-action:none">
        <div id="sliderTrack" style="position:absolute;left:30px;right:30px;bottom:28px;height:10px;border-radius:999px;background:#252525"></div>
        <div id="basket" style="position:absolute;bottom:48px;width:110px;height:28px;border:3px solid var(--green);border-top:0;border-radius:0 0 22px 22px;background:#11261a"></div>
      </div>
      <p><b id="basketScore">0</b> catches</p>
    </div>`;

    const box=$("basketGame"),basket=$("basket"),scoreEl=$("basketScore");
    let basketX=Math.max(0,box.clientWidth/2-55);
    let score=0,balls=[],finished=false,start=performance.now(),lastSpawn=0;
    basket.style.left=basketX+"px";

    function setBasket(clientX){
      const r=box.getBoundingClientRect();
      basketX=Math.max(0,Math.min(box.clientWidth-110,clientX-r.left-55));
      basket.style.left=basketX+"px";
    }

    // True slider-style control: press/drag anywhere horizontally.
    box.addEventListener("pointerdown",e=>{
      e.preventDefault();
      box.setPointerCapture?.(e.pointerId);
      setBasket(e.clientX);
    },{passive:false});

    box.addEventListener("pointermove",e=>{
      if(e.buttons===0 && e.pointerType!=="touch")return;
      e.preventDefault();
      setBasket(e.clientX);
    },{passive:false});

    function spawnBall(){
      const el=document.createElement("div");
      const size=26;
      el.style.cssText=`position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:var(--gold);top:-30px`;
      box.appendChild(el);
      balls.push({
        el,
        x:15+Math.random()*Math.max(1,box.clientWidth-size-30),
        y:-30,
        v:2.6+Math.random()*0.8,
        caught:false
      });
    }

    function frame(now){
      if(finished)return;
      const elapsed=(now-start)/1000;

      // 15-second round. Starts gentle, then speeds up.
      if(elapsed>=15){
        finished=true;
        balls.forEach(b=>b.el.remove());
        ctx.submit(score,`${score} catches`);
        return;
      }

      const progress=Math.min(1,elapsed/15);
      const diff=ramp(ctx.round,progress);
      const spawnDelay=Math.max(420,900-260*progress*diff);

      if(now-lastSpawn>spawnDelay){
        lastSpawn=now;
        spawnBall();
      }

      balls.forEach(b=>{
        b.y+=b.v*diff;
        b.el.style.left=b.x+"px";
        b.el.style.top=b.y+"px";

        const basketTop=box.clientHeight-76;
        if(!b.caught &&
           b.y+26>=basketTop &&
           b.y<=basketTop+30 &&
           b.x+26>basketX &&
           b.x<basketX+110){
          b.caught=true;
          score++;
          scoreEl.textContent=score;
          ctx.live(score);
          b.y=999;
        }
      });

      balls=balls.filter(b=>{
        if(b.y>box.clientHeight+30){
          b.el.remove();
          return false;
        }
        return true;
      });

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function aim(ctx) {
    let score=0,ended=false;
    const duration=12000;
    ctx.area.innerHTML=`<div><div class="instruction">12 seconds. Hit every target you can.</div><div id="aimbox" style="width:min(760px,94vw);height:500px;position:relative;border:1px solid #333;border-radius:18px;background:#080808;touch-action:none"></div><p><b id="aimscore">0</b> hits</p></div>`;
    const box=$("aimbox");
    function spawn(){
      if(ended)return;box.innerHTML="";
      const prog=Math.min(1,score/12),diff=ramp(ctx.round,prog),size=Math.max(20,(46+Math.random()*42)/diff);
      const t=document.createElement("button");
      t.style.cssText=`position:absolute;width:${size}px;height:${size}px;border:0;border-radius:50%;background:var(--red);left:${Math.random()*Math.max(1,box.clientWidth-size)}px;top:${Math.random()*Math.max(1,box.clientHeight-size)}px;touch-action:none`;
      t.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();if(ended)return;score++;$("aimscore").textContent=score;ctx.live(score);spawn()},{passive:false});
      box.appendChild(t);
    }
    spawn();
    setTimeout(()=>{if(ended)return;ended=true;box.innerHTML="";ctx.submit(score,`${score} targets hit`)},duration);
  }

  function stoplight(ctx) {
    ctx.area.innerHTML=`<div><div class="instruction">Do not tap on red. Tap the instant it turns green.</div><button id="light" class="hold" style="background:var(--red)">WAIT</button></div>`;
    const b=$("light");let green=false,at=0,finished=false;const delay=1500+Math.random()*3500;
    const to=setTimeout(()=>{if(finished)return;green=true;at=performance.now();b.style.background="var(--green)";b.textContent="GO!"},delay);
    b.addEventListener("pointerdown",e=>{
      e.preventDefault();if(finished)return;
      if(!green){finished=true;clearTimeout(to);ctx.submit(99999,"False start");return}
      finished=true;const ms=performance.now()-at;ctx.submit(ms,`${Math.round(ms)} ms`);
    },{passive:false});
  }

  const registry = { button,stack,flappy,reaction,center,taprush,catcher,memory,slider,balance,aim,stoplight };
  return { registry, difficultyForRound };
})();
