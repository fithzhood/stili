// PlayStation 1 — una strada di notte nella nebbia, con tutti i difetti dell'hardware del 1994:
// 320×240 ingranditi senza filtro, vertici agganciati alla griglia dei pixel (tremano),
// texture affini senza correzione prospettica (si torcono), luce calcolata per vertice,
// colore a 15 bit con il retino di dithering ordinato della console, nebbia per vertice,
// poligoni interi che spariscono al limite della distanza di disegno.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

THREE.ColorManagement.enabled = false;   // colori grezzi, come la console: niente gamma, niente spazio lineare
const Q = Demo.query;
const S = 3;                       // un modulo del kit Kenney = 3 metri
const ALTEZZA_OCCHI = 1.6;
const RIGHE = 240;                 // linee verticali, come la console

// ─────────────────────────── renderer a bassa risoluzione ───────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Demo.shot });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
document.body.prepend(renderer.domElement);
renderer.domElement.style.imageRendering = 'pixelated';

let RES = new THREE.Vector2(320, 240);
const rt = new THREE.WebGLRenderTarget(320, 240, {
  minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
});
function dimensiona() {
  renderer.setSize(innerWidth, innerHeight);
  const w = Math.round(RIGHE * innerWidth / innerHeight);
  RES.set(w, RIGHE);
  rt.setSize(w, RIGHE);
  camera.aspect = w / RIGHE; camera.updateProjectionMatrix();
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 4 / 3, 0.1, 200);
dimensiona();
addEventListener('resize', dimensiona);

// ─────────────────────────── luci (calcolate per vertice nello shader) ───────────────────────────
const NLAMP = 8;
const U = {
  uRes: { value: RES },
  uCam: { value: new THREE.Vector3() },
  uDraw: { value: 28 },
  uFog: { value: new THREE.Color(0x383b40) },
  uFogR: { value: new THREE.Vector2(3, 33) },
  uAmb: { value: new THREE.Color(0x181d28) },
  uMoonDir: { value: new THREE.Vector3(-0.4, 0.8, 0.3).normalize() },
  uMoon: { value: new THREE.Color(0x2a3140) },
  uTorchPos: { value: new THREE.Vector3() },
  uTorchDir: { value: new THREE.Vector3(0, 0, -1) },
  uTorch: { value: 1 },
  uLampPos: { value: Array.from({ length: NLAMP }, () => new THREE.Vector3(0, -100, 0)) },
  uLampCol: { value: Array.from({ length: NLAMP }, () => new THREE.Color(0, 0, 0)) },
};

const VS = /* glsl */`
  attribute vec3 centro;
  attribute vec3 color;
  uniform vec2 uRes; uniform vec3 uCam; uniform float uDraw;
  uniform vec3 uFog; uniform vec2 uFogR; uniform vec3 uAmb; uniform vec3 uMoonDir; uniform vec3 uMoon;
  uniform vec3 uTorchPos; uniform vec3 uTorchDir; uniform float uTorch;
  uniform vec3 uLampPos[${NLAMP}]; uniform vec3 uLampCol[${NLAMP}];
  uniform float uEmis;
  varying vec3 vUVw;      // (uv·w, w): interpolato "corretto" dà proprio l'interpolazione affine
  varying vec3 vLuce;
  varying vec3 vNebbiaCol;
  varying float vNebbia;
  void main() {
    // distanza di disegno per poligono intero, come i motori dell'epoca
    if (distance(centro, uCam) > uDraw) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 clip = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    // niente sottopixel: la GTE consegnava coordinate intere di schermo
    if (clip.w > 0.05) {
      vec2 h = uRes * 0.5;
      vec2 ndc = floor(clip.xy / clip.w * h + 0.5) / h;
      clip.xy = ndc * clip.w;
    }
    gl_Position = clip;
    vUVw = vec3(uv * clip.w, clip.w);

    vec3 n = normalize(mat3(modelMatrix) * normal);
    vec3 L = uAmb + uMoon * max(dot(n, uMoonDir), 0.0);
    for (int i = 0; i < ${NLAMP}; i++) {
      vec3 d = uLampPos[i] - wp;
      float dist = length(d);
      float att = clamp(1.0 - dist / 10.5, 0.0, 1.0);
      att = att * (0.4 + 0.6 * att);
      L += uLampCol[i] * att * (0.35 + 0.65 * max(dot(n, d / dist), 0.0));
    }
    vec3 dt = wp - uTorchPos;
    float dd = length(dt);
    vec3 dir = dt / dd;
    float cono = smoothstep(0.84, 0.95, dot(dir, uTorchDir));
    float attT = 1.0 / (1.0 + 0.03 * dd * dd);
    L += uTorch * vec3(1.0, 0.93, 0.78) * 2.8 * cono * attT * (0.3 + 0.7 * max(dot(n, -dir), 0.0));
    vLuce = min(L * color + uEmis * vec3(1.3, 0.95, 0.5), vec3(2.0));

    float dc = distance(wp, uCam);
    vNebbia = clamp((dc - uFogR.x) / (uFogR.y - uFogR.x), 0.0, 1.0);
    vNebbia = pow(vNebbia, 0.8);
    vec3 vd = normalize(wp - uCam);
    vNebbiaCol = uFog * (1.0 + uTorch * 0.55 * smoothstep(0.86, 0.99, dot(vd, uTorchDir)));
  }`;

