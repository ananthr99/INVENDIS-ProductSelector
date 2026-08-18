function downloadFile(url, btn) {
  const filename = decodeURIComponent(url.split('/').pop());
  const origHtml = btn ? btn.innerHTML : null;
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  fetch(url)
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    })
    .catch(() => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    });
}

function isHf(p, key) { return (p.hidden_fields || []).includes(key); }
function anyVisible(p, ...keys) { return keys.some(k => !isHf(p, k)); }

function buildVariantsTable(v) {
  if (!v || !v.headers || !v.rows) return '';

  // Strip any parenthetical note from a part-number cell to get the lookup key
  const dsKey = cell => cell.replace(/\s*\(.*\)$/, '').trim();

  // Only add the Data Sheet column if at least one row has a matching file
  const hasDs = v.rows.some(row => !!PART_DATASHEETS[dsKey(row[row.length - 1])]);

  const noteHtml = v.note ? `<div class="variants-note">${v.note}</div>` : '';
  const partNoIdx = v.headers.length - 1;

  const thead = `<tr>
    ${v.headers.map((h, i) => `<th${i === partNoIdx ? ' class="col-partno"' : ''}>${h}</th>`).join('')}
    ${hasDs ? '<th class="col-datasheet">Data Sheet</th>' : ''}
  </tr>`;

  const tbody = v.rows.map(row => {
    const cells = row.map((cell, i) => {
      const cls = i === partNoIdx ? ' class="cell-partno"' : cell === '✓' ? ' class="cell-yes"' : cell === '—' ? ' class="cell-no"' : '';
      return `<td${cls}>${cell}</td>`;
    }).join('');
    let dsCell = '';
    if (hasDs) {
      const pn = dsKey(row[row.length - 1]);
      const file = PART_DATASHEETS[pn];
      if (file) {
        dsCell = `<td class="cell-datasheet">
            <a class="ds-btn ds-view" href="${file}" target="_blank" rel="noopener">View</a>
            <button class="ds-btn ds-download" onclick="downloadFile('${file}',this)">&#x2193;</button>
           </td>`;
      } else {
        const mailSubject = encodeURIComponent('Datasheet Request: ' + pn);
        const mailBody = encodeURIComponent('Hi Invendis team,\n\nI would like to request the datasheet for ' + pn + '.\n\nThank you.');
        dsCell = `<td class="cell-datasheet"><a class="ds-btn ds-contact" href="mailto:sales@invendis.com?subject=${mailSubject}&body=${mailBody}" title="Datasheet not available — contact us for more information">Contact us</a></td>`;
      }
    }
    return `<tr>${cells}${dsCell}</tr>`;
  }).join('');

  return `
    <div class="spec-section variants-section">
      <div class="spec-section-title">Product Variants</div>
      ${noteHtml}
      <div class="variants-table-wrap">
        <table class="variants-table">
          <thead>${thead}</thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    </div>`;
}

