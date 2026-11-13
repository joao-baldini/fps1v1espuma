// Sandstone: mapa do Plant the Bomb 5v5, convertido do GLB enviado pelo autor (amogusstrikesback2 no Sketchfab, CC-BY 4.0).
// Uso: node tools/import-sandstone.mjs caminho/chicken_gun_fruzer_sandy.glb
// O GLB tem 818 mil triângulos (cada palmeira vem em 3 níveis de detalhe). Aqui fica só o nível leve das palmeiras, a
// miudeza de decoração (copos, pratos, livros, comida...) sai, e o resto é simplificado por agrupamento de vértices.
// A cor de cada triângulo vem do atlas de cores do modelo; por cima, os padrões procedurais leves do jogo.
// Colisão: prédios, muralha, escadas, morros e tendas pela própria malha; caixas, barris e paletes pela caixa do objeto;
// palmeiras pelo tronco; plantas, portas, janelas e montanhas só na vista.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Gltf } from './gltf.mjs';
import { packMap, bakeNavigation, pruneNavigation } from './import-source-maps.mjs';
import { PATTERNS as PAT } from './source-bsp.mjs';
import '../assets/maps/runtime.js';

const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
const encode = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

// PNG mínimo (8 bits, RGB/RGBA/paleta, sem entrelaçamento) para ler o atlas de cores.
function readPng(buf) {
  let p = 8, w = 0, h = 0, type = 0, palette = null; const idat = [];
  while (p < buf.length) { const n = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[12]) throw Error('PNG não suportado'); type = d[9]; }
    else if (t === 'PLTE') palette = d; else if (t === 'IDAT') idat.push(d); p += 12 + n; }
  const ch = { 2: 3, 6: 4, 3: 1, 0: 1, 4: 2 }[type], raw = inflateSync(Buffer.concat(idat)), stride = w * ch, out = Buffer.alloc(w * h * 3), row = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) { const a = i >= ch ? row[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0; let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[i] = v & 255; }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 3;
      if (type === 3) { const k = row[x] * 3; out[o] = palette[k]; out[o + 1] = palette[k + 1]; out[o + 2] = palette[k + 2]; }
      else if (type === 0 || type === 4) out[o] = out[o + 1] = out[o + 2] = row[x * ch];
      else { out[o] = row[x * ch]; out[o + 1] = row[x * ch + 1]; out[o + 2] = row[x * ch + 2]; } }
    row.copy(prev);
  }
  return { w, h, rgb: out };
}

// Classes de objeto pelo nome do nó do GLB.
const CLASSES = [
  [/LOD[01]/, 'drop'], [/^PalmTree/, 'palm'],
  [/^(Jug|Plate|Cup|Book|Scroll|Food|Garbage|Dryer|Flag|Carpet)/, 'drop'],
  [/^(Plant|FlowerBed)/, 'plant'], [/^(Door|WindowPart)/, 'decal'], [/^(Mountain|PowerLines)/, 'scenery'], [/^Cube/, 'ground'],
  [/^(House|Wall|Stairs|Hill|Tent|Market|Fence|Well|Fountain|Block|Rock|Tile)/, 'mesh'],
  [/^(Box|Barrel|Pallet|Bag|Pot|Table|Desk|Furniture)/, 'prop'],
];
const classOf = name => (CLASSES.find(([re]) => re.test(name)) || [, 'prop'])[1];
// Padrão procedural e escala da textura por tipo (o atlas só dá a cor).
const LOOK = { House: [PAT.concrete, .3], Wall: [PAT.stone, .55], Stairs: [PAT.stone, .8], Tile: [PAT.stone, 1.4], Hill: [PAT.ground, .5], Rock: [PAT.stone, .6], Box: [PAT.wood, 1.4],
  Pallet: [PAT.wood, 1.6], Barrel: [PAT.wood, 1.6], Table: [PAT.wood, 1.4], Desk: [PAT.wood, 1.4], Furniture: [PAT.wood, 1.4], Door: [PAT.wood, 1.6], Fence: [PAT.wood, 1.4],
  Tent: [PAT.plain, .5], Market: [PAT.wood, 1.2], Well: [PAT.stone, .9], Fountain: [PAT.stone, .9], PowerLines: [PAT.plain, .5], Plant: [PAT.foliage, .5], PalmTree: [PAT.foliage, .5], Mountain: [PAT.ground, .05], Cube: [PAT.ground, .5] };