// il retino di dithering 4×4 della PlayStation, in unità da 8 bit
const DITHER = /* glsl */`
  float ditherPS1(vec2 fc) {
    int x = int(mod(fc.x, 4.0)), y = int(mod(fc.y, 4.0));
    int i = y * 4 + x;
    float m[16] = float[16](-4.0, 0.0, -3.0, 1.0,  2.0, -2.0, 3.0, -1.0,  -3.0, 1.0, -4.0, 0.0,  3.0, -1.0, 2.0, -2.0);
    return m[i];
  }
  vec3 quindiciBit(vec3 c, vec2 fc) {
    vec3 v = clamp(floor(c * 255.0 + ditherPS1(fc)), 0.0, 255.0);
    return floor(v / 8.0) / 31.0;
  }`;

const FS = /* glsl */`
  uniform sampler2D map;
  uniform float uHaMappa;
  varying vec3 vUVw; varying vec3 vLuce; varying vec3 vNebbiaCol; varying float vNebbia;
  ${DITHER}
  void main() {
    vec2 uv = vUVw.xy / vUVw.z;             // affine: nessuna correzione prospettica
    vec4 t = uHaMappa > 0.5 ? texture2D(map, uv) : vec4(1.0);
    if (t.a < 0.5) discard;
    // la GPU moltiplicava texel × colore con 128 = 1.0: la luce può anche schiarire
    vec3 c = t.rgb * vLuce;
    c = mix(c, vNebbiaCol, vNebbia);
    gl_FragColor = vec4(quindiciBit(c, gl_FragCoord.xy), 1.0);
  }`;

const materiali = new Map();
function materialePS1(tex, emis = 0) {
  const k = (tex ? tex.uuid : 'nessuna') + ':' + emis;
  if (materiali.has(k)) return materiali.get(k);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, map: { value: tex }, uHaMappa: { value: tex ? 1 : 0 }, uEmis: { value: emis } },
    vertexShader: VS, fragmentShader: FS,
  });
  materiali.set(k, m);
  return m;
}

// ─────────────────────────── geometria: tassellazione e fusione per texture ───────────────────────────
// Il tassello massimo tiene la luce per vertice ancora leggibile, ma lascia i poligoni grandi
// abbastanza perché la texture affine si pieghi quando ci si avvicina.
const LATO_MAX = 1.6;
const secchi = new Map(); // chiave texture → {tex, emis, pos:[], nor:[], uv:[], col:[]}

function secchio(tex, emis = 0) {
  const k = (tex ? tex.uuid : 'nessuna') + ':' + emis;
  if (!secchi.has(k)) secchi.set(k, { tex, emis, pos: [], nor: [], uv: [], col: [] });
  return secchi.get(k);
}

function spingiTriangolo(b, p, n, u, c, lato) {
  // p,n: 3 Vector3, u: 3 Vector2
  const l01 = p[0].distanceTo(p[1]), l12 = p[1].distanceTo(p[2]), l20 = p[2].distanceTo(p[0]);
  const lmax = Math.max(l01, l12, l20);
  if (lmax > lato) {
    let a, bI, cI;
    if (lmax === l01) { a = 0; bI = 1; cI = 2; } else if (lmax === l12) { a = 1; bI = 2; cI = 0; } else { a = 2; bI = 0; cI = 1; }
    const pm = p[a].clone().lerp(p[bI], 0.5), nm = n[a].clone().lerp(n[bI], 0.5).normalize(), um = u[a].clone().lerp(u[bI], 0.5);
    spingiTriangolo(b, [p[a], pm, p[cI]], [n[a], nm, n[cI]], [u[a], um, u[cI]], c, lato);
    spingiTriangolo(b, [pm, p[bI], p[cI]], [nm, n[bI], n[cI]], [um, u[bI], u[cI]], c, lato);
    return;
  }
  for (let i = 0; i < 3; i++) {
    b.pos.push(p[i].x, p[i].y, p[i].z);
    b.nor.push(n[i].x, n[i].y, n[i].z);
    b.uv.push(u[i].x, u[i].y);
    b.col.push(c.r, c.g, c.b);
  }
}

