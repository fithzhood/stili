// ASCII — omaggio a Brogue e Dwarf Fortress.
// Tutto è una griglia di caratteri: ogni cella ha un glifo, un colore del glifo e un colore di fondo.
// Il colore nasce dalla luce: ogni sorgente (torce, bracieri, funghi, lava, fuoco, la lampada del
// giocatore) proietta la sua luce con lo shadowcasting e tinge le celle che raggiunge.

const COLS = 100, ROWS = 34;          // griglia dello schermo
const MW = 79, MH = 29;               // mappa (come Brogue)
const MX = 21, MY = 3;                // dove comincia la mappa sullo schermo

// ─────────────────────────── Casualità ───────────────────────────
function generatore(s) {
  return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let x = Math.imul(s ^ s >>> 15, 1 | s);
    x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}
let rnd = generatore(1);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pesca = a => a[Math.floor(rnd() * a.length)];
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
function rumore(x, y) { // rumore di valore liscio
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// ─────────────────────────── Terreni ───────────────────────────
const MURO = 0, PAV = 1, PORTA = 2, ERBA = 4, SECCA = 5, FUNGO = 6, FONDA = 7, BASSA = 8, LAVA = 9,
  TORCIA = 10, BRACIERE = 11, CENERE = 12, SCALE = 13, STATUA = 15, MACERIE = 16;
const DEF = {
  [MURO]:     { g: '#', fg: [0.62, 0.58, 0.52], bg: [0.30, 0.27, 0.24], opaco: 1, solido: 1, nome: 'un muro di pietra' },
  [PAV]:      { g: '.', fg: [0.50, 0.48, 0.44], bg: [0.12, 0.11, 0.10], nome: 'il pavimento' },
  [PORTA]:    { g: '+', fg: [0.85, 0.60, 0.30], bg: [0.36, 0.22, 0.10], opaco: 1, nome: 'una porta di legno', brucia: 0.06, durata: 14 },
  [ERBA]:     { g: '"', fg: [0.32, 0.78, 0.22], bg: [0.10, 0.13, 0.07], nome: 'l\'erba', brucia: 0.24, durata: 7 },
  [SECCA]:    { g: '"', fg: [0.72, 0.62, 0.26], bg: [0.14, 0.12, 0.07], nome: 'l\'erba secca', brucia: 0.45, durata: 5 },
  [FUNGO]:    { g: '"', fg: [0.40, 1.00, 0.80], bg: [0.06, 0.16, 0.14], nome: 'funghi luminescenti', brucia: 0.12, durata: 4, luce: 1 },
  [FONDA]:    { g: '~', fg: [0.30, 0.50, 1.00], bg: [0.04, 0.10, 0.38], solido: 1, nome: 'l\'acqua profonda' },
  [BASSA]:    { g: '~', fg: [0.45, 0.65, 0.95], bg: [0.10, 0.20, 0.36], nome: 'l\'acqua bassa' },
  [LAVA]:     { g: '~', fg: [1.00, 0.75, 0.30], bg: [0.75, 0.18, 0.02], solido: 1, nome: 'la lava', luce: 1 },
  [TORCIA]:   { g: '#', fg: [1.00, 0.85, 0.40], bg: [0.45, 0.30, 0.14], opaco: 1, solido: 1, nome: 'una torcia a muro', luce: 1 },
  [BRACIERE]: { g: 'Ω', fg: [1.00, 0.70, 0.30], bg: [0.30, 0.14, 0.05], solido: 1, nome: 'un braciere', luce: 1 },
  [CENERE]:   { g: '.', fg: [0.34, 0.31, 0.29], bg: [0.07, 0.065, 0.06], nome: 'la cenere' },
  [SCALE]:    { g: '>', fg: [1.00, 0.92, 0.60], bg: [0.26, 0.20, 0.12], nome: 'una scala che scende' },
  [STATUA]:   { g: 'ß', fg: [0.85, 0.85, 0.90], bg: [0.16, 0.15, 0.15], solido: 1, nome: 'una statua di marmo' },
  [MACERIE]:  { g: ',', fg: [0.55, 0.52, 0.48], bg: [0.12, 0.11, 0.10], nome: 'le macerie' },
};
const OGGETTI = {
  '!': { fg: [1.0, 0.45, 0.25], nome: 'una fiala incendiaria' },
  '*': { fg: [1.0, 0.85, 0.20], nome: 'qualche moneta d\'oro' },
  '?': { fg: [0.95, 0.90, 0.75], nome: 'una pergamena' },
  '/': { fg: [0.70, 0.55, 1.00], nome: 'una bacchetta' },
  ')': { fg: [0.80, 0.82, 0.90], nome: 'una daga' },
};
const MOSTRI = {
  r: { art: 'il', nome: 'ratto', fg: [0.72, 0.60, 0.50], pv: 3 },
  j: { art: 'lo', nome: 'sciacallo', fg: [0.85, 0.68, 0.40], pv: 4 },
  k: { art: 'il', nome: 'coboldo', fg: [0.75, 0.55, 0.85], pv: 5 },
  g: { art: 'il', nome: 'goblin', fg: [0.45, 0.80, 0.40], pv: 8 },
  m: { art: 'la', nome: 'scimmia', fg: [0.80, 0.55, 0.30], pv: 6 },
  e: { art: "l'", nome: 'anguilla', fg: [0.35, 0.85, 0.80], pv: 9, acqua: 1 },
};

// ─────────────────────────── Stato del livello ───────────────────────────
const N = MW * MH;
const idx = (x, y) => y * MW + x;
const dentro = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
let T, fuoco, braci, fumo, visto, memG, memF, memB, oggetti, mostri, luciFisse, varia;
let P = { x: 0, y: 0, pv: 20, pvMax: 20, fiale: 3, oro: 0, dir: [1, 0] };
let profondita = 1;
const messaggi = [];
const Art = (s, maiusc) => { const d = MOSTRI[s], a = d.art + (d.art.endsWith("'") ? '' : ' ') + d.nome; return maiusc ? a[0].toUpperCase() + a.slice(1) : a; };
function msg(s, col = [1, 1, 1]) {
  const u = messaggi[messaggi.length - 1];
  if (u && u.base === s) { u.n++; u.s = `${s} (x${u.n})`; return; }
  messaggi.push({ s, base: s, n: 1, col }); if (messaggi.length > 30) messaggi.shift();
}

const opaco = (x, y) => {
  if (!dentro(x, y)) return true;
  const t = T[idx(x, y)];
  if (t === PORTA) return !(P.x === x && P.y === y) && !mostri.some(m => m.x === x && m.y === y);
  return !!DEF[t].opaco;
};
const passabile = t => !DEF[t].solido;

// Shadowcasting ricorsivo a otto ottanti.
const OTT = [[1, 0, 0, -1, -1, 0, 0, 1], [0, 1, -1, 0, 0, -1, 1, 0], [0, 1, 1, 0, 0, -1, -1, 0], [1, 0, 0, 1, -1, 0, 0, -1]];
function campo(ox, oy, raggio, cb, opq = opaco) {
  cb(ox, oy, 0);
  for (let o = 0; o < 8; o++) proietta(ox, oy, 1, 1.0, 0.0, raggio, OTT[0][o], OTT[1][o], OTT[2][o], OTT[3][o], cb, opq);
}
function proietta(cx, cy, riga, inizio, fine, raggio, xx, xy, yx, yy, cb, opq) {
  if (inizio < fine) return;
  const r2 = raggio * raggio;
  let nuovoInizio = 0;
  for (let j = riga; j <= raggio; j++) {
    let dx = -j - 1; const dy = -j; let bloccato = false;
    while (dx <= 0) {
      dx++;
      const X = cx + dx * xx + dy * xy, Y = cy + dx * yx + dy * yy;
      const sx = (dx - 0.5) / (dy + 0.5), dxs = (dx + 0.5) / (dy - 0.5);
      if (inizio < dxs) continue; else if (fine > sx) break;
      if (dx * dx + dy * dy < r2 && dentro(X, Y)) cb(X, Y, Math.sqrt(dx * dx + dy * dy));
      if (bloccato) {
        if (opq(X, Y)) { nuovoInizio = dxs; continue; }
        bloccato = false; inizio = nuovoInizio;
      } else if (opq(X, Y) && j < raggio) {
        bloccato = true;
        proietta(cx, cy, j + 1, inizio, sx, raggio, xx, xy, yx, yy, cb, opq);
        nuovoInizio = dxs;
      }
    }
    if (bloccato) break;
  }
}

// ─────────────────────────── Generazione ───────────────────────────
function blob(w, h, riemp = 0.55, giri = 5) { // grotta con automa cellulare, tiene la regione più grande
  let g = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.push(x > 0 && y > 0 && x < w - 1 && y < h - 1 && rnd() < riemp ? 1 : 0);
  for (let k = 0; k < giri; k++) {
    const n = g.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let c = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) c += g[(y + j) * w + x + i];
      n[y * w + x] = c >= 5 ? 1 : c <= 3 ? 0 : g[y * w + x];
    }
    g = n;
  }
  // regione più grande
  const reg = new Int32Array(w * h).fill(-1); let best = [], id = 0;
  for (let s = 0; s < w * h; s++) if (g[s] && reg[s] < 0) {
    const q = [s], celle = []; reg[s] = id;
    while (q.length) { const c = q.pop(); celle.push(c); const x = c % w, y = (c / w) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Y = y + b;
        if (X >= 0 && Y >= 0 && X < w && Y < h && g[Y * w + X] && reg[Y * w + X] < 0) { reg[Y * w + X] = id; q.push(Y * w + X); } } }
    if (celle.length > best.length) best = celle; id++;
  }
  return best.map(c => [c % w, (c / w) | 0]);
}
function disegnoStanza() {
  const tipo = rnd();
  let celle = [];
  if (tipo < 0.40) { const w = ri(3, 11), h = ri(2, 6); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) celle.push([x, y]); }
  else if (tipo < 0.60) { // a croce
    const w1 = ri(3, 11), h1 = ri(2, 4), w2 = ri(2, Math.max(2, w1 - 2)), h2 = ri(h1 + 2, 8), ox = ri(0, w1 - w2), oy = ri(0, h2 - h1);
    const s = new Set();
    for (let y = 0; y < h1; y++) for (let x = 0; x < w1; x++) s.add((x) + ',' + (y + oy));
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) s.add((x + ox) + ',' + y);
    celle = [...s].map(k => k.split(',').map(Number));
  } else if (tipo < 0.75) { const r = ri(2, 4); for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) celle.push([x + r, y + r]); }
  else celle = blob(ri(8, 16), ri(6, 10), 0.58, 4);
  return { celle, grotta: tipo >= 0.75 };
}
function generaLivello(seme) {
  rnd = generatore(seme);
  T = new Uint8Array(N).fill(MURO);
  fuoco = new Float32Array(N); braci = new Float32Array(N); fumo = new Float32Array(N);
  visto = new Uint8Array(N); memG = new Array(N).fill(' '); memF = new Float32Array(N * 3); memB = new Float32Array(N * 3);
  oggetti = new Map(); mostri = []; luciFisse = [];
  varia = new Float32Array(N); for (let i = 0; i < N; i++) varia[i] = rnd();
  // prima caverna al centro
  for (const [x, y] of blob(40, 19, 0.54, 5)) T[idx(x + 19, y + 5)] = PAV;
  // accrescimento: stanze attaccate con una porta a pareti che toccano il pavimento
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let tent = 0; tent < 3000; tent++) {
    const X = ri(1, MW - 2), Y = ri(1, MH - 2);
    if (T[idx(X, Y)] !== MURO) continue;
    const vicini = D4.filter(([a, b]) => T[idx(X + a, Y + b)] === PAV);
    if (vicini.length !== 1) continue;
    const D = vicini[0];
    const st = disegnoStanza();
    const set = new Set(st.celle.map(c => c[0] + ',' + c[1]));
    // porta della stanza: una cella fuori dal bordo nella direzione D
    const bordo = st.celle.filter(([x, y]) => !set.has((x + D[0]) + ',' + (y + D[1])));
    if (!bordo.length) continue;
    const b = pesca(bordo);
    let porta = [b[0] + D[0], b[1] + D[1]];
    let celle = st.celle.slice();
    if (!st.grotta && rnd() < 0.35) { // corridoio
      const L = ri(2, 7);
      for (let k = 0; k < L; k++) { celle.push(porta); porta = [porta[0] + D[0], porta[1] + D[1]]; }
    }
    const ox = X - porta[0], oy = Y - porta[1];
    let ok = true;
    for (const [x, y] of celle) {
      const ax = x + ox, ay = y + oy;
      if (ax < 1 || ay < 1 || ax > MW - 2 || ay > MH - 2) { ok = false; break; }
      for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1; i++) {
        const cx = ax + i, cy = ay + j;
        if (cx === X && cy === Y) continue;
        if (dentro(cx, cy) && T[idx(cx, cy)] !== MURO) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (!ok) continue;
    for (const [x, y] of celle) T[idx(x + ox, y + oy)] = PAV;
    T[idx(X, Y)] = st.grotta || rnd() < 0.3 ? PAV : PORTA;
  }
  // anelli: aprire i muri sottili fra due zone lontane a piedi
  const bfs = (sx, sy) => {
    const d = new Int16Array(N).fill(-1); const q = [idx(sx, sy)]; d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) { const c = q[h], x = c % MW, y = (c / MW) | 0;
      for (const [a, b] of D4) { const X = x + a, Y = y + b; if (!dentro(X, Y)) continue; const k = idx(X, Y);
        if (d[k] < 0 && passabile(T[k]) && T[k] !== MURO) { d[k] = d[c] + 1; q.push(k); } } }
    return d;
  };
  for (let tent = 0; tent < 250; tent++) {
    const X = ri(2, MW - 3), Y = ri(2, MH - 3);
    if (T[idx(X, Y)] !== MURO) continue;
    for (const [a, b] of [[1, 0], [0, 1]]) {
      if (T[idx(X + a, Y + b)] === PAV && T[idx(X - a, Y - b)] === PAV && T[idx(X + b, Y + a)] === MURO && T[idx(X - b, Y - a)] === MURO) {
        const d = bfs(X + a, Y + b)[idx(X - a, Y - b)];
        if (d < 0 || d > 22) T[idx(X, Y)] = rnd() < 0.5 ? PORTA : PAV;
      }
    }
  }
  // laghi d'acqua (con la corona d'acqua bassa) e una pozza di lava, senza spezzare il livello
  const connesso = () => {
    let start = -1, tot = 0;
    for (let i = 0; i < N; i++) if (passabile(T[i]) && T[i] !== MURO) { tot++; if (start < 0) start = i; }
    const d = bfs(start % MW, (start / MW) | 0); let n = 0; for (let i = 0; i < N; i++) if (d[i] >= 0) n++;
    return n === tot;
  };
  const lago = (tipo, w, h) => {
    for (let tent = 0; tent < 30; tent++) {
      const forma = blob(w, h, 0.6, 5); if (forma.length < 12) continue;
      const ox = ri(1, MW - w - 1), oy = ri(1, MH - h - 1);
      const vecchio = T.slice();
      const s = new Set(forma.map(([x, y]) => (x + ox) + ',' + (y + oy)));
      let tocca = 0;
      for (const k of s) { const [x, y] = k.split(',').map(Number); if (T[idx(x, y)] !== MURO) tocca++; }
      if (tocca < forma.length * 0.3) continue;
      for (const k of s) {
        const [x, y] = k.split(',').map(Number);
        if (x < 1 || y < 1 || x > MW - 2 || y > MH - 2) continue;
        let interno = true;
        for (const [a, b] of D4) if (!s.has((x + a) + ',' + (y + b))) interno = false;
        T[idx(x, y)] = tipo === LAVA ? LAVA : interno ? FONDA : BASSA;
      }
      if (tipo !== LAVA) for (const k of s) { // corona d'acqua bassa sul pavimento attorno
        const [x, y] = k.split(',').map(Number);
        for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
          const X = x + i, Y = y + j; if (X < 1 || Y < 1 || X > MW - 2 || Y > MH - 2) continue;
          if (T[idx(X, Y)] === PAV && rnd() < 0.55) T[idx(X, Y)] = BASSA;
        }
      }
      if (connesso()) return true;
      T.set(vecchio);
    }
    return false;
  };
  lago(FONDA, ri(12, 20), ri(7, 10));
  lago(FONDA, ri(8, 13), ri(5, 8));
  lago(LAVA, ri(8, 12), ri(5, 7));
  // erba, erba secca e funghi a macchie
  const macchie = (tipo, n, rmin, rmax, soglia) => {
    for (let k = 0; k < n; k++) {
      let cx, cy; do { cx = ri(1, MW - 2); cy = ri(1, MH - 2); } while (T[idx(cx, cy)] !== PAV);
      const r = ri(rmin, rmax), sx = rnd() * 100;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (!dentro(x, y) || T[idx(x, y)] !== PAV) continue;
        const d = Math.hypot(x - cx, (y - cy) * 1.4) / r;
        if (d < 1 && rumore(x * 0.35 + sx, y * 0.5) > soglia + d * 0.35) T[idx(x, y)] = tipo;
      }
    }
  };
  macchie(ERBA, 14, 5, 11, 0.15);
  macchie(SECCA, 4, 3, 7, 0.25);
  macchie(FUNGO, 6, 2, 4, 0.22);
  // macerie sparse
  for (let i = 0; i < N; i++) if (T[i] === PAV && rnd() < 0.025) T[i] = MACERIE;
  // torce sui muri che guardano il pavimento, ben distanziate
  const torce = [];
  for (let tent = 0; tent < 900 && torce.length < 16; tent++) {
    const X = ri(1, MW - 2), Y = ri(1, MH - 2);
    if (T[idx(X, Y)] !== MURO) continue;
    if (!D4.some(([a, b]) => T[idx(X + a, Y + b)] === PAV)) continue;
    if (torce.some(([x, y]) => Math.hypot(x - X, y - Y) < 8)) continue;
    torce.push([X, Y]); T[idx(X, Y)] = TORCIA;
  }
  // statue nelle sale ampie
  for (let tent = 0, n = 0; tent < 300 && n < 4; tent++) {
    const X = ri(2, MW - 3), Y = ri(2, MH - 3); let ok = true;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (T[idx(X + i, Y + j)] !== PAV) ok = false;
    if (ok) { T[idx(X, Y)] = STATUA; n++; }
  }
  // bracieri vicino all'erba
  for (let tent = 0, n = 0; tent < 800 && n < 3; tent++) {
    const X = ri(2, MW - 3), Y = ri(2, MH - 3);
    if (T[idx(X, Y)] !== PAV) continue;
    let erba = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (T[idx(X + i, Y + j)] === ERBA || T[idx(X + i, Y + j)] === SECCA) erba++;
    if (erba >= 5) { T[idx(X, Y)] = BRACIERE; n++; }
  }
  // luci fisse
  for (let i = 0; i < N; i++) {
    const x = i % MW, y = (i / MW) | 0, t = T[i];
    if (t === TORCIA) luciFisse.push(luce(x, y, [1.25, 0.78, 0.36], 9.5, 0.22, 7));
    else if (t === BRACIERE) luciFisse.push(luce(x, y, [1.4, 0.72, 0.28], 8, 0.28, 9));
    else if (t === FUNGO) luciFisse.push(luce(x, y, [0.16, 0.50, 0.40], 4.2, 0.05, 1.5));
    else if (t === LAVA) luciFisse.push(luce(x, y, [0.60, 0.20, 0.04], 4.5, 0.12, 2));
  }
  // scale, oggetti, mostri
  const liberi = []; for (let i = 0; i < N; i++) if (T[i] === PAV || T[i] === ERBA || T[i] === SECCA) liberi.push(i);
  const libero = () => { let c; do { c = pesca(liberi); } while (oggetti.has(c) || mostri.some(m => idx(m.x, m.y) === c)); return c; };
  // partenza: il punto da cui si vede più erba
  let bestS = -1, best = -1;
  for (let k = 0; k < 400; k++) {
    const c = pesca(liberi); if (T[c] !== PAV) continue;
    let v = 0; const tipi = new Set();
    campo(c % MW, (c / MW) | 0, 12, (x, y, d) => {
      const t = T[idx(x, y)];
      if (!DEF[t].opaco) v += 1;
      if ((t === ERBA || t === SECCA) && d > 3) v += 2.5;
      if (t === TORCIA || t === BRACIERE) v += 8;
      if (t === LAVA || t === FONDA || t === FUNGO) { v += 0.8; tipi.add(t); }
    }, (x, y) => !dentro(x, y) || !!DEF[T[idx(x, y)]].opaco);
    v += tipi.size * 40;
    if (v > best) { best = v; bestS = c; }
  }
  P.x = bestS % MW; P.y = (bestS / MW) | 0;
  let lontano = bestS, dmax = 0; const d0 = bfs(P.x, P.y);
  for (const c of liberi) if (d0[c] > dmax && T[c] === PAV) { dmax = d0[c]; lontano = c; }
  T[lontano] = SCALE;
  for (let k = 0; k < 7; k++) oggetti.set(libero(), pesca(['!', '!', '*', '*', '?', '/', ')']));
  for (let k = 0; k < 6; k++) {
    const c = libero(), s = pesca(['r', 'r', 'j', 'k', 'g', 'm']);
    mostri.push({ x: c % MW, y: (c / MW) | 0, s, pv: MOSTRI[s].pv, dir: [0, 0] });
  }
  const acque = []; for (let i = 0; i < N; i++) if (T[i] === FONDA) acque.push(i);
  for (let k = 0; k < Math.min(2, acque.length); k++) { const c = pesca(acque); mostri.push({ x: c % MW, y: (c / MW) | 0, s: 'e', pv: 9, dir: [0, 0] }); }
  visto.fill(0);
}
function luce(x, y, col, raggio, tremolio = 0, velocita = 6) {
  const celle = [], pesi = [];
  campo(x, y, raggio, (X, Y, d) => {
    const k = idx(X, Y); if (celle.includes(k)) return;
    const f = Math.max(0, 1 - d / raggio); celle.push(k); pesi.push(f * f * (3 - 2 * f));
  }, (X, Y) => !dentro(X, Y) || !!DEF[T[idx(X, Y)]].opaco);
  return { x, y, col, raggio, tremolio, velocita, fase: rnd() * 100, celle: Int32Array.from(celle), pesi: Float32Array.from(pesi) };
}