const lookOf = name => LOOK[Object.keys(LOOK).find(k => name.startsWith(k))] || [PAT.plain, .5];

export function readSandstone(file) {
  const g = new Gltf(file), atlas = g.json.images.map((im, i) => { const v = g.json.bufferViews[im.bufferView]; return readPng(g.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)); });
  const texOf = m => g.json.materials[m]?.pbrMetallicRoughness?.baseColorTexture?.index ?? 0;
  const objects = new Map();
  for (const t of g.triangles()) {
    const name = (t.node || '').replace(/_LowPolyFPS2_MAIN_0$|_sand2_0$/, ''); let o = objects.get(t.node);
    if (!o) { o = { name, cls: classOf(name), tris: [] }; objects.set(t.node, o); }
    if (o.cls === 'drop') continue;
    let c = 0xc8b48c;
    if (t.uv) { const img = atlas[g.json.textures[texOf(t.material)].source], u = (t.uv[0][0] + t.uv[1][0] + t.uv[2][0]) / 3, v = (t.uv[0][1] + t.uv[1][1] + t.uv[2][1]) / 3;
      const x = Math.min(img.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.w))), y = Math.min(img.h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * img.h))), k = (y * img.w + x) * 3;
      c = (img.rgb[k] << 16) | (img.rgb[k + 1] << 8) | img.rgb[k + 2]; }
    o.tris.push({ p: t.p, c });
  }
  return [...objects.values()].filter(o => o.cls !== 'drop');
}

// Simplificação por agrupamento de vértices: cada vértice vai para o centro da sua célula; triângulos que somem saem.
function cluster(tris, cell) {
  if (!cell) return tris;
  const key = p => p.map(v => Math.round(v / cell)).join(','), sum = new Map();
  for (const t of tris) for (const p of t.p) { const k = key(p); const s = sum.get(k) || [0, 0, 0, 0]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; sum.set(k, s); }
  const out = [], seen = new Set();
  for (const t of tris) {
    const ks = t.p.map(key); if (ks[0] === ks[1] || ks[1] === ks[2] || ks[0] === ks[2]) continue;
    const id = ks.slice().sort().join('|'); if (seen.has(id)) continue; seen.add(id);
    out.push({ p: ks.map(k => { const s = sum.get(k); return [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; }), c: t.c });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename && process.argv[2] === '--stats') {
  const objs = readSandstone(process.argv[3]), by = new Map();
  for (const o of objs) { const b = by.get(o.cls) || [0, 0, 0]; b[0]++; b[1] += o.tris.length; b[2] += cluster(o.tris, { mesh: .3, prop: .25, plant: .4 }[o.cls] || 0).length; by.set(o.cls, b); }
  console.log([...by].map(([k, v]) => k + ': objetos ' + v[0] + ', tris ' + v[1] + ' -> ' + v[2]).join('\n'));
}

// Face plana convertida para o formato do mapa, com uv pela projeção no mundo (padrões procedurais).
function polygon(p, c, look) {
  const n = unit(cross(sub(p[1], p[0]), sub(p[2], p[0]))); if (!Number.isFinite(n[0]) || Math.hypot(...n) < .5) return null;
  const [pat, s] = look, ax = Math.abs(n[1]) > .7 ? [0, 2] : Math.abs(n[0]) > Math.abs(n[2]) ? [2, 1] : [0, 1];
  return { p, n, c, glass: false, tag: 'world', uv: p.map(q => [q[ax[0]] * s, q[ax[1]] * s]), pat };
}
// Colisão de uma face (como no importador dos mapas 5v5): placa fina; faces de chão descem 25 cm.
function faceHull({ p, n }) {
  const walk = n[1] > .69, low = Math.min(...p.map(q => q[1])) - .25, back = p.map(q => q.map((v, i) => v - n[i] * .035));
  const planes = [[...n, dot(n, p[0])], walk ? [0, -1, 0, -low] : [...n.map(v => -v), -dot(n, p[0]) + .035]];
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], e = unit(cross(sub(b, a), walk ? [0, 1, 0] : n)); if (Math.hypot(...e) > .9) planes.push([...e, dot(e, a)]); }
  const pts = walk ? p.concat(p.map(q => [q[0], low, q[2]])) : p.concat(back);
  return { planes, min: [0, 1, 2].map(i => Math.min(...pts.map(q => q[i]))), max: [0, 1, 2].map(i => Math.max(...pts.map(q => q[i]))), mask: walk ? 7 : 3 };
}
const boxHull = (lo, hi, mask = 3) => ({ planes: [[1, 0, 0, hi[0]], [-1, 0, 0, -lo[0]], [0, 1, 0, hi[1]], [0, -1, 0, -lo[1]], [0, 0, 1, hi[2]], [0, 0, -1, -lo[2]]], min: lo, max: hi, mask });