function aggiungiMesh(mesh, lato = LATO_MAX, emis = 0) {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
  const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const mat = mesh.material;
  const tex = mat.map || null;
  const col = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
  const b = secchio(tex, emis);
  const det = mesh.matrixWorld.determinant();
  for (let i = 0; i < P.count; i += 3) {
    const p = [], n = [], u = [];
    for (let j = 0; j < 3; j++) {
      p.push(new THREE.Vector3().fromBufferAttribute(P, i + j).applyMatrix4(mesh.matrixWorld));
      n.push(N ? new THREE.Vector3().fromBufferAttribute(N, i + j).applyMatrix3(nm).normalize() : new THREE.Vector3(0, 1, 0));
      u.push(UV ? new THREE.Vector2().fromBufferAttribute(UV, i + j) : new THREE.Vector2());
    }
    if (det < 0) { [p[1], p[2]] = [p[2], p[1]]; [n[1], n[2]] = [n[2], n[1]]; [u[1], u[2]] = [u[2], u[1]]; }
    spingiTriangolo(b, p, n, u, col, lato);
  }
}

function costruisciSecchi() {
  for (const b of secchi.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    const cen = new Float32Array(b.pos.length);
    for (let i = 0; i < b.pos.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const m = (b.pos[i + k] + b.pos[i + 3 + k] + b.pos[i + 6 + k]) / 3;
        cen[i + k] = cen[i + 3 + k] = cen[i + 6 + k] = m;
      }
    }
    g.setAttribute('centro', new THREE.BufferAttribute(cen, 3));
    const m = new THREE.Mesh(g, materialePS1(b.tex, b.emis));
    m.frustumCulled = false;
    scene.add(m);
  }
  secchi.clear();
}

// ─────────────────────────── caricamento ───────────────────────────
function sistemaTex(t, ripeti = false) {
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
  if (ripeti) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}
const texCache = new Map();
function sistemaModello(root) {
  root.traverse(o => {
    if (o.isMesh && o.material.map) {
      const m = o.material.map;
      const k = m.image && (m.image.src || m.name) || m.uuid;
      if (!texCache.has(k)) texCache.set(k, sistemaTex(m, true));
      o.material.map = texCache.get(k);
    }
  });
  return root;
}

const NOMI = ['wall-a', 'wall-a-window', 'wall-a-door', 'wall-a-garage', 'wall-a-roof', 'wall-b', 'wall-b-window',
  'wall-b-door', 'wall-b-garage', 'wall-b-roof', 'detail-light-single', 'detail-light-double', 'tree-pine-large', 'tree-large',
  'tree-shrub', 'truck-grey', 'truck-flat', 'wall-fence', 'wall-type-b', 'detail-dumpster-closed', 'detail-dumpster-open',
  'detail-barrier-strong-type-a', 'detail-barrier-strong-damaged', 'detail-barrier-type-a', 'detail-bench',
  'detail-bricks-type-a', 'pallet', 'planks', 'wall-c-flat', 'balcony-type-a', 'detail-awning-wide',
  'wall-broken-type-a', 'scaffolding-structure', 'detail-cables-type-a'];
const MOD = {};

async function carica() {
  const loader = new GLTFLoader();
  let fatti = 0;
  await Promise.all(NOMI.map(async n => {
    const g = await loader.loadAsync(`assets/${n}.glb`);
    MOD[n] = sistemaModello(g.scene);
    Demo.carica('Carico il villaggio', ++fatti / NOMI.length);
  }));
  const tl = new THREE.TextureLoader();
  const tex = {};
  await Promise.all(['asphalt', 'tiles', 'concrete', 'grass', 'dirt'].map(async n => {
    tex[n] = sistemaTex(await tl.loadAsync(`assets/Textures/${n}.png`), true);
  }));
  return tex;
}

// ─────────────────────────── il villaggio ───────────────────────────
let seme = 20260926;
const rnd = () => { seme = (seme * 1664525 + 1013904223) >>> 0; return seme / 4294967296; };
const scegli = a => a[Math.floor(rnd() * a.length)];

const ostacoli = [];   // AABB {x0,z0,x1,z1} nel piano
const lampioni = [];   // {pos, rotto, fase}
const tmp = new THREE.Object3D();