// ─────────────────────────── Fuoco, fumo, braci ───────────────────────────
let luciFuoco = [];
function accendi(x, y, forza = 1) {
  if (!dentro(x, y)) return;
  const k = idx(x, y), t = T[k];
  if (DEF[t].solido || t === BASSA) return;
  const d = DEF[t].durata || ri(3, 6);
  fuoco[k] = Math.max(fuoco[k], d * forza + rnd() * 2);
}
function passoFuoco() {
  const nuovi = [];
  for (let k = 0; k < N; k++) {
    if (fuoco[k] <= 0) continue;
    const x = k % MW, y = (k / MW) | 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (!i && !j) continue;
      const X = x + i, Y = y + j; if (!dentro(X, Y)) continue;
      const q = idx(X, Y), b = DEF[T[q]].brucia;
      if (b && fuoco[q] <= 0 && rnd() < b * (i && j ? 0.45 : 1)) nuovi.push(q);
    }
    fuoco[k] -= 1;
    fumo[k] = Math.min(1.4, fumo[k] + 0.35);
    if (fuoco[k] <= 0) {
      fuoco[k] = 0;
      const t = T[k];
      if (t === ERBA || t === SECCA || t === FUNGO) { T[k] = CENERE; rimuoviLuceFissa(k); }
      if (t === PORTA) T[k] = PAV;
      braci[k] = 1;
    }
  }
  for (const q of nuovi) if (fuoco[q] <= 0) { fuoco[q] = (DEF[T[q]].durata || 4) + rnd() * 3; }
  // fumo: si allarga, sale verso nord e si dirada
  const f2 = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    if (DEF[T[k]].opaco) continue;
    const x = k % MW, y = (k / MW) | 0;
    let s = fumo[k] * 0.45, w = 0.45;
    for (const [a, b, p] of [[1, 0, 0.12], [-1, 0, 0.12], [0, 1, 0.22], [0, -1, 0.06]]) {
      const X = x + a, Y = y + b; if (!dentro(X, Y) || DEF[T[idx(X, Y)]].opaco) continue;
      s += fumo[idx(X, Y)] * p; w += p;
    }
    f2[k] = s / w * 0.90;
    if (f2[k] < 0.01) f2[k] = 0;
  }
  fumo = f2;
  for (let k = 0; k < N; k++) if (braci[k] > 0) braci[k] = Math.max(0, braci[k] - 0.035);
  // i mostri sul fuoco bruciano
  for (const m of mostri) if (fuoco[idx(m.x, m.y)] > 0) { m.pv -= 3; if (m.pv <= 0) msg(`${Art(m.s, true)} brucia.`, [1, 0.6, 0.3]); }
  mostri = mostri.filter(m => m.pv > 0);
  if (fuoco[idx(P.x, P.y)] > 0) { P.pv = Math.max(1, P.pv - 1); if (!P.scottato) msg('Stai bruciando!', [1, 0.4, 0.2]); P.scottato = 4; }
  if (P.scottato) P.scottato--;
  // luci delle fiamme
  luciFuoco = [];
  for (let k = 0; k < N; k++) if (fuoco[k] > 0) luciFuoco.push(luce(k % MW, (k / MW) | 0, [0.42, 0.18, 0.04], 4.8, 0.4, 11));
}
function rimuoviLuceFissa(k) {
  const x = k % MW, y = (k / MW) | 0;
  luciFisse = luciFisse.filter(l => !(l.x === x && l.y === y));
}

