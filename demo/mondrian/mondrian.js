// De Stijl — un breakout dentro un quadro di Mondrian.
// Il gioco vive in "unità di tela" (1000 × 1080); il disegno scala tutto sulla finestra.
import { mulberry, creaPennellate, creaTela } from './mondrian-trama.js?v=8';
import { PW, PH, COL, quadroClassico } from './mondrian-quadro.js?v=8';
import { quadroBoogie } from './mondrian-boogie.js?v=8';
import { creaSala, didascalia } from './mondrian-sala.js?v=8';

const cv = document.createElement('canvas');
cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;cursor:none';
document.body.prepend(cv);
const g = cv.getContext('2d');
const RND = mulberry(12345);

// ── Misure (ricalcolate a ogni resize) ──
let W, H, dpr, s, X0, Y0, pw, ph, sala, tela, conDida;
const piastrelle = creaPennellate();
let pattern = piastrelle.map(p => g.createPattern(p, 'repeat'));
function misure() {
  W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const hMax = H * 0.84, wMax = W * 0.66;
  s = Math.min(hMax / PH, wMax / PW);
  pw = PW * s; ph = PH * s;
  conDida = W - pw > 460;
  X0 = Math.round((W - pw) / 2 - (conDida ? Math.min(90, W * 0.06) : 0));
  Y0 = Math.round(H * 0.085 + (H * 0.86 - ph) / 2);
  sala = creaSala(W, H, dpr, X0, Y0, pw, ph);
  tela = creaTela(pw * dpr, ph * dpr, 7);
  pattern = piastrelle.map(p => g.createPattern(p, 'repeat'));
}
misure();
addEventListener('resize', misure);

// ── Stato ──
const Q0 = Demo.query;
const semeBase = parseInt(Q0.get('seme') || '4', 10);
let n = Q0.get('quadro') === 'boogie' ? 13 : 12;
let quadro, P = 1, fase = 'gioco', tFase = 0, perse = 0;
const pad = { x: PW / 2, w: 176, h: 26, y: PH - 78, vx: 0 };
const R = 11;                                   // mezzo lato della pallina
const palla = { x: PW / 2, y: 0, vx: 0, vy: 0, att: true, v: 640, tAtt: 0 };
let cadute = [], schegge = [];
let auto = true, mira = 0, mouseX = null;

function nuovoQuadro(subito) {
  n++;
  const seme = semeBase * 7919 + n * 977;
  quadro = n % 2 === 0 ? quadroBoogie(seme) : quadroClassico(seme);
  P = subito ? 1 : 0; fase = subito ? 'gioco' : 'pittura'; tFase = 0;
  palla.att = true; palla.v = 640; palla.tAtt = 0;
}
nuovoQuadro(false);

// ── Ingressi ──
cv.addEventListener('mousemove', e => { mouseX = e.clientX; auto = false; });
cv.addEventListener('mousedown', () => { auto = false; lancia(); });
function lancia() {
  if (!palla.att || fase === 'pittura') return;
  palla.att = false;
  const a = (RND() - 0.5) * 0.7;
  palla.vx = Math.sin(a) * palla.v; palla.vy = -Math.cos(a) * palla.v;
}

