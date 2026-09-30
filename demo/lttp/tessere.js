// Tessere disegnate a codice: l'erba alta (due fotogrammi, le punte ondeggiano) e l'ombra dei piedi.
import { IMG } from './disegno.js?v=8';

function erbaAlta(onda) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 21;
  const g = c.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(((x % 16) + 16) % 16, y, 1, 1); };
  // corpo del cespo: verde scuro pieno, con qualche filo più chiaro e più scuro
  g.fillStyle = '#437e38'; g.fillRect(0, 7, 16, 14);
  for (let y = 8; y < 21; y += 3) for (let x = (y * 5) % 4; x < 16; x += 4) { px(x, y, '#5a9a40'); px(x + 1, y - 1, '#5a9a40'); px(x + 2, y + 1, '#356a30'); }
  // ciuffi: tre steli per ciuffo, contorno scuro e punta chiara
  const steli = [];
  for (const [cx, cy] of [[2, 9], [7, 8], [12, 9], [5, 15], [10, 16], [15, 15]])
    for (const [a, l] of [[-0.5, 6], [0.05, 8], [0.55, 6]]) {
      const aa = a + onda * 0.18, pts = [];
      for (let s = 0; s <= l; s++) pts.push([Math.round(cx + Math.sin(aa) * s * (0.6 + s / l * 0.4)), Math.round(cy - Math.cos(aa) * s)]);
      steli.push(pts);
    }
  for (const p of steli) for (const [x, y] of p) { px(x - 1, y, '#26492c'); px(x + 1, y, '#26492c'); px(x, y - 1, '#26492c'); }
  for (const p of steli) p.forEach(([x, y], i) => px(x, y, i > p.length - 3 ? '#c4e46a' : i > p.length / 2 ? '#86c04c' : '#58983e'));
  return c;
}

export function preparaTessere() {
  IMG.erbaAlta = [erbaAlta(0), erbaAlta(1)];
  const om = document.createElement('canvas'); om.width = 12; om.height = 4;
  const og = om.getContext('2d'); og.fillStyle = 'rgba(30,26,70,0.42)'; og.fillRect(2, 0, 8, 4); og.fillRect(0, 1, 12, 2);
  IMG.ombra = om;
}
