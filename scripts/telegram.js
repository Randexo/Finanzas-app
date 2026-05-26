// ─────────────────────────────────────────────────────────────
// telegram.js — Responsabilidad: configuracion del bot,
// sincronizacion con la API de Telegram y parseo de mensajes
// ─────────────────────────────────────────────────────────────

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
  } catch(e) {}
}

function saveTgConfig() {
  localStorage.setItem('mf_tg', JSON.stringify(tgConfig));
}

function onTgInput() {
  tgConfig.token     = document.getElementById('tg-token').value.trim();
  tgConfig.chatId    = document.getElementById('tg-chat-id').value.trim();
  tgConfig.claudeKey = document.getElementById('tg-claude-key').value.trim();
  saveTgConfig();
  updateTgDot();
}

function updateTgDot() {
  const on    = !!tgConfig.token;
  const dot   = document.getElementById('tg-dot');
  const label = document.getElementById('tg-label');
  if (dot)   dot.className     = 'tg-dot' + (on ? '' : ' off');
  if (label) label.textContent = on ? 'Telegram activo' : 'Telegram desconectado';
}

function setTgMsg(msg) {
  const el = document.getElementById('tg-msg');
  if (el) el.textContent = msg;
}

function toggleTgPanel() {
  const body   = document.getElementById('tg-body');
  const toggle = document.getElementById('tg-toggle');
  body.hidden  = !body.hidden;
  if (toggle) toggle.textContent = body.hidden ? 'Configurar ▾' : 'Cerrar ▴';
}

// ── Parser con Gemini (lenguaje libre) ───────────────────────

async function testGeminiKey() {
  const key = tgConfig.claudeKey;
  if (!key) { console.log('No hay key guardada'); return; }
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await resp.json();
  if (data.models) {
    console.log('Modelos disponibles:', data.models.map(m => m.name).join('\n'));
  } else {
    console.log('Error:', JSON.stringify(data));
  }
}

async function parseWithClaude(text) {
  console.log('[Gemini] key guardada:', tgConfig.claudeKey ? 'sí' : 'NO — campo vacío');
  if (!tgConfig.claudeKey) return null;
  try {
    const cats   = state.categories.map(c => c.name).join(', ');
    const prompt = `Extrae monto y categoría del mensaje de gasto personal. Categorías disponibles: ${cats}.
Mensaje: "${text}"
Responde SOLO con JSON válido, sin texto adicional: {"amount": número, "category": "nombre exacto de la lista", "note": "descripción breve"}
Si no hay monto o categoría clara, responde: {"error": "no_parse"}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${tgConfig.claudeKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const data = await resp.json();
    console.log('[Gemini] respuesta:', JSON.stringify(data));
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

// ── Sincronizacion con Telegram API ──────────────────────────

async function syncTelegram() {
  const token  = document.getElementById('tg-token').value.trim();
  const chatId = document.getElementById('tg-chat-id').value.trim();

  if (!token) { setTgMsg('Configura el token primero'); return; }

  tgConfig.token  = token;
  tgConfig.chatId = chatId;
  setTgMsg('Sincronizando...');

  try {
    const url  = `https://api.telegram.org/bot${token}/getUpdates?offset=${tgConfig.lastUpdateId + 1}&limit=100`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (!data.ok) { setTgMsg('Error: ' + data.description); return; }

    console.log('[Sync] mensajes recibidos:', data.result.length, '| lastUpdateId:', tgConfig.lastUpdateId);

    let count = 0;
    for (const upd of data.result) {
      console.log('[Sync] mensaje:', upd.update_id, upd.message?.text);
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

    const now = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
    setTgMsg(`${now} · ${count} gasto(s) importado(s)`);

    const sub = document.getElementById('tg-panel-sub');
    if (sub) sub.textContent = `Ultimo sync: ${now}`;

  } catch(e) {
    setTgMsg('Error de red: ' + e.message);
  }
}

// ── Parseo de mensajes ────────────────────────────────────────
// Formato esperado: "150 alimentacion cena del martes"
// Opcional:        "/gasto 150 alimentacion cena del martes"

function parseTgMessage(text) {
  text = text.trim().replace(/^\/gasto\s*/i, '');
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s+(\S+)(.*)?$/);
  if (!m) return null;

  const amount = parseFloat(m[1].replace(',', '.'));
  const hint   = norm(m[2]);
  const note   = (m[3] || '').trim();

  const cat = findCategory(hint);
  if (!cat) return null;

  return { catId: cat.id, amount, note };
}

function findCategory(hint) {
  const cats = state.categories;
  return cats.find(c => norm(c.name) === hint)
      || cats.find(c => norm(c.name).startsWith(hint))
      || cats.find(c => norm(c.name).includes(hint))
      || cats.find(c => hint.includes(norm(c.name).split(' ')[0]))
      || null;
}