// ── Fisica della pallina ──
const sovrap = (m) => palla.x + R > m.x && palla.x - R < m.x + m.w && palla.y + R > m.y && palla.y - R < m.y + m.h;
function colpito(m) {
  const pz = quadro.colpisci(m.rif);
  cadute.push({ ...pz, vx: palla.vx * 0.12 + (RND() - 0.5) * 60, vy: -160 - RND() * 80, rot: 0, vr: (RND() - 0.5) * 1.6, t: 0 });
  const cols = [pz.col, pz.col, COL.nero, COL.bianchi[0]];
  for (let i = 0; i < 16; i++) {
    const a = RND() * Math.PI * 2, v = 120 + RND() * 380;
    schegge.push({ x: palla.x, y: palla.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, l: 4 + RND() * 7,
      col: cols[RND() * 4 | 0], t: 0, vita: 0.5 + RND() * 0.5, rot: RND() * 3 });
  }
  palla.v = Math.min(palla.v + 7, 880);
}
function urto(asseX, mattoni) {
  if (asseX) {
    if (palla.x - R < 0) { palla.x = R; palla.vx = Math.abs(palla.vx); }
    if (palla.x + R > PW) { palla.x = PW - R; palla.vx = -Math.abs(palla.vx); }
  } else if (palla.y - R < 0) { palla.y = R; palla.vy = Math.abs(palla.vy); }
  const respingi = (m) => {
    if (asseX) {
      if (palla.vx > 0) { palla.x = m.x - R - 0.01; palla.vx = -Math.abs(palla.vx); }
      else { palla.x = m.x + m.w + R + 0.01; palla.vx = Math.abs(palla.vx); }
    } else {
      if (palla.vy > 0) { palla.y = m.y - R - 0.01; palla.vy = -Math.abs(palla.vy); }
      else { palla.y = m.y + m.h + R + 0.01; palla.vy = Math.abs(palla.vy); }
    }
  };
  for (const m of mattoni) if (sovrap(m)) { respingi(m); colpito(m); return true; }
  for (const st of quadro.statici) { const m = { x: st[0], y: st[1], w: st[2], h: st[3] }; if (sovrap(m)) { respingi(m); return false; } }
  // racchetta
  if (!asseX && palla.vy > 0) {
    const m = { x: pad.x - pad.w / 2, y: pad.y, w: pad.w, h: pad.h };
    if (sovrap(m) && palla.y < pad.y + 8) {
      palla.y = pad.y - R - 0.01;
      const o = Math.max(-1, Math.min(1, (palla.x - pad.x) / (pad.w / 2 + R)));
      const a = o * 1.05;
      palla.vx = Math.sin(a) * palla.v; palla.vy = -Math.cos(a) * palla.v;
      mira = (RND() - 0.5) * 1.4;
    }
  }
  return false;
}
function muoviPalla(dt) {
  const v = Math.hypot(palla.vx, palla.vy) || 1;
  // velocità costante, e mai quasi orizzontale
  palla.vx *= palla.v / v; palla.vy *= palla.v / v;
  if (Math.abs(palla.vy) < palla.v * 0.28) {
    palla.vy = Math.sign(palla.vy || 1) * palla.v * 0.28;
    palla.vx = Math.sign(palla.vx) * Math.sqrt(palla.v * palla.v - palla.vy * palla.vy);
  }
  const passi = Math.ceil(palla.v * dt / 5), h = dt / passi;
  let mattoni = quadro.mattoni();
  for (let i = 0; i < passi; i++) {
    palla.x += palla.vx * h; if (urto(true, mattoni)) mattoni = quadro.mattoni();
    palla.y += palla.vy * h; if (urto(false, mattoni)) mattoni = quadro.mattoni();
  }
  if (palla.y > PH + 40) { perse++; palla.att = true; palla.tAtt = 0; palla.v = Math.max(640, palla.v - 60); }
}

// ── Pilota automatico (finché nessuno tocca niente, e nelle foto) ──
function pilota(dt) {
  let tx = palla.x;
  if (!palla.att && palla.vy > 0) {
    let x = palla.x + palla.vx * (pad.y - R - palla.y) / palla.vy;
    const L = PW - 2 * R; x -= R;
    x = ((x % (2 * L)) + 2 * L) % (2 * L); if (x > L) x = 2 * L - x;
    tx = x + R - mira * pad.w * 0.35;
  } else if (!palla.att) tx = palla.x;
  const dx = tx - pad.x, vmax = 1500;
  pad.x += Math.max(-vmax * dt, Math.min(vmax * dt, dx * Math.min(1, dt * 10)));
}

