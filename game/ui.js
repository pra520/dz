// ═══════════════════════════════════════════════════════
//  DEAD ZONE — UI, HUD, shop, menus, level flow, net glue,
//  input and the main loop.
// ═══════════════════════════════════════════════════════
const $=id=>document.getElementById(id);
const canvas=$('c'),ov=$('ov'),octx=ov.getContext('2d');
let hudDirty=true,hudT=0,intentionalUnlock=false,settingsOpen=false;

// ── VFX / messages ──
function flashDmg(){const e=$('dmgV');e.style.opacity='1';clearTimeout(e._t);e._t=setTimeout(()=>e.style.opacity='0',380);}
function flashHeal(){const e=$('healV');e.style.opacity='.8';clearTimeout(e._t);e._t=setTimeout(()=>e.style.opacity='0',150);}
function flashScreen(){const e=$('flashV');e.style.transition='none';e.style.opacity='.9';setTimeout(()=>{e.style.transition='opacity .9s';e.style.opacity='0';},40);}
function showToast(txt,col,dur=2400){const e=$('toast');e.textContent=txt;e.style.color=col||'#aa44ff';e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),dur);}
function showWave(m,s){const e=$('wave');e.innerHTML=`<div class="wt">${m}</div><div class="ws">${s||''}</div>`;e.style.opacity='1';clearTimeout(e._t);e._t=setTimeout(()=>e.style.opacity='0',3200);}
const HitFX={a:0,s:1,c:'#fff'};
function showHit(kind){HitFX.a=1;HitFX.s=kind==='head'?1.55:kind==='crit'?1.3:1;HitFX.c=kind==='head'?'#ff5533':kind==='crit'?'#ffdd44':'#ffffff';}
let dmgNums=[];
function dmgNum(x,y,h,txt,col,big){dmgNums.push({x:x+rnd(-8,8),y:y+rnd(-8,8),h,txt:String(txt),col,big:!!big,life:1.2});if(dmgNums.length>60)dmgNums.shift();}
function killFeed(who,what,head){
  const f=$('feed'),d=document.createElement('div');
  d.innerHTML=what?`<b>${esc(who)}</b> ☠ ${esc(what)}${head?' 🎯':''}`:esc(who);
  f.prepend(d);while(f.children.length>5)f.lastChild.remove();
  setTimeout(()=>{d.style.opacity='0';setTimeout(()=>d.remove(),500);},4500);
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// ── ACHIEVEMENTS ──
const ACHS=[
  {id:'first_kill',n:'First Blood',d:'Kill your first zombie',i:'🩸'},
  {id:'kills_50',n:'Survivor',d:'Kill 50 zombies',i:'⚔️'},
  {id:'kills_100',n:'Veteran',d:'Kill 100 zombies',i:'💀'},
  {id:'kills_500',n:'Exterminator',d:'Kill 500 zombies',i:'🔥'},
  {id:'wave_5',n:'Wave Rider',d:'Clear 5 waves',i:'🌊'},
  {id:'wave_10',n:'Unstoppable',d:'Clear 10 waves',i:'🏆'},
  {id:'wave_20',n:'Legend',d:'Clear 20 waves',i:'👑'},
  {id:'level_5',n:'Leveling Up',d:'Reach level 5',i:'⬆️'},
  {id:'level_10',n:'Elite Soldier',d:'Reach level 10',i:'🎖️'},
  {id:'money_5000',n:'Big Spender',d:'Hold $5000',i:'💰'},
  {id:'headshot_10',n:'Marksman',d:'Get 10 headshots',i:'🎯'},
  {id:'buy_sniper',n:'Long Shot',d:'Buy the Sniper Rifle',i:'🔭'},
  {id:'boss_kill',n:'Boss Slayer',d:'Kill an Abomination',i:'👹'},
  {id:'titan_kill',n:'Titan Killer',d:'Kill the Titan',i:'🗿'},
  {id:'full_upgrade',n:'Maxed Out',d:'Fully upgrade a weapon',i:'⭐'},
  {id:'level_clear',n:'Area Cleared',d:'Complete a campaign level',i:'🚩'},
  {id:'campaign_done',n:'Savior',d:'Finish the whole campaign',i:'🌅'},
];
const UNLOCKED=new Set(),ACHQ=[];let achShowing=false;
function ach(id,cond){if(!cond||UNLOCKED.has(id))return;const a=ACHS.find(x=>x.id===id);if(!a)return;UNLOCKED.add(id);ACHQ.push(a);if(!achShowing)nextAch();}
function nextAch(){
  if(!ACHQ.length){achShowing=false;return;}achShowing=true;const a=ACHQ.shift(),e=$('achiev');
  e.innerHTML=`${a.i} <b style="color:#ffdd00">${a.n}</b> — ${a.d}`;e.classList.add('show');Snd.play('ach');
  setTimeout(()=>{e.classList.remove('show');setTimeout(nextAch,400);},2800);
}

// ── HUD ──
function refreshHUD(){
  const P=player,w=P.w;
  $('hv').textContent=Math.ceil(P.hp);$('hb').style.width=(P.hp/P.maxHp*100)+'%';
  $('av').textContent=Math.ceil(P.armor);$('ab').style.width=(P.armor/P.maxArmor*100)+'%';
  $('lowHPV').classList.toggle('on',P.hp>0&&P.hp/P.maxHp<.25);
  const camp=GS.mode==='campaign';
  $('wv').textContent=camp?`${GS.wave}/${GS.level.waves}`:GS.wave;
  const left=isHost()?GS.wTotal-GS.wSpawned+zombies.filter(z=>!z.dying).length:(GS.left||0);
  $('zv').textContent=GS.wActive?left:'—';
  $('sv').textContent=GS.score.toLocaleString();$('kv').textContent=GS.kills;
  $('mv').textContent='$'+GS.money.toLocaleString();$('lv').textContent=GS.plv;
  $('xb').style.width=(GS.xp/GS.xpNext*100)+'%';
  $('nextT').textContent=GS.levelDone?'Level clear!':GS.wActive?'Survive!':'Next wave '+Math.max(0,Math.ceil(GS.timer))+'s';
  $('lvlN').textContent=camp?`Level ${GS.li+1} / ${DZ.LEVELS.length}`:'Endless';
  $('mapN').textContent=GS.level.icon+' '+GS.level.name;
  if(w){const d=DZ.WEAPONS[w.id],t=DZ.TIERS[w.tier||0].name;$('wn').textContent=`[${P.wi+1}] ${d.name}${t?' '+t:''}`;$('wn').style.color=DZ.TIERS[w.tier||0].tint||'#88ffcc';$('ammo').textContent=w.mag+' / '+w.res;$('ammo').style.color=w.mag===0?'#ff4444':'#fff';}
  $('gn').textContent=P.grenades;
  $('slots').innerHTML=P.inv.map((x,i)=>`<span class="slot${i===P.wi?' on':''}">${i+1}</span>`).join('');
  // power-ups
  let h='';for(const id in GS.pu){const left=GS.pu[id]-GT;if(left>0){const p=DZ.POWERUPS[id];h+=`<span class="pu" style="color:${p.color};border-color:${p.color}">${p.icon} ${p.name} ${Math.ceil(left)}s</span>`;}}
  if(P.buffs.speed>GT)h+=`<span class="pu" style="color:#44ddff;border-color:#44ddff">⚡ ADRENALINE ${Math.ceil(P.buffs.speed-GT)}s</span>`;
  $('pus').innerHTML=h;
  // boss bar
  let boss=null;
  if(isHost()){const b=zombies.find(z=>z.type.boss&&!z.dying);if(b)boss={f:b.hp/b.mhp,n:b.type.name};}else boss=GS.bossInfo;
  $('bossbar').style.display=boss?'block':'none';if(boss){$('bossN').textContent='👹 '+boss.n;$('bossF').style.width=Math.max(0,boss.f*100)+'%';}
  // squad
  const mp=Net.role!=='solo';$('team').style.display=mp&&peers.size?'block':'none';
  if(mp){let t='';for(const p of peers.values()){if(!p.ready)continue;t+=`<div class="tm"><span style="color:${p.color};width:90px;overflow:hidden">${p.dead?'☠ ':''}${esc(p.name)}</span><div class="bar"><div class="bfill" style="background:${p.color};width:${Math.max(0,p.hp/(p.mhp||100)*100)}%"></div></div></div>`;}$('teamL').innerHTML=t;}
  hudDirty=false;
}
function frameHUD(){
  const P=player;$('sf').style.width=P.stamina+'%';
  const rb=$('reloadB');
  if(P.reloading){rb.style.display='block';$('rf').style.width=Math.min(100,(GT-P.reloadStart)/P.reloadDur*100)+'%';}else rb.style.display='none';
  $('downO').style.display=P.dead&&Net.role!=='solo'&&!GS.over?'block':'none';
  if(P.dead)$('downT').textContent='Respawning in '+Math.max(0,Math.ceil(P.respawnT))+'s';
}

// ── MINIMAP ──
let mmBase=null;
function buildMinimap(){
  const S=160,B=GS.map.B,k=S/B,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');
  x.fillStyle='rgba(20,20,24,.85)';x.fillRect(0,0,S,S);
  for(const h of GS.map.hazards){x.fillStyle='rgba(255,90,0,.7)';x.fillRect(h.x*k,h.y*k,h.w*k,h.h*k);}
  for(const w of GS.map.walls){x.fillStyle=w.k==='water'?'rgba(40,90,150,.8)':w.ht<60?'rgba(150,140,110,.55)':'rgba(200,170,120,.85)';x.fillRect(w.x*k,w.y*k,Math.max(1,w.w*k),Math.max(1,w.h*k));}
  mmBase=c;
}
function drawMinimap(){
  const c=$('mm'),x=c.getContext('2d'),S=160,k=S/GS.map.B;
  x.clearRect(0,0,S,S);if(mmBase)x.drawImage(mmBase,0,0);
  for(const p of pickups){if(p.dead)continue;x.fillStyle=p.type==='pu'?'#ffffff':'#ffdd00';x.fillRect(p.x*k-1.5,p.y*k-1.5,p.type==='pu'?4:3,p.type==='pu'?4:3);}
  for(const z of zombies){if(z.dying)continue;x.fillStyle=z.type.boss?'#ff2200':'#ff4444';const r=z.type.boss?3.5:1.8;x.beginPath();x.arc(z.x*k,z.y*k,r,0,7);x.fill();}
  for(const p of peers.values()){if(!p.ready)continue;x.fillStyle=p.color;x.beginPath();x.arc(p.x*k,p.y*k,3,0,7);x.fill();}
  const px=player.x*k,py=player.y*k,a=player.angle;
  x.fillStyle='#fff';x.beginPath();x.moveTo(px+Math.cos(a)*6,py+Math.sin(a)*6);x.lineTo(px+Math.cos(a+2.5)*4,py+Math.sin(a+2.5)*4);x.lineTo(px+Math.cos(a-2.5)*4,py+Math.sin(a-2.5)*4);x.fill();
}

// ── 2D OVERLAY (crosshair, scope, numbers, name tags) ──
function drawOverlay(dt){
  const W=ov.width,H=ov.height,x=octx;x.clearRect(0,0,W,H);
  if(!GS.running)return;
  const cx=W/2,cy=H/2,P=player,w=P.w,st=w&&wstats(w);
  const scoped=st&&(st.optic==='sniper'||st.optic==='acog')&&P.ads<.25&&!P.dead;
  // damage numbers
  x.textAlign='center';
  for(const d of dmgNums){const s=GFX.toScreen(d.x,d.y,d.h);if(!s.on)continue;x.globalAlpha=Math.min(1,d.life*1.6);x.font=(d.big?'bold 19px':'bold 14px')+' Courier New';x.lineWidth=3;x.strokeStyle='rgba(0,0,0,.85)';x.strokeText(d.txt,s.x,s.y);x.fillStyle=d.col;x.fillText(d.txt,s.x,s.y);}
  x.globalAlpha=1;
  // zombie health bars (only when visible)
  const ex=P.x,ey=P.y,ez=P.eye;
  for(const z of zombies){
    if(z.dying)continue;const f=isHost()?z.hp/z.mhp:(z.hpF==null?1:z.hpF);if(f>=.999&&!z.type.boss&&z.tid!=='heavy')continue;
    const d=Math.hypot(z.x-ex,z.y-ey);if(d>900)continue;
    const top=(z.air||0)+z.type.h+12,s=GFX.toScreen(z.x,z.y,top);if(!s.on)continue;
    const dx=z.x-ex,dy=z.y-ey,dz=top-ez,l=Math.hypot(dx,dy,dz);if(Nav.rayWalls(ex,ey,ez,dx/l,dy/l,dz/l,l-z.r))continue;
    const bw=Math.max(26,Math.min(90,2600/d*(z.type.bulk||1)));
    x.fillStyle='rgba(0,0,0,.7)';x.fillRect(s.x-bw/2-1,s.y-1,bw+2,6);x.fillStyle=f>.5?'#55ee55':f>.25?'#ffaa22':'#ff3322';x.fillRect(s.x-bw/2,s.y,bw*Math.max(0,f),4);
  }
  // teammates
  for(const p of peers.values()){
    if(!p.ready)continue;const s=GFX.toScreen(p.rx||p.x,p.ry||p.y,(p.z||0)+86);if(!s.on)continue;
    x.font='bold 12px Courier New';x.fillStyle=p.color;x.strokeStyle='rgba(0,0,0,.9)';x.lineWidth=3;const t=(p.dead?'☠ ':'')+p.name;x.strokeText(t,s.x,s.y);x.fillText(t,s.x,s.y);
    x.fillStyle='rgba(0,0,0,.7)';x.fillRect(s.x-20,s.y+4,40,4);x.fillStyle=p.color;x.fillRect(s.x-20,s.y+4,40*Math.max(0,p.hp/(p.mhp||100)),4);
  }
  // pickup labels
  x.font='11px Courier New';
  for(const p of pickups){if(p.dead)continue;const d=Math.hypot(p.x-ex,p.y-ey);if(d>240)continue;const s=GFX.toScreen(p.x,p.y,6);if(!s.on)continue;
    const lab=p.type==='pu'?DZ.POWERUPS[p.pu].name:DZ.PICKUPS[p.type].label;x.fillStyle='#fff';x.strokeStyle='#000';x.lineWidth=3;x.strokeText(lab,s.x,s.y);x.fillText(lab,s.x,s.y);}
  // scope / red dot / crosshair
  if(scoped)drawScope(x,W,H,st,w);
  else if(st&&st.optic==='reddot'&&P.ads<.35){x.fillStyle='#ff2020';x.shadowColor='#ff0000';x.shadowBlur=8;x.beginPath();x.arc(cx,cy,2.6,0,7);x.fill();x.shadowBlur=0;}
  else if(!P.dead&&P.ads>.5&&w){
    const def=DZ.WEAPONS[w.id],g=Math.max(4,Math.min(46,4+curSpread(st,def)*380)),L=7;
    x.strokeStyle='rgba(0,0,0,.6)';x.lineWidth=3.5;cross(x,cx,cy,g,L);x.strokeStyle='rgba(255,255,255,.92)';x.lineWidth=1.6;cross(x,cx,cy,g,L);
    x.fillStyle='rgba(255,255,255,.9)';x.fillRect(cx-1,cy-1,2,2);
  }
  // hit marker
  if(HitFX.a>0){const s=11*HitFX.s;x.globalAlpha=HitFX.a;x.strokeStyle=HitFX.c;x.lineWidth=HitFX.s>1.4?3.2:2.2;x.lineCap='round';x.beginPath();
    for(const[a,b]of[[-1,-1],[1,-1],[-1,1],[1,1]]){x.moveTo(cx+a*s,cy+b*s);x.lineTo(cx+a*s*.45,cy+b*s*.45);}x.stroke();x.globalAlpha=1;x.lineCap='butt';HitFX.a=Math.max(0,HitFX.a-dt*3.8);}
  // damage direction
  for(const d of dmgDirs){d.t-=dt;if(d.t<=0)continue;const rel=d.a-P.angle,R=110;x.strokeStyle=`rgba(255,30,20,${Math.min(.85,d.t)})`;x.lineWidth=7;x.beginPath();x.arc(cx,cy,R,rel-Math.PI/2-.32,rel-Math.PI/2+.32);x.stroke();}
  dmgDirs=dmgDirs.filter(d=>d.t>0);
  if(CFG.showFps){x.textAlign='left';x.font='11px monospace';x.fillStyle='rgba(255,255,255,.55)';x.fillText(`FPS ${Math.round(GS.fps)} · Z ${zombies.filter(z=>!z.dying).length}${Net.role!=='solo'?' · '+Net.role.toUpperCase()+' '+Net.code:''}`,8,H-8);}
}
function cross(x,cx,cy,g,L){x.beginPath();x.moveTo(cx,cy-g);x.lineTo(cx,cy-g-L);x.moveTo(cx,cy+g);x.lineTo(cx,cy+g+L);x.moveTo(cx-g,cy);x.lineTo(cx-g-L,cy);x.moveTo(cx+g,cy);x.lineTo(cx+g+L,cy);x.stroke();}
function drawScope(x,W,H,st,w){
  const cx=W/2,cy=H/2,sn=st.optic==='sniper',R=Math.min(W,H)*(sn?.46:.38);
  x.fillStyle='#000';x.beginPath();x.rect(0,0,W,H);x.arc(cx,cy,R,0,Math.PI*2,true);x.fill();
  const g=x.createRadialGradient(cx,cy,R*.75,cx,cy,R);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.85)');x.fillStyle=g;x.beginPath();x.arc(cx,cy,R,0,7);x.fill();
  x.strokeStyle='rgba(0,0,0,.9)';x.lineWidth=sn?1.6:1.2;x.beginPath();
  if(sn){x.moveTo(cx-R,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy-R);x.lineTo(cx,cy+R);x.stroke();
    x.lineWidth=4;x.beginPath();x.moveTo(cx-R,cy);x.lineTo(cx-R*.12,cy);x.moveTo(cx+R*.12,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy+R*.12);x.lineTo(cx,cy+R);x.stroke();
    x.fillStyle='rgba(0,0,0,.9)';for(let i=1;i<=4;i++){const o=R*.025*i*1.6;x.beginPath();x.arc(cx+o,cy,1.6,0,7);x.arc(cx-o,cy,1.6,0,7);x.fill();x.beginPath();x.arc(cx,cy+o,1.6,0,7);x.fill();}
    x.fillStyle='#ff2020';x.beginPath();x.arc(cx,cy,1.8,0,7);x.fill();
    x.font='bold 13px Courier New';x.textAlign='center';x.fillStyle='rgba(255,255,255,.7)';x.fillText((w.zs||st.zoom).toFixed(1)+'×  (scroll to zoom)',cx,cy+R-18);
  }else{x.moveTo(cx,cy+6);x.lineTo(cx,cy+R*.5);x.stroke();x.strokeStyle='#ff3a20';x.lineWidth=2.2;x.beginPath();x.moveTo(cx-9,cy+8);x.lineTo(cx,cy);x.lineTo(cx+9,cy+8);x.stroke();}
}

