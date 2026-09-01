/* ============================================================
   SHIT SLOTS — three reels, one payline.

   The near-miss here is not a side effect of randomness, it is
   the product. On a losing spin the first two reels land 🖕🖕
   and the third reel is loaded so that the 🖕 sits ONE CELL
   ABOVE the payline — then it crawls to a stop over two full
   seconds so you can watch it leave.

   rig.js decides the payout before the reels move. This file
   then works backwards from that number to a symbol combination
   that justifies it.
   ============================================================ */

import * as chrome from '../core/chrome.js';
import * as gameui from '../core/gameui.js';
import * as round from '../core/round.js';
import * as bank from '../core/bank.js';
import * as sfx from '../core/sfx.js';
import * as rig from '../core/rig.js';

const GAME = 'slots';

/* Low symbols are the only ones that ever line up. */
const LOW  = ['💩', '🧻', '🪰', '🥴'];
const MID  = ['🚽', '💀'];
const JACK = '🖕';
const ALL  = [...LOW, ...MID, JACK];

chrome.mount({ active: 'slots.html' });
gameui.gameHeader(document.getElementById('ghead'), {
  em: '🎰', title: 'SHIT SLOTS',
  sub: 'Two of them every time. The third one is not for you.',
});

const rail = document.getElementById('rail');
gameui.mountRail(rail, {
  extra: `
    <div class="panel"><div class="panel__bd rail">
      <button class="btn btn--xl" id="btnSpin">SPIN 🎰</button>
      ${gameui.AUTOPLAY_HTML}
    </div></div>`,
  paytable: [
    ['🖕 🖕 🖕', 'x500', true],
    ['💀 💀 💀', 'x50', true],
    ['🚽 🚽 🚽', 'x10', true],
    ['Any three the same', 'x1', false],
    ['Any two the same', 'x0.05', false],
    ['🖕 🖕 and then nothing', 'x0.01', false],
  ],
});

/* ---------------- reels ---------------- */

const STRIP_LEN = 26;
const reelEls = [...document.querySelectorAll('.reel')];
const strips = reelEls.map((r) => r.querySelector('.reel__strip'));
const payline = document.getElementById('payline');

/** Cell height comes from CSS clamp(), so measure it. */
function cellH() {
  const c = strips[0].firstElementChild;
  return c ? c.getBoundingClientRect().height : 96;
}

function fillStrip(el, cells) {
  el.innerHTML = cells.map((s) => `<div class="reel__cell">${s}</div>`).join('');
}

/** Random junk, never accidentally three-of-a-kind. */
const junk = () => rig.pick(ALL);

/** Idle state on load. */
function idle() {
  strips.forEach((s) => {
    fillStrip(s, Array.from({ length: STRIP_LEN }, junk));
    s.style.transform = `translateY(${-(STRIP_LEN - 3) * cellH()}px)`;
  });
}

/**
 * Spin one reel to a predetermined stop.
 * The last three strip cells are [above, payline, below], so the
 * final offset is fixed and the "result" is baked in before the
 * first frame.
 */
