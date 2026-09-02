// ─── Graph API ───────────────────────────────────────────────────────────────
async function callGraph(method, path, body = null, asBuffer = false) {
  const token   = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  const opts    = { method, headers };
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    headers['Content-Type'] = 'application/octet-stream';
    opts.body = body;
  } else if (body !== null) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(GRAPH + path, opts);
  if (!res.ok) throw new Error(`Graph ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return asBuffer ? res.arrayBuffer() : res.json();
}

// ─── Folder discovery ────────────────────────────────────────────────────────
async function resolveFolder() {
  // Check if the logged-in user owns the ProductSelector folder in their own OneDrive.
  // Admin: folder exists → full OneDrive read/write.
  // Employee: folder not found → noOneDrive flag; Gist used as data source instead.
  try {
    await callGraph('GET', `/me/drive/root:/${FOLDER}`);
    folderCtx = { ownDrive: true };
  } catch(e) {
    const m = e.message || '';
    if (m.includes('404') || m.includes('itemNotFound')) {
      folderCtx = { noOneDrive: true };
    } else {
      throw e;
    }
  }
}

// Returns the Graph path for a file relative to the ProductSelector folder (admin only).
function folderPath(relPath) {
  return `/me/drive/root:/${FOLDER}/${relPath}`;
}

// Strips the leading 'ProductSelector/' prefix from paths passed to uploadFile/createLink.
function toRelPath(onedrivePath) {
  return onedrivePath.startsWith(FOLDER + '/')
    ? onedrivePath.slice(FOLDER.length + 1)
    : onedrivePath;
}

async function uploadFile(onedrivePath, buffer, mime) {
  const token = await getToken();
  const res = await fetch(`${GRAPH}${folderPath(toRelPath(onedrivePath))}:/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mime },
    body: buffer
  });
  if (!res.ok) throw new Error(`Upload ${res.status}: ${await res.text()}`);
  return res.json();
}


async function createLink(onedrivePath) {
  const r = await callGraph('POST', `${folderPath(toRelPath(onedrivePath))}:/createLink`, {
    type: 'view', scope: 'anonymous'
  });
  return r.link?.webUrl || '';
}

// ─── Excel (SheetJS) ─────────────────────────────────────────────────────────
function productToRow(p) {
  return COLS.map(col => {
    if (col === 'variants_json')   return JSON.stringify(p.variants        ?? null);
    if (col === 'images')          return JSON.stringify(p.images          ?? []);
    if (col === 'use_cases')       return JSON.stringify(p.use_cases       ?? []);
    if (col === 'part_datasheets') return JSON.stringify(p.part_datasheets ?? {});
    return p[col] ?? '';
  });
}

function rowToProduct(headers, values) {
  const p = {};
  headers.forEach((h, i) => p[h] = values[i] ?? '');
  try { p.images          = JSON.parse(p.images          || '[]');   } catch { console.warn('[rowToProduct] bad images JSON for', p.id); p.images = []; }
  try { p.use_cases       = JSON.parse(p.use_cases       || '[]');   } catch { console.warn('[rowToProduct] bad use_cases JSON for', p.id); p.use_cases = []; }
  try { p.variants        = JSON.parse(p.variants_json   || 'null'); } catch { console.warn('[rowToProduct] bad variants JSON for', p.id); p.variants = null; }
  try { p.part_datasheets = JSON.parse(p.part_datasheets || '{}');   } catch { console.warn('[rowToProduct] bad part_datasheets JSON for', p.id); p.part_datasheets = {}; }
  delete p.variants_json;
  p.order = (p.order !== '' && p.order != null) ? Number(p.order) : null;
  return p;
}

