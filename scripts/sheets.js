// sheets.js — Sincronización con Google Sheets via Apps Script

let sheetsUrl = '';
let _isSyncing = false;
let _configTimer = null;

function loadSheetsConfig() {
  sheetsUrl = localStorage.getItem('mf_sheets_url') || '';
  const el = document.getElementById('sheets-url');
  if (el) el.value = sheetsUrl;
}

function onSheetsInput() {
  sheetsUrl = document.getElementById('sheets-url').value.trim();
  localStorage.setItem('mf_sheets_url', sheetsUrl);
}

// ── Guardar config (categorías + ingreso) ─────────────────────

function scheduleConfigSync() {
  if (_isSyncing) return;
  clearTimeout(_configTimer);
  _configTimer = setTimeout(saveConfigToSheets, 1500);
}

async function saveConfigToSheets() {
  if (!sheetsUrl) return;
  try {
    await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action:     'saveConfig',
        income:     state.income,
        categories: state.categories
      })
    });
  } catch(e) {
    console.error('[Sheets] saveConfig:', e.message);
  }
}

// ── Guardar / eliminar gasto ──────────────────────────────────

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

// ── JSONP helper (evita CORS en lecturas) ─────────────────────

function fetchJsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = 'gs_' + Date.now();
    const script = document.createElement('script');
    window[cb] = data => { delete window[cb]; document.body.removeChild(script); resolve(data); };
    script.onerror = () => { delete window[cb]; document.body.removeChild(script); reject(new Error('JSONP error')); };
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    document.body.appendChild(script);
  });
}

// ── Sincronizar todo desde Sheets ─────────────────────────────

async function syncFromSheets() {
  if (!sheetsUrl) return;
  _isSyncing = true;
  try {
    // Cargar configuración (categorías + ingreso)
    const cfgData = await fetchJsonp(sheetsUrl + '?type=config');
    if (cfgData.ok && cfgData.config && cfgData.config.categories && cfgData.config.categories.length > 0) {
      state.income     = cfgData.config.income || state.income;
      state.categories = cfgData.config.categories;
      nextCatId = Math.max(...state.categories.map(c => c.id)) + 1;
      const incInput = document.getElementById('inp-income');
      if (incInput) incInput.value = state.income;
    } else if (state.categories.length > 0) {
      await saveConfigToSheets();
    }

    // Cargar gastos
    const expData = await fetchJsonp(sheetsUrl);
    if (!expData.ok) { console.error('[Sheets] error:', expData.error); return; }

    if (expData.expenses.length === 0 && state.expenses.length > 0) {
      console.log('[Sheets] primera vez — migrando', state.expenses.length, 'gastos y config');
      for (const e of state.expenses) await saveToSheets(e);
      await saveConfigToSheets();
    } else {
      state.expenses = expData.expenses.map(e => ({
        id:     e.id,
        catId:  e.catId,
        amount: e.monto,
        note:   e.nota || '',
        date:   e.fecha,
        source: e.fuente || 'manual'
      }));
    }

    localStorage.setItem('mf_state', JSON.stringify({ state, nextCatId, nextExpId }));
    recalcAll();
    console.log('[Sheets] sincronizado — ' + (expData.expenses?.length || 0) + ' gastos');
  } catch(e) {
    console.error('[Sheets] syncFromSheets:', e.message);
  } finally {
    _isSyncing = false;
  }
}
