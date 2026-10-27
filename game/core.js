// ═══════════════════════════════════════════════════════
//  DEAD ZONE — Core: settings, state, sound, player & combat
//  (shared top-level scope with sim.js / ui.js / net.js)
// ═══════════════════════════════════════════════════════
const VERSION='dz2.0';
const EYE=64,EYE_CROUCH=40,P_RADIUS=16;
const HEADSHOT_MULT=2.25;
const PLAYER_COLORS=['#4fc3f7','#81c784','#ffb74d','#e57373'];

// ── SETTINGS (persisted) ──
const CFG={sens:5,scopeSens:1,vol:70,fov:85,showFps:true,shake:'low',quality:'medium',invertY:false,name:''};
try{Object.assign(CFG,JSON.parse(localStorage.getItem('dz_cfg')||'{}'));}catch(e){}
function saveCfg(){try{localStorage.setItem('dz_cfg',JSON.stringify(CFG));}catch(e){}}
if(!CFG.name){try{const a=JSON.parse(localStorage.getItem('dz_account')||'null');CFG.name=(a&&a.name&&a.name!=='Survivor')?a.name:'Survivor'+(Math.random()*900+100|0);}catch(e){CFG.name='Survivor';}}

// ── CAMPAIGN PROGRESS (persisted) ──
const PROG={unlocked:0,best:{}};
try{Object.assign(PROG,JSON.parse(localStorage.getItem('dz_progress')||'{}'));}catch(e){}
function saveProg(){try{localStorage.setItem('dz_progress',JSON.stringify(PROG));}catch(e){}}

// ── INPUT ──
const K={},M={dx:0,dy:0,btn:{},vdx:0,vdy:0};
let locked=false;
function lockPointer(){try{const p=document.getElementById('c').requestPointerLock();if(p&&p.catch)p.catch(()=>{});}catch(e){}}

// ── GAME STATE ──
let GT=0; // game clock (seconds)
const GS={running:false,paused:false,over:false,shopOpen:false,levelDone:false,
  mode:'campaign',li:0,level:DZ.LEVELS[0],map:null,
  wave:1,wActive:false,timer:0,wTotal:0,wSpawned:0,spawnT:0,bossQ:[],wavesCleared:0,
  score:0,kills:0,money:0,xp:0,plv:1,xpNext:100,hs:0,
  pu:{},fps:0,fpsT:0,fpsN:0,levelSnap:null,bossInfo:null};
const myPid=()=>Net.role==='client'?Net.myId:'H';
const isHost=()=>Net.role!=='client';
const puOn=id=>GS.pu[id]&&GS.pu[id]>GT;