async function readFromGist() {
  const gistId = CFG.gistId;
  if (!gistId) throw new Error('gistId not set in onedrive-config.js — cannot load products');
  const _ghdr = getGithubToken() ? { Authorization: `Bearer ${getGithubToken()}` } : {};
  const res  = await fetch(`https://api.github.com/gists/${gistId}`, { headers: _ghdr });
  updateRateLimit(res.headers);
  if (!res.ok) throw new Error(`Gist fetch failed (${res.status})`);
  const data    = await res.json();
  const content = data.files?.['products.json']?.content;
  if (!content) throw new Error('products.json not found in Gist');
  lastGistJson = content; // snapshot for rollback if a subsequent write partially fails
  try { changelogEntries = JSON.parse(data.files?.['changelog.json']?.content || '[]'); } catch { changelogEntries = []; }
  const parsed = JSON.parse(content);
  products  = (parsed.products || []).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  cats      = parsed.cats || [];
  if (parsed.dropdowns && Object.keys(parsed.dropdowns).length) {
    dropdowns = { ...parsed.dropdowns };
    // Ensure any new built-in defaults added after last save are present
    Object.keys(DEFAULT_DROPDOWNS).forEach(k => { if (!dropdowns[k]) dropdowns[k] = DEFAULT_DROPDOWNS[k].slice(); });
  } else {
    dropdowns = JSON.parse(JSON.stringify(DEFAULT_DROPDOWNS));
  }
  // Remove fields that are no longer managed as dropdowns (now plain text inputs)
  delete dropdowns['housing'];
  delete dropdowns['op_temp'];
  catColors       = parsed.catColors || {};
  catColorIndices = _catColorIndicesFromMap(cats, catColors);
  siteConfig = parsed.siteConfig
    ? { ...DEFAULT_SITE_CONFIG, ...parsed.siteConfig }
    : JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIG));
}

async function readExcel() {
  // Gist is the shared source of truth for everyone — this ensures all admins
  // always see each other's changes regardless of who made them.
  try {
    await readFromGist();
    if (products.length > 0 || cats.length > 0) return;
  } catch { /* Gist empty or not yet created — fall through to OneDrive Excel */ }

  // First-time / Gist-empty fallback: read from admin's own OneDrive Excel.
  if (folderCtx.noOneDrive) throw new Error('No products in Gist yet — ask the admin to publish first');
  const buf     = await callGraph('GET', `${folderPath('products.xlsx')}:/content`, null, true);
  const wb      = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws      = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const headers = rawRows[0] || [];
  products = rawRows.slice(1)
    .filter(r => r.some(Boolean))
    .map(r => rowToProduct(headers, r))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  const wsCats = wb.Sheets[wb.SheetNames[1]];
  if (wsCats) {
    const cRows = XLSX.utils.sheet_to_json(wsCats, { header: 1, defval: '' });
    cats = cRows.slice(1).map(r => r[0]).filter(Boolean);
  }
  catColorIndices = _catColorIndicesFromMap(cats, {});
}

