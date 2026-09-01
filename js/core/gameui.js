/* ============================================================
   gameui.js — the control rail every game shares.

   Bet stepper with nagging, quick-stake chips, live lifetime
   stats, a round log, and the decorative payout table.
   Built here so all four games behave identically.
   ============================================================ */

import * as bank from './bank.js';
import * as fanfare from './fanfare.js';
import * as taunt from './taunt.js';
import * as sfx from './sfx.js';
import * as achievements from './achievements.js';
import { ADVERTISED_RTP } from './rig.js';

const CHIPS = [1, 5, 10, 25, 50, 100, 250, 500];

/**
 * Render the standard rail into `root`.
 * @param {HTMLElement} root
 * @param {{ paytable?: [string,string,boolean?][], extra?: string }} opts
 * @returns {{ setBusy(b:boolean):void, onSpinLock(fn):void }}
 */
export function mountRail(root, { paytable = [], extra = '' } = {}) {
  root.innerHTML = `
    ${extra}
    <div class="panel">
      <div class="panel__hd">Your stake <span class="dim" id="railMax">max 500</span></div>
      <div class="panel__bd rail">
        <div class="field">
          <span class="field__l">Bet amount</span>
          <div class="betrow">
            <button id="betDown" aria-label="Decrease bet">−</button>
            <input id="betInput" type="number" min="1" max="500" step="1" value="10"
                   inputmode="numeric" aria-label="Bet amount">
            <button id="betUp" aria-label="Increase bet">+</button>
          </div>
        </div>
        <div class="chips" id="chips">
          ${CHIPS.map((c) => `<button class="chip" data-chip="${c}">${c}</button>`).join('')}
          <button class="chip" data-chip="max">ALL IN</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">Your session <span class="dim">honest numbers</span></div>
      <div class="panel__bd">
        <div class="statlist">
          <div><span>Rounds played</span><span id="stSpins">0</span></div>
          <div><span>Total staked</span><span id="stWagered">0.00</span></div>
          <div><span>Total returned</span><span id="stReturned">0.00</span></div>
          <div><span>Net</span><span id="stNet">0.00</span></div>
          <div><span>Your actual RTP</span><span id="stRtp">—</span></div>
          <div><span>Loss streak</span><span id="stStreak">0</span></div>
        </div>
      </div>
    </div>

    ${paytable.length ? `
    <div class="panel">
      <div class="panel__hd">Paytable <span class="dim">decorative</span></div>
      <div class="panel__bd paytable">
        ${paytable.map(([sym, val, never]) => `
          <div><span class="sym">${sym}</span><span class="val${never ? ' never' : ''}">${val}</span></div>`).join('')}
        <div style="border:0;padding-top:10px">
          <span class="dim" style="font-size:10.5px">Advertised RTP ${ADVERTISED_RTP}. This table has
          no effect on any outcome.</span>
        </div>
      </div>
    </div>` : ''}

    <div class="panel">
      <div class="panel__hd">Round history</div>
      <div class="log" id="log">
        <div class="log__row"><span class="dim">nothing yet</span><span class="dim">—</span></div>
      </div>
    </div>`;

  /* ---- bet stepper ---- */
  const input = root.querySelector('#betInput');
  const chips = root.querySelectorAll('[data-chip]');

  const paintChips = () => {
    const b = bank.bet();
    chips.forEach((c) => c.classList.toggle('on', +c.dataset.chip === b));
  };
  const paintBet = () => { input.value = bank.bet(); paintChips(); };

  let nagAt = 0;
  const apply = (v, nag = true) => {
    const { dir } = bank.setBet(v);
    paintBet();
    if (nag && dir !== 'same') {
      sfx.tick(dir === 'up' ? 1.3 : 0.7);
      // don't spam: one nag every 2.5s
      if (Date.now() - nagAt > 2500) {
        nagAt = Date.now();
        fanfare.toast(taunt.betNudge(dir), 'info', 3000);
      }
    }
  };

  input.addEventListener('change', () => apply(input.value));
  input.addEventListener('blur', paintBet);
  root.querySelector('#betUp').addEventListener('click', () => apply(bank.bet() + step(bank.bet(), 1)));
  root.querySelector('#betDown').addEventListener('click', () => apply(bank.bet() - step(bank.bet(), -1)));
  chips.forEach((c) => c.addEventListener('click', () => {
    if (c.dataset.chip === 'max') {
      apply(Math.max(bank.MIN_BET, Math.min(bank.MAX_BET, Math.floor(bank.credits()))));
      fanfare.toast('ALL IN. The single most profitable button on this website. For us.', 'info', 4000);
      sfx.airhorn();
    } else apply(c.dataset.chip);
  }));

  function step(v, sign) {
    if (v < 10) return 1;
    if (v < 50) return 5;
    if (v < 100) return 10;
    if (v < 250) return 25;
    return sign > 0 ? 50 : 50;
  }

  /* ---- stats ---- */
  const el = (id) => root.querySelector('#' + id);
  const paintStats = () => {
    const s = bank.stats();
    el('stSpins').textContent = s.spins;
    el('stWagered').textContent = s.wagered.toFixed(2);
    el('stReturned').textContent = s.returned.toFixed(2);
    const net = el('stNet');
    net.textContent = (s.net > 0 ? '+' : '') + s.net.toFixed(2);
    net.style.color = s.net > 0 ? 'var(--toxic)' : s.net < 0 ? 'var(--blood)' : '';
    el('stRtp').textContent = s.spins ? s.rtp.toFixed(2) + '%' : '—';
    el('stStreak').textContent = s.lossStreak;
  };
  paintStats();

  /* ---- log ---- */
  const log = root.querySelector('#log');
  let cleared = false;
  window.addEventListener('sd:round', (e) => {
    if (!cleared) { log.innerHTML = ''; cleared = true; }
    const r = e.detail;
    const row = document.createElement('div');
    row.className = 'log__row';
    row.innerHTML = `
      <span>−${r.bet.toFixed(2)}</span>
      <span class="p${r.payout === 0 ? ' zero' : ''}">
        ${r.payout > 0 ? '+' + r.payout.toFixed(2) : '0.00'}
      </span>
      <span class="${r.net > 0 ? 'p' : 'n'}">${r.net > 0 ? '+' : ''}${r.net.toFixed(2)}</span>`;
    log.appendChild(row);
    while (log.children.length > 40) log.firstElementChild.remove();
    paintStats();
    paintBet();
  });

  bank.on((e) => { if (e.type === 'reset') { paintBet(); paintStats(); } });

  paintBet();
  return { paintStats, paintBet };
}

