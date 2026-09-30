// Tratto tremolante: un sogno quasi tutto bianco disegnato a matita e pastelli.
// Ogni disegno è prerenderizzato in tre varianti con il tratto spostato di poco; si alternano
// tre volte e mezza al secondo (line boil). Niente immagini: tutto nasce dal codice.
import { OGGETTI, OCCHI, SPR, prerendiTutto, TP } from './mondo.js?v=8';
import { filo, occhi, zeta, preparaRiquadro, BOX, testo, linea } from './vivi.js?v=8';
import { grana, ellisse, rng } from './matita.js?v=8';

const cv = document.createElement('canvas');
cv.className = 'sogno'; document.body.prepend(cv);
const g = cv.getContext('2d');
let Z = 0, W = 1280, H = 720, RIQ = null, pronto = false;
function ridimensiona() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  const nz = Math.min(2.2, cv.height / 600);
  if (Math.abs(nz - Z) > 0.005) { Z = nz; prerendiTutto(Z); RIQ = preparaRiquadro(Z); }
  W = cv.width / Z; H = cv.height / Z;
}
addEventListener('resize', () => { if (pronto) ridimensiona(); });

const P = { x: 1215, y: 890, dir: 0, lato: 1, fase: 0, muove: false };
const cam = { x: 0, y: 0 };
const ZETA = []; let zTimer = 0, zChi = 0;
let dialogo = null, fotogramma = 0;
const pilota = Demo.shot && !Demo.query.has('tieni');
const buioO = OGGETTI[0];

function libero(x, y) {
  if (x < 260 || x > 2450 || y < 380 || y > 1680) return false;
  for (const o of OGGETTI) for (const u of o.urti) if (Math.hypot(x - o.x - u.dx, (y - o.y - u.dy) * 1.4) < u.r + 16) return false;
  return true;
}
function vicino() {
  let best = null, bd = 1e9;
  for (const o of OGGETTI) {
    if (!o.frase) continue;
    const d = Math.hypot(P.x - o.x - o.parla[0], P.y - o.y - o.parla[1]) - (o.id === 'buio' ? 50 : 0);
    if (d < 125 && d < bd) { bd = d; best = o; }
  }
  return best;
}
function aCapo(t) {
  g.font = '30px Matita'; const righe = []; let r = '';
  for (const p of t.split(' ')) { const n = (r + ' ' + p).trim(); if (g.measureText(n).width > 610) { righe.push(r); r = p; } else r = n; }
  return [...righe, r];
}

function aggiorna(dt) {
  let dx = 0, dy = 0, azione = false;
  if (pilota) { const f = fotogramma; dx = f < 24 ? -0.5 : 0; dy = f < 24 ? 0.7 : 0; azione = Demo.query.has('parla') && f === 50; }
  else { const a = Demo.asse(); dx = a.x; dy = -a.y; azione = Demo.premuto(' '); }
  if (dialogo) {
    dialogo.car += dt * 32;
    if (azione) { if (dialogo.car < dialogo.tot) dialogo.car = dialogo.tot; else dialogo = null; }
    dx = dy = 0;
  } else if (azione) { const o = vicino(); if (o) { const righe = aCapo(o.frase); dialogo = { righe, car: 0, tot: righe.join('').length }; } }
  const l = Math.hypot(dx, dy);
  P.muove = l > 0.2;
  if (P.muove) {
    dx /= Math.max(1, l); dy /= Math.max(1, l);
    if (Math.abs(dx) > Math.abs(dy)) { P.dir = 2; P.lato = Math.sign(dx); } else P.dir = dy > 0 ? 0 : 1;
    const v = 190 * dt;
    if (libero(P.x + dx * v, P.y)) P.x += dx * v;
    if (libero(P.x, P.y + dy * v)) P.y += dy * v;
    P.fase += dt * 7;
  } else P.fase = 0;
  cam.x += (P.x - W / 2 - cam.x) * Math.min(1, dt * 3.5);
  cam.y += (P.y - 60 - H / 2 - cam.y) * Math.min(1, dt * 3.5);
  // zeta di chi dorme
  if ((zTimer -= dt) < 0) { zTimer = 1.1; zChi ^= 1; const am = OGGETTI[3]; ZETA.push({ x: am.x + (zChi ? -112 : 62), y: am.y + (zChi ? -62 : -22), t: 0, f: zChi * 2, k: ZETA.length % 3 === 0 }); }
  for (let i = ZETA.length - 1; i >= 0; i--) if ((ZETA[i].t += dt) > 3) ZETA.splice(i, 1);
}

