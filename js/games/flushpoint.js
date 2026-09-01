/* ============================================================
   FLUSHPOINT — the crash game.

   Your 💩 climbs out of the toilet along a line. The higher it
   gets, the more it is worth — and the more water is waiting for
   it. Grab it before the flush, or it slides all the way back
   down the line into the bowl and gets flushed.

   Two things are rigged, and both are shown on screen when they
   happen:

   - If the round was already decided as a loss, the flush is
     retro-fitted to land 0.01 UNDER the multiplier you clicked
     at. Not near it. Under it. Every time.
   - If it was decided as a win, you grab it fine — and then get
     paid a completely different, much smaller number, with the
     "handling fee" itemised.

   The chart is there so the mechanic reads at a glance: the poo
   is the tip of the line, the gridlines show what it is worth,
   the dashed line shows where the robot would grab, and a red
   cross marks where it died.
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
const AUTO_AT = 2;             // where autoplay grabs it

chrome.mount({ active: 'flushpoint.html' });
gameui.gameHeader(document.getElementById('ghead'), {
  em: '🚽', title: 'FLUSHPOINT',
  sub: 'Grab the money before the toilet flushes.',
});

const rail = document.getElementById('rail');
gameui.mountRail(rail, {
  extra: `
    <div class="panel"><div class="panel__bd rail">
      <button class="btn btn--xl" id="btnGo">START 🚽</button>
      <label class="autorow">
        <input type="checkbox" id="autoplay">
        <span>GIVE UP AND LET US TAKE IT <span class="dim">(grabs it at ${AUTO_AT.toFixed(2)}×)</span></span>
      </label>
    </div></div>`,
  paytable: [
    ['Grab it at 2.00×', 'x2', false],
    ['Grab it at 5.00×', 'x5', true],
    ['Too slow', 'nothing', false],
    ['Our handling fee', 'up to 99.9%', false],
  ],
});

const el = {
  mult: document.getElementById('fpMult'),
  hint: document.getElementById('fpHint'),
  hist: document.getElementById('fpHist'),
  btn: document.getElementById('btnGo'),
  auto: document.getElementById('autoplay'),
  cv: document.getElementById('fpCv'),
  loo: document.getElementById('fpLoo'),
  rider: document.getElementById('fpRider'),
  water: document.getElementById('fpWater'),
  swirl: document.getElementById('fpSwirl'),
  flushBtn: document.getElementById('fpBtn'),
};

const HINTS = {
  idle: 'Press START. Your 💩 climbs out of the toilet. Grab it before it falls back in.',
  running: 'Grab it now — it can flush at any moment.',
  grabbed: (m) => `Grabbed at ${m.toFixed(2)}×. It never went back in.`,
  flushed: (at, clicked) => clicked
    ? `Flushed at ${at.toFixed(2)}×. You clicked at ${(at + 0.01).toFixed(2)}×.`
    : `Flushed at ${at.toFixed(2)}×. You never grabbed it.`,
};

/* ---------------- the chart ---------------- */

const ctx = el.cv.getContext('2d');
const CW = el.cv.width, CH = el.cv.height;

(function hidpi() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  el.cv.width = CW * dpr; el.cv.height = CH * dpr;
  el.cv.style.width = '100%';
  el.cv.style.height = 'auto';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
})();

/* The line starts at the toilet's rim. These coordinates and the CSS that
   positions the toilet are two halves of the same number — see .fp__loo. */
const X0 = 105, Y0 = 200, XMAX = 646, YTOP = 26;   // XMAX leaves room for the axis labels

let track = [];                  // [{ t, m }] the climb so far
let view = { tMax: 4, mMax: 2 }; // axes grow as needed
let crash = null;
let grabbed = null;

const xOf = (t) => X0 + Math.min(1, t / view.tMax) * (XMAX - X0);
const yOf = (m) => Y0 - ((m - 1) / (view.mMax - 1)) * (Y0 - YTOP);

/** Put the poo at a point in canvas coordinates. */
function placeRider(cx, cy) {
  el.rider.style.left = (cx / CW * 100) + '%';
  el.rider.style.top = (cy / CH * 100) + '%';
}

