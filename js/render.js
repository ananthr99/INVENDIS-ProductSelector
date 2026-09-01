function updateHeroStats() {
  const el = document.getElementById('heroStats');
  if (!el) return;
  const labels = {
    'Router':'routers','Gateway':'gateways','Switch':'switches',
    'Energy Meter':'meters','PCB':'PCBs','Other':'other',
    'Intel Based Devices':'Intel devices'
  };
  function catLabel(c) { return labels[c] || c.toLowerCase(); }
  let html = `<div class="hero-stat"><span class="num">${PRODUCTS.length}</span><span class="lbl">total</span></div>`;
  CATS.filter(c => c !== 'All').forEach(cat => {
    const n = PRODUCTS.filter(p => p.cat === cat).length;
    if (n > 0) html += `<div class="hero-stat"><span class="num">${n}</span><span class="lbl">${esc(catLabel(cat))}</span></div>`;
  });
  el.innerHTML = html;
}

function buildCatTabs() {
  const tabs = document.getElementById('catTabs');
  const counts = {};
  CATS.forEach(c => { counts[c] = c === 'All' ? PRODUCTS.length : PRODUCTS.filter(p => p.cat === c).length; });
  tabs.innerHTML = '';
  CATS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab' + (activeCat === c ? ' active' : '');
    btn.appendChild(document.createTextNode(c + ' '));
    const span = document.createElement('span');
    span.className = 'count';
    span.textContent = counts[c];
    btn.appendChild(span);
    btn.addEventListener('click', () => setCat(c));
    tabs.appendChild(btn);
  });
}