function spr(o, v) {
  const c = SPR.ogg[o.id][v], [x0, y0, x1, y1] = o.box;
  g.drawImage(c, o.x + x0, o.y + y0, x1 - x0, y1 - y0);
}

function disegna(t) {
  const v = Math.floor(t * 3.5) % 3;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#fcfbf7'; g.fillRect(0, 0, cv.width, cv.height);
  g.setTransform(Z, 0, 0, Z, -cam.x * Z, -cam.y * Z);
  for (let tx = Math.floor(cam.x / TP) * TP; tx < cam.x + W; tx += TP)
    for (let ty = Math.floor(cam.y / TP) * TP; ty < cam.y + H; ty += TP) g.drawImage(SPR.pav[v], tx, ty, TP, TP);
  for (const o of OGGETTI) if (o.fondo) spr(o, v);
  for (const [ex, ey, f] of OCCHI) occhi(g, buioO.x + ex, buioO.y + ey, f, v, t, P.x, P.y - 60);
  const lista = OGGETTI.filter(o => !o.fondo).map(o => ({ y: o.y, f: () => {
    if (!o.appesa) return spr(o, v);
    const th = 0.03 * Math.sin(t * 0.9), px = o.x + Math.sin(th) * 1500, py = o.y - o.appesa;
    filo(g, o.x, py - 1500, px, py, v);
    g.save(); g.translate(px, py); g.rotate(-th);
    const c = SPR.ogg[o.id][v], [x0, y0, x1, y1] = o.box; g.drawImage(c, x0, y0, x1 - x0, y1 - y0); g.restore();
  } }));
  lista.push({ y: P.y, f: () => {
    const c = SPR.eroe[P.dir][P.muove ? [1, 0, 2, 0][Math.floor(P.fase) % 4] : 0][v];
    g.save(); g.translate(P.x, P.y); if (P.dir === 2 && P.lato < 0) g.scale(-1, 1);
    g.drawImage(c, -42, -112, 84, 126); g.restore();
  } });
  lista.sort((a, b) => a.y - b.y).forEach(o => o.f());
  zeta(g, ZETA, t);
  const qui = !dialogo && vicino();
  if (qui) {                                      // nuvoletta con il punto esclamativo
    const bx = P.x + 34, by = P.y - 132 + Math.sin(t * 3) * 2;
    g.fillStyle = '#fdfcf8'; g.beginPath(); g.ellipse(bx, by, 17, 15, 0, 0, 6.3); g.fill();
    linea(g, ellisse(rng(3 + v), bx, by, 17, 15, 0.5), v, { w: 1.8, jit: 0.8 });
    linea(g, [[bx - 12, by + 13], [bx - 18, by + 22], [bx - 5, by + 15]], v, { w: 1.6, jit: 0.6 });
    g.fillStyle = '#231f22'; g.font = '26px Matita'; g.textAlign = 'center'; g.fillText('!', bx, by + 9); g.textAlign = 'left';
  }
  // schermo: grana del foglio, bordi che si incupiscono vicino al buio, testo
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 0.05; g.fillStyle = g.createPattern(grana(), 'repeat'); g.fillRect(0, 0, cv.width, cv.height); g.globalAlpha = 1;
  const k = Math.max(0, 1 - Math.hypot(P.x - buioO.x, P.y - buioO.y) / 900);
  const vg = g.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.35, cv.width / 2, cv.height / 2, cv.width * 0.72);
  vg.addColorStop(0, 'rgba(60,54,62,0)'); vg.addColorStop(1, `rgba(60,54,62,${0.1 + k * 0.35})`);
  g.fillStyle = vg; g.fillRect(0, 0, cv.width, cv.height);
  if (dialogo) {
    g.setTransform(Z, 0, 0, Z, 0, 0);
    const x = (W - BOX[2]) / 2, y = H - BOX[3] - 36;
    g.drawImage(RIQ[v], x, y, BOX[2], BOX[3]);
    testo(g, dialogo.righe, dialogo.car, v, x + 42, y + 60);
    if (dialogo.car >= dialogo.tot && Math.floor(t * 2.5) % 2) linea(g, [[x + BOX[2] - 52, y + 104], [x + BOX[2] - 42, y + 114], [x + BOX[2] - 32, y + 104]], v, { w: 2.4 });
  }
}

async function avvia() {
  Demo.carica('Tempero le matite');
  await document.fonts.load('30px Matita');
  ridimensiona(); pronto = true;
  cam.x = P.x - W / 2; cam.y = P.y - 60 - H / 2;
  Demo.loop((dt, t) => { if (dt > 0) { aggiorna(dt); fotogramma++; } disegna(t); });
  Demo.pronto();
}
avvia().catch(e => Demo.errore(e));
