/* ============================================================================
 * DEAD ZONE — Lobby <-> Game Bridge
 * ----------------------------------------------------------------------------
 * A tiny, dependency-free glue layer loaded by BOTH the lobby and the game so
 * they can hand data to each other through localStorage:
 *
 *   Lobby  --(loadout + carried items)-->  Game     key: dz_launch
 *   Game   --(coins earned, stats)------>  Lobby    key: dz_pending_rewards
 *
 * The game writes rewards on match end; the lobby credits them on return and
 * clears the slot. Keeping this separate means the game only needs one <script>
 * include and one function call — no tight coupling.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const LAUNCH_KEY = 'dz_launch';
  const REWARD_KEY = 'dz_pending_rewards';

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function clear(key) { try { localStorage.removeItem(key); } catch (e) {} }

  // --- lobby side -----------------------------------------------------------
  // Called by the lobby right before navigating to the game.
  function launch(loadout, items) {
    write(LAUNCH_KEY, { loadout: loadout || [], items: items || {}, at: Date.now() });
  }
  // The game reads this to build the player's starting inventory.
  function takeLaunch() { const d = read(LAUNCH_KEY); return d; }

  // --- game side ------------------------------------------------------------
  // Convert in-match performance into a persistent coin reward. Kept simple and
  // in one place so the payout curve is easy to tune later.
  function coinsFor(result) {
    const kills = result.kills || 0;
    const wave = result.wave || 0;
    const score = result.score || 0;
    return Math.floor(kills * 12 + wave * 60 + score * 0.05);
  }
  // Game calls this on death / quit-to-lobby. Accumulates onto any reward that
  // hasn't been collected yet, so playing several matches back-to-back (via
  // "Play Again") never drops earnings; the best wave/score is kept.
  function reportMatch(result) {
    const prev = read(REWARD_KEY) || { kills: 0, wave: 0, score: 0, coins: 0, matches: 0 };
    const payload = {
      kills: (prev.kills || 0) + (result.kills || 0),
      wave: Math.max(prev.wave || 0, result.wave || 0),
      score: Math.max(prev.score || 0, result.score || 0),
      coins: (prev.coins || 0) + coinsFor(result),
      matches: (prev.matches || 0) + 1,
      at: Date.now(),
    };
    write(REWARD_KEY, payload);
    return payload;
  }

  // The lobby reads + clears this when it regains focus.
  function takeRewards() {
    const d = read(REWARD_KEY);
    if (d) clear(REWARD_KEY);
    return d;
  }

  global.LobbyBridge = {
    LAUNCH_KEY, REWARD_KEY,
    launch, takeLaunch,
    reportMatch, takeRewards, coinsFor,
  };
})(window);
