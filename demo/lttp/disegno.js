// Disegno del mondo a strati: pavimento animato, ombre, oggetti e personaggi per quota, chiome sopra.
import { T, C, R, base, acquaPiena, taglio, OGG, SOPRA, OMBRE, FIORI, DECOR, NINFEE, hash } from './mappa.js?v=7';
export const IMG = {};
export const cam = { x: 0, y: 0 };
let ombre = null;

// Ombre: sagome sfocate e poi ridotte a tre livelli di trasparenza, come la "color math" del Super
// Nintendo (mezza tinta sottratta), con un retino a scacchiera sul gradino più esterno.
export function preparaOmbre() {
  ombre = document.createElement('canvas'); ombre.width = C * T; ombre.height = R * T;
  const g = ombre.getContext('2d', { willReadFrequently: true });
  g.filter = 'blur(2.5px)'; g.fillStyle = '#000';
  for (const o of OMBRE) {
    g.beginPath();
    if (o.rx) g.ellipse(o.x, o.y, o.rx, o.ry, 0, 0, Math.PI * 2); else g.roundRect(o.x, o.y, o.w, o.h, o.r);
    g.fill();
  }
  g.filter = 'none';
  const im = g.getImageData(0, 0, ombre.width, ombre.height), d = im.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = d[i + 3] / 255, x = p % ombre.width, y = (p / ombre.width) | 0;
    let q = a > 0.62 ? 1 : a > 0.3 ? 0.62 : a > 0.08 && ((x + y) & 1) ? 0.62 : 0;
    d[i] = 30; d[i + 1] = 26; d[i + 2] = 70; d[i + 3] = q * 105;
  }
  g.putImageData(im, 0, 0);
}

// disco a pixel pieni (niente bordi sfumati): righe di larghezza calcolata
function disco(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let dy = -Math.round(r * 0.7); dy <= Math.round(r * 0.7); dy++) {
    const w = Math.round(Math.sqrt(Math.max(0, 1 - (dy / (r * 0.7 + 0.5)) ** 2)) * r);
    g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}

export function tessera(img, sx, sy, x, y, w = T, h = T, flip = false, g) {
  x = Math.round(x - cam.x); y = Math.round(y - cam.y);
  if (flip) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(IMG[img], sx, sy, w, h, 0, 0, w, h); g.restore(); }
  else g.drawImage(IMG[img], sx, sy, w, h, x, y, w, h);
}

