// Variante "Broadway Boogie Woogie": griglia di strade gialle punteggiate di quadratini
// rossi, blu e grigi, con qualche blocco più grande. I mattoni sono i quadratini e i blocchi.
// Quando un quadratino salta, gli altri della stessa strada scivolano e si ridistribuiscono.
import { mulberry } from './mondrian-trama.js?v=7';
import { PW, PH, COL } from './mondrian-quadro.js?v=7';

const G = '#eec51c', RS = '#c9311e', BL = '#2447a0', GR = '#cdc9bf', FONDO = '#f3f0e7';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function quadroBoogie(seme) {
  const R = mulberry(seme);
  const SW = 19;                         // larghezza di una strada
  const RH = 600;                        // la griglia occupa la parte alta
  const colore = () => { const x = R(); return x < 0.36 ? RS : x < 0.64 ? BL : GR; };

  // strade: posizioni irregolari, come nel quadro
  const hs = [14 + R() * 20];
  while (true) { const y = hs[hs.length - 1] + SW + 55 + R() * 85; if (y > RH - SW - 50) break; hs.push(y); }
  hs.push(RH - SW);
  const vs = [10 + R() * 30];
  while (true) { const x = vs[vs.length - 1] + SW + 60 + R() * 100; if (x > PW - SW - 30) break; vs.push(x); }
  if (PW - SW - vs[vs.length - 1] > 90) vs.push(PW - SW - 12 - R() * 20);

  const strade = [];
  for (const y of hs) strade.push({ v: false, c: y, a: 0, b: PW, perline: [] });
  for (const x of vs) strade.push({ v: true, c: x, a: 0, b: RH, perline: [] });
  // due tronconi verticali corti fra strade orizzontali
  for (let k = 0; k < 2; k++) {
    const i = 1 + (R() * (hs.length - 2) | 0), j = (R() * (vs.length - 1) | 0);
    const x = (vs[j] + vs[j + 1]) / 2 + (R() - 0.5) * 20;
    strade.push({ v: true, c: x, a: hs[i - 1] + SW, b: hs[i], perline: [], corta: true });
  }
  const oriz = strade.filter(s => !s.v), vert = strade.filter(s => s.v);

  // incroci: quadratini fissi
  const incroci = [];
  for (const h of oriz) for (const v of vert) {
    if (h.c + SW <= v.a || h.c >= v.b) continue;
    incroci.push({ x: v.c, y: h.c, w: SW, h: SW, col: R() < 0.55 ? colore() : G, vivo: true });
  }
  // perline lungo le strade, a tratti fra un incrocio e l'altro
  for (const s of strade) {
    const croci = (s.v ? oriz.filter(h => h.c + SW > s.a && h.c < s.b).map(h => h.c)
                       : vert.filter(v => v.a < s.c + SW && v.b > s.c).map(v => v.c)).sort((p, q) => p - q);
    const tagli = [s.a - SW].concat(croci, [s.b]);
    s.tratti = [];
    for (let i = 0; i < tagli.length - 1; i++) {
      const t0 = tagli[i] + SW, t1 = tagli[i + 1];
      if (t1 - t0 < SW) continue;
      const tr = { t0, t1, perline: [] };
      let p = t0 + 4 + R() * 14;
      while (true) {
        const L = R() < 0.15 ? SW * 1.7 : SW;
        if (p + L > t1 - 3) break;
        if (R() < 0.62) tr.perline.push({ p: p + L / 2, meta: p + L / 2, L, col: colore(), vivo: true });
        p += L + 7 + R() * 30;
      }
      s.tratti.push(tr);
    }
  }
  // blocchi grandi nelle celle
  const blocchi = [];
  const tenta = 26;
  for (let k = 0; k < tenta && blocchi.length < 7; k++) {
    const i = R() * (hs.length - 1) | 0, j = R() * (vs.length - 1) | 0;
    const y0 = hs[i] + SW, y1 = hs[i + 1], x0 = vs[j] + SW, x1 = vs[j + 1];
    const cw = x1 - x0, ch = y1 - y0;
    if (cw < 50 || ch < 45) continue;
    const w = clamp(34 + R() * (cw - 20), 34, cw - 12), h = clamp(30 + R() * (ch - 18), 30, ch - 10);
    const x = R() < 0.5 ? x0 + (R() < 0.6 ? 0 : 6) : x1 - w - (R() < 0.6 ? 0 : 6);
    const y = R() < 0.5 ? y0 : y1 - h;
    if (blocchi.some(b => x < b.x + b.w + 6 && x + w > b.x - 6 && y < b.y + b.h + 6 && y + h > b.y - 6)) continue;
    const tipi = [[BL, RS], [RS, G], [G, RS], [GR, BL], [BL, G], [RS, GR]];
    const [c1, c2] = tipi[R() * tipi.length | 0];
    const iw = Math.min(w, h) * (0.3 + R() * 0.25);
    blocchi.push({ x, y, w, h, col: c1, dentro: { x: x + (w - iw) * (0.25 + R() * 0.5), y: y + (h - iw) * (0.25 + R() * 0.5), w: iw, h: iw, col: c2 }, vivo: true });
  }

  const vivi = () => {
    let n = incroci.filter(c => c.vivo && c.col !== G).length + blocchi.filter(b => b.vivo).length;
    for (const s of strade) for (const t of s.tratti) n += t.perline.filter(p => p.vivo).length;
    return n;
  };
  const rett = (s, p) => s.v ? { x: s.c, y: p.p - p.L / 2, w: SW, h: p.L } : { x: p.p - p.L / 2, y: s.c, w: p.L, h: SW };

  const Q = {
    tipo: 'boogie', RH, LB: 0,
    titolo: 'Broadway Boogie Woogie',
    campo: { x0: 0, x1: PW },
    statici: [],
    get finito() { return vivi() === 0; },
    rimasti: vivi,
    colori() { return new Set([G, RS, BL]); },
    aggiorna(dt) {
      const k = 1 - Math.exp(-dt * 7);
      for (const s of strade) for (const t of s.tratti) for (const p of t.perline) p.p += (p.meta - p.p) * k;
    },
    mattoni() {
      const m = [];
      for (const s of strade) for (const t of s.tratti) for (const p of t.perline) if (p.vivo) m.push({ ...rett(s, p), rif: { s, t, p } });
      for (const c of incroci) if (c.vivo && c.col !== G) m.push({ x: c.x, y: c.y, w: c.w, h: c.h, rif: { c } });
      for (const b of blocchi) if (b.vivo) m.push({ x: b.x, y: b.y, w: b.w, h: b.h, rif: { b } });
      return m;
    },
    colpisci(r) {
      if (r.p) {
        r.p.vivo = false;
        const q = rett(r.s, r.p);
        // i superstiti del tratto si ridistribuiscono: a metà strada verso la spaziatura uniforme
        const vive = r.t.perline.filter(p => p.vivo);
        const tot = vive.reduce((a, p) => a + p.L, 0), gap = (r.t.t1 - r.t.t0 - tot) / (vive.length + 1);
        let pos = r.t.t0 + gap;
        for (const p of vive) { const u = pos + p.L / 2; p.meta = p.meta * 0.45 + u * 0.55; pos += p.L + gap; }
        return { x: q.x, y: q.y, w: q.w, h: q.h, ix: 0, iy: 0, iw: q.w, ih: q.h, col: r.p.col, pat: 0, ox: 0, oy: 0, nobordo: true };
      }
      if (r.c) { r.c.vivo = false; const c = r.c; const col = c.col; c.col = G;
        return { x: c.x, y: c.y, w: c.w, h: c.h, ix: 0, iy: 0, iw: c.w, ih: c.h, col, pat: 0, ox: 0, oy: 0, nobordo: true }; }
      const b = r.b; b.vivo = false;
      return { x: b.x, y: b.y, w: b.w, h: b.h, ix: 0, iy: 0, iw: b.w, ih: b.h, col: b.col, pat: 1, ox: 3, oy: 9, nobordo: true,
        dentro: { x: b.dentro.x - b.x, y: b.dentro.y - b.y, w: b.dentro.w, h: b.dentro.h, col: b.dentro.col } };
    },
    disegna(g, P, pennello) {
      const al = k => clamp(k, 0, 1);
      g.fillStyle = COL.tela; g.fillRect(0, 0, PW, PH);
      g.globalAlpha = al(P / 0.25);
      g.fillStyle = FONDO; g.fillRect(0, 0, PW, PH);
      pennello(0, 0, PW, PH, 0, 0, 0);
      g.globalAlpha = 1;
      // strade gialle che si stendono
      strade.forEach((s, i) => {
        const k = al((P - 0.1 - i * 0.02) / 0.2);
        if (k <= 0) return;
        g.fillStyle = G;
        if (s.v) g.fillRect(s.c, s.a, SW, (s.b - s.a) * k); else g.fillRect(s.a, s.c, (s.b - s.a) * k, SW);
      });
      // blocchi
      blocchi.forEach((b, i) => {
        if (!b.vivo) return;
        g.globalAlpha = al((P - 0.55 - i * 0.03) / 0.2);
        g.fillStyle = b.col; g.fillRect(b.x, b.y, b.w, b.h);
        pennello(b.x, b.y, b.w, b.h, 1, 3, 9);
        const d = b.dentro; g.fillStyle = d.col; g.fillRect(d.x, d.y, d.w, d.h);
      });
      // quadratini
      for (const s of strade) for (const t of s.tratti) t.perline.forEach((p, i) => {
        if (!p.vivo) return;
        g.globalAlpha = al((P - 0.4 - ((p.meta * 7 + i * 13) % 100) / 300) / 0.12);
        const q = rett(s, p); g.fillStyle = p.col; g.fillRect(q.x, q.y, q.w, q.h);
      });
      for (const c of incroci) {
        if (c.col === G) continue;
        g.globalAlpha = al((P - 0.45) / 0.15);
        g.fillStyle = c.col; g.fillRect(c.x, c.y, c.w, c.h);
      }
      g.globalAlpha = 1;
    },
  };
  return Q;
}
