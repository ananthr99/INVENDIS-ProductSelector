// ─── Secrets ─────────────────────────────────────────────────────────────────
function getGithubToken() {
  return sessionToken || localStorage.getItem('invendis_github_token') || CFG.githubToken || '';
}

async function saveGithubToken() {
  const val = document.getElementById('ghTokenInput').value.trim();
  if (!val) { showToast('Enter a token first', 'err'); return; }

  localStorage.setItem('invendis_github_token', val);
  sessionToken = val;

  // Always save to the user's own OneDrive regardless of folderCtx,
  // so the token persists across browsers for this Microsoft account.
  try {
    const token = await getToken();
    const bytes = new TextEncoder().encode(JSON.stringify({ githubToken: val }));
    const res   = await fetch(`${GRAPH}/me/drive/root:/${FOLDER}/admin-config.json:/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: bytes.buffer
    });
    if (res.ok) showToast('Token saved — auto-loaded on your next sign-in from any browser', 'ok');
    else        showToast('Saved to this browser only', 'ok');
  } catch {
    showToast('Saved to this browser only', 'ok');
  }

  document.getElementById('ghTokenInput').value = '';
  renderSetupStatus();
  updateTokenBanner();
}

async function loadAdminConfig() {
  // Always reads from the user's own OneDrive — works for admin (file exists)
  // and employees (creates on first token save; falls back to localStorage until then).
  try {
    const buf  = await callGraph('GET', `/me/drive/root:/${FOLDER}/admin-config.json:/content`, null, true);
    const conf = JSON.parse(new TextDecoder().decode(new Uint8Array(buf)));
    if (conf.githubToken) sessionToken = conf.githubToken;
  } catch {
    // not found yet — fall back to localStorage silently
  }
}

// ─── MSAL / Auth ─────────────────────────────────────────────────────────────
function initMsal() {
  msalInst = new msal.PublicClientApplication({
    auth: {
      clientId:    CFG.clientId,
      authority:  `https://login.microsoftonline.com/${CFG.tenantId || 'common'}`,
      redirectUri: window.location.href.split('?')[0],
    },
    cache: { cacheLocation: 'sessionStorage' }
  });
}

async function signIn() {
  const btn = document.getElementById('btnSignIn');
  btn.disabled = true;
  document.getElementById('loginErr').textContent = '';
  try {
    await msalInst.loginPopup({ scopes: SCOPES });
    loadData();
  } catch(e) {
    document.getElementById('loginErr').textContent = e.message || 'Sign-in failed';
    btn.disabled = false;
  }
}

function signOut() {
  if (isDirty) {
    showConfirm('You have unsaved changes. Leave anyway?', () => {
      isDirty = false;
      sessionStorage.clear();
      window.location.reload();
    });
    return;
  }
  sessionStorage.clear();
  window.location.reload();
}


async function getToken() {
  const accs = msalInst.getAllAccounts();
  if (!accs.length) throw new Error('Not signed in');
  try {
    const r = await msalInst.acquireTokenSilent({ scopes: SCOPES, account: accs[0] });
    return r.accessToken;
  } catch {
    const r = await msalInst.acquireTokenPopup({ scopes: SCOPES });
    return r.accessToken;
  }
}
