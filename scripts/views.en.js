// views.js — English version
// Responsibility: navigation between views and
// initial page setup on load.
// This script is loaded LAST so all others are
// already available when init runs.

const VIEWS = {
  presupuesto: { h1: 'Personal Budget',    sub: 'Monthly plan · define your categories and amounts' },
  seguimiento: { h1: 'Expense Tracker',    sub: 'Monthly transactions · sync Telegram to log on the go' },
  graficas:    { h1: 'Charts',             sub: 'Daily, weekly, monthly, and annual visualizations' },
  exportar:    { h1: 'Import / Export',    sub: 'Upload a card statement or download your data as CSV' },
  config:      { h1: 'Settings',           sub: 'Connections and family access · admin only' },
};

function showView(view) {
  if (view === 'config' && isLocked()) return;

  Object.keys(VIEWS).forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.hidden = (v !== view);
    const nav = document.getElementById('nav-' + v);
    if (nav) nav.className = 'sidebar-link' + (v === view ? ' active' : '');
  });

  document.getElementById('view-h1').textContent  = VIEWS[view]?.h1  || '';
  document.getElementById('view-sub').textContent = VIEWS[view]?.sub || '';

  if (view === 'graficas') renderCharts();
  if (view === 'config')   updateConfigStatus();
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
}

function generateInviteLink() {
  if (!sheetsUrl) { alert('Set up the Google Sheets URL first.'); return; }
  const hash = btoa(unescape(encodeURIComponent(sheetsUrl)));
  const url  = 'https://randexo.github.io/Finanzas-app?invitacion=' + encodeURIComponent(hash);
  navigator.clipboard.writeText(url).then(() => {
    alert('Link copied.\n\nShare it via WhatsApp. Each person only needs to open it once.');
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

  const _inv = new URLSearchParams(location.search).get('invitacion');
  if (_inv) {
    try {
      const url = decodeURIComponent(escape(atob(_inv)));
      localStorage.clear();
      localStorage.setItem('mf_sheets_url', url);
      localStorage.setItem('mf_locked', '1');
      history.replaceState(null, '', location.pathname);
    } catch(e) { console.error('Invitacion invalida:', e); }
  }

  buildMonthSelector();
  loadState();

  const importMonth = document.getElementById('import-month');
  if (importMonth) importMonth.value = monthKey();

  const incInput = document.getElementById('inp-income');
  if (incInput) incInput.value = state.income;

  loadTgConfig();
  loadSheetsConfig();
  updateConfigStatus();
  loadCatTranslations();
  applyLock();
  fillCatSelect();
  recalcAll();
  syncFromSheets();
  autoTranslateCategories();
})();
