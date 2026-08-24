// ─── Variants Editor ──────────────────────────────────────────────────────────
let variantData = { note: '', headers: [], rows: [] };

function renderVariantsEditor(variants) {
  variantData = variants
    ? { note: variants.note || '', headers: [...(variants.headers || [])], rows: (variants.rows || []).map(r => [...r]) }
    : { note: '', headers: [], rows: [] };
  document.getElementById('fVariantNote').value = variantData.note;
  _renderVariantsTable();
}

function _renderVariantsTable() {
  const wrap = document.getElementById('variantsTableWrap');
  const { headers, rows } = variantData;
  if (!headers.length) {
    wrap.innerHTML = '<p style="font-size:12px;color:#9ca3af;margin:0">No columns yet — click "+ Add Column" to start building the table.</p>';
    return;
  }
  const thStyle = 'padding:6px 4px;min-width:130px;';
  const colInputStyle = 'width:100%;box-sizing:border-box;font-size:12px;font-weight:600;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;background:#f0f4ff;color:#1e3a8a';
  const cellInputStyle = 'width:100%;box-sizing:border-box;font-size:12px;padding:4px 6px;border:1px solid #e5e7eb;border-radius:4px';
  const rmBtnStyle = 'background:none;border:none;cursor:pointer;color:#9ca3af;font-size:16px;line-height:1;padding:0 3px;vertical-align:middle';

  let t = `<table style="border-collapse:collapse;width:100%"><thead><tr style="border-bottom:2px solid #e5e7eb">`;
  headers.forEach((h, ci) => {
    t += `<th style="${thStyle}">
      <div style="display:flex;gap:3px;align-items:center">
        <input type="text" value="${esc(h)}" placeholder="Column name"
          oninput="variantData.headers[${ci}]=this.value"
          style="${colInputStyle}">
        <button type="button" onclick="removeVariantCol(${ci})" style="${rmBtnStyle}" title="Remove column">×</button>
      </div></th>`;
  });
  t += `<th style="padding:6px 8px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;background:#fafafa">Datasheet</th>`;
  t += `<th style="width:28px"></th></tr></thead><tbody>`;
  rows.forEach((row, ri) => {
    t += `<tr style="border-bottom:1px solid #f3f4f6">`;
    headers.forEach((_, ci) => {
      const isLastCol = ci === headers.length - 1;
      t += `<td style="padding:3px 4px"><input type="text" value="${esc(row[ci] ?? '')}"
        oninput="variantData.rows[${ri}][${ci}]=this.value"
        ${isLastCol ? `onchange="_renderVariantsTable()"` : ''}
        style="${cellInputStyle}"></td>`;
    });
    // Datasheet cell — keyed by last column value (matches main site logic)
    const partNo = _rowDsKey(row[headers.length - 1] ?? '');
    const existing = partNo && currentPartDs[partNo];
    const pending  = partNo && pendingPartDs.find(p => p.partNo === partNo);
    let dsCell;
    if (!partNo) {
      dsCell = `<span style="font-size:11px;color:#9ca3af">— fill last column —</span>`;
    } else if (pending) {
      dsCell = `<span style="font-size:11px;color:#1A6FC4">📄 ${esc(pending.file.name)}</span>
        <button type="button" onclick="removeRowDs('${esc(partNo)}')" style="${rmBtnStyle}" title="Remove">×</button>`;
    } else if (existing === 'contact_us') {
      dsCell = `<span style="font-size:11px;color:#1A6FC4;white-space:nowrap">Contact us</span>
        <button type="button" onclick="removeRowDs('${esc(partNo)}')" style="${rmBtnStyle}" title="Remove">×</button>`;
    } else if (existing) {
      const href = existing.startsWith('http') ? existing : '../' + existing;
      dsCell = `<a href="${href}" target="_blank" style="font-size:12px;color:#1A6FC4;white-space:nowrap">📄 View</a>
        <button type="button" onclick="removeRowDs('${esc(partNo)}')" style="${rmBtnStyle}" title="Remove">×</button>`;
    } else {
      dsCell = `<label style="font-size:11px;padding:3px 8px;border:1px dashed #9ca3af;border-radius:4px;cursor:pointer;color:#6b7280;white-space:nowrap">
        Upload PDF<input type="file" accept=".pdf" style="display:none" onchange="handleRowDsFile(event,'${esc(partNo)}')"></label>
        <button type="button" onclick="setRowDsContactUs('${esc(partNo)}')" style="font-size:11px;padding:3px 8px;border:1px dashed #9ca3af;border-radius:4px;cursor:pointer;color:#6b7280;white-space:nowrap;background:none;margin-left:4px">Contact us</button>`;
    }
    t += `<td style="padding:3px 8px;white-space:nowrap">${dsCell}</td>`;
    t += `<td style="padding:3px;text-align:center"><button type="button" onclick="removeVariantRow(${ri})" style="${rmBtnStyle}" title="Remove row">×</button></td></tr>`;
  });
  t += `</tbody></table>`;
  wrap.innerHTML = t;
}

function addVariantCol() {
  variantData.headers.push('');
  variantData.rows.forEach(r => r.push(''));
  _renderVariantsTable();
  // focus the new header input
  const inputs = document.querySelectorAll('#variantsTableWrap thead input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function addVariantRow() {
  variantData.rows.push(variantData.headers.map(() => ''));
  _renderVariantsTable();
  // focus first cell of the new row
  const rows = document.querySelectorAll('#variantsTableWrap tbody tr');
  if (rows.length) { const inp = rows[rows.length - 1].querySelector('input'); if (inp) inp.focus(); }
}

function removeVariantCol(ci) {
  variantData.headers.splice(ci, 1);
  variantData.rows.forEach(r => r.splice(ci, 1));
  _renderVariantsTable();
}

function removeVariantRow(ri) {
  variantData.rows.splice(ri, 1);
  _renderVariantsTable();
}

function clearVariants() {
  if (variantData.headers.length === 0 && variantData.rows.length === 0) return;
  if (!confirm('Clear all variant columns and rows?')) return;
  variantData = { note: '', headers: [], rows: [] };
  document.getElementById('fVariantNote').value = '';
  _renderVariantsTable();
}

function getVariantsFromEditor() {
  variantData.note = (document.getElementById('fVariantNote')?.value || '').trim();
  if (!variantData.headers.length && !variantData.rows.length) return null;
  const out = { headers: variantData.headers, rows: variantData.rows };
  if (variantData.note) out.note = variantData.note;
  return out;
}

// ─── Variant Datasheets (inline in table) ────────────────────────────────────
function _rowDsKey(val) { return (val||'').replace(/\s*\(.*\)$/,'').trim(); }
function handleRowDsFile(e, partNo) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !partNo) return;
  pendingPartDs = pendingPartDs.filter(p => p.partNo !== partNo);
  pendingPartDs.push({ partNo, file });
  _renderVariantsTable();
}
function removeRowDs(partNo) {
  delete currentPartDs[partNo];
  pendingPartDs = pendingPartDs.filter(p => p.partNo !== partNo);
  _renderVariantsTable();
}
function setRowDsContactUs(partNo) {
  if (!partNo) return;
  pendingPartDs = pendingPartDs.filter(p => p.partNo !== partNo);
  currentPartDs[partNo] = 'contact_us';
  _renderVariantsTable();
}