// ── SOUND (WebAudio synth, no files) ──
const Snd={
  ac:null,out:null,
  init(){if(this.ac)return;try{this.ac=new(window.AudioContext||window.webkitAudioContext)();this.out=this.ac.createGain();this.out.connect(this.ac.destination);}catch(e){}},
  v(){return CFG.vol/100;},
  n(freq,dur,type='square',vol=.3,det=0,slide){
    if(!this.ac)return;const t=this.ac.currentTime,g=this.ac.createGain(),o=this.ac.createOscillator();
    g.gain.setValueAtTime(Math.max(.0001,vol*this.v()),t);g.gain.exponentialRampToValueAtTime(.001,t+dur);g.connect(this.out);
    o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);o.detune.value=det;o.connect(g);o.start(t);o.stop(t+dur);
  },
  noise(dur,freq,vol,type='bandpass',q=.7,slide){
    if(!this.ac)return;const t=this.ac.currentTime,len=Math.floor(this.ac.sampleRate*dur);
    const buf=this.ac.createBuffer(1,len,this.ac.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.6);
    const src=this.ac.createBufferSource();src.buffer=buf;const f=this.ac.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(freq,t);if(slide)f.frequency.exponentialRampToValueAtTime(slide,t+dur);f.Q.value=q;
    const g=this.ac.createGain();g.gain.setValueAtTime(Math.max(.0001,vol*this.v()),t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    src.connect(f);f.connect(g);g.connect(this.out);src.start();
  },
  gun(def,vol=1){
    if(!def)return;const[f,v]=def.snd;
    if(def.special==='flame'){this.noise(.12,500,.12*vol,'lowpass',.5);return;}
    if(def.special==='tesla'){this.n(1600,.12,'sawtooth',.12*vol,0,300);this.noise(.1,3000,.12*vol,'highpass');return;}
    if(def.special==='rail'){this.n(2400,.4,'sine',.22*vol,0,120);this.noise(.3,1500,.3*vol);return;}
    if(def.special==='plasma'){this.n(1400,.14,'square',.1*vol,0,500);this.noise(.1,2200,.12*vol);return;}
    if(def.special==='gl'||def.special==='rocket'){this.noise(.3,300,.4*vol,'lowpass');this.n(90,.25,'sine',.2*vol);return;}
    this.noise(.18,f,v*vol);this.n(f*.12+40,.08,'sine',v*.5*vol);
  },
  at(x,y){const d=Math.hypot(x-player.x,y-player.y);return Math.max(0,1-d/1800);},
  play(t,vol=1){
    if(!this.ac||vol<=0.01)return;
    switch(t){
      case'reload':this.n(200,.08,'sine',.18*vol);setTimeout(()=>this.n(320,.06,'sine',.14*vol),140);break;
      case'empty':this.n(80,.07,'sawtooth',.14*vol);break;
      case'buy':this.n(440,.05,'sine',.18);setTimeout(()=>this.n(660,.05,'sine',.18),55);break;
      case'pickup':this.n(550,.07,'sine',.18);setTimeout(()=>this.n(770,.07,'sine',.18),75);break;
      case'hit':this.n(110,.1,'sawtooth',.22);break;
      case'death':this.n(80,.5,'sawtooth',.28);this.n(60,.8,'sine',.18);break;
      case'zatk':this.n(100,.18,'sawtooth',.25*vol);break;
      case'zdie':this.n(140,.28,'sawtooth',.26*vol,Math.random()*200-100,60);break;
      case'groan':this.n(70+Math.random()*40,.6,'sawtooth',.07*vol,0,50+Math.random()*30);break;
      case'headshot':this.n(1100,.05,'square',.24);setTimeout(()=>this.n(1500,.08,'square',.2),45);break;
      case'hitmark':this.n(900,.03,'square',.07);break;
      case'wave':this.n(220,.09,'square',.18);setTimeout(()=>this.n(330,.09,'square',.18),100);setTimeout(()=>this.n(440,.18,'square',.18),200);break;
      case'ach':this.n(440,.09,'sine',.18);setTimeout(()=>this.n(550,.09,'sine',.18),70);setTimeout(()=>this.n(660,.13,'sine',.18),140);break;
      case'boss':for(let i=0;i<3;i++)setTimeout(()=>this.n(80,.28,'sawtooth',.35),i*180);break;
      case'xplode':this.noise(.9,700,.6*vol,'lowpass',.6,80);this.n(55,.6,'sine',.4*vol);break;
      case'powerup':[523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.n(f,.12,'triangle',.2),i*70));break;
      case'levelup':[392,523,659].forEach((f,i)=>setTimeout(()=>this.n(f,.14,'triangle',.2),i*90));break;
      case'victory':[523,659,784,659,784,1047].forEach((f,i)=>setTimeout(()=>this.n(f,.22,'triangle',.22),i*150));break;
      case'spit':this.noise(.25,900,.18*vol,'bandpass',2,300);break;
      case'scream':this.n(900,.8,'sawtooth',.14*vol,0,1600);this.n(1200,.7,'square',.06*vol,0,700);break;
      case'slam':this.noise(.6,200,.5*vol,'lowpass');this.n(40,.5,'sine',.4*vol);break;
      case'melee':this.noise(.15,1800,.2,'highpass',1,600);break;
      case'blink':this.n(1800,.2,'sine',.1*vol,0,200);break;
      case'nade':this.n(300,.05,'square',.1);break;
    }
  }
};

// ── WEAPON INSTANCES ──
function newWeapon(id){const d=DZ.WEAPONS[id];return{id,mag:d.mag,res:d.ammo,up:{damage:0,fireRate:0,reload:0,mag:0,crit:0},tier:0,optic:null,laser:false,zs:0};}
// effective optic = the better of the built-in one and a bought one
function opticOf(w){const d=DZ.WEAPONS[w.id],a=d.scope,b=w.optic;if(!b)return a||null;if(!a)return b;return DZ.OPTICS[b].rank>DZ.OPTICS[a].rank?b:a;}
function wstats(w){
  const d=DZ.WEAPONS[w.id],u=w.up,T=DZ.TIERS[w.tier||0],pk=player.perks;
  const opt=opticOf(w),zoom=opt?(opt===d.scope?d.zoom:Math.max(d.zoom,DZ.OPTICS[opt].zoom)):d.zoom;
  return{
    dmg:d.dmg*(1+u.damage*.2)*T.dmg,
    rate:d.rate/(1+u.fireRate*.1)/(pk.has('rapidFire')?1.2:1),
    reload:d.reload*(1-u.reload*.12)*(pk.has('quickHands')?.7:1),
    mag:Math.max(1,Math.round(d.mag*(1+u.mag*.2)*T.mag)),
    maxRes:Math.round(d.ammo*T.mag*1.5),
    crit:.05+u.crit*.05+(pk.has('luckyShot')?.1:0),
    spread:d.spread*(w.laser?.6:1),
    zoom,optic:opt,
    zMin:opt==='sniper'?4:zoom,zMax:opt==='sniper'?Math.max(zoom,8)*1.25:zoom,
  };
}

// ── PLAYER ──
const player={
  x:1600,y:1600,z:0,vz:0,vx:0,vy:0,angle:0,pitch:0,recoil:0,
  hp:100,maxHp:100,armor:0,maxArmor:100,stamina:100,
  inv:[],wi:0,reloading:false,reloadStart:0,reloadDur:0,nextShot:0,burstLeft:0,burstNext:0,spin:0,
  ads:1,crouchF:0,sprint:false,moving:false,grounded:true,bob:0,bobAmt:0,footT:0,lastDmg:-99,
  switchT:-9,meleeT:-9,grenades:2,perks:new Set(),buffs:{},dead:false,respawnT:0,shots:0,
  get w(){return this.inv[this.wi]||null;},
  get viewPitch(){return Math.max(-1.45,Math.min(1.45,this.pitch+this.recoil));},
  get eye(){return this.z+EYE+(EYE_CROUCH-EYE)*this.crouchF;},
};
let shakeMag=0;
function addShake(a){const m=CFG.shake==='off'?0:CFG.shake==='low'?.45:1;shakeMag=Math.min(1.2,shakeMag+a*m);}

