// ─── Load ─────────────────────────────────────────────────────────────────────
async function loadData() {
  showScreen('loading');
  const accs = msalInst.getAllAccounts();
  if (!accs.length) { showScreen('login'); return; }

  const email   = (accs[0].username || '').toLowerCase();
  const allowed = (CFG.allowedEmails || []).map(e => e.toLowerCase());
  if (allowed.length && !allowed.includes(email)) {
    msalInst.logoutPopup({ account: accs[0] }).catch(() => {});
    document.getElementById('loginErr').textContent = `Access denied — ${email} is not an authorised account.`;
    showScreen('login');
    return;
  }

  document.getElementById('headerUser').textContent = accs[0].name || accs[0].username || '';
  try {
    await resolveFolder();
    await loadAdminConfig();
    await readExcel();
    renderSidebar();
    showScreen('dash');
    switchTab('dashboard');
    renderDashboard(accs[0]);
    updateTokenBanner();
    fetchRateLimit();
  } catch(e) {
    showToast('Load error: ' + (e.message || 'unknown error'), 'err');
    showScreen('login');
  }
}

let _dashInterval = null;

function renderDashboard(account) {
  document.getElementById('dashUserName').textContent  = account.name     || account.username || '';
  document.getElementById('dashUserEmail').textContent = account.username || '';

  function tick() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
    const dateStr = now.toLocaleDateString('en-US',  { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const ce = document.getElementById('dashClock');
    const de = document.getElementById('dashDate');
    if (ce) ce.textContent = timeStr;
    if (de) de.textContent = dateStr;
  }
  tick();
  clearInterval(_dashInterval);
  _dashInterval = setInterval(tick, 1000);
}


// ─── Save Product ─────────────────────────────────────────────────────────────
async function saveProduct() {
  const p = collectForm();
  if (!p.id)   { showToast('Product ID is required', 'err'); return; }
  if (!p.name) { showToast('Display name is required', 'err'); return; }
  if (/\s/.test(p.id)) { showToast('Product ID must not contain spaces', 'err'); return; }
  if (products.some(x => x.id === p.id && x.id !== selectedId)) { showToast(`Product ID "${p.id}" is already in use — choose a unique ID`, 'err'); return; }

  const lookupIdEarly = selectedId ?? p.id;
  if (p.order !== null) {
    const duplicate = products.find(x => x.id !== lookupIdEarly && x.order === p.order);
    if (duplicate) {
      showToast(`Sort order ${p.order} is already used by "${duplicate.name}" — choose a different number`, 'err');
      return;
    }
  }

  p.variants = getVariantsFromEditor();

  const pendingImgCount = pendingImgs.length;
  const hadPendingDs    = !!pendingDs;

  showOverlay('Uploading images…');

  const newImageUrls = [];
  for (const pi of pendingImgs) {
    try {
      const ext  = pi.file.name.split('.').pop().toLowerCase();
      const name = `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;
      const url  = await pushFileToGitHub(`assets/images/${name}`, await pi.file.arrayBuffer(), `Add image ${name}`);
      newImageUrls.push(url);
    } catch(e) { showToast('Image upload failed: ' + e.message, 'err'); hideOverlay(); return; }
  }

  if (pendingDs) {
    updateOverlay('Uploading datasheet…');
    try {
      const name = `${p.id}-datasheet.pdf`;
      currentDs = await pushFileToGitHub(`assets/datasheets/${name}`, await pendingDs.arrayBuffer(), `Add datasheet ${name}`);
    } catch(e) { showToast('Datasheet upload failed: ' + e.message, 'err'); hideOverlay(); return; }
  }

  p.images    = [...currentImgs, ...newImageUrls];
  p.datasheet = currentDs || null;

  for (const pd of pendingPartDs) {
    updateOverlay(`Uploading datasheet for ${pd.partNo}…`);
    try {
      const safeName = pd.partNo.replace(/[^a-zA-Z0-9\-_.]/g, '_');
      const name = `${p.id}-${safeName}.pdf`;
      const url  = await pushFileToGitHub(`assets/datasheets/${name}`, await pd.file.arrayBuffer(), `Add part datasheet ${name}`);
      currentPartDs[pd.partNo] = url;
    } catch(e) { showToast('Part datasheet upload failed: ' + e.message, 'err'); hideOverlay(); return; }
  }
  p.part_datasheets = { ...currentPartDs };

  // Re-read latest Gist data before writing so we don't overwrite concurrent changes by others.
  updateOverlay('Syncing latest data…');
  try { await readFromGist(); } catch {}

  const lookupId = selectedId ?? p.id;
  if (p.order !== null) {
    const dupeAfterSync = products.find(x => x.id !== lookupId && x.order === p.order);
    if (dupeAfterSync) {
      showToast(`Sort order ${p.order} conflicts with "${dupeAfterSync.name}" — choose a different number`, 'err');
      hideOverlay();
      return;
    }
  }

  const idx        = products.findIndex(x => x.id === lookupId);
  const isNew      = idx < 0;
  const oldProduct = idx >= 0 ? { ...products[idx] } : null;
  if (idx >= 0) {
    products[idx] = p;
  } else {
    products.push(p);
  }
  products.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  updateOverlay('Saving to Excel…');
  try { await writeExcel(); } catch(e) { showToast('Excel save failed: ' + e.message, 'err'); hideOverlay(); return; }

  updateOverlay('Publishing…');
  try { await writeJson(); } catch(e) { showToast('Publish failed: ' + e.message, 'err'); hideOverlay(); return; }

  pendingImgs   = [];
  pendingDs     = null;
  isDirty = false;
  pendingPartDs = [];
  selectedId  = p.id;
  renderSidebar();
  hideOverlay();
  showToast('Saved and published!', 'ok');
  const { summary, diff } = diffProduct(oldProduct, p, pendingImgCount, hadPendingDs);
  logChange(isNew ? 'Added product' : 'Updated product', p.name + ' (' + p.id + ')', summary, diff);
}

// ─── Delete Product ───────────────────────────────────────────────────────────
async function deleteProduct() {
  if (!selectedId) return;
  const p = products.find(x => x.id === selectedId);
  if (!p || !confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
  showOverlay('Deleting…');
  try { await readFromGist(); } catch {}
  products = products.filter(x => x.id !== selectedId);
  try { await writeExcel(); await writeJson(); }
  catch(e) { showToast('Delete failed: ' + e.message, 'err'); hideOverlay(); return; }
  selectedId = null;
  hideEditForm();
  renderSidebar();
  hideOverlay();
  showToast('Product deleted', 'ok');
  logChange('Deleted product', p.name + ' (' + p.id + ')');
}

// ─── Save Categories ──────────────────────────────────────────────────────────
async function saveCats() {
  const inputs = [...document.querySelectorAll('.cat-row-input')];
  // Snapshot colour selections by name before readFromGist can overwrite catColorIndices
  const colorByName = {};
  inputs.forEach((inp, i) => { const n = inp.value.trim(); if (n) colorByName[n] = catColorIndices[i] ?? 4; });

  showOverlay('Saving categories…');
  try {
    try { await readFromGist(); } catch {}
    cats = inputs.map(i => i.value.trim()).filter(c => c && c.toLowerCase() !== 'all');

    // Rebuild catColorIndices + catColors from snapshot
    catColorIndices = cats.map(name => colorByName[name] ?? _colorToPaletteIdx(LEGACY_CAT_COLORS[name]));
    catColors = {};
    cats.forEach((name, i) => {
      const p = CAT_COLOR_PALETTE[catColorIndices[i] ?? 4];
      catColors[name] = { bg: p.bg, fg: p.fg };
    });

    await writeExcel(); await writeJson(); renderSidebar(); renderCatDropdown(); hideOverlay();
    showToast('Categories saved!', 'ok');
    logChange('Updated categories', cats.slice(0, 6).join(', ') + (cats.length > 6 ? '…' : ''));
  }
  catch(e) { showToast('Save failed: ' + e.message, 'err'); hideOverlay(); }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function renderSidebar() {
  const safeCats = cats.filter(c => c.toLowerCase() !== 'all');
  document.getElementById('catPills').innerHTML = ['', ...safeCats].map(c => `
    <button class="cat-pill ${sidebarCat === c ? 'active' : ''}"
      onclick="setSidebarCat('${esc(c)}')">${c || 'All'}</button>`).join('');

  const q  = (document.getElementById('sideSearch')?.value || '').toLowerCase();
  const fp = products.filter(p =>
    (!sidebarCat || p.cat === sidebarCat) &&
    (!q || (p.name||'').toLowerCase().includes(q) || (p.id||'').toLowerCase().includes(q)));
  document.getElementById('productList').innerHTML = fp.length
    ? fp.map(p => `<div class="product-item ${p.id === selectedId ? 'active' : ''}" onclick="selectProduct('${esc(p.id)}')">
        <div class="product-item-name">${esc(p.name || p.id)}</div>
        <div class="product-item-cat">${esc(p.cat || '—')}</div></div>`).join('')
    : '<div style="padding:16px;color:#9ca3af;font-size:13px;text-align:center">No products</div>';
}

function setSidebarCat(c) { sidebarCat = c; renderSidebar(); }

// ─── Product Form ─────────────────────────────────────────────────────────────
function selectProduct(id) {
  if (isDirty) {
    showConfirm('You have unsaved changes. Discard them?', () => {
      isDirty = false;
      selectProduct(id);
    });
    return;
  }
  selectedId = id;
  const p = products.find(x => x.id === id);
  if (!p) return;
  renderSidebar();
  populateForm(p);
  document.getElementById('noSelection').style.display = 'none';
  document.getElementById('editForm').style.display = 'block';
  switchTab('products');
}

// ─── Categories Panel ─────────────────────────────────────────────────────────
function _colorDropOptions(selPi, onclickFn) {
  return CAT_COLOR_PALETTE.map((p, pi) =>
    `<button class="cat-color-option${pi === selPi ? ' selected' : ''}" style="background:${p.bg};color:${p.fg}" onclick="${onclickFn(pi)}">${p.label}</button>`
  ).join('');
}
function toggleCatColorDrop(dropId) {
  const drop = document.getElementById(dropId);
  if (!drop) return;
  const isOpen = drop.classList.contains('open');
  document.querySelectorAll('.cat-color-drop.open').forEach(d => d.classList.remove('open'));
  if (!isOpen) drop.classList.add('open');
}
function renderCatList() {
  document.getElementById('catList').innerHTML = cats.map((c, i) => {
    const pi = catColorIndices[i] ?? 4;
    const p  = CAT_COLOR_PALETTE[pi];
    return `
    <div class="cat-row">
      <div class="cat-row-top">
        <input class="cat-row-input" type="text" value="${esc(c)}">
        <div class="cat-color-select">
          <button class="cat-color-btn" style="background:${p.bg};color:${p.fg}" onclick="toggleCatColorDrop('catDrop${i}')">${p.label} &#9662;</button>
          <div class="cat-color-drop" id="catDrop${i}">
            ${_colorDropOptions(pi, pi2 => `setCatColor(${i},${pi2})`)}
          </div>
        </div>
        <button class="cat-rm" onclick="removeCat(${i})">×</button>
      </div>
    </div>`;
  }).join('');
  _renderNewCatColorPicker();
}
function _renderNewCatColorPicker() {
  const el = document.getElementById('newCatColorSelect');
  if (!el) return;
  const p = CAT_COLOR_PALETTE[_newCatColorIdx];
  el.innerHTML = `
    <button class="cat-color-btn" style="background:${p.bg};color:${p.fg}" onclick="toggleCatColorDrop('newCatDrop')">${p.label} &#9662;</button>
    <div class="cat-color-drop" id="newCatDrop">
      ${_colorDropOptions(_newCatColorIdx, pi => `setNewCatColor(${pi})`)}
    </div>`;
}
function setCatColor(catIdx, paletteIdx) {
  catColorIndices[catIdx] = paletteIdx;
  document.querySelectorAll('.cat-color-drop.open').forEach(d => d.classList.remove('open'));
  renderCatList();
}
function setNewCatColor(paletteIdx) {
  _newCatColorIdx = paletteIdx;
  document.querySelectorAll('.cat-color-drop.open').forEach(d => d.classList.remove('open'));
  _renderNewCatColorPicker();
}
function addCat() {
  const inp = document.getElementById('newCatInput');
  const val = inp.value.trim(); if (!val) return;
  if (val.toLowerCase() === 'all') { showToast('"All" is reserved — it is added automatically', 'err'); return; }
  cats.push(val);
  catColorIndices.push(_newCatColorIdx);
  renderCatList();
  inp.value = '';
}
function removeCat(i) { cats.splice(i,1); catColorIndices.splice(i,1); renderCatList(); }
