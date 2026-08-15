function renderFormDropdowns() {
  const builtinSelects = {
    wifi: 'fWifi', cellular_gen: 'fCellGen',
    rs485: 'fRs485', rs232: 'fRs232',
  };
  // Populate all fields currently in dropdowns (builtin + user-converted)
  Object.keys(dropdowns).forEach(field => {
    const selId = builtinSelects[field] || CONVERTIBLE_TEXT_FIELDS[field]?.htmlId;
    if (!selId) return;
    let el = document.getElementById(selId);
    if (!el) return;
    // If it's still a text input, replace with select
    if (el.tagName === 'INPUT') {
      const sel = document.createElement('select');
      sel.id = selId;
      el.parentNode.replaceChild(sel, el);
      el = sel;
    }
    const current = el.value;
    const opts = dropdowns[field];
    el.innerHTML = opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
    el.value = opts.includes(current) ? current : (opts[0] || '');
  });
  // Restore any text fields that were reverted (no longer in dropdowns)
  Object.entries(CONVERTIBLE_TEXT_FIELDS).forEach(([field, cfg]) => {
    if (dropdowns[field]) return;
    const el = document.getElementById(cfg.htmlId);
    if (!el || el.tagName !== 'SELECT') return;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.id = cfg.htmlId;
    if (cfg.placeholder) inp.placeholder = cfg.placeholder;
    inp.value = el.value === '-' ? '' : el.value;
    el.parentNode.replaceChild(inp, el);
  });
}

function normSerial(v) {
  if (v === true  || v === 'Yes')      return 'Yes';
  if (v === false || v === 'No')       return 'No';
  if (v === 'Optional')                return 'Optional';
  return '-';
}
function normCellular(v) {
  if (!v || v === 'none' || v === '') return '-';
  return v;
}
function normWifi(v) {
  if (!v || v === 'none' || v === 'false' || v === '') return '-';
  if (v === 'WiFi24')  return 'WiFi4/2.4GHz';
  if (v === 'Wi-Fi 4') return 'WiFi4';
  return v;
}

function populateForm(p) {
  renderFormDropdowns();
  renderVisibilityToggles(p.hidden_fields || []);
  [['fId',p.id],['fName',p.name],['fOrder',p.order??0],['fDesc',p.desc],
   ['fCpu',p.cpu],['fRam',p.ram],['fStorage',p.storage],['fCell',p.cell],
   ['fIp',p.ip],['fPower',p.power],['fPorts',p.ports],['fOs',p.os],
   ['fDims',p.dims],['fWeight',p.weight]
  ].forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; });
  document.getElementById('fCellGen').value = normCellular(p.cellular_gen);
  document.getElementById('fWifi').value    = normWifi(p.wifi);
  document.getElementById('fRs485').value   = normSerial(p.rs485);
  document.getElementById('fRs232').value   = normSerial(p.rs232);
  document.getElementById('fHousing').value = p.housing || '';
  document.getElementById('fOpTemp').value  = p.op_temp  || '';
  currentPartDs = { ...(p.part_datasheets || {}) };
  pendingPartDs = [];
  renderVariantsEditor(p.variants ?? null);
  renderCatDropdown(p.cat);
  renderUseCaseTags(p.use_cases || []);
  renderAdditionalSpecs(p.additional_specs || []);
  currentImgs = [...(p.images || [])];
  pendingImgs  = [];
  renderImageGrid();
  currentDs = p.datasheet || '';
  pendingDs  = null;
  renderDatasheet();
  isDirty = false;
}

function collectForm() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  return {
    id: v('fId'), name: v('fName'), cat: v('fCat'),
    order: Number(v('fOrder')) || 0, desc: v('fDesc'),
    cpu: v('fCpu'), ram: v('fRam'), storage: v('fStorage'),
    cell: v('fCell'), cellular_gen: v('fCellGen'), wifi: v('fWifi'),
    rs485: v('fRs485'), rs232: v('fRs232'), ip: v('fIp'),
    power: v('fPower'), ports: v('fPorts'), os: v('fOs'),
    housing: v('fHousing'), dims: v('fDims'), weight: v('fWeight'),
    op_temp: v('fOpTemp'), use_cases: getUseCaseTags(),
    additional_specs: getAdditionalSpecs(),
    hidden_fields: getHiddenFields(),
    variants: null, part_datasheets: {}
  };
}

function newProduct() {
  selectedId = null;
  const p = { id:'', name:'', cat: cats[0]||'', order: products.length,
    desc:'', images:[], use_cases:[], hidden_fields:[], variants:null, part_datasheets:{} };
  renderSidebar();
  populateForm(p);
  document.getElementById('noSelection').style.display = 'none';
  document.getElementById('editForm').style.display = 'block';
  document.getElementById('fId').focus();
  switchTab('products');
}

