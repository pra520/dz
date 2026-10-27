/* ============================================================================
 * DEAD ZONE — Account & Save System
 * ----------------------------------------------------------------------------
 * Persistent player profile stored in localStorage. This is the ONE place that
 * owns the player's money, purchases and unlocks. Shop, wallet, codex and the
 * game all read/write through this API, so every system stays in sync.
 *
 * Public API (window.Account):
 *   load() / save() / reset()
 *   get()                         -> the live account object
 *   canAfford(currency, amount)   -> bool
 *   spend(currency, amount)       -> bool (false if too poor)
 *   grant(currency, amount)       -> new balance
 *   ownsGun(id) / buyGun(gun, currency) -> {ok, reason}
 *   setLoadout(ids[])             -> persists equipped guns (max 4)
 *   addItem(id, n) / consumeItem(id)
 *   applyMatchResult(result)      -> credits coins + updates stats
 *   export() / import(json)
 *   onChange(fn)                  -> subscribe to any account change
 * ==========================================================================*/
(function (global) {
  'use strict';

  const KEY = 'dz_account';
  const VERSION = 1;
  const MAX_LOADOUT = 4;
  const STARTING_COINS = 500;

  const listeners = [];
  let account = null;

  function starterGuns() {
    return (global.LobbyData ? LobbyData.GUNS : [])
      .filter(g => g.starter).map(g => g.id);
  }

  function freshAccount() {
    const owned = starterGuns();
    const now = Date.now();
    return {
      version: VERSION,
      name: 'Survivor',
      createdAt: now,
      updatedAt: now,
      coins: STARTING_COINS,
      rs: 0,
      ownedGuns: owned.slice(),
      loadout: owned.slice(0, MAX_LOADOUT),
      items: {},                 // { itemId: count }
      unlocks: [],               // generic unlock ids (skins, perks…)
      stats: { matches: 0, kills: 0, bestWave: 0, bestScore: 0, coinsEarned: 0 },
    };
  }

  // Merge a loaded object onto a fresh template so older / partial saves and
  // future new fields never break the game.
  function migrate(raw) {
    const base = freshAccount();
    if (!raw || typeof raw !== 'object') return base;
    const a = Object.assign(base, raw);
    a.version = VERSION;
    a.stats = Object.assign(base.stats, raw.stats || {});
    a.items = Object.assign({}, raw.items || {});
    // guarantee starters are always owned
    for (const id of starterGuns()) if (!a.ownedGuns.includes(id)) a.ownedGuns.push(id);
    a.loadout = (a.loadout || []).filter(id => a.ownedGuns.includes(id)).slice(0, MAX_LOADOUT);
    if (!a.loadout.length) a.loadout = a.ownedGuns.slice(0, MAX_LOADOUT);
    return a;
  }

  function notify() { listeners.forEach(fn => { try { fn(account); } catch (e) {} }); }

  // --- persistence ----------------------------------------------------------
  function load() {
    try { account = migrate(JSON.parse(localStorage.getItem(KEY))); }
    catch (e) { account = freshAccount(); }
    return account;
  }
  function save() {
    if (!account) return;
    account.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(account)); } catch (e) {}
    notify();
  }
  function reset() { account = freshAccount(); save(); return account; }
  function get() { return account || load(); }

  // --- currency -------------------------------------------------------------
  function bal(cur) { return get()[cur] || 0; }
  function canAfford(cur, amt) { return bal(cur) >= amt; }
  function grant(cur, amt) { get()[cur] = bal(cur) + amt; save(); return get()[cur]; }
  function spend(cur, amt) {
    if (!canAfford(cur, amt)) return false;
    get()[cur] = bal(cur) - amt; save(); return true;
  }

  // --- guns / purchases -----------------------------------------------------
  function ownsGun(id) { return get().ownedGuns.includes(id); }

  function buyGun(gun, currency) {
    if (!gun) return { ok: false, reason: 'unknown-gun' };
    if (ownsGun(gun.id)) return { ok: false, reason: 'owned' };
    const price = currency === 'rs' ? gun.rsPrice : gun.price;
    if (price == null) return { ok: false, reason: 'not-for-sale' };
    if (!spend(currency, price)) return { ok: false, reason: 'too-poor' };
    get().ownedGuns.push(gun.id);
    if (get().loadout.length < MAX_LOADOUT) get().loadout.push(gun.id);
    save();
    return { ok: true };
  }

  function setLoadout(ids) {
    const owned = get().ownedGuns;
    get().loadout = ids.filter(id => owned.includes(id)).slice(0, MAX_LOADOUT);
    if (!get().loadout.length) get().loadout = owned.slice(0, MAX_LOADOUT);
    save();
    return get().loadout;
  }

  // --- items ----------------------------------------------------------------
  function itemCount(id) { return get().items[id] || 0; }
  function addItem(id, n = 1) { get().items[id] = itemCount(id) + n; save(); }
  function consumeItem(id) {
    if (itemCount(id) <= 0) return false;
    get().items[id]--; if (get().items[id] <= 0) delete get().items[id];
    save(); return true;
  }

  // --- match rewards (the lobby <-> game bridge lands here) ------------------
  // result: { coins, kills, wave, score }
  function applyMatchResult(result) {
    if (!result) return;
    const a = get();
    const coins = Math.max(0, Math.floor(result.coins || 0));
    a.coins += coins;
    a.stats.matches += Math.max(1, result.matches || 1);
    a.stats.kills += Math.max(0, result.kills || 0);
    a.stats.bestWave = Math.max(a.stats.bestWave, result.wave || 0);
    a.stats.bestScore = Math.max(a.stats.bestScore, result.score || 0);
    a.stats.coinsEarned += coins;
    save();
    return coins;
  }

  // --- import / export ------------------------------------------------------
  function exportSave() { return JSON.stringify(get(), null, 2); }
  function importSave(json) {
    try { account = migrate(JSON.parse(json)); save(); return true; }
    catch (e) { return false; }
  }

  function onChange(fn) { listeners.push(fn); return () => {
    const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1);
  }; }

  global.Account = {
    KEY, MAX_LOADOUT, STARTING_COINS,
    load, save, reset, get,
    canAfford, grant, spend, bal,
    ownsGun, buyGun, setLoadout,
    itemCount, addItem, consumeItem,
    applyMatchResult,
    export: exportSave, import: importSave,
    onChange,
  };
})(window);