function resetPlayer(full){
  const sp=GS.map.pSpawn;
  Object.assign(player,{x:sp.x,y:sp.y,z:0,vz:0,vx:0,vy:0,angle:-Math.PI/2,pitch:0,recoil:0,stamina:100,reloading:false,burstLeft:0,spin:0,ads:1,crouchF:0,dead:false,respawnT:0,lastDmg:-99,switchT:-9,meleeT:-9,nextShot:0});
  if(full){player.perks=new Set();player.maxHp=100;player.maxArmor=100;player.grenades=2;player.buffs={};player.armor=0;}
  player.hp=player.maxHp;
}

function startReload(){
  const w=player.w;if(!w||player.reloading||player.dead)return;
  const st=wstats(w);if(w.mag>=st.mag||w.res<=0)return;
  player.reloading=true;player.reloadStart=GT;player.reloadDur=st.reload/1000;player.burstLeft=0;
  Snd.play('reload');
}
function finishReload(){
  const w=player.w;player.reloading=false;if(!w)return;
  const st=wstats(w),give=Math.min(st.mag-w.mag,w.res);w.mag+=give;w.res-=give;hudDirty=true;
}
function switchWeapon(i){
  if(i<0||i>=player.inv.length||i===player.wi&&GT-player.switchT>.4)return;
  player.wi=i;player.reloading=false;player.burstLeft=0;player.spin=0;player.switchT=GT;hudDirty=true;
}

// ── DAMAGE TAKEN ──
let dmgDirs=[];
function localHurt(d,sx,sy){
  if(player.dead||!GS.running||GS.levelDone)return;
  if(puOn('godmode')||GT<(player.shield||0))return;
  if(player.armor>0){const b=Math.min(player.armor,d*.6);player.armor-=b;d-=b;}
  player.hp-=d;player.lastDmg=GT;
  flashDmg();Snd.play('hit');addShake(Math.min(.5,d*.02));
  if(sx!=null){dmgDirs.push({a:Math.atan2(sy-player.y,sx-player.x),t:1.2});if(dmgDirs.length>6)dmgDirs.shift();}
  if(player.hp<=0){player.hp=0;playerDown();}
  hudDirty=true;
}
function heal(a){player.hp=Math.min(player.maxHp,player.hp+a);flashHeal();hudDirty=true;}
function addArmor(a){player.armor=Math.min(player.maxArmor,player.armor+a);hudDirty=true;}

// ── RAY TESTS ──
function raySphere(ox,oy,oz,dx,dy,dz,cx,cy,cz,r){
  const lx=ox-cx,ly=oy-cy,lz=oz-cz,b=lx*dx+ly*dy+lz*dz,c=lx*lx+ly*ly+lz*lz-r*r,h=b*b-c;
  if(h<0)return-1;const t=-b-Math.sqrt(h);return t>=0?t:-1;
}
function rayCyl(ox,oy,oz,dx,dy,dz,cx,cy,r,z0,z1){
  const lx=ox-cx,ly=oy-cy,a=dx*dx+dy*dy;let best=-1;
  if(a>1e-9){
    const b=lx*dx+ly*dy,c=lx*lx+ly*ly-r*r,h=b*b-a*c;
    if(h>=0){const t=(-b-Math.sqrt(h))/a;if(t>=0){const z=oz+dz*t;if(z>=z0&&z<=z1)best=t;}}
  }
  if(Math.abs(dz)>1e-6){
    for(const zp of[z1,z0]){const t=(zp-oz)/dz;if(t<0)continue;const x=lx+dx*t,y=ly+dy*t;if(x*x+y*y<=r*r&&(best<0||t<best))best=t;}
  }
  return best;
}
// world-space head position of a zombie (model gives offsets)
function zHead(z){const m=z.model;const hx=m?m.headX:0,hy=m?m.headY:z.type.h*.85;return[z.x+Math.cos(z.a)*hx,z.y+Math.sin(z.a)*hx,(z.air||0)+hy];}
// returns {t, head} or null
function rayZombie(z,ox,oy,oz,dx,dy,dz){
  if(z.dying)return null;
  const m=z.model,hr=(m?m.headR:z.type.h*.09)*1.25,[hx,hy,hz]=zHead(z);
  const th=raySphere(ox,oy,oz,dx,dy,dz,hx,hy,hz,hr);
  const top=Math.max(8,hz-hr*.7),br=z.type.crawl?z.r*1.1:z.r*.85;
  const tb=rayCyl(ox,oy,oz,dx,dy,dz,z.x,z.y,br,(z.air||0),(z.air||0)+top);
  if(th>=0&&(tb<0||th<=tb+hr))return{t:th,head:true};
  if(tb>=0)return{t:tb,head:false};
  return null;
}