// Malha simplificada pelo meshoptimizer (soldando só por posição); cada triângulo novo pega a cor do triângulo
// original mais próximo do seu centro.
function simplifyMesh(M, tris, ratio, err) {
  const key = new Map(), pos = [], idx = [];
  for (const t of tris) for (const p of t.p) { const k = p.map(v => Math.round(v * 1e3)).join(','); let i = key.get(k); if (i === undefined) { i = pos.length / 3; key.set(k, i); pos.push(...p); } idx.push(i); }
  const target = Math.max(3, Math.floor(idx.length * ratio / 3) * 3), [out] = M.simplify(new Uint32Array(idx), new Float32Array(pos), 3, target, err, []);
  const cell = .5, grid = new Map(), cen = t => [0, 1, 2].map(i => (t.p[0][i] + t.p[1][i] + t.p[2][i]) / 3), gk = c => c.map(v => Math.floor(v / cell)).join(',');
  for (const t of tris) { const c = cen(t), k = gk(c); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([c, t.c, t]); }
  const res = [];
  for (let i = 0; i < out.length; i += 3) {
    const p = [0, 1, 2].map(k => [pos[out[i + k] * 3], pos[out[i + k] * 3 + 1], pos[out[i + k] * 3 + 2]]), c = cen({ p }), n = unit(cross(sub(p[1], p[0]), sub(p[2], p[0]))); let best = null, bd = Infinity;
    for (let r = 0; r <= 3 && !best; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (const [q, col, t] of grid.get([Math.floor(c[0] / cell) + dx, Math.floor(c[1] / cell) + dy, Math.floor(c[2] / cell) + dz].join(',')) || []) {
      const tn = unit(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]))), d = Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]) + (1 - Math.abs(dot(tn, n))) * 2; if (d < bd) { bd = d; best = col; } }
    res.push({ p, c: best ?? tris[0].c });
  }
  return res;
}
// Cor dominante (por área) de um conjunto de triângulos.
function dominant(tris) { const w = new Map(); for (const t of tris) { const a = Math.hypot(...cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]))); w.set(t.c, (w.get(t.c) || 0) + a); } let best = 0xb08a5a, bw = -1; for (const [c, v] of w) if (v > bw) { bw = v; best = c; } return best; }
// Peça simples no lugar do objeto: caixa orientada pelo eixo principal no chão, ou cilindro (barris, potes).
function primitive(o, to) {
  const pts = o.tris.flatMap(t => t.p.map(to)), mx = pts.reduce((s, q) => s + q[0], 0) / pts.length, mz = pts.reduce((s, q) => s + q[2], 0) / pts.length;
  let sxx = 0, szz = 0, sxz = 0; for (const q of pts) { sxx += (q[0] - mx) ** 2; szz += (q[2] - mz) ** 2; sxz += (q[0] - mx) * (q[2] - mz); }
  const ang = .5 * Math.atan2(2 * sxz, sxx - szz), ux = [Math.cos(ang), 0, Math.sin(ang)], uz = [-Math.sin(ang), 0, Math.cos(ang)];
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of pts) { const a = (q[0] - mx) * ux[0] + (q[2] - mz) * ux[2], b = (q[0] - mx) * uz[0] + (q[2] - mz) * uz[2]; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const up = o.tris.filter(t => unit(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0])))[1] > .7), side = dominant(o.tris), top = up.length ? dominant(up) : side;
  const P = (a, y, b) => [mx + ux[0] * a + uz[0] * b, y, mz + ux[2] * a + uz[2] * b], faces = [];
  if (/^(Barrel|Pot)/.test(o.name)) {
    const r = Math.max(a1 - a0, b1 - b0) / 2, ca = (a0 + a1) / 2, cb = (b0 + b1) / 2, n = 10, ring = Array.from({ length: n }, (_, k) => { const t = k / n * 2 * Math.PI; return [ca + Math.cos(t) * r, cb + Math.sin(t) * r]; });
    for (let k = 0; k < n; k++) { const [pa, pb] = ring[k], [qa, qb] = ring[(k + 1) % n]; faces.push([[P(pa, y0, pb), P(pa, y1, pb), P(qa, y1, qb), P(qa, y0, qb)], side]); }
    faces.push([ring.map(([pa, pb]) => P(pa, y1, pb)).reverse(), top]);
  } else {
    const c = [P(a0, 0, b0), P(a1, 0, b0), P(a1, 0, b1), P(a0, 0, b1)], at = (q, y) => [q[0], y, q[2]];
    faces.push([c.map(q => at(q, y1)).reverse(), top]);
    for (let k = 0; k < 4; k++) { const q = c[k], r = c[(k + 1) % 4]; faces.push([[at(q, y0), at(q, y1), at(r, y1), at(r, y0)], side]); }
  }
  return { faces, hull: faces, lo: [Math.min(...pts.map(q => q[0])), y0, Math.min(...pts.map(q => q[2]))], hi: [Math.max(...pts.map(q => q[0])), y1, Math.max(...pts.map(q => q[2]))], mx, mz, ux, uz, a0, a1, b0, b1, y0, y1 };
}
const convexHullOf = pr => { // planos da caixa orientada
  const { mx, mz, ux, uz, a0, a1, b0, b1, y0, y1 } = pr, planes = [[0, 1, 0, y1], [0, -1, 0, -y0]];
  for (const [n, lo, hi] of [[ux, a0, a1], [uz, b0, b1]]) { const d0 = n[0] * mx + n[2] * mz; planes.push([n[0], 0, n[2], d0 + hi], [-n[0], 0, -n[2], -(d0 + lo)]); }
  return { planes, min: pr.lo, max: pr.hi, mask: 3 };
};

