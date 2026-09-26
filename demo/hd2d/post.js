// Post-produzione HD-2D: tilt-shift a bokeh (dischi di luce sulle lanterne sfocate),
// bagliore caldo, grading caldo-freddo, vignettatura e un filo di grana.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// quanto è sfocata una riga dello schermo: nitida attorno al fuoco, sfocata in alto e in basso
const COC = `
uniform float uFuoco, uBanda, uRampa, uAlto, uBasso;
float coc(vec2 uv){
  float d = uv.y - uFuoco;
  float k = d > 0.0 ? uAlto : uBasso;
  return smoothstep(uBanda, uBanda + uRampa, abs(d)) * k;
}`;

class TiltShiftPass extends Pass {
  constructor(w, h) {
    super();
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.u = {
      tDiffuse: { value: null }, tSfoc: { value: null }, uRes: { value: new THREE.Vector2() },
      uFuoco: { value: 0.45 }, uBanda: { value: 0.19 }, uRampa: { value: 0.28 }, uAlto: { value: 0.9 }, uBasso: { value: 0.75 },
      uRaggio: { value: 14 },
    };
    // 1) sfocatura a disco (angolo aureo) a metà risoluzione; i punti luminosi pesano di più → bokeh
    this.sfoca = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.u, vertexShader: VS,
      fragmentShader: COC + `
        uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uRaggio; varying vec2 vUv;
        void main(){
          float c = coc(vUv);
          vec2 px = uRaggio * c / uRes;
          vec3 acc = vec3(0.0); float wsum = 0.0;
          const int N = 48;
          for (int i = 0; i < N; i++) {
            float fi = float(i) + 0.5;
            float r = sqrt(fi / float(N));
            float a = fi * 2.39996;
            vec2 o = vec2(cos(a), sin(a)) * r * px;
            vec3 s = texture2D(tDiffuse, vUv + o).rgb;
            float l = dot(s, vec3(0.3, 0.55, 0.15));
            float w = 1.0 + smoothstep(0.9, 3.5, l) * 2.5;      // i punti di luce si allargano in dischi
            acc += s * w; wsum += w;
          }
          gl_FragColor = vec4(acc / wsum, 1.0);
        }`,
    }));
    // 2) composizione: nitido nella fascia a fuoco, sfocato fuori
    this.componi = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.u, vertexShader: VS,
      fragmentShader: COC + `
        uniform sampler2D tDiffuse, tSfoc; varying vec2 vUv;
        void main(){
          float c = coc(vUv);
          vec3 a = texture2D(tDiffuse, vUv).rgb, b = texture2D(tSfoc, vUv).rgb;
          gl_FragColor = vec4(mix(a, b, smoothstep(0.05, 0.4, c)), 1.0);   // nella fascia centrale: pixel intatti
        }`,
    }));
    this.setSize(w, h);
  }
  setSize(w, h) { this.rt.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); this.u.uRes.value.set(w >> 1, h >> 1); }
  render(renderer, writeBuffer, readBuffer) {
    this.u.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.rt); this.sfoca.render(renderer);
    this.u.tSfoc.value = this.rt.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.componi.render(renderer);
  }
}
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const GRADING = {
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uT; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // caldo-freddo: le ombre scivolano verso il blu notte, le luci verso l'ambra
      vec3 freddo = vec3(0.62, 0.78, 1.18), caldo = vec3(1.18, 0.98, 0.78);
      c *= mix(freddo, caldo, smoothstep(0.02, 0.6, l));
      c = mix(vec3(l), c, 1.18);
      c = c * c / (c + 0.06) * 1.06;                         // neri più profondi, notte vera                               // un po' più di saturazione
      c += vec3(0.002, 0.004, 0.010);                          // velo di foschia notturna nei neri
      // vignettatura ovale, forte: il diorama si chiude ai bordi
      vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float v = smoothstep(1.05, 0.25, length(q * vec2(0.82, 1.05)));
      c *= mix(0.28, 1.0, v);
      c += (h(vUv * uRes + fract(uT) * 91.0) - 0.5) * 0.012;  // grana
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export function creaPost(renderer, scene, camera) {
  const w = innerWidth, h = innerHeight;
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  const comp = new EffectComposer(renderer, rt);
  comp.addPass(new RenderPass(scene, camera));
  const tilt = new TiltShiftPass(w, h); comp.addPass(tilt);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.4, 1.05); comp.addPass(bloom);
  const grade = new ShaderPass(GRADING); comp.addPass(grade);
  comp.addPass(new OutputPass());
  return {
    comp, tilt, bloom, grade,
    setSize(w, h) { comp.setSize(w, h); grade.uniforms.uRes.value.set(w, h); tilt.u.uRaggio.value = 8.5 * h / 1080; },
  };
}
