// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = [
  'id','name','cat','order','desc',
  'cpu','ram','storage','cell','cellular_gen','wifi',
  'rs485','rs232','ip','power','ports','os',
  'housing','dims','weight','op_temp',
  'images','use_cases','datasheet','variants_json','part_datasheets'
];
const CFG        = typeof ONEDRIVE_CONFIG !== 'undefined' ? ONEDRIVE_CONFIG : {};
const FOLDER     = CFG.folderPath || 'ProductSelector';
const GRAPH      = 'https://graph.microsoft.com/v1.0';
const SCOPES     = ['Files.ReadWrite','User.Read'];

// ─── Dropdown defaults ────────────────────────────────────────────────────────
const DROPDOWN_FIELD_LABELS = {
  wifi:         'Wi-Fi',
  cellular_gen: 'Cellular Gen',
  rs485:        'RS485',
  rs232:        'RS232',
};
const DEFAULT_DROPDOWNS = {
  wifi:         ['WiFi6', 'WiFi5', 'WiFi4/2.4GHz', 'WiFi4', '-'],
  cellular_gen: ['5G', '4G', '3G', '-'],
  rs485:        ['Yes', 'No', 'Optional', '-'],
  rs232:        ['Yes', 'No', 'Optional', '-'],
};

const CONVERTIBLE_TEXT_FIELDS = {
  cell:    { label: 'Cellular Module', htmlId: 'fCell',    placeholder: 'e.g. EC25-AF' },
  cpu:     { label: 'CPU',             htmlId: 'fCpu',     placeholder: '' },
  ram:     { label: 'RAM',             htmlId: 'fRam',     placeholder: '' },
  storage: { label: 'Storage',         htmlId: 'fStorage', placeholder: '' },
  ip:      { label: 'IP Rating',       htmlId: 'fIp',      placeholder: 'e.g. IP30' },
  power:   { label: 'Power Input',     htmlId: 'fPower',   placeholder: 'e.g. 9–36V DC' },
  os:      { label: 'OS',              htmlId: 'fOs',      placeholder: 'e.g. OpenWrt' },
  dims:    { label: 'Dimensions',      htmlId: 'fDims',    placeholder: 'e.g. 140×90×30 mm' },
  weight:  { label: 'Weight',          htmlId: 'fWeight',  placeholder: '' },
  housing: { label: 'Housing',         htmlId: 'fHousing', placeholder: 'e.g. Aluminium' },
  op_temp: { label: 'Operating Temp',  htmlId: 'fOpTemp',  placeholder: 'e.g. -20–60 °C' },
};

const HIDEABLE_FIELD_MAP = {
  fCell: 'cell', fCellGen: 'cellular_gen', fWifi: 'wifi',
  fCpu: 'cpu', fRam: 'ram', fStorage: 'storage',
  fIp: 'ip', fPower: 'power', fPorts: 'ports', fOs: 'os',
  fRs485: 'rs485', fRs232: 'rs232',
  fHousing: 'housing', fDims: 'dims', fWeight: 'weight', fOpTemp: 'op_temp'
};

// ─── State ────────────────────────────────────────────────────────────────────
let sessionToken = ''; // loaded from OneDrive after login; falls back to localStorage
let folderCtx   = null; // resolved after login: { ownDrive:true } | { driveId, folderId }
let products    = [];
let cats        = [];
let dropdowns   = JSON.parse(JSON.stringify(DEFAULT_DROPDOWNS));
let selectedId  = null;
let lastGistJson  = null; // snapshot of last successfully written Gist content, used for rollback
let _syncRepoJson = null; // repo JSON fetched by loadSyncComparison(), used by overwriteGistFromRepo()
let _syncGistJson = null; // gist JSON fetched by loadSyncComparison(), used by overwriteRepoFromGist()
let currentImgs = [];   // existing image URLs for the selected product
let pendingImgs = [];   // [{file, dataUrl}] not yet uploaded
let pendingDs      = null; // File object pending upload
let isDirty = false;
let currentDs      = '';   // current datasheet URL
let currentPartDs  = {};   // existing part_datasheets {partNo: url}
let pendingPartDs  = [];   // [{partNo, file}] not yet uploaded
let sidebarCat  = '';
let msalInst;

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(name) {
  ['products','cats','fields','setup','changelog'].forEach(t => {
    document.getElementById('panel' + cap(t)).classList.toggle('active', t === name);
    document.getElementById('tab'   + cap(t)).classList.toggle('active', t === name);
  });
  if (name === 'cats')      renderCatList();
  if (name === 'setup')     renderSetupStatus();
  if (name === 'changelog') loadChangelog();
  if (name === 'fields')    renderDropdownEditor();
}

// ─── Screens ─────────────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const map = { setup:'sSetup', login:'sLogin', loading:'sLoading', dash:'sDash' };
  document.getElementById(map[name]).classList.add('active');
}

function showConfirm(message, onOk) {
  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.innerHTML = `
    <div class="confirm-box">
      <h3>Unsaved Changes</h3>
      <p>${message}</p>
      <div class="confirm-actions">
        <button class="confirm-btn-cancel" id="confirmCancel">Keep editing</button>
        <button class="confirm-btn-ok" id="confirmOk">Discard changes</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('confirmOk').onclick = () => { el.remove(); onOk(); };
  document.getElementById('confirmCancel').onclick = () => el.remove();
}


// ─── Toast / Overlay ─────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (type ? ' '+type : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
function showOverlay(msg)   { document.getElementById('overlay').style.display='flex'; document.getElementById('overlayMsg').textContent=msg; }
function updateOverlay(msg) { document.getElementById('overlayMsg').textContent=msg; }
function hideOverlay()      { document.getElementById('overlay').style.display='none'; }

// ─── Utils ───────────────────────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cap(s) { return s.charAt(0).toUpperCase()+s.slice(1); }
