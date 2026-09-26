// Risografia: un uccellino sopra una città, stampato a due o tre inchiostri.
// Ogni inchiostro ha la sua "lastra": un canvas in cui si disegna solo la densità (0 = carta,
// 1 = inchiostro pieno). Uno shader WebGL poi stampa: trasforma la densità in grana di punti,
// sposta ogni lastra di qualche pixel (registro) e sovrappone gli inchiostri in moltiplicazione.
import * as THREE from 'three';

const Q = Demo.query;
const LH = 540;                                   // altezza logica della scena

// ─────────────────────────── inchiostri e accoppiate ───────────────────────────
const INK = {
  rosa: [1.0, 0.282, 0.690],       // #FF48B0 fluo pink
  blu: [0.0, 0.471, 0.749],        // #0078BF
  giallo: [1.0, 0.910, 0.0],       // #FFE800
};
// lastra A (figure calde), B (ombre e linee), C (luce e cielo). Con due inchiostri, C si stampa col tamburo di A o di B.
const ACCOPPIATE = [
  ['rosa', 'blu', 'giallo'],
  ['rosa', 'blu', 'rosa'],
  ['giallo', 'blu', 'giallo'],
  ['rosa', 'giallo', 'giallo'],
  ['blu', 'rosa', 'giallo'],
];

// ─────────────────────────── lastre ───────────────────────────
const lastre = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = c.height = 4; return { c, x: c.getContext('2d') }; });
let W = 2, H = 2, K = 1, LW = 960;

// disegna la stessa forma su più lastre, ognuna con la sua densità
function su(dens, disegna) {
  for (let i = 0; i < 3; i++) {
    if (!dens[i]) continue;
    const x = lastre[i].x;
    x.globalAlpha = dens[i]; x.fillStyle = '#000'; x.strokeStyle = '#000';
    disegna(x, i);
  }
}
// scava la carta: toglie inchiostro (finestre, nuvole, occhi)
function buca(quali, disegna, forza = 1) {
  for (const i of quali) {
    const x = lastre[i].x;
    x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = forza; x.fillStyle = '#000'; x.strokeStyle = '#000';
    disegna(x, i);
    x.restore();
  }
}
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// trame a righe (tipiche delle stampe riso): pattern creati una volta per lastra
const trame = {};
function trama(nome, w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'));
  trame[nome] = lastre.map(l => l.x.createPattern(c, 'repeat'));
}

// ─────────────────────────── scena ───────────────────────────
const ORIZ = 430, SUOLO = 505;
let cam = 0;

function cielo() {
  // cielo: giallo che cresce verso l'orizzonte, un velo rosa in basso (la sfumatura la fa la grana)
  su([0, 0, 1], x => { const g = x.createLinearGradient(0, 0, 0, SUOLO); g.addColorStop(0, 'rgba(0,0,0,0.06)'); g.addColorStop(0.75, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); x.fillStyle = g; x.fillRect(0, 0, LW, SUOLO); });
  su([1, 0, 0], x => { const g = x.createLinearGradient(0, 200, 0, SUOLO); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); x.fillStyle = g; x.fillRect(0, 200, LW, SUOLO - 200); });
  su([0, 1, 0], x => { const g = x.createLinearGradient(0, 0, 0, 180); g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, LW, 180); });
  // sole a righe: pieno in alto, tagliato da strisce di carta sempre più larghe verso il basso
  const sx = LW * 0.74, sy = 150, r = 74;
  su([0.95, 0, 1], x => { x.beginPath(); x.arc(sx, sy, r, 0, Math.PI * 2); x.fill(); });
  buca([0, 2], x => { for (let i = 0; i < 6; i++) { const y = sy + 8 + i * 12, h = 2 + i * 1.3; x.fillRect(sx - r, y, r * 2, h); } });
  // nuvole di carta: tolgono inchiostro al cielo, con un'ombra blu leggera
  for (let i = 0; i < 5; i++) {
    const w = 150 + hash(i + 3) * 120, px = ((i * 260 + 90 - cam * 0.06) % (LW + 400) + LW + 400) % (LW + 400) - 200, py = 70 + hash(i) * 150;
    const nuv = x => { x.beginPath(); for (let k = 0; k < 5; k++) { const cx = px + k / 4 * w, rr = 16 + Math.sin(k / 4 * Math.PI) * 22 + hash(i * 9 + k) * 8; x.moveTo(cx + rr, py); x.arc(cx, py - rr * 0.4, rr, 0, Math.PI * 2); } x.rect(px, py - 12, w, 20); x.fill(); };
    su([0, 0.35, 0], x => { x.save(); x.translate(6, 5); nuv(x); x.restore(); });
    buca([0, 1, 2], nuv);
  }
}