function piazza(nome, x, y, z, rotY = 0, scala = S, lato = LATO_MAX, finestraAccesa = 0) {
  const o = MOD[nome].clone(true);
  o.position.set(x, y, z); o.rotation.y = rotY;
  if (scala.isVector3) o.scale.copy(scala); else o.scale.setScalar(scala);
  o.updateMatrixWorld(true);
  o.traverse(m => {
    if (!m.isMesh) return;
    const vetro = finestraAccesa && m.material.map && /windows/.test(m.material.map.image?.src || m.material.name || '');
    aggiungiMesh(m, lato, vetro ? finestraAccesa : 0);
  });
  return o;
}
function blocca(x0, z0, x1, z1) { ostacoli.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }); }

// piano a griglia con uv in coordinate di mondo (una ripetizione ogni `rip` metri)
function piano(tex, x0, z0, x1, z1, y, rip = 3, passo = 1.5, colore = 0xffffff) {
  const b = secchio(tex);
  const c = new THREE.Color(colore);
  const nx = Math.max(1, Math.round((x1 - x0) / passo)), nz = Math.max(1, Math.round((z1 - z0) / passo));
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const xa = x0 + (x1 - x0) * i / nx, xb = x0 + (x1 - x0) * (i + 1) / nx;
    const za = z0 + (z1 - z0) * j / nz, zb = z0 + (z1 - z0) * (j + 1) / nz;
    const P = (x, z) => new THREE.Vector3(x, y, z), UVp = (x, z) => new THREE.Vector2(x / rip, -z / rip);
    spingiTriangolo(b, [P(xa, za), P(xa, zb), P(xb, zb)], [up, up, up], [UVp(xa, za), UVp(xa, zb), UVp(xb, zb)], c, 99);
    spingiTriangolo(b, [P(xa, za), P(xb, zb), P(xb, za)], [up, up, up], [UVp(xa, za), UVp(xb, zb), UVp(xb, za)], c, 99);
  }
}
// scatola a mano (cordoli, muretti) con uv in metri
function scatola(tex, x0, y0, z0, x1, y1, z1, rip = 3, colore = 0xffffff) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const uv = g.attributes.uv, pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    const px = pos.getX(i) + (x0 + x1) / 2, py = pos.getY(i) + (y0 + y1) / 2, pz = pos.getZ(i) + (z0 + z1) / 2;
    if (ny > 0.5) uv.setXY(i, px / rip, pz / rip);
    else if (nx > 0.5) uv.setXY(i, pz / rip, py / rip);
    else uv.setXY(i, px / rip, py / rip);
  }
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, color: colore }));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.updateMatrixWorld();
  aggiungiMesh(m);
}

const STRADA = 4.5;          // mezza larghezza della carreggiata
const MARCIAPIEDE = 7.5;     // dove cominciano le case
const Z0 = 9, Z1 = -96;      // la strada va da qui a là (verso -z)
const BORDO = -84;           // dove la strada si spezza nel vuoto

function casa(lato, z, larg, prof, piani, fam) {
  // lato: -1 sinistra (x<0), +1 destra. La facciata (il lato -z del modulo) guarda la strada.
  const rot = lato < 0 ? -Math.PI / 2 : Math.PI / 2;
  const accesa = rnd() < 0.45;   // qualcuno ha lasciato la luce accesa
  const f = fam;
  for (let i = 0; i < larg; i++) {
    const zc = z - (i + 0.5) * S;
    for (let j = 0; j < prof; j++) {
      const xc = lato * (MARCIAPIEDE + (j + 0.5) * S);
      for (let p = 0; p < piani; p++) {
        let nome = `wall-${f}`;
        if (j === 0) {
          if (p === 0) nome = scegli([`wall-${f}-window`, `wall-${f}-door`, `wall-${f}-window`, `wall-${f}-garage`, `wall-${f}`]);
          else nome = scegli([`wall-${f}-window`, `wall-${f}-window`, `wall-${f}`]);
        }
        piazza(nome, xc, p * S, zc, rot, S, LATO_MAX, accesa && p === piani - 1 && i === 0 ? 0.9 : 0);
      }
      // tetto a capanna: il colmo corre lungo la strada
      piazza(`wall-${f}-roof`, xc, piani * S, zc, 0);
    }
  }
  const xa = lato * MARCIAPIEDE, xb = lato * (MARCIAPIEDE + prof * S);
  blocca(xa, z, xb, z - larg * S);
}