// ── SCREENS ──
const SCREENS=['mainM','levelM','mpM','hostM','clientM','pauseO','levelO','gameoverO'];
function showScreen(id){for(const s of SCREENS)$(s).classList.toggle('on',s===id);}
let levelMode='campaign';
function openLevels(mode){
  levelMode=mode;$('levelTitle').textContent=mode==='campaign'?'Campaign':'Endless Mode';
  $('levelSub').textContent=mode==='campaign'?'Clear every wave to unlock the next level · weapons & cash carry over':'Waves never stop · pick any unlocked map';
  $('lvgrid').innerHTML=DZ.LEVELS.map((L,i)=>{const lock=i>PROG.unlocked;const best=PROG.best[L.id];
    return`<div class="lv${lock?' locked':''}" onclick="${lock?'':`startLevel(${i},'${mode}',{})`}"><div class="no">${lock?'🔒':i+1}</div><div class="ic">${L.icon}</div><div class="nm">${L.name}</div><div class="ds">${L.desc}</div><div class="ds">${mode==='campaign'?L.waves+' waves':'Endless'}${best?' · best wave '+best:''}</div></div>`;}).join('');
  showScreen('levelM');
}
function openSettings(){
  $('sSens').value=CFG.sens;$('sScope').value=Math.round(CFG.scopeSens*10);$('sVol').value=CFG.vol;$('sFov').value=CFG.fov;$('sQ').value=CFG.quality;$('sShake').value=CFG.shake;$('sInv').checked=CFG.invertY;$('sFps').checked=CFG.showFps;$('sName').value=CFG.name;
  $('settingsO').classList.add('on');settingsOpen=true;
}
function closeSettings(){
  CFG.sens=+$('sSens').value;CFG.scopeSens=+$('sScope').value/10;CFG.vol=+$('sVol').value;CFG.fov=+$('sFov').value;CFG.shake=$('sShake').value;CFG.invertY=$('sInv').checked;CFG.showFps=$('sFps').checked;
  CFG.name=($('sName').value||'Survivor').slice(0,16);
  if(CFG.quality!==$('sQ').value){CFG.quality=$('sQ').value;GFX.setQuality(CFG.quality);}
  saveCfg();$('settingsO').classList.remove('on');settingsOpen=false;
}

