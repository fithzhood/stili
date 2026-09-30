// La vita del villaggio: abitanti che passeggiano, galline e un gatto, farfalle, foglie che cadono.
import { T, SOPRA } from './mappa.js?v=8';
import { IMG, cam } from './disegno.js?v=8';
import { G, libero, caso } from './eroe.js?v=8';

export const ABITANTI = [];
const BESTIE = [], FARFALLE = [], FOGLIE = [];
const FRASI = {
  donna: 'Taglia pure l\'erba alta: tanto ricresce, e io intanto la innaffio.',
  vecchio: 'Ai miei tempi sotto i cespugli si trovavano i cuori. Anche oggi, a dire il vero.',
  ragazzo: 'Il pozzo è profondo. Una volta, laggiù, ho visto brillare una moneta.',
  ragazza: 'Sotto le chiome degli alberi non ti vede nessuno. Nemmeno io.',
};
const tile = (c, r) => [c * T + 8, r * T + 12];

export function popola() {
  const ab = (img, c, r, zona) => { const [x, y] = tile(c, r); ABITANTI.push({ img, x, y, dir: 0, passo: 0, vx: 0, vy: 0, cambio: caso() * 2, zona: zona.map(v => v * T), frase: FRASI[img] }); };
  ab('donna', 12, 9, [4, 8, 14, 10]); ab('vecchio', 7, 15, [3, 14, 15, 17]);
  ab('ragazzo', 21, 14, [18, 13, 24, 17]); ab('ragazza', 20, 21, [15, 19, 22, 26]);
  const be = (img, c, r, zona) => { const [x, y] = tile(c, r); BESTIE.push({ img, x, y, t: caso() * 3, vx: 0, vy: 0, cambio: 0, flip: false, zona: zona.map(v => v * T) }); };
  be('gallina', 24, 16, [22, 13, 26, 18]); be('gallina', 25, 14, [22, 13, 26, 18]); be('gallina', 6, 10, [4, 9, 13, 10]); be('gatto', 23, 13, [19, 12, 24, 14]);
  for (let i = 0; i < 7; i++) {
    const [x, y] = [[5, 11.5], [12, 11.5], [17, 14.5], [23, 16], [9, 22], [37, 10], [21, 21]][i];
    FARFALLE.push({ x: x * T, y: y * T, f: caso() * 10, col: ['#fff8e0', '#ffe070', '#ffb0d8'][i % 3] });
  }
}

function passeggia(p, dt, vel, fermo) {
  p.cambio -= dt;
  if (p.cambio <= 0) {
    p.cambio = 0.8 + caso() * 2.2;
    const k = Math.floor(caso() * 7);
    p.vx = [0, 0, -1, 1, 0, 0, 0][k] * vel; p.vy = [1, -1, 0, 0, 0, 0, 0][k] * vel;
  }
  if (fermo) { p.vx = p.vy = 0; return false; }
  const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, [x0, y0, x1, y1] = p.zona;
  const vicino = Math.abs(nx - G.x) < 13 && Math.abs(ny - G.y) < 10;
  if (nx > x0 && nx < x1 && ny > y0 && ny < y1 && !vicino && libero(nx, ny, 8, 4)) { p.x = nx; p.y = ny; return !!(p.vx || p.vy); }
  p.vx = p.vy = 0; return false;
}

export function aggiornaVita(dt, t, dialogo) {
  for (const p of ABITANTI) {
    const va = passeggia(p, dt, 24, dialogo && dialogo.chi === p);
    if (p.vx || p.vy) p.dir = p.vy > 0 ? 0 : p.vy < 0 ? 1 : p.vx < 0 ? 2 : 3;
    p.passo = va ? p.passo + dt * 6 : 0;
  }
  for (const b of BESTIE) { b.t += dt; passeggia(b, dt, 16, false); if (b.vx) b.flip = b.vx > 0; }
  // una foglia si stacca da una chioma visibile, ogni tanto
  if (caso() < dt * 0.9) {
    const vis = SOPRA.filter(o => o.x - cam.x > -20 && o.x - cam.x < 330 && o.y - cam.y > -40 && o.y - cam.y < 170 && o.img === 'nature');
    if (vis.length) { const o = vis[Math.floor(caso() * vis.length)]; FOGLIE.push({ x: o.x + 6 + caso() * (o.w - 12), y: o.y + 10 + caso() * 10, t: 0, f: caso() * 6 }); }
  }
  for (let i = FOGLIE.length - 1; i >= 0; i--) { const f = FOGLIE[i]; f.t += dt; f.y += 14 * dt; f.x += Math.sin(f.t * 2.4 + f.f) * 12 * dt; if (f.t > 3.2) FOGLIE.splice(i, 1); }
}

export function abitanteDavanti() {
  const fx = G.x + [0, 0, -12, 12][G.dir], fy = G.y + [12, -12, 0, 0][G.dir];
  return ABITANTI.find(p => Math.abs(p.x - fx) < 10 && Math.abs(p.y - fy) < 11);
}

export function attoriVita(g, t) {
  const L = [];
  const ombra = (x, y) => g.drawImage(IMG.ombra, x - 6, y - 3);
  for (const p of ABITANTI) L.push({ y: p.y, f: () => {
    const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
    ombra(x, y);
    g.drawImage(IMG[p.img], p.dir * 16, (p.passo ? Math.floor(p.passo) % 4 : 0) * 16, 16, 16, x - 8, y - 15, 16, 16);
  } });
  for (const b of BESTIE) L.push({ y: b.y, f: () => {
    const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y);
    const fr = Math.floor(b.t * (b.vx || b.vy ? 7 : 1.5)) % 2;
    ombra(x, y);
    g.save(); g.translate(x, 0); if (b.flip) g.scale(-1, 1);
    g.drawImage(IMG[b.img], fr * 16, 0, 16, 16, -8, y - 14, 16, 16); g.restore();
  } });
  return L;
}

// Farfalle e foglie volano sopra tutto tranne le chiome (le foglie cadono DALLE chiome: stanno sopra)
export function disegnaFarfalle(g, t) {
  for (const b of FARFALLE) {
    const x = Math.round(b.x + Math.sin(t * 0.6 + b.f) * 22 + Math.sin(t * 1.7 + b.f * 2) * 7 - cam.x);
    const y = Math.round(b.y + Math.cos(t * 0.8 + b.f) * 12 + Math.sin(t * 2.3 + b.f) * 4 - cam.y);
    const z = 8 + Math.round(Math.sin(t * 3 + b.f) * 2);
    g.fillStyle = 'rgba(30,26,70,0.35)'; g.fillRect(x - 1, y, 2, 1);
    const aperta = Math.floor(t * 9 + b.f) % 2;
    g.fillStyle = b.col;
    if (aperta) { g.fillRect(x - 2, y - z, 2, 2); g.fillRect(x + 1, y - z, 2, 2); } else { g.fillRect(x - 1, y - z - 1, 1, 2); g.fillRect(x + 1, y - z - 1, 1, 2); }
    g.fillStyle = '#3a2a30'; g.fillRect(x, y - z, 1, 2);
  }
}
export function disegnaFoglie(g) {
  for (const f of FOGLIE) {
    const fr = Math.floor(f.t * 6 + f.f) % 6;
    if (f.t > 2.7 && Math.floor(f.t * 20) % 2) continue;
    g.drawImage(IMG.foglie, fr * 12, 0, 12, 7, Math.round(f.x - cam.x) - 6, Math.round(f.y - cam.y) - 3, 12, 7);
  }
}
