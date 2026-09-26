// Il foglio del prato: un'unica grande carta verde con il sentiero incollato sopra, il fiume
// di carta azzurra, ciuffi d'erba a pennarello e le pieghe di un foglio aperto.
import { tela, fibre, piega, rnd, texDa } from './carta.js?v=6';

export const TERRA = { x0: -30, x1: 34, z0: -14, z1: 8, S: 32 };
export const FIUME = { x0: 9.6, x1: 12.4 };

export function prato() {
  const { x0, x1, z0, z1, S } = TERRA;
  const W = (x1 - x0) * S, H = (z1 - z0) * S;
  const [c, g] = tela(W, H);
  const px = x => (x - x0) * S, pz = z => (z - z0) * S;
  const r = rnd(99);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#93cf86'); gr.addColorStop(1, '#a9dc7c');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // chiazze più scure e più chiare, come carte di due verdi incollate
  for (let i = 0; i < 40; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(120,190,100,0.35)' : 'rgba(190,230,140,0.35)';
    g.beginPath(); g.ellipse(r() * W, r() * H, 60 + r() * 120, 30 + r() * 50, r() * 0.4, 0, 7); g.fill();
  }
  // ciuffi d'erba
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, s = 4 + r() * 5;
    g.strokeStyle = r() < 0.7 ? 'rgba(70,140,70,0.55)' : 'rgba(230,250,190,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - s * 0.6, y - s); g.lineTo(x, y); g.lineTo(x + s * 0.6, y - s); g.stroke();
  }
  // un nastro irregolare con il bordo bianco strappato
  const nastro = (bordoA, bordoB, n, orizz, fill, bianco = 0.2) => {
    const giro = (off, jit) => {
      g.beginPath();
      for (let i = 0; i <= n; i++) { const u = i / n; const [a, b] = bordoA(u); const jj = (r() - 0.5) * jit; orizz ? g.lineTo(px(a), pz(b - off + jj)) : g.lineTo(px(a - off + jj), pz(b)); }
      for (let i = n; i >= 0; i--) { const u = i / n; const [a, b] = bordoB(u); const jj = (r() - 0.5) * jit; orizz ? g.lineTo(px(a), pz(b + off + jj)) : g.lineTo(px(a + off + jj), pz(b)); }
      g.closePath();
    };
    g.fillStyle = 'rgba(60,90,40,0.18)'; g.save(); g.translate(3, 5); giro(bianco, 0.06); g.fill(); g.restore();   // ombra del foglio
    g.fillStyle = '#fdfaf0'; giro(bianco, 0.09); g.fill();
    g.fillStyle = fill; giro(0, 0.02); g.fill();
  };
  // sentiero
  const sx = u => x0 + u * (x1 - x0);
  nastro(u => [sx(u), -1.7 + Math.sin(sx(u) * 0.35) * 0.35], u => [sx(u), 1.6 + Math.sin(sx(u) * 0.3 + 1) * 0.35], 240, true, '#f2ddb0');
  for (let i = 0; i < 260; i++) {
    const x = x0 + r() * (x1 - x0), z = -1.3 + r() * 2.6;
    g.fillStyle = r() < 0.5 ? '#dcc190' : '#fff1cf'; g.beginPath(); g.ellipse(px(x), pz(z), 3 + r() * 5, 2 + r() * 3, r() * 3, 0, 7); g.fill();
  }
  // fiume
  const sz = u => z0 + u * (z1 - z0);
  nastro(u => [FIUME.x0 + Math.sin(sz(u) * 0.5) * 0.25, sz(u)], u => [FIUME.x1 + Math.sin(sz(u) * 0.5 + 0.6) * 0.25, sz(u)], 120, false, '#6cc6ee', 0.25);
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 4;
  for (let i = 0; i < 40; i++) {
    const z = z0 + r() * (z1 - z0), x = FIUME.x0 + 0.5 + r() * 1.8;
    g.beginPath(); g.arc(px(x), pz(z), 7 + r() * 5, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
  }
  // le pieghe del foglio aperto
  for (const x of [-18, -4, 6, 20]) piega(g, px(x), 0, px(x) + 20, H, 1.3);
  piega(g, 0, pz(-6.5), W, pz(-6.2), 1.3);
  fibre(g, W, H, 0.6, 5);
  return texDa(c);
}
