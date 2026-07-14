/* Balloon Rescue — vanilla JS canvas game */
(() => {
'use strict';

// ---------- Utilities ----------
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const rand = (a,b) => a + Math.random()*(b-a);
const randi = (a,b) => Math.floor(rand(a,b));
const choice = a => a[randi(0,a.length)];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const now = () => performance.now();

// ---------- Canvas ----------
const canvas = $('#stage');
const ctx = canvas.getContext('2d');
let W=0, H=0, DPR=1;
function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  W = w; H = h;
  canvas.width = Math.floor(w*DPR);
  canvas.height = Math.floor(h*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);

// ---------- Audio (WebAudio synth) ----------
const Audio = (() => {
  let AC=null, master=null, musicGain=null, sfxGain=null, muted=false, musicOn=false, musicNodes=[];
  function ensure(){
    if(AC) return;
    try{
      AC = new (window.AudioContext||window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
      sfxGain = AC.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
      musicGain = AC.createGain(); musicGain.gain.value = 0.12; musicGain.connect(master);
    }catch(e){}
  }
  function resume(){ ensure(); if(AC && AC.state==='suspended') AC.resume(); }
  function tone(freq, dur=0.15, type='sine', vol=0.5, slide=0){
    if(muted||!AC) return;
    const t0 = AC.currentTime;
    const o = AC.createOscillator(); o.type=type; o.frequency.setValueAtTime(freq,t0);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide), t0+dur);
    const g = AC.createGain(); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol,t0+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g).connect(sfxGain); o.start(t0); o.stop(t0+dur+0.05);
  }
  function noise(dur=0.2, vol=0.4, filterFreq=1200){
    if(muted||!AC) return;
    const t0 = AC.currentTime;
    const buf = AC.createBuffer(1, AC.sampleRate*dur, AC.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*(1-i/d.length);
    const s = AC.createBufferSource(); s.buffer = buf;
    const f = AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=filterFreq;
    const g = AC.createGain(); g.gain.value=vol;
    s.connect(f).connect(g).connect(sfxGain); s.start(t0);
  }
  const A = {
    setMuted(v){ muted=v; if(v) stopMusic(); else if(musicOn) startMusic(); },
    isMuted(){ return muted; },
    resume,
    correct(){ tone(660,.08,'triangle',.4); setTimeout(()=>tone(880,.12,'triangle',.4),70); },
    wrong(){ tone(180,.18,'sawtooth',.4,-80); },
    pop(){ noise(.09,.5,3000); tone(rand(500,900),.07,'square',.25,-300); },
    click(){ tone(500,.04,'square',.2); },
    victory(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.18,'triangle',.4),i*110)); },
    fall(){
      if(muted||!AC) return;
      const t0=AC.currentTime, o=AC.createOscillator(), g=AC.createGain();
      o.type='sine'; o.frequency.setValueAtTime(1200,t0); o.frequency.exponentialRampToValueAtTime(150,t0+1.2);
      g.gain.setValueAtTime(.25,t0); g.gain.exponentialRampToValueAtTime(.001,t0+1.2);
      o.connect(g).connect(sfxGain); o.start(t0); o.stop(t0+1.25);
    },
    splash(){ noise(.5,.6,900); },
    growl(){
      if(muted||!AC) return;
      const t0=AC.currentTime;
      for(let i=0;i<3;i++){ const o=AC.createOscillator(),g=AC.createGain();
        o.type='sawtooth'; o.frequency.setValueAtTime(80+i*10,t0); o.frequency.linearRampToValueAtTime(40,t0+.4);
        g.gain.setValueAtTime(.15,t0); g.gain.exponentialRampToValueAtTime(.001,t0+.5);
        o.connect(g).connect(sfxGain); o.start(t0); o.stop(t0+.55);
      }
    },
    startMusic(){
      ensure(); if(muted) return; stopMusic(); musicOn=true;
      const notes=[262,330,392,523,392,330]; let i=0;
      const iv = setInterval(()=>{
        if(!musicOn||muted||!AC){ clearInterval(iv); return; }
        const t0 = AC.currentTime;
        const o=AC.createOscillator(), g=AC.createGain();
        o.type='triangle'; o.frequency.setValueAtTime(notes[i%notes.length],t0);
        g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(.6,t0+.05); g.gain.exponentialRampToValueAtTime(.001,t0+.55);
        o.connect(g).connect(musicGain); o.start(t0); o.stop(t0+.6);
        i++;
      }, 380);
      musicNodes.push(iv);
    },
    stopMusic(){ musicOn=false; musicNodes.forEach(clearInterval); musicNodes.length=0; }
  };
  function startMusic(){ A.startMusic(); }
  function stopMusic(){ A.stopMusic(); }
  return A;
})();

