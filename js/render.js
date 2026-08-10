function buildCatTabs() {
  const tabs = document.getElementById('catTabs');
  const counts = {};
  CATS.forEach(c => { counts[c] = c === 'All' ? PRODUCTS.length : PRODUCTS.filter(p => p.cat === c).length; });
  tabs.innerHTML = CATS.map(c => `
    <button class="cat-tab ${activeCat===c?'active':''}" onclick="setCat('${c}')">
      ${c} <span class="count">${counts[c]}</span>
    </button>
  `).join('');
}

function render() {
  const list = getFiltered();
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

  document.getElementById('statFiltered').textContent = list.length;
  const rc = document.getElementById('resultsCount');
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, list.length);
  rc.innerHTML = list.length
    ? `Showing <strong>${start}–${end}</strong> of <strong>${list.length}</strong> products`
    : `<strong>0</strong> products found`;
  document.getElementById('clearBtn').style.display = hasActiveFilters() ? 'inline' : 'none';
  buildCatTabs();
  ['fCell','fWifi','fPorts','fSerial'].forEach(id => {
    const el = document.getElementById(id);
    el.className = el.value ? 'active-filter' : '';
  });
  const r = document.getElementById('results');
  if (!list.length) {
    r.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6M11 8v6"/></svg>
      <h3>No products found</h3>
      <p>Try adjusting your search or filters above.</p>
    </div>`;
    renderPagination(0, 0);
    return;
  }
  const page = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  if (viewMode === 'grid') renderGrid(page, r);
  else renderList(page, r);
  renderPagination(totalPages, list.length);
  updateCompareTray();
}

function renderPagination(totalPages, total) {
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const maxVisible = 5;
  let pages = [];
  if (totalPages <= maxVisible + 2) {
    pages = Array.from({length: totalPages}, (_, i) => i + 1);
  } else {
    pages = [1];
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    if (currentPage <= 3) { start = 2; end = Math.min(totalPages - 1, maxVisible); }
    if (currentPage >= totalPages - 2) { start = Math.max(2, totalPages - maxVisible + 1); end = totalPages - 1; }
    if (start > 2) pages.push('…');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('…');
    pages.push(totalPages);
  }

  el.innerHTML = `
    <div class="pagination">
      <button class="pg-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      ${pages.map(p => p === '…'
        ? `<span class="pg-ellipsis">…</span>`
        : `<button class="pg-btn ${p === currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`
      ).join('')}
      <button class="pg-btn" onclick="goPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  `;
}

function goPage(p) {
  currentPage = p;
  render();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function renderGrid(list, r) {
  r.className = 'grid-view';
  r.innerHTML = list.map(p => {
    const imgs = PRODUCT_IMAGES[p.id];
    const thumb = imgs?.length ? `<div class="card-thumb-wrap"><img class="card-thumb" src="${imgs[0]}" alt="${p.name}"></div>` : '';
    const uc = PRODUCT_USE_CASES[p.id] || [];
    const ucHtml = uc.length ? `<div class="card-use-cases">${uc.slice(0,2).map(u=>`<span class="use-case-chip-sm">${u}</span>`).join('')}</div>` : '';
    return `
    <div class="card ${compareSet.has(p.id)?'compare-selected':''}">
      ${thumb}
      <span class="badge ${catBadgeClass(p.cat)}">${p.cat}</span>
      <div class="card-name">${p.name}</div>
      <div class="card-desc">${p.desc}</div>
      <div class="card-specs">
        ${p.cellular_gen&&p.cellular_gen!=='none'?`<span class="spec-pill highlight">${p.cellular_gen}</span>`:''}
        ${p.wifi!=='none'?`<span class="spec-pill highlight">${wifiLabel(p.wifi)}</span>`:''}
        ${p.rs485?'<span class="spec-pill warn">RS485</span>':''}
        ${p.rs232?'<span class="spec-pill warn">RS232</span>':''}
        ${p.ports>0?`<span class="spec-pill">${p.ports} ports</span>`:''}
        ${p.ip?`<span class="spec-pill">${p.ip}</span>`:''}
      </div>
      ${ucHtml}
      <div class="card-footer">
        <label class="compare-check" onclick="event.stopPropagation()">
          <input type="checkbox" ${compareSet.has(p.id)?'checked':''} onchange="toggleCompare('${p.id}',this.checked)"> Compare
        </label>
        <span class="details-link" onclick="openDetail('${p.id}')">Details →</span>
      </div>
    </div>
  `;
  }).join('');
}

function renderList(list, r) {
  r.className = 'list-view';
  r.innerHTML = `<div class="list-head">
    <span></span>
    <span>Model</span><span>Description</span>
    <span style="text-align:center">Cellular</span>
    <span style="text-align:center">Wi-Fi</span>
    <span style="text-align:center">RS485</span>
    <span style="text-align:center">Ports</span>
    <span style="text-align:center">Compare</span>
  </div>` + list.map(p => {
    const imgs = PRODUCT_IMAGES[p.id];
    const thumb = imgs?.length ? `<img class="list-thumb" src="${imgs[0]}" alt="${p.name}">` : `<span></span>`;
    return `
    <div class="list-row ${compareSet.has(p.id)?'compare-selected':''}" onclick="openDetail('${p.id}')">
      ${thumb}
      <div>
        <div class="list-name">${p.name}</div>
        <div class="list-cat"><span class="badge ${catBadgeClass(p.cat)}">${p.cat}</span></div>
      </div>
      <div class="list-desc">${p.desc}</div>
      <div class="list-cell">${p.cellular_gen!=='none'?`<span class="yes-pill">${p.cellular_gen}</span>`:'<span class="no-pill">—</span>'}</div>
      <div class="list-cell">${p.wifi!=='none'?`<span class="yes-pill">${wifiLabel(p.wifi)}</span>`:'<span class="no-pill">—</span>'}</div>
      <div class="list-cell">${p.rs485?'<span class="yes-pill">Yes</span>':'<span class="no-pill">—</span>'}</div>
      <div class="list-cell">${p.ports>0?p.ports:'—'}</div>
      <div class="list-cell" onclick="event.stopPropagation()">
        <input type="checkbox" style="width:14px;height:14px;accent-color:#1A6FC4;cursor:pointer" ${compareSet.has(p.id)?'checked':''} onchange="toggleCompare('${p.id}',this.checked)">
      </div>
    </div>
  `;
  }).join('');
}

function setView(v) {
  viewMode = v;
  document.getElementById('btnGrid').classList.toggle('active', v==='grid');
  document.getElementById('btnList').classList.toggle('active', v==='list');
  render();
}