function render() {
  const list = getFiltered();
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

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
    r.className = '';
    r.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6M11 8v6"/></svg>
      <h3>No Products Found</h3>
      <p>Try adjusting your search filters.</p>
    </div>`;
    renderPagination(0, 0);
    return;
  }
  const page = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  if (viewMode === 'grid') { renderGrid(page, r); truncateUseCasePills(); }
  else renderList(page, r);
  renderPagination(totalPages, list.length);
  updateCompareTray();
  syncURL();
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

function truncateUseCasePills() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.card-use-cases').forEach(container => {
      const chips = Array.from(container.querySelectorAll('.use-case-chip-sm'));
      if (!chips.length) return;

      const firstTop = chips[0].getBoundingClientRect().top;
      const chipH = chips[0].getBoundingClientRect().height;
      const gap = 4;

      // Find first chip that falls on row 3+
      let cutIdx = chips.length;
      for (let i = 1; i < chips.length; i++) {
        const row = Math.round((chips[i].getBoundingClientRect().top - firstTop) / (chipH + gap));
        if (row >= 2) { cutIdx = i; break; }
      }

      if (cutIdx >= chips.length) return;

      for (let i = cutIdx; i < chips.length; i++) chips[i].style.display = 'none';

      const moreChip = document.createElement('span');
      moreChip.className = 'use-case-chip-sm use-case-chip-more';
      moreChip.textContent = `+${chips.length - cutIdx} more`;
      container.appendChild(moreChip);

      // If "+N more" itself wrapped to row 3, retire one more chip
      const moreRow = Math.round((moreChip.getBoundingClientRect().top - firstTop) / (chipH + gap));
      if (moreRow >= 2 && cutIdx > 0) {
        chips[--cutIdx].style.display = 'none';
        moreChip.textContent = `+${chips.length - cutIdx} more`;
      }
    });
  });
}

function renderGrid(list, r) {
  r.className = 'grid-view';
  r.innerHTML = list.map(p => {
    const imgs = PRODUCT_IMAGES[p.id];
    const thumb = imgs?.length ? `<div class="card-thumb-wrap"><img class="card-thumb" src="${imgs[0]}" alt="${esc(p.name)}" loading="lazy"></div>` : '';
    const uc = PRODUCT_USE_CASES[p.id] || [];
    const ucHtml = uc.length ? `<div class="card-use-cases">${uc.map(u=>`<span class="use-case-chip-sm">${esc(u)}</span>`).join('')}</div>` : '';
    const eid = esc(JSON.stringify(p.id));
    return `
    <div class="card ${compareSet.has(p.id)?'compare-selected':''}" role="button" tabindex="0" onclick="openDetail(${eid})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetail(${eid})}">
      ${thumb}
      <span class="badge ${catBadgeClass(p.cat)}">${esc(p.cat)}</span>
      <div class="card-name">${esc(p.name)}</div>
      <div class="card-desc">${esc(p.desc)}</div>
      <div class="card-specs">
        ${hasCellular(p.cellular_gen)&&!isHf(p,'cellular_gen')?`<span class="spec-pill highlight">${esc(p.cellular_gen)}</span>`:''}
        ${hasWifi(p.wifi)&&!isHf(p,'wifi')?`<span class="spec-pill highlight">${esc(wifiLabel(p.wifi))}</span>`:''}
        ${(p.rs485===true||p.rs485==='Yes'||p.rs485==='Optional')&&!isHf(p,'rs485')?`<span class="spec-pill warn">RS485${p.rs485==='Optional'?' (Opt)':''}</span>`:''}
        ${(p.rs232===true||p.rs232==='Yes'||p.rs232==='Optional')&&!isHf(p,'rs232')?`<span class="spec-pill warn">RS232${p.rs232==='Optional'?' (Opt)':''}</span>`:''}
        ${portsCount(p)>0&&!isHf(p,'ports')?`<span class="spec-pill">${portsCount(p)} ports</span>`:''}
        ${p.ip&&!isHf(p,'ip')?`<span class="spec-pill">${esc(p.ip)}</span>`:''}
      </div>
      ${ucHtml}
      <div class="card-footer">
        <label class="compare-check" onclick="event.stopPropagation()">
          <input type="checkbox" ${compareSet.has(p.id)?'checked':''} onchange="toggleCompare(${eid},this.checked)"> Compare
        </label>
        <span class="details-link" onclick="event.stopPropagation();openDetail(${eid})">Details →</span>
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
    const thumb = imgs?.length ? `<img class="list-thumb" src="${imgs[0]}" alt="${esc(p.name)}" loading="lazy">` : `<span></span>`;
    const eid = esc(JSON.stringify(p.id));
    return `
    <div class="list-row ${compareSet.has(p.id)?'compare-selected':''}" role="button" tabindex="0" onclick="openDetail(${eid})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetail(${eid})}">
      ${thumb}
      <div>
        <div class="list-name">${esc(p.name)}</div>
        <div class="list-cat"><span class="badge ${catBadgeClass(p.cat)}">${esc(p.cat)}</span></div>
      </div>
      <div class="list-desc">${esc(p.desc)}</div>
      <div class="list-cell">${hasCellular(p.cellular_gen)&&!isHf(p,'cellular_gen')?`<span class="yes-pill">${esc(p.cellular_gen)}</span>`:'<span class="no-pill">-</span>'}</div>
      <div class="list-cell">${hasWifi(p.wifi)&&!isHf(p,'wifi')?`<span class="yes-pill">${esc(wifiLabel(p.wifi))}</span>`:'<span class="no-pill">-</span>'}</div>
      <div class="list-cell">${(p.rs485===true||p.rs485==='Yes')&&!isHf(p,'rs485')?'<span class="yes-pill">Yes</span>':p.rs485==='Optional'&&!isHf(p,'rs485')?'<span class="yes-pill">Opt</span>':'<span class="no-pill">-</span>'}</div>
      <div class="list-cell">${portsCount(p)>0?esc(portsDisplay(p)):'-'}</div>
      <div class="list-cell" onclick="event.stopPropagation()">
        <input type="checkbox" style="width:14px;height:14px;accent-color:#1A6FC4;cursor:pointer" ${compareSet.has(p.id)?'checked':''} onchange="toggleCompare(${eid},this.checked)">
      </div>
    </div>
  `;
  }).join('');
}

function setView(v) {
  if (v === 'list' && window.innerWidth <= 640) {
    showToast('List view is not available on small screens.');
    return;
  }
  viewMode = v;
  document.getElementById('btnGrid').classList.toggle('active', v==='grid');
  document.getElementById('btnList').classList.toggle('active', v==='list');
  render();
}