// ---------- Persistence ----------
const Store = {
  key:'balloon-rescue-v1',
  data:{ best:0, longestStreak:0, scores:[], muted:false, hc:false, usedByCat:{} },
  load(){ try{ const s=localStorage.getItem(this.key); if(s) Object.assign(this.data, JSON.parse(s)); }catch(e){} },
  save(){ try{ localStorage.setItem(this.key, JSON.stringify(this.data)); }catch(e){} }
};
Store.load();

// ---------- Word pool ----------
const CATS = window.CATEGORIES;
const WORDS = window.WORDS;
function allWords(){ return Object.values(WORDS).flat(); }
function pickWord(cat){
  const pool = (cat==='Random'||!cat) ? allWords() : (WORDS[cat]||allWords());
  const used = Store.data.usedByCat[cat] = Store.data.usedByCat[cat] || [];
  const remaining = pool.filter(w=>!used.includes(w));
  const list = remaining.length ? remaining : (used.length=0, pool);
  const w = choice(list);
  used.push(w); Store.save();
  return w;
}

// ---------- Balloon colors ----------
const BALLOON_COLORS = ['#ff4d4d','#3b82f6','#22c55e','#8b5cf6','#facc15','#fb923c','#f472b6','#22d3ee','#ffffff','#a3e635','#eab308','#a855f7','#06b6d4','#e879f9','#7dd3fc'];

// ---------- World state ----------
const State = {
  scene:'menu', // menu|play|falling|drown|round|over
  category:'Random',
  word:'', revealed:[], wrong:new Set(), guessed:new Set(),
  lives:5, score:0, solved:0, streak:0,
  emotion:'calm', // calm|happy|scared|panic|celebrate|terrified
  emotionUntil:0,
  shakeUntil:0, shakeAmt:0,
  time:0,
};

// entities
const balloons=[]; // 15
const particles=[];
const confetti=[];
const clouds=[];
const birds=[];
const gators=[];
let character=null;

// ---------- Character ----------
function createCharacter(){
  return {
    x: 0, y: 0, // set in layout
    baseY: 0,
    vx:0, vy:0,
    bob: 0,
    armWave:0, legKick:0,
    falling:false, splashed:false,
    fistPump:0,
    shake:0,
  };
}

// ---------- Balloons ----------
function createBalloon(i){
  const color = BALLOON_COLORS[i % BALLOON_COLORS.length];
  return {
    i,
    alive:true,
    color,
    // anchor offset around character (spread)
    ox: rand(-70,70), oy: rand(-40,20),
    swayA: rand(4,10), swayP: rand(0,Math.PI*2), swayS: rand(0.6,1.4),
    scale:1, targetScale:1,
    x:0,y:0, // absolute
    inflate:0, popping:0, popped:false,
    stringSeed: rand(0,1000),
    fallY:0, fallVy:0, // popped remains
  };
}

// ---------- Alligators ----------
function createGator(x, y, dir){
  return { x, y, dir, // dir 1 or -1
    baseY:y, tail:0, blink:0, mouth:0, mode:'idle', speed: rand(10,20), phase:rand(0,Math.PI*2) };
}

// ---------- Clouds / birds ----------
function initSky(){
  clouds.length=0;
  for(let i=0;i<6;i++) clouds.push({x:rand(0,W), y:rand(30, H*0.35), s:rand(.7,1.6), v:rand(6,16)});
  birds.length=0;
}

// ---------- Layout ----------
let LAYOUT = { charX:0, charY:0, lakeY:0 };
function computeLayout(){
  LAYOUT.lakeY = H*0.78;
  LAYOUT.charX = W*0.5;
  LAYOUT.charY = H*0.58;
  if(character){ character.baseY = LAYOUT.charY; if(!character.falling){ character.x = LAYOUT.charX; character.y = LAYOUT.charY; } }
}

