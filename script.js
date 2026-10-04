const crt = document.getElementById('crt');
const crtScreen = document.getElementById('crt-content');
const wall = document.getElementById('wall');
let lastTv = null;

// build the five extra faces of each TV cabinet (the front is already in the HTML)
document.querySelectorAll('.tv').forEach((tv) => {
  ['back', 'left', 'right', 'top', 'bottom'].forEach((side) => {
    const face = document.createElement('div');
    face.className = 'face ' + side;
    tv.append(face);
  });
});

// live site thumbnails: scale the 1280px-wide iframe to fit its TV screen
function fitLive() {
  document.querySelectorAll('.screen.live').forEach((screen) => {
    const s = screen.clientWidth / 1280;
    screen.style.setProperty('--s', s);
    screen.querySelector('iframe').style.height = screen.clientHeight / s + 'px';
  });
}
fitLive();
window.addEventListener('resize', fitLive);

// tilt the whole wall slightly toward the pointer
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduceMotion) {
  window.addEventListener('pointermove', (e) => {
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    wall.style.setProperty('--rx', (x * 26).toFixed(2) + 'deg');
    wall.style.setProperty('--ry', (-y * 12).toFixed(2) + 'deg');
  });
}

function openTv(id, trigger) {
  const tpl = document.getElementById('t-' + id);
  if (!tpl) return;
  crtScreen.replaceChildren(tpl.content.cloneNode(true));
  crtScreen.classList.toggle('wide', tpl.hasAttribute('data-wide'));
  lastTv = trigger;
  crt.hidden = false;
  document.getElementById('close').focus();
}

function closeTv() {
  crt.hidden = true;
  crtScreen.replaceChildren(); // also stops any embedded site
  if (lastTv) lastTv.focus();
}

document.querySelectorAll('[data-open]').forEach((tv) => {
  tv.addEventListener('click', () => openTv(tv.dataset.open, tv));
  tv.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTv(tv.dataset.open, tv); }
  });
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
