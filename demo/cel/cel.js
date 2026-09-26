// Cel shading alla Wind Waker: isoletta tropicale nel tardo pomeriggio.
// Luce a gradini (MeshToonMaterial + gradientMap), luce di bordo iniettata nello shader,
// contorni neri a guscio rovesciato, mare piatto con ghirigori di schiuma e fascia di riva
// calcolata dalla profondità del fondale (una texture cotta dal rilievo dell'isola).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const Q = Demo.query;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: Demo.shot });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);

// ─────────────────────────── luce ───────────────────────────
// Sole basso da ovest: tardo pomeriggio, luce calda e ombre lunghe. Scelto perché nell'inquadratura
// d'apertura illumini di tre quarti la faccia del personaggio, con il mare davanti.
const DIR_SOLE = new THREE.Vector3(-0.88, 0.36, 0.30).normalize();
const sole = new THREE.DirectionalLight(0xffe4b8, 3.1);
sole.castShadow = true;
sole.shadow.mapSize.set(2048, 2048);
sole.shadow.bias = -0.0004;
sole.shadow.normalBias = 0.03;
const sc = sole.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
scene.add(sole, sole.target);
// l'ombra è un colore, non un buio: ambiente azzurro-violetto uniforme (niente sfumature)
const ambiente = new THREE.AmbientLight(0x9eaaf2, 1.8);
scene.add(ambiente);

// rampa a gradini: dotNL -1..1 → [buio, buio, mezzo, pieno]
// 16 celle su dotNL -1..1: al buio fino a 0, una banda media stretta, poi pieno (col sole basso
// anche il terreno piano deve stare nel gradino pieno)
const celle = [];
for (let i = 0; i < 16; i++) { const v = i < 8 ? 0 : i < 10 ? 125 : 255; celle.push(v, v, v, 255); }
const rampa = new THREE.DataTexture(new Uint8Array(celle), 16, 1);
rampa.minFilter = rampa.magFilter = THREE.NearestFilter; rampa.needsUpdate = true;

// uniform condivise da tutti i materiali toon
const U = {
  uSoleV: { value: new THREE.Vector3() },   // direzione del sole in spazio vista
  uBordo: { value: new THREE.Color(0xfff0c8) },
};