// ── SHOP ──
let shopTab='w',shopCat='All',upSel=0;
const shopPrice=p=>Math.round(p*(puOn('firesale')?.5:1));
function openShop(){
  if(!GS.running||GS.over||GS.levelDone||player.dead)return;
  GS.shopOpen=true;intentionalUnlock=true;if(locked)document.exitPointerLock();
  $('pauseO').classList.remove('on');$('shopO').classList.add('on');upSel=Math.min(upSel,player.inv.length-1);renderShop();
}
function closeShop(){
  if(!GS.shopOpen)return;GS.shopOpen=false;$('shopO').classList.remove('on');
  if(GS.paused)$('pauseO').classList.add('on');else lockPointer();
}
function setShopTab(t){shopTab=t;renderShop();}
function renderShop(){
  $('shopMoney').textContent='$'+GS.money.toLocaleString();
  $('saleTag').style.display=puOn('firesale')?'block':'none';$('liveTag').style.display=Net.role!=='solo'?'block':'none';
  $('shopTabs').innerHTML=[['w','Weapons'],['u','Upgrades'],['p','Perks'],['i','Items']].map(([k,n])=>`<button class="btn${shopTab===k?' on':''}" onclick="setShopTab('${k}')">${n}</button>`).join('');
  $('shopC').innerHTML=shopTab==='w'?tabWeapons():shopTab==='u'?tabUpgrades():shopTab==='p'?tabPerks():tabItems();
  if(shopTab==='w')requestAnimationFrame(()=>WeaponVM.mountShopPreviews());
  hudDirty=true;
}
function buyBtn(label,ok,fn){return`<button class="buy" ${ok?'':'disabled'} onclick="${fn}">${label}</button>`;}
function tabWeapons(){
  let h='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">'+DZ.WEAPON_CATS.map(c=>`<button class="chip${shopCat===c?' on':''}" onclick="shopCat='${c}';renderShop()">${c}</button>`).join('')+'</div><div class="grid">';
  for(const id in DZ.WEAPONS){
    const d=DZ.WEAPONS[id];if(shopCat!=='All'&&d.cat!==shopCat)continue;
    const own=player.inv.findIndex(w=>w.id===id),pr=shopPrice(d.price);
    const sp={flame:'Burns targets',tesla:'Chain lightning ×6',rail:'Pierces everything',gl:'Explosive arc',rocket:'Huge explosion',plasma:'Energy bolts',minigun:'Spin-up · 1400 RPM'}[d.special]||'';
    h+=`<div class="card" style="border-color:${own>=0?'#44ff44':'rgba(255,34,0,.4)'}"><div class="gun-preview" data-weapon="${id}"></div>
      <div class="nm" style="color:${d.color}">${d.name}</div>
      <div class="st">${d.cat} · ${d.auto?'AUTO':d.burst>1?'BURST':'SEMI'}<br>DMG ${d.dmg}${d.pellets>1?'×'+d.pellets:''} · RPM ${Math.round(60000/d.rate)} · MAG ${d.mag}<br>${d.scope?DZ.OPTICS[d.scope].name+' · ':''}${d.zoom>1.6?d.zoom+'× zoom':''}${d.pierce&&d.pierce<99?' · pierce '+d.pierce:''} ${sp}</div>
      ${own>=0?`<div style="margin-top:8px;color:#44ff44;font-size:11px">✓ OWNED [${own+1}]</div>`:buyBtn(pr?`BUY $${pr.toLocaleString()}`:'TAKE (FREE)',GS.money>=pr&&player.inv.length<9,`buyWeapon('${id}')`)}</div>`;
  }
  return h+'</div>';
}
function buyWeapon(id){
  const d=DZ.WEAPONS[id],pr=shopPrice(d.price);
  if(player.inv.some(w=>w.id===id))return;
  if(player.inv.length>=9){showToast('Inventory full (9) — press G to drop a gun','#ff6655');return;}
  if(GS.money<pr)return;GS.money-=pr;player.inv.push(newWeapon(id));Snd.play('buy');ach('buy_sniper',id==='sniper');renderShop();
}
function upCost(w,k){const d=DZ.WEAPONS[w.id],lv=w.up[k],tot=Object.values(w.up).reduce((a,b)=>a+b,0);return shopPrice(Math.floor((350+d.price*.12)*(lv+1)*(1+tot*.12)));}
function tierCost(w){const n=(w.tier||0)+1;return n<DZ.TIERS.length?shopPrice(DZ.TIERS[n].price+Math.round(DZ.WEAPONS[w.id].price*.4)):0;}
function refillCost(w){return shopPrice(200+Math.round(DZ.WEAPONS[w.id].price*.04));}
function tabUpgrades(){
  if(!player.inv.length)return'<div style="color:#888">No weapons.</div>';
  let h='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+player.inv.map((w,i)=>`<button class="chip${upSel===i?' on':''}" onclick="upSel=${i};renderShop()">[${i+1}] ${DZ.WEAPONS[w.id].name}${w.tier?' '+DZ.TIERS[w.tier].name:''}</button>`).join('')+'</div>';
  const w=player.inv[upSel];if(!w)return h;const d=DZ.WEAPONS[w.id],st=wstats(w);
  h+=`<div class="st" style="color:#aaa;margin-bottom:10px;font-size:12px">${d.name}: DMG ${Math.round(st.dmg)} · RPM ${Math.round(60000/st.rate)} · MAG ${st.mag} · RELOAD ${(st.reload/1000).toFixed(1)}s · CRIT ${Math.round(st.crit*100)}% · ZOOM ${st.zoom}×</div><div class="grid">`;
  for(const k in DZ.UPGRADES){
    const U=DZ.UPGRADES[k],lv=w.up[k],c=upCost(w,k);
    const bars=Array.from({length:5},(_,i)=>`<span style="display:inline-block;width:18px;height:5px;margin-right:2px;border-radius:2px;background:${i<lv?'#ffaa00':'rgba(255,255,255,.14)'}"></span>`).join('');
    h+=`<div class="card" style="border-color:rgba(255,160,0,.4)"><div class="nm" style="color:#ffaa00">${U.name}</div><div class="st">${U.desc}</div><div style="margin:7px 0">${bars}</div>
      ${lv>=5?'<div style="color:#44ff44;font-size:11px">MAX</div>':buyBtn('UPGRADE $'+c.toLocaleString(),GS.money>=c,`buyUpgrade('${k}')`)}</div>`;
  }
  const nt=(w.tier||0)+1;
  h+=`<div class="card" style="border-color:#ffcc33"><div class="nm" style="color:${DZ.TIERS[Math.min(nt,2)].tint}">⚙ Weapon Tier</div><div class="st">Mk II: ×1.55 dmg, +25% mag<br>Mk III: ×2.3 dmg, +50% mag</div>
    ${nt>=DZ.TIERS.length?'<div style="color:#44ff44;font-size:11px;margin-top:8px">Mk III — MAX</div>':buyBtn(`→ ${DZ.TIERS[nt].name} $${tierCost(w).toLocaleString()}`,GS.money>=tierCost(w),'buyTier()')}</div>`;
  if(!DZ.NO_OPTIC.has(w.id)){
    for(const o in DZ.OPTICS){
      const O=DZ.OPTICS[o],cur=opticOf(w),have=cur===o,better=cur&&DZ.OPTICS[cur].rank>=O.rank,pr=shopPrice(O.price);
      h+=`<div class="card" style="border-color:rgba(0,200,255,.4)"><div class="nm" style="color:#66ddff">🔭 ${O.name}</div><div class="st">${O.desc}</div>
        ${have?'<div style="color:#44ff44;font-size:11px;margin-top:8px">✓ EQUIPPED</div>':better?'<div style="color:#888;font-size:11px;margin-top:8px">Better optic fitted</div>':buyBtn('FIT $'+pr.toLocaleString(),GS.money>=pr,`buyOptic('${o}')`)}</div>`;
    }
    h+=`<div class="card" style="border-color:rgba(255,40,40,.4)"><div class="nm" style="color:#ff5555">🔴 Laser Sight</div><div class="st">-40% hip-fire spread</div>${w.laser?'<div style="color:#44ff44;font-size:11px;margin-top:8px">✓ FITTED</div>':buyBtn('FIT $'+shopPrice(600),GS.money>=shopPrice(600),'buyLaser()')}</div>`;
  }
  h+=`<div class="card" style="border-color:rgba(255,220,0,.4)"><div class="nm" style="color:#ffdd44">📦 Refill Ammo</div><div class="st">Reserve ${w.res} / ${st.maxRes}</div>${buyBtn('REFILL $'+refillCost(w),GS.money>=refillCost(w)&&w.res<st.maxRes,'buyRefill()')}</div>`;
  if(Object.values(w.up).every(v=>v>=5))ach('full_upgrade',true);
  return h+'</div>';
}
function selW(){return player.inv[upSel];}
function spend(c){if(GS.money<c)return false;GS.money-=c;Snd.play('buy');return true;}
function buyUpgrade(k){const w=selW();if(!w||w.up[k]>=5||!spend(upCost(w,k)))return;w.up[k]++;renderShop();}
function buyTier(){const w=selW();if(!w||(w.tier||0)>=DZ.TIERS.length-1||!spend(tierCost(w)))return;w.tier=(w.tier||0)+1;const st=wstats(w);w.mag=st.mag;renderShop();showToast(DZ.WEAPONS[w.id].name+' '+DZ.TIERS[w.tier].name+'!',DZ.TIERS[w.tier].tint);}
function buyOptic(o){const w=selW();if(!w||!spend(shopPrice(DZ.OPTICS[o].price)))return;w.optic=o;w.zs=0;renderShop();}
function buyLaser(){const w=selW();if(!w||w.laser||!spend(shopPrice(600)))return;w.laser=true;renderShop();}
function buyRefill(){const w=selW();if(!w||!spend(refillCost(w)))return;w.res=wstats(w).maxRes;renderShop();}
function tabPerks(){
  let h='<div class="grid">';
  for(const id in DZ.PERKS){const p=DZ.PERKS[id],own=player.perks.has(id),pr=shopPrice(p.price);
    h+=`<div class="card" style="border-color:${own?'#44ff44':'rgba(170,68,255,.45)'}"><div style="font-size:26px">${p.icon}</div><div class="nm" style="color:#cc88ff">${p.name}</div><div class="st">${p.desc}</div>
      ${own?'<div style="color:#44ff44;font-size:11px;margin-top:8px">✓ ACTIVE</div>':buyBtn('BUY $'+pr.toLocaleString(),GS.money>=pr,`buyPerk('${id}')`)}</div>`;}
  return h+'</div>';
}
function buyPerk(id){
  if(player.perks.has(id)||!spend(shopPrice(DZ.PERKS[id].price)))return;player.perks.add(id);
  if(id==='ironBody'){player.maxHp+=50;player.hp+=50;}
  if(id==='heavyArmor'){player.maxArmor=200;addArmor(100);}
  renderShop();
}
function tabItems(){
  let h='<div class="grid">';
  for(const it of DZ.ITEMS){const pr=shopPrice(it.p);h+=`<div class="card" style="border-color:rgba(0,200,200,.4)"><div style="font-size:26px">${it.i}</div><div class="nm" style="color:#88ffee">${it.n}</div><div class="st">${it.d}</div>${buyBtn('BUY $'+pr,GS.money>=pr,`buyItem('${it.id}')`)}</div>`;}
  return h+'</div>';
}
function buyItem(id){
  const it=DZ.ITEMS.find(i=>i.id===id);if(!it||!spend(shopPrice(it.p)))return;
  switch(id){
    case'medkit':heal(50);break;case'bigmed':heal(9999);break;
    case'ashrd':addArmor(25);break;case'avest':addArmor(75);break;
    case'apack':if(player.w)player.w.res=Math.max(player.w.res,wstats(player.w).maxRes);break;
    case'acrate':for(const w of player.inv)w.res=Math.max(w.res,wstats(w).maxRes);break;
    case'nades':player.grenades+=3;break;
    case'adrn':player.buffs.speed=GT+30;break;
    case'regen':player.buffs.regen=GT+60;break;
  }
  renderShop();
}