// ── FIRING ──
function muzzleWorld(){
  const a=player.angle,p=player.viewPitch,cp=Math.cos(p),ads=player.ads;
  const right=10*ads,down=8*ads+2;
  return[player.x+Math.cos(a)*cp*28+Math.cos(a+1.5708)*right,player.y+Math.sin(a)*cp*28+Math.sin(a+1.5708)*right,player.eye+Math.sin(p)*28-down];
}
function aimDir(spread){
  const yaw=player.angle+(Math.random()-.5)*2*spread,pt=player.viewPitch+(Math.random()-.5)*2*spread;
  return[Math.cos(pt)*Math.cos(yaw),Math.cos(pt)*Math.sin(yaw),Math.sin(pt)];
}
function curSpread(st,def){
  let s=st.spread;const ads=player.ads<.5;
  if(ads)s*=def.cat==='Shotgun'?.7:.3;
  if(player.crouchF>.5)s*=.7;if(player.moving&&!ads)s*=1.4;if(player.sprint)s*=2.4;if(!player.grounded)s*=2;
  return s;
}
// nearest blocking distance along a ray (walls, floor, ceiling)
function rayWorld(ox,oy,oz,dx,dy,dz,max){
  let t=max,n=null,kind='none';
  const w=Nav.rayWalls(ox,oy,oz,dx,dy,dz,max);if(w){t=w.t;n=w.n;kind='wall';}
  if(dz<-1e-6){const tf=-oz/dz;if(tf<t){t=tf;n=[0,1,0];kind='floor';}}
  const ceil=GS.level.theme.indoor;if(ceil&&dz>1e-6){const tc=(ceil-oz)/dz;if(tc<t){t=tc;n=[0,-1,0];kind='ceil';}}
  return{t,n,kind};
}
function fireHitscan(st,def,w){
  const sp=curSpread(st,def),eye=[player.x,player.y,player.eye],mz=muzzleWorld();
  const special=def.special;
  for(let p=0;p<def.pellets;p++){
    const d=aimDir(sp),wr=rayWorld(eye[0],eye[1],eye[2],d[0],d[1],d[2],6000);
    const hits=[];
    for(const z of zombies){const h=rayZombie(z,eye[0],eye[1],eye[2],d[0],d[1],d[2]);if(h&&h.t<wr.t)hits.push({z,t:h.t,head:h.head});}
    hits.sort((a,b)=>a.t-b.t);
    const n=Math.min(hits.length,1+def.pierce);let endT=wr.t;
    for(let i=0;i<n;i++){
      const h=hits[i],fall=h.t>def.range?Math.max(.4,1-(h.t-def.range)/def.range*.6):1;
      dealDamage(h.z,st.dmg*fall*Math.pow(.75,i)*(1+Math.random()*.15),h.head,st,{wid:w.id});
      const hx=eye[0]+d[0]*h.t,hy=eye[1]+d[1]*h.t,hz=eye[2]+d[2]*h.t;
      GFX.emit(special==='plasma'?'plasma':'blood',hx,hy,hz,special==='plasma'?6:5);
      if(i===n-1&&n<=def.pierce)endT=wr.t;else if(i===n-1)endT=h.t;
    }
    const ex=eye[0]+d[0]*endT,ey=eye[1]+d[1]*endT,ez=eye[2]+d[2]*endT;
    if(special==='rail'){GFX.beam(mz[0],mz[1],mz[2],ex,ey,ez,'#00ffcc',2.4,.5);for(let k=0;k<12;k++){const f=Math.random();GFX.emit('tesla',mz[0]+(ex-mz[0])*f,mz[1]+(ey-mz[1])*f,mz[2]+(ez-mz[2])*f,1);}}
    else if(special==='plasma')GFX.beam(mz[0],mz[1],mz[2],ex,ey,ez,'#ff55ff',1.3,.12);
    else if(Math.random()<(def.pellets>1?.35:.85))GFX.tracer(mz[0],mz[1],mz[2],ex,ey,ez,'#ffe2a0',.06);
    if(wr.kind!=='none'&&endT===wr.t){
      GFX.emit(special==='plasma'?'plasma':'spark',ex-d[0]*2,ey-d[1]*2,ez-d[2]*2,special==='rail'?10:3);
      if(Math.random()<.5)GFX.emit('dust',ex-d[0]*3,ey-d[1]*3,ez-d[2]*3,1);
    }
  }
}
function fireFlame(st,def){
  const eye=[player.x,player.y,player.eye],mz=muzzleWorld(),d=aimDir(.02);
  for(let i=0;i<3;i++)GFX.emit('flame',mz[0]+d[0]*10,mz[1]+d[1]*10,mz[2]+d[2]*10,1,{dir:d,v:rnd(620,760),jit:55,life:1.1});
  const range=def.range,cosA=Math.cos(.17);
  for(const z of zombies){
    if(z.dying)continue;const dx=z.x-eye[0],dy=z.y-eye[1],dz=(z.air||0)+z.type.h*.5-eye[2],dist=Math.hypot(dx,dy,dz);
    if(dist>range+z.r||dist<1)continue;
    if((dx*d[0]+dy*d[1]+dz*d[2])/dist<cosA&&dist>z.r*2)continue;
    const wr=Nav.rayWalls(eye[0],eye[1],eye[2],dx/dist,dy/dist,dz/dist,dist);if(wr)continue;
    dealDamage(z,st.dmg,false,st,{burn:true,wid:'flamethrower'});
  }
}
function fireTesla(st,def){
  const eye=[player.x,player.y,player.eye],mz=muzzleWorld(),d=aimDir(0);
  let first=null,bt=def.range;
  for(const z of zombies){const h=rayZombie(z,eye[0],eye[1],eye[2],d[0],d[1],d[2]);if(h&&h.t<bt){bt=h.t;first=z;}}
  if(!first){ // forgiving aim: nearest zombie within a narrow cone
    let bd=1e9;for(const z of zombies){if(z.dying)continue;const dx=z.x-eye[0],dy=z.y-eye[1],dz=(z.air||0)+z.type.h*.6-eye[2],dist=Math.hypot(dx,dy,dz);
      if(dist>def.range)continue;if((dx*d[0]+dy*d[1]+dz*d[2])/dist<Math.cos(.1))continue;if(Nav.rayWalls(eye[0],eye[1],eye[2],dx/dist,dy/dist,dz/dist,dist))continue;if(dist<bd){bd=dist;first=z;}}
  }
  if(!first){const wr=rayWorld(eye[0],eye[1],eye[2],d[0],d[1],d[2],260);zap(mz,[eye[0]+d[0]*wr.t,eye[1]+d[1]*wr.t,eye[2]+d[2]*wr.t]);return;}
  const hit=new Set();let cur=first,from=mz,dmg=st.dmg;
  for(let i=0;i<6&&cur;i++){
    hit.add(cur);const to=[cur.x,cur.y,(cur.air||0)+cur.type.h*.6];zap(from,to);GFX.emit('tesla',to[0],to[1],to[2],6);
    dealDamage(cur,dmg,false,st,{wid:'tesla'});dmg*=.82;from=to;
    let nxt=null,nd=270;for(const z of zombies){if(z.dying||hit.has(z))continue;const dd=Math.hypot(z.x-cur.x,z.y-cur.y);if(dd<nd&&Nav.pathClear(cur.x,cur.y,z.x,z.y,2)){nd=dd;nxt=z;}}
    cur=nxt;
  }
}
function zap(a,b){
  let p=a;const n=4;
  for(let i=1;i<=n;i++){const t=i/n,j=i<n?18:0;const q=[a[0]+(b[0]-a[0])*t+rnd(-j,j),a[1]+(b[1]-a[1])*t+rnd(-j,j),a[2]+(b[2]-a[2])*t+rnd(-j,j)];GFX.beam(p[0],p[1],p[2],q[0],q[1],q[2],'#88e8ff',1.1,.12);p=q;}
}
function launch(kind,st,def){
  const mz=muzzleWorld(),d=aimDir(curSpread(st,def));
  const sp=kind==='rocket'?1500:kind==='gl'?1150:720,up=kind==='rocket'?0:kind==='gl'?110:240;
  projectiles.push({kind,x:mz[0],y:mz[1],z:mz[2],vx:d[0]*sp+player.vx*.4,vy:d[1]*sp+player.vy*.4,vz:d[2]*sp+up,
    life:kind==='nade'?2.2:6,dmg:kind==='nade'?420:st.dmg,r:kind==='nade'?220:def.splash||180,owner:myPid(),mesh:GFX.projMesh(kind),bounce:kind==='nade'});
}