/** Materiale toon con luce di bordo netta e (opzionale) saturazione della texture. */
function toon(opz = {}) {
  const m = new THREE.MeshToonMaterial({ color: opz.color ?? 0xffffff, map: opz.map || null, gradientMap: rampa });
  const forza = opz.bordo ?? 0.55, sat = opz.sat ?? 1.0;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSoleV = U.uSoleV; sh.uniforms.uBordo = U.uBordo;
    sh.uniforms.uForza = { value: forza }; sh.uniforms.uSat = { value: sat };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSoleV; uniform vec3 uBordo; uniform float uForza; uniform float uSat;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        { float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = max(mix(vec3(l), diffuseColor.rgb, uSat), 0.0); }`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 V = normalize(vViewPosition);
          float fr = 1.0 - max(dot(normal, V), 0.0);
          // bordo solo sul lato che guarda il sole, e solo quando la camera è controsole
          float verso = max(dot(normal, uSoleV), 0.0) + 0.35 * max(-dot(V, uSoleV), 0.0);
          float b = step(0.56, fr) * step(0.10, verso);
          outgoingLight = mix(outgoingLight, outgoingLight * 0.35 + uBordo * 0.9, b * uForza);
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'toon' + forza + '_' + sat;
  return m;
}

// ───────────────── contorni a guscio rovesciato ─────────────────
// Le normali dei modelli a facce piatte sono spezzate agli spigoli: il guscio si aprirebbe.
// Si calcola una normale "liscia" per posizione e la si mette in un attributo a parte.
function normaliLisce(geo) {
  if (geo.getAttribute('oNormal')) return;
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  const acc = new Map(), chiavi = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.round(pos.getX(i) * 1e3) + ',' + Math.round(pos.getY(i) * 1e3) + ',' + Math.round(pos.getZ(i) * 1e3);
    chiavi[i] = k;
    let a = acc.get(k); if (!a) { a = [0, 0, 0]; acc.set(k, a); }
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(chiavi[i]); const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  geo.setAttribute('oNormal', new THREE.BufferAttribute(out, 3));
}
function materialeContorno(spessore) {
  const m = new THREE.MeshBasicMaterial({ color: 0x14100e, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSpess = { value: spessore };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 oNormal; uniform float uSpess;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(oNormal) * uSpess;');
  };
  m.customProgramCacheKey = () => 'contorno';
  return m;
}
/** Aggiunge il guscio nero a tutte le mesh sotto obj. spessore in metri del mondo. */
function contorna(obj, spessore) {
  obj.updateMatrixWorld(true);
  const lista = [];
  obj.traverse(o => { if (o.isMesh && !o.userData.contorno) lista.push(o); });
  const s = new THREE.Vector3();
  for (const o of lista) {
    normaliLisce(o.geometry);
    o.getWorldScale(s);
    const mat = materialeContorno(spessore / Math.max(1e-6, (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z)) / 3));
    let g;
    if (o.isSkinnedMesh) {
      g = new THREE.SkinnedMesh(o.geometry, mat);
      g.bind(o.skeleton, o.bindMatrix);
      g.position.copy(o.position); g.quaternion.copy(o.quaternion); g.scale.copy(o.scale);
      o.parent.add(g);
    } else {
      g = new THREE.Mesh(o.geometry, mat);
      o.add(g);
    }
    g.userData.contorno = true; g.castShadow = false; g.receiveShadow = false; g.frustumCulled = o.frustumCulled;
  }
}

// ─────────────────────────── rilievo ───────────────────────────
const perlin = new ImprovedNoise();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function raggioIsola(ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return 25 + 7.5 * perlin.noise(c * 1.2 + 5, s * 1.2 + 5, 0.5) + 3.0 * perlin.noise(c * 2.8 + 1, s * 2.8, 2.1);
}
/** Altezza del terreno (il mare è a y = 0). */
function altezza(x, z) {
  const r = Math.hypot(x, z), R = raggioIsola(Math.atan2(z, x)), s = r / R;
  let h;
  if (s < 1) {
    // pianoro erboso, gradino di terra, spiaggia che scende dolce fino all'acqua
    h = lerp(1.9, 0.62, smooth(0.57, 0.64, s));
    h = lerp(h, 0.0, smooth(0.68, 1.0, s) * 0.85 + (s > 0.68 ? (s - 0.68) / 0.32 * 0.15 : 0));
  } else {
    h = -Math.min(5.5, (s - 1) * 11);
  }
  // collina dietro alla casa
  h += 5.2 * Math.exp(-((x + 7) ** 2 + (z + 5) ** 2) / 55) * (1 - smooth(0.6, 0.8, s));
  // ondulazione leggera del pianoro
  h += 0.35 * perlin.noise(x * 0.09, 3.3, z * 0.09) * (1 - smooth(0.5, 0.7, s));
  return h;
}

const LATO = 130, SEG = 260;
const terrGeo = new THREE.PlaneGeometry(LATO, LATO, SEG, SEG); terrGeo.rotateX(-Math.PI / 2);
{
  const p = terrGeo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, altezza(p.getX(i), p.getZ(i)));
  terrGeo.computeVertexNormals();
}
// Il colore del terreno si decide nello shader per quota e pendenza: bordo netto erba/sabbia/terra.
const terrMat = toon({ bordo: 0.0 });
{
  const vecchio = terrMat.onBeforeCompile;
  terrMat.onBeforeCompile = (sh) => {
    vecchio(sh);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vWN;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        float n = vn(vWP.xz * 0.35) * 0.6 + vn(vWP.xz * 1.3) * 0.4;
        vec3 sabbia = vec3(0.98, 0.86, 0.55);
        vec3 sabbiaBagnata = vec3(0.86, 0.70, 0.42);
        vec3 erba = vec3(0.36, 0.78, 0.20);
        vec3 erbaChiara = vec3(0.55, 0.88, 0.25);
        vec3 terra = vec3(0.62, 0.40, 0.22);
        vec3 c = sabbia;
        c = mix(c, sabbiaBagnata, step(vWP.y, 0.12 + n * 0.08));
        float eh = 0.95 + (n - 0.5) * 0.35;
        vec3 e = mix(erba, erbaChiara, step(0.62, vn(vWP.xz * 0.18 + 9.0)));
        c = mix(c, e, step(eh, vWP.y));
        c = mix(c, terra, step(vWN.y, 0.80 - n * 0.08) * step(0.5, vWP.y));
        vec4 diffuseColor = vec4(c, opacity);`);
  };
  terrMat.customProgramCacheKey = () => 'terreno';
}
const terreno = new THREE.Mesh(terrGeo, terrMat);
terreno.receiveShadow = true;
scene.add(terreno);

// texture delle profondità per il mare (rilievo cotto in 256×256, 0..255 = -6..+6 m)
const NT = 256;
const profDati = new Uint8Array(NT * NT * 4);
for (let j = 0; j < NT; j++) for (let i = 0; i < NT; i++) {
  const x = (i / (NT - 1) - 0.5) * LATO, z = (j / (NT - 1) - 0.5) * LATO;
  const v = Math.max(0, Math.min(255, Math.round((altezza(x, z) + 6) / 12 * 255)));
  const k = (j * NT + i) * 4; profDati[k] = v; profDati[k + 1] = v; profDati[k + 2] = v; profDati[k + 3] = 255;
}
const profTex = new THREE.DataTexture(profDati, NT, NT);
profTex.minFilter = profTex.magFilter = THREE.LinearFilter; profTex.needsUpdate = true;

// ─────────────────────────── mare ───────────────────────────
const SIMPLEX = `
vec3 m289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;} vec2 m289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 perm(vec3 x){return m289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=m289(i);vec3 p=perm(perm(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;
vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;
m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
return 130.0*dot(m,g);}`;