// ── LEVEL FLOW ──
function loadoutFromLobby(){
  let ids=DZ.DEFAULT_LOADOUT.slice();
  try{const l=window.LobbyBridge&&LobbyBridge.takeLaunch();if(l&&Array.isArray(l.loadout)){const v=l.loadout.filter(id=>DZ.WEAPONS[id]);if(v.length)ids=v;}}catch(e){}
  return ids.map(newWeapon);
}
function freshRun(){
  Object.assign(GS,{score:0,kills:0,money:300,xp:0,plv:1,xpNext:100,hs:0,wavesCleared:0,reported:false});
  UNLOCKED.clear();player.inv=loadoutFromLobby();player.wi=0;resetPlayer(true);
}
function takeSnap(){return JSON.parse(JSON.stringify({inv:player.inv,wi:player.wi,money:GS.money,score:GS.score,kills:GS.kills,xp:GS.xp,plv:GS.plv,xpNext:GS.xpNext,hs:GS.hs,wc:GS.wavesCleared,perks:[...player.perks],maxHp:player.maxHp,maxArmor:player.maxArmor,armor:player.armor,grenades:player.grenades}));}
function restoreSnap(s){
  s=JSON.parse(JSON.stringify(s));player.inv=s.inv;player.wi=Math.min(s.wi,s.inv.length-1);
  Object.assign(GS,{money:s.money,score:s.score,kills:s.kills,xp:s.xp,plv:s.plv,xpNext:s.xpNext,hs:s.hs,wavesCleared:s.wc});
  player.perks=new Set(s.perks);player.maxHp=s.maxHp;player.maxArmor=s.maxArmor;player.armor=s.armor;player.grenades=s.grenades;player.buffs={};
}
function startLevel(li,mode,o){
  o=o||{};const L=DZ.LEVELS[li];if(!L)return;
  Snd.init();if(Snd.ac&&Snd.ac.state==='suspended')Snd.ac.resume();
  $('shopO').classList.remove('on');$('settingsO').classList.remove('on');settingsOpen=false;
  GS.li=li;GS.mode=mode;GS.level=L;GS.map=DZMaps.buildMap(L.id);
  Nav.load(GS.map);clearWorld();GFX.buildLevel(GS.map,L);buildMinimap();
  if(o.restore&&GS.levelSnap)restoreSnap(GS.levelSnap);else if(!o.carry)freshRun();
  resetPlayer(false);
  if(Net.role==='client'){const k=parseInt(String(Net.myId).slice(1))||2;player.x+=(k%2?1:-1)*45*Math.ceil((k-1)/2);Nav.resolve(player,P_RADIUS);}
  for(const w of player.inv){const st=wstats(w);w.mag=Math.min(Math.max(w.mag,0),st.mag);}
  GS.levelSnap=takeSnap();
  Object.assign(GS,{running:true,paused:false,over:false,shopOpen:false,levelDone:false,wave:o.wave||1,wActive:false,timer:o.wave?4:8,wTotal:0,wSpawned:0,bossQ:[],pu:{},left:0,bossInfo:null});
  for(const p of peers.values()){p.dead=false;p.seen=performance.now();if(Net.role==='host')p.ready=false;}
  dmgNums=[];dmgDirs=[];player.shield=GT+2;
  showScreen(null);$('ui').classList.remove('off');hudDirty=true;
  if(Net.role==='host')Net.broadcast({t:'start',li,mode,carry:!!o.carry,retry:!!o.restore});
  showWave(L.icon+' '+L.name.toUpperCase(),mode==='campaign'?`Level ${li+1} · ${L.waves} waves · boss on the last wave`:'Endless mode · how long can you last?');
  Snd.play('wave');lockPointer();
  setTimeout(()=>{if(GS.running&&!locked&&!GS.paused&&!GS.shopOpen)showToast('CLICK TO PLAY','#ffffff',2200);},500);
}
function levelComplete(){
  const final=GS.li===DZ.LEVELS.length-1;
  if(Net.role==='host')Net.broadcast({t:'lvl',li:GS.li,final});
  showLevelDone(GS.li,final);
}
function showLevelDone(li,final){
  GS.levelDone=true;
  PROG.unlocked=Math.max(PROG.unlocked,Math.min(DZ.LEVELS.length-1,li+1));PROG.best[DZ.LEVELS[li].id]=Math.max(PROG.best[DZ.LEVELS[li].id]||0,GS.wave);saveProg();
  ach('level_clear',true);if(final)ach('campaign_done',true);
  intentionalUnlock=true;if(locked)document.exitPointerLock();
  Snd.play(final?'victory':'levelup');
  $('lvlDoneT').textContent=final?'🌅 VICTORY! 🌅':'LEVEL COMPLETE';
  $('lvlStats').innerHTML=`${DZ.LEVELS[li].icon} ${DZ.LEVELS[li].name}<br>Score: ${GS.score.toLocaleString()} · Kills: ${GS.kills} · Headshots: ${GS.hs}<br>Cash carried over: $${GS.money.toLocaleString()}`+(final?'<br><span style="color:#44ff88">You cleared the Dead Zone! Try Endless mode next.</span>':`<br>Next: ${DZ.LEVELS[li+1].icon} ${DZ.LEVELS[li+1].name}`);
  const client=Net.role==='client';
  $('nextBtn').style.display=!client&&!final?'':'none';$('waitHost').style.display=client&&!final?'block':'none';
  if(final)reportMatch();
  showScreen('levelO');
}
function nextLevel(){if(Net.role==='client')return;startLevel(GS.li+1,'campaign',{carry:true});}
function retryLevel(){if(Net.role==='client')return;$('gameoverO').classList.remove('on');startLevel(GS.li,GS.mode,{restore:true});}
function playerDown(){
  if(player.dead)return;player.dead=true;player.reloading=false;Snd.play('death');
  if(Net.role==='solo'){squadWiped();return;}
  player.respawnT=10;
}
function respawnTick(dt){
  if(!player.dead||Net.role==='solo'||GS.over)return;
  player.respawnT-=dt;
  if(player.respawnT<=0){
    const mate=[...peers.values()].find(p=>p.ready&&!p.dead);
    const sp=mate?{x:mate.x+30,y:mate.y}:GS.map.pSpawn;
    player.x=sp.x;player.y=sp.y;Nav.resolve(player,P_RADIUS);
    player.dead=false;player.hp=Math.round(player.maxHp*.6);player.shield=GT+3;player.lastDmg=GT;hudDirty=true;showToast('BACK IN THE FIGHT','#44ff88');
  }
}
function squadWiped(){
  if(GS.over)return;GS.over=true;
  if(Net.role==='host')Net.broadcast({t:'over'});
  showGameOver(Net.role==='solo'?'YOU DIED':'SQUAD WIPED');
}
function showGameOver(title){
  GS.over=true;intentionalUnlock=true;if(locked)document.exitPointerLock();
  reportMatch();
  const coins=window.LobbyBridge?LobbyBridge.coinsFor({kills:GS.kills,wave:GS.wavesCleared,score:GS.score}):0;
  $('goT').textContent=title;
  $('goS').innerHTML=`${GS.level.icon} ${GS.level.name} · Wave ${GS.wave}<br>Score: ${GS.score.toLocaleString()} · Kills: ${GS.kills} · Headshots: ${GS.hs}<br>Waves cleared: ${GS.wavesCleared} · Level ${GS.plv}<br><span style="color:#ffdd00">Lobby coins earned: ${coins} ⛃</span>`;
  $('retryBtn').style.display=Net.role==='client'?'none':'';
  if(GS.mode==='endless'){PROG.best[GS.level.id]=Math.max(PROG.best[GS.level.id]||0,GS.wave);saveProg();}
  showScreen('gameoverO');
}
function reportMatch(){
  if(GS.reported||!GS.kills&&!GS.wavesCleared)return;GS.reported=true;
  try{if(window.LobbyBridge)LobbyBridge.reportMatch({kills:GS.kills,wave:GS.wavesCleared,score:GS.score});}catch(e){}
}
function pauseGame(){
  if(!GS.running||GS.over||GS.levelDone)return;GS.paused=true;intentionalUnlock=true;if(locked)document.exitPointerLock();
  $('pauseSub').textContent=Net.role==='solo'?'':'Multiplayer — the match keeps running!';showScreen('pauseO');
}
function resumeGame(){GS.paused=false;showScreen(null);if(settingsOpen)closeSettings();if(GS.running&&!GS.shopOpen)lockPointer();}
function quitToMenu(){
  if(GS.running)reportMatch();
  GS.running=false;GS.over=false;GS.paused=false;GS.shopOpen=false;GS.levelDone=false;
  $('shopO').classList.remove('on');intentionalUnlock=true;if(locked)document.exitPointerLock();
  clearWorld();$('ui').classList.add('off');
  if(Net.role==='host'){Net.broadcast({t:'menu'});openHostRoom();}
  else if(Net.role==='client'){leaveMP();}
  else showScreen('mainM');
  menuBackdrop();
}
function backToLobby(){reportMatch();Net.leave();window.location.href='lobby.html';}

