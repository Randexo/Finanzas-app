// sheets.js — Sincronización con Google Sheets

const SHEET_ID = '12ipWUNldTpSfUYiw6e1BpToGT6Mpqy6assxeqfC5PYM';

let sheetsUrl = '';
let _isSyncing = false;
let _configTimer = null;

function loadSheetsConfig() {
  sheetsUrl = localStorage.getItem('mf_sheets_url') || '';
  const el = document.getElementById('sheets-url');
  if (el) el.value = sheetsUrl;
  if (typeof updateConfigStatus === 'function') updateConfigStatus();
}

function onSheetsInput() {
  sheetsUrl = document.getElementById('sheets-url').value.trim();
  localStorage.setItem('mf_sheets_url', sheetsUrl);
}

// ── Lectura via Google Sheets Visualization API (sin CORS) ────

function gvizUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

function parseCsvLine(line) {
  const result = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let field = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') { field += '"'; i += 2; }
          else { i++; break; }
        } else { field += line[i++]; }
      }
      result.push(field);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) { result.push(line.slice(i)); break; }
      result.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return result;
}

function parseCsv(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] !== undefined ? vals[i] : '');
    return obj;
  });
}

async function fetchCsv(sheetName) {
  const resp = await fetch(gvizUrl(sheetName));
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return parseCsv(await resp.text());
}

// ── Guardar config (categorías + ingreso) — via Apps Script ───

function scheduleConfigSync() {
  if (_isSyncing) return;
  if (localStorage.getItem('mf_locked') === '1') return;
  clearTimeout(_configTimer);
  _configTimer = setTimeout(saveConfigToSheets, 1500);
}

async function saveConfigToSheets() {
  if (!sheetsUrl) return;
  await fetch(sheetsUrl, {
    method: 'POST',
    mode:   'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action:     'saveConfig',
      income:     state.income,
      categories: JSON.stringify(state.categories)
    })
  });
}

// ── Guardar / eliminar gasto — via Apps Script ────────────────

async function saveToSheets(expense) {
  if (!sheetsUrl) return;
  const cat = state.categories.find(c => c.id === expense.catId);
  await fetch(sheetsUrl, {
    method: 'POST',
    mode:   'no-cors',
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
}

async function deleteFromSheets(id) {
  if (!sheetsUrl) return;
  await fetch(sheetsUrl, {
    method: 'POST',
    mode:   'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'delete', id: String(id) })
  });
}

// ── Sincronizar todo desde Sheets ─────────────────────────────

async function syncFromSheets() {
  if (!sheetsUrl) return;
  _isSyncing = true;
  try {
    // Config: Apps Script doGet (sin caché de gviz)
    try {
      const r   = await fetch(sheetsUrl + '?type=config');
      const cfg = await r.json();
      if (cfg.ok && cfg.config) {
        if (cfg.config.income > 0) {
          state.income = cfg.config.income;
          const el = document.getElementById('inp-income');
          if (el) el.value = state.income;
        }
        if (Array.isArray(cfg.config.categories) && cfg.config.categories.length > 0) {
          state.categories = cfg.config.categories;
          nextCatId = Math.max(...state.categories.map(c => c.id)) + 1;
        } else if (!cfg.config.income && state.categories.length > 0) {
          saveConfigToSheets();
        }
      }
    } catch(cfgErr) {
      console.warn('[Sheets] config via script falló, usando gviz:', cfgErr.message);
      const cfgRows = await fetchCsv('Config');
      const cfgMap  = {};
      cfgRows.forEach(r => { cfgMap[r.key] = r.value; });
      if (cfgMap.income) {
        const p = parseFloat(cfgMap.income);
        if (p > 0) { state.income = p; const el = document.getElementById('inp-income'); if (el) el.value = p; }
      }
      if (cfgMap.categories) {
        try {
          const cats = JSON.parse(cfgMap.categories);
          if (Array.isArray(cats) && cats.length > 0) { state.categories = cats; nextCatId = Math.max(...cats.map(c => c.id)) + 1; }
        } catch(e) { console.warn('[Sheets] categories parse error:', e.message); }
      } else if (cfgRows.length === 0 && state.categories.length > 0) {
        saveConfigToSheets();
      }
    }

    // Gastos: gviz CSV
    const expRows = await fetchCsv('Gastos');

    if (expRows.length === 0 && state.expenses.length > 0) {
      for (const e of state.expenses) await saveToSheets(e);
      saveConfigToSheets();
    } else {
      state.expenses = expRows.map(r => ({
        id:     r.id,
        catId:  parseInt(r.catId) || 0,
        amount: parseFloat(r.monto) || 0,
        note:   r.nota || '',
        date:   r.fecha,
        source: r.fuente || 'manual'
      }));
    }

    localStorage.setItem('mf_state', JSON.stringify({ state, nextCatId, nextExpId }));
    recalcAll();
    console.log('[Sheets] sincronizado —', expRows.length, 'gastos');
  } catch(e) {
    console.error('[Sheets] syncFromSheets:', e.message);
  } finally {
    _isSyncing = false;
  }
}