function costruisci(tex) {
  // ── suolo ──
  piano(tex.asphalt, -STRADA, BORDO, STRADA, Z0, 0, 3, 1.0);
  for (const s of [-1, 1]) {
    const xa = s * STRADA, xb = s * MARCIAPIEDE;
    piano(tex.tiles, Math.min(xa, xb), BORDO, Math.max(xa, xb), Z0, 0.18, 1.5, 1.5);
    // cordolo
    scatola(tex.concrete, Math.min(xa, xa + s * 0.25), 0, BORDO, Math.max(xa, xa + s * 0.25), 0.2, Z0, 1.5);
    // retro delle case: erba e terra
    piano(tex.grass, Math.min(xb, s * 40), BORDO, Math.max(xb, s * 40), Z0, 0.0, 3, 3, 0x8a8a80);
  }
  // mezzeria tratteggiata, consumata
  for (let z = Z0 - 2; z > BORDO + 3; z -= 4.5) {
    if (rnd() < 0.12) continue;
    piano(tex.concrete, -0.09, z - 1.8, 0.09, z, 0.012, 3, 2, 0xb9b39a);
  }
  // l'orlo del mondo: dove la strada finisce, una scarpata che scende nel niente
  scatola(tex.dirt, -40, -30, BORDO - 0.01, 40, 0.0, BORDO - 0.02, 3);
  // dietro la partenza: un muro di cantiere
  for (let x = -MARCIAPIEDE; x < MARCIAPIEDE; x += S) piazza('wall-fence', x + 1.5, 0, Z0 - 0.2, 0);
  blocca(-40, Z0 - 0.6, 40, Z0 + 2);
  blocca(-40, BORDO + 0.6, 40, BORDO - 5);
  blocca(-MARCIAPIEDE - 40, Z0, -MARCIAPIEDE - 39, BORDO);
  blocca(MARCIAPIEDE + 40, Z0, MARCIAPIEDE + 39, BORDO);

  // ── case sui due lati ──
  for (const lato of [-1, 1]) {
    let z = Z0 - 3 - (lato > 0 ? 3 : 0);
    while (z > BORDO + 12) {
      const larg = 2 + Math.floor(rnd() * 2), prof = 2 + Math.floor(rnd() * 2), piani = rnd() < 0.55 ? 2 : 1;
      casa(lato, z, larg, prof, piani, rnd() < 0.62 ? 'a' : 'b');
      z -= larg * S;
      // vicolo fra una casa e l'altra
      const vic = rnd() < 0.7 ? S : 2 * S;
      const xm = lato * (MARCIAPIEDE + 1.5);
      const zc = z - vic / 2;
      // staccionata in fondo al vicolo e un oggetto dentro
      const xf = lato * (MARCIAPIEDE + S * 1.2);
      piazza('wall-fence', xf, 0, zc, Math.PI / 2, vic / 1);
      blocca(xf - 0.2, z, xf + 0.2, z - vic);
      const r = rnd();
      if (r < 0.35) { piazza(scegli(['detail-dumpster-closed', 'detail-dumpster-open']), xm + lato * 0.4, 0, zc, lato > 0 ? Math.PI / 2 : -Math.PI / 2); blocca(xm - 1, zc - 1.2, xm + 1.4 * lato, zc + 1.2); }
      else if (r < 0.7) { piazza(scegli(['tree-pine-large', 'tree-large']), xm + lato * 1.2, 0, zc, rnd() * 6, S * (0.9 + rnd() * 0.3)); blocca(xm + lato * 1.2 - 0.5, zc - 0.5, xm + lato * 1.2 + 0.5, zc + 0.5); }
      else { piazza('pallet', xm, 0, zc, rnd() * 3, S * 0.6); piazza('planks', xm, 0.45, zc + 0.3, rnd() * 3, S * 0.6); }
      z -= vic;
    }
  }

  // ── lampioni: pochi funzionano, uno sfrigola ──
  let i = 0;
  for (let z = Z0 - 6; z > BORDO + 6; z -= 13, i++) {
    const lato = i % 2 ? 1 : -1;
    const x = lato * (STRADA + 0.8);
    // il braccio del modello punta verso -z: lo giriamo verso la strada
    piazza('detail-light-single', x, 0.18, z, lato < 0 ? -Math.PI / 2 : Math.PI / 2, S * 1.7);
    blocca(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
    lampioni.push({ pos: new THREE.Vector3(x - lato * 1.05, 4.9, z), rotto: i === 1 || i === 5, sfrigola: i === 3 || i === 6, fase: rnd() * 10 });
  }

  // ── la strada interrotta: camion di traverso, sbarramenti, mattoni ──
  piazza('truck-grey', -1.5, 0, BORDO + 14, 0.5, S);
  blocca(-4, BORDO + 11, 1.2, BORDO + 17.5);
  for (let x = -STRADA + 0.6; x < STRADA; x += 2.1) piazza(rnd() < 0.3 ? 'detail-barrier-strong-damaged' : 'detail-barrier-strong-type-a', x, 0, BORDO + 2.5 + rnd() * 0.5, (rnd() - 0.5) * 0.4, S);
  piazza('detail-barrier-type-a', 2.5, 0, BORDO + 5, 0.3, S);
  piazza('detail-bricks-type-a', 3, 0, BORDO + 9, 1, S);
  piazza('truck-flat', 2.8, 0, -18, Math.PI + 0.06, S);
  blocca(1.5, -20.5, 4.1, -15.5);
  piazza('detail-bench', -(STRADA + 2.2), 0.18, -30, Math.PI / 2, S);
  piazza('detail-bricks-type-a', -2, 0, -44, 2, S);
  piazza('detail-barrier-type-a', 1.5, 0, -50, 0.8, S);
  piazza('scaffolding-structure', -(MARCIAPIEDE + 1.5), 0, -58.5, 0, S);
  piazza('scaffolding-structure', -(MARCIAPIEDE + 1.5), S, -58.5, 0, S);

  // cavi fra i due lati della strada
  for (let z = -10; z > BORDO; z -= 22) {
    piazza('detail-cables-type-a', 0, 6.4, z, 0, new THREE.Vector3(MARCIAPIEDE * 2, S, S));
  }
}

// ─────────────────────────── la figura in fondo alla strada ───────────────────────────
// Una sagoma magra, poche decine di poligoni come un personaggio dell'epoca. Non riceve luce:
// è un buco nella nebbia. Quando ti avvicini, il lampione sfarfalla e lei non c'è più.
const figura = new THREE.Group();
function costruisciFigura() {
  const nero = new THREE.MeshBasicMaterial({ color: 0x080808 });
  const parte = (w, h, d, x, y, z, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), nero);
    m.position.set(x, y, z); m.rotation.z = rz; figura.add(m);
  };
  parte(0.22, 0.28, 0.24, 0, 1.78, 0);            // testa, un po' reclinata
  figura.children[0].rotation.z = 0.35;
  parte(0.42, 0.7, 0.2, 0, 1.3, 0);               // busto
  parte(0.1, 0.95, 0.1, -0.27, 1.05, 0, 0.06);    // braccia lunghe, ciondolanti
  parte(0.1, 0.95, 0.1, 0.27, 1.05, 0, -0.04);
  parte(0.14, 0.95, 0.14, -0.1, 0.48, 0);          // gambe
  parte(0.14, 0.95, 0.14, 0.11, 0.48, 0);
  figura.children.forEach(c => { c.material = materialePS1(null); });
}
const POSTI_FIGURA = [new THREE.Vector3(-3.1, 0, -24.5), new THREE.Vector3(1.2, 0, -44), new THREE.Vector3(-3.4, 0, -66), new THREE.Vector3(2.4, 0, -78), new THREE.Vector3(3.2, 0, -12)];
let postoFig = 0, figVisibile = true, figTimer = 0;

