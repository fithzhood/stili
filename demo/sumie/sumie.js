// Inchiostro sumi-e — il paesaggio è reso in due buffer (densità d'inchiostro + normali/profondità);
// il passaggio finale lo stende su carta di riso: aloni d'acqua, contorni a pennello di spessore
// variabile con i bordi sfrangiati dalle fibre, e, dopo l'alba, un velo d'acquerello.
// Tenendo premuto Maiusc si usa il pennello celeste.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { costruisciMondo, altezza, rng } from './sumie-mondo.js?v=6';

THREE.ColorManagement.enabled = false;
const Q = Demo.query;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Demo.shot, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'gl';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 6000);
camera.position.set(-4, 44, -62);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(4, 30, 110);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 120; controls.maxDistance = 210;
controls.minPolarAngle = Math.PI * 0.42; controls.maxPolarAngle = Math.PI * 0.53;
controls.minAzimuthAngle = Math.PI - 0.55; controls.maxAzimuthAngle = Math.PI + 0.55;
controls.rotateSpeed = 0.45;
if (Q.get('cam') === '2') camera.position.set(-60, 22, -30);
controls.update();

// ── Luce ──
const sole = new THREE.DirectionalLight(0xffffff, Math.PI);
const DIR0 = new THREE.Vector3(0.55, 0.62, -0.35).normalize();
const dirSole = DIR0.clone();
sole.castShadow = true;
sole.shadow.mapSize.set(2048, 2048);
Object.assign(sole.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 600 });
sole.shadow.bias = -0.0008; sole.shadow.normalBias = 0.3; sole.shadow.radius = 3;
sole.target.position.set(0, 0, 50);
scene.add(sole, sole.target);

const hex = h => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);

