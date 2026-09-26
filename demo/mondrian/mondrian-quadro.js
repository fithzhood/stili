// Il quadro "classico": composizione per suddivisione ricorsiva (albero di tagli).
// Ogni foglia è un mattone. Quando una foglia cade, la linea che la separava dalla sorella
// scorre fino al bordo e la sorella si allarga: il quadro si ricompone restando un Mondrian.
import { mulberry } from './mondrian-trama.js?v=2';

export const PW = 1000, PH = 1080;          // tela, in unità
export const COL = {
  bianchi: ['#f8f5ec', '#f5f2e8', '#f9f7f1', '#f3f0e5'],
  rosso: '#cf2a1c', giallo: '#f2c616', blu: '#1c3b91', nero: '#151414', grigio: '#d4d1c7',
  tela: '#d7cbb0', linea: '#151414',
};
const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function quadroClassico(seme) {
  const R = mulberry(seme);
  const RH = 540 + (R() * 70 | 0);          // altezza della composizione
  const LB = 17;                             // linea che la chiude in basso
  let ord = 0;
  const foglia = (padre) => ({ f: true, padre, col: COL.bianchi[R() * 4 | 0], vuoto: false,
    pat: R() * 5 | 0, ox: R() * 300, oy: R() * 300 });
  let radice = foglia(null);

  // ── Layout (anche durante le animazioni) ──
  function rapporto(n) {
    if (!n.anim) return [n.r, n.lt];
    const k = ease(clamp(n.anim.t / n.anim.dur, 0, 1));
    return [n.anim.r0 + (n.anim.r1 - n.anim.r0) * k, n.lt * (1 - k)];
  }
  function layout() {
    const celle = [], linee = [];
    (function vai(n, cx, cy, cw, ch, px, py, pw, ph, prof) {
      n.cell = [cx, cy, cw, ch]; n.paint = [px, py, pw, ph];
      if (n.f || n.vuoto) { celle.push(n); return; }
      const [r, lt] = rapporto(n);
      if (n.dir === 'v') {
        const s = cx + cw * r;
        linee.push({ n, x: s - lt / 2, y: py, w: lt, h: ph, v: true });
        vai(n.a, cx, cy, s - cx, ch, px, py, Math.max(0, s - lt / 2 - px), ph, prof + 1);
        vai(n.b, s, cy, cx + cw - s, ch, s + lt / 2, py, Math.max(0, px + pw - s - lt / 2), ph, prof + 1);
      } else {
        const s = cy + ch * r;
        linee.push({ n, x: px, y: s - lt / 2, w: pw, h: lt, v: false });
        vai(n.a, cx, cy, cw, s - cy, px, py, pw, Math.max(0, s - lt / 2 - py), prof + 1);
        vai(n.b, cx, s, cw, cy + ch - s, px, s + lt / 2, pw, Math.max(0, py + ph - s - lt / 2), prof + 1);
      }
    })(radice, 0, 0, PW, RH, 0, 0, PW, RH, 0);
    return { celle, linee };
  }

  // ── Generazione ──
  const obiettivo = 12 + (R() * 5 | 0);
  let protetto = null, nfoglie = 1;
  for (let k = 0; k < 200 && nfoglie < obiettivo; k++) {
    const { celle } = layout();
    const cand = celle.filter(c => c !== protetto && Math.min(c.cell[2], c.cell[3]) > 120);
    if (!cand.length) break;
    let tot = 0; for (const c of cand) tot += Math.pow(c.cell[2] * c.cell[3], 1.3);
    let x = R() * tot, n = cand[0];
    for (const c of cand) { x -= Math.pow(c.cell[2] * c.cell[3], 1.3); if (x <= 0) { n = c; break; } }
    const [, , w, h] = n.cell;
    let dir = w > h * 1.1 ? 'v' : h > w * 1.1 ? 'o' : (R() < 0.5 ? 'v' : 'o');
    if (R() < 0.15) dir = dir === 'v' ? 'o' : 'v';
    let r = R() < 0.5 ? 0.2 + R() * 0.22 : 0.58 + R() * 0.22;
    // niente strisce lunghe e sottili: i figli restano rettangoli "da quadro"
    const aspetto = (d, r) => {
      const a = d === 'v' ? [w * r, h, w * (1 - r), h] : [w, h * r, w, h * (1 - r)];
      return Math.max(a[0] / a[1], a[1] / a[0], a[2] / a[3], a[3] / a[2]);
    };
    if (aspetto(dir, r) > 3.2) { dir = dir === 'v' ? 'o' : 'v'; if (aspetto(dir, r) > 3.2) continue; }
    const lato = dir === 'v' ? w : h;
    const min = 62 / lato;
    if (min > 0.45) continue;
    r = clamp(r, min, 1 - min);
    const prof = (function p(q) { return q.padre ? 1 + p(q.padre) : 0; })(n);
    const spessori = prof === 0 ? [17, 20, 23] : prof < 3 ? [12, 14, 17, 19] : [9, 11, 13, 15];
    Object.assign(n, { f: false, dir, r, lt: spessori[R() * spessori.length | 0], ord: ord++, anim: null,
      a: foglia(n), b: foglia(n) });
    nfoglie++;
    if (nfoglie === 5) {
      // il campo più grande resta intero: il "vuoto" su cui si regge il quadro
      const cc = layout().celle.sort((p, q) => q.cell[2] * q.cell[3] - p.cell[2] * p.cell[3]);
      protetto = cc[0];
    }
  }
  const nlinee = ord;

  // ── Colori: pochi, piccoli, verso i bordi ──
  {
    const cc = layout().celle.slice();
    const area = c => c.cell[2] * c.cell[3];
    const bordo = c => (c.cell[0] < 1) + (c.cell[1] < 1) + (c.cell[0] + c.cell[2] > PW - 1) + (c.cell[1] + c.cell[3] > RH - 1);
    const presi = new Set();
    const scegli = (filtro, peso) => {
      const l = cc.filter(c => !presi.has(c) && filtro(c));
      if (!l.length) return null;
      let tot = 0; for (const c of l) tot += peso(c);
      let x = R() * tot;
      for (const c of l) { x -= peso(c); if (x <= 0) { presi.add(c); return c; } }
      presi.add(l[0]); return l[0];
    };
    const ord2 = cc.slice().sort((p, q) => area(q) - area(p));
    const grande = ord2[0], medio = area(grande);
    if (R() < 0.45) { grande.col = COL.rosso; presi.add(grande); }
    else {
      presi.add(grande);
      const c = scegli(c => area(c) > medio * 0.05 && area(c) < medio * 0.95, c => 1 + bordo(c) * 2);
      if (c) c.col = COL.rosso;
    }
    const b = scegli(c => area(c) < medio * 0.35, c => (1 + bordo(c) * 3) / Math.sqrt(area(c)));
    if (b) b.col = COL.blu;
    const g = scegli(c => area(c) < medio * 0.3, c => (1 + bordo(c)) / Math.sqrt(area(c)));
    if (g) g.col = COL.giallo;
    if (R() < 0.4) { const n = scegli(c => area(c) < medio * 0.08, () => 1); if (n) n.col = COL.nero; }
    if (R() < 0.35) { const n = scegli(c => area(c) < medio * 0.3, () => 1); if (n) n.col = COL.grigio; }
  }

  // ── Striscia di bordo nel campo di gioco (una sola, asimmetrica) ──
  const striscia = R() < 0.85 ? (() => {
    const sx = R() < 0.5, sw = 44 + R() * 46, sy = PH - 70 - R() * 110;
    const colori = [COL.blu, COL.giallo, COL.rosso, COL.nero];
    return { sx, sw, sy, col: colori[R() * colori.length | 0], lt: 14 };
  })() : null;

  // ── Rimozione con ricomposizione ──
  let finito = false;
  function rimuovi(n) {
    n.vuoto = true;
    const p = n.padre;
    if (!p) { finito = true; return; }
    const sorella = p.a === n ? p.b : p.a;
    if (sorella.vuoto) { rimuovi(p); return; }
    const [r, lt] = rapporto(p);
    p.lt = lt;
    p.anim = { r0: r, r1: p.a === n ? 0 : 1, t: 0, dur: 0.8 };
  }
  function aggiorna(dt) {
    (function vai(n) {
      if (n.f) return;
      vai(n.a); vai(n.b);
      if (n.anim && !n.vuoto) {
        n.anim.t += dt;
        if (n.anim.t >= n.anim.dur) {
          const s = n.a.vuoto ? n.b : n.a;
          s.padre = n.padre;
          if (!n.padre) radice = s;
          else if (n.padre.a === n) n.padre.a = s; else n.padre.b = s;
        }
      }
    })(radice);
  }

  let L = layout();
  const Q = {
    tipo: 'classico', RH, LB,
    titolo: 'Composizione',
    campo: { x0: striscia && striscia.sx ? striscia.sw + striscia.lt / 2 : 0,
             x1: striscia && !striscia.sx ? PW - striscia.sw - striscia.lt / 2 : PW },
    statici: [[0, RH, PW, LB]].concat(striscia ? [[striscia.sx ? striscia.sw - striscia.lt / 2 : PW - striscia.sw - striscia.lt / 2, RH + LB, striscia.lt, PH - RH - LB]] : []),
    get finito() { return finito; },
    rimasti() { return L.celle.filter(c => c.f && !c.vuoto).length; },
    colori() { return new Set(L.celle.filter(c => c.f && !c.vuoto).map(c => c.col)); },
    aggiorna(dt) { aggiorna(dt); L = layout(); },
    mattoni() {
      const m = [];
      for (const c of L.celle) {
        if (!c.f || c.vuoto) continue;
        const [x, y, w, h] = c.cell;
        m.push({ x, y, w, h: (y + h > RH - 0.5) ? h + LB : h, rif: c });
      }
      return m;
    },
    /** Colpito: la foglia si stacca. Restituisce il pezzo che cade. */
    colpisci(c) {
      const [px, py, pw, ph] = c.paint, [x, y, w, h] = c.cell;
      const pezzo = { x, y, w, h: (y + h > RH - 0.5) ? h + LB : h, ix: px - x, iy: py - y, iw: pw, ih: ph,
        col: c.col, pat: c.pat, ox: c.ox, oy: c.oy };
      rimuovi(c);
      L = layout();
      return pezzo;
    },
    /** P: avanzamento della pittura iniziale 0..1. */
    disegna(g, P, pennello) {
      g.fillStyle = COL.tela; g.fillRect(0, 0, PW, PH);
      // campo di gioco (bianco) e striscia
      const fondo = COL.bianchi[0];
      const al = k => clamp(k, 0, 1);
      g.globalAlpha = al((P - 0.55) / 0.3);
      g.fillStyle = fondo; g.fillRect(0, RH + LB, PW, PH - RH - LB);
      pennello(0, RH + LB, PW, PH - RH - LB, 0, 40, 17);
      if (striscia) {
        const { sx, sw, sy, lt, col } = striscia;
        const x0 = sx ? 0 : PW - sw + lt / 2, w = sw - lt / 2;
        g.fillStyle = col; g.fillRect(x0, sy + lt / 2, w, PH - sy - lt / 2);
        pennello(x0, sy + lt / 2, w, PH - sy - lt / 2, 1, 7, 90);
      }
      // foglie
      L.celle.forEach((c, i) => {
        const [x, y, w, h] = c.paint;
        if (w <= 0 || h <= 0) return;
        if (c.vuoto) { g.globalAlpha = 1; g.fillStyle = COL.tela; g.fillRect(x, y, w, h); return; }
        g.globalAlpha = al((P - 0.5 - (i % 7) * 0.03) / 0.25);
        g.fillStyle = c.col; g.fillRect(x, y, w, h);
        pennello(x, y, w, h, c.pat, c.ox, c.oy);
      });
      g.globalAlpha = 1;
      // linee: nella pittura iniziale crescono una dopo l'altra
      g.fillStyle = COL.linea;
      const cresci = (x, y, w, h, v, k) => {
        k = al(k); if (k <= 0) return;
        if (v) g.fillRect(x, y, w, h * k); else g.fillRect(x, y, w * k, h);
      };
      cresci(0, RH, PW, LB, false, P / 0.12);
      if (striscia) {
        const { sx, sw, sy, lt } = striscia;
        const lx = sx ? sw - lt / 2 : PW - sw - lt / 2;
        cresci(lx, RH + LB, lt, PH - RH - LB, true, (P - 0.1) / 0.15);
        cresci(sx ? 0 : lx + lt, sy - lt / 2, sw - lt / 2, lt, false, (P - 0.2) / 0.1);
      }
      for (const l of L.linee) {
        const k = (P - 0.08 - (l.n.ord / Math.max(1, nlinee)) * 0.4) / 0.14;
        cresci(l.x, l.y, l.w, l.h, l.v, k);
      }
    },
  };
  return Q;
}
