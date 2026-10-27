// ═══════════════════════════════════════════════════════
//  DEAD ZONE — World simulation
//  The host (or solo player) runs zombies, waves, drops and
//  hazards. Clients mirror it from 20 Hz snapshots.
// ═══════════════════════════════════════════════════════
let zombies=[],pickups=[],clouds=[],zproj=[];
const peers=new Map(); // pid -> remote player {pid,name,color,x,y,z,a,p,w,hp,mhp,dead,sh,cr,avatar,...}
let zid=1,pkid=1,projid=1,fieldT=0;

function aliveTargets(){
  const out=[];
  if(!player.dead)out.push({pid:myPid(),x:player.x,y:player.y,z:player.z});
  for(const p of peers.values())if(!p.dead&&p.ready)out.push({pid:p.pid,x:p.x,y:p.y,z:p.z||0});
  return out;
}
function nPlayers(){let n=1;for(const p of peers.values())if(p.ready)n++;return n;}
function effWave(){return GS.mode==='endless'?GS.wave+Math.round(GS.level.diff*.5):GS.level.diff+GS.wave;}

// ── ZOMBIE (host-simulated) ──
class Zombie{
  constructor(x,y,tid,id){
    const T=DZ.ZTYPES[tid],ew=effWave(),np=nPlayers();
    this.id=id||zid++;this.type=T;this.tid=tid;this.x=x;this.y=y;this.a=Math.random()*6.28;
    this.r=T.r;this.k=Nav.sizeClass(T.r);
    this.mhp=this.hp=Math.round(T.hp*(1+ew*.12)*(1+.35*(np-1)));
    this.spd=T.spd*Math.min(1.65,1+ew*.025)*60;this.dmg=T.dmg*(1+ew*.05);
    this.rew=Math.round(T.rew*(1+ew*.04));this.xp=T.xp;
    this.dir={x:0,y:0};this.ai=0;this.atkCD=1;this.atk=0;this.walk=Math.random()*6;
    this.chk={x,y,t:0};this.stuck=0;this.jit=0;this.cd={spit:2+Math.random()*2,leap:2,blink:3,scream:5,slam:3,charge:4,summon:10};
    this.air=0;this.flashT=0;this.burn=0;this.burnBy=null;this.buff=0;this.dying=false;this.deadT=0;this.lastHit=null;this.charge=0;this.leap=0;
    this.model=GFX.makeZombie(T);GFX.scene.add(this.model.root);
  }
  update(dt){
    if(this.dying){this.deadT+=dt;if(this.deadT>2.4)this.gone=true;return;}
    this.flashT=Math.max(0,this.flashT-dt);
    if(this.burn>GT){this.hp-=18*dt;if(Math.random()<.4)GFX.emit('fire',this.x,this.y,(this.air||0)+this.type.h*.5,1,{spread:this.r*.5});if(this.hp<=0)killZombie(this,this.burnBy,false);if(this.dying)return;}
    const tg=nearestTarget(this.x,this.y);
    if(!tg){this.moving=false;return;}
    const dx=tg.x-this.x,dy=tg.y-this.y,dist=Math.hypot(dx,dy);
    const reach=this.r+P_RADIUS+14,T=this.type;
    for(const k in this.cd)this.cd[k]-=dt;
    // ── decide a direction a few times per second ──
    this.ai-=dt;
    if(this.ai<=0){
      this.ai=.15+Math.random()*.1;
      this.direct=dist<1500&&Nav.pathClear(this.x,this.y,tg.x,tg.y,this.r);
      if(this.jit>0){/* keep the unstick direction */}
      else if(this.direct)this.dir={x:dx/(dist||1),y:dy/(dist||1)};
      else this.dir=Nav.flowDir(this.k,this.x,this.y,tg.x,tg.y,this.r)||{x:dx/(dist||1),y:dy/(dist||1)};
    }
    this.jit=Math.max(0,this.jit-dt);
    let mult=this.buff>GT?1.6:1,move=dist>reach*.9;
    // ── specials ──
    if(T.ranged&&dist<700&&this.direct){
      if(dist<380)move=false;
      if(dist<260&&this.jit<=0){this.dir={x:-dx/dist,y:-dy/dist};move=true;}
      if(this.cd.spit<=0&&losTo(this,tg)){this.cd.spit=2.4+Math.random();spit(this,tg);}
    }
    if(this.tid==='leaper'){
      if(this.leap>0){this.leap-=dt;mult=4.2;this.air=Math.sin((1-this.leap/.55)*Math.PI)*48;if(this.leap<=0)this.air=0;}
      else if(dist>130&&dist<420&&this.direct&&this.cd.leap<=0){this.leap=.55;this.cd.leap=3.5+Math.random()*2;this.dir={x:dx/dist,y:dy/dist};}
    }
    if(this.tid==='phantom'&&this.cd.blink<=0&&dist>280){
      this.cd.blink=3+Math.random()*2.5;const step=Math.min(230,dist-120);
      const nx=this.x+this.dir.x*step,ny=this.y+this.dir.y*step;
      if(!Nav.circleHits(nx,ny,this.r)){fxAll('blink',this.x,this.y);this.x=nx;this.y=ny;fxAll('blink',nx,ny);}
    }
    if(this.tid==='screamer'&&this.cd.scream<=0&&dist<900){
      this.cd.scream=9;for(const z of zombies)if(!z.dying&&Math.hypot(z.x-this.x,z.y-this.y)<480)z.buff=GT+5;fxAll('scream',this.x,this.y);
    }
    if(T.boss){
      if(this.charge>0){this.charge-=dt;mult=2.8;}
      else if(dist>320&&dist<1000&&this.direct&&this.cd.charge<=0){this.charge=1.1;this.cd.charge=7;this.dir={x:dx/dist,y:dy/dist};fxAll('roar',this.x,this.y);}
      const sr=this.tid==='titan'?270:180;
      if(dist<sr&&this.cd.slam<=0){this.cd.slam=this.tid==='titan'?4.5:5.5;this.atk=.01;fxAll('slam',this.x,this.y,sr);hurtArea(this.x,this.y,sr,this.dmg*.8);}
      if(this.tid==='titan'&&this.cd.summon<=0){this.cd.summon=16;for(let i=0;i<4;i++){const a=i/4*6.28;const sx=this.x+Math.cos(a)*90,sy=this.y+Math.sin(a)*90;if(!Nav.circleHits(sx,sy,20))zombies.push(new Zombie(sx,sy,'fast'));}}
    }
    // ── move ──
    this.moving=move;
    if(move){const s=this.spd*mult*dt;this.x+=this.dir.x*s;this.y+=this.dir.y*s;this.walk+=dt*this.spd/14*(mult>1?1.5:1);}
    // separation (then walls, so nobody is ever shoved into a wall)
    for(const o of zombies){
      if(o===this||o.dying)continue;const sx=this.x-o.x,sy=this.y-o.y,mn=this.r+o.r;
      if(Math.abs(sx)>mn||Math.abs(sy)>mn)continue;const d=Math.hypot(sx,sy);
      if(d>0&&d<mn){const k=(mn-d)/d*.5*(o.r>this.r*1.5?1.4:o.r*1.5<this.r?.3:1);this.x+=sx*k;this.y+=sy*k;}
    }
    // never stand inside a player
    if(!this.air)for(const t of aliveTargets()){const px=this.x-t.x,py=this.y-t.y,d=Math.hypot(px,py),mn=this.r+P_RADIUS;if(d<mn&&d>0){this.x=t.x+px/d*mn;this.y=t.y+py/d*mn;}}
    Nav.resolve(this,this.r);
    // ── stuck detection: if we barely moved for a while, wiggle; if hopeless, respawn somewhere better ──
    this.chk.t+=dt;
    if(this.chk.t>=1){
      const prog=Math.hypot(this.x-this.chk.x,this.y-this.chk.y);
      if(move&&prog<14&&dist>reach+30){this.stuck++;
        if(this.stuck>=2){const fd=Nav.flowDir(this.k,this.x,this.y,tg.x,tg.y,this.r);const a=fd?Math.atan2(fd.y,fd.x)+(Math.random()-.5)*1.6:Math.random()*6.28;this.dir={x:Math.cos(a),y:Math.sin(a)};this.jit=.6;}
        if(this.stuck>=7&&dist>500)relocate(this);
      }else this.stuck=0;
      this.chk={x:this.x,y:this.y,t:0};
    }
    // face where we're going (or the target when close)
    const fa=dist<reach*2.5?Math.atan2(dy,dx):Math.atan2(this.dir.y,this.dir.x);
    let da=fa-this.a;while(da>Math.PI)da-=6.283;while(da<-Math.PI)da+=6.283;this.a+=da*Math.min(1,dt*8);
    // ── attack ──
    this.atkCD-=dt;
    if(this.atk>0){this.atk+=dt/.4;
      if(this.atk>=.5&&!this.hitDone){this.hitDone=true;
        if(this.tid==='expldr'){killZombie(this,this.lastHit,false);return;}
        const t2=nearestTarget(this.x,this.y);if(t2&&Math.hypot(t2.x-this.x,t2.y-this.y)<reach+12&&t2.z<this.type.h)hurtTarget(t2.pid,this.dmg,this.x,this.y);}
      if(this.atk>=1)this.atk=0;}
    else if(dist<reach&&this.atkCD<=0&&tg.z<this.type.h){this.atk=.01;this.hitDone=false;this.atkCD=1.25;fxAll('zatk',this.x,this.y);}
  }
}
function nearestTarget(x,y){let b=null,bd=1e9;for(const t of aliveTargets()){const d=Math.hypot(t.x-x,t.y-y);if(d<bd){bd=d;b=t;}}return b;}
function losTo(z,t){const ox=z.x,oy=z.y,oz=z.type.h*.8,dx=t.x-ox,dy=t.y-oy,dz=50-oz,l=Math.hypot(dx,dy,dz);return!Nav.rayWalls(ox,oy,oz,dx/l,dy/l,dz/l,l);}
function relocate(z){
  const sp=pickSpawn(z.k);if(!sp)return;z.x=sp.x;z.y=sp.y;z.stuck=0;z.jit=0;z.ai=0;
}

