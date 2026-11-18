// AIM.DUELO 2.0 — Procedural PBR Textures, Normal/Roughness Maps, Environment & Graphics Presets
(() => {
  'use strict';

  const PRESETS = {
    low:    { label: 'Baixo',  scale: 0.75, shadows: 'off',    textures: 'low',    particles: 'low',    fx: 'low',    anisotropy: 1 },
    medium: { label: 'Médio',  scale: 0.90, shadows: 'low',    textures: 'medium', particles: 'medium', fx: 'medium', anisotropy: 2 },
    high:   { label: 'Alto',   scale: 1.00, shadows: 'medium', textures: 'high',   particles: 'high',   fx: 'high',   anisotropy: 4 },
    ultra:  { label: 'Ultra',  scale: 1.00, shadows: 'high',   textures: 'high',   particles: 'high',   fx: 'high',   anisotropy: 8 },
  };

  // Fast deterministic hash & tileable value noise (wraps seamlessly on [0, period)).
  function hash2(x, y, seed) {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function tileNoise(u, v, period, seed) {
    const x = u * period, y = v * period;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const ix0 = ((x0 % period) + period) % period, ix1 = (ix0 + 1) % period;
    const iy0 = ((y0 % period) + period) % period, iy1 = (iy0 + 1) % period;
    const a = hash2(ix0, iy0, seed), b = hash2(ix1, iy0, seed);
    const c = hash2(ix0, iy1, seed), d = hash2(ix1, iy1, seed);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function tileFbm(u, v, basePeriod, octaves, seed) {
    let sum = 0, amp = 0.5, norm = 0, p = basePeriod;
    for (let i = 0; i < octaves; i++) {
      sum += amp * tileNoise(u, v, p, seed + i * 31);
      norm += amp; amp *= 0.5; p *= 2;
    }
    return sum / norm;
  }

  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // Generates a packed 256x256 seamless DataTexture:
  // R = detail albedo multiplier (0.5..1.0 centered ~0.92), G = roughness (0..1), B = normal.x (0..1), A = normal.y (0..1)
  function buildPackedPBR(THREE, size, fn, strength = 1.6, anisotropy = 4) {
    const hMap = new Float32Array(size * size);
    const alb = new Float32Array(size * size);
    const rgh = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const res = fn(u, v);
        const idx = y * size + x;
        alb[idx] = clamp01(res.albedo);
        rgh[idx] = clamp01(res.roughness);
        hMap[idx] = res.height;
      }
    }
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const ym = (y - 1 + size) % size, yp = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size, xp = (x + 1) % size;
        const idx = y * size + x;
        const dx = (hMap[y * size + xp] - hMap[y * size + xm]) * strength;
        const dy = (hMap[yp * size + x] - hMap[ym * size + x]) * strength;
        const len = Math.hypot(-dx, -dy, 1.0);
        const nx = (-dx / len) * 0.5 + 0.5;
        const ny = (-dy / len) * 0.5 + 0.5;
        const o = idx * 4;
        data[o]     = Math.round(alb[idx] * 255);
        data[o + 1] = Math.round(rgh[idx] * 255);
        data[o + 2] = Math.round(clamp01(nx) * 255);
        data[o + 3] = Math.round(clamp01(ny) * 255);
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = anisotropy;
    tex.needsUpdate = true;
    return tex;
  }

  // Standard separate maps (albedo/roughness/normal) for MeshStandardMaterial (weapons, props, characters)
  function buildStandardMaps(THREE, size, fn, strength = 1.4, anisotropy = 4) {
    const hMap = new Float32Array(size * size);
    const colData = new Uint8Array(size * size * 4);
    const rghData = new Uint8Array(size * size * 4);
    const nrmData = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const res = fn(u, v);
        const idx = y * size + x, o = idx * 4;
        hMap[idx] = res.height;
        const c = Math.round(clamp01(res.albedo) * 255);
        colData[o] = colData[o + 1] = colData[o + 2] = c; colData[o + 3] = 255;
        const r = Math.round(clamp01(res.roughness) * 255);
        rghData[o] = rghData[o + 1] = rghData[o + 2] = r; rghData[o + 3] = 255;
      }
    }
    for (let y = 0; y < size; y++) {
      const ym = (y - 1 + size) % size, yp = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size, xp = (x + 1) % size;
        const idx = y * size + x, o = idx * 4;
        const dx = (hMap[y * size + xp] - hMap[y * size + xm]) * strength;
        const dy = (hMap[yp * size + x] - hMap[ym * size + x]) * strength;
        const len = Math.hypot(-dx, -dy, 1.0);
        nrmData[o]     = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
        nrmData[o + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
        nrmData[o + 2] = Math.round(((1.0 / len) * 0.5 + 0.5) * 255);
        nrmData[o + 3] = 255;
      }
    }
    const makeTex = (buf) => {
      const t = new THREE.DataTexture(buf, size, size, THREE.RGBAFormat);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = anisotropy;
      t.needsUpdate = true;
      return t;
    };
    return { map: makeTex(colData), roughnessMap: makeTex(rghData), normalMap: makeTex(nrmData) };
  }

  // Procedural material definitions
  const MAT_FNS = {
    // 0: Architectural Concrete (slabs, subtle form-tie holes, hairline wear)
    concrete(u, v) {
      const base = tileFbm(u, v, 4, 4, 11);
      const grit = tileFbm(u, v, 16, 2, 23);
      const sx = Math.abs(Math.sin(u * Math.PI * 2));
      const sy = Math.abs(Math.sin(v * Math.PI * 2));
      const seam = smooth(0.0, 0.035, Math.min(sx, sy));
      const tie = Math.hypot(((u * 2) % 1) - 0.5, ((v * 2) % 1) - 0.5) < 0.04 ? 0.72 : 1.0;
      const h = (base * 0.55 + grit * 0.35) * (0.65 + 0.35 * seam) * tie;
      return {
        albedo: (0.82 + base * 0.16 + grit * 0.06) * (0.86 + 0.14 * seam) * (tie < 1 ? 0.8 : 1),
        roughness: clamp01(0.78 + (1 - base) * 0.18 + (1 - seam) * 0.1),
        height: h,
      };
    },
    // 1: Tactical Wood Crate (planks, wood grain, plank seams, corner wear)
    wood(u, v) {
      const plankIdx = Math.floor(v * 4);
      const pv = (v * 4) % 1;
      const pu = (u + plankIdx * 0.37) % 1;
      const seamY = smooth(0.0, 0.055, Math.min(pv, 1 - pv));
      const seamX = smooth(0.0, 0.03, Math.min(pu, 1 - pu));
      const seam = Math.min(seamX, seamY);
      const grain = tileNoise(u * 2, v * 28, 8, 41 + plankIdx * 7);
      const fine = tileFbm(u, v, 12, 3, 59);
      const vary = 0.90 + hash2(plankIdx, 3, 99) * 0.15;
      const h = (grain * 0.45 + fine * 0.25) * (0.45 + 0.55 * seam);
      return {
        albedo: vary * (0.82 + grain * 0.16 + fine * 0.08) * (0.72 + 0.28 * seam),
        roughness: clamp01(0.62 + (1 - grain) * 0.22 + (1 - seam) * 0.15),
        height: h,
      };
    },
    // 2: Industrial Corrugated / Brushed Metal (shipping containers, steel beams)
    metal(u, v) {
      const rib = 0.5 + 0.5 * Math.cos(u * Math.PI * 16);
      const ribSharp = Math.pow(rib, 0.65);
      const brush = tileNoise(u * 4, v * 32, 8, 71);
      const wear = tileFbm(u, v, 6, 3, 83);
      const panel = smooth(0.0, 0.025, Math.min(v, 1 - v));
      const h = ribSharp * 0.65 + brush * 0.12 + wear * 0.12 + panel * 0.11;
      return {
        albedo: (0.78 + ribSharp * 0.20 + brush * 0.06) * (0.86 + 0.14 * panel),
        roughness: clamp01(0.32 + wear * 0.26 + (1 - ribSharp) * 0.12),
        height: h,
      };
    },
    // 3: Competitive Tactical Floor Tile (clean readability + subtle stone/terrazzo joints)
    floor(u, v) {
      const tx = (u * 2) % 1, ty = (v * 2) % 1;
      const sx = smooth(0.0, 0.028, Math.min(tx, 1 - tx));
      const sy = smooth(0.0, 0.028, Math.min(ty, 1 - ty));
      const seam = Math.min(sx, sy);
      const stone = tileFbm(u, v, 4, 3, 107);
      const speck = tileNoise(u, v, 32, 113);
      const tileTint = 0.94 + hash2(Math.floor(u * 2), Math.floor(v * 2), 127) * 0.08;
      const h = (stone * 0.4 + speck * 0.15) * (0.55 + 0.45 * seam);
      return {
        albedo: tileTint * (0.90 + stone * 0.08) * (0.84 + 0.16 * seam),
        roughness: clamp01(0.68 + stone * 0.18 + (1 - seam) * 0.15),
        height: h,
      };
    },
    // 4: Weathered Masonry / Brick & Stone Block
    brick(u, v) {
      const row = Math.floor(v * 6);
      const bu = (u * 3 + (row % 2) * 0.5) % 1;
      const bv = (v * 6) % 1;
      const mx = smooth(0.02, 0.08, Math.min(bu, 1 - bu));
      const my = smooth(0.04, 0.12, Math.min(bv, 1 - bv));
      const brickMask = mx * my;
      const rough = tileFbm(u, v, 8, 3, 139);
      const tint = 0.86 + hash2(Math.floor(u * 3 + (row % 2) * 0.5), row, 149) * 0.2;
      const h = brickMask * (0.55 + rough * 0.35);
      return {
        albedo: brickMask * tint * (0.86 + rough * 0.14) + (1 - brickMask) * 0.68,
        roughness: clamp01(0.84 - brickMask * 0.08 + (1 - rough) * 0.1),
        height: h,
      };
    },
    // 5: Gunmetal / Stippled Polymer / Tactical Fabric (for weapons & operators)
    tacticalMetal(u, v) {
      const brush = tileNoise(u * 16, v * 2, 16, 173);
      const micro = tileFbm(u, v, 16, 2, 181);
      return {
        albedo: 0.86 + brush * 0.1 + micro * 0.06,
        roughness: clamp01(0.28 + micro * 0.22),
        height: brush * 0.4 + micro * 0.6,
      };
    },
    tacticalFabric(u, v) {
      const weaveX = 0.5 + 0.5 * Math.sin(u * Math.PI * 64);
      const weaveY = 0.5 + 0.5 * Math.sin(v * Math.PI * 64);
      const weave = (weaveX + weaveY) * 0.5;
      const fold = tileFbm(u, v, 4, 3, 193);
      return {
        albedo: 0.84 + weave * 0.12 + fold * 0.08,
        roughness: clamp01(0.76 + (1 - weave) * 0.16),
        height: weave * 0.55 + fold * 0.45,
      };
    },
  };

  let cached = null;

  function init(THREE, renderer) {
    if (cached || !THREE || !THREE.DataTexture) return cached;
    const maxAniso = renderer && renderer.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1) : 4;
    const texSize = 256;

    const worldPacked = {
      concrete: buildPackedPBR(THREE, texSize, MAT_FNS.concrete, 2.0, maxAniso),
      wood:     buildPackedPBR(THREE, texSize, MAT_FNS.wood,     2.4, maxAniso),
      metal:    buildPackedPBR(THREE, texSize, MAT_FNS.metal,    2.2, maxAniso),
      floor:    buildPackedPBR(THREE, texSize, MAT_FNS.floor,    1.5, maxAniso),
      brick:    buildPackedPBR(THREE, texSize, MAT_FNS.brick,    2.6, maxAniso),
    };

    const gunMaps = buildStandardMaps(THREE, 128, MAT_FNS.tacticalMetal, 1.1, maxAniso);
    const fabricMaps = buildStandardMaps(THREE, 128, MAT_FNS.tacticalFabric, 1.3, maxAniso);

    // Procedural Sky + Horizon Environment Map via DataTexture CubeTexture or PMREM
    let envMap = null;
    if (renderer && THREE.PMREMGenerator && THREE.WebGLRenderTarget) {
      try {
        const envScene = new THREE.Scene();
        const skyGeo = new THREE.SphereGeometry(20, 24, 14);
        const pos = skyGeo.attributes.position;
        const cols = new Float32Array(pos.count * 3);
        const top = new THREE.Color(0x3a7ec4);
        const hor = new THREE.Color(0xd7e7f5);
        const gnd = new THREE.Color(0x3b4046);
        const sunDir = new THREE.Vector3(0.5, 0.85, 0.35).normalize();
        const sunCol = new THREE.Color(0xfff1d6);
        const tmp = new THREE.Color(), v3 = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v3.fromBufferAttribute(pos, i).normalize();
          if (v3.y >= 0) {
            tmp.copy(hor).lerp(top, Math.pow(v3.y, 0.55));
            const s = Math.max(0, v3.dot(sunDir));
            tmp.lerp(sunCol, Math.pow(s, 18) * 0.85);
          } else {
            tmp.copy(hor).lerp(gnd, Math.pow(-v3.y, 0.45));
          }
          cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
        }
        skyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const rt = pmrem.fromScene(envScene, 0.04);
        envMap = rt.texture;
        skyGeo.dispose();
        pmrem.dispose();
      } catch (e) {
        envMap = null;
      }
    }

    // Decal texture: crisp bullet hole crater with dark core and radial cracks
    let decalTex = null;
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 28);
        g.addColorStop(0, 'rgba(10,10,12,0.96)');
        g.addColorStop(0.28, 'rgba(20,20,24,0.88)');
        g.addColorStop(0.55, 'rgba(42,40,38,0.42)');
        g.addColorStop(1, 'rgba(42,40,38,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = 'rgba(16,16,18,0.65)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.3;
          ctx.beginPath();
          ctx.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6);
          ctx.lineTo(32 + Math.cos(a + 0.1) * 20, 32 + Math.sin(a + 0.1) * 20);
          ctx.stroke();
        }
        decalTex = new THREE.CanvasTexture(c);
      }
    }

    cached = { worldPacked, gunMaps, fabricMaps, envMap, decalTex, maxAniso };
    return cached;
  }

  function setAnisotropy(aniso) {
    if (!cached) return;
    const a = Math.min(cached.maxAniso || 4, Math.max(1, aniso));
    for (const tex of Object.values(cached.worldPacked)) { tex.anisotropy = a; tex.needsUpdate = true; }
    for (const set of [cached.gunMaps, cached.fabricMaps]) {
      for (const tex of Object.values(set)) { tex.anisotropy = a; tex.needsUpdate = true; }
    }
  }

  globalThis.V2Materials = { PRESETS, init, setAnisotropy, get: () => cached };
})();