// ─────────────────────────── Turni ───────────────────────────
let lancio = null;         // la fiala in volo
function turno(dx, dy) {
  P.dir = [dx, dy];
  const X = P.x + dx, Y = P.y + dy;
  if (!dentro(X, Y)) return;
  const k = idx(X, Y), t = T[k];
  const m = mostri.find(m => m.x === X && m.y === Y);
  if (m) {
    const nm = Art(m.s);
    m.pv -= ri(2, 4);
    if (m.pv <= 0) { msg(`Uccidi ${nm}.`, [1, 0.85, 0.6]); mostri = mostri.filter(q => q !== m); }
    else msg(`Colpisci ${nm}.`, [0.9, 0.9, 0.9]);
  } else if (t === BRACIERE) {
    msg('Rovesci il braciere: le braci si spargono sull\'erba!', [1, 0.65, 0.3]);
    T[k] = MACERIE; rimuoviLuceFissa(k);
    for (let s = 0; s < 3; s++) for (let l = -1; l <= 1; l++) accendi(X + dx * s + (dy ? l : 0), Y + dy * s + (dx ? l : 0), 0.8);
    accendi(X, Y, 1);
  } else if (t === FONDA) msg('L\'acqua è troppo profonda.', [0.6, 0.75, 1]);
  else if (t === LAVA) msg('Il calore della lava ti respinge.', [1, 0.5, 0.2]);
  else if (DEF[t].solido) { /* muro: niente */ return; }
  else {
    P.x = X; P.y = Y;
    const o = oggetti.get(k);
    if (o) {
      oggetti.delete(k);
      if (o === '!') { P.fiale++; msg('Raccogli una fiala incendiaria. (spazio per lanciarla)', OGGETTI['!'].fg); }
      else if (o === '*') { const n = ri(8, 40); P.oro += n; msg(`Raccogli ${n} monete d'oro.`, OGGETTI['*'].fg); }
      else if (o === '?') { visto.fill(1); for (let i = 0; i < N; i++) ricorda(i, 0.35); msg('Leggi la pergamena: la mappa del livello ti si apre nella mente!', [0.8, 0.7, 1]); }
      else msg(`Trovi ${OGGETTI[o].nome}.`, OGGETTI[o].fg);
    }
    if (t === SCALE) { profondita++; msg(`Scendi alla profondità ${profondita}.`, [1, 0.9, 0.6]); generaLivello(1000 + profondita * 77); calcolaVista(); return; }
    if (t === BASSA && rnd() < 0.3) msg('Guadi l\'acqua bassa.', [0.6, 0.75, 1]);
  }
  // i mostri si muovono a caso, e scappano dal fuoco
  for (const q of mostri) {
    if (rnd() < 0.45) continue;
    const opz = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([a, b]) => {
      const x = q.x + a, y = q.y + b; if (!dentro(x, y)) return false;
      const tt = T[idx(x, y)];
      if (MOSTRI[q.s].acqua) return tt === FONDA;
      return passabile(tt) && tt !== BRACIERE && fuoco[idx(x, y)] <= 0 && !(x === P.x && y === P.y) && !mostri.some(o => o.x === x && o.y === y);
    });
    if (!opz.length) continue;
    const [a, b] = pesca(opz); q.x += a; q.y += b;
  }
  if (P.pv < P.pvMax && rnd() < 0.15) P.pv++;
  calcolaVista();
}
function lancia() {
  if (lancio) return;
  if (P.fiale <= 0) { msg('Non hai più fiale.', [0.7, 0.7, 0.7]); return; }
  P.fiale--;
  lancio = { x: P.x, y: P.y, dx: P.dir[0], dy: P.dir[1], passi: 0, t: 0 };
  msg('Lanci una fiala incendiaria!', OGGETTI['!'].fg);
}
function passoLancio(dt) {
  lancio.t += dt;
  while (lancio && lancio.t > 0.035) {
    lancio.t -= 0.035;
    const X = lancio.x + lancio.dx, Y = lancio.y + lancio.dy;
    const muro = !dentro(X, Y) || DEF[T[idx(X, Y)]].opaco || DEF[T[idx(X, Y)]].solido && T[idx(X, Y)] !== FONDA && T[idx(X, Y)] !== LAVA;
    const bersaglio = mostri.some(m => m.x === X && m.y === Y);
    if (muro || lancio.passi >= 7) { scoppia(lancio.x, lancio.y); lancio = null; break; }
    lancio.x = X; lancio.y = Y; lancio.passi++;
    if (bersaglio) { scoppia(X, Y); lancio = null; break; }
  }
}
function scoppia(x, y) {
  msg('La fiala si infrange in una vampata!', [1, 0.55, 0.2]);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (rnd() < (i && j ? 0.7 : 1)) accendi(x + i, y + j, 1.2);
  fumo[idx(x, y)] += 1;
}

