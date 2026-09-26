// Disegno della finestra in "coordinate di cartone" (texel della texture, y verso il basso).
// Due tele: REGIONI (ogni pezzo di colore ha un id, codificato nel canale rosso) e PITTURA
// (la grisaglia: il marrone scuro che i vetrai dipingevano su volti, pieghe e scritte).
import { disegnaSanto, disegnaBaldacchino } from './vetrata-santo.js?v=7';

export const TW = 624, TH = 1024;            // cartone = 7,3 m × 12 m
export const LANC = { yS: 560, yB: 1012, sx: [18, 306], dx: [318, 606], d: 10 };
export const OCULO = { x: 312, y: 190, r: 122, rv: 110 };

// colori del vetro come trasmittanza lineare
export const C = {
  rubino: [0.78, 0.05, 0.07], blu: [0.07, 0.17, 0.66], bluchiaro: [0.2, 0.42, 0.8], verde: [0.1, 0.52, 0.2],
  oro: [0.97, 0.7, 0.1], giallo: [0.98, 0.86, 0.3], bianco: [0.86, 0.87, 0.8], carne: [0.9, 0.7, 0.62],
  porpora: [0.46, 0.1, 0.36], bruno: [0.5, 0.28, 0.1], grigio: [0.62, 0.64, 0.6], smeraldo: [0.05, 0.4, 0.3],
};

/** Arco a sesto acuto equilatero fra x0 e x1, imposta yS, base yB, rientrato di d. */
export function arco(g, x0, x1, yS, yB, d) {
  const r = x1 - x0, h = r / 2, R = r - d, dy = Math.sqrt(R * R - h * h);
  g.moveTo(x0 + d, yB - d); g.lineTo(x0 + d, yS);
  g.arc(x1, yS, R, Math.PI, Math.atan2(-dy, -h) + 2 * Math.PI, false);
  g.arc(x0, yS, R, Math.atan2(-dy, h) + 2 * Math.PI, 2 * Math.PI, false);
  g.lineTo(x1 - d, yB - d); g.closePath();
}

export function creaCartone() {
  const reg = [{ nome: 'pietra', tipo: 'pietra' }];
  const R = (nome, col, cella = 30, aniso = 1) => { reg.push({ nome, tipo: 'vetro', col, cella, aniso }); return reg.length - 1; };
  const mk = () => { const c = document.createElement('canvas'); c.width = TW; c.height = TH; return c; };
  const cR = mk(), cP = mk(), cD = mk();
  const g = cR.getContext('2d'), p = cP.getContext('2d'), pd = cD.getContext('2d');
  pd.strokeStyle = 'rgba(38,22,12,1)';
  const id = (n) => `rgb(${n * 4},0,0)`;
  const riempi = (n, f) => { g.fillStyle = id(n); g.beginPath(); f(g); g.fill(); };
  p.strokeStyle = p.fillStyle = 'rgba(38,22,12,1)'; p.lineCap = 'round'; p.lineJoin = 'round';

  // tutto pietra, poi il vetro dentro l'arco maggiore (i pennacchi)
  g.fillStyle = id(0); g.fillRect(0, 0, TW, TH);
  const pennacchi = R('pennacchi', C.blu, 26);
  riempi(pennacchi, q => arco(q, 0, TW, 539, TH, 12));
  // sotto l'imposta delle lancette è tutto pietra (montante centrale compreso)
  g.fillStyle = id(0); g.fillRect(0, LANC.yS - 4, TW, TH);

  // oculo: anello di pietra, rosa di vetro
  const O = OCULO;
  riempi(0, q => q.arc(O.x, O.y, O.r, 0, 7));
  rosa(g, p, R, id, O);
  // due tondi stellati nei pennacchi
  for (const [x, y] of [[130, 262], [494, 262]]) {
    riempi(0, q => q.arc(x, y, 31, 0, 7));
    const fondo = R('tondo', C.rubino, 20), stella = R('stella', C.oro, 40);
    riempi(fondo, q => q.arc(x, y, 23, 0, 7));
    riempi(stella, q => stellaPath(q, x, y, 17, 7, 6));
  }

  // lancette: fascia di pietra, bordo a perle, campo, baldacchino, santo, scritta
  const lancette = [
    { x: LANC.sx, dir: 1, fondo: C.rubino, santo: 'pietro' },
    { x: LANC.dx, dir: -1, fondo: C.blu, santo: 'paolo' },
  ];
  for (const L of lancette) {
    const [x0, x1] = L.x, cx = (x0 + x1) / 2;
    riempi(0, q => arco(q, x0, x1, LANC.yS, LANC.yB, 0));
    const bordo = R('bordo', L.fondo === C.blu ? C.rubino : C.blu, 18);
    riempi(bordo, q => arco(q, x0, x1, LANC.yS, LANC.yB, LANC.d));
    perle(g, R, id, x0, x1);
    const campo = R('campo', L.fondo, 27);
    riempi(campo, q => arco(q, x0, x1, LANC.yS, LANC.yB, LANC.d + 15));
    // diaspro dipinto sul fondo: reticolo a losanghe con crocette
    pd.save(); pd.beginPath(); arco(pd, x0, x1, LANC.yS, LANC.yB, LANC.d + 15); pd.clip();
    pd.globalAlpha = 0.3; pd.lineWidth = 0.9;
    for (let k = -30; k < 40; k++) {
      pd.beginPath(); pd.moveTo(x0 + k * 22, 300); pd.lineTo(x0 + k * 22 + 700, 1000); pd.stroke();
      pd.beginPath(); pd.moveTo(x0 + k * 22, 300); pd.lineTo(x0 + k * 22 - 700, 1000); pd.stroke();
    }
    pd.restore();
    disegnaBaldacchino(g, p, R, id, cx, L);
    disegnaSanto(g, p, R, id, cx, L);
  }
  return { reg, cR, cP, cD };
}

