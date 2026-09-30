// Pixel art 16 bit: un livello di platform su un'isola al tramonto.
// Tutto disegnato su un canvas a bassa risoluzione (altezza ~240 px) ingrandito a scala intera
// senza filtro. Grafica: Treasure Hunters di Pixel Frog (CC0). Cielo, mare e luci sono procedurali.

const T = 32;                    // lato del tile
const COLS = 84, ROWS = 10;
const ACQUA = 8 * T + 2;         // quota della superficie del mare nel livello
const GRAV = 1050, SALTO = 372, VMAX = 122;

// ── Canvas a scala intera ──
const cv = document.createElement('canvas');
cv.className = 'px';
document.body.prepend(cv);
const ctx = cv.getContext('2d');
let S = 3, LW = 427, LH = 240;
function ridimensiona() {
  S = Math.max(1, Math.ceil(innerHeight / 270));
  LW = Math.ceil(innerWidth / S); LH = Math.ceil(innerHeight / S);
  cv.width = LW; cv.height = LH;
  cv.style.width = LW * S + 'px'; cv.style.height = LH * S + 'px';
  ctx.imageSmoothingEnabled = false;
  cieloCache = null;
}
addEventListener('resize', ridimensiona);

// ── Immagini ──
const META = {"cap_idle":[64,40,5],"cap_run":[64,40,6],"cap_jump":[64,40,3],"cap_fall":[64,40,1],"cap_ground":[64,40,2],"cap_hit":[64,40,4],"dust_jump":[52,20,6],"dust_fall":[52,20,5],"dust_run":[52,20,5],"crab_run":[72,32,6],"crab_dead":[72,32,4],"star_run":[34,30,6],"star_dead":[34,30,4],"tooth_run":[34,30,6],"tooth_dead":[34,30,4],"coin":[16,16,4],"coin_fx":[16,16,3],"dia_blue":[24,24,4],"dia_red":[24,24,4],"dia_green":[24,24,4],"dia_fx":[24,24,4],"water_top":[96,32,4],"water_bot":[96,32,1],"splash":[24,12,5],"candle":[32,32,6],"chest_open":[64,35,10],"chest_close":[64,35,10],"flag":[34,93,9],"palm_top":[39,32,4],"bpalm":[64,64,4],"bpalm_l":[51,53,4],"bpalm_r":[52,53,4],"refl_big":[170,10,4],"refl_med":[53,3,4],"refl_small":[35,3,4],"barrels":[32,32,6],"terrain":[544,160,1],"palm_base":[96,96,1],"clouds_big":[448,101,1],"cloud1":[74,24,1],"cloud2":[133,35,1],"cloud3":[140,39,1],"spikes":[32,32,1],"flag_base":[30,16,1]};
const IMG = {};
function carica(nome) {
  return new Promise((ok, ko) => {
    const im = new Image();
    im.onload = () => { IMG[nome] = im; ok(); };
    im.onerror = () => ko(new Error('Manca ' + nome + '.png'));
    im.src = 'assets/' + nome + '.png?v=8';
  });
}

// Copia di un'immagine velata con un colore (foschia dei piani lontani, sagome in controluce)
function vela(im, colore, quanto) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = quanto; g.fillStyle = colore; g.fillRect(0, 0, c.width, c.height);
  return c;
}