// ─────────────────────────── Vista e memoria ───────────────────────────
let inVista = new Uint8Array(N), distanze = new Float32Array(N);
let luceGiocatore = null;
function calcolaVista() {
  inVista.fill(0);
  campo(P.x, P.y, 60, (x, y, d) => { inVista[idx(x, y)] = 1; distanze[idx(x, y)] = d; });
  luceGiocatore = luce(P.x, P.y, [1.0, 0.96, 0.84], 15);
}

// Il giocatore è già in giro da un po': ciò che ha attraversato resta nella memoria (grigio-blu).
function esplorato(passi) {
  const d = new Int16Array(N).fill(-1); const q = [idx(P.x, P.y)]; d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % MW, y = (c / MW) | 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const X = x + i, Y = y + j; if (!dentro(X, Y)) continue; const k = idx(X, Y);
      if (d[k] >= 0) continue;
      d[k] = d[c] + 1;
      if (d[k] <= passi && !DEF[T[k]].opaco || T[k] === PORTA) q.push(k);
    }
  }
  for (let k = 0; k < N; k++) if (d[k] >= 0 && d[k] <= passi + 1) { visto[k] = 1; ricorda(k); }
}

// ─────────────────────────── Disegno ───────────────────────────
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
document.body.prepend(canvas);
const ctx = canvas.getContext('2d', { alpha: false });
let W = 0, H = 0, cw = 0, ch = 0, fontPx = 0;
function ridimensiona() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = Math.round(innerWidth * dpr); H = Math.round(innerHeight * dpr);
  canvas.width = W; canvas.height = H;
  cw = W / COLS; ch = H / ROWS;
  fontPx = Math.floor(Math.min(ch * 0.86, cw * 1.62));
}
addEventListener('resize', ridimensiona);

