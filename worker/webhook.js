// ─────────────────────────────────────────────────────────────
// worker/webhook.js — Responsabilidad: Cloudflare Worker
// Recibe mensajes de Telegram en tiempo real (webhook),
// los parsea y los guarda en la base de datos.
//
// ESTADO: esqueleto listo para implementar en la Etapa 2.
// Por ahora la aplicacion usa polling desde el navegador.
//
// Para desplegar:
//   1. npm install -g wrangler
//   2. wrangler login
//   3. wrangler deploy worker/webhook.js
// ─────────────────────────────────────────────────────────────

// Variables de entorno (se configuran en Cloudflare Dashboard):
//   TELEGRAM_TOKEN  → token del bot
//   TELEGRAM_CHAT   → tu chat ID (para filtrar solo tus mensajes)
//   DB_URL          → URL de la base de datos (Supabase u otra)
//   DB_KEY          → clave de la base de datos

export default {
  async fetch(request, env) {
    // Solo aceptar POST de Telegram
    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }

    try {
      const update = await request.json();
      const msg    = update?.message;

      // Ignorar si no hay mensaje de texto
      if (!msg || !msg.text) return ok();

      // Filtrar: solo procesar mensajes del chat autorizado
      if (env.TELEGRAM_CHAT && String(msg.chat.id) !== env.TELEGRAM_CHAT) return ok();

      // Parsear el mensaje
      const parsed = parseMessage(msg.text);
      if (!parsed) return ok();

      // Guardar en la base de datos
      // TODO (Etapa 2): implementar segun la BD elegida
      // await saveExpense(env, { ...parsed, date: isoDate(msg.date), source: 'telegram' });

      // Responder al usuario por Telegram
      // await replyTelegram(env.TELEGRAM_TOKEN, msg.chat.id, `Registrado: $${parsed.amount} en ${parsed.category}`);

      return ok();
    } catch (e) {
      return new Response('Error: ' + e.message, { status: 500 });
    }
  }
};

// ── Parseo de mensaje ─────────────────────────────────────────
// Formato: "150 alimentacion cena del martes"
// Opcional: "/gasto 150 alimentacion cena"

function parseMessage(text) {
  text = text.trim().replace(/^\/gasto\s*/i, '');
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s+(\S+)(.*)?$/);
  if (!m) return null;

  return {
    amount:   parseFloat(m[1].replace(',', '.')),
    category: m[2].toLowerCase(),
    note:     (m[3] || '').trim()
  };
}

// ── Helpers ───────────────────────────────────────────────────

function ok() {
  return new Response('OK', { status: 200 });
}

function isoDate(unixTimestamp) {
  return new Date(unixTimestamp * 1000).toISOString().slice(0, 10);
}

async function replyTelegram(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text })
  });
}

// ── saveExpense (implementar en Etapa 2) ─────────────────────
// async function saveExpense(env, expense) { ... }
