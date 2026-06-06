// ─────────────────────────────────────────────────────────────
// expenses.js — Responsabilidad: CRUD de gastos individuales
// y renderizado de la tabla de transacciones del mes
// ─────────────────────────────────────────────────────────────

function addExpense(catId, amount, note, date, source) {
  const expense = {
    id:     Date.now(),
    catId:  catId,
    amount: amount,
    note:   note || '',
    date:   date,
    source: source
  };
  state.expenses.push(expense);
  saveState();
  saveToSheets(expense);
  recalcAll();
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => String(e.id) !== String(id));
  saveState();
  deleteFromSheets(id);
  recalcAll();
}

function renderExpenses() {
  const exps  = monthExpenses().sort((a,b) => b.date.localeCompare(a.date));
  const tbody = document.getElementById('exp-body');
  const empty = document.getElementById('exp-empty');
  if (!tbody) return;

  if (!exps.length) {
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  tbody.innerHTML = exps.map(e => {
    const cat     = state.categories.find(c => c.id === e.catId);
    const name    = cat ? escHtml(cat.name) : 'Desconocida';
    const color   = cat ? cat.color : '#8A8A8A';
    const srcHtml = e.source === 'telegram' ? '<span class="src-tg">Telegram</span>'
      : e.source === 'tarjeta' ? '<span class="src-tarjeta">Tarjeta</span>'
      : '<span class="src-manual">Manual</span>';

    return `<tr>
      <td style="font-size:0.78rem;color:#7A6A5A;white-space:nowrap">${e.date}</td>
      <td><div class="cat-name-cell">
        <div class="cat-dot" style="background:${color}"></div>
        <span style="font-size:0.84rem;font-weight:500">${name}</span>
      </div></td>
      <td class="right" style="font-weight:600;font-size:0.88rem">${fmt(e.amount)}</td>
      <td style="font-size:0.78rem;color:#7A6A5A">${escHtml(e.note || '–')}</td>
      <td style="text-align:center">${srcHtml}</td>
      <td><button class="del-btn" onclick="deleteExpense('${e.id}')">×</button></td>
    </tr>`;
  }).join('');
}

// ── Formulario de agregar gasto ───────────────────────────────

function toggleAddForm() {
  const form = document.getElementById('add-form');
  form.hidden = !form.hidden;
  if (!form.hidden) {
    fillCatSelect();
    document.getElementById('new-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('new-amt').focus();
  }
}

function submitExpense() {
  const catId  = parseInt(document.getElementById('new-cat').value);
  const amount = parseFloat(document.getElementById('new-amt').value);
  const note   = document.getElementById('new-note').value.trim();
  const date   = document.getElementById('new-date').value;
  if (!catId || !(amount > 0) || !date) return;

  addExpense(catId, amount, note, date, 'manual');

  document.getElementById('new-amt').value  = '';
  document.getElementById('new-note').value = '';
  document.getElementById('add-form').hidden = true;
}

function fillCatSelect() {
  const sel = document.getElementById('new-cat');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = state.categories.map(c =>
    `<option value="${c.id}" ${c.id == cur ? 'selected' : ''}>${escHtml(c.name)}</option>`
  ).join('');
}
