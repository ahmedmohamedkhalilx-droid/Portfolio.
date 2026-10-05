import { createTv } from './tv3d.js';

const SITE = 'https://helco-co.github.io/';
const wall = document.getElementById('wall');
const project = document.getElementById('project');
const frame = document.getElementById('frame');
const viewport = document.getElementById('viewport');
const closeBtn = document.getElementById('close');
const openBtn = document.getElementById('open-project');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let tv = null;
try {
  tv = createTv(wall, { siteUrl: SITE, onPress: openProject });
} catch (err) {
  // no WebGL: the button below still opens the project
  wall.classList.add('no-3d');
  wall.textContent = '3D view is not available in this browser.';
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
const startRect = () => {
  if (tv) return tv.screenRect();
  const w = wall.getBoundingClientRect();
  return { left: w.left + w.width / 2 - 40, top: w.top + w.height / 2 - 30, width: 80, height: 60 };
};

function openProject() {
  if (!project.hidden) return;
  if (tv) tv.setPaused(true);
  project.hidden = false;
  document.body.style.overflow = 'hidden';
  setRect(startRect()); // start exactly over the TV screen
  frame.getBoundingClientRect(); // flush so the transition runs
  requestAnimationFrame(() => {
    project.classList.add('open');
    setRect(fullRect());
  });
  const iframe = document.createElement('iframe');
  iframe.src = SITE;
  iframe.title = 'HELCO live site';
  viewport.replaceChildren(iframe);
  closeBtn.focus({ preventScroll: true });
}

function closeProject() {
  project.classList.remove('open');
  if (tv) tv.setPaused(false);
  setRect(startRect());
  setTimeout(() => {
    project.hidden = true;
    document.body.style.overflow = '';
    viewport.replaceChildren(); // stops the embedded site
    openBtn.focus({ preventScroll: true });
  }, reduceMotion ? 0 : 450);
}

openBtn.addEventListener('click', openProject);
closeBtn.addEventListener('click', closeProject);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !project.hidden) closeProject(); });
window.addEventListener('resize', () => { if (!project.hidden) setRect(fullRect()); });