function tryFire(){
  const w=player.w;if(!w||player.dead||player.reloading||GT-player.switchT<.35||GT-player.meleeT<.4)return false;
  const def=DZ.WEAPONS[w.id],st=wstats(w);
  if(def.special==='minigun'&&player.spin<1)return false;
  if(GT<player.nextShot)return false;
  if(w.mag<=0){Snd.play('empty');player.nextShot=GT+.25;if(w.res>0)startReload();return false;}
  player.nextShot=GT+st.rate/1000;w.mag--;player.shots++;hudDirty=true;
  Snd.gun(def);WeaponVM.onFire(def);
  const mz=muzzleWorld();GFX.muzzleFlash(mz[0],mz[1],mz[2],def.special==='plasma'?'#ff66ff':def.special==='tesla'||def.special==='rail'?'#66ddff':'#ffaa55');
  if(def.rec>=12)addShake(def.rec*.012);
  switch(def.special){
    case'flame':fireFlame(st,def);break;
    case'tesla':fireTesla(st,def);break;
    case'gl':launch('gl',st,def);break;
    case'rocket':launch('rocket',st,def);break;
    default:fireHitscan(st,def,w);
  }
  // kick the view only after the shot has left the barrel
  const k=player.ads<.5?.5:1;
  player.recoil+=def.rec*.0085*k*(player.crouchF>.5?.75:1);
  player.angle+=(Math.random()-.5)*def.rec*.0016*k;
  if(w.mag===0&&w.res>0&&def.burst===1)setTimeout(()=>{if(player.w===w&&w.mag===0)startReload();},250);
  return true;
}
function onTriggerDown(){
  const w=player.w;if(!w)return;const def=DZ.WEAPONS[w.id];
  if(def.auto)return;
  if(def.burst>1){if(GT>=player.nextShot&&tryFire()){player.burstLeft=def.burst-1;player.burstNext=GT+.065;player.nextShot=GT+wstats(w).rate/1000;}}
  else tryFire();
}
function throwGrenade(){
  if(player.dead||player.grenades<=0||GT-player.meleeT<.4)return;
  player.grenades--;player.meleeT=GT-.1;launch('nade',{dmg:420,spread:0},{splash:220,cat:''});Snd.play('nade');hudDirty=true;
}
function melee(){
  if(player.dead||GT-player.meleeT<.6)return;
  player.meleeT=GT;Snd.play('melee');
  const fx=Math.cos(player.angle),fy=Math.sin(player.angle);
  for(const z of zombies){
    if(z.dying)continue;const dx=z.x-player.x,dy=z.y-player.y,d=Math.hypot(dx,dy);
    if(d>z.r+70)continue;if((dx*fx+dy*fy)/(d||1)<.55)continue;
    dealDamage(z,150*(1+(player.perks.has('ironBody')?.2:0)),false,{crit:0},{wid:'knife',push:[fx*22,fy*22]});
    GFX.emit('blood',z.x,z.y,(z.air||0)+z.type.h*.6,8);
  }
}

