// ─────────────────────────────────────────────────────────────
// state.js — Responsabilidad: datos globales y persistencia
// Lee y escribe en localStorage. Todos los demas scripts
// acceden a `state` y llaman a saveState() despues de cambios.
// ─────────────────────────────────────────────────────────────

const COLORS = ['#C4956A','#5BAD8F','#6A9EC4','#A06AC4','#C46A6A','#6AC4B8','#C4B46A','#8A8A8A'];

let state = {
  income: 5000,
  categories: [
    { id:1, name:'Vivienda',        budget:1500, color:COLORS[0], isSavings:false },
    { id:2, name:'Alimentacion',    budget:600,  color:COLORS[1], isSavings:false },
    { id:3, name:'Transporte',      budget:200,  color:COLORS[2], isSavings:false },
    { id:4, name:'Entretenimiento', budget:200,  color:COLORS[3], isSavings:false },
    { id:5, name:'Salud',           budget:150,  color:COLORS[4], isSavings:false },
    { id:6, name:'Ahorro',          budget:500,  color:COLORS[5], isSavings:true  },
    { id:7, name:'Otros',           budget:150,  color:COLORS[6], isSavings:false },
  ],
  expenses: []
  // expenses[i] = { id, catId, amount, note, date (YYYY-MM-DD), source ('manual'|'telegram') }
};

let nextCatId = 8;
let nextExpId = 1;

function saveState() {
  localStorage.setItem('mf_state', JSON.stringify({ state, nextCatId, nextExpId }));
  if (typeof scheduleConfigSync === 'function') scheduleConfigSync();
}

function loadState() {
  try {
    const raw = localStorage.getItem('mf_state');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state      = parsed.state;
    nextCatId  = parsed.nextCatId;
    nextExpId  = parsed.nextExpId;
  } catch(e) {
    console.warn('No se pudo cargar el estado guardado:', e);
  }
}

// ── Utilidades compartidas ────────────────────────────────────

function monthKey() {
  return document.getElementById('month-sel').value; // "2026-05"
}

function monthExpenses() {
  const k = monthKey();
  return state.expenses.filter(e => e.date.startsWith(k));
}

function realFor(catId) {
  return monthExpenses()
    .filter(e => e.catId === catId)
    .reduce((sum, e) => sum + e.amount, 0);
}

function fmt(n) {
  return '$' + Math.round(n).toLocaleString();
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function statusFor(cat, real) {
  const plan = cat.budget;
  if (!plan && !real) return 'vacio';
  if (!plan) return cat.isSavings ? 'verde' : (real > 0 ? 'rojo' : 'vacio');
  const pct = real / plan;
  if (cat.isSavings) return pct >= 1 ? 'verde' : pct >= 0.8 ? 'naranja' : 'rojo';
  return pct <= 1 ? 'verde' : pct <= 1.15 ? 'naranja' : 'rojo';
}

function statusLabel(s) {
  return { verde:'En rango', naranja:'Alerta', rojo:'Excedido', vacio:'Sin datos' }[s];
}

function diffFor(cat, real) {
  if (!cat.budget && !real) return { txt:'–', cls:'neutral' };
  const d   = cat.isSavings ? (real - cat.budget) : (cat.budget - real);
  const s   = statusFor(cat, real);
  const cls = s==='verde'?'good': s==='naranja'?'warning': s==='rojo'?'bad':'neutral';
  return { txt: (d >= 0 ? '+' : '') + '$' + Math.abs(Math.round(d)).toLocaleString(), cls };
}

// ── Orquestador principal (llaman todos los scripts) ──────────

function recalcAll() {
  renderBudgetTable();
  renderProgressBars('p-bars');
  updateSummaryCards();
  renderExpenses();
  renderProgressBars('sg-bars');
  renderCharts();
}
