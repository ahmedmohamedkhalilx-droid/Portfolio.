const crt = document.getElementById('crt');
const content = document.getElementById('crt-content');
let lastTv = null;

function openTv(id, trigger) {
  const tpl = document.getElementById('t-' + id);
  if (!tpl) return;
  content.replaceChildren(tpl.content.cloneNode(true));
  lastTv = trigger;
  crt.hidden = false;
  document.getElementById('close').focus();
}

function closeTv() {
  crt.hidden = true;
  if (lastTv) lastTv.focus();
}

document.querySelectorAll('[data-open]').forEach((tv) => {
  tv.addEventListener('click', () => openTv(tv.dataset.open, tv));
});
document.getElementById('close').addEventListener('click', closeTv);
crt.addEventListener('click', (e) => { if (e.target === crt) closeTv(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !crt.hidden) closeTv(); });

// remote: toggle the wall's background
const root = document.documentElement;
try { if (localStorage.getItem('theme') === 'dark') root.dataset.theme = 'dark'; } catch (e) {}
document.getElementById('remote').addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});
