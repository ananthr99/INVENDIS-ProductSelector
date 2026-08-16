// ─── Setup Panel ─────────────────────────────────────────────────────────────
function showGistInfo(id, rawUrl) {
  document.getElementById('gistIdBox').textContent  = id;
  document.getElementById('gistUrlBox').textContent = rawUrl;
  document.getElementById('gistInfoSection').style.display = 'block';
  document.getElementById('gistStatusMsg').textContent = 'Gist created! Copy the values below into js/onedrive-config.js:';
  switchTab('setup');
}

async function getPublicJsonUrl() {
  showOverlay('Getting public URL…');
  try {
    const url = await createLink(`${FOLDER}/products.json`);
    document.getElementById('publicUrlText').textContent = url;
    document.getElementById('publicUrlBox').style.display = 'block';
    hideOverlay();
    showToast('URL ready — copy it into onedrive-config.js', 'ok');
  } catch(e) { hideOverlay(); showToast('Could not get URL (publish first): ' + e.message, 'err'); }
}
function renderSetupStatus() {
  document.getElementById('setupFolder').textContent = FOLDER;
  const hasCid   = !!(CFG.clientId && CFG.clientId !== 'YOUR_CLIENT_ID');
  const hasToken = !!getGithubToken();
  const hasGist  = !!CFG.gistId;
  const hasUrl   = !!CFG.productsJsonUrl;

  const ghTokenStatus = document.getElementById('ghTokenStatus');
  if (ghTokenStatus) ghTokenStatus.textContent = hasToken ? 'Token set — auto-loads on future sign-ins from any browser.' : 'No token saved yet — enter it above and click Save.';
  const hasGHRepo = !!(CFG.githubOwner && CFG.githubRepo);
  document.getElementById('dotConfig').className      = 'dot ' + (hasCid ? 'ok' : 'warn');
  document.getElementById('statusConfig').textContent = hasCid ? 'Azure App Registration configured' : 'clientId not set in js/onedrive-config.js';
  document.getElementById('dotGH').className          = 'dot ' + (hasGHRepo ? 'ok' : 'warn');
  document.getElementById('statusGH').textContent     = hasGHRepo
    ? `GitHub repo: ${CFG.githubOwner}/${CFG.githubRepo} — images & datasheets upload here`
    : 'githubOwner / githubRepo not set — image and datasheet uploads will fail';
  document.getElementById('dotUrl').className         = 'dot ' + (hasUrl ? 'ok' : 'warn');
  document.getElementById('statusUrl').textContent    = hasUrl ? 'productsJsonUrl set — main site loads live data' : 'productsJsonUrl not set — main site uses static data';

  const gistMsg = document.getElementById('gistStatusMsg');
  if (!hasToken) {
    gistMsg.textContent = 'GitHub token not set — enter it in the GitHub Token section above and click Save.';
  } else if (!hasGist) {
    gistMsg.textContent = 'Token configured. Click "Save & Publish" on any product to create the Gist and get your URL.';
  } else if (hasUrl) {
    gistMsg.textContent = 'Gist connected — every Save & Publish updates the live site automatically.';
  } else {
    gistMsg.textContent = 'Gist ID set but productsJsonUrl is missing — copy the raw URL into onedrive-config.js.';
  }
}

function updateTokenBanner() {
  const banner = document.getElementById('tokenBanner');
  if (banner) banner.style.display = getGithubToken() ? 'none' : 'flex';
}

