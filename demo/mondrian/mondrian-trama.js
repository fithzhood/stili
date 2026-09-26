// Texture della pittura: pennellate per ogni rettangolo e trama della tela con craquelure.
// Tutto procedurale, generato una volta (le pennellate) o a ogni resize (la tela).

export function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Piastrella ripetibile di pennellate con una direzione dominante: da usare in "multiply".
// Bianco = neutro; le setole scuriscono appena, come le creste dell'olio sotto la luce radente.
function piastrella(ang, seme) {
  const S = 320, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const R = mulberry(seme);
  g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
  g.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const x = R() * S, y = R() * S;
    const L = 50 + R() * 150, w = 10 + R() * 22;
    const a = ang + (R() - 0.5) * 0.22;
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    const curva = (R() - 0.5) * 10;
    const setole = 7 + (R() * 8 | 0);
    for (let j = 0; j < setole; j++) {
      const o = (j / (setole - 1) - 0.5) * w;
      const al = 0.007 + R() * 0.02;
      const scuro = R() < 0.8;
      g.strokeStyle = scuro ? `rgba(60,55,45,${al})` : `rgba(255,255,255,${al})`;
      g.lineWidth = 0.8 + R() * 1.6;
      const l0 = -L / 2 + R() * 12, l1 = L / 2 - R() * 18;
      for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
        const bx = x + ox + nx * o, by = y + oy + ny * o;
        const x0 = bx + ca * l0, y0 = by + sa * l0, x1 = bx + ca * l1, y1 = by + sa * l1;
        if (Math.max(x0, x1) < -20 || Math.min(x0, x1) > S + 20 || Math.max(y0, y1) < -20 || Math.min(y0, y1) > S + 20) continue;
        g.beginPath(); g.moveTo(x0, y0);
        g.quadraticCurveTo(bx + nx * curva, by + ny * curva, x1, y1);
        g.stroke();
      }
    }
  }
  return c;
}

/** Quattro piastrelle: orizzontale, verticale, due oblique. */
export function creaPennellate() {
  return [0, Math.PI / 2, 0.5, -0.45, Math.PI / 2 + 0.3].map((a, i) => piastrella(a, 101 + i * 7));
}

/** Tela: trama dell'ordito, grana, luce di sala (più chiara in alto a sinistra), craquelure. */
export function creaTela(w, h, seme) {
  w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const R = mulberry(seme);
  const img = g.createImageData(w, h), d = img.data;
  const passo = Math.max(2, Math.round(w / 260));
  for (let y = 0; y < h; y++) {
    const fy = ((y % passo) / passo);
    for (let x = 0; x < w; x++) {
      const fx = ((x % passo) / passo);
      // trama: fili che si alternano sopra e sotto
      const sopra = ((x / passo | 0) + (y / passo | 0)) & 1;
      const filo = sopra ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
      let v = 0.965 + filo * 0.03 + (R() - 0.5) * 0.03;
      // luce della sala
      const u = x / w, t = y / h;
      v *= 1.0 - 0.045 * (u * 0.4 + t * 0.9) - 0.035 * Math.pow(Math.hypot(u - 0.45, t - 0.35) * 1.3, 2);
      const k = (y * w + x) * 4;
      const b = Math.max(0, Math.min(255, v * 255));
      d[k] = b; d[k + 1] = b * 0.995; d[k + 2] = b * 0.98; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // craquelure: reti di crepe sottili, a gruppi
  g.lineCap = 'round';
  const scala = w / 600;
  for (let gr = 0; gr < 26; gr++) {
    const cx = R() * w, cy = R() * h;
    for (let i = 0; i < 14; i++) {
      let x = cx + (R() - 0.5) * 90 * scala, y = cy + (R() - 0.5) * 90 * scala, a = R() * Math.PI * 2;
      g.strokeStyle = `rgba(70,60,45,${0.04 + R() * 0.06})`;
      g.lineWidth = Math.max(0.6, 0.7 * scala);
      g.beginPath(); g.moveTo(x, y);
      const n = 4 + (R() * 6 | 0);
      for (let s = 0; s < n; s++) {
        a += (R() - 0.5) * 1.3;
        x += Math.cos(a) * 9 * scala; y += Math.sin(a) * 9 * scala;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  return c;
}