// ── Aggiornamento ──
function aggiorna(dt) {
  if (Demo.premuto('n')) nuovoQuadro(false);
  quadro.aggiorna(dt);
  tFase += dt;
  if (fase === 'pittura') { P = Math.min(1, P + dt / 2.6); if (P >= 1) { fase = 'gioco'; tFase = 0; } }
  // racchetta
  const ax = Demo.asse().x;
  if (ax) { auto = false; mouseX = null; }
  if (Demo.premuto(' ')) { auto = false; lancia(); }
  if (auto) pilota(dt);
  else if (ax) pad.x += ax * 1100 * dt;
  else if (mouseX != null) pad.x += ((mouseX - X0) / s - pad.x) * Math.min(1, dt * 30);
  const x0 = quadro.campo.x0 + pad.w / 2, x1 = quadro.campo.x1 - pad.w / 2;
  pad.x = Math.max(x0, Math.min(x1, pad.x));
  // pallina
  if (palla.att) {
    palla.x = pad.x + pad.w * 0.18; palla.y = pad.y - R - 1; palla.tAtt += dt;
    if (auto && fase === 'gioco' && palla.tAtt > 0.9) lancia();
  } else if (dt > 0) muoviPalla(dt);
  if (fase === 'gioco' && quadro.finito) { fase = 'fine'; tFase = 0; }
  if (fase === 'fine' && tFase > 2.2) nuovoQuadro(false);
  // pezzi che cadono, schegge
  for (const c of cadute) { c.t += dt; c.vy += 1700 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; }
  cadute = cadute.filter(c => c.y < PH + 900);
  for (const q of schegge) { q.t += dt; q.vy += 1400 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += dt * 6; }
  schegge = schegge.filter(q => q.t < q.vita);
}

