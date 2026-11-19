// AIM.DUELO 2.0 — PBR World Shader, Atmospheric Sky, Directional Shadows & Exterior Backdrop
(() => {
  'use strict';

  const MAT = { concrete: 0, wood: 1, metal: 2, floor: 3, brick: 4 };

  const SKY_MOODS = {
    azul:      { top: 0x2b6cb0, mid: 0x7cb5e8, hor: 0xdcebf7, sun: 0xfff5e0, fog: 0xc8dceb, sunDir: [0.55, 0.72, 0.42], light: 0xfff3df, hemiSky: 0x9ecbf5, hemiGnd: 0x4c545e },
    amarelo:   { top: 0x2c74b8, mid: 0x87bee8, hor: 0xf0e6d2, sun: 0xffe8bd, fog: 0xe6dcc8, sunDir: [0.62, 0.65, 0.44], light: 0xffeccf, hemiSky: 0xaad0f5, hemiGnd: 0x6b5d4b },
    verde:     { top: 0x295f8a, mid: 0x76a8c9, hor: 0xd3e2e6, sun: 0xfff0d4, fog: 0xc4d4da, sunDir: [-0.52, 0.74, 0.42], light: 0xfff1dc, hemiSky: 0x94bfd8, hemiGnd: 0x465249 },
    roxo:      { top: 0x284b7a, mid: 0x6f8fb8, hor: 0xcad6e3, sun: 0xffebd6, fog: 0xbcc8d8, sunDir: [0.48, 0.76, -0.44], light: 0xffe8d2, hemiSky: 0x8eaad0, hemiGnd: 0x434857 },
    laranja:   { top: 0x385e8c, mid: 0x8ca8c4, hor: 0xebd7c3, sun: 0xffdfad, fog: 0xdecbb8, sunDir: [0.64, 0.58, 0.50], light: 0xffe1b8, hemiSky: 0xa0bcdb, hemiGnd: 0x5c4f44 },
    industria: { top: 0x35587a, mid: 0x7e9bb3, hor: 0xc8d4db, sun: 0xfff2dc, fog: 0xbcc8d0, sunDir: [0.50, 0.75, 0.43], light: 0xfff0da, hemiSky: 0x9ab5cc, hemiGnd: 0x4a4f52 },
    terracota: { top: 0x1c64c8, mid: 0x6aaef0, hor: 0xd9ecfb, sun: 0xffe2a8, fog: 0xd7e6f2, sunDir: [0.58, 0.70, 0.42], light: 0xffe4b5, hemiSky: 0x8fc3f5, hemiGnd: 0x8a6a4a },
    praga:     { top: 0x1f61c2, mid: 0x6dabea, hor: 0xd8eaf8, sun: 0xffe8bf, fog: 0xd3e3ef, sunDir: [0.52, 0.72, 0.46], light: 0xffeac8, hemiSky: 0x8fc0f0, hemiGnd: 0x76664f },
    elysion:   { top: 0x1a5fc9, mid: 0x68aaf0, hor: 0xd8eafa, sun: 0xfff0d2, fog: 0xd1e3f2, sunDir: [0.45, 0.80, 0.38], light: 0xfff0d8, hemiSky: 0x92c6f7, hemiGnd: 0x6a6660 },
    areia:     { top: 0x2e72b5, mid: 0x8bc0e8, hor: 0xf4e8d1, sun: 0xffe8ba, fog: 0xe8dcc6, sunDir: [0.60, 0.64, 0.48], light: 0xffebd0, hemiSky: 0xadd4f5, hemiGnd: 0x6e5e49 },
  };

  function createWorldMaterial(THREE, mats, opts = {}) {
    const tex = mats.worldPacked;
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.04,
      envMapIntensity: 0.55,
      side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
      depthWrite: opts.depthWrite ?? true,
    });

    const uniforms = mat.userData.v2Uniforms = {
      uTexConcrete: { value: tex.concrete },
      uTexWood:     { value: tex.wood },
      uTexMetal:    { value: tex.metal },
      uTexFloor:    { value: tex.floor },
      uTexBrick:    { value: tex.brick },
      uDetail:      { value: opts.detail ?? 1.0 },
      uLinearize:   { value: opts.linearize ?? 1.0 },
    };

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
attribute float aMat;
attribute float aAO;
varying float vMat;
varying float vAO;
varying vec3 vWPos;
varying vec3 vWNorm;`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vMat = aMat;
vAO = aAO;
vec4 v2wp = modelMatrix * vec4(transformed, 1.0);
vWPos = v2wp.xyz;
vWNorm = normalize(mat3(modelMatrix) * objectNormal);`);

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D uTexConcrete;
uniform sampler2D uTexWood;
uniform sampler2D uTexMetal;
uniform sampler2D uTexFloor;
uniform sampler2D uTexBrick;
uniform float uDetail;
uniform float uLinearize;
varying float vMat;
varying float vAO;
varying vec3 vWPos;
varying vec3 vWNorm;

