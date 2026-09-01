/* ============================================================
   rig.js — THE RIGGING ENGINE.

   Every game on this site settles through settle(). That is the
   whole architecture: the games are only animations, the outcome
   was decided here before the reels started moving.

   Two ideas do all the work:

   1. PAYOUT is chosen from a distribution with a real RTP of
      about 8%. Most rounds pay nothing; a third pay you back a
      humiliating fraction of your stake.

   2. TIER — the presentation — is deliberately DECOUPLED from
      the payout. A 0.01-credit return on a 50-credit bet is
      allowed to render as "JACKPOT", with sirens. That mismatch
      is the entire joke, and it is exactly how the real ones
      make a net loss feel like a win.

   Randomness is centralised and seedable so behaviour is
   reproducible, and ?rig= forces an outcome for testing.
   ============================================================ */

import * as bank from './bank.js';

/* ---------------- seedable RNG ---------------- */

const qs = new URLSearchParams(location.search);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedParam = qs.get('seed');
export const SEEDED = seedParam !== null;
const _rand = SEEDED ? mulberry32(parseInt(seedParam, 10) || 1) : Math.random;

export const rand = () => _rand();
export const range = (a, b) => a + _rand() * (b - a);
export const int = (a, b) => Math.floor(range(a, b + 1));
export const pick = (arr) => arr[Math.floor(_rand() * arr.length)];
export const chance = (p) => _rand() < p;

/** Weighted pick from [[value, weight], ...]. */
export function weighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = _rand() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[pairs.length - 1][0];
}

/* ---------------- outcome classes ---------------- */

export const TIERS = ['WIN', 'BIG WIN', 'MEGA WIN', 'JACKPOT'];

/**
 * Base distribution. Real RTP works out to roughly 8%:
 *   .33 * ~0.14  +  .045 * ~1.0  +  .005 * ~2.5  ≈  0.10
 * (and the escalating rig below shaves it further)
 */
const BASE = [
  ['nothing',   62],   // payout 0
  ['crumb',     33],   // 0.01x - 0.40x  → a loss, presented as a win
  ['breakeven',  4.5], // 0.90x - 1.10x  → presented as legendary
  ['real',       0.5], // 2x - 3x        → an actual win. The hook.
];

/** Debug override: ?rig=nothing|crumb|breakeven|real|win|jackpot */
const FORCE = qs.get('rig');

function pickOutcome() {
  if (FORCE) {
    if (FORCE === 'win' || FORCE === 'jackpot') return 'crumb';  // the signature gag
    if (BASE.some(([k]) => k === FORCE)) return FORCE;
  }

  const st = bank.stats();
  const w = BASE.map(([k, v]) => [k, v]);
  const set = (k, v) => { const e = w.find(([n]) => n === k); if (e) e[1] = v; };

  // Doing well? The rig notices.
  if (st.realWinStreak >= 2) { set('nothing', 80); set('crumb', 19.5); set('breakeven', 0.5); set('real', 0.05); }

  // Long dry spell? Throw a crumb, so you keep going. Never a real win.
  if (st.lossStreak >= 8) { set('nothing', 18); set('crumb', 81); set('breakeven', 1); set('real', 0); }

  // Nearly broke? Definitely a crumb. Can't have you leaving.
  if (bank.credits() <= bank.bet() * 2) { set('nothing', 30); set('crumb', 69); set('real', 0); }

  return weighted(w);
}

function payoutFor(outcome, bet) {
  switch (outcome) {
    case 'nothing':   return 0;
    // deliberately weighted toward the insulting end
    case 'crumb':     return bank.round2(Math.max(0.01, bet * weighted([
                        [0.001, 34], [0.01, 26], [0.03, 16], [0.08, 12], [0.18, 8], [0.35, 4],
                      ]) * range(0.8, 1.25)));
    case 'breakeven': return bank.round2(bet * range(0.9, 1.1));
    case 'real':      return bank.round2(bet * range(2, 3));
    default:          return 0;
  }
}

/**
 * The theatre. Tier is chosen from how ABSURD the announcement
 * would be, not from how much you got. Smaller returns get
 * louder celebrations, because that's funnier and because
 * that's what the real ones do.
 */
function tierFor(outcome, ratio) {
  if (FORCE === 'jackpot') return 'JACKPOT';
  if (outcome === 'real') return weighted([['MEGA WIN', 3], ['JACKPOT', 2]]);
  if (outcome === 'breakeven') return weighted([['BIG WIN', 1], ['MEGA WIN', 3], ['JACKPOT', 4]]);
  // crumb — the smaller the crumb, the bigger the party
  if (ratio < 0.02) return weighted([['JACKPOT', 6], ['MEGA WIN', 3], ['BIG WIN', 1]]);
  if (ratio < 0.10) return weighted([['MEGA WIN', 4], ['JACKPOT', 3], ['BIG WIN', 2]]);
  return weighted([['BIG WIN', 4], ['WIN', 3], ['MEGA WIN', 2], ['JACKPOT', 1]]);
}

/* ---------------- the one public call ---------------- */

/**
 * settle({ bet, game })
 *
 * @returns {{
 *   outcome: 'nothing'|'crumb'|'breakeven'|'real',
 *   payout: number,          // what you actually get back
 *   net: number,             // payout - bet. The only honest number.
 *   ratio: number,           // payout / bet
 *   tier: string|null,       // presentation tier, null if payout is 0
 *   multiplierShown: number, // the tiny multiplier we brag about
 *   nearMiss: boolean,       // animate an almost-win before revealing
 *   isRealWin: boolean       // did you genuinely come out ahead
 * }}
 */
export function settle({ bet, game = 'unknown' } = {}) {
  const stake = bank.round2(bet);
  const outcome = pickOutcome();
  const payout = payoutFor(outcome, stake);
  const net = bank.round2(payout - stake);
  const ratio = stake > 0 ? payout / stake : 0;

  const res = {
    outcome,
    payout,
    net,
    ratio,
    tier: payout > 0 ? tierFor(outcome, ratio) : null,
    multiplierShown: Math.round(ratio * 100) / 100,
    // a total loss almost always gets teased first; that's the addictive bit
    nearMiss: outcome === 'nothing' ? chance(0.82) : chance(0.35),
    isRealWin: net > 0,
    game,
  };

  console.log(
    `[rig] ${game} bet=${stake} outcome=${outcome} payout=${payout} net=${net} tier=${res.tier}`
  );
  return res;
}

/** The number in the corner of every stage. It is not a lie. */
export const ADVERTISED_RTP = '7.31%';

export default { settle, rand, range, int, pick, chance, weighted, ADVERTISED_RTP, SEEDED };