// Host-side damage (from us or from a client's hit message)
function hostDamage(z,d,head,pid,o){
  if(!z||z.dying)return;o=o||{};
  if(z.type.armor&&!head)d*=z.type.armor;
  if(puOn('instakill'))d=z.type.boss?d*4:z.hp+1;
  z.hp-=d;z.flashT=.08;z.lastHit=pid;
  if(o.burn){z.burn=GT+3;z.burnBy=pid;}
  if(o.push){z.x+=o.push[0];z.y+=o.push[1];Nav.resolve(z,z.r);}
  if(z.hp<=0)killZombie(z,pid,head);
}
function killZombie(z,pid,head,silent){
  if(z.dying)return;z.dying=true;z.deadT=0;z.hp=0;z.burn=0;
  fxAll('zdie',z.x,z.y);
  if(!silent){
    const msg={rew:z.rew,xp:z.xp,head:head?1:0,tid:z.tid};
    if(pid===myPid())onKill(msg.rew,msg.xp,head,z.tid);else if(pid&&peers.has(pid))Net.sendTo(pid,Object.assign({t:'kill'},msg));
    const who=pid===myPid()?CFG.name:(peers.get(pid)||{}).name;
    if(who)killFeed(who,z.type.name,head);
    if(Net.role==='host'&&who)Net.broadcast({t:'kf',k:who,z:z.type.name,h:head?1:0});
    drops(z);
  }
  if(z.tid==='expldr')hostExplosion(z.x,z.y,30,150,160,pid,true);
  if(z.tid==='toxic')clouds.push({id:projid++,x:z.x,y:z.y,r:120,dps:10,until:GT+6});
}
function hostExplosion(x,y,z,r,dmg,pid,fxToo){
  if(fxToo)boomFx(x,y,z,r);
  if(Net.role==='host')Net.broadcast({t:'fx',k:'boom',x:x|0,y:y|0,z:z|0,r},fxToo?null:pid);
  for(const o of zombies){if(o.dying)continue;const d=Math.hypot(o.x-x,o.y-y);if(d<r+o.r)hostDamage(o,dmg*(1-Math.min(1,d/(r+o.r))*.6),false,pid,{});}
  if(fxToo)hurtArea(x,y,r,dmg*.25);
}
function hurtArea(x,y,r,dmg){for(const t of aliveTargets()){const d=Math.hypot(t.x-x,t.y-y);if(d<r)hurtTarget(t.pid,dmg*(1-d/r*.5),x,y);}}
function hurtTarget(pid,d,sx,sy){if(pid===myPid())localHurt(d,sx,sy);else Net.sendTo(pid,{t:'dmg',d:Math.round(d),x:sx|0,y:sy|0});}

