/* ============================================================
   chrome.js — the shared casino furniture.

   Header + balance, the fake live-winners ticker, the eternally
   expiring bonus timer, the cashier that takes no money, the
   cookie banner whose reject button runs away, and a footer of
   entirely fictional licences.

   Every page calls mount() once.
   ============================================================ */

import * as bank from './bank.js';
import * as sfx from './sfx.js';
import * as fanfare from './fanfare.js';
import * as taunt from './taunt.js';
import * as store from './store.js';

/** games/*.html needs to climb one level for shared assets. */
export const BASE = location.pathname.includes('/games/') ? '../' : './';

const NAV = [
  ['Lobby', 'index.html'],
  ['Shit Drop', 'games/drop.html'],
  ['Shit Slots', 'games/slots.html'],
  ['Flushpoint', 'games/flushpoint.html'],
  ['Wheel', 'games/wheel.html'],
];

/* ---------------- ticker ---------------- */

function tickerHTML() {
  const items = [];
  for (let i = 0; i < 14; i++) {
    items.push(`<span>${taunt.fakeWinner()}</span>`);
    if (i % 4 === 3) items.push(`<span class="truth">(${taunt.TRUTHS[i % taunt.TRUTHS.length]})</span>`);
  }
  const half = items.join('');
  return `
    <div class="ticker">
      <div class="ticker__label"><span class="ticker__dot"></span>LIVE WINS</div>
      <div class="ticker__track">${half}${half}</div>
    </div>`;
}

/* ---------------- bonus nag ---------------- */

function startBonusTimer(el) {
  let left = 299;
  const tick = () => {
    left--;
    if (left < 0) {
      left = 299;                                  // it never actually expires
      if (store.once('bonus-reset-seen')) {
        fanfare.toast('Your expiring bonus has been generously extended. It will expire again shortly. Forever.', 'info');
      }
    }
    const m = Math.floor(left / 60);
    const s = String(left % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------------- cashier (takes nothing) ---------------- */

const METHODS = [
  ['🫀', 'Your left kidney', 'Instant. Non-refundable.'],
  ['📺', "Your mum's Netflix password", 'We will change it.'],
  ['🤝', 'A firm handshake', 'Processing fee: 100%.'],
  ['🐕', 'The dog', 'She deserves better anyway.'],
  ['🦷', 'Teeth (any)', 'Minimum 3.'],
  ['💍', "Someone else's wedding ring", 'No questions asked.'],
  ['📄', 'A promise', 'We accept verbal contracts and regret.'],
];

function modal(id, title, bodyHTML, footHTML = '') {
  const m = document.createElement('div');
  m.className = 'modal';
  m.id = id;
  m.innerHTML = `
    <div class="modal__box" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal__hd">
        <h3>${title}</h3>
        <button class="modal__x" data-close aria-label="Close">×</button>
      </div>
      <div class="modal__bd">${bodyHTML}</div>
      ${footHTML ? `<div class="modal__ft">${footHTML}</div>` : ''}
    </div>`;
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('on');
  });
  return m;
}

function buildCashier() {
  const body = `
    <p><b>Top up your balance instantly.</b> Choose a payment method below. We accept
    almost anything, because none of it is real and neither is your balance.</p>
    <ul class="paylist">
      ${METHODS.map((m, i) => `
        <li><button data-pay="${i}">
          <span class="em">${m[0]}</span>
          <span><b>${m[1]}</b><br><span class="dim" style="font-size:11px">${m[2]}</span></span>
        </button></li>`).join('')}
    </ul>
    <p class="fineprint">
      No card fields. No crypto address. No payment of any kind is possible on this website —
      this cashier is part of the joke. Every "credit" is a number in your own browser.
      Whatever you pick below, you get 5 pity credits and a fart.
    </p>`;
  const m = modal('mCashier', '💳 Cashier', body);
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pay]');
    if (!b) return;
    const meth = METHODS[+b.dataset.pay];
    bank.pity();
    sfx.fart(3);
    m.classList.remove('on');
    fanfare.toast(`Payment accepted: <b>${meth[1]}</b>. Balance credited with 5 (five) credits. ${taunt.pityLine()}`, 'info', 7000);
  });
  return m;
}

function buildResponsible() {
  const body = `
    <p><b>Please gamble responsibly.</b></p>
    <p style="font-size:13px">Ha.</p>
    <p>Anyway — here are 5 free credits. Statistically you will give them back within
      ninety seconds, which is the actual business model of every website that has ever
      shown you this message.</p>
    <p class="fineprint">
      Genuinely, though: this site is a parody. If real gambling has stopped being fun for you,
      that feeling is the product working as designed. In the UK, GamCare is on 0808 8020 133,
      and <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware.org</a>
      exists. Elsewhere, your local equivalent does too. That part isn't a joke.
    </p>`;
  const m = modal('mResponsible', '🛟 Responsible Gambling', body,
    '<button class="btn" data-take>Take the 5 credits</button>');
  m.addEventListener('click', (e) => {
    if (!e.target.closest('[data-take]')) return;
    bank.pity();
    sfx.partyHorn();
    m.classList.remove('on');
    fanfare.toast('5 credits deposited. Enjoy your responsible gambling.', 'info');
  });
  return m;
}

