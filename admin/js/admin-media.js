// ─── Images ──────────────────────────────────────────────────────────────────
function resolveImg(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return '../' + url.replace(/^\.\//, '');
}
function renderImageGrid() {
  const ex = currentImgs.map((url, i) => `<div class="img-item">
    <img src="${resolveImg(url)}" alt="" onerror="this.style.opacity='.3'">
    <button class="img-rm" onclick="removeExistingImg(${i})">×</button></div>`).join('');
  const pn = pendingImgs.map((pi, i) => `<div class="img-item">
    <img src="${pi.dataUrl}" alt=""><span class="img-badge">New</span>
    <button class="img-rm" onclick="removePendingImg(${i})">×</button></div>`).join('');
  document.getElementById('imageGrid').innerHTML = ex + pn;
}
function handleImageFiles(e) {
  [...e.target.files].forEach(file => {
    const r = new FileReader();
    r.onload = ev => { pendingImgs.push({ file, dataUrl: ev.target.result }); renderImageGrid(); };
    r.readAsDataURL(file);
  });
  e.target.value = '';
}
function removeExistingImg(i) { currentImgs.splice(i,1); renderImageGrid(); }
function removePendingImg(i)  { pendingImgs.splice(i,1); renderImageGrid(); }

// ─── Datasheet ────────────────────────────────────────────────────────────────
function renderDatasheet() {
  const w = document.getElementById('datasheetWrap');
  if (pendingDs) {
    w.innerHTML = `<div class="ds-row pending"><span>📄 ${esc(pendingDs.name)} <em style="color:#1A6FC4">(pending upload)</em></span><button class="ds-rm" onclick="clearDatasheet()">×</button></div>`;
  } else if (currentDs === 'contact_us') {
    w.innerHTML = `<div class="ds-row"><span style="color:#1A6FC4;font-size:13px">Contact us</span><button class="ds-rm" onclick="clearDatasheet()">×</button></div>`;
  } else if (currentDs) {
    const rawM = currentDs.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/[^/]+\/(.+)$/);
    const dsHref = rawM ? `https://${rawM[1]}.github.io/${rawM[2]}/${rawM[3]}` : (currentDs.startsWith('http') ? currentDs : '../' + currentDs);
    w.innerHTML = `<div class="ds-row"><a href="${dsHref}" target="_blank">📄 View current datasheet</a><button class="ds-rm" onclick="clearDatasheet()">×</button></div>`;
  } else {
    w.innerHTML = '';
  }
}
function handleDatasheetFile(e) { pendingDs = e.target.files[0]||null; renderDatasheet(); e.target.value=''; }
function clearDatasheet() { pendingDs = null; currentDs = ''; renderDatasheet(); }
function setDsContactUs() { pendingDs = null; currentDs = 'contact_us'; renderDatasheet(); }
