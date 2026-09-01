/* ============================================================
   round.js — the shared round lifecycle.

   Games are animations. This is the actual gambling:

     const r = round.begin('slots');   // takes your money, decides the outcome
     await myAnimation(r);             // the game pretends to be fair
     round.finish(r);                  // pays out, insults you, hands out trophies

   Keeping it here means all four games lie in exactly the
   same way, and the rig only lives in one place.
   ============================================================ */

import * as bank from './bank.js';
import * as rig from './rig.js';
import * as fanfare from './fanfare.js';
import * as taunt from './taunt.js';
import * as achievements from './achievements.js';
import * as sfx from './sfx.js';

/**
 * Take the stake and decide the outcome up front.
 * @returns settlement object, or null if the player is broke.
 */
export function begin(game) {
  const bet = bank.bet();
  if (!bank.canAfford(bet)) {
    fanfare.toast(taunt.bustLine(), 'loss');
    window.dispatchEvent(new CustomEvent('sd:broke'));
    return null;
  }
  bank.stake(bet);
  sfx.coins(4);
  achievements.markPlayed(game);
  const r = rig.settle({ bet, game });
  r.bet = bet;
  return r;
}

/**
 * Credit the "winnings" and run the whole presentation layer.
 * @returns the bank record.
 */
export async function finish(r, { silentFanfare = false } = {}) {
  const rec = bank.payout({ stakeAmount: r.bet, payout: r.payout, game: r.game });

  const line = taunt.taunt({
    bet: r.bet, payout: r.payout, net: rec.net,
    lossStreak: rec.stats.lossStreak, outcome: r.outcome,
  });

  if (r.payout > 0) {
    // ANY payout gets the full jackpot treatment. Even 0.01.
    if (!silentFanfare) await fanfare.celebrate({ ...r, net: rec.net });
    fanfare.toast(line.text, line.kind === 'loss' ? 'loss' : 'win');
  } else {
    fanfare.lossStamp();
    fanfare.toast(line.text, line.kind);
  }

  window.dispatchEvent(new CustomEvent('sd:round', { detail: { ...r, ...rec } }));
  achievements.check(rec);
  if (bank.isBust()) window.dispatchEvent(new CustomEvent('sd:broke'));
  return rec;
}

/** Near-miss beat, called by a game right before it reveals a loss. */
export function tease() {
  fanfare.teaseThud();
  if (rig.chance(0.5)) fanfare.toast(taunt.nearMissLine(), 'info', 3600);
}

export default { begin, finish, tease };