// buffer dello schermo: glifo, colore del glifo, colore del fondo
const SG = new Array(COLS * ROWS).fill(' '), SF = new Float32Array(COLS * ROWS * 3), SB = new Float32Array(COLS * ROWS * 3);
function cella(c, r, g, fg, bg) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
  const k = r * COLS + c;
  if (g != null) SG[k] = g;
  if (fg) { SF[k * 3] = fg[0]; SF[k * 3 + 1] = fg[1]; SF[k * 3 + 2] = fg[2]; }
  if (bg) { SB[k * 3] = bg[0]; SB[k * 3 + 1] = bg[1]; SB[k * 3 + 2] = bg[2]; }
}
function scrivi(c, r, s, fg, bg) { for (let i = 0; i < s.length; i++) cella(c + i, r, s[i], fg, bg); }
function barra(c, r, larg, frac, etichetta, colPieno, fg = [1, 1, 1]) {
  const piena = Math.round(frac * larg), inizio = Math.floor((larg - etichetta.length) / 2);
  for (let i = 0; i < larg; i++) {
    const bg = i < piena ? colPieno : colPieno.map(v => v * 0.28);
    const ch = etichetta[i - inizio] || ' ';
    cella(c + i, r, i >= inizio && i < inizio + etichetta.length ? ch : ' ', fg, bg);
  }
}

