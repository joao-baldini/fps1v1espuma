// Converts the four Wingman BSPs supplied by the user (used with the authors' permission) into the game's map format.
// Usage: node tools/import-wingman-maps.mjs <wg_sanctum.bsp> <wg_neon.bsp> <wg_forge.bsp> <wg_overgrowth.bsp>
// Geometry, collision, spawns and bombsites come from each BSP. Stock CS:GO props are not inside the files, so the
// common cover props (crates, barrels, hedges, cars, barriers, rocks, fences, railings, trees...) are approximated by
// boxes and prisms from rules on the model name, and checked against the map's own navigation mesh (.nav): a prop that
// would cover walkable floor is shrunk or left out. Surfaces get light procedural textures (no images).
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { compileSourceMap, rotation, PATTERNS } from './source-bsp.mjs';
import { readNav } from './source-nav.mjs';
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

// Walkable points of the original CS navigation mesh (every 12 units), hashed in 64-unit cells.
function walkSamples(nav) {
  const cells = new Map(), key = (x, y) => Math.floor(x / 64) + ',' + Math.floor(y / 64);
  for (const a of nav.areas) {
    for (let x = a.x0 + 4; x <= a.x1 - 4 + 1e-6; x += 12) for (let y = a.y0 + 4; y <= a.y1 - 4 + 1e-6; y += 12) {
      const u = (x - a.x0) / Math.max(1e-6, a.x1 - a.x0), v = (y - a.y0) / Math.max(1e-6, a.y1 - a.y0);
      const north = a.z[0] + (a.z[1] - a.z[0]) * u, south = a.z[3] + (a.z[2] - a.z[3]) * u, z = north + (south - north) * v, k = key(x, y);
      if (!cells.has(k)) cells.set(k, []); cells.get(k).push([x, y, z]);
    }
  }
  return { near(x, y, r) { const out = []; for (let i = Math.floor((x - r) / 64); i <= Math.floor((x + r) / 64); i++) for (let j = Math.floor((y - r) / 64); j <= Math.floor((y + r) / 64); j++) for (const p of cells.get(i + ',' + j) || []) out.push(p); return out; } };
}