function buildFairness() {
  const body = `
    <p><b>Provably Unfair™ Gaming</b></p>
    <p>Our games use a certified pseudo-random number generator, audited by nobody,
      whose output is then <i>ignored</i> in favour of a predetermined result.</p>
    <div class="statlist" style="margin:14px 0">
      <div><span>Advertised RTP</span><span>7.31%</span></div>
      <div><span>Actual RTP</span><span>7.31%</span></div>
      <div><span>Chance a round pays nothing</span><span>~62%</span></div>
      <div><span>Chance a "win" is still a net loss</span><span>~93%</span></div>
      <div><span>Near-misses that were engineered</span><span>all of them</span></div>
      <div><span>House edge</span><span>92.69%</span></div>
    </div>
    <p class="fineprint">This table is accurate. Read <code>js/core/rig.js</code> —
      the source is public. Real operators publish a 96% RTP and never publish the
      near-miss logic, which is the part that keeps you here.</p>`;
  return modal('mFair', '⚖️ Fairness', body);
}

/* ---------------- cookie banner ---------------- */

function buildCookies() {
  const el = document.createElement('div');
  el.id = 'cookies';
  if (bank.s().cookiesAck) el.classList.add('gone');
  el.innerHTML = `
    <h4>🍪 We value your privacy</h4>
    <div>We and 1,847 carefully selected partners store cookies to personalise the
      exact moment you are most likely to lose control. Legitimate interest.</div>
    <div class="row">
      <button class="btn" id="cookieAccept">Accept all</button>
      <button class="btn btn--ghost" id="cookieReject">Reject all</button>
    </div>`;

  const reject = el.querySelector('#cookieReject');
  let dodges = 0;
  const dodge = () => {
    dodges++;
    if (dodges > 7) {   // relent eventually, then betray them
      reject.style.transform = 'none';
      return;
    }
    const x = (Math.random() - 0.5) * 190;
    const y = (Math.random() - 0.5) * 90;
    reject.style.transform = `translate(${x}px, ${y}px)`;
  };
  reject.addEventListener('pointerenter', dodge);
  reject.addEventListener('focus', dodge);
  reject.addEventListener('click', () => {
    store.patch({ cookiesAck: true });
    el.classList.add('gone');
    fanfare.toast('Preferences saved: <b>Accept all</b>. Thank you for rejecting all.', 'info');
    sfx.fart(2);
  });
  el.querySelector('#cookieAccept').addEventListener('click', () => {
    store.patch({ cookiesAck: true });
    el.classList.add('gone');
    sfx.coins(3);
  });
  return el;
}

/* ---------------- header ---------------- */

function headerHTML(active) {
  const nav = NAV.map(([label, href]) => {
    const on = active && href.endsWith(active) ? ' class="on"' : '';
    return `<a href="${BASE}${href}"${on}>${label}</a>`;
  }).join('');

  return `
    <div class="bonusbar">
      <span>🔥 <b>WELCOME BONUS</b> 200% up to 10,000 💩 — expires in</span>
      <span class="bonusbar__t" id="bonusTimer">4:59</span>
      <span class="bonusbar__cta" id="bonusCta">CLAIM NOW</span>
    </div>
    <header class="hdr">
      <div class="hdr__in">
        <a class="logo" href="${BASE}index.html">
          <span class="logo__badge">💩</span>
          <span class="logo__text">
            <span class="logo__name">SHIT DROP</span>
            <span class="logo__tm">You'll never win</span>
          </span>
        </a>
        <nav class="hdr__nav">${nav}</nav>
        <div class="bal">
          <span class="bal__lbl">Balance</span>
          <span class="bal__n" id="balN">0.00</span>
          <span style="font-size:15px">💩</span>
          <button class="btn" id="btnDeposit" style="padding:7px 10px;font-size:10px">Deposit</button>
          <button class="btn btn--ghost btn--dead" id="btnWithdraw"
            style="padding:7px 10px;font-size:10px"
            title="Minimum withdrawal: 1,000,000 💩">Withdraw</button>
          <button class="mutebtn" id="btnMute" title="Mute the farts">🔊</button>
        </div>
      </div>
    </header>`;
}