const Luce = new Float32Array(N * 3);
function calcolaLuce(t) {
  Luce.fill(0.035);
  const aggiungi = (l, f) => {
    const c = l.celle, p = l.pesi, r = l.col[0] * f, g = l.col[1] * f, b = l.col[2] * f;
    for (let i = 0; i < c.length; i++) { const k = c[i] * 3, w = p[i]; Luce[k] += r * w; Luce[k + 1] += g * w; Luce[k + 2] += b * w; }
  };
  for (const l of luciFisse) aggiungi(l, 1 - l.tremolio * rumore(t * l.velocita + l.fase, l.fase));
  for (const l of luciFuoco) aggiungi(l, 1 - l.tremolio * rumore(t * l.velocita + l.fase, 3.3));
  if (luceGiocatore) aggiungi(luceGiocatore, 1);
  // braci che si spengono: un filo di rosso
  for (let k = 0; k < N; k++) if (braci[k] > 0) { Luce[k * 3] += braci[k] * 0.35; Luce[k * 3 + 1] += braci[k] * 0.08; }
}

const FIAMME = [[1.0, 0.95, 0.45], [1.0, 0.72, 0.18], [1.0, 0.45, 0.08], [0.85, 0.18, 0.04]];
function aspetto(k, t) { // colore "vero" della cella, prima della luce: {g, fg, bg, emette}
  const x = k % MW, y = (k / MW) | 0, tt = T[k], d = DEF[tt];
  let g = d.g, fg = d.fg.slice(), bg = d.bg.slice(), em = 0;
  const v = (varia[k] - 0.5) * 0.14;
  bg = bg.map(c => c * (1 + v)); fg = fg.map(c => c * (1 + v * 0.8));
  if (tt === FONDA || tt === BASSA) {
    const onda = Math.sin(x * 0.8 + t * 1.7 + Math.sin(y * 0.6 + t * 0.9) * 1.8) * 0.5 + rumore(x * 0.4 + t * 0.5, y * 0.6 - t * 0.3) - 0.5;
    const a = tt === FONDA ? 1 : 0.6;
    bg = [bg[0] + onda * 0.03 * a, bg[1] + onda * 0.06 * a, bg[2] + onda * 0.13 * a];
    fg = fg.map(c => c * (0.75 + onda * 0.45));
    if (tt === FONDA && onda > 0.55) g = '≈';
    if (tt === BASSA && varia[k] > 0.55) g = ' ';
  } else if (tt === LAVA) {
    const n = rumore(x * 0.5 + t * 0.6, y * 0.7 - t * 0.4) * 0.7 + rumore(x * 1.3 - t * 1.1, y * 1.1) * 0.3;
    bg = [0.55 + n * 0.45, 0.10 + n * 0.28, 0.02 + n * 0.02]; fg = [1, 0.55 + n * 0.4, 0.15 + n * 0.25];
    g = n > 0.62 ? '≈' : '~'; em = 1;
  } else if (tt === TORCIA || tt === BRACIERE) {
    const f = 0.8 + 0.2 * rumore(t * 9 + k, 1);
    fg = fg.map(c => c * f); em = 1;
  } else if (tt === FUNGO) {
    em = 0.7; const f = 0.85 + 0.15 * Math.sin(t * 1.3 + k);
    fg = fg.map(c => c * f);
  } else if (tt === CENERE && varia[k] > 0.7) g = ',';
  if (braci[k] > 0 && fuoco[k] <= 0) {
    const b = braci[k] * (0.7 + 0.3 * rumore(t * 5 + k, 2));
    fg = [fg[0] + b * 0.9, fg[1] + b * 0.25, fg[2]]; bg = [bg[0] + b * 0.18, bg[1] + b * 0.03, bg[2]];
    if (braci[k] > 0.25) g = pesca2([',', '\'', '.'], k);
  }
  if (fuoco[k] > 0) {
    const s = Math.floor(t * 14) * 7 + k * 13;
    const c1 = FIAMME[Math.floor(hash(s, 5) * 3.99)], c2 = FIAMME[Math.min(3, 1 + Math.floor(hash(s, 9) * 3))];
    g = hash(s, 1) < 0.72 ? '^' : '"'; fg = c1.slice(); bg = c2.map(c => c * 0.55); em = 1;
  }
  return { g, fg, bg, em };
}
const pesca2 = (a, k) => a[Math.floor(varia[k] * 97) % a.length];

