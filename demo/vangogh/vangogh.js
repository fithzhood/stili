// Pennellate — un villaggio notturno in 3D ridipinto a olio.
// 1) la scena viene resa in una texture (colore + direzione suggerita + profondità);
// 2) dall'immagine si ricava un campo di direzioni (tensore di struttura, sfumato);
// 3) decine di migliaia di pennellate istanziate, ancorate a punti del mondo o del cielo,
//    prendono colore dalla scena e si orientano lungo il campo, in tre strati dal grosso al fine;
// 4) lo spessore della pittura (impasto) viene illuminato di taglio nel passaggio finale.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { costruisciMondo, campionaSuperfici, rng } from './vangogh-mondo.js?v=3';

THREE.ColorManagement.enabled = false;
const Q = Demo.query;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Demo.shot, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
document.body.prepend(renderer.domElement);

const FOV = 55;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 1, 5000);
const CAM0 = new THREE.Vector3(0, 31, -34);
camera.position.copy(CAM0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(4, 38, 100);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.enablePan = false; controls.rotateSpeed = 0.35; controls.zoomSpeed = 0.6;
controls.update();
{
  const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  controls.minAzimuthAngle = sph.theta - 0.32; controls.maxAzimuthAngle = sph.theta + 0.32;
  controls.minPolarAngle = sph.phi - 0.1; controls.maxPolarAngle = sph.phi + 0.07;
  controls.minDistance = sph.radius * 0.72; controls.maxDistance = sph.radius * 1.08;
}
if (Q.get('cam') === '2') { camera.position.set(-38, 16, -22); controls.update(); }

// ── Luce notturna: la luna da destra, un cielo blu che riempie le ombre ──
const lunaL = new THREE.DirectionalLight(0xd8dcff, 2.2); lunaL.position.set(-0.8, 0.9, -0.7); scene.add(lunaL);
scene.add(new THREE.HemisphereLight(0x5a7cc8, 0x1a2a3c, 2.4));

const hex = h => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);