function footerHTML() {
  const badges = ['eCOGRA — unaudited', 'Curaçao — never heard of her', 'GamStop — blocked us',
    '18+ (we do not check)', 'SSL — probably', 'RNG — decorative'];
  return `
    <footer class="ftr">
      <div class="ftr__in">
        <div class="ftr__logos">${badges.map((b) => `<span class="ftr__logo">${b}</span>`).join('')}</div>
        <div class="ftr__legal">
          <p><b>SHIT DROP</b> is operated by Absolutely Nobody Ltd, registered at an address
          that does not exist, and licensed by no authority in any jurisdiction. Regulated by
          vibes. Curaçao? Never heard of her. 18+ (or younger, we genuinely do not care).
          Gamble irresponsibly.</p>
          <p>All games have a house edge of 92.69%. Winnings cannot be withdrawn, transferred,
          exchanged, enjoyed, or proven. Terms and conditions are made up as we go.
          By reading this you consent to being mocked.
          <a href="#" data-open="mFair">Fairness</a> ·
          <a href="#" data-open="mResponsible">Responsible Gambling</a> ·
          <a href="#" data-open="mCashier">Cashier</a> ·
          <a href="#" id="btnReset">Reset my account</a> ·
          <a href="https://github.com/therezor/shit-drop" target="_blank" rel="noopener">Source</a></p>
        </div>
        <div class="ftr__sat">
          <b>This is satire.</b> No real money, payments, or accounts exist here — the credits
          are a number in your browser's localStorage and the cashier accepts nothing. The odds
          are printed honestly in <code>js/core/rig.js</code>, which is the only difference
          between this site and the real ones.
          <b>If real gambling has stopped being a choice for you:</b>
          <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware.org</a>,
          or GamCare on 0808 8020 133 in the UK.
        </div>
      </div>
    </footer>`;
}

/* ---------------- mount ---------------- */

let mounted = false;

/**
 * Inject the shared chrome. Call once per page.
 * @param {{active?: string}} opts  active = filename to highlight in the nav
 */
export function mount({ active = '' } = {}) {
  if (mounted) return;
  mounted = true;

  sfx.arm();
  fanfare.mount();

  const top = document.createElement('div');
  top.innerHTML = tickerHTML() + headerHTML(active);
  document.body.prepend(top);

  const bottom = document.createElement('div');
  bottom.innerHTML = footerHTML();
  document.body.append(bottom);

  document.body.append(buildCashier(), buildResponsible(), buildFairness(), buildCookies());

  startBonusTimer(document.getElementById('bonusTimer'));

  /* balance */
  const balN = document.getElementById('balN');
  const paint = (delta = 0) => {
    balN.textContent = bank.credits().toFixed(2);
    if (delta) {
      balN.classList.remove('flash-up', 'flash-down');
      void balN.offsetWidth;
      balN.classList.add(delta < 0 ? 'flash-down' : 'flash-up');
    }
  };
  paint();
  bank.on((e) => { if (e.type === 'credits' || e.type === 'reset') paint(e.delta || 0); });

  /* buttons */
  const open = (id) => document.getElementById(id)?.classList.add('on');
  document.getElementById('btnDeposit').addEventListener('click', () => { open('mCashier'); sfx.coins(6); });
  document.getElementById('bonusCta').addEventListener('click', () => open('mCashier'));
  document.getElementById('btnWithdraw').addEventListener('click', () => {
    fanfare.toast(taunt.withdrawLine(), 'loss');
    sfx.trombone();
  });

  const muteBtn = document.getElementById('btnMute');
  const paintMute = () => { muteBtn.textContent = bank.muted() ? '🔇' : '🔊'; };
  paintMute();
  muteBtn.addEventListener('click', () => {
    const m = bank.toggleMute();
    paintMute();
    if (m && store.once('mute-nag')) fanfare.toast(taunt.muteLine(), 'info');
    if (!m) sfx.fart(2);
  });

  document.body.addEventListener('click', (e) => {
    const a = e.target.closest('[data-open]');
    if (a) { e.preventDefault(); open(a.dataset.open); }
    const r = e.target.closest('#btnReset');
    if (r) {
      e.preventDefault();
      bank.reset();
      sfx.flush();
      fanfare.toast('Account wiped. Fresh 1,000 credits. The only winning move, and you will not take it.', 'info');
      setTimeout(() => location.reload(), 1400);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal.on').forEach((m) => m.classList.remove('on'));
  });

  /* broke handling — a player at zero cannot lose any more, so we intervene */
  let brokeShown = false;
  window.addEventListener('sd:broke', () => {
    if (brokeShown) return;
    brokeShown = true;
    setTimeout(() => {
      open('mCashier');
      fanfare.toast(taunt.bustLine(), 'loss', 8000);
      brokeShown = false;
    }, 1500);
  });
}

export default { mount, BASE };
