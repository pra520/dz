// ═══════════════════════════════════════════════════════
//  DEAD ZONE — Weapon Viewmodel (3D)
//  Loads the real .glb gun models from gun_models_3d/ and
//  renders them as a first-person viewmodel on the #vmC
//  canvas, and as rotating previews in the weapon shop.
//
//  ── TUNING ──
//  Every weapon is auto-centered, auto-scaled and
//  auto-rotated so its longest dimension points "forward"
//  (away from the camera). If a specific gun still looks
//  rotated wrong / too big / too small / off-center, tweak
//  its entry in WEAPON_CONFIG below:
//    extraRotY / extraRotX / extraRotZ  -> radians, applied
//        on top of the automatic orientation (try Math.PI
//        to flip a backwards-facing gun)
//    scaleMul   -> multiply the auto scale (e.g. 1.3)
//    offset     -> {x,y,z} nudge in viewmodel space
//
//  DEBUG: while playing, press "[" / "]" to rotate the
//  current weapon's model by 90° (yaw) and "-" / "=" to
//  rotate pitch — the resulting extraRotY/extraRotX values
//  are logged to the console so you can copy them into
//  WEAPON_CONFIG below.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_FILES = {
  pistol:     'gun_models_3d/Pistol.glb',
  revolver:   'gun_models_3d/Revolver.glb',
  smg:        'gun_models_3d/smg.glb',
  ar:         'gun_models_3d/Assault Rifle.glb',
  burstRifle: 'gun_models_3d/burst rifle.glb',
  shotgun:    'gun_models_3d/Shotgun.glb',
  combatSG:   'gun_models_3d/combat shotgun.glb',
  sniper:     'gun_models_3d/Sniper Rifle.glb',
  lmg:        'gun_models_3d/lmg.glb',
  plasma:     'gun_models_3d/plasma rifle.glb',
};

// Per-weapon manual tweaks (fill these in if a gun needs adjustment).
const WEAPON_CONFIG = {
  pistol:     {},
  revolver:   {},
  smg:        {},
  ar:         {},
  burstRifle: {},
  shotgun:    {},
  combatSG:   {},
  sniper:     {},
  lmg:        {},
  plasma:     {},
};

const TARGET_LENGTH = 0.95; // normalized "barrel length" in view-space units

// Viewmodel anchor positions (camera-relative, camera looks down -Z)
const BASE_POS = { x: 0.46, y: -0.42, z: -1.05 };
const ADS_POS  = { x: 0.0,  y: -0.07, z: -0.55 };
const BASE_ROT = { x: 0.02, y: -0.18, z: 0.0 };
const ADS_ROT  = { x: 0.0,  y: 0.0,   z: 0.0 };

const BOB_SCALE = 0.032;

// ── core three.js setup ──
let renderer, scene, camera, weaponRoot, modelHolder, pitchRig;
let muzzleLight, muzzleSprite;
const templates = {};   // weaponId -> normalized THREE.Group template (un-cloned)
const loadPromises = {};
let currentWeaponId = null;
let canvas;

// animation state
let recoilPos = new THREE.Vector3();
let recoilRot = new THREE.Euler();
let recoilVelZ = 0;
let flashT = 0;     // muzzle flash remaining time
let flashColor = new THREE.Color('#ffaa00');
let lastState = null;
let visible = false;

const loader = new GLTFLoader();

function init() {
  canvas = document.getElementById('vmC');
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);
  camera.position.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(0.6, 1, 0.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x6688ff, 0.35);
  fill.position.set(-0.8, -0.4, 0.6);
  scene.add(fill);

  muzzleLight = new THREE.PointLight(0xffaa55, 0, 4, 2);
  scene.add(muzzleLight);

  const flashGeo = new THREE.PlaneGeometry(1, 1);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffaa55, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  muzzleSprite = new THREE.Mesh(flashGeo, flashMat);
  scene.add(muzzleSprite);

  pitchRig = new THREE.Group();
  scene.add(pitchRig);

  weaponRoot = new THREE.Group();
  weaponRoot.position.set(BASE_POS.x, BASE_POS.y, BASE_POS.z);
  pitchRig.add(weaponRoot);

  modelHolder = new THREE.Group();
  weaponRoot.add(modelHolder);

  preloadAll();
  window.dispatchEvent(new Event('weaponvm-ready'));

  window.addEventListener('keydown', onDebugKey);
}