async function writeExcel() {
  if (folderCtx.noOneDrive) return; // employees have no OneDrive access — skip
  const wb  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([COLS, ...products.map(productToRow)]), 'Products');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['name'], ...cats.map(c => [c])]), 'Categories');
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  await uploadFile(`${FOLDER}/products.xlsx`, new Uint8Array(bytes).buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function buildJsonData() {
  return {
    cats,
    catColors,
    dropdowns,
    siteConfig,
    products: products.map(p => {
      const out = {};
      COLS.filter(c => c !== 'variants_json').forEach(c => { out[c] = p[c] ?? null; });
      out.images            = Array.isArray(p.images)           ? p.images           : [];
      out.use_cases         = Array.isArray(p.use_cases)       ? p.use_cases       : [];
      out.hidden_fields     = Array.isArray(p.hidden_fields)   ? p.hidden_fields   : [];
      out.additional_specs  = Array.isArray(p.additional_specs) ? p.additional_specs : [];
      out.variants          = p.variants        ?? null;
      out.part_datasheets   = p.part_datasheets ?? {};
      return out;
    })
  };
}

async function writeJson() {
  const jsonStr = JSON.stringify(buildJsonData(), null, 2);
  const bytes   = new TextEncoder().encode(jsonStr);

  // Non-critical OneDrive backup — failure here never blocks the save.
  if (!folderCtx.noOneDrive) {
    try { await uploadFile(`${FOLDER}/products.json`, bytes.buffer, 'application/json'); } catch {}
  }

  // Step 1: Write to Gist (primary live source).
  // If this throws, the repo is untouched — no rollback needed, just propagate.
  const gistData = await pushToGist(jsonStr);
  if (gistData && !CFG.gistId) {
    const rawUrl = `https://gist.githubusercontent.com/${gistData.owner.login}/${gistData.id}/raw/products.json`;
    CFG.gistId = gistData.id;
    showGistInfo(gistData.id, rawUrl);
  }

  // Step 2: Write to repo — must stay in sync with the Gist.
  // If this fails, roll back the Gist to its previous state so both stay consistent.
  try {
    await pushFileToGitHub('data/products.json', bytes.buffer, 'Update products catalogue');
  } catch(repoErr) {
    console.error('[Admin] Repo sync failed — rolling back Gist to previous state:', repoErr.message);
    if (lastGistJson) {
      try { await pushToGist(lastGistJson); }
      catch(rbErr) { console.error('[Admin] Gist rollback also failed:', rbErr.message); }
    }
    throw new Error('Gist rolled back. Please try again.');
  }

  lastGistJson = jsonStr; // update snapshot after both writes succeed
}

async function pushToGist(jsonStr) {
  const token  = getGithubToken();
  const gistId = CFG.gistId;
  if (!token || token === 'YOUR_GITHUB_TOKEN') return;

  const payload = {
    description: 'Invendis ProductSelector — products.json',
    public: true,
    files: { 'products.json': { content: jsonStr } }
  };

  const url    = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
  const method = gistId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  updateRateLimit(res.headers);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 && body.includes('rate limit')) throw new Error('GitHub API rate limit exceeded — please wait a few minutes and try again.');
    throw new Error(`GitHub Gist ${res.status}: ${body}`);
  }
  return res.json();
}


// ─── GitHub Rate Limit ───────────────────────────────────────────────────────
function updateRateLimit(headers) {
  const remaining = parseInt(headers.get('X-RateLimit-Remaining'), 10);
  const limit     = parseInt(headers.get('X-RateLimit-Limit'),     10);
  const reset     = parseInt(headers.get('X-RateLimit-Reset'),     10);
  if (isNaN(remaining) || isNaN(limit)) return;
  rateLimitInfo = { remaining, limit, reset };
  if (typeof renderRateLimit === 'function') renderRateLimit();
}

async function fetchRateLimit() {
  const token = getGithubToken();
  if (!token || token === 'YOUR_GITHUB_TOKEN') return;
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) return;
    const data = await res.json();
    const core = data.resources?.core;
    if (!core) return;
    rateLimitInfo = { remaining: core.remaining, limit: core.limit, reset: core.reset };
    if (typeof renderRateLimit === 'function') renderRateLimit();
  } catch {}
}

// ─── GitHub File Upload ───────────────────────────────────────────────────────
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function pushFileToGitHub(repoPath, buffer, commitMessage) {
  const owner  = CFG.githubOwner;
  const repo   = CFG.githubRepo;
  const branch = CFG.githubBranch || 'main';
  const token  = getGithubToken();
  if (!owner || !repo || !token) throw new Error('GitHub repo not configured — open Setup tab and save your token');

  const base64 = arrayBufferToBase64(buffer);

  // Fetch existing file SHA (required by GitHub API when updating)
  let sha;
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}?ref=${branch}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      cache: 'no-store'
    });
    if (r.ok) { const d = await r.json(); sha = d.sha; }
  } catch {}

  const body = { message: commitMessage, content: base64, branch };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  updateRateLimit(res.headers);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 && body.includes('rate limit')) throw new Error('GitHub API rate limit exceeded — please wait a few minutes and try again.');
    throw new Error(`GitHub upload ${res.status}: ${body}`);
  }

  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${repoPath}`;
}
