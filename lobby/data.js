/* ============================================================================
 * DEAD ZONE — Lobby Data Layer
 * ----------------------------------------------------------------------------
 * Single source of truth for everything the lobby, shop and codex show.
 * Gun ids MATCH the in-game WDEFS ids (see zombie_fps.html) and the 3D model
 * manifest (gun_models_3d/manifest.json) so the systems stay connected.
 *
 * To add content later you only touch this file:
 *   - add a gun  -> push to GUNS
 *   - add a zombie -> push to ZOMBIES
 *   - add an item / currency pack -> push to ITEMS / RS_PACKS
 * ==========================================================================*/
(function (global) {
  'use strict';

  // --- Currencies -----------------------------------------------------------
  // coins : soft currency, earned by playing (killing zombies / clearing waves)
  // rs    : hard currency ("real money" style premium currency)
  const CURRENCY = {
    coins: { id: 'coins', name: 'Coins', symbol: '⛃', color: '#ffdd00', kind: 'soft' },
    rs:    { id: 'rs',    name: 'Rs',    symbol: '₹', color: '#37e39b', kind: 'hard' },
  };

  const RARITY = {
    common:    { name: 'Common',    color: '#9aa0a6' },
    uncommon:  { name: 'Uncommon',  color: '#5cd669' },
    rare:      { name: 'Rare',      color: '#4aa3ff' },
    epic:      { name: 'Epic',      color: '#b464ff' },
    legendary: { name: 'Legendary', color: '#ffb020' },
  };

  // --- Guns -----------------------------------------------------------------
  // price     : coin cost (0 = free / starter, null = not sold for coins)
  // rsPrice   : optional Rs shortcut cost (null = not sold for Rs)
  // starter   : owned automatically on a fresh account
  // model     : glb file (kept in sync with gun_models_3d/manifest.json)
  const GUNS = [
    { id:'pistol',     name:'Pistol',         cat:'Sidearm',  rarity:'common',    price:0,    rsPrice:null, starter:true,
      dmg:35,  rpm:214,  mag:15,  range:900,  fire:'Semi',  model:'Pistol.glb',
      desc:'Reliable last-resort sidearm. Never runs dry on options.' },
    { id:'revolver',   name:'Revolver',       cat:'Sidearm',  rarity:'uncommon',  price:800,  rsPrice:null, starter:false,
      dmg:80,  rpm:97,   mag:6,   range:1500, fire:'Semi',  model:'Revolver.glb',
      desc:'Heavy-hitting six-shooter. Rewards a steady trigger finger.' },
    { id:'smg',        name:'SMG',            cat:'Automatic',rarity:'uncommon',  price:1200, rsPrice:null, starter:false,
      dmg:22,  rpm:800,  mag:35,  range:550,  fire:'Auto',  model:'smg.glb',
      desc:'Shreds fast movers up close with a blistering fire rate.' },
    { id:'ar',         name:'Assault Rifle',  cat:'Automatic',rarity:'common',    price:0,    rsPrice:null, starter:true,
      dmg:40,  rpm:571,  mag:30,  range:850,  fire:'Auto',  model:'Assault Rifle.glb',
      desc:'The dependable all-rounder. Good at everything, master of none.' },
    { id:'burstRifle', name:'Burst Rifle',    cat:'Automatic',rarity:'rare',      price:1800, rsPrice:null, starter:false,
      dmg:40,  rpm:706,  mag:30,  range:1800, fire:'Burst', model:'burst rifle.glb',
      desc:'Three-round bursts for surgical mid-range control.' },
    { id:'shotgun',    name:'Shotgun',        cat:'Shotgun',  rarity:'common',    price:0,    rsPrice:null, starter:true,
      dmg:20,  pellets:8, rpm:92, mag:8, range:400, fire:'Semi', model:'Shotgun.glb',
      desc:'Point-blank devastation. Keep the horde in front of you.' },
    { id:'combatSG',   name:'Combat Shotgun', cat:'Shotgun',  rarity:'rare',      price:2500, rsPrice:null, starter:false,
      dmg:22,  pellets:8, rpm:158, mag:12, range:420, fire:'Semi', model:'combat shotgun.glb',
      desc:'Faster, deeper magazine. Wade into the swarm and keep firing.' },
    { id:'sniper',     name:'Sniper Rifle',   cat:'Marksman', rarity:'epic',      price:3500, rsPrice:60,   starter:false,
      dmg:230, rpm:46,   mag:5,   range:4000, fire:'Semi',  model:'Sniper Rifle.glb',
      desc:'One shot, one kill. Delete bosses from across the map.' },
    { id:'lmg',        name:'Light MG',       cat:'Heavy',    rarity:'epic',      price:5000, rsPrice:90,   starter:false,
      dmg:36,  rpm:706,  mag:100, range:1400, fire:'Auto',  model:'lmg.glb',
      desc:'A hundred-round belt of suppression. Hold the line indefinitely.' },
    { id:'plasma',     name:'Plasma Rifle',   cat:'Energy',   rarity:'legendary', price:8000, rsPrice:150,  starter:false,
      dmg:80,  rpm:316,  mag:25,  range:2000, fire:'Auto',  model:'plasma rifle.glb',
      desc:'Experimental energy weapon. Melts anything it touches.' },
    // ── added in v2 (procedural 3D models, no .glb needed) ──
    { id:'deagle',     name:'Desert Eagle',   cat:'Sidearm',  rarity:'uncommon',  price:1500, rsPrice:null, starter:false,
      dmg:110, rpm:143,  mag:7,   range:1600, fire:'Semi',  model:null,
      desc:'Hand cannon. Punches clean through the first zombie in line.' },
    { id:'uzi',        name:'Machine Pistol', cat:'Automatic',rarity:'uncommon',  price:900,  rsPrice:null, starter:false,
      dmg:18,  rpm:1034, mag:32,  range:700,  fire:'Auto',  model:null,
      desc:'Tiny, loud and absurdly fast. Spray and pray.' },
    { id:'ak47',       name:'AK-47',          cat:'Automatic',rarity:'rare',      price:2200, rsPrice:null, starter:false,
      dmg:52,  rpm:522,  mag:30,  range:1600, fire:'Auto',  model:null,
      desc:'Hard-hitting rifle with a stiff kick. Tame it and it rules.' },
    { id:'dmr',        name:'Marksman DMR',   cat:'Marksman', rarity:'rare',      price:3000, rsPrice:null, starter:false,
      dmg:100, rpm:200,  mag:15,  range:3000, fire:'Semi',  model:null,
      desc:'Fast follow-up shots through a built-in 4x scope.' },
    { id:'heavySniper',name:'Anti-Materiel .50',cat:'Marksman',rarity:'legendary',price:7000, rsPrice:120,  starter:false,
      dmg:520, rpm:33,   mag:4,   range:5000, fire:'Semi',  model:null,
      desc:'10x scope. Each round tears through six zombies in a row.' },
    { id:'doubleBarrel',name:'Double Barrel', cat:'Shotgun',  rarity:'uncommon',  price:1600, rsPrice:null, starter:false,
      dmg:28,  pellets:10, rpm:231, mag:2, range:420, fire:'Semi', model:null,
      desc:'Two barrels, ten pellets each. Point-blank deletion.' },
    { id:'aa12',       name:'Auto Shotgun',   cat:'Shotgun',  rarity:'epic',      price:4500, rsPrice:80,   starter:false,
      dmg:17,  pellets:8, rpm:353, mag:20, range:450, fire:'Auto', model:null,
      desc:'Drum-fed full-auto shotgun. Hold the trigger, clear the room.' },
    { id:'minigun',    name:'Minigun',        cat:'Heavy',    rarity:'legendary', price:9000, rsPrice:160,  starter:false,
      dmg:30,  rpm:1429, mag:300, range:1400, fire:'Auto',  model:null,
      desc:'Spins up, then shreds everything. Slows you down while firing.' },
    { id:'flamethrower',name:'Flamethrower',  cat:'Special',  rarity:'epic',      price:6000, rsPrice:100,  starter:false,
      dmg:11,  rpm:1200, mag:150, range:430,  fire:'Auto',  model:null,
      desc:'Short-range cone of fire that sets the horde burning.' },
    { id:'grenadeLauncher',name:'Grenade Launcher',cat:'Explosive',rarity:'epic',price:5500, rsPrice:95,   starter:false,
      dmg:260, rpm:80,   mag:6,   range:'Splash', fire:'Semi', model:null,
      desc:'Lobbed explosive rounds for crowds behind cover.' },
    { id:'rpg',        name:'Rocket Launcher',cat:'Explosive',rarity:'legendary', price:8500, rsPrice:150,  starter:false,
      dmg:700, rpm:50,   mag:1,   range:'Splash', fire:'Semi', model:null,
      desc:'One rocket, one crater. The answer to Brutes and Bosses.' },
    { id:'tesla',      name:'Tesla Gun',      cat:'Energy',   rarity:'legendary', price:7500, rsPrice:130,  starter:false,
      dmg:75,  rpm:167,  mag:30,  range:950,  fire:'Auto',  model:null,
      desc:'Lightning jumps between up to six zombies per shot.' },
    { id:'railgun',    name:'Railgun',        cat:'Energy',   rarity:'legendary', price:12000,rsPrice:200,  starter:false,
      dmg:850, rpm:40,   mag:5,   range:6000, fire:'Semi',  model:null,
      desc:'A beam that pierces every zombie in its path. The endgame gun.' },
  ];

  // --- Zombies (full bestiary) ---------------------------------------------
  // Stats are the wave-1 baseline; every stat scales up as waves increase.
  // These mirror the Zombie constructor in zombie_fps.html.
  const ZOMBIES = [
    { id:'normal',  name:'Walker',       icon:'🧟', color:'#7ea86b', threat:1,
      hp:110, speed:'Slow',    dmg:12, reward:50,   size:'Medium',
      desc:'The backbone of the horde. Slow, steady and endless.',
      behavior:'Shambles directly toward you and swings on contact.' },
    { id:'fast',    name:'Runner',       icon:'🏃', color:'#d6b24a', threat:2,
      hp:65,  speed:'Very Fast', dmg:9,  reward:80,  size:'Small',
      desc:'Lean and frenzied. Closes the gap before you can react.',
      behavior:'Sprints at the player — deadly in open ground.' },
    { id:'heavy',   name:'Brute',        icon:'🦍', color:'#a15a3a', threat:3,
      hp:350, speed:'Slow',    dmg:22, reward:160,  size:'Large',
      desc:'A wall of rotting muscle. Soaks up enormous punishment.',
      behavior:'Lumbers forward and hits like a truck. Aim for the head.' },
    { id:'expldr',  name:'Bloater',      icon:'🤢', color:'#8ec63f', threat:3,
      hp:90,  speed:'Fast',    dmg:70, reward:110,  size:'Medium',
      desc:'A gas-swollen corpse ready to burst. Do not let it reach you.',
      behavior:'Rushes in and detonates for massive contact damage.' },
    { id:'boss',    name:'Abomination',  icon:'👹', color:'#c0392b', threat:5,
      hp:2500, speed:'Medium', dmg:38, reward:1200, size:'Colossal',
      desc:'A towering mutation that anchors the late waves.',
      behavior:'Charges from range and ground-slams up close. Bring your best gun.' },
    // ── added in v2 ──
    { id:'crawler', name:'Crawler',      icon:'🦎', color:'#7d8b6a', threat:2,
      hp:70,  speed:'Fast',    dmg:10, reward:70,   size:'Tiny',
      desc:'Legless and low to the ground. Easy to miss in the dark.',
      behavior:'Scuttles along the floor under your crosshair. Aim low.' },
    { id:'toxic',   name:'Toxic',        icon:'☣️', color:'#7a4a9a', threat:2,
      hp:140, speed:'Slow',    dmg:14, reward:120,  size:'Medium',
      desc:'Its body is a chemical spill waiting to happen.',
      behavior:'Leaves a poison cloud where it dies. Do not stand in it.' },
    { id:'spitter', name:'Spitter',      icon:'🤮', color:'#9ab83a', threat:3,
      hp:100, speed:'Medium',  dmg:14, reward:120,  size:'Medium',
      desc:'Keeps its distance and lobs acid at you.',
      behavior:'Ranged attacker. Close the gap or break line of sight.' },
    { id:'screamer',name:'Screamer',     icon:'😱', color:'#d8d0c0', threat:3,
      hp:120, speed:'Medium',  dmg:10, reward:130,  size:'Tall',
      desc:'A shriek that drives the horde into a frenzy.',
      behavior:'Its scream makes nearby zombies 60% faster. Kill it first.' },
    { id:'armored', name:'Riot',         icon:'🛡️', color:'#5a6a7a', threat:3,
      hp:260, speed:'Slow',    dmg:18, reward:170,  size:'Medium',
      desc:'Died in full riot gear, and still wearing it.',
      behavior:'Body armour soaks 60% of damage. Headshots ignore it.' },
    { id:'leaper',  name:'Leaper',       icon:'🦗', color:'#5a7a5a', threat:3,
      hp:110, speed:'Fast',    dmg:22, reward:140,  size:'Medium',
      desc:'Coiled legs and no fear.',
      behavior:'Pounces from several metres away. Strafe when it crouches.' },
    { id:'phantom', name:'Phantom',      icon:'👻', color:'#55ffff', threat:4,
      hp:95,  speed:'Fast',    dmg:16, reward:150,  size:'Medium',
      desc:'Half there, half not. Its eyes are the only sure thing.',
      behavior:'Blinks (teleports) toward you every few seconds.' },
    { id:'titan',   name:'Titan',        icon:'🗿', color:'#ffaa00', threat:5,
      hp:9000, speed:'Medium', dmg:55, reward:5000, size:'Gigantic',
      desc:'The heart of the Hive. The final boss of the campaign.',
      behavior:'Huge ground slams, charges, and summons Runners to its side.' },
  ];

  // --- Consumable items (also usable as lobby-purchasable loadout perks) ----
  const ITEMS = [
    { id:'medkit', name:'Med Kit',     icon:'❤️', price:300, rsPrice:null, desc:'Carry into a match: restores 50 HP.' },
    { id:'avest',  name:'Armor Vest',  icon:'🦺', price:600, rsPrice:null, desc:'Start a match with +75 armor.' },
    { id:'acrate', name:'Ammo Crate',  icon:'🗃️', price:500, rsPrice:null, desc:'Top up +200 reserve ammo on spawn.' },
    { id:'adrn',   name:'Adrenaline',  icon:'⚡', price:600, rsPrice:8,    desc:'+50% move speed for the first 30s.' },
  ];

  // --- Rs (premium currency) top-up packs -----------------------------------
  // In a shipping game these map to a real payment provider. Here the purchase
  // is simulated so the full flow can be demonstrated end-to-end.
  const RS_PACKS = [
    { id:'rs_small',  name:'Handful',    rs:50,   priceLabel:'₹49',   bonus:0 },
    { id:'rs_med',    name:'Pouch',      rs:120,  priceLabel:'₹99',   bonus:20 },
    { id:'rs_large',  name:'Stash',      rs:300,  priceLabel:'₹249',  bonus:60 },
    { id:'rs_mega',   name:'Warchest',   rs:700,  priceLabel:'₹499',  bonus:200 },
  ];

  global.LobbyData = { CURRENCY, RARITY, GUNS, ZOMBIES, ITEMS, RS_PACKS,
    gun: id => GUNS.find(g => g.id === id),
    zombie: id => ZOMBIES.find(z => z.id === id),
    item: id => ITEMS.find(i => i.id === id),
  };
})(window);
