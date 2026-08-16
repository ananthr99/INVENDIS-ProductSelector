// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
  const configured = !!(CFG.clientId && CFG.clientId !== 'YOUR_CLIENT_ID');
  if (!configured) {
    document.getElementById('redirectHint').textContent = window.location.href.split('?')[0];
    showScreen('setup'); return;
  }
  initMsal();
  await msalInst.initialize();
  try { await msalInst.handleRedirectPromise(); } catch {}
  if (msalInst.getAllAccounts().length) { loadData(); }
  else { showScreen('login'); }
})();

window.addEventListener('beforeunload', e => {
  if (isDirty) { e.preventDefault(); e.returnValue = ''; }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.cat-color-select')) {
    document.querySelectorAll('.cat-color-drop.open').forEach(d => d.classList.remove('open'));
  }
});
