const wall = document.getElementById('wall');
const tv = document.getElementById('tv-helco');
const screenEl = document.getElementById('tv-screen');
const project = document.getElementById('project');
const frame = document.getElementById('frame');
const viewport = document.getElementById('viewport');
const closeBtn = document.getElementById('close');
const SITE = 'https://helco-co.github.io/';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// build the five extra faces of the cabinet (the front is already in the HTML)
['back', 'left', 'right', 'top', 'bottom'].forEach((side) => {
  const face = document.createElement('div');
  face.className = 'face ' + side;
  tv.append(face);
});

// scale the 1280px-wide live preview to fit the TV screen
function fitLive() {
  const s = screenEl.clientWidth / 1280;
  const iframe = screenEl.querySelector('iframe');
  screenEl.style.setProperty('--s', s);
  iframe.style.height = screenEl.clientHeight / s + 'px';
}
fitLive();
window.addEventListener('resize', fitLive);

// tilt the TV toward the pointer
if (!reduceMotion) {
  window.addEventListener('pointermove', (e) => {
    if (!project.hidden) return;
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    wall.style.setProperty('--rx', (x * 26 - 8).toFixed(2) + 'deg');
    wall.style.setProperty('--ry', (-y * 12 + 3).toFixed(2) + 'deg');
  });
}

function setRect(r) {
  frame.style.left = r.left + 'px';
  frame.style.top = r.top + 'px';
  frame.style.width = r.width + 'px';
  frame.style.height = r.height + 'px';
}
const fullRect = () => {
  const m = Math.min(window.innerWidth, window.innerHeight) * 0.03;
  return { left: m, top: m, width: window.innerWidth - m * 2, height: window.innerHeight - m * 2 };
};

function openProject() {
  const r = screenEl.getBoundingClientRect();
  project.hidden = false;
  document.body.style.overflow = 'hidden';
  setRect(r); // start exactly over the TV screen
  frame.getBoundingClientRect(); // flush so the transition runs
  requestAnimationFrame(() => {
    project.classList.add('open');
    setRect(fullRect());
  });
  const iframe = document.createElement('iframe');
  iframe.src = SITE;
  iframe.title = 'HELCO live site';
  viewport.replaceChildren(iframe);
  closeBtn.focus();
}

function closeProject() {
  project.classList.remove('open');
  setRect(screenEl.getBoundingClientRect());
  setTimeout(() => {
    project.hidden = true;
    document.body.style.overflow = '';
    viewport.replaceChildren(); // stops the embedded site
    tv.focus();
  }, reduceMotion ? 0 : 450);
}

tv.addEventListener('click', openProject);
tv.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(); }
});
closeBtn.addEventListener('click', closeProject);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !project.hidden) closeProject(); });
window.addEventListener('resize', () => { if (!project.hidden) setRect(fullRect()); });