function skyline(p, base, alt, largh, seme, dens, finestre) {
  const off = cam * p, passo = largh;
  const i0 = Math.floor(off / passo) - 1, i1 = Math.ceil((off + LW) / passo) + 1;
  for (let i = i0; i <= i1; i++) {
    const h1 = hash(i * 7.1 + seme), h2 = hash(i * 3.3 + seme * 2), h3 = hash(i * 5.9 + seme * 3);
    const w = passo * (0.7 + h2 * 0.5), x0 = i * passo - off + (h3 - 0.5) * passo * 0.3, h = alt[0] + h1 * (alt[1] - alt[0]), top = base - h;
    su(dens, x => {
      x.fillRect(x0, top, w, h + 80);
      if (h3 > 0.72) { x.beginPath(); x.arc(x0 + w / 2, top, w * 0.32, Math.PI, 0); x.fill(); }                     // cupola
      if (h2 > 0.6) { x.fillRect(x0 + w * 0.5 - 1, top - 30 - h1 * 20, 2, 32 + h1 * 20); x.fillRect(x0 + w * 0.5 - 6, top - 22, 12, 2); } // antenna
      if (h1 > 0.8) { x.beginPath(); x.moveTo(x0, top); x.lineTo(x0 + w / 2, top - w * 0.4); x.lineTo(x0 + w, top); x.fill(); }   // tetto a punta
    });
    if (finestre) {
      buca(finestre, x => {
        const cols = Math.max(2, Math.floor(w / 13)), rows = Math.floor(h / 16);
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
          if (hash(i * 31 + c * 7 + r * 13 + seme) < 0.28) continue;
          x.fillRect(x0 + 5 + c * (w - 8) / cols, top + 8 + r * 16, (w - 8) / cols - 5, 8);
        }
      }, 0.85);
      // lato in ombra: mezza facciata in blu leggero
      su([0, 0.25, 0], x => x.fillRect(x0 + w * 0.62, top, w * 0.38, h + 80));
    }
  }
}

function gru(p, seme) {
  const off = cam * p, passo = 720;
  const i0 = Math.floor(off / passo) - 1, i1 = Math.ceil((off + LW) / passo) + 1;
  for (let i = i0; i <= i1; i++) {
    const x0 = i * passo - off + hash(i + seme) * 300, top = 120 + hash(i * 2 + seme) * 60, base = SUOLO;
    su([0, 0.6, 0], x => {
      x.lineWidth = 1.6;
      // torre a traliccio
      x.strokeRect(x0, top, 14, base - top);
      x.beginPath();
      for (let y = top; y < base; y += 14) { x.moveTo(x0, y); x.lineTo(x0 + 14, y + 14); x.moveTo(x0 + 14, y); x.lineTo(x0, y + 14); }
      // braccio e contrappeso
      x.moveTo(x0 - 60, top); x.lineTo(x0 + 190, top); x.moveTo(x0 - 60, top + 10); x.lineTo(x0 + 190, top + 10);
      for (let k = -60; k < 190; k += 12) { x.moveTo(x0 + k, top); x.lineTo(x0 + k + 12, top + 10); }
      x.moveTo(x0 + 7, top - 30); x.lineTo(x0 - 60, top); x.moveTo(x0 + 7, top - 30); x.lineTo(x0 + 190, top);
      x.stroke();
      x.fillRect(x0 - 58, top + 10, 24, 18);
      // cavo e gancio con un carico che dondola
      const hx = x0 + 150, ld = 90 + Math.sin(cam * 0.004 + i) * 10;
      x.beginPath(); x.moveTo(hx, top + 10); x.lineTo(hx, top + ld); x.stroke();
      x.beginPath(); x.arc(hx, top + ld + 5, 5, -Math.PI * 0.2, Math.PI * 1.1); x.stroke();
    });
    su([0.8, 0, 0], x => x.fillRect(x0 + 150 - 16, top + 110 + Math.sin(cam * 0.004 + i) * 10, 32, 14));
  }
}