export function approximateProps(map, nav, report) {
  const { bsp, convert, center, scale, base } = map;
  const plane = (n, d) => [n[0], n[2], -n[1], (d - dot(n, center)) * scale];
  const props = bsp.staticProps().concat(bsp.entities.filter(e => /^(prop_dynamic|prop_physics)/.test(e.classname)).map(e => ({ model: (e.model || '').toLowerCase(), origin: (e.origin || '0 0 0').split(/\s+/).map(Number), angles: (e.angles || '0 0 0').split(/\s+/).map(Number), solid: Number(e.solid ?? 6), scale: Number(e.modelscale) || 1 })));
  const stats = { approximated: 0, solid: 0, shrunk: 0, dropped: 0, buried: 0, unknown: new Map() };
  const samples = walkSamples(nav), world = new globalThis.SourceMaps.NativeMap(packMap(map));
  const spawns = map.t.concat(map.ct).map(p => [p[0] / scale + center[0], center[1] - p[1] / scale, p[3] / scale + center[2]]);
  // A piece is wrong when a point where CS players walk lies inside it at body height (its top may be walkable), or
  // when most of it is buried in the map's own solids: then it is shrunk, tried at another anchor, or left out.
  const check = (xf, toLocal, s, b) => {
    const [x0, x1, y0, y1, z0, z1] = b, c = xf([(x0 + x1) / 2, (y0 + y1) / 2, 0]), r = Math.hypot(x1 - x0, y1 - y0) * s / 2 + 8;
    if (z1 - z0 > 18) for (const p of samples.near(c[0], c[1], r)) {
      const q = toLocal(p);
      if (q[0] > x0 + 4 && q[0] < x1 - 4 && q[1] > y0 + 4 && q[1] < y1 - 4 && q[2] > z0 - 64 && q[2] < z1 - 8) return false;
    }
    // Nothing solid where a player spawns (body radius 12 units plus a margin).
    for (const p of spawns) { const q = toLocal(p); if (q[0] > x0 - 18 / s && q[0] < x1 + 18 / s && q[1] > y0 - 18 / s && q[1] < y1 + 18 / s && q[2] > z0 - 72 && q[2] < z1) return false; }
    let inside = 0, total = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      const g = convert(xf([x0 + (x1 - x0) * (.2 + .3 * i), y0 + (y1 - y0) * (.2 + .3 * j), z0 + (z1 - z0) * (.2 + .3 * k)])); total++;
      if (world.overlap(g[0], g[1], g[2], .02, .02)) inside++;
    }
    return inside / total < .35 ? true : 'buried';
  };
  for (const prop of props) {
    if (!prop.model || bsp.pak.has(prop.model.replace(/\.mdl$/, '.phy')) || prop.origin[2] < base - 512) continue;
    const spec = propSpec(prop.model);
    if (!spec) { stats.unknown.set(prop.model, (stats.unknown.get(prop.model) || 0) + 1); continue; }
    const rot = rotation(prop.angles), s = prop.scale || 1, tilted = Math.abs(prop.angles[0]) > 25 || Math.abs(prop.angles[2]) > 25;
    const xf = p => add(rot(mul(p, s)), prop.origin), ax = [rot([1, 0, 0]), rot([0, 1, 0]), rot([0, 0, 1])];
    const toLocal = p => { const d = [p[0] - prop.origin[0], p[1] - prop.origin[1], p[2] - prop.origin[2]]; return ax.map(a => dot(d, a) / s); };
    // A box standing in for a model only reads right upright: tipped-over or hanging props are left out.
    if (tilted) { stats.tilted = (stats.tilted || 0) + 1; continue; }
    const solid = !!prop.solid;
    const pieces = spec.tree
      ? [{ b: [-spec.tree.trunk / 2, spec.tree.trunk / 2, -spec.tree.trunk / 2, spec.tree.trunk / 2, 0, spec.tree.height], cyl: true, mask: solid ? 3 : 0, color: C.trunk, pat: P.wood },
         { b: [-spec.tree.crown[0] / 2, spec.tree.crown[0] / 2, -spec.tree.crown[1] / 2, spec.tree.crown[1] / 2, spec.tree.crownAt, spec.tree.crownAt + spec.tree.crown[2]], cyl: true, mask: 0, color: C.foliage, pat: P.foliage }]
      : [{ b: [-spec.size[0] / 2, spec.size[0] / 2, -spec.size[1] / 2, spec.size[1] / 2, 0, spec.size[2]], cyl: !!spec.cyl, mask: solid && spec.size[2] > 18 ? (spec.mask ?? 3) : 0, color: spec.color, pat: spec.pat, elongated: spec.elongated }];
    const out = [];
    let ok = true;
    for (const piece of pieces) {
      const [x0, x1, y0, y1, z0, z1] = piece.b, L = x1 - x0, options = [[x0, x1, y0, y1]];
      if (piece.elongated) options.push([0, L, y0, y1], [-L, 0, y0, y1]);
      for (const [a, b2, c, d] of options.slice()) { const k = .6, mx = (a + b2) / 2, my = (c + d) / 2; options.push([mx - (b2 - a) * k / 2, mx + (b2 - a) * k / 2, my - (d - c) * k / 2, my + (d - c) * k / 2]); }
      let chosen = null, buried = false;
      for (const [i, o] of options.entries()) { const r = check(xf, toLocal, s, [...o, z0, z1]); if (r === true) { chosen = o; if (i >= options.length / 2) stats.shrunk++; break; } if (r === 'buried') buried = true; }
      if (!chosen) { ok = false; if (buried) stats.buried++; else stats.dropped++; break; }
      out.push({ ...piece, faces: shape(chosen[0], chosen[1], chosen[2], chosen[3], z0, z1, xf, rot, piece.cyl) });
    }
    if (!ok) continue;
    stats.approximated++;
    for (const piece of out) {
      for (const f of piece.faces) {
        const pts = f.p, uvAxes = Math.abs(f.n[0]) > Math.abs(f.n[1]) && Math.abs(f.n[0]) > Math.abs(f.n[2]) ? [1, 2] : Math.abs(f.n[1]) > Math.abs(f.n[2]) ? [0, 2] : [0, 1];
        map.polygons.push({ p: pts.map(convert), n: [f.n[0], f.n[2], -f.n[1]], c: piece.color, glass: false, tag: 'prop', uv: pts.map(p => [p[uvAxes[0]] / 64, p[uvAxes[1]] / 64]), pat: piece.pat });
      }
      if (piece.mask) {
        const pts = piece.faces.flatMap(f => f.p).map(convert), lo = [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))), hi = [0, 1, 2].map(i => Math.max(...pts.map(p => p[i])));
        map.hulls.push({ planes: piece.faces.map(f => plane(f.n, f.d)), min: lo, max: hi, mask: piece.mask, src: 'approx:' + prop.model });
        stats.solid++;
      }
    }
  }
  report.props = { approximated: stats.approximated, tilted: stats.tilted || 0, solidPieces: stats.solid, shrunk: stats.shrunk, droppedOnWalkways: stats.dropped, droppedBuried: stats.buried, unknownModels: stats.unknown.size, unknownInstances: [...stats.unknown.values()].reduce((s, v) => s + v, 0) };
}