const mareMat = new THREE.ShaderMaterial({
  uniforms: {
    uT: { value: 0 }, uProf: { value: profTex }, uLato: { value: LATO },
    uCam: { value: new THREE.Vector3() },
    uFondo: { value: new THREE.Color('#1646c8') }, uMedio: { value: new THREE.Color('#1f7fe0') },
    uBasso: { value: new THREE.Color('#3cc9e6') }, uOriz: { value: new THREE.Color('#9fd0f2') },
  },
  vertexShader: `
    varying vec3 vWP;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    uniform float uT, uLato; uniform sampler2D uProf; uniform vec3 uCam, uFondo, uMedio, uBasso, uOriz;
    varying vec3 vWP;
    ${SIMPLEX}
    // una curva di livello del rumore: linea sottile a larghezza costante sullo schermo
    float linea(float n, float soglia, float px){ float w = fwidth(n) * px + 1e-4; return 1.0 - smoothstep(0.0, w, abs(n - soglia)); }
    void main(){
      vec2 p = vWP.xz;
      vec2 uv = p / uLato + 0.5;
      float h = -6.0;
      if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) h = texture2D(uProf, uv).r * 12.0 - 6.0;
      float d = -h;                                   // profondità dell'acqua
      float dist = length(vWP - uCam);
      float nb = snoise(p * 0.12 + uT * 0.05) * 0.35;  // tremolio dei confini fra le fasce

      // fasce di colore nette: basso fondale turchese, medio, profondo blu saturo
      vec3 c = uFondo;
      c = mix(c, uMedio, step(d, 2.6 + nb));
      c = mix(c, uBasso, step(d, 1.05 + nb * 0.6));

      // ghirigori di schiuma al largo: curve di livello di un rumore piegato, a macchie, che si torcono piano
      vec2 q = p * 0.03;
      vec2 w = vec2(snoise(q * 1.1 + vec2(uT * 0.020, 0.0)), snoise(q * 1.1 + vec2(4.7, -uT * 0.018)));
      float n1 = snoise(q * 2.2 + w * 0.9 + vec2(0.0, uT * 0.03));
      float n2 = snoise(q * 4.0 - w * 0.7 + vec2(uT * 0.025, 3.1));
      float macchia = smoothstep(0.35, 0.6, snoise(q * 0.8 + vec2(-uT * 0.01, 1.7)));
      float macchia2 = smoothstep(0.45, 0.7, snoise(q * 1.3 + vec2(9.2, uT * 0.012)));
      float g = max(linea(n1, 0.35, 1.6) * macchia, linea(n2, -0.3, 1.3) * macchia2 * 0.9);
      g *= step(1.6, d) * (1.0 - smoothstep(45.0, 130.0, dist));
      c = mix(c, vec3(1.0), g);

      // fascia di schiuma attaccata alla riva + un'onda che si stacca e si allarga
      float riva = step(d, 0.16 + 0.07 * snoise(p * 0.5 + uT * 0.4));
      float fase = fract(uT * 0.22);
      float onda = d - (0.28 + fase * 0.9);
      float anello = (1.0 - smoothstep(0.0, 0.06 + 0.04 * fase, abs(onda))) * (1.0 - fase) * step(0.0, snoise(p * 0.35 + 7.0) + 0.35);
      float fase2 = fract(uT * 0.22 + 0.5);
      float onda2 = d - (0.28 + fase2 * 0.9);
      anello = max(anello, (1.0 - smoothstep(0.0, 0.06 + 0.04 * fase2, abs(onda2))) * (1.0 - fase2) * step(0.0, snoise(p * 0.35 - 3.0) + 0.35));
      c = mix(c, vec3(1.0), max(riva, step(0.5, anello)));

      // verso l'orizzonte il mare si schiarisce nella foschia del cielo
      c = mix(c, uOriz, smoothstep(180.0, 900.0, dist) * 0.85);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
});
const mare = new THREE.Mesh(new THREE.CircleGeometry(1400, 96), mareMat);
mare.rotation.x = -Math.PI / 2;
scene.add(mare);

// ─────────────────────────── cielo ───────────────────────────
const cielo = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uSole: { value: DIR_SOLE } },
  vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
  fragmentShader: `
    uniform vec3 uSole; varying vec3 vD;
    void main(){
      vec3 d = normalize(vD);
      float s = max(dot(d, uSole), 0.0);
      float h = d.y;
      vec3 alto = vec3(0.10, 0.36, 0.86), medio = vec3(0.32, 0.62, 0.95);
      vec3 oriz = mix(vec3(0.66, 0.84, 0.97), vec3(1.00, 0.80, 0.52), pow(s, 4.0));
      vec3 c = mix(oriz, medio, smoothstep(0.0, 0.20, h));
      c = mix(c, alto, smoothstep(0.18, 0.75, h));
      // sole piatto a disco con aloni a gradini, come un adesivo
      c = mix(c, vec3(1.0, 0.93, 0.70), step(0.9955, s) * 0.45);
      c = mix(c, vec3(1.0, 0.96, 0.80), step(0.9978, s) * 0.7);
      c = mix(c, vec3(1.0, 0.99, 0.90), step(0.99865, s));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
}));
scene.add(cielo);