// ---------- Round setup ----------
function startRound(){
  State.word = pickWord(State.category);
  State.revealed = State.word.split('').map(c => (c===' ' ? ' ' : ''));
  State.wrong = new Set(); State.guessed = new Set();
  State.scene = 'play';
  State.emotion = 'calm'; State.emotionUntil = 0;
  balloons.length=0;
  for(let i=0;i<15;i++) balloons.push(createBalloon(i));
  particles.length=0; confetti.length=0;
  character = createCharacter();
  computeLayout();
  gators.length=0;
  const n = 3;
  for(let i=0;i<n;i++) gators.push(createGator(W*(0.2+i*0.3), H*0.86, i%2?1:-1));
  renderWord(); renderKeyboard();
  showHUD(true); showPlayUI(true); showMenu(false); hideAllScreens();
  Audio.resume(); if(!Store.data.muted) Audio.startMusic();
}

function newGame(cat){
  State.category = cat || State.category || 'Random';
  State.lives = 5; State.score = 0; State.solved = 0; State.streak = 0;
  Store.data.usedByCat[State.category] = [];
  startRound();
}

// ---------- Guess logic ----------
function guess(letter){
  if(State.scene!=='play') return;
  letter = letter.toUpperCase();
  if(!/^[A-Z]$/.test(letter)) return;
  if(State.guessed.has(letter)) return;
  State.guessed.add(letter);
  const w = State.word;
  if(w.includes(letter)){
    let count=0;
    for(let i=0;i<w.length;i++) if(w[i]===letter){ State.revealed[i]=letter; count++; }
    State.score += count*10;
    Audio.correct();
    setEmotion('happy', 700);
    character.fistPump = 1;
    character.vy = -80;
    renderWord(); updateHUD(); markKey(letter,true);
    if(State.revealed.join('')===w){ winRound(); }
  }else{
    State.wrong.add(letter);
    Audio.wrong();
    setEmotion('scared', 900);
    character.shake = 1;
    triggerShake(0.5, 350);
    // pop 3 balloons
    popBalloons(3);
    State.lives--;
    updateHUD(); markKey(letter,false);
    if(State.lives<=0){
      // wait until pops animate then lose
      setTimeout(()=>loseRound(), 800);
    } else if(State.lives===1){
      setTimeout(()=>{ if(State.scene==='play') setEmotion('panic', 999999); }, 400);
    }
  }
}

function popBalloons(n){
  const alive = balloons.filter(b=>b.alive && !b.popping);
  for(let i=0;i<n && i<alive.length;i++){
    const b = alive[i];
    b.popping = 0.001; b.targetScale = 1.35;
  }
}

function winRound(){
  State.scene = 'round';
  State.solved++; State.streak++;
  const bonus = State.lives*50 + 100;
  State.score += bonus;
  Store.data.longestStreak = Math.max(Store.data.longestStreak, State.streak);
  Store.data.best = Math.max(Store.data.best, State.score);
  Store.save();
  Audio.victory();
  setEmotion('celebrate', 3000);
  // confetti
  for(let i=0;i<120;i++) confetti.push({x:rand(0,W),y:-10,vx:rand(-40,40),vy:rand(40,120),r:rand(3,6),c:choice(BALLOON_COLORS),rot:rand(0,Math.PI*2),vr:rand(-4,4)});
  showRound(true, bonus);
  showPlayUI(false);
}

function loseRound(){
  State.scene = 'falling';
  Audio.fall();
  setEmotion('terrified', 5000);
  character.falling = true;
  character.vy = 50;
  // wake gators
  gators.forEach(g=>{ g.mode='attack'; g.speed = rand(60,90); });
  showPlayUI(false);
}

function finishGameOver(){
  State.scene = 'over';
  Audio.growl();
  Store.data.best = Math.max(Store.data.best, State.score);
  Store.data.scores = (Store.data.scores||[]).concat([{score:State.score, solved:State.solved, date:Date.now()}])
    .sort((a,b)=>b.score-a.score).slice(0,10);
  Store.save();
  showOver(true);
  Audio.stopMusic();
}

function setEmotion(e, ms){ State.emotion = e; State.emotionUntil = now()+ms; }
function triggerShake(amt, ms){ State.shakeAmt = amt; State.shakeUntil = now()+ms; }