// ── acid spit (host projectiles) ──
function spit(z,t){
  const ox=z.x+Math.cos(z.a)*15,oy=z.y+Math.sin(z.a)*15,oz=z.type.h*.85,d=Math.hypot(t.x-ox,t.y-oy),tt=d/460;
  zproj.push({id:projid++,x:ox,y:oy,z:oz,vx:(t.x-ox)/tt,vy:(t.y-oy)/tt,vz:(45-oz)/tt+.5*500*tt,life:tt+1,dmg:z.dmg*1.1});fxAll('spit',ox,oy);
}
function updZProj(dt){
  for(const p of zproj){
    p.life-=dt;p.vz-=500*dt;const ox=p.x,oy=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    if(Math.random()<.6)GFX.emit('acid',p.x,p.y,p.z,1,{spd:.2});
    let hit=p.z<=0||p.life<=0||Nav.circleHits(p.x,p.y,4)&&p.z<80;
    for(const t of aliveTargets())if(Math.hypot(t.x-p.x,t.y-p.y)<P_RADIUS+8&&p.z<t.z+70&&p.z>t.z-5){hurtTarget(t.pid,p.dmg,ox,oy);hit=true;break;}
    if(hit){p.dead=true;fxAll('acidhit',p.x,p.y);}
  }
  zproj=zproj.filter(p=>!p.dead);
}

