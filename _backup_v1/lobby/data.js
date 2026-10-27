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
      dmg:80,  rpm:80,   mag:6,   range:1000, fire:'Semi',  model:'Revolver.glb',
      desc:'Heavy-hitting six-shooter. Rewards a steady trigger finger.' },
    { id:'smg',        name:'SMG',            cat:'Automatic',rarity:'uncommon',  price:1200, rsPrice:null, starter:false,
      dmg:22,  rpm:800,  mag:35,  range:550,  fire:'Auto',  model:'smg.glb',
      desc:'Shreds fast movers up close with a blistering fire rate.' },
    { id:'ar',         name:'Assault Rifle',  cat:'Automatic',rarity:'common',    price:0,    rsPrice:null, starter:true,
      dmg:40,  rpm:571,  mag:30,  range:850,  fire:'Auto',  model:'Assault Rifle.glb',
      desc:'The dependable all-rounder. Good at everything, master of none.' },
    { id:'burstRifle', name:'Burst Rifle',    cat:'Automatic',rarity:'rare',      price:1800, rsPrice:null, starter:false,
      dmg:38,  rpm:706,  mag:30,  range:900,  fire:'Burst', model:'burst rifle.glb',
      desc:'Three-round bursts for surgical mid-range control.' },
    { id:'shotgun',    name:'Shotgun',        cat:'Shotgun',  rarity:'common',    price:0,    rsPrice:null, starter:true,
      dmg:20,  pellets:8, rpm:92, mag:8, range:400, fire:'Semi', model:'Shotgun.glb',
      desc:'Point-blank devastation. Keep the horde in front of you.' },
    { id:'combatSG',   name:'Combat Shotgun', cat:'Shotgun',  rarity:'rare',      price:2500, rsPrice:null, starter:false,
      dmg:22,  pellets:8, rpm:158, mag:12, range:420, fire:'Semi', model:'combat shotgun.glb',
      desc:'Faster, deeper magazine. Wade into the swarm and keep firing.' },
    { id:'sniper',     name:'Sniper Rifle',   cat:'Marksman', rarity:'epic',      price:3500, rsPrice:60,   starter:false,
      dmg:190, rpm:43,   mag:5,   range:2500, fire:'Semi',  model:'Sniper Rifle.glb',
      desc:'One shot, one kill. Delete bosses from across the map.' },
    { id:'lmg',        name:'Light MG',       cat:'Heavy',    rarity:'epic',      price:5000, rsPrice:90,   starter:false,
      dmg:35,  rpm:706,  mag:100, range:750,  fire:'Auto',  model:'lmg.glb',
      desc:'A hundred-round belt of suppression. Hold the line indefinitely.' },
    { id:'plasma',     name:'Plasma Rifle',   cat:'Energy',   rarity:'legendary', price:8000, rsPrice:150,  starter:false,
      dmg:78,  rpm:316,  mag:25,  range:1100, fire:'Auto',  model:'plasma rifle.glb',
      desc:'Experimental energy weapon. Melts anything it touches.' },
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
      behavior:'Relentless pursuit with devastating melee. Bring your best gun.' },
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
