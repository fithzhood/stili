// Pseudo-3D synthwave — omaggio a Out Run (1986).
// Si disegna tutto su una tela piccola (360 righe, come una scheda da sala giochi un po' più
// generosa), poi si ingrandisce a pixel pieni, con un bagliore sulle parti al neon e le scanline.
import { SEG, LARGH, CAM_H, CAM_D, VISTA, segmenti, costruisciPista, trova, preparaCielo, disegnaCielo,
  disegnaStrada, disegnaSprite } from './strada.js?v=1';
import { creaSprite, disegnaAuto } from './sprite.js?v=1';

const LH = 360;
let LW = 640;
const schermo = document.createElement('canvas');
schermo.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;image-rendering:pixelated';
document.body.prepend(schermo);
const sx = schermo.getContext('2d', { alpha: false });
const bassa = document.createElement('canvas'), x = bassa.getContext('2d', { alpha: false });
const bagliore = document.createElement('canvas'), bx = bagliore.getContext('2d');
let SW = 0, SH = 0;

function ridimensiona() {
  SW = Math.round(innerWidth * Math.min(devicePixelRatio || 1, 2)); SH = Math.round(innerHeight * Math.min(devicePixelRatio || 1, 2));
  schermo.width = SW; schermo.height = SH;
  LW = Math.round(LH * SW / SH);
  bassa.width = LW; bassa.height = LH;
  bagliore.width = Math.round(LW / 3); bagliore.height = Math.round(LH / 3);
  preparaCielo(LW, LH);
}

// ─────────────────────────── Stato ───────────────────────────
const VMAX = SEG * 60;                      // un segmento per fotogramma a 60 fps
const G = {
  pos: 0, vel: VMAX * 0.78, x: -0.15, sterzo: 0, lean: 0, auto: true,
  tempo: 60, punti: 0, giro: 0, tempoGiro: 0, fine: 0, avviso: 0, sfondoX: 0, sobbalzo: 0,
  fumo: [], traffico: [], frena: false, fuori: false,
};
let S = null;
const pezzi = { lampSx: 1, lampDx: 1, lampRosaSx: 1, lampRosaDx: 1, frecciaSx: 1, frecciaDx: 1 };
function immagine(nome) {
  if (nome.startsWith('palma')) return S.palme[+nome.slice(5)];
  if (nome.startsWith('cartello')) return S.cartelli[+nome.slice(8)];
  return S[nome];
}
let rs = 99; const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };

function creaTraffico() {
  G.traffico = [];
  for (let i = 0; i < 16; i++) {
    const z = (1200 + i * 150 + rnd() * 90) * SEG % (segmenti.length * SEG);
    G.traffico.push({ z, off: [-0.62, 0, 0.62][Math.floor(rnd() * 3)] + (rnd() - 0.5) * 0.1, vel: VMAX * (0.32 + rnd() * 0.22),
      img: Math.floor(rnd() * 4) });
  }
  // una macchina subito davanti, per l'inquadratura d'apertura
  G.traffico.push({ z: 26 * SEG, off: 0.55, vel: VMAX * 0.55, img: 0 });
  G.traffico.push({ z: 55 * SEG, off: -0.6, vel: VMAX * 0.5, img: 1 });
}