// ── effects that every peer should see (host broadcasts, everyone plays) ──
function fxAll(k,x,y,r){playFx(k,x,y,r);if(Net.role==='host'&&k!=='zatk')Net.broadcast({t:'fx',k,x:x|0,y:y|0,r:r|0});}
function playFx(k,x,y,r){
  const v=Snd.at(x,y);
  switch(k){
    case'zdie':Snd.play('zdie',v);GFX.emit('gib',x,y,40,10);GFX.emit('blood',x,y,30,14);break;
    case'zatk':Snd.play('zatk',v);break;
    case'blink':GFX.emit('blink',x,y,40,16);Snd.play('blink',v);break;
    case'scream':Snd.play('scream',v);GFX.emit('blink',x,y,70,20,{col:'#ffffff'});addShake(.15*v);break;
    case'roar':Snd.play('boss',v*.7);break;
    case'slam':Snd.play('slam',v);GFX.emit('dust',x,y,6,30,{spread:r*.5,size:2});GFX.emit('smoke',x,y,8,10,{spread:r*.4});addShake(.6*v);break;
    case'spit':Snd.play('spit',v);break;
    case'acidhit':GFX.emit('acid',x,y,10,14);break;
    case'boom':boomFx(x,y,0,r||180);break;
  }
}

// ── DROPS ──
function drops(z){
  const at=(t,v,pu)=>pickups.push({id:pkid++,type:t,val:v,pu,x:z.x+rnd(-30,30),y:z.y+rnd(-30,30),life:pu?25:35,model:null});
  if(z.type.boss){at('pu',0,pickPU());at('weapon',0);at('money',z.rew);return;}
  const r=Math.random();
  if(r<.028)at('pu',0,pickPU());
  else if(r<.04)at('weapon',0);
  else if(r<.048)at('token',0);
  else if(r<.09)at('grenade',2);
  if(Math.random()<.24){const t=['health','armor','ammo','ammo'][Math.floor(Math.random()*4)];at(t,{health:30,armor:25,ammo:1}[t]);}
  if(Math.random()<.3)at('money',Math.round(z.rew*.6));
}
function pickPU(){const w={maxammo:3,instakill:2,double:2,nuke:1,speed:2,godmode:1,firesale:1.2};let s=0;for(const k in w)s+=w[k];let r=Math.random()*s;for(const k in w){r-=w[k];if(r<=0)return k;}return'maxammo';}
function updPickups(dt){
  for(const p of pickups){
    p.life-=dt;if(p.life<=0){p.dead=true;continue;}
    for(const t of aliveTargets()){
      if(Math.hypot(t.x-p.x,t.y-p.y)>36||t.z>40)continue;
      p.dead=true;
      if(p.type==='pu'){const by=t.pid===myPid()?CFG.name:(peers.get(t.pid)||{}).name;localPowerup(p.pu,by);if(Net.role==='host')Net.broadcast({t:'pu',id:p.pu,by});if(p.pu==='nuke')nukeAll();}
      else if(t.pid===myPid())localPickup(p.type,p.val);
      else Net.sendTo(t.pid,{t:'pk',type:p.type,val:p.val});
      break;
    }
  }
  clouds=clouds.filter(c=>c.until>GT);
}
function nukeAll(){for(const z of zombies)if(!z.dying)killZombie(z,null,false,true);}

