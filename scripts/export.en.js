// export.js — English version
// Responsibility: CSV history downloads
// Supports: current month, date range, full history

function exportMonth() {
  const key  = monthKey();
  const exps = state.expenses.filter(e => e.date.startsWith(key));
  _downloadCsv(exps, `expenses_${key}.csv`);
}

function exportRange() {
  const from = document.getElementById('exp-from').value;
  const to   = document.getElementById('exp-to').value;
  if (!from || !to) { alert('Please select a date range.'); return; }

  const exps = state.expenses.filter(e => e.date >= from && e.date <= to);
  _downloadCsv(exps, `expenses_${from}_${to}.csv`);
}

function exportAll() {
  _downloadCsv(state.expenses, 'expenses_full_history.csv');
}

// ── CSV build and download ────────────────────────────────────

function _downloadCsv(expenses, filename) {
  if (!expenses.length) { alert('No expenses in the selected period.'); return; }

  const rows = [
    ['Date', 'Category', 'Category Budget', 'Amount', 'Note', 'Source']
  ];

  const sorted = [...expenses].sort((a,b) => a.date.localeCompare(b.date));

  for (const e of sorted) {
    const cat    = state.categories.find(c => c.id === e.catId);
    const nombre = cat ? cat.name    : 'Unknown';
    const budget = cat ? cat.budget  : 0;
    rows.push([e.date, nombre, budget, e.amount, e.note || '', e.source]);
  }

  const csv  = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