// ─── Activity Log ─────────────────────────────────────────────────────────────
function diffProduct(old, neu, imgCount, hadDs) {
  if (!old) {
    const parts = [];
    if (neu.cat)   parts.push(`Category: ${neu.cat}`);
    if (imgCount)  parts.push(`+${imgCount} image${imgCount > 1 ? 's' : ''}`);
    if (hadDs)     parts.push('with datasheet');
    return parts.join(' · ');
  }
  const changes = [];
  const fields = [
    ['name','Name'],['cat','Category'],['cpu','CPU'],['ram','RAM'],
    ['storage','Storage'],['cell','Cellular'],['cellular_gen','Cellular gen'],
    ['wifi','Wi-Fi'],['ip','IP'],['power','Power'],['ports','Ports'],
    ['os','OS'],['housing','Housing'],['dims','Dimensions'],
    ['weight','Weight'],['op_temp','Op. temp']
  ];
  for (const [k, label] of fields) {
    const ov = String(old[k] ?? '');
    const nv = String(neu[k] ?? '');
    if (ov !== nv) changes.push(`${label}: ${ov || '—'} → ${nv || '—'}`);
  }
  if (String(old.desc || '') !== String(neu.desc || '')) changes.push('Description updated');
  if (!!old.rs485 !== !!neu.rs485) changes.push(`RS485: ${neu.rs485 ? 'enabled' : 'disabled'}`);
  if (!!old.rs232 !== !!neu.rs232) changes.push(`RS232: ${neu.rs232 ? 'enabled' : 'disabled'}`);
  if (imgCount > 0) changes.push(`+${imgCount} image${imgCount > 1 ? 's' : ''}`);
  const removedImgs = (old.images || []).length - ((neu.images || []).length - imgCount);
  if (removedImgs > 0) changes.push(`-${removedImgs} image${removedImgs > 1 ? 's' : ''}`);
  if (hadDs) changes.push('datasheet updated');
  else if (old.datasheet && !neu.datasheet) changes.push('datasheet removed');
  const oldUC = old.use_cases || [], newUC = neu.use_cases || [];
  const addedUC = newUC.filter(u => !oldUC.includes(u));
  const removedUC = oldUC.filter(u => !newUC.includes(u));
  if (addedUC.length)   changes.push(`+use case: ${addedUC.join(', ')}`);
  if (removedUC.length) changes.push(`-use case: ${removedUC.join(', ')}`);
  const out = changes.join(' · ');
  return out.length > 300 ? out.slice(0, 297) + '…' : out;
}

async function logChange(action, detail, changes) {
  const token = getGithubToken();
  if (!token || !CFG.gistId) return;
  try {
    let entries = [];
    try {
      const r = await fetch(`https://api.github.com/gists/${CFG.gistId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        const d = await r.json();
        const c = d.files?.['changelog.json']?.content;
        if (c) entries = JSON.parse(c);
      }
    } catch {}
    const user = (msalInst.getAllAccounts()[0]?.username || 'unknown').toLowerCase();
    entries.unshift({ ts: new Date().toISOString(), user, action, detail: detail || '', changes: changes || '' });
    if (entries.length > 500) entries = entries.slice(0, 500);
    await fetch(`https://api.github.com/gists/${CFG.gistId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { 'changelog.json': { content: JSON.stringify(entries, null, 2) } } })
    });
  } catch {}
}

async function loadChangelog() {
  const el = document.getElementById('changelogContent');
  if (!el) return;
  el.innerHTML = '<p style="color:#9ca3af;font-size:13px">Loading…</p>';
  try {
    if (!CFG.gistId) throw new Error('Gist not configured yet — publish a product first');
    const _tok = getGithubToken();
    const r = await fetch(`https://api.github.com/gists/${CFG.gistId}`,
      _tok ? { headers: { Authorization: `Bearer ${_tok}` } } : {}
    );
    if (!r.ok) throw new Error(`Could not fetch activity log (${r.status})`);
    const d = await r.json();
    const c = d.files?.['changelog.json']?.content;
    renderChangelog(c ? JSON.parse(c) : []);
  } catch(e) {
    el.innerHTML = `<p style="color:#dc2626;font-size:13px">${esc(e.message)}</p>`;
  }
}