// Alone a gradini (la "color math" additiva del Super Nintendo: niente sfumature continue)
function alone(r, colore, passi = 4) {
  const c = document.createElement('canvas'); c.width = c.height = r * 2 + 1;
  const g = c.getContext('2d');
  const [R, G, B] = colore;
  const im = g.createImageData(c.width, c.height);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const d = Math.hypot(x - r, y - r) / r;
    if (d >= 1) continue;
    let v = Math.ceil((1 - d) * passi) / passi;          // quantizzato
    // retino 2x2 sul bordo di ogni gradino: il passaggio si "sfrangia" come nei giochi dell'epoca
    const fr = (1 - d) * passi % 1;
    if (fr < 0.18 && ((x + y) & 1)) v -= 1 / passi;
    v = v * v * 0.55;
    const i = (y * c.width + x) * 4;
    im.data[i] = R * v; im.data[i + 1] = G * v; im.data[i + 2] = B * v; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

// ── Disegno di uno sprite da striscia ──
let camX = 0, camY = 0;
function spr(nome, fr, x, y, flip = false, g = ctx) {
  const [w, h, n] = META[nome];
  const im = IMG[nome];
  fr = ((fr | 0) % n + n) % n;
  const sx = Math.round(x - camX), sy = Math.round(y - camY);
  if (sx > LW || sy > LH || sx + w < 0 || sy + h < 0) return;
  if (flip) {
    g.save(); g.translate(sx + w, sy); g.scale(-1, 1);
    g.drawImage(im, fr * w, 0, w, h, 0, 0, w, h);
    g.restore();
  } else g.drawImage(im, fr * w, 0, w, h, sx, sy, w, h);
}

// ── Livello ──
const mappa = Array.from({ length: ROWS }, () => new Array(COLS).fill(0)); // 0 vuoto, 1 roccia, 2 asse
const suolo = (a, b, cima = 7) => { for (let c = a; c <= b; c++) for (let r = cima; r < ROWS; r++) mappa[r][c] = 1; };
const blocco = (a, b, r0, r1) => { for (let c = a; c <= b; c++) for (let r = r0; r <= r1; r++) mappa[r][c] = 1; };
const asse = (a, b, r) => { for (let c = a; c <= b; c++) mappa[r][c] = 2; };

suolo(0, 14); suolo(17, 28); blocco(22, 24, 6, 6);
asse(30, 31, 5);
suolo(33, 47); blocco(40, 41, 5, 6);
asse(44, 46, 4);
suolo(50, 63); asse(53, 56, 4); asse(58, 60, 2);
suolo(66, COLS - 1); blocco(70, 71, 6, 6);

const ENT = [];   // decorazioni e oggetti
const metti = (tipo, c, r, extra = {}) => ENT.push(Object.assign({ tipo, x: c * T + T / 2, y: r * T + T }, extra));
// primo tratto
metti('palma', 6, 6); metti('candela', 2, 6); metti('barili', 9, 6, { f: 0 }); metti('candela', 13, 6);
const arco = (c0, r, n, alto = 1) => { for (let i = 0; i < n; i++) { const k = (i - (n - 1) / 2) / ((n - 1) / 2 || 1); metti('moneta', c0 + i * 0.75, r - alto * (1 - k * k) * 0.9); } };
arco(10.2, 6, 5, 1.6);
arco(14.7, 5.6, 3, 0.9);
metti('palma', 19, 6); metti('candela', 21, 6); arco(22.2, 5, 4, 0.8); metti('diamante', 26, 3.4, { col: 'dia_blue' });
metti('barili', 27, 6, { f: 1 });
arco(29.8, 4.2, 3, 0.7);
metti('candela', 34, 6); metti('palma', 36, 6); arco(37.5, 6, 3, 0.6); metti('moneta', 40.5, 3.8); metti('moneta', 41.3, 3.8);
metti('diamante', 45, 2.6, { col: 'dia_red' }); metti('barili', 47, 6, { f: 3 }); metti('candela', 43, 6);
arco(47.9, 5.6, 3, 0.9);
metti('candela', 51, 6); metti('palma', 57, 6); arco(53.6, 3.6, 4, 0.6); metti('diamante', 59, 0.6, { col: 'dia_green' });
metti('barili', 62, 6, { f: 0 }); arco(63.9, 5.6, 3, 0.9);
metti('candela', 68, 6); metti('palma', 73, 6); metti('candela', 76, 6); arco(70, 4.6, 3, 0.7);
metti('forziere', 78, 6); metti('bandiera', 81, 6);

const NEMICI = [];
const nemico = (tipo, c, r, a, b) => NEMICI.push({ tipo, x: c * T + T / 2, y: r * T + T, vx: -26, min: a * T + 8, max: (b + 1) * T - 8, vivo: true, t: Math.random(), vy: 0, morto: 0 });
nemico('crab', 11, 6, 7, 14);
nemico('star', 26, 6, 25, 28);
nemico('tooth', 45, 6, 42, 47);
nemico('crab', 60, 6, 57, 63);
nemico('star', 75, 6, 72, 77);

const solido = (c, r) => (c < 0 || c >= COLS) ? true : (r >= ROWS ? false : r < 0 ? false : mappa[r][c] === 1);
const tipo = (c, r) => (c < 0 || c >= COLS || r < 0 || r >= ROWS) ? 0 : mappa[r][c];

// Pre-render dei tile del livello in un unico canvas (le rocce non cambiano)
let livello = null;
function costruisciLivello() {
  livello = document.createElement('canvas');
  livello.width = COLS * T; livello.height = ROWS * T;
  const g = livello.getContext('2d');
  const ter = IMG.terrain;
  const piazza = (tx, ty, c, r) => g.drawImage(ter, tx * T, ty * T, T, T, c * T, r * T, T, T);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = mappa[r][c];
    if (!v) continue;
    if (v === 2) {
      const l = tipo(c - 1, r) === 2, d = tipo(c + 1, r) === 2;
      if (!l && !d) piazza(4, 4, c, r); else piazza(!l ? 0 : !d ? 2 : 1, 4, c, r);
      continue;
    }
    const su = tipo(c, r - 1) === 1, giu = r + 1 >= ROWS || tipo(c, r + 1) === 1;
    const sx = c === 0 || tipo(c - 1, r) === 1, dx = c === COLS - 1 || tipo(c + 1, r) === 1;
    if (!sx && !dx) { piazza(4, !su ? 0 : !giu ? 2 : 1, c, r); continue; }
    piazza(!sx ? 0 : !dx ? 2 : 1, !su ? 0 : !giu ? 2 : 1, c, r);
  }
}

// ── Giocatore ──
const P = { x: 4 * T, y: 7 * T, vx: 0, vy: 0, a: 14, h: 24, terra: false, dir: 1, anim: 'idle', at: 0,
  coyote: 0, buffer: 0, ferito: 0, lampeggia: 0, sicuro: { x: 4 * T, y: 7 * T }, morto: 0, polvere: 0, atterra: 0 };
