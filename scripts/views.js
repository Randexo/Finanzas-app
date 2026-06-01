// ─────────────────────────────────────────────────────────────
// views.js — Responsabilidad: navegacion entre vistas y
// configuracion inicial de la pagina al cargar
// Este script se carga de ULTIMO para que todos los demas
// ya esten disponibles cuando se ejecute el init.
// ─────────────────────────────────────────────────────────────

const VIEWS = {
  presupuesto: { h1: 'Presupuesto Personal',    sub: 'Plan mensual · define tus categorias y montos' },
  seguimiento: { h1: 'Seguimiento de Gastos',   sub: 'Transacciones del mes · conecta Telegram para registrar al vuelo' },
  graficas:    { h1: 'Graficas',                sub: 'Visualizaciones diarias, semanales, mensuales y anuales' },
  exportar:    { h1: 'Exportar Historico',      sub: 'Descarga tus datos en formato CSV' },
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

// ── Selector de mes dinámico ──────────────────────────────────

function buildMonthSelector() {
  const sel    = document.getElementById('month-sel');
  const now    = new Date();
  const names  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const curKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  // 12 meses atrás hasta 12 meses adelante
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

// ── Bloqueo de configuración ──────────────────────────────────

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
  const saved = JSON.parse(localStorage.getItem('mf_state') || '{}');
  const inner = saved.state || {};
  const cfg = {
    sheetsUrl: sheetsUrl,
    token:     tgConfig.token,
    chatId:    tgConfig.chatId,
    geminiKey: tgConfig.claudeKey,
    state:     JSON.stringify({
      state:     { income: inner.income || 0, categories: inner.categories || [], expenses: [] },
      nextCatId: saved.nextCatId || 1,
      nextExpId: 1
    })
  };
  const hash = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  const base = 'https://randexo.github.io/Finanzas-app';
  const url  = base + '?invite=' + encodeURIComponent(hash);
  const catCount = state.categories.length;
  navigator.clipboard.writeText(url).then(() => {
    alert(`Link copiado.\n\nCompartelo por WhatsApp. Cada persona solo necesita abrirlo una vez.\n\n✓ Incluye ${catCount} categorías (los gastos se sincronizan desde Sheets).`);
  }).catch(() => {
    prompt('Copia este link y compartelo:', url);
  });
}

// ── Init ──────────────────────────────────────────────────────

(function init() {
  if (location.search.includes('unlock')) {
    localStorage.removeItem('mf_locked');
    history.replaceState(null, '', location.pathname);
  }

  // Procesar link de invitación
  const _inv = new URLSearchParams(location.search).get('invite');
  if (_inv) {
    try {
      const cfg = JSON.parse(decodeURIComponent(escape(atob(_inv))));
      localStorage.clear();
      if (cfg.sheetsUrl) localStorage.setItem('mf_sheets_url', cfg.sheetsUrl);
      localStorage.setItem('mf_tg', JSON.stringify({
        token: cfg.token || '', chatId: cfg.chatId || '',
        claudeKey: cfg.geminiKey || '', lastUpdateId: 0
      }));
      if (cfg.state && cfg.state !== '{}') localStorage.setItem('mf_state', cfg.state);
      localStorage.setItem('mf_locked', '1');
      history.replaceState(null, '', location.pathname);
    } catch(e) { console.error('Invite link invalido:', e); }
  }

  buildMonthSelector();
  loadState();

  const incInput = document.getElementById('inp-income');
  if (incInput) incInput.value = state.income;

  loadTgConfig();
  loadSheetsConfig();
  applyLock();
  fillCatSelect();
  recalcAll();
  syncFromSheets();
})();
