// views.js — English version
// Responsibility: navigation between views and
// initial page setup on load.
// This script is loaded LAST so all others are
// already available when init runs.

const VIEWS = {
  presupuesto: { h1: 'Personal Budget',    sub: 'Monthly plan · define your categories and amounts' },
  seguimiento: { h1: 'Expense Tracker',    sub: 'Monthly transactions · connect Telegram to log on the go' },
  graficas:    { h1: 'Charts',             sub: 'Daily, weekly, monthly, and annual visualizations' },
  exportar:    { h1: 'Export History',     sub: 'Download your data in CSV format' },
};

function showView(view) {
  Object.keys(VIEWS).forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.hidden = (v !== view);
    const nav = document.getElementById('nav-' + v);
    if (nav) nav.className = 'sidebar-link' + (v === view ? ' active' : '');
  });

  document.getElementById('view-h1').textContent  = VIEWS[view]?.h1  || '';
  document.getElementById('view-sub').textContent = VIEWS[view]?.sub || '';

  if (view === 'graficas') renderCharts();
  recalcAll();
}

// ── Dynamic month selector ────────────────────────────────────

function buildMonthSelector() {
  const sel    = document.getElementById('month-sel');
  const now    = new Date();
  const names  = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const curKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  for (let i = -12; i <= 12; i++) {
    const d   = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const opt = document.createElement('option');
    opt.value    = key;
    opt.textContent = `${names[d.getMonth()]} ${d.getFullYear()}`;
    if (key === curKey) opt.selected = true;
    sel.appendChild(opt);
  }
}

// ── Config lock ───────────────────────────────────────────────

function isLocked() {
  if (location.protocol === 'file:') return false;
  return localStorage.getItem('mf_locked') === '1'
      && !location.search.includes('unlock');
}

function applyLock() {
  if (!isLocked()) return;
  document.body.classList.add('locked');
  const body   = document.getElementById('tg-body');
  const toggle = document.getElementById('tg-toggle');
  const header = document.querySelector('.tg-header');
  if (body)   body.hidden        = true;
  if (toggle) toggle.hidden      = true;
  if (header) header.onclick     = null;
}

function generateInviteLink() {
  const full = JSON.parse(localStorage.getItem('mf_state') || '{}');
  const cfg = {
    sheetsUrl: sheetsUrl,
    token:     tgConfig.token,
    chatId:    tgConfig.chatId,
    geminiKey: tgConfig.claudeKey,
    state:     JSON.stringify({ income: full.income || 0, categories: full.categories || [] })
  };
  const hash = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  const base = 'https://randexo.github.io/Finanzas-app';
  const url  = base + '?invite=' + encodeURIComponent(hash);
  const catCount = state.categories.length;
  navigator.clipboard.writeText(url).then(() => {
    alert(`Link copied.\n\nShare it via WhatsApp. Each person only needs to open it once.\n\n✓ Includes ${catCount} categories (expenses sync from Sheets).`);
  }).catch(() => {
    prompt('Copy this link and share it:', url);
  });
}

// ── Init ──────────────────────────────────────────────────────

(function init() {
  if (location.search.includes('unlock')) {
    localStorage.removeItem('mf_locked');
    history.replaceState(null, '', location.pathname);
  }

  const _inv = new URLSearchParams(location.search).get('invite');
  if (_inv) {
    try {
      const cfg = JSON.parse(decodeURIComponent(escape(atob(_inv))));
      if (cfg.sheetsUrl) localStorage.setItem('mf_sheets_url', cfg.sheetsUrl);
      localStorage.setItem('mf_tg', JSON.stringify({
        token: cfg.token || '', chatId: cfg.chatId || '',
        claudeKey: cfg.geminiKey || '', lastUpdateId: 0
      }));
      if (cfg.state && cfg.state !== '{}') localStorage.setItem('mf_state', cfg.state);
      localStorage.setItem('mf_locked', '1');
      history.replaceState(null, '', location.pathname);
    } catch(e) { console.error('Invalid invite link:', e); }
  }

  buildMonthSelector();
  loadState();

  const incInput = document.getElementById('inp-income');
  if (incInput) incInput.value = state.income;

  loadTgConfig();
  loadSheetsConfig();
  loadCatTranslations();
  applyLock();
  fillCatSelect();
  recalcAll();
  syncFromSheets();
  autoTranslateCategories();
})();