vec4 sampleWorldMat(int id, vec2 uv) {
  if (id == 1) return texture2D(uTexWood, uv * 0.75);
  if (id == 2) return texture2D(uTexMetal, uv * 0.55);
  if (id == 3) return texture2D(uTexFloor, uv * 0.42);
  if (id == 4) return texture2D(uTexBrick, uv * 0.48);
  return texture2D(uTexConcrete, uv * 0.42);
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
#ifdef USE_COLOR
  if (uLinearize > 0.5) diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(2.2));
#endif
int v2mId = int(vMat + 0.5);
vec3 v2an = abs(vWNorm);
vec2 v2uv = v2an.y > 0.55 ? vWPos.xz : (v2an.x > 0.55 ? vWPos.zy : vWPos.xy);
vec4 v2tex = sampleWorldMat(v2mId, v2uv);
float v2distFade = clamp(1.0 - (length(vWPos - cameraPosition) - 18.0) / 55.0, 0.25, 1.0);
float v2detailAmt = uDetail * v2distFade;
diffuseColor.rgb *= mix(1.0, v2tex.r * 1.08, v2detailAmt);
float v2groundAO = v2an.y < 0.5 ? (0.80 + 0.20 * smoothstep(0.0, 0.75, max(0.0, vWPos.y))) : 1.0;
diffuseColor.rgb *= clamp(vAO * v2groundAO, 0.48, 1.0);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, clamp(v2tex.g, 0.22, 0.96), uDetail);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
if (v2mId == 2) metalnessFactor = mix(metalnessFactor, 0.52, uDetail);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (uDetail > 0.5) {
  vec2 v2tn = (v2tex.ba * 2.0 - 1.0) * (0.48 * v2distFade);
  vec3 v2n = normalize(vWNorm);
  vec3 v2up = abs(v2n.y) > 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 v2t = normalize(cross(v2up, v2n));
  vec3 v2b = cross(v2n, v2t);
  vec3 v2worldPerturbed = normalize(v2n + v2t * v2tn.x + v2b * v2tn.y);
  normal = normalize(mix(normal, normalize((viewMatrix * vec4(v2worldPerturbed, 0.0)).xyz), 0.75));
}`);
    };
    mat.customProgramCacheKey = () => 'v2-world-pbr';
    return mat;
  }

  // Upgrade existing Source/Wingman shader material with soft atmospheric lighting, subtle micro-AO & horizon fog
  function createSkyMesh(THREE) {
    const geo = new THREE.SphereGeometry(220, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x2b6cb0) },
        uMid: { value: new THREE.Color(0x7cb5e8) },
        uHor: { value: new THREE.Color(0xdcebf7) },
        uSunCol: { value: new THREE.Color(0xfff5e0) },
        uSunDir: { value: new THREE.Vector3(0.55, 0.72, 0.42).normalize() },
      },
      vertexShader: `varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: `uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHor;
uniform vec3 uSunCol;
uniform vec3 uSunDir;
varying vec3 vDir;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){return 0.55*noise(p)+0.3*noise(p*2.1)+0.15*noise(p*4.3);}
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 sky = mix(uHor, uMid, smoothstep(0.0, 0.28, h));
  sky = mix(sky, uTop, smoothstep(0.22, 0.88, h));
  // Subtle high-altitude cirrus clouds
  if (d.y > 0.04) {
    vec2 cuv = d.xz / (d.y + 0.18) * 1.4;
    float cl = smoothstep(0.50, 0.82, fbm(cuv + vec2(1.7, -0.8)));
    float fade = smoothstep(0.04, 0.25, d.y) * (1.0 - smoothstep(0.65, 0.98, d.y));
    sky = mix(sky, mix(uHor, vec3(1.0), 0.72), cl * fade * 0.28);
  }
  float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
  sky += uSunCol * (pow(sunDot, 12.0) * 0.22 + pow(sunDot, 160.0) * 0.75);
  float disc = smoothstep(0.99935, 0.99975, sunDot);
  sky = mix(sky, uSunCol * 1.2, disc);
  // Subtle dark lower hemisphere below horizon
  if (d.y < 0.0) sky = mix(uHor, uHor * 0.55, clamp(-d.y * 4.0, 0.0, 1.0));
  gl_FragColor = vec4(sky, 1.0);
}`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -2;
    mesh.frustumCulled = false;
    return mesh;
  }

  function setupLights(THREE, scene) {
    const hemi = new THREE.HemisphereLight(0x9ecbf5, 0x4c545e, 0.72);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff3df, 1.15);
    sun.position.set(28, 42, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 130;
    const d = 34;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    scene.add(sun.target);

    const fill = new THREE.DirectionalLight(0x9cc4e8, 0.32);
    fill.position.set(-22, 18, -26);
    scene.add(fill);

    // Subtle dynamic muzzle flash point light in world space
    const muzzleLight = new THREE.PointLight(0xffb85c, 0, 7.5, 2);
    muzzleLight.visible = false;
    scene.add(muzzleLight);

    return { hemi, sun, fill, muzzleLight };
  }

  function applyMood(THREE, lights, skyMesh, scene, themeName, ax = 24, az = 26) {
    const mood = SKY_MOODS[themeName] || SKY_MOODS.azul;
    if (skyMesh && skyMesh.material && skyMesh.material.uniforms) {
      const u = skyMesh.material.uniforms;
      u.uTop.value.setHex(mood.top);
      u.uMid.value.setHex(mood.mid);
      u.uHor.value.setHex(mood.hor);
      u.uSunCol.value.setHex(mood.sun);
      u.uSunDir.value.set(...mood.sunDir).normalize();
    }
    if (scene && scene.fog) {
      scene.fog.color.setHex(mood.fog);
    }
    if (lights) {
      // Dia ensolarado: sol forte e quente, céu azul mais intenso preenchendo as sombras.
      lights.sun.intensity = mood.sunI ?? 2.15;
      lights.hemi.intensity = mood.hemiI ?? 0.82;
      if (lights.fill) lights.fill.intensity = 0.22;
      lights.hemi.color.setHex(mood.hemiSky);
      lights.hemi.groundColor.setHex(mood.hemiGnd);
      lights.sun.color.setHex(mood.light);
      lights.sun.position.set(mood.sunDir[0] * 55, mood.sunDir[1] * 55, mood.sunDir[2] * 55);
      const span = Math.max(ax, az) + 10;
      lights.sun.shadow.camera.left = -span;
      lights.sun.shadow.camera.right = span;
      lights.sun.shadow.camera.top = span;
      lights.sun.shadow.camera.bottom = -span;
      lights.sun.shadow.camera.updateProjectionMatrix();
    }
    return mood;
  }

  // Builds exterior architectural skyline outside the playable arena so walls frame a real world
  function buildExterior(THREE, themeName, ax, az, addBoxFn, geoFromFn, worldMat) {
    const out = { p: [], n: [], c: [], m: [], ao: [] };
    const pushBox = (a, b, hex, matId = MAT.concrete, aoTop = 1, aoBot = 0.72) => {
      addBoxFn(out, a, b, hex, false, true, matId, aoTop, aoBot);
    };

    const isWarm = themeName === 'amarelo' || themeName === 'terracota' || themeName === 'areia' || themeName === 'praga';
    const isInd = themeName === 'azul' || themeName === 'industria' || themeName === 'laranja' || themeName === 'verde' || themeName === 'roxo';

    // Outer ground apron extending to horizon
    pushBox([-160, -0.15, -160], [160, -0.02, -az - 1], isWarm ? 0xb5a48a : 0x50565d, MAT.floor, 0.9, 0.9);
    pushBox([-160, -0.15, az + 1], [160, -0.02, 160], isWarm ? 0xb5a48a : 0x50565d, MAT.floor, 0.9, 0.9);
    pushBox([-160, -0.15, -az - 1], [-ax - 1, -0.02, az + 1], isWarm ? 0xb5a48a : 0x50565d, MAT.floor, 0.9, 0.9);
    pushBox([ax + 1, -0.15, -az - 1], [160, -0.02, az + 1], isWarm ? 0xb5a48a : 0x50565d, MAT.floor, 0.9, 0.9);

    // Deterministic pseudo-random skyline silhouettes outside walls
    let seed = 1337 + ax * 13 + az * 7;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

    const pal = isWarm
      ? [0xd9c39e, 0xc7a87f, 0xb87654, 0xc4b59b, 0x9b8970]
      : [0x58626e, 0x454e59, 0x6b747e, 0x384049, 0x777f85];

    const ringSpecs = [
      // North & South blocks
      ...Array.from({ length: 14 }, (_, i) => {
        const x = -70 + i * 11 + (rnd() - 0.5) * 3;
        return [x, -az - 14 - rnd() * 22, 6 + rnd() * 6, 6 + rnd() * 7, 9 + rnd() * 18];
      }),
      ...Array.from({ length: 14 }, (_, i) => {
        const x = -70 + i * 11 + (rnd() - 0.5) * 3;
        return [x, az + 14 + rnd() * 22, 6 + rnd() * 6, 6 + rnd() * 7, 9 + rnd() * 18];
      }),
      // West & East blocks
      ...Array.from({ length: 12 }, (_, i) => {
        const z = -60 + i * 11 + (rnd() - 0.5) * 3;
        return [-ax - 14 - rnd() * 22, z, 6 + rnd() * 7, 6 + rnd() * 6, 9 + rnd() * 17];
      }),
      ...Array.from({ length: 12 }, (_, i) => {
        const z = -60 + i * 11 + (rnd() - 0.5) * 3;
        return [ax + 14 + rnd() * 22, z, 6 + rnd() * 7, 6 + rnd() * 6, 9 + rnd() * 17];
      }),
    ];

    for (const [cx, cz, w, d, h] of ringSpecs) {
      const col = pal[Math.floor(rnd() * pal.length)];
      const mat = isWarm ? (rnd() < 0.45 ? MAT.brick : MAT.concrete) : (rnd() < 0.35 ? MAT.metal : MAT.concrete);
      pushBox([cx - w / 2, -0.02, cz - d / 2], [cx + w / 2, h, cz + d / 2], col, mat, 1.0, 0.7);
      // Roof parapet / mechanical penthouse
      if (h > 12) {
        pushBox([cx - w * 0.28, h, cz - d * 0.28], [cx + w * 0.28, h + 1.8, cz + d * 0.28], 0x3b4248, MAT.metal, 1.0, 0.85);
      }
    }

    if (isInd) {
      // Industrial gantry cranes & smokestacks in the distance
      for (const [cx, cz, h] of [[-ax - 18, -18, 26], [ax + 18, 16, 28]]) {
        pushBox([cx - 0.9, 0, cz - 0.9], [cx + 0.9, h, cz + 0.9], 0xc9523b, MAT.metal, 1.0, 0.8);
        pushBox([cx - 10, h - 1.2, cz - 0.6], [cx + 10, h, cz + 0.6], 0xd99b26, MAT.metal, 1.0, 0.9);
      }
    } else {
      // Cypress silhouettes outside warm plaza walls
      for (const [tx, tz] of [[-ax - 6, -12], [-ax - 7, 10], [ax + 6, -8], [ax + 7, 14], [-10, -az - 7], [12, az + 7]]) {
        pushBox([tx - 0.25, 0, tz - 0.25], [tx + 0.25, 2.5, tz + 0.25], 0x5c432c, MAT.wood, 0.9, 0.7);
        pushBox([tx - 1.1, 2.3, tz - 1.1], [tx + 1.1, 6.8, tz + 1.1], 0x395c34, MAT.brick, 1.0, 0.75);
        pushBox([tx - 0.7, 6.8, tz - 0.7], [tx + 0.7, 9.2, tz + 0.7], 0x456b3e, MAT.brick, 1.0, 0.85);
      }
    }

    const geo = geoFromFn(out);
    const mesh = new THREE.Mesh(geo, worldMat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
  }

  globalThis.V2World = { MAT, SKY_MOODS, createWorldMaterial, createSkyMesh, setupLights, applyMood, buildExterior };
})();