let monete = 0, diamanti = 0;
const FX = [];      // animazioni una tantum (polvere, scintille, spruzzi)
const BRICIOLE = []; // particelle di pixel
function fx(nome, x, y, flip = false, vel = 14) { FX.push({ nome, x, y, flip, t: 0, vel }); }
function briciole(x, y, n, col, forza = 60) {
  for (let i = 0; i < n; i++) BRICIOLE.push({ x, y, vx: (Math.random() - 0.5) * forza * 2, vy: -Math.random() * forza - 20,
    t: 0, vita: 0.4 + Math.random() * 0.4, col });
}

// Collisione rettangolo contro la mappa, asse per asse
function muovi(o, dt) {
  const hw = o.a / 2;
  // orizzontale
  o.x += o.vx * dt;
  const r0 = Math.floor((o.y - o.h + 1) / T), r1 = Math.floor((o.y - 1) / T);
  if (o.vx > 0) {
    const c = Math.floor((o.x + hw) / T);
    for (let r = r0; r <= r1; r++) if (solido(c, r)) { o.x = c * T - hw - 0.01; o.vx = 0; break; }
  } else if (o.vx < 0) {
    const c = Math.floor((o.x - hw) / T);
    for (let r = r0; r <= r1; r++) if (solido(c, r)) { o.x = (c + 1) * T + hw + 0.01; o.vx = 0; break; }
  }
  // verticale
  const prima = o.y;
  o.y += o.vy * dt;
  o.terra = false;
  const c0 = Math.floor((o.x - hw + 1) / T), c1 = Math.floor((o.x + hw - 1) / T);
  if (o.vy >= 0) {
    const r = Math.floor(o.y / T);
    for (let c = c0; c <= c1; c++) {
      const v = tipo(c, r);
      if (v === 1 || (v === 2 && prima <= r * T + 0.5)) { o.y = r * T; o.vy = 0; o.terra = true; break; }
    }
  } else {
    const r = Math.floor((o.y - o.h) / T);
    for (let c = c0; c <= c1; c++) if (solido(c, r)) { o.y = (r + 1) * T + o.h; o.vy = 0; break; }
  }
}

// ── Ingresso: tastiera e pad dal guscio; in foto un piccolo "attract mode" scritto a mano ──
const pilota = Demo.shot && !Demo.query.has('tieni') && !Demo.query.has('fermo');
let fotogramma = 0;
function input() {
  if (pilota) {
    const f = fotogramma;
    return { x: f > 8 ? 1 : 0, salto: f >= 52 && f < 70, premuto: f === 52 };
  }
  const a = Demo.asse();
  return { x: Math.abs(a.x) > 0.2 ? Math.sign(a.x) * Math.min(1, Math.abs(a.x) * 1.3) : 0, salto: Demo.giu(' ') || Demo.giu('ArrowUp') || Demo.giu('w'),
    premuto: Demo.premuto(' ') || Demo.premuto('ArrowUp') || Demo.premuto('w') };
}

function aggiornaGiocatore(dt, t) {
  const inp = input();
  if (P.morto > 0) {            // caduto in mare: si riparte dall'ultimo punto sicuro
    P.morto -= dt;
    if (P.morto <= 0) { P.x = P.sicuro.x; P.y = P.sicuro.y; P.vx = P.vy = 0; P.lampeggia = 1.2; fx('dust_fall', P.x - 26, P.y - 20); }
    return;
  }
  const acc = P.terra ? 1100 : 700;
  if (P.ferito > 0) { P.ferito -= dt; }
  else if (inp.x) { P.vx += inp.x * acc * dt; if (Math.abs(P.vx) > VMAX * Math.abs(inp.x)) P.vx = Math.sign(P.vx) * VMAX * Math.abs(inp.x); P.dir = inp.x > 0 ? 1 : -1; }
  else { const f = (P.terra ? 1300 : 300) * dt; P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f; }

  P.coyote = P.terra ? 0.1 : P.coyote - dt;
  P.buffer = inp.premuto ? 0.12 : P.buffer - dt;
  if (P.buffer > 0 && P.coyote > 0 && P.ferito <= 0) {
    P.vy = -SALTO; P.buffer = 0; P.coyote = 0; P.terra = false;
    fx('dust_jump', P.x - 26, P.y - 20);
    briciole(P.x, P.y, 5, '#f3e4c8', 40);
  }
  if (!inp.salto && P.vy < -140) P.vy += GRAV * 1.6 * dt;   // salto più basso se si lascia il tasto
  P.vy = Math.min(P.vy + GRAV * dt, 460);
  const eraTerra = P.terra, vyPrima = P.vy;
  muovi(P, dt);
  if (P.terra && !eraTerra && vyPrima > 150) {
    fx('dust_fall', P.x - 26, P.y - 20); P.atterra = 0.12;
    briciole(P.x - 6, P.y, 3, '#e9d7b6', 30); briciole(P.x + 6, P.y, 3, '#e9d7b6', 30);
  }
  if (P.terra) {
    // punto sicuro: solo su roccia piena sotto entrambi i piedi
    const c0 = Math.floor((P.x - 7) / T), c1 = Math.floor((P.x + 7) / T), r = Math.floor(P.y / T);
    if (tipo(c0, r) && tipo(c1, r)) P.sicuro = { x: P.x, y: P.y };
    if (Math.abs(P.vx) > 60) {
      P.polvere -= dt;
      if (P.polvere <= 0) { P.polvere = 0.3; fx('dust_run', P.x - 26 - P.dir * 10, P.y - 20, P.dir < 0); }
    }
  }
  P.atterra -= dt;
  P.lampeggia = Math.max(0, P.lampeggia - dt);
  P.x = Math.max(10, Math.min(COLS * T - 10, P.x));
  if (P.y > ACQUA + 10) {       // splash
    P.morto = 0.9; fx('splash', P.x - 12, ACQUA - 10, false, 10);
    for (let i = 0; i < 10; i++) briciole(P.x, ACQUA, 1, i % 2 ? '#ffffff' : '#bfe3f2', 90);
  }

  // animazione
  let a = 'idle';
  if (P.ferito > 0) a = 'hit';
  else if (!P.terra) a = P.vy < -40 ? 'jump' : 'fall';
  else if (P.atterra > 0) a = 'ground';
  else if (Math.abs(P.vx) > 8) a = 'run';
  if (a !== P.anim) { P.anim = a; P.at = 0; }
  P.at += dt;
}