// nuvole a batuffolo: sagome piatte dipinte su canvas, bianco pieno con la pancia azzurrina
function texNuvola(seme) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  let r = seme * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const bolle = [];
  const n = 6 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const x = 90 + (i / (n - 1)) * 330 + (rnd() - 0.5) * 30;
    const centro = 1 - Math.abs(i / (n - 1) - 0.5) * 2;
    const rr = 34 + centro * 50 + rnd() * 18;
    bolle.push([x, 200 - rr * 0.75 - centro * 18, rr]);
  }
  const disegna = (dy, scala, col) => {
    g.fillStyle = col; g.beginPath();
    for (const [x, y, rr] of bolle) { g.moveTo(x + rr * scala, y + dy); g.arc(x, y + dy, rr * scala, 0, Math.PI * 2); }
    g.rect(bolle[0][0], 170, bolle[n - 1][0] - bolle[0][0], 34 - (1 - scala) * 60);
    g.fill();
  };
  disegna(0, 1, '#b9c8ef');            // pancia in ombra
  disegna(-14, 0.93, '#ffffff');        // corpo illuminato
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const nuvole = [];
{
  const tex = [texNuvola(1), texNuvola(2), texNuvola(3), texNuvola(4)];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.SpriteMaterial({ map: tex[i % 4], transparent: true, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(m);
    const ang = i / 16 * Math.PI * 2 + (i % 3) * 0.13, el = 0.05 + ((i * 37) % 10) / 10 * 0.16, dist = 1500;
    const w = 330 + ((i * 53) % 7) * 45;
    sp.scale.set(w, w / 2, 1);
    sp.userData = { ang, el, dist };
    sp.renderOrder = -1;
    scene.add(sp); nuvole.push(sp);
  }
}
function posNuvole(t) {
  for (const n of nuvole) {
    const a = n.userData.ang + t * 0.004, e = n.userData.el, d = n.userData.dist;
    n.position.set(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d + 40, Math.sin(a) * Math.cos(e) * d);
  }
}

// ─────────────────────────── oggetti ───────────────────────────
const cespugli = new THREE.Group(); scene.add(cespugli);
function cespuglio(x, z, sc) {
  const g = new THREE.Group();
  const mat = toon({ color: 0x3f9c2a, bordo: 0.5 });
  const pezzi = [[0, 0.45, 0, 0.62], [0.5, 0.35, 0.15, 0.48], [-0.45, 0.33, 0.1, 0.46], [0.1, 0.32, -0.45, 0.44], [0.05, 0.85, 0.05, 0.42]];
  for (const [px, py, pz, r] of pezzi) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), mat);
    m.position.set(px, py, pz); m.castShadow = true; g.add(m);
  }
  g.position.set(x, altezza(x, z) - 0.1, z); g.scale.setScalar(sc);
  cespugli.add(g);
  contorna(g, 0.035);
}

const caricatore = new GLTFLoader();
const carica = (f) => new Promise((ok, ko) => caricatore.load('assets/' + f + '?v=7', ok, undefined, ko));
const K = 1.35;   // scala dei pezzi Kenney
const ostacoli = [];
const solidi = [];   // ciò che la camera non deve attraversare
const raggio = new THREE.Raycaster();  // cerchi {x, z, r} che il personaggio non attraversa

function puntoSullaRiva(ang, quota) {
  // cammina dal centro verso fuori finché il terreno scende sotto la quota voluta
  for (let r = 5; r < 40; r += 0.05) {
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    if (altezza(x, z) < quota) return { x, z, r };
  }
  return { x: Math.cos(ang) * 30, z: Math.sin(ang) * 30, r: 30 };
}

// pontile fatto a mano: assi di traverso un po' storte, travi sotto, pali tondi con la corda
function costruisciPontile(p0, dx, dz, L) {
  const geos = [];
  const col = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); const cc = new THREE.Color(c);
    for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const q = PONTE.quota;
  let r = 7; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const toniAsse = ['#d99a58', '#c88748', '#e3aa6a', '#bf7d40'];
  for (let s = 0.1; s < L; s += 0.38) {
    const lung = 2.3 + rnd() * 0.25;
    const g = new THREE.BoxGeometry(lung, 0.1, 0.33);
    g.rotateY((rnd() - 0.5) * 0.06); g.translate((rnd() - 0.5) * 0.15, q - 0.05, s);
    geos.push(col(g, toniAsse[Math.floor(rnd() * 4)]));
  }
  for (const lato of [-0.75, 0.75]) {
    const g = new THREE.BoxGeometry(0.18, 0.22, L); g.translate(lato, q - 0.21, L / 2); geos.push(col(g, '#8a5530'));
  }
  const pali = [];
  for (let s = 0.4; s < L + 0.1; s += 2.6) for (const lato of [-1.22, 1.22]) {
    const alto = q + 0.45 + rnd() * 0.15;
    const g = new THREE.CylinderGeometry(0.15, 0.17, alto + 3.5, 8); g.translate(lato, (alto - 3.5) / 2, s);
    pali.push(col(g, '#9a6236'));
    const corda = new THREE.TorusGeometry(0.17, 0.045, 6, 12); corda.rotateX(Math.PI / 2); corda.translate(lato, q + 0.12, s);
    pali.push(col(corda, '#e8d7a8'));
  }
  const matLegno = toon({ bordo: 0.4 }); matLegno.vertexColors = true;
  const tav = new THREE.Mesh(mergeGeometries(geos), matLegno);
  const pal = new THREE.Mesh(mergeGeometries(pali), matLegno);
  const gr = new THREE.Group(); gr.add(tav, pal);
  for (const m of [tav, pal]) { m.castShadow = true; m.receiveShadow = true; }
  gr.position.set(p0.x, 0, p0.z); gr.rotation.y = Math.atan2(dx, dz);
  scene.add(gr);
  contorna(pal, 0.03);
  contorna(tav, 0.018);
}