// ── WAVES ──
function pickSpawn(k){
  const pts=Nav.N.spawns,tg=aliveTargets();if(!pts.length)return null;
  for(let i=0;i<30;i++){
    const s=pts[Math.floor(Math.random()*pts.length)];if(s.k<k)continue;
    if(tg.some(t=>Math.hypot(t.x-s.x,t.y-s.y)<700))continue;
    const x=s.x+rnd(-12,12),y=s.y+rnd(-12,12);
    if(!Nav.circleHits(x,y,[22,32,52][k]))return{x,y};
  }
  const s=pts.find(p=>p.k>=k);return s?{x:s.x,y:s.y}:null;
}
function pickType(){
  const pool=GS.level.pool;let s=0;const opts=[];
  for(const id in pool){const[w,from]=pool[id];if(GS.wave<from)continue;const wt=id==='normal'?w:w*(1+(GS.wave-from)*.12);opts.push([id,wt]);s+=wt;}
  let r=Math.random()*s;for(const[id,wt]of opts){r-=wt;if(r<=0)return id;}return'normal';
}
function isBossWave(){return GS.mode==='campaign'?GS.wave===GS.level.waves:GS.wave%5===0;}
function startWave(){
  GS.wActive=true;const ew=effWave(),np=nPlayers(),boss=isBossWave();
  let cnt=Math.round((7+ew*2.6)*(1+.55*(np-1)));if(boss)cnt=Math.round(cnt*.6);
  GS.wTotal=cnt;GS.wSpawned=0;GS.spawnT=.5;
  GS.bossQ=boss?(GS.mode==='campaign'?GS.level.boss.slice():(GS.wave>=15&&GS.wave%10===0?['titan']:['boss'])):[];
  GS.wTotal+=GS.bossQ.length;
  const sub=boss?'⚠ BOSS WAVE ⚠':GS.mode==='campaign'?`Wave ${GS.wave} of ${GS.level.waves}`:'Survive!';
  announce('WAVE '+GS.wave,sub,boss?'boss':'wave');
}
function updWaves(dt){
  if(GS.levelDone)return;
  if(!GS.wActive){GS.timer-=dt;if(GS.timer<=0)startWave();return;}
  const alive=zombies.filter(z=>!z.dying).length,np=nPlayers(),maxAlive=Math.min(64,40+8*(np-1));
  if(GS.wSpawned<GS.wTotal&&alive<maxAlive){
    GS.spawnT-=dt;
    if(GS.spawnT<=0){
      const tid=GS.bossQ.length?GS.bossQ.shift():pickType(),k=Nav.sizeClass(DZ.ZTYPES[tid].r);
      const sp=pickSpawn(k);
      if(sp){zombies.push(new Zombie(sp.x,sp.y,tid));GS.wSpawned++;if(DZ.ZTYPES[tid].boss)fxAll('roar',sp.x,sp.y);}
      GS.spawnT=Math.max(.22,1.3-effWave()*.045)/Math.sqrt(np);
    }
  }
  if(GS.wSpawned>=GS.wTotal&&alive===0)waveCleared();
}
function waveCleared(){
  GS.wActive=false;GS.wavesCleared++;
  const bonus=500+effWave()*110;
  addMoney(bonus);if(Net.role==='host')Net.broadcast({t:'bonus',m:bonus});
  ach('wave_5',GS.wavesCleared>=5);ach('wave_10',GS.wavesCleared>=10);ach('wave_20',GS.wavesCleared>=20);
  if(GS.mode==='campaign'&&GS.wave>=GS.level.waves){levelComplete();return;}
  GS.wave++;GS.timer=10;
  announce(`WAVE ${GS.wave-1} CLEARED`,`Next wave in 10s · Bonus $${bonus} · F = Shop`,'wave');
}
function announce(m,s,snd){showWave(m,s);if(snd)Snd.play(snd);if(Net.role==='host')Net.broadcast({t:'ann',m,s,snd});}

