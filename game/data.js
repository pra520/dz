// ═══════════════════════════════════════════════════════
//  DEAD ZONE — Game data
//  Weapons, zombie types, perks, power-ups, items, levels.
//  Everything here is plain data so it is easy to tune.
//  Gun ids match lobby/data.js and gun_models_3d/manifest.json.
// ═══════════════════════════════════════════════════════
(function(global){
'use strict';

// ── WEAPONS ──
// dmg: per pellet · rate: ms between shots · rec: recoil kick · spread: radians
// mag/ammo: magazine / reserve · reload: ms · range: full-damage distance
// zoom: ADS zoom factor · scope: built-in optic (reddot | acog | sniper)
// special: plasma | flame | tesla | rail | gl (grenade launcher) | rocket | minigun
// pierce: extra zombies a bullet passes through
const WEAPONS={
  pistol:     {name:'Pistol',          cat:'Sidearm', dmg:35,  rate:280, rec:3,   spread:.028,mag:15, ammo:150, reload:1400,range:1200,price:0,    snd:[900,.35], color:'#aaaaaa',zoom:1.3, model:'Pistol.glb',
               proc:{kind:'pistol',len:.55}},
  revolver:   {name:'Revolver',        cat:'Sidearm', dmg:80,  rate:620, rec:8,   spread:.020,mag:6,  ammo:60,  reload:2200,range:1500,price:800,  snd:[600,.5],  color:'#8b7355',zoom:1.4, model:'Revolver.glb',pierce:1,
               proc:{kind:'revolver',len:.62}},
  deagle:     {name:'Desert Eagle',    cat:'Sidearm', dmg:110, rate:420, rec:10,  spread:.024,mag:7,  ammo:70,  reload:1800,range:1600,price:1500, snd:[520,.55], color:'#c9c9c9',zoom:1.4, pierce:1,
               proc:{kind:'pistol',len:.66,chunky:true}},
  uzi:        {name:'Machine Pistol',  cat:'SMG',     dmg:18,  rate:58,  rec:1.6, spread:.070,mag:32, ammo:384, reload:1300,range:700, price:900,  snd:[1300,.22],color:'#555566',zoom:1.2, auto:true,
               proc:{kind:'smg',len:.62,compact:true}},
  smg:        {name:'SMG',             cat:'SMG',     dmg:22,  rate:75,  rec:2,   spread:.055,mag:35, ammo:350, reload:1500,range:800, price:1200, snd:[1200,.25],color:'#6677aa',zoom:1.35,auto:true, model:'smg.glb',
               proc:{kind:'smg',len:.8}},
  ar:         {name:'Assault Rifle',   cat:'Rifle',   dmg:40,  rate:105, rec:3.5, spread:.030,mag:30, ammo:270, reload:1900,range:1600,price:0,    snd:[800,.38], color:'#44aa44',zoom:1.5, auto:true, model:'Assault Rifle.glb',
               proc:{kind:'rifle',len:1}},
  burstRifle: {name:'Burst Rifle',     cat:'Rifle',   dmg:40,  rate:330, rec:3,   spread:.024,mag:30, ammo:270, reload:1800,range:1800,price:1800, snd:[850,.35], color:'#66aaff',zoom:1.7, burst:3, scope:'reddot', model:'burst rifle.glb',
               proc:{kind:'rifle',len:.98,optic:'reddot'}},
  ak47:       {name:'AK-47',           cat:'Rifle',   dmg:52,  rate:115, rec:4.6, spread:.038,mag:30, ammo:300, reload:2100,range:1600,price:2200, snd:[700,.45], color:'#8a5a2b',zoom:1.5, auto:true,
               proc:{kind:'rifle',len:1.02,wood:true,curvedMag:true}},
  dmr:        {name:'Marksman DMR',    cat:'Marksman',dmg:100, rate:300, rec:6,   spread:.008,mag:15, ammo:120, reload:2200,range:3000,price:3000, snd:[650,.5],  color:'#5c6b4a',zoom:4,   scope:'acog', pierce:1,
               proc:{kind:'rifle',len:1.1,optic:'acog',longBarrel:true}},
  sniper:     {name:'Sniper Rifle',    cat:'Marksman',dmg:230, rate:1300,rec:16,  spread:.003,mag:5,  ammo:45,  reload:3000,range:4000,price:3500, snd:[280,.7],  color:'#aaffaa',zoom:6,   scope:'sniper',pierce:2, model:'Sniper Rifle.glb',
               proc:{kind:'sniper',len:1.25,optic:'sniper'}},
  heavySniper:{name:'Anti-Materiel .50',cat:'Marksman',dmg:520,rate:1800,rec:24,  spread:.002,mag:4,  ammo:36,  reload:3400,range:5000,price:7000, snd:[200,.85], color:'#445544',zoom:10,  scope:'sniper',pierce:6,
               proc:{kind:'sniper',len:1.4,optic:'sniper',heavy:true}},
  shotgun:    {name:'Shotgun',         cat:'Shotgun', dmg:20,  rate:650, rec:12,  spread:.120,mag:8,  ammo:72,  reload:2800,range:450, price:0,    snd:[400,.55], color:'#cc8844',zoom:1.2, pellets:8, model:'Shotgun.glb',
               proc:{kind:'shotgun',len:1,wood:true}},
  doubleBarrel:{name:'Double Barrel',  cat:'Shotgun', dmg:28,  rate:260, rec:16,  spread:.140,mag:2,  ammo:60,  reload:1900,range:420, price:1600, snd:[330,.65], color:'#7a4a22',zoom:1.2, pellets:10,
               proc:{kind:'shotgun',len:.95,wood:true,double:true}},
  combatSG:   {name:'Combat Shotgun',  cat:'Shotgun', dmg:22,  rate:380, rec:9,   spread:.100,mag:12, ammo:108, reload:2200,range:480, price:2500, snd:[350,.6],  color:'#aa5522',zoom:1.25,pellets:8, model:'combat shotgun.glb',
               proc:{kind:'shotgun',len:1}},
  aa12:       {name:'Auto Shotgun',    cat:'Shotgun', dmg:17,  rate:170, rec:7,   spread:.110,mag:20, ammo:160, reload:2600,range:450, price:4500, snd:[380,.55], color:'#3d3d3d',zoom:1.25,pellets:8, auto:true,
               proc:{kind:'shotgun',len:.95,drum:true}},
  lmg:        {name:'Light MG',        cat:'Heavy',   dmg:36,  rate:85,  rec:4,   spread:.050,mag:100,ammo:500, reload:4500,range:1400,price:5000, snd:[700,.4],  color:'#ffaa00',zoom:1.4, auto:true, model:'lmg.glb',
               proc:{kind:'lmg',len:1.15}},
  minigun:    {name:'Minigun',         cat:'Heavy',   dmg:30,  rate:42,  rec:2.4, spread:.065,mag:300,ammo:900, reload:6000,range:1400,price:9000, snd:[750,.3],  color:'#666666',zoom:1.15,auto:true, special:'minigun',
               proc:{kind:'minigun',len:1.1}},
  flamethrower:{name:'Flamethrower',   cat:'Special', dmg:11,  rate:50,  rec:.4,  spread:.090,mag:150,ammo:450, reload:3000,range:430, price:6000, snd:[160,.18], color:'#dd5500',zoom:1,   auto:true, special:'flame',
               proc:{kind:'flamer',len:1}},
  grenadeLauncher:{name:'Grenade Launcher',cat:'Explosive',dmg:260,rate:750,rec:14,spread:.01,mag:6, ammo:30,  reload:3200,range:0,   price:5500, snd:[180,.6],  color:'#556b2f',zoom:1.3, special:'gl',splash:180,
               proc:{kind:'gl',len:.85}},
  rpg:        {name:'Rocket Launcher', cat:'Explosive',dmg:700,rate:1200,rec:20,  spread:0,   mag:1,  ammo:12,  reload:2600,range:0,   price:8500, snd:[120,.8],  color:'#4b5320',zoom:1.5, special:'rocket',splash:250,
               proc:{kind:'rpg',len:1.2}},
  plasma:     {name:'Plasma Rifle',    cat:'Energy',  dmg:80,  rate:190, rec:2,   spread:.014,mag:25, ammo:175, reload:2000,range:2000,price:8000, snd:[1500,.3], color:'#ff44ff',zoom:1.6, auto:true, special:'plasma',pierce:1, model:'plasma rifle.glb',
               proc:{kind:'energy',len:1,glow:'#ff44ff'}},
  tesla:      {name:'Tesla Gun',       cat:'Energy',  dmg:75,  rate:360, rec:3,   spread:0,   mag:30, ammo:150, reload:2400,range:950, price:7500, snd:[1800,.3], color:'#33ccff',zoom:1.2, auto:true, special:'tesla',
               proc:{kind:'tesla',len:.9,glow:'#33ccff'}},
  railgun:    {name:'Railgun',         cat:'Energy',  dmg:850, rate:1500,rec:18,  spread:0,   mag:5,  ammo:35,  reload:3000,range:6000,price:12000,snd:[2400,.6], color:'#00ffcc',zoom:3,   scope:'acog', special:'rail',pierce:99,
               proc:{kind:'rail',len:1.2,glow:'#00ffcc'}},
};
for(const id in WEAPONS){const w=WEAPONS[id];w.id=id;w.pellets=w.pellets||1;w.burst=w.burst||1;w.auto=!!w.auto;w.pierce=w.pierce||0;}
const WEAPON_CATS=['All','Sidearm','SMG','Rifle','Marksman','Shotgun','Heavy','Special','Explosive','Energy'];
const DEFAULT_LOADOUT=['pistol','ar','shotgun'];

// Optics you can bolt onto a gun in the shop (guns with a better built-in optic skip it)
const OPTICS={
  reddot:{name:'Red Dot Sight',zoom:1.7,price:400, rank:1,desc:'Clean red dot · 1.7× zoom'},
  acog:  {name:'4× Scope',     zoom:4,  price:1200,rank:2,desc:'Magnified optic · 4× zoom'},
  sniper:{name:'Sniper Scope', zoom:8,  price:2500,rank:3,desc:'Long-range scope · 8× zoom (scroll to adjust)'},
};
const NO_OPTIC=new Set(['flamethrower','tesla','minigun','grenadeLauncher','rpg']);

// Weapon upgrade tracks (5 levels each, per weapon)
const UPGRADES={
  damage:  {name:'Damage',     desc:'+20% damage / lv'},
  fireRate:{name:'Fire Rate',  desc:'+10% fire rate / lv'},
  reload:  {name:'Reload Speed',desc:'-12% reload time / lv'},
  mag:     {name:'Magazine',   desc:'+20% magazine / lv'},
  crit:    {name:'Crit Chance',desc:'+5% crit chance / lv'},
};
const TIERS=[
  {name:'',      dmg:1,  mag:1,   tint:null},
  {name:'Mk II', dmg:1.55,mag:1.25,tint:'#ffcc33',price:4000},
  {name:'Mk III',dmg:2.3, mag:1.5, tint:'#cc44ff',price:10000},
];

// ── ZOMBIES ──
// hp/spd/dmg are wave-1 baselines; they scale with the effective wave.
// spd is units per 1/60 s (player walks at 3.2). r = collision radius.
// h = body height in world units (a human is ~72). armor = body damage taken multiplier.
const ZTYPES={
  normal: {name:'Walker',     icon:'🧟',hp:110, spd:.95,dmg:12,rew:50,  xp:20, r:20,h:72, skin:'#6f8f5a',cloth:'#4b3a2a',pants:'#2d3340'},
  fast:   {name:'Runner',     icon:'🏃',hp:65,  spd:2.0,dmg:9, rew:80,  xp:30, r:18,h:66, skin:'#a8a05a',cloth:'#7a2a2a',pants:'#3a3a3a',lean:.35},
  crawler:{name:'Crawler',    icon:'🦎',hp:70,  spd:1.55,dmg:10,rew:70, xp:25, r:20,h:30, skin:'#7d8b6a',cloth:'#3d4a33',pants:'#2a2a2a',crawl:true},
  heavy:  {name:'Brute',      icon:'🦍',hp:350, spd:.6, dmg:22,rew:160, xp:55, r:30,h:96, skin:'#8a5a3a',cloth:'#3a2a20',pants:'#24262e',bulk:1.5},
  expldr: {name:'Bloater',    icon:'🤢',hp:90,  spd:1.3,dmg:60,rew:110, xp:45, r:24,h:76, skin:'#8ec63f',cloth:'#556b2f',pants:'#3d4d22',bloat:true},
  toxic:  {name:'Toxic',      icon:'☣️',hp:140, spd:.9, dmg:14,rew:120, xp:45, r:21,h:74, skin:'#7a4a9a',cloth:'#2f2a3a',pants:'#1f1f2a',glow:'#aa55ff'},
  spitter:{name:'Spitter',    icon:'🤮',hp:100, spd:1.0,dmg:14,rew:120, xp:45, r:20,h:70, skin:'#9ab83a',cloth:'#4a5a1a',pants:'#2a2f1a',ranged:true,glow:'#ccff33'},
  screamer:{name:'Screamer',  icon:'😱',hp:120, spd:1.1,dmg:10,rew:130, xp:50, r:19,h:80, skin:'#d8d0c0',cloth:'#5a5a5a',pants:'#333',thin:true},
  armored:{name:'Riot',       icon:'🛡️',hp:260, spd:.8, dmg:18,rew:170, xp:60, r:23,h:76, skin:'#6f8f5a',cloth:'#2c3440',pants:'#1e232b',armor:.4},
  leaper: {name:'Leaper',     icon:'🦗',hp:110, spd:1.4,dmg:22,rew:140, xp:50, r:19,h:62, skin:'#5a7a5a',cloth:'#2a3a2a',pants:'#202820',lean:.5},
  phantom:{name:'Phantom',    icon:'👻',hp:95,  spd:1.6,dmg:16,rew:150, xp:55, r:19,h:74, skin:'#334455',cloth:'#111822',pants:'#0a0f14',ghost:true,glow:'#55ffff'},
  boss:   {name:'Abomination',icon:'👹',hp:2600,spd:1.05,dmg:38,rew:1200,xp:220,r:44,h:165,skin:'#9a3a2a',cloth:'#3a1010',pants:'#2a0a0a',bulk:1.3,boss:true,glow:'#ff3300'},
  titan:  {name:'Titan',      icon:'🗿',hp:9000,spd:.95,dmg:55,rew:5000,xp:800,r:58,h:230,skin:'#5a5a6a',cloth:'#2a2a3a',pants:'#1a1a22',bulk:1.4,boss:true,armorPlates:true,glow:'#ffaa00'},
};
const ZTYPE_IDS=Object.keys(ZTYPES);
for(const id of ZTYPE_IDS)ZTYPES[id].id=id;

// ── PERKS (bought once per run in the shop) ──
const PERKS={
  ironBody:  {name:'Iron Body',   icon:'💪',price:2500,desc:'+50 max health'},
  heavyArmor:{name:'Heavy Armor', icon:'🦺',price:2000,desc:'Armor cap 200 · +100 armor now'},
  quickHands:{name:'Quick Hands', icon:'✋',price:2000,desc:'Reload 30% faster'},
  marathon:  {name:'Marathon',    icon:'🏃',price:1500,desc:'Sprint 20% faster · half stamina drain'},
  rapidFire: {name:'Rapid Fire',  icon:'🔥',price:3000,desc:'Fire rate +20% on every gun'},
  secondWind:{name:'Second Wind', icon:'💚',price:1800,desc:'Health regen starts sooner & 3× faster'},
  deadeye:   {name:'Deadeye',     icon:'🎯',price:2200,desc:'Headshots deal +50% damage'},
  scavenger: {name:'Scavenger',   icon:'🦝',price:1500,desc:'Ammo & cash pickups worth 2×'},
  luckyShot: {name:'Lucky Shot',  icon:'🍀',price:1600,desc:'+10% critical hit chance'},
};

// ── POWER-UPS (rare zombie drops, shared by the whole team) ──
const POWERUPS={
  maxammo:  {name:'MAX AMMO',     icon:'📦',color:'#ffdd44',dur:0},
  instakill:{name:'INSTA-KILL',   icon:'💀',color:'#ff3344',dur:12},
  double:   {name:'DOUBLE CASH',  icon:'💲',color:'#44ff88',dur:20},
  nuke:     {name:'NUKE',         icon:'☢️',color:'#ffaa00',dur:0},
  speed:    {name:'SPEED BOOST',  icon:'⚡',color:'#44ddff',dur:15},
  godmode:  {name:'INVINCIBLE',   icon:'⭐',color:'#ffffff',dur:8},
  firesale: {name:'FIRE SALE',    icon:'🏷️',color:'#ff66cc',dur:30},
};
const POWERUP_IDS=Object.keys(POWERUPS);

// Regular pickups
const PICKUPS={
  health:{icon:'❤️',color:'#ff4466',label:'+Health'},
  armor: {icon:'🛡️',color:'#4488ff',label:'+Armor'},
  ammo:  {icon:'🔫',color:'#ffdd44',label:'+Ammo'},
  money: {icon:'💰',color:'#ffdd00',label:'Cash'},
  grenade:{icon:'💣',color:'#88aa55',label:'+Grenades'},
  weapon:{icon:'🎁',color:'#ff8800',label:'Weapon Crate'},
  token: {icon:'⬆️',color:'#cc66ff',label:'Upgrade Token'},
};

// Shop items
const ITEMS=[
  {id:'medkit',n:'Med Kit',      d:'Restore 50 HP',          p:300, i:'❤️'},
  {id:'bigmed',n:'Large Med Kit',d:'Full HP restore',        p:700, i:'🏥'},
  {id:'ashrd', n:'Armor Shard',  d:'+25 Armor',              p:200, i:'🛡️'},
  {id:'avest', n:'Armor Vest',   d:'+75 Armor',              p:600, i:'🦺'},
  {id:'apack', n:'Ammo Pack',    d:'Refill current gun reserve',p:250,i:'📦'},
  {id:'acrate',n:'Ammo Crate',   d:'Refill ALL gun reserves', p:700, i:'🗃️'},
  {id:'nades', n:'Grenades ×3',  d:'Q to throw',             p:450, i:'💣'},
  {id:'adrn',  n:'Adrenaline',   d:'+35% speed for 30s',     p:600, i:'⚡'},
  {id:'regen', n:'Regen Stim',   d:'+2 HP/s for 60s',        p:800, i:'💉'},
];

// ── LEVELS ──
// diff: added to the wave number to get the "effective wave" that drives zombie stats.
// pool: spawn weights; a type only appears once the level's wave >= its 'from' value.
// theme drives the 3D look (sky, fog, lights, floor/wall textures).
const LEVELS=[
  {id:'city',     name:'City Streets',      icon:'🏙', waves:5, diff:0,  desc:'Open streets · Easy',
   pool:{normal:[10,1],fast:[3,2]}, boss:['heavy','heavy'],
   theme:{sky:['#1b2a4a','#c98a5a'],fog:'#6a5a5a',fogFar:2600,hemi:['#b8c4ff','#3a3020',.8],sun:['#ffd2a0',1.1],floor:'asphalt',wall:'brick',ambient:'dust'}},
  {id:'military', name:'Military Base',     icon:'🪖', waves:6, diff:2,  desc:'Bunkers & barricades',
   pool:{normal:[10,1],fast:[4,1],crawler:[3,2],heavy:[2,4]}, boss:['boss'],
   theme:{sky:['#24341f','#9aa47a'],fog:'#5c654a',fogFar:2800,hemi:['#d8e8c0','#2a3020',.85],sun:['#fff0c0',1.1],floor:'dirt',wall:'concrete',ambient:'dust'}},
  {id:'lab',      name:'Abandoned Lab',     icon:'🧪', waves:6, diff:3,  desc:'Dark rooms · Indoor',
   pool:{normal:[10,1],fast:[4,1],expldr:[3,2],toxic:[3,3],crawler:[2,1]}, boss:['boss'],
   theme:{sky:['#05050c','#101020'],fog:'#0a0a16',fogFar:1500,hemi:['#8899ff','#101018',.45],sun:['#aabbff',.35],floor:'labtile',wall:'labpanel',indoor:200,dark:true,ceiling:'labceil',ambient:'spores'}},
  {id:'graveyard',name:'Midnight Graveyard',icon:'🪦', waves:7, diff:4,  desc:'Foggy night · Phantoms',
   pool:{normal:[10,1],crawler:[4,1],phantom:[3,2],fast:[3,1],toxic:[2,4]}, boss:['boss'],
   theme:{sky:['#03040a','#1a2030'],fog:'#141a24',fogFar:1300,hemi:['#6677aa','#0a0a10',.4],sun:['#8899cc',.4],floor:'grass',wall:'stone',dark:true,ambient:'mist'}},
  {id:'mall',     name:'Dead Mall',         icon:'🛍', waves:7, diff:5,  desc:'Spitters & screamers',
   pool:{normal:[10,1],fast:[4,1],spitter:[3,1],screamer:[2,2],expldr:[2,3]}, boss:['boss'],
   theme:{sky:['#101010','#202020'],fog:'#2a2622',fogFar:2200,hemi:['#fff4e0','#302820',.75],sun:['#fff0dd',.55],floor:'tile',wall:'store',indoor:260,ceiling:'mallceil',ambient:'dust'}},
  {id:'desert',   name:'Desert Outpost',    icon:'🏜', waves:8, diff:6,  desc:'Blazing sun · Leapers',
   pool:{normal:[10,1],fast:[5,1],leaper:[4,1],heavy:[2,3],spitter:[2,4]}, boss:['boss'],
   theme:{sky:['#3a7acc','#f0d090'],fog:'#e0c090',fogFar:3200,hemi:['#fff8e0','#806040',1],sun:['#fff0c8',1.4],floor:'sand',wall:'adobe',ambient:'sand'}},
  {id:'arctic',   name:'Frozen Station',    icon:'❄️', waves:8, diff:7,  desc:'Whiteout · Riot zombies',
   pool:{normal:[10,1],fast:[4,1],armored:[4,1],crawler:[3,2],screamer:[2,3]}, boss:['boss'],
   theme:{sky:['#8aa4c0','#e8f0f8'],fog:'#d0dce8',fogFar:1700,hemi:['#ffffff','#8090a0',1],sun:['#ffffff',.9],floor:'snow',wall:'metal',ambient:'snow'}},
  {id:'subway',   name:'Subway Tunnels',    icon:'🚇', waves:8, diff:8,  desc:'Pitch black · Close quarters',
   pool:{normal:[10,1],crawler:[5,1],fast:[4,1],phantom:[3,2],expldr:[3,2],heavy:[2,4]}, boss:['boss'],
   theme:{sky:['#000','#080808'],fog:'#050505',fogFar:1200,hemi:['#8888aa','#080808',.35],sun:['#aaaaff',.25],floor:'rail',wall:'tunnel',indoor:200,dark:true,ceiling:'tunnelceil',ambient:'dust'}},
  {id:'hospital', name:'St. Mercy Hospital',icon:'🏥', waves:9, diff:9,  desc:'Room to room',
   pool:{normal:[10,1],fast:[4,1],toxic:[3,1],screamer:[3,2],leaper:[3,3],armored:[2,4]}, boss:['boss','heavy'],
   theme:{sky:['#101010','#1a1a1a'],fog:'#1a2020',fogFar:1400,hemi:['#e0fff8','#202828',.55],sun:['#e0ffff',.4],floor:'hospital',wall:'hospital',indoor:200,dark:true,ceiling:'labceil',ambient:'spores'}},
  {id:'forest',   name:'Blackwood Forest',  icon:'🌲', waves:9, diff:10, desc:'Dense trees · Night',
   pool:{normal:[10,1],fast:[5,1],leaper:[4,1],phantom:[3,2],crawler:[3,1],heavy:[2,3]}, boss:['boss','boss'],
   theme:{sky:['#02050a','#0f1f18'],fog:'#0a140f',fogFar:1250,hemi:['#88aa99','#060a06',.4],sun:['#aaccbb',.35],floor:'forest',wall:'wood',dark:true,ambient:'fireflies'}},
  {id:'docks',    name:'Harbor Docks',      icon:'⚓', waves:10,diff:11, desc:'Container maze',
   pool:{normal:[10,1],fast:[5,1],spitter:[4,1],armored:[3,2],expldr:[3,2],heavy:[3,3]}, boss:['boss','boss'],
   theme:{sky:['#2a3a50','#7a8a9a'],fog:'#5a6a78',fogFar:2400,hemi:['#c8d8ff','#303840',.85],sun:['#e8eeff',.9],floor:'dock',wall:'metal',ambient:'rain'}},
  {id:'prison',   name:'Iron Gate Prison',  icon:'⛓', waves:10,diff:12, desc:'Lockdown · Everything',
   pool:{normal:[10,1],fast:[5,1],armored:[4,1],screamer:[3,1],leaper:[3,2],toxic:[3,2],heavy:[3,3]}, boss:['boss','boss'],
   theme:{sky:['#1a1a24','#4a4a5a'],fog:'#2a2a34',fogFar:2000,hemi:['#c0c0e0','#202028',.7],sun:['#d0d0ff',.7],floor:'prison',wall:'prisonbrick',ambient:'dust'}},
  {id:'volcano',  name:'Hellfire Caldera',  icon:'🌋', waves:11,diff:13, desc:'Lava hurts · Brutes',
   pool:{normal:[8,1],fast:[5,1],heavy:[4,1],expldr:[4,1],leaper:[3,2],spitter:[3,2],phantom:[2,3]}, boss:['boss','boss','heavy'],
   theme:{sky:['#1a0000','#802000'],fog:'#3a0a00',fogFar:1900,hemi:['#ff8866','#200000',.7],sun:['#ff7744',.9],floor:'basalt',wall:'basalt',ambient:'ember',lava:true}},
  {id:'hive',     name:'Ground Zero: Hive', icon:'☣️', waves:12,diff:15, desc:'Final level · The Titan',
   pool:{normal:[8,1],fast:[5,1],crawler:[3,1],toxic:[3,1],spitter:[3,1],armored:[3,2],phantom:[3,2],leaper:[3,2],screamer:[2,3],heavy:[3,3],expldr:[3,2]}, boss:['titan','boss'],
   theme:{sky:['#12001a','#4a0a3a'],fog:'#2a0624',fogFar:1700,hemi:['#ff88dd','#100010',.6],sun:['#ff66cc',.6],floor:'flesh',wall:'flesh',dark:true,ambient:'spores'}},
];

const KEY_HELP='WASD Move · Mouse Aim · LMB Shoot · RMB Aim/Scope · Wheel Switch (Zoom when scoped)<br>Shift Sprint · C Crouch · Space Jump · R Reload · 1-9 Weapons · Q Grenade · V Melee · T Flashlight · F Shop · Esc Pause';

global.DZ={WEAPONS,WEAPON_CATS,DEFAULT_LOADOUT,OPTICS,NO_OPTIC,UPGRADES,TIERS,ZTYPES,ZTYPE_IDS,PERKS,POWERUPS,POWERUP_IDS,PICKUPS,ITEMS,LEVELS,KEY_HELP};
})(window);
