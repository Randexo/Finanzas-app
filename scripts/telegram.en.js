// telegram.js — English version
// Responsibility: bot configuration, Telegram API sync,
// and message parsing

let tgConfig = { token: '', chatId: '', lastUpdateId: 0, claudeKey: '' };

function loadTgConfig() {
  try {
    const raw = localStorage.getItem('mf_tg');
    if (!raw) return;
    tgConfig = JSON.parse(raw);
    const tokenEl  = document.getElementById('tg-token');
    const chatEl   = document.getElementById('tg-chat-id');
    const claudeEl = document.getElementById('tg-claude-key');
    if (tokenEl)  tokenEl.value  = tgConfig.token     || '';
    if (chatEl)   chatEl.value   = tgConfig.chatId    || '';
    if (claudeEl) claudeEl.value = tgConfig.claudeKey || '';
    updateTgDot();
    updateConfigStatus();
    if (tgConfig.token) setTimeout(saveTgConfigToSheets, 2000);
  } catch(e) {}
}

function saveTgConfig() {
  localStorage.setItem('mf_tg', JSON.stringify(tgConfig));
}

let _tgSyncTimer = null;

async function saveTgConfigToSheets() {
  if (!sheetsUrl) return;
  await fetch(sheetsUrl, {
    method: 'POST',
    mode:   'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action:    'saveTgConfig',
      token:     tgConfig.token,
      chatId:    tgConfig.chatId,
      geminiKey: tgConfig.claudeKey
    })
  });
}

function onTgInput() {
  tgConfig.token     = document.getElementById('tg-token').value.trim();
  tgConfig.chatId    = document.getElementById('tg-chat-id').value.trim();
  tgConfig.claudeKey = document.getElementById('tg-claude-key').value.trim();
  saveTgConfig();
  updateTgDot();
  clearTimeout(_tgSyncTimer);
  _tgSyncTimer = setTimeout(saveTgConfigToSheets, 1500);
}

function updateConfigStatus() {
  function dot(id, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className  = 'cfg-status ' + (ok ? 'cfg-ok' : 'cfg-empty');
    el.textContent = ok ? '● Configured' : '○ Not set';
  }
  dot('cfg-sheets-status', !!sheetsUrl);
  dot('cfg-gemini-status', !!tgConfig.claudeKey);
  dot('cfg-tg-status',     !!(tgConfig.token && tgConfig.chatId));
}

function updateTgDot() {
  const on    = !!tgConfig.token;
  const dot   = document.getElementById('tg-dot');
  const label = document.getElementById('tg-label');
  if (dot)   dot.className     = 'tg-dot' + (on ? '' : ' off');
  if (label) label.textContent = on ? 'Telegram active' : 'Telegram disconnected';
}

function setTgMsg(msg) {
  const el = document.getElementById('tg-msg');
  if (el) el.textContent = msg;
}

function toggleTgPanel() {
  const body   = document.getElementById('tg-body');
  const toggle = document.getElementById('tg-toggle');
  body.hidden  = !body.hidden;
  if (toggle) toggle.textContent = body.hidden ? 'Configure ▾' : 'Close ▴';
}

// ── Gemini parser (free-form language) ───────────────────────

async function testGeminiKey() {
  const key = tgConfig.claudeKey;
  if (!key) { console.log('No key saved'); return; }
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await resp.json();
  if (data.models) {
    console.log('Available models:', data.models.map(m => m.name).join('\n'));
  } else {
    console.log('Error:', JSON.stringify(data));
  }
}

async function parseWithClaude(text) {
  console.log('[Gemini] saved key:', tgConfig.claudeKey ? 'yes' : 'NO — field empty');
  if (!tgConfig.claudeKey) return null;
  try {
    const cats   = state.categories.map(c => c.name).join(', ');
    const prompt = `Extract amount and category from this personal expense message. Available categories: ${cats}.
Message: "${text}"
Reply ONLY with valid JSON, no extra text: {"amount": number, "category": "exact name from the list", "note": "brief description"}
If there is no clear amount or category, reply: {"error": "no_parse"}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${tgConfig.claudeKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const data = await resp.json();
    console.log('[Gemini] response:', JSON.stringify(data));
    const raw  = data.candidates[0].content.parts[0].text.trim()
                   .replace(/^```json\s*/,'').replace(/\s*```$/,'');
    const result = JSON.parse(raw);
    if (result.error) return null;

    const cat = state.categories.find(c => norm(c.name) === norm(result.category))
             || state.categories.find(c => norm(c.name).includes(norm(result.category)))
             || state.categories.find(c => norm(result.category).includes(norm(c.name)));
    if (!cat || !(result.amount > 0)) return null;

    return { catId: cat.id, amount: result.amount, note: result.note || '' };
  } catch(e) {
    console.error('[Gemini] error:', e.message);
    return null;
  }
}

// ── Telegram API sync ─────────────────────────────────────────

async function syncTelegram() {
  const token  = document.getElementById('tg-token').value.trim();
  const chatId = document.getElementById('tg-chat-id').value.trim();

  if (!token) { setTgMsg('Set up the token first'); return; }

  tgConfig.token  = token;
  tgConfig.chatId = chatId;
  setTgMsg('Syncing...');

  try {
    const url  = `https://api.telegram.org/bot${token}/getUpdates?offset=${tgConfig.lastUpdateId + 1}&limit=100`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (!data.ok) { setTgMsg('Error: ' + data.description); return; }

    console.log('[Sync] messages received:', data.result.length, '| lastUpdateId:', tgConfig.lastUpdateId);

    let count = 0;
    for (const upd of data.result) {
      console.log('[Sync] message:', upd.update_id, upd.message?.text);
      tgConfig.lastUpdateId = Math.max(tgConfig.lastUpdateId, upd.update_id);
      const msg = upd.message;
      if (!msg || !msg.text) continue;
      if (chatId && String(msg.chat.id) !== chatId) continue;

      const date   = new Date(msg.date * 1000).toISOString().slice(0,10);
      const parsed = (await parseWithClaude(msg.text)) || parseTgMessage(msg.text);
      if (parsed) {
        addExpense(parsed.catId, parsed.amount, parsed.note, date, 'telegram');
        count++;
      }
    }

    saveTgConfig();
    updateTgDot();

    const now = new Date().toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit' });
    setTgMsg(`${now} · ${count} expense(s) imported`);

    const sub = document.getElementById('tg-panel-sub');
    if (sub) sub.textContent = `Last sync: ${now}`;

  } catch(e) {
    setTgMsg('Network error: ' + e.message);
  }
}

// ── Message parsing ───────────────────────────────────────────
// Expected format: "150 groceries tuesday dinner"
// Optional:       "/expense 150 groceries tuesday dinner"

function parseTgMessage(text) {
  text = text.trim().replace(/^\/gasto\s*/i, '').replace(/^\/expense\s*/i, '');
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s+(\S+)(.*)?$/);
  if (!m) return null;

  const amount = parseFloat(m[1].replace(',', '.'));
  const hint   = norm(m[2]);
  const note   = (m[3] || '').trim();

  const cat = findCategoryByHint(hint);
  if (!cat) return null;

  return { catId: cat.id, amount, note };
}
