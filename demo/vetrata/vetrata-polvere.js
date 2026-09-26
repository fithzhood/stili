// Granelli di polvere che galleggiano nella navata: si vedono solo dentro i raggi,
// e prendono il colore della tessera da cui passa la luce che li colpisce.
const A = 3.65, YS = 7.683, YB = 2, YT = 14, N = 900;

function arco(x, y) {
  const qx = Math.abs(x);
  const d = y < YS ? qx - A : Math.hypot(qx + A, y - YS) - 2 * A;
  return Math.max(d, YB - y);
}

export function creaPolvere(gl, piccola) {
  let s = 99;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pos = new Float32Array(N * 3), fase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rnd() - 0.5) * 16; pos[i * 3 + 1] = rnd() * 13; pos[i * 3 + 2] = 0.3 + rnd() * 15;
    fase[i] = rnd() * 100;
  }
  const dati = new Float32Array(N * 6);
  const vao = gl.createVertexArray(), vb = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, dati.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  gl.bindVertexArray(null);

  return {
    aggiorna(dt, t, L, sunC, nube) {
      for (let i = 0; i < N; i++) {
        const o = i * 3, f = fase[i];
        let x = pos[o], y = pos[o + 1], z = pos[o + 2];
        // moti lenti dell'aria: un vortice largo e un tremolio
        x += (Math.sin(y * 0.4 + t * 0.13 + f) * 0.05 + Math.sin(t * 0.9 + f * 3) * 0.02) * dt * 3;
        y += (Math.sin(x * 0.5 + t * 0.1 + f) * 0.04 - 0.012) * dt * 3;
        z += Math.cos(y * 0.3 + t * 0.12 + f * 2) * 0.05 * dt * 3;
        if (y < 0) y += 13; if (y > 13) y -= 13;
        if (x < -8) x += 16; if (x > 8) x -= 16;
        if (z < 0.3) z += 15; if (z > 15.3) z -= 15;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        const k = i * 6;
        dati[k] = x; dati[k + 1] = y; dati[k + 2] = z;
        let r = 0, g = 0, b = 0;
        if (L[2] < -0.01) {
          const sd = -z / L[2], wx = x + sd * L[0], wy = y + sd * L[1];
          if (arco(wx, wy) < 0) {
            const u = (wx + A) / (2 * A), v = (YT - wy) / (YT - YB);
            const px = Math.min(77, Math.max(0, u * 78 | 0)), py = Math.min(127, Math.max(0, v * 128 | 0));
            const q = (py * 78 + px) * 3;
            // i fiocchi ruotano e ogni tanto "accendono" un riflesso
            const sc = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * (1.5 + (f % 2)) + f), 6);
            const ombra = 1 - nube.forza * Math.exp(-(((wx - nube.x) / 4) ** 2));
            const m = sc * ombra * 0.9;
            r = piccola[q] * sunC[0] * m; g = piccola[q + 1] * sunC[1] * m; b = piccola[q + 2] * sunC[2] * m;
          }
        }
        dati[k + 3] = r; dati[k + 4] = g; dati[k + 5] = b;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dati);
    },
    disegna() {
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.POINTS, 0, N);
      gl.bindVertexArray(null);
    },
  };
}