// casetta tonda alla Outset: muro di calce, tetto di paglia a cono, porta e finestrelle
function casetta(x, y, z, rot) {
  const g = new THREE.Group();
  const calce = toon({ color: 0xf3ead2, bordo: 0.4 }), paglia = toon({ color: 0xe6b24a, bordo: 0.5 }),
    pagliaScura = toon({ color: 0xb9802c, bordo: 0 }), legno = toon({ color: 0x7a4a26, bordo: 0 }),
    pietra = toon({ color: 0xa9a39a, bordo: 0 }), buio = toon({ color: 0x3a2a22, bordo: 0 });
  const add = (geo, mat, px, py, pz, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(2.35, 2.5, 0.45, 20), pietra, 0, 0.1, 0);
  add(new THREE.CylinderGeometry(2.1, 2.2, 2.6, 20), calce, 0, 1.55, 0);
  add(new THREE.ConeGeometry(3.05, 2.5, 20, 1, false), paglia, 0, 4.05, 0);
  add(new THREE.CylinderGeometry(3.06, 3.08, 0.22, 20, 1, true), pagliaScura, 0, 2.85, 0);
  add(new THREE.ConeGeometry(0.35, 0.8, 8), pagliaScura, 0, 5.55, 0);
  // porta ad arco
  const porta = add(new THREE.BoxGeometry(0.95, 1.55, 0.2), legno, 0, 1.05, 2.13);
  add(new THREE.CylinderGeometry(0.475, 0.475, 0.2, 12, 1, false, 0, Math.PI), legno, 0, 1.82, 2.13).rotation.set(Math.PI / 2, 0, Math.PI / 2);
  for (const a of [1.1, -1.1]) {
    const f = add(new THREE.BoxGeometry(0.55, 0.6, 0.2), buio, Math.sin(a) * 2.12, 1.9, Math.cos(a) * 2.12, a);
    add(new THREE.BoxGeometry(0.7, 0.1, 0.28), legno, Math.sin(a) * 2.16, 1.55, Math.cos(a) * 2.16, a);
  }
  g.position.set(x, y - 0.1, z); g.rotation.y = rot;
  scene.add(g); solidi.push(g);
  contorna(g, 0.035);
  void porta;
}

// scogli tondi: icosaedri deformati dal rumore, normali lisce, due o tre sassi per gruppo
const matScoglio = toon({ color: 0xb7a58f, bordo: 0.5 }), matScoglio2 = toon({ color: 0x9b8f84, bordo: 0.5 });
function scoglio(x, z, sc, seme) {
  const g = new THREE.Group();
  const n = 2 + (seme % 2);
  for (let k = 0; k < n; k++) {
    const geo = new THREE.IcosahedronGeometry(1, 3);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const d = 1 + 0.28 * perlin.noise(vx * 1.3 + seme * 3 + k, vy * 1.3, vz * 1.3 + k * 5);
      p.setXYZ(i, vx * d * 1.15, vy * d * 0.8, vz * d);
    }
    geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
    const m = new THREE.Mesh(mergeVertices(geo), k === 1 ? matScoglio2 : matScoglio);
    m.geometry.computeVertexNormals();
    const s = k === 0 ? 1 : 0.55 - k * 0.08;
    m.scale.setScalar(s);
    m.position.set(k === 0 ? 0 : Math.cos(k * 2.4 + seme) * 1.1, s * 0.35, k === 0 ? 0 : Math.sin(k * 2.4 + seme) * 1.1);
    m.rotation.y = seme + k;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  g.position.set(x, Math.max(altezza(x, z), -1.4), z); g.scale.setScalar(sc);
  scene.add(g); solidi.push(g);
  contorna(g, 0.04);
}

let personaggio, mixer, azioni = {}, azioneOra = null;
const PONTE = { ang: -1.3, quota: 0.95, inizio: null, fine: null, larg: 1.2 };