// ── Mondo: oggetti e nemici ──
function aggiornaMondo(dt, t) {
  for (const e of ENT) {
    if ((e.tipo === 'moneta' || e.tipo === 'diamante') && !e.preso) {
      const cy = e.y - (e.tipo === 'moneta' ? 8 : 12);
      if (Math.abs(P.x - e.x) < 13 && Math.abs(P.y - P.h / 2 - cy) < 18 && P.morto <= 0) {
        e.preso = true;
        if (e.tipo === 'moneta') { monete++; fx('coin_fx', e.x - 8, cy - 8, false, 16); }
        else { diamanti++; fx('dia_fx', e.x - 12, cy - 12, false, 12); briciole(e.x, cy, 12, '#ffffff', 80); }
      }
    }
    if (e.tipo === 'forziere' && !e.aperto && Math.abs(P.x - e.x) < 30 && Math.abs(P.y - e.y) < 20) {
      e.aperto = true; e.t0 = t;
      for (let i = 0; i < 26; i++) briciole(e.x, e.y - 20, 1, i % 3 ? '#ffd35a' : '#fff6c0', 150);
    }
  }
  for (const n of NEMICI) {
    n.t += dt;
    if (!n.vivo) { n.vy += GRAV * dt; n.y += n.vy * dt; n.x += n.vx * dt; n.morto += dt; continue; }
    n.x += n.vx * dt;
    if (n.x < n.min) { n.x = n.min; n.vx = Math.abs(n.vx); }
    if (n.x > n.max) { n.x = n.max; n.vx = -Math.abs(n.vx); }
    if (P.morto > 0 || P.lampeggia > 0) continue;
    const hw = n.tipo === 'crab' ? 13 : 10, alto = n.tipo === 'crab' ? 18 : 20;
    if (Math.abs(P.x - n.x) < hw + 6 && P.y > n.y - alto && P.y - P.h < n.y) {
      if (P.vy > 40 && P.y < n.y - alto + 12) {        // schiacciato
        n.vivo = false; n.vy = -220; n.vx = P.dir * 40;
        P.vy = input().salto ? -SALTO * 1.05 : -250;
        fx('dust_fall', n.x - 26, n.y - 20);
        briciole(n.x, n.y - 10, 8, '#ffffff', 90);
      } else {                                           // colpito
        P.ferito = 0.35; P.lampeggia = 1.3; P.vx = (P.x < n.x ? -1 : 1) * 150; P.vy = -200;
        if (monete > 0) { const m = Math.min(3, monete); monete -= m; briciole(P.x, P.y - 12, m * 3, '#ffd35a', 110); }
      }
    }
  }
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i]; f.t += dt;
    if (f.t * f.vel >= META[f.nome][2]) FX.splice(i, 1);
  }
  for (let i = BRICIOLE.length - 1; i >= 0; i--) {
    const b = BRICIOLE[i]; b.t += dt;
    b.vy += 380 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.t > b.vita) BRICIOLE.splice(i, 1);
  }
}