function alberiCase(p) {
  const off = cam * p, passo = 44;
  const i0 = Math.floor(off / passo) - 1, i1 = Math.ceil((off + LW) / passo) + 1;
  for (let i = i0; i <= i1; i++) {
    const h1 = hash(i * 1.7 + 50), h2 = hash(i * 2.9 + 51), x0 = i * passo - off;
    if (h1 < 0.55) {
      // albero: chioma tonda verde (giallo + blu sovrapposti), tronco blu
      const r = 16 + h2 * 14, cy = SUOLO - 18 - r;
      su([0, 0.6, 1], x => { x.beginPath(); x.arc(x0, cy, r, 0, Math.PI * 2); x.arc(x0 + r * 0.6, cy + 6, r * 0.7, 0, Math.PI * 2); x.fill(); });
      su([0, 0.95, 0], x => x.fillRect(x0 - 2, cy + r * 0.5, 4, SUOLO - cy));
      buca([1], x => { x.beginPath(); x.arc(x0 - r * 0.35, cy - r * 0.3, r * 0.3, 0, Math.PI * 2); x.fill(); }, 0.6);   // luce sulla chioma
    } else {
      // casetta col tetto rosa
      const w = 30 + h2 * 16, h = 22 + h1 * 10, b = SUOLO;
      su([0, 0.22, 0.5], x => x.fillRect(x0 - w / 2, b - h, w, h));
      su([0.95, 0, 0], x => { x.beginPath(); x.moveTo(x0 - w / 2 - 4, b - h); x.lineTo(x0, b - h - 18); x.lineTo(x0 + w / 2 + 4, b - h); x.fill(); });
      buca([2, 1], x => x.fillRect(x0 - 5, b - h + 7, 10, 9));
    }
  }
}

function suolo() {
  su([0, 1, 0], x => x.fillRect(0, SUOLO, LW, LH - SUOLO));
  su([0, 0, 0], () => {});
  // righe del marciapiede: carta a strisce
  buca([1, 2], x => { const o = (cam % 30); for (let X = -o; X < LW; X += 30) x.fillRect(X, SUOLO + 10, 16, 3); }, 0.9);
}

// ─────────────────────────── ostacoli ───────────────────────────
const PASSO = 280, LARGO = 64, VARCO = 165;
const ostacoli = [];
function nuovoOstacolo(x) {
  const c = 150 + Math.random() * (SUOLO - 150 - 150);
  ostacoli.push({ x, c, tipo: Math.random() < 0.5 ? 0 : 1, seme: Math.random() * 100, contato: false });
}
function disegnaOstacoli() {
  for (const o of ostacoli) {
    const x0 = o.x - cam, alto = o.c - VARCO / 2, basso = o.c + VARCO / 2;
    // dal basso: una torre blu piena, finestre accese in giallo, serbatoio rosa sul tetto
    buca([0, 2], x => { x.fillRect(x0, basso + 16, LARGO, SUOLO - basso); x.beginPath(); x.ellipse(x0 + LARGO / 2, basso + 4, 18, 11, 0, 0, Math.PI * 2); x.fill(); });   // la torre copre ciò che ha dietro
    su([0, 1, 0], x => x.fillRect(x0, basso + 16, LARGO, SUOLO - basso));
    const fin = x => { for (let y = basso + 26; y < SUOLO - 12; y += 17) for (let c = 0; c < 3; c++) x.fillRect(x0 + 6 + c * 17, y, 10, 9); };
    buca([1], fin);
    su([0, 0, 1], fin);
    su([0.9, 0, 0], x => x.fillRect(x0 + LARGO * 0.62, basso + 16, LARGO * 0.38, SUOLO - basso));
    su([1, 0, 0], x => { x.beginPath(); x.ellipse(x0 + LARGO / 2, basso + 4, 18, 11, 0, 0, Math.PI * 2); x.fill(); });
    su([0, 1, 0], x => { x.fillRect(x0 + 12, basso + 12, 3, 6); x.fillRect(x0 + LARGO - 15, basso + 12, 3, 6); });
    // dall'alto: una trave a traliccio appesa, con l'insegna gialla in fondo
    su([0, 1, 0], x => {
      x.lineWidth = 2.2; x.strokeRect(x0 + 12, -10, LARGO - 24, alto - 22);
      x.beginPath();
      for (let y = -10; y < alto - 32; y += 16) { x.moveTo(x0 + 12, y); x.lineTo(x0 + LARGO - 12, y + 16); x.moveTo(x0 + LARGO - 12, y); x.lineTo(x0 + 12, y + 16); }
      x.stroke();
    });
    buca([0, 1, 2], x => x.fillRect(x0 - 4, alto - 34, LARGO + 8, 34));
    su([1, 0, 1], x => x.fillRect(x0 - 4, alto - 34, LARGO + 8, 34));
    buca([0, 2], x => { x.font = '13px "Rubik Mono One", sans-serif'; x.textAlign = 'center'; x.fillText(o.tipo ? 'BAR' : 'OTTICA', x0 + LARGO / 2, alto - 12); });
  }
}