// Floors that CS players stand on but that are missing here: the tops of stock props (stairs, crates, scaffold walkways)
// that are not inside the file. Each CS navigation area with no floor under most of its points becomes a solid block
// shaped by the area itself (sloped top for stairs and ramps), down to the floor below, or a slab when CS players also
// walk underneath it. This restores the routes up to raised areas that the approximation alone could not.
function restoreWalkSurfaces(map, nav) {
  const { convert, scale } = map, world = new globalThis.SourceMaps.NativeMap(packMap(map)), samples = walkSamples(nav);
  let blocks = 0, buried = 0, skipped = 0;
  for (const a of nav.areas) {
    const w = a.x1 - a.x0, d = a.y1 - a.y0; if (w < 6 || d < 6) continue;
    const zAt = (x, y) => { const u = (x - a.x0) / w, v = (y - a.y0) / d, n = a.z[0] + (a.z[1] - a.z[0]) * u, s = a.z[3] + (a.z[2] - a.z[3]) * u; return n + (s - n) * v; };
    let missing = 0, total = 0, below = -Infinity;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x = a.x0 + w * (.2 + .3 * i), y = a.y0 + d * (.2 + .3 * j), z = zAt(x, y), g = convert([x, y, z]); total++;
      const fl = world.floors(g[0], g[2], g[1] - 30 * scale, g[1] + 10 * scale);
      if (!fl.length) { missing++; const lower = world.floors(g[0], g[2], g[1] - 600 * scale, g[1] - 30 * scale); below = Math.max(below, lower.length ? lower.at(-1) / scale : -Infinity); }
    }
    if (missing / total < .6) continue;
    const top = Math.min(...a.z), cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2;
    let bottom = Number.isFinite(below) ? below + map.base : top - 600; // floor heights come back in game metres / scale
    // CS players walking under this area keep their headroom: the block becomes a slab above them.
    for (const p of samples.near(cx, cy, Math.hypot(w, d) / 2)) if (p[0] > a.x0 + 2 && p[0] < a.x1 - 2 && p[1] > a.y0 + 2 && p[1] < a.y1 - 2 && p[2] < top - 20) bottom = Math.max(bottom, p[2] + 74);
    bottom = Math.min(bottom, top - 4);
    // Least-squares plane through the four corners (game coordinates), so stairs become an even ramp.
    const corners = [[a.x0, a.y0, a.z[0]], [a.x1, a.y0, a.z[1]], [a.x1, a.y1, a.z[2]], [a.x0, a.y1, a.z[3]]].map(convert);
    const mx = corners.reduce((s, c) => s + c[0], 0) / 4, mz = corners.reduce((s, c) => s + c[2], 0) / 4, my = corners.reduce((s, c) => s + c[1], 0) / 4;
    let sxx = 0, szz = 0, sxy = 0, szy = 0; for (const c of corners) { sxx += (c[0] - mx) ** 2; szz += (c[2] - mz) ** 2; sxy += (c[0] - mx) * (c[1] - my); szy += (c[2] - mz) * (c[1] - my); }
    const ga = sxx ? sxy / sxx : 0, gb = szz ? szy / szz : 0, yTop = (x, z) => my + ga * (x - mx) + gb * (z - mz);
    // Only even, walkable surfaces (CS walkable slopes stay under 45 degrees); twisted or steep areas are left out.
    if (Math.hypot(ga, gb) > .9 || corners.some(c => Math.abs(yTop(c[0], c[2]) - c[1]) > 6 * scale)) { skipped++; continue; }
    const lo = convert([a.x0, a.y1, bottom]), hi = convert([a.x1, a.y0, bottom]), x0 = lo[0], x1 = hi[0], z0 = lo[2], z1 = hi[2], yb = lo[1];
    // Interior mostly inside the map's own solids: the floor exists in another form, leave it.
    let inside = 0; for (const fx of [.25, .5, .75]) for (const fz of [.25, .5, .75]) { const x = x0 + (x1 - x0) * fx, z = z0 + (z1 - z0) * fz, y = (yb + yTop(x, z)) / 2; if (world.overlap(x, y, z, .02, .02)) inside++; }
    if (inside > 3) { buried++; continue; }
    const Y = (x, z) => yTop(x, z), thick = (my - yb) / scale, slope = Math.hypot(ga, gb);
    const [col, pat] = thick < 26 ? [C.metal, P.metal] : slope > .12 ? [C.concrete, P.concrete ?? P.stone] : [C.crate, P.wood];
    const T = [[x0, Y(x0, z0), z0], [x1, Y(x1, z0), z0], [x1, Y(x1, z1), z1], [x0, Y(x0, z1), z1]], Bt = T.map(p => [p[0], yb, p[2]]);
    const quad = (pts, n) => { const ax = Math.abs(n[0]) > .5 ? [2, 1] : Math.abs(n[2]) > .5 ? [0, 1] : [0, 2]; map.polygons.push({ p: pts, n, c: col, glass: false, tag: 'prop', uv: pts.map(q => [q[ax[0]] / (64 * scale), q[ax[1]] / (64 * scale)]), pat }); };
    const nl = Math.hypot(ga, 1, gb), up = [-ga / nl, 1 / nl, -gb / nl];
    const boxFaces = (xa, xb, za, zb, ylo, yhi) => {
      quad([[xa, yhi, zb], [xb, yhi, zb], [xb, yhi, za], [xa, yhi, za]], [0, 1, 0]);
      quad([[xa, ylo, za], [xb, ylo, za], [xb, yhi, za], [xa, yhi, za]], [0, 0, -1]); quad([[xb, ylo, zb], [xa, ylo, zb], [xa, yhi, zb], [xb, yhi, zb]], [0, 0, 1]);
      quad([[xa, ylo, zb], [xa, ylo, za], [xa, yhi, za], [xa, yhi, zb]], [-1, 0, 0]); quad([[xb, ylo, za], [xb, ylo, zb], [xb, yhi, zb], [xb, yhi, za]], [1, 0, 0]);
    };
    if (slope > .12) {
      // Sloped areas were stairs: drawn as steps of about 20 cm (the collision stays the even ramp, as CS stair clips).
      const alongX = Math.abs(ga) >= Math.abs(gb), len = alongX ? x1 - x0 : z1 - z0, n = Math.max(2, Math.round(Math.abs(alongX ? ga : gb) * len / .2));
      for (let k = 0; k < n; k++) {
        const a0 = k / n, a1 = (k + 1) / n, top = alongX ? Y(x0 + len * (a0 + a1) / 2, (z0 + z1) / 2) : Y((x0 + x1) / 2, z0 + len * (a0 + a1) / 2);
        if (alongX) boxFaces(x0 + len * a0, x0 + len * a1, z0, z1, yb, top); else boxFaces(x0, x1, z0 + len * a0, z0 + len * a1, yb, top);
      }
    } else {
      quad([T[3], T[2], T[1], T[0]], up);
      quad([Bt[0], Bt[1], T[1], T[0]], [0, 0, -1]); quad([Bt[2], Bt[3], T[3], T[2]], [0, 0, 1]);
      quad([Bt[3], Bt[0], T[0], T[3]], [-1, 0, 0]); quad([Bt[1], Bt[2], T[2], T[1]], [1, 0, 0]);
    }
    const ys = T.map(p => p[1]);
    map.hulls.push({ planes: [[up[0], up[1], up[2], up[0] * mx + up[1] * my + up[2] * mz], [0, -1, 0, -yb], [1, 0, 0, x1], [-1, 0, 0, -x0], [0, 0, 1, z1], [0, 0, -1, -z0]], min: [x0, yb, z0], max: [x1, Math.max(...ys), z1], mask: 3, src: 'navfloor:' + a.id });
    blocks++;
  }
  map.report.restored = { blocks, buried, skipped };
}

// Everywhere a player can get to in the conversion, flooded on a 25 cm grid from the spawns: walking (0.5 m steps),
// dropping to the floor below and jumping up to 1.25 m where there is head room.
export function playerReach(world, S = .25, JUMP = 1.25) {
  const [bx0, by0, bz0, bx1, by1, bz1] = world.meta.bounds, nx = Math.ceil((bx1 - bx0) / S), nz = Math.ceil((bz1 - bz0) / S);
  const X = i => bx0 + (i + .5) * S, Z = j => bz0 + (j + .5) * S, memo = new Map();
  const floors = (i, j) => { const k = i * nz + j; let f = memo.get(k); if (!f) { f = world.floors(X(i), Z(j), by0 - 1, by1 + 1).map(y => ({ y, free: !world.overlap(X(i), y + .46, Z(j), 1.3, .28) })); memo.set(k, f); } return f; };
  const seen = new Map(), queue = [], edges = [], id = (i, j, y) => i + ',' + j + ',' + Math.round(y * 20);
  const push = (i, j, y) => { const k = id(i, j, y); if (seen.has(k)) return false; seen.set(k, [i, j, y]); queue.push([i, j, y]); return true; };
  for (const s of world.meta.t.concat(world.meta.ct)) { const i = Math.floor((s[0] - bx0) / S), j = Math.floor((s[1] - bz0) / S), f = floors(i, j).filter(v => v.free && Math.abs(v.y - s[3]) < .6); if (f.length) push(i, j, f[0].y); }
  while (queue.length) {
    const [i, j, y] = queue.pop(), x = X(i), z = Z(j);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const all = floors(a, b), land = all.filter(v => v.y <= y + .5), next = all.filter(v => v.y > y + .5 && v.y <= y + JUMP && v.free).map(v => v.y);
      if (land.length && land.at(-1).free && land.at(-1).y > y - 6) next.push(land.at(-1).y);
      for (const ny of next) {
        if (ny > y + .5 && world.overlap(x, y + .46, z, ny - y + 1.3, .28)) continue;
        if (world.overlap((x + X(a)) / 2, Math.max(y, ny) + .46, (z + Z(b)) / 2, 1.3, .28)) continue;
        edges.push([i, j, y, a, b, ny]); push(a, b, ny);
      }
    }
  }
  return { S, bx0, bz0, X, Z, cells: [...seen.values()], edges };
}

// Where players can get to in the conversion but the original CS navigation has no walkable floor nearby (the fence,
// wall or cover there was a stock prop missing from the file, or it is the way out of the map), a visible grate panel
// closes the border: it blocks the body (also against jumps) and lets bullets through, like a fence.
function fenceOffMap(map, nav) {
  const samples = walkSamples(nav), toSource = (x, y, z) => [x / map.scale + map.center[0], map.center[1] - z / map.scale, y / map.scale + map.center[2]];
  const offCache = new Map(), off = (x, y, z) => { const k = x.toFixed(3) + ',' + z.toFixed(3) + ',' + y.toFixed(2); let v = offCache.get(k); if (v === undefined) { const [sx, sy, sz] = toSource(x, y, z); v = !samples.near(sx, sy, 40).some(p => Math.abs(p[0] - sx) <= 40 && Math.abs(p[1] - sy) <= 40 && Math.abs(p[2] - sz) < 48); offCache.set(k, v); } return v; };
  let panels = 0, offCells = 0;
  for (let pass = 0; pass < 3; pass++) {
    const reach = playerReach(new globalThis.SourceMaps.NativeMap(packMap(map))), { S, bx0, bz0, X, Z } = reach;
    offCells = reach.cells.filter(([i, j, y]) => off(X(i), y, Z(j))).length;
    // Border segments on the grid lines between a legit cell and an off-map cell, merged along each line.
    const lines = new Map();
    for (const [i, j, y, a, b, ny] of reach.edges) {
      if (off(X(i), y, Z(j)) || !off(X(a), ny, Z(b))) continue;
      const alongZ = a !== i, line = alongZ ? 'x' + Math.max(i, a) : 'z' + Math.max(j, b), at = alongZ ? j : i;
      if (!lines.has(line)) lines.set(line, []); lines.get(line).push([at, Math.min(y, ny), Math.max(y, ny)]);
    }
    if (!lines.size) break;
    for (const [line, segs] of lines) {
      segs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      const runs = [];
      for (const [at, y0, y1] of segs) { const r = runs.find(r => at <= r.end + 1 && Math.abs(r.y0 - y0) < 1.2); if (r) { r.end = Math.max(r.end, at); r.y0 = Math.min(r.y0, y0); r.y1 = Math.max(r.y1, y1); } else runs.push({ start: at, end: at, y0, y1 }); }
      const v = +line.slice(1);
      for (const r of runs) {
        const y0 = r.y0 - .2, y1 = r.y1 + 3, w0 = (r.start) * S, w1 = (r.end + 1) * S;
        if (line[0] === 'x') { const x = bx0 + v * S; box(map, [x - .03, y0, bz0 + w0], [x + .03, y1, bz0 + w1]); } else { const z = bz0 + v * S; box(map, [bx0 + w0, y0, z - .03], [bx0 + w1, y1, z + .03]); }
        panels++;
      }
    }
  }
  map.report.grates = { offCells, panels };
}

function box(map, lo, hi) {
  const B = map.bounds; lo = lo.map((v, i) => Math.max(v, B[i])); hi = hi.map((v, i) => Math.min(v, B[i + 3]));
  if (lo.some((v, i) => v >= hi[i])) return;
  const P = (x, y, z) => [x, y, z], [a, b, c] = lo, [d, e, f] = hi, col = 0x8b939a;
  const quads = [[[P(d, b, c), P(d, e, c), P(d, e, f), P(d, b, f)], [1, 0, 0]], [[P(a, b, f), P(a, e, f), P(a, e, c), P(a, b, c)], [-1, 0, 0]], [[P(a, e, c), P(a, e, f), P(d, e, f), P(d, e, c)], [0, 1, 0]], [[P(a, b, c), P(d, b, c), P(d, b, f), P(a, b, f)], [0, -1, 0]], [[P(a, b, f), P(d, b, f), P(d, e, f), P(a, e, f)], [0, 0, 1]], [[P(a, b, c), P(a, e, c), P(d, e, c), P(d, b, c)], [0, 0, -1]]];
  for (const [pts, nn] of quads) { const ax = Math.abs(nn[0]) ? [2, 1] : Math.abs(nn[1]) ? [0, 2] : [0, 1]; map.polygons.push({ p: pts, n: nn, c: col, glass: false, tag: 'grate', uv: pts.map(q => [q[ax[0]] * 1.6, q[ax[1]] * 1.6]), pat: P_METAL }); }
  map.hulls.push({ planes: [[1, 0, 0, d], [-1, 0, 0, -a], [0, 1, 0, e], [0, -1, 0, -b], [0, 0, 1, f], [0, 0, -1, -c]], min: [a, b, c], max: [d, e, f], mask: 1, src: 'grate' });
}
const P_METAL = PATTERNS.metal;

// Keep only the playable area (removes the 3D skybox and far scenery), with a margin for the boundary walls.
function clipToPlay(map, margin = 3) {
  const [x0, z0, x1, z1] = map.playBounds;
  clipBox(map, [x0 - margin, -12, z0 - margin], [x1 + margin, 40, z1 + margin]);
}