// ── Fondale ──
// Cielo a bande come un gradiente HDMA: pochi colori pieni, righe di retino fra una banda e l'altra.
const CIELO = ['#3d3a74', '#4f4486', '#654f95', '#7f5c9e', '#9d6aa3', '#bb7ba3', '#d68f9f', '#e8a79d', '#f1bf9f', '#f6d4a7', '#f9e3b4'];
const MARE = ['#f6e2bd', '#c9c1d3', '#a8afd3', '#8e9dcb', '#7a8bc0', '#6978b2', '#5b69a5', '#4f5c98'];
let cieloCache = null;
function orizzonte() { return Math.round(LH * 0.6 - camY * 0.25); }
function disegnaCielo(t) {
  const oy = orizzonte();
  const key = LW + 'x' + LH + ':' + oy;
  if (!cieloCache || cieloCache.key !== key) {
    const c = document.createElement('canvas'); c.width = LW; c.height = LH;
    const g = c.getContext('2d');
    const im = g.createImageData(LW, LH);
    const bande = (y, y0, y1, pal) => {
      const u = Math.max(0, Math.min(0.9999, (y - y0) / (y1 - y0))) * pal.length;
      return u;
    };
    const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const CP = CIELO.map(hex), MP = MARE.map(hex);
    for (let y = 0; y < LH; y++) {
      let pal, u;
      if (y < oy) { pal = CP; u = bande(Math.pow(Math.max(0, y) / oy, 0.8) * oy, 0, oy, CP); }
      else { pal = MP; u = bande(Math.pow((y - oy) / Math.max(1, LH - oy), 0.7) * (LH - oy), 0, LH - oy, MP); }
      const i = Math.floor(u), fr = u - i;
      for (let x = 0; x < LW; x++) {
        // retino ordinato fra una banda e la successiva: due righe di scacchiera
        let k = i;
        if (fr > 0.82 && ((x + y) & 1) && i + 1 < pal.length) k = i + 1;
        if (y === oy) k = 0;
        const col = y === oy ? [255, 246, 222] : pal[k];
        const p = (y * LW + x) * 4;
        im.data[p] = col[0]; im.data[p + 1] = col[1]; im.data[p + 2] = col[2]; im.data[p + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    cieloCache = { key, c };
  }
  ctx.drawImage(cieloCache.c, 0, 0);
}

let ISOLA_MEDIA, PALME_MEDIE, SOLE, ALONE_CANDELA, ALONE_DIA = {}, ALONE_SOLE, NUVOLE_ROSA, ISOLA_LONTANA, PALME_VELATE, PALME_SCURE, NUVOLE_PICC = [];
function preparaFondale() {
  // sole a cerchi concentrici
  const r = 20;
  SOLE = document.createElement('canvas'); SOLE.width = SOLE.height = r * 2 + 1;
  const g = SOLE.getContext('2d');
  const anelli = ['#fff0c8', '#fff8e0', '#fffdf4'];
  anelli.forEach((c, i) => {
    const rr = r - i * 3;
    g.fillStyle = c;
    for (let y = -rr; y <= rr; y++) { const w = Math.round(Math.sqrt(rr * rr - y * y)); g.fillRect(r - w, r + y, w * 2 + 1, 1); }
  });
  ALONE_SOLE = alone(70, [255, 190, 130], 5);
  ALONE_CANDELA = alone(26, [255, 170, 70], 4);
  ALONE_DIA.dia_blue = alone(20, [90, 170, 255], 3);
  ALONE_DIA.dia_red = alone(20, [255, 80, 90], 3);
  ALONE_DIA.dia_green = alone(20, [80, 255, 140], 3);
  NUVOLE_ROSA = vela(IMG.clouds_big, '#f3b8a8', 0.35);
  NUVOLE_PICC = [vela(IMG.cloud1, '#e9b3b7', 0.3), vela(IMG.cloud2, '#e9b3b7', 0.3), vela(IMG.cloud3, '#e9b3b7', 0.3)];
  PALME_VELATE = [vela(IMG.bpalm, '#6a5d8e', 0.5), vela(IMG.bpalm_l, '#6a5d8e', 0.5), vela(IMG.bpalm_r, '#6a5d8e', 0.5)];
  // isola intermedia: gobba piena, bordo chiaro in cima, retino verso il basso
  {
    const W = 1400, H = 46;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const h = c.getContext('2d');
    const gobbe = [[60, 360, 30], [700, 260, 22], [1060, 200, 26]];
    PALME_MEDIE = [];
    for (const [x0, w, alt] of gobbe) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const y = Math.round(Math.pow(Math.sin(u * Math.PI), 0.45) * alt);
        if (y <= 0) continue;
        h.fillStyle = '#5b4f82'; h.fillRect(x0 + x, H - y, 1, y);
        h.fillStyle = '#7b6ca3'; h.fillRect(x0 + x, H - y, 1, 1);
        h.fillStyle = '#4d4274';
        for (let yy = H - y + 6; yy < H; yy++) if ((x + yy) % 2 === 0 && yy > H - y + 6 + (x * 7 % 5)) h.fillRect(x0 + x, yy, 1, 1);
      }
      const n = Math.max(2, Math.round(w / 90));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.7) / (n + 0.4);
        const px = x0 + Math.round(u * w);
        const py = Math.round(Math.pow(Math.sin(u * Math.PI), 0.45) * alt);
        PALME_MEDIE.push([px, py, i % 3]);
      }
    }
    ISOLA_MEDIA = c;
  }
  PALME_SCURE = vela(IMG.palm_top, '#1c1630', 0.92);
  // isole lontane: profilo procedurale a gobbe, colore della foschia
  ISOLA_LONTANA = [];
  const colori = ['#a38bb4', '#8a78a8'];
  for (let k = 0; k < 2; k++) {
    const c = document.createElement('canvas'); c.width = 900; c.height = 60;
    const h = c.getContext('2d'); h.fillStyle = colori[k];
    let seme = 7 + k * 13;
    const rnd = () => (seme = (seme * 9301 + 49297) % 233280) / 233280;
    const isole = k === 0 ? [[40, 220, 22], [420, 160, 14], [700, 150, 18]] : [[180, 190, 30], [560, 240, 26]];
    for (const [x0, w, alt] of isole) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        let y = Math.sin(u * Math.PI) ** 0.6 * alt + Math.sin(x * 0.09 + rnd()) * 1.5;
        y = Math.round(y);
        h.fillRect(x0 + x, 60 - y, 1, y);
      }
    }
    ISOLA_LONTANA.push(c);
  }
}

