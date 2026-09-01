/* ============================================================
   fanfare.js — the theatre.

   celebrate() plays the FULL jackpot sequence for any payout
   above zero, no matter how insulting: screen shake, siren,
   confetti, a giant gold tier banner and a counter that rolls
   up dramatically to a number like 0.07.

   The net loss is rendered underneath in 8px grey. That is the
   whole trick, and it is not an exaggeration of the real thing.
   ============================================================ */

import * as sfx from './sfx.js';
import { pick } from './rig.js';

let dom = null;

const SUBS = {
  'WIN': ['A win is a win. Sort of. Not really.', 'A number went up. Then it went down.'],
  'BIG WIN': ['BIG! Well. Big-ish. Well. No.', 'That nice feeling is not money.'],
  'MEGA WIN': ['MEGA! HUGE! TINY!', 'The sirens are not linked to the prize.'],
  'JACKPOT': [
    'THE BIG ONE!!! (it is not the big one)',
    'JACKPOT!!! Please read the little grey words.',
    'THE BIGGEST WIN EVER. Look at it. Look closer.',
    'INCREDIBLE!!! Now check your balance.',
  ],
};

function build() {
  if (dom) return dom;

  const confetti = document.createElement('canvas');
  confetti.id = 'confetti';
  confetti.setAttribute('aria-hidden', 'true');

  const ff = document.createElement('div');
  ff.id = 'fanfare';
  ff.setAttribute('role', 'status');
  ff.setAttribute('aria-live', 'polite');
  ff.innerHTML = `
    <div class="ff">
      <div class="ff__tier" id="ffTier">JACKPOT</div>
      <div class="ff__mult" id="ffMult">x0.00</div>
      <div class="ff__amt" id="ffAmt">0.00 <small>💩</small></div>
      <div class="ff__sub" id="ffSub"></div>
      <div class="ff__net" id="ffNet"></div>
      <div class="ff__hint">click anywhere to keep losing</div>
    </div>`;

  const stamp = document.createElement('div');
  stamp.id = 'lossstamp';
  stamp.innerHTML = '<div class="stamp">LOSER</div>';

  const toasts = document.createElement('div');
  toasts.id = 'toasts';

  document.body.append(confetti, ff, stamp, toasts);

  dom = {
    confetti, ff, stamp, toasts,
    tier: ff.querySelector('#ffTier'),
    mult: ff.querySelector('#ffMult'),
    amt:  ff.querySelector('#ffAmt'),
    sub:  ff.querySelector('#ffSub'),
    net:  ff.querySelector('#ffNet'),
  };
  return dom;
}

/* ---------------- toasts ---------------- */

const KIND_LABEL = { loss: 'result', win: 'congratulations', streak: 'milestone', info: 'notice', trophy: 'achievement unlocked' };

export function toast(text, kind = 'loss', ms = 5200) {
  const d = build();
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.innerHTML = `<span class="toast__k">${KIND_LABEL[kind] || kind}</span>${text}`;
  d.toasts.appendChild(el);
  // keep the stack sane
  while (d.toasts.children.length > 4) d.toasts.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, ms);
  return el;
}

/* ---------------- confetti ---------------- */

let raf = 0;
let bits = [];

function burst(n, tier) {
  const d = build();
  const c = d.confetti;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const emoji = tier === 'JACKPOT' ? ['💩', '💩', '🪙', '🖕', '🧻'] : ['💩', '🪙', '💩'];
  bits = Array.from({ length: n }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.5,
    y: innerHeight * 0.52,
    vx: (Math.random() - 0.5) * 15,
    vy: -Math.random() * 17 - 7,
    r: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.34,
    s: 12 + Math.random() * 24,
    e: pick(emoji),
    life: 1,
  }));

  cancelAnimationFrame(raf);
  const tick = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    for (const b of bits) {
      b.vy += 0.42; b.vx *= 0.995;
      b.x += b.vx; b.y += b.vy; b.r += b.vr;
      if (b.y > innerHeight + 60) { b.life = 0; continue; }
      alive++;
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.font = `${b.s}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.e, 0, 0);
      ctx.restore();
    }
    if (alive) raf = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  raf = requestAnimationFrame(tick);
}

/* ---------------- rolling counter ---------------- */

function rollTo(el, target, ms) {
  const t0 = performance.now();
  // start well above zero so the digits blur convincingly for a 0.04 payout
  return new Promise((done) => {
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = target * eased;
      // spin the digits early, settle on the sad truth late
      const shown = p < 0.82 ? (target * eased + Math.random() * target * 0.9) : v;
      el.innerHTML = `${shown.toFixed(2)} <small>💩</small>`;
      if (p < 1) requestAnimationFrame(step);
      else { el.innerHTML = `${target.toFixed(2)} <small>💩</small>`; done(); }
    };
    requestAnimationFrame(step);
  });
}

/* ---------------- the main event ---------------- */

let busy = false;

/**
 * Play the full win sequence. Resolves when dismissed.
 * @param {{tier:string,payout:number,net:number,bet:number,multiplierShown:number}} r
 */
export function celebrate(r) {
  const d = build();
  if (busy) return Promise.resolve();
  busy = true;

  const tier = r.tier || 'WIN';
  d.tier.textContent = tier + (tier === 'JACKPOT' ? '!!!' : '!');
  d.mult.textContent = `x${r.multiplierShown.toFixed(2)}`;
  d.amt.innerHTML = '0.00 <small>💩</small>';
  d.sub.textContent = pick(SUBS[tier] || SUBS['WIN']);
  d.net.textContent = r.net < 0
    ? `(you bet ${r.bet.toFixed(2)} and lost ${Math.abs(r.net).toFixed(2)} · this was a loss)`
    : `(you are up ${r.net.toFixed(2)} — enjoy it)`;

  d.ff.classList.add('on');
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 520);

  sfx.fanfareSting(tier);
  burst(tier === 'JACKPOT' ? 120 : 70, tier);

  const dur = tier === 'JACKPOT' ? 2000 : 1400;
  rollTo(d.amt, r.payout, dur);

  return new Promise((resolve) => {
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      d.ff.classList.remove('on');
      d.ff.removeEventListener('click', close);
      busy = false;
      resolve();
    };
    d.ff.addEventListener('click', close);
    setTimeout(close, dur + (tier === 'JACKPOT' ? 1900 : 1300));
  });
}

/** The loss beat: a big red stamp and a sad noise. */
export function lossStamp(word) {
  const d = build();
  const el = d.stamp.querySelector('.stamp');
  el.textContent = word || pick(['LOSER', 'NOPE', 'LOL NO', 'GONE', 'DENIED', 'TOUGH']);
  d.stamp.classList.remove('on');
  void d.stamp.offsetWidth;   // restart the animation
  d.stamp.classList.add('on');
  sfx.lossSting();
  setTimeout(() => d.stamp.classList.remove('on'), 1600);
}

/** The near-miss beat — plays BEFORE the loss is revealed. */
export function teaseThud() { sfx.thud(); }

export function mount() { build(); }

export default { celebrate, lossStamp, toast, teaseThud, mount };
