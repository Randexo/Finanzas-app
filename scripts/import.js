// import.js — Importar reporte de tarjeta (PDF → Gemini → Sheets)

let _importPreview = [];

async function extractPdfText(file) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const buffer = await file.arrayBuffer();
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;

  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map(i => i.str).join(' ') + '\n';
  }
  return text;
}

async function analyzeReport() {
  const file = document.getElementById('import-file').files[0];
  if (!file) { alert('Selecciona un archivo PDF'); return; }

  const key = tgConfig.claudeKey;
  if (!key) {
    alert('Configura tu Gemini API key en la sección de Telegram primero.');
    return;
  }

  const statusEl  = document.getElementById('import-status');
  const analyzeBtn = document.getElementById('import-analyze-btn');
  analyzeBtn.disabled = true;
  statusEl.textContent = 'Extrayendo texto del PDF...';
  document.getElementById('import-preview').innerHTML = '';

  try {
    const pdfText = await extractPdfText(file);
    statusEl.textContent = 'Analizando con Gemini...';

    const cats    = state.categories.map(c => c.name).join(', ');
    const month   = document.getElementById('import-month').value; // "YYYY-MM"

    const prompt =
`Eres un asistente que extrae transacciones de estados de cuenta bancarios o de tarjeta de crédito.
Categorías disponibles: ${cats}.
Mes de referencia: ${month}.

Extrae TODOS los cargos/compras del siguiente texto. Ignora pagos, abonos o transferencias que sean ingresos.
Para cada cargo asigna la categoría más apropiada de la lista.
Si la fecha no tiene año, usa el año del mes de referencia.

Texto del estado de cuenta:
${pdfText.substring(0, 16000)}

Responde SOLO con un array JSON válido, sin texto adicional:
[{"fecha":"YYYY-MM-DD","descripcion":"texto corto","monto":número,"categoria":"nombre exacto de la lista"}]

Si no hay transacciones, responde: []`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const data = await resp.json();
    const raw  = data.candidates[0].content.parts[0].text.trim()
                   .replace(/^```json\s*/, '').replace(/\s*```$/, '');

    const rows = JSON.parse(raw);

    _importPreview = rows.map(t => {
      const cat = state.categories.find(c => norm(c.name) === norm(t.categoria))
               || state.categories.find(c => norm(c.name).includes(norm(t.categoria)))
               || state.categories.find(c => norm(t.categoria).includes(norm(c.name)));
      return {
        date:    t.fecha,
        amount:  t.monto,
        note:    t.descripcion,
        catId:   cat ? cat.id : null,
        catName: cat ? cat.name : '⚠ Sin categoría'
      };
    });

    renderImportPreview();
    statusEl.textContent = `${_importPreview.length} transacción(es) detectada(s)`;

  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
    console.error('[Import]', e);
  } finally {
    analyzeBtn.disabled = false;
  }
}

function renderImportPreview() {
  const container = document.getElementById('import-preview');
  if (!_importPreview.length) {
    container.innerHTML = '<p class="import-empty">No se detectaron transacciones en el PDF.</p>';
    return;
  }

  const catOptions = state.categories
    .map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`)
    .join('');

  const rows = _importPreview.map((t, i) => `
    <tr>
      <td class="imp-td-date">${escHtml(t.date)}</td>
      <td class="imp-td-desc" title="${escHtml(t.note)}">${escHtml(t.note)}</td>
      <td class="imp-td-cat">
        <select class="imp-cat-sel" onchange="_importPreview[${i}].catId = this.value ? parseInt(this.value) : null">
          <option value="">– sin cat –</option>
          ${state.categories.map(c =>
            `<option value="${c.id}" ${t.catId === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`
          ).join('')}
        </select>
      </td>
      <td class="imp-td-amt">$${(+t.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      <td class="imp-td-chk"><input type="checkbox" class="import-chk" data-idx="${i}" checked></td>
    </tr>`).join('');

  container.innerHTML = `
    <table class="imp-table">
      <thead>
        <tr>
          <th class="imp-td-date">Fecha</th>
          <th class="imp-td-desc">Descripción</th>
          <th class="imp-td-cat">Categoría</th>
          <th class="imp-td-amt">Monto</th>
          <th class="imp-td-chk">✓</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="imp-confirm-row">
      <button class="btn-primary" onclick="confirmImport()">Importar seleccionados a Sheets</button>
      <span id="import-confirm-msg" class="imp-confirm-msg"></span>
    </div>`;
}

async function confirmImport() {
  const checkboxes = document.querySelectorAll('.import-chk');
  const selected   = [];
  checkboxes.forEach(chk => {
    if (!chk.checked) return;
    const t = _importPreview[parseInt(chk.dataset.idx)];
    if (t && t.catId) selected.push(t);
  });

  if (!selected.length) {
    alert('Selecciona al menos una transacción con categoría asignada.');
    return;
  }

  const msg = document.getElementById('import-confirm-msg');
  msg.textContent = `Importando ${selected.length} transacciones…`;

  for (const t of selected) {
    addExpense(t.catId, t.amount, t.note, t.date, 'tarjeta');
  }

  msg.textContent = `✓ ${selected.length} transacción(es) importada(s) a Google Sheets`;
  _importPreview  = [];
  document.getElementById('import-preview').innerHTML = '';
  document.getElementById('import-file').value        = '';
  document.getElementById('import-status').textContent = '';
}
