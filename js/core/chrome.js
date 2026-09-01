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

// [long label, href, short label for phones]
const NAV = [
  ['Lobby', 'index.html', 'Lobby'],
  ['Shit Drop', 'games/drop.html', 'Drop'],
  ['Shit Slots', 'games/slots.html', 'Slots'],
  ['Flushpoint', 'games/flushpoint.html', 'Flush'],
  ['Wheel', 'games/wheel.html', 'Wheel'],
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
        fanfare.toast('Good news! Your bonus has been extended. It will run out again very soon. Forever.', 'info');
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
  ['🫀', 'Your left kidney',       2000],
  ['💍', "Someone else's ring",    1000],
  ['🐕', 'The dog',                 500],
  ['🦷', 'Three teeth',             250],
  ['📺', "Your mum's Netflix",      100],
  ['🤝', 'A firm handshake',         10],
  ['📄', 'A promise',                 1],
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
    <p><b>Pick what you want to pay with.</b></p>
    <ul class="paylist">
      ${METHODS.map((m, i) => `
        <li><button data-pay="${i}">
          <span class="em">${m[0]}</span>
          <span class="paylist__what">${m[1]}</span>
          <span class="paylist__amt">+${m[2].toLocaleString('en-US')} 💩</span>
        </button></li>`).join('')}
    </ul>
    <p class="fineprint">There are no card boxes here. You cannot really pay us anything.</p>`;
  const m = modal('mCashier', '💳 Cashier', body);
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pay]');
    if (!b) return;
    const [, what, amount] = METHODS[+b.dataset.pay];
    bank.deposit(amount);
    sfx.coins(Math.min(30, 6 + amount / 100));
    sfx.fart(3);
    m.classList.remove('on');
    fanfare.toast(`Took your <b>${what}</b>. Here is <b>${amount.toLocaleString('en-US')} 💩</b>.`, 'info', 5000);
  });
  return m;
}

function buildResponsible() {
  const body = `
    <p><b>Please gamble responsibly.</b></p>
    <p style="font-size:13px">Ha. Anyway, here are 100 free credits.</p>
    <p class="fineprint">
      The real bit: this site is a joke, the tricks in it are not. If real gambling has stopped
      being fun, that is the machine working, not you being weak. UK: GamCare 0808 8020 133 and
      <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware.org</a>.
    </p>`;
  const m = modal('mResponsible', '🛟 Responsible Gambling', body,
    '<button class="btn" data-take>Take the 100 credits</button>');
  m.addEventListener('click', (e) => {
    if (!e.target.closest('[data-take]')) return;
    bank.deposit(100);
    sfx.partyHorn();
    m.classList.remove('on');
    fanfare.toast('100 credits added. Enjoy your responsible gambling.', 'info');
  });
  return m;
}

function buildFairness() {
  const body = `
    <p style="font-size:17px"><b>No.</b></p>
    <p>Every game is decided before you press the button. Then the pictures move about for a
      few seconds so it feels like a game.</p>
    <div class="statlist" style="margin:14px 0">
      <div><span>You get back</span><span>6.57%</span></div>
      <div><span>We keep</span><span>93.43%</span></div>
      <div><span>Goes that pay nothing</span><span>64 in 100</span></div>
      <div><span>"Wins" that still lose money</span><span>93 in 100</span></div>
      <div><span>Near misses done on purpose</span><span>all of them</span></div>
      <div><span>If you bet 10, you get back</span><span>6.5%</span></div>
      <div><span>If you bet 500, you get back</span><span>3.4%</span></div>
    </div>
    <p class="fineprint">Those numbers are true — run <code>node _test/rtp.mjs</code>. Yes, betting
      more really does make it worse. A real casino says 96% and never mentions any of this.</p>`;
  return modal('mFair', '⚖️ Is this fair?', body);
}

/* ---------------- cookie banner ---------------- */

function buildCookies() {
  const el = document.createElement('div');
  el.id = 'cookies';
  if (bank.s().cookiesAck) el.classList.add('gone');
  el.innerHTML = `
    <h4>🍪 We value your privacy</h4>
    <div>We and 1,847 hand-picked friends save cookies so we can work out the exact moment
      you are most likely to lose control. This is called legitimate interest.</div>
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
    fanfare.toast('Saved! We picked <b>Accept all</b> for you. Thanks for rejecting all.', 'info');
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
  const nav = NAV.map(([label, href, short]) => {
    const on = active && href.endsWith(active) ? ' on' : '';
    return `<a class="navlink${on}" href="${BASE}${href}">` +
           `<span class="nav-long">${label}</span><span class="nav-short">${short}</span></a>`;
  }).join('');

  return `
    <div class="bonusbar">
      <span>🔥 <b>FREE MONEY</b> 200% up to 10,000 💩 — gone in</span>
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
          <span class="bal__lbl">Your money</span>
          <span class="bal__n" id="balN">0.00</span>
          <span class="bal__coin">💩</span>
          <span class="bal__acts">
            <button class="btn" id="btnDeposit">Deposit</button>
            <button class="btn btn--ghost btn--dead" id="btnWithdraw"
              title="You need 1,000,000 💩 to take money out">Take out</button>
            <button class="mutebtn" id="btnMute" title="Mute the farts">🔊</button>
          </span>
        </div>
      </div>
    </header>`;
}

function footerHTML() {
  const badges = ['Checked by nobody', 'Curaçao — never heard of her', 'Banned by GamStop',
    '18+ (we do not check)', 'Padlock icon — for looks', 'Random numbers — ignored'];
  return `
    <footer class="ftr">
      <div class="ftr__in">
        <div class="ftr__logos">${badges.map((b) => `<span class="ftr__logo">${b}</span>`).join('')}</div>
        <div class="ftr__legal">
          <p><b>SHIT DROP</b> is run by Absolutely Nobody Ltd, from an address that does not
          exist, with a licence from nobody at all. We are not checked by anyone. Curaçao?
          Never heard of her. 18+, or younger, we truly do not care. Gamble badly.</p>
          <p>We keep 93.43% of everything. Your winnings cannot be taken out, sent anywhere,
          swapped, spent, or proven to exist. The rules are made up as we go along.
          By reading this you agree to be laughed at.
          <a href="#" data-open="mFair">Is this fair?</a> ·
          <a href="#" data-open="mResponsible">Responsible Gambling</a> ·
          <a href="#" data-open="mCashier">Cashier</a> ·
          <a href="#" id="btnReset">Reset my account</a> ·
          <a href="https://github.com/therezor/shit-drop" target="_blank" rel="noopener">Source</a></p>
        </div>
        <div class="ftr__sat">
          <b>This is a joke website.</b> There is no real money in it. You cannot put money in
          and you cannot take money out. Your credits are a made-up number saved in your own
          browser, and the shop only takes things like your kidney. We print the real odds on
          the screen, which is the only thing that makes this different from a real one.
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
      fanfare.toast('All gone. Here is 1,000 fresh credits. Walking away now is the only way to win, and you will not do it.', 'info');
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
