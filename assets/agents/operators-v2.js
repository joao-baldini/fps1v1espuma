// AIM.DUELO 2.0 — Articulated Humanoid Tactical Operators (High-Detail Procedural Geometry)
(() => {
  'use strict';

  const V3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  const TEAM_STYLES = {
    coalition: {
      name: 'Coalition',
      cloth: 0x2c3b4a, cloth2: 0x22303d, pants: 0x26313b, vest: 0x1d252e,
      gear: 0x161b22, boot: 0x181c20, skin: 0xd4a682, accent: 0x38bdf8,
      helmet: 0x26323d, visor: 0x1b242c, mask: 0x1d242b,
    },
    syndicate: {
      name: 'Syndicate',
      cloth: 0x4b4437, cloth2: 0x3a342a, pants: 0x35332d, vest: 0x2d2823,
      gear: 0x1b1917, boot: 0x191816, skin: 0xc99672, accent: 0xf97316,
      helmet: 0x3b352c, visor: 0x2a1d19, mask: 0x292420,
    },
  };

  const OP_STYLES = {
    finder: {
      cloth: 0x284e5c, cloth2: 0x1f3d49, pants: 0x23333d, vest: 0x1a2832,
      gear: 0x141e24, boot: 0x161c20, skin: 0xd8ad88, hair: 0x222b30,
      accent: 0x38e8e0, helmet: 0x1f313b, visor: 0x1a424d,
    },
    doctor: {
      cloth: 0xd2d6ca, cloth2: 0xb7bdb0, pants: 0x2f453f, vest: 0x5c8069,
      gear: 0x24332d, boot: 0x1a201e, skin: 0xb5805d, hair: 0x2f2a27,
      accent: 0x52d68a, helmet: 0x395246, visor: 0x223029,
    },
    ghost: {
      cloth: 0x363848, cloth2: 0x292b38, pants: 0x242836, vest: 0x1f222d,
      gear: 0x161820, boot: 0x15171c, skin: 0xd5b9a0, hair: 0x222630,
      accent: 0xa78bfa, helmet: 0x262936, visor: 0x1a1c24,
    },
    brutus: {
      cloth: 0x585542, cloth2: 0x454334, pants: 0x323732, vest: 0x2f3638,
      gear: 0x1e2224, boot: 0x171a1c, skin: 0xb88560, hair: 0x3d3026,
      accent: 0xeab308, helmet: 0x343a3c, visor: 0x222628,
    },
    detector: {
      cloth: 0x8d553d, cloth2: 0x6e422f, pants: 0x35403f, vest: 0x2b3a3c,
      gear: 0x1c2425, boot: 0x191d1e, skin: 0xdfb18a, hair: 0x44332b,
      accent: 0xf59e0b, helmet: 0x384546, visor: 0x60a5fa,
    },
  };

  function pushTri(out, a, b, c, r, g, bl, flatNormal = null) {
    let n = flatNormal;
    if (!n) {
      n = norm(cross(sub(b, a), sub(c, a)));
    }
    out.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    out.n.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
    out.c.push(r, g, bl, r, g, bl, r, g, bl);
  }

  function hexRGB(hex) {
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }

  // Smooth lofted tube/limb between arbitrary cross-section rings
  // rings: array of { pos:[x,y,z], rx, rz, dir?:[x,y,z] }
  function addLoft(out, rings, segs, hex, capStart = true, capEnd = true, smooth = true) {
    const [r, g, bl] = hexRGB(hex);
    const ringPts = [];
    const ringNorms = [];
    for (let ri = 0; ri < rings.length; ri++) {
      const cur = rings[ri];
      const prev = rings[Math.max(0, ri - 1)].pos;
      const next = rings[Math.min(rings.length - 1, ri + 1)].pos;
      let tangent = cur.dir || sub(next, prev);
      if (Math.hypot(...tangent) < 1e-6) tangent = [0, 1, 0];
      tangent = norm(tangent);
      const ref = Math.abs(tangent[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
      const right = norm(cross(tangent, ref));
      const fwd = norm(cross(right, tangent));
      const pts = [], nms = [];
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const ox = ca * cur.rx, oz = sa * cur.rz;
        pts.push([
          cur.pos[0] + right[0] * ox + fwd[0] * oz,
          cur.pos[1] + right[1] * ox + fwd[1] * oz,
          cur.pos[2] + right[2] * ox + fwd[2] * oz,
        ]);
        nms.push(norm([
          right[0] * (ca / Math.max(0.01, cur.rx)) + fwd[0] * (sa / Math.max(0.01, cur.rz)),
          right[1] * (ca / Math.max(0.01, cur.rx)) + fwd[1] * (sa / Math.max(0.01, cur.rz)),
          right[2] * (ca / Math.max(0.01, cur.rx)) + fwd[2] * (sa / Math.max(0.01, cur.rz)),
        ]));
      }
      ringPts.push(pts);
      ringNorms.push(nms);
    }

    for (let ri = 0; ri < rings.length - 1; ri++) {
      const pA = ringPts[ri], pB = ringPts[ri + 1];
      const nA = ringNorms[ri], nB = ringNorms[ri + 1];
      for (let s = 0; s < segs; s++) {
        const sn = (s + 1) % segs;
        const a = pA[s], b = pA[sn], c = pB[sn], d = pB[s];
        if (smooth) {
          out.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
          out.n.push(...nA[s], ...nA[sn], ...nB[sn]);
          out.c.push(r, g, bl, r, g, bl, r, g, bl);
          out.p.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
          out.n.push(...nA[s], ...nB[sn], ...nB[s]);
          out.c.push(r, g, bl, r, g, bl, r, g, bl);
        } else {
          pushTri(out, a, b, c, r, g, bl);
          pushTri(out, a, c, d, r, g, bl);
        }
      }
    }

    if (capStart) {
      const c0 = rings[0].pos, p0 = ringPts[0];
      for (let s = 0; s < segs; s++) {
        pushTri(out, c0, p0[(s + 1) % segs], p0[s], r, g, bl);
      }
    }
    if (capEnd) {
      const c1 = rings[rings.length - 1].pos, p1 = ringPts[rings.length - 1];
      for (let s = 0; s < segs; s++) {
        pushTri(out, c1, p1[s], p1[(s + 1) % segs], r, g, bl);
      }
    }
  }

  // Chamfered box helper for crisp tactical armor plates, pouches, and accessories
  function addBevelBox(out, cx, cy, cz, w, h, d, hex, cut = 0.015) {
    const [r, g, bl] = hexRGB(hex);
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const c = Math.min(cut, hw * 0.35, hd * 0.35);
    const ring = [
      [-hw + c, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c],
      [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c],
    ];
    const bot = ring.map(([x, z]) => [cx + x, cy - hh, cz + z]);
    const top = ring.map(([x, z]) => [cx + x, cy + hh, cz + z]);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      pushTri(out, bot[i], top[j], bot[j], r, g, bl);
      pushTri(out, bot[i], top[i], top[j], r, g, bl);
    }
    for (let i = 1; i < 7; i++) {
      pushTri(out, bot[0], bot[i], bot[i + 1], r, g, bl);
      pushTri(out, top[0], top[i + 1], top[i], r, g, bl);
    }
  }

  // Ellipsoid helper for sculpted cranium, shoulders, kneepads, helmet dome
  function addEllipsoid(out, cx, cy, cz, rx, ry, rz, segsW, segsH, hex, hemiY = false) {
    const [r, g, bl] = hexRGB(hex);
    const startH = hemiY ? Math.floor(segsH / 2) : 0;
    const pts = [];
    for (let iy = startH; iy <= segsH; iy++) {
      const phi = (iy / segsH) * Math.PI;
      const y = -Math.cos(phi);
      const rad = Math.sin(phi);
      const row = [];
      for (let ix = 0; ix < segsW; ix++) {
        const theta = (ix / segsW) * Math.PI * 2;
        const nx = Math.cos(theta) * rad, ny = y, nz = Math.sin(theta) * rad;
        row.push({ p: [cx + nx * rx, cy + ny * ry, cz + nz * rz], n: norm([nx / rx, ny / ry, nz / rz]) });
      }
      pts.push(row);
    }
    for (let iy = 0; iy < pts.length - 1; iy++) {
      for (let ix = 0; ix < segsW; ix++) {
        const ixn = (ix + 1) % segsW;
        const a = pts[iy][ix], b = pts[iy][ixn], c = pts[iy + 1][ixn], d = pts[iy + 1][ix];
        out.p.push(...a.p, ...b.p, ...c.p, ...a.p, ...c.p, ...d.p);
        out.n.push(...a.n, ...b.n, ...c.n, ...a.n, ...c.n, ...d.n);
        out.c.push(r, g, bl, r, g, bl, r, g, bl, r, g, bl, r, g, bl, r, g, bl);
      }
    }
    if (hemiY) {
      const center = [cx, cy, cz], base = pts[0];
      for (let ix = 0; ix < segsW; ix++) {
        pushTri(out, center, base[ix].p, base[(ix + 1) % segsW].p, r, g, bl);
      }
    }
  }

  function toGeometry(THREE, out) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(out.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(out.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(out.c, 3));
    g.computeBoundingSphere();
    return g;
  }

  // Build sculpted leg segments (for both unified leg and articulated 3-part Elimination leg)
  function buildLegParts(THREE, s) {
    // Unified leg centered at hip pivot x = 0 (offset later by legL/legR)
    const legGeo = (side) => {
      const out = { p: [], n: [], c: [] };
      // Thigh + calf + ankle (y from 0.81 down to 0.14)
      addLoft(out, [
        { pos: [0, 0.82, 0], rx: 0.095, rz: 0.105 },
        { pos: [0, 0.65, -0.005], rx: 0.088, rz: 0.096 },
        { pos: [0, 0.45, -0.01], rx: 0.072, rz: 0.078 },
        { pos: [0, 0.28, 0.005], rx: 0.068, rz: 0.076 },
        { pos: [0, 0.16, 0], rx: 0.058, rz: 0.065 },
      ], 10, s.pants, true, true, true);
      // Hard tactical kneepad
      addBevelBox(out, 0, 0.44, -0.082, 0.105, 0.125, 0.036, s.gear, 0.014);
      // Thigh utility pouch / drop-leg holster on right leg
      if (side > 0) {
        addBevelBox(out, 0.088, 0.62, -0.01, 0.035, 0.14, 0.10, s.gear, 0.008);
      } else {
        addBevelBox(out, -0.085, 0.63, 0, 0.025, 0.05, 0.14, s.vest, 0.005);
      }
      // Combat boot (ankle collar, vamp, toe cap, lugged sole)
      addLoft(out, [
        { pos: [0, 0.21, 0], rx: 0.063, rz: 0.072 },
        { pos: [0, 0.08, -0.01], rx: 0.068, rz: 0.095 },
        { pos: [0, 0.02, -0.035], rx: 0.072, rz: 0.145 },
      ], 10, s.boot, true, true, true);
      addBevelBox(out, 0, 0.018, -0.038, 0.138, 0.036, 0.27, s.boot, 0.012);
      return toGeometry(THREE, out);
    };

    // Individual articulated segments for Elimination IK gait (normalized to unit Y=0.81 height like legacy elimLegPose!)
    const thighOut = { p: [], n: [], c: [] };
    addLoft(thighOut, [
      { pos: [0, 0.0, 0], rx: 0.078, rz: 0.084 },
      { pos: [0, 0.40, 0], rx: 0.092, rz: 0.10 },
      { pos: [0, 0.81, 0], rx: 0.098, rz: 0.108 },
    ], 10, s.pants, true, true, true);
    addBevelBox(thighOut, 0, 0.06, -0.075, 0.10, 0.15, 0.035, s.gear, 0.012);

    const shinOut = { p: [], n: [], c: [] };
    addLoft(shinOut, [
      { pos: [0, 0.0, 0], rx: 0.062, rz: 0.070 },
      { pos: [0, 0.44, 0.01], rx: 0.076, rz: 0.084 },
      { pos: [0, 0.81, 0], rx: 0.075, rz: 0.082 },
    ], 10, s.pants, true, true, true);

    const bootOut = { p: [], n: [], c: [] };
    addBevelBox(bootOut, 0, 0.40, 0, 0.112, 0.80, 0.185, s.boot, 0.024);

    return {
      legL: legGeo(-1),
      legR: legGeo(1),
      segThigh: toGeometry(THREE, thighOut),
      segShin: toGeometry(THREE, shinOut),
      segBoot: toGeometry(THREE, bootOut),
    };
  }

  function buildHip(THREE, s) {
    const out = { p: [], n: [], c: [] };
    addLoft(out, [
      { pos: [0, 0.72, 0], rx: 0.195, rz: 0.135 },
      { pos: [0, 0.84, 0], rx: 0.21, rz: 0.145 },
    ], 12, s.pants, true, true, true);
    // Tactical duty belt + buckle
    addBevelBox(out, 0, 0.845, 0, 0.392, 0.06, 0.275, s.gear, 0.014);
    addBevelBox(out, 0, 0.845, -0.142, 0.072, 0.052, 0.018, 0x8a929a, 0.004);
    return toGeometry(THREE, out);
  }

  function buildBody(THREE, s, opId = null) {
    const out = { p: [], n: [], c: [] };
    // Anatomical tapered athletic torso (waist -> ribcage -> broad shoulders -> collar)
    addLoft(out, [
      { pos: [0, 0.83, 0], rx: 0.195, rz: 0.135 },
      { pos: [0, 1.04, 0], rx: 0.205, rz: 0.145 },
      { pos: [0, 1.28, -0.005], rx: 0.24, rz: 0.165 },
      { pos: [0, 1.43, 0], rx: 0.22, rz: 0.15 },
      { pos: [0, 1.49, 0], rx: 0.095, rz: 0.09 },
    ], 12, s.cloth, true, true, true);

    // Neck
    addLoft(out, [
      { pos: [0, 1.46, 0], rx: 0.072, rz: 0.074 },
      { pos: [0, 1.56, -0.008], rx: 0.062, rz: 0.065 },
    ], 10, s.skin, false, true, true);

    // Tactical collar
    addLoft(out, [
      { pos: [0, 1.45, 0], rx: 0.115, rz: 0.115 },
      { pos: [0, 1.505, 0], rx: 0.105, rz: 0.105 },
    ], 10, s.cloth2, true, true, true);

    // Contoured Ballistic Plate Carrier (front & back armor plates + shoulder straps)
    addBevelBox(out, 0, 1.24, -0.148, 0.31, 0.36, 0.052, s.vest, 0.02);
    addBevelBox(out, 0, 1.25, 0.148, 0.30, 0.35, 0.048, s.vest, 0.02);
    // Side cummerbund straps
    for (const side of [-1, 1]) {
      addBevelBox(out, side * 0.215, 1.15, 0, 0.045, 0.16, 0.27, s.vest, 0.01);
      addBevelBox(out, side * 0.13, 1.435, 0, 0.065, 0.045, 0.26, s.gear, 0.008);
      // Team / Operator IFF shoulder chevron
      addBevelBox(out, side * 0.235, 1.37, 0, 0.022, 0.08, 0.08, s.accent, 0.005);
    }

    // 3 MOLLE front rifle magazine pouches
    for (const mx of [-0.095, 0, 0.095]) {
      addBevelBox(out, mx, 1.12, -0.184, 0.072, 0.135, 0.045, s.cloth2, 0.01);
      addBevelBox(out, mx, 1.15, -0.205, 0.06, 0.03, 0.015, s.gear, 0.004);
    }
    // Radio + whip antenna on left chest/back
    addBevelBox(out, -0.13, 1.33, -0.18, 0.055, 0.105, 0.035, s.gear, 0.008);
    addLoft(out, [
      { pos: [-0.14, 1.38, -0.18], rx: 0.006, rz: 0.006 },
      { pos: [-0.15, 1.56, -0.17], rx: 0.004, rz: 0.004 },
    ], 6, s.gear, true, true, true);

    // Operator-specific body gear
    if (opId === 'finder') {
      addBevelBox(out, 0.02, 1.24, 0.20, 0.26, 0.34, 0.09, s.gear, 0.02);
      addLoft(out, [{ pos: [0.11, 1.41, 0.21], rx: 0.008, rz: 0.008 }, { pos: [0.11, 1.72, 0.21], rx: 0.006, rz: 0.006 }], 6, s.gear);
      addBevelBox(out, 0.11, 1.72, 0.21, 0.028, 0.035, 0.028, s.accent, 0.006);
    } else if (opId === 'doctor') {
      addBevelBox(out, 0, 1.18, 0.21, 0.29, 0.34, 0.13, 0xe8ece8, 0.024);
      addBevelBox(out, 0, 1.19, 0.28, 0.038, 0.15, 0.018, 0xd9453a, 0.004);
      addBevelBox(out, 0, 1.19, 0.28, 0.13, 0.038, 0.018, 0xd9453a, 0.004);
      addBevelBox(out, 0, 1.24, -0.18, 0.035, 0.13, 0.016, s.accent, 0.004);
      addBevelBox(out, 0, 1.24, -0.18, 0.11, 0.035, 0.016, s.accent, 0.004);
    } else if (opId === 'ghost') {
      addBevelBox(out, 0, 1.42, 0.13, 0.38, 0.11, 0.12, s.cloth2, 0.025);
    } else if (opId === 'brutus') {
      for (const side of [-1, 1]) {
        addEllipsoid(out, side * 0.26, 1.41, 0, 0.09, 0.085, 0.14, 8, 6, s.accent);
        addBevelBox(out, side * 0.27, 1.33, 0, 0.09, 0.08, 0.24, s.vest, 0.015);
      }
      addBevelBox(out, 0, 1.47, -0.04, 0.24, 0.07, 0.22, s.vest, 0.018);
    } else if (opId === 'detector') {
      addBevelBox(out, 0, 1.20, 0.21, 0.28, 0.35, 0.13, s.vest, 0.02);
      addBevelBox(out, 0, 1.37, 0.21, 0.24, 0.055, 0.12, s.accent, 0.012);
    }

    // Sculpted Articulated Arms + Tactical Gloves gripping the weapon
    // Right arm (trigger arm): shoulder -> elbow -> trigger grip [.16, 1.21, -.11]
    addEllipsoid(out, 0.24, 1.39, 0, 0.072, 0.075, 0.078, 8, 6, s.cloth);
    addLoft(out, [
      { pos: [0.24, 1.39, 0], rx: 0.065, rz: 0.068 },
      { pos: [0.31, 1.25, -0.02], rx: 0.058, rz: 0.06 },
      { pos: [0.315, 1.15, -0.025], rx: 0.054, rz: 0.056 },
    ], 8, s.cloth, true, true, true);
    addLoft(out, [
      { pos: [0.315, 1.15, -0.025], rx: 0.052, rz: 0.054 },
      { pos: [0.24, 1.185, -0.07], rx: 0.046, rz: 0.048 },
      { pos: [0.175, 1.21, -0.105], rx: 0.04, rz: 0.042 },
    ], 8, s.cloth2, true, true, true);
    // Right tactical glove
    addEllipsoid(out, 0.165, 1.215, -0.115, 0.045, 0.042, 0.055, 8, 6, s.gear);

    // Left arm (support arm): shoulder -> elbow -> forend grip [.10, 1.25, -.40]
    addEllipsoid(out, -0.24, 1.39, 0, 0.072, 0.075, 0.078, 8, 6, s.cloth);
    addLoft(out, [
      { pos: [-0.24, 1.39, 0], rx: 0.065, rz: 0.068 },
      { pos: [-0.28, 1.24, -0.11], rx: 0.056, rz: 0.058 },
      { pos: [-0.275, 1.16, -0.19], rx: 0.052, rz: 0.054 },
    ], 8, s.cloth, true, true, true);
    addLoft(out, [
      { pos: [-0.275, 1.16, -0.19], rx: 0.05, rz: 0.052 },
      { pos: [-0.09, 1.21, -0.31], rx: 0.044, rz: 0.046 },
      { pos: [0.09, 1.25, -0.39], rx: 0.038, rz: 0.04 },
    ], 8, s.cloth2, true, true, true);
    // Left tactical glove
    addEllipsoid(out, 0.105, 1.25, -0.405, 0.044, 0.04, 0.055, 8, 6, s.gear);

    return toGeometry(THREE, out);
  }

  function buildHead(THREE, s, opId = null) {
    const out = { p: [], n: [], c: [] };
    // Sculpted anatomical cranium + jaw
    addEllipsoid(out, 0, 1.66, 0, 0.118, 0.135, 0.128, 12, 10, s.skin);
    // Chin / jawline taper
    addEllipsoid(out, 0, 1.585, -0.035, 0.082, 0.068, 0.092, 10, 8, s.skin);
    // Nose bridge
    addBevelBox(out, 0, 1.635, -0.125, 0.026, 0.045, 0.032, s.skin, 0.008);
    // Ears
    for (const side of [-1, 1]) {
      addEllipsoid(out, side * 0.122, 1.645, 0.005, 0.018, 0.035, 0.026, 6, 6, s.skin);
    }

    // Tactical face gear / mask / goggles depending on operator/team
    if (opId === 'finder') {
      // Hair + Glowing Cyan Recon Visor + Comms Headset
      addEllipsoid(out, 0, 1.72, 0.015, 0.122, 0.08, 0.126, 12, 6, s.hair, true);
      addBevelBox(out, 0, 1.668, -0.122, 0.21, 0.052, 0.042, 0x1a2830, 0.014);
      addBevelBox(out, 0, 1.67, -0.142, 0.185, 0.022, 0.012, s.accent, 0.004);
      for (const side of [-1, 1]) {
        addEllipsoid(out, side * 0.132, 1.655, 0.005, 0.026, 0.045, 0.042, 8, 6, s.gear);
      }
    } else if (opId === 'doctor') {
      // Hair bun + headband + clear eye detail
      addEllipsoid(out, 0, 1.71, 0.02, 0.122, 0.085, 0.128, 12, 6, s.hair, true);
      addEllipsoid(out, 0.01, 1.73, 0.135, 0.055, 0.055, 0.055, 8, 6, s.hair);
      addBevelBox(out, 0, 1.67, -0.12, 0.15, 0.022, 0.014, 0x22292d, 0.004);
    } else if (opId === 'ghost') {
      // Stealth hood + tactical respirator mask + violet visor slit
      addEllipsoid(out, 0, 1.68, 0.005, 0.132, 0.138, 0.138, 12, 10, s.cloth);
      addBevelBox(out, 0, 1.59, -0.115, 0.165, 0.095, 0.05, s.gear, 0.02);
      addBevelBox(out, 0, 1.668, -0.125, 0.175, 0.028, 0.02, s.accent, 0.006);
    } else if (opId === 'brutus') {
      // Heavy beard + tactical sweatband
      addEllipsoid(out, 0, 1.715, 0.01, 0.122, 0.075, 0.126, 12, 6, s.hair, true);
      addEllipsoid(out, 0, 1.565, -0.045, 0.096, 0.062, 0.098, 10, 6, s.hair);
      addBevelBox(out, 0, 1.71, -0.005, 0.242, 0.036, 0.25, s.accent, 0.012);
    } else if (opId === 'detector') {
      // Tactical beanie + sensor goggles on forehead
      addEllipsoid(out, 0, 1.72, 0.01, 0.128, 0.085, 0.132, 12, 6, s.accent, true);
      for (const side of [-1, 1]) {
        addEllipsoid(out, side * 0.052, 1.72, -0.125, 0.04, 0.028, 0.024, 8, 6, s.gear);
        addEllipsoid(out, side * 0.052, 1.72, -0.142, 0.028, 0.018, 0.01, 8, 6, s.visor);
      }
    } else {
      // Standard Tactical Operatives (Elimination / DM / TDM): Balaclava + Tinted Tactical Goggles
      addEllipsoid(out, 0, 1.655, 0.002, 0.122, 0.136, 0.132, 12, 10, s.mask || 0x1e242a);
      // Exposed eye strip + tactical sunglasses/goggles
      addBevelBox(out, 0, 1.665, -0.118, 0.17, 0.045, 0.025, s.skin, 0.006);
      addBevelBox(out, 0, 1.668, -0.128, 0.185, 0.042, 0.022, s.visor || 0x162029, 0.01);
      addBevelBox(out, 0, 1.67, -0.14, 0.16, 0.014, 0.008, s.accent, 0.003);
    }

    return toGeometry(THREE, out);
  }

  function buildHelmet(THREE, s) {
    const out = { p: [], n: [], c: [] };
    // Contoured ballistic FAST/ACH helmet dome
    addEllipsoid(out, 0, 1.705, 0.008, 0.142, 0.125, 0.152, 14, 8, s.helmet, true);
    // Helmet lower rim & nape guard
    addLoft(out, [
      { pos: [0, 1.67, 0.012], rx: 0.145, rz: 0.152 },
      { pos: [0, 1.715, 0.008], rx: 0.142, rz: 0.152 },
    ], 14, s.helmet, false, false, true);
    // Side ARC accessory rails + Peltor comms ear-cups
    for (const side of [-1, 1]) {
      addBevelBox(out, side * 0.145, 1.70, 0.0, 0.018, 0.032, 0.16, s.gear, 0.005);
      addEllipsoid(out, side * 0.142, 1.648, 0.01, 0.024, 0.044, 0.04, 8, 6, s.gear);
    }
    // Front NVG mount shroud + rear counterweight pouch
    addBevelBox(out, 0, 1.745, -0.148, 0.055, 0.055, 0.022, s.gear, 0.006);
    addBevelBox(out, 0, 1.705, 0.152, 0.095, 0.065, 0.032, s.gear, 0.008);
    // Subtle IFF strobe strip on top
    addBevelBox(out, 0, 1.83, 0.02, 0.042, 0.016, 0.065, s.accent, 0.004);
    return toGeometry(THREE, out);
  }

  const rigCache = new Map();

  function getRigGeometries(THREE, key, isOperator = false) {
    const cacheKey = (isOperator ? 'op:' : 'team:') + key;
    if (rigCache.has(cacheKey)) return rigCache.get(cacheKey);
    const s = isOperator ? (OP_STYLES[key] || OP_STYLES.finder) : (TEAM_STYLES[key] || TEAM_STYLES.coalition);
    const legParts = buildLegParts(THREE, s);
    const bundle = {
      hip: buildHip(THREE, s),
      legL: legParts.legL,
      legR: legParts.legR,
      segThigh: legParts.segThigh,
      segShin: legParts.segShin,
      segBoot: legParts.segBoot,
      body: buildBody(THREE, s, isOperator ? key : null),
      head: buildHead(THREE, s, isOperator ? key : null),
      helmet: buildHelmet(THREE, s),
    };
    rigCache.set(cacheKey, bundle);
    return bundle;
  }

  // PBR Material for characters (uses fabric micro-normal/roughness & sRGB->linear vertex colors)
  function createCharacterMaterial(THREE, mats, tintHex = null) {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: tintHex != null ? tintHex : 0xffffff,
      roughness: 0.72,
      metalness: 0.08,
      envMapIntensity: 0.45,
      normalMap: mats?.fabricMaps?.normalMap || null,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: mats?.fabricMaps?.roughnessMap || null,
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
#ifdef USE_COLOR
  diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(2.2));
#endif`
      );
    };
    mat.customProgramCacheKey = () => 'v2-char-pbr';
    return mat;
  }

  globalThis.V2Operators = { TEAM_STYLES, OP_STYLES, getRigGeometries, createCharacterMaterial };
})();