function renderChangelog(entries) {
  const toolbar = document.getElementById('logToolbar');
  const filters = document.getElementById('logFilters');
  const paging  = document.getElementById('logPagination');
  if (!entries.length) {
    document.getElementById('changelogContent').innerHTML =
      '<p style="color:#9ca3af;font-size:13px">No activity recorded yet — changes will appear here after the first save.</p>';
    toolbar.style.display = 'none';
    if (filters) filters.style.display = 'none';
    if (paging)  paging.style.display  = 'none';
    return;
  }
  _allLogEntries = entries;
  _logPage       = 1;
  _logFilter     = { q: '', user: '', when: '', type: '' };
  document.getElementById('logSearchInput').value = '';
  document.getElementById('logUserFilter').value  = '';
  document.getElementById('logWhenFilter').value  = '';
  document.getElementById('logTypeFilter').value  = '';
  const users = [...new Set(entries.map(e => e.user).filter(Boolean))].sort();
  document.getElementById('logUserFilter').innerHTML =
    '<option value="">All users</option>' +
    users.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
  toolbar.style.display = 'flex';
  if (filters) filters.style.display = 'flex';
  document.getElementById('logSelectAll').checked = false;
  applyLogFilters();
}

function setLogFilter(key, val) {
  _logFilter[key] = val;
  _logPage = 1;
  applyLogFilters();
}

function clearLogFilters() {
  _logFilter = { q: '', user: '', when: '', type: '' };
  _logPage   = 1;
  document.getElementById('logSearchInput').value = '';
  document.getElementById('logUserFilter').value  = '';
  document.getElementById('logWhenFilter').value  = '';
  document.getElementById('logTypeFilter').value  = '';
  applyLogFilters();
}

function applyLogFilters() {
  const { q, user, when, type } = _logFilter;
  const now          = Date.now();
  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
  const startOfYest  = new Date(startOfToday - 86400000);

  const filtered = _allLogEntries
    .map((e, origIdx) => ({ e, origIdx }))
    .filter(({ e }) => {
      if (user && e.user !== user) return false;
      if (type) {
        const a = (e.action || '').toLowerCase();
        if (type === 'added'      && !a.includes('add'))     return false;
        if (type === 'updated'    && !a.includes('updat'))   return false;
        if (type === 'deleted'    && !a.includes('delet'))   return false;
        if (type === 'categories' && !a.includes('categor')) return false;
      }
      if (when) {
        const ts = new Date(e.ts);
        if (when === 'today'     && ts < startOfToday) return false;
        if (when === 'yesterday' && (ts < startOfYest || ts >= startOfToday)) return false;
        if (when === 'week'      && ts < new Date(now - 7  * 86400000)) return false;
        if (when === 'month'     && ts < new Date(now - 30 * 86400000)) return false;
      }
      if (q) {
        const ql = q.toLowerCase();
        if (![(e.user||''),(e.action||''),(e.detail||''),(e.changes||'')]
              .some(s => s.toLowerCase().includes(ql))) return false;
      }
      return true;
    });

  _renderLogPage(filtered);
}

function _renderLogPage(filtered) {
  const el         = document.getElementById('changelogContent');
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE));
  if (_logPage > totalPages) _logPage = totalPages;

  if (!total) {
    el.innerHTML = '<p style="color:#9ca3af;font-size:13px">No entries match the current filters.</p>';
    _renderLogPagination(0, 0);
    return;
  }

  const page           = filtered.slice((_logPage - 1) * LOG_PAGE_SIZE, _logPage * LOG_PAGE_SIZE);
  const todayLabel     = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  const yesterdayLabel = new Date(Date.now() - 86400000).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  const groups = {};
  page.forEach(({ e, origIdx }) => {
    const raw     = new Date(e.ts).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    const display = raw === todayLabel ? 'Today' : raw === yesterdayLabel ? 'Yesterday' : raw;
    if (!groups[display]) groups[display] = [];
    groups[display].push({ e, origIdx });
  });
  el.innerHTML = Object.entries(groups).map(([label, items]) => `
    <div class="log-date-group">
      <div class="log-date-label">${label}</div>
      ${items.map(({ e, origIdx }) => {
        const time = new Date(e.ts).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
        return `<div class="log-entry">
          <input type="checkbox" class="log-entry-cb" data-idx="${origIdx}">
          <div class="log-entry-dot" style="margin-top:4px"></div>
          <div class="log-body">
            <div class="log-action">${esc(e.action)}${e.detail ? ' — ' + esc(e.detail) : ''}</div>
            ${e.changes ? `<div class="log-changes">${esc(e.changes)}</div>` : ''}
            <div class="log-meta-row">${esc(e.user)} · ${time}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');
  _renderLogPagination(totalPages, total);
  document.getElementById('logSelectAll').checked = false;
}

