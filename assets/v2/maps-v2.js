// AIM.DUELO 2.0 — Architectural & Environmental Overhaul for Elimination Maps
(() => {
  'use strict';

  const M = () => globalThis.V2World ? globalThis.V2World.MAT : { concrete: 0, wood: 1, metal: 2, floor: 3, brick: 4 };

  // Detailed strapped military wooden crate (visual framing around exact solid hitbox)
  function addCrateTrim(B, x, z, w, d, h, y0 = 0, woodCol = 0x8f6b43, frameCol = 0x5c4228, metalCol = 0x2c3238) {
    const t = 0.055, e = 0.018;
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y0 + h;
    // Corner vertical battens
    for (const cx of [x0, x1 - t]) for (const cz of [z0, z1 - t]) {
      B.deco([cx - e, y0, cz - e], [cx + t + e, y1, cz + t + e], frameCol, M().wood);
    }
    // Top & bottom perimeter framing
    for (const yy of [y0, y1 - t * 1.1]) {
      B.deco([x0 - e, yy, z0 - e], [x1 + e, yy + t * 1.1, z0 + t + e], frameCol, M().wood);
      B.deco([x0 - e, yy, z1 - t - e], [x1 + e, yy + t * 1.1, z1 + e], frameCol, M().wood);
      B.deco([x0 - e, yy, z0 - e], [x0 + t + e, yy + t * 1.1, z1 + e], frameCol, M().wood);
      B.deco([x1 - t - e, yy, z0 - e], [x1 + e, yy + t * 1.1, z1 + e], frameCol, M().wood);
    }
    // Steel corner brackets & center latch strip
    for (const cx of [x0 - e, x1 - 0.14]) for (const cz of [z0 - e, z1 - 0.14]) {
      B.deco([cx, y1 - 0.08, cz], [cx + 0.16, y1 + e, cz + 0.16], metalCol, M().metal);
    }
    if (h >= 1.1) {
      const ym = y0 + h * 0.5;
      B.deco([x0 - e * 1.3, ym - 0.03, z0 - e * 1.3], [x1 + e * 1.3, ym + 0.03, z1 + e * 1.3], metalCol, M().metal);
    }
  }

  // Detailed steel shipping container (corrugated ribs, ISO corner posts, locking bars)
  function addContainerTrim(B, x, z, w, d, h, y0 = 0, bodyCol = 0x325773, trimCol = 0x223b4f) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y0 + h;
    const e = 0.028;
    // Top/bottom ISO rails
    for (const yy of [y0, y1 - 0.08]) {
      B.deco([x0 - e, yy, z0 - e], [x1 + e, yy + 0.08, z1 + e], trimCol, M().metal);
    }
    // Corner ISO castings
    for (const cx of [x0 - e, x1 - 0.12]) for (const cz of [z0 - e, z1 - 0.12]) {
      B.deco([cx, y0, cz], [cx + 0.14, y1, cz + 0.14], 0x1e242b, M().metal);
    }
    // Corrugated ribs along longer sides
    const alongX = w >= d;
    if (alongX) {
      for (let rx = x0 + 0.25; rx < x1 - 0.2; rx += 0.34) {
        B.deco([rx, y0 + 0.1, z0 - 0.025], [rx + 0.12, y1 - 0.1, z1 + 0.025], trimCol, M().metal);
      }
      // Door locking rods on one end
      for (const dz of [-0.24, 0.24]) {
        B.deco([x1, y0 + 0.15, z + dz - 0.02], [x1 + 0.035, y1 - 0.15, z + dz + 0.02], 0x8b939c, M().metal);
      }
    } else {
      for (let rz = z0 + 0.25; rz < z1 - 0.2; rz += 0.34) {
        B.deco([x0 - 0.025, y0 + 0.1, rz], [x1 + 0.025, y1 - 0.1, rz + 0.12], trimCol, M().metal);
      }
      for (const dx of [-0.24, 0.24]) {
        B.deco([x + dx - 0.02, y0 + 0.15, z1], [x + dx + 0.02, y1 - 0.15, z1 + 0.035], 0x8b939c, M().metal);
      }
    }
  }

  // Concrete perimeter pilasters, base plinths, and top coping caps around the entire arena
  function addPerimeterArchitecture(B, ax, az, wallH, baseCol = 0x4b5259, trimCol = 0x353b42, accentCol = 0xd99b26, mat = M().concrete) {
    // Base plinth around all 4 walls
    const ph = 0.45, pd = 0.09;
    B.deco([-ax, 0, -az], [ax, ph, -az + pd], trimCol, mat);
    B.deco([-ax, 0, az - pd], [ax, ph, az], trimCol, mat);
    B.deco([-ax, 0, -az], [-ax + pd, ph, az], trimCol, mat);
    B.deco([ax - pd, 0, -az], [ax, ph, az], trimCol, mat);

    // Top coping ledge
    const ch = 0.35, cd = 0.22;
    B.deco([-ax - 0.1, wallH - ch, -az - 0.1], [ax + 0.1, wallH + 0.08, -az + cd], trimCol, mat);
    B.deco([-ax - 0.1, wallH - ch, az - cd], [ax + 0.1, wallH + 0.08, az + 0.1], trimCol, mat);
    B.deco([-ax - 0.1, wallH - ch, -az], [-ax + cd, wallH + 0.08, az], trimCol, mat);
    B.deco([ax - cd, wallH - ch, -az], [ax + 0.1, wallH + 0.08, az], trimCol, mat);

    // Architectural pilasters / columns every ~5m along X and Z walls
    for (let z = -az + 3; z <= az - 3; z += 5.2) {
      B.deco([-ax, 0, z - 0.28], [-ax + 0.16, wallH, z + 0.28], baseCol, mat);
      B.deco([ax - 0.16, 0, z - 0.28], [ax, wallH, z + 0.28], baseCol, mat);
    }
    for (let x = -ax + 3; x <= ax - 3; x += 5.2) {
      B.deco([x - 0.28, 0, -az], [x + 0.28, wallH, -az + 0.16], baseCol, mat);
      B.deco([x - 0.28, 0, az - 0.16], [x + 0.28, wallH, az], baseCol, mat);
    }

    // Upper horizontal utility conduit / accent band along walls
    B.deco([-ax + 0.02, 4.6, -az + 0.08], [ax - 0.02, 4.74, -az + 0.18], accentCol, M().metal);
    B.deco([-ax + 0.02, 4.6, az - 0.18], [ax - 0.02, 4.74, az - 0.08], accentCol, M().metal);
    B.deco([-ax + 0.08, 4.6, -az + 0.02], [-ax + 0.18, 4.74, az - 0.02], accentCol, M().metal);
    B.deco([ax - 0.18, 4.6, -az + 0.02], [ax - 0.08, 4.74, az - 0.02], accentCol, M().metal);
  }

  // Overhead industrial floodlight gantry truss (high above gameplay, never blocks sightlines)
  function addOverheadGantry(B, ax, z, trussCol = 0x2c3238, lampCol = 0xfff1d0) {
    const y = 7.4;
    B.deco([-ax, y, z - 0.14], [ax, y + 0.18, z + 0.14], trussCol, M().metal);
    B.deco([-ax, y + 0.55, z - 0.14], [ax, y + 0.72, z + 0.14], trussCol, M().metal);
    for (let x = -ax + 2; x <= ax - 2; x += 3.2) {
      B.deco([x - 0.06, y + 0.18, z - 0.06], [x + 0.06, y + 0.55, z + 0.06], trussCol, M().metal);
    }
    for (const lx of [-ax * 0.55, 0, ax * 0.55]) {
      B.deco([lx - 0.45, y - 0.18, z - 0.22], [lx + 0.45, y, z + 0.22], 0x1e2226, M().metal);
      B.deco([lx - 0.36, y - 0.22, z - 0.14], [lx + 0.36, y - 0.18, z + 0.14], lampCol, M().metal);
    }
  }

  // Tactical spawn barrier trim (concrete blast wall with yellow/orange hazard stripe & top bevel)
  function addShieldTrim(B, zc, hw, baseCol = 0x454d54, stripeCol = 0xd99b26) {
    const pair = (a, b, col, mat) => {
      B.deco(a, b, col, mat);
      B.deco([-b[0], a[1], -b[2]], [-a[0], b[1], -a[2]], col, mat);
    };
    pair([-hw - 0.05, 0, zc - 0.44], [hw + 0.05, 0.38, zc + 0.44], 0x2f353b, M().concrete);
    pair([-hw - 0.04, 2.95, zc - 0.44], [hw + 0.04, 3.24, zc + 0.44], baseCol, M().metal);
    pair([-hw + 0.1, 1.45, zc - 0.42], [hw - 0.1, 1.62, zc + 0.42], stripeCol, M().metal);
    // Vertical steel reinforcement ribs
    for (let x = -hw + 0.8; x <= hw - 0.8; x += 2.2) {
      pair([x - 0.07, 0.38, zc - 0.43], [x + 0.07, 2.95, zc + 0.43], 0x2a3036, M().metal);
    }
  }

  // Painted floor lane lines / site sector markings (flush 4mm visual layer)
  function addFloorLine(B, x0, z0, x1, z1, col = 0xd9a93a) {
    B.deco([Math.min(x0, x1), 0.002, Math.min(z0, z1)], [Math.max(x0, x1), 0.01, Math.max(z0, z1)], col, M().floor);
  }

  // Mediterranean stone planter + controlled cypress tree outside playable lanes
  function addPlanterTree(B, x, z) {
    B.deco([x - 0.65, 0, z - 0.65], [x + 0.65, 0.45, z + 0.65], 0xc9bc9f, M().brick);
    B.deco([x - 0.55, 0.45, z - 0.55], [x + 0.55, 0.5, z + 0.55], 0x4d3a27, M().wood);
    B.deco([x - 0.14, 0.5, z - 0.14], [x + 0.14, 3.1, z + 0.14], 0x5c432c, M().wood);
    B.deco([x - 0.68, 2.8, z - 0.68], [x + 0.68, 4.9, z + 0.68], 0x3b6334, M().brick);
    B.deco([x - 0.45, 4.9, z - 0.45], [x + 0.45, 6.2, z + 0.45], 0x48753e, M().brick);
  }

  const ELIM_PALETTES = {
    caixas: {
      floor: 0x62686e, wall: 0x555d66, shield: 0x3a424b, crate: 0x9c7448, crate2: 0x335875, plat: 0x565e66, ramp: 0x6a7178,
      floorMat: 3, wallMat: 0, crateMat: 1, crate2Mat: 2, shieldMat: 0, platMat: 0, rampMat: 2,
    },
    patio: {
      floor: 0xc2b297, wall: 0xc9b48f, shield: 0x8f7a5c, crate: 0x9e7446, crate2: 0x9c6044, plat: 0xb59f7d, ramp: 0xa69374,
      floorMat: 3, wallMat: 4, crateMat: 1, crate2Mat: 4, shieldMat: 4, platMat: 4, rampMat: 4,
    },
    torres: {
      floor: 0x5b615d, wall: 0x4c544f, shield: 0x39423e, crate: 0x8c683e, crate2: 0x3e524a, plat: 0x4b5752, ramp: 0x606b65,
      floorMat: 3, wallMat: 0, crateMat: 1, crate2Mat: 2, shieldMat: 2, platMat: 0, rampMat: 2,
    },
    ponte: {
      floor: 0x5c6068, wall: 0x525661, shield: 0x3c414d, crate: 0x8f6b43, crate2: 0x4e5869, plat: 0x6b717d, ramp: 0x5c626e,
      floorMat: 3, wallMat: 4, crateMat: 1, crate2Mat: 2, shieldMat: 0, platMat: 0, rampMat: 0,
    },
    fortes: {
      floor: 0x706960, wall: 0x5e5850, shield: 0x423e38, crate: 0x8a643b, crate2: 0x595249, plat: 0x665f56, ramp: 0x756c61,
      floorMat: 3, wallMat: 0, crateMat: 1, crate2Mat: 0, shieldMat: 0, platMat: 0, rampMat: 2,
    },
  };

  function decorateMap(id, B, K, ax, az) {
    const MS = 0.95;
    const C = 1.2;
    const pair = (fn) => { fn(1); fn(-1); };

    if (id === 'caixas') {
      // Cargo Yard: shipping containers (2*C high or wide) + strapped wooden military crates + warehouse facade + gantry
      addPerimeterArchitecture(B, ax, az, 7, 0x4b5259, 0x333940, 0xd4922a, M().concrete);
      addShieldTrim(B, -21 * MS, 8 * MS, 0x3b444e, 0xd4922a);
      addOverheadGantry(B, ax, -10);
      addOverheadGantry(B, ax, 10);

      // Painted tactical yard markings on floor
      addFloorLine(B, -ax + 2, -0.08, ax - 2, 0.08, 0xb88f35);
      addFloorLine(B, -8 * MS, -21 * MS + 0.5, 8 * MS, -21 * MS + 0.62, 0x3a7ca5);
      addFloorLine(B, -8 * MS, 21 * MS - 0.62, 8 * MS, 21 * MS - 0.5, 0xc2543a);

      // Warehouse roll-up shutters on side walls
      for (const z of [-14, 0, 14]) {
        B.deco([-ax, 0, z - 2.2], [-ax + 0.06, 4.2, z + 2.2], 0x2d353d, M().metal);
        B.deco([ax - 0.06, 0, z - 2.2], [ax, 4.2, z + 2.2], 0x2d353d, M().metal);
        for (let y = 0.4; y < 4.0; y += 0.42) {
          B.deco([-ax, y, z - 2.1], [-ax + 0.09, y + 0.08, z + 2.1], 0x3d4752, M().metal);
          B.deco([ax - 0.09, y, z - 2.1], [ax, y + 0.08, z + 2.1], 0x3d4752, M().metal);
        }
      }

      // Trim every crate & container matching MAPS.caixas coordinates
      const HALF = [
        [-11,-18,2*C,C,C],[11.5,-17,C,C,2*C],[-4,-15,C,C,C],[4,-14,2*C,C,C],[-13,-10,C,2*C,C],[8.5,-9.5,C,C,2*C],
        [-6,-7.5,2*C,C,C],[1,-7,C,C,C],[13,-4,C,2*C,C],[-9.5,-2.5,C,C,2*C],[4,-2,C,C,2*C],
        [9.5,-19,C,2*C,C],[0,-17.5,2*C,C,C],[-6,-12,C,C,2*C],[6.5,-11,C,C,C],[-1.5,-11,C,C,C],[-3,-4.5,C,C,C],[7,-5.5,C,C,C]
      ];
      for (const [x, z, w, d, h] of HALF) {
        const fn = h > C ? addContainerTrim : addCrateTrim;
        const c1 = h > C ? 0x335875 : 0x9c7448, c2 = h > C ? 0x233e54 : 0x634527;
        fn(B, x * MS, z * MS, w, d, h, 0, c1, c2);
        fn(B, -x * MS, -z * MS, w, d, h, 0, c1, c2);
      }
      for (const [x, z] of [[-11.6,-18],[4.6,-14],[13,-4.6]]) {
        addCrateTrim(B, x * MS, z * MS, C, C, C, C, 0x856039, 0x4f361e);
        addCrateTrim(B, -x * MS, -z * MS, C, C, C, C, 0x856039, 0x4f361e);
      }
      addCrateTrim(B, 0, 0, 2 * C, 2 * C, C, 0, 0x9c7448, 0x5c3f23);
    }

    else if (id === 'patio') {
      // Plaza Sol: Mediterranean stone courtyard, arched colonnades, tiled fountain trim, cypress planters
      addPerimeterArchitecture(B, ax, az, 7, 0xb8a382, 0x8c7759, 0x9e583b, M().brick);
      addShieldTrim(B, -19.8, 7.5, 0x7d6a51, 0xc27c44);

      // Terracotta tile roof eaves along perimeter walls
      B.deco([-ax, 6.2, -az], [ax, 6.6, -az + 0.85], 0xa64d32, M().brick);
      B.deco([-ax, 6.2, az - 0.85], [ax, 6.6, az], 0xa64d32, M().brick);
      B.deco([-ax, 6.2, -az], [-ax + 0.85, 6.6, az], 0xa64d32, M().brick);
      B.deco([ax - 0.85, 6.2, -az], [ax, 6.6, az], 0xa64d32, M().brick);

      // Central plaza cornice, corner stone pillars & decorative pergola beams
      B.deco([-4.1, 2.22, -4.1], [4.1, 2.42, 4.1], 0x8f7a5e, M().concrete);
      for (const sx of [-3.7, 3.7]) for (const sz of [-3.7, 3.7]) {
        B.deco([sx - 0.22, 0, sz - 0.22], [sx + 0.22, 2.55, sz + 0.22], 0x9c886b, M().brick);
      }
      // Ramp side stone curbs
      pair((s) => {
        B.deco([s * -1.65, 0, s * -10], [s * -1.5, 0.25, s * -4], 0x857157, M().brick);
        B.deco([s * 1.5, 0, s * -10], [s * 1.65, 0.25, s * -4], 0x857157, M().brick);
      });
      // Crate trims
      for (const [x, z, w, d, h, y0] of [
        [2.2, 2.2, C, C, C, 2.4], [5, -13, 2 * C, C, C, 0], [-4, -14, C, C, C, 0], [-4, -14, C, C, C, C],
        [-6.5, -2, C, C, C, 0], [-9, -17.5, C, C, C, 0], [9.5, -17, C, 2 * C, C, 0], [7, -8, C, C, C, 0]
      ]) {
        addCrateTrim(B, x, z, w, d, h, y0, 0x9e7446, 0x614426);
        addCrateTrim(B, -x, -z, w, d, h, y0, 0x9e7446, 0x614426);
      }
      // Corner planters against perimeter walls (never block routes)
      for (const [px, pz] of [[-ax + 0.9, -az + 0.9], [ax - 0.9, -az + 0.9], [-ax + 0.9, az - 0.9], [ax - 0.9, az - 0.9]]) {
        addPlanterTree(B, px, pz);
      }
    }

    else if (id === 'torres') {
      // Bastion: Military watchtowers, steel I-beam girders, safety railings, HVAC units, tactical bollards
      addPerimeterArchitecture(B, ax, az, 7, 0x47504b, 0x323935, 0xd4a438, M().concrete);
      addShieldTrim(B, -21, 7, 0x39423e, 0xd4a438);
      addOverheadGantry(B, ax, 0);

      // Tower structural beams, floor grates & safety railings (outside sightlines/matching parapet)
      pair((s) => {
        const x0 = s > 0 ? 6 : -12, x1 = s > 0 ? 12 : -6, z0 = s > 0 ? -13 : 9, z1 = s > 0 ? -9 : 13;
        B.deco([x0 - 0.08, 2.82, z0 - 0.08], [x1 + 0.08, 3.02, z1 + 0.08], 0x2b3330, M().metal);
        // Steel corner pillars under tower deck
        for (const cx of [x0, x1 - 0.25]) for (const cz of [z0, z1 - 0.25]) {
          B.deco([cx, 0, cz], [cx + 0.25, 3.0, cz + 0.25], 0x252c29, M().metal);
        }
        // Radio antenna mast on outer corner of tower
        const mx = s > 0 ? 11.7 : -11.7, mz = s > 0 ? -9.2 : 9.2;
        B.deco([mx - 0.08, 4.0, mz - 0.08], [mx + 0.08, 6.8, mz + 0.08], 0x3b4440, M().metal);
        B.deco([mx - 0.28, 6.2, mz - 0.28], [mx + 0.28, 6.32, mz + 0.28], 0xd4a438, M().metal);
      });

      for (const [x, z, w, d, h, y0] of [
        [6.8, -12, C, C, C, 3], [-11, -13, C, 2 * C, C, 0], [-3, -12, 2 * C, C, C, 0],
        [3, -17.5, C, C, C, 0], [-9, -18, C, C, C, 0], [-9, -18, C, C, C, C], [4, -8, C, C, C, 0], [-4, -1, C, C, C, 0]
      ]) {
        addCrateTrim(B, x, z, w, d, h, y0, 0x8c683e, 0x523b21);
        addCrateTrim(B, -x, -z, w, d, h, y0, 0x8c683e, 0x523b21);
      }
      addContainerTrim(B, -8, -6, C, C, 2 * C, 0, 0x3e524a, 0x283630);
      addContainerTrim(B, 8, 6, C, C, 2 * C, 0, 0x3e524a, 0x283630);
    }

    else if (id === 'ponte') {
      // Viaduct: Steel & concrete overpass bridge, chamfered piers, steel truss guardrails, underpass lighting
      addPerimeterArchitecture(B, ax, az, 7, 0x4b505c, 0x323640, 0x7b93b8, M().brick);
      addShieldTrim(B, -20.5, 7.5, 0x3c414d, 0x7b93b8);

      const BY = 2.6;
      // Bridge girder ribs & underside crossbeams
      for (let z = -7.5; z <= 7.5; z += 2.5) {
        B.deco([-1.6, BY - 0.36, z - 0.14], [1.6, BY - 0.28, z + 0.14], 0x2b303a, M().metal);
      }
      // Pier capitals & bases
      for (const z of [-5, 0, 5]) {
        B.deco([-0.55, 0, z - 0.55], [0.55, 0.32, z + 0.55], 0x353a45, M().concrete);
        B.deco([-0.55, BY - 0.55, z - 0.55], [0.55, BY - 0.3, z + 0.55], 0x353a45, M().concrete);
      }
      // Steel handrail top cap along bridge parapets
      B.deco([-1.7, BY + 0.88, -6.1], [-1.45, BY + 0.98, 6.1], 0x282d36, M().metal);
      B.deco([1.45, BY + 0.88, -6.1], [1.7, BY + 0.98, 6.1], 0x282d36, M().metal);

      // Underpass ceiling strip light
      B.deco([-0.25, BY - 0.33, -7], [0.25, BY - 0.29, 7], 0xdcebf7, M().metal);

      // Crates & containers
      for (const [x, z, w, d, h, y0] of [
        [-9, -12, 2 * C, C, C, 0], [-7, 3, C, C, C, 0], [8, -13, C, C, C, 0], [8, -13, C, C, C, C],
        [11, -7, C, 2 * C, C, 0], [5, -6, C, C, C, 0], [-5, -17, C, C, C, 0], [5, -18, 2 * C, C, C, 0], [-12, -17, C, C, C, 0]
      ]) {
        addCrateTrim(B, x, z, w, d, h, y0, 0x8f6b43, 0x573e24);
        addCrateTrim(B, -x, -z, w, d, h, y0, 0x8f6b43, 0x573e24);
      }
      for (const [x, z] of [[-11, -4], [-5, -9]]) {
        addContainerTrim(B, x, z, C, C, 2 * C, 0, 0x4e5869, 0x343c4a);
        addContainerTrim(B, -x, -z, C, C, 2 * C, 0, 0x4e5869, 0x343c4a);
      }
    }

    else if (id === 'fortes') {
      // Citadel: Reinforced concrete bunkers/bastions, armored blast walls, hazard ramp curbs, comms dish
      addPerimeterArchitecture(B, ax, az, 7, 0x575148, 0x3b3731, 0xd48538, M().concrete);
      addShieldTrim(B, -20.5, 7.5, 0x423e38, 0xd48538);
      addOverheadGantry(B, ax, 0);

      // Bastion platform edge coping & hazard curbs
      pair((s) => {
        const zEdge = s > 0 ? -13 : 13;
        B.deco([-15, 1.08, zEdge - 0.14], [15, 1.22, zEdge + 0.14], 0x3d3832, M().metal);
        // Comms relay mast on the high corner bastion wall
        const rx = s > 0 ? 12.2 : -12.2, rz = s > 0 ? -17.6 : 17.6;
        B.deco([rx - 0.12, 1.2 + 3 * C, rz - 0.12], [rx + 0.12, 1.2 + 3 * C + 2.1, rz + 0.12], 0x2d3238, M().metal);
        B.deco([rx - 0.55, 1.2 + 3 * C + 1.5, rz - 0.1], [rx + 0.55, 1.2 + 3 * C + 1.9, rz + 0.1], 0x76808a, M().metal);
      });

      // Center monolith cap & steel buttresses
      B.deco([-1.26, 3 * C - 0.12, -0.66], [1.26, 3 * C + 0.06, 0.66], 0x38342f, M().metal);
      B.deco([-1.26, 0, -0.66], [1.26, 0.28, 0.66], 0x38342f, M().concrete);

      for (const [x, z, w, d, h, y0] of [
        [-11.5, -13.6, C, C, C, 1.2], [-2.5, -13.6, 2 * C, C, C, 1.2], [3.5, -13.6, C, C, C, 1.2],
        [-4, -3, 2 * C, C, C, 0], [-10, -6, C, 2 * C, C, 0], [11, -1, C, C, C, 0], [2, -9, C, C, C, 0], [-5, -10, C, C, C, 0]
      ]) {
        addCrateTrim(B, x, z, w, d, h, y0, 0x8a643b, 0x52391f);
        addCrateTrim(B, -x, -z, w, d, h, y0, 0x8a643b, 0x52391f);
      }
      addContainerTrim(B, 6, -5, C, C, 2 * C, 0, 0x595249, 0x3a352f);
      addContainerTrim(B, -6, 5, C, C, 2 * C, 0, 0x595249, 0x3a352f);
    }
  }

  // Determines floor material at (x, y, z) for material-specific footsteps
  function surfaceKindAt(map, x, y, z) {
    if (!map) return 'concrete';
    for (const [x0, z0, x1, z1] of map.water || []) {
      if (x > x0 && x < x1 && z > z0 && z < z1 && y < 0.3) return 'water';
    }
    if (y > 0.35) {
      if (map.id === 'torres' || map.id === 'dmdeposito') return 'metal';
      if (map.id === 'patio' || map.id === 'dmborgo' || map.id === 'fortes') return 'concrete';
    }
    if (map.id === 'dmborgo' || map.id === 'patio') return 'concrete';
    return 'concrete';
  }

  globalThis.V2Maps = { ELIM_PALETTES, decorateMap, surfaceKindAt };
})();
