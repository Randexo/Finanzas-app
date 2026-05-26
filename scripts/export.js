// ─────────────────────────────────────────────────────────────
// export.js — Responsabilidad: descarga de historicos en CSV
// Soporta: mes actual, rango de fechas, todo el historico
// ─────────────────────────────────────────────────────────────

function exportMonth() {
  const key  = monthKey();
  const exps = state.expenses.filter(e => e.date.startsWith(key));
  _downloadCsv(exps, `gastos_${key}.csv`);
}

function exportRange() {
  const from = document.getElementById('exp-from').value;
  const to   = document.getElementById('exp-to').value;
  if (!from || !to) { alert('Selecciona un rango de fechas.'); return; }

  const exps = state.expenses.filter(e => e.date >= from && e.date <= to);
  _downloadCsv(exps, `gastos_${from}_${to}.csv`);
}

function exportAll() {
  _downloadCsv(state.expenses, 'gastos_historico_completo.csv');
}

// ── Construccion y descarga del CSV ──────────────────────────

function _downloadCsv(expenses, filename) {
  if (!expenses.length) { alert('No hay gastos en el periodo seleccionado.'); return; }

  const rows = [
    ['Fecha', 'Categoria', 'Presupuesto categoria', 'Monto', 'Nota', 'Fuente']
  ];

  const sorted = [...expenses].sort((a,b) => a.date.localeCompare(b.date));

  for (const e of sorted) {
    const cat    = state.categories.find(c => c.id === e.catId);
    const nombre = cat ? cat.name    : 'Desconocida';
    const budget = cat ? cat.budget  : 0;
    rows.push([e.date, nombre, budget, e.amount, e.note || '', e.source]);
  }

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const bom = '﻿'; // para que Excel abra bien los acentos
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