// ─────────────────────────── Aggiornamento ───────────────────────────
function aggiorna(dt, t) {
  const L = segmenti.length * SEG;
  const asse = Demo.asse();
  const gas = asse.y > 0.3 || Demo.pad.rt > 0.2, freno = asse.y < -0.3 || Demo.pad.lt > 0.2;
  if (G.auto && (asse.x || asse.y || Demo.pad.rt > 0.2 || Demo.premuto(' '))) {
    G.auto = false; G.tempo = 60; G.punti = 0; G.giro = 0; G.tempoGiro = 0; G.fine = 0; G.avviso = 0;
  }
  const segG = trova(G.pos + CAM_H * CAM_D);
  const perc = G.vel / VMAX;
  let sterzo, acc;
  if (G.auto || G.fine > 0) {
    // pilota automatico: segue la curva e scarta le auto davanti
    let bersaglio = -0.1;
    for (const c of G.traffico) {
      let d = (c.z - G.pos + L) % L;
      if (d > 0 && d < SEG * 45 && Math.abs(c.off - bersaglio) < 0.5) bersaglio = c.off > 0 ? c.off - 0.75 : c.off + 0.75;
    }
    sterzo = Math.max(-1, Math.min(1, (bersaglio - G.x) * 3 + segG.curva * perc * 0.35));
    acc = G.fine > 0 ? -0.3 : perc < 0.86 ? 1 : 0;
  } else {
    sterzo = asse.x;
    acc = gas ? 1 : freno ? -1 : 0;
  }
  G.frena = acc < 0;
  const dx = dt * 2 * perc;
  G.x += dx * sterzo;
  G.x -= dx * perc * segG.curva * 0.3;               // la forza centrifuga spinge fuori
  if (acc > 0) G.vel += VMAX / 5 * dt * (1.15 - perc * 0.5);
  else if (acc < 0) G.vel -= VMAX * 0.9 * dt;
  else G.vel -= VMAX / 5 * dt;
  G.fuori = Math.abs(G.x) > 1.08;
  if (G.fuori && G.vel > VMAX / 4) G.vel -= VMAX / 1.6 * dt;
  G.x = Math.max(-3, Math.min(3, G.x));
  G.vel = Math.max(0, Math.min(VMAX, G.vel));
  // urti con palme e cartelli fuori strada
  if (G.fuori) for (const sp of segG.sprite) {
    const img = immagine(sp.nome), w = img.width * 14 / LARGH * 0.35;
    if (Math.abs(G.x - sp.off) < w + 0.12) { G.vel = VMAX / 6; G.x = sp.off > 0 ? sp.off - w - 0.2 : sp.off + w + 0.2; G.sobbalzo = 1; }
  }
  // traffico
  for (const c of G.traffico) {
    c.z = (c.z + c.vel * dt) % L;
    const d = (c.z - G.pos - CAM_H * CAM_D + L) % L;
    if (d < SEG * 1.2 && G.vel > c.vel && Math.abs(G.x - c.off) < 0.42) {
      G.vel = c.vel * 0.8; G.pos = (c.z - CAM_H * CAM_D - SEG * 1.3 + L) % L; G.sobbalzo = 1;
    }
  }
  const prima = G.pos;
  G.pos = (G.pos + G.vel * dt) % L;
  if (G.pos < prima) { // traguardo
    G.giro++;
    if (!G.auto) { G.tempo += 35; G.avviso = 3; }
    G.tempoGiro = 0;
  }
  G.sfondoX += segG.curva * perc * dt * 60;
  // sterzo che si vede: l'auto si inclina con un po' di ritardo
  G.lean += ((sterzo * Math.min(1, perc * 1.6)) - G.lean) * Math.min(1, dt * 8);
  G.sobbalzo = Math.max(0, G.sobbalzo - dt * 3);
  // fumo delle gomme fuori strada (o in frenata forte)
  const genera = (G.fuori && perc > 0.12) || (G.frena && perc > 0.55);
  if (genera) for (let i = 0; i < 2; i++) {
    const lato = rnd() < 0.5 ? -1 : 1;
    G.fumo.push({ x: LW / 2 + lato * 66 + (rnd() - 0.5) * 12, y: LH - 12, vx: -lato * 10 + (rnd() - 0.5) * 30 - G.lean * 40,
      vy: -18 - rnd() * 25, r: 4 + rnd() * 5, t: 0, vita: 0.7 + rnd() * 0.5, terra: G.fuori });
  }
  for (const f of G.fumo) { f.x += f.vx * dt; f.y += f.vy * dt; f.r += 22 * dt; f.t += dt; }
  G.fumo = G.fumo.filter(f => f.t < f.vita);
  if (!G.auto && G.fine <= 0) {
    G.tempo -= dt; G.tempoGiro += dt; G.punti += Math.round(G.vel * dt * 0.05) * 10;
    if (G.tempo <= 0) { G.tempo = 0; G.fine = 5; }
  } else if (!G.auto) { G.fine -= dt; if (G.fine <= 0) { G.auto = true; G.fine = 0; } }
  G.avviso = Math.max(0, G.avviso - dt);
}

