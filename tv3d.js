import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// A procedural retro TV. The live site is a real iframe placed on the screen by the CSS3D
// renderer (below the canvas); the screen mesh punches a transparent hole in the canvas so
// the cabinet correctly hides the site when you spin the TV around.

const BODY = { w: 8, h: 6, d: 5 };
const SCREEN = { w: 5.2, h: 3.9, x: -0.95, y: 0.15, r: 0.45 };
const FRAME_PX = { w: 1280, h: 960 }; // the iframe's size; its aspect matches SCREEN

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

export function createTv(container, { siteUrl, onPress }) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  camera.position.set(-11.8, 4.2, 20.5);

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

  // ----- materials
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x26322c, roughness: 0.55, metalness: 0.15 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x1b2420, roughness: 0.7, metalness: 0.1 });
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0f1512, roughness: 0.4, metalness: 0.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8ddd9, roughness: 0.25, metalness: 0.9 });
  const tan = new THREE.MeshStandardMaterial({ color: 0xb9a672, roughness: 0.4, metalness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x070a08, roughness: 0.8 });
  const hole = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide });

  const tv = new THREE.Group();
  scene.add(tv);

  // cabinet + the tapered back of the picture tube
  const body = new THREE.Mesh(new RoundedBoxGeometry(BODY.w, BODY.h, BODY.d, 5, 0.28), bodyMat);
  body.castShadow = true;
  tv.add(body);
  const back = new THREE.Mesh(new RoundedBoxGeometry(5.8, 4.5, 2.6, 5, 0.4), backMat);
  back.position.set(-0.6, 0, -BODY.d / 2 - 1.1);
  back.castShadow = true;
  tv.add(back);

  // bezel ring around the screen, then the screen itself (the see-through hole)
  const frontZ = BODY.d / 2;
  const ring = rrect(SCREEN.w + 0.7, SCREEN.h + 0.7, SCREEN.r + 0.25);
  ring.holes.push(rrect(SCREEN.w, SCREEN.h, SCREEN.r));
  const bezel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ring, { depth: 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 24 }),
    bezelMat
  );
  bezel.position.set(SCREEN.x, SCREEN.y, frontZ);
  tv.add(bezel);

  const screenZ = frontZ + 0.03;
  const screen = new THREE.Mesh(new THREE.ShapeGeometry(rrect(SCREEN.w, SCREEN.h, SCREEN.r), 24), hole);
  screen.position.set(SCREEN.x, SCREEN.y, screenZ);
  tv.add(screen);

  const gloss = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN.w, SCREEN.h),
    new THREE.MeshBasicMaterial({ map: glossTexture(), transparent: true, depthWrite: false, opacity: 0.35 })
  );
  gloss.position.set(SCREEN.x, SCREEN.y, screenZ + 0.005);
  tv.add(gloss);

  // control panel: knobs, speaker slots, a small tan strip
  const panelX = 3.0;
  [1.25, 0.2].forEach((y, i) => {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.3, 40), chrome);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(panelX, y + 0.55, frontZ + 0.15);
    knob.rotation.z = i ? 0.9 : -0.5;
    knob.castShadow = true;
    tv.add(knob);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.04), tan);
    mark.position.set(panelX, y + 0.55, frontZ + 0.32);
    mark.rotation.z = knob.rotation.z;
    tv.add(mark);
  });
  for (let i = 0; i < 9; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.05), black);
    slot.position.set(panelX - 0.55 + i * 0.14, -1.35, frontZ + 0.01);
    tv.add(slot);
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.04), tan);
  strip.position.set(panelX, -2.35, frontZ + 0.01);
  tv.add(strip);

  // feet
  [[-3, -1.6], [3, -1.6], [-3, 1.6], [3, 1.6]].forEach(([x, z]) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.35, 20), black);
    foot.position.set(x, -BODY.h / 2 - 0.12, z);
    foot.castShadow = true;
    tv.add(foot);
  });

  // antennas
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), backMat);
  base.position.set(-0.3, BODY.h / 2 - 0.02, -0.4);
  tv.add(base);
  [-0.6, 0.55].forEach((tilt) => {
    const pivot = new THREE.Group();
    pivot.position.copy(base.position);
    pivot.rotation.z = tilt;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3.4, 10), tan);
    rod.position.y = 1.7;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), tan);
    tip.position.y = 3.4;
    pivot.add(rod, tip);
    tv.add(pivot);
  });

  // floor shadow + lights
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -BODY.h / 2 - 0.3;
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(new THREE.HemisphereLight(0xcfe3d8, 0x0a0e0c, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-6, 10, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fb59c, 1.6);
  rim.position.set(8, 3, -7);
  scene.add(rim);

  // ----- the live site, mapped onto the screen
  const frame = document.createElement('iframe');
  frame.src = siteUrl;
  frame.title = 'HELCO live preview';
  frame.loading = 'lazy';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { width: FRAME_PX.w + 'px', height: FRAME_PX.h + 'px', border: '0', background: '#0f1512', pointerEvents: 'none' });
  const site = new CSS3DObject(frame);
  site.position.set(SCREEN.x, SCREEN.y, screenZ);
  site.scale.setScalar(SCREEN.w / FRAME_PX.w);
  tv.add(site);

  // ----- controls: drag for a full 360, gentle sway when idle
  const controls = new OrbitControls(camera, gl.domElement);
  controls.target.set(0, 0.5, 0);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = !reduceMotion;
  controls.minPolarAngle = 0.9;
  controls.maxPolarAngle = 1.75;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 1.2;
  gl.domElement.style.touchAction = 'pan-y'; // sideways drag spins the TV, vertical drag still scrolls the page
  let lastInteract = 0;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => { lastInteract = performance.now(); });

  // ----- press vs drag, hover cursor
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  function hitsTv(e) {
    const r = gl.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    return ray.intersectObject(tv, true).length > 0;
  }
  let down = null;
  gl.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  gl.domElement.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 600 && hitsTv(e)) onPress();
    down = null;
  });
  gl.domElement.addEventListener('pointermove', (e) => {
    if (!down) gl.domElement.style.cursor = hitsTv(e) ? 'pointer' : 'grab';
  });

  // ----- sizing + loop
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    gl.setSize(w, h);
    css.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  let paused = false;
  let speed = 1.2;
  function loop() {
    if (paused) return;
    requestAnimationFrame(loop);
    if (!reduceMotion) {
      if (!controls.autoRotate && !down && performance.now() - lastInteract > 3000) controls.autoRotate = true;
      if (controls.autoRotate) { // sway between about -57 and +29 degrees instead of spinning forever
        const az = controls.getAzimuthalAngle();
        if (az > 0.5) speed = 1.2;
        else if (az < -1) speed = -1.2;
        controls.autoRotateSpeed = speed;
      }
    }
    controls.update();
    gl.render(scene, camera);
    css.render(scene, camera);
  }
  loop();

  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
    new THREE.Vector3((sx * SCREEN.w) / 2, (sy * SCREEN.h) / 2, 0));

  return {
    // the screen's bounding box in viewport pixels, used as the start of the zoom animation
    screenRect() {
      tv.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const box = container.getBoundingClientRect();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of corners) {
        const v = c.clone().applyMatrix4(screen.matrixWorld).project(camera);
        const px = box.left + ((v.x + 1) / 2) * box.width;
        const py = box.top + ((1 - v.y) / 2) * box.height;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px);
        y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
    },
    setPaused(p) {
      if (paused === p) return;
      paused = p;
      if (!p) loop();
    },
  };
}