// ── Materiali: quanto inchiostro in ombra e in luce, e la tinta d'acquerello che appare all'alba ──
const TAV = {
  terreno:  { ink: [0.13, 0.0], tinta: 0xc2bb86, cun: 0.2, punti: 1, fade: [150, 450], oriz: [230, 360] },
  acqua:    { ink: [0.0, 0.0], tinta: 0x9dc3cf, acqua: 1, fade: [150, 300], oriz: [230, 360] },
  monte:    { ink: [0.72, 0.16], tinta: 0x8aa3ab, cun: 1.2, cunS: 0.18, nebbia: 1, bordo: 1, fade: [250, 620] },
  roccia:   { ink: [0.8, 0.12], tinta: 0x9a968a, cun: 1, punti: 1, fade: [150, 500] },
  tronco:   { ink: [0.95, 0.55], tinta: 0x6e5a48, cun: 0.6 },
  aghi:     { ink: [1.0, 0.72], tinta: 0x4d7448, cun: 0.5 },
  bambu:    { ink: [0.36, 0.06], tinta: 0x86a85c, peso: 0.45 },
  nodo:     { ink: [1.0, 0.9], tinta: 0x4f6a3a },
  foglia:   { ink: [1.0, 0.82], tinta: 0x5b8f45, lati: THREE.DoubleSide },
  secco:    { ink: [0.92, 0.5], tinta: 0x5f4b3e, cun: 0.5 },
  legno:    { ink: [0.8, 0.35], tinta: 0x6d5646 },
  vermiglio:{ ink: [0.08, 0.0], tinta: 0xd63b24, colore: 1 },
  fiore:    { ink: [0.02, 0.0], tinta: 0xf4a3b6, colore: 1, lati: THREE.DoubleSide },
};
const U = { uT: { value: 0 }, uNotte: { value: 1 } };
const cache = {};
const IDS = Object.keys(TAV);
function M(nome) {
  if (cache[nome]) return cache[nome];
  const o = TAV[nome];
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: o.lati || THREE.FrontSide });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, {
      uInk: { value: new THREE.Vector2(...o.ink) }, uTinta: { value: hex(o.tinta) },
      uCun: { value: o.cun || 0 }, uNeb: { value: o.nebbia || 0 }, uCol: { value: o.colore || 0 },
      uAcqua: { value: o.acqua || 0 }, uPunti: { value: o.punti || 0 }, uBordo: { value: o.bordo || 0 },
      uId: { value: (IDS.indexOf(nome) + 1) / 32 }, uCunS: { value: o.cunS || 1 }, uPeso: { value: o.peso || 1 }, uOriz: { value: new THREE.Vector2(...(o.oriz || [1e5, 2e5])) }, uFade: { value: new THREE.Vector2(...(o.fade || [200, 700])) },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMondo;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wpM = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpM = instanceMatrix * wpM;
        #endif
        vMondo = (modelMatrix * wpM).xyz;`);
    sh.fragmentShader = 'layout(location = 1) out highp vec4 gInfo;\nlayout(location = 2) out highp vec4 gExtra;\n' + sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vMondo;
        uniform vec2 uInk, uFade; uniform vec3 uTinta; uniform float uCun, uNeb, uCol, uAcqua, uT, uNotte, uPunti, uBordo, uId, uCunS, uPeso; uniform vec2 uOriz;
        float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vno(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hs(i), hs(i+vec2(1,0)), f.x), mix(hs(i+vec2(0,1)), hs(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ return 0.5*vno(p) + 0.25*vno(p*2.1) + 0.125*vno(p*4.3) + 0.125*vno(p*8.7); }`)
      .replace('#include <opaque_fragment>', `
        float luce = reflectedLight.directDiffuse.g;
        float l = smoothstep(0.04, 0.8, luce);
        float tono = mix(uInk.x, uInk.y, l);
        vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        // "cun": colpi di pennello a fibra di canapa, verticali lungo il pendio
        if (uCun > 0.0) {
          // triplanare: sulle pareti che guardano verso x si usa z, su quelle verso z si usa x
          float wx = abs(nW.x), wz = abs(nW.z); float ws = wx + wz + 1e-4; wx /= ws; wz /= ws;
          float yy = vMondo.y * uCunS;
          float lod = clamp(fwidth(vMondo.x * 1.1 * uCunS + vMondo.z * 1.1 * uCunS) * 1.5, 0.0, 1.0);
          float st = wx * fbm(vec2(vMondo.z * 0.35 * uCunS, yy * 0.03)) + wz * fbm(vec2(vMondo.x * 0.35 * uCunS, yy * 0.03));
          float st2 = wx * vno(vec2(vMondo.z * 1.2 * uCunS + 7.0, yy * 0.07)) + wz * vno(vec2(vMondo.x * 1.2 * uCunS + 7.0, yy * 0.07));
          st2 = mix(st2, 0.5, lod);
          float fib = smoothstep(0.5, 0.7, st) * 0.7 + smoothstep(0.58, 0.78, st2) * 0.55;
          fib *= 1.0 - abs(nW.y) * 0.6;
          tono += uCun * (fib * 0.5 - 0.1) * (1.0 - l * 0.4);
          tono *= 0.75 + 0.5 * vno(vMondo.xz * 0.04 * uCunS + vMondo.y * 0.02 * uCunS);
        }
        // "dian": puntini d'inchiostro sui dossi e sulle creste
        if (uPunti > 0.0) {
          float sc = uNeb > 0.0 ? 4.0 : 1.6;
          vec3 pp = vMondo / sc;
          vec2 cel = floor(pp.xz + pp.y * 0.7);
          vec2 f = fract(pp.xz + pp.y * 0.7) - 0.5 - (vec2(hs(cel), hs(cel + 3.1)) - 0.5) * 0.6;
          float quale = step(0.7, hs(cel * 1.7)) * smoothstep(0.45, 0.7, fbm(vMondo.xz * 0.02)) * (1.0 - smoothstep(0.08, 0.2, fwidth(pp.x)));
          float rp = 0.13 + 0.1 * hs(cel + 9.0);
          float pd = (1.0 - smoothstep(rp * 0.7, rp, length(f))) * quale * smoothstep(0.3, 0.7, nW.y + 0.3);
          tono = max(tono, pd * 0.85);
        }
        // nebbia fra i monti: la base dei picchi si scioglie nella carta
        float peso = 1.0;
        if (uBordo > 0.0) tono += 0.55 * pow(1.0 - abs(normal.z), 2.5);   // l'inchiostro si addensa verso il contorno
        if (uNeb > 0.0) {
          float n = fbm(vec2(vMondo.x * 0.004 + uT * 0.004, vMondo.y * 0.01));
          float m = smoothstep(-10.0, 85.0, vMondo.y + (n - 0.5) * 70.0);
          tono *= m; peso *= m;
          tono = mix(tono, min(1.0, tono * 1.35 + 0.1), smoothstep(0.55, 1.0, vMondo.y / 330.0));
        }
        // acqua: bianca, con qualche riga orizzontale di corrente
        if (uAcqua > 0.0) {
          float r = vno(vec2(vMondo.x * 0.12, vMondo.z * 1.6 + uT * 0.5));
          float r2 = vno(vec2(vMondo.x * 0.08, vMondo.z * 0.9 - uT * 0.3));
          tono = 0.16 + smoothstep(0.8, 0.92, r2) * 0.35 - smoothstep(0.7, 0.85, r) * 0.14;
        }
        float dist = length(vMondo - cameraPosition);
        float dis = exp(-max(0.0, dist - uFade.x) / uFade.y);
        float oz = 1.0 - smoothstep(uOriz.x, uOriz.y, dist);
        tono *= dis * oz; peso *= uCol > 0.5 ? 0.45 : dis * oz;
        tono *= mix(1.0, 1.12, uNotte);
        gl_FragColor = vec4(uTinta, clamp(tono, 0.0, 1.0));
        gInfo = vec4(normalize(normal) * (uCol > 0.5 ? 0.5 : 1.0), vViewPosition.z);
        gExtra = vec4(peso * uPeso, uId, 0.0, 1.0);`);
  };
  m.customProgramCacheKey = () => 'sumi-' + nome;
  cache[nome] = m;
  return m;
}

