/* ============================================================
   FLUSHPOINT — the crash game.

   The multiplier climbs, the bowl fills, and you cash out before
   it flushes. Except:

   - If the rig has decided this round pays nothing, the flush
     happens THE INSTANT YOU CLICK, at your multiplier minus
     0.01. Not near it. Exactly under it. Every time.
   - If the rig has decided this round pays something, you cash
     out fine — and then get paid a completely different, much
     smaller number, with a "withdrawal fee" cheerfully itemised.

   Both behaviours are printed on screen when they happen. The
   real ones do the first and hide it.
   ============================================================ */

import * as chrome from '../core/chrome.js';
import * as gameui from '../core/gameui.js';
import * as round from '../core/round.js';
import * as bank from '../core/bank.js';
import * as sfx from '../core/sfx.js';
import * as fanfare from '../core/fanfare.js';
import * as rig from '../core/rig.js';

const GAME = 'flushpoint';
const GROWTH = 0.235;          // e^(0.235t): ~1.9x at 3s, ~3.2x at 5s
const HARD_CAP = 4.5;          // nobody rides past this

chrome.mount({ active: 'flushpoint.html' });
gameui.gameHeader(document.getElementById('ghead'), {
  em: '🚽', title: 'FLUSHPOINT',
  sub: 'Grab your money before it flushes. It flushes just under wherever you click.',
});

const rail = document.getElementById('rail');
gameui.mountRail(rail, {
  extra: `
    <div class="panel"><div class="panel__bd rail">
      <button class="btn btn--xl" id="btnGo">PLACE BET 🚽</button>
      <label class="autorow">
        <input type="checkbox" id="autoplay">
        <span>GIVE UP AND LET US TAKE IT <span class="dim">(grabs it for you at 2.00×)</span></span>
      </label>
    </div></div>`,
  paytable: [
    ['Grab it at 2.00×', 'x2', false],
    ['Grab it at 5.00×', 'x5', true],
    ['Grab it at 100×', 'x100', true],
    ['Too slow', 'nothing', false],
    ['Our handling fee', 'up to 99.9%', false],
  ],
});

const el = {
  mult: document.getElementById('fpMult'),
  lbl: document.getElementById('fpLbl'),
  bowl: document.getElementById('fpBowl'),
  water: document.getElementById('fpWater'),
  turd: document.getElementById('fpTurd'),
  hist: document.getElementById('fpHist'),
  btn: document.getElementById('btnGo'),
  auto: document.getElementById('autoplay'),
};

const history = [];
function paintHistory() {
  el.hist.innerHTML = history.slice(-14).map((h) =>
    `<span class="${h.cashed ? 'hi' : 'lo'}">${h.m.toFixed(2)}×</span>`).join('');
}

function paintBowl(m) {
  const p = Math.min(1, (m - 1) / (HARD_CAP - 1));
  el.water.style.height = (18 + p * 70) + '%';
  el.turd.style.bottom = (12 + p * 58) + '%';
  el.mult.textContent = m.toFixed(2) + '×';
  el.mult.classList.toggle('danger', m >= 2);
}

function resetBowl() {
  el.bowl.classList.remove('flushing');
  el.mult.classList.remove('dead', 'danger');
  paintBowl(1);
  el.lbl.textContent = 'press the button';
  el.mult.textContent = '1.00×';
}
resetBowl();

/* ---------------- the round ---------------- */

let state = 'idle';        // idle | running | ending
let r = null;
let raf = 0;
let gurgleAt = 0;
let crashAt = 0;
let t0 = 0;

/** Where would it crash on its own, if you never clicked? */
function crashPointFor(res) {
  if (res.payout > 0) return HARD_CAP;                    // let them ride, then charge "fees"
  if (res.nearMiss) return rig.range(2.6, HARD_CAP);      // wait for the click; this is the backstop
  return rig.range(1.02, 1.38);                           // a quick, unceremonious flush
}