// ── Materiali della scena: colore a due toni con motivo, e la direzione "suggerita" ──
// modi: 0 curve di livello (campi e colline), 1 fiamma (cipresso), 2 vortice (chiome), 3 falda (tetti), 4 verticale (muri)
const TAV = {
  terra:    { c1: 0x1f4a33, c2: 0x86a24c, modo: 0, motivo: 0 },
  muro:     { c1: 0xa9c0e0, c2: 0xe0cf92, modo: 4, motivo: 1 },
  tetto:    { c1: 0x243a6c, c2: 0x33508c, modo: 3, motivo: 1 },
  tettoR:   { c1: 0x7a4e3a, c2: 0x9a6a3a, modo: 3, motivo: 1 },
  finestra: { c1: 0xffd23a, c2: 0xfff09a, modo: 4, motivo: 1, luce: 1 },
  ulivo:    { c1: 0x1d3b33, c2: 0x3d6a4e, modo: 2, motivo: 2 },
  cipresso: { c1: 0x0c1714, c2: 0x4f8a5a, modo: 1, motivo: 3 },
};
const U = { uRisS: { value: new THREE.Vector2(1, 1) } };
const cache = {};
function M(nome) {
  if (cache[nome]) return cache[nome];
  const o = TAV[nome];
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: nome === 'finestra' ? THREE.DoubleSide : THREE.FrontSide });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, { uC1: { value: hex(o.c1) }, uC2: { value: hex(o.c2) }, uModo: { value: o.modo }, uMotivo: { value: o.motivo }, uLuce: { value: o.luce || 0 } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vHint; varying vec3 vMondo; uniform float uModo; uniform vec2 uRisS;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wpM = modelMatrix * vec4(transformed, 1.0);
        vMondo = wpM.xyz;
        vec3 nW = normalize(mat3(modelMatrix) * objectNormal);
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 T;
        if (uModo < 0.5) {
          T = normalize(cross(up, nW) + vec3(1e-4, 0.0, 0.0));
          float w = 0.45 * sin(wpM.x * 0.045 + wpM.z * 0.03) + 0.25 * sin(wpM.x * 0.13 - wpM.z * 0.09);
          T = normalize(T * cos(w) + cross(nW, T) * sin(w));
        } else if (uModo < 1.5) {
          float tw = 0.75 * sin(wpM.y * 0.28 + atan(nW.z, nW.x) * 2.0);
          T = normalize(up * cos(tw) + cross(nW, up) * sin(tw));
        } else if (uModo < 2.5) {
          T = normalize(cross(up, nW) + up * 0.35 * sin(wpM.y * 0.9));
        } else if (uModo < 3.5) {
          T = normalize(up - nW * nW.y + vec3(1e-4));
        } else {
          T = up;
        }
        vec4 c0 = projectionMatrix * viewMatrix * wpM;
        vec4 c1 = projectionMatrix * viewMatrix * (wpM + vec4(T * 0.5, 0.0));
        vec2 dd = (c1.xy / c1.w - c0.xy / c0.w) * uRisS;
        dd = normalize(dd + vec2(1e-6, 0.0));
        vHint = vec2(dd.x * dd.x - dd.y * dd.y, 2.0 * dd.x * dd.y);`);
    sh.fragmentShader = 'layout(location = 1) out highp vec4 gInfo;\n' + sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vHint; varying vec3 vMondo;
        uniform vec3 uC1, uC2; uniform float uMotivo, uLuce;
        float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vno(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hs(i), hs(i+vec2(1,0)), f.x), mix(hs(i+vec2(0,1)), hs(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `
        float mt;
        if (uMotivo < 0.5) {          // campi: fasce che seguono le curve di livello
          float y = vMondo.y + 5.0 * vno(vMondo.xz * 0.02);
          mt = 0.5 + 0.5 * sin(y * 1.3 + vno(vMondo.xz * 0.05) * 4.0);
          mt = smoothstep(0.15, 0.85, mix(mt, vno(vMondo.xz * 0.08), 0.3));
          // le colline lontane virano al blu, i campi vicini al verde e all'ocra
          float lon = smoothstep(150.0, 330.0, vMondo.z);
          vec3 a = mix(uC1, vec3(0.13, 0.27, 0.52), lon), b = mix(uC2, vec3(0.3, 0.46, 0.7), lon);
          b = mix(b, vec3(0.72, 0.62, 0.3), smoothstep(40.0, 0.0, vMondo.z) * 0.5 * vno(vMondo.xz * 0.04));
          diffuseColor.rgb = mix(a, b, mt);
        } else if (uMotivo < 1.5) {
          diffuseColor.rgb = mix(uC1, uC2, vno(floor(vMondo.xz / 7.0) * 3.1));
        } else if (uMotivo < 2.5) {
          diffuseColor.rgb = mix(uC1, uC2, smoothstep(0.3, 0.8, vno(vMondo.xz * 0.3 + vMondo.y * 0.2)));
        } else {                      // cipresso: lingue più chiare che salgono a spirale
          float an = atan(vMondo.z - 6.0, vMondo.x - 17.0);
          float s = vno(vec2(an * 2.2 + vMondo.y * 0.05, vMondo.y * 0.11)) * 0.7 + vno(vec2(an * 5.0, vMondo.y * 0.3)) * 0.3;
          diffuseColor.rgb = mix(uC1, uC2, smoothstep(0.5, 0.8, s));
        }`)
      .replace('#include <opaque_fragment>', `
        vec3 col = outgoingLight;
        if (uLuce > 0.5) col = diffuseColor.rgb * 1.15;
        gl_FragColor = vec4(col, 1.0);
        gInfo = vec4(vHint, vViewPosition.z, 1.0);`);
  };
  m.customProgramCacheKey = () => 'vg-' + nome;
  cache[nome] = m;
  return m;
}

// ── Il cielo: stesso codice per il colore (nella scena) e per le direzioni (nelle pennellate) ──
const CIELO_GLSL = `
  const vec4 VORT[5] = vec4[5](vec4(-0.08, 0.30, 0.16, 0.05), vec4(0.15, 0.36, 0.1, -0.065), vec4(0.47, 0.19, 0.07, 0.08), vec4(-0.55, 0.46, 0.09, -0.055), vec4(-0.33, 0.14, 0.06, 0.07));
  const vec3 STELLE[11] = vec3[11](vec3(-0.64, 0.56, 0.032), vec3(-0.4, 0.33, 0.028), vec3(-0.24, 0.57, 0.027), vec3(0.03, 0.52, 0.03), vec3(0.3, 0.5, 0.034),
    vec3(0.36, 0.23, 0.024), vec3(-0.74, 0.22, 0.024), vec3(0.76, 0.2, 0.028), vec3(0.08, 0.17, 0.022), vec3(-0.18, 0.1, 0.018), vec3(0.44, 0.63, 0.022));
  const vec3 LUNA = vec3(0.6, 0.37, 0.05);
  vec2 ruota(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
  float psiOnda(vec2 q){ return q.y - 0.4 - 0.05 * sin(q.x * 5.0 + 0.8) - 0.022 * sin(q.x * 11.0 + 2.0); }
  vec3 coloreCielo(vec2 q, float t){
    float v = q.y;
    vec3 c = mix(vec3(0.5, 0.66, 0.8), vec3(0.17, 0.35, 0.68), smoothstep(-0.02, 0.2, v));
    c = mix(c, vec3(0.09, 0.19, 0.5), smoothstep(0.3, 0.85, v));
    // lievi strisce ovunque, perché ogni pennellata trovi un tono diverso
    c *= 0.9 + 0.2 * (0.5 + 0.5 * sin(psiOnda(q) * 60.0 + q.x * 3.0));
    // la grande onda
    float psi = psiOnda(q);
    float fascia = exp(-psi * psi / (0.075 * 0.075));
    float st = 0.5 + 0.5 * sin(psi * 110.0 + sin(q.x * 7.0) * 1.7);
    c = mix(c, mix(vec3(0.3, 0.52, 0.8), vec3(0.82, 0.9, 0.9), st), fascia * 0.85);
    for (int i = 0; i < 5; i++) {
      vec2 d = q - VORT[i].xy; float r = length(d), R = VORT[i].z;
      float w = 1.0 - smoothstep(0.7 * R, 1.1 * R, r);
      if (w <= 0.0) continue;
      float an = atan(d.y, d.x) - VORT[i].w * t;
      float s = 0.5 + 0.5 * sin(r / R * 17.0 + an * 2.0 * sign(VORT[i].w));
      vec3 vc = mix(vec3(0.2, 0.4, 0.78), vec3(0.8, 0.88, 0.9), s);
      vc = mix(vc, vec3(0.95, 0.93, 0.72), (1.0 - smoothstep(0.0, 0.3, r / R)) * 0.7);
      c = mix(c, vc, w * 0.92);
    }
    for (int j = 0; j < 11; j++) {
      vec2 d = q - STELLE[j].xy; float r = length(d) / STELLE[j].z;
      if (r > 2.8) continue;
      float anello = fract(r * 1.25);
      vec3 hc = anello < 0.5 ? vec3(0.96, 0.84, 0.28) : (r > 1.6 ? vec3(0.55, 0.75, 0.85) : vec3(0.88, 0.95, 0.78));
      c = mix(c, hc, (1.0 - smoothstep(1.4, 2.8, r)) * 0.85);
      c = mix(c, vec3(1.0, 0.98, 0.82), 1.0 - smoothstep(0.38, 0.55, r));
    }
    {
      vec2 d = q - LUNA.xy; float r = length(d) / LUNA.z;
      if (r < 3.2) {
        float anello = fract(r * 1.1);
        vec3 hc = anello < 0.5 ? vec3(0.98, 0.8, 0.22) : vec3(0.95, 0.62, 0.18);
        c = mix(c, hc, (1.0 - smoothstep(1.2, 3.2, r)) * 0.9);
        float disco = 1.0 - smoothstep(0.9, 1.0, r);
        float morso = 1.0 - smoothstep(0.8, 0.86, length(d / LUNA.z - vec2(0.3, 0.2)));
        c = mix(c, vec3(1.0, 0.86, 0.25), disco);
        c = mix(c, mix(vec3(0.96, 0.6, 0.14), vec3(0.85, 0.42, 0.1), anello), disco * morso);
      }
    }
    return c;
  }
  vec2 campoCielo(vec2 q){
    float dpsi = 0.25 * cos(q.x * 5.0 + 0.8) + 0.242 * cos(q.x * 11.0 + 2.0);
    vec2 dir = normalize(vec2(1.0, dpsi));
    for (int i = 0; i < 5; i++) {
      vec2 d = q - VORT[i].xy; float r = max(length(d), 1e-4), R = VORT[i].z;
      float w = 1.0 - smoothstep(0.8 * R, 1.4 * R, r);
      vec2 tg = normalize(vec2(-d.y, d.x) / r * sign(VORT[i].w) - d / r * 0.3);
      if (dot(tg, dir) < 0.0) tg = -tg;
      dir = normalize(mix(dir, tg, w) + 1e-5);
    }
    for (int j = 0; j < 11; j++) {
      vec2 d = q - STELLE[j].xy; float r = max(length(d), 1e-4), R = STELLE[j].z;
      float w = 1.0 - smoothstep(1.8 * R, 3.0 * R, r);
      vec2 tg = vec2(-d.y, d.x) / r; if (dot(tg, dir) < 0.0) tg = -tg;
      dir = normalize(mix(dir, tg, w) + 1e-5);
    }
    { vec2 d = q - LUNA.xy; float r = max(length(d), 1e-4); float w = 1.0 - smoothstep(2.2 * LUNA.z, 3.4 * LUNA.z, r);
      vec2 tg = vec2(-d.y, d.x) / r; if (dot(tg, dir) < 0.0) tg = -tg; dir = normalize(mix(dir, tg, w) + 1e-5); }
    return dir;
  }`;
const VORT = [[-0.08, 0.30, 0.16, 0.05], [0.15, 0.36, 0.1, -0.065], [0.47, 0.19, 0.07, 0.08], [-0.55, 0.46, 0.09, -0.055], [-0.33, 0.14, 0.06, 0.07]];
const STELLE = [[-0.64, 0.56, 0.032], [-0.4, 0.33, 0.028], [-0.24, 0.57, 0.027], [0.03, 0.52, 0.03], [0.3, 0.5, 0.034], [0.36, 0.23, 0.024], [-0.74, 0.22, 0.024], [0.76, 0.2, 0.028], [0.08, 0.17, 0.022], [-0.18, 0.1, 0.018], [0.44, 0.63, 0.022]];
const LUNA = [0.6, 0.37, 0.05];

const U_T = { value: 0 };
const cieloMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, side: THREE.BackSide, depthWrite: false,
  uniforms: { uT: U_T },
  vertexShader: `out vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.9999; }`,
  fragmentShader: `precision highp float; in vec3 vDir; uniform float uT;
    layout(location = 0) out vec4 oCol; layout(location = 1) out vec4 oInfo;
    ${CIELO_GLSL}
    void main(){ vec3 d = normalize(vDir); vec2 q = vec2(-atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0)));
      oCol = vec4(coloreCielo(q, uT), 1.0); oInfo = vec4(1.0, 0.0, 1e5, 0.0); }`,
});
const cielo = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), cieloMat);
cielo.renderOrder = -1; cielo.frustumCulled = false;
scene.add(cielo);

Demo.carica('Preparo la tela', 0.15);
const mondo = costruisciMondo(scene, M);

// ── Le pennellate ──
const PXR720 = 360 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));   // pixel per radiante a 720p
const STRATI = [
  { L: 46, W: 15, copertura: 2.0 },
  { L: 27, W: 8.5, copertura: 2.3 },
  { L: 15, W: 4.8, copertura: 1.6 },
];
Demo.carica('Carico i pennelli', 0.4);
const terra = campionaSuperfici(mondo.campioni, CAM0, STRATI, PXR720, 7);

// cielo: griglia sfalsata in (azimut, altezza); chi cade in un vortice gira con lui
function campionaCielo() {
  const r = rng(99);
  const out = STRATI.map(() => ({ pos: [], dati: [], vort: [] }));
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const assegna = (u, v) => {
    for (const [cu, cv, R, w] of VORT) { const d = Math.hypot(u - cu, v - cv); if (d < R * 1.25) return [cu, cv, w * (1 - smooth(0.85 * R, 1.25 * R, d))]; }
    for (const [cu, cv, s] of STELLE) if (Math.hypot(u - cu, v - cv) < s * 3) return [cu, cv, 0.12];
    if (Math.hypot(u - LUNA[0], v - LUNA[1]) < LUNA[2] * 3.4) return [LUNA[0], LUNA[1], 0.035];
    return [0, 0, 0];
  };
  const vicinoAStella = (u, v) => STELLE.some(([cu, cv, s]) => Math.hypot(u - cu, v - cv) < s * 2.9) || Math.hypot(u - LUNA[0], v - LUNA[1]) < LUNA[2] * 3.3;
  STRATI.forEach((s, si) => {
    const passo = Math.sqrt(s.L * s.W * 0.78 / s.copertura) / PXR720;
    for (let v = -0.14; v < 0.98; v += passo * 0.866) {
      const riga = Math.round(v / passo);
      for (let u = -1.4 + (riga % 2) * passo * 0.5; u < 1.4; u += passo) {
        const uu = u + (r() - 0.5) * passo * 0.8, vv = v + (r() - 0.5) * passo * 0.8;
        if (si === 2 && !vicinoAStella(uu, vv)) continue;       // lo strato fine solo attorno agli astri
        out[si].pos.push(uu, vv, 0);
        out[si].dati.push(s.L / PXR720, r(), si, 1);
        out[si].vort.push(...assegna(uu, vv), 0);
      }
    }
  });
  // anelli concentrici attorno a stelle e luna, pennellate tangenti (strato medio)
  const s = STRATI[1];
  for (const [cu, cv, R, om] of [...STELLE.map(x => [...x, 0.12]), [...LUNA, 0.035]]) {
    for (let rr = R * 0.55; rr < R * 2.7; rr += R * 0.32) {
      const n = Math.max(6, Math.round(2 * Math.PI * rr / (s.L / PXR720 * 0.6)));
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + r() * 0.2;
        out[1].pos.push(cu + Math.cos(a) * rr, cv + Math.sin(a) * rr, 0);
        out[1].dati.push(s.L / PXR720 * 0.75, r(), 1, 2);
        out[1].vort.push(cu, cv, om, 0);
      }
    }
  }
  return out;
}
const cieloP = campionaCielo();

const quad = new THREE.PlaneGeometry(2, 2);
const PALETTE = [0x1f3a93, 0x2f5fb3, 0x1b2f5a, 0x8fb6de, 0xd7e6ee, 0xf2c230, 0xf7e27a, 0xe8902a, 0x1f3a2a, 0x3d6b52, 0x6f7f3a, 0xb8893a, 0x121a33, 0x4f86c6];

const tratti = [];
function stratoMesh(si) {
  const t = terra[si], c = cieloP[si];
  const n = t.pos.length / 3 + c.pos.length / 3;
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute('position', quad.attributes.position);
  const P = new Float32Array(n * 3), D = new Float32Array(n * 4), V = new Float32Array(n * 4);
  P.set(t.pos, 0); P.set(c.pos, t.pos.length);
  D.set(t.dati, 0); D.set(c.dati, t.dati.length);
  V.set(c.vort, (t.pos.length / 3) * 4);
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(P, 3));
  g.setAttribute('aD', new THREE.InstancedBufferAttribute(D, 4));
  g.setAttribute('aV', new THREE.InstancedBufferAttribute(V, 4));
  g.instanceCount = n;
  const s = STRATI[si];
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      tScena: { value: null }, tInfo: { value: null }, tFlusso: { value: null },
      uRes: { value: new THREE.Vector2() }, uPxRad: { value: 1 }, uT: U_T, uScala: { value: 1 },
      uL: { value: s.L }, uWL: { value: s.W / s.L }, uStrato: { value: si },
      uPal: { value: PALETTE.map(hex) },
    },
    vertexShader: `precision highp float;
      in vec3 aP; in vec4 aD; in vec4 aV;
      uniform sampler2D tScena, tInfo, tFlusso; uniform vec2 uRes; uniform float uPxRad, uT, uScala, uL, uWL, uStrato;
      uniform vec3 uPal[14];
      out vec2 vQ; out vec3 vCol; out float vSeme; out float vCurva;
      ${CIELO_GLSL}
      float h1(float x){ return fract(sin(x * 91.3458) * 47453.5453); }
      vec4 clipCielo(vec2 q){ vec3 d = vec3(-sin(q.x) * cos(q.y), sin(q.y), cos(q.x) * cos(q.y)); return projectionMatrix * vec4(mat3(viewMatrix) * d * 3000.0, 1.0); }
      vec2 dirFlusso(vec2 uv){ vec4 f = texture(tFlusso, uv); float a = 0.5 * atan(f.y, f.x); return vec2(cos(a), sin(a)); }
      void main(){
        float tipo = aD.w, seme = aD.y;
        vec4 clip; vec2 dir, dirA, dirB; float lenPx, vis = 1.0;
        if (tipo < 0.5) {
          vec4 vp = viewMatrix * vec4(aP, 1.0);
          float dv = -vp.z;
          clip = projectionMatrix * vp;
          vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
          vec4 inf = texture(tInfo, uv);
          if (clip.w <= 0.0 || inf.w < 0.5 || dv > inf.z * 1.025 + 0.8) vis = 0.0;
          vec4 fl = texture(tFlusso, uv);
          dir = dirFlusso(uv);
          lenPx = aD.x / dv * uPxRad;
          // lo strato fine va solo dove l'immagine ha dettaglio
          if (uStrato > 1.5) vis *= step(0.25, fl.z);
          vec2 o = dir * lenPx * 0.5 / uRes;
          dirA = dirFlusso(uv - o); dirB = dirFlusso(uv + o);
        } else {
          vec2 q = aP.xy;
          if (aV.z != 0.0) q = aV.xy + ruota(q - aV.xy, aV.z * uT);
          clip = clipCielo(q);
          vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
          vec4 inf = texture(tInfo, uv);
          if (inf.w > 0.5) vis = 0.0;
          vec2 dq = campoCielo(q);
          vec4 c2 = clipCielo(q + dq * 0.004);
          dir = normalize((c2.xy / c2.w - clip.xy / clip.w) * uRes + 1e-6);
          lenPx = aD.x * uPxRad;
          float ha = aD.x * 0.5;
          vec2 qa = q - dq * ha, qb = q + dq * ha;
          vec2 da = campoCielo(qa), db = campoCielo(qb);
          vec4 ca = clipCielo(qa), ca2 = clipCielo(qa + da * 0.004), cb = clipCielo(qb), cb2 = clipCielo(qb + db * 0.004);
          dirA = normalize((ca2.xy / ca2.w - ca.xy / ca.w) * uRes + 1e-6);
          dirB = normalize((cb2.xy / cb2.w - cb.xy / cb.w) * uRes + 1e-6);
        }
        float nom = uL * uScala;
        lenPx = clamp(lenPx, nom * 0.45, nom * 2.4) * (0.85 + 0.3 * h1(seme * 7.0));
        float widPx = lenPx * uWL * (0.85 + 0.3 * h1(seme * 13.0));
        // curvatura: quanto gira il campo fra la coda e la punta del tratto
        if (dot(dirA, dir) < 0.0) dirA = -dirA;
        if (dot(dirB, dir) < 0.0) dirB = -dirB;
        vec2 perp = vec2(-dir.y, dir.x);
        vCurva = clamp((dot(dirB, perp) - dot(dirA, perp)) * 0.9, -0.8, 0.8) * lenPx / max(widPx, 1.0) * 0.5;
        // colore preso dalla scena, lungo il tratto
        vec2 uv0 = clip.xy / clip.w * 0.5 + 0.5, du = dir * lenPx * 0.3 / uRes;
        vec3 col = (texture(tScena, uv0).rgb * 2.0 + texture(tScena, uv0 - du).rgb + texture(tScena, uv0 + du).rgb) * 0.25;
        // avvicina il colore alla tavolozza dell'olio
        float best = 1e9; vec3 pc = col;
        for (int i = 0; i < 14; i++) { vec3 d = uPal[i] - col; float e = dot(d, d); if (e < best) { best = e; pc = uPal[i]; } }
        col = mix(col, pc, 0.38);
        col *= 0.9 + 0.2 * h1(seme * 3.0);
        col = mix(col, col.gbr, (h1(seme * 5.0) - 0.5) * 0.08);
        vCol = col; vSeme = seme;
        vQ = position.xy * vec2(1.0, 1.25);
        vec2 off = dir * position.x * lenPx * 0.5 + perp * position.y * widPx * 0.5 * (1.25 + abs(vCurva));
        clip.xy += off / (uRes * 0.5) * clip.w;
        if (tipo > 0.5) clip.z = clip.w * (0.99985 - seme * 0.00005 - (tipo > 1.5 ? 0.00006 : 0.0));
        if (vis < 0.5) clip = vec4(2.0, 2.0, 2.0, 1.0);
        gl_Position = clip;
      }`,
    fragmentShader: `precision highp float;
      in vec2 vQ; in vec3 vCol; in float vSeme; in float vCurva;
      layout(location = 0) out vec4 oCol; layout(location = 1) out vec4 oH;
      float h1(float x){ return fract(sin(x * 91.3458) * 47453.5453); }
      void main(){
        vec2 q = vQ;
        q.y -= vCurva * (q.x * q.x - 0.33);
        float xe = abs(q.x);
        float wid = 1.0 - pow(xe, 3.0) * 0.5;
        float nb = 7.0;
        float bf = (q.y / wid * 0.5 + 0.5) * nb;
        float bi = floor(bf);
        float hb = h1(bi + vSeme * 37.0);
        float fine = 0.8 + 0.2 * hb;
        if (abs(q.y) > wid || xe > fine || bi < 0.0 || bi >= nb) discard;
        float cr = 1.0 - pow(abs(fract(bf) - 0.5) * 2.0, 2.0);
        float carico = smoothstep(1.0, -0.6, q.x);             // la pittura si accumula dove il pennello si posa
        float h = 0.3 + 0.35 * cr * (0.5 + 0.5 * hb) + 0.3 * carico;
        vec3 col = vCol * (0.88 + 0.22 * hb) * (0.95 + 0.08 * cr);
        oCol = vec4(col, 1.0); oH = vec4(h, 0.0, 0.0, 1.0);
      }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(m);
  return { sc, mat };
}
Demo.carica('Stendo il colore', 0.7);
for (let i = 0; i < 3; i++) tratti.push(stratoMesh(i));