Demo.carica('Macino l\'inchiostro', 0.2);
const mondo = costruisciMondo(scene, M);

// petali che cadono dagli alberi fioriti
const NPET = 320;
const petaloGeo = new THREE.CircleGeometry(0.16, 7); petaloGeo.scale(1, 0.62, 1);
const petali = new THREE.InstancedMesh(petaloGeo, M('fiore'), NPET);
petali.frustumCulled = false; scene.add(petali);
const petaliD = Array.from({ length: NPET }, () => ({ vivo: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), eta: 0 }));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _z = new THREE.Matrix4().makeScale(0, 0, 0);
const rnd = rng(77);

// ── Carta di riso: macchie e fibre, generate una volta ──
function cartaDiRiso() {
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, N, N);
  const r = rng(3);
  // velature larghe
  for (let i = 0; i < 260; i++) {
    const px = r() * N, py = r() * N, rad = 30 + r() * 160;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    const v = r() < 0.5 ? 255 : 0;
    g.addColorStop(0, `rgba(${v},${v},${v},${0.035 + r() * 0.04})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    x.fillStyle = g;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { x.save(); x.translate(ox, oy); x.fillRect(px - rad, py - rad, rad * 2, rad * 2); x.restore(); }
  }
  // fibre
  for (let i = 0; i < 4200; i++) {
    const px = r() * N, py = r() * N, L = 8 + Math.pow(r(), 2) * 140, a = r() * Math.PI * 2;
    const chiara = r() < 0.6;
    x.strokeStyle = chiara ? `rgba(255,255,255,${0.1 + r() * 0.25})` : `rgba(40,30,20,${0.05 + r() * 0.12})`;
    x.lineWidth = 0.4 + r() * (chiara ? 1.4 : 0.8);
    x.beginPath();
    let qx = px, qy = py, aa = a;
    x.moveTo(qx, qy);
    for (let k = 0; k < 6; k++) { aa += (r() - 0.5) * 0.7; qx += Math.cos(aa) * L / 6; qy += Math.sin(aa) * L / 6; x.lineTo(qx, qy); }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
const carta = cartaDiRiso();

// ── Post: inchiostro su carta ──
const rt = new THREE.WebGLRenderTarget(1, 1, { count: 3, type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const post = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
  uniforms: {
    tA: { value: null }, tI: { value: null }, tE: { value: null }, tCarta: { value: carta },
    uRes: { value: new THREE.Vector2() }, uR: { value: 1 }, uT: U.uT, uAcq: { value: 0 }, uPenn: { value: 0 },
    uProjInv: { value: new THREE.Matrix4() }, uCamM: { value: new THREE.Matrix4() },
    uSole: { value: new THREE.Vector3(-999, -999, 0) }, uSoleA: { value: 0 },
    uCarta: { value: hex(0xefe5cf) }, uInk: { value: hex(0x1b1714) },
  },
  vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `precision highp float; out vec4 oCol;
    uniform sampler2D tA, tI, tE, tCarta; uniform vec2 uRes; uniform float uR, uT, uAcq, uPenn, uSoleA;
    uniform mat4 uProjInv, uCamM; uniform vec3 uSole, uCarta, uInk;
    vec4 A(ivec2 p){ return texelFetch(tA, clamp(p, ivec2(0), ivec2(uRes) - 1), 0); }
    vec4 I(ivec2 p){ vec4 v = texelFetch(tI, clamp(p, ivec2(0), ivec2(uRes) - 1), 0); if (v.w <= 0.0) v = vec4(0.0, 0.0, 1.0, 1e6); return v; }
    float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vno(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hs(i), hs(i+vec2(1,0)), f.x), mix(hs(i+vec2(0,1)), hs(i+vec2(1,1)), f.x), f.y); }
    float E(ivec2 p){ return texelFetch(tE, clamp(p, ivec2(0), ivec2(uRes) - 1), 0).r; }
    float ID(ivec2 p){ return texelFetch(tE, clamp(p, ivec2(0), ivec2(uRes) - 1), 0).g; }
    float bordo(ivec2 p, ivec2 o, vec4 c){
      vec4 a = I(p + o), b = I(p - o);
      // il contorno lo decide la superficie più vicina: se è nella nebbia, il tratto svanisce
      float pw = E(p); float dm = c.w;
      if (a.w < dm) { dm = a.w; pw = E(p + o); }
      if (b.w < dm) { dm = b.w; pw = E(p - o); }
      float ia = 1.0 / a.w, ib = 1.0 / b.w, ic = 1.0 / c.w;
      float lap = abs(ia + ib - 2.0 * ic) / max(max(ia, ib), ic);
      float e = smoothstep(0.06, 0.2, lap);
      float nd = 1.0 - min(dot(normalize(a.xyz), normalize(c.xyz)), dot(normalize(b.xyz), normalize(c.xyz)));
      float ic2 = ID(p), dId = (abs(ID(p + o) - ic2) > 0.001 || abs(ID(p - o) - ic2) > 0.001) ? 0.85 : 0.0;
      return max(max(e, dId * step(c.w, 9e5)), smoothstep(0.35, 0.6, nd) * step(c.w, 9e5) * 0.8) * pw;
    }
    vec3 mondo(vec2 fc, float d){
      vec2 ndc = fc / uRes * 2.0 - 1.0;
      vec4 v = uProjInv * vec4(ndc, 1.0, 1.0); v.xyz /= v.w;
      vec3 vp = v.xyz / -v.z * d;
      return (uCamM * vec4(vp, 1.0)).xyz;
    }
    void main(){
      vec2 fc = gl_FragCoord.xy;
      ivec2 p = ivec2(fc);
      vec4 a = A(p), c = I(p);
      bool cielo = c.w > 9e5;
      vec3 cartaT = texture(tCarta, fc / 1024.0).rgb;
      float fib = cartaT.r - 0.5;                 // fibre e velature, attorno a zero
      float fib2 = texture(tCarta, fc / 700.0 + 0.37).r - 0.5;

      // aloni: il pigmento si accumula al bordo delle velature
      float tono = a.a, med = 0.0; vec3 tMed = vec3(0.0);
      float rw = 4.0 * uR;
      for (int i = 0; i < 8; i++) {
        float an = float(i) * 0.785398;
        vec4 s = A(p + ivec2(vec2(cos(an), sin(an)) * rw));
        med += s.a; tMed += s.rgb;
      }
      med /= 8.0; tMed /= 8.0;
      tono += max(0.0, tono - med) * 1.3;
      tono *= 0.9 + 0.3 * fib;                  // la carta beve l'inchiostro in modo irregolare
      tono = clamp(tono, 0.0, 1.0);

      // contorni a pennello: spessore che cambia lungo il tratto e con la vicinanza
      vec3 w = mondo(fc, min(c.w, 4000.0));
      float nz = vno(w.xz * 0.22 + w.y * 0.17);
      float prox = clamp(70.0 / c.w, 0.35, 1.6);
      float r = uR * (0.45 + 1.5 * nz) * prox;
      int ri = int(max(1.0, r + 0.5)), rh = max(1, ri / 2);
      float e = 0.0;
      e = max(e, bordo(p, ivec2(ri, 0), c)); e = max(e, bordo(p, ivec2(0, ri), c));
      e = max(e, bordo(p, ivec2(ri, ri), c)); e = max(e, bordo(p, ivec2(ri, -ri), c));
      e = max(e, bordo(p, ivec2(rh, 0), c)); e = max(e, bordo(p, ivec2(0, rh), c));
      // pennello asciutto: le fibre della carta lasciano buchi nel tratto
      float cop = smoothstep(0.3, 0.7, e + fib * 1.1 + fib2 * 0.6);
      float lontano = smoothstep(120.0, 1100.0, c.w);
      float inkE = cop * mix(1.0, 0.55, lontano);

      float ink = 1.0 - (1.0 - tono) * (1.0 - inkE);
      vec3 cartaC = uCarta * (0.95 + 0.16 * fib) ;
      vec3 col = mix(cartaC, uInk, ink * 0.94);

      // acquerello: velo di colore dopo l'alba, che sborda un po' oltre le forme
      bool colorato = !cielo && length(c.xyz) < 0.75;
      vec3 tinta = mix(a.rgb, tMed, 0.5);
      if (cielo) {
        float ds = length(fc - uSole.xy) / uRes.y;
        tinta = mix(vec3(1.0, 0.86, 0.7), vec3(0.83, 0.9, 0.95), smoothstep(0.05, 0.7, ds));
      }
      float vel = uAcq * (0.25 + 0.55 * smoothstep(0.3, 0.8, vno(fc / 140.0) * 0.7 + vno(fc / 37.0) * 0.3)) * (1.0 - ink * 0.6);
      col *= mix(vec3(1.0), tinta, vel * 0.5);
      if (colorato) col = mix(col, mix(a.rgb * (0.9 + 0.2 * fib), uInk, inkE), 0.92);

      // il sole disegnato: disco vermiglio, dietro ai monti
      if (uSoleA > 0.0) {
        float d = length(fc - uSole.xy) / uSole.z;
        d += (vno(fc / 9.0) - 0.5) * 0.06 + fib * 0.05;
        float disco = (1.0 - smoothstep(0.96, 1.0, d)) * uSoleA;
        float alone = exp(-max(0.0, d - 1.0) * 2.2) * 0.22 * uSoleA;
        float vis = cielo ? 1.0 : smoothstep(500.0, 1200.0, c.w) * 0.8;
        col = mix(col, vec3(0.86, 0.23, 0.14) * (0.95 + 0.1 * fib), disco * vis * 0.95);
        col = mix(col, vec3(0.95, 0.55, 0.4), alone * vis * (1.0 - disco));
      }

      // pennello celeste: il mondo si ferma e ingiallisce, come una vecchia pergamena
      if (uPenn > 0.0) {
        float lum = dot(col, vec3(0.3, 0.55, 0.15));
        vec3 sep = vec3(lum) * vec3(1.02, 0.88, 0.62) + vec3(0.06, 0.03, -0.02);
        vec2 q = fc / uRes - 0.5;
        sep *= 1.0 - dot(q, q) * 0.55;
        col = mix(col, sep, uPenn);
      }
      // bordo della carta appena più scuro
      vec2 q = fc / uRes - 0.5;
      col *= 1.0 - pow(max(abs(q.x), abs(q.y)) * 2.0, 8.0) * 0.12;
      oCol = vec4(col, 1.0);
    }`,
});
const fq = new FullScreenQuad(post);

// ── Sovrapposizioni: il tratto del pennello e l'iscrizione col sigillo ──
const trattoC = document.createElement('canvas'); trattoC.id = 'tratto';
document.body.insertBefore(trattoC, renderer.domElement.nextSibling);
const tx = trattoC.getContext('2d');
let tratto = [], disegna = false, wS = 0, tempo = 0, percorso = 0;
const iscr = document.createElement('canvas'); iscr.id = 'iscrizione';
document.body.insertBefore(iscr, trattoC.nextSibling);
function disegnaIscrizione() {
  const H = Math.round(innerHeight * 0.40 * devicePixelRatio), W = Math.round(H * 0.3);
  iscr.width = W; iscr.height = H; iscr.style.height = '40vh';
  const x = iscr.getContext('2d');
  const r = rng(9);
  const fs = W * 0.62;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const car = ['山', '水', '清', '音'];
  // calligrafia: il carattere ripassato più volte con piccoli scarti, come un pennello carico
  car.forEach((ch, i) => {
    const cy = fs * 0.62 + i * fs * 1.08;
    for (let k = 0; k < 7; k++) {
      x.fillStyle = `rgba(24,20,18,${0.18 + r() * 0.12})`;
      x.font = `${fs * (0.97 + r() * 0.06)}px SimSun, "MS Mincho", serif`;
      x.fillText(ch, W / 2 + (r() - 0.5) * fs * 0.05, cy + (r() - 0.5) * fs * 0.05);
    }
  });
  // sigillo vermiglio con i caratteri intagliati in bianco
  const S = W * 0.62, sx = (W - S) / 2, sy = fs * 0.62 + 4 * fs * 1.08 - fs * 0.2;
  x.fillStyle = '#c8321f';
  x.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, lato = Math.floor(t * 4), u = (t * 4) % 1;
    const j = (r() - 0.5) * S * 0.035;
    const P = [[sx + u * S, sy + j], [sx + S + j, sy + u * S], [sx + S - u * S, sy + S + j], [sx + j, sy + S - u * S]][lato % 4];
    i ? x.lineTo(...P) : x.moveTo(...P);
  }
  x.fill();
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = '#000';
  x.font = `bold ${S * 0.42}px SimSun, serif`;
  x.fillText('墨', sx + S * 0.28, sy + S * 0.3); x.fillText('絵', sx + S * 0.28, sy + S * 0.72);
  x.fillText('天', sx + S * 0.72, sy + S * 0.3); x.fillText('筆', sx + S * 0.72, sy + S * 0.72);
  for (let i = 0; i < 160; i++) { x.globalAlpha = 0.25 + r() * 0.5; x.fillRect(sx + r() * S, sy + r() * S, 1 + r() * 2, 1 + r() * 2); }
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
}

function ridimensiona() {
  const pr = renderer.getPixelRatio();
  renderer.setSize(innerWidth, innerHeight);
  const w = Math.floor(innerWidth * pr), h = Math.floor(innerHeight * pr);
  rt.setSize(w, h);
  post.uniforms.uRes.value.set(w, h);
  post.uniforms.uR.value = Math.max(1, h / 540) * 1.6;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const vw = trattoC.width, vh = trattoC.height;
  trattoC.width = Math.floor(innerWidth * devicePixelRatio); trattoC.height = Math.floor(innerHeight * devicePixelRatio);
  // ridimensionare svuota la tela: se c'era un tratto in corso lo si ridisegna
  if (typeof tratto !== 'undefined' && tratto.length > 1 && (vw !== trattoC.width || vh !== trattoC.height) && trattoC.style.opacity !== '0') {
    const vecchio = tratto; tratto = [vecchio[0]]; wS = 0; percorso = 0;
    for (let i = 1; i < vecchio.length; i++) { pennellata(tratto[tratto.length - 1], vecchio[i]); tratto.push(vecchio[i]); }
  }
  disegnaIscrizione();
}
addEventListener('resize', ridimensiona);
ridimensiona();

// ── Il pennello celeste ──
const stato = { penn: 0, acq: 0, soleA: 0, soleDir: null, soleR: 0, notte: 1 };
const cv = renderer.domElement;
const dpr = () => devicePixelRatio;
const maiusc = e => (e && e.shiftKey) || Demo.giu('Shift');

function pennellata(p0, p1) {
  // corpo del tratto: un trapezio per segmento, più largo quando si va piano;
  // poi le setole asciutte scavano fili di carta dentro al tratto, sempre di più man mano che il pennello si scarica
  const dx = p1.x - p0.x, dy = p1.y - p0.y, L = Math.hypot(dx, dy);
  if (L < 0.01) return;
  const vel = L / Math.max(1 / 120, p1.t - p0.t);
  const base = 12 * dpr() * Math.max(0.6, innerHeight / 900);
  const wT = base * THREE.MathUtils.clamp(1.3 - vel / (2600 * dpr()), 0.3, 1.3);
  const w0 = wS || wT * 0.3;
  wS += (wT - wS) * Math.min(1, L / (60 * dpr()));
  const lung = Math.min(1, tratto.length / 8);
  const w1 = wS * (0.3 + 0.7 * lung);
  percorso += L;
  const carico = Math.max(0.2, 1 - percorso / (1100 * dpr()));
  const nx = -dy / L, ny = dx / L;
  tx.globalCompositeOperation = 'source-over';
  tx.fillStyle = `rgba(16,12,10,${0.55 + 0.4 * carico})`;
  tx.beginPath();
  tx.moveTo(p0.x + nx * w0, p0.y + ny * w0); tx.lineTo(p1.x + nx * w1, p1.y + ny * w1);
  tx.lineTo(p1.x - nx * w1, p1.y - ny * w1); tx.lineTo(p0.x - nx * w0, p0.y - ny * w0);
  tx.closePath(); tx.fill();
  tx.beginPath(); tx.arc(p1.x, p1.y, w1 * 0.98, 0, Math.PI * 2); tx.fill();
  // setole asciutte
  tx.globalCompositeOperation = 'destination-out';
  tx.lineWidth = 1.1 * dpr();
  for (let k = 0; k < 11; k++) {
    const seme = Math.sin(k * 12.9898 + 4.1) * 43758.5453, f = seme - Math.floor(seme);
    const soglia = carico * 1.25 - 0.2;
    if (f < soglia) continue;
    const o = (k / 10 - 0.5) * 1.8;
    tx.strokeStyle = `rgba(0,0,0,${Math.min(0.9, (f - soglia) * 2.5)})`;
    tx.beginPath(); tx.moveTo(p0.x + nx * w0 * o, p0.y + ny * w0 * o); tx.lineTo(p1.x + nx * w1 * o, p1.y + ny * w1 * o); tx.stroke();
  }
  tx.globalCompositeOperation = 'source-over';
}
function puntoDa(e) { return { x: e.clientX * dpr(), y: e.clientY * dpr(), t: tempo }; }
cv.addEventListener('pointerdown', e => {
  if (!maiusc(e)) return;
  disegna = true; tratto = [puntoDa(e)]; wS = 0; percorso = 0;
  trattoC.style.transition = 'none'; trattoC.style.opacity = 1; tx.clearRect(0, 0, trattoC.width, trattoC.height);
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (!disegna) return;
  const p = puntoDa(e); p.t = performance.now() / 1000;  // solo per la velocità del tratto
  const q = tratto[tratto.length - 1];
  if (Math.hypot(p.x - q.x, p.y - q.y) < 2) return;
  if (q.t === tempo && tratto.length === 1) q.t = p.t - 0.016;
  pennellata(q, p); tratto.push(p);
});
const fine = () => { if (!disegna) return; disegna = false; valuta(tratto); };
cv.addEventListener('pointerup', fine);
addEventListener('keyup', e => { if (e.key === 'Shift') { fine(); sbiadisci(); } });
function sbiadisci() { trattoC.style.transition = 'opacity .9s'; trattoC.style.opacity = 0; }

const ray = new THREE.Raycaster();
function aSchermo(v) { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * innerWidth * dpr(), y: (-p.y * 0.5 + 0.5) * innerHeight * dpr(), z: p.z }; }
function pxPerRad() { return (innerHeight * dpr() / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); }

function valuta(pts) {
  if (pts.length < 6) return;
  // cerchio? baricentro, raggio medio, dispersione e giro compiuto attorno al centro
  let cx = 0, cy = 0; for (const p of pts) { cx += p.x; cy += p.y; } cx /= pts.length; cy /= pts.length;
  const rs = pts.map(p => Math.hypot(p.x - cx, p.y - cy));
  const rm = rs.reduce((a, b) => a + b, 0) / rs.length;
  const sd = Math.sqrt(rs.reduce((a, b) => a + (b - rm) ** 2, 0) / rs.length) / (rm || 1);
  let giro = 0;
  for (let i = 1; i < pts.length; i++) {
    let d = Math.atan2(pts[i].y - cy, pts[i].x - cx) - Math.atan2(pts[i - 1].y - cy, pts[i - 1].x - cx);
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    giro += d;
  }
  const cerchio = sd < 0.32 && Math.abs(giro) > Math.PI * 1.6 && rm > 18 * dpr();
  if (cerchio) {
    const ndc = new THREE.Vector2(cx / (innerWidth * dpr()) * 2 - 1, -(cy / (innerHeight * dpr())) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(mondo.solidi, false)[0];
    if (!hit && ray.ray.direction.y > -0.02) { sorgeIlSole(ray.ray.direction.clone(), rm / pxPerRad()); return 'sole'; }
  }
  // una linea che attraversa un albero secco lo fa fiorire
  let fatto = null;
  for (const al of mondo.alberi) {
    if (al.fiorito) continue;
    const c = aSchermo(al.centro);
    if (c.z > 1) continue;
    const rPx = al.raggio / camera.position.distanceTo(al.centro) * pxPerRad();
    if (pts.some(p => Math.hypot(p.x - c.x, p.y - c.y) < rPx)) { al.fiorito = true; fatto = 'fiore'; }
  }
  return fatto;
}
function sorgeIlSole(dir, angR) {
  stato.soleDir = dir; stato.soleR = THREE.MathUtils.clamp(angR, 0.025, 0.12);
}

// prove automatiche per le foto: ?prova=cerchio | albero | tutto | pennello
function simulaTratto(punti) {
  tratto = []; percorso = 0; wS = 0;
  for (let i = 0; i < punti.length; i++) {
    const p = { x: punti[i][0], y: punti[i][1], t: i * 0.012 };
    if (i) pennellata(tratto[tratto.length - 1], p);
    tratto.push(p);
  }
}
function prova(tipo, fase) {
  const W = innerWidth * dpr(), H = innerHeight * dpr();
  if (tipo === 'cerchio' || tipo === 'tutto' || tipo === 'pennello') {
    const pts = []; const cx = W * 0.64, cy = H * 0.13, R = H * 0.065;
    for (let i = 0; i <= 64; i++) { const a = i / 60 * Math.PI * 2 - 1; pts.push([cx + Math.cos(a) * R * (1 + 0.05 * Math.sin(i)), cy + Math.sin(a) * R]); }
    simulaTratto(pts);
    if (tipo !== 'pennello') valuta(tratto);
  }
  if (tipo === 'albero' || tipo === 'tutto') {
    for (const al of mondo.alberi) {
      const c = aSchermo(al.centro);
      const pts = []; for (let i = 0; i <= 30; i++) pts.push([c.x - 60 + i * 4, c.y + 30 - i * 2]);
      simulaTratto(pts); valuta(tratto);
    }
  }
  if (tipo !== 'pennello') { tx.clearRect(0, 0, trattoC.width, trattoC.height); }
}
const PROVA = Q.get('prova');
let provato = false;

// ── Ciclo ──
const _v = new THREE.Vector3();
function aggiorna(dt, t) {
  const inPenn = Demo.giu('Shift') || PROVA === 'pennello';
  stato.penn += ((inPenn ? 1 : 0) - stato.penn) * Math.min(1, dt * 10);
  controls.enabled = !inPenn;
  if (!inPenn) tempo += dt;      // col pennello in mano il mondo si ferma
  const tt = tempo;
  U.uT.value = tt;

  if (PROVA && !provato && t > 0.2) { provato = true; prova(PROVA); }

  // alba
  if (stato.soleDir) {
    stato.soleA = Math.min(1, stato.soleA + dt * 0.8);
    stato.acq = Math.min(1, stato.acq + dt * 0.45);
    const target = stato.soleDir.clone(); target.y = Math.max(target.y, 0.35); target.normalize();
    dirSole.lerp(target, Math.min(1, dt * 0.8)).normalize();
  }
  U.uNotte.value = 1 - stato.acq;
  sole.position.copy(sole.target.position).addScaledVector(dirSole, 300);

  // bambù al vento
  if (!inPenn) for (const b of mondo.bambu) {
    b.g.rotation.x = b.rx + Math.sin(tt * 1.1 + b.fase) * b.amp;
    b.g.rotation.z = b.rz + Math.sin(tt * 0.83 + b.fase * 1.7) * b.amp * 0.8;
  }

  // fioriture e petali
  for (const al of mondo.alberi) {
    if (!al.fiorito || al.fiore >= 1.6) continue;
    al.fiore = Math.min(1.6, al.fiore + dt * 0.7);
    al.dati.forEach((d, i) => {
      const k = THREE.MathUtils.smoothstep(al.fiore, d.ritardo, d.ritardo + 0.45);
      _s.setScalar(d.s * k * (1 + 0.25 * Math.sin(k * Math.PI)));
      _m.compose(d.p, d.q, _s); al.fiori.setMatrixAt(i, _m);
    });
    al.fiori.instanceMatrix.needsUpdate = true;
  }
  if (!inPenn) {
    for (const al of mondo.alberi) {
      if (!al.fiorito || al.fiore < 0.5 || dt <= 0) continue;
      if (rnd() < dt * 9) {
        const d = petaliD.find(p => !p.vivo); if (!d) break;
        const pt = al.punte[Math.floor(rnd() * al.punte.length)].p;
        d.vivo = true; d.eta = 0; d.p.copy(pt); d.v.set(0.6 + rnd() * 0.8, -0.3, (rnd() - 0.5) * 0.6);
        d.r.set(rnd() * 6, rnd() * 6, rnd() * 6); d.w.set(rnd() * 3, rnd() * 3, rnd() * 3);
      }
    }
    petaliD.forEach((d, i) => {
      if (!d.vivo) { petali.setMatrixAt(i, _z); return; }
      d.eta += dt;
      d.v.y = Math.max(-0.9, d.v.y - dt * 0.4);
      d.p.x += (d.v.x + Math.sin(tt * 1.7 + i) * 0.5) * dt; d.p.y += d.v.y * dt; d.p.z += (d.v.z + Math.cos(tt * 1.3 + i) * 0.4) * dt;
      d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; d.r.z += d.w.z * dt;
      if (d.p.y < altezza(d.p.x, d.p.z) + 0.05 || d.eta > 12) d.vivo = false;
      _q.setFromEuler(d.r); _s.setScalar(d.vivo ? 1 : 0);
      _m.compose(d.p, _q, _s); petali.setMatrixAt(i, _m);
    });
    petali.instanceMatrix.needsUpdate = true;
  }
  controls.update();
  document.body.classList.toggle('pennello', inPenn);
}

function rendi() {
  camera.updateMatrixWorld();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  const u = post.uniforms;
  u.tA.value = rt.textures[0]; u.tI.value = rt.textures[1]; u.tE.value = rt.textures[2];
  u.uProjInv.value.copy(camera.projectionMatrixInverse);
  u.uCamM.value.copy(camera.matrixWorld);
  u.uAcq.value = stato.acq; u.uPenn.value = stato.penn; u.uSoleA.value = stato.soleA;
  if (stato.soleDir) {
    const pr = renderer.getPixelRatio();
    const p = _v.copy(camera.position).addScaledVector(stato.soleDir, 3000).project(camera);
    const r = stato.soleR * (rt.height / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    u.uSole.value.set((p.x * 0.5 + 0.5) * rt.width, (p.y * 0.5 + 0.5) * rt.height, p.z < 1 ? r : 0);
    void pr;
  }
  u.uCarta.value.copy(hex(0xe9e0cb)).lerp(hex(0xf3e9d3), stato.acq);
  renderer.setRenderTarget(null);
  fq.render(renderer);
}

Demo.extra('<p>Il cerchio va tracciato nel cielo, in un solo gesto: il sole sorge dove l\'hai disegnato. Una linea che attraversa uno dei tre alberi secchi (sulle due rive e in primo piano) lo fa fiorire.</p>');
Demo.carica('Stendo la carta', 0.9);
aggiorna(0, 0); rendi();
Demo.loop((dt, t) => { aggiorna(dt, t); rendi(); });
Demo.pronto();