// ── MULTIPLAYER UI ──
function openMP(){$('mpName').value=CFG.name;$('mpErr').textContent='';showScreen('mpM');}
function readName(){CFG.name=($('mpName').value||'Survivor').trim().slice(0,16)||'Survivor';saveCfg();}
async function hostGame(){
  readName();$('mpErr').style.color='#88ccff';$('mpErr').textContent='Creating room…';
  try{await Net.host();$('mpErr').textContent='';openHostRoom();}
  catch(e){$('mpErr').style.color='';$('mpErr').textContent='Could not create a room: '+(e.message||e.type||e);Net.leave();}
}
let hostMode='campaign';
function openHostRoom(){
  $('roomCode').textContent=Net.code;$('roomLink').value=Net.link();
  setHostMode(hostMode);renderRosters();showScreen('hostM');
}
function setHostMode(m){
  hostMode=m;$('hmC').classList.toggle('on',m==='campaign');$('hmE').classList.toggle('on',m==='endless');
  $('hostLevel').innerHTML=DZ.LEVELS.map((L,i)=>i<=PROG.unlocked?`<option value="${i}">${i+1}. ${L.icon} ${L.name}${m==='campaign'?' ('+L.waves+' waves)':''}</option>`:'').join('');
}
function hostStart(){startLevel(+$('hostLevel').value||0,hostMode,{});}
async function joinGame(){
  readName();const v=$('joinIn').value;$('mpErr').style.color='#88ccff';$('mpErr').textContent='Connecting…';
  try{
    const w=await Net.join(v);$('mpErr').textContent='';
    if(history.replaceState)history.replaceState(null,'',location.href.split('?')[0]);
    if(w.inGame&&w.start){startLevel(w.start.li,w.start.mode,{wave:w.start.wave});}
    else{renderRosters();showScreen('clientM');}
  }catch(e){$('mpErr').style.color='';$('mpErr').textContent=e.message||String(e);}
}
function leaveMP(){
  Net.leave();for(const p of peers.values())if(p.avatar)GFX.remove(p.avatar.root);peers.clear();
  if(GS.running){GS.running=false;clearWorld();$('ui').classList.add('off');menuBackdrop();}
  showScreen('mpM');
}
function renderRosters(){
  const h=Net.roster.map(r=>`<div style="color:${r.color}">● ${esc(r.name)}${r.pid==='H'?' (host)':''}${r.pid===Net.myId?' — you':''}</div>`).join('');
  $('hostRoster').innerHTML=h+(Net.roster.length<MAX_PLAYERS?'<div style="color:#555">waiting for players…</div>':'');$('clientRoster').innerHTML=h;
}
function copyText(t){try{navigator.clipboard.writeText(t).then(()=>showToast('Copied!','#44ff88',1200),()=>fallbackCopy(t));}catch(e){fallbackCopy(t);}}
function fallbackCopy(t){const i=$('roomLink');const old=i.value;i.value=t;i.select();document.execCommand('copy');i.value=old;showToast('Copied!','#44ff88',1200);}
function copyLink(){copyText(Net.link());}
function copyCode(){copyText(Net.code);}

