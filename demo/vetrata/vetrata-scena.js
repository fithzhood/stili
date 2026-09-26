// La navata: sole comandato dal mouse, ore del giorno, nuvole, polvere nei raggi.
import { TW, TH } from './vetrata-disegno.js?v=7';
import { SCENA } from './vetrata-glsl-scena.js?v=7';
import { VERT, PUNTI_V, PUNTI_F } from './vetrata-glsl-post.js?v=7';
import { creaGL, programma, textura, creaPost } from './vetrata-gl.js?v=7';
import { creaPolvere } from './vetrata-polvere.js?v=7';

const ORE = [
  { nome: 'Alba', sun: [1.0, 0.56, 0.44], int: 5.5, sky: [0.26, 0.24, 0.4], amb: [0.05, 0.045, 0.065], el: [22, 40] },
  { nome: 'Mezzogiorno', sun: [1.0, 0.93, 0.8], int: 7.0, sky: [0.3, 0.4, 0.62], amb: [0.055, 0.056, 0.066], el: [38, 58] },
  { nome: 'Tramonto', sun: [1.0, 0.46, 0.18], int: 6.5, sky: [0.3, 0.2, 0.24], amb: [0.055, 0.04, 0.036], el: [18, 36] },
];
const CAM = { H: 1.7, D: 20.2, f: 2.1, shift: -0.37 };

export function avvia(vetro) {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
  document.body.prepend(cv);
  const { gl, float } = creaGL(cv);
  const post = creaPost(gl, float);
  const pS = programma(gl, VERT, SCENA), pP = programma(gl, PUNTI_V, PUNTI_F);
  const tCol = textura(gl, TW, TH, vetro.col, true), tAux = textura(gl, TW, TH, vetro.aux, false);
  const polvere = creaPolvere(gl, vetro.piccola);
  // media della luce trasmessa dalla finestra: illumina sguinci, pietra e pavimento
  let media = [0, 0, 0];
  for (let i = 0; i < vetro.piccola.length; i += 3) for (let j = 0; j < 3; j++) media[j] += vetro.piccola[i + j];
  media = media.map(v => v / (vetro.piccola.length / 3));

  const Q = Demo.query;
  let ora = Math.max(0, Math.min(2, parseInt(Q.get('ora') || '2', 10)));
  const cur = JSON.parse(JSON.stringify(ORE[ora]));
  let mx = parseFloat(Q.get('mx') || '0.4'), my = parseFloat(Q.get('my') || '0.15');
  const nube = { x: -99, forza: 0, attiva: false };
  if (Q.get('nube')) Object.assign(nube, { x: parseFloat(Q.get('nube')), forza: 0.8 });

  cv.addEventListener('mousemove', e => { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; });
  const cambiaOra = () => { ora = (ora + 1) % ORE.length; };
  const passaNube = () => { if (!nube.attiva) Object.assign(nube, { x: -16, attiva: true }); };
  cv.addEventListener('click', cambiaOra);

  let W = 0, H = 0, rw = 0, rh = 0;
  function misure() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = Math.round(innerWidth * dpr); H = Math.round(innerHeight * dpr);
    cv.width = W; cv.height = H;
    const rs = Math.min(1, 1500 / W);
    rw = Math.round(W * rs); rh = Math.round(H * rs);
    post.dimensioni(rw, rh);
  }
  misure();
  addEventListener('resize', misure);

  Demo.extra(`<p><b>Clic</b> o <b>spazio</b>: alba → mezzogiorno → tramonto. <b>N</b>: fa passare una nuvola.</p>
    <p>A sinistra san Pietro con le chiavi, a destra san Paolo con la spada e il libro; sopra, il rosone.</p>`);

  Demo.loop((dt, t) => {
    if (Demo.premuto(' ')) cambiaOra();
    if (Demo.premuto('n') || Demo.premuto('x')) passaNube();
    const a = Demo.asse(), gd = Demo.guarda();
    mx = Math.min(1, Math.max(0, mx + (a.x + gd.x) * dt * 0.4));
    my = Math.min(1, Math.max(0, my - (a.y + gd.y) * dt * 0.4));
    // l'ora scivola verso quella scelta
    const k = 1 - Math.exp(-dt * 1.6), O = ORE[ora];
    for (const c of ['sun', 'sky', 'amb', 'el']) cur[c] = cur[c].map((v, i) => v + (O[c][i] - v) * k);
    cur.int += (O.int - cur.int) * k;
    if (nube.attiva) { nube.x += dt * 3.6; nube.forza = 0.82; if (nube.x > 16) { nube.attiva = false; nube.forza = 0; } }
    const az = (mx - 0.5) * 1.3, el = (cur.el[1] + (cur.el[0] - cur.el[1]) * my) * Math.PI / 180;
    const L = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
    const sunC = cur.sun.map(v => v * cur.int);
    const velo = 1 - nube.forza * 0.5;
    const glow = media.map((m, i) => m * (cur.sky[i] * 1.2 + sunC[i] * 0.7 * velo) * 0.55);

    gl.bindFramebuffer(gl.FRAMEBUFFER, post.scena.f); gl.viewport(0, 0, rw, rh);
    gl.useProgram(pS.p);
    const u = pS.u;
    gl.uniform2f(u.uRes, rw, rh); gl.uniform1f(u.uF, CAM.f); gl.uniform1f(u.uShift, CAM.shift); gl.uniform1f(u.uT, t);
    gl.uniform3f(u.uCam, 0, CAM.H, CAM.D); gl.uniform3fv(u.uL, L); gl.uniform3fv(u.uSunC, sunC);
    gl.uniform3fv(u.uSky, cur.sky); gl.uniform3fv(u.uAmb, cur.amb); gl.uniform3fv(u.uGlow, glow);
    gl.uniform2f(u.uNube, nube.x, nube.forza);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tCol); gl.uniform1i(u.tCol, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tAux); gl.uniform1i(u.tAux, 1);
    gl.activeTexture(gl.TEXTURE0);
    post.quad();
    // polvere: additiva sopra la scena HDR
    polvere.aggiorna(dt, t, L, sunC, nube);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pP.p);
    gl.uniform2f(pP.u.uRes, rw, rh); gl.uniform1f(pP.u.uF, CAM.f); gl.uniform1f(pP.u.uShift, CAM.shift);
    gl.uniform3f(pP.u.uCam, 0, CAM.H, CAM.D);
    polvere.disegna();
    gl.disable(gl.BLEND);
    post.finale(W, H, parseFloat(Q.get('esp') || '1.0'), t);
  });
  Demo.pronto();
}