function ricorda(k, lum) {
  const a = aspetto(k, 0);
  memG[k] = a.g;
  for (let c = 0; c < 3; c++) { memF[k * 3 + c] = a.fg[c]; memB[k * 3 + c] = a.bg[c]; }
}

function componi(t) {
  SG.fill(' '); SF.fill(0); SB.fill(0);
  calcolaLuce(t);
  const visibili = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const k = idx(x, y), c = MX + x, r = MY + y;
    const Lr = Luce[k * 3], Lg = Luce[k * 3 + 1], Lb = Luce[k * 3 + 2];
    const lum = Lr * 0.3 + Lg * 0.5 + Lb * 0.2;
    const vede = inVista[k] && (lum > 0.075 || distanze[k] <= 1.5 || DEF[T[k]].luce || fuoco[k] > 0);
    if (vede) {
      if (!visto[k] || (t * 4 | 0) % 2 === 0) ricorda(k);
      visto[k] = 1;
      const a = aspetto(k, t);
      const L = [Math.min(Lr, 1.7), Math.min(Lg, 1.7), Math.min(Lb, 1.7)];
      let fg, bg;
      if (a.em) { fg = a.fg.map((v, i) => v * (0.85 + L[i] * 0.25)); bg = a.bg.map((v, i) => v * (0.8 + L[i] * 0.3)); }
      else { fg = a.fg.map((v, i) => v * L[i] * 1.25); bg = a.bg.map((v, i) => v * L[i] * 1.35); }
      // fumo: vela il fondo di grigio
      const f = Math.min(1, fumo[k]);
      if (f > 0.02) {
        const gl = Math.min(0.42, 0.16 + lum * 0.12);
        bg = bg.map(v => v * (1 - f * 0.6) + gl * f * 0.6);
        fg = fg.map(v => v * (1 - f * 0.35) + gl * f * 0.4);
      }
      cella(c, r, a.g, fg, bg);
      const o = oggetti.get(k);
      if (o) cella(c, r, o, OGGETTI[o].fg.map((v, i) => v * Math.min(1.2, 0.5 + L[i] * 0.7)));
      visibili.push(k);
    } else if (visto[k]) {
      // memoria: grigio-blu scuro, senza luce
      const mf = [memF[k * 3], memF[k * 3 + 1], memF[k * 3 + 2]], mb = [memB[k * 3], memB[k * 3 + 1], memB[k * 3 + 2]];
      const q = v => v[0] * 0.3 + v[1] * 0.5 + v[2] * 0.2;
      const lf = q(mf), lb = q(mb);
      cella(c, r, memG[k], [lf * 0.32 + 0.05, lf * 0.36 + 0.07, lf * 0.55 + 0.13], [lb * 0.22 + 0.012, lb * 0.25 + 0.016, lb * 0.42 + 0.04]);
    }
  }
  // mostri visibili
  const visti = [];
  for (const m of mostri) {
    const k = idx(m.x, m.y);
    if (!visibili.includes(k)) continue;
    const L = Math.min(1.3, 0.55 + (Luce[k * 3] * 0.3 + Luce[k * 3 + 1] * 0.5 + Luce[k * 3 + 2] * 0.2) * 0.8);
    if (m.s === 'e' && Math.sin(t * 0.9 + m.x) < 0.1) continue; // l'anguilla si immerge
    cella(MX + m.x, MY + m.y, m.s, MOSTRI[m.s].fg.map(v => v * L));
    visti.push(m);
  }
  if (lancio) cella(MX + lancio.x, MY + lancio.y, '!', [1, 0.6, 0.3]);
  cella(MX + P.x, MY + P.y, '@', [1, 1, 1]);

  // ── barra laterale ──
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < 20; c++) cella(c, r, ' ', null, [0.02, 0.02, 0.03]);
  let r = 3;
  scrivi(0, r++, '@: Tu', [1, 1, 1]);
  barra(0, r++, 20, P.pv / P.pvMax, `Salute ${P.pv}/${P.pvMax}`, [0.62, 0.14, 0.14]);
  barra(0, r++, 20, Math.min(1, P.fiale / 5), `Fiale di fuoco: ${P.fiale}`, [0.62, 0.30, 0.06]);
  barra(0, r++, 20, 0.82, 'Sazio', [0.22, 0.40, 0.16]);
  scrivi(1, r++, `Oro: ${P.oro}`, [1, 0.85, 0.3]);
  r++;
  for (const m of visti.slice(0, 5)) {
    const d = MOSTRI[m.s];
    scrivi(0, r, m.s, d.fg); scrivi(1, r++, `: ${d.nome}`, [0.85, 0.85, 0.85]);
    barra(0, r++, 20, m.pv / d.pv, 'Salute', [0.50, 0.12, 0.12], [0.9, 0.9, 0.9]);
    r++;
  }
  for (const k of visibili) {
    if (r > 27) break;
    const o = oggetti.get(k); if (!o) continue;
    scrivi(0, r, o, OGGETTI[o].fg); scrivi(1, r++, `: ${OGGETTI[o].nome.replace(/^(una?|qualche) /, '')}`, [0.7, 0.7, 0.7]);
  }
  const fiamme = visibili.filter(k => fuoco[k] > 0).length;
  if (fiamme && r <= 28) { scrivi(0, r, '^', FIAMME[1]); scrivi(1, r++, ': fuoco che divampa', [0.8, 0.6, 0.45]); }
  const dp = `-- Profondità: ${profondita} --`;
  scrivi(Math.floor((20 - dp.length) / 2), ROWS - 3, dp, [0.6, 0.6, 0.65]);

  // ── messaggi: il più nuovo in basso e acceso, i vecchi sbiadiscono ──
  const ultimi = messaggi.slice(-3);
  for (let i = 0; i < ultimi.length; i++) {
    const m = ultimi[ultimi.length - 1 - i], f = [1, 0.62, 0.4][i];
    scrivi(MX, 2 - i, m.s.slice(0, COLS - MX), m.col.map(v => v * f));
  }
  // ── pulsanti in fondo, come in Brogue ──
  const tasti = [['Frecce', ' muovi'], ['Spazio', ' lancia una fiala'], ['Urta', ' un braciere'], ['>', ' scendi']];
  let c = MX + 1;
  for (const [a, b] of tasti) {
    scrivi(c, ROWS - 1, ' ' + a, [1, 0.85, 0.35], [0.08, 0.08, 0.13]); c += a.length + 1;
    scrivi(c, ROWS - 1, b + ' ', [0.78, 0.78, 0.85], [0.08, 0.08, 0.13]); c += b.length + 3;
  }
}