async function costruisci() {
  Demo.carica('Carico l\'isola', 0.1);
  const nomi = ['palm-bend', 'palm-detailed-bend', 'palm-detailed-straight', 'palm-straight',
    'boat-row-small', 'barrel', 'crate', 'chest'];
  const gl = {};
  let fatti = 0;
  await Promise.all(nomi.map(n => carica(n + '.glb').then(g => { gl[n] = g.scene; Demo.carica('Carico l\'isola', 0.1 + 0.6 * (++fatti / nomi.length)); })));
  const pers = await carica('personaggio.gltf');
  Demo.carica('Dipingo il mare', 0.8);

  // i modelli Kenney usano una tavolozza a texture: la si tiene, in toon e un filo più satura
  const mats = new Map();
  const toonDa = (m) => {
    if (!mats.has(m)) { const t = toon({ map: m.map, sat: 1.35, bordo: 0.45 }); if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; mats.set(m, t); }
    return mats.get(m);
  };
  const piazza = (nome, x, z, rotY = 0, sc = K, y = null, contorno = 0.04) => {
    const o = gl[nome].clone(true);
    o.traverse(m => { if (m.isMesh) { m.material = toonDa(m.material); m.castShadow = true; m.receiveShadow = true; } });
    o.position.set(x, y ?? altezza(x, z), z); o.rotation.y = rotY; o.scale.setScalar(sc);
    scene.add(o);
    if (contorno) contorna(o, contorno);
    return o;
  };

  // pontile: parte dal bordo della spiaggia e va al largo
  const a = PONTE.ang;
  const p0 = puntoSullaRiva(a, PONTE.quota);
  const dx = Math.cos(a), dz = Math.sin(a);
  const passo = 2.5 * K;
  const pezzi = 5;
  costruisciPontile(p0, dx, dz, passo * pezzi);
  PONTE.inizio = { x: p0.x, z: p0.z }; PONTE.fine = { x: p0.x + dx * passo * pezzi, z: p0.z + dz * passo * pezzi };
  PONTE.larg = 1.15;
  // barchetta legata in fondo al pontile, e due barili sul tavolato
  const barca = piazza('boat-row-small', PONTE.fine.x + dz * 2.6 - dx * 2, PONTE.fine.z - dx * 2.6 - dz * 2, -a + 0.3, K, -0.12, 0.035);
  barca.userData.galleggia = true;
  piazza('barrel', PONTE.fine.x - dx * 1.8 + dz * 0.9, PONTE.fine.z - dz * 1.8 - dx * 0.9, 0.4, 0.62, PONTE.quota, 0.03);
  piazza('crate', PONTE.fine.x - dx * 3.4 - dz * 1.0, PONTE.fine.z - dz * 3.4 + dx * 1.0, 0.2, 0.7, PONTE.quota, 0.03);

  // capanna sul pianoro, vicino all'attacco del pontile
  const cA = a + 0.42; const cp = puntoSullaRiva(cA, 1.5);
  const cx = cp.x - Math.cos(cA) * 3.2, cz = cp.z - Math.sin(cA) * 3.2;
  const hy = altezza(cx, cz);
  casetta(cx, hy, cz, Math.atan2(p0.x - cx, p0.z - cz));
  ostacoli.push({ x: cx, z: cz, r: 2.0 * K, cam: true });
  piazza('chest', cx + Math.cos(cA + 1.7) * 3.4, cz + Math.sin(cA + 1.7) * 3.4, -cA, 0.7, null, 0.03);

  // palme: sul bordo della spiaggia, piegate verso il mare
  const palme = ['palm-detailed-bend', 'palm-bend', 'palm-detailed-straight', 'palm-detailed-bend', 'palm-straight', 'palm-detailed-bend', 'palm-bend', 'palm-detailed-straight', 'palm-detailed-bend'];
  const angPalme = [0.15, 0.95, 1.35, 2.2, 2.75, 3.5, 4.2, 5.0, 5.7];
  angPalme.forEach((ang, i) => {
    const q = puntoSullaRiva(ang, 0.75 + (i % 3) * 0.25);
    const rin = 1.0 + (i % 2) * 2.5;
    const x = q.x - Math.cos(ang) * rin, z = q.z - Math.sin(ang) * rin;
    // i modelli "bend" pendono verso -x: si ruotano perché pendano verso il largo
    const rot = palme[i].includes('bend') ? -ang + Math.PI : ang * 3;
    piazza(palme[i], x, z, rot, K * (0.95 + (i % 3) * 0.14), altezza(x, z) - 0.1, 0.045);
    ostacoli.push({ x, z, r: 0.5 });
  });

  // scogli in acqua e sulla riva
  const scogli = [['rocks-a', 2.0, 1.25, 1.1], ['rocks-sand-b', 3.9, 1.1, 0.9], ['rocks-c', 4.6, 1.3, 1.2], ['rocks-b', 5.4, 1.2, 1.4], ['rocks-sand-a', 1.6, 1.0, 0.7]];
  scogli.forEach(([, ang, fuori, sc], i) => {
    const q = puntoSullaRiva(ang, 0.0);
    const x = q.x * fuori, z = q.z * fuori;
    scoglio(x, z, sc * 1.6, i);
    ostacoli.push({ x, z, r: 2.0 * sc, cam: true });
  });
  // cespugli sul pianoro
  [[-2, 6, 1.1], [3, -9, 1.3], [-12, 4, 1.0], [8, 2, 0.9], [-4, -14, 1.2], [11, -5, 1.0], [-14, -8, 1.15], [1, 12, 0.9]].forEach(([x, z, s]) => { cespuglio(x, z, s); ostacoli.push({ x, z, r: 0.8 * s }); });

  // personaggio: la tuta diventa verde Wind Waker, la pancia color panna
  personaggio = pers.scene;
  const box = new THREE.Box3().setFromObject(personaggio);
  const alt = box.max.y - box.min.y;
  personaggio.scale.setScalar(1.45 / alt);
  const colori = { Main: 0x3fa830, Main_Light: 0xf5c38a, Main2: 0xf2e6c4, White: 0xffffff, Black: 0x1a1410, EyeColor: 0x1d2a44 };
  personaggio.traverse(o => {
    if (!o.isMesh) return;
    const nome = o.material.name;
    o.material = toon({ color: colori[nome] ?? 0xffffff, bordo: nome === 'Black' || nome === 'EyeColor' ? 0 : 0.85 });
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
  });
  // si parte sul pontile, rivolti al largo
  personaggio.position.set(PONTE.inizio.x + dx * passo * 2.2, 0, PONTE.inizio.z + dz * passo * 2.2);
  personaggio.position.y = altezzaCamminabile(personaggio.position.x, personaggio.position.z);
  // inquadratura d'apertura: dalla riva verso il largo, il personaggio torna a casa lungo il pontile
  if (!Q.has('yaw')) vista.yaw = Math.atan2(-dx, -dz) + 0.5;
  personaggio.rotation.y = vista.yaw - 0.55;
  scene.add(personaggio);
  contorna(personaggio, 0.022);
  mixer = new THREE.AnimationMixer(personaggio);
  for (const clip of pers.animations) azioni[clip.name] = mixer.clipAction(clip);
  suona('Idle', 0);
}

