import { createTvs } from './tv3d.js';

const PROJECTS = {
  helco: {
    title: 'HELCO',
    desc: 'Marketing site for Hany ElAraby & Co., an Egyptian audit, tax and advisory firm. Next.js, Tailwind and next-intl, in English and Arabic with full RTL.',
    url: 'https://helco-co.github.io/',
  },
  tessera: {
    title: 'Tessera',
    desc: 'A custom Shopify theme for the Tessera storefront: woven coverlets, tailored collections and bespoke packaging.',
    url: null, // not published yet
  },
};

const wall = document.getElementById('wall');
const project = document.getElementById('project');
const frame = document.getElementById('frame');
const viewport = document.getElementById('viewport');
const closeBtn = document.getElementById('close');
const pTitle = document.getElementById('p-title');
const pDesc = document.getElementById('p-desc');
const pLink = document.getElementById('p-link');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let tvs = null;
let current = null;
let lastTrigger = null;
try {
  tvs = createTvs(
    wall,
    [
      { id: 'helco', title: 'HELCO', siteUrl: PROJECTS.helco.url },
      { id: 'tessera', title: 'Tessera', label: 'TESSERA', sub: 'COMING SOON', color: 0x362f27 },
    ],
    { onPress: (id) => openProject(id) }
  );
} catch (err) {
  // no WebGL: the buttons below still open the projects
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
const startRect = (id) => {
  if (tvs) return tvs.screenRect(id);
  const w = wall.getBoundingClientRect();
  return { left: w.left + w.width / 2 - 40, top: w.top + w.height / 2 - 30, width: 80, height: 60 };
};

function openProject(id) {
  if (!project.hidden) return;
  const p = PROJECTS[id];
  current = id;
  lastTrigger = document.activeElement;
  if (tvs) tvs.setPaused(true);

  pTitle.textContent = p.title;
  pDesc.textContent = p.desc;
  pLink.hidden = !p.url;
  if (p.url) pLink.href = p.url;
  if (p.url) {
    const iframe = document.createElement('iframe');
    iframe.src = p.url;
    iframe.title = p.title + ' live site';
    viewport.replaceChildren(iframe);
  } else {
    const note = document.createElement('div');
    note.className = 'soon';
    note.innerHTML = '<b>Not published yet</b><span>The live store will appear here once it launches.</span>';
    viewport.replaceChildren(note);
  }

  project.hidden = false;
  document.body.style.overflow = 'hidden';
  setRect(startRect(id)); // start exactly over the TV screen
  frame.getBoundingClientRect(); // flush so the transition runs
  requestAnimationFrame(() => {
    project.classList.add('open');
    setRect(fullRect());
  });
  closeBtn.focus({ preventScroll: true });
}

function closeProject() {
  project.classList.remove('open');
  if (tvs) tvs.setPaused(false);
  setRect(startRect(current));
  setTimeout(() => {
    project.hidden = true;
    document.body.style.overflow = '';
    viewport.replaceChildren(); // stops the embedded site
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus({ preventScroll: true });
  }, reduceMotion ? 0 : 450);
}

document.querySelectorAll('[data-open]').forEach((btn) => {
  btn.addEventListener('click', () => openProject(btn.dataset.open));
});
closeBtn.addEventListener('click', closeProject);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !project.hidden) closeProject(); });
window.addEventListener('resize', () => { if (!project.hidden) setRect(fullRect()); });
