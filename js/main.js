document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

async function fetchProductData() {
  const gistId = typeof ONEDRIVE_CONFIG !== 'undefined' && ONEDRIVE_CONFIG.gistId;

  // 1. Try Gist API — always fresh, but limited to 60 unauthenticated req/hour
  if (gistId) {
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, { cache: 'no-store' });
      if (res.ok) {
        const gist    = await res.json();
        const content = gist.files?.['products.json']?.content;
        if (content) return JSON.parse(content);
      }
      console.warn('[ProductSelector] Gist API returned', res.status, '— trying repo fallback');
    } catch(e) {
      console.warn('[ProductSelector] Gist fetch error:', e.message);
    }
  }

  // 2. Fallback: data/products.json committed to the repo (no rate limits, updates within ~1 min of a save)
  try {
    const res = await fetch(`data/products.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) return await res.json();
    console.warn('[ProductSelector] data/products.json returned', res.status);
  } catch(e) {
    console.warn('[ProductSelector] data/products.json fetch error:', e.message);
  }

  return null;
}

function applyData(data) {
  if (!data) return;

  if (Array.isArray(data.cats) && data.cats.length) {
    CATS.splice(0, CATS.length, ...data.cats);
  }

  if (Array.isArray(data.products) && data.products.length) {
    [PRODUCT_IMAGES, PRODUCT_USE_CASES, PRODUCT_DATASHEETS].forEach(map => {
      Object.keys(map).forEach(k => delete map[k]);
    });
    Object.keys(PART_DATASHEETS).forEach(k => delete PART_DATASHEETS[k]);

    PRODUCTS = data.products.map(d => {
      if (d.images?.length)    PRODUCT_IMAGES[d.id]    = d.images;
      if (d.use_cases?.length) PRODUCT_USE_CASES[d.id] = d.use_cases;
      if (d.datasheet)         PRODUCT_DATASHEETS[d.id] = d.datasheet;
      if (d.part_datasheets)   Object.assign(PART_DATASHEETS, d.part_datasheets);
      return d;
    });
  }
}

async function initApp() {
  document.getElementById('results').innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:#aaa">
      <svg style="animation:spin 1s linear infinite;width:28px;height:28px;display:block;margin:0 auto 12px" viewBox="0 0 24 24" fill="none" stroke="#1A6FC4" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity=".15"/>
        <path d="M12 2a10 10 0 0 1 10 10"/>
      </svg>
      <p style="font-size:14px">Loading products…</p>
    </div>`;

  const data = await fetchProductData();
  if (data) {
    applyData(data);
  } else {
    console.warn('[ProductSelector] All fetches failed — using static data');
    PRODUCTS = PRODUCTS_DATA;
  }

  document.getElementById('statTotal').textContent = PRODUCTS.length;
  render();
}

initApp();