export async function buildGeometry(file) {
  const M = (await import(process.env.MESHOPT || 'meshoptimizer')).MeshoptSimplifier; await M.ready;
  const objs = readSandstone(file), ground = objs.find(o => o.cls === 'ground'), walls = objs.filter(o => o.name.startsWith('Wall'));
  const gy = Math.min(...ground.tris.flatMap(t => t.p.map(p => p[1]))), wb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const o of walls) for (const t of o.tris) for (const p of t.p) { wb[0] = Math.min(wb[0], p[0]); wb[1] = Math.min(wb[1], p[2]); wb[2] = Math.max(wb[2], p[0]); wb[3] = Math.max(wb[3], p[2]); }
  const cxz = [(wb[0] + wb[2]) / 2, (wb[1] + wb[3]) / 2], to = p => [p[0] - cxz[0], p[1] - gy, p[2] - cxz[1]];
  const polygons = [], hulls = [], add = (p, c, look) => { const f = polygon(p, c, look); if (f) polygons.push(f); return f; };
  for (const o of objs) {
    const look = lookOf(o.name);
    if (o.cls === 'prop' || o.cls === 'decal') {
      const pr = primitive(o, to); for (const [p, c] of pr.faces) add(p, c, look);
      if (o.cls === 'prop' && pr.y1 - pr.y0 > .25) hulls.push(convexHullOf(pr));
      continue;
    }
    let tris = o.tris;
    // O chafariz (Well) é redondo e pequeno: guarda bem mais detalhe que as casas.
    if (o.cls === 'mesh') tris = /^Fountain/.test(o.name) ? tris : /^Well/.test(o.name) ? simplifyMesh(M, tris, .2, .004) : simplifyMesh(M, tris, /^House/.test(o.name) ? .12 : .06, .01);
    else if (o.cls === 'plant') tris = cluster(tris, .4);
    tris = tris.map(t => ({ p: t.p.map(to), c: t.c }));
    for (const t of tris) add(t.p, t.c, look);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const t of o.tris) for (const q0 of t.p) { const q = to(q0); for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } }
    // Colisão por caixa orientada: casas e muralha medidas pelas paredes (abaixo de 2,5 m) e fechadas até o topo (sem parede
    // invisível no beiral); balcões e poço pela parte de baixo; tendas, cercas e pedras inteiras. Escadas e morros pela malha.
    const BOXED = [[/^(House|Wall)/, 2.5, true], [/^(Market|Well|Fountain)/, 1.3, false], [/^(Tent|Fence|Rock)/, 99, false]], boxed = BOXED.find(([re]) => re.test(o.name));
    if (o.cls === 'mesh' && /^(Tile|Block)/.test(o.name)) continue;
    if (o.cls === 'mesh' && boxed) {
      const [, cut, full] = boxed, low = { name: o.name, tris: o.tris.filter(t => t.p.every(q => q[1] - gy < cut)) }; if (!low.tris.length) continue;
      // topo: a laje do telhado (a maior área de faces viradas para cima), não o ponto mais alto (frisos e pinos)
      let top = full ? hi[1] : null;
      if (full) { const w = new Map(); for (const t of o.tris) { const q = t.p.map(to), nn = cross(sub(q[1], q[0]), sub(q[2], q[0])), a = Math.hypot(...nn); if (a > 1e-9 && nn[1] / a > .9) { const y = Math.round((q[0][1] + q[1][1] + q[2][1]) / 3 * 20) / 20; if (y > 2.5) w.set(y, (w.get(y) || 0) + a); } }
        let best = -1; for (const [y, a] of w) if (a > best) { best = a; top = y; } }
      const pr = primitive(low, to); if (top === null) top = pr.y1; pr.y0 = 0; pr.y1 = top; pr.lo = [pr.lo[0], 0, pr.lo[2]]; pr.hi = [pr.hi[0], top, pr.hi[2]]; hulls.push(convexHullOf(pr));
    } else if (o.cls === 'mesh') for (const t of tris) { const n = unit(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]))); if (Math.hypot(...n) > .5 && Number.isFinite(n[0])) hulls.push(faceHull({ p: t.p, n })); }
    else if (o.cls === 'ground') hulls.push({ ...boxHull([lo[0], -1, lo[2]], [hi[0], 0, hi[2]]), mask: 7 });
    else if (o.cls === 'palm') { const base = o.tris.flatMap(t => t.p.map(to)).filter(q => q[1] < lo[1] + .6), x = base.reduce((s, q) => s + q[0], 0) / base.length, z = base.reduce((s, q) => s + q[2], 0) / base.length; hulls.push(boxHull([x - .22, lo[1], z - .22], [x + .22, lo[1] + 3.2, z + .22])); }
  }
  return { polygons, hulls, center: cxz, groundY: gy };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename && process.argv[2] === '--top') {
  // Vista de cima (PPM) para alinhar spawns, bombsites e barreiras com o minimapa do autor.
  const { polygons } = await buildGeometry(process.argv[3]), S = +(process.argv[5] || 8), R = 64, N = R * 2 * S, img = Buffer.alloc(N * N * 3, 40), zb = new Float32Array(N * N).fill(-1e9);
  for (const f of polygons) { if (f.n[1] < .2) continue; const P = f.p.map(q => [(q[0] + R) * S, (q[2] + R) * S, q[1]]);
    const x0 = Math.max(0, Math.floor(Math.min(...P.map(q => q[0])))), x1 = Math.min(N - 1, Math.ceil(Math.max(...P.map(q => q[0])))), y0 = Math.max(0, Math.floor(Math.min(...P.map(q => q[1])))), y1 = Math.min(N - 1, Math.ceil(Math.max(...P.map(q => q[1]))));
    const [a, b, c] = P, d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(d) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d, l3 = 1 - l1 - l2; if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      const h = l1 * a[2] + l2 * b[2] + l3 * c[2], k = y * N + x; if (h < zb[k]) continue; zb[k] = h; const sh = .75 + .25 * f.n[1]; img[k * 3] = ((f.c >> 16) & 255) * sh; img[k * 3 + 1] = ((f.c >> 8) & 255) * sh; img[k * 3 + 2] = (f.c & 255) * sh; } }
  for (let m = -R; m <= R; m += 10) for (let t = 0; t < N; t++) { for (const k of [t * N + (m + R) * S, ((m + R) * S) * N + t]) if (k >= 0 && k < N * N) { img[k * 3] = m ? 255 : 0; img[k * 3 + 1] = m ? 255 : 255; img[k * 3 + 2] = m ? 255 : 0; } }
  writeFileSync(process.argv[4], Buffer.concat([Buffer.from('P6\n' + N + ' ' + N + '\n255\n'), img]));
}