// ─────────────────────────── uccellino ───────────────────────────
const bird = { x: 0, y: 260, vy: 0, stato: 'vola', t: 0, ala: 0, piume: [] };
function disegnaUccello(t) {
  const x0 = bird.x, y0 = bird.y, a = clampA(bird.vy * 0.0022);
  const lati = (x, fn) => { x.save(); x.translate(x0, y0); x.rotate(a); x.scale(1.35, 1.35); fn(x); x.restore(); };
  // prima si libera la carta sotto la sagoma, così l'uccellino sta davanti alla città
  buca([0, 1, 2], x => lati(x, x => { x.beginPath(); x.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2); x.moveTo(16, -4); x.lineTo(29, 0); x.lineTo(16, 4); x.fill(); x.beginPath(); x.moveTo(-14, -2); x.lineTo(-31, -11); x.lineTo(-28, 5); x.fill(); }));
  // coda
  su([0.9, 0.3, 0], x => lati(x, x => { x.beginPath(); x.moveTo(-14, -2); x.lineTo(-30, -10); x.lineTo(-27, 4); x.fill(); }));
  // corpo rosa, pancia gialla
  su([1, 0, 0], x => lati(x, x => { x.beginPath(); x.ellipse(0, 0, 19, 15, 0, 0, Math.PI * 2); x.fill(); }));
  su([0, 0, 0.95], x => lati(x, x => { x.beginPath(); x.ellipse(3, 6, 13, 8, 0.2, 0, Math.PI * 2); x.fill(); }));
  // becco
  su([0.4, 0, 1], x => lati(x, x => { x.beginPath(); x.moveTo(16, -4); x.lineTo(28, 0); x.lineTo(16, 4); x.fill(); }));
  // occhio: carta con la pupilla blu
  buca([0, 2], x => lati(x, x => { x.beginPath(); x.arc(8, -5, 5, 0, Math.PI * 2); x.fill(); }));
  su([0, 1, 0], x => lati(x, x => { x.beginPath(); x.arc(9.5, -5, 2.4, 0, Math.PI * 2); x.fill(); }));
  // ala blu che batte
  const b = Math.sin(bird.ala) * 0.9;
  su([0, 0.9, 0], x => lati(x, x => { x.save(); x.translate(-4, -2); x.rotate(-0.3 + b); x.beginPath(); x.ellipse(-4, -9, 8, 15, 0.5, 0, Math.PI * 2); x.fill(); x.restore(); }));
  // piume staccate dopo un urto
  for (const p of bird.piume) su([0.9, 0.2, 0], x => { x.save(); x.translate(p.x - cam, p.y); x.rotate(p.r); x.beginPath(); x.ellipse(0, 0, 5, 2.4, 0, 0, Math.PI * 2); x.fill(); x.restore(); });
}
const clampA = v => Math.max(-0.6, Math.min(0.9, v));