/** Perle bianche lungo la fascia di bordo di una lancetta. */
function perle(g, R, id, x0, x1) {
  const d = LANC.d + 7.5, r = x1 - x0, h = r / 2, Rr = r - d, yS = LANC.yS, yB = LANC.yB;
  const punti = [];
  for (let y = yB - d - 8; y > yS; y -= 17) { punti.push([x0 + d, y]); punti.push([x1 - d, y]); }
  const a0 = Math.PI, a1 = Math.atan2(-Math.sqrt(Rr * Rr - h * h), -h) + 2 * Math.PI;
  const n = Math.round((a1 - a0) * Rr / 17);
  for (let i = 1; i < n; i++) {
    const a = a0 + (a1 - a0) * i / n;
    punti.push([x1 + Math.cos(a) * Rr, yS + Math.sin(a) * Rr]);
    punti.push([x0 + Math.cos(3 * Math.PI - a) * Rr, yS + Math.sin(3 * Math.PI - a) * Rr]);
  }
  for (let i = 1; i < 16; i++) punti.push([x0 + d + (r - 2 * d) * i / 16, yB - d]);
  const perla = R('perla', C.bianco, 12);
  g.fillStyle = id(perla);
  for (const [x, y] of punti) { g.beginPath(); g.arc(x, y, 4.2, 0, 7); g.fill(); }
}

export function stellaPath(q, x, y, r1, r2, n, rot = -Math.PI / 2) {
  for (let i = 0; i < n * 2; i++) {
    const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1;
    if (i) q.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else q.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  q.closePath();
}

/** Rosone: stella d'oro al centro, otto petali, corona di perle. */
function rosa(g, p, R, id, O) {
  const { x, y, rv } = O;
  const fondo = R('rosa-fondo', C.blu, 22);
  g.fillStyle = id(fondo); g.beginPath(); g.arc(x, y, rv, 0, 7); g.fill();
  const corona = R('rosa-corona', C.rubino, 16);
  g.fillStyle = id(corona); g.beginPath(); g.arc(x, y, rv, 0, 7); g.arc(x, y, rv - 14, 0, 7, true); g.fill();
  const perla = R('perla', C.bianco, 12);
  g.fillStyle = id(perla);
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * (rv - 7), y + Math.sin(a) * (rv - 7), 3.6, 0, 7); g.fill(); }
  const pet = [R('petalo', C.rubino, 22), R('petalo', C.verde, 22)];
  const cuore = R('petalo-cuore', C.giallo, 14);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8, px = x + Math.cos(a) * 64, py = y + Math.sin(a) * 64;
    g.fillStyle = id(pet[i % 2]); g.beginPath(); g.ellipse(px, py, 30, 20, a, 0, 7); g.fill();
    g.fillStyle = id(cuore); g.beginPath(); g.arc(x + Math.cos(a) * 72, y + Math.sin(a) * 72, 7, 0, 7); g.fill();
    p.lineWidth = 1.4; p.globalAlpha = 0.7;
    p.beginPath(); p.ellipse(px, py, 22, 13, a, 0, 7); p.stroke();
    p.globalAlpha = 1;
  }
  const disco = R('rosa-disco', C.rubino, 30);
  g.fillStyle = id(disco); g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill();
  const stella = R('rosa-stella', C.oro, 60);
  g.fillStyle = id(stella); g.beginPath(); stellaPath(g, x, y, 30, 13, 8); g.fill();
  p.lineWidth = 1.2; p.beginPath(); stellaPath(p, x, y, 24, 10, 8); p.stroke();
  p.beginPath(); p.arc(x, y, 6, 0, 7); p.fill();
}