// le parti della figura sono Mesh normali: per usare lo stesso shader serve 'centro' e 'color'
function preparaFigura() {
  figura.children.forEach(m => {
    let g = m.geometry.toNonIndexed();
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(0.05), 3));
    m.geometry = g;
  });
}

// ─────────────────────────── cielo (fondo di nebbia) ───────────────────────────
const cielo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { uFog: U.uFog, uTorchDir: U.uTorchDir, uTorch: U.uTorch, uInvPV: { value: new THREE.Matrix4() }, uCam: U.uCam },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
  fragmentShader: `
    uniform vec3 uFog; uniform vec3 uTorchDir; uniform float uTorch; uniform mat4 uInvPV; uniform vec3 uCam;
    varying vec2 vP;
    ${DITHER}
    void main() {
      vec4 w = uInvPV * vec4(vP, 1.0, 1.0);
      vec3 d = normalize(w.xyz / w.w - uCam);
      vec3 c = uFog * (1.0 + uTorch * 0.55 * smoothstep(0.86, 0.99, dot(d, uTorchDir)));
      c *= mix(0.78, 1.0, smoothstep(0.55, -0.05, d.y));   // in alto la nebbia si fa più scura
      gl_FragColor = vec4(quindiciBit(c, gl_FragCoord.xy), 1.0);
    }`,
  depthWrite: false, depthTest: false,
}));
cielo.frustumCulled = false;
const scenaCielo = new THREE.Scene(); scenaCielo.add(cielo);
const camCielo = new THREE.Camera();

