// Vettoriale CRT — omaggio ad Asteroids (1979).
// Il gioco produce solo segmenti; WebGL2 li disegna come fascio di elettroni gaussiano in un
// buffer a virgola mobile, li accumula nel fosforo (due persistenze: breve e lunga), aggiunge
// il bagliore a tre scale e infine piega l'immagine sul vetro curvo del tubo.

// ─────────────────────────── Casualità ripetibile ───────────────────────────
let seme = 20260926;
const rnd = () => { seme |= 0; seme = seme + 0x6D2B79F5 | 0; let x = Math.imul(seme ^ seme >>> 15, 1 | seme);
  x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();
// rumore del fascio: generatore separato, così il gioco resta uguale a prescindere dal disegno
let semeF = 7; const rf = () => { semeF = (semeF * 16807) % 2147483647; return semeF / 2147483647; };

// ─────────────────────────── WebGL2 ───────────────────────────
const canvas = document.createElement('canvas');
document.body.prepend(canvas);
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: Demo.shot, alpha: false });
if (!gl) throw new Error('Serve WebGL2');
if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float'))
  throw new Error('Il browser non sa disegnare in buffer a virgola mobile');

function shader(tipo, src) {
  const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
  return s;
}
function programma(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

// Fascio: ogni segmento è un'istanza, espansa in un rettangolo attorno alla capsula.
const VS_FASCIO = `#version 300 es
in vec4 aSeg; in vec4 aCol;
uniform vec2 uRes;
out vec2 vP; flat out vec4 vSeg; flat out vec4 vCol;
void main(){
  int id = gl_VertexID;
  vec2 c = vec2((id==1||id==2||id==4) ? 1.0 : -1.0, (id==2||id==4||id==5) ? 1.0 : -1.0);
  vec2 a = aSeg.xy, b = aSeg.zw, d = b - a;
  float L = length(d); vec2 dir = L > 1e-4 ? d / L : vec2(1.0, 0.0); vec2 n = vec2(-dir.y, dir.x);
  float R = aCol.w * 3.6;
  vec2 p = (c.x < 0.0 ? a : b) + dir * c.x * R + n * c.y * R;
  vP = p; vSeg = aSeg; vCol = aCol;
  vec2 q = p / uRes * 2.0 - 1.0; gl_Position = vec4(q.x, -q.y, 0.0, 1.0);
}`;
const FS_FASCIO = `#version 300 es
precision highp float;
in vec2 vP; flat in vec4 vSeg; flat in vec4 vCol;
uniform vec3 uTinta[8];
out vec4 o;
void main(){
  vec2 a = vSeg.xy, b = vSeg.zw, pa = vP - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  float d = length(pa - ba * h);
  float s = vCol.w;
  float I = exp(-d * d / (2.0 * s * s)) + 0.10 * exp(-d / (s * 2.2)); // nucleo gaussiano + piede
  o = vec4(vCol.rgb * I, 1.0);
}`;
const VS_PIENO = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
// Fosforo: la scia vecchia sbiadisce, il fascio di adesso ci deposita energia.
const FS_FOSFORO = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uScia, uFascio; uniform float uDeposito, uDecad; out vec4 o;
void main(){ o = vec4((texture(uScia, vUv).rgb + texture(uFascio, vUv).rgb * uDeposito) * uDecad, 1.0); }`;
const FS_HDR = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uFascio, uBreve, uLunga; uniform float uGuad; out vec4 o;
void main(){
  vec3 lunga = texture(uLunga, vUv).rgb;
  float l = dot(lunga, vec3(0.3, 0.5, 0.2));
  // la coda lunga del fosforo vira al verde-giallo, come un P7
  vec3 c = texture(uFascio, vUv).rgb + texture(uBreve, vUv).rgb + l * vec3(0.55, 1.0, 0.45);
  o = vec4(c * uGuad, 1.0);
}`;
const FS_SFOCA = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){
  const float w[5] = float[](0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);
  vec3 c = texture(uTex, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture(uTex, vUv + uDir * float(i)).rgb * w[i];
    c += texture(uTex, vUv - uDir * float(i)).rgb * w[i];
  }
  o = vec4(c, 1.0);
}`;
const FS_COPIA = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ // riduzione a 4 campioni: niente scintillio quando le linee sottili si muovono
  vec3 c = texture(uTex, vUv + uTexel * vec2(-0.5,-0.5)).rgb + texture(uTex, vUv + uTexel * vec2(0.5,-0.5)).rgb
         + texture(uTex, vUv + uTexel * vec2(-0.5,0.5)).rgb + texture(uTex, vUv + uTexel * vec2(0.5,0.5)).rgb;
  o = vec4(c * 0.25, 1.0);
}`;
const FS_FINALE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uHdr, uB1, uB2, uB3;
uniform vec2 uRes; uniform float uT, uFlick;
out vec4 o;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec2 cc = vUv - 0.5;
  float asp = uRes.x / uRes.y;
  // vetro curvo: le coordinate si allargano verso i bordi, le linee dritte si piegano
  vec2 w = cc * (1.0 + vec2(0.11 * cc.y * cc.y, 0.17 * cc.x * cc.x));
  vec2 uv = w + 0.5;
  // bordo del tubo: rettangolo con gli angoli molto arrotondati
  vec2 q = abs(w) * 2.0; vec2 rq = vec2(q.x * asp, q.y);
  vec2 dd = max(rq - vec2(asp - 0.16, 1.0 - 0.16), 0.0);
  float bordo = length(dd) - 0.16;
  float dentro = 1.0 - smoothstep(-0.012, 0.0, bordo);

  vec3 hdr = texture(uHdr, uv).rgb;
  vec3 bloom = texture(uB1, uv).rgb * 0.9 + texture(uB2, uv).rgb * 0.9 + texture(uB3, uv).rgb * 1.2;
  vec3 c = (hdr + bloom) * uFlick;
  c = 1.0 - exp(-c * 1.15);                         // il nucleo satura verso il bianco, l'alone resta colorato

  // fondo del fosforo: nero-blu, un poco più chiaro al centro, con la grana del rivestimento
  float r2 = dot(cc * vec2(asp, 1.0), cc * vec2(asp, 1.0));
  vec3 fondo = mix(vec3(0.020, 0.028, 0.048), vec3(0.006, 0.008, 0.016), smoothstep(0.0, 0.9, r2));
  float grana = hash(floor(vUv * uRes) + floor(uT * 60.0) * 0.37);
  fondo += (grana - 0.5) * 0.010;
  c += fondo;

  // riflesso del vetro: una finestra lontana in alto a sinistra e una banda diagonale morbida
  vec2 hp = (vUv - vec2(0.24, 0.80)) * vec2(asp, 1.0);
  float macchia = exp(-dot(hp, hp) * 9.0) * 0.050;
  float banda = smoothstep(0.10, 0.0, abs((vUv.x * asp * 0.55 + vUv.y) - 1.28)) * 0.018;
  c += vec3(0.62, 0.72, 0.9) * (macchia + banda);

  // vignettatura sul vetro
  vec2 vv = uv * (1.0 - uv);
  c *= pow(clamp(vv.x * vv.y * 16.0, 0.0, 1.0), 0.22);
  c *= dentro;
  // cornice: plastica nera che raccoglie un filo del bagliore
  vec3 cornice = vec3(0.012, 0.012, 0.016) + bloom * 0.020 * (1.0 - dentro);
  c += cornice * (1.0 - dentro) * smoothstep(0.08, 0.0, bordo);
  o = vec4(c, 1.0);
}`;

const pFascio = programma(VS_FASCIO, FS_FASCIO);
const pFosforo = programma(VS_PIENO, FS_FOSFORO);
const pHdr = programma(VS_PIENO, FS_HDR);
const pSfoca = programma(VS_PIENO, FS_SFOCA);
const pCopia = programma(VS_PIENO, FS_COPIA);
const pFinale = programma(VS_PIENO, FS_FINALE);

const MAXSEG = 12000;
const datiSeg = new Float32Array(MAXSEG * 8);
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
const bufSeg = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, bufSeg);
gl.bufferData(gl.ARRAY_BUFFER, datiSeg.byteLength, gl.DYNAMIC_DRAW);
const locSeg = gl.getAttribLocation(pFascio.p, 'aSeg'), locCol = gl.getAttribLocation(pFascio.p, 'aCol');
gl.enableVertexAttribArray(locSeg); gl.vertexAttribPointer(locSeg, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(locSeg, 1);
gl.enableVertexAttribArray(locCol); gl.vertexAttribPointer(locCol, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(locCol, 1);
const vaoVuoto = gl.createVertexArray();

function fbo(w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  return { f, tex, w, h };
}
let RT = null;
let PW = 1, PH = 1;
function ridimensiona() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const nw = Math.round(innerWidth * dpr), nh = Math.round(innerHeight * dpr);
  if (RT && nw === PW && nh === PH) return;
  PW = nw; PH = nh;
  canvas.width = PW; canvas.height = PH;
  if (RT) for (const k in RT) { gl.deleteTexture(RT[k].tex); gl.deleteFramebuffer(RT[k].f); }
  const h2 = [PW >> 1, PH >> 1], h4 = [PW >> 2, PH >> 2], h8 = [PW >> 3, PH >> 3];
  RT = {
    fascio: fbo(PW, PH), breveA: fbo(PW, PH), breveB: fbo(PW, PH), lungaA: fbo(h2[0], h2[1]), lungaB: fbo(h2[0], h2[1]),
    hdr: fbo(PW, PH),
    b1: fbo(...h2), b1t: fbo(...h2), b2: fbo(...h4), b2t: fbo(...h4), b3: fbo(...h8), b3t: fbo(...h8),
  };
  mondo.W = mondo.H * PW / PH;
}

function pieno(prog, dest, tex, uni) {
  gl.useProgram(prog.p);
  gl.bindFramebuffer(gl.FRAMEBUFFER, dest ? dest.f : null);
  gl.viewport(0, 0, dest ? dest.w : PW, dest ? dest.h : PH);
  let unit = 0;
  for (const [nome, t] of Object.entries(tex)) {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.uniform1i(prog.u[nome], unit); unit++;
  }
  for (const [nome, v] of Object.entries(uni || {})) {
    if (typeof v === 'number') gl.uniform1f(prog.u[nome], v); else gl.uniform2fv(prog.u[nome], v);
  }
  gl.bindVertexArray(vaoVuoto);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// ─────────────────────────── Elenco dei segmenti del fotogramma ───────────────────────────
let nSeg = 0, SC = 1;            // SC: pixel per unità di mondo
let jit = 0.35;                  // tremolio del fascio in pixel
function segP(x1, y1, x2, y2, c, i, sig) {   // in pixel
  if (nSeg >= MAXSEG) return;
  const o = nSeg * 8, j = jit, g = i * (0.93 + rf() * 0.14);
  datiSeg[o] = x1 + (rf() - 0.5) * j; datiSeg[o + 1] = y1 + (rf() - 0.5) * j;
  datiSeg[o + 2] = x2 + (rf() - 0.5) * j; datiSeg[o + 3] = y2 + (rf() - 0.5) * j;
  datiSeg[o + 4] = c[0] * g; datiSeg[o + 5] = c[1] * g; datiSeg[o + 6] = c[2] * g; datiSeg[o + 7] = sig;
  nSeg++;
}
const SIG = () => Math.max(0.95, PH / 720 * 1.05);
function linea(x1, y1, x2, y2, c, i = 1) { segP(x1 * SC, y1 * SC, x2 * SC, y2 * SC, c, i, SIG()); }
function punto(x, y, c, i = 1, s = 1) { segP(x * SC, y * SC, x * SC, y * SC, c, i, SIG() * s); }
// Polilinea: dove il fascio cambia direzione si ferma un istante e lì il fosforo è più acceso.
function poli(pts, c, i = 1, chiusa = false) {
  const n = pts.length;
  for (let k = 0; k < n - 1 + (chiusa ? 1 : 0); k++) {
    const a = pts[k], b = pts[(k + 1) % n];
    linea(a[0], a[1], b[0], b[1], c, i);
  }
  for (let k = 0; k < n; k++) punto(pts[k][0], pts[k][1], c, i * 0.55, 1.25);
}

// ─────────────────────────── Carattere vettoriale ───────────────────────────
// Ogni lettera è una lista di tratti su una griglia 4×6, come la ROM dei caratteri dei giochi vettoriali.
const R0 = [[0, 0], [4, 0], [4, 6], [0, 6], [0, 0]];
const FONT = {
  '0': [R0, [[4, 0], [0, 6]]], '1': [[[2, 0], [2, 6]]], '2': [[[0, 0], [4, 0], [4, 3], [0, 3], [0, 6], [4, 6]]],
  '3': [[[0, 0], [4, 0], [4, 6], [0, 6]], [[0, 3], [4, 3]]], '4': [[[0, 0], [0, 3], [4, 3]], [[4, 0], [4, 6]]],
  '5': [[[4, 0], [0, 0], [0, 3], [4, 3], [4, 6], [0, 6]]], '6': [[[0, 0], [0, 6], [4, 6], [4, 3], [0, 3]]],
  '7': [[[0, 0], [4, 0], [4, 6]]], '8': [R0, [[0, 3], [4, 3]]], '9': [[[4, 3], [0, 3], [0, 0], [4, 0], [4, 6]]],
  A: [[[0, 6], [0, 2], [2, 0], [4, 2], [4, 6]], [[0, 4], [4, 4]]],
  B: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [0, 6]]],
  C: [[[4, 0], [0, 0], [0, 6], [4, 6]]], D: [[[0, 0], [2, 0], [4, 2], [4, 4], [2, 6], [0, 6], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]], F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [4, 0], [0, 0], [0, 6], [4, 6], [4, 4], [2, 4]]], H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[0, 0], [4, 0]], [[2, 0], [2, 6]], [[0, 6], [4, 6]]], J: [[[4, 0], [4, 6], [2, 6], [0, 4]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3], [4, 6]]], L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 2], [4, 0], [4, 6]]], N: [[[0, 6], [0, 0], [4, 6], [4, 0]]], O: [R0],
  P: [[[0, 6], [0, 0], [4, 0], [4, 3], [0, 3]]], Q: [[[0, 0], [4, 0], [4, 4], [2, 6], [0, 6], [0, 0]], [[2, 4], [4, 6]]],
  R: [[[0, 6], [0, 0], [4, 0], [4, 3], [0, 3], [4, 6]]], S: [[[4, 0], [0, 0], [0, 3], [4, 3], [4, 6], [0, 6]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]], U: [[[0, 0], [0, 6], [4, 6], [4, 0]]], V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [0, 6], [2, 4], [4, 6], [4, 0]]], X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 2], [4, 0]], [[2, 2], [2, 6]]], Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  '-': [[[1, 3], [3, 3]]], '.': [[[2, 6], [2, 5.7]]], ' ': [],
};
function testo(s, x, y, dim, c, i = 1, allinea = 'sx') {
  const u = dim / 6, passo = 6 * u, larg = s.length * passo - 2 * u;
  let x0 = allinea === 'centro' ? x - larg / 2 : allinea === 'dx' ? x - larg : x;
  for (const ch of s) {
    for (const tratto of FONT[ch] || []) poli(tratto.map(p => [x0 + p[0] * u, y + p[1] * u]), c, i);
    x0 += passo;
  }
}

// ─────────────────────────── Gioco ───────────────────────────
const mondo = { W: 1400, H: 780 };
const COL = {
  roccia: [0.72, 0.84, 1.0], nave: [0.45, 1.0, 0.92], ufo: [1.0, 0.42, 0.86], proiet: [1, 1, 1],
  testo: [0.78, 0.9, 1.0], scintilla: [1.0, 0.72, 0.42], fiamma: [1.0, 0.62, 0.35],
};
const G = {
  nave: null, rocce: [], colpi: [], colpiUfo: [], ufo: null, part: [], rottami: [],
  punti: 0, record: 12470, vite: 3, ondata: 0, rinasci: 0, fine: 0, timerUfo: 3, auto: true,
  prossimaVita: 10000, cadenza: 0, iper: 0, shiftPulito: false, lampeggio: 0,
};
const MODELLI_ROCCIA = [];
for (let m = 0; m < 4; m++) {
  const n = 10 + (m % 2), pts = [];
  const tacca = Math.floor(rr(0, n));
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + rr(-0.12, 0.12);
    let r = rr(0.74, 1.0);
    if (k === tacca || (m > 1 && k === (tacca + 5) % n)) r = rr(0.5, 0.6);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  MODELLI_ROCCIA.push(pts);
}
const RAGGI = [0, 17, 32, 62];
const dx = (a, b) => { let d = b - a; const W = mondo.W; if (d > W / 2) d -= W; if (d < -W / 2) d += W; return d; };
const dy = (a, b) => { let d = b - a; const H = mondo.H; if (d > H / 2) d -= H; if (d < -H / 2) d += H; return d; };
const avvolgi = o => { o.x = (o.x % mondo.W + mondo.W) % mondo.W; o.y = (o.y % mondo.H + mondo.H) % mondo.H; };

function nuovaNave() { return { x: mondo.W / 2, y: mondo.H / 2, vx: 0, vy: 0, a: -Math.PI / 2, spinta: false, vivo: true }; }
function roccia(x, y, taglia, vel) {
  const a = rr(0, Math.PI * 2), v = vel || rr(...[[0, 0], [95, 150], [65, 105], [35, 65]][taglia]);
  return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, taglia, r: RAGGI[taglia], m: MODELLI_ROCCIA[Math.floor(rr(0, 4))],
    rot: rr(-0.4, 0.4), ang: rr(0, 6.28) };
}
function nuovaOndata() {
  G.ondata++;
  const n = Math.min((G.auto ? 6 : 3) + G.ondata, 11);
  for (let i = 0; i < n; i++) {
    let x, y;
    do { x = rr(0, mondo.W); y = rr(0, mondo.H); } while (Math.hypot(dx(G.nave.x, x), dy(G.nave.y, y)) < 260);
    G.rocce.push(roccia(x, y, 3));
  }
}
function nuovaPartita(auto) {
  G.rocce = []; G.colpi = []; G.colpiUfo = []; G.ufo = null; G.part = []; G.rottami = [];
  G.punti = 0; G.vite = 3; G.ondata = 0; G.rinasci = 0; G.fine = 0; G.timerUfo = auto ? 2.3 : 12; G.primoUfo = auto; G.auto = auto;
  G.prossimaVita = 10000; G.nave = nuovaNave();
  nuovaOndata();
}
function esplosione(x, y, n, vmax, col = COL.scintilla, vita = 0.9) {
  for (let i = 0; i < n; i++) {
    const a = rr(0, 6.283), v = rr(20, vmax);
    G.part.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vita: rr(vita * 0.5, vita), col });
  }
}
function segna(p) {
  G.punti += p;
  if (G.punti >= G.prossimaVita) { G.vite++; G.prossimaVita += 10000; }
  if (G.punti > G.record) G.record = G.punti;
}
function spezza(r, idx) {
  G.rocce.splice(idx, 1);
  segna([0, 100, 50, 20][r.taglia]);
  esplosione(r.x, r.y, 6 + r.taglia * 4, 60 + r.taglia * 30, COL.roccia, 0.7);
  if (r.taglia > 1) for (let k = 0; k < 2; k++) {
    const f = roccia(r.x, r.y, r.taglia - 1);
    f.vx += r.vx * 0.4; f.vy += r.vy * 0.4;
    G.rocce.push(f);
  }
}
function nave_muore() {
  const n = G.nave;
  n.vivo = false;
  esplosione(n.x, n.y, 20, 180, COL.nave, 1.2);
  // i cinque tratti dello scafo se ne vanno ciascuno per conto suo, ruotando
  for (const [a, b] of formaNave(n)) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, an = rr(0, 6.28), v = rr(15, 60);
    G.rottami.push({ x: mx, y: my, hx: (b[0] - a[0]) / 2, hy: (b[1] - a[1]) / 2, vx: n.vx * 0.3 + Math.cos(an) * v,
      vy: n.vy * 0.3 + Math.sin(an) * v, w: rr(-3, 3), ang: 0, t: 0, vita: rr(1.4, 2.4) });
  }
  G.vite--;
  if (G.vite <= 0) G.fine = 5; else G.rinasci = 2.4;
}
function formaNave(n) {
  const c = Math.cos(n.a), s = Math.sin(n.a);
  const T = (x, y) => [n.x + (x * c - y * s) * 1.35, n.y + (x * s + y * c) * 1.35];
  const naso = T(16, 0), sx = T(-11, -10), dxx = T(-11, 10), bs = T(-6.5, -7.8), bd = T(-6.5, 7.8);
  return [[naso, sx], [naso, dxx], [bs, bd]];
}

// Pilota automatico della modalità attrazione: mira col tempo di volo e spara.
function pilota(dt) {
  const n = G.nave; const cmd = { giro: 0, spinta: false, fuoco: false };
  if (!n.vivo) return cmd;
  let best = null, bd = 1e9;
  const bersagli = G.rocce;   // il disco volante lo lascia al giocatore
  for (const r of bersagli) {
    const d = Math.hypot(dx(n.x, r.x), dy(n.y, r.y)) - r.r * (r === G.ufo ? 3 : 1);
    if (d < bd) { bd = d; best = r; }
  }
  if (!best) return cmd;
  const ddx = dx(n.x, best.x), ddy = dy(n.y, best.y), tv = Math.hypot(ddx, ddy) / 640;
  const mira = Math.atan2(ddy + best.vy * tv, ddx + best.vx * tv);
  let diff = mira - n.a; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  cmd.giro = Math.abs(diff) > 0.04 ? Math.sign(diff) : 0;
  cmd.fuoco = Math.abs(diff) < 0.14 && bd < 520;
  cmd.spinta = Math.hypot(n.vx, n.vy) < 40 && bd > 260 && Math.abs(diff) < 0.5;
  return cmd;
}

function aggiorna(dt, t) {
  const n = G.nave, W = mondo.W, H = mondo.H;
  // ── comandi ──
  const asse = Demo.asse();
  const umanoOra = asse.x || asse.y || Demo.premuto(' ') || Demo.premuto('Shift') || (Demo.pad.rt > 0.3);
  if (G.auto && umanoOra) { nuovaPartita(false); return; }
  let cmd;
  if (G.auto) cmd = pilota(dt);
  else cmd = { giro: asse.x, spinta: asse.y > 0.3 || Demo.pad.rt > 0.3, fuoco: Demo.premuto(' ') };
  // iperspazio: Maiusc lasciato senza aver premuto altro (Maiusc+F è del guscio)
  if (!G.auto) {
    if (Demo.premuto('Shift')) G.shiftPulito = true;
    if (Demo.giu('Shift') && Demo.giu('f')) G.shiftPulito = false;
    if (G.shiftPulito && !Demo.giu('Shift')) { G.shiftPulito = false; if (n.vivo && G.iper <= 0) G.iper = 0.6; }
  }
  if (G.iper > 0) {
    G.iper -= dt;
    if (n.vivo && G.iper <= 0.45 && !n.saltato) {
      n.saltato = true; esplosione(n.x, n.y, 10, 90, COL.nave, 0.4);
      n.x = rr(60, W - 60); n.y = rr(60, H - 60); n.vx = n.vy = 0; n.nascosto = true;
    }
    if (G.iper <= 0) { n.saltato = false; n.nascosto = false; esplosione(n.x, n.y, 8, 70, COL.nave, 0.35); }
  }
  // ── nave ──
  if (n.vivo && !n.nascosto) {
    n.a += cmd.giro * 4.4 * dt;
    n.spinta = cmd.spinta;
    if (n.spinta) { n.vx += Math.cos(n.a) * 430 * dt; n.vy += Math.sin(n.a) * 430 * dt; }
    const att = Math.exp(-0.55 * dt); n.vx *= att; n.vy *= att;
    const v = Math.hypot(n.vx, n.vy); if (v > 560) { n.vx *= 560 / v; n.vy *= 560 / v; }
    n.x += n.vx * dt; n.y += n.vy * dt; avvolgi(n);
    G.cadenza -= dt;
    if (cmd.fuoco && G.colpi.length < 4 && G.cadenza <= 0) {
      G.cadenza = G.auto ? 0.2 : 0.06;
      G.colpi.push({ x: n.x + Math.cos(n.a) * 16, y: n.y + Math.sin(n.a) * 16, vx: n.vx + Math.cos(n.a) * 640,
        vy: n.vy + Math.sin(n.a) * 640, t: 0.95 });
    }
  }
  // ── rinascita e fine partita ──
  if (!n.vivo && G.rinasci > 0) {
    G.rinasci -= dt;
    if (G.rinasci <= 0) {
      const libero = G.rocce.every(r => Math.hypot(dx(W / 2, r.x), dy(H / 2, r.y)) > r.r + 110);
      if (libero) G.nave = nuovaNave(); else G.rinasci = 0.2;
    }
  }
  if (G.fine > 0) { G.fine -= dt; if (G.fine <= 0) nuovaPartita(true); }
  // ── oggetti ──
  for (const c of [...G.colpi, ...G.colpiUfo]) { c.x += c.vx * dt; c.y += c.vy * dt; c.t -= dt; avvolgi(c); }
  G.colpi = G.colpi.filter(c => c.t > 0); G.colpiUfo = G.colpiUfo.filter(c => c.t > 0);
  for (const r of G.rocce) { r.x += r.vx * dt; r.y += r.vy * dt; r.ang += r.rot * dt; avvolgi(r); }
  for (const p of G.part) { p.x += p.vx * dt; p.y += p.vy * dt; p.t += dt; const a = Math.exp(-1.2 * dt); p.vx *= a; p.vy *= a; }
  G.part = G.part.filter(p => p.t < p.vita);
  for (const r of G.rottami) { r.x += r.vx * dt; r.y += r.vy * dt; r.ang += r.w * dt; r.t += dt; }
  G.rottami = G.rottami.filter(r => r.t < r.vita);
  // ── disco volante ──
  G.timerUfo -= dt;
  if (!G.ufo && G.timerUfo <= 0) {
    const piccolo = G.punti > 8000 || rnd() < 0.3, sx = rnd() < 0.5;
    const primo = G.primoUfo, entra = primo ? W * 0.12 : 0; G.primoUfo = false;
    G.ufo = { x: sx ? -20 + entra : W + 20 - entra, y: rr(H * 0.2, H * 0.8), vx: (sx ? 1 : -1) * (piccolo ? 150 : 110), vy: 0,
      piccolo: primo ? false : piccolo, r: primo ? 20 : piccolo ? 11 : 20, cambio: 1.2, tiro: 0.8, dist: entra, fantasma: primo };
    if (primo) G.ufo.y = H * 0.3;
  }
  if (G.ufo) {
    const u = G.ufo;
    u.x += u.vx * dt; u.y += u.vy * dt; u.dist += Math.abs(u.vx * dt);
    u.y = (u.y % H + H) % H;
    u.cambio -= dt; if (u.cambio <= 0) { u.cambio = rr(0.8, 1.6); u.vy = [-1, 0, 1][Math.floor(rr(0, 3))] * 70; }
    u.tiro -= dt;
    if (u.tiro <= 0 && n.vivo) {
      u.tiro = u.piccolo ? 0.8 : 1.1;
      let a = rr(0, 6.28);
      if (u.piccolo || rnd() < 0.35) a = Math.atan2(dy(u.y, n.y), dx(u.x, n.x)) + rr(-0.15, 0.15);
      G.colpiUfo.push({ x: u.x, y: u.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, t: 1.1 });
    }
    if (u.dist > W + 60) { G.ufo = null; G.timerUfo = rr(8, 14); }
  }
  // ── urti ──
  for (let i = G.colpi.length - 1; i >= 0; i--) {
    const c = G.colpi[i];
    let preso = false;
    for (let j = G.rocce.length - 1; j >= 0; j--) {
      const r = G.rocce[j];
      if (Math.hypot(dx(c.x, r.x), dy(c.y, r.y)) < r.r * 0.92) { spezza(r, j); preso = true; break; }
    }
    if (!preso && G.ufo && Math.hypot(dx(c.x, G.ufo.x), dy(c.y, G.ufo.y)) < G.ufo.r) {
      segna(G.ufo.piccolo ? 1000 : 200); esplosione(G.ufo.x, G.ufo.y, 22, 160, COL.ufo, 1.1);
      G.ufo = null; G.timerUfo = rr(7, 12); preso = true;
    }
    if (preso) G.colpi.splice(i, 1);
  }
  if (G.ufo && !G.ufo.fantasma) for (let j = G.rocce.length - 1; j >= 0; j--) {
    const r = G.rocce[j];
    if (Math.hypot(dx(G.ufo.x, r.x), dy(G.ufo.y, r.y)) < r.r + G.ufo.r * 0.8) {
      spezza(r, j); esplosione(G.ufo.x, G.ufo.y, 22, 160, COL.ufo, 1.1); G.ufo = null; G.timerUfo = rr(7, 12); break;
    }
  }
  for (let j = G.rocce.length - 1; j >= 0; j--) {
    const r = G.rocce[j];
    for (let i = G.colpiUfo.length - 1; i >= 0; i--) {
      const c = G.colpiUfo[i];
      if (Math.hypot(dx(c.x, r.x), dy(c.y, r.y)) < r.r * 0.92) { G.colpiUfo.splice(i, 1); spezza(r, j); break; }
    }
  }
  if (n.vivo && !n.nascosto) {
    let colpita = false;
    for (let j = G.rocce.length - 1; j >= 0 && !colpita; j--) {
      const r = G.rocce[j];
      if (Math.hypot(dx(n.x, r.x), dy(n.y, r.y)) < r.r * 0.85 + 12) { spezza(r, j); colpita = true; }
    }
    for (const c of G.colpiUfo) if (Math.hypot(dx(n.x, c.x), dy(n.y, c.y)) < 11) { colpita = true; c.t = 0; }
    if (G.ufo && Math.hypot(dx(n.x, G.ufo.x), dy(n.y, G.ufo.y)) < G.ufo.r + 9) { colpita = true; G.ufo = null; G.timerUfo = 8; }
    if (colpita) nave_muore();
  }
  if (!G.rocce.length && !G.ufo) nuovaOndata();
}

// ─────────────────────────── Disegno dei segmenti ───────────────────────────
function copie(x, y, r, fn) { // disegna anche dall'altra parte quando l'oggetto scavalca il bordo
  const W = mondo.W, H = mondo.H;
  const ox = [0], oy = [0];
  if (x < r) ox.push(W); if (x > W - r) ox.push(-W);
  if (y < r) oy.push(H); if (y > H - r) oy.push(-H);
  for (const a of ox) for (const b of oy) fn(x + a, y + b);
}
function disegnaNave(n, cx, cy, i = 1, scala = 1.35) {
  const c = Math.cos(n.a), s = Math.sin(n.a);
  const T = (x, y) => [cx + (x * c - y * s) * scala, cy + (x * s + y * c) * scala];
  poli([T(-11, -10), T(16, 0), T(-11, 10)], COL.nave, i);
  poli([T(-6.5, -7.8), T(-6.5, 7.8)], COL.nave, i);
  if (n.spinta && (fotogramma & 2)) {
    const lung = 13 + rf() * 9;
    poli([T(-6.5, -4.2), T(-6.5 - lung, 0), T(-6.5, 4.2)], COL.fiamma, 0.95);
  }
}
function disegnaUfo(u, cx, cy) {
  const k = u.piccolo ? 0.58 : 1;
  const P = (x, y) => [cx + x * k, cy + y * k];
  poli([P(-22, 0), P(-9, -7), P(9, -7), P(22, 0), P(9, 8), P(-9, 8)], COL.ufo, 1.05, true);
  poli([P(-22, 0), P(22, 0)], COL.ufo, 1.05);
  poli([P(-9, -7), P(-5, -14), P(5, -14), P(9, -7)], COL.ufo, 1.05);
}
let fotogramma = 0;
function componi(t) {
  nSeg = 0; SC = PH / mondo.H;
  jit = Math.max(0.3, PH / 900 * 0.45);
  const W = mondo.W, H = mondo.H;
  for (const r of G.rocce) copie(r.x, r.y, r.r, (x, y) => {
    const c = Math.cos(r.ang), s = Math.sin(r.ang);
    poli(r.m.map(p => [x + (p[0] * c - p[1] * s) * r.r, y + (p[0] * s + p[1] * c) * r.r]), COL.roccia, 1.25, true);
  });
  const n = G.nave;
  if (n.vivo && !n.nascosto) copie(n.x, n.y, 18, (x, y) => disegnaNave(n, x, y));
  if (G.ufo) copie(G.ufo.x, G.ufo.y, 24, (x, y) => disegnaUfo(G.ufo, x, y));
  for (const c of G.colpi) punto(c.x, c.y, COL.proiet, 2.6, 1.7);
  for (const c of G.colpiUfo) punto(c.x, c.y, [1, 0.7, 0.95], 2.4, 1.7);
  for (const p of G.part) punto(p.x, p.y, p.col, 1.9 * (1 - p.t / p.vita), 1.3);
  for (const r of G.rottami) {
    const c = Math.cos(r.ang), s = Math.sin(r.ang), hx = r.hx * c - r.hy * s, hy = r.hx * s + r.hy * c, f = 1 - r.t / r.vita;
    poli([[r.x - hx, r.y - hy], [r.x + hx, r.y + hy]], COL.nave, f);
  }
  // ── punteggio, record, vite ──
  const m = 26 + Math.max(0, (W - H * 4 / 3) / 2) * 0.35;
  testo(String(G.punti).padStart(2, '0'), m + 130, 70, 30, COL.testo, 1.0, 'dx');
  testo(String(G.record).padStart(2, '0'), W / 2, 74, 17, COL.testo, 0.8, 'centro');
  for (let k = 0; k < Math.min(G.vite, 8); k++)
    disegnaNave({ a: -Math.PI / 2 }, m + 130 - 12 - k * 22, 128, 0.85, 0.8);
  if (G.auto) {
    if (t % 1.2 < 0.8) testo('PREMI SPAZIO', W / 2, H * 0.72, 22, COL.testo, 0.95, 'centro');
    testo('1 GETTONE 1 PARTITA', W / 2, H - 62, 15, COL.testo, 0.7, 'centro');
  } else if (G.fine > 0) {
    testo('PARTITA FINITA', W / 2, H * 0.42, 30, COL.testo, 1.0, 'centro');
  } else if (!n.vivo && G.vite > 0) {
    testo('GIOCATORE 1', W / 2, H * 0.36, 22, COL.testo, 0.9, 'centro');
  }
}

// ─────────────────────────── Ciclo ───────────────────────────
addEventListener('resize', ridimensiona);
ridimensiona();
nuovaPartita(true);
// la partita dimostrativa è già in corso quando si accende lo schermo
for (let i = 0; i < 150; i++) aggiorna(1 / 60, i / 60);

let trBreve = ['breveA', 'breveB'], trLunga = ['lungaA', 'lungaB'];
Demo.loop((dt, t) => {
  if (dt > 0) { fotogramma++; aggiorna(Math.min(dt, 1 / 30), t); }
  {
    componi(t);
    // 1) fascio di adesso
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.fascio.f);
    gl.viewport(0, 0, PW, PH);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pFascio.p);
    gl.uniform2f(pFascio.u.uRes, PW, PH);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufSeg);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, datiSeg, 0, nSeg * 8);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nSeg);
    gl.disable(gl.BLEND);
    // 2) fosforo: persistenza breve (scia) e lunga (bagliore residuo)
    const k60 = dt * 60;
    if (dt > 0) {
    pieno(pFosforo, RT[trBreve[1]], { uScia: RT[trBreve[0]], uFascio: RT.fascio }, { uDeposito: 0.5 * k60, uDecad: Math.exp(-dt / 0.11) });
    pieno(pFosforo, RT[trLunga[1]], { uScia: RT[trLunga[0]], uFascio: RT.fascio }, { uDeposito: 0.03 * k60, uDecad: Math.exp(-dt / 0.75) });
    trBreve.reverse(); trLunga.reverse();
    }
    // 3) immagine HDR e bagliore a tre scale
    pieno(pHdr, RT.hdr, { uFascio: RT.fascio, uBreve: RT[trBreve[0]], uLunga: RT[trLunga[0]] }, { uGuad: 2.0 });
    const livelli = [['hdr', 'b1', 'b1t'], ['b1', 'b2', 'b2t'], ['b2', 'b3', 'b3t']];
    for (const [da, a, tmp] of livelli) {
      pieno(pCopia, RT[a], { uTex: RT[da] }, { uTexel: [1 / RT[da].w, 1 / RT[da].h] });
      const sp = 1.6;
      pieno(pSfoca, RT[tmp], { uTex: RT[a] }, { uDir: [sp / RT[a].w, 0] });
      pieno(pSfoca, RT[a], { uTex: RT[tmp] }, { uDir: [0, sp / RT[a].h] });
    }
  }
  // 4) il vetro: curvatura, tono, riflessi. Si ridisegna anche a tempo fermo (modalità foto).
  const flick = 1 + (Math.sin(t * 61.0) * 0.012 + Math.sin(t * 7.3) * 0.01 + (rf() - 0.5) * (dt > 0 ? 0.03 : 0));
  pieno(pFinale, null, { uHdr: RT.hdr, uB1: RT.b1, uB2: RT.b2, uB3: RT.b3 }, { uRes: [PW, PH], uT: t, uFlick: dt > 0 ? flick : 1 });
});
Demo.extra('<h4>Il fosforo</h4><p>Il fascio lascia due code: una breve e bianca, che fa le scie dietro alle cose in movimento, e una lunga e verdastra che resta per quasi un secondo.</p>');
Demo.pronto();
