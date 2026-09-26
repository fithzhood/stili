// Shader della scena (HDR lineare). Mondo in metri: pavimento y=0, parete z=0, stanza a z>0.
// La finestra va da x=-3,65 a 3,65 e da y=2 a y=14; il vetro sta a z=0, la faccia esterna a z=-0,8.
export const SCENA = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uF, uShift, uT;
uniform vec3 uCam, uL, uSunC, uSky, uAmb, uGlow;
uniform vec2 uNube;
uniform sampler2D tCol, tAux;
out vec4 o;
const float A = 3.65, YS = 7.683, YB = 2.0, YT = 14.0;

float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0 + i.z * 113.0;
  vec4 a = fract(sin(vec4(n, n + 1.0, n + 57.0, n + 58.0)) * 43758.5);
  vec4 b = fract(sin(vec4(n + 113.0, n + 114.0, n + 170.0, n + 171.0)) * 43758.5);
  vec4 m = mix(a, b, f.z);
  return mix(mix(m.x, m.y, f.x), mix(m.z, m.w, f.x), f.y);
}
float arco(vec2 p) {
  vec2 q = vec2(abs(p.x), p.y);
  float d = q.y < YS ? q.x - A : length(q - vec2(-A, YS)) - 2.0 * A;
  return max(d, YB - q.y);
}
vec2 uvDi(vec2 w) { return vec2((w.x + A) / (2.0 * A), (YT - w.y) / (YT - YB)); }
vec3 vetro(vec2 uv, float lod) { vec3 c = textureLod(tCol, uv, lod).rgb; return c * c; }
float sole(float x) { return 1.0 - uNube.y * exp(-pow((x - uNube.x) / 4.0, 2.0)); }

// luce del sole che passa dalla finestra e arriva nel punto P (vetro colorato, sfocato con la distanza)
vec3 fascio(vec3 P, float lodMin, bool riv) {
  if (uL.z >= -0.01 || uL.y <= 0.0) return vec3(0);
  float s = -P.z / uL.z; vec3 W = P + s * uL;
  float d = arco(W.xy); if (d > 0.0) return vec3(0);
  float k = 1.0;
  if (riv) { vec3 W2 = P + ((-0.8 - P.z) / uL.z) * uL; k = smoothstep(0.0, -0.06, arco(W2.xy)); }
  float lod = max(lodMin, log2(0.8 * s + 1.5));
  return vetro(uvDi(W.xy), lod) * sole(W.x) * k;
}
vec3 conci(vec2 p) {
  float r = floor(p.y / 0.72), ox = h21(vec2(r, 3.1)) * 1.7;
  float c = floor((p.x + ox) / 1.6);
  vec2 f = vec2(fract((p.x + ox) / 1.6) * 1.6, fract(p.y / 0.72) * 0.72);
  float m = smoothstep(0.0, 0.03, min(min(f.x, 1.6 - f.x), min(f.y, 0.72 - f.y)));
  float v = 0.78 + 0.3 * h21(vec2(r, c)) + 0.18 * (vn(vec3(p * 6.0, 1.0)) - 0.5) + 0.1 * (vn(vec3(p * 23.0, 2.0)) - 0.5);
  return vec3(0.58, 0.53, 0.46) * v * mix(0.62, 1.0, m);
}
vec3 lastre(vec2 p) {
  float r = floor(p.y / 1.1), ox = mod(r, 2.0) * 0.55;
  float c = floor((p.x + ox) / 1.1);
  vec2 f = fract(vec2((p.x + ox) / 1.1, p.y / 1.1)) * 1.1;
  float m = smoothstep(0.0, 0.018, min(min(f.x, 1.1 - f.x), min(f.y, 1.1 - f.y)));
  float v = 0.7 + 0.35 * h21(vec2(r, c) + 7.0) + 0.22 * (vn(vec3(p * 3.0, 4.0)) - 0.5) + 0.12 * (vn(vec3(p * 17.0, 5.0)) - 0.5);
  return vec3(0.55, 0.5, 0.43) * v * mix(0.4, 1.0, m);
}