// aloni dei lampioni nella nebbia: quadrati sempre rivolti alla camera, sommati alla scena
const aloni = new THREE.Group();
const matAlone = new THREE.ShaderMaterial({
  uniforms: { uK: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uK; varying vec2 vUv;
    ${DITHER}
    void main(){
      float r = length(vUv - 0.5) * 2.0;
      float a = pow(max(0.0, 1.0 - r), 2.2) * 0.55 + smoothstep(0.12, 0.05, r) * 0.6;
      vec3 c = vec3(1.0, 0.62, 0.28) * a * uK;
      gl_FragColor = vec4(quindiciBit(c, gl_FragCoord.xy), 1.0);
    }`,
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
});
function alone(l) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), matAlone.clone());
  m.position.copy(l.pos).add(new THREE.Vector3(0, 0.05, 0));
  l.alone = m; aloni.add(m);
}

// schermo: ingrandimento senza filtro della render target
const schermo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: rt.texture } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }`,
  depthTest: false, depthWrite: false,
}));
schermo.frustumCulled = false;
const scenaSchermo = new THREE.Scene(); scenaSchermo.add(schermo);

// ─────────────────────────── controlli ───────────────────────────
const pl = { x: 0.2, z: -4, yaw: 0.1, pitch: -0.06, passo: 0 };
const INQ = {
  // inquadrature di prova (?cam=N)
  1: { x: -2.8, z: -26, yaw: -0.25, pitch: -0.05 },
  2: { x: 5.9, z: -12, yaw: 0.9, pitch: 0.0 },
  3: { x: 0.5, z: -72, yaw: 0.0, pitch: -0.12 },
  4: { x: -4.5, z: -30, yaw: 1.2, pitch: 0.1 },
  5: { x: 3.5, z: -60, yaw: -1.9, pitch: 0.05 },
  6: { x: -1, z: -30, yaw: 1.1, pitch: 0.12 },
  7: { x: 1, z: -40, yaw: -1.2, pitch: 0.12 },
};
if (INQ[Q.get('cam')]) Object.assign(pl, INQ[Q.get('cam')]);
let mouseX = 0, mouseY = 0;
renderer.domElement.addEventListener('click', () => { if (!Demo.shot) renderer.domElement.requestPointerLock?.(); });
addEventListener('mousemove', e => {
  if (document.pointerLockElement === renderer.domElement) { mouseX += e.movementX; mouseY += e.movementY; }
});
let torciaAccesa = Q.get('torcia') !== '0';
const torciaDir = new THREE.Vector3(0, 0, -1);

function collidi(x, z) {
  const r = 0.35;
  for (const b of ostacoli) {
    const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2); x = cx + dx / d * r; z = cz + dz / d * r; }
      else {
        // dentro la scatola: esce dal lato più vicino
        const opts = [[b.x0 - r - x, 0], [b.x1 + r - x, 0], [0, b.z0 - r - z], [0, b.z1 + r - z]];
        opts.sort((a, c) => Math.hypot(...a) - Math.hypot(...c));
        x += opts[0][0]; z += opts[0][1];
      }
    }
  }
  return [x, z];
}

// ─────────────────────────── avvio ───────────────────────────
try {
  Demo.carica('Carico il villaggio', 0);
  const tex = await carica();
  costruisci(tex);
  costruisciSecchi();
  costruisciFigura(); preparaFigura();
  scene.add(figura);
  lampioni.filter(l => !l.rotto).forEach(alone);
  scene.add(aloni);
  figura.position.copy(POSTI_FIGURA[0]);
  figura.rotation.y = 0.3;
  Demo.extra(`<h4>Tasti</h4><p><b>F</b> accende e spegne la torcia · <b>Maiusc</b> per correre · clic per catturare il mouse, <b>Esc</b> per liberarlo</p>
    <h4>I difetti, uno per uno</h4><p>Lo schermo è di ${RIGHE} righe. Avvicinati a un muro e guarda i mattoni piegarsi lungo la
    diagonale del poligono; gira piano la testa e guarda gli spigoli saltare da un pixel all'altro. In fondo alla nebbia i
    poligoni compaiono interi, non a poco a poco.</p>`);
} catch (e) { Demo.errore(e); throw e; }

