// Piccoli attrezzi WebGL2: programmi, texture, bersagli HDR, piramide del bagliore.
import { VERT, GIU, SU, FINALE } from './vetrata-glsl-post.js?v=3';

export function creaGL(cv) {
  const gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: Demo.shot, alpha: false });
  if (!gl) throw new Error('Serve WebGL2');
  const float = !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  return { gl, float };
}

export function programma(gl, vs, fs) {
  const sh = (t, s) => {
    const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(o));
    return o;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p'); gl.bindAttribLocation(p, 1, 'c');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

export function textura(gl, w, h, dati, mip) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, dati);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (mip) gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}

function bersaglio(gl, w, h, float) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f, w, h };
}

/** Catena di post: scena HDR → bagliore a 5 livelli → schermo. */
export function creaPost(gl, float) {
  const pGiu = programma(gl, VERT, GIU), pSu = programma(gl, VERT, SU), pFin = programma(gl, VERT, FINALE);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const quad = () => { gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  let scena = null, liv = [], W = 0, H = 0;
  const P = {
    quad,
    get scena() { return scena; },
    dimensioni(w, h) {
      if (w === W && h === H) return;
      W = w; H = h;
      scena = bersaglio(gl, w, h, float);
      liv = [];
      let lw = w, lh = h;
      for (let i = 0; i < 5; i++) { lw = Math.max(1, lw >> 1); lh = Math.max(1, lh >> 1); liv.push(bersaglio(gl, lw, lh, float)); }
    },
    finale(schermoW, schermoH, esp, t) {
      gl.disable(gl.BLEND);
      gl.useProgram(pGiu.p);
      let src = scena;
      liv.forEach((l, i) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, l.f); gl.viewport(0, 0, l.w, l.h);
        gl.bindTexture(gl.TEXTURE_2D, src.t);
        gl.uniform2f(pGiu.u.uTex, 1 / src.w, 1 / src.h); gl.uniform1f(pGiu.u.uSoglia, i === 0 ? 1.4 : 0);
        quad(); src = l;
      });
      gl.useProgram(pSu.p);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = liv.length - 1; i > 0; i--) {
        const a = liv[i], b = liv[i - 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, b.f); gl.viewport(0, 0, b.w, b.h);
        gl.bindTexture(gl.TEXTURE_2D, a.t);
        gl.uniform2f(pSu.u.uTex, 1 / a.w, 1 / a.h); gl.uniform2f(pSu.u.uOut, 1 / b.w, 1 / b.h);
        quad();
      }
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, schermoW, schermoH);
      gl.useProgram(pFin.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scena.t);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, liv[0].t);
      gl.uniform1i(pFin.u.tS, 0); gl.uniform1i(pFin.u.tB, 1);
      gl.uniform2f(pFin.u.uRes, schermoW, schermoH); gl.uniform1f(pFin.u.uEsp, esp); gl.uniform1f(pFin.u.uT, t);
      quad();
      gl.activeTexture(gl.TEXTURE0);
    },
  };
  return P;
}
