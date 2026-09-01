/* ============================================================
   taunt.js — the abuse layer.

   Dictionaries tiered by how badly you just did and how long
   you've been losing. Nothing here is nice. That's the point:
   a real casino says "so close!" — this one says what it means.
   ============================================================ */

import { pick, chance } from './rig.js';

export const SLOGANS = [
  "You'll never win.™",
  'The house always wins. You just always lose.',
  'Certified 7.31% payout — the most honest casino online.',
  'Where your money goes to die.',
  "97% of our players quit before they get lucky. Don't be like them. Be worse.",
  'Every game is rigged. We just admit it.',
  'Turning disposable income into disposable dignity since right now.',
  'Statistically, you have already lost. Emotionally, too.',
  'We took your money before you clicked. This is a formality.',
  'The only drop is your net worth.',
];

/* ---------------- losses ---------------- */

// total loss, nothing back at all
const NOTHING = [
  'Nothing. Absolutely fucking nothing.',
  'Zero. Zilch. Just like your prospects.',
  'That money is gone and it is not coming back.',
  'Wow. Nothing at all. Shocking. Unprecedented.',
  'You gave us money and we kept it. Working as intended.',
  'Congratulations, you played yourself.',
  'The machine has considered your request and said no.',
  'Empty. Like your bank account. Like your weekend.',
  'Not a single credit. Beautiful, really.',
  'We appreciate the donation.',
  'You lost. Try again, idiot.',
  "That's gone. Say goodbye. Wave at it.",
  'Fuck all. Nada. Get bent.',
  'Big swing. Total miss. Classic you.',
];

// tiny bet lost
const SMALL = [
  'Losing that little is honestly embarrassing. Bet more, coward.',
  'A tiny loss for a tiny player.',
  'You lost, but so cheaply that it barely counts as gambling.',
  'That was the loss equivalent of a firm handshake.',
];

// big bet lost
const BIG = [
  'OOF. That one actually hurt, didn\'t it? Good.',
  'That was a lot of money. It is our money now.',
  'Huge bet. Huge loss. Huge idiot.',
  'You could have bought something real with that. You did not.',
  'Somewhere, your future self is screaming.',
  'That is rent. That was rent.',
  'A genuinely stupid amount to lose in one click. Respect.',
];

// truly massive bet lost
const HUGE = [
  'JESUS. Okay. That was a catastrophic decision and we love you for it.',
  'You just set fire to a pile of money in front of an audience.',
  'This is the single dumbest thing anyone has done on this website today.',
  'We are printing your loss out and framing it.',
  'Your mother would be so, so disappointed. We asked her.',
];

/* ---------------- loss streaks ---------------- */

const STREAK = {
  3:  'Three in a row. A pattern is emerging and it is called "you".',
  5:  'Five losses. At this point it is a lifestyle.',
  7:  'Seven straight. The machine is not broken. You are.',
  10: 'TEN IN A ROW. Ten. We did not even have to try.',
  13: 'Thirteen. Unlucky? No. Working as designed.',
  15: 'Fifteen losses. Genuinely, how are you still here?',
  20: 'Twenty. TWENTY. You are the reason this website is profitable.',
  25: 'Twenty-five in a row. You have become the house edge.',
  30: 'Thirty. We have stopped laughing. This is just sad now. Continue.',
  40: 'Forty consecutive losses. You are not a gambler, you are a subscription.',
  50: 'Fifty. You have lost fifty times in a row. Please seek a hobby. Or bet more.',
};

/* ---------------- "wins" (i.e. smaller losses) ---------------- */

// payout > 0 but you still lost money. The core gag.
const FAKE_WIN = [
  'YOU WON! (You lost {loss} credits.)',
  'BIG WINNER!!! Net result: down {loss}. Enjoy!',
  "That's a win! In the sense that a number went up. Briefly.",
  'Look at that payout! Now look at your balance. Now cry.',
  'Winner winner! You are {loss} credits poorer. Celebrate.',
  'A win! Statistically. Legally. Not financially.',
  'We are legally allowed to call that a win, so: WIN!',
  'You got {payout} back out of {bet}. This is what winning feels like here.',
  'HUGE WIN! Down {loss} overall, but let us have this moment.',
  'The sirens went off, so it must have been good. It was not.',
];

// genuine net-positive win
const REAL_WIN = [
  "Okay. You actually won. Don't get used to it.",
  'A real win. We hate this. It will not happen again.',
  'You beat us. Once. Statistically we already have it back.',
  'Enjoy this. Seriously. It is the last one.',
  'A genuine profit. Now bet it all again — you know you will.',
];

const BREAKEVEN = [
  'You got your money back. Thrilling. Riveting. Pointless.',
  'Break even! All that noise for nothing.',
  'Exactly what you started with, minus the time and the dignity.',
];

/* ---------------- UI nagging ---------------- */

const BET_UP = [
  'Now THAT is a real player. 😍',
  'Bigger bet, bigger loss. We love your energy.',
  'Yes. Yes. Give us more.',
  'Finally, someone with conviction and no plan.',
];

const BET_DOWN = [
  'Pussy.',
  'Scared? You should be. Still, pathetic.',
  'Lowering your bet does not lower your odds. Nice try, coward.',
  'Oh, playing it safe. Adorable.',
  'That is the bet of a man who checks his bank app.',
];

