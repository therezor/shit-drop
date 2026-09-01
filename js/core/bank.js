/* ============================================================
   bank.js — credits, bet sizing, streaks, lifetime stats.
   Every game settles through here. No game touches store.js
   or localStorage directly.
   ============================================================ */

import * as store from './store.js';

export const MIN_BET = 1;
export const MAX_BET = 500;
export const PITY = 5;                 // the humiliating handout
export const WITHDRAW_MIN = 1_000_000; // lol

const listeners = new Set();

function emit(detail) {
  for (const fn of listeners) { try { fn(detail); } catch (e) { console.error(e); } }
}

/** fn({ type, ...payload }) — 'credits' | 'bet' | 'settle' | 'bust' | 'reset' */
export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const s = () => store.get();

export const credits = () => round2(s().credits);
export const bet = () => s().bet;
export const muted = () => s().muted;
export const trophies = () => s().trophies;

export function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

/** Lifetime numbers. `net` is the only honest figure on the whole site. */
export function stats() {
  const st = s();
  const net = round2(st.returned - st.wagered);
  return {
    spins: st.spins,
    wagered: round2(st.wagered),
    returned: round2(st.returned),
    net,
    rtp: st.wagered > 0 ? (st.returned / st.wagered) * 100 : 0,
    lossStreak: st.lossStreak,
    winStreak: st.winStreak,
    realWinStreak: st.realWinStreak,
    worstNet: round2(st.worstNet),
    bestNet: round2(st.bestNet),
    busts: st.busts,
    lost: Math.max(0, -net),
  };
}

export function clampBet(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return MIN_BET;
  return Math.min(MAX_BET, Math.max(MIN_BET, n));
}

/** Returns { bet, dir } where dir is 'up' | 'down' | 'same' so the UI can taunt. */
export function setBet(v) {
  const prev = s().bet;
  const next = clampBet(v);
  store.patch({ bet: next });
  const dir = next > prev ? 'up' : next < prev ? 'down' : 'same';
  emit({ type: 'bet', bet: next, prev, dir });
  return { bet: next, dir };
}

export const canAfford = (amount = s().bet) => credits() >= amount;
export const isBust = () => credits() < MIN_BET;

/** Take the money. Call before animating. Throws if broke. */
export function stake(amount = s().bet) {
  const amt = round2(amount);
  if (amt < MIN_BET) throw new Error('bet too small');
  if (credits() < amt) throw new Error('insufficient credits');
  store.patch({ credits: round2(s().credits - amt), wagered: round2(s().wagered + amt) });
  emit({ type: 'credits', credits: credits(), delta: -amt, reason: 'stake' });
  return amt;
}

/**
 * Give back the "winnings" and update every streak.
 * Returns a settlement record the UI uses for its lies.
 */
export function payout({ stakeAmount, payout: pay, game }) {
  const p = round2(Math.max(0, pay));
  const st = s();
  const net = round2(p - stakeAmount);

  const patch = {
    credits: round2(st.credits + p),
    returned: round2(st.returned + p),
    spins: st.spins + 1,
  };

  // "win" = any payout at all (the site's definition).
  if (p > 0) { patch.winStreak = st.winStreak + 1; patch.lossStreak = 0; }
  else { patch.lossStreak = st.lossStreak + 1; patch.winStreak = 0; }

  // real win = you actually came out ahead. Rare on purpose.
  patch.realWinStreak = net > 0 ? st.realWinStreak + 1 : 0;

  if (net < st.worstNet) patch.worstNet = net;
  if (net > st.bestNet) patch.bestNet = net;

  store.patch(patch);
  if (p > 0) emit({ type: 'credits', credits: credits(), delta: p, reason: 'payout' });

  const rec = { game, stake: stakeAmount, payout: p, net, credits: credits(), stats: stats() };
  emit({ type: 'settle', ...rec });
  if (isBust()) { store.patch({ busts: s().busts + 1 }); emit({ type: 'bust' }); }
  return rec;
}

/** Money in. The cashier pays different amounts for different body parts. */
export function deposit(amount) {
  const amt = round2(amount);
  store.patch({ credits: round2(s().credits + amt), deposited: round2((s().deposited || 0) + amt) });
  emit({ type: 'credits', credits: credits(), delta: amt, reason: 'deposit' });
  return credits();
}

/** The pity handout. Deliberately not enough to matter. */
export function pity(amount = PITY) {
  store.patch({ credits: round2(s().credits + amount), pityTaken: s().pityTaken + 1 });
  emit({ type: 'credits', credits: credits(), delta: amount, reason: 'pity' });
  return credits();
}

export function toggleMute() {
  const m = !s().muted;
  store.patch({ muted: m });
  emit({ type: 'mute', muted: m });
  return m;
}

export function awardTrophy(id) {
  const t = s().trophies;
  if (t.includes(id)) return false;
  store.patch({ trophies: [...t, id] });
  return true;
}

/**
 * WIPE. The Wheel of Misfortune has two of these segments.
 * Zeroes the balance outright. Fake credits, real feeling.
 */
export function wipe() {
  const had = credits();
  store.patch({ credits: 0 });
  emit({ type: 'credits', credits: 0, delta: -had, reason: 'wipe' });
  emit({ type: 'bust' });
  return had;
}

export function reset() { store.reset(); emit({ type: 'reset' }); }
export const once = store.once;