// ── Render target e passaggi a schermo intero ──
const rtScena = new THREE.WebGLRenderTarget(1, 1, { count: 2, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
rtScena.textures[1].minFilter = rtScena.textures[1].magFilter = THREE.NearestFilter;
const rtT1 = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
const rtT2 = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
const rtFlusso = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
const rtTela = new THREE.WebGLRenderTarget(1, 1, { count: 2, type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });

const VS = `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const passo = (fs, uniforms) => new FullScreenQuad(new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms, vertexShader: VS, fragmentShader: 'precision highp float; in vec2 vUv; out vec4 oCol;\n' + fs, depthTest: false, depthWrite: false }));

// tensore di struttura dai gradienti di colore
const pTensore = passo(`uniform sampler2D tS; uniform vec2 uPx;
  vec3 C(vec2 o){ return texture(tS, vUv + o * uPx).rgb; }
  void main(){
    vec3 gx = (C(vec2(1,-1)) + 2.0*C(vec2(1,0)) + C(vec2(1,1)) - C(vec2(-1,-1)) - 2.0*C(vec2(-1,0)) - C(vec2(-1,1))) * 0.25;
    vec3 gy = (C(vec2(-1,1)) + 2.0*C(vec2(0,1)) + C(vec2(1,1)) - C(vec2(-1,-1)) - 2.0*C(vec2(0,-1)) - C(vec2(1,-1))) * 0.25;
    oCol = vec4(dot(gx, gx), dot(gx, gy), dot(gy, gy), 1.0);
  }`, { tS: { value: null }, uPx: { value: new THREE.Vector2() } });
const pSfuma = passo(`uniform sampler2D tS; uniform vec2 uDir;
  void main(){
    vec4 s = texture(tS, vUv) * 0.1964;
    s += (texture(tS, vUv + uDir * 1.4118) + texture(tS, vUv - uDir * 1.4118)) * 0.2969;
    s += (texture(tS, vUv + uDir * 3.2941) + texture(tS, vUv - uDir * 3.2941)) * 0.0945;
    s += (texture(tS, vUv + uDir * 5.1765) + texture(tS, vUv - uDir * 5.1765)) * 0.0104;
    oCol = s;
  }`, { tS: { value: null }, uDir: { value: new THREE.Vector2() } });
// direzione finale: il bordo dell'immagine dove c'è, altrimenti la direzione suggerita dalla forma
const pDirezione = passo(`uniform sampler2D tT, tI;
  void main(){
    vec3 t = texture(tT, vUv).xyz; vec4 inf = texture(tI, vUv);
    float E = t.x, F = t.y, G = t.z;
    float tr = E + G, disc = sqrt(max((E - G) * (E - G) + 4.0 * F * F, 0.0));
    float l1 = 0.5 * (tr + disc), l2 = 0.5 * (tr - disc);
    vec2 v1 = abs(F) > 1e-7 ? vec2(F, l1 - E) : (E >= G ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
    vec2 tg = normalize(vec2(-v1.y, v1.x) + 1e-8);
    float coer = (l1 - l2) / (l1 + l2 + 1e-5);
    float forza = smoothstep(0.0004, 0.004, l1) * coer;
    vec2 a = vec2(tg.x * tg.x - tg.y * tg.y, 2.0 * tg.x * tg.y);
    vec2 h = inf.xy;
    vec2 s = a * forza * 1.3 + h * (1.0 - forza) * 0.9;
    oCol = vec4(normalize(s + vec2(1e-6, 0.0)), smoothstep(0.0003, 0.003, l1), 1.0);
  }`, { tT: { value: null }, tI: { value: null } });
// imprimitura: la scena sfumata sotto a tutto, così fra una pennellata e l'altra non resta la tela nuda
const imprMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
  uniforms: { tS: { value: null } },
  vertexShader: VS,
  fragmentShader: `precision highp float; in vec2 vUv; uniform sampler2D tS;
    layout(location = 0) out vec4 oCol; layout(location = 1) out vec4 oH;
    void main(){ vec3 c = vec3(0.0); for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) c += texture(tS, vUv + vec2(i, j) * 0.004).rgb;
      oCol = vec4(c / 25.0 * 0.85, 1.0); oH = vec4(0.12, 0.0, 0.0, 1.0); }`,
});
const pImpr = new FullScreenQuad(imprMat);
// composizione finale: l'impasto illuminato di taglio, la trama della tela
const pFinale = passo(`uniform sampler2D tC, tH; uniform vec2 uRes; uniform float uS;
  float H(vec2 o){ return texture(tH, vUv + o / uRes).r; }
  float hs(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec3 col = texture(tC, vUv).rgb;
    float hx = H(vec2(uS, 0.0)) - H(vec2(-uS, 0.0)), hy = H(vec2(0.0, uS)) - H(vec2(0.0, -uS));
    vec3 n = normalize(vec3(-hx * 3.2, -hy * 3.2, 1.0));
    vec3 l = normalize(vec3(-0.45, 0.6, 0.66));
    float dif = dot(n, l);
    col *= 0.8 + 0.3 * dif;
    float sp = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
    col += sp * 0.16 * (0.4 + H(vec2(0.0)));
    vec2 f = gl_FragCoord.xy;
    float tela = (sin(f.x * 1.7) * sin(f.y * 1.7)) * 0.5 + 0.5;
    col *= 0.965 + 0.05 * tela + (hs(floor(f / 2.0)) - 0.5) * 0.03;
    vec2 q = vUv - 0.5; col *= 1.0 - dot(q, q) * 0.35;
    oCol = vec4(col, 1.0);
  }`, { tC: { value: null }, tH: { value: null }, uRes: { value: new THREE.Vector2() }, uS: { value: 1 } });

function ridimensiona() {
  const pr = renderer.getPixelRatio();
  renderer.setSize(innerWidth, innerHeight);
  const w = Math.floor(innerWidth * pr), h = Math.floor(innerHeight * pr);
  const ws = Math.max(2, Math.floor(w / 2)), hs = Math.max(2, Math.floor(h / 2));
  rtScena.setSize(ws, hs); rtT1.setSize(ws, hs); rtT2.setSize(ws, hs); rtFlusso.setSize(ws, hs);
  rtTela.setSize(w, h);
  U.uRisS.value.set(ws, hs);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const pxRad = (h / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  for (const t of tratti) { t.mat.uniforms.uRes.value.set(w, h); t.mat.uniforms.uPxRad.value = pxRad; t.mat.uniforms.uScala.value = h / 720; }
  pTensore.material.uniforms.uPx.value.set(1 / ws, 1 / hs);
  pFinale.material.uniforms.uRes.value.set(w, h);
  pFinale.material.uniforms.uS.value = Math.max(1, h / 900);
}
addEventListener('resize', ridimensiona);
ridimensiona();

function rendi() {
  camera.updateMatrixWorld();
  cielo.position.copy(camera.position);
  // 1. la scena
  renderer.setRenderTarget(rtScena); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, camera);
  // 2. il campo di direzioni
  pTensore.material.uniforms.tS.value = rtScena.textures[0];
  renderer.setRenderTarget(rtT1); pTensore.render(renderer);
  const ws = rtT1.width, hs = rtT1.height;
  pSfuma.material.uniforms.tS.value = rtT1.texture; pSfuma.material.uniforms.uDir.value.set(1.6 / ws, 0);
  renderer.setRenderTarget(rtT2); pSfuma.render(renderer);
  pSfuma.material.uniforms.tS.value = rtT2.texture; pSfuma.material.uniforms.uDir.value.set(0, 1.6 / hs);
  renderer.setRenderTarget(rtT1); pSfuma.render(renderer);
  pDirezione.material.uniforms.tT.value = rtT1.texture; pDirezione.material.uniforms.tI.value = rtScena.textures[1];
  renderer.setRenderTarget(rtFlusso); pDirezione.render(renderer);
  // 3. la tela: imprimitura, poi i tre strati di pennellate dal grosso al fine
  renderer.setRenderTarget(rtTela); renderer.setClearColor(0x1a2440, 1); renderer.clear();
  imprMat.uniforms.tS.value = rtScena.textures[0]; pImpr.render(renderer);
  for (const t of tratti) {
    renderer.clearDepth();
    const u = t.mat.uniforms;
    u.tScena.value = rtScena.textures[0]; u.tInfo.value = rtScena.textures[1]; u.tFlusso.value = rtFlusso.texture;
    renderer.render(t.sc, camera);
  }
  // 4. a schermo
  pFinale.material.uniforms.tC.value = rtTela.textures[0]; pFinale.material.uniforms.tH.value = rtTela.textures[1];
  renderer.setRenderTarget(null); pFinale.render(renderer);
}

const nTratti = tratti.reduce((a, t) => a + t.sc.children[0].geometry.instanceCount, 0);
Demo.extra(`<p>In questo momento sulla tela ci sono <b>${nTratti.toLocaleString('it-IT')}</b> pennellate. Quelle sul paesaggio sono inchiodate a punti del mondo: girando la visuale restano al loro posto. Quelle del cielo girano con i vortici.</p>`);
Demo.carica('Ultime pennellate', 0.95);
rendi();
Demo.loop((dt, t) => { U_T.value = t; controls.update(); rendi(); });
Demo.pronto();