// Apply our hit locally (solo/host) or send it to the host (client). Damage numbers show instantly either way.
function dealDamage(z,d,head,st,o){
  o=o||{};let kind='normal';
  if(head){d*=HEADSHOT_MULT*(player.perks.has('deadeye')?1.5:1);kind='head';}
  else if(Math.random()<(st.crit||0)){d*=1.5;kind='crit';}
  if(puOn('instakill'))kind=kind==='normal'?'crit':kind;
  const shown=Math.round(d*(z.type.armor&&!head?z.type.armor:1));
  if(o.wid!=='flamethrower'||Math.random()<.25)dmgNum(z.x,z.y,(z.air||0)+z.type.h+10,kind==='head'?'HEADSHOT '+shown:shown,kind==='head'?'#ff4444':kind==='crit'?'#ffdd00':'#ffaaaa',kind!=='normal');
  if(head){GS.hs++;ach('headshot_10',GS.hs>=10);Snd.play('headshot');}else Snd.play('hitmark');
  showHit(kind);
  if(isHost())hostDamage(z,d,head,myPid(),o);
  else{Net.send({t:'hit',z:z.id,d:Math.round(d),h:head?1:0,b:o.burn?1:0,px:o.push?o.push[0]|0:0,py:o.push?o.push[1]|0:0});z.flashT=.08;}
}

// ── PROJECTILES fired by this player ──
let projectiles=[];
function updProjectiles(dt){
  for(const p of projectiles){
    if(p.dead)continue;p.life-=dt;
    const ox=p.x,oy=p.y,oz=p.z;
    if(p.kind!=='rocket')p.vz-=900*dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    const dx=p.x-ox,dy=p.y-oy,dz=p.z-oz,len=Math.hypot(dx,dy,dz)||1;
    const wr=Nav.rayWalls(ox,oy,oz,dx/len,dy/len,dz/len,len);
    let boom=p.life<=0;
    if(wr){if(p.bounce){p.x=ox;p.y=oy;p.z=oz;const n=wr.n;if(n[0])p.vx*=-.45;if(n[2])p.vy*=-.45;if(n[1])p.vz*=-.45;}else{boom=true;p.x=ox+dx/len*wr.t;p.y=oy+dy/len*wr.t;p.z=oz+dz/len*wr.t;}}
    if(p.z<=2){if(p.bounce){p.z=2;p.vz=Math.abs(p.vz)*.4;p.vx*=.65;p.vy*=.65;}else boom=true;}
    const ceil=GS.level.theme.indoor;if(ceil&&p.z>ceil-4){if(p.bounce){p.z=ceil-4;p.vz=-Math.abs(p.vz)*.4;}else boom=true;}
    if(!p.bounce)for(const z of zombies){if(z.dying)continue;if(Math.hypot(z.x-p.x,z.y-p.y)<z.r+6&&p.z>(z.air||0)-4&&p.z<(z.air||0)+z.type.h+6){boom=true;break;}}
    if(p.kind==='rocket'){GFX.emit('smoke',p.x,p.y,p.z,1,{size:.5,life:.6});GFX.emit('fire',p.x,p.y,p.z,1,{size:.5});}
    else if(p.kind==='gl'&&Math.random()<.5)GFX.emit('smoke',p.x,p.y,p.z,1,{size:.3,life:.4});
    if(p.mesh){p.mesh.position.set(p.x,p.z,p.y);if(p.kind==='rocket')p.mesh.rotation.set(0,-Math.atan2(p.vy,p.vx),Math.atan2(p.vz,Math.hypot(p.vx,p.vy)),'YZX');}
    if(boom){p.dead=true;GFX.remove(p.mesh);explode(p.x,p.y,Math.max(2,p.z),p.r,p.dmg,p.owner,true);}
  }
  projectiles=projectiles.filter(p=>!p.dead);
}
// visual + (host) damage. mine=true when this peer caused it.
function explode(x,y,z,r,dmg,owner,mine){
  boomFx(x,y,z,r);
  if(isHost())hostExplosion(x,y,z,r,dmg,owner);
  else if(mine)Net.send({t:'boom',x:x|0,y:y|0,z:z|0,r,d:Math.round(dmg)});
}
function boomFx(x,y,z,r){
  GFX.emit('boom',x,y,z+10,Math.round(18+r*.08));GFX.emit('smoke',x,y,z+20,14,{spread:r*.25});GFX.emit('spark',x,y,z+10,24,{spd:2});
  GFX.explosionLight(x,y,z);Snd.play('xplode',Snd.at(x,y));
  const d=Math.hypot(x-player.x,y-player.y);if(d<r*3)addShake(Math.max(.15,1-d/(r*3))*.9);
}

