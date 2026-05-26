// sheets.js — Sincronización con Google Sheets via Apps Script

let sheetsUrl = '';

function loadSheetsConfig() {
  sheetsUrl = localStorage.getItem('mf_sheets_url') || '';
  const el = document.getElementById('sheets-url');
  if (el) el.value = sheetsUrl;
}

function onSheetsInput() {
  sheetsUrl = document.getElementById('sheets-url').value.trim();
  localStorage.setItem('mf_sheets_url', sheetsUrl);
}

async function saveToSheets(expense) {
  if (!sheetsUrl) return;
  const cat = state.categories.find(c => c.id === expense.catId);
  try {
    await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        id:        String(expense.id),
        fecha:     expense.date,
        catId:     expense.catId,
        catNombre: cat ? cat.name : '',
        monto:     expense.amount,
        nota:      expense.note || '',
        fuente:    expense.source || 'manual'
      })
    });
  } catch(e) {
    console.error('[Sheets] guardar:', e.message);
  }
}

async function deleteFromSheets(id) {
  if (!sheetsUrl) return;
  try {
    await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete', id: String(id) })
    });
  } catch(e) {
    console.error('[Sheets] eliminar:', e.message);
  }
}

async function syncFromSheets() {
  if (!sheetsUrl) return;
  try {
    const resp = await fetch(sheetsUrl);
    const data = await resp.json();
    if (!data.ok) { console.error('[Sheets] error:', data.error); return; }

    if (data.expenses.length === 0 && state.expenses.length > 0) {
      console.log('[Sheets] primera vez — migrando', state.expenses.length, 'gastos locales');
      for (const e of state.expenses) await saveToSheets(e);
      return;
    }

    state.expenses = data.expenses.map(e => ({
      id:     e.id,
      catId:  e.catId,
      amount: e.monto,
      note:   e.nota || '',
      date:   e.fecha,
      source: e.fuente || 'manual'
    }));
    saveState();
    recalcAll();
    console.log('[Sheets] sincronizado:', data.expenses.length, 'gastos');
  } catch(e) {
    console.error('[Sheets] syncFromSheets:', e.message);
  }
}