// host: a player connected
function onNetJoin(pid,name,color){
  peers.set(pid,{pid,name,color,ready:false,x:GS.map?GS.map.pSpawn.x:0,y:GS.map?GS.map.pSpawn.y:0,z:0,a:0,p:0,w:'pistol',hp:100,mhp:100,dead:false,sh:0,cr:false,seen:performance.now()});
  Net.sendTo(pid,{t:'welcome',pid,roster:Net.roster,inGame:GS.running&&!GS.over,start:GS.running?{li:GS.li,mode:GS.mode,wave:GS.wave}:null});
  Net.broadcast({t:'roster',roster:Net.roster});renderRosters();
  if(GS.running)killFeed(name+' joined the fight');else Snd.play('pickup');
}
function onNetLeave(pid){
  if(pid==='H'&&Net.role==='client'){
    const wasRunning=GS.running;Net.leave();
    for(const p of peers.values())if(p.avatar)GFX.remove(p.avatar.root);peers.clear();
    if(wasRunning){reportMatch();GS.running=false;clearWorld();$('ui').classList.add('off');intentionalUnlock=true;if(locked)document.exitPointerLock();menuBackdrop();}
    showScreen('mpM');$('mpErr').style.color='';$('mpErr').textContent='The host closed the game.';return;
  }
  const p=peers.get(pid);if(p){if(p.avatar)GFX.remove(p.avatar.root);peers.delete(pid);if(GS.running)killFeed(p.name+' left');}
  Net.broadcast({t:'roster',roster:Net.roster});renderRosters();hudDirty=true;
}
function onNetError(e){console.warn('net',e&&e.type,e);}
function onNetMsg(pid,m){
  if(Net.role==='host'){
    const p=peers.get(pid);if(!p)return;p.seen=performance.now();
    switch(m.t){
      case'p':Object.assign(p,{x:m.x,y:m.y,z:m.z,a:m.a,p:m.p,w:m.w,hp:m.hp,mhp:m.mhp,dead:!!m.d,sh:m.sh,cr:!!m.cr});if(GS.running)p.ready=true;break;
      case'hit':{const z=zombies.find(o=>o.id===m.z);if(z)hostDamage(z,+m.d||0,!!m.h,pid,{burn:!!m.b,push:m.px||m.py?[m.px,m.py]:null});break;}
      case'boom':hostExplosion(+m.x,+m.y,+m.z,Math.min(300,+m.r||0),+m.d||0,pid);break;
    }
    return;
  }
  switch(m.t){
    case'roster':Net.roster=m.roster;for(const r of m.roster){const q=peers.get(r.pid);if(q){q.name=r.name;q.color=r.color;}}renderRosters();break;
    case'start':startLevel(m.li,m.mode,{carry:m.carry,restore:m.retry});break;
    case's':if(GS.running)applySnapshot(m);break;
    case'dmg':localHurt(m.d,m.x,m.y);break;
    case'kill':onKill(m.rew,m.xp,!!m.head,m.tid);break;
    case'pk':localPickup(m.type,m.val);break;
    case'pu':localPowerup(m.id,m.by);break;
    case'kf':killFeed(m.k,m.z,m.h);break;
    case'ann':showWave(m.m,m.s);if(m.snd)Snd.play(m.snd);break;
    case'fx':playFx(m.k,m.x,m.y,m.r);break;
    case'bonus':addMoney(m.m);break;
    case'lvl':showLevelDone(m.li,m.final);break;
    case'over':showGameOver('SQUAD WIPED');break;
    case'menu':if(GS.running||GS.over){reportMatch();GS.running=false;GS.over=false;clearWorld();$('ui').classList.add('off');intentionalUnlock=true;if(locked)document.exitPointerLock();menuBackdrop();}renderRosters();showScreen('clientM');break;
  }
}
let netT=0;
function netTick(dt){
  if(Net.role==='solo')return;netT+=dt;if(netT<.05)return;netT=0;
  if(Net.role==='host'){
    if(Net.conns.size&&GS.running)Net.broadcast(buildSnapshot());
  }else if(GS.running){
    const P=player;Net.send({t:'p',x:P.x|0,y:P.y|0,z:P.z|0,a:+P.angle.toFixed(3),p:+P.viewPitch.toFixed(3),w:P.w?P.w.id:'',hp:Math.ceil(P.hp),mhp:P.maxHp,d:P.dead?1:0,sh:P.shots,cr:P.crouchF>.5?1:0});
  }
}

