function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function toggleCompare(id, checked) {
  if (checked) {
    if (compareSet.size >= 3) { showToast('You can compare up to 3 products at a time.'); return; }
    compareSet.add(id);
  } else {
    compareSet.delete(id);
  }
  render();
}

function updateCompareTray() {
  const tray = document.getElementById('compareTray');
  const chips = document.getElementById('trayChips');
  if (compareSet.size === 0) { tray.classList.remove('visible'); return; }
  tray.classList.add('visible');
  const sel = PRODUCTS.filter(p => compareSet.has(p.id));
  chips.innerHTML = sel.map(p => `
    <div class="compare-chip">${esc(p.name)}
      <button onclick="toggleCompare(${esc(JSON.stringify(p.id))},false)" title="Remove">×</button>
    </div>
  `).join('');
}

function clearCompare() { compareSet.clear(); render(); }

function openCompareModal() {
  const sel = PRODUCTS.filter(p => compareSet.has(p.id));
  if (sel.length < 2) { showToast('Please select at least 2 products to compare.'); return; }
  // [label, data-key, hidden_fields-key (null = never hideable)]
  const fields = [
    ['Category',       'cat',          null],
    ['CPU',            'cpu',          'cpu'],
    ['RAM',            'ram',          'ram'],
    ['Cellular',       'cellular_gen', 'cellular_gen'],
    ['Wi-Fi',          null,           'wifi'],
    ['Ethernet ports', null,           'ports'],
    ['Power input',    'power',        'power'],
    ['RS485',          'rs485',        'rs485'],
    ['RS232',          'rs232',        'rs232'],
    ['IP rating',      'ip',           'ip'],
    ['Enclosure',      'housing',      'housing'],
    ['Dimensions',     'dims',         'dims'],
    ['Weight',         'weight',       'weight'],
    ['Operating temp', 'op_temp',      'op_temp'],
    ['OS',             'os',           'os'],
  ];
  function val(p, key) {
    if (!key) return '-';
    if (key==='rs485'||key==='rs232') return hasSerial(p[key]) ? p[key] : '-';
    return p[key]||'-';
  }
  const rows = fields.map(([label, key, hKey]) => {
    // Hide row when every product in the comparison has this field hidden
    if (hKey && sel.every(p => isHf(p, hKey))) return '';

    const vals = sel.map(p => {
      // Field is hidden for this product but visible in at least one other → N/A
      if (hKey && isHf(p, hKey)) return null;
      if (!key) {
        if (label==='Wi-Fi') return wifiLabel(p.wifi);
        if (label==='Ethernet ports') return portsDisplay(p);
      }
      return val(p, key);
    });
    const allSame = vals.every(v => v === vals[0]);
    return `<tr class="${!allSame?'diff-row':''}">
      <td>${esc(label)}</td>
      ${vals.map(v => v === null
        ? `<td class="compare-na">Not applicable</td>`
        : `<td>${esc(v)}</td>`
      ).join('')}
    </tr>`;
  }).filter(Boolean).join('');

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal compare-modal" role="dialog" aria-modal="true" aria-labelledby="compareModalTitle">
        <div class="modal-close-bar">
          <button class="modal-close" aria-label="Close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-header">
          <div class="modal-title" id="compareModalTitle">Product Comparison</div>
          <div class="modal-desc">Rows highlighted in yellow have differing values between products.</div>
        </div>
        <div class="modal-body" style="padding:0;overflow-x:auto">
          <table class="compare-table">
            <thead><tr>
              <th>Specification</th>
              ${sel.map(p=>`<th><span class="badge ${catBadgeClass(p.cat)}" style="margin-bottom:4px;display:inline-block">${esc(p.cat)}</span><br>${esc(p.name)}</th>`).join('')}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="modal-actions">
          <a class="btn-enquire" href="mailto:sales@invendis.com?subject=Enquiry: ${encodeURIComponent(sel.map(p=>p.name).join(', '))}">Enquire about these products</a>
          <button class="btn-add-compare" id="btnCopyCompare" onclick="copyCompare()">Copy table</button>
          <button class="btn-add-compare" onclick="window.print()">Print / PDF</button>
          <button class="btn-add-compare" onclick="closeModal()">Close</button>
        </div>
      </div>
    </div>`;
    activateModal();
}

function copyCompare() {
  const table = document.querySelector('.compare-table');
  if (!table) return;
  const text = Array.from(table.querySelectorAll('tr'))
    .map(row => Array.from(row.querySelectorAll('th,td'))
      .map(cell => cell.textContent.trim()).join('\t'))
    .join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btnCopyCompare');
    if (!btn) return;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy table', 2000);
  });
}