// ── per-frame world update ──
function updateWorld(dt){
  if(isHost()){
    fieldT-=dt;
    if(fieldT<=0){fieldT=.25;const tg=aliveTargets();if(tg.length){const used=new Set(zombies.map(z=>z.k));for(const k of used)Nav.computeField(k,tg);}}
    for(const z of zombies)z.update(dt);
    for(let i=zombies.length-1;i>=0;i--)if(zombies[i].gone){GFX.remove(zombies[i].model.root);zombies.splice(i,1);}
    updZProj(dt);updPickups(dt);updWaves(dt);
    // all players down -> game over
    if(GS.running&&!GS.levelDone&&player.dead&&[...peers.values()].every(p=>p.dead||!p.ready))if(Net.role==='host'||Net.role==='solo')squadWiped();
  }else{
    for(const z of zombies){
      z.x+=(z.tx-z.x)*Math.min(1,dt*14);z.y+=(z.ty-z.y)*Math.min(1,dt*14);
      let da=z.ta-z.a;while(da>Math.PI)da-=6.283;while(da<-Math.PI)da+=6.283;z.a+=da*Math.min(1,dt*10);
      z.air+=((z.tair||0)-z.air)*Math.min(1,dt*14);
      z.moving=Math.hypot(z.tx-z.x,z.ty-z.y)>1.5||z.wasMoving;z.walk+=dt*(z.moving?z.type.spd*4.3:0);
      if(z.atk>0){z.atk+=dt/.4;if(z.atk>=1)z.atk=0;}
      z.flashT=Math.max(0,(z.flashT||0)-dt);
      if(z.burning&&Math.random()<.4)GFX.emit('fire',z.x,z.y,(z.air||0)+z.type.h*.5,1,{spread:z.r*.5});
      if(z.dying)z.deadT+=dt;
    }
    for(let i=zombies.length-1;i>=0;i--)if(zombies[i].dying&&zombies[i].deadT>2.4){GFX.remove(zombies[i].model.root);zombies.splice(i,1);}
    for(const p of zproj)if(Math.random()<.6)GFX.emit('acid',p.x,p.y,p.z,1,{spd:.2});
  }
  for(const c of clouds)if(Math.random()<dt*14)GFX.emit('poison',c.x+rnd(-c.r,c.r)*.7,c.y+rnd(-c.r,c.r)*.7,20,1);
  // ambient groans
  if(Math.random()<dt*.6&&zombies.length){const z=zombies[Math.floor(Math.random()*zombies.length)];if(!z.dying)Snd.play('groan',Snd.at(z.x,z.y));}
}