function _renderLogPagination(totalPages, total) {
  const el = document.getElementById('logPagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; el.style.display = 'none'; return; }
  const start = (_logPage - 1) * LOG_PAGE_SIZE + 1;
  const end   = Math.min(_logPage * LOG_PAGE_SIZE, total);
  el.style.display = 'flex';
  el.innerHTML = `
    <span class="log-page-info">Showing ${start}–${end} of ${total}</span>
    <div class="log-page-btns">
      <button class="log-pg-btn" onclick="goLogPage(${_logPage - 1})" ${_logPage === 1 ? 'disabled' : ''}>&#8249;</button>
      <span class="log-page-cur">${_logPage} / ${totalPages}</span>
      <button class="log-pg-btn" onclick="goLogPage(${_logPage + 1})" ${_logPage === totalPages ? 'disabled' : ''}>&#8250;</button>
    </div>`;
}

function goLogPage(p) {
  _logPage = p;
  applyLogFilters();
}

function toggleSelectAllLogs(checked) {
  document.querySelectorAll('.log-entry-cb').forEach(cb => cb.checked = checked);
}

async function deleteSelectedLogs() {
  const checked = [...document.querySelectorAll('.log-entry-cb:checked')];
  if (!checked.length) { showToast('Select entries to delete first', 'err'); return; }
  if (!confirm(`Delete ${checked.length} selected log ${checked.length === 1 ? 'entry' : 'entries'}?`)) return;
  const indices = new Set(checked.map(cb => Number(cb.dataset.idx)));
  const token = getGithubToken();
  if (!token || !CFG.gistId) { showToast('GitHub token required', 'err'); return; }
  showOverlay('Deleting selected logs…');
  try {
    const r = await fetch(`https://api.github.com/gists/${CFG.gistId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      cache: 'no-store'
    });
    if (!r.ok) throw new Error(`Fetch failed (${r.status})`);
    const d = await r.json();
    const c = d.files?.['changelog.json']?.content;
    const filtered = (c ? JSON.parse(c) : []).filter((_, i) => !indices.has(i));
    await patchChangelog(filtered);
    hideOverlay();
    renderChangelog(filtered);
    showToast(`Deleted ${indices.size} log ${indices.size === 1 ? 'entry' : 'entries'}`, 'ok');
  } catch(e) {
    hideOverlay();
    showToast('Delete failed: ' + e.message, 'err');
  }
}

async function deleteAllLogs() {
  if (!confirm('Delete all activity log entries? This cannot be undone.')) return;
  const token = getGithubToken();
  if (!token || !CFG.gistId) { showToast('GitHub token required', 'err'); return; }
  showOverlay('Clearing activity log…');
  try {
    await patchChangelog([]);
    hideOverlay();
    renderChangelog([]);
    showToast('Activity log cleared', 'ok');
  } catch(e) {
    hideOverlay();
    showToast('Failed: ' + e.message, 'err');
  }
}

async function patchChangelog(entries) {
  const token = getGithubToken();
  const res = await fetch(`https://api.github.com/gists/${CFG.gistId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: { 'changelog.json': { content: JSON.stringify(entries, null, 2) } } })
  });
  if (!res.ok) throw new Error(`Gist PATCH failed (${res.status})`);
}

// ─── Manual Sync (Repo → Gist) ───────────────────────────────────────────────
async function loadSyncComparison() {
  const panel = document.getElementById('syncDiffPanel');
  const btn   = document.getElementById('btnOverwriteGist');
  const btn2  = document.getElementById('btnOverwriteRepo');
  panel.innerHTML = '<p style="color:#9ca3af;font-size:13px">Loading…</p>';
  panel.style.display = 'block';
  btn.style.display = 'none';
  btn2.style.display = 'none';
  _syncRepoJson = null;
  _syncGistJson = null;
  const token = getGithubToken();
  if (!token || !CFG.gistId || !CFG.githubOwner || !CFG.githubRepo) {
    panel.innerHTML = '<p style="color:#dc2626;font-size:13px">GitHub token, Gist ID, and repo config all required.</p>';
    return;
  }
  try {
    const [gistRes, repoRes] = await Promise.all([
      fetch(`https://api.github.com/gists/${CFG.gistId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, cache: 'no-store'
      }),
      fetch(`https://api.github.com/repos/${CFG.githubOwner}/${CFG.githubRepo}/contents/data/products.json`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, cache: 'no-store'
      })
    ]);
    if (!gistRes.ok) throw new Error(`Gist fetch failed (${gistRes.status})`);
    if (!repoRes.ok) throw new Error(`Repo file fetch failed (${repoRes.status})`);
    const gistJson  = await gistRes.json();
    const repoJson  = await repoRes.json();
    const gistContent = gistJson.files?.['products.json']?.content;
    if (!gistContent) throw new Error('products.json not found in Gist');
    const repoBase64  = repoJson.content.replace(/\n/g, '');
    const repoBytes   = Uint8Array.from(atob(repoBase64), c => c.charCodeAt(0));
    const repoContent = new TextDecoder().decode(repoBytes);
    _syncRepoJson = repoContent;
    _syncGistJson = gistContent;
    renderSyncDiff(panel, btn, btn2, JSON.parse(gistContent), JSON.parse(repoContent), gistJson.updated_at);
  } catch(e) {
    panel.innerHTML = `<p style="color:#dc2626;font-size:13px">${esc(e.message)}</p>`;
  }
}

