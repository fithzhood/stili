// Ligne claire — un deserto disegnato a china, alla maniera di Moebius e di Sable.
// La scena viene resa in due buffer (colore piatto + normali/profondità); un secondo
// passaggio ripassa i contorni a china con spessore costante, poi FXAA liscia il tratto.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { costruisciMondo, altezza, vn, rng } from './moebius-mondo.js?v=3';

THREE.ColorManagement.enabled = false;   // i colori della tavolozza vanno a schermo tali e quali

const Q = Demo.query;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Demo.shot, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.5, 14000);

// ── Luce: un sole solo, basso da destra ──
const DIR_SOLE = new THREE.Vector3(0.78, 0.62, -0.1).normalize();
const sole = new THREE.DirectionalLight(0xffffff, Math.PI);
sole.castShadow = true;
sole.shadow.mapSize.set(4096, 4096);
const SC = sole.shadow.camera; SC.left = -170; SC.right = 170; SC.top = 170; SC.bottom = -170; SC.near = 1; SC.far = 900;
sole.shadow.bias = -0.0006; sole.shadow.normalBias = 0.25;
scene.add(sole, sole.target);

// ── Tavolozza: per ogni materiale il tono in luce e il tono in ombra ──
const hex = h => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
const INK = 0x2a1c19;
const CIELO_ALTO = 0xbfe2da, CIELO_BASSO = 0xf7efdc;
const TAV = {
  sabbia:  [0xf1d6a8, 0xd9a08c, { tratto: 1, increspa: 1 }],
  roccia:  [0xeaa985, 0xb66a67, { tratto: 1 }],
  rocciaT: [0xa9d3c7, 0x6f9ea5, { tratto: 1 }],
  pietra:  [0xf0e6cd, 0xa7bcc2, { tratto: 1 }],
  pietraS: [0xe2c79a, 0xa98f86, { tratto: 1 }],
  osso:    [0xfaf3e1, 0xd6c6b4, { tratto: 0 }],
  buio:    [0x3a2a26, 0x2a1c19, { tratto: 0 }],
  torre:   [0xdcefe2, 0x8fbcb8, { tratto: 1 }],
  pianeta: [0xf6d2bf, 0xcf9ea4, { tratto: 1, nebbia: 0.25 }],
  anello:  [0xf3e5c2, 0xc9b39c, { tratto: 0, nebbia: 0.25, lati: THREE.DoubleSide }],
  nuvola:  [0xfffbf1, 0xd3e7e1, { tratto: 0, nebbia: 0.2 }],
  scafo:   [0xf5efe1, 0xb3c1c6, { tratto: 0 }],
  rosso:   [0xdb5b3c, 0x9a3a33, { tratto: 0 }],
  turch:   [0x55aba1, 0x2f7270, { tratto: 0 }],
  metallo: [0x7b8e93, 0x4a5559, { tratto: 0 }],
  mantello:[0xecbc4d, 0xb8743e, { tratto: 0 }],
  sciarpa: [0xd2432f, 0x8e2a2a, { tratto: 0, lati: THREE.DoubleSide }],
  casco:   [0xf8f3e9, 0xa9b8be, { tratto: 0 }],
  visiera: [0x34414b, 0x1f262d, { tratto: 0 }],
  pelle:   [0xc98a63, 0x8e5a48, { tratto: 0 }],
  polvere: [0xf6e2bd, 0xdcb09a, { tratto: 0 }],
};

// uniformi condivise da tutti i materiali
const U = {
  uSoleV: { value: new THREE.Vector3() },
  uInk: { value: hex(INK) },
  uNebbiaCol: { value: hex(CIELO_BASSO) },
  uScalaPx: { value: 1 },
};