const BUST = [
  'You are out of credits. You have achieved nothing. Well done.',
  'Balance: zero. Journey: complete. Lesson: not learned.',
  'Broke. Skint. Done. That took less time than we expected.',
  'You have run out of money, which was always the ending.',
];

const PITY = [
  'Here is 5 credits. It is not a kindness, it is a fishing hook.',
  '5 whole credits. Go on. Lose them too.',
  'A pity handout. Take it and be ashamed.',
  'We are giving you 5 credits because a player at zero cannot lose any more.',
];

const NEAR_MISS = [
  'SO close. That is not an accident.',
  'Almost! By design. Every time.',
  'One symbol off. Engineered to feel like your fault.',
  'You nearly had it. You never had it.',
  'That near miss was chosen for you before you clicked.',
];

const WITHDRAW = [
  'Withdrawals require a minimum balance of 1,000,000 credits. Keep going!',
  'Withdraw? Ha. Ha ha. No.',
  'Our withdrawal team is on holiday. Permanently.',
];

const MUTE = [
  'Muting the farts will not mute the losses.',
  'Oh, the sounds were the problem? Not the gambling? Okay.',
];

/* ---------------- fake social proof ---------------- */

const NAMES = [
  'BigDick69', 'xX_TurdLord_Xx', 'grinding_dad', 'CryptoJanitor', 'LucyLoseAlot',
  'nan_from_hull', 'ShartVader', 'definitely_not_a_bot', 'Poopmaster3000', 'YourExGF',
  'DrainedDaily', 'flush_god', 'mortgage_is_fine', 'AnalRetentive', 'Steve',
  'i_can_stop_anytime', 'sewer_baron', 'BrownPitt', 'ThePlop', 'wife_left_2024',
];
const GAMES_ = ['SHIT DROP', 'SHIT SLOTS', 'FLUSHPOINT', 'WHEEL OF MISFORTUNE'];

export function fakeWinner() {
  const amt = (Math.floor(Math.random() * 96000) + 4000).toLocaleString('en-US');
  return `<b>${pick(NAMES)}</b> just won ${amt} 💩 on ${pick(GAMES_)}!`;
}

export const TRUTHS = [
  'no they didn\'t',
  'this ticker is fabricated',
  'nobody has ever won that',
  'these names were generated at random',
  'the payout table is decorative',
];

export const QUOTES = [
  { s: 5, t: 'Lost £4,000 in one evening. Slick interface though.', who: 'Dave', sub: 'verified loser' },
  { s: 5, t: 'The farts really soften the blow of financial ruin.', who: 'Maria', sub: 'down 12,400 💩' },
  { s: 1, t: 'I won 0.01 credits and the screen said JACKPOT. I cried.', who: 'Anonymous', sub: 'still playing' },
  { s: 5, t: 'Finally, a casino that respects me enough to insult me directly.', who: 'Kev', sub: 'VIP Diamond Turd' },
  { s: 5, t: 'Better odds than my actual bookmaker, and that is the tragedy.', who: 'Tom', sub: 'no longer welcome at home' },
  { s: 4, t: 'Docked one star because I briefly broke even.', who: 'Sandra', sub: 'lifetime net: -8,912 💩' },
];

/* ---------------- the picker ---------------- */

function fill(str, { bet, payout, net }) {
  return str
    .replace(/{loss}/g, Math.abs(net).toFixed(2))
    .replace(/{payout}/g, payout.toFixed(2))
    .replace(/{bet}/g, bet.toFixed(2));
}

/**
 * The line shown after a round.
 * @returns {{ text: string, kind: 'loss'|'win'|'streak' }}
 */
export function taunt({ bet, payout, net, lossStreak, outcome }) {
  // streak milestones take priority — they're the funniest beat
  if (payout === 0 && STREAK[lossStreak]) {
    return { text: STREAK[lossStreak], kind: 'streak' };
  }

  if (payout > 0) {
    if (net > 0) return { text: pick(REAL_WIN), kind: 'win' };
    if (outcome === 'breakeven' || Math.abs(net) < 0.01) return { text: pick(BREAKEVEN), kind: 'win' };
    return { text: fill(pick(FAKE_WIN), { bet, payout, net }), kind: 'win' };
  }

  // total loss, sized abuse
  let pool = NOTHING;
  if (bet >= 250) pool = HUGE;
  else if (bet >= 75) pool = BIG;
  else if (bet <= 2) pool = SMALL;
  else if (chance(0.35)) pool = NOTHING;
  return { text: pick(pool), kind: 'loss' };
}

export const betNudge   = (dir) => pick(dir === 'up' ? BET_UP : BET_DOWN);
export const bustLine   = () => pick(BUST);
export const pityLine   = () => pick(PITY);
export const nearMissLine = () => pick(NEAR_MISS);
export const withdrawLine = () => pick(WITHDRAW);
export const muteLine   = () => pick(MUTE);
export const slogan     = () => pick(SLOGANS);

export default { taunt, betNudge, bustLine, pityLine, nearMissLine, withdrawLine, muteLine, slogan, SLOGANS, QUOTES, fakeWinner, TRUTHS };
