// state.js — English version
// Responsibility: global data and persistence
// Reads and writes to localStorage. All other scripts
// access `state` and call saveState() after changes.

const COLORS = ['#C4956A','#5BAD8F','#6A9EC4','#A06AC4','#C46A6A','#6AC4B8','#C4B46A','#8A8A8A'];

// ── Translation engine ────────────────────────────────────────
// Maps category ID (as string) → English display name.
// Set via the "English Name" column in the Budget view.
// Stored in localStorage so it persists across sessions.

let catTranslations = {}; // { "1": "Housing", "2": "Groceries", ... }

function loadCatTranslations() {
  try {
    const raw = localStorage.getItem('mf_cat_trans');
    if (raw) catTranslations = JSON.parse(raw);
  } catch(e) {}
}

function saveCatTranslations() {
  localStorage.setItem('mf_cat_trans', JSON.stringify(catTranslations));
}

async function autoTranslateCategories() {
  const srcNames = JSON.parse(localStorage.getItem('mf_cat_src') || '{}');
  const missing = state.categories.filter(c => {
    const key = String(c.id);
    return !catTranslations[key] || srcNames[key] !== c.name;
  });
  if (!missing.length) return;
  const key = (typeof tgConfig !== 'undefined') ? tgConfig.claudeKey : '';
  if (!key) return;

  const nameList = missing.map(c => c.name).join('\n');
  const prompt = `Translate these Spanish personal finance category names to English. Keep them short and natural. Reply ONLY with valid JSON, no extra text: {"translations": {"OriginalName": "EnglishName"}}\n\n${nameList}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }] }) }
    );
    const data = await resp.json();
    const raw  = data.candidates[0].content.parts[0].text.trim()
                   .replace(/^```json\s*/,'').replace(/\s*```$/,'');
    const result = JSON.parse(raw);
    const newSrc = { ...srcNames };
    missing.forEach(cat => {
      const t = result.translations?.[cat.name];
      if (t) { catTranslations[String(cat.id)] = t; newSrc[String(cat.id)] = cat.name; }
    });
    saveCatTranslations();
    localStorage.setItem('mf_cat_src', JSON.stringify(newSrc));
    recalcAll();
  } catch(e) {
    console.warn('[autoTranslate]', e.message);
  }
}

// Returns the English display name for a category, or its stored name if no translation is set.
function getDisplayName(cat) {
  return catTranslations[String(cat.id)] || cat.name;
}

// Finds a category by hint, checking both stored names and English translations.
// Used by the Telegram parser so "vivienda" and "housing" both work.
function findCategoryByHint(hint) {
  const h = norm(hint);
  const cats = state.categories;

  // 1. Match against stored name
  const byStored = cats.find(c => norm(c.name) === h)
    || cats.find(c => norm(c.name).startsWith(h))
    || cats.find(c => norm(c.name).includes(h))
    || cats.find(c => h.includes(norm(c.name).split(' ')[0]));
  if (byStored) return byStored;

  // 2. Match against English display name
  const byTranslation = cats.find(c => norm(getDisplayName(c)) === h)
    || cats.find(c => norm(getDisplayName(c)).startsWith(h))
    || cats.find(c => norm(getDisplayName(c)).includes(h))
    || cats.find(c => h.includes(norm(getDisplayName(c)).split(' ')[0]));
  return byTranslation || null;
}

let state = {
  income: 5000,
  categories: [
    { id:1, name:'Housing',        budget:1500, color:COLORS[0], isSavings:false },
    { id:2, name:'Groceries',      budget:600,  color:COLORS[1], isSavings:false },
    { id:3, name:'Transportation', budget:200,  color:COLORS[2], isSavings:false },
    { id:4, name:'Entertainment',  budget:200,  color:COLORS[3], isSavings:false },
    { id:5, name:'Health',         budget:150,  color:COLORS[4], isSavings:false },
    { id:6, name:'Savings',        budget:500,  color:COLORS[5], isSavings:true  },
    { id:7, name:'Other',          budget:150,  color:COLORS[6], isSavings:false },
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
    console.warn('Could not load saved state:', e);
  }
}

// ── Shared utilities ──────────────────────────────────────────

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
  return { verde:'On Track', naranja:'Alert', rojo:'Exceeded', vacio:'No Data' }[s];
}

function diffFor(cat, real) {
  if (!cat.budget && !real) return { txt:'–', cls:'neutral' };
  const d   = cat.isSavings ? (real - cat.budget) : (cat.budget - real);
  const s   = statusFor(cat, real);
  const cls = s==='verde'?'good': s==='naranja'?'warning': s==='rojo'?'bad':'neutral';
  return { txt: (d >= 0 ? '+' : '') + '$' + Math.abs(Math.round(d)).toLocaleString(), cls };
}

// ── Main orchestrator (called by all scripts) ─────────────────

function recalcAll() {
  renderBudgetTable();
  renderProgressBars('p-bars');
  updateSummaryCards();
  renderExpenses();
  renderProgressBars('sg-bars');
  renderCharts();
}