function disegnaFondale(t) {
  disegnaCielo(t);
  const oy = orizzonte();
  const sx = Math.round(LW * 0.68 - camX * 0.02);
  // nuvole grandi (parallasse 0.06) e piccole che scorrono da sole
  const nw = IMG.clouds_big.width;
  const nx = -((camX * 0.06 + t * 2) % nw);
  for (let x = nx - nw; x < LW; x += nw) ctx.drawImage(NUVOLE_ROSA, Math.round(x), oy - 104);
  const picc = [[0, 40, 0.16], [300, 18, 0.12], [650, 58, 0.2], [980, 30, 0.14]];
  picc.forEach(([x0, y0, p], i) => {
    const im = NUVOLE_PICC[i % 3], W = LW + 300;
    const x = ((x0 - camX * p - t * (4 + i * 1.5)) % W + W) % W - 150;
    ctx.drawImage(im, Math.round(x), Math.round(y0 - camY * 0.1));
  });

  // sole e alone additivo
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(ALONE_SOLE, sx - 70, oy - 18 - 70);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(SOLE, sx - 20, oy - 18 - 20);

  // isole lontane (due piani), poggiate sull'orizzonte
  const isola = (im, p, dy) => {
    const x0 = -((camX * p) % im.width);
    for (let x = x0 - im.width; x < LW; x += im.width) ctx.drawImage(im, Math.round(x), oy - 60 + dy);
  };
  isola(ISOLA_LONTANA[0], 0.12, 1);
  isola(ISOLA_LONTANA[1], 0.2, 2);
  // riflessi sul mare: sprite animati a tre profondità
  const riflessi = [['refl_small', 4, 0.25, 7], ['refl_med', 12, 0.3, 6], ['refl_big', 24, 0.38, 5], ['refl_small', 36, 0.45, 7], ['refl_med', 50, 0.5, 6]];
  riflessi.forEach(([n, dy, p, v], i) => {
    const w = META[n][0], per = 420 + i * 70;
    for (let x = -((camX * p + i * 131) % per); x < LW; x += per) {
      spr(n, t * v + i, x + camX, oy + dy + camY);
    }
  });
  // scia del sole sull'acqua: trattini che luccicano
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const y = oy + 2 + i * 2 + (i > 10 ? i - 10 : 0);
    const w = Math.max(2, 22 - i * 0.6 + Math.sin(t * 3 + i * 1.7) * 5);
    const jit = Math.round(Math.sin(t * 2.3 + i * 2.1) * (2 + i * 0.3));
    const on = Math.sin(t * 5 + i * 3.3) > -0.3;
    if (!on) continue;
    ctx.fillStyle = i < 8 ? '#6b4a2a' : '#3c2c1c';
    ctx.fillRect(Math.round(sx - w / 2 + jit), y, Math.round(w), 1);
  }
  ctx.globalCompositeOperation = 'source-over';

  // isola intermedia con palme che ondeggiano (parallasse 0.45)
  const im = ISOLA_MEDIA, base = oy + 30;
  const x0 = -((camX * 0.45 + 200) % im.width);
  for (let x = x0 - im.width; x < LW; x += im.width) {
    const X = Math.round(x);
    if (X > LW || X + im.width < 0) continue;
    for (const [px, py, v] of PALME_MEDIE) {
      const nome = v === 0 ? 'bpalm' : v === 1 ? 'bpalm_l' : 'bpalm_r';
      const [w, h] = META[nome];
      ctx.drawImage(PALME_VELATE[v], (Math.floor(t * 6 + px * 0.1) % 4) * w, 0, w, h, X + px - (w >> 1), base - py - h + 4, w, h);
    }
    ctx.drawImage(im, X, base - im.height);
  }
}