// Materiale "a due toni": parte da Lambert (così ombre, istanze e tutto il resto le gestisce three)
// e sostituisce l'uscita: tono chiaro o scuro, tratteggio a china nelle ombre, foschia con la distanza,
// e in più scrive normale e profondità nel secondo buffer, per i contorni.
const cacheMat = {};
function M(nome) {
  if (cacheMat[nome]) return cacheMat[nome];
  const [c, s, o] = TAV[nome];
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: o.lati || THREE.FrontSide });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, {
      uChiaro: { value: hex(c) }, uScuro: { value: hex(s) },
      uTratto: { value: o.tratto ?? 1 }, uNebbia: { value: o.nebbia ?? 1 }, uIncr: { value: o.increspa ?? 0 },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMondo;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wpM = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpM = instanceMatrix * wpM;
        #endif
        vMondo = (modelMatrix * wpM).xyz;`);
    sh.fragmentShader = 'layout(location = 1) out highp vec4 gInfo;\n' + sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vMondo;
        uniform vec3 uChiaro, uScuro, uInk, uNebbiaCol, uSoleV;
        uniform float uTratto, uNebbia, uScalaPx, uIncr;
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vno(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
        // linee parallele ancorate al mondo, a più scale: la distanza fra le righe resta
        // sempre fra 1 e 2 volte "passo" pixel, a qualunque distanza
        float righe(float c, float passo, float spess) {
          float d = max(fwidth(c), 1e-5);
          float L = log2(d * passo);
          float Lf = floor(L), fr = L - Lf;
          float s0 = exp2(Lf);
          float x = c / s0;
          float dist = abs(fract(x + 0.5) - 0.5) * s0 / d;
          float lin = 1.0 - smoothstep(spess * 0.5, spess * 0.5 + 0.9, dist);
          float dispari = mod(floor(x + 0.5), 2.0);
          return lin * mix(1.0, 1.0 - fr, dispari);
        }`)
      .replace('#include <opaque_fragment>', `
        float luce = reflectedLight.directDiffuse.g;
        float ndl = dot(normal, uSoleV);
        vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        float inLuce = smoothstep(0.30, 0.36, luce);
        vec3 col = mix(uScuro, uChiaro, inLuce);
        float dist = length(vMondo - cameraPosition);
        // tratteggio solo nelle ombre; incrociato dove la forma volta del tutto le spalle al sole
        if (uTratto > 0.5) {
          vec3 an = abs(nW);
          float c1, c2;
          if (an.y > an.x && an.y > an.z) { c1 = vMondo.x + vMondo.z; c2 = vMondo.x - vMondo.z; }
          else if (an.x > an.z) { c1 = vMondo.y + vMondo.z * 0.8; c2 = vMondo.y - vMondo.z * 0.8; }
          else { c1 = vMondo.y + vMondo.x * 0.8; c2 = vMondo.y - vMondo.x * 0.8; }
          float passo = 7.0 * uScalaPx, sp = 1.05 * uScalaPx;
          float h = righe(c1, passo, sp) * (1.0 - inLuce);
          float core = smoothstep(-0.05, -0.35, ndl) * (1.0 - inLuce);
          h = max(h, righe(c2, passo, sp) * core);
          h *= 1.0 - smoothstep(180.0, 420.0, dist);
          col = mix(col, uInk, h * 0.78);
        }
        // increspature del vento sulla sabbia: trattini corti, solo vicino
        if (uIncr > 0.5) {
          vec2 w = vec2(0.85, 0.52);
          float u = dot(vMondo.xz, w), v = dot(vMondo.xz, vec2(-w.y, w.x));
          float cc = u * 0.8 + 1.6 * sin(v * 0.11) + 2.5 * vno(vMondo.xz * 0.03);
          float riga = abs(fract(cc) - 0.5) / max(fwidth(cc), 1e-4);
          float trat = 1.0 - smoothstep(0.4 * uScalaPx, 0.4 * uScalaPx + 1.0, riga);
          float mask = smoothstep(0.62, 0.7, vno(vec2(v * 0.35, floor(cc) * 3.7)));
          trat *= mask * (1.0 - smoothstep(25.0, 70.0, dist)) * step(fwidth(cc), 0.3);
          col = mix(col, uInk, trat * 0.45);
        }
        float neb = uNebbia * (1.0 - exp(-dist / 2600.0));
        col = mix(col, uNebbiaCol, neb);
        gl_FragColor = vec4(col, 1.0);
        gInfo = vec4(normalize(normal), vViewPosition.z);`);
  };
  m.customProgramCacheKey = () => 'toon-' + nome;
  cacheMat[nome] = m;
  return m;
}

