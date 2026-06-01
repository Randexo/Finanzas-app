// categories.js — English version
// Responsibility: category CRUD and rendering of the budget table
// and comparative progress bars

function addCategory() {
  state.categories.push({
    id:        nextCatId++,
    name:      'New category',
    budget:    0,
    color:     COLORS[nextCatId % COLORS.length],
    isSavings: false
  });
  saveState();
  recalcAll();
  fillCatSelect();
}

function deleteCategory(id) {
  state.categories = state.categories.filter(c => c.id !== id);
  saveState();
  recalcAll();
  fillCatSelect();
}

function renderBudgetTable() {
  const income = state.income || 5000;
  const tbody  = document.getElementById('budget-body');
  if (!tbody) return;

  tbody.innerHTML = state.categories.map(cat => {
    const real    = realFor(cat.id);
    const status  = statusFor(cat, real);
    const diff    = diffFor(cat, real);
    const pct     = income > 0 ? (real / income * 100).toFixed(1) : '0.0';
    const displayName = escHtml(getDisplayName(cat));

    return `<tr>
      <td><div class="cat-name-cell">
        <div class="cat-dot" style="background:${cat.color}"></div>
        <input class="cat-name-input" value="${displayName}"
          oninput="
            const v = this.value.trim();
            if (v && v !== state.categories.find(c=>c.id===${cat.id})?.name) catTranslations['${cat.id}'] = v;
            else delete catTranslations['${cat.id}'];
            saveCatTranslations(); recalcAll();">
      </div></td>
      <td class="right">
        <input class="amount-input" type="number" min="0" placeholder="0" value="${cat.budget||''}"
          onchange="state.categories.find(c=>c.id===${cat.id}).budget=parseFloat(this.value)||0; saveState(); recalcAll()">
      </td>
      <td class="right" style="font-size:0.86rem;font-weight:600">${fmt(real)}</td>
      <td class="right diff-cell ${diff.cls}">${diff.txt}</td>
      <td class="right" style="font-size:0.78rem;color:#7A6A5A">${pct}%</td>
      <td style="text-align:center"><span class="badge ${status}">${statusLabel(status)}</span></td>
      <td><button class="del-btn" onclick="deleteCategory(${cat.id})">×</button></td>
    </tr>`;
  }).join('');
}

function renderProgressBars(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const max = Math.max(...state.categories.map(c => c.budget), 1);

  el.innerHTML = state.categories.map(cat => {
    const real     = realFor(cat.id);
    const planW    = (cat.budget / max * 100).toFixed(1);
    const realW    = Math.min(real / max * 100, 100).toFixed(1);
    const status   = statusFor(cat, real);
    const barColor = status==='verde'?'#5BAD8F': status==='naranja'?'#E67E22': status==='rojo'?'#C0504D':'#C8BEB4';

    return `<div class="bar-row">
      <div class="bar-label">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cat.color};margin-right:6px;vertical-align:middle"></span>
        ${escHtml(getDisplayName(cat))}
      </div>
      <div class="bar-track">
        <div class="bar-plan" style="width:${planW}%"></div>
        <div class="bar-real" style="width:${realW}%;background:${barColor}"></div>
      </div>
      <div class="bar-nums">${fmt(real)} / ${fmt(cat.budget)}</div>
    </div>`;
  }).join('');
}

function updateSummaryCards() {
  const income    = state.income || 0;
  const totalPlan = state.categories.reduce((s,c) => s + c.budget, 0);
  const totalReal = state.categories.filter(c => !c.isSavings).reduce((s,c) => s + realFor(c.id), 0);
  const savings   = income - totalReal;
  const avail     = totalPlan - totalReal;

  // Budget view
  _set('p-income',      fmt(income));
  _set('p-plan',        fmt(totalPlan));
  _set('p-plan-pct',    income>0 ? (totalPlan/income*100).toFixed(1)+'% of income' : '–');
  _set('p-real',        fmt(totalReal));
  _set('p-real-pct',    income>0 ? (totalReal/income*100).toFixed(1)+'% of income' : '–');
  _set('p-savings',     fmt(savings));
  _set('p-savings-pct', income>0 ? (savings/income*100).toFixed(1)+'% savings rate' : '–');
  _cls('p-sc-savings', 'sum-card ' + (savings >= 0 ? 'green' : 'red'));
  _cls('p-sc-real',    'sum-card ' + (totalReal > totalPlan ? 'red' : 'green'));

  // Tracker view
  _set('sg-income',    fmt(income));
  _set('sg-plan',      fmt(totalPlan));
  _set('sg-plan-pct',  income>0 ? (totalPlan/income*100).toFixed(1)+'% of income' : '–');
  _set('sg-real',      fmt(totalReal));
  _set('sg-real-pct',  income>0 ? (totalReal/income*100).toFixed(1)+'% of income' : '–');
  _set('sg-avail',     fmt(avail));
  _set('sg-avail-pct', avail >= 0 ? 'available from budget' : 'over budget');
  _cls('sg-sc-avail',  'sum-card ' + (avail >= 0 ? 'green' : 'red'));
  _cls('sg-sc-real',   'sum-card ' + (totalReal > totalPlan ? 'red' : 'green'));
}

function _set(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
function _cls(id, cls) { const el = document.getElementById(id); if (el) el.className = cls; }
