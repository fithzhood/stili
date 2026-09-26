// Game Boy (1989): un piccolo mondo dall'alto su uno schermo da 160×144 a quattro toni.
// Il mondo si disegna in 4 livelli di grigio su un canvas 160×144; ogni fotogramma i livelli
// passano in un buffer che imita i cristalli liquidi (lenti a cambiare: la scia), e uno shader
// WebGL disegna lo schermo ingrandito con la griglia dei pixel, l'ombra dei pixel sul fondo
// e i bordi non del tutto netti. Grafica: Ninja Adventure (CC0), ridotta a 4 toni in anticipo.

const W = 160, H = 144, HUD = 16, PH = H - HUD;   // area di gioco 160×128 + barra in basso
const TS = 16, SC = 10, SR = 8;                   // tile, colonne e righe di una schermata
const MC = SC * 3, MR = SR * 2;                   // mondo di 3×2 schermate

// ── Modelli (tasto H) ──
const MODELLI = [
  { nome: 'DMG', pal: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], fondo: '#a3c214', corpo: ['#cfcbc3', '#bdb9b0'], cornice: '#5d5e6c', luce: 0, ombra: 0.30 },
  { nome: 'Pocket', pal: ['#1a1b17', '#4a4b44', '#8d8f82', '#c3c4b4'], fondo: '#c9cabb', corpo: ['#c4c7cd', '#a9adb5'], cornice: '#3c3d44', luce: 0, ombra: 0.26 },
  { nome: 'Light', pal: ['#00302a', '#0a6a5a', '#35c4a6', '#6cf0d2'], fondo: '#78f4d8', corpo: ['#d8bf6a', '#bfa351'], cornice: '#38383e', luce: 1, ombra: 0 },
];
let modello = +(Demo.query.get('modello') || 0) % 3;

// ── Canvas: corpo della console (2D) e schermo (WebGL) ──
const corpo = document.createElement('canvas');
corpo.style.cssText = 'position:fixed;left:0;top:0';
const schermo = document.createElement('canvas');
schermo.style.cssText = 'position:fixed';
document.body.prepend(corpo, schermo);
let S = 4, SX = 0, SY = 0;

// ── Canvas LCD a 4 livelli ──
const lcd = document.createElement('canvas'); lcd.width = W; lcd.height = H;
const L = lcd.getContext('2d', { willReadFrequently: true });
L.imageSmoothingEnabled = false;
const disp = new Float32Array(W * H).fill(1);   // stato dei cristalli: 0 scuro .. 1 chiaro
const bytes = new Uint8Array(W * H);

