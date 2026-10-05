import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// Procedural retro TVs. A TV with a `siteUrl` shows that live site as a real iframe placed on
// the screen by the CSS3D renderer (below the canvas); its screen mesh punches a transparent
// hole in the canvas so the cabinet correctly hides the site. A TV with a `label` shows a
// painted "coming soon" screen instead.

const BODY = { w: 8, h: 6, d: 5 };
const SCREEN = { w: 5.2, h: 3.9, x: -0.95, y: 0.15, r: 0.45 };
const FRAME_PX = { w: 1280, h: 960 }; // the iframe's size; its aspect matches SCREEN
const HOVER_SCALE = 1.12;

function rrect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function glossTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.0)');
  grad.addColorStop(1, 'rgba(255,255,255,0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// the screen shown by a TV that has no live site yet
function labelTexture(label, sub, pal) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 768;
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(440, 330, 60, 512, 384, 620);
  bg.addColorStop(0, pal.screenLight);
  bg.addColorStop(1, pal.screenDark);
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 768);
  g.fillStyle = pal.screenText;
  g.textAlign = 'center';
  g.font = '600 150px Georgia, "Times New Roman", serif';
  g.fillText(label, 512, 390);
  g.font = '34px ui-monospace, Consolas, monospace';
  g.globalAlpha = 0.8;
  g.fillText(sub, 512, 470);
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,0.14)'; // scanlines
  for (let y = 0; y < 768; y += 4) g.fillRect(0, y, 1024, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createTvs(container, tvConfigs, { onPress }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);

  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  gl.shadowMap.enabled = true;
  const css = new CSS3DRenderer();
  for (const el of [css.domElement, gl.domElement]) {
    el.style.position = 'absolute';
    el.style.inset = '0';
  }
  css.domElement.style.pointerEvents = 'none';
  container.append(css.domElement, gl.domElement);

  // ----- shared materials
  const hole = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide });
  const gloss = glossTexture();

  function buildTv(cfg) {
    const g = new THREE.Group();
    const pal = cfg.palette; // each TV wears its website's colours
    const bodyMat = new THREE.MeshStandardMaterial({ color: pal.body, roughness: 0.55, metalness: 0.15 });
    const backMat = new THREE.MeshStandardMaterial({ color: pal.back, roughness: 0.7, metalness: 0.1 });
    const bezelMat = new THREE.MeshStandardMaterial({ color: pal.bezel, roughness: 0.4, metalness: 0.2 });
    const chrome = new THREE.MeshStandardMaterial({ color: pal.knob, roughness: 0.3, metalness: 0.85 });
    const tan = new THREE.MeshStandardMaterial({ color: pal.accent, roughness: 0.4, metalness: 0.7 });
    const black = new THREE.MeshStandardMaterial({ color: pal.slot, roughness: 0.8 });

    const body = new THREE.Mesh(new RoundedBoxGeometry(BODY.w, BODY.h, BODY.d, 5, 0.28), bodyMat);
    body.castShadow = true;
    g.add(body);
    const back = new THREE.Mesh(new RoundedBoxGeometry(5.8, 4.5, 2.6, 5, 0.4), backMat);
    back.position.set(-0.6, 0, -BODY.d / 2 - 1.1);
    back.castShadow = true;
    g.add(back);

    // bezel ring around the screen
    const frontZ = BODY.d / 2;
    const ring = rrect(SCREEN.w + 0.7, SCREEN.h + 0.7, SCREEN.r + 0.25);
    ring.holes.push(rrect(SCREEN.w, SCREEN.h, SCREEN.r));
    const bezel = new THREE.Mesh(
      new THREE.ExtrudeGeometry(ring, { depth: 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 24 }),
      bezelMat
    );
    bezel.position.set(SCREEN.x, SCREEN.y, frontZ);
    g.add(bezel);

    // the screen: a see-through hole for a live site, or a painted texture
    const screenZ = frontZ + 0.03;
    const screenMat = cfg.siteUrl
      ? hole
      : new THREE.MeshBasicMaterial({ map: labelTexture(cfg.label, cfg.sub, pal), side: THREE.DoubleSide });
    const screen = new THREE.Mesh(new THREE.ShapeGeometry(rrect(SCREEN.w, SCREEN.h, SCREEN.r), 24), screenMat);
    screen.position.set(SCREEN.x, SCREEN.y, screenZ);
    if (!cfg.siteUrl) { // ShapeGeometry UVs are in shape units; remap to 0..1 for the texture
      const uv = screen.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / SCREEN.w + 0.5, uv.getY(i) / SCREEN.h + 0.5);
    }
    g.add(screen);

    const glare = new THREE.Mesh(
      new THREE.PlaneGeometry(SCREEN.w, SCREEN.h),
      new THREE.MeshBasicMaterial({ map: gloss, transparent: true, depthWrite: false, opacity: 0.35 })
    );
    glare.position.set(SCREEN.x, SCREEN.y, screenZ + 0.005);
    g.add(glare);

    // control panel: knobs, speaker slots, tan strip
    const panelX = 3.0;
    // two real dials: a recessed collar, a ridged metal knob, a tan cap and a dark pointer.
    // The knob is turned by rotating the group about the z axis (the axis it faces along).
    const dials = [];
    [[1.8, -0.5], [0.75, 0.9]].forEach(([y, start]) => {
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 0.1, 40), black);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(panelX, y, frontZ + 0.05);
      g.add(collar);

      const dial = new THREE.Group();
      dial.position.set(panelX, y, frontZ + 0.1);
      dial.userData.dial = { angle: start, target: start };
      dial.rotation.z = start;

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.34, 40), chrome);
      body.rotation.x = Math.PI / 2;           // cylinder axis now points out of the TV (+z)
      body.position.z = 0.17;
      body.castShadow = true;
      dial.add(body);
      for (let k = 0; k < 20; k++) {           // grip ridges around the rim
        const ang = (k / 20) * Math.PI * 2;
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.3), chrome);
        ridge.position.set(Math.cos(ang) * 0.45, Math.sin(ang) * 0.45, 0.17);
        ridge.rotation.z = ang;
        dial.add(ridge);
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 32), tan);
      cap.rotation.x = Math.PI / 2;
      cap.position.z = 0.36;
      dial.add(cap);
      const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.05), black);
      pointer.position.set(0, 0.17, 0.41);
      dial.add(pointer);

      dial.traverse((o) => { o.userData.dialOwner = dial; });
      g.add(dial);
      dials.push(dial);
    });
    for (let i = 0; i < 9; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.05), black);
      slot.position.set(panelX - 0.55 + i * 0.14, -1.35, frontZ + 0.01);
      g.add(slot);
    }
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.04), tan);
    strip.position.set(panelX, -2.35, frontZ + 0.01);
    g.add(strip);

    [[-3, -1.6], [3, -1.6], [-3, 1.6], [3, 1.6]].forEach(([x, z]) => {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.35, 20), black);
      foot.position.set(x, -BODY.h / 2 - 0.12, z);
      foot.castShadow = true;
      g.add(foot);
    });

    // antennas
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), backMat);
    base.position.set(-0.3, BODY.h / 2 - 0.02, -0.4);
    g.add(base);
    [-0.6, 0.55].forEach((tilt) => {
      const pivot = new THREE.Group();
      pivot.position.copy(base.position);
      pivot.rotation.z = tilt;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3.4, 10), tan);
      rod.position.y = 1.7;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), tan);
      tip.position.y = 3.4;
      pivot.add(rod, tip);
      g.add(pivot);
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: 0.4 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -BODY.h / 2 - 0.3;
    floor.receiveShadow = true;
    g.add(floor);

    if (cfg.siteUrl) { // the live site, mapped onto the screen
      const frame = document.createElement('iframe');
      frame.src = cfg.siteUrl;
      frame.title = cfg.title + ' live preview';
      frame.loading = 'lazy';
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      Object.assign(frame.style, { width: FRAME_PX.w + 'px', height: FRAME_PX.h + 'px', border: '0', background: '#0f1512', pointerEvents: 'none' });
      const site = new CSS3DObject(frame);
      site.position.set(SCREEN.x, SCREEN.y, screenZ);
      site.scale.setScalar(SCREEN.w / FRAME_PX.w);
      g.add(site);
    }

    return { id: cfg.id, group: g, screen, dials, scale: 1, target: 1 };
  }
  const row = new THREE.Group(); // both TVs live in one row so they turn together and stay touching
  scene.add(row);
  const tvs = tvConfigs.map(buildTv);
  tvs.forEach((t) => row.add(t.group));

  scene.add(new THREE.HemisphereLight(0xcfe3d8, 0x0a0e0c, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-6, 10, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fb59c, 1.6);
  rim.position.set(8, 3, -7);
  scene.add(rim);

  // ----- layout: side by side at every screen size
  function layout(aspect) {
    const n = tvs.length;
    const gap = BODY.w + 0.04; // cabinets touch (a hair of air avoids z-fighting)
    tvs.forEach((t, i) => t.group.position.set((i - (n - 1) / 2) * gap, 0, 0));
    row.rotation.y = -0.2; // the row turns as one piece, so the TVs stay edge to edge
    const spanW = (n - 1) * gap + BODY.w + 2.2;
    const spanH = 13;
    const t15 = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(spanW / (2 * t15 * aspect), spanH / (2 * t15)) * 1.04;
    camera.position.set(0, 0.9 + dist * 0.1, dist);
    camera.lookAt(0, 0.5, 0);
    camera.updateMatrixWorld(true);
  }

  // ----- render on demand
  let paused = false;
  let dirty = true;
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    gl.setSize(w, h);
    css.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    layout(w / h);
    dirty = true;
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop() {
    requestAnimationFrame(loop);
    if (paused) return;
    for (const t of tvs) { // ease each TV toward its hover size
      if (Math.abs(t.scale - t.target) > 0.001) {
        t.scale = reduceMotion ? t.target : t.scale + (t.target - t.scale) * 0.16;
        t.group.scale.setScalar(t.scale);
        t.group.position.z = (t.scale - 1) * 7;
        dirty = true;
      }
    }
    for (const t of tvs) {
      for (const d of t.dials) {
        const st = d.userData.dial;
        if (Math.abs(st.angle - st.target) > 0.002) {
          st.angle = reduceMotion ? st.target : st.angle + (st.target - st.angle) * 0.2;
          d.rotation.z = st.angle;
          dirty = true;
        }
      }
    }
    if (!dirty) return;
    dirty = false;
    gl.render(scene, camera);
    css.render(scene, camera);
  }
  loop();

  // ----- hover + press
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  function pick(e) {
    const r = gl.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(tvs.map((t) => t.group), true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o) {
      const t = tvs.find((x) => x.group === o);
      if (t) return { tv: t, dial: hit.object.userData.dialOwner || null };
      o = o.parent;
    }
    return null;
  }
  const tvAt = (e) => pick(e)?.tv ?? null;
  function setHover(t) {
    for (const x of tvs) x.target = x === t ? HOVER_SCALE : 1;
    gl.domElement.style.cursor = t ? 'pointer' : 'default';
  }
  gl.domElement.addEventListener('pointermove', (e) => setHover(tvAt(e)));
  gl.domElement.addEventListener('pointerleave', () => setHover(null));
  gl.domElement.addEventListener('click', (e) => {
    const hit = pick(e);
    if (!hit) return;
    if (hit.dial) { hit.dial.userData.dial.target -= Math.PI / 3; dirty = true; return; } // a knob click turns the dial; it does not open the project
    onPress(hit.tv.id);
  });

  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
    new THREE.Vector3((sx * SCREEN.w) / 2, (sy * SCREEN.h) / 2, 0));

  return {
    // a TV's screen as a bounding box in viewport pixels: the start of the zoom animation
    screenRect(id) {
      const t = tvs.find((x) => x.id === id);
      row.updateMatrixWorld(true);
      const box = container.getBoundingClientRect();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of corners) {
        const v = c.clone().applyMatrix4(t.screen.matrixWorld).project(camera);
        const px = box.left + ((v.x + 1) / 2) * box.width;
        const py = box.top + ((1 - v.y) / 2) * box.height;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px);
        y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
    },
    setPaused(p) { paused = p; dirty = true; },
  };
}