function buildImageCarousel(id, name) {
  const imgs = PRODUCT_IMAGES[id] || [];
  if (!imgs.length) return '';
  carouselImages = imgs;
  carouselIdx = 0;
  const multi = imgs.length > 1;
  return `
    <div class="product-image-wrap loading">
      ${multi ? `<button class="carousel-btn carousel-prev" aria-label="Previous image" onclick="navigateCarousel(-1)">&#8249;</button>` : ''}
      <img class="carousel-img" id="carouselImg" src="${imgs[0]}" alt="${name}" onload="this.style.opacity=1; this.parentElement.classList.remove('loading')">
      ${multi ? `<button class="carousel-btn carousel-next" aria-label="Next image" onclick="navigateCarousel(1)">&#8250;</button>` : ''}
      ${multi ? `<div class="carousel-counter" id="carouselCounter">1 / ${imgs.length}</div>` : ''}
    </div>`;
}

function navigateCarousel(dir) {
  if (!carouselImages.length) return;
  carouselIdx = (carouselIdx + dir + carouselImages.length) % carouselImages.length;
  const img = document.getElementById('carouselImg');
  img.style.opacity = 0;
  img.parentElement.classList.add('loading');
  img.src = carouselImages[carouselIdx];
  const counter = document.getElementById('carouselCounter');
  if (counter) counter.textContent = `${carouselIdx + 1} / ${carouselImages.length}`;
}

function buildAdditionalSpecsSection(p) {
  const specs = p.additional_specs;
  if (!specs || !specs.length) return '';
  return `
    <div class="spec-section">
      <div class="spec-section-title">Additional Specifications</div>
      ${specs.map(s => srow(s.k, s.v || '-')).join('')}
    </div>`;
}

function buildDatasheetsSection(id) {
  const file = PRODUCT_DATASHEETS[id];
  if (!file) return '';
  return `
    <div class="spec-section datasheet-section">
      <div class="spec-section-title">Datasheet</div>
      <div class="datasheet-item">
        <svg class="datasheet-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="8" y1="17" x2="12" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="datasheet-label">Product Datasheet</span>
        <div class="datasheet-btns">
          <a class="ds-btn ds-view" href="${file}" target="_blank" rel="noopener">View</a>
          <button class="ds-btn ds-download" onclick="downloadFile('${file}',this)">Download</button>
        </div>
      </div>
    </div>`;
}

function openDetail(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-close-bar">
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-header">
          <span class="badge ${catBadgeClass(p.cat)}">${p.cat}</span>
          <div class="modal-title">${p.name}</div>
          <div class="modal-desc">${p.desc}</div>
        </div>
        ${buildImageCarousel(p.id, p.name)}
        ${(PRODUCT_USE_CASES[p.id]||[]).length ? `<div class="modal-use-cases"><div class="modal-use-cases-label">Typical Use Cases</div><div class="modal-use-cases-chips">${(PRODUCT_USE_CASES[p.id]).map(u=>`<span class="use-case-chip">${u}</span>`).join('')}</div></div>` : ''}
        <div class="modal-body">
          ${p.cat === 'Energy Meter' ? `
          ${anyVisible(p,'rs485','rs232','power') ? `<div class="spec-section">
            <div class="spec-section-title">Communication</div>
            ${isHf(p,'rs485')   ? '' : srow('RS485 / Modbus', rsLabel(p.rs485, p.variants, 'RS485'))}
            ${isHf(p,'rs232')   ? '' : srow('RS232', rsLabel(p.rs232, p.variants, 'RS232'))}
            ${isHf(p,'power')   ? '' : srow('Power supply', p.power)}
          </div>` : ''}
          ${anyVisible(p,'housing','ip','dims','weight','op_temp') ? `<div class="spec-section">
            <div class="spec-section-title">Physical</div>
            ${isHf(p,'housing') ? '' : srow('Enclosure', p.housing)}
            ${p.ip && !isHf(p,'ip') ? srow('IP Rating', p.ip) : ''}
            ${isHf(p,'dims')    ? '' : srow('Dimensions', p.dims || '-')}
            ${isHf(p,'weight')  ? '' : srow('Weight', p.weight || '-')}
            ${isHf(p,'op_temp') ? '' : srow('Operating temp', p.op_temp || '-')}
          </div>` : ''}` : `
          ${anyVisible(p,'cellular_gen','wifi','ports','rs485','rs232') ? `<div class="spec-section">
            <div class="spec-section-title">Connectivity</div>
            ${isHf(p,'cellular_gen') ? '' : srow('Cellular', hasCellular(p.cellular_gen)?p.cell:'-')}
            ${isHf(p,'wifi')         ? '' : srow('Wi-Fi', wifiLabel(p.wifi))}
            ${isHf(p,'ports')        ? '' : srow('Ethernet ports', p.ports>0?p.ports+' ports':'-')}
            ${isHf(p,'rs485')        ? '' : srow('RS485', rsLabel(p.rs485, p.variants, 'RS485'))}
            ${isHf(p,'rs232')        ? '' : srow('RS232', rsLabel(p.rs232, p.variants, 'RS232'))}
          </div>` : ''}
          ${anyVisible(p,'cpu','ram','storage','power','ip','housing','dims','weight','op_temp') ? `<div class="spec-section">
            <div class="spec-section-title">Hardware</div>
            ${isHf(p,'cpu')     ? '' : srow('CPU', p.cpu)}
            ${isHf(p,'ram')     ? '' : srow('RAM', p.ram||'-')}
            ${isHf(p,'storage') ? '' : srow('Storage', p.storage||'-')}
            ${isHf(p,'power')   ? '' : srow('Power input', p.power)}
            ${isHf(p,'ip')      ? '' : srow('IP / Housing', p.ip||'-')}
            ${isHf(p,'housing') ? '' : srow('Enclosure', p.housing)}
            ${isHf(p,'dims')    ? '' : srow('Dimensions', p.dims||'-')}
            ${isHf(p,'weight')  ? '' : srow('Weight', p.weight||'-')}
            ${isHf(p,'op_temp') ? '' : srow('Operating temp', p.op_temp||'-')}
          </div>` : ''}
          ${p.os && p.os !== '-' && !isHf(p,'os') ? `<div class="spec-section"><div class="spec-section-title">Software</div>${srow('Operating system',p.os)}</div>` : ''}`}
          ${buildAdditionalSpecsSection(p)}
          ${buildVariantsTable(p.variants)}
          ${buildDatasheetsSection(p.id)}
        </div>
        <div class="modal-actions">
          <a class="btn-enquire" href="mailto:sales@invendis.com?subject=Enquiry: ${encodeURIComponent(p.name)}&body=Hi Invendis team,%0A%0AI would like to enquire about the ${encodeURIComponent(p.name)}.%0A%0APlease send me more details.%0A%0AThank you.">Enquire about this product</a>
          <button class="btn-add-compare" onclick="toggleCompare('${p.id}',${!compareSet.has(p.id)});this.textContent=compareSet.has('${p.id}')?'Added to compare':'+ Compare'">
            ${compareSet.has(p.id)?'Added to compare':'+ Compare'}
          </button>
        </div>
      </div>
    </div>`;
}

function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }
