// Converts the four Wingman BSPs supplied by the user (used with the authors' permission) into the game's map format.
// Usage: node tools/import-wingman-maps.mjs <wg_sanctum.bsp> <wg_neon.bsp> <wg_forge.bsp> <wg_overgrowth.bsp>
// Geometry, collision, spawns and bombsites come from each BSP. Stock CS:GO props are not inside the files, so the
// common cover props (crates, barrels, hedges, cars, barriers, rocks, fences, railings, trees...) are approximated by
// boxes and prisms from rules on the model name, and checked against the map's own navigation mesh (.nav): a prop that
// would cover walkable floor is shrunk or left out. Surfaces get light procedural textures (no images).
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { compileSourceMap, rotation, PATTERNS } from './source-bsp.mjs';
import { readNav, navHeightsAt } from './source-nav.mjs';
import { packMap, bakeNavigation } from './import-source-maps.mjs';
import '../assets/maps/runtime.js';

export const WINGMAN_MAPS = {
  sanctum: { name: 'Sanctum', credit: 'alicate madeira 4', file: 'wg_sanctum.bsp' },
  neon: { name: 'Neon', credit: 'zelzstorm', file: 'wg_neon.bsp' },
  forge: { name: 'Forge', credit: 'Blind', file: 'wg_forge.bsp' },
  overgrowth: { name: 'Overgrowth', credit: 'jd40', file: 'wg_overgrowth.bsp' },
};

const add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, s) => a.map(v => v * s), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const P = PATTERNS;
const C = { wood: 0x8a6a45, crate: 0x9a7a4e, metal: 0x66737a, barrel: 0x5f6b62, stone: 0x9b958a, rock: 0x8c877d, foliage: 0x4e6b38, trunk: 0x5b4632, car: 0x7b858e, concrete: 0xaaa69d, hay: 0xc4a65c, fence: 0x8b939a, plaster: 0xc9bca5, cloth: 0x6d6a5c };

// Prop rules: size in model units [length (x), width (y), height (z)], origin at the base centre.
const dims3 = m => { const d = m.match(/(\d+)x(\d+)x(\d+)/); return d ? [+d[1], +d[2], +d[3]] : null; };
const tail = (m, re, def) => { const d = m.match(re); return d ? +d[1] : def; };
const SKIP = /(wire|cable|light|lamp|fixture|sign|decal|pipe|trim|merlon|window|door|vent|gutter|curb|grass|weed|vine|ivy|clover|flower|garbage|beercan|bottle|paper|socket|alarm|extinguisher|sprinkler|button|gauge|valve|joist|beam|rebar|conduit|plate|bumper|leaves|card|tarp_|windowtarp|manhole|_cap|noose|endcap|support|attachment|bell|ceiling|frame|shutter|bars|loose_board|cinderblock|pot_|planter|chair|junctionbox|exhaust|fan_|ladder|scaffold|arch|poster|graffiti|debris|trash_|can_|cup|book|clutter|rope|chain_|hose|faucet|outlet|switch|camera|speaker|radio|phone|keyboard|monitor|computer|clock|picture|painting|mirror|towel|curtain|blind|flag|banner|awning|canopy|umbrella)/;
const RULES = [
  [/crate_assembly_(\d+)x(\d+)/, m => { const d = m.match(/(\d+)x(\d+)/); return { size: [+d[1], +d[2], 100], color: C.crate, pat: P.wood }; }],
  [/(\d+)x(\d+)x(\d+)/, m => ({ size: dims3(m), color: /crate|wood|box/.test(m) ? C.crate : C.concrete, pat: /crate|wood|box/.test(m) ? P.wood : P.concrete })],
  [/barrel|drum|keg/, m => /wine_barrel/.test(m) ? { size: [44, 34, 34], color: C.wood, pat: P.wood } : { size: [30, 30, 44], cyl: true, color: C.barrel, pat: P.metal }],
  [/hay_bale/, () => ({ size: [64, 40, 40], color: C.hay, pat: P.ground })],
  [/concrete_bags?_stack|sandbag/, () => ({ size: [64, 44, 30], color: C.cloth, pat: P.concrete })],
  [/pallet_stack|pallet_barrels|shell_pallet|bomb_shells|wood_pallet_stack/, () => ({ size: [48, 40, 40], color: C.wood, pat: P.wood })],
  [/plywood|sheetrock_stack/, () => ({ size: [96, 48, 30], color: C.wood, pat: P.wood })],
  [/wine_crate|crate/, () => ({ size: [48, 40, 40], color: C.crate, pat: P.wood })],
  [/hedge/, m => { const d = m.match(/hedge_(\d+)_(\d+)/); return { size: d ? [+d[1], 48, +d[2]] : [128, 48, 96], color: C.foliage, pat: P.foliage, elongated: !!d }; }],
  [/cypress/, () => ({ tree: { trunk: 14, height: 300, crown: [56, 56, 250], crownAt: 40 } })],
  [/palm_tree/, () => ({ tree: { trunk: 16, height: 330, crown: [200, 200, 60], crownAt: 290 } })],
  [/tree/, () => ({ tree: { trunk: 22, height: 320, crown: [240, 240, 200], crownAt: 150 } })],
  [/bush|shrub/, () => ({ size: [72, 72, 56], color: C.foliage, pat: P.foliage, mask: 0 })],
  [/(rock|stones)_cluster|flat_stones|pebble/, () => ({ size: [96, 96, 10], color: C.rock, pat: P.stone, mask: 0 })],
  [/rock|boulder|cliff/, () => ({ size: [112, 96, 72], color: C.rock, pat: P.stone })],
  [/forklift/, () => ({ size: [110, 48, 84], color: C.car, pat: P.metal })],
  [/truck/, () => ({ size: [300, 100, 120], color: C.car, pat: P.metal })],
  [/\bvan\b|_van|van_/, () => ({ size: [200, 80, 90], color: C.car, pat: P.metal })],
  [/sedan|hatchback|taxi|_car|car_|cars\//, () => ({ size: [180, 76, 58], color: C.car, pat: P.metal })],
  [/dumpster|trashbin|trash_bin/, () => ({ size: [80, 48, 56], color: C.metal, pat: P.metal })],
  [/containerboxclosed|crate_metal/, () => ({ size: [64, 48, 48], color: C.metal, pat: P.metal })],
  [/shipping_container|cargo_container|container/, () => ({ size: [480, 96, 104], color: C.metal, pat: P.metal, elongated: true })],
  [/concrete_barrier|jersey|barricade_concrete|road_barrier/, () => ({ size: [96, 24, 40], color: C.concrete, pat: P.concrete, elongated: true })],
  [/bollard/, () => ({ size: [12, 12, 42], cyl: true, color: C.metal, pat: P.metal })],
  [/fencepost|fence_post/, () => ({ size: [6, 6, 96], cyl: true, color: C.fence, pat: P.metal })],
  [/razorwire/, () => ({ size: [128, 24, 32], color: C.fence, pat: P.metal, mask: 1, glass: true, elongated: true })],
  [/chainlink_fence|fence|gate_fence/, m => ({ size: [tail(m, /_(\d+)(?:_low|b|c)?$/, 128), 4, 112], color: C.fence, pat: P.metal, mask: 1, glass: true, elongated: true })],
  [/guardrail(\d+)/, m => ({ size: [tail(m, /guardrail(\d+)/, 256), 8, 32], color: C.metal, pat: P.metal, elongated: true })],
  [/railing/, m => ({ size: [tail(m, /_(\d+)(?:_low)?$/, 64), 3, 42], color: C.metal, pat: P.metal, mask: 1, elongated: true })],
  [/ac_unit|roof_ac|ac_powerbox|ac_inset|generator|transformer/, () => ({ size: [64, 40, 48], color: C.metal, pat: P.metal })],
  [/table|desk|workbench/, () => ({ size: [64, 32, 30], color: C.wood, pat: P.wood })],
  [/cupboard|locker|cabinet|shelf|shelves|fridge|vending/, () => ({ size: [48, 24, 72], color: C.metal, pat: P.metal })],
  [/column|pillar/, () => ({ size: [28, 28, 128], cyl: true, color: C.plaster, pat: P.stone })],
  [/breeze_block/, () => ({ size: [32, 12, 32], color: C.plaster, pat: P.concrete })],
  [/wire_spool|spool/, () => ({ size: [48, 48, 40], cyl: true, color: C.wood, pat: P.wood })],
  [/tile_set/, () => ({ size: [48, 48, 24], color: C.plaster, pat: P.roof })],
  [/box|cardboard/, () => ({ size: [24, 24, 24], color: C.crate, pat: P.wood })],
];
export function propSpec(model) {
  const m = model.replace(/^models\//, '').replace(/\.mdl$/, '');
  if (SKIP.test(m)) return null;
  for (const [re, make] of RULES) if (re.test(m)) return make(m);
  return null;
}

// Box or prism in model space, transformed to Source world space: faces (outward) and convex hull planes.
function shape(x0, x1, y0, y1, z0, z1, xf, rot, cyl = false) {
  const ring = cyl ? Array.from({ length: 8 }, (_, i) => { const a = (i + .5) * Math.PI / 4; return [(x0 + x1) / 2 + Math.cos(a) * (x1 - x0) / 2, (y0 + y1) / 2 + Math.sin(a) * (y1 - y0) / 2]; })
    : [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const lo = ring.map(([x, y]) => xf([x, y, z0])), hi = ring.map(([x, y]) => xf([x, y, z1])), faces = [], n = ring.length;
  const up = rot([0, 0, 1]);
  faces.push({ p: hi.slice(), n: up }, { p: lo.slice().reverse(), n: mul(up, -1) });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, [ax, ay] = ring[i], [bx, by] = ring[j];
    const local = [by - ay, -(bx - ax), 0], len = Math.hypot(local[0], local[1]) || 1, nn = rot([local[0] / len, local[1] / len, 0]);
    faces.push({ p: [lo[i], lo[j], hi[j], hi[i]], n: nn });
  }
  return faces.map(f => ({ ...f, d: dot(f.n, f.p[0]) }));
}

function approximateProps(map, nav, report) {
  const { bsp, convert, center, scale, base } = map;
  const plane = (n, d) => [n[0], n[2], -n[1], (d - dot(n, center)) * scale];
  const props = bsp.staticProps().concat(bsp.entities.filter(e => /^(prop_dynamic|prop_physics)/.test(e.classname)).map(e => ({ model: (e.model || '').toLowerCase(), origin: (e.origin || '0 0 0').split(/\s+/).map(Number), angles: (e.angles || '0 0 0').split(/\s+/).map(Number), solid: Number(e.solid ?? 6), scale: Number(e.modelscale) || 1 })));
  const stats = { approximated: 0, solid: 0, shrunk: 0, dropped: 0, unknown: new Map() };
  const overlap = (xf, x0, x1, y0, y1, baseZ) => {
    let hit = 0, total = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const w = xf([x0 + (x1 - x0) * (i + .5) / 4, y0 + (y1 - y0) * (j + .5) / 4, 0]); total++;
      if (navHeightsAt(nav, w[0], w[1]).some(h => Math.abs(h - baseZ) < 14)) hit++;
    }
    return hit / total;
  };
  for (const prop of props) {
    if (!prop.model || bsp.pak.has(prop.model.replace(/\.mdl$/, '.phy')) || prop.origin[2] < base - 512) continue;
    const spec = propSpec(prop.model);
    if (!spec) { stats.unknown.set(prop.model, (stats.unknown.get(prop.model) || 0) + 1); continue; }
    const rot = rotation(prop.angles), s = prop.scale || 1, tilted = Math.abs(prop.angles[0]) > 25 || Math.abs(prop.angles[2]) > 25;
    const xf = p => add(rot(mul(p, s)), prop.origin);
    const out = [];
    let mask = prop.solid && !tilted ? (spec.mask ?? 3) : 0;
    if (spec.tree) {
      const t = spec.tree, r = t.trunk / 2;
      out.push({ faces: shape(-r, r, -r, r, 0, t.height, xf, rot, true), mask: prop.solid ? 3 : 0, color: C.trunk, pat: P.wood });
      const [cx, cy, cz] = t.crown;
      out.push({ faces: shape(-cx / 2, cx / 2, -cy / 2, cy / 2, t.crownAt, t.crownAt + cz, xf, rot, true), mask: 0, color: C.foliage, pat: P.foliage });
    } else {
      let [L, W, H] = spec.size, x0 = -L / 2, x1 = L / 2, y0 = -W / 2, y1 = W / 2;
      const baseZ = prop.origin[2];
      if (mask & 1) {
        // The navigation mesh is ground truth for where players walk: pick the anchor that covers the least walkable
        // floor, shrink once if needed, and leave the prop out when it still blocks a walkway.
        const options = [[x0, x1]];
        if (spec.elongated) options.push([0, L], [-L, 0]);
        let best = null;
        for (const [a, b] of options) { const o = overlap(xf, a, b, y0, y1, baseZ); if (!best || o < best.o) best = { a, b, o }; }
        [x0, x1] = [best.a, best.b];
        if (best.o > .3) {
          const k = .6, cxm = (x0 + x1) / 2, half = (x1 - x0) * k / 2; x0 = cxm - half; x1 = cxm + half; y0 *= k; y1 *= k;
          const o = overlap(xf, x0, x1, y0, y1, baseZ);
          if (o > .3) { stats.dropped++; continue; }
          stats.shrunk++;
        }
      }
      out.push({ faces: shape(x0, x1, y0, y1, 0, H, xf, rot, !!spec.cyl), mask, color: spec.color, pat: spec.pat, glass: !!spec.glass });
    }
    stats.approximated++;
    for (const piece of out) {
      for (const f of piece.faces) {
        const pts = f.p, ax = Math.abs(f.n[0]) > Math.abs(f.n[1]) && Math.abs(f.n[0]) > Math.abs(f.n[2]) ? [1, 2] : Math.abs(f.n[1]) > Math.abs(f.n[2]) ? [0, 2] : [0, 1];
        map.polygons.push({ p: pts.map(convert), n: [f.n[0], f.n[2], -f.n[1]], c: piece.color, glass: !!piece.glass, tag: 'prop', uv: pts.map(p => [p[ax[0]] / 64, p[ax[1]] / 64]), pat: piece.pat });
      }
      if (piece.mask) {
        const pts = piece.faces.flatMap(f => f.p).map(convert), lo = [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))), hi = [0, 1, 2].map(i => Math.max(...pts.map(p => p[i])));
        map.hulls.push({ planes: piece.faces.map(f => plane(f.n, f.d)), min: lo, max: hi, mask: piece.mask });
        stats.solid++;
      }
    }
  }
  report.props = { approximated: stats.approximated, solidPieces: stats.solid, shrunk: stats.shrunk, droppedOnWalkways: stats.dropped, unknownModels: stats.unknown.size, unknownInstances: [...stats.unknown.values()].reduce((s, v) => s + v, 0) };
}

// Keep only the playable area (removes the 3D skybox and far scenery), with a margin for the boundary walls.
function clipToPlay(map, margin = 3) {
  const [x0, z0, x1, z1] = map.playBounds;
  const lo = [x0 - margin, -12, z0 - margin], hi = [x1 + margin, 40, z1 + margin];
  const clip = (vertices, uv, axis, value, sign) => {
    const out = [], ouv = [];
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length], da = (a[axis] - value) * sign, db = (b[axis] - value) * sign;
      if (da >= -1e-7) { out.push(a); if (uv) ouv.push(uv[i]); }
      if ((da < 0) !== (db < 0)) { const t = da / (da - db); out.push(a.map((v, j) => v + (b[j] - v) * t)); if (uv) { const ua = uv[i], ub = uv[(i + 1) % uv.length]; ouv.push([ua[0] + (ub[0] - ua[0]) * t, ua[1] + (ub[1] - ua[1]) * t]); } }
    }
    return [out, uv ? ouv : null];
  };
  map.polygons = map.polygons.flatMap(face => {
    let p = face.p, uv = face.uv || null;
    for (let axis = 0; axis < 3; axis++) { [p, uv] = clip(p, uv, axis, lo[axis], 1); if (p.length < 3) return []; [p, uv] = clip(p, uv, axis, hi[axis], -1); if (p.length < 3) return []; }
    return [{ ...face, p, ...(uv ? { uv } : {}) }];
  });
  map.hulls = map.hulls.filter(h => h.min.every((v, i) => v <= hi[i]) && h.max.every((v, i) => v >= lo[i]));
  map.bounds = [...lo, ...hi];
}

