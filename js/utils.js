function catBadgeClass(c) {
  const fixed = { Router:'b-router', Gateway:'b-gateway', Switch:'b-switch', 'Energy Meter':'b-energy', Other:'b-other', PCB:'b-pcb' };
  return fixed[c] || 'b-cat-' + (c || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function wifiLabel(w) {
  const map = {
    'WiFi6':'Wi-Fi 6', 'WiFi5':'Wi-Fi 5',
    'WiFi4/2.4GHz':'Wi-Fi 4/2.4GHz', 'WiFi24':'Wi-Fi 4/2.4GHz',
    'WiFi4':'Wi-Fi 4', 'Wi-Fi 4':'Wi-Fi 4',
    '-':'-', 'none':'-', 'false':'-', '':'-'
  };
  return map[w] !== undefined ? map[w] : w;
}

function hasCellular(c) { return !!c && c !== '-' && c !== 'none' && c !== ''; }
function hasWifi(w)     { return !!w && w !== '-' && w !== 'none' && w !== 'false' && w !== ''; }

function srow(k, v) {
  return `<div class="spec-row"><span class="spec-key">${k}</span><span class="spec-val">${v}</span></div>`;
}

function hasSerial(v) { return v === true || v === 'Yes' || v === 'Optional'; }
function rsLabel(flag, variants, colName) {
  if (!hasSerial(flag)) return '-';
  if (!variants || !variants.headers || !variants.rows) return flag;
  const colIdx = variants.headers.indexOf(colName);
  if (colIdx === -1) return flag;
  return variants.rows.every(row => row[colIdx] === '✓') ? 'Yes' : 'Optional';
}