function renderSyncDiff(panel, btn, btn2, gistData, repoData, gistUpdatedAt) {
  const rows = [];
  if (JSON.stringify(gistData.cats||[]) !== JSON.stringify(repoData.cats||[])) {
    rows.push({ badge:'mod', label:'Categories',
      detail:`Gist: [${(gistData.cats||[]).join(', ')}]  →  Repo: [${(repoData.cats||[]).join(', ')}]` });
  }
  const gistMap = Object.fromEntries((gistData.products||[]).map(p => [p.id, p]));
  const repoMap = Object.fromEntries((repoData.products||[]).map(p => [p.id, p]));
  for (const id of new Set([...Object.keys(gistMap), ...Object.keys(repoMap)])) {
    const g = gistMap[id], r = repoMap[id];
    if (g && !r) {
      rows.push({ badge:'rem', label: g.name||id, detail:'In Gist only — will be removed by overwrite' });
    } else if (!g && r) {
      rows.push({ badge:'add', label: r.name||id, detail:'In repo only — will be added by overwrite' });
    } else {
      const fields = ['name','cat','desc','cpu','ram','storage','cell','cellular_gen','wifi','rs485','rs232','ip','power','ports','os','housing','dims','weight','op_temp'];
      const changed = fields.filter(f => String(g[f]??'') !== String(r[f]??''));
      if (JSON.stringify(g.images||[]) !== JSON.stringify(r.images||[])) changed.push('images');
      if (JSON.stringify(g.use_cases||[]) !== JSON.stringify(r.use_cases||[])) changed.push('use_cases');
      if (String(g.datasheet||'') !== String(r.datasheet||'')) changed.push('datasheet');
      if (changed.length) rows.push({ badge:'mod', label: g.name||id, detail:'Changed: ' + changed.join(', ') });
    }
  }
  const gistTime = gistUpdatedAt ? new Date(gistUpdatedAt).toLocaleString() : '—';
  let html = `<p style="font-size:12px;color:#6b7280;margin-bottom:8px">
    Gist updated: <strong>${gistTime}</strong> &nbsp;·&nbsp;
    Gist: <strong>${(gistData.products||[]).length} products</strong> &nbsp;·&nbsp;
    Repo: <strong>${(repoData.products||[]).length} products</strong></p>`;
  if (!rows.length) {
    html += `<div class="sync-diff"><div class="sync-diff-row">
      <span class="sync-diff-badge s-ok">IN SYNC</span>
      <div class="sync-diff-name" style="color:#1e40af">Gist and repo are identical — no action needed</div>
    </div></div>`;
    btn.style.display = 'none';
  } else {
    html += `<div class="sync-diff">` + rows.map(row => `
      <div class="sync-diff-row">
        <span class="sync-diff-badge ${row.badge==='add'?'s-add':row.badge==='rem'?'s-rem':'s-mod'}">${row.badge==='add'?'REPO ONLY':row.badge==='rem'?'GIST ONLY':'MODIFIED'}</span>
        <div>
          <div class="sync-diff-name">${esc(row.label)}</div>
          <div class="sync-diff-detail">${esc(row.detail)}</div>
        </div>
      </div>`).join('') + `</div>`;
    btn.style.display = 'block';
    btn2.style.display = 'block';
  }
  panel.innerHTML = html;
}