function drawChart() {
  ctx.clearRect(0, 0, CW, CH);

  ctx.font = '700 11px ui-monospace, monospace';
  ctx.textBaseline = 'middle';

  // what it is worth, at a glance
  for (const m of [1.5, 2, 3, 4, 5, 8, 10]) {
    if (m > view.mMax) break;
    const y = yOf(m);
    const isAuto = m === AUTO_AT;
    ctx.strokeStyle = isAuto ? '#f5c51855' : '#ffffff10';
    ctx.setLineDash(isAuto ? [5, 4] : []);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(XMAX, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isAuto ? '#a5840f' : '#54675c';
    ctx.textAlign = 'left';
    ctx.fillText(m.toFixed(m < 10 ? 1 : 0) + '×', XMAX + 4, y);
  }
  if (el.auto.checked && AUTO_AT <= view.mMax) {
    ctx.fillStyle = '#a5840f';
    ctx.textAlign = 'left';
    ctx.fillText('robot grabs here', X0 + 6, yOf(AUTO_AT) - 10);
  }

  if (track.length < 2) return;

  const dead = !!crash;
  const col = dead ? '#ff3b30' : grabbed ? '#39ff88' : '#ffd23f';

  // filled area under the climb
  const g = ctx.createLinearGradient(0, YTOP, 0, Y0);
  g.addColorStop(0, dead ? '#ff3b3040' : grabbed ? '#39ff8840' : '#ffd23f38');
  g.addColorStop(1, '#00000000');
  ctx.beginPath();
  ctx.moveTo(xOf(track[0].t), yOf(track[0].m));
  for (const pt of track) ctx.lineTo(xOf(pt.t), yOf(pt.m));
  ctx.lineTo(xOf(track[track.length - 1].t), Y0);
  ctx.lineTo(xOf(track[0].t), Y0);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();

  // the line
  ctx.beginPath();
  ctx.moveTo(xOf(track[0].t), yOf(track[0].m));
  for (const pt of track) ctx.lineTo(xOf(pt.t), yOf(pt.m));
  ctx.strokeStyle = col;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.shadowColor = col; ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (dead) {
    const last = track[track.length - 1];
    const tx = xOf(last.t), ty = yOf(last.m);
    ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tx - 10, ty - 10); ctx.lineTo(tx + 10, ty + 10);
    ctx.moveTo(tx + 10, ty - 10); ctx.lineTo(tx - 10, ty + 10);
    ctx.stroke();
    ctx.fillStyle = '#ff8a82';
    ctx.font = '800 13px ui-monospace, monospace';
    ctx.textAlign = tx > CW * 0.7 ? 'right' : 'left';
    ctx.fillText(`FLUSHED ${crash.m.toFixed(2)}×`, tx + (tx > CW * 0.7 ? -16 : 16), ty - 16);
  }
}

/* ---------------- the toilet ---------------- */

/** Top-down into the bowl: filling up means the water rises towards you. */
function paintToilet(m) {
  const p = Math.min(1, (m - 1) / (HARD_CAP - 1));
  el.water.setAttribute('rx', (18 + p * 30).toFixed(1));
  el.water.setAttribute('ry', (7 + p * 12).toFixed(1));
  el.water.setAttribute('cy', (100 - p * 4).toFixed(1));
  // the higher you climb, the more the cistern wants to go off
  el.loo.classList.toggle('fp__loo--tense', m >= 1.7);
  el.loo.classList.toggle('fp__loo--panic', m >= 2.6);
}

function resetToilet() {
  paintToilet(1);
  el.swirl.setAttribute('opacity', '0');
  el.flushBtn.setAttribute('cy', '7');
  el.loo.classList.remove('fp__loo--tense', 'fp__loo--panic');
  el.rider.className = 'fp__rider';
  el.rider.style.opacity = '1';
  el.rider.style.transform = 'translate(-50%,-50%)';
  placeRider(X0, Y0);
}