// ── WebGL ──
const gl = schermo.getContext('webgl', { preserveDrawingBuffer: Demo.shot, antialias: false });
if (!gl) throw new Error('WebGL non disponibile');
const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.,1.); }`;
const FS = `precision highp float;
varying vec2 uv;
uniform sampler2D lcd;
uniform float S;            // pixel del dispositivo per pixel LCD
uniform vec3 P0, P1, P2, P3, F;
uniform float luce, ombra, tempo;
float ink(vec2 c){ c = clamp(c, vec2(0.), vec2(159.,143.)); return texture2D(lcd, (c + 0.5) / vec2(160.,144.)).r; }
vec3 pal(float v){ v = clamp(v,0.,1.)*3.; return v < 1. ? mix(P0,P1,v) : v < 2. ? mix(P1,P2,v-1.) : mix(P2,P3,v-2.); }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec2 p = uv * vec2(160.,144.);
  vec2 c = floor(p), f = fract(p);
  float v = ink(c);
  // pixel con bordi morbidi e un filo di fessura fra uno e l'altro
  float g = 1.0 / S;
  vec2 m2 = smoothstep(vec2(0.), vec2(g*1.6), f) * smoothstep(vec2(1.), vec2(1.-g*0.9), f);
  float m = m2.x * m2.y;
  vec3 pix = pal(v);
  // i pixel scuri non sono mai neri pieni: un velo di fondo li attraversa
  pix = mix(pix, F, 0.07);
  vec3 col = mix(F, pix, 0.35 + 0.65 * m);
  // ombra dei pixel sul fondo riflettente, spostata in basso a destra e un po' sfocata
  vec2 q = p - vec2(0.42, 0.5) - 0.5;
  vec2 qi = floor(q), qf = fract(q);
  float sh = mix(mix(ink(qi), ink(qi+vec2(1.,0.)), qf.x), mix(ink(qi+vec2(0.,1.)), ink(qi+vec2(1.,1.)), qf.x), qf.y);
  float d = (1. - sh) * ombra * (0.35 + 0.65 * v);
  col *= 1. - d;
  // retroilluminazione (Light): i toni chiari brillano, niente ombra
  col += luce * (pal(v) * 0.10 + vec3(0.02,0.06,0.05)) * v;
  // vetro: un riflesso diagonale appena percettibile e un po' di grana
  float gl = smoothstep(0.35, 0.0, abs(uv.x + uv.y * 0.6 - 0.35)) * 0.035;
  col += gl;
  col += (h(c + fract(tempo)) - 0.5) * 0.012;
  // bordo interno leggermente più scuro, come lo schermo incassato
  vec2 e = min(uv, 1. - uv);
  col *= mix(0.9, 1., smoothstep(0., 0.02, min(e.x, e.y)));
  gl_FragColor = vec4(col, 1.);
}`;
function shader(tipo, src) {
  const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog); gl.useProgram(prog);
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const aP = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, W, H, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
const U = n => gl.getUniformLocation(prog, n);
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

// ── Corpo della console ──
function disegnaCorpo() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const iw = innerWidth, ih = innerHeight;
  S = Math.max(2, Math.floor(Math.min((ih - 16) / (H * 1.12), (iw - 40) / (W * 1.35))));
  const sw = W * S, sh = H * S;
  SX = Math.round((iw - sw) / 2); SY = Math.round((ih - sh) / 2 + sh * 0.015);
  schermo.style.left = SX + 'px'; schermo.style.top = SY + 'px';
  schermo.style.width = sw + 'px'; schermo.style.height = sh + 'px';
  schermo.width = sw * dpr; schermo.height = sh * dpr;
  gl.viewport(0, 0, schermo.width, schermo.height);
  corpo.width = iw * dpr; corpo.height = ih * dpr; corpo.style.width = iw + 'px'; corpo.style.height = ih + 'px';
  const g = corpo.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const M = MODELLI[modello];
  // plastica: gradiente leggero e una trama fine
  const gr = g.createLinearGradient(0, 0, iw * 0.4, ih);
  gr.addColorStop(0, M.corpo[0]); gr.addColorStop(1, M.corpo[1]);
  g.fillStyle = gr; g.fillRect(0, 0, iw, ih);
  g.globalAlpha = 0.05;
  for (let i = 0; i < 2600; i++) { g.fillStyle = i % 2 ? '#000' : '#fff'; g.fillRect(Math.random() * iw, Math.random() * ih, 1, 1); }
  g.globalAlpha = 1;
  // cornice scura attorno allo schermo, angolo in basso a destra molto arrotondato
  const px = sw * 0.2, pt = sh * 0.1, pb = sh * 0.08;
  const bx = SX - px, by = SY - pt, bw = sw + px * 2, bh = sh + pt + pb;
  const r = S * 4, rb = S * 22;
  g.beginPath();
  g.moveTo(bx + r, by); g.lineTo(bx + bw - r, by); g.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
  g.lineTo(bx + bw, by + bh - rb); g.quadraticCurveTo(bx + bw, by + bh, bx + bw - rb, by + bh);
  g.lineTo(bx + r, by + bh); g.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
  g.lineTo(bx, by + r); g.quadraticCurveTo(bx, by, bx + r, by); g.closePath();
  g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 6; g.shadowOffsetY = -1;
  g.fillStyle = M.cornice; g.fill();
  g.shadowColor = 'transparent';
  // linee e scritta in alto
  const ly = by + pt * 0.42, lh = Math.max(1, S * 0.5);
  g.font = `600 ${Math.round(S * 3.2)}px "Segoe UI", Arial, sans-serif`;
  const txt = 'MATRICE A PUNTI · QUATTRO TONI';
  const tw = g.measureText(txt).width;
  const tx = bx + bw * 0.5 - tw / 2;
  g.fillStyle = '#8c1d4f'; g.fillRect(bx + S * 6, ly - lh * 2.2, tx - (bx + S * 6) - S * 3, lh);
  g.fillRect(tx + tw + S * 3, ly - lh * 2.2, bx + bw - S * 6 - (tx + tw + S * 3), lh);
  g.fillStyle = '#2c2f7a'; g.fillRect(bx + S * 6, ly + lh * 1.2, tx - (bx + S * 6) - S * 3, lh);
  g.fillRect(tx + tw + S * 3, ly + lh * 1.2, bx + bw - S * 6 - (tx + tw + S * 3), lh);
  g.fillStyle = '#b8b8c6'; g.textBaseline = 'middle'; g.fillText(txt, tx, ly);
  // spia della batteria
  const lx = bx + px * 0.36, lyy = SY + sh * 0.34;
  const on = g.createRadialGradient(lx, lyy, 0, lx, lyy, S * 4);
  on.addColorStop(0, '#ff5a4a'); on.addColorStop(0.45, '#d8202a'); on.addColorStop(1, 'rgba(216,32,42,0)');
  g.fillStyle = on; g.beginPath(); g.arc(lx, lyy, S * 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e03a3a'; g.beginPath(); g.arc(lx, lyy, S * 1.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b8b8c6'; g.font = `600 ${Math.round(S * 2.6)}px "Segoe UI", Arial, sans-serif`;
  g.textAlign = 'center'; g.fillText('BATTERY', lx, lyy + S * 7); g.textAlign = 'left';
  // nome del modello sotto la cornice, in corsivo come sulla plastica
  g.fillStyle = '#2c2f7a';
  g.font = `italic 700 ${Math.round(S * 6)}px Georgia, "Times New Roman", serif`;
  g.fillText('Stili', bx + S * 2, by + bh + S * 9);
  const lw = g.measureText('Stili ').width;
  g.font = `italic 800 ${Math.round(S * 4.2)}px "Segoe UI", Arial, sans-serif`;
  g.fillText({ DMG: 'DMG', Pocket: 'POCKET', Light: 'LIGHT' }[M.nome], bx + S * 2 + lw, by + bh + S * 9);
}

// ── Immagini (già a 4 livelli) ──
const IMG = {};
const NOMI = ['floor', 'nature', 'house', 'water', 'boy', 'oldman', 'villager', 'woman', 'chicken', 'cat', 'ripples', 'font'];
const carica = n => new Promise((ok, ko) => { const i = new Image(); i.onload = () => { IMG[n] = i; ok(); }; i.onerror = () => ko(new Error('Manca ' + n)); i.src = 'assets/' + n + '.png?v=1'; });
let FONT_CHIARO;

// ── Mondo ──
// suolo: 0 prato, 1 sentiero, 2 acqua
const suolo = Array.from({ length: MR }, () => new Array(MC).fill(0));
const solido = Array.from({ length: MR }, () => new Array(MC).fill(false));
const OGG = [];   // {img, c, r, sc, sr, w, h} in tile
const FIORI = [];
const CARTELLI = [];
function rett(tipo, c0, r0, c1, r1) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { suolo[r][c] = tipo; if (tipo === 2) solido[r][c] = true; } }
function ogg(img, sc, sr, w, h, c, r, solidoDa = 0) {
  OGG.push({ img, sc, sr, w, h, c, r });
  for (let y = r + solidoDa; y < r + h; y++) for (let x = c; x < c + w; x++) if (y >= 0 && y < MR && x >= 0 && x < MC) solido[y][x] = true;
}
const albero = (c, r) => ogg('nature', 0, 0, 2, 2, c, r);
const pino = (c, r) => ogg('nature', 2, 0, 2, 2, c, r);
const cespuglio = (c, r) => ogg('nature', 0, 10, 1, 1, c, r);
const sasso = (c, r) => ogg('nature', 5, 12, 1, 1, c, r);
const fiore = (c, r, k = 0) => FIORI.push({ c, r, k });
const cartello = (c, r, testo) => { ogg('nature', 5, 8, 1, 1, c, r); CARTELLI.push({ c, r, testo }); };

function costruisciMondo() {
  // cornice di alberi tutto attorno
  for (let c = 0; c < MC; c += 2) { (c % 4 ? pino : albero)(c, 0); (c % 4 ? albero : pino)(c, MR - 2); }
  for (let r = 2; r < MR - 2; r += 2) { albero(0, r); pino(MC - 2, r); }
  // schermata 0,0: il villaggio
  ogg('house', 0, 0, 4, 3, 2, 2, 1);
  ogg('house', 12, 0, 4, 3, 6, 2, 1);
  rett(1, 3, 5, 9, 6);
  cartello(5, 5, 'VILLAGGIO DI STILI|Quattro verdi e uno schermo da 160x144.|Premi H per cambiare modello.');
  fiore(2, 6, 0); fiore(2, 7, 1); fiore(6, 7, 0); fiore(9, 7, 2);
  // schermata 1,0: il laghetto
  rett(2, 12, 3, 16, 5);
  albero(17, 2); cespuglio(11, 2); cespuglio(18, 5);
  cartello(13, 6, 'LAGHETTO|Qui non si nuota: il Game Boy non ha le pinne.');
  fiore(11, 5, 1); fiore(15, 7, 0); fiore(16, 7, 2); fiore(19, 3, 0);
  rett(1, 10, 6, 11, 7);
  // schermata 2,0: il bosco dei pini
  pino(22, 2); pino(25, 3); pino(22, 5); pino(26, 6); albero(24, 5);
  cespuglio(21, 3); sasso(27, 2);
  cartello(21, 7, 'BOSCO DEI PINI|Lo schermo è lento: ogni cosa che si muove lascia una scia.');
  // schermata 0,1: il prato fiorito
  for (const [c, r, k] of [[3, 9, 0], [4, 10, 1], [6, 9, 2], [7, 11, 0], [3, 12, 2], [5, 12, 0], [8, 13, 1], [2, 11, 1]]) fiore(c, r, k);
  cespuglio(9, 9); cespuglio(9, 10); cespuglio(4, 13);
  cartello(6, 11, 'PRATO|Ogni pixel getta un\'ombra sul fondo dello schermo.');
  // schermata 1,1: sassi e un secondo stagno
  rett(2, 14, 10, 17, 12);
  sasso(11, 9); sasso(12, 13); sasso(18, 9); cespuglio(11, 12);
  albero(12, 10);
  rett(1, 13, 13, 18, 13);
  // schermata 2,1: radura
  rett(1, 22, 9, 26, 12);
  albero(27, 10); pino(20, 12); sasso(22, 13); fiore(25, 13, 0); fiore(26, 13, 1);
  cartello(24, 8, 'FINE DEL MONDO|Da qui in poi ci sono solo pixel spenti.');
}

// ── Personaggi ──
const PNG = [];   // abitanti che passeggiano
const TESTI_PNG = {
  villager: 'Buongiorno! Hai letto il cartello davanti alle case?',
  woman: 'Col modello Light lo schermo si illumina di turchese.',
  oldman: 'Ai miei tempi i colori erano quattro, e bastavano.',
};
function png(img, c, r, zona) { PNG.push({ img, x: c * TS + 8, y: r * TS + 14, dir: 0, t: 0, cambio: 0, vx: 0, vy: 0, zona, passo: 0 }); }
const ANIMALI = [];
function animale(img, c, r, zona) { ANIMALI.push({ img, x: c * TS + 8, y: r * TS + 14, t: Math.random() * 3, vx: 0, vy: 0, cambio: 0, zona, flip: false }); }

const G = { x: 5 * TS + 8, y: 7 * TS + 12, dir: 0, passo: 0, muove: false };   // dir: 0 giù, 1 su, 2 sinistra, 3 destra
let camX = 0, camY = 0, scorre = null;   // scorrimento fra schermate
let dialogo = null;

function libero(x, y, w = 10, h = 6) {
  for (const [px, py] of [[x - w / 2, y - h], [x + w / 2 - 0.01, y - h], [x - w / 2, y - 0.01], [x + w / 2 - 0.01, y - 0.01]]) {
    const c = Math.floor(px / TS), r = Math.floor(py / TS);
    if (c < 0 || r < 0 || c >= MC || r >= MR || solido[r][c]) return false;
  }
  return true;
}

// ── Ingresso ──
const pilota = Demo.shot && !Demo.query.has('tieni') && !Demo.query.has('fermo');
let fotogramma = 0;
function input() {
  if (pilota) {
    const f = fotogramma;
    return { x: 0, y: f < 4 ? 1 : 0, azione: f === 6 };
  }
  const a = Demo.asse();
  return { x: Math.abs(a.x) > 0.3 ? Math.sign(a.x) : 0, y: Math.abs(a.y) > 0.3 ? Math.sign(a.y) : 0, azione: Demo.premuto(' ') };
}

function testoPagine(t) {
  // a capo a 18 caratteri, due righe per pagina; '|' forza una nuova riga
  const righe = [];
  for (const par of t.split('|')) {
    let r = '';
    for (const p of par.split(' ')) {
      if ((r + (r ? ' ' : '') + p).length > 18) { righe.push(r); r = p; } else r += (r ? ' ' : '') + p;
    }
    righe.push(r);
  }
  const pag = [];
  for (let i = 0; i < righe.length; i += 2) pag.push(righe.slice(i, i + 2));
  return pag;
}

function aggiorna(dt, t) {
  const inp = input();
  if (Demo.premuto('h')) { modello = (modello + 1) % 3; disegnaCorpo(); }
  if (dialogo) {
    dialogo.car += dt * 38;
    const tot = dialogo.pag[dialogo.i].join('').length;
    if (inp.azione) {
      if (dialogo.car < tot) dialogo.car = tot;
      else if (++dialogo.i >= dialogo.pag.length) dialogo = null;
      else dialogo.car = 0;
    }
  } else if (scorre) {
    scorre.t += dt / 0.75;
    const k = Math.min(1, scorre.t);
    camX = scorre.x0 + (scorre.x1 - scorre.x0) * k; camY = scorre.y0 + (scorre.y1 - scorre.y0) * k;
    G.x += scorre.dx * dt * 22; G.y += scorre.dy * dt * 22; G.passo += dt * 8;
    if (k >= 1) scorre = null;
  } else {
    let dx = inp.x, dy = -inp.y;
    G.muove = !!(dx || dy);
    if (dy) G.dir = dy > 0 ? 0 : 1; else if (dx) G.dir = dx < 0 ? 2 : 3;
    const v = 58 * dt / (dx && dy ? 1.41 : 1);
    if (dx && libero(G.x + dx * v, G.y)) G.x += dx * v;
    if (dy && libero(G.x, G.y + dy * v)) G.y += dy * v;
    if (G.muove) G.passo += dt * 8; else G.passo = 0;
    // parlare: cartello o abitante davanti al naso
    if (inp.azione) {
      const fx = G.x + [0, 0, -12, 12][G.dir], fy = G.y - 3 + [12, -14, 0, 0][G.dir];
      const c = Math.floor(fx / TS), r = Math.floor(fy / TS);
      const cart = CARTELLI.find(k => k.c === c && k.r === r);
      const ab = PNG.find(p => Math.abs(p.x - fx) < 10 && Math.abs(p.y - 4 - fy) < 12);
      if (cart) dialogo = { pag: testoPagine(cart.testo), i: 0, car: 0 };
      else if (ab) { dialogo = { pag: testoPagine(TESTI_PNG[ab.img]), i: 0, car: 0 }; ab.dir = [1, 0, 3, 2][G.dir]; ab.vx = ab.vy = 0; ab.cambio = 2; }
    }
    // uscita dal bordo: la schermata scorre
    const sx = Math.floor(camX / W), sy = Math.floor(camY / PH);
    let nx = sx, ny = sy;
    if (G.x > (sx + 1) * W - 2) nx++; else if (G.x < sx * W + 2) nx--;
    else if (G.y > (sy + 1) * PH + 2) ny++; else if (G.y - 8 < sy * PH - 2) ny--;
    if ((nx !== sx || ny !== sy) && nx >= 0 && ny >= 0 && nx < 3 && ny < 2)
      scorre = { t: 0, x0: camX, y0: camY, x1: nx * W, y1: ny * PH, dx: nx - sx, dy: ny - sy };
  }
  // abitanti e animali passeggiano dentro la loro schermata
  for (const p of PNG) {
    p.cambio -= dt;
    if (p.cambio <= 0 && !dialogo) {
      p.cambio = 0.8 + Math.random() * 1.6;
      const k = Math.floor(Math.random() * 6);
      p.vx = [0, 0, -1, 1, 0, 0][k] * 22; p.vy = [1, -1, 0, 0, 0, 0][k] * 22;
      if (p.vx || p.vy) p.dir = p.vy > 0 ? 0 : p.vy < 0 ? 1 : p.vx < 0 ? 2 : 3;
    }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    const [zx, zy] = p.zona;
    const dentro = nx > zx * W + 10 && nx < (zx + 1) * W - 10 && ny > zy * PH + 18 && ny < (zy + 1) * PH - 4;
    const vicino = Math.abs(nx - G.x) < 12 && Math.abs(ny - G.y) < 10;
    if (dentro && !vicino && libero(nx, ny)) { p.x = nx; p.y = ny; p.passo += dt * 6; } else { p.vx = p.vy = 0; }
  }
  for (const a of ANIMALI) {
    a.t += dt; a.cambio -= dt;
    if (a.cambio <= 0) { a.cambio = 0.5 + Math.random() * 2; const k = Math.random(); a.vx = k < 0.3 ? -14 : k < 0.6 ? 14 : 0; a.vy = k > 0.8 ? (Math.random() < 0.5 ? -10 : 10) : 0; if (a.vx) a.flip = a.vx > 0; }
    const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
    const [zx, zy] = a.zona;
    if (nx > zx * W + 10 && nx < (zx + 1) * W - 10 && ny > zy * PH + 18 && ny < (zy + 1) * PH - 4 && libero(nx, ny, 8, 4)) { a.x = nx; a.y = ny; }
    else { a.vx = a.vy = 0; }
  }
}

// ── Disegno sul canvas a 4 livelli ──
const hash = (c, r) => { let h = c * 374761393 + r * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function tile(img, sc, sr, x, y, w = 1, h = 1, flip = false) {
  x = Math.round(x); y = Math.round(y);
  if (flip) { L.save(); L.translate(x + w * TS, y); L.scale(-1, 1); L.drawImage(IMG[img], sc * TS, sr * TS, w * TS, h * TS, 0, 0, w * TS, h * TS); L.restore(); }
  else L.drawImage(IMG[img], sc * TS, sr * TS, w * TS, h * TS, x, y, w * TS, h * TS);
}
const tipoSuolo = (c, r) => (c < 0 || r < 0 || c >= MC || r >= MR) ? -1 : suolo[r][c];
function disegnaMondo(t) {
  const cx = Math.round(camX), cy = Math.round(camY);
  L.fillStyle = '#fff'; L.fillRect(0, 0, W, PH);
  const c0 = Math.floor(cx / TS), r0 = Math.floor(cy / TS);
  for (let r = r0; r <= r0 + SR; r++) for (let c = c0; c <= c0 + SC; c++) {
    if (c < 0 || r < 0 || c >= MC || r >= MR) continue;
    const x = c * TS - cx, y = r * TS - cy;
    const v = suolo[r][c];
    const h = hash(c, r);
    if (v === 0) {
      // prato: quasi sempre pieno, qualche ciuffo sparso
      tile('floor', h < 0.6 ? 0 : h < 0.72 ? 1 : h < 0.84 ? 2 : h < 0.94 ? 3 : 4, 12, x, y);
    } else {
      const n = tipoSuolo(c, r - 1) === v, s = tipoSuolo(c, r + 1) === v, o = tipoSuolo(c - 1, r) === v, e = tipoSuolo(c + 1, r) === v;
      const tc = !o ? 0 : !e ? 2 : 1, tr = !n ? 0 : !s ? 2 : 1;
      if (v === 1) {
        tile('floor', 0, 12, x, y);
        tile('floor', tc, 7 + tr, x, y);
      } else {
        tile('floor', 0, 12, x, y);
        if (tc === 1 && tr === 1) tile('ripples', (Math.floor(t * 3 + h * 4)) % 4, 0, x, y);
        else tile('water', tc, 6 + tr, x, y);
      }
    }
  }
  // fiori: in Link's Awakening ondeggiano a scatti, qui si specchiano ogni mezzo secondo
  for (const f of FIORI) {
    const x = f.c * TS - cx, y = f.r * TS - cy;
    if (x < -16 || y < -16 || x > W || y > PH) continue;
    tile('nature', [0, 1, 3][f.k], 11, x, y, 1, 1, Math.floor(t * 2 + f.c) % 2 === 1);
  }
  for (const o of OGG) {
    const x = o.c * TS - cx, y = o.r * TS - cy;
    if (x > W || y > PH || x + o.w * TS < 0 || y + o.h * TS < 0) continue;
    tile(o.img, o.sc, o.sr, x, y, o.w, o.h);
  }
  // personaggi ordinati per quota
  const tutti = [...PNG.map(p => ({ y: p.y, f: () => omino(p.img, p.dir, p.passo, p.x, p.y, p.vx || p.vy) })),
    ...ANIMALI.map(a => ({ y: a.y, f: () => bestiola(a) })),
    { y: G.y, f: () => omino('boy', G.dir, G.passo, G.x, G.y, G.muove || scorre) }];
  tutti.sort((a, b) => a.y - b.y).forEach(o => o.f());

  function omino(img, dir, passo, x, y, cammina) {
    const fr = cammina ? Math.floor(passo) % 4 : 0;
    L.drawImage(IMG[img], dir * 16, fr * 16, 16, 16, Math.round(x - 8 - cx), Math.round(y - 15 - cy), 16, 16);
  }
  function bestiola(a) {
    const fr = Math.floor(a.t * (a.vx || a.vy ? 6 : 2)) % 2;
    const x = Math.round(a.x - 8 - cx), y = Math.round(a.y - 14 - cy);
    if (a.flip) { L.save(); L.translate(x + 16, y); L.scale(-1, 1); L.drawImage(IMG[a.img], fr * 16, 0, 16, 16, 0, 0, 16, 16); L.restore(); }
    else L.drawImage(IMG[a.img], fr * 16, 0, 16, 16, x, y, 16, 16);
  }
}

// Caratteri 8×8 del pacchetto: ASCII da 32, poi le accentate nell'ordine della code page 437
const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûù';
function scrivi(s, x, y, chiaro = false) {
  const im = chiaro ? FONT_CHIARO : IMG.font;
  for (const ch of s) {
    let i = ch.charCodeAt(0) - 32;
    const k = CP437.indexOf(ch);
    if (k >= 0) i = 96 + k; else if (i < 0 || i > 94) i = 31;
    L.drawImage(im, (i % 15) * 8, Math.floor(i / 15) * 8, 8, 8, x, y, 8, 8);
    x += 8;
  }
}
function cornice(x, y, w, h) {
  L.fillStyle = '#000'; L.fillRect(x, y, w, h);
  L.fillStyle = '#fff'; L.fillRect(x + 2, y + 2, w - 4, 1); L.fillRect(x + 2, y + h - 3, w - 4, 1);
  L.fillRect(x + 2, y + 2, 1, h - 4); L.fillRect(x + w - 3, y + 2, 1, h - 4);
}
function disegnaDialogo(t) {
  if (!dialogo) return;
  const y = G.y - camY > PH * 0.55 ? 4 : PH - 44;
  cornice(4, y, W - 8, 40);
  let resta = Math.floor(dialogo.car);
  dialogo.pag[dialogo.i].forEach((riga, k) => {
    const pezzo = riga.slice(0, Math.max(0, resta)); resta -= riga.length;
    scrivi(pezzo, 8, y + 8 + k * 14, true);
  });
  const tot = dialogo.pag[dialogo.i].join('').length;
  if (dialogo.car >= tot && Math.floor(t * 3) % 2 === 0) {
    L.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) L.fillRect(W - 16 + i, y + 31 + i, 7 - i * 2, 1);
  }
}
// barra in basso come in Link's Awakening: tasti B e A con l'oggetto, monete, cuori
const CUORE = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
function disegnaHud() {
  const y = PH;
  L.fillStyle = '#fff'; L.fillRect(0, y, W, HUD);
  L.fillStyle = '#000'; L.fillRect(0, y, W, 1);
  // tasti B e A
  scrivi('B', 2, y + 5);
  L.fillStyle = '#000'; L.fillRect(10, y + 3, 26, 11); L.fillStyle = '#fff'; L.fillRect(11, y + 4, 24, 9);
  // scudo
  L.fillStyle = '#555'; L.fillRect(18, y + 5, 7, 5); L.fillRect(19, y + 10, 5, 1); L.fillRect(20, y + 11, 3, 1);
  L.fillStyle = '#000'; L.fillRect(21, y + 6, 1, 4);
  scrivi('A', 40, y + 5);
  L.fillStyle = '#000'; L.fillRect(48, y + 3, 26, 11); L.fillStyle = '#fff'; L.fillRect(49, y + 4, 24, 9);
  // spada
  L.fillStyle = '#000'; L.fillRect(55, y + 8, 12, 1); L.fillRect(53, y + 6, 1, 5); L.fillRect(51, y + 8, 2, 1);
  L.fillStyle = '#555'; L.fillRect(56, y + 7, 10, 1);
  // monete
  L.fillStyle = '#000'; L.fillRect(80, y + 4, 5, 9); L.fillStyle = '#aaa'; L.fillRect(81, y + 5, 3, 7);
  L.fillStyle = '#fff'; L.fillRect(81, y + 6, 1, 3);
  scrivi('042', 86, y + 5);
  // cuori
  for (let k = 0; k < 3; k++) for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (CUORE[r][c] === '1') {
    L.fillStyle = k < 2 ? '#000' : (r + c) % 2 ? '#000' : '#aaa';
    L.fillRect(116 + k * 9 + c, y + 5 + r, 1, 1);
  }
  scrivi('', 0, 0);
}

// ── Cristalli liquidi: il fotogramma nuovo si fa strada lentamente ──
function lcdPasso(dt) {
  const px = L.getImageData(0, 0, W, H).data;
  const kScuro = dt > 0 ? 1 - Math.exp(-dt / 0.035) : 0;
  const kChiaro = dt > 0 ? 1 - Math.exp(-dt / 0.085) : 0;
  for (let i = 0, j = 0; i < W * H; i++, j += 4) {
    const bersaglio = Math.round(px[j] / 85) / 3;
    const d = bersaglio - disp[i];
    disp[i] += d * (d < 0 ? kScuro : kChiaro);
    bytes[i] = disp[i] * 255 + 0.5;
  }
}
function lcdMostra(t) {
  const M = MODELLI[modello];
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
  const dpr = schermo.width / (W * S);
  gl.uniform1f(U('S'), S * dpr);
  M.pal.forEach((c, i) => gl.uniform3fv(U('P' + i), rgb(c)));
  gl.uniform3fv(U('F'), rgb(M.fondo));
  gl.uniform1f(U('luce'), M.luce); gl.uniform1f(U('ombra'), M.ombra); gl.uniform1f(U('tempo'), t);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

async function avvia() {
  let n = 0;
  await Promise.all(NOMI.map(k => carica(k).then(() => Demo.carica('Carico i tile', ++n / NOMI.length))));
  FONT_CHIARO = document.createElement('canvas'); FONT_CHIARO.width = IMG.font.width; FONT_CHIARO.height = IMG.font.height;
  const fg = FONT_CHIARO.getContext('2d'); fg.drawImage(IMG.font, 0, 0); fg.globalCompositeOperation = 'source-in'; fg.fillStyle = '#fff'; fg.fillRect(0, 0, 999, 999);
  costruisciMondo();
  png('villager', 4, 7, [0, 0]); png('woman', 8, 6, [0, 0]); png('oldman', 24, 4, [2, 0]); png('villager', 16, 11, [1, 1]);
  animale('chicken', 14, 7, [1, 0]); animale('chicken', 18, 7, [1, 0]); animale('cat', 5, 11, [0, 1]); animale('chicken', 7, 6, [0, 0]);
  if (pilota) { G.x = 5 * TS + 8; G.y = 7 * TS + 3; G.dir = 1; }
  if (Demo.query.has('schermata')) {   // per il collaudo: ?schermata=1,0
    const [a, b] = Demo.query.get('schermata').split(',').map(Number);
    camX = a * W; camY = b * PH; G.x = a * W + 72; G.y = b * PH + 110;
  }
  disegnaCorpo();
  addEventListener('resize', disegnaCorpo);
  Demo.extra('<p>H cambia modello: <b>DMG</b> (verde, 1989), <b>Pocket</b> (grigio, 1996), <b>Light</b> (turchese retroilluminato, 1998).</p>');
  Demo.loop((dt, t) => {
    if (dt > 0) { aggiorna(dt, t); fotogramma++; }
    L.imageSmoothingEnabled = false;
    disegnaMondo(t);
    disegnaDialogo(t);
    disegnaHud();
    if (dt > 0 || !lcdPasso.fatto) { lcdPasso(dt > 0 ? dt : 1); lcdPasso.fatto = true; }
    lcdMostra(t);
  });
  Demo.pronto();
}
avvia().catch(e => Demo.errore(e));
