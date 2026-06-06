// ─────────────────────────────────────────────────────────────
// views.js — Responsabilidad: navegacion entre vistas y
// configuracion inicial de la pagina al cargar
// Este script se carga de ULTIMO para que todos los demas
// ya esten disponibles cuando se ejecute el init.
// ─────────────────────────────────────────────────────────────

const VIEWS = {
  presupuesto: { h1: 'Presupuesto Personal',    sub: 'Plan mensual · define tus categorias y montos' },
  seguimiento: { h1: 'Seguimiento de Gastos',   sub: 'Transacciones del mes · sincroniza Telegram para registrar al vuelo' },
  graficas:    { h1: 'Graficas',                sub: 'Visualizaciones diarias, semanales, mensuales y anuales' },
  exportar:    { h1: 'Importar / Exportar',     sub: 'Sube un reporte de tarjeta o descarga tus datos en CSV' },
  config:      { h1: 'Configuracion',           sub: 'Conexiones y acceso para la familia · solo visible para el admin' },
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
}

function generateInviteLink() {
  if (!sheetsUrl) { alert('Configura primero la URL de Google Sheets.'); return; }
  const hash = btoa(unescape(encodeURIComponent(sheetsUrl)));
  const url  = 'https://randexo.github.io/Finanzas-app?invitacion=' + encodeURIComponent(hash);
  navigator.clipboard.writeText(url).then(() => {
    alert('Link copiado.\n\nCompartelo por WhatsApp. Cada persona solo necesita abrirlo una vez.');
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
  applyLock();
  fillCatSelect();
  recalcAll();
  syncFromSheets();
})();