// ── render sync for zombies / pickups / peers ──
function syncVisuals(dt){
  for(const z of zombies){
    GFX.zFlash(z.model,z.flashT>0);
    GFX.poseZombie(z.model,{x:z.x,y:z.y,a:z.a,walk:z.walk,moving:z.moving,atk:z.atk,dead:z.dying?z.deadT:0,air:z.air});
  }
  const t=GT;
  for(const p of pickups){
    if(!p.model){const P=p.type==='pu'?DZ.POWERUPS[p.pu]:DZ.PICKUPS[p.type];p.model=GFX.makePickup(P.icon,P.color,p.type==='pu');}
    p.model.position.set(p.x,22+Math.sin(t*2.5+p.id)*5,p.y);p.model.visible=p.life>5||Math.sin(t*16)>0;
  }
  for(let i=pickups.length-1;i>=0;i--)if(pickups[i].dead){GFX.remove(pickups[i].model);pickups.splice(i,1);}
  for(const p of peers.values()){
    if(!p.ready)continue;
    if(!p.avatar){p.avatar=GFX.makeAvatar(p.color);GFX.scene.add(p.avatar.root);p.walk=0;}
    if(p.rx==null){p.rx=p.x;p.ry=p.y;}
    const ox=p.rx,oy=p.ry;p.rx+=(p.x-p.rx)*Math.min(1,dt*14);p.ry+=(p.y-p.ry)*Math.min(1,dt*14);
    const mv=Math.hypot(p.rx-ox,p.ry-oy)/Math.max(dt,1e-3);p.walk+=dt*mv/14;
    GFX.poseAvatar(p.avatar,{x:p.rx,y:p.ry,z:p.z||0,a:p.a,pitch:p.p,walk:p.walk,moving:mv>15,crouch:p.cr,dead:p.dead});
    if(p.sh!==p.lastSh){if(p.lastSh!=null){p.avatar.flash.material.opacity=1;const d=DZ.WEAPONS[p.w];if(d)Snd.gun(d,Snd.at(p.x,p.y)*.7);}p.lastSh=p.sh;}
  }
  const live=new Set(zproj.map(p=>p.id));
  for(const[id,m]of projMeshes)if(!live.has(id)){GFX.remove(m);projMeshes.delete(id);}
  for(const p of zproj){let m=projMeshes.get(p.id);if(!m){m=GFX.projMesh('acid');projMeshes.set(p.id,m);}m.position.set(p.x,p.z,p.y);}
}
const projMeshes=new Map();