async function overwriteGistFromRepo() {
  if (!_syncRepoJson) { showToast('Load comparison first', 'err'); return; }
  if (!confirm('Overwrite the live Gist with repo content? The main site will immediately reflect the repo data.')) return;
  showOverlay('Overwriting Gist…');
  try {
    await pushToGist(_syncRepoJson);
    lastGistJson  = _syncRepoJson;
    const repoData = JSON.parse(_syncRepoJson);
    _syncRepoJson = null;
    _syncGistJson = null;
    hideOverlay();
    const panel = document.getElementById('syncDiffPanel');
    const btn   = document.getElementById('btnOverwriteGist');
    const btn2  = document.getElementById('btnOverwriteRepo');
    btn.style.display  = 'none';
    btn2.style.display = 'none';
    panel.style.display = 'block';
    renderSyncDiff(panel, btn, btn2, repoData, repoData, new Date().toISOString());
    showToast('Gist overwritten with repo content', 'ok');
    try { await readFromGist(); renderSidebar(); } catch {}
  } catch(e) {
    hideOverlay();
    showToast('Overwrite failed: ' + e.message, 'err');
  }
}

async function overwriteRepoFromGist() {
  if (!_syncGistJson) { showToast('Load comparison first', 'err'); return; }
  if (!confirm('Overwrite repo data/products.json and OneDrive products.xlsx with Gist content?')) return;

  const parsed = JSON.parse(_syncGistJson);
  products  = (parsed.products || []).sort((a, b) => a.order - b.order);
  cats      = parsed.cats || [];
  if (parsed.dropdowns) dropdowns = { ...DEFAULT_DROPDOWNS, ...parsed.dropdowns };

  showOverlay('Updating OneDrive…');
  try { await writeExcel(); } catch(e) { showToast('Excel update failed: ' + e.message, 'err'); hideOverlay(); return; }

  updateOverlay('Pushing to repo…');
  try {
    const bytes = new TextEncoder().encode(_syncGistJson);
    await pushFileToGitHub('data/products.json', bytes.buffer, 'Sync products.json from Gist');
  } catch(e) { showToast('Repo update failed: ' + e.message, 'err'); hideOverlay(); return; }

  _syncRepoJson = null;
  _syncGistJson = null;
  hideOverlay();

  const panel = document.getElementById('syncDiffPanel');
  const btn   = document.getElementById('btnOverwriteGist');
  const btn2  = document.getElementById('btnOverwriteRepo');
  btn.style.display  = 'none';
  btn2.style.display = 'none';
  panel.style.display = 'block';
  renderSyncDiff(panel, btn, btn2, parsed, parsed, null);

  renderSidebar();
  showToast('OneDrive and repo updated from Gist', 'ok');
}

