/* ============================================================================
 * DEAD ZONE — Lobby Controller
 * ----------------------------------------------------------------------------
 * Renders the lobby UI and wires every system together:
 *   Account (save)  <->  Shop  <->  Wallet  <->  Codex  <->  Play/Launch
 * All state lives in Account; this file is purely presentation + interaction.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const D = global.LobbyData, A = global.Account;
  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag);
    if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  let currentTab = 'home';

  // -------------------------------------------------------------- boot
  function init() {
    A.load();
    // credit anything earned in the last match before drawing the wallet
    const pending = global.LobbyBridge && LobbyBridge.takeRewards();
    A.onChange(renderWallet);
    buildTabs();
    renderProfile();
    renderWallet();
    switchTab('home');
    if (pending) {
      const coins = A.applyMatchResult(pending);
      toast(`Match complete · +${coins} ⛃  (Wave ${pending.wave}, ${pending.kills} kills)`);
    }
    // if we come back to the tab from the game, pick up rewards too
    global.addEventListener('focus', pickupRewards);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pickupRewards(); });
  }

  function pickupRewards() {
    const p = global.LobbyBridge && LobbyBridge.takeRewards();
    if (p) { const c = A.applyMatchResult(p); toast(`Match complete · +${c} ⛃  (Wave ${p.wave})`); refresh(); }
  }

  // -------------------------------------------------------------- header
  function renderProfile() {
    const a = A.get();
    $('#profileName').textContent = a.name;
    $('#profileSub').textContent = `Matches ${a.stats.matches} · Best Wave ${a.stats.bestWave}`;
  }
  function renderWallet() {
    const a = A.get();
    $('#coinAmt').textContent = a.coins.toLocaleString();
    $('#rsAmt').textContent = a.rs.toLocaleString();
  }

  // -------------------------------------------------------------- tabs
  const TABS = [
    { id: 'home',  label: 'Lobby' },
    { id: 'shop',  label: 'Armory' },
    { id: 'items', label: 'Items' },
    { id: 'codex', label: 'Bestiary' },
  ];
  function buildTabs() {
    const nav = $('#tabs');
    TABS.forEach(t => {
      const b = el('button', 'tab', t.label);
      b.dataset.tab = t.id;
      b.onclick = () => switchTab(t.id);
      nav.appendChild(b);
    });
  }
  function switchTab(id) {
    currentTab = id;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
    refresh();
  }
  function refresh() {
    renderProfile();
    const view = $('#view');
    view.innerHTML = '';
    ({ home: renderHome, shop: renderShop, items: renderItems, codex: renderCodex }[currentTab])(view);
  }

  // -------------------------------------------------------------- HOME
  function renderHome(view) {
    const a = A.get();
    const hero = el('div', 'hero');
    hero.innerHTML = `
      <h1>DEAD ZONE</h1><p>Zombie Survival · FPS</p>
      <button class="play-btn" id="playBtn">▶ DEPLOY</button>
      <div class="play-note">Launches the game with your equipped loadout · earnings return here</div>`;
    view.appendChild(hero);
    $('#playBtn').onclick = launchGame;

    // stats
    const stats = el('div', 'stat-row');
    [['matches','Matches'],['kills','Total Kills'],['bestWave','Best Wave'],
     ['bestScore','Best Score'],['coinsEarned','Coins Earned']].forEach(([k, l]) => {
      const s = el('div', 'stat');
      s.innerHTML = `<div class="n">${(a.stats[k]||0).toLocaleString()}</div><div class="l">${l}</div>`;
      stats.appendChild(s);
    });
    hero.appendChild(stats);

    // loadout preview
    const h = el('div', 'section-h', 'Equipped Loadout — change in the Armory');
    h.style.marginTop = '34px';
    view.appendChild(h);
    const strip = el('div', 'loadout');
    for (let i = 0; i < A.MAX_LOADOUT; i++) {
      const id = a.loadout[i];
      if (id) { const g = D.gun(id);
        strip.appendChild(el('div', 'slot', `<div style="font-size:22px">🔫</div>
          <div class="gn" style="color:${D.RARITY[g.rarity].color}">${g.name}</div>
          <div class="gc">${g.cat}</div>`));
      } else strip.appendChild(el('div', 'slot empty', '<div style="font-size:22px">＋</div><div class="gn">Empty</div>'));
    }
    view.appendChild(strip);

    // account footer
    const foot = el('div', 'row');
    foot.style.marginTop = '30px'; foot.style.justifyContent = 'center';
    const exp = el('button', 'linkbtn', '⇩ Export Save');
    const imp = el('button', 'linkbtn', '⇧ Import Save');
    const rst = el('button', 'linkbtn danger', '↺ Reset Account');
    exp.onclick = openExport; imp.onclick = openImport;
    rst.onclick = () => { if (confirm('Reset your account? All coins, guns and progress are lost.')) { A.reset(); toast('Account reset'); refresh(); } };
    foot.append(exp, imp, rst);
    view.appendChild(foot);
  }

  // -------------------------------------------------------------- ARMORY (guns)
  function renderShop(view) {
    view.appendChild(el('div', 'section-h', 'Armory — buy & equip weapons'));
    const grid = el('div', 'grid');
    D.GUNS.forEach(g => grid.appendChild(gunCard(g)));
    view.appendChild(grid);
  }
  function gunCard(g) {
    const a = A.get(), owned = A.ownsGun(g.id), equipped = a.loadout.includes(g.id);
    const rar = D.RARITY[g.rarity];
    const c = el('div', 'card');
    c.style.borderColor = rar.color + '66';
    const dmgLine = g.pellets ? `${g.dmg}×${g.pellets}` : `${g.dmg}`;
    c.innerHTML = `
      <div class="rar" style="color:${rar.color}">${rar.name}</div>
      <h3>${g.name}</h3><div class="cat">${g.cat} · ${g.fire}</div>
      <div class="desc">${g.desc}</div>
      <div class="stats-mini">
        <span>DMG <b>${dmgLine}</b></span><span>RPM <b>${g.rpm}</b></span>
        <span>MAG <b>${g.mag}</b></span><span>RANGE <b>${g.range}</b></span>
      </div>`;
    if (owned) {
      c.appendChild(el('div', 'owned-tag', '✓ OWNED'));
      const eq = el('button', 'equip' + (equipped ? ' on' : ''), equipped ? '✓ EQUIPPED — click to unequip' : 'EQUIP');
      eq.onclick = () => toggleEquip(g.id);
      c.appendChild(eq);
    } else {
      const foot = el('div', 'foot');
      const coinBtn = el('button', 'buy coins', g.price === 0 ? 'FREE' : `${g.price.toLocaleString()} ⛃`);
      coinBtn.disabled = g.price == null || !A.canAfford('coins', g.price);
      coinBtn.onclick = () => purchaseGun(g, 'coins');
      foot.appendChild(coinBtn);
      if (g.rsPrice != null) {
        const rsBtn = el('button', 'buy rs', `${g.rsPrice} ₹`);
        rsBtn.disabled = !A.canAfford('rs', g.rsPrice);
        rsBtn.onclick = () => purchaseGun(g, 'rs');
        foot.appendChild(rsBtn);
      }
      c.appendChild(foot);
    }
    return c;
  }
  function purchaseGun(g, cur) {
    const r = A.buyGun(g, cur);
    if (r.ok) toast(`Purchased ${g.name}!`);
    else toast(r.reason === 'too-poor' ? `Not enough ${cur === 'rs' ? 'Rs' : 'coins'}` : 'Cannot buy');
    refresh();
  }
  function toggleEquip(id) {
    const a = A.get();
    let l = a.loadout.slice();
    if (l.includes(id)) l = l.filter(x => x !== id);
    else if (l.length < A.MAX_LOADOUT) l.push(id);
    else { toast(`Loadout full (${A.MAX_LOADOUT} max) — unequip one first`); return; }
    A.setLoadout(l);
    refresh();
  }

  // -------------------------------------------------------------- ITEMS
  function renderItems(view) {
    view.appendChild(el('div', 'section-h', 'Items — consumables carried into a match'));
    const grid = el('div', 'grid');
    D.ITEMS.forEach(it => {
      const owned = A.itemCount(it.id);
      const c = el('div', 'card');
      c.innerHTML = `<div style="font-size:30px">${it.icon}</div>
        <h3>${it.name}</h3><div class="desc">${it.desc}</div>
        <div class="cat" style="margin-bottom:10px">Owned: <b style="color:#fff">${owned}</b></div>`;
      const foot = el('div', 'foot');
      const b = el('button', 'buy coins', `${it.price.toLocaleString()} ⛃`);
      b.disabled = !A.canAfford('coins', it.price);
      b.onclick = () => { if (A.spend('coins', it.price)) { A.addItem(it.id); toast(`Bought ${it.name}`); } refresh(); };
      foot.appendChild(b);
      if (it.rsPrice != null) {
        const rb = el('button', 'buy rs', `${it.rsPrice} ₹`);
        rb.disabled = !A.canAfford('rs', it.rsPrice);
        rb.onclick = () => { if (A.spend('rs', it.rsPrice)) { A.addItem(it.id); toast(`Bought ${it.name}`); } refresh(); };
        foot.appendChild(rb);
      }
      c.appendChild(foot);
      grid.appendChild(c);
    });
    view.appendChild(grid);
  }

  // -------------------------------------------------------------- BESTIARY
  function renderCodex(view) {
    view.appendChild(el('div', 'section-h', 'Bestiary — every zombie in the Dead Zone'));
    const grid = el('div', 'grid');
    D.ZOMBIES.forEach(z => {
      const c = el('div', 'card');
      c.style.borderColor = z.color + '66';
      const pips = Array.from({ length: 5 }, (_, i) =>
        `<span class="pip${i < z.threat ? ' on' : ''}"></span>`).join('');
      c.innerHTML = `
        <div style="font-size:34px">${z.icon}</div>
        <h3 style="color:${z.color}">${z.name}</h3>
        <div class="cat">Threat <span class="threat">${pips}</span></div>
        <div class="desc">${z.desc}</div>
        <div class="stats-mini">
          <span>HP <b>${z.hp}</b></span><span>SPEED <b>${z.speed}</b></span>
          <span>DAMAGE <b>${z.dmg}</b></span><span>REWARD <b>$${z.reward}</b></span>
          <span>SIZE <b>${z.size}</b></span>
        </div>
        <div class="desc" style="color:#888;margin-top:auto"><b style="color:#aaa">Behavior:</b> ${z.behavior}</div>`;
      grid.appendChild(c);
    });
    view.appendChild(grid);
  }

  // -------------------------------------------------------------- WALLET / Rs shop
  function openRsShop() {
    const box = el('div', 'box');
    box.innerHTML = `<h2>Get Rs</h2>
      <p style="color:#8a8a8a;font-size:11px;margin-bottom:16px;letter-spacing:1px">
      Premium currency for shortcut unlocks. (Purchases are simulated in this demo build.)</p>`;
    D.RS_PACKS.forEach(p => {
      const row = el('div', 'pack');
      row.innerHTML = `<div><div class="rsamt">${p.rs} ₹</div>
        ${p.bonus ? `<div class="bonus">+${p.bonus} bonus included</div>` : ''}</div>`;
      const b = el('button', 'buyreal', p.priceLabel);
      b.onclick = () => { A.grant('rs', p.rs); toast(`+${p.rs} Rs added`); closeModal(); };
      row.appendChild(b);
      box.appendChild(row);
    });
    const close = el('button', 'close', 'CLOSE');
    close.onclick = closeModal; box.appendChild(close);
    showModal(box);
  }

  // -------------------------------------------------------------- import/export
  function openExport() {
    const box = el('div', 'box');
    box.innerHTML = `<h2>Export Save</h2>
      <p style="color:#8a8a8a;font-size:11px">Copy this text to back up your account.</p>`;
    const ta = el('textarea', 'io-area'); ta.value = A.export(); ta.readOnly = true;
    box.appendChild(ta);
    const copy = el('button', 'buy coins', 'COPY'); copy.style.width = '100%';
    copy.onclick = () => { ta.select(); document.execCommand('copy'); toast('Copied to clipboard'); };
    box.appendChild(copy);
    const close = el('button', 'close', 'CLOSE'); close.onclick = closeModal; box.appendChild(close);
    showModal(box);
  }
  function openImport() {
    const box = el('div', 'box');
    box.innerHTML = `<h2>Import Save</h2>
      <p style="color:#8a8a8a;font-size:11px">Paste a previously exported save. This overwrites your current account.</p>`;
    const ta = el('textarea', 'io-area'); ta.placeholder = 'Paste save JSON here…';
    box.appendChild(ta);
    const load = el('button', 'buy coins', 'IMPORT'); load.style.width = '100%';
    load.onclick = () => { if (A.import(ta.value.trim())) { toast('Save imported'); closeModal(); refresh(); renderWallet(); } else toast('Invalid save data'); };
    box.appendChild(load);
    const close = el('button', 'close', 'CLOSE'); close.onclick = closeModal; box.appendChild(close);
    showModal(box);
  }

  // -------------------------------------------------------------- launch game
  function launchGame() {
    const a = A.get();
    if (!a.loadout.length) { toast('Equip at least one weapon first'); switchTab('shop'); return; }
    LobbyBridge.launch(a.loadout, a.items);
    global.location.href = 'zombie_fps.html';
  }

  // -------------------------------------------------------------- modal + toast
  function showModal(box) {
    const m = el('div', 'modal'); m.id = 'modal';
    m.onclick = e => { if (e.target === m) closeModal(); };
    m.appendChild(box); document.body.appendChild(m);
  }
  function closeModal() { const m = $('#modal'); if (m) m.remove(); }

  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // expose the couple of things the HTML wires directly
  global.Lobby = { init, openRsShop };
  document.addEventListener('DOMContentLoaded', init);
})(window);