function suona(nome, fade = 0.25) {
  const a = azioni[nome]; if (!a || a === azioneOra) return;
  a.reset().setEffectiveWeight(1).play();
  if (azioneOra) azioneOra.crossFadeTo(a, fade, false);
  azioneOra = a;
}

// ───────────────────── dove si può camminare ─────────────────────
function sulPontile(x, z) {
  if (!PONTE.inizio) return false;
  const ax = PONTE.fine.x - PONTE.inizio.x, az = PONTE.fine.z - PONTE.inizio.z, L = Math.hypot(ax, az);
  const ux = ax / L, uz = az / L;
  const px = x - PONTE.inizio.x, pz = z - PONTE.inizio.z;
  const lungo = px * ux + pz * uz, trasv = -px * uz + pz * ux;
  return lungo > -1.5 && lungo < L - 0.4 && Math.abs(trasv) < PONTE.larg;
}
function altezzaCamminabile(x, z) {
  const h = altezza(x, z);
  if (sulPontile(x, z)) return Math.max(h, PONTE.quota);
  return h;
}
function camminabile(x, z) {
  if (sulPontile(x, z)) return true;
  if (altezza(x, z) < -0.25) return false;   // si bagnano i piedi, non di più: il mare aperto è chiuso
  for (const o of ostacoli) if ((x - o.x) ** 2 + (z - o.z) ** 2 < o.r * o.r) return false;
  return true;
}

// ─────────────────────────── visuale ───────────────────────────
const vista = { yaw: Number(Q.get('yaw') ?? 2.55), pitch: Number(Q.get('pitch') ?? 0.14), dist: Number(Q.get('dist') ?? 6.5) };
let trascina = null;
renderer.domElement.addEventListener('pointerdown', e => { trascina = { x: e.clientX, y: e.clientY }; renderer.domElement.classList.add('giro'); renderer.domElement.setPointerCapture(e.pointerId); });
addEventListener('pointermove', e => {
  if (!trascina) return;
  vista.yaw -= (e.clientX - trascina.x) * 0.006;
  vista.pitch = Math.min(1.2, Math.max(-0.1, vista.pitch + (e.clientY - trascina.y) * 0.005));
  trascina = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => { trascina = null; renderer.domElement.classList.remove('giro'); });
renderer.domElement.addEventListener('wheel', e => { vista.dist = Math.min(16, Math.max(3.5, vista.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: true });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// gabbiani: tre V piatte che girano in tondo battendo le ali
const gabbiani = [];
{
  const mat = toon({ color: 0xffffff, bordo: 0 });
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const ala = new THREE.BufferGeometry();
    ala.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.18, 0, 0, 0.18, 1.1, 0.0, 0.05], 3));
    ala.computeVertexNormals();
    const sx = new THREE.Mesh(ala, mat), dx = new THREE.Mesh(ala, mat);
    mat.side = THREE.DoubleSide; dx.scale.x = -1;
    const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 3, 6), mat); corpo.rotation.x = Math.PI / 2;
    g.add(sx, dx, corpo);
    g.userData = { sx, dx, r: 14 + i * 5, h: 11 + i * 2.5, v: 0.22 + i * 0.05, f: i * 2.1 };
    scene.add(g); gabbiani.push(g);
  }
}

