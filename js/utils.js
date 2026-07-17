function catBadgeClass(c) {
  return {Router:'b-router',Gateway:'b-gateway',Switch:'b-switch','Energy Meter':'b-energy',Other:'b-other'}[c]||'b-other';
}

function wifiLabel(w) {
  return {WiFi6:'Wi-Fi 6',WiFi5:'Wi-Fi 5',WiFi24:'Wi-Fi 4',none:'—'}[w]||w;
}

function srow(k, v) {
  return `<div class="spec-row"><span class="spec-key">${k}</span><span class="spec-val">${v}</span></div>`;
}

function rsLabel(flag, variants, colName) {
  if (!flag) return 'No';
  if (!variants || !variants.headers || !variants.rows) return 'Yes';
  const colIdx = variants.headers.indexOf(colName);
  if (colIdx === -1) return 'Yes';
  return variants.rows.every(row => row[colIdx] === '✓') ? 'Yes' : 'Optional';
}