// ── loading & normalization ──
function preloadAll() {
  for (const id of Object.keys(MODEL_FILES)) {
    loadPromises[id] = loadModel(id);
  }
}

function loadModel(id) {
  const path = encodeURI(MODEL_FILES[id]);
  return new Promise((resolve) => {
    loader.load(path, (gltf) => {
      const obj = gltf.scene;
      templates[id] = normalize(obj, id);
      if (id === currentWeaponId) applyModel(id);
      resolve(templates[id]);
    }, undefined, (err) => {
      console.warn('WeaponVM: failed to load', id, path, err);
      resolve(null);
    });
  });
}

// Center, scale and orient a loaded model so its longest dimension
// points roughly "into the screen" (local -Z), producing a usable
// FPS viewmodel pose regardless of the source model's own axes.
function normalize(obj, id) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const inner = new THREE.Group();
  obj.position.sub(center);
  inner.add(obj);

  const dims = [size.x, size.y, size.z];
  const maxIdx = dims.indexOf(Math.max(...dims));
  if (maxIdx === 0) inner.rotation.y = Math.PI / 2;       // X -> Z
  else if (maxIdx === 1) inner.rotation.x = -Math.PI / 2; // Y -> Z
  // maxIdx === 2: already roughly aligned with Z

  const longest = Math.max(dims[maxIdx], 1e-6);
  const scale = TARGET_LENGTH / longest;

  const wrapper = new THREE.Group();
  wrapper.add(inner);
  wrapper.scale.setScalar(scale);

  const cfg = WEAPON_CONFIG[id] || {};
  if (cfg.extraRotY) wrapper.rotation.y += cfg.extraRotY;
  if (cfg.extraRotX) wrapper.rotation.x += cfg.extraRotX;
  if (cfg.extraRotZ) wrapper.rotation.z += cfg.extraRotZ;
  if (cfg.scaleMul) wrapper.scale.multiplyScalar(cfg.scaleMul);
  if (cfg.offset) wrapper.position.set(cfg.offset.x || 0, cfg.offset.y || 0, cfg.offset.z || 0);

  wrapper.userData.size = size;
  wrapper.userData.scale = scale;
  return wrapper;
}

function applyModel(id) {
  while (modelHolder.children.length) modelHolder.remove(modelHolder.children[0]);
  const tpl = templates[id];
  if (!tpl) return;
  const inst = tpl.clone(true);
  modelHolder.add(inst);
}

