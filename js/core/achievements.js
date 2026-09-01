/* ============================================================
   achievements.js — trophies. Every single one is for losing.

   Real casinos gamify engagement, not outcomes. So does this:
   the progress you make is measured in money destroyed.
   ============================================================ */

import * as bank from './bank.js';
import * as fanfare from './fanfare.js';
import * as sfx from './sfx.js';

/** test(ctx) where ctx = { stats, credits, bet, state, last } */
export const TROPHIES = [
  { id: 'first-blood', em: '🩸', t: 'First Blood',
    d: 'Lose for the very first time.',
    test: ({ stats }) => stats.spins >= 1 && stats.net < 0 },

  { id: 'nothing-burger', em: '🕳️', t: 'Nothing Burger',
    d: 'Get back exactly nothing.',
    test: ({ last }) => last && last.payout === 0 },

  { id: 'the-crumb', em: '🍞', t: 'The Crumb',
    d: 'Bet 50 or more. Win less than 0.10.',
    test: ({ last }) => last && last.payout > 0 && last.payout < 0.1 && last.stake >= 50 },

  { id: 'down-bad', em: '📉', t: 'Down Bad',
    d: 'Lose 250 credits in total.',
    test: ({ stats }) => stats.net <= -250 },

  { id: 'financially-illiterate', em: '🧠', t: 'Financially Illiterate',
    d: 'Lose 10 goes in a row.',
    test: ({ stats }) => stats.lossStreak >= 10 },

  { id: 'big-swinger', em: '🍆', t: 'Big Swinger',
    d: 'Bet the full 500 on one go.',
    test: ({ last }) => last && last.stake >= 500 },

  { id: 'certified-idiot', em: '🏅', t: 'Certified Idiot',
    d: 'Run out of money completely.',
    test: ({ stats }) => stats.busts >= 1 },

  { id: 'sunk-cost', em: '⚓', t: 'The Sunk Cost',
    d: 'Have 100 goes. Knowing all of this.',
    test: ({ stats }) => stats.spins >= 100 },

  { id: 'lucky-fool', em: '🍀', t: 'Lucky Fool',
    d: 'Actually come out ahead on one go.',
    test: ({ last }) => last && last.net > 0 },

  { id: 'gave-it-back', em: '🔁', t: 'Gave It Straight Back',
    d: 'Win, then lose it on the very next go.',
    test: ({ stats, last }) => last && last.net < 0 && stats.bestNet > 0 && stats.spins >= 2 && window.__sdWonLast === true },

  { id: 'beggar', em: '🥣', t: 'Professional Beggar',
    d: 'Take the sad little handout three times.',
    test: ({ state }) => state.pityTaken >= 3 },

  { id: 'vip-turd', em: '💎', t: 'VIP Diamond Turd',
    d: 'Burn 1,000 credits of pretend money.',
    test: ({ stats }) => stats.lost >= 1000 },

  { id: 'all-tourists', em: '🎪', t: 'The Full Tour',
    d: 'Lose money in all four games.',
    test: () => {
      try { return JSON.parse(localStorage.getItem('shitdrop.played') || '[]').length >= 4; }
      catch { return false; }
    } },

  { id: 'masochist', em: '⛓️', t: 'Masochist',
    d: 'Have 300 goes. Please stop.',
    test: ({ stats }) => stats.spins >= 300 },
];

export const VIP_TIERS = [
  { at: 0,    name: 'Nobody' },
  { at: 100,  name: 'Bronze Stool' },
  { at: 300,  name: 'Silver Log' },
  { at: 600,  name: 'Gold Turd' },
  { at: 1000, name: 'Diamond Turd' },
  { at: 2500, name: 'Sewer Baron' },
];

/** The bar fills up with money LOST. There is no prize. We say so on the page. */
export function vip() {
  const lost = bank.stats().lost;
  let i = 0;
  for (let k = 0; k < VIP_TIERS.length; k++) if (lost >= VIP_TIERS[k].at) i = k;
  const cur = VIP_TIERS[i];
  const next = VIP_TIERS[i + 1] || null;
  const pct = next
    ? Math.min(100, ((lost - cur.at) / (next.at - cur.at)) * 100)
    : 100;
  return { lost, tier: cur, next, pct };
}

/** Note which games you've been fleeced by, for the Full Tour trophy. */
export function markPlayed(game) {
  try {
    const a = JSON.parse(localStorage.getItem('shitdrop.played') || '[]');
    if (!a.includes(game)) { a.push(game); localStorage.setItem('shitdrop.played', JSON.stringify(a)); }
  } catch { /* whatever */ }
}

/**
 * Run after every settlement. Awards anything newly earned and
 * toasts it. Returns the ids awarded this call.
 */
export function check(last) {
  const ctx = { stats: bank.stats(), credits: bank.credits(), bet: bank.bet(), state: bank.s(), last };
  const won = [];
  for (const tr of TROPHIES) {
    if (bank.trophies().includes(tr.id)) continue;
    let ok = false;
    try { ok = !!tr.test(ctx); } catch { ok = false; }
    if (ok && bank.awardTrophy(tr.id)) won.push(tr.id);
  }
  // remember whether the previous round was a net win, for 'gave-it-back'
  if (last) window.__sdWonLast = last.net > 0;

  won.forEach((id, i) => {
    const tr = TROPHIES.find((t) => t.id === id);
    setTimeout(() => {
      fanfare.toast(`${tr.em} <b>${tr.t}</b><br><span class="dim">${tr.d}</span>`, 'trophy', 6500);
      sfx.partyHorn();
    }, 600 + i * 900);
  });
  return won;
}

export const got = (id) => bank.trophies().includes(id);

export default { TROPHIES, VIP_TIERS, check, vip, markPlayed, got };
