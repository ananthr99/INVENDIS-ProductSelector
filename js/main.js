document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'ArrowLeft'  && carouselImages.length > 1) navigateCarousel(-1);
  if (e.key === 'ArrowRight' && carouselImages.length > 1) navigateCarousel(1);
});

async function fetchProductData() {
  const CACHE_KEY = 'invendis_products_cache';
  const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  // Return cached data if still fresh
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) return data;
    }
  } catch(e) { /* ignore corrupt cache */ }

  const gistId = typeof ONEDRIVE_CONFIG !== 'undefined' && ONEDRIVE_CONFIG.gistId;

  // 1. Try Gist API
  if (gistId) {
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, { cache: 'no-store' });
      if (res.ok) {
        const gist    = await res.json();
        const content = gist.files?.['products.json']?.content;
        if (content) {
          const data = JSON.parse(content);
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
          return data;
        }
      }
      console.warn('[ProductSelector] Gist API returned', res.status, '— trying repo fallback');
    } catch(e) {
      console.warn('[ProductSelector] Gist fetch error:', e.message);
    }
  }

  // 2. Fallback: data/products.json
  try {
    const res = await fetch(`data/products.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      return data;
    }
    console.warn('[ProductSelector] data/products.json returned', res.status);
  } catch(e) {
    console.warn('[ProductSelector] data/products.json fetch error:', e.message);
  }

  return null;
}


function injectCatColorStyles(catColors) {
  if (!catColors || !Object.keys(catColors).length) return;
  const FIXED = { Router:'b-router', Gateway:'b-gateway', Switch:'b-switch', 'Energy Meter':'b-energy', Other:'b-other', PCB:'b-pcb' };
  const slug  = n => 'b-cat-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const isSafeColor = v => /^#[0-9a-fA-F]{3,8}$|^rgb[a]?\([^)]*\)$|^hsl[a]?\([^)]*\)$|^[a-zA-Z]+$/.test(String(v||'').trim());
  let css = '';
  for (const [name, col] of Object.entries(catColors)) {
    const cls = FIXED[name] || slug(name);
    if (isSafeColor(col.bg) && isSafeColor(col.fg))
      css += `.${cls}{background:${col.bg};color:${col.fg}}\n`;
  }
  let el = document.getElementById('_dynCatColors');
  if (!el) { el = document.createElement('style'); el.id = '_dynCatColors'; document.head.appendChild(el); }
  el.textContent = css;
}

// raw.githubusercontent.com serves files with Content-Disposition: attachment and blocks
// cross-origin fetch (CORS). GitHub Pages serves the same committed files with correct
// MIME types and no forced download. Normalise at load time so every consumer gets the
// right URL without needing per-consumer workarounds.
function rawToPages(url) {
  if (!url || typeof url !== 'string') return url;
  const m = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/[^/]+\/(.+)$/);
  return m ? `https://${m[1]}.github.io/${m[2]}/${m[3]}` : url;
}

function applyData(data) {
  if (!data) return;

  if (Array.isArray(data.cats) && data.cats.length) {
    CATS.splice(0, CATS.length, ...data.cats);
  }

  if (data.catColors) {
    injectCatColorStyles(data.catColors);
  }

  if (Array.isArray(data.products) && data.products.length) {
    [PRODUCT_IMAGES, PRODUCT_USE_CASES, PRODUCT_DATASHEETS].forEach(map => {
      Object.keys(map).forEach(k => delete map[k]);
    });
    Object.keys(PART_DATASHEETS).forEach(k => delete PART_DATASHEETS[k]);

    PRODUCTS = data.products.map(d => {
      if (d.images?.length) {
        d.images = d.images.map(rawToPages);
        PRODUCT_IMAGES[d.id] = d.images;
      }
      if (d.use_cases?.length) PRODUCT_USE_CASES[d.id] = d.use_cases;
      if (d.datasheet) {
        d.datasheet = rawToPages(d.datasheet);
        PRODUCT_DATASHEETS[d.id] = d.datasheet;
      }
      if (d.part_datasheets) {
        Object.keys(d.part_datasheets).forEach(k => {
          d.part_datasheets[k] = rawToPages(d.part_datasheets[k]);
        });
        Object.assign(PART_DATASHEETS, d.part_datasheets);
      }
      return d;
    });
  }

  if (data.siteConfig) {
    applySiteConfig(data.siteConfig);
  }
}

function applySiteConfig(cfg) {
  if (!cfg) return;
  if (cfg.email) {
    document.querySelectorAll('[data-cfg="email"]').forEach(el => {
      el.href = 'mailto:' + cfg.email;
      el.textContent = cfg.email;
    });
  }
  if (cfg.phone) {
    document.querySelectorAll('[data-cfg="phone"]').forEach(el => {
      el.href = 'tel:' + cfg.phone.replace(/\s/g, '');
      el.textContent = cfg.phone;
    });
  }
  if (cfg.heroSubtitle) {
    document.querySelectorAll('[data-cfg="heroSubtitle"]').forEach(el => el.textContent = cfg.heroSubtitle);
  }
  if (cfg.footerBrandText) {
    document.querySelectorAll('[data-cfg="footerBrandText"]').forEach(el => el.textContent = cfg.footerBrandText);
  }
  if (cfg.address) {
    document.querySelectorAll('[data-cfg="address"]').forEach(el => {
      el.textContent = '';
      cfg.address.split('\n').forEach((line, i) => {
        if (i) el.appendChild(document.createElement('br'));
        el.appendChild(document.createTextNode(line));
      });
    });
  }
  if (cfg.copyright) {
    document.querySelectorAll('[data-cfg="copyright"]').forEach(el => {
      el.textContent = '© ' + cfg.copyright;
    });
  }
  if (cfg.logoInvendis) document.querySelectorAll('[data-cfg="logoInvendis"]').forEach(el => el.src = cfg.logoInvendis);
  if (cfg.logoSilbo)    document.querySelectorAll('[data-cfg="logoSilbo"]').forEach(el => el.src = cfg.logoSilbo);
  if (cfg.logoMii)      document.querySelectorAll('[data-cfg="logoMii"]').forEach(el => el.src = cfg.logoMii);
  if (cfg.invendisUrl)  document.querySelectorAll('[data-cfg="invendisUrl"]').forEach(el => el.href = cfg.invendisUrl);
  if (cfg.silboUrl)     document.querySelectorAll('[data-cfg="silboUrl"]').forEach(el => el.href = cfg.silboUrl);
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

  updateHeroStats();
  loadFromURL();
  render();
}

initApp();

window.addEventListener('resize', () => {
  if (window.innerWidth <= 640 && viewMode === 'list') {
    setView('grid');
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    sessionStorage.removeItem('invendis_products_cache');
  }
});