// ── Cielo: una sfera che segue la camera, sfumata dal crema all'acquamarina ──
const cieloMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, side: THREE.BackSide, depthWrite: false,
  uniforms: { uAlto: { value: hex(CIELO_ALTO) }, uBasso: { value: hex(CIELO_BASSO) }, uInk: U.uInk },
  vertexShader: `out vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
  fragmentShader: `precision highp float; in vec3 vDir; uniform vec3 uAlto, uBasso, uInk;
    layout(location=0) out vec4 oCol; layout(location=1) out vec4 oInfo;
    void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(uBasso, uAlto, smoothstep(0.02, 0.55, h));
      oCol = vec4(c, 1.0); oInfo = vec4(0.0, 0.0, 1.0, 1e6); }`,
});
const cielo = new THREE.Mesh(new THREE.SphereGeometry(13000, 32, 16), cieloMat);
cielo.renderOrder = -10; cielo.frustumCulled = false;
scene.add(cielo);

Demo.carica('Disegno il deserto', 0.2);
const { solidi } = costruisciMondo(scene, M);

// ── La moto a cuscino d'aria e il suo pilota ──
function costruisciMoto() {
  const g = new THREE.Group();          // radice: posizione e direzione
  const corpo = new THREE.Group();      // inclinazioni (beccheggio, rollio)
  g.add(corpo);
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, M(mat)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true; corpo.add(m); return m;
  };
  // scafo a goccia, asse lungo z
  const prof = [[0, -2.1], [0.32, -2.0], [0.5, -1.4], [0.62, -0.4], [0.6, 0.6], [0.46, 1.5], [0.22, 2.2], [0, 2.45]].map(([r, y]) => new THREE.Vector2(r, y));
  const scafo = new THREE.LatheGeometry(prof, 24); scafo.rotateX(Math.PI / 2);
  add(scafo, 'scafo', 0, 0, 0, 0, 0, 0, 1.05, 0.62, 1);
  // presa d'aria anteriore e fascia rossa
  add(new THREE.TorusGeometry(0.5, 0.13, 8, 24), 'rosso', 0, 0.02, 1.25, 0, 0, 0, 1.05, 0.7, 1);
  add(new THREE.CylinderGeometry(0.66, 0.66, 0.28, 24, 1, true), 'rosso', 0, 0, -0.6, Math.PI / 2, 0, 0, 1, 1, 0.64);
  // pattini a cuscino, sotto
  for (const l of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.34, 0.42, 1.9, 12), 'metallo', l * 0.62, -0.3, 0.1, Math.PI / 2, 0, 0);
    add(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12), 'turch', l * 0.62, -0.3, 1.05, Math.PI / 2, 0, 0);
  }
  // pinne e coda
  add(new THREE.BoxGeometry(0.05, 0.42, 0.6), 'turch', 0, 0.36, -1.75, -0.6, 0, 0);
  for (const l of [-1, 1]) add(new THREE.BoxGeometry(0.9, 0.05, 0.5), 'turch', l * 0.55, 0.05, -1.7, 0, 0, l * 0.25);
  // parabrezza e manubrio
  add(new THREE.CircleGeometry(0.34, 16), 'turch', 0, 0.55, 0.95, -0.9, 0, 0, 1, 1.4, 1);
  add(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), 'metallo', 0, 0.48, 0.62, 0, 0, Math.PI / 2);
  // sella
  add(new THREE.CapsuleGeometry(0.26, 0.9, 4, 10), 'pelle', 0, 0.38, -0.55, Math.PI / 2, 0, 0, 1, 1, 0.6);

  // pilota: mantello a cono, cappuccio a punta, maschera bianca
  const pil = new THREE.Group(); pil.position.set(0, 0.5, -0.45); corpo.add(pil);
  const addP = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, M(mat)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true; pil.add(m); return m;
  };
  addP(new THREE.CylinderGeometry(0.22, 0.62, 1.1, 14), 'mantello', 0, 0.55, 0.05, 0.45, 0, 0);
  addP(new THREE.CapsuleGeometry(0.2, 0.5, 4, 8), 'mantello', 0, 0.75, 0.2, 0.9, 0, 0);
  const testa = new THREE.Group(); testa.position.set(0, 1.28, 0.42); pil.add(testa);
  const mT = (geo, mat, x, y, z, rx = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, M(mat)); m.position.set(x, y, z); m.rotation.x = rx; m.scale.set(sx, sy, sz); m.castShadow = true; testa.add(m); return m; };
  mT(new THREE.SphereGeometry(0.24, 18, 14), 'casco', 0, 0, 0.02, 0, 1, 1.1, 1.05);
  mT(new THREE.BoxGeometry(0.34, 0.07, 0.1), 'visiera', 0, 0.02, 0.22);
  mT(new THREE.ConeGeometry(0.3, 0.75, 14), 'mantello', 0, 0.2, -0.12, -1.0);
  mT(new THREE.CylinderGeometry(0.21, 0.3, 0.2, 14), 'sciarpa', 0, -0.23, -0.02);
  // braccia e gambe: capsule tese fra due punti (coordinate del pilota)
  const arto = (a, b, r, mat) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, d.length() - r * 2), 4, 8), M(mat));
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = true; pil.add(m); return m;
  };
  for (const l of [-1, 1]) {
    arto([l * 0.24, 0.95, 0.32], [l * 0.36, 0.55, 0.72], 0.085, 'mantello');
    arto([l * 0.36, 0.55, 0.72], [l * 0.5, -0.02, 1.05], 0.075, 'mantello');
    arto([l * 0.5, -0.04, 1.03], [l * 0.5, -0.02, 1.12], 0.07, 'pelle');
    arto([l * 0.2, 0.12, 0.05], [l * 0.42, 0.28, 0.6], 0.11, 'pelle');
    arto([l * 0.42, 0.28, 0.6], [l * 0.5, -0.25, 0.75], 0.09, 'pelle');
  }
  return { g, corpo, testa };
}
const moto = costruisciMoto();
scene.add(moto.g);

// sciarpa: una catenella simulata, resa come nastro
const NS = 11, LS = 0.21;
const sciarpaP = [], sciarpaV = [];
for (let i = 0; i < NS; i++) { sciarpaP.push(new THREE.Vector3()); sciarpaV.push(new THREE.Vector3()); }
const sciarpaGeo = new THREE.BufferGeometry();
sciarpaGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 2 * 3), 3));
{ const idx = []; for (let i = 0; i < NS - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } sciarpaGeo.setIndex(idx); }
const sciarpa = new THREE.Mesh(sciarpaGeo, M('sciarpa'));
sciarpa.castShadow = true; sciarpa.frustumCulled = false;
scene.add(sciarpa);

// polvere: sbuffi a fumetto, sfere istanziate che crescono e poi si sgonfiano
const NP = 420;
const polvere = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), M('polvere'), NP);
polvere.frustumCulled = false; polvere.castShadow = false;
scene.add(polvere);
const sbuffi = [];
for (let i = 0; i < NP; i++) sbuffi.push({ vivo: false, p: new THREE.Vector3(), v: new THREE.Vector3(), eta: 0, vita: 1, s: 1 });
let prossimo = 0;
const rnd = rng(1234);
function sbuffa(p, v, s, vita) {
  const b = sbuffi[prossimo]; prossimo = (prossimo + 1) % NP;
  b.vivo = true; b.p.copy(p); b.v.copy(v); b.eta = 0; b.vita = vita; b.s = s;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);

// ── Stato del pilota ──
const stato = { x: 0, z: -12, dir: -1.1, vel: 15, y: 0, vy: 0, roll: 0, pitch: 0 };
const cam = { yaw: 1.0, pitch: 0.12, dist: 8.5, ultimoMouse: 0 };
if (Q.get('cam') === '2') { cam.yaw = 2.6; cam.pitch = 0.12; }
if (Q.get('cam') === '3') { stato.x = -60; stato.z = 120; stato.dir = 0.9; cam.yaw = -0.4; }
if (Q.get('cam') === '4') { cam.yaw = 0; cam.pitch = 0.05; cam.dist = 8; }
stato.y = altezza(stato.x, stato.z) + 1.3;

// ── Visuale col mouse: pointer lock al clic ──
const cv = renderer.domElement;
cv.addEventListener('click', () => { if (document.pointerLockElement !== cv) cv.requestPointerLock?.(); });
let tempo = 0;
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== cv) return;
  cam.yaw -= e.movementX * 0.0028;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + e.movementY * 0.0022, -0.25, 1.0);
  cam.ultimoMouse = tempo;
});
addEventListener('wheel', e => { cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.08), 5, 24); }, { passive: true });

// ── Post: contorni a china + FXAA ──
const rtOpz = { count: 2, type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true };
let rtScena = new THREE.WebGLRenderTarget(1, 1, rtOpz);
let rtInk = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
const inkMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: { tCol: { value: null }, tInfo: { value: null }, uR: { value: 1 }, uInk: U.uInk, uNeb: U.uNebbiaCol, uT: { value: 0 } },
  vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `precision highp float; in vec2 vUv; out vec4 oCol;
    uniform sampler2D tCol, tInfo; uniform float uR, uT; uniform vec3 uInk, uNeb;
    vec4 I(ivec2 p){ return texelFetch(tInfo, clamp(p, ivec2(0), textureSize(tInfo,0)-1), 0); }
    float bordo(ivec2 p, ivec2 o, vec4 c) {
      vec4 a = I(p + o), b = I(p - o);
      // laplaciano della profondità inversa: zero sui piani, alto sulle discontinuità
      float ia = 1.0 / a.w, ib = 1.0 / b.w, ic = 1.0 / c.w;
      float lap = abs(ia + ib - 2.0 * ic) / max(max(ia, ib), ic);
      float e = smoothstep(0.10, 0.22, lap);
      // pieghe: normali che cambiano bruscamente
      float nd = 1.0 - min(dot(a.xyz, c.xyz), dot(b.xyz, c.xyz));
      e = max(e, smoothstep(0.28, 0.45, nd) * step(c.w, 9e5));
      return e;
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      ivec2 p = ivec2(gl_FragCoord.xy);
      vec4 c = I(p);
      vec3 col = texelFetch(tCol, p, 0).rgb;
      int r = int(max(1.0, floor(uR + 0.5)));
      float e = 0.0;
      e = max(e, bordo(p, ivec2(r, 0), c));
      e = max(e, bordo(p, ivec2(0, r), c));
      e = max(e, bordo(p, ivec2(r, r), c) * 0.9);
      e = max(e, bordo(p, ivec2(r, -r), c) * 0.9);
      // la china sbiadisce appena con la lontananza, come nelle tavole
      float d = min(c.w, 6000.0);
      vec3 ink = mix(uInk, mix(uInk, uNeb, 0.55), smoothstep(400.0, 4000.0, d));
      col = mix(col, ink, e);
      // grana della carta stampata
      float g = hash(floor(gl_FragCoord.xy)) - 0.5;
      col += g * 0.022;
      oCol = vec4(col, 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const fqInk = new FullScreenQuad(inkMat);
const fxaaMat = new THREE.ShaderMaterial({ ...FXAAShader, uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms), depthTest: false, depthWrite: false });
const fqFx = new FullScreenQuad(fxaaMat);

function ridimensiona() {
  const pr = renderer.getPixelRatio();
  const w = Math.floor(innerWidth * pr), h = Math.floor(innerHeight * pr);
  renderer.setSize(innerWidth, innerHeight);
  rtScena.setSize(w, h); rtInk.setSize(w, h);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const sc = h / 720;
  U.uScalaPx.value = Math.max(1, sc);
  inkMat.uniforms.uR.value = Math.max(1, sc * 1.25);
  fxaaMat.uniforms.resolution.value.set(1 / w, 1 / h);
}
addEventListener('resize', ridimensiona);
ridimensiona();

// ── Simulazione ──
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const collo = new THREE.Vector3();
let sciarpaPronta = false;

function aggiorna(dt, t) {
  tempo = t;
  const a = Demo.asse();
  const gp = Demo.guarda();
  if (gp.x || gp.y) { cam.yaw -= gp.x * dt * 2.2; cam.pitch = THREE.MathUtils.clamp(cam.pitch - gp.y * dt * 1.5, -0.25, 1.0); cam.ultimoMouse = t; }

  // guida: accelera, frena, sterza (si sterza anche da fermi, piano)
  const acc = a.y > 0 ? 26 : (a.y < 0 ? (stato.vel > 0 ? -40 : -12) : 0);
  stato.vel += acc * a.y * Math.sign(a.y || 1) * dt;
  stato.vel -= stato.vel * (a.y ? 0.35 : 0.9) * dt;
  stato.vel = THREE.MathUtils.clamp(stato.vel, -10, 42);
  const sterzo = -a.x * dt * (1.6 - 0.7 * Math.min(1, Math.abs(stato.vel) / 40));
  stato.dir += sterzo;
  const fx = Math.sin(stato.dir), fz = Math.cos(stato.dir);
  stato.x += fx * stato.vel * dt; stato.z += fz * stato.vel * dt;
  // ostacoli: si scivola via di lato
  for (const s of solidi) {
    const dx = stato.x - s.x, dz = stato.z - s.z, d = Math.hypot(dx, dz), m = s.r + 1.6;
    if (d < m && d > 0.01) { stato.x = s.x + dx / d * m; stato.z = s.z + dz / d * m; stato.vel *= 0.97; }
  }
  const rMax = 1100, rr = Math.hypot(stato.x, stato.z);
  if (rr > rMax) { stato.x *= rMax / rr; stato.z *= rMax / rr; }

  const hSotto = altezza(stato.x, stato.z);
  const hAv = altezza(stato.x + fx * 2.5, stato.z + fz * 2.5), hDi = altezza(stato.x - fx * 2.5, stato.z - fz * 2.5);
  const yT = Math.max(hSotto, (hAv + hDi) / 2) + 1.25 + Math.sin(t * 2.3) * 0.07;
  stato.y += (yT - stato.y) * Math.min(1, dt * 8);
  const pitchT = -Math.atan2(hAv - hDi, 5) - stato.vel * 0.002;
  stato.pitch += (pitchT - stato.pitch) * Math.min(1, dt * 6);
  const rollT = a.x * 0.42 * Math.min(1, Math.abs(stato.vel) / 12 + 0.25);
  stato.roll += (rollT - stato.roll) * Math.min(1, dt * 5);
  moto.g.position.set(stato.x, stato.y, stato.z);
  moto.g.rotation.y = stato.dir;
  moto.corpo.rotation.set(stato.pitch + Math.sin(t * 1.7) * 0.015, 0, stato.roll);
  moto.testa.rotation.y = -a.x * 0.35;

  // polvere: sbuffi dai pattini, più fitti quando si corre
  const vv = Math.abs(stato.vel);
  const quanti = dt > 0 ? (vv > 2 ? Math.min(4, vv * 0.07) : 0.1) : 0;
  let n = Math.floor(quanti) + (rnd() < quanti % 1 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const l = rnd() < 0.5 ? -1 : 1;
    _v.set(l * 0.8 + (rnd() - 0.5) * 0.6, 0, -1.2 - rnd() * 0.6).applyAxisAngle(_up, stato.dir);
    _v.x += stato.x; _v.z += stato.z; _v.y = altezza(_v.x, _v.z) + 0.3;
    _v2.set(l * (1 + rnd() * 2.5), 0.8 + rnd() * 1.6, -stato.vel * (0.15 + rnd() * 0.2)).applyAxisAngle(_up, stato.dir);
    if (vv < 2) _v2.set((rnd() - 0.5) * 2, 0.6 + rnd(), (rnd() - 0.5) * 2);
    sbuffa(_v, _v2, vv > 2 ? 0.35 + rnd() * 0.45 + vv * 0.012 : 0.18 + rnd() * 0.2, vv > 2 ? 0.8 + rnd() * 0.9 : 0.9 + rnd() * 0.6);
  }
  for (let i = 0; i < NP; i++) {
    const b = sbuffi[i];
    if (!b.vivo) { polvere.setMatrixAt(i, _zero); continue; }
    b.eta += dt;
    if (b.eta > b.vita) { b.vivo = false; polvere.setMatrixAt(i, _zero); continue; }
    b.v.multiplyScalar(1 - 1.6 * dt); b.v.y -= 0.6 * dt;
    b.p.addScaledVector(b.v, dt);
    const k = b.eta / b.vita;
    let sc = b.s * (0.35 + 1.5 * Math.sqrt(k)) * (1 - Math.pow(k, 3));
    const dc = b.p.distanceTo(camera.position);
    sc *= THREE.MathUtils.smoothstep(dc, 2.5, 7.5);
    _s.set(sc, sc * 0.8, sc);
    _m4.compose(b.p, _q, _s);
    polvere.setMatrixAt(i, _m4);
  }
  polvere.instanceMatrix.needsUpdate = true;

  // sciarpa: il primo anello segue il collo, gli altri subiscono il vento della corsa
  moto.testa.updateWorldMatrix(true, false);
  collo.set(0, -0.25, -0.18).applyMatrix4(moto.testa.matrixWorld);
  if (!sciarpaPronta) {
    for (let i = 0; i < NS; i++) sciarpaP[i].copy(collo).add(_v.set(-fx, -0.3, -fz).multiplyScalar(i * LS));
    sciarpaPronta = true;
  }
  const vento = _v2.set(-fx, 0.15, -fz).multiplyScalar(stato.vel * 0.45 + 2.5);
  sciarpaP[0].copy(collo);
  for (let i = 1; i < NS; i++) {
    const p = sciarpaP[i], v = sciarpaV[i];
    if (dt > 0) {
      v.y -= 3.5 * dt;
      v.addScaledVector(_v.copy(vento).sub(v), Math.min(1, dt * 2.5));
      v.x += Math.sin(t * 9 + i * 0.9) * 9 * dt * (1 + vv * 0.05) * i / NS;
      v.y += Math.cos(t * 7.3 + i * 1.1) * 9 * dt * i / NS;
      p.addScaledVector(v, dt);
    }
    // vincolo di lunghezza
    const q = sciarpaP[i - 1];
    _v.subVectors(p, q); const d = _v.length() || 1;
    p.copy(q).addScaledVector(_v, LS / d);
    const hT = altezza(p.x, p.z) + 0.1; if (p.y < hT) p.y = hT;
  }
  const pa = sciarpaGeo.attributes.position.array;
  for (let i = 0; i < NS; i++) {
    const p = sciarpaP[i], q = sciarpaP[Math.min(NS - 1, i + 1)], o = sciarpaP[Math.max(0, i - 1)];
    _v.subVectors(q, o).normalize();
    const lato = _v2.crossVectors(_v, _up).normalize();
    lato.applyAxisAngle(_v, Math.sin(t * 6 + i * 0.6) * 0.8);
    const w = 0.16 * (1 - i / NS * 0.4);
    pa[i * 6] = p.x + lato.x * w; pa[i * 6 + 1] = p.y + lato.y * w; pa[i * 6 + 2] = p.z + lato.z * w;
    pa[i * 6 + 3] = p.x - lato.x * w; pa[i * 6 + 4] = p.y - lato.y * w; pa[i * 6 + 5] = p.z - lato.z * w;
  }
  sciarpaGeo.attributes.position.needsUpdate = true;
  sciarpaGeo.computeVertexNormals();

  // camera in terza persona: se non tocchi il mouse per un po' torna dietro alla moto
  if (t - cam.ultimoMouse > 2.5 && vv > 4) cam.yaw += (0 - cam.yaw) * Math.min(1, dt * 0.9);
  const ang = stato.dir + Math.PI + cam.yaw;
  const cd = cam.dist + vv * 0.06;
  const cx = stato.x + Math.sin(ang) * Math.cos(cam.pitch) * cd;
  const cz = stato.z + Math.cos(ang) * Math.cos(cam.pitch) * cd;
  let cy = stato.y + 1.6 + Math.sin(cam.pitch) * cd;
  cy = Math.max(cy, altezza(cx, cz) + 1.2);
  camera.position.set(cx, cy, cz);
  camera.lookAt(stato.x + fx * 2, stato.y + 2.1, stato.z + fz * 2);

  // ombre: la camera d'ombra segue il pilota, agganciata ai texel per non far tremolare i bordi
  const passo = (SC.right - SC.left) / sole.shadow.mapSize.x;
  const ox = Math.round((stato.x + fx * 60) / passo) * passo, oz = Math.round((stato.z + fz * 60) / passo) * passo;
  sole.target.position.set(ox, 0, oz);
  sole.position.set(ox + DIR_SOLE.x * 400, DIR_SOLE.y * 400, oz + DIR_SOLE.z * 400);
  cielo.position.copy(camera.position);
}

function disegna(t) {
  camera.updateMatrixWorld();
  U.uSoleV.value.copy(DIR_SOLE).transformDirection(camera.matrixWorldInverse);
  renderer.setRenderTarget(rtScena);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  inkMat.uniforms.tCol.value = rtScena.textures[0];
  inkMat.uniforms.tInfo.value = rtScena.textures[1];
  inkMat.uniforms.uT.value = t;
  renderer.setRenderTarget(rtInk);
  fqInk.render(renderer);
  fxaaMat.uniforms.tDiffuse.value = rtInk.texture;
  renderer.setRenderTarget(null);
  fqFx.render(renderer);
}

Demo.extra('<p>La china non è disegnata a mano: nasce dove la profondità o la normale cambiano di colpo. Il tratteggio è ancorato al mondo e cambia scala con la distanza, così le righe restano sempre fitte uguali.</p>');

Demo.carica('Ripasso a china', 0.9);
// primo fotogramma per compilare tutto prima di togliere il velo
aggiorna(0, 0);
disegna(0);
Demo.loop((dt, t) => { if (dt > 0) aggiorna(dt, t); else aggiorna(0, t); disegna(t); });
Demo.pronto();