// keep-alive: clients ping while in the lobby; the host drops anyone silent for 20s
setInterval(()=>{
  if(Net.role==='client'&&!GS.running)Net.send({t:'hb'});
  if(Net.role==='host'){const now=performance.now();for(const p of peers.values())if(now-p.seen>20000){const c=Net.conns.get(p.pid);if(c)c.close();Net._drop(c||{pid:p.pid});}}
},1000);

// ── INPUT ──
document.addEventListener('keydown',e=>{
  if(e.target&&(e.target.tagName==='INPUT'&&e.target.type==='text'||e.target.tagName==='SELECT'))return;
  K[e.code]=true;
  if(e.code==='Tab'){e.preventDefault();if(GS.running&&!GS.over&&!GS.levelDone)GS.paused?resumeGame():pauseGame();return;}
  if(e.code==='Escape'){if(settingsOpen)closeSettings();else if(GS.shopOpen)closeShop();else if(GS.paused)resumeGame();else if(GS.running&&!GS.over&&!GS.levelDone)pauseGame();return;}
  if(!GS.running||GS.over||GS.levelDone)return;
  if(e.code==='KeyF'){GS.shopOpen?closeShop():openShop();return;}
  if(GS.paused||GS.shopOpen||player.dead)return;
  if(e.code==='KeyR')startReload();
  if(/^Digit[1-9]$/.test(e.code))switchWeapon(+e.code.slice(5)-1);
  if(e.code==='KeyQ')throwGrenade();
  if(e.code==='KeyV')melee();
  if(e.code==='KeyT')GFX.flashOn=!GFX.flashOn;
  if(e.code==='KeyG'&&player.inv.length>1){const w=player.inv.splice(player.wi,1)[0];player.wi=Math.min(player.wi,player.inv.length-1);showToast('Dropped '+DZ.WEAPONS[w.id].name,'#aaaaaa',1200);hudDirty=true;}
});
document.addEventListener('keyup',e=>{K[e.code]=false;});
document.addEventListener('mousemove',e=>{if(locked){M.dx+=Math.max(-250,Math.min(250,e.movementX));M.dy+=Math.max(-250,Math.min(250,e.movementY));}});
document.addEventListener('mousedown',e=>{
  M.btn[e.button]=true;if(e.target!==canvas)return;
  if(GS.running&&!GS.paused&&!GS.shopOpen&&!GS.over&&!GS.levelDone){if(!locked){lockPointer();return;}if(e.button===0&&!player.dead)onTriggerDown();}
});
document.addEventListener('mouseup',e=>{M.btn[e.button]=false;});
document.addEventListener('pointerlockchange',()=>{
  locked=!!document.pointerLockElement;
  if(!locked){for(const k in M.btn)M.btn[k]=false;if(GS.running&&!GS.over&&!GS.levelDone&&!GS.shopOpen&&!GS.paused&&!intentionalUnlock)pauseGame();}
  intentionalUnlock=false;
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{
  if(!GS.running||GS.paused||GS.shopOpen||!player.w)return;e.preventDefault();
  const w=player.w,st=wstats(w);
  if(st.optic==='sniper'&&player.ads<.3){w.zs=Math.max(st.zMin,Math.min(st.zMax,(w.zs||st.zoom)*(e.deltaY<0?1.15:1/1.15)));return;}
  const n=player.inv.length;switchWeapon((player.wi+(e.deltaY>0?1:-1)+n)%n);
},{passive:false});
window.addEventListener('blur',()=>{for(const k in K)K[k]=false;for(const k in M.btn)M.btn[k]=false;});

function resize(){
  const w=innerWidth,h=innerHeight;ov.width=w;ov.height=h;
  if(GFX.renderer){GFX.resize(w,h);WeaponVM.resize(w,h);}
}
window.addEventListener('resize',resize);

// ── MENU BACKDROP ──
let backdrop=null;
function menuBackdrop(){
  const L=DZ.LEVELS[Math.min(PROG.unlocked,DZ.LEVELS.length-1)]||DZ.LEVELS[0];
  GS.level=L;GS.map=DZMaps.buildMap(L.id);Nav.load(GS.map);GFX.buildLevel(GS.map,L);backdrop={t:0};
}

// ── MAIN LOOP ──
let lastT=0;
function loop(ts){
  requestAnimationFrame(loop);
  let dt=(ts-lastT)/1000;lastT=ts;if(!(dt>0))dt=.016;dt=Math.min(dt,.05);
  GS.fpsN++;GS.fpsT+=dt;if(GS.fpsT>=.5){GS.fps=GS.fpsN/GS.fpsT;GS.fpsN=0;GS.fpsT=0;}
  if(!GFX.ready)return;
  if(GS.running){
    const frozen=GS.over||Net.role==='solo'&&(GS.paused||GS.shopOpen);
    if(!frozen){
      GT+=dt;updatePlayer(dt);updProjectiles(dt);updateWorld(dt);respawnTick(dt);
      for(const d of dmgNums){d.life-=dt;d.h+=dt*34;}dmgNums=dmgNums.filter(d=>d.life>0);
      for(const id in GS.pu)if(GS.pu[id]<GT){delete GS.pu[id];hudDirty=true;}
    }else{M.dx=M.dy=0;}
    netTick(dt);
    shakeMag*=Math.pow(.015,dt);
    const sk=shakeMag*.035,eye=player.dead?Math.max(18,player.eye-30):player.eye;
    GFX.setView(player.x,player.y,eye,player.angle+(Math.random()-.5)*sk,player.viewPitch+(Math.random()-.5)*sk,CFG.fov/curZoom(),(Math.random()-.5)*sk*.5);
    syncVisuals(dt);GFX.ambient(dt,player.x,player.y);
    const w=player.w,def=w&&DZ.WEAPONS[w.id],st=w&&wstats(w);
    const extraOptic=w&&w.optic&&opticOf(w)!==def.scope?opticOf(w):null;
    WeaponVM.update(dt,{id:w&&w.id,tier:w&&w.tier,optic:extraOptic,laser:w&&w.laser,bob:player.bob,bobAmt:player.bobAmt,sprint:player.sprint,crouch:player.crouchF>.5,adsF:player.ads,
      reloadP:player.reloading?(GT-player.reloadStart)/player.reloadDur:0,switchP:Math.min(1,(GT-player.switchT)/.35),meleeP:GT-player.meleeT<.35?(GT-player.meleeT)/.35:0,spin:player.spin,
      mdx:M.vdx,mdy:M.vdy,hide:st&&(st.optic==='sniper'||st.optic==='acog')&&player.ads<.25,visible:!player.dead&&!GS.shopOpen&&!GS.over});
    M.vdx=M.vdy=0;
  }else if(backdrop){
    backdrop.t+=dt;const B=GS.map.B,a=backdrop.t*.05;
    GFX.setView(B/2+Math.cos(a)*700,B/2+Math.sin(a)*700,GS.level.theme.indoor?120:260,a+Math.PI*.82,-.12,80,0);
    GFX.ambient(dt,B/2,B/2);
  }
  GFX.frame(dt,ts/1000);GFX.render();
  if(GS.running)WeaponVM.render(GFX.renderer);
  drawOverlay(dt);
  if(GS.running){
    frameHUD();hudT+=dt;
    if(hudT>.1){hudT=0;refreshHUD();drawMinimap();if(GS.shopOpen)$('shopMoney').textContent='$'+GS.money.toLocaleString();}
    else if(hudDirty&&hudT>.03)refreshHUD();
  }
}

// ── BOOT ──
async function boot(){
  $('helpT').innerHTML=DZ.KEY_HELP;resize();
  try{window.THREE=await import('three');}
  catch(e){$('loadT').innerHTML='Could not load the 3D engine.<br>Check your internet connection and refresh.';return;}
  try{window.GLTFLoader=(await import('three/addons/loaders/GLTFLoader.js')).GLTFLoader;}catch(e){}
  GFX.init(canvas,CFG.quality);WeaponVM.init();resize();
  menuBackdrop();
  $('loadO').classList.add('h');showScreen('mainM');
  requestAnimationFrame(loop);
  const j=new URLSearchParams(location.search).get('join');
  if(j){openMP();$('joinIn').value=j;joinGame();}
}
boot();