// ─── Field Options Editor ─────────────────────────────────────────────────────
function renderDropdownEditor() {
  const el = document.getElementById('dropdownEditor');
  if (!el) return;

  function chipList(field) {
    const opts = dropdowns[field] || [];
    return opts.map((o, i) => {
      const inUse = products.filter(p => p[field] === o).length;
      return `<span class="dd-chip">
        <span class="dd-chip-label" onclick="renameOption('${field}',${i})" title="Click to rename">${esc(o)}</span>
        <button class="dd-chip-del" onclick="removeOption('${field}',${i},${inUse})" title="${inUse} product(s) use this value">×</button>
      </span>`;
    }).join('');
  }

  // Section 1: all current dropdown fields
  const ddCards = Object.keys(dropdowns).map(field => {
    const isBuiltin = !!DEFAULT_DROPDOWNS[field];
    const label = DROPDOWN_FIELD_LABELS[field] || CONVERTIBLE_TEXT_FIELDS[field]?.label || field;
    const revertBtn = isBuiltin ? '' :
      `<button class="btn-revert-text" onclick="revertToText('${field}')">Revert to text</button>`;
    return `
      <div class="dd-card">
        <div class="dd-card-header"><div class="dd-card-title">${label}</div>${revertBtn}</div>
        <div class="dd-chips">${chipList(field)}</div>
        <div class="dd-add-row">
          <input type="text" id="ddInput_${field}" placeholder="New option…" onkeydown="if(event.key==='Enter')addOption('${field}')">
          <button class="btn-get" onclick="addOption('${field}')">+ Add</button>
        </div>
      </div>`;
  }).join('') || '<p style="color:#9ca3af;font-size:13px">No dropdown fields.</p>';

  // Section 2: text fields not yet converted
  const textFields = Object.entries(CONVERTIBLE_TEXT_FIELDS).filter(([f]) => !dropdowns[f]);
  const textRows = textFields.length
    ? textFields.map(([field, cfg]) =>
        `<div class="dd-text-row">
          <span class="dd-text-label">${cfg.label}</span>
          <button class="btn-make-dd" onclick="makeDropdown('${field}')">Make Dropdown</button>
        </div>`).join('')
    : '<p style="color:#9ca3af;font-size:13px">All convertible fields are already dropdowns.</p>';

  el.innerHTML = `
    <div class="dd-section-title">Dropdown Fields</div>
    ${ddCards}
    <div class="dd-section-title" style="margin-top:28px">Text Fields</div>
    <div class="dd-text-list">${textRows}</div>`;
}

function makeDropdown(field) {
  const cfg = CONVERTIBLE_TEXT_FIELDS[field];
  if (!cfg) return;
  // Seed initial options from distinct values already in products, plus '-'
  const existing = [...new Set(products.map(p => p[field]).filter(v => v && v.trim() !== ''))];
  if (!existing.includes('-')) existing.push('-');
  dropdowns[field] = existing;
  renderDropdownEditor();
  renderFormDropdowns();
}

function revertToText(field) {
  if (DEFAULT_DROPDOWNS[field]) { showToast('Built-in dropdown fields cannot be reverted to text.', 'err'); return; }
  const label = CONVERTIBLE_TEXT_FIELDS[field]?.label || field;
  if (!confirm(`Revert "${label}" to a free-text field?\n\nExisting product values are kept, but the options list will be removed.`)) return;
  delete dropdowns[field];
  renderDropdownEditor();
  renderFormDropdowns();
}

function addOption(field) {
  const inp = document.getElementById(`ddInput_${field}`);
  const val = inp.value.trim();
  if (!val) return;
  if ((dropdowns[field] || []).includes(val)) { showToast(`"${val}" already exists`, 'err'); return; }
  dropdowns[field].push(val);
  inp.value = '';
  renderDropdownEditor();
  renderFormDropdowns();
}

function removeOption(field, idx, inUse) {
  const val = dropdowns[field][idx];
  if (inUse > 0) {
    if (!confirm(`${inUse} product(s) currently use "${val}". Remove this option anyway?\n\nThose products will show the first available option next time they are edited.`)) return;
  }
  dropdowns[field].splice(idx, 1);
  renderDropdownEditor();
  renderFormDropdowns();
}