// ─────────────────────────── stampa (WebGL) ───────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Demo.shot });
renderer.setPixelRatio(1);
document.body.prepend(renderer.domElement);
const tex = lastre.map(l => { const t = new THREE.CanvasTexture(l.c); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; });
const U = {
  tA: { value: tex[0] }, tB: { value: tex[1] }, tC: { value: tex[2] },
  iA: { value: new THREE.Vector3() }, iB: { value: new THREE.Vector3() }, iC: { value: new THREE.Vector3() },
  oA: { value: new THREE.Vector2() }, oB: { value: new THREE.Vector2() }, oC: { value: new THREE.Vector2() },
  res: { value: new THREE.Vector2(2, 2) }, seme: { value: 1 }, grana: { value: 1.6 },
};
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: U, depthTest: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tA, tB, tC; uniform vec3 iA, iB, iC; uniform vec2 oA, oB, oC, res; uniform float seme, grana;
    varying vec2 vUv;
    float h(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.), f.x), f.y); }
    // copertura di una lastra: densità → grana stocastica. Niente sfumature: ogni granello c'è o non c'è.
    float lastra(sampler2D t, vec2 off, vec2 px, float s, float ang){
      float d = texture2D(t, vUv + off).a;
      // il tamburo non inchiostra mai uguale: bande orizzontali e chiazze larghe
      d *= 0.90 + 0.13 * vn(vec2(px.y * 0.006 + s, s)) + 0.10 * (vn(px * 0.012 + s * 7.) - 0.5);
      vec2 cella = floor(px / grana);
      // retino a punti ruotato (ogni lastra con il suo angolo) sporcato dalla grana
      float ca = cos(ang), sa = sin(ang);
      vec2 q = mat2(ca, -sa, sa, ca) * px / (grana * 3.2);
      vec2 fq = fract(q) - 0.5;
      float punto = clamp(3.14159 * dot(fq, fq), 0., 1.);
      float soglia = mix(punto, h(cella + s * 17.3), 0.28) * 0.94 + 0.03;
      float c = step(soglia, d);
      // anche nel pieno qualche granello resta scoperto (inchiostro che non attacca)
      c *= step(0.035, h(cella * 1.7 + s * 3.1) + step(0.2, 1. - d));
      return c;
    }
    void main(){
      vec2 px = gl_FragCoord.xy;
      vec3 carta = vec3(0.953, 0.933, 0.878);
      // grana della carta: fibre e puntini
      float f = vn(px * vec2(0.05, 0.4) + seme) * 0.5 + vn(px * 0.9) * 0.5;
      carta *= 0.975 + f * 0.035;
      carta *= 1. - step(0.996, h(floor(px / 2.) + 9.1)) * 0.12;
      vec3 col = carta;
      col *= mix(vec3(1.), iC, lastra(tC, oC, px, seme + 3., 0.26) * 0.92);
      col *= mix(vec3(1.), iA, lastra(tA, oA, px, seme, 1.31) * 0.92);
      col *= mix(vec3(1.), iB, lastra(tB, oB, px, seme + 1., 0.79) * 0.9);
      gl_FragColor = vec4(col, 1.);
    }`,
}));
const postScene = new THREE.Scene(); postScene.add(quad);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ─────────────────────────── ristampa ───────────────────────────
let accoppiata = 0, stampa = 1;
function ristampa(nuova = true) {
  if (nuova) { accoppiata = (accoppiata + 1) % ACCOPPIATE.length; stampa++; }
  const ink = ACCOPPIATE[accoppiata];
  U.iA.value.fromArray(INK[ink[0]]); U.iB.value.fromArray(INK[ink[1]]); U.iC.value.fromArray(INK[ink[2]]);
  // registro: ogni lastra finisce fuori di qualche pixel, in una direzione a caso
  const px = Math.max(2, H / 260);
  for (const o of [U.oA, U.oB, U.oC]) { const a = Math.random() * Math.PI * 2, r = px * (0.4 + Math.random()); o.value.set(Math.cos(a) * r / W, Math.sin(a) * r / H); }
  U.seme.value = Math.random() * 100;
}

function ridimensiona() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H);
  const ph = Math.round(H * 0.7), pw = Math.round(W * 0.7);
  for (const l of lastre) { l.c.width = pw; l.c.height = ph; }
  for (const t of tex) { t.dispose(); t.needsUpdate = true; }
  K = ph / LH; LW = pw / K;
  U.res.value.set(W, H);
  U.grana.value = Math.max(1.2, H / 620);
  bird.x = LW * 0.3;
  trama('righe', 8, 8, x => { x.fillRect(0, 0, 8, 3); });
}
addEventListener('resize', () => { ridimensiona(); ristampa(false); });

// ─────────────────────────── gioco ───────────────────────────
const VEL = 118, GRAV = 1050, SPINTA = -300;
let passati = 0, auto = Demo.shot && !Q.get('tieni');
function ricomincia() {
  ostacoli.length = 0;
  for (let i = 0; i < 6; i++) nuovoOstacolo(cam + LW * 0.75 + i * PASSO);
  bird.y = 250; bird.vy = 0; bird.stato = 'vola'; passati = 0;
}

function aggiorna(dt, t) {
  bird.t += dt;
  if (bird.stato === 'vola') {
    cam += VEL * dt;
    let batti = Demo.premuto(' ') || Demo.premuto('ArrowUp') || Demo.premuto('w');
    if (auto) {                                            // pilota automatico per la foto
      const pross = ostacoli.find(o => o.x + LARGO - cam > bird.x - 20);
      const meta = pross ? pross.c + 18 : 270;
      if (bird.y > meta && bird.vy > -40) batti = true;
    }
    if (batti) { bird.vy = SPINTA; bird.ala = 0; }
    bird.vy += GRAV * dt; bird.y += bird.vy * dt;
    bird.ala += dt * (bird.vy < 0 ? 26 : 9);
    if (bird.y < 12) { bird.y = 12; bird.vy = 0; }
    // urto: contro una torre, una trave o il marciapiede
    let urto = bird.y > SUOLO - 10;
    for (const o of ostacoli) {
      const x0 = o.x - cam;
      if (bird.x + 20 > x0 - 4 && bird.x - 20 < x0 + LARGO + 4 && (bird.y - 16 < o.c - VARCO / 2 || bird.y + 16 > o.c + VARCO / 2 + 2)) urto = true;
      if (!o.contato && x0 + LARGO < bird.x) { o.contato = true; passati++; }
    }
    if (urto) {
      bird.stato = 'urto'; bird.t = 0; bird.vy = -120;
      for (let i = 0; i < 7; i++) bird.piume.push({ x: bird.x + cam, y: bird.y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, r: Math.random() * 6 });
    }
  } else {
    // un urto gentile: rimbalza, perde qualche piuma, e si riparte
    cam += VEL * 0.25 * dt;
    bird.vy += GRAV * 0.5 * dt; bird.y = Math.min(SUOLO - 14, bird.y + bird.vy * dt);
    bird.ala += dt * 4;
    if (bird.t > 1.0) ricomincia();
  }
  for (const p of bird.piume) { p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 3; }
  bird.piume = bird.piume.filter(p => p.y < LH + 20);
  // ostacoli infiniti
  while (ostacoli.length && ostacoli[0].x - cam < -LARGO - 40) ostacoli.shift();
  while (ostacoli.length < 6) nuovoOstacolo((ostacoli.length ? ostacoli[ostacoli.length - 1].x : cam + LW) + PASSO);
}

function componi(t) {
  for (const l of lastre) { l.x.setTransform(1, 0, 0, 1, 0, 0); l.x.globalAlpha = 1; l.x.clearRect(0, 0, l.c.width, l.c.height); l.x.setTransform(K, 0, 0, K, 0, 0); }
  cielo();
  skyline(0.12, ORIZ + 10, [70, 190], 48, 11, [0, 0.32, 0], null);
  gru(0.3, 4);
  skyline(0.45, SUOLO, [50, 180], 70, 23, [0.55, 0, 0], [0, 2]);
  alberiCase(0.8);
  suolo();
  disegnaOstacoli();
  disegnaUccello(t);
  // numero della stampa e punti, stampati come in una fanzine
  su([0, 1, 0], x => {
    x.font = '50px "Rubik Mono One", sans-serif'; x.textAlign = 'center'; x.fillText(String(passati), LW / 2, 72);
    x.font = '10px "Rubik Mono One", sans-serif'; x.textAlign = 'left';
    x.fillText('CITTÀ IN VOLO · STAMPA N. ' + stampa + ' · ' + ACCOPPIATE[accoppiata].filter((v, i, a) => a.indexOf(v) === i).join(' + ').toUpperCase(), 18, LH - 12);
  });
  su([0.9, 0, 0], x => { x.font = '50px "Rubik Mono One", sans-serif'; x.textAlign = 'center'; x.fillText(String(passati), LW / 2 + 4, 76); });
  for (const tt of tex) tt.needsUpdate = true;
}

// ─────────────────────────── avvio ───────────────────────────
Demo.carica('Inchiostro il tamburo', 0.4);
try { await document.fonts.load('34px "Rubik Mono One"'); } catch (e) { /* va bene anche senza */ }
ridimensiona();
ristampa(false);
cam = 0; ricomincia();
if (Demo.shot) { cam = 40; ostacoli.length = 0; for (let i = 0; i < 6; i++) nuovoOstacolo(cam + LW * 0.52 + i * PASSO); ostacoli[0].c = 250; ostacoli[1].c = 300; }

Demo.loop((dt, t) => {
  if (Demo.premuto('r')) ristampa(true);
  aggiorna(dt, t);
  componi(t);
  renderer.render(postScene, postCam);
});
Demo.extra('<p>Tre lastre: figure calde, ombre e linee, luce e cielo. <b>R</b> cambia l\'accoppiata di inchiostri fra rosa fluo, blu e giallo, e rifà il registro.</p>');
Demo.pronto();