// ── Piano di gioco ──
function disegnaGioco(t) {
  // palme dietro al livello (tronco + chioma animata)
  for (const e of ENT) if (e.tipo === 'palma') {
    const bx = e.x - 16, by = e.y;
    const alt = 2 + ((e.x / T | 0) % 2);
    for (let k = 0; k < alt; k++) {
      const sx = Math.round(bx - camX), sy = Math.round(by - (k + 1) * T - camY);
      ctx.drawImage(IMG.palm_base, 0, 0, T, T, sx, sy, T, T);
    }
    // ciuffo d'erba ai piedi
    ctx.drawImage(IMG.palm_base, T, 2 * T, T, T, Math.round(bx - 6 - camX), Math.round(by - T - camY), T, T);
    ctx.drawImage(IMG.palm_base, 2 * T, 2 * T, T, T, Math.round(bx + 8 - camX), Math.round(by - T - camY), T, T);
    spr('palm_top', t * 7 + e.x, bx - 3, by - alt * T - 22);
  }
  // rocce
  const x0 = Math.max(0, Math.floor(camX)), w = Math.min(LW, livello.width - x0);
  ctx.drawImage(livello, x0, Math.floor(camY), w, LH, Math.round(x0 - camX), 0, w, LH);

  // oggetti
  for (const e of ENT) {
    if (e.tipo === 'candela') spr('candle', t * 9 + e.x, e.x - 16, e.y - 25);
    else if (e.tipo === 'barili') spr('barrels', e.f, e.x - 16, e.y - 32);
    else if (e.tipo === 'moneta' && !e.preso) spr('coin', t * 10 + e.x * 0.05, e.x - 8, e.y - 16 + Math.round(Math.sin(t * 3 + e.x) * 1));
    else if (e.tipo === 'diamante' && !e.preso) spr(e.col, t * 8, e.x - 12, e.y - 24 + Math.round(Math.sin(t * 2.5 + e.x) * 2));
    else if (e.tipo === 'forziere') {
      if (e.aperto) spr('chest_open', Math.min(9, (t - e.t0) * 14), e.x - 32, e.y - 35);
      else spr('chest_close', t * 8, e.x - 32, e.y - 35);
    } else if (e.tipo === 'bandiera') {
      spr('flag', t * 11, e.x - 4, e.y - 93);
    }
  }
  // nemici
  for (const n of NEMICI) {
    const nome = n.tipo + (n.vivo ? '_run' : '_dead');
    const [w, h] = META[nome];
    const fr = n.vivo ? n.t * 12 : Math.min(3, n.morto * 12);
    const flip = n.tipo === 'crab' ? false : n.vx > 0;
    if (n.tipo === 'crab') spr(nome, fr, n.x - 36, n.y - 29, flip);
    else spr(nome, fr, n.x - 17, n.y - 29 + (n.tipo === 'tooth' ? 1 : 0), flip);
  }
  // effetti dietro al personaggio
  for (const f of FX) if (f.nome.startsWith('dust')) spr(f.nome, f.t * f.vel, f.x, f.y, f.flip);
  // giocatore
  if (P.morto <= 0 && !(P.lampeggia > 0 && Math.floor(P.lampeggia * 20) % 2)) {
    const nome = 'cap_' + P.anim;
    const vel = { idle: 8, run: 13, jump: 12, fall: 1, ground: 16, hit: 14 }[P.anim];
    let fr = P.at * vel;
    if (P.anim === 'jump') fr = Math.min(2, fr);
    spr(nome, fr, P.x - 32 + (P.dir < 0 ? 2 : 0), P.y - 32, P.dir < 0);
  }
  for (const f of FX) if (!f.nome.startsWith('dust')) spr(f.nome, f.t * f.vel, f.x, f.y, f.flip);
  for (const b of BRICIOLE) {
    ctx.fillStyle = b.col;
    ctx.fillRect(Math.round(b.x - camX), Math.round(b.y - camY), 1, 1);
  }
}