// ── public API ──
const WeaponVM = {
  use3DFor(id) {
    return !!MODEL_FILES[id];
  },

  setWeapon(id) {
    if (!id || id === currentWeaponId) return;
    currentWeaponId = id;
    recoilPos.set(0, 0, 0);
    recoilRot.set(0, 0, 0);
    recoilVelZ = 0;
    flashT = 0;
    if (templates[id]) applyModel(id);
    // if not yet loaded, applyModel runs automatically once it resolves
  },

  onFire(w) {
    const isPlasma = !!w?.isPlasma;
    flashColor = new THREE.Color(isPlasma ? '#ff66ff' : '#ffaa44');
    flashT = 0.07;
    // kick: push back + tilt up, snaps back via spring damping
    const kick = Math.min(0.16, 0.02 + (w?.recoil || 3) * 0.012);
    recoilVelZ += kick * 6;
    recoilRot.x -= Math.min(0.22, 0.03 + (w?.recoil || 3) * 0.012);
    recoilRot.z += (Math.random() - 0.5) * 0.04;
  },

  onReloadStart() {
    // animation is driven continuously from update() via player state
  },

  resize(w, h) {
    if (!renderer) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  },

  setVisible(v) {
    visible = !!v;
    if (canvas) canvas.style.opacity = visible ? '1' : '0';
  },

  update(dt, state) {
    if (!renderer) return;
    dt = Math.min(dt || 0, 0.1);
    lastState = state;

    if (state.visible !== visible) WeaponVM.setVisible(state.visible);
    if (state.weaponId) WeaponVM.setWeapon(state.weaponId);

    // --- bob ---
    const bobY = Math.sin(state.bob || 0) * (state.bobAmt || 0) * BOB_SCALE * (state.isCrouch ? 3 : 4);
    const bobX = Math.cos((state.bob || 0) * 0.5) * (state.bobAmt || 0) * BOB_SCALE * 3;

    // --- ADS lerp ---
    const a = THREE.MathUtils.clamp(state.adsF ?? 1, 0, 1);
    const px = THREE.MathUtils.lerp(ADS_POS.x, BASE_POS.x, a);
    const py = THREE.MathUtils.lerp(ADS_POS.y, BASE_POS.y, a) + (state.isCrouch ? 0.05 : 0);
    const pz = THREE.MathUtils.lerp(ADS_POS.z, BASE_POS.z, a);
    const rx = THREE.MathUtils.lerp(ADS_ROT.x, BASE_ROT.x, a);
    const ry = THREE.MathUtils.lerp(ADS_ROT.y, BASE_ROT.y, a);
    const rz = THREE.MathUtils.lerp(ADS_ROT.z, BASE_ROT.z, a);

    // --- reload dip ---
    let reloadRotZ = 0, reloadDip = 0;
    if (state.reloading && state.reloadDur) {
      const prog = THREE.MathUtils.clamp((performance.now() - state.reloadStart) / state.reloadDur, 0, 1);
      const s = Math.sin(prog * Math.PI);
      reloadRotZ = s * 0.5;
      reloadDip = s * 0.18;
    }

    // --- recoil spring ---
    recoilVelZ -= recoilVelZ * Math.min(1, dt * 14);
    recoilPos.z += recoilVelZ * dt;
    recoilPos.z *= Math.max(0, 1 - dt * 10);
    recoilRot.x *= Math.max(0, 1 - dt * 9);
    recoilRot.z *= Math.max(0, 1 - dt * 9);

    weaponRoot.position.set(px + bobX + recoilPos.x, py - bobY - reloadDip + recoilPos.y, pz + recoilPos.z);
    weaponRoot.rotation.set(rx + recoilRot.x, ry, rz + reloadRotZ + recoilRot.z);

    // --- follow camera pitch (look up/down tilts the gun with the view) ---
    const pitch = state.pitch || 0;
    pitchRig.rotation.x = THREE.MathUtils.clamp(pitch, -1.55, 1.55) * 0.55;

    // --- muzzle flash ---
    flashT = Math.max(0, flashT - dt);
    const fi = flashT > 0 ? (flashT / 0.07) : 0;
    muzzleLight.intensity = fi * 3.2;
    muzzleLight.color = flashColor;
    muzzleSprite.material.opacity = fi * 0.95;
    muzzleSprite.material.color = flashColor;
    const flashScale = 0.22 + fi * 0.12;
    muzzleSprite.scale.set(flashScale, flashScale, 1);
    // place flash near the forward tip of the current model
    const tipLocal = new THREE.Vector3(0, 0, -TARGET_LENGTH * 0.55);
    const tipWorld = modelHolder.localToWorld(tipLocal.clone());
    muzzleSprite.position.copy(tipWorld);
    muzzleSprite.lookAt(camera.position);
    muzzleLight.position.copy(tipWorld);
  },

  render() {
    if (!renderer || !visible) return;
    renderer.render(scene, camera);
  },

  // ── shop previews ──
  mountShopPreviews() {
    document.querySelectorAll('.gun-preview[data-weapon]').forEach((el) => {
      if (el._gpInit) return;
      el._gpInit = true;
      addShopPreview(el);
    });
    startPreviewLoop();
  },
};