// ── POWER-UPS (applied on every peer) ──
function localPowerup(id,by){
  const P=DZ.POWERUPS[id];if(!P)return;
  Snd.play('powerup');showToast(P.icon+' '+P.name+(by?` · ${by}`:''),P.color,2600);
  if(P.dur)GS.pu[id]=GT+P.dur;
  if(id==='maxammo'){for(const w of player.inv){const st=wstats(w);w.res=Math.max(w.res,st.maxRes);w.mag=st.mag;}player.grenades=Math.max(player.grenades,4);}
  if(id==='nuke'){addMoney(400);flashScreen('#ffffff');}
  hudDirty=true;
}
function addMoney(m){GS.money+=Math.round(m);ach('money_5000',GS.money>=5000);hudDirty=true;}
// reward for a kill credited to us
function onKill(rew,xp,head,tid){
  addMoney(rew*(puOn('double')?2:1));GS.score+=rew;GS.kills++;addXP(xp);
  ach('first_kill',GS.kills>=1);ach('kills_50',GS.kills>=50);ach('kills_100',GS.kills>=100);ach('kills_500',GS.kills>=500);
  if(tid==='boss')ach('boss_kill',true);if(tid==='titan')ach('titan_kill',true);
}
function addXP(a){
  GS.xp+=a;
  while(GS.xp>=GS.xpNext){GS.xp-=GS.xpNext;GS.plv++;GS.xpNext=Math.floor(GS.xpNext*1.3);
    showToast('LEVEL UP! '+GS.plv,'#aa44ff');player.maxHp+=5;player.hp=Math.min(player.maxHp,player.hp+20);
    ach('level_5',GS.plv>=5);ach('level_10',GS.plv>=10);Snd.play('levelup');}
  hudDirty=true;
}
// pickups granted to us by the host
function localPickup(type,val){
  const scav=player.perks.has('scavenger')?2:1;
  switch(type){
    case'health':heal(val);dmgNum(player.x,player.y,player.eye-10,'+'+val+' HP','#44ff88');GFX.emit('heal',player.x,player.y,30,10);break;
    case'armor':addArmor(val);dmgNum(player.x,player.y,player.eye-10,'+'+val+' ARMOR','#4488ff');break;
    case'ammo':for(const w of player.inv){const st=wstats(w);w.res=Math.min(st.maxRes*2,w.res+Math.ceil(st.mag*.8*scav));}dmgNum(player.x,player.y,player.eye-10,'+AMMO','#ffdd44');break;
    case'money':addMoney(val*scav);dmgNum(player.x,player.y,player.eye-10,'$'+val*scav,'#ffdd00');break;
    case'grenade':player.grenades+=2;dmgNum(player.x,player.y,player.eye-10,'+2 GRENADES','#88aa55');break;
    case'token':{const w=player.w;if(!w)break;const c=Object.keys(w.up).filter(k=>w.up[k]<5);if(c.length){const k=c[Math.floor(Math.random()*c.length)];w.up[k]++;showToast('FREE UPGRADE: '+w.name+' '+DZ.UPGRADES[k].name,'#cc66ff');}else addMoney(1500);break;}
    case'weapon':{const own=new Set(player.inv.map(w=>w.id));const pool=Object.keys(DZ.WEAPONS).filter(id=>!own.has(id));
      if(pool.length&&player.inv.length<9){const id=pool[Math.floor(Math.random()*pool.length)];player.inv.push(newWeapon(id));showToast('🎁 '+DZ.WEAPONS[id].name+' [slot '+player.inv.length+']','#ff8800',2600);}
      else{for(const w of player.inv)w.res=Math.max(w.res,wstats(w).maxRes);showToast('🎁 Ammo restocked','#ff8800');}break;}
  }
  Snd.play('pickup');hudDirty=true;
}