// ─────────────────────────── Disegno ───────────────────────────
function testo(s, X, Y, col, dim = 8, allinea = 'left', ombra = '#2a0033') {
  x.font = `${dim}px Arcade`; x.textAlign = allinea; x.textBaseline = 'top';
  x.fillStyle = ombra; x.fillText(s, X + Math.max(1, dim / 8), Y + Math.max(1, dim / 8));
  x.fillStyle = col; x.fillText(s, X, Y);
}
function testoSfumato(s, X, Y, dim, allinea, c1, c2) {
  x.font = `${dim}px Arcade`; x.textAlign = allinea; x.textBaseline = 'top';
  x.fillStyle = '#2a0033'; x.fillText(s, X + 2, Y + 2);
  const g = x.createLinearGradient(0, Y, 0, Y + dim); g.addColorStop(0, c1); g.addColorStop(1, c2);
  x.fillStyle = g; x.fillText(s, X, Y);
}
function hud(t) {
  const kmh = Math.round(G.vel / VMAX * 293);
  // tempo in alto al centro
  testo('TEMPO', LW / 2, 30, '#ffd23f', 8, 'center');
  testoSfumato(String(Math.ceil(G.tempo)).padStart(2, '0'), LW / 2, 41, 24, 'center', '#fff27a', '#ff6a2a');
  testo('PUNTI', 14, 30, '#4ff0ff', 8, 'left');
  testo(String(G.punti).padStart(7, ' '), 14, 41, '#ffffff', 8, 'left');
  testo('GIRO', LW - 14, 30, '#ff4fd8', 8, 'right');
  const tg = G.tempoGiro, m = Math.floor(tg / 60), s = Math.floor(tg % 60), c = Math.floor(tg * 100 % 100);
  testo(`${m}'${String(s).padStart(2, '0')}"${String(c).padStart(2, '0')}`, LW - 14, 41, '#ffffff', 8, 'right');
  // velocità e contagiri a led
  testoSfumato(String(kmh).padStart(3, ' '), 14, LH - 40, 16, 'left', '#ffffff', '#4ff0ff');
  testo('km/h', 66, LH - 32, '#4ff0ff', 8, 'left');
  const tacche = 24, accese = Math.round(kmh / 293 * tacche);
  for (let i = 0; i < tacche; i++) {
    const col = i < 14 ? '#3dff9a' : i < 20 ? '#ffd23f' : '#ff3050';
    x.fillStyle = i < accese ? col : '#2a1038';
    x.fillRect(14 + i * 5, LH - 18 - Math.floor(i / 3), 4, 4 + Math.floor(i / 3));
  }
  testo(kmh > 150 ? 'ALTA' : 'BASSA', 140, LH - 24, kmh > 150 ? '#ff4fd8' : '#4ff0ff', 8, 'left');
  if (G.auto) {
    if (t % 1.2 < 0.8) testoSfumato('PREMI  PER GIOCARE', LW / 2, LH * 0.19, 16, 'center', '#ffffff', '#ff4fd8');
    if (t % 1.2 < 0.8) { // freccia in su disegnata a mano: il carattere non ce l'ha
      const ax = Math.round(LW / 2 - 45), ay = Math.round(LH * 0.19);
      x.fillStyle = '#4ff0ff';
      for (let i = 0; i < 7; i++) x.fillRect(ax - i, ay + 2 + i, 1 + i * 2, 1);
      x.fillRect(ax - 2, ay + 9, 5, 6);
    }
  }
  if (G.avviso > 0 && t % 0.5 < 0.35) testoSfumato('TEMPO EXTRA!', LW / 2, LH * 0.28, 16, 'center', '#fff27a', '#ff6a2a');
  if (G.fine > 0) testoSfumato('FINE CORSA', LW / 2, LH * 0.28, 24, 'center', '#ffffff', '#ff2d95');
}