const avanti = new THREE.Vector3(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
const invPV = new THREE.Matrix4();

Demo.loop((dt, t) => {
  // visuale
  const g = Demo.guarda();
  pl.yaw -= mouseX * 0.0022 + g.x * 2.2 * dt;
  pl.pitch = Math.max(-1.2, Math.min(1.2, pl.pitch - mouseY * 0.0022 + g.y * 1.8 * dt));
  mouseX = mouseY = 0;
  if (Demo.premuto('f') && !Demo.giu('Shift')) torciaAccesa = !torciaAccesa;

  // movimento (Maiusc corre)
  const a = Demo.asse();
  const vel = (Demo.giu('Shift') ? 5.2 : 2.6) * dt;
  const sx = Math.sin(pl.yaw), cz = Math.cos(pl.yaw);
  let nx = pl.x + (-sx * a.y + cz * a.x) * vel;
  let nz = pl.z + (-cz * a.y - sx * a.x) * vel;
  [nx, nz] = collidi(nx, nz);
  const mosso = Math.hypot(nx - pl.x, nz - pl.z);
  pl.x = nx; pl.z = nz;
  pl.passo += mosso * 2.1;

  const bob = Math.sin(pl.passo * 2) * 0.045 * Math.min(1, mosso / Math.max(vel, 1e-4));
  camera.position.set(pl.x, ALTEZZA_OCCHI + 0.18 + bob, pl.z);
  eul.set(pl.pitch, pl.yaw, Math.sin(pl.passo) * 0.006);
  camera.quaternion.setFromEuler(eul);
  camera.updateMatrixWorld();
  U.uCam.value.copy(camera.position);

  // torcia: segue lo sguardo con un po' di ritardo, come tenuta in mano
  camera.getWorldDirection(avanti);
  avanti.y -= 0.3; avanti.normalize();            // la torcia punta un po' in basso, sulla strada
  torciaDir.lerp(avanti, dt > 0 ? Math.min(1, dt * 7) : 0).normalize();
  if (!Demo.shot || t < 0.05) torciaDir.copy(avanti);
  U.uTorchDir.value.copy(torciaDir);
  const dx = new THREE.Vector3(Math.cos(pl.yaw), 0, -Math.sin(pl.yaw));
  U.uTorchPos.value.copy(camera.position).addScaledVector(dx, 0.25).add(new THREE.Vector3(0, -0.35, 0));
  U.uTorch.value = torciaAccesa ? 1 : 0;

  // lampioni: ne teniamo accesi i più vicini (8 per volta)
  const lista = lampioni.filter(l => !l.rotto)
    .map(l => ({ l, d: l.pos.distanceToSquared(camera.position) }))
    .sort((p, q) => p.d - q.d).slice(0, NLAMP);
  for (let i = 0; i < NLAMP; i++) {
    const e = lista[i];
    if (!e) { U.uLampCol.value[i].setRGB(0, 0, 0); continue; }
    let k = 1;
    if (e.l.sfrigola) {
      const f = Math.sin(t * 23 + e.l.fase) + Math.sin(t * 7.3 + e.l.fase * 2);
      k = f > 1.1 ? 0.15 : (Math.sin(t * 0.9 + e.l.fase) > 0.7 ? 0.35 : 1);
    }
    e.l.k = k;
    U.uLampPos.value[i].copy(e.l.pos);
    U.uLampCol.value[i].setRGB(1.25 * k, 0.72 * k, 0.32 * k);
  }

  for (const l of lampioni) if (l.alone) {
    l.alone.quaternion.copy(camera.quaternion);
    const d = l.pos.distanceTo(camera.position);
    const neb = Math.pow(Math.min(1, Math.max(0, (d - U.uFogR.value.x) / (U.uFogR.value.y - U.uFogR.value.x))), 0.8);
    l.alone.material.uniforms.uK.value = (l.k ?? 1) * (1 - 0.75 * neb);
  }

  // la figura: se ti avvicini troppo, sparisce e ricompare altrove, lontano
  const df = Math.hypot(figura.position.x - pl.x, figura.position.z - pl.z);
  if (figVisibile && df < 13) { figVisibile = false; figTimer = 0; }
  if (!figVisibile) {
    figTimer += dt;
    if (figTimer > 3) {
      // il posto più lontano da te fra quelli previsti
      let best = 0, bd = -1;
      POSTI_FIGURA.forEach((p, i) => { const d = Math.hypot(p.x - pl.x, p.z - pl.z); if (d > bd && i !== postoFig) { bd = d; best = i; } });
      postoFig = best; figura.position.copy(POSTI_FIGURA[best]);
      figVisibile = bd > 16;
    }
  }
  figura.visible = figVisibile;
  figura.rotation.y = Math.atan2(pl.x - figura.position.x, pl.z - figura.position.z);
  figura.updateMatrixWorld(true);
  // la figura non è nei secchi: la sua geometria va in coordinate di mondo col centro del corpo
  figura.children.forEach(m => {
    const c = m.geometry.getAttribute('centro');
    const w = new THREE.Vector3(); m.getWorldPosition(w);
    if (!c) m.geometry.setAttribute('centro', new THREE.BufferAttribute(new Float32Array(m.geometry.attributes.position.count * 3), 3));
    const cc = m.geometry.getAttribute('centro');
    for (let i = 0; i < cc.count; i++) cc.setXYZ(i, w.x, w.y, w.z);
    cc.needsUpdate = true;
  });

  // disegno: cielo di nebbia, scena, poi ingrandimento senza filtro
  invPV.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  cielo.material.uniforms.uInvPV.value.copy(invPV);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scenaCielo, camCielo);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(scenaSchermo, camCielo);
});
Demo.pronto();
