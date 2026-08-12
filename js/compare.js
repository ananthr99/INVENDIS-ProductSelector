function toggleCompare(id, checked) {
  if (checked) {
    if (compareSet.size >= 3) { alert('You can compare up to 3 products at a time.'); return; }
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
    <div class="compare-chip">${p.name}
      <button onclick="toggleCompare('${p.id}',false)" title="Remove">×</button>
    </div>
  `).join('');
}

function clearCompare() { compareSet.clear(); render(); }

function openCompareModal() {
  const sel = PRODUCTS.filter(p => compareSet.has(p.id));
  if (sel.length < 2) { alert('Please select at least 2 products to compare.'); return; }
  const fields = [
    ['Category','cat'],['CPU','cpu'],['RAM','ram'],['Cellular','cellular_gen'],
    ['Wi-Fi',null],['Ethernet ports',null],['Power input','power'],
    ['RS485','rs485'],['RS232','rs232'],['IP rating','ip'],['Enclosure','housing'],
    ['Dimensions','dims'],['Weight','weight'],['Operating temp','op_temp'],['OS','os']
  ];
  function val(p, key) {
    if (!key) return '—';
    if (key==='rs485'||key==='rs232') return hasSerial(p[key]) ? p[key] : 'No';
    return p[key]||'—';
  }
  const rows = fields.map(([label,key]) => {
    const vals = sel.map(p => {
      if (!key) {
        if (label==='Wi-Fi') return wifiLabel(p.wifi);
        if (label==='Ethernet ports') return p.ports>0?p.ports+' ports':'N/A';
      }
      return val(p, key);
    });
    const allSame = vals.every(v => v === vals[0]);
    return `<tr class="${!allSame?'diff-row':''}">
      <td>${label}</td>
      ${sel.map((_,i) => `<td>${vals[i]}</td>`).join('')}
    </tr>`;
  }).join('');

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal compare-modal">
        <div class="modal-close-bar">
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-header">
          <div class="modal-title">Product comparison</div>
          <div class="modal-desc">Rows highlighted in yellow have differing values between products.</div>
        </div>
        <div class="modal-body" style="padding:0;overflow-x:auto">
          <table class="compare-table">
            <thead><tr>
              <th>Specification</th>
              ${sel.map(p=>`<th><span class="badge ${catBadgeClass(p.cat)}" style="margin-bottom:4px;display:inline-block">${p.cat}</span><br>${p.name}</th>`).join('')}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="modal-actions">
          <a class="btn-enquire" href="mailto:sales@invendis.com?subject=Enquiry: ${encodeURIComponent(sel.map(p=>p.name).join(', '))}">Enquire about these products</a>
          <button class="btn-add-compare" onclick="closeModal()">Close</button>
        </div>
      </div>
    </div>`;
}