// ─────────────────────────── ciclo ───────────────────────────
const tmp = new THREE.Vector3(), avanti = new THREE.Vector3(), destra = new THREE.Vector3();
let velOra = 0, distCam = 6.5;
costruisci().then(() => {
  Demo.loop((dt, t) => {
    const g = Demo.guarda();
    vista.yaw -= g.x * dt * 2.4;
    vista.pitch = Math.min(1.2, Math.max(-0.1, vista.pitch - g.y * dt * 1.6));

    // movimento relativo alla camera
    const ax = Demo.asse();
    avanti.set(-Math.sin(vista.yaw), 0, -Math.cos(vista.yaw));
    destra.set(-avanti.z, 0, avanti.x);
    const dir = tmp.set(0, 0, 0).addScaledVector(avanti, ax.y).addScaledVector(destra, ax.x);
    const m = Math.min(1, dir.length());
    const corre = Demo.giu('Shift') || m > 0.95 && Demo.pad.rt > 0.5;
    const vMax = corre ? 6.2 : 3.2;
    velOra = lerp(velOra, m * vMax, Math.min(1, dt * 10));
    if (m > 0.05 && dt > 0) {
      dir.normalize();
      const p = personaggio.position;
      const nx = p.x + dir.x * velOra * dt, nz = p.z + dir.z * velOra * dt;
      if (camminabile(nx, nz)) { p.x = nx; p.z = nz; }
      else {
        // scivola lungo l'ostacolo: prova direzioni ruotate, sempre più di sbieco e più lente
        for (const da of [0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) {
          const c = Math.cos(da), s2 = Math.sin(da), v = velOra * dt * Math.cos(da);
          const rx = dir.x * c - dir.z * s2, rz = dir.x * s2 + dir.z * c;
          if (camminabile(p.x + rx * v, p.z + rz * v)) { p.x += rx * v; p.z += rz * v; break; }
        }
      }
      const voluto = Math.atan2(dir.x, dir.z);
      let d = voluto - personaggio.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      personaggio.rotation.y += d * Math.min(1, dt * 12);
      suona(velOra > 4.5 ? 'Run' : 'Walk');
      // come in Wind Waker la camera, lasciata stare, si rimette pian piano alle spalle
      if (!trascina && Math.abs(g.x) < 0.1 && ax.y > -0.3) {
        let dy = (personaggio.rotation.y + Math.PI) - vista.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        vista.yaw += dy * Math.min(1, dt * 0.9) * m;
      }
    } else if (dt > 0) {
      suona('Idle', 0.3);
    }
    const hy = altezzaCamminabile(personaggio.position.x, personaggio.position.z);
    personaggio.position.y = lerp(personaggio.position.y, Math.max(hy, -0.25), dt > 0 ? Math.min(1, dt * 18) : 0);
    if (azioneOra && azioneOra !== azioni.Idle) azioneOra.timeScale = Math.max(0.6, velOra / (azioneOra === azioni.Run ? 6.2 : 3.2));
    mixer.update(dt);

    // camera in orbita attorno al personaggio, mai sotto il terreno o il mare
    const bersaglio = tmp.copy(personaggio.position).add(new THREE.Vector3(0, 1.05, 0));
    const cp = Math.cos(vista.pitch);
    camera.position.set(bersaglio.x + Math.sin(vista.yaw) * cp * vista.dist, bersaglio.y + Math.sin(vista.pitch) * vista.dist, bersaglio.z + Math.cos(vista.yaw) * cp * vista.dist);
    // se fra il personaggio e la camera c'è la casetta o uno scoglio, la camera si avvicina
    {
      const verso = new THREE.Vector3().subVectors(camera.position, bersaglio); const L = verso.length(); verso.divideScalar(L);
      raggio.set(bersaglio, verso); raggio.far = L;
      const hit = raggio.intersectObjects(solidi, true).find(h => !h.object.userData.contorno);
      distCam = lerp(distCam, hit ? Math.max(0.9, hit.distance - 0.4) : L, dt > 0 ? Math.min(1, dt * (hit ? 20 : 4)) : 1);
      camera.position.copy(bersaglio).addScaledVector(verso, distCam);
    }
    // e comunque non entra mai dentro la casetta o uno scoglio: la si spinge fuori dal cerchio
    for (const o of ostacoli) {
      if (!o.cam) continue;
      const ex = camera.position.x - o.x, ez = camera.position.z - o.z, d = Math.hypot(ex, ez), rr = o.r + 0.5;
      if (d < rr) { camera.position.x = o.x + ex / (d || 1) * rr; camera.position.z = o.z + ez / (d || 1) * rr; }
    }
    camera.position.y = Math.max(camera.position.y, altezza(camera.position.x, camera.position.z) + 0.6, 0.5);
    camera.lookAt(bersaglio);
    if (Q.get('cam')) {   // inquadrature di prova: cam=x,y,z,tx,ty,tz
      const c = Q.get('cam').split(',').map(Number);
      camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3] || 0, c[4] || 0, c[5] || 0);
    }
    camera.updateMatrixWorld();

    // il sole segue il personaggio perché le ombre restino nitide dove si guarda
    sole.target.position.copy(personaggio.position);
    sole.position.copy(personaggio.position).addScaledVector(DIR_SOLE, 80);
    U.uSoleV.value.copy(DIR_SOLE).transformDirection(camera.matrixWorldInverse);

    mareMat.uniforms.uT.value = t;
    mareMat.uniforms.uCam.value.copy(camera.position);
    posNuvole(t);
    scene.traverse(o => { if (o.userData.galleggia) { o.position.y = -0.12 + Math.sin(t * 1.3) * 0.06; o.rotation.z = Math.sin(t * 0.9) * 0.04; } });
    for (const gb of gabbiani) {
      const u = gb.userData, a = t * u.v + u.f;
      gb.position.set(Math.cos(a) * u.r + 4, u.h + Math.sin(t * 0.7 + u.f) * 0.8, Math.sin(a) * u.r + 2);
      gb.rotation.y = -a;
      const bat = Math.sin(t * 7 + u.f) * 0.45;
      u.sx.rotation.z = bat; u.dx.rotation.z = -bat;
    }
    // in modalità foto i 90 fotogrammi simulati non si disegnano: si disegna solo a tempo fermo
    if (!Demo.shot || dt === 0) renderer.render(scene, camera);
  });
  Demo.pronto();
}).catch(e => Demo.errore(e));