// ── NETWORK SNAPSHOTS ──
function buildSnapshot(){
  const z=[];
  for(const o of zombies)z.push([o.id,DZ.ZTYPE_IDS.indexOf(o.tid),o.x|0,o.y|0,Math.round(o.a*100),Math.round(o.hp/o.mhp*100),(o.dying?1:0)|(o.atk>0?2:0)|(o.burn>GT?4:0)|(o.moving?8:0),o.air|0]);
  const p=[[myPid(),player.x|0,player.y|0,player.z|0,Math.round(player.angle*100),Math.round(player.viewPitch*100),player.w?player.w.id:'',Math.ceil(player.hp),player.maxHp,player.dead?1:0,player.shots,player.crouchF>.5?1:0]];
  for(const q of peers.values())if(q.ready)p.push([q.pid,q.x|0,q.y|0,q.z|0,Math.round(q.a*100),Math.round(q.p*100),q.w,q.hp,q.mhp,q.dead?1:0,q.sh,q.cr?1:0]);
  const boss=zombies.find(o=>o.type.boss&&!o.dying);
  return{t:'s',g:[GS.wave,GS.wActive?1:0,Math.ceil(GS.timer),GS.wTotal-GS.wSpawned+zombies.filter(o=>!o.dying).length,boss?Math.round(boss.hp/boss.mhp*1000):-1,boss?boss.type.name:''],
    z,p,k:pickups.map(o=>[o.id,o.type,o.x|0,o.y|0,o.pu||'',o.life|0]),j:zproj.map(o=>[o.id,o.x|0,o.y|0,o.z|0]),h:clouds.map(c=>[c.x|0,c.y|0,c.r])};
}
function applySnapshot(s){
  const [wv,act,tm,left,bhp,bn]=s.g;GS.wave=wv;GS.wActive=!!act;GS.timer=tm;GS.left=left;GS.bossInfo=bhp>=0?{f:bhp/1000,n:bn}:null;
  const seen=new Set();
  for(const e of s.z){
    const[id,ti,x,y,a,hp,fl,air]=e;seen.add(id);
    let z=zmap.get(id);
    if(!z){const tid=DZ.ZTYPE_IDS[ti];const T=DZ.ZTYPES[tid];z={id,tid,type:T,x,y,a:a/100,tx:x,ty:y,ta:a/100,r:T.r,walk:Math.random()*6,air:0,atk:0,deadT:0,model:GFX.makeZombie(T)};GFX.scene.add(z.model.root);zombies.push(z);zmap.set(id,z);}
    z.tx=x;z.ty=y;z.ta=a/100;z.hpF=hp/100;z.tair=air;z.burning=!!(fl&4);z.wasMoving=!!(fl&8);
    if(fl&2&&!(z.atk>0))z.atk=.01;
    if(fl&1&&!z.dying){z.dying=true;z.deadT=0;}
  }
  for(const z of zombies)if(!seen.has(z.id)&&!z.dying){z.dying=true;z.deadT=1.5;}
  for(const[id,z]of zmap)if(!zombies.includes(z))zmap.delete(id);
  // players
  const live=new Set();
  for(const e of s.p){
    const[pid,x,y,z,a,pt,w,hp,mhp,dead,sh,cr]=e;if(pid===myPid())continue;live.add(pid);
    let q=peers.get(pid);if(!q){const r=Net.roster.find(o=>o.pid===pid)||{};q={pid,name:r.name||pid,color:r.color||'#fff'};peers.set(pid,q);}
    Object.assign(q,{x,y,z,a:a/100,p:pt/100,w,hp,mhp,dead:!!dead,sh,cr:!!cr,ready:true});
  }
  for(const[pid,q]of peers)if(!live.has(pid)){if(q.avatar)GFX.remove(q.avatar.root);peers.delete(pid);}
  // pickups
  const pk=new Set();
  for(const e of s.k){const[id,type,x,y,pu,life]=e;pk.add(id);let p=pickups.find(o=>o.id===id);if(!p){p={id,type,x,y,pu:pu||null,val:0,life,model:null};pickups.push(p);}p.life=life;}
  for(const p of pickups)if(!pk.has(p.id))p.dead=true;
  zproj=s.j.map(e=>({id:e[0],x:e[1],y:e[2],z:e[3]}));
  clouds=s.h.map(e=>({x:e[0],y:e[1],r:e[2],dps:10}));
}
const zmap=new Map();

function clearWorld(){
  for(const z of zombies)GFX.remove(z.model.root);zombies=[];zmap.clear();
  for(const p of pickups)GFX.remove(p.model);pickups=[];
  for(const p of projectiles)GFX.remove(p.mesh);projectiles=[];
  for(const[,m]of projMeshes)GFX.remove(m);projMeshes.clear();zproj=[];clouds=[];
  for(const p of peers.values())if(p.avatar){GFX.remove(p.avatar.root);p.avatar=null;}
}
