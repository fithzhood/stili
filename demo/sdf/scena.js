// Tutto il mondo della demo "sdf" in un solo fragment shader: isole sospese con un tempio
// in rovina e un acquedotto, sopra un mare di nuvole al tramonto. Nessun modello, nessuna
// texture: ogni pixel lancia un raggio e interroga una formula di distanza.
export const FRAG = /* glsl */`
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uCam;
uniform mat3  uRot;
uniform float uFov;
uniform vec3  uSun;
uniform vec2  uJit;
uniform int   uDebug;
uniform int   uZero;   // sempre 0: impedisce al compilatore di srotolare i cicli (ANGLE/D3D ci metterebbe minuti)
in vec2 vUv;
out vec4 fragColor;

#define PI 3.14159265

// ───────────── rumore ─────────────
float h1(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n2(vec2 x) {
  vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y);
}
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
const mat3 M3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = uZero; i < 3; i++) { s += a * n3(p); p = M3 * p * 2.03; a *= 0.5; } return s; }
float fbm2(vec2 p, int oct) { float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = uZero; i < 6; i++) { if (i >= oct) break; s += a * n2(p); p = m * p; a *= 0.5; } return s; }

// ───────────── primitive ─────────────
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdCylY(vec3 p, float r, float h0, float h1_) { vec2 d = vec2(length(p.xz) - r, max(h0 - p.y, p.y - h1_)); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float smax(float a, float b, float k) { float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) + k * h * (1.0 - h); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }

// ───────────── isole ─────────────
// Un'isola è una carota di roccia: in cima un pianoro, sotto si stringe fino a una punta.
float sdIsola(vec3 p, vec3 c, float r, float seme) {
  vec3 q = p - c;
  float b = length(q - vec3(0.0, -r * 0.8, 0.0)) - r * 2.1;
  if (b > 1.5) return b;
  float t = clamp(-q.y / (r * 2.2), 0.0, 1.0);
  float rad = r * (1.0 - pow(t, 0.85)) * (1.0 - 0.25 * t) + 0.2;
  float ang = atan(q.z, q.x);
  rad *= 1.0 + 0.10 * sin(ang * 3.0 + seme) + 0.06 * sin(ang * 7.0 + seme * 2.0);
  float d = (length(q.xz) - rad) * 0.62;
  float cima = q.y - 0.35 * n2(q.xz * 0.25 + seme) - 0.15;
  d = smax(d, cima, 0.9);
  d = max(d, -q.y - r * 2.25);
  float roc = fbm3(q * (0.9 / max(r, 3.0) * 2.2) + seme);
  d += (roc - 0.5) * r * 0.22 * (0.35 + t);
  return d;
}

// Tempio: stilobate a tre gradini, peristilio di 6×8 colonne, architrave davanti, dietro il crollo.
float colonna(vec3 q, vec2 id, out float capitello) {
  float hh = h1(id * 7.31 + 1.7);
  float alt = 6.2;
  bool rotta = (id.y < -1.5 && hh < 0.7) || (hh < 0.18);
  if (rotta) alt = 1.2 + 3.8 * h1(id + 3.1);
  float r = 0.46 - 0.05 * clamp(q.y / 6.2, 0.0, 1.0);
  float ang = atan(q.z, q.x);
  r += 0.018 * cos(ang * 20.0);
  float cima = rotta ? alt + 0.35 * (n2(q.xz * 3.0 + id * 5.0) - 0.5) : alt;
  float d = sdCylY(q, r, 0.0, cima) * 0.9;
  d = min(d, sdCylY(q, 0.58, 0.0, 0.22));                       // base
  capitello = 1e5;
  if (!rotta) {
    capitello = sdBox(q - vec3(0.0, alt + 0.14, 0.0), vec3(0.62, 0.14, 0.62));
    capitello = min(capitello, sdCylY(q, 0.55 - 0.1 * clamp((alt - q.y) * 3.0, 0.0, 1.0), alt - 0.3, alt));
  }
  return min(d, capitello);
}

vec2 tempio(vec3 p) {
  vec3 q = p - vec3(-1.0, 0.35, 1.0);
  float bb = sdBox(q - vec3(0.0, 4.5, 0.0), vec3(7.8, 5.9, 9.0));
  if (bb > 1.0) return vec2(bb, 3.0);
  // gradini
  float d = sdBox(q - vec3(0.0, 0.2, 0.0), vec3(5.9, 0.2, 8.1));
  d = min(d, sdBox(q - vec3(0.0, 0.6, 0.0), vec3(5.5, 0.2, 7.7)));
  d = min(d, sdBox(q - vec3(0.0, 1.0, 0.0), vec3(5.1, 0.2, 7.3)));
  // colonne sul perimetro: si prende la colonna del bordo più vicina
  vec3 cq = q - vec3(0.0, 1.2, 0.0);
  const float S = 2.2;
  vec2 id = clamp(floor(cq.xz / S + 0.5), vec2(-2.0, -3.0), vec2(2.0, 3.0));
  vec2 idA = vec2(sign(id.x + 0.001) * 2.0, id.y);
  vec2 idB = vec2(id.x, sign(id.y + 0.001) * 3.0);
  if (abs(id.x) > 1.5 || abs(id.y) > 2.5) { idA = id; idB = id; }
  float cap, col = 1e5;
  for (int k = uZero; k < 2; k++) {
    vec2 ii = k == 0 ? idA : idB;
    col = min(col, colonna(cq - vec3(ii.x * S, 0.0, ii.y * S), ii, cap));
  }
  // architrave, cornice e frontone, solo sulla metà anteriore
  float arch = sdBox(q - vec3(0.0, 7.95, 3.2), vec3(4.95, 0.42, 3.9));
  arch = min(arch, sdBox(q - vec3(0.0, 8.5, 3.3), vec3(5.15, 0.13, 4.05)));
  vec3 fq = q - vec3(0.0, 8.63, 6.85);
  float tri = max(abs(fq.x) * 0.3 + fq.y - 1.5, -fq.y);
  tri = max(tri, abs(fq.z) - 0.45);
  arch = min(arch, tri * 0.9);
  arch = max(arch, -(q.z + 0.6 * n2(q.xy * 1.5) - 0.6));
  // rocchi di colonna caduti
  vec3 r1 = q - vec3(3.4, 1.64, -5.6); r1.xz = mat2(0.8, 0.6, -0.6, 0.8) * r1.xz;
  float rocchi = sdCylY(r1.yxz, 0.44, -1.0, 1.0);
  vec3 r2 = q - vec3(-7.0, 0.44, -4.0); r2.xz = mat2(0.3, 0.95, -0.95, 0.3) * r2.xz;
  rocchi = min(rocchi, sdCylY(r2.yxz, 0.44, -0.8, 0.8));
  rocchi = min(rocchi, sdBox(q - vec3(-1.5, 1.64, -4.8), vec3(1.4, 0.42, 0.55)));
  d = min(d, min(col, min(arch, rocchi)));
  return vec2(d, 3.0);
}

// Acquedotto a due ordini di archi che scavalca il vuoto fra due isole.
vec2 acquedotto(vec3 p) {
  vec3 q = p - vec3(20.0, 0.0, 7.0);
  q.xz = mat2(0.894, -0.447, 0.447, 0.894) * q.xz;
  float bb = sdBox(q - vec3(0.0, -2.0, 0.0), vec3(12.5, 8.0, 1.6));
  if (bb > 1.0) return vec2(bb, 5.0);
  float d = sdBox(q - vec3(0.0, -2.2, 0.0), vec3(11.5, 7.0, 0.95));
  // archi grandi (ordine inferiore)
  float per = 3.3;
  vec3 a = q; a.x = mod(a.x + per * 0.5, per) - per * 0.5;
  float arco = min(length(a.xy - vec2(0.0, -2.2)) - 1.3, sdBox(a - vec3(0.0, -6.0, 0.0), vec3(1.3, 3.8, 2.0)));
  arco = max(arco, abs(a.z) - 2.0);
  d = max(d, -arco);
  // archetti (ordine superiore)
  vec3 b = q; float per2 = 1.65; b.x = mod(b.x + per2 * 0.5, per2) - per2 * 0.5;
  float arco2 = min(length(b.xy - vec2(0.0, 2.6)) - 0.52, sdBox(b - vec3(0.0, 1.6, 0.0), vec3(0.52, 1.0, 2.0)));
  d = max(d, -arco2);
  // cornicione e speco (il canale in cima)
  d = min(d, sdBox(q - vec3(0.0, 0.95, 0.0), vec3(11.6, 0.14, 1.12)));
  d = max(d, -sdBox(q - vec3(0.0, 4.9, 0.0), vec3(12.0, 0.2, 0.45)));
  // estremità erose e fondo spezzato
  d = max(d, abs(q.x) - 10.2 - 1.3 * n2(q.yz * 0.7));
  d = max(d, -(q.y + 8.3 - 2.5 * n2(q.xz * 0.6 + 4.0) - 1.5 * n2(q.xz * 2.0)));
  return vec2(d, 5.0);
}

// Cipressi: ellissoidi scuri e affusolati
float cipresso(vec3 p, vec3 c, float h) {
  vec3 q = p - c;
  float d = sdEll(q - vec3(0.0, h * 0.5, 0.0), vec3(h * 0.13, h * 0.52, h * 0.13));
  d = min(d, sdCylY(q, 0.12, -0.3, 0.8));
  return d;
}

// isole: centro (xyz), raggio; il seme è l'indice. Le piccole ondeggiano piano.
const vec4 ISOLE[10] = vec4[10](
  vec4(0.0, 0.0, 0.0, 14.0), vec4(34.0, -3.0, 13.0, 8.0), vec4(-30.0, 5.0, -24.0, 6.5),
  vec4(12.0, 8.0, -30.0, 3.2), vec4(-16.0, -6.0, 22.0, 2.4), vec4(22.0, 12.0, 30.0, 1.7),
  vec4(-44.0, -2.0, 14.0, 3.5), vec4(150.0, 4.0, -120.0, 30.0), vec4(-60.0, 18.0, -170.0, 24.0),
  vec4(40.0, 0.0, -220.0, 20.0));
float ondeggia(int i) { return (i >= 2 && i <= 6) ? 0.4 * sin(uTime * (0.3 + 0.05 * float(i)) + float(i)) : 0.0; }

vec2 mappa(vec3 p) {
  float d = 1e5;
  for (int i = uZero; i < 10; i++) {
    vec4 is = ISOLE[i];
    // scarto rapido: lontano dall'isola basta la sfera che la contiene
    vec3 c = is.xyz + vec3(0.0, ondeggia(i), 0.0);
    float b = length(p - c + vec3(0.0, is.w * 0.8, 0.0)) - is.w * 2.1;
    if (b > d) continue;
    d = min(d, sdIsola(p, c, is.w, float(i) * 3.0 + 1.0));
  }
  vec2 r = vec2(d, 1.0);
  vec2 t = tempio(p); if (t.x < r.x) r = t;
  vec2 a = acquedotto(p); if (a.x < r.x) r = a;
  float cp = cipresso(p, vec3(-8.6, 0.4, 7.0), 7.5);
  cp = min(cp, cipresso(p, vec3(-9.2, 0.4, 3.8), 6.0));
  cp = min(cp, cipresso(p, vec3(7.9, 0.4, -6.5), 8.0));
  cp = min(cp, cipresso(p, vec3(36.0, -2.6, 12.0), 7.0));
  cp = min(cp, cipresso(p, vec3(33.0, -2.6, 16.5), 5.2));
  cp = min(cp, cipresso(p, vec3(-31.0, 5.4 + ondeggia(2), -25.0), 5.5));
  if (cp < r.x) r = vec2(cp, 4.0);
  return r;
}

// ───────────── raymarching ─────────────
vec2 traccia(vec3 ro, vec3 rd, float tmax) {
  float t = 0.05;
  // il mondo solido vive fra y = -32 e y = 50: fuori non si marcia
  if (rd.y > 0.0 && ro.y > 50.0) return vec2(-1.0);
  if (rd.y < 0.0) tmax = min(tmax, (ro.y + 32.0) / -rd.y);
  if (rd.y > 0.0) tmax = min(tmax, (50.0 - ro.y) / rd.y);
  for (int i = uZero; i < 140; i++) {
    vec3 p = ro + rd * t;
    vec2 h = mappa(p);
    if (h.x < 0.0012 * t) return vec2(t, h.y);
    t += h.x;
    if (t > tmax) break;
  }
  return vec2(-1.0);
}

vec3 normale(vec3 p, float t) {
  vec3 n = vec3(0.0);
  float e = 0.0015 * max(t, 1.0);
  for (int i = uZero; i < 4; i++) {
    vec3 k = 0.5773 * (2.0 * vec3((((i + 3) >> 1) & 1), ((i >> 1) & 1), (i & 1)) - 1.0);
    n += k * mappa(p + e * k).x;
  }
  return normalize(n);
}

float ombra(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.08, ph = 1e10;
  for (int i = uZero; i < 28; i++) {
    float h = mappa(ro + rd * t).x;
    float y = h * h / (2.0 * ph);
    float d = sqrt(max(h * h - y * y, 0.0));
    res = min(res, 10.0 * d / max(0.0, t - y));
    ph = h;
    t += clamp(h, 0.1, 4.0);
    if (res < 0.002 || t > 80.0) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

float occlusione(vec3 p, vec3 n) {
  float o = 0.0, s = 1.0;
  for (int i = uZero; i < 4; i++) {
    float h = 0.06 + 0.55 * float(i);
    o += (h - mappa(p + n * h).x) * s;
    s *= 0.72;
  }
  return clamp(1.0 - 0.55 * o, 0.0, 1.0);
}

// ───────────── cielo ─────────────
const vec3 SOLE = vec3(1.75, 1.18, 0.72);
vec3 cielo(vec3 rd) {
  float y = rd.y;
  vec3 orizz = vec3(1.10, 0.56, 0.24);
  vec3 zenit = vec3(0.05, 0.15, 0.45);
  vec3 col = mix(orizz, zenit, pow(clamp(y + 0.02, 0.0, 1.0), 0.45));
  col = mix(col, vec3(1.0, 0.55, 0.36), 0.45 * exp(-abs(y) * 14.0));   // fascia rosata all'orizzonte
  float s = max(dot(rd, uSun), 0.0);
  col += SOLE * (0.55 * pow(s, 6.0) + 0.35 * pow(s, 48.0));
  col += vec3(4.0, 3.2, 2.2) * smoothstep(0.99955, 0.9998, s);
  // cirri alti
  if (y > 0.0) {
    vec2 uv = rd.xz / (y + 0.06) * 1.4 + vec2(uTime * 0.004, 0.0);
    float c = fbm2(uv * vec2(0.7, 2.2), 5);
    c = smoothstep(0.52, 0.85, c) * smoothstep(0.0, 0.18, y);
    vec3 cc = mix(vec3(1.25, 0.72, 0.52), vec3(1.6, 1.05, 0.75), pow(s, 4.0));
    col = mix(col, cc, c * 0.55);
  }
  return col;
}

vec3 foschia(vec3 rd) {
  float s = max(dot(rd, uSun), 0.0);
  return mix(vec3(0.62, 0.46, 0.46), vec3(1.25, 0.72, 0.42), pow(s, 4.0));
}

// ───────────── materiali ─────────────
vec3 colore(vec3 p, vec3 n, float m, out float spec) {
  spec = 0.0;
  if (m < 1.5) {
    // roccia a strati, verde sul pianoro
    float strati = n3(vec3(p.x * 0.08, p.y * 1.3, p.z * 0.08)) * 0.6 + 0.4 * sin(p.y * 2.3 + n3(p * 0.4) * 3.0);
    vec3 r = mix(vec3(0.40, 0.28, 0.20), vec3(0.62, 0.48, 0.34), strati);
    r = mix(r, vec3(0.30, 0.22, 0.17), smoothstep(0.55, 0.9, n3(p * 1.7)) * 0.6);
    float g = smoothstep(0.55, 0.85, n.y + 0.25 * (n3(p * 0.9) - 0.5));
    vec3 erba = mix(vec3(0.20, 0.30, 0.08), vec3(0.42, 0.46, 0.14), n3(p * 0.6));
    erba = mix(erba, vec3(0.55, 0.45, 0.20), smoothstep(0.6, 0.8, n3(p * 0.25 + 3.0)) * 0.6);
    return mix(r, erba, g);
  }
  if (m < 3.5) {
    // marmo caldo, un po' consumato
    float v = n3(p * vec3(2.0, 0.6, 2.0));
    vec3 c = mix(vec3(0.80, 0.74, 0.64), vec3(0.90, 0.86, 0.78), v);
    c *= 0.82 + 0.18 * n3(p * 6.0);
    c = mix(c, vec3(0.42, 0.44, 0.30), smoothstep(0.62, 0.85, n3(p * 1.3 + 7.0)) * smoothstep(0.3, 0.9, n.y) * 0.7);
    spec = 0.25;
    return c;
  }
  if (m < 4.5) return mix(vec3(0.05, 0.10, 0.04), vec3(0.10, 0.17, 0.06), n3(p * 3.0));
  // tufo dell'acquedotto
  float v = n3(p * vec3(1.5, 4.0, 1.5));
  vec3 c = mix(vec3(0.62, 0.46, 0.32), vec3(0.74, 0.58, 0.40), v);
  // filari di conci
  float giunto = smoothstep(0.04, 0.0, abs(fract(p.y * 1.6) - 0.5) - 0.46);
  c *= 1.0 - 0.25 * giunto;
  return c;
}

vec3 illumina(vec3 p, vec3 rd, vec3 n, float m, float t) {
  float spec;
  vec3 alb = colore(p, n, m, spec);
  float dif = clamp(dot(n, uSun), 0.0, 1.0);
  float sh = dif > 0.001 ? ombra(p + n * 0.02 * max(t * 0.05, 1.0), uSun) : 0.0;
  float ao = occlusione(p, n);
  float cie = clamp(0.5 + 0.5 * n.y, 0.0, 1.0);
  float bas = clamp(0.5 - 0.5 * n.y, 0.0, 1.0);             // luce che risale dalle nuvole
  float ctr = clamp(dot(n, normalize(vec3(-uSun.x, 0.0, -uSun.z))), 0.0, 1.0);
  vec3 lin = vec3(0.0);
  lin += SOLE * 2.6 * dif * sh;
  lin += vec3(0.24, 0.30, 0.52) * 0.55 * cie * ao;
  lin += vec3(0.85, 0.55, 0.45) * 0.30 * bas * ao;
  lin += vec3(0.45, 0.30, 0.22) * 0.25 * ctr * ao;
  vec3 col = alb * lin;
  vec3 h = normalize(uSun - rd);
  float fr = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 5.0);
  col += SOLE * spec * pow(clamp(dot(n, h), 0.0, 1.0), 24.0) * dif * sh * (0.3 + 0.7 * fr);
  if (m > 3.5 && m < 4.5) col += SOLE * 0.10 * fr * sh;
  return col;
}

// ───────────── nuvole ─────────────
// Il mare di nuvole è una superficie morbida: un'altezza a grandi banchi, più un rumore 3D
// che la gonfia a cavolfiore. Si illumina come un corpo che lascia passare la luce:
// luce avvolgente, cime dorate, valli in ombra bluastra, bordi che si accendono controsole.
float nuvolaBase(vec2 xz) {
  vec2 w = xz + vec2(uTime * 0.5, uTime * 0.15);
  float grande = fbm2(w * 0.010, 3);
  float cumuli = n2(w * 0.028); cumuli *= cumuli;
  return -31.0 + 11.0 * grande + 12.0 * cumuli;
}
float gonfio(vec3 p, float lod) {
  vec3 w = p + vec3(uTime * 0.5, 0.0, uTime * 0.15);
  float a = n3(w * 0.055);
  float b = n3(w * 0.14 + 5.0);
  float c = n3(w * 0.36 + 9.0);
  return 9.0 * a * a + (4.5 * b * b + 1.2 * c) * lod;
}
float nuvolaF(vec3 p, float lod) { return p.y - nuvolaBase(p.xz) - gonfio(p, lod); }

vec4 nuvole(vec3 ro, vec3 rd, float tmax, float dith) {
  const float TOP = 4.0;
  if (rd.y >= 0.0 && ro.y > TOP) return vec4(0.0, 0.0, 0.0, 1.0);
  float t = 0.0;
  if (ro.y > TOP) t = (ro.y - TOP) / -rd.y;
  tmax = min(tmax, 1400.0);
  if (t > tmax) return vec4(0.0, 0.0, 0.0, 1.0);
  float lod = 1.0, f = 0.0, tp = t;
  bool colpito = false;
  for (int i = uZero; i < 64; i++) {
    vec3 p = ro + rd * t;
    lod = smoothstep(260.0, 80.0, t);
    f = nuvolaF(p, lod);
    if (f < 0.02 * t * 0.02 + 0.02) { colpito = true; break; }
    tp = t;
    t += max(f * 0.55, 0.2 + t * 0.006);
    if (t > tmax) break;
  }
  if (!colpito) return (rd.y < 0.0 && t < tmax) ? vec4(foschia(rd) * 0.95, 0.0) : vec4(0.0, 0.0, 0.0, 1.0);
  // affina il punto fra l'ultimo passo fuori e quello dentro
  float ta = tp, tb = t;
  for (int i = uZero; i < 5; i++) {
    float tm = 0.5 * (ta + tb);
    if (nuvolaF(ro + rd * tm, lod) < 0.0) tb = tm; else ta = tm;
  }
  t = tb;
  if (t > tmax) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 p = ro + rd * t;
  float e = 0.35 + t * 0.004;
  vec3 n = normalize(vec3(nuvolaF(p + vec3(e, 0, 0), lod) - nuvolaF(p - vec3(e, 0, 0), lod),
                          2.0 * e,
                          nuvolaF(p + vec3(0, 0, e), lod) - nuvolaF(p - vec3(0, 0, e), lod)));
  // quanto la nuvola stessa copre il sole: si guarda poco più in là verso il sole
  float occ = 0.0;
  for (int i = uZero; i < 3; i++) {
    float k = 2.0 + float(i) * 5.0;
    occ += clamp(-nuvolaF(p + uSun * k + n * 0.5, 0.0) / (1.5 + k * 0.6), 0.0, 1.0);
  }
  float luceSole = exp(-occ * 1.2);
  // quanto si è in fondo a una valle: l'altezza sopra la base spianata
  float cavita = clamp((p.y - nuvolaBase(p.xz)) / 7.0, 0.0, 1.0);
  float avv = clamp((dot(n, uSun) + 0.55) / 1.55, 0.0, 1.0);
  float s = max(dot(rd, uSun), 0.0);
  float bordo = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
  vec3 col = vec3(1.95, 1.30, 0.70) * pow(avv, 1.5) * luceSole * (0.45 + 0.55 * cavita);
  col += vec3(0.13, 0.19, 0.40) * (0.3 + 0.7 * cavita) * (0.55 + 0.45 * n.y);
  col += vec3(1.6, 0.9, 0.45) * bordo * (0.25 + 1.6 * pow(s, 4.0)) * luceSole;   // bordo controsole
  col *= 0.78;
  float fo = 1.0 - exp(-t * 0.0016);
  col = mix(col, foschia(rd), fo);
  return vec4(col, 0.0);
}

vec3 aces(vec3 x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }

void main() {
  vec2 fc = gl_FragCoord.xy + uJit;
  vec2 uv = (2.0 * fc - uRes) / uRes.y;
  vec3 rd = normalize(uRot * vec3(uv * uFov, -1.0));
  vec3 ro = uCam;
  float dith = h1(fc + fract(uTime * 7.13) * 91.0 + uJit * 37.0);

  vec2 hit = traccia(ro, rd, 700.0);
  vec3 col;
  float tSol = 1e5;
  if (hit.x > 0.0) {
    tSol = hit.x;
    vec3 p = ro + rd * hit.x;
    vec3 n = normale(p, hit.x);
    col = illumina(p, rd, n, hit.y, hit.x);
    float f = 1.0 - exp(-hit.x * 0.0026);
    col = mix(col, foschia(rd), f);
  } else {
    col = cielo(rd);
  }
  vec4 nv = nuvole(ro, rd, tSol, dith);
  col = col * nv.w + nv.rgb;
  if (uDebug == 1) { fragColor = vec4(nv.rgb, 1.0); return; }
  if (uDebug == 2) { fragColor = vec4(vec3(nv.w), 1.0); return; }
  // bagliore del sole sopra tutto
  float s = max(dot(rd, uSun), 0.0);
  col += SOLE * 0.12 * pow(s, 3.0);

  col = aces(col * 0.85);
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.25);
  col = pow(col, vec3(1.0 / 2.2));
  // leggera curva e vignettatura da cartolina
  col = col * col * (3.0 - 2.0 * col) * 0.25 + col * 0.75;
  vec2 q = gl_FragCoord.xy / uRes;
  col *= 0.72 + 0.28 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.18);
  col += (dith - 0.5) / 255.0;
  fragColor = vec4(col, 1.0);
}
`;

export const VERT = /* glsl */`
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