const fmt = v => Math.max(0, Math.min(255, Math.round(v * 255)));
function disegna() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.font = `${fontPx}px Brogue, "DejaVu Sans Mono", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let r = 0; r < ROWS; r++) {
    const y0 = Math.round(r * ch), y1 = Math.round((r + 1) * ch);
    for (let c = 0; c < COLS; c++) {
      const k = r * COLS + c, x0 = Math.round(c * cw), x1 = Math.round((c + 1) * cw);
      const br = fmt(SB[k * 3]), bgc = fmt(SB[k * 3 + 1]), bb = fmt(SB[k * 3 + 2]);
      if (br | bgc | bb) { ctx.fillStyle = `rgb(${br},${bgc},${bb})`; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
      const g = SG[k];
      if (g !== ' ') {
        ctx.fillStyle = `rgb(${fmt(SF[k * 3])},${fmt(SF[k * 3 + 1])},${fmt(SF[k * 3 + 2])})`;
        ctx.fillText(g, (x0 + x1) / 2, (y0 + y1) / 2 + fontPx * 0.04);
      }
    }
  }
}

// ─────────────────────────── Avvio ───────────────────────────
async function avvia() {
  Demo.carica('Scavo il sotterraneo');
  try {
    const ff = new FontFace('Brogue', 'url(assets/DejaVuSansMono.ttf)');
    await ff.load(); document.fonts.add(ff);
  } catch (e) { console.warn('font', e); }
  ridimensiona();
  generaLivello(Number(Demo.query.get('seme')) || 31);
  msg('Benvenuto nelle Segrete. Le scale portano solo in giù.', [0.85, 0.8, 1]);
  // un braciere già rovesciato: il fuoco corre sull'erba secca quando si accende lo schermo
  let innesco = -1, dm = 1e9;
  calcolaVista();
  for (let k = 0; k < N; k++) {
    if ((T[k] === ERBA || T[k] === SECCA) && inVista[k]) {
      const d = Math.abs(distanze[k] - 5.5); if (d < dm) { dm = d; innesco = k; }
    }
  }
  if (innesco >= 0) {
    accendi(innesco % MW, (innesco / MW) | 0, 1.2);
    for (let i = 0; i < 5; i++) passoFuoco();
    messaggi.length = 1;
    msg('Qualcosa ha dato fuoco all\'erba: le fiamme si allargano!', [1, 0.6, 0.3]);
  }
  calcolaVista();
  esplorato(Demo.query.has('tutto') ? 999 : 55);
  let accFuoco = 0, rip = 0, tenuto = false;
  Demo.loop((dt, t) => {
    // movimento a turni con ripetizione se il tasto resta giù
    const a = Demo.asse();
    const dx = Math.sign(Math.round(a.x)), dy = -Math.sign(Math.round(a.y));
    if ((dx || dy) && !lancio) {
      if (!tenuto) { turno(dx, dy); tenuto = true; rip = 0.22; }
      else { rip -= dt; if (rip <= 0) { turno(dx, dy); rip = 0.085; } }
    } else if (!dx && !dy) tenuto = false;
    if (Demo.premuto(' ') || Demo.premuto('e')) lancia();
    if (lancio) passoLancio(dt);
    accFuoco += dt;
    while (accFuoco > 0.15) { accFuoco -= 0.15; passoFuoco(); }
    componi(t);
    disegna();
  });
  Demo.pronto();
}
Demo.extra('<h4>Legenda</h4><p><b>@</b> tu · <b>#</b> muro · <b>+</b> porta · <b>"</b> erba (verde), erba secca (gialla), funghi luminosi (azzurri) · <b>~</b> acqua, lava · <b>Ω</b> braciere · <b>^</b> fuoco · <b>!</b> fiala incendiaria · <b>?</b> pergamena · <b>&gt;</b> scala</p><p>Ciò che hai già visto resta in memoria, in grigio-blu.</p>');
avvia().catch(e => Demo.errore(e));