function disegna(t) {
  x.imageSmoothingEnabled = false;
  disegnaCielo(x, LW, LH, G.sfondoX, t);
  const sob = G.vel > VMAX * 0.3 ? Math.round(Math.sin(t * 37) * 0.6 * (G.vel / VMAX)) : 0;
  const vis = disegnaStrada(x, LW, LH, G.pos, G.x, sob * 4 + G.sobbalzo * 60);
  // sprite dal più lontano al più vicino, con le auto del traffico mescolate
  const L = segmenti.length * SEG;
  const autoPerSeg = new Map();
  for (const c of G.traffico) { const sg = trova(c.z); if (!autoPerSeg.has(sg)) autoPerSeg.set(sg, []); autoPerSeg.get(sg).push(c); }
  for (let k = vis.length - 1; k >= 0; k--) {
    const seg = vis[k], neb = Math.pow(seg.n / VISTA, 1.6);
    for (const sp of seg.sprite) disegnaSprite(x, LW, LH, immagine(sp.nome), seg, sp.off, 14, neb);
    for (const c of autoPerSeg.get(seg) || []) disegnaSprite(x, LW, LH, S.auto[c.img], seg, c.off, 9, neb);
  }
  // fumo e polvere
  for (const f of G.fumo) {
    const a = 1 - f.t / f.vita;
    x.globalAlpha = a * 0.55; x.fillStyle = f.terra ? '#c9a0c8' : '#e8e0f0';
    const R = Math.round(f.r);
    x.fillRect(Math.round(f.x - R), Math.round(f.y - R * 0.6), R * 2, Math.round(R * 1.2));
    x.fillRect(Math.round(f.x - R * 0.6), Math.round(f.y - R), Math.round(R * 1.2), R * 2);
  }
  x.globalAlpha = 1;
  // l'auto del giocatore
  const base = LH - 6 + (G.fuori ? Math.round(Math.sin(t * 50) * 1.5) : sob) - Math.round(G.sobbalzo * 3);
  disegnaAuto(x, Math.round(LW / 2), base, G.lean, G.frena, t);
  hud(t);

  // ingrandimento a pixel pieni
  sx.imageSmoothingEnabled = false;
  sx.globalCompositeOperation = 'source-over';
  sx.drawImage(bassa, 0, 0, SW, SH);
  // bagliore: solo le parti accese passano la soglia, poi sfocate e sommate
  bx.globalCompositeOperation = 'copy';
  bx.filter = 'brightness(1.1) contrast(3.2) saturate(1.4) blur(2px)';
  bx.drawImage(bassa, 0, 0, bagliore.width, bagliore.height);
  bx.filter = 'none';
  sx.imageSmoothingEnabled = true;
  sx.globalCompositeOperation = 'lighter';
  sx.globalAlpha = 0.5;
  sx.drawImage(bagliore, 0, 0, SW, SH);
  sx.globalAlpha = 1;
  sx.globalCompositeOperation = 'source-over';
  // scanline: una riga scura per ogni riga della tela piccola
  const passo = SH / LH;
  if (passo >= 2) {
    sx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let r = 0; r < LH; r++) sx.fillRect(0, Math.floor(r * passo + passo * 0.62), SW, Math.max(1, Math.round(passo * 0.34)));
  }
  // vignettatura
  const v = sx.createRadialGradient(SW / 2, SH / 2, SH * 0.45, SW / 2, SH / 2, SH * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,0,20,0.55)');
  sx.fillStyle = v; sx.fillRect(0, 0, SW, SH);
}

// ─────────────────────────── Avvio ───────────────────────────
async function avvia() {
  Demo.carica('Accendo i neon');
  try { const ff = new FontFace('Arcade', 'url(assets/PressStart2P-Regular.ttf)'); await ff.load(); document.fonts.add(ff); }
  catch (e) { console.warn('font', e); }
  ridimensiona();
  addEventListener('resize', ridimensiona);
  S = creaSprite();
  costruisciPista();
  creaTraffico();
  const avvioZ = Number(Demo.query.get('z')) || 0;
  G.pos = avvioZ * SEG;
  Demo.loop((dt, t) => {
    if (dt > 0) aggiorna(Math.min(dt, 1 / 30), t);
    disegna(t);
  });
  Demo.pronto();
}
avvia().catch(e => Demo.errore(e));