function disegnaAcqua(t) {
  const y = Math.round(ACQUA - 6 - camY);
  if (y > LH) return;
  const off = Math.round(camX) % 96;
  for (let x = -off; x < LW; x += 96) {
    ctx.drawImage(IMG.water_top, (Math.floor(t * 7) % 4) * 96, 0, 96, 32, x, y, 96, 32);
    for (let yy = y + 32; yy < LH; yy += 32) ctx.drawImage(IMG.water_bot, x, yy);
  }
  // il mare si scurisce a bande con la profondità
  const scuri = ['rgba(40,60,110,0.10)', 'rgba(40,55,105,0.18)', 'rgba(35,45,95,0.27)', 'rgba(30,38,85,0.36)'];
  for (let i = 0; i < 4; i++) {
    const yy = y + 14 + i * 10;
    if (yy >= LH) break;
    ctx.fillStyle = scuri[i]; ctx.fillRect(0, yy, LW, i === 3 ? LH - yy : 10);
  }
  // scintille sulla cresta
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i++) {
    const wx = ((i * 97 + Math.floor(t * 2 + i) * 53) % 700) - (camX % 700);
    const X = ((wx % 700) + 700) % 700;
    if (X > LW) continue;
    if ((Math.floor(t * 6 + i * 0.7) % 5) > 1) continue;
    ctx.fillStyle = '#5a6a70';
    ctx.fillRect(Math.round(X), y + 3 + (i % 3) * 5, 3, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function disegnaLuci(t) {
  ctx.globalCompositeOperation = 'lighter';
  for (const e of ENT) {
    if (e.tipo === 'candela') {
      // la fiamma tremola: il raggio cambia a scatti, non in modo continuo
      const fl = Math.floor(t * 12 + e.x) % 3;
      const im = ALONE_CANDELA;
      const d = [0, 1, 2][fl];
      ctx.drawImage(im, 0, 0, im.width, im.height, Math.round(e.x - camX - 26 + d), Math.round(e.y - 17 - camY - 26 + d), im.width - d * 2, im.height - d * 2);
    }
    if (e.tipo === 'diamante' && !e.preso) {
      const im = ALONE_DIA[e.col];
      ctx.drawImage(im, Math.round(e.x - camX - 20), Math.round(e.y - 12 - camY - 20 + Math.sin(t * 2.5 + e.x) * 2));
    }
    if (e.tipo === 'forziere' && e.aperto) {
      const k = Math.min(1, (t - e.t0) * 1.5);
      ctx.globalAlpha = k;
      ctx.drawImage(ALONE_CANDELA, Math.round(e.x - camX - 26), Math.round(e.y - 22 - camY - 26));
      ctx.globalAlpha = 1;
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

// primo piano: fronde scure in controluce che scorrono più veloci del livello
function disegnaPrimoPiano(t) {
  const per = 820;
  for (const [px, alto] of [[120, true], [520, false], [700, true]]) {
    const x = ((px - camX * 1.35) % per + per) % per - 60;
    for (let k = 0; k < 2; k++) {
      const X = Math.round(x + k * per);
      if (X < -120 || X > LW + 40) continue;
      const fr = Math.floor(t * 5 + px) % 4;
      ctx.save();
      if (alto) {
        ctx.translate(X, -6); ctx.scale(2, -2);
        ctx.drawImage(PALME_SCURE, fr * 39, 0, 39, 32, 0, -32, 39, 32);
      } else {
        ctx.translate(X, LH + 4); ctx.scale(2, 2);
        ctx.drawImage(PALME_SCURE, fr * 39, 0, 39, 32, 0, -32, 39, 32);
      }
      ctx.restore();
    }
  }
}

// ── HUD con caratteri 3x5 fatti a mano ──
const CIFRE = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001010010', '111101111101111', '111101111001111', '000101010101000'];
function testo(s, x, y) {
  for (const pass of [0, 1]) {
    let cx = x;
    for (const ch of s) {
      const idx = ch === 'x' ? 10 : +ch;
      const b = CIFRE[idx];
      for (let i = 0; i < 15; i++) if (b[i] === '1') {
        const px = cx + (i % 3), py = y + Math.floor(i / 3);
        if (pass === 0) { ctx.fillStyle = '#2b1d33'; ctx.fillRect(px - 1, py - 1, 3, 3); }
        else { ctx.fillStyle = (i / 3 | 0) < 2 ? '#fffbe8' : '#ffd66b'; ctx.fillRect(px, py, 1, 1); }
      }
      cx += 5;
    }
  }
}
function disegnaHud(t) {
  const x = Math.round(LW / 2 - 40), y = 10;
  const cf = Math.floor(t * 8) % 4;
  ctx.drawImage(IMG.coin, cf * 16, 0, 16, 16, x, y - 5, 16, 16);
  testo('x' + String(monete).padStart(2, '0'), x + 17, y);
  ctx.drawImage(IMG.dia_blue, 0, 0, 24, 24, x + 44, y - 9, 24, 24);
  testo('x' + diamanti, x + 66, y);
}

// ── Ciclo ──
function camera(dt) {
  const guarda = P.dir * LW * 0.14 + P.vx * 0.25;
  camera.anticipo = camera.anticipo == null ? guarda : camera.anticipo + (guarda - camera.anticipo) * Math.min(1, dt * 2.2);
  const tx = P.x - LW / 2 + camera.anticipo;
  const ty = Math.min(P.y + 40, 7 * T) - LH * 0.76;
  const k = Math.min(1, dt * 6);
  camX += (tx - camX) * k; camY += (ty - camY) * Math.min(1, dt * 3);
  camX = Math.max(0, Math.min(COLS * T - LW, camX));
  camY = Math.max(0, Math.min(ROWS * T - LH, camY));
}

async function avvia() {
  ridimensiona();
  const nomi = Object.keys(META);
  let fatti = 0;
  await Promise.all(nomi.map(n => carica(n).then(() => Demo.carica('Carico gli sprite', ++fatti / nomi.length))));
  costruisciLivello();
  preparaFondale();
  if (Demo.query.has('x')) { P.x = +Demo.query.get('x') * T; P.sicuro = { x: P.x, y: P.y }; }
  camera(1); camX = Math.max(0, Math.min(COLS * T - LW, P.x - LW / 2 + P.dir * LW * 0.14)); camY = Math.max(0, Math.min(ROWS * T - LH, 7 * T - LH * 0.76));
  Demo.loop((dt, t) => {
    if (dt > 0) {
      const passi = Math.ceil(dt / (1 / 60));
      for (let i = 0; i < passi; i++) { aggiornaGiocatore(dt / passi, t); aggiornaMondo(dt / passi, t); }
      camera(dt);
      fotogramma++;
    }
    ctx.imageSmoothingEnabled = false;
    disegnaFondale(t);
    disegnaGioco(t);
    disegnaLuci(t);
    disegnaAcqua(t);
    disegnaHud(t);
    if (Demo.query.has('debug') && window.__shotReady) document.title = 'DBG ' + [camX, camY, P.x, P.y, LW, LH, S].map(v => Math.round(v)).join(',');
  });
  Demo.pronto();
}
avvia().catch(e => Demo.errore(e));