// ---------- Rendering ----------
function drawSky(){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#7ec8ff'); g.addColorStop(0.7,'#c8ecff'); g.addColorStop(1,'#e6f5ff');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // sun
  ctx.save();
  const sx = W*0.85, sy = H*0.15;
  const rg = ctx.createRadialGradient(sx,sy,10,sx,sy,120);
  rg.addColorStop(0,'rgba(255,240,150,1)'); rg.addColorStop(1,'rgba(255,240,150,0)');
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(sx,sy,120,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ffe066'; ctx.beginPath(); ctx.arc(sx,sy,36,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawClouds(dt){
  for(const c of clouds){
    c.x += c.v*dt*0.05;
    if(c.x > W+120) c.x = -120;
    ctx.save(); ctx.translate(c.x,c.y); ctx.scale(c.s,c.s);
    ctx.fillStyle='rgba(255,255,255,.9)';
    for(const [x,y,r] of [[0,0,22],[22,-6,20],[44,4,22],[16,10,18],[34,10,18]]){
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}
function drawTrees(){
  const y = LAYOUT.lakeY;
  ctx.fillStyle='#2a9d54';
  const trees = [ [W*0.05,y-40,30], [W*0.13,y-55,40], [W*0.9,y-45,32], [W*0.8,y-35,26] ];
  for(const [x,ty,r] of trees){
    ctx.fillStyle='#7a4a1e'; ctx.fillRect(x-4,ty,8,20);
    ctx.fillStyle='#2a9d54'; ctx.beginPath(); ctx.arc(x,ty,r,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x-r*0.5,ty-r*0.3,r*0.7,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+r*0.5,ty-r*0.2,r*0.6,0,Math.PI*2); ctx.fill();
  }
  // grass strip
  ctx.fillStyle='#3fbb6a'; ctx.fillRect(0,y-4,W,8);
}
function drawBirds(dt){
  if(Math.random()<0.005 && birds.length<3){
    birds.push({x:-30, y:rand(60,H*0.3), v:rand(30,60), p:0});
  }
  ctx.strokeStyle='#0e2a3d'; ctx.lineWidth=2;
  for(let i=birds.length-1;i>=0;i--){
    const b=birds[i]; b.x += b.v*dt; b.p += dt*6;
    ctx.beginPath();
    const w = 6 + Math.sin(b.p)*3;
    ctx.moveTo(b.x-8, b.y+w); ctx.quadraticCurveTo(b.x-4, b.y-w, b.x, b.y);
    ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x+4, b.y-w, b.x+8, b.y+w);
    ctx.stroke();
    if(b.x>W+30) birds.splice(i,1);
  }
}

function drawLake(t){
  const y = LAYOUT.lakeY;
  ctx.fillStyle='#1e6fa8';
  ctx.beginPath(); ctx.moveTo(0,y);
  for(let x=0;x<=W;x+=8){
    const wave = Math.sin(x*0.03 + t*2)*3 + Math.sin(x*0.07 + t*1.3)*2;
    ctx.lineTo(x, y+wave);
  }
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
  // highlights
  ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1;
  for(let i=0;i<3;i++){
    ctx.beginPath();
    for(let x=0;x<=W;x+=8){
      const yy = y + 10 + i*18 + Math.sin(x*0.04 + t*2 + i)*2;
      x===0?ctx.moveTo(x,yy):ctx.lineTo(x,yy);
    }
    ctx.stroke();
  }
}

function drawGator(g, t){
  ctx.save(); ctx.translate(g.x, g.y);
  ctx.scale(g.dir, 1);
  const bob = Math.sin(t*1.6 + g.phase)*2;
  ctx.translate(0, bob);
  // body
  ctx.fillStyle='#2f7d3a';
  ctx.beginPath(); ctx.ellipse(0,0,42,10,0,0,Math.PI*2); ctx.fill();
  // tail
  const tw = Math.sin(t*3 + g.phase)*6;
  ctx.beginPath(); ctx.moveTo(-30,0); ctx.quadraticCurveTo(-55,-6+tw,-70,tw); ctx.quadraticCurveTo(-55,4+tw,-30,4); ctx.fill();
  // head
  ctx.beginPath(); ctx.ellipse(35,-3,20,8,0,0,Math.PI*2); ctx.fill();
  // mouth
  const m = g.mouth;
  ctx.fillStyle='#1f5a29';
  ctx.beginPath(); ctx.moveTo(20,-2); ctx.lineTo(55,-2-m*4); ctx.lineTo(55,0); ctx.lineTo(20,2); ctx.closePath(); ctx.fill();
  if(m>0.2){
    ctx.fillStyle='#c44'; ctx.beginPath(); ctx.moveTo(30,-1); ctx.lineTo(52,-1-m*3); ctx.lineTo(52,0); ctx.lineTo(30,1); ctx.closePath(); ctx.fill();
    // teeth
    ctx.fillStyle='#fff';
    for(let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(34+i*5,-1-m*3); ctx.lineTo(36+i*5,-1-m*3); ctx.lineTo(35+i*5,1-m*2); ctx.closePath(); ctx.fill(); }
  }
  // eye
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(30,-8,3.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#000'; const bl = g.blink>0?0.2:1; ctx.beginPath(); ctx.ellipse(30,-8,1.8,1.8*bl,0,0,Math.PI*2); ctx.fill();
  // ridges on back
  ctx.fillStyle='#245c2c';
  for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(i*10,-8); ctx.lineTo(i*10-4,-3); ctx.lineTo(i*10+4,-3); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

function drawBalloon(b){
  if(!b.alive && !b.popped) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.scale, b.scale);
  // string (drawn from balloon down to character waist)
  ctx.restore();
}

function drawBalloonBody(b){
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.scale, b.scale);
  // shadow/body
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.ellipse(0,0,14,18,0,0,Math.PI*2); ctx.fill();
  // highlight
  ctx.fillStyle='rgba(255,255,255,.45)';
  ctx.beginPath(); ctx.ellipse(-5,-6,4,7,0,0,Math.PI*2); ctx.fill();
  // knot
  ctx.fillStyle=b.color;
  ctx.beginPath(); ctx.moveTo(-3,17); ctx.lineTo(3,17); ctx.lineTo(0,22); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawCharacter(t){
  const c = character; if(!c) return;
  ctx.save();
  let x=c.x, y=c.y;
  // shake
  if(c.shake>0){ x += rand(-3,3)*c.shake; y += rand(-3,3)*c.shake; }
  ctx.translate(x,y);
  // fist pump bounce
  const bounce = c.fistPump>0 ? -8*Math.sin(c.fistPump*Math.PI) : 0;
  ctx.translate(0, bounce);
  const stroke='#0e2a3d';
  ctx.strokeStyle=stroke; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.fillStyle='#ffe0bd';
  // head
  ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // eyes
  const e = State.emotion;
  let eyeOpen = 1, browY=-8, mouth='smile', pupilShake=0, sweat=false;
  if(e==='calm'){ mouth='calm'; }
  if(e==='happy'){ eyeOpen=1.2; mouth='bigSmile'; }
  if(e==='scared'){ eyeOpen=1.4; mouth='o'; browY=-10; pupilShake=1; }
  if(e==='panic'){ eyeOpen=1.6; mouth='ohno'; browY=-11; pupilShake=2; sweat=true; }
  if(e==='celebrate'){ eyeOpen=0.6; mouth='bigSmile'; }
  if(e==='terrified'){ eyeOpen=1.6; mouth='ohno'; browY=-11; pupilShake=3; }
  // eye whites
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.ellipse(-6,-3,4*eyeOpen,4,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6,-3,4*eyeOpen,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#0e2a3d';
  const px=rand(-pupilShake,pupilShake), py=rand(-pupilShake,pupilShake);
  ctx.beginPath(); ctx.arc(-6+px*0.3,-3+py*0.3,1.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(6+px*0.3,-3+py*0.3,1.6,0,Math.PI*2); ctx.fill();
  // brows
  ctx.beginPath(); ctx.moveTo(-10,browY); ctx.lineTo(-2,browY+2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2,browY+2); ctx.lineTo(10,browY); ctx.stroke();
  // mouth
  ctx.beginPath();
  if(mouth==='smile'){ ctx.arc(0,4,5,0,Math.PI); }
  else if(mouth==='bigSmile'){ ctx.arc(0,3,7,0,Math.PI); }
  else if(mouth==='calm'){ ctx.moveTo(-4,5); ctx.lineTo(4,5); }
  else if(mouth==='o'){ ctx.arc(0,6,3,0,Math.PI*2); }
  else if(mouth==='ohno'){ ctx.ellipse(0,7,3,4,0,0,Math.PI*2); }
  ctx.stroke();
  if(sweat){
    ctx.fillStyle='#7ec8ff';
    ctx.beginPath(); ctx.ellipse(-14,-2 + Math.sin(t*8)*2,2,4,0,0,Math.PI*2); ctx.fill();
  }
  // body
  ctx.beginPath(); ctx.moveTo(0,16); ctx.lineTo(0,42); ctx.stroke();
  // arms
  const wave = Math.sin(t*10)* (e==='scared'||e==='panic'||e==='terrified' ? 12 : 3);
  const fist = c.fistPump>0 ? -10 : 0;
  ctx.beginPath(); ctx.moveTo(0,22); ctx.lineTo(-14, 28+wave+fist); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,22); ctx.lineTo(14, 28-wave+fist); ctx.stroke();
  // legs
  const kick = Math.sin(t*12)* (e==='scared'||e==='panic'||e==='terrified' ? 10 : 2);
  ctx.beginPath(); ctx.moveTo(0,42); ctx.lineTo(-8, 60+kick); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,42); ctx.lineTo(8, 60-kick); ctx.stroke();
  ctx.restore();
}

function drawStrings(){
  const c = character; if(!c) return;
  ctx.save();
  ctx.strokeStyle='rgba(30,50,70,.65)'; ctx.lineWidth=1;
  const wx = c.x, wy = c.y + 16; // waist
  for(const b of balloons){
    if(!b.alive) continue;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y+22*b.scale);
    const mx = (b.x+wx)/2 + Math.sin(b.stringSeed + State.time*2)*4;
    const my = (b.y+wy)/2;
    ctx.quadraticCurveTo(mx,my,wx,wy);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Update ----------
function update(dt){
  State.time += dt;
  // clouds/birds handled in draw
  // character bob
  const c = character;
  if(c){
    if(!c.falling){
      c.bob += dt;
      const bobY = Math.sin(c.bob*1.6)*4;
      // when scared, tremble; when celebrate, small hop
      let extra = 0;
      if(State.emotion==='celebrate') extra = Math.abs(Math.sin(State.time*6))*-8;
      c.y += ((c.baseY + bobY + extra) - c.y)*0.15;
      c.x += (LAYOUT.charX - c.x)*0.15;
      if(c.fistPump>0) c.fistPump = Math.max(0, c.fistPump - dt*3);
      if(c.shake>0) c.shake = Math.max(0, c.shake - dt*1.5);
    } else {
      // falling physics
      c.vy += 600*dt;
      c.y += c.vy*dt;
      c.shake = 0.6;
      if(!c.splashed && c.y >= LAYOUT.lakeY - 10){
        c.splashed = true;
        Audio.splash();
        // splash particles
        for(let i=0;i<40;i++) particles.push({x:c.x+rand(-10,10),y:LAYOUT.lakeY,vx:rand(-160,160),vy:rand(-260,-60),g:600,life:1.0,r:rand(2,4),c:'#a7dcff'});
        triggerShake(1.2, 700);
        gators.forEach(g=>{ g.mode='attack'; });
        setTimeout(()=>finishGameOver(), 1600);
      }
      if(c.splashed){
        c.y = LAYOUT.lakeY - 6 + Math.sin(State.time*10)*2;
      }
    }
  }
  // balloons positions
  const wx = c?c.x:W/2, wy = c?c.y-30:H/2;
  for(const b of balloons){
    if(b.alive){
      // sway
      const tx = wx + b.ox + Math.sin(State.time*b.swayS + b.swayP)*b.swayA;
      const ty = wy - 120 + b.oy + Math.cos(State.time*b.swayS*0.8 + b.swayP)*3;
      b.x += (tx-b.x)*0.1;
      b.y += (ty-b.y)*0.1;
      if(b.popping>0){
        b.popping += dt*4;
        b.scale += (b.targetScale - b.scale)*0.3;
        if(b.popping>=1){
          // POP
          b.alive=false; b.popped=true;
          Audio.pop();
          // particles
          for(let k=0;k<14;k++) particles.push({x:b.x,y:b.y,vx:rand(-180,180),vy:rand(-180,180),g:400,life:.7,r:rand(2,4),c:b.color});
          // string falls: create 3 tiny lines
          particles.push({x:b.x,y:b.y,vx:rand(-30,30),vy:rand(20,60),g:200,life:1.2,r:1.5,c:'#556',string:true});
          triggerShake(0.35, 180);
        }
      } else {
        b.scale += (1 - b.scale)*0.1;
      }
    }
  }
  // particles
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.life -= dt;
    p.vy += (p.g||0)*dt;
    p.x += p.vx*dt; p.y += p.vy*dt;
    if(p.life<=0) particles.splice(i,1);
  }
  // confetti
  for(let i=confetti.length-1;i>=0;i--){
    const p = confetti[i];
    p.vy += 60*dt;
    p.x += p.vx*dt; p.y += p.vy*dt; p.rot += p.vr*dt;
    if(p.y>H+20) confetti.splice(i,1);
  }
  // gators
  for(const g of gators){
    g.blink -= dt; if(g.blink<-2) g.blink = rand(2,6);
    if(g.mode==='idle'){
      g.x += g.dir* rand(4,10) *dt;
      if(g.x<40||g.x>W-40) g.dir*=-1;
      g.mouth += ((Math.sin(State.time*1.2 + g.phase)>0.9?0.3:0) - g.mouth)*0.1;
    } else {
      const tx = character? character.x : W/2;
      g.x += Math.sign(tx-g.x)*g.speed*dt;
      g.dir = tx>g.x?1:-1;
      g.mouth += (1 - g.mouth)*0.1;
    }
  }
  // clouds move handled in draw with dt via State.dt store
}

// ---------- Draw ----------
function draw(dt){
  ctx.save();
  // shake
  let sx=0, sy=0;
  if(now()<State.shakeUntil){
    const k = (State.shakeUntil - now())/700;
    sx = rand(-8,8)*State.shakeAmt*k; sy = rand(-8,8)*State.shakeAmt*k;
  }
  ctx.translate(sx,sy);

  drawSky();
  drawClouds(dt*1000);
  drawTrees();
  drawBirds(dt);
  drawLake(State.time);

  // strings first (behind balloons)
  drawStrings();

  // balloons
  for(const b of balloons){
    if(b.alive) drawBalloonBody(b);
  }
  // character
  drawCharacter(State.time);
  // gators
  for(const g of gators) drawGator(g, State.time);
  // particles
  for(const p of particles){
    ctx.globalAlpha = clamp(p.life,0,1);
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  // confetti
  for(const p of confetti){
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.c;
    ctx.fillRect(-p.r,-p.r*0.4,p.r*2,p.r*0.8); ctx.restore();
  }
  ctx.restore();
}

// ---------- Loop ----------
let lastT = 0;
function loop(t){
  const dt = Math.min(0.05, (t-lastT)/1000 || 0);
  lastT = t;
  update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}

// ---------- UI wiring ----------
function renderWord(){
  const el = $('#word'); el.innerHTML='';
  const w = State.word;
  for(let i=0;i<w.length;i++){
    const c = w[i];
    const s = document.createElement('span');
    if(c===' '){ s.className='ltr sp'; s.textContent=' '; }
    else { s.className='ltr' + (State.revealed[i]?' rev':''); s.textContent = State.revealed[i] || ' '; }
    el.appendChild(s);
  }
}
function renderKeyboard(){
  const kb = $('#keyboard'); kb.innerHTML='';
  for(let i=0;i<26;i++){
    const l = String.fromCharCode(65+i);
    const b = document.createElement('button');
    b.className='key'; b.textContent=l; b.setAttribute('aria-label',`Letter ${l}`);
    b.addEventListener('click', ()=>{ Audio.resume(); Audio.click(); guess(l); });
    kb.appendChild(b);
  }
}
function markKey(letter, good){
  const btns = $$('#keyboard .key');
  const idx = letter.charCodeAt(0)-65;
  const b = btns[idx]; if(!b) return;
  b.disabled = true; b.classList.add(good?'good':'bad');
}
function updateHUD(){
  $('#hud-score').textContent = State.score;
  $('#hud-solved').textContent = State.solved;
  $('#hud-streak').textContent = State.streak;
  $('#hud-best').textContent = Store.data.best;
  $('#hud-lives').textContent = State.lives;
}
function showHUD(v){ $('#hud').classList.toggle('hidden', !v); updateHUD(); }
function showPlayUI(v){ $('#play-ui').classList.toggle('hidden', !v); }
function hideAllScreens(){ ['#menu','#categories','#scores','#how','#round','#over'].forEach(s=>$(s).classList.add('hidden')); }
function showMenu(v){ $('#menu').classList.toggle('hidden', !v); if(v){ showHUD(false); showPlayUI(false); } }
function showRound(v, bonus){
  const el = $('#round'); el.classList.toggle('hidden', !v);
  if(v){ $('#round-title').textContent='You saved them! 🎉'; $('#round-word').textContent = State.word;
    $('#round-score').textContent = bonus; $('#round-streak').textContent = State.streak; }
}
function showOver(v){
  const el = $('#over'); el.classList.toggle('hidden', !v);
  if(v){ $('#over-word').textContent = 'Word was: ' + State.word;
    $('#over-score').textContent = State.score; $('#over-solved').textContent = State.solved; $('#over-best').textContent = Store.data.best; }
}
function showCategories(){
  hideAllScreens();
  const grid = $('#cat-grid'); grid.innerHTML='';
  for(const c of CATS){
    const b = document.createElement('button'); b.className='btn'; b.textContent = c;
    b.addEventListener('click', ()=>{ Audio.click(); State.category=c; newGame(c); });
    grid.appendChild(b);
  }
  $('#categories').classList.remove('hidden');
}
function showScores(){
  hideAllScreens();
  const list = $('#score-list'); list.innerHTML='';
  const scs = Store.data.scores||[];
  if(!scs.length){ const li=document.createElement('li'); li.textContent='No scores yet — play a round!'; list.appendChild(li); }
  scs.forEach((s,i)=>{
    const li=document.createElement('li');
    const d = new Date(s.date); const ds = d.toLocaleDateString();
    li.innerHTML = `<span>#${i+1} · ${ds}</span><span>${s.score} pts · ${s.solved} solved</span>`;
    list.appendChild(li);
  });
  $('#scores').classList.remove('hidden');
}

// Menu handlers
document.addEventListener('click', (e)=>{
  const t = e.target.closest('[data-act]'); if(!t) return;
  Audio.resume(); Audio.click();
  const act = t.dataset.act;
  if(act==='play'){ hideAllScreens(); newGame(State.category||'Random'); }
  else if(act==='categories'){ showCategories(); }
  else if(act==='scores'){ showScores(); }
  else if(act==='how'){ hideAllScreens(); $('#how').classList.remove('hidden'); }
  else if(act==='back'){ hideAllScreens(); $('#menu').classList.remove('hidden'); }
  else if(act==='home'){ hideAllScreens(); showMenu(true); Audio.stopMusic(); }
  else if(act==='next'){ hideAllScreens(); startRound(); }
  else if(act==='sound'){ toggleMute(); }
});

function toggleMute(){
  const m = !Audio.isMuted();
  Audio.setMuted(m);
  Store.data.muted = m; Store.save();
  $('#sound-label').textContent = m ? 'Off' : 'On';
  $('#btn-sound').textContent = m ? '🔇' : '🔊';
}
$('#btn-sound').addEventListener('click', (e)=>{ e.stopPropagation(); Audio.resume(); toggleMute(); });
$('#btn-contrast').addEventListener('click', (e)=>{ e.stopPropagation(); Store.data.hc = !Store.data.hc; Store.save(); document.documentElement.classList.toggle('hc', Store.data.hc); });
$('#btn-home').addEventListener('click', (e)=>{ e.stopPropagation(); hideAllScreens(); showMenu(true); Audio.stopMusic(); });

// Keyboard
window.addEventListener('keydown', (e)=>{
  if(State.scene!=='play') return;
  const k = e.key.toUpperCase();
  if(/^[A-Z]$/.test(k)){ Audio.resume(); guess(k); }
});

// Init
function init(){
  resize();
  initSky();
  computeLayout();
  // apply prefs
  Audio.setMuted(!!Store.data.muted);
  $('#sound-label').textContent = Store.data.muted ? 'Off' : 'On';
  $('#btn-sound').textContent = Store.data.muted ? '🔇' : '🔊';
  if(Store.data.hc) document.documentElement.classList.add('hc');
  updateHUD();
  showMenu(true);
  requestAnimationFrame(loop);
}
window.addEventListener('resize', ()=>{ computeLayout(); });
init();

})();