function renameOption(field, idx) {
  const old = dropdowns[field][idx];
  const val = prompt(`Rename "${old}" to:`, old);
  if (!val || val.trim() === old) return;
  const trimmed = val.trim();
  if (dropdowns[field].includes(trimmed)) { showToast(`"${trimmed}" already exists`, 'err'); return; }
  const inUse = products.filter(p => p[field] === old).length;
  if (inUse > 0) {
    if (!confirm(`${inUse} product(s) use "${old}". Rename to "${trimmed}"?\n\nThis will NOT update existing saved products — they keep the old value until re-saved.`)) return;
  }
  dropdowns[field][idx] = trimmed;
  renderDropdownEditor();
  renderFormDropdowns();
}

async function saveFieldOptions() {
  showOverlay('Saving field options…');
  try {
    await writeJson();
    hideOverlay();
    showToast('Field options saved', 'ok');
  } catch(e) {
    hideOverlay();
    showToast('Save failed: ' + e.message, 'err');
  }
}

// ─── Site Settings Panel ──────────────────────────────────────────────────────
function renderSiteSettings() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('cfgEmail',          siteConfig.email);
  set('cfgPhone',          siteConfig.phone);
  set('cfgAddress',        siteConfig.address);
  set('cfgHeroSubtitle',   siteConfig.heroSubtitle);
  set('cfgFooterBrandText',siteConfig.footerBrandText);
  set('cfgCopyright',      siteConfig.copyright);
  set('cfgInvendisUrl',    siteConfig.invendisUrl);
  set('cfgSilboUrl',       siteConfig.silboUrl);
  _setLogoPreview('Invendis', siteConfig.logoInvendis);
  _setLogoPreview('Silbo',    siteConfig.logoSilbo);
  _setLogoPreview('Mii',      siteConfig.logoMii);
}

function _setLogoPreview(key, url) {
  const el = document.getElementById('previewLogo' + key);
  if (el && url) el.src = url.split('?')[0]; // strip cache-bust before setting preview
}

function previewLogo(key, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    pendingLogos[key] = { file, dataUrl: e.target.result };
    _setLogoPreview(cap(key), e.target.result);
  };
  reader.readAsDataURL(file);
}

async function saveSiteSettings() {
  siteConfig = {
    ...siteConfig,
    email:           (document.getElementById('cfgEmail')?.value           || '').trim(),
    phone:           (document.getElementById('cfgPhone')?.value           || '').trim(),
    address:         (document.getElementById('cfgAddress')?.value         || '').trim(),
    heroSubtitle:    (document.getElementById('cfgHeroSubtitle')?.value    || '').trim(),
    footerBrandText: (document.getElementById('cfgFooterBrandText')?.value || '').trim(),
    copyright:       (document.getElementById('cfgCopyright')?.value       || '').trim(),
    invendisUrl:     (document.getElementById('cfgInvendisUrl')?.value     || '').trim(),
    silboUrl:        (document.getElementById('cfgSilboUrl')?.value        || '').trim(),
  };

  showOverlay('Saving site settings…');

  // Upload any pending logo files
  const logoMap = { invendis: 'assets/invendis_logo.png', silbo: 'assets/silbo_logo.png', mii: 'assets/make-in-india.png' };
  for (const [key, repoPath] of Object.entries(logoMap)) {
    const pending = pendingLogos[key];
    if (!pending) continue;
    try {
      updateOverlay('Uploading ' + key + ' logo…');
      const buf = await pending.file.arrayBuffer();
      await pushFileToGitHub(repoPath, buf, 'Update ' + key + ' logo');
      siteConfig['logo' + cap(key)] = repoPath + '?v=' + Date.now();
      delete pendingLogos[key];
    } catch(e) {
      hideOverlay();
      showToast('Logo upload failed: ' + e.message, 'err');
      return;
    }
  }

  updateOverlay('Publishing…');
  try {
    await writeJson();
    hideOverlay();
    showToast('Site settings saved & published', 'ok');
  } catch(e) {
    hideOverlay();
    showToast('Save failed: ' + e.message, 'err');
  }
}

function resetSiteSettings() {
  if (!confirm('Reset all site settings to defaults?')) return;
  siteConfig = JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIG));
  pendingLogos = {};
  renderSiteSettings();
  showToast('Reset to defaults — click Save to publish', '');
}