/** It slides all the way back down its own line and into the bowl. */
function slideBackIn() {
  const n = track.length;
  return new Promise((done) => {
    const t0 = performance.now();
    const DUR = 420;
    const step = (now) => {
      const q = Math.min(1, (now - t0) / DUR);
      const i = Math.max(0, Math.round((1 - q) * (n - 1)));
      const pt = track[i];
      placeRider(xOf(pt.t), yOf(pt.m));
      el.rider.style.transform = `translate(-50%,-50%) rotate(${(q * 420).toFixed(0)}deg)`;
      q < 1 ? requestAnimationFrame(step) : done();
    };
    requestAnimationFrame(step);
  });
}

/** Handle down, three turns round the bowl, gone. */
function flushAnimation() {
  el.flushBtn.setAttribute('cy', '10');
  const t0 = performance.now();
  const DUR = 1000;
  const step = (now) => {
    const q = Math.min(1, (now - t0) / DUR);
    const a = q * Math.PI * 6;
    const rad = 26 * (1 - q);
    // swirl in canvas coords, around the bowl rim
    placeRider(X0 + Math.cos(a) * rad * 1.6, Y0 + Math.sin(a) * rad * 0.7);
    el.rider.style.transform =
      `translate(-50%,-50%) rotate(${(a * 57).toFixed(0)}deg) scale(${Math.max(0.05, 1 - q).toFixed(3)})`;
    el.rider.style.opacity = (1 - q * 0.95).toFixed(2);
    el.swirl.setAttribute('opacity', (Math.sin(q * Math.PI) * 0.9).toFixed(2));
    el.swirl.setAttribute('transform', `rotate(${(a * 40).toFixed(0)} 75 98)`);
    el.water.setAttribute('rx', (48 * (1 - q) + 5).toFixed(1));
    el.water.setAttribute('ry', (19 * (1 - q) + 2).toFixed(1));
    if (q < 1) requestAnimationFrame(step);
    else { el.swirl.setAttribute('opacity', '0'); el.rider.style.opacity = '0'; }
  };
  requestAnimationFrame(step);
}

/** Grabbed: it pops off the line, safe, and stays there. */
function grabAnimation() {
  el.rider.classList.add('fp__rider--safe');
  setTimeout(() => el.rider.classList.remove('fp__rider--safe'), 700);
}

/* ---------------- history ---------------- */

const history = [];
function paintHistory() {
  el.hist.innerHTML = history.slice(-12).map((h) =>
    `<span class="${h.cashed ? 'hi' : 'lo'}">${h.m.toFixed(2)}×</span>`).join('');
}

/* ---------------- the round ---------------- */

let state = 'idle';        // idle | running | ending
let r = null;
let raf = 0;
let gurgleAt = 0;
let crashAt = 0;
let t0 = 0;

function reset() {
  state = 'idle';
  track = [{ t: 0, m: 1 }];
  crash = null;
  grabbed = null;
  view = { tMax: 4, mMax: 2 };
  el.mult.textContent = '1.00×';
  el.mult.className = 'fp__mult';
  resetToilet();
  drawChart();
}
reset();

/** Where it would flush if you never clicked. */
function crashPointFor(res) {
  if (res.payout > 0) return HARD_CAP;                    // let them ride, then charge "fees"
  if (res.nearMiss) return rig.range(2.6, HARD_CAP);      // wait for the click; this is the backstop
  return rig.range(1.02, 1.38);                           // a quick, unceremonious flush
}