function hideEditForm() {
  document.getElementById('editForm').style.display = 'none';
  document.getElementById('noSelection').style.display = 'flex';
}

// ─── Category Dropdown ────────────────────────────────────────────────────────
function renderCatDropdown(selected) {
  const sel = document.getElementById('fCat');
  const safeCats = cats.filter(c => c.toLowerCase() !== 'all');
  sel.innerHTML = safeCats.length
    ? safeCats.map(c => `<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}</option>`).join('')
    : '<option value="">— add categories first —</option>';
}

// ─── Additional Specs ─────────────────────────────────────────────────────────
function renderAdditionalSpecs(arr) {
  const container = document.getElementById('additionalSpecsRows');
  container.innerHTML = '';
  (arr || []).forEach((item, i) => addSpecRow(item.k, item.v));
}
function addSpecRow(k, v) {
  const container = document.getElementById('additionalSpecsRows');
  const row = document.createElement('div');
  row.className = 'spec-row';
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;align-items:center';
  row.innerHTML = `<input type="text" placeholder="Spec name (e.g. HDMI Ports)" value="${esc(k||'')}" style="flex:1;min-width:0">
    <input type="text" placeholder="Value (e.g. 2)" value="${esc(v||'')}" style="flex:1;min-width:0">
    <button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:16px;line-height:1;padding:0 4px" title="Remove">×</button>`;
  container.appendChild(row);
}
function getAdditionalSpecs() {
  return [...document.querySelectorAll('#additionalSpecsRows .spec-row')].map(row => {
    const inputs = row.querySelectorAll('input');
    return { k: inputs[0].value.trim(), v: inputs[1].value.trim() };
  }).filter(s => s.k || s.v);
}

// ─── Use Cases ────────────────────────────────────────────────────────────────
function renderUseCaseTags(arr) {
  document.getElementById('useCaseTags').innerHTML = arr.map((t, i) => `
    <span class="tag">${esc(t)}<button class="tag-rm" onclick="removeTag(${i})">×</button></span>`).join('');
}
function getUseCaseTags() {
  return [...document.querySelectorAll('#useCaseTags .tag')]
    .map(el => el.childNodes[0].textContent.trim()).filter(Boolean);
}
function handleTagKey(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const inp = document.getElementById('useCaseInput');
  const val = inp.value.trim();
  if (!val) return;
  const tags = getUseCaseTags(); tags.push(val);
  renderUseCaseTags(tags); inp.value = '';
}
function removeTag(i) { const t = getUseCaseTags(); t.splice(i,1); renderUseCaseTags(t); }

// ─── Field Visibility Toggles ────────────────────────────────────────────────
const EYE_OPEN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_SHUT = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function renderVisibilityToggles(hiddenFields) {
  document.querySelectorAll('.vis-toggle').forEach(e => e.remove());
  document.querySelectorAll('.field-hidden').forEach(e => e.classList.remove('field-hidden'));
  Object.entries(HIDEABLE_FIELD_MAP).forEach(([inputId, fieldKey]) => {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const fieldDiv = inp.closest('.field');
    const lbl = fieldDiv?.querySelector('label');
    if (!lbl) return;
    const hidden = hiddenFields.includes(fieldKey);
    if (hidden) fieldDiv.classList.add('field-hidden');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vis-toggle';
    btn.dataset.field = fieldKey;
    btn.title = hidden ? 'Hidden on main site — click to show' : 'Visible on main site — click to hide';
    btn.innerHTML = hidden ? EYE_SHUT : EYE_OPEN;
    btn.onclick = () => toggleFieldVisibility(fieldKey);
    lbl.appendChild(btn);
  });
}

function toggleFieldVisibility(fieldKey) {
  const inputId = Object.keys(HIDEABLE_FIELD_MAP).find(k => HIDEABLE_FIELD_MAP[k] === fieldKey);
  const inp = document.getElementById(inputId);
  const fieldDiv = inp?.closest('.field');
  if (!fieldDiv) return;
  const nowHidden = !fieldDiv.classList.contains('field-hidden');
  fieldDiv.classList.toggle('field-hidden', nowHidden);
  const btn = fieldDiv.querySelector('.vis-toggle');
  if (btn) { btn.innerHTML = nowHidden ? EYE_SHUT : EYE_OPEN; btn.title = nowHidden ? 'Hidden on main site — click to show' : 'Visible on main site — click to hide'; }
}

function getHiddenFields() {
  const hidden = [];
  Object.entries(HIDEABLE_FIELD_MAP).forEach(([inputId, fieldKey]) => {
    const inp = document.getElementById(inputId);
    if (inp?.closest('.field')?.classList.contains('field-hidden')) hidden.push(fieldKey);
  });
  return hidden;
}