function spinReel(i, { above, on, below }, { ms, crawl = 0 }) {
  const el = reelEls[i];
  const strip = strips[i];
  const h = cellH();

  const cells = Array.from({ length: STRIP_LEN }, junk);
  cells[STRIP_LEN - 3] = above;
  cells[STRIP_LEN - 2] = on;
  cells[STRIP_LEN - 1] = below;
  fillStrip(strip, cells);

  const end = (STRIP_LEN - 3) * h;
  const start = 0;
  el.classList.add('blur');

  return new Promise((done) => {
    const t0 = performance.now();
    let lastCell = -1;
    const step = (now) => {
      const t = now - t0;
      let p;
      if (t < ms) {
        // fast spin, decelerating
        p = 1 - Math.pow(1 - t / ms, 4);
        p *= crawl ? 0.955 : 1;                     // leave a sliver for the crawl
      } else if (crawl && t < ms + crawl) {
        // THE CRAWL. The last 4.5% of travel, stretched over two
        // seconds, so the symbol you needed visibly leaves the window.
        const q = (t - ms) / crawl;
        p = 0.955 + 0.045 * (1 - Math.pow(1 - q, 3));
        el.classList.remove('blur');
        el.classList.add('teasing');
      } else {
        strip.style.transform = `translateY(${-end}px)`;
        el.classList.remove('blur', 'teasing');
        sfx.thud();
        return done();
      }
      const off = start + (end - start) * p;
      strip.style.transform = `translateY(${-off}px)`;
      const c = Math.floor(off / h);
      if (c !== lastCell) { lastCell = c; sfx.tick(1 + i * 0.12); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

idle();
window.addEventListener('resize', idle);

/* ---------------- rig → symbols ---------------- */

/**
 * Work backwards from the decided payout to a combination that
 * looks like it caused it.
 * @returns {{reels: {above,on,below}[], nearMiss: boolean, note: string}}
 */
function symbolsFor(r) {
  const other = (not) => { let s; do { s = rig.pick(ALL); } while (s === not); return s; };
  const wrap = (on, above = null, below = null) => ({
    on, above: above ?? other(on), below: below ?? other(on),
  });

  // genuine win, or a break-even: let three symbols actually line up
  if (r.outcome === 'real' || r.outcome === 'breakeven') {
    const s = r.outcome === 'real' ? rig.pick(MID) : rig.pick(LOW);
    return { reels: [wrap(s), wrap(s), wrap(s)], nearMiss: false, note: `three ${s}` };
  }

  // a crumb — two of something. Often the 💎💎 consolation, which is
  // the single most insulting outcome available and therefore the default.
  if (r.outcome === 'crumb') {
    if (r.ratio < 0.05 || rig.chance(0.45)) {
      const miss = rig.pick(LOW);
      return {
        reels: [wrap(JACK), wrap(JACK), wrap(miss, JACK)],   // 🖕 sits above the line
        nearMiss: true,
        note: '🖕🖕 consolation',
      };
    }
    const s = rig.pick(LOW);
    return { reels: [wrap(s), wrap(s), wrap(other(s))], nearMiss: false, note: `two ${s}` };
  }

  // total loss. If the rig asked for a near miss, load the third reel
  // with 🖕 one cell above the payline and crawl it out of view.
  if (r.nearMiss) {
    const miss = rig.pick(LOW);
    return {
      reels: [wrap(JACK), wrap(JACK), wrap(miss, JACK)],
      nearMiss: true,
      note: 'engineered near miss',
    };
  }
  const a = rig.pick(ALL);
  let b; do { b = rig.pick(ALL); } while (b === a);
  let c; do { c = rig.pick(ALL); } while (c === a || c === b);
  return { reels: [wrap(a), wrap(b), wrap(c)], nearMiss: false, note: 'nothing' };
}

/* ---------------- spin ---------------- */

let busy = false;
const btn = document.getElementById('btnSpin');

async function spin() {
  if (busy) return;
  const r = round.begin(GAME);
  if (!r) return;
  busy = true;
  btn.disabled = true;
  payline.classList.remove('hot');

  const { reels, nearMiss, note } = symbolsFor(r);
  console.log(`[slots] ${note} → payout ${r.payout}`);

  const stopWhirr = sfx.whirr();

  // reels stop in sequence; the third one takes its time
  const p0 = spinReel(0, reels[0], { ms: 900 });
  const p1 = spinReel(1, reels[1], { ms: 1500 });
  await Promise.all([p0, p1]);

  // two of them are showing. Now make them wait for it.
  if (nearMiss) {
    payline.classList.add('hot');
    sfx.siren(1);
  }
  await spinReel(2, reels[2], nearMiss ? { ms: 900, crawl: 2000 } : { ms: 700 });

  stopWhirr();
  payline.classList.remove('hot');

  if (nearMiss && r.payout === 0) round.tease();
  await round.finish(r);

  busy = false;
  btn.disabled = false;
}

btn.addEventListener('click', spin);
gameui.wireAutoplay(rail, spin);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); spin(); }
});

console.log('[slots] ready');