function onDebugKey(e) {
  if (!currentWeaponId) return;
  const inst = modelHolder.children[0];
  if (!inst) return;
  const STEP = Math.PI / 2;
  const STEPS = Math.PI / 18;
  let changed = false;
  if (e.code === 'BracketRight') { inst.rotation.y += STEP; changed = true; }
  if (e.code === 'BracketLeft') { inst.rotation.y -= STEP; changed = true; }
  if (e.code === 'Equal') { inst.rotation.x += STEPS; changed = true; }
  if (e.code === 'Minus') { inst.rotation.x -= STEPS; changed = true; }
  if (changed) {
    console.log(`[WeaponVM] ${currentWeaponId} -> extraRotY: ${inst.rotation.y.toFixed(3)}, extraRotX: ${inst.rotation.x.toFixed(3)}`);
  }
}

// ── shop preview renderers ──
// IMPORTANT: all shop previews share ONE WebGLRenderer/context. Creating a
// separate renderer per gun (10+) blows past the browser's ~16-context limit,
// which makes it drop the OLDEST context — the main game canvas — leaving a
// white screen and broken rendering. Instead we render each preview through a
// single offscreen renderer and blit the result into a per-tile 2D canvas.
let sharedPreviewR = null;
const shopPreviews = [];   // {el, cv, cx, scene, cam, group, id}
let previewRAF = 0;

function getSharedPreviewRenderer() {
  if (!sharedPreviewR) {
    sharedPreviewR = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    sharedPreviewR.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    sharedPreviewR.outputColorSpace = THREE.SRGBColorSpace;
  }
  return sharedPreviewR;
}

function addShopPreview(el) {
  const id = el.dataset.weapon;
  const w = el.clientWidth || 160, h = el.clientHeight || 110;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const cv = document.createElement('canvas');
  cv.style.width = '100%'; cv.style.height = '100%';
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  el.appendChild(cv);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, w / h, 0.01, 20);
  cam.position.set(0, 0, 1.6);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dl = new THREE.DirectionalLight(0xffffff, 1.0);
  dl.position.set(1, 1.2, 1.5);
  scene.add(dl);
  const group = new THREE.Group();
  scene.add(group);

  const pv = { el, cv, cx: cv.getContext('2d'), scene, cam, group, id };
  addPreviewModel(pv);
  shopPreviews.push(pv);
}

function addPreviewModel(pv) {
  const tpl = templates[pv.id];
  if (!tpl) { setTimeout(() => { if (shopPreviews.includes(pv)) addPreviewModel(pv); }, 200); return; }
  while (pv.group.children.length) pv.group.remove(pv.group.children[0]);
  const inst = tpl.clone(true);
  inst.rotation.y += Math.PI * 0.15;
  pv.group.add(inst);
}

function startPreviewLoop() {
  if (previewRAF) return;
  const r = getSharedPreviewRenderer();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function frame() {
    // drop previews whose tiles left the DOM (shop re-rendered / closed)
    for (let i = shopPreviews.length - 1; i >= 0; i--) {
      if (!shopPreviews[i].el.isConnected) shopPreviews.splice(i, 1);
    }
    if (!shopPreviews.length) { previewRAF = 0; return; }
    for (const pv of shopPreviews) {
      if (pv.el.offsetParent === null) continue; // hidden (shop closed / other tab)
      const w = pv.el.clientWidth || 160, h = pv.el.clientHeight || 110;
      const bw = Math.max(1, Math.round(w * dpr)), bh = Math.max(1, Math.round(h * dpr));
      if (pv.cv.width !== bw || pv.cv.height !== bh) { pv.cv.width = bw; pv.cv.height = bh; }
      if (Math.abs(pv.cam.aspect - w / h) > 1e-3) { pv.cam.aspect = w / h; pv.cam.updateProjectionMatrix(); }
      pv.group.rotation.y += 0.012;
      r.setSize(w, h, false);
      r.render(pv.scene, pv.cam);
      pv.cx.clearRect(0, 0, pv.cv.width, pv.cv.height);
      pv.cx.drawImage(r.domElement, 0, 0, pv.cv.width, pv.cv.height);
    }
    previewRAF = requestAnimationFrame(frame);
  }
  previewRAF = requestAnimationFrame(frame);
}

window.WeaponVM = WeaponVM;
init();