function start() {
  if (state !== 'idle') return;
  r = round.begin(GAME);
  if (!r) return;

  state = 'running';
  crashAt = crashPointFor(r);
  t0 = performance.now();
  gurgleAt = 0;
  el.btn.textContent = 'GRAB IT 💰';
  el.btn.classList.add('btn--danger');
  el.lbl.textContent = 'going up — grab it whenever you like';
  console.log(`[flushpoint] payout=${r.payout} backstop crash=${crashAt.toFixed(2)}`);

  const loop = (now) => {
    if (state !== 'running') return;
    const t = (now - t0) / 1000;
    const m = Math.exp(GROWTH * t);

    if (m >= crashAt) return flush(crashAt, false);

    paintBowl(m);
    if (now - gurgleAt > 340) { gurgleAt = now; sfx.gurgle(); }

    // autoplay cashes out at 2.00x
    if (el.auto.checked && m >= 2) return cashOut(m);

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

function currentMult() {
  return Math.exp(GROWTH * ((performance.now() - t0) / 1000));
}

/** The player clicked CASH OUT. */
function onCashClick() {
  if (state !== 'running') return;
  const m = currentMult();

  if (r.payout === 0) {
    /* THE SIGNATURE MOVE.
       The round was already decided as a loss, so the flush is
       retro-fitted to land exactly 0.01 beneath the multiplier you
       clicked at. You did not mistime it. There was no timing. */
    const at = Math.max(1.01, m - 0.01);
    console.log(`[flushpoint] click at ${m.toFixed(2)} → retro-flush at ${at.toFixed(2)}`);
    return flush(at, true);
  }
  cashOut(m);
}

async function flush(at, wasClicked) {
  if (state === 'ending') return;
  state = 'ending';
  cancelAnimationFrame(raf);

  paintBowl(at);
  el.mult.textContent = at.toFixed(2) + '×';
  el.mult.classList.add('dead');
  el.bowl.classList.add('flushing');
  el.lbl.textContent = wasClicked ? 'flushed just under your click' : 'flushed';
  sfx.flush();

  history.push({ m: at, cashed: false });
  paintHistory();

  if (wasClicked) {
    fanfare.toast(
      `<b>FLUSHED AT ${at.toFixed(2)}×</b> — and you clicked at ${(at + 0.01).toFixed(2)}×. ` +
      `So close! That is the whole trick. It was never going to be anything else.`, 'loss', 7000);
    round.tease();
  }

  // make sure the settlement matches what actually happened on screen
  if (r.payout > 0) {
    console.log('[flushpoint] rode past the cap without cashing out — forfeit');
    Object.assign(r, { payout: 0, outcome: 'nothing', tier: null, ratio: 0, multiplierShown: 0, isRealWin: false });
    fanfare.toast('You never grabbed it. The toilet does not wait. You get nothing.', 'loss', 6000);
  }

  await new Promise((res) => setTimeout(res, 1000));
  await round.finish(r);
  finishUp();
}

async function cashOut(m) {
  if (state === 'ending') return;
  state = 'ending';
  cancelAnimationFrame(raf);

  paintBowl(m);
  el.lbl.textContent = 'you got it';
  sfx.coins(14);
  history.push({ m, cashed: true });
  paintHistory();

  // the fee. Itemised, because that's funnier than hiding it.
  const expected = r.bet * m;
  const fee = expected - r.payout;
  if (fee > 0.02) {
    fanfare.toast(
      `You grabbed it at <b>${m.toFixed(2)}×</b>. You bet ${r.bet.toFixed(2)}, so that is ` +
      `${expected.toFixed(2)} 💩.<br>We gave you <b>${r.payout.toFixed(2)} 💩</b>. ` +
      `We kept <b>${((fee / expected) * 100).toFixed(1)}%</b> as a fee. Totally normal.`,
      'info', 8000);
  }

  await round.finish(r);
  finishUp();
}

function finishUp() {
  state = 'idle';
  el.btn.textContent = 'START 🚽';
  el.btn.classList.remove('btn--danger');
  setTimeout(resetBowl, 600);

  if (el.auto.checked && !bank.isBust()) setTimeout(start, 1200);
}

el.btn.addEventListener('click', () => {
  if (state === 'idle') start();
  else if (state === 'running') onCashClick();
});

el.auto.addEventListener('change', () => {
  if (el.auto.checked) {
    fanfare.toast('The robot will grab it at 2.00× for you. It only works on goes that were going to pay anyway.', 'info', 6000);
    if (state === 'idle') start();
  }
});

window.addEventListener('sd:broke', () => { el.auto.checked = false; });

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    el.btn.click();
  }
});

paintHistory();
console.log('[flushpoint] ready');