/** Standard page scaffold bits shared by the four game pages. */
export function gameHeader(root, { em, title, sub }) {
  root.innerHTML = `
    <div class="gtitle">
      <span class="gtitle__em">${em}</span>
      <h1>${title}</h1>
      <div class="gtitle__sub">${sub}</div>
    </div>`;
}

/** Autoplay checkbox markup — named honestly. */
export const AUTOPLAY_HTML = `
  <label class="autorow">
    <input type="checkbox" id="autoplay">
    <span>GIVE UP AND LET US TAKE IT <span class="dim">(autoplay)</span></span>
  </label>`;

export function wireAutoplay(root, spin) {
  const box = root.querySelector('#autoplay');
  if (!box) return { active: () => false };
  let timer = 0;
  const stop = () => { clearTimeout(timer); timer = 0; };
  box.addEventListener('change', () => {
    if (box.checked) {
      fanfare.toast('Autoplay engaged. You have automated your own decline. Efficient.', 'info', 5000);
      loop();
    } else stop();
  });
  function loop() {
    if (!box.checked) return;
    if (bank.isBust()) { box.checked = false; return; }
    Promise.resolve(spin()).finally(() => {
      if (box.checked) timer = setTimeout(loop, 900);
    });
  }
  window.addEventListener('sd:broke', () => { box.checked = false; stop(); });
  return { active: () => box.checked, stop };
}

export { achievements };
export default { mountRail, gameHeader, AUTOPLAY_HTML, wireAutoplay };
