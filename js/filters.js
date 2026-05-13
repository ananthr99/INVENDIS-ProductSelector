function getFiltered() {
  const q = (document.getElementById('search').value||'').toLowerCase().trim();
  const fCell = document.getElementById('fCell').value;
  const fWifi = document.getElementById('fWifi').value;
  const fPorts = document.getElementById('fPorts').value;
  const fSerial = document.getElementById('fSerial').value;
  const results = PRODUCTS.filter(p => {
    if (activeCat !== 'All' && p.cat !== activeCat) return false;
    if (q && !p.name.toLowerCase().includes(q) && !p.desc.toLowerCase().includes(q) && !p.cat.toLowerCase().includes(q) && !p.cpu.toLowerCase().includes(q)) return false;
    if (fCell === '5G' && p.cellular_gen !== '5G') return false;
    if (fCell === '4G' && p.cellular_gen !== '4G') return false;
    if (fCell === 'none' && p.cellular_gen !== 'none') return false;
    if (fWifi === 'WiFi6' && p.wifi !== 'WiFi6') return false;
    if (fWifi === 'WiFi5' && p.wifi !== 'WiFi5') return false;
    if (fWifi === 'WiFi24' && p.wifi !== 'WiFi24') return false;
    if (fWifi === 'none' && p.wifi !== 'none') return false;
    if (fPorts === '2' && p.ports > 2) return false;
    if (fPorts === '5' && (p.ports < 3 || p.ports > 5)) return false;
    if (fPorts === '8' && (p.ports < 6 || p.ports > 8)) return false;
    if (fPorts === '10' && p.ports < 9) return false;
    if (fSerial === 'rs485' && !p.rs485) return false;
    if (fSerial === 'rs232' && !p.rs232) return false;
    if (fSerial === 'both' && !(p.rs485 && p.rs232)) return false;
    return true;
  });
  results.sort((a, b) => {
    const aHasImg = !!(PRODUCT_IMAGES[a.id] && PRODUCT_IMAGES[a.id].length);
    const bHasImg = !!(PRODUCT_IMAGES[b.id] && PRODUCT_IMAGES[b.id].length);
    if (aHasImg === bHasImg) return 0;
    return aHasImg ? -1 : 1;
  });
  return results;
}

function hasActiveFilters() {
  return document.getElementById('search').value || document.getElementById('fCell').value ||
    document.getElementById('fWifi').value || document.getElementById('fPorts').value ||
    document.getElementById('fSerial').value || activeCat !== 'All';
}

function setCat(c) { activeCat = c; currentPage = 1; render(); }

function clearFilters() {
  document.getElementById('search').value = '';
  document.getElementById('fCell').value = '';
  document.getElementById('fWifi').value = '';
  document.getElementById('fPorts').value = '';
  document.getElementById('fSerial').value = '';
  activeCat = 'All';
  currentPage = 1;
  render();
}