void main() {
  vec2 nd = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  float asp = uRes.x / uRes.y;
  vec3 d = normalize(vec3(nd.x * asp / uF, (nd.y - uShift) / uF, -1.0));
  vec3 cam = uCam;
  float tP = d.y < 0.0 ? -cam.y / d.y : 1e9, tW = -cam.z / d.z;
  float tH = min(tP, tW);
  vec3 P = cam + d * tH, col;
  float amb = 1.0;
  if (tW < tP) {
    float s = arco(P.xy);
    if (s < 0.0) {
      vec2 uv = uvDi(P.xy);
      vec4 c = texture(tCol, uv); vec4 x = texture(tAux, uv);
      vec3 T = c.rgb * c.rgb;
      vec2 tilt = (x.gb - 0.5) * 2.0;
      vec3 dv = normalize(d + vec3(tilt * 0.2, 0.0));
      float an = acos(clamp(dot(dv, uL), -1.0, 1.0));
      float si = sole(P.x);
      vec3 Lin = uSky * 1.2 + uSunC * si * (0.22 + 0.7 * exp(-an * an / 0.25) + 2.0 * exp(-an * an / 0.01));
      vec3 vetroC = T * Lin * 0.9;
      float pietra = x.a;
      vec3 pietraC = vec3(0.5, 0.46, 0.4) * (uAmb * 1.5 + uGlow * (0.15 + 0.5 * (1.0 - x.r)));
      vec3 piombo = vec3(0.02) * (uAmb + uGlow * 0.2);
      col = vetroC + pietraC * pietra + piombo * clamp(1.0 - c.a - pietra, 0.0, 1.0);
    } else {
      vec3 alb = conci(P.xy);
      float sp = 0.9;                                        // strombatura (sguincio) intorno al vano
      if (s < sp) {
        float k = s / sp;
        alb = vec3(0.6, 0.55, 0.48) * (0.85 + 0.3 * vn(vec3(P.xy * 5.0, 9.0)));
        col = alb * (uAmb * 1.2 + uGlow * (0.9 * pow(1.0 - k, 1.6) + 0.12)) * mix(1.0, 0.55, smoothstep(0.93, 1.0, k));
      } else {
        float cornice = smoothstep(1.62, 1.66, P.y) * (1.0 - smoothstep(1.86, 1.9, P.y));
        alb = mix(alb, vec3(0.62, 0.57, 0.5) * (0.9 + 0.2 * vn(vec3(P.xy * 8.0, 3.0))), cornice);
        col = alb * (uAmb + uGlow * 0.3 * exp(-(s - sp) / 2.2) + uGlow * 0.12 * exp(-P.y / 1.5));
        col *= 1.0 - 0.35 * smoothstep(1.86, 1.92, P.y) * (1.0 - smoothstep(1.92, 2.05, P.y));
        // semicolonne addossate ai lati della campata
        float u = (abs(P.x) - 7.6) / 0.75;
        if (abs(u) < 1.0) {
          vec3 n = normalize(vec3(sign(P.x) * u, 0.0, sqrt(1.0 - u * u)));
          vec3 l = normalize(vec3(0.0, 8.0, 3.0) - vec3(P.x, P.y, 0.75 * sqrt(1.0 - u * u)));
          float fus = 0.85 + 0.25 * vn(vec3(P.x * 3.0, P.y * 0.4, 7.0));
          col = vec3(0.6, 0.55, 0.48) * fus * (uAmb * (0.6 + 0.6 * n.z) + uGlow * 0.55 * max(dot(n, l), 0.0) + uGlow * 0.12 * exp(-P.y / 1.5));
          col *= 0.75 + 0.25 * smoothstep(0.02, 0.0, abs(fract(P.y / 0.72) - 0.5) - 0.48);
        }
      }
    }
  } else {
    vec3 alb = lastre(P.xz);
    float ao = 0.55 + 0.45 * smoothstep(0.0, 1.5, P.z);
    vec3 luce = uAmb * ao + uGlow * 0.18 * exp(-P.z / 4.0) + uSunC * fascio(P, 0.0, true) * uL.y * 2.2;
    col = alb * luce;
    // pavimento lucidato dall'uso: riflesso tenue della finestra
    vec3 r = reflect(d, vec3(0, 1, 0)); float tr = -P.z / r.z; vec3 W = P + r * tr;
    col += vetro(uvDi(W.xy), 4.0) * (uSky + uSunC * 0.8) * 0.03 * pow(1.0 - r.y, 3.0) * smoothstep(0.0, -0.5, arco(W.xy)) * step(0.0, W.y);
  }
  // pulviscolo nei raggi: marcia lungo il raggio di vista
  float N = 32.0, st = min(tH, 45.0) / N, j = h21(gl_FragCoord.xy + fract(uT * 7.0) * 91.0);
  vec3 acc = vec3(0);
  for (float i = 0.0; i < 32.0; i++) {
    vec3 Q = cam + d * (i + j) * st;
    if (Q.z < 0.05) break;
    vec3 f = fascio(Q, 3.2, false);
    if (f.r + f.g + f.b > 0.0) {
      float dens = 0.25 + 0.75 * smoothstep(0.35, 0.8, vn(Q * 0.8 + vec3(0.0, -uT * 0.06, uT * 0.04)));
      acc += f * dens;
    }
  }
  float ph = 0.35 + 1.3 * pow(max(dot(d, uL), 0.0), 3.0);
  col += acc * st * uSunC * ph * 0.017;
  o = vec4(col, 1.0);
}`;
