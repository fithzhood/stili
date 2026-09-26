// Shader di contorno: triangolo a schermo pieno, bagliore (bloom) a piramide, composizione
// finale (tonemapping, vignetta, grana) e i granelli di polvere disegnati come punti.
export const VERT = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// riduzione: 4 campioni bilineari; alla prima passata tiene solo ciò che supera la soglia
export const GIU = `#version 300 es
precision highp float;
uniform sampler2D t; uniform vec2 uTex; uniform float uSoglia;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * 2.0 * uTex;
  vec3 c = (texture(t, uv + uTex * vec2(-1, -1)).rgb + texture(t, uv + uTex * vec2(1, -1)).rgb +
            texture(t, uv + uTex * vec2(-1, 1)).rgb + texture(t, uv + uTex * vec2(1, 1)).rgb) * 0.25;
  if (uSoglia > 0.0) { float l = max(c.r, max(c.g, c.b)); c *= max(0.0, l - uSoglia) / max(l, 1e-4); }
  o = vec4(c, 1.0);
}`;

// risalita: filtro a tenda su 9 campioni, sommato (blending additivo) al livello più fine
export const SU = `#version 300 es
precision highp float;
uniform sampler2D t; uniform vec2 uTex, uOut;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uOut, e = uTex;
  vec3 c = texture(t, uv).rgb * 4.0;
  c += (texture(t, uv + vec2(e.x, 0)).rgb + texture(t, uv - vec2(e.x, 0)).rgb + texture(t, uv + vec2(0, e.y)).rgb + texture(t, uv - vec2(0, e.y)).rgb) * 2.0;
  c += texture(t, uv + e).rgb + texture(t, uv - e).rgb + texture(t, uv + vec2(e.x, -e.y)).rgb + texture(t, uv + vec2(-e.x, e.y)).rgb;
  o = vec4(c / 16.0, 1.0);
}`;

export const FINALE = `#version 300 es
precision highp float;
uniform sampler2D tS, tB; uniform vec2 uRes; uniform float uEsp, uT;
out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture(tS, uv).rgb + texture(tB, uv).rgb * 0.35;
  c = aces(c * uEsp);
  vec2 q = uv - 0.5; q.x *= uRes.x / uRes.y;
  c *= 1.0 - 0.55 * smoothstep(0.35, 1.05, length(q * vec2(0.9, 1.1)));
  c = pow(c, vec3(1.0 / 2.2));
  c += (h(gl_FragCoord.xy + fract(uT) * 100.0) - 0.5) * 0.025;
  o = vec4(c, 1.0);
}`;

// polvere: punti in 3D proiettati con la stessa camera della scena
export const PUNTI_V = `#version 300 es
in vec3 p; in vec3 c;
uniform vec2 uRes; uniform float uF, uShift; uniform vec3 uCam;
out vec3 vc;
void main() {
  vec3 r = p - uCam; float z = -r.z;
  gl_Position = vec4(r.x * uF / (z * uRes.x / uRes.y), r.y * uF / z + uShift, 0.0, 1.0);
  gl_PointSize = clamp(uRes.y * 0.05 / z, 1.5, 6.0);
  vc = c;
}`;
export const PUNTI_F = `#version 300 es
precision highp float;
in vec3 vc; out vec4 o;
void main() { vec2 q = gl_PointCoord - 0.5; float a = exp(-dot(q, q) * 14.0); o = vec4(vc * a, 1.0); }`;
