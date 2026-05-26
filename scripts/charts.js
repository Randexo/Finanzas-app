// ─────────────────────────────────────────────────────────────
// charts.js — Responsabilidad: visualizaciones con Chart.js
// Soporta periodos: diario, semanal, mensual, anual (max 5 años)
// ─────────────────────────────────────────────────────────────

let currentPeriod = 'mensual';
let chartLine   = null;
let chartDonut  = null;
let chartBar    = null;

function setPeriod(period) {
  currentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.className = 'period-btn' + (btn.textContent.toLowerCase().includes(period.slice(0,3)) ? ' active' : '');
  });
  // Mapear label a periodo
  const map = { diario:'Diario', semanal:'Semanal', mensual:'Mensual', anual:'Anual' };
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.className = 'period-btn' + (btn.getAttribute('onclick').includes(period) ? ' active' : '');
  });
  renderCharts();
}

function renderCharts() {
  const view = document.getElementById('view-graficas');
  if (!view || view.hidden) return;

  switch (currentPeriod) {
    case 'diario':   renderDailyCharts();   break;
    case 'semanal':  renderWeeklyCharts();  break;
    case 'mensual':  renderMonthlyCharts(); break;
    case 'anual':    renderAnnualCharts();  break;
  }
}

// ── Periodo: DIARIO (dias del mes seleccionado) ───────────────

function renderDailyCharts() {
  const key    = monthKey();
  const [y, m] = key.split('-').map(Number);
  const days   = new Date(y, m, 0).getDate();
  const labels = Array.from({ length: days }, (_, i) => `${i+1}`);

  const dataByDay = labels.map((_, i) => {
    const d = String(i+1).padStart(2,'0');
    const dateStr = `${key}-${d}`;
    return state.expenses.filter(e => e.date === dateStr && !state.categories.find(c=>c.id===e.catId)?.isSavings)
      .reduce((s,e) => s + e.amount, 0);
  });

  _renderLine(labels, dataByDay, 'Gasto diario');
  _renderDonut(key);
  _renderBar();
}

// ── Periodo: SEMANAL (ultimas 8 semanas) ─────────────────────

function renderWeeklyCharts() {
  const weeks  = [];
  const totals = [];
  const now    = new Date();

  for (let i = 7; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - i * 7 - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const label = `${start.getDate()}/${start.getMonth()+1}`;
    weeks.push(label);

    const startStr = start.toISOString().slice(0,10);
    const endStr   = end.toISOString().slice(0,10);
    const total    = state.expenses
      .filter(e => e.date >= startStr && e.date <= endStr && !state.categories.find(c=>c.id===e.catId)?.isSavings)
      .reduce((s,e) => s + e.amount, 0);
    totals.push(total);
  }

  _renderLine(weeks, totals, 'Gasto semanal');
  _renderDonut(monthKey());
  _renderBar();
}

// ── Periodo: MENSUAL (ultimos 12 meses) ──────────────────────

function renderMonthlyCharts() {
  const labels = [];
  const totals = [];
  const now    = new Date();
  const mNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    labels.push(mNames[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2));
    const total = state.expenses
      .filter(e => e.date.startsWith(k) && !state.categories.find(c=>c.id===e.catId)?.isSavings)
      .reduce((s,e) => s + e.amount, 0);
    totals.push(total);
  }

  _renderLine(labels, totals, 'Gasto mensual');
  _renderDonut(monthKey());
  _renderBar();
}

// ── Periodo: ANUAL (ultimos 5 años) ──────────────────────────

function renderAnnualCharts() {
  const labels = [];
  const totals = [];
  const curYear = new Date().getFullYear();

  for (let y = curYear - 4; y <= curYear; y++) {
    labels.push(String(y));
    const total = state.expenses
      .filter(e => e.date.startsWith(String(y)) && !state.categories.find(c=>c.id===e.catId)?.isSavings)
      .reduce((s,e) => s + e.amount, 0);
    totals.push(total);
  }

  _renderLine(labels, totals, 'Gasto anual');
  _renderDonut(monthKey());
  _renderBar();
}

// ── Renders internos ──────────────────────────────────────────

function _renderLine(labels, data, label) {
  const ctx = document.getElementById('chart-line');
  if (!ctx) return;
  if (chartLine) chartLine.destroy();
  chartLine = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: '#C4956A',
        backgroundColor: 'rgba(196,149,106,0.1)',
        borderWidth: 2,
        pointRadius: 3,
        fill: true,
        tension: 0.3
      }]
    },
    options: _lineOpts()
  });
}

function _renderDonut(key) {
  const ctx = document.getElementById('chart-donut');
  if (!ctx) return;
  if (chartDonut) chartDonut.destroy();

  const cats   = state.categories.filter(c => !c.isSavings);
  const values = cats.map(c =>
    state.expenses.filter(e => e.catId === c.id && e.date.startsWith(key)).reduce((s,e) => s+e.amount, 0)
  );

  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   cats.map(c => c.name),
      datasets: [{ data: values, backgroundColor: cats.map(c => c.color), borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { family: 'Inter', size: 11 }, boxWidth: 12 } } }
    }
  });
}

function _renderBar() {
  const ctx = document.getElementById('chart-bar');
  if (!ctx) return;
  if (chartBar) chartBar.destroy();

  const labels   = state.categories.map(c => c.name);
  const budgets  = state.categories.map(c => c.budget);
  const reals    = state.categories.map(c => realFor(c.id));

  chartBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Presupuestado', data: budgets, backgroundColor: 'rgba(224,216,208,0.8)', borderRadius: 4 },
        { label: 'Gastado',       data: reals,   backgroundColor: state.categories.map(c => c.color + 'CC'), borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { family: 'Inter', size: 11 } } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#F0EAE3' }, ticks: { callback: v => '$'+v.toLocaleString() } } }
    }
  });
}

function _lineOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } },
      y: { grid: { color: '#F0EAE3' }, ticks: { callback: v => '$'+v.toLocaleString(), font: { family: 'Inter', size: 10 } } }
    }
  };
}