// ── PLAYER UPDATE ──
function updatePlayer(dt){
  const P=player;
  // look
  const zoom=curZoom(),sens=CFG.sens*.00065/Math.pow(zoom,.92)*(zoom>1.3?CFG.scopeSens:1);
  P.angle+=M.dx*sens;P.pitch-=(CFG.invertY?-1:1)*M.dy*sens;
  P.pitch=Math.max(-1.45,Math.min(1.45,P.pitch));
  M.vdx=M.dx;M.vdy=M.dy;M.dx=0;M.dy=0;
  P.recoil-=P.recoil*Math.min(1,dt*7);
  if(P.dead){P.vx=P.vy=0;return;}
  const w=P.w,def=w&&DZ.WEAPONS[w.id];
  // movement
  const inputOk=!GS.shopOpen&&!GS.paused;
  let fx=0,fy=0;
  if(inputOk){if(K.KeyW)fx+=1;if(K.KeyS)fx-=.7;if(K.KeyA)fy-=.85;if(K.KeyD)fy+=.85;}
  P.sprint=inputOk&&K.ShiftLeft&&K.KeyW&&P.stamina>0&&P.ads>.6;
  const crouch=inputOk&&(K.KeyC||K.ControlLeft);
  P.crouchF+=((crouch?1:0)-P.crouchF)*Math.min(1,dt*10);
  let spd=P.sprint?330*(P.perks.has('marathon')?1.2:1):crouch?110:192;
  if(P.ads<.5)spd*=.6;if(def&&def.special==='minigun'&&P.spin>0)spd*=.65;
  if(puOn('speed')||(P.buffs.speed&&P.buffs.speed>GT))spd*=1.35;
  const ca=Math.cos(P.angle),sa=Math.sin(P.angle);
  const tx=(ca*fx-sa*fy)*spd,ty=(sa*fx+ca*fy)*spd;
  const acc=P.grounded?12:3;P.vx+=(tx-P.vx)*Math.min(1,dt*acc);P.vy+=(ty-P.vy)*Math.min(1,dt*acc);
  P.x+=P.vx*dt;P.y+=P.vy*dt;
  // zombies are solid: slide around them instead of walking through
  for(const z of zombies){if(z.dying||(z.air||0)>20)continue;const dx=P.x-z.x,dy=P.y-z.y,mn=z.r+P_RADIUS-2;if(Math.abs(dx)>mn||Math.abs(dy)>mn)continue;const d=Math.hypot(dx,dy);if(d<mn&&d>0){P.x=z.x+dx/d*mn;P.y=z.y+dy/d*mn;}}
  Nav.resolve(P,P_RADIUS);
  if(P.sprint)P.stamina=Math.max(0,P.stamina-dt*(P.perks.has('marathon')?14:28));else P.stamina=Math.min(100,P.stamina+dt*14);
  // jump
  if(inputOk&&K.Space&&P.grounded){P.vz=290;P.grounded=false;}
  if(!P.grounded){P.vz-=900*dt;P.z+=P.vz*dt;if(P.z<=0){P.z=0;P.vz=0;P.grounded=true;}}
  P.moving=Math.hypot(P.vx,P.vy)>20;
  if(P.moving&&P.grounded){P.bob+=dt*(P.sprint?10:crouch?4:7);P.bobAmt=Math.min(1,P.bobAmt+dt*5);P.footT-=dt;if(P.footT<=0){P.footT=P.sprint?.28:.45;Snd.n(crouch?55:75,.04,'sine',.035);}}
  else P.bobAmt=Math.max(0,P.bobAmt-dt*8);
  // aim
  const wantAds=inputOk&&M.btn[2]&&!P.sprint;
  P.ads+=((wantAds?0:1)-P.ads)*Math.min(1,dt*(wantAds?11:9));
  // weapon timers
  if(P.reloading&&GT-P.reloadStart>=P.reloadDur)finishReload();
  if(def&&def.special==='minigun'){const hold=inputOk&&M.btn[0];P.spin=Math.max(0,Math.min(1,P.spin+(hold?dt/.6:-dt/.8)));}
  if(P.burstLeft>0&&GT>=P.burstNext){P.nextShot=0;if(tryFire()){P.burstLeft--;P.burstNext=GT+.065;P.nextShot=GT+wstats(w).rate/1000;}else P.burstLeft=0;}
  if(inputOk&&locked&&M.btn[0]&&def&&def.auto)tryFire();
  // health regen
  const sw=P.perks.has('secondWind');
  if(GT-P.lastDmg>(sw?2:5)&&P.hp<P.maxHp){P.hp=Math.min(P.maxHp,P.hp+dt*(sw?12:4));hudDirty=true;}
  if(P.buffs.regen&&P.buffs.regen>GT&&P.hp<P.maxHp){P.hp=Math.min(P.maxHp,P.hp+dt*2);}
  // lava & poison clouds
  if(P.z<6){const h=Nav.hazardAt(P.x,P.y);if(h){P.hazT=(P.hazT||0)+dt;if(P.hazT>.25){localHurt(h*P.hazT);P.hazT=0;GFX.emit('fire',P.x,P.y,5,3);}}}
  for(const c of clouds){if(Math.hypot(c.x-P.x,c.y-P.y)<c.r){P.cloudT=(P.cloudT||0)+dt;if(P.cloudT>.5){localHurt(c.dps*P.cloudT);P.cloudT=0;}break;}}
}
function curZoom(){
  const w=player.w;if(!w)return 1;const st=wstats(w);
  const z=st.optic==='sniper'?(w.zs||st.zoom):st.zoom;
  return 1+(z-1)*(1-player.ads);
}
function rnd(a,b){return a+Math.random()*(b-a);}