function clipBox(map, lo, hi) {
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
  // Hulls are cut at the same box, so nothing solid lies outside the map's bounds (and its spatial grid).
  map.hulls = map.hulls.filter(h => h.min.every((v, i) => v <= hi[i]) && h.max.every((v, i) => v >= lo[i])).map(h => {
    if (h.min.every((v, i) => v >= lo[i]) && h.max.every((v, i) => v <= hi[i])) return h;
    const planes = h.planes.slice();
    for (let i = 0; i < 3; i++) { const n = [0, 0, 0]; if (h.max[i] > hi[i]) { n[i] = 1; planes.push([...n, hi[i]]); } if (h.min[i] < lo[i]) { const m = [0, 0, 0]; m[i] = -1; planes.push([...m, -lo[i]]); } }
    return { ...h, planes, min: h.min.map((v, i) => Math.max(v, lo[i])), max: h.max.map((v, i) => Math.min(v, hi[i])) };
  });
  map.bounds = [...lo, ...hi];
}

// Each navigation link is walked with the game's own ground movement (friction 5.2, acceleration 5.5, gravity, 0.5 m
// steps, the same as physics() in index.html), from the centre and from 6 cm to each side.
// Links that the body cannot actually cross (an invisible player clip on a kerb, a step that is a bit too tall) are
// removed, so bots never plan through them. Spawns and bombsites must stay connected afterwards.
export function pruneNavigation(map) {
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
  restoreWalkSurfaces(map, nav);
  bakeNavigation(map);
  clipToPlay(map);
  delete map.navigation; bakeNavigation(map);
  // Spawn points in some BSPs float up to ~1.6 m above the floor (in CS the player drops); put them on the ground.
  { const native = new globalThis.SourceMaps.NativeMap(packMap(map)); for (const p of map.t.concat(map.ct)) { const y = native.ground(p[0], p[1], p[3]); if (p[3] - y > .05 && p[3] - y < 3) p[3] = y; } }
  fenceOffMap(map, nav);
  delete map.navigation; bakeNavigation(map);
  pruneNavigation(map);
  clipBox(map, map.bounds.slice(0, 3), map.bounds.slice(3));
  delete map.bsp; delete map.convert;
  return map;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const args = process.argv.slice(2), keys = Object.keys(WINGMAN_MAPS);
  if (args.length !== keys.length) throw Error('Usage: node tools/import-wingman-maps.mjs ' + keys.map(k => '<' + WINGMAN_MAPS[k].file + '>').join(' '));
  const out = resolve(import.meta.dirname, '../assets/maps'); mkdirSync(out, { recursive: true });
  // Os mapas originais (tools/build-*.mjs) continuam no catálogo, na frente.
  const previous = {}; try { new Function('globalThis', readFileSync(resolve(out, 'catalog.js'), 'utf8'))(previous); } catch {}
  const catalog = Object.fromEntries(Object.entries(previous.SOURCE_MAP_CATALOG || {}).filter(([, v]) => v.original));
  for (const [i, key] of keys.entries()) {
    const map = importWingmanMap(resolve(args[i]), key), packed = packMap(map), bytes = gzipSync(Buffer.from(JSON.stringify(packed)), { level: 9 });
    catalog[key] = { name: map.name, credit: map.credit, ax: map.ax, az: map.az, t: map.t, ct: map.ct, sites: map.sites };
    writeFileSync(resolve(out, key + '.js'), '// Generated from a user-supplied BSP (used with the author\'s permission). Light procedural textures, no images.\n(globalThis.SOURCE_MAP_PAYLOADS??={}).' + key + '=' + JSON.stringify(bytes.toString('base64')) + ';\n');
    const tris = Buffer.from(packed.mesh.index, 'base64').length / 12;
    console.log(key, bytes.length + ' bytes gzipped', tris + ' triangles', map.hulls.length + ' hulls', 'nav links cut ' + map.report.navigationPruned, 'grates ' + JSON.stringify(map.report.grates), 'restored ' + JSON.stringify(map.report.restored), JSON.stringify(map.report.props), 'nav', JSON.stringify(map.report.navigation && { nodes: map.report.navigation.nodes, spawns: map.report.navigation.spawnsConnected + '/' + map.report.navigation.spawnsTotal }));
  }
  writeFileSync(resolve(out, 'catalog.js'), '// Metadata only: the geometry is loaded when a map is played.\nglobalThis.SOURCE_MAP_CATALOG=' + JSON.stringify(catalog) + ';\n');
}
