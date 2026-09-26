// Carta e cartone disegnati su canvas: fibre, pieghe, bordi consumati, e il ritaglio col bordo bianco.
import * as THREE from 'three';

export function rnd(seme) { let r = seme >>> 0 || 1; return () => ((r = (r * 16807) % 2147483647) / 2147483647); }
export function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function texDa(cv, ripeti = false) {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (ripeti) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Fibre della carta: puntini e trattini chiari e scuri, sottilissimi. */
export function fibre(g, w, h, forza = 1, seme = 7) {
  const r = rnd(seme);
  for (let i = 0; i < w * h / 90 * forza; i++) {
    const x = r() * w, y = r() * h, a = r() * Math.PI, l = 2 + r() * 7;
    g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.10 + r() * 0.12})` : `rgba(90,60,30,${0.04 + r() * 0.06})`;
    g.lineWidth = 0.6 + r() * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < w * h / 40 * forza; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '80,50,20'},${0.05 * r()})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
}

/** Una piega: linea chiara accanto a una linea scura, come un foglio piegato e riaperto. */
export function piega(g, x0, y0, x1, y1, forza = 1) {
  const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1, ox = nx / l * 1.6, oy = ny / l * 1.6;
  g.lineWidth = 2.2; g.lineCap = 'round';
  g.strokeStyle = `rgba(60,35,15,${0.16 * forza})`; g.beginPath(); g.moveTo(x0 + ox, y0 + oy); g.lineTo(x1 + ox, y1 + oy); g.stroke();
  g.strokeStyle = `rgba(255,255,245,${0.35 * forza})`; g.beginPath(); g.moveTo(x0 - ox, y0 - oy); g.lineTo(x1 - ox, y1 - oy); g.stroke();
}

/**
 * Ritaglio: disegna la figura, poi le mette dietro il bordo bianco del taglio con le forbici
 * (dilatazione dell'alfa) e un filo grigio che lo stacca dallo sfondo.
 */
export function ritaglio(w, h, disegna, bordo = 9) {
  const [a, ga] = tela(w, h);
  ga.translate(w * 0.06, h * 0.06); ga.scale(0.88, 0.88); disegna(ga);   // margine per il bordo bianco
  const [b, gb] = tela(w, h);
  const alone = (r, col) => {
    const [m, gm] = tela(w, h);
    for (let i = 0; i < 24; i++) { const t = i / 24 * Math.PI * 2; gm.drawImage(a, Math.cos(t) * r, Math.sin(t) * r); }
    for (let rr = r * 0.5; rr > 0; rr -= r * 0.5) for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; gm.drawImage(a, Math.cos(t) * rr, Math.sin(t) * rr); }
    gm.globalCompositeOperation = 'source-in'; gm.fillStyle = col; gm.fillRect(0, 0, w, h);
    return m;
  };
  gb.drawImage(alone(bordo + 2, '#b9b2a6'), 0, 0);
  gb.drawImage(alone(bordo, '#fbf8f1'), 0, 0);
  gb.drawImage(a, 0, 0);
  // fibre solo sopra il ritaglio
  gb.globalCompositeOperation = 'source-atop'; fibre(gb, w, h, 0.8, w + h);
  return b;
}

/** Il retro del foglio: il disegno speculare, schiarito come carta vista in controluce. */
export function retro(cv) {
  const [c, g] = tela(cv.width, cv.height);
  g.translate(cv.width, 0); g.scale(-1, 1); g.drawImage(cv, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,248,236,0.22)'; g.fillRect(0, 0, cv.width, cv.height);
  return c;
}

/** Cartone ondulato visto in sezione: onde marroni fra due strati di carta kraft. */
export function ondulato() {
  const [c, g] = tela(128, 32);
  g.fillStyle = '#c89a62'; g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#a97a45'; g.fillRect(0, 0, 128, 5); g.fillRect(0, 27, 128, 5);
  g.strokeStyle = '#8a5e30'; g.lineWidth = 3; g.beginPath();
  for (let x = 0; x <= 128; x++) { const y = 16 + Math.sin(x / 128 * Math.PI * 2 * 8) * 9; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  fibre(g, 128, 32, 1.5, 3);
  return texDa(c, true);
}

/** Kraft: il marrone del cartone da imballo, con fibre e qualche macchia. */
export function kraft(w, h, seme = 5, base = '#c79d68') {
  const [c, g] = tela(w, h); const r = rnd(seme);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(120,80,40,${0.03 + r() * 0.04})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
  fibre(g, w, h, 1.6, seme);
  return [c, g];
}