// Each navigation link is walked with the game's own ground movement (friction 5.2, acceleration 5.5, gravity, 0.5 m
// steps, the same as physics() in index.html), from the centre and from 6 cm to each side.
// Links that the body cannot actually cross (an invisible player clip on a kerb, a step that is a bit too tall) are
// removed, so bots never plan through them. Spawns and bombsites must stay connected afterwards.
function pruneNavigation(map) {
  const nav = map.navigation, read = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
  const X = read(nav.x, Float32Array), Z = read(nav.z, Float32Array), H = read(nav.height, Float32Array), L = read(nav.links, Int32Array), n = X.length;
  const native = new globalThis.SourceMaps.NativeMap(packMap(map));
  class V { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
  const dt = 1 / 128, step = (e, wx, wz, maxS, world = native) => {
    if (e.onGround) {
      const sp = Math.hypot(e.vel.x, e.vel.z);
      if (sp > 0) { const ns = Math.max(0, sp - Math.max(sp, 2.032) * 5.2 * dt); e.vel.x *= ns / sp; e.vel.z *= ns / sp; }
      const add = maxS - (e.vel.x * wx + e.vel.z * wz);
      if (add > 0) { const as = Math.min(5.5 * maxS * dt, add); e.vel.x += as * wx; e.vel.z += as * wz; }
    } else { const add = Math.min(.762, maxS) - (e.vel.x * wx + e.vel.z * wz); if (add > 0) { const a = Math.min(add, 12 * maxS * dt); e.vel.x += wx * a; e.vel.z += wz * a; } }
    e.vel.y -= 20.32 * dt; world.move(e, dt, .3, .5);
  };
  const walk = (a, b) => {
    const ux = X[b] - X[a], uz = Z[b] - Z[a], ul = Math.hypot(ux, uz) || 1;
    for (const off of [-.06, 0, .06]) {
      const x = X[a] - uz / ul * off, z = Z[a] + ux / ul * off, y = native.ground(x, z, H[a]);
      if (native.overlap(x, y + .005, z, 1.8, .3)) continue;
      const e = { pos: new V(x, y + .002, z), vel: new V(), h: 1.8, onGround: true }; let ok = false;
      for (let f = 0; f < 250 && !ok; f++) { const dx = X[b] - e.pos.x, dz = Z[b] - e.pos.z, d = Math.hypot(dx, dz); if (d < .12) { ok = Math.abs(e.pos.y - H[b]) < .6; break; } step(e, dx / d, dz / d, Math.min(4.5, d * 10)); }
      if (!ok) return false;
    }
    return true;
  };
  let cut = 0;
  for (let a = 0; a < n; a++) for (let d = 0; d < 4; d++) { const b = L[a * 4 + d]; if (b < 0) continue; if (!walk(a, b)) { L[a * 4 + d] = -1; cut++; } }
  const nearest = (x, z, y) => { let best = -1, bd = Infinity; for (let i = 0; i < n; i++) { const dd = (X[i] - x) ** 2 + (Z[i] - z) ** 2 + (H[i] - y) ** 2; if (dd < bd) { bd = dd; best = i; } } return best; };
  const reach = new Uint8Array(n), queue = [nearest(map.t[0][0], map.t[0][1], map.t[0][3])]; reach[queue[0]] = 1;
  while (queue.length) { const a = queue.pop(); for (let d = 0; d < 4; d++) { const b = L[a * 4 + d]; if (b >= 0 && !reach[b]) { reach[b] = 1; queue.push(b); } } }
  const goals = map.ct.map(p => nearest(p[0], p[1], p[3])).concat(map.sites.map(s => nearest((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, s.y0)));
  if (!goals.every(g => reach[g])) throw Error(map.key + ': pruning the navigation disconnected a spawn or bombsite');
  nav.links = Buffer.from(L.buffer).toString('base64');
  map.report.navigationPruned = cut + followRoutes(map, step, V);
}

// The bots' own route search (breadth-first, same neighbour order as dmFindPath in index.html) from the attackers'
// spawn to the defenders' spawn and to every bombsite, followed continuously with the game's movement. Wherever the
// body stops (a cell that only just fits beside a slanted clip), that link is removed and the route is searched again.
function followRoutes(map, stepFn, V) {
  const native = new globalThis.SourceMaps.NativeMap(packMap(map)), nav = native.buildNav(1, 1), from = map.t[0];
  const targets = [map.ct[0], ...map.sites.map(s => [(s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, 0, NaN])];
  const bfs = (start, goal) => {
    const parent = new Int32Array(nav.x.length).fill(-2), queue = [start]; parent[start] = -1;
    for (let head = 0; head < queue.length && parent[goal] === -2; head++) { const id = queue[head]; for (let d = 0; d < 4; d++) { const next = nav.links[id * 4 + d]; if (next >= 0 && parent[next] === -2) { parent[next] = id; queue.push(next); } } }
    if (parent[goal] === -2) return null; const path = []; for (let id = goal; id !== start && id >= 0; id = parent[id]) path.push(id); return path.reverse();
  };
  const unlink = (a, b) => { for (let d = 0; d < 4; d++) { if (nav.links[a * 4 + d] === b) nav.links[a * 4 + d] = -1; if (nav.links[b * 4 + d] === a) nav.links[b * 4 + d] = -1; } };
  let cut = 0;
  const step = (e, wx, wz, maxS) => stepFn(e, wx, wz, maxS, native);
  for (const goal of targets) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const y0 = native.ground(from[0], from[1], from[3]), e = { pos: new V(from[0], y0, from[1]), vel: new V(), h: 1.8, onGround: true };
      const gy = Number.isFinite(goal[3]) ? goal[3] : native.ground(goal[0], goal[1]);
      const start = native.cell(nav, e.pos.x, e.pos.z, e.pos.y), end = native.cell(nav, goal[0], goal[1], gy), path = bfs(start, end);
      if (!path) throw Error(map.key + ': no route from the attackers to a goal after pruning');
      let stuck = -1, prev = start;
      for (const id of path) {
        let frames = 0;
        while (Math.hypot(nav.x[id] - e.pos.x, nav.z[id] - e.pos.z) > .12 && frames++ < 400) { const dx = nav.x[id] - e.pos.x, dz = nav.z[id] - e.pos.z, d = Math.hypot(dx, dz); step(e, dx / d, dz / d, 4.5); }
        if (frames >= 400) { stuck = id; break; }
        prev = id;
      }
      if (stuck < 0) break;
      unlink(prev, stuck); cut++;
    }
  }
  map.navigation.links = Buffer.from(nav.links.buffer, nav.links.byteOffset, nav.links.byteLength).toString('base64');
  return cut;
}

export function importWingmanMap(file, key) {
  const info = WINGMAN_MAPS[key];
  const map = compileSourceMap(file, key, { textures: true });
  map.name = info.name; map.credit = info.credit;
  const navFile = [...map.bsp.pak.keys()].find(k => k.endsWith('.nav'));
  if (!navFile) throw Error(key + ': no navigation mesh');
  const nav = readNav(map.bsp.asset(navFile));
  approximateProps(map, nav, map.report);
  bakeNavigation(map);
  clipToPlay(map);
  delete map.navigation; bakeNavigation(map);
  // Spawn points in some BSPs float up to ~1.6 m above the floor (in CS the player drops); put them on the ground.
  { const native = new globalThis.SourceMaps.NativeMap(packMap(map)); for (const p of map.t.concat(map.ct)) { const y = native.ground(p[0], p[1], p[3]); if (p[3] - y > .05 && p[3] - y < 3) p[3] = y; } }
  pruneNavigation(map);
  delete map.bsp; delete map.convert;
  return map;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const args = process.argv.slice(2), keys = Object.keys(WINGMAN_MAPS);
  if (args.length !== keys.length) throw Error('Usage: node tools/import-wingman-maps.mjs ' + keys.map(k => '<' + WINGMAN_MAPS[k].file + '>').join(' '));
  const out = resolve(import.meta.dirname, '../assets/maps'); mkdirSync(out, { recursive: true });
  const catalog = {};
  for (const [i, key] of keys.entries()) {
    const map = importWingmanMap(resolve(args[i]), key), packed = packMap(map), bytes = gzipSync(Buffer.from(JSON.stringify(packed)), { level: 9 });
    catalog[key] = { name: map.name, credit: map.credit, ax: map.ax, az: map.az, t: map.t, ct: map.ct, sites: map.sites };
    writeFileSync(resolve(out, key + '.js'), '// Generated from a user-supplied BSP (used with the author\'s permission). Light procedural textures, no images.\n(globalThis.SOURCE_MAP_PAYLOADS??={}).' + key + '=' + JSON.stringify(bytes.toString('base64')) + ';\n');
    const tris = Buffer.from(packed.mesh.index, 'base64').length / 12;
    console.log(key, bytes.length + ' bytes gzipped', tris + ' triangles', map.hulls.length + ' hulls', 'nav links cut ' + map.report.navigationPruned, JSON.stringify(map.report.props), 'nav', JSON.stringify(map.report.navigation && { nodes: map.report.navigation.nodes, spawns: map.report.navigation.spawnsConnected + '/' + map.report.navigation.spawnsTotal }));
  }
  writeFileSync(resolve(out, 'catalog.js'), '// Metadata only: the geometry is loaded when a map is played.\nglobalThis.SOURCE_MAP_CATALOG=' + JSON.stringify(catalog) + ';\n');
}
