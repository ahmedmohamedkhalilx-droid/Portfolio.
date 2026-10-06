import { createTvs } from './tv3d.js';

const PROJECTS = {
  helco: {
    title: 'HELCO',
    desc: 'Marketing site for Hany ElAraby & Co., an Egyptian audit, tax and advisory firm. Next.js, Tailwind and next-intl, in English and Arabic with full RTL.',
    url: 'https://helco-co.github.io/',
  },
  tessera: {
    title: 'Tessera',
    desc: 'Online store for an Egyptian luxury bed and bath linen house: a custom Shopify theme with about thirty bespoke sections, English and Arabic with full right-to-left support. Shown here as captures of the live storefront.',
    url: null, // Shopify stores cannot be embedded, so the open view shows captured pages and has no link
    scrub: { dir: 'assets/tessera/scrub/', count: 202, maxScroll: 8012 }, // smooth recording of the store scrolling, played back as you scroll
    frames: Array.from({ length: 11 }, (_, i) => `assets/tessera/f${String(i).padStart(2, '0')}.jpg`),
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
      {
        id: 'helco', title: 'HELCO', siteUrl: PROJECTS.helco.url,
        // from helco-co.github.io: ground #0f1419, panels #1b2025, gold #a88c68
        palette: { body: 0x1b2025, back: 0x12181e, bezel: 0x0f1419, accent: 0xa88c68, knob: 0xe1c19a, slot: 0x090e14 },
      },
      {
        id: 'tessera', title: 'Tessera', frames: PROJECTS.tessera.frames,
        // Tessera brand palette: stone #C9C0B0, forest #363C31, burgundy #33161A, plum-black #211415
        palette: {
          body: 0x33161a, back: 0x211415, bezel: 0x211415, accent: 0xc9c0b0, knob: 0xc9c0b0, slot: 0x150b0c,
          screenLight: '#4a5244', screenDark: '#363c31', screenText: '#c9c0b0',
        },
      },
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
  } else if (p.scrub) {
    viewport.replaceChildren(createScrubber(p.scrub, p.title, p.frames[0]));
  } else if (p.frames) {
    const shots = document.createElement('div');
    shots.className = 'shots';
    p.frames.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = i === 0 ? p.title + ' storefront, top of the home page' : '';
      img.loading = i < 2 ? 'eager' : 'lazy';
      shots.append(img);
    });
    viewport.replaceChildren(shots);
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

// Downloads the recorded frames of a site without blocking the page. Coarse frames (every 8th) come
// first so scrubbing works immediately; the rest are fetched nearest-to-the-viewer first, a few at a
// time. On a slow link or with data-saver on, only frames close to the viewer are fetched.
const loaders = new Map();
function getFrameLoader({ dir, count }) {
  if (loaders.has(dir)) return loaders.get(dir);
  const imgs = new Array(count).fill(null); // an Image once it has been requested
  const listeners = new Set();
  const conn = navigator.connection || {};
  const lean = !!conn.saveData || /(^|-)(slow-2g|2g|3g)$/.test(conn.effectiveType || '');
  const MAX = lean ? 2 : 4;
  const COARSE = 8;
  let focus = 0, active = 0, started = false;
  const url = (i) => `${dir}s${String(i).padStart(3, '0')}.webp`;
  function next() {
    for (let i = 0; i < count; i += COARSE) if (!imgs[i]) return i;
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < count; i++) if (!imgs[i] && Math.abs(i - focus) < bestDist) { best = i; bestDist = Math.abs(i - focus); }
    return lean && bestDist > 6 ? -1 : best;
  }
  function pump() {
    while (active < MAX) {
      const i = next();
      if (i < 0) return;
      const img = new Image();
      img.decoding = 'async';
      imgs[i] = img;
      active++;
      const done = () => { active--; listeners.forEach((fn) => fn(i)); pump(); };
      img.onload = done;
      img.onerror = done;
      img.src = url(i);
    }
  }
  const api = {
    imgs,
    start() { if (!started) { started = true; pump(); } },
    setFocus(i) { focus = i; if (started) pump(); },
    onLoad(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    has(i) { const im = imgs[i]; return !!(im && im.complete && im.naturalWidth); },
  };
  loaders.set(dir, api);
  return api;
}

// Start fetching the Tessera recording quietly once the page has settled, so opening it is instant.
function warmUp() {
  const go = () => setTimeout(() => getFrameLoader(PROJECTS.tessera.scrub).start(), 1500);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
}
warmUp();

// Plays a pre-recorded scroll of a site: the frame shown follows the scroll position, so the
// page's own scroll animations (fades, pinned zooms) move exactly as they do on the real site.
function createScrubber(cfg, title, placeholderSrc) {
  const { count, maxScroll } = cfg;
  const loader = getFrameLoader(cfg);
  const el = document.createElement('div');
  el.className = 'scrub';
  el.tabIndex = 0;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', title + ' storefront. Scroll to browse the page.');
  const track = document.createElement('div');
  track.className = 'scrub-track';
  const stage = document.createElement('div');
  stage.className = 'scrub-stage';
  const canvas = document.createElement('canvas');
  canvas.width = 1280;   // the frames are captured at 1280x960; keep them at native size so text stays sharp
  canvas.height = 960;
  const hint = document.createElement('span');
  hint.className = 'scrub-hint';
  hint.textContent = 'Scroll ↓';
  stage.append(canvas, hint);
  el.append(track, stage);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // the first still is already in the browser cache from the TV on the wall, so there is never an empty frame
  const placeholder = new Image();
  placeholder.src = placeholderSrc;
  let want = 0, drawn = false;
  function draw(img) { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); drawn = true; }
  function paint(i) { // draw the wanted frame, or the nearest one that has loaded
    want = i;
    for (let d = 0; d < count; d++) {
      for (const k of [i - d, i + d]) if (k >= 0 && k < count && loader.has(k)) { draw(loader.imgs[k]); return; }
    }
    if (!drawn && placeholder.complete && placeholder.naturalWidth) draw(placeholder);
  }
  placeholder.onload = () => { if (!drawn) paint(want); };
  const off = loader.onLoad((k) => { if (!el.isConnected) { off(); return; } if (Math.abs(k - want) <= 8) paint(want); });
  function frameAt() {
    const range = track.offsetHeight - el.clientHeight;
    return range > 0 ? Math.round((el.scrollTop / range) * (count - 1)) : 0;
  }
  function size() { // scrolling distance matches the real page at the width it is shown at
    const shownWidth = Math.min(el.clientWidth, (el.clientHeight * 4) / 3);
    track.style.height = Math.round(maxScroll * (shownWidth / 1280) + el.clientHeight) + 'px';
  }
  let raf = 0;
  el.addEventListener('scroll', () => {
    hint.classList.add('gone');
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { const i = frameAt(); loader.setFocus(i); paint(i); });
  });
  new ResizeObserver(() => { size(); paint(frameAt()); }).observe(el);
  loader.start(); // no-op if the background warm-up already began
  paint(0);
  return el;
}