export function pavimento(g, t, LW, LH) {
  const c0 = Math.floor(cam.x / T), r0 = Math.floor(cam.y / T);
  const c1 = Math.min(C - 1, c0 + Math.ceil(LW / T) + 1), r1 = Math.min(R - 1, r0 + Math.ceil(LH / T) + 1);
  for (let r = Math.max(0, r0); r <= r1; r++) for (let c = Math.max(0, c0); c <= c1; c++) {
    const [img, sx, sy] = base[r][c];
    tessera(img, sx * T, sy * T, c * T, r * T, T, T, false, g);
    if (!acquaPiena[r][c]) continue;
    const h = hash(c, r);
    // onde: trattini chiari e scuri che scorrono piano, sfasati da una tessera all'altra
    for (let k = 0; k < 2; k++) {
      const hk = hash(c * 5 + k * 3, r * 11 + k);
      const fase = (t * 0.35 + hk) % 1;
      const x = Math.round(c * T + ((hk * 13 + fase * 8) % 12) - cam.x), y = Math.round(r * T + 3 + k * 7 + hk * 3 - cam.y);
      const w = 2 + Math.round(Math.sin(fase * Math.PI) * 3);
      g.fillStyle = k ? '#5cc6de' : '#a8f0fa'; g.fillRect(x, y, w, 1);
      if (!k) { g.fillStyle = '#5cc6de'; g.fillRect(x + 1, y + 1, Math.max(1, w - 2), 1); }
    }
    // luccichii: una croce di pixel che si accende e si spegne
    for (let k = 0; k < 2; k++) {
      const hk = hash(c * 7 + k, r * 13 + k);
      const v = Math.sin(t * (1.6 + hk * 2) + hk * 50);
      if (v < 0.8) continue;
      const x = Math.round(c * T + 3 + hk * 10 - cam.x), y = Math.round(r * T + 3 + (hk * 91 % 1) * 10 - cam.y);
      g.fillStyle = '#e8ffff'; g.fillRect(x, y, 1, 1);
      if (v > 0.92) { g.fillStyle = '#c8faff'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); g.fillStyle = '#fff'; g.fillRect(x, y, 1, 1); }
    }
  }
  for (const n of NINFEE) {
    const x = Math.round(n.x - cam.x), y = Math.round(n.y - cam.y + Math.sin(t * 1.3 + n.x) * 0.6);
    if (x < -8 || y < -8 || x > LW + 8 || y > LH + 8) continue;
    disco(g, x + 1, y + 2, n.r, '#2f6a4a'); disco(g, x, y + 1, n.r, '#6fb34a');
    g.fillStyle = '#a8d85a'; g.fillRect(x - 1, y, 2, 1);
    g.fillStyle = '#71ddee'; g.fillRect(x, y + 1, n.r, 1);
    if (n.r > 3) { g.fillStyle = '#f7a8c8'; g.fillRect(x - 2, y - 1, 2, 2); g.fillStyle = '#fff'; g.fillRect(x - 2, y - 1, 1, 1); }
  }
  for (const d of DECOR) {
    if (d.x - cam.x < -T || d.y - cam.y < -T || d.x - cam.x > LW || d.y - cam.y > LH) continue;
    tessera('detail', d.sx, d.sy, d.x, d.y, T, T, false, g);
  }
  // fiori che ondeggiano: la metà alta scivola di un pixel avanti e indietro
  for (const f of FIORI) {
    if (f.x - cam.x < -T || f.y - cam.y < -T || f.x - cam.x > LW || f.y - cam.y > LH) continue;
    const sx = [0, 3, 6][f.k] * T, sy = 11 * T;
    const s = [0, 1, 0, -1][(Math.floor(t * 2.6 + f.x * 0.07 + f.y * 0.05)) & 3];
    tessera('nature', sx, sy + 9, f.x, f.y + 9, T, 7, false, g);
    tessera('nature', sx, sy, f.x + s, f.y, T, 9, false, g);
  }
  // erba tagliata: resta il ciuffo basso
  for (let r = Math.max(0, r0); r <= r1; r++) for (let c = Math.max(0, c0); c <= c1; c++) {
    const k = taglio[r][c];
    if (k && !k.vivo) tessera('detail', 3 * T, 2 * T, c * T, r * T + 2, T, T, false, g);
  }
  g.drawImage(ombre, Math.round(cam.x), Math.round(cam.y), LW, LH, 0, 0, LW, LH);
}

// Oggetti e personaggi ordinati per quota: chi sta più in basso sullo schermo copre chi sta sopra.
export function oggetti(g, attori, LW, LH, t) {
  const lista = [];
  for (const o of OGG) if (o.x - cam.x < LW && o.y - cam.y < LH && o.x + o.w - cam.x > 0 && o.y + o.h - cam.y > 0)
    lista.push({ y: o.base, f: () => tessera(o.img, o.sx, o.sy, o.x, o.y, o.w, o.h, o.flip, g) });
  const c0 = Math.max(0, Math.floor(cam.x / T)), r0 = Math.max(0, Math.floor(cam.y / T));
  for (let r = r0; r < Math.min(R, r0 + Math.ceil(LH / T) + 2); r++) for (let c = c0; c < Math.min(C, c0 + Math.ceil(LW / T) + 2); c++) {
    const k = taglio[r][c];
    if (!k || !k.vivo) continue;
    const scossa = k.scossa > 0 ? Math.round(Math.sin(k.scossa * 60)) : 0;
    if (k.tipo === 'cesp') lista.push({ y: r * T + 14, f: () => tessera('nature', 2 * T, 10 * T, c * T + scossa, r * T, T, T, false, g) });
    else lista.push({ y: r * T + 6, f: () => { const fr = Math.floor(t * 1.5 + c * 0.4 + r * 0.3) % 2; g.drawImage(IMG.erbaAlta[fr], Math.round(c * T - cam.x), Math.round(r * T - 5 - cam.y)); } });
  }
  for (const a of attori) lista.push(a);
  lista.sort((a, b) => a.y - b.y);
  for (const o of lista) o.f();
}

export function chiome(g, LW, LH) {
  for (const o of SOPRA) if (o.x - cam.x < LW && o.y - cam.y < LH && o.x + o.w - cam.x > 0 && o.y + o.h - cam.y > 0)
    tessera(o.img, o.sx, o.sy, o.x, o.y, o.w, o.h, false, g);
}