// Marcações do autor (vista de cima, coordenadas do jogo antes do recentro da navegação; -z = lado dos Defensores).
// Atacantes no alto do minimapa (+z), Defensores embaixo (-z). Bombsites nas áreas vermelhas; barreiras nas linhas azuis.
const LAYOUT = {
  t: { at: [-5.5, 39.5], yaw: 0 }, ct: { at: [12, -36], yaw: Math.PI },
  sites: [
    { name: 'A', parts: [[25, -8.5, 33.4, 2.75]] },
    { name: 'B', parts: [[-31.6, -18.8, -24, .06], [-40.5, -18.8, -31.6, -4.75]] },
  ],
  // cada barreira vai de parede a parede: os pontos marcados são esticados na mesma direção até encostar em algo sólido
  barriers: [[9.5, 40.1, 9.5, 36.75], [-20.75, 38.5, -20.75, 36.9], [31.2, -24.7, 32.7, -38.1], [11.2, -24, 5.4, -24], [-14.3, -29.8, -14.3, -35.7]],
};

export async function compileSandstone(file) {
  const geo = await buildGeometry(file), polygons = geo.polygons, hulls = geo.hulls;
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const f of polygons) for (const p of f.p) for (let i = 0; i < 3; i++) { bounds[i] = Math.min(bounds[i], p[i]); bounds[i + 3] = Math.max(bounds[i + 3], p[i]); }
  const map = { key: 'sandstone', name: 'Sandstone', credit: 'amogusstrikesback2', scale: 1, center: [0, 0, 0], surfaceCollision: true, bounds: bounds.map((v, i) => v + (i < 3 ? -1 : 1)),
    t: [], ct: [], sites: [], ladders: [], polygons, hulls, report: { sourceSha256: createHash('sha256').update(readFileSync(file)).digest('hex') } };
  let native = new globalThis.SourceMaps.NativeMap(packMap(map));
  const free = (x, z) => { const fl = native.floors(x, z, -1, 3).filter(y => !native.overlap(x, y + .02, z, 1.8, .34)); return fl.length ? fl[0] : null; };
  // Barreiras: estica cada segmento até a parede dos dois lados (no máximo 4 m), na altura do peito.
  const hitDist = (x, z, dx, dz, max) => { const y = (free(x, z) ?? 0) + 1.2; const h = native.ray([x, y, z], [dx, 0, dz], max); return h ? h.t : max; };
  const barriers = LAYOUT.barriers.map(([ax, az, bx, bz]) => { const l = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / l, dz = (bz - az) / l, a = hitDist(ax, az, -dx, -dz, 4), b = hitDist(bx, bz, dx, dz, 4);
    return [ax - dx * a, az - dz * a, bx + dx * b, bz + dz * b].map(v => +v.toFixed(3)); });
  // Cinco spawns por lado em volta do ponto marcado, em chão livre e afastados entre si.
  for (const side of ['t', 'ct']) { const { at, yaw } = LAYOUT[side], list = map[side];
    for (let r = 0; r <= 8 && list.length < 5; r += .5) for (let k = 0; k < 16 && list.length < 5; k++) { const a = k / 16 * 2 * Math.PI, x = at[0] + Math.cos(a) * r, z = at[1] + Math.sin(a) * r, y = free(x, z);
      if (y === null || list.some(p => Math.hypot(p[0] - x, p[1] - z) < 1.5)) continue; list.push([+x.toFixed(2), +z.toFixed(2), yaw, y]); }
    if (list.length < 5) throw Error('poucos spawns livres para ' + side); }
  for (const s of LAYOUT.sites) { const xs = s.parts.flatMap(p => [p[0], p[2]]), zs = s.parts.flatMap(p => [p[1], p[3]]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const big = s.parts.reduce((a, b) => (b[2] - b[0]) * (b[3] - b[1]) > (a[2] - a[0]) * (a[3] - a[1]) ? b : a), cx0 = (big[0] + big[2]) / 2, cz0 = (big[1] + big[3]) / 2;
    // ponto de referência do bombsite: chão livre (sem caixa nem chafariz) mais perto do centro da maior parte
    let lx = cx0, lz = cz0, y = free(cx0, cz0) ?? 0;
    search: for (let r = 0; r < 6; r += .25) for (let k = 0; k < 24; k++) { const x = cx0 + Math.cos(k / 24 * 2 * Math.PI) * r, z = cz0 + Math.sin(k / 24 * 2 * Math.PI) * r, f = free(x, z);
      if (f !== null && f < .3 && x > big[0] + .5 && x < big[2] - .5 && z > big[1] + .5 && z < big[3] - .5) { lx = +x.toFixed(2); lz = +z.toFixed(2); y = f; break search; } }
    map.sites.push({ name: s.name, x0, z0, x1, z1, y0: y - .3, y1: y + 1.6, lx, lz, parts: s.parts.map(p => p.slice()) }); }
  const before = map.center.slice(); bakeNavigation(map);
  const dx = map.center[0] - before[0], dz = -(map.center[1] - before[1]);
  for (const b of barriers) { b[0] -= dx; b[2] -= dx; b[1] -= dz; b[3] -= dz; }
  for (const s of map.sites) for (const p of s.parts) { p[0] -= dx; p[2] -= dx; p[1] -= dz; p[3] -= dz; }
  map.barriers = barriers;
  pruneNavigation(map);
  // As barreiras precisam fechar cada spawn: pela navegação, sem cruzar barreira, não se chega a nenhum bombsite nem ao outro spawn.
  { const rd = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }, nv = map.navigation;
    const X = rd(nv.x, Float32Array), Z = rd(nv.z, Float32Array), L = rd(nv.links, Int32Array), n = X.length;
    const cross = (ax, az, bx, bz, b) => { const s1 = (x, z) => (b[2] - b[0]) * (z - b[1]) - (b[3] - b[1]) * (x - b[0]), s2 = (x, z) => (bx - ax) * (z - az) - (bz - az) * (x - ax); return s1(ax, az) * s1(bx, bz) <= 0 && s2(b[0], b[1]) * s2(b[2], b[3]) <= 0; };
    const near = (x, z) => { let best = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
    map.report.spawnZones = {};
    for (const side of ['t', 'ct']) { const seen = new Uint8Array(n), q = map[side].map(p => near(p[0], p[1])); for (const i of q) seen[i] = 1;
      while (q.length) { const a = q.pop(); for (let d = 0; d < 4; d++) { const b = L[a * 4 + d]; if (b < 0 || seen[b] || barriers.some(br => cross(X[a], Z[a], X[b], Z[b], br))) continue; seen[b] = 1; q.push(b); } }
      const other = side === 't' ? 'ct' : 't', leak = map[other].some(p => seen[near(p[0], p[1])]) || map.sites.some(s => s.parts.some(pp => seen[near((pp[0] + pp[2]) / 2, (pp[1] + pp[3]) / 2)]));
      map.report.spawnZones[side] = seen.reduce((s, v) => s + v, 0); if (leak) throw Error('a barreira do spawn ' + side + ' não fecha (' + map.report.spawnZones[side] + ' células)'); } }
  return map;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename && !process.argv[2].startsWith('--')) {
  const map = await compileSandstone(resolve(process.argv[2])), packed = packMap(map), bytes = gzipSync(Buffer.from(JSON.stringify(packed)), { level: 9 }), out = resolve(import.meta.dirname, '../assets/maps');
  writeFileSync(resolve(out, 'sandstone.js'), '// Sandstone: convertido do GLB do autor (amogusstrikesback2, Sketchfab, CC-BY 4.0) por tools/import-sandstone.mjs.\n(globalThis.SOURCE_MAP_PAYLOADS??={}).sandstone=' + JSON.stringify(bytes.toString('base64')) + ';\n');
  const file = resolve(out, 'warface-catalog.js'), ctx = {}; try { new Function('globalThis', readFileSync(file, 'utf8'))(ctx); } catch {}
  // mantém os outros mapas do catálogo (ex.: o Lily) e põe o Sandstone na frente
  const catalog = { sandstone: { name: map.name, credit: map.credit, ax: map.ax, az: map.az, t: map.t, ct: map.ct, sites: map.sites, barriers: map.barriers }, ...Object.fromEntries(Object.entries(ctx.WARFACE_MAP_CATALOG || {}).filter(([k]) => k !== 'sandstone')) };
  writeFileSync(file, '// Metadata only; geometry is lazy loaded.\nglobalThis.WARFACE_MAP_CATALOG=' + JSON.stringify(catalog) + ';\n');
  const tris = Buffer.from(packed.mesh.index, 'base64').length / 12;
  console.log('sandstone', bytes.length + ' bytes gzipped', tris + ' triangles', map.hulls.length + ' hulls', JSON.stringify({ zones: map.report.spawnZones, nav: map.report.navigation.nodes, pruned: map.report.navigationPruned, t: map.t, ct: map.ct, barriers: map.barriers, sites: map.sites.map(s => [s.name, s.parts]) }));
}