// ── Disegno ──
function pennello(x, y, w, h, i, ox, oy) {
  if (w <= 0 || h <= 0) return;
  const p = pattern[i % pattern.length];
  p.setTransform(new DOMMatrix([1 / (s * dpr), 0, 0, 1 / (s * dpr), ox, oy]));
  const op = g.globalCompositeOperation;
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = p; g.fillRect(x, y, w, h);
  g.globalCompositeOperation = op;
}
function blocco(x, y, w, h, col, bordo, riempi2) {
  g.fillStyle = COL.nero; g.fillRect(x, y, w, h);
  g.fillStyle = col; g.fillRect(x + bordo, y + bordo, w - 2 * bordo, h - 2 * bordo);
  if (riempi2) riempi2();
}
function disegnaPezzo(c) {
  const sc = 1 + Math.min(1, c.t * 1.5) * 0.07;
  g.save();
  g.translate(c.x + c.w / 2, c.y + c.h / 2); g.rotate(c.rot); g.scale(sc, sc);
  const alto = Math.min(1, c.t * 2);
  g.shadowColor = 'rgba(30,25,15,0.35)'; g.shadowBlur = (6 + alto * 22) * s * dpr;
  g.shadowOffsetX = (3 + alto * 12) * s * dpr; g.shadowOffsetY = (5 + alto * 22) * s * dpr;
  g.translate(-c.w / 2, -c.h / 2);
  if (c.nobordo) { g.fillStyle = c.col; g.fillRect(0, 0, c.w, c.h); }
  else { g.fillStyle = COL.nero; g.fillRect(0, 0, c.w, c.h); }
  g.shadowColor = 'transparent';
  if (!c.nobordo) { g.fillStyle = c.col; g.fillRect(c.ix, c.iy, c.iw, c.ih); }
  pennello(c.ix, c.iy, c.iw, c.ih, c.pat, c.ox - c.x, c.oy - c.y);
  if (c.dentro) { g.fillStyle = c.dentro.col; g.fillRect(c.dentro.x, c.dentro.y, c.dentro.w, c.dentro.h); }
  g.restore();
}
function disegna() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(sala, 0, 0);
  g.setTransform(dpr * s, 0, 0, dpr * s, X0 * dpr, Y0 * dpr);
  g.save();
  g.beginPath(); g.rect(0, 0, PW, PH); g.clip();
  quadro.disegna(g, P, pennello);
  // trama della tela e luce di sala sopra tutto il dipinto
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.drawImage(tela, X0 * dpr, Y0 * dpr, pw * dpr, ph * dpr);
  g.restore();
  // racchetta e pallina: blocchi pieni con bordo nero, appoggiati sulla tela
  const vis = fase !== 'pittura' || P > 0.85;
  if (vis) {
    g.globalAlpha = fase === 'pittura' ? (P - 0.85) / 0.15 : 1;
    g.save();
    g.shadowColor = 'rgba(30,25,15,0.35)'; g.shadowBlur = 7 * s * dpr; g.shadowOffsetX = 4 * s * dpr; g.shadowOffsetY = 7 * s * dpr;
    const px = pad.x - pad.w / 2;
    g.fillStyle = COL.nero; g.fillRect(px, pad.y, pad.w, pad.h);
    g.fillRect(palla.x - R, palla.y - R, 2 * R, 2 * R);
    g.restore();
    const b = 6, sp = px + pad.w * 0.7;
    g.fillStyle = COL.rosso; g.fillRect(px + b, pad.y + b, sp - px - b - 3, pad.h - 2 * b);
    g.fillStyle = COL.bianchi[0]; g.fillRect(sp + 3, pad.y + b, px + pad.w - b - sp - 3, pad.h - 2 * b);
    pennello(px + b, pad.y + b, pad.w - 2 * b, pad.h - 2 * b, 0, 11, 5);
    g.fillStyle = COL.blu; g.fillRect(palla.x - R + 5, palla.y - R + 5, 2 * R - 10, 2 * R - 10);
    g.globalAlpha = 1;
  }
  g.restore();
  // fuori dal quadro: pezzi che si staccano e cadono davanti alla cornice
  for (const c of cadute) disegnaPezzo(c);
  for (const q of schegge) {
    g.save(); g.globalAlpha = Math.max(0, 1 - q.t / q.vita);
    g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = q.col; g.fillRect(-q.l / 2, -q.l / 2, q.l, q.l); g.restore();
  }
  // didascalia
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (conDida) {
    const dx = X0 + pw + Math.max(36, W * 0.03);
    didascalia(g, dx, Y0 + ph - 150, 212, quadro, n, perse);
  }
  if (fase === 'fine') {
    const a = Math.min(1, tFase * 2) * Math.max(0, Math.min(1, (2.2 - tFase) * 2));
    g.globalAlpha = a;
    g.font = 'italic 600 22px Georgia, serif'; g.textAlign = 'center';
    g.fillStyle = '#1a1814'; g.fillText('Quadro finito', X0 + pw / 2, Y0 + ph * 0.3);
    g.textAlign = 'left'; g.globalAlpha = 1;
  }
}

Demo.extra('<p><b>N</b> dipinge subito un quadro nuovo. I quadri si alternano: una Composizione classica, poi una variante <i>Broadway Boogie Woogie</i>.</p>');

// Nelle foto la partita è già avviata da qualche secondo, col pilota automatico.
if (Demo.shot) {
  const pre = parseFloat(Q0.get('pre') || '3.3');
  for (let i = 0; i < pre * 60; i++) aggiorna(1 / 60);
}
// Collaudo: ?mosaico=1 mostra otto composizioni affiancate (semi consecutivi).
function mosaico() {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#888'; g.fillRect(0, 0, cv.width, cv.height);
  const k = Math.min(cv.width / 4 / PW, cv.height / 2 / PH) * 0.94;
  for (let i = 0; i < 8; i++) {
    const q = (Q0.get('mosaico') === 'boogie' ? quadroBoogie : quadroClassico)(semeBase * 7919 + i * 977 * 2 + 977);
    g.setTransform(k, 0, 0, k, (i % 4) * cv.width / 4 + 8, (i / 4 | 0) * cv.height / 2 + 8);
    q.disegna(g, 1, () => {});
  }
}
Demo.loop((dt) => { if (Q0.get('mosaico')) return mosaico(); aggiorna(dt); disegna(); });
Demo.pronto();