function start() {
  if (state !== 'idle') return;
  r = round.begin(GAME);
  if (!r) return;

  reset();
  state = 'running';
  track = [{ t: 0, m: 1 }];
  crashAt = crashPointFor(r);
  t0 = performance.now();
  gurgleAt = 0;
  el.btn.textContent = 'GRAB IT 💰';
  el.btn.classList.add('btn--danger');
  el.hint.textContent = HINTS.running;
  console.log(`[flushpoint] payout=${r.payout} backstop crash=${crashAt.toFixed(2)}`);

  const loop = (now) => {
    if (state !== 'running') return;
    const t = (now - t0) / 1000;
    const m = Math.exp(GROWTH * t);

    if (m >= crashAt) return flush(crashAt, false);

    track.push({ t, m });
    if (t > view.tMax * 0.92) view.tMax = t * 1.35;
    if (m > view.mMax * 0.9) view.mMax = m * 1.25;

    el.mult.textContent = m.toFixed(2) + '×';
    el.mult.classList.toggle('danger', m >= 2);
    paintToilet(m);
    drawChart();
    placeRider(xOf(t), yOf(m));       // the poo IS the tip of the line

    if (now - gurgleAt > 340) { gurgleAt = now; sfx.gurgle(); }
    if (el.auto.checked && m >= AUTO_AT) return cashOut(m);

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

const currentMult = () => Math.exp(GROWTH * ((performance.now() - t0) / 1000));

/** You clicked GRAB IT. */
function onGrab() {
  if (state !== 'running') return;
  const m = currentMult();

  if (r.payout === 0) {
    /* THE SIGNATURE MOVE. The round was already a loss, so the flush is
       retro-fitted to 0.01 beneath the multiplier you clicked at. You did
       not mistime it. There was no timing. */
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

  crash = { m: at };
  track.push({ t: track.length ? track[track.length - 1].t : 0, m: at });
  if (at > view.mMax * 0.9) view.mMax = at * 1.15;
  el.mult.textContent = at.toFixed(2) + '×';
  el.mult.className = 'fp__mult dead';
  el.hint.textContent = HINTS.flushed(at, wasClicked);
  paintToilet(at);
  drawChart();

  history.push({ m: at, cashed: false });
  paintHistory();

  // down the line, into the bowl, gone
  sfx.thud();
  await slideBackIn();
  sfx.flush();
  flushAnimation();

  if (wasClicked) {
    fanfare.toast(
      `<b>FLUSHED AT ${at.toFixed(2)}×</b> — you clicked at ${(at + 0.01).toFixed(2)}×. ` +
      `It always flushes just under you.`, 'loss', 6500);
    round.tease();
  }

  // keep the settlement honest with what the screen just showed
  if (r.payout > 0) {
    console.log('[flushpoint] rode past the cap without grabbing it — forfeit');
    Object.assign(r, { payout: 0, outcome: 'nothing', tier: null, ratio: 0, multiplierShown: 0, isRealWin: false });
  }

  await new Promise((res) => setTimeout(res, 1150));
  await round.finish(r);
  finishUp();
}

async function cashOut(m) {
  if (state === 'ending') return;
  state = 'ending';
  cancelAnimationFrame(raf);

  grabbed = { m };
  el.mult.textContent = m.toFixed(2) + '×';
  el.mult.className = 'fp__mult';
  el.hint.textContent = HINTS.grabbed(m);
  drawChart();
  grabAnimation();
  sfx.coins(14);
  history.push({ m, cashed: true });
  paintHistory();

  // the fee, itemised, because that is funnier than hiding it
  const expected = r.bet * m;
  const fee = expected - r.payout;
  if (fee > 0.02) {
    fanfare.toast(
      `${m.toFixed(2)}× of ${r.bet.toFixed(2)} is ${expected.toFixed(2)} 💩. ` +
      `You get <b>${r.payout.toFixed(2)} 💩</b>. Fee: <b>${((fee / expected) * 100).toFixed(1)}%</b>.`,
      'info', 7000);
  }

  await round.finish(r);
  finishUp();
}

function finishUp() {
  state = 'idle';
  el.btn.textContent = 'START 🚽';
  el.btn.classList.remove('btn--danger');
  setTimeout(() => {
    if (state === 'idle') { reset(); el.hint.textContent = HINTS.idle; }
  }, 900);

  if (el.auto.checked && !bank.isBust()) setTimeout(start, 1400);
}

el.btn.addEventListener('click', () => {
  if (state === 'idle') start();
  else if (state === 'running') onGrab();
});

el.auto.addEventListener('change', () => {
  drawChart();
  if (el.auto.checked) {
    fanfare.toast(`The robot grabs it at ${AUTO_AT.toFixed(2)}×. Only on goes that were going to pay anyway.`, 'info', 5000);
    if (state === 'idle') start();
  }
});

window.addEventListener('sd:broke', () => { el.auto.checked = false; });
window.addEventListener('resize', () => { drawChart(); if (state !== 'running') placeRider(X0, Y0); });

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); el.btn.click(); }
});

paintHistory();
console.log('[flushpoint] ready');
