// ─── Special Characters Bar ───────────────────────────────────────────────────
let _lastFocusedField = null;

document.addEventListener('focusin', e => {
  const el = e.target;
  if ((el.tagName === 'INPUT' && el.type === 'text') || el.tagName === 'TEXTAREA') {
    _lastFocusedField = el;
  }
});

function insertSpecialChar(ch) {
  const el = _lastFocusedField;
  if (el && document.contains(el) && ((el.tagName === 'INPUT' && el.type === 'text') || el.tagName === 'TEXTAREA')) {
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    el.value = el.value.slice(0, start) + ch + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + ch.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    _scFeedback('Inserted');
  } else {
    navigator.clipboard.writeText(ch)
      .then(()  => _scFeedback('Copied'))
      .catch(() => _scFeedback('Copied'));
  }
}

let _scTimer;
function _scFeedback(msg) {
  const el = document.getElementById('specialCharsFeedback');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_scTimer);
  _scTimer = setTimeout(() => el.classList.remove('show'), 1500);
}

// Add a shadow when the bar is scrolled past its natural position (stuck)
const _scObserver = new IntersectionObserver(
  ([entry]) => entry.target.classList.toggle('stuck', entry.intersectionRatio < 1),
  { threshold: 1 }
);
document.addEventListener('DOMContentLoaded', () => {
  const bar = document.getElementById('specialCharsBar');
  if (bar) _scObserver.observe(bar);
});
