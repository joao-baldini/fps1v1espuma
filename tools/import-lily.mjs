// Lily: mapa do Plant the Bomb 5v5, convertido do BSP enviado pelo usuário (uso permitido com os devidos créditos).
// Uso: node tools/import-lily.mjs caminho/de_lily.bsp
// Estruturas 1:1: paredes, pisos, escadas e colisão vêm dos brushes do BSP. Sem textura: cada material é a cor chapada
// da sua própria textura embutida (o mapa usa texturas de cor sólida). Os props do CS:GO não vêm no arquivo: caixas,
// pilhas de caixas, caçambas, sacos de lixo, barris, caminhões, táxi e empilhadeira são refeitos como blocos nas
// medidas do nome do modelo (caixas) ou nas medidas do modelo original (os outros), na posição e rotação do BSP.
// Spawns e bombsites vêm das entidades do BSP; as barreiras da fase de compra são as bordas das func_buyzone.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { compileSourceMap, rotation } from './source-bsp.mjs';
import { readNav } from './source-nav.mjs';
import { packMap, bakeNavigation, pruneNavigation } from './import-source-maps.mjs';
import '../assets/maps/runtime.js';

const add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, s) => a.map(v => v * s), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Cor média da textura DXT1 embutida (o topo da cadeia de mipmaps fica no fim do VTF).
function vtfColor(buf) {
  const w = buf.readUInt16LE(16), h = buf.readUInt16LE(18), fmt = buf.readInt32LE(52); if (fmt !== 13) return null;
  const size = Math.max(8, w * h / 2), top = buf.subarray(buf.length - size), c565 = v => [((v >> 11) & 31) * 255 / 31, ((v >> 5) & 63) * 255 / 63, (v & 31) * 255 / 31], s = [0, 0, 0];
  let n = 0;
  for (let p = 0; p < size; p += 8) {
    const a = top.readUInt16LE(p), b = top.readUInt16LE(p + 2), ca = c565(a), cb = c565(b), idx = top.readUInt32LE(p + 4);
    const cols = a > b ? [ca, cb, ca.map((x, i) => (2 * x + cb[i]) / 3), ca.map((x, i) => (x + 2 * cb[i]) / 3)] : [ca, cb, ca.map((x, i) => (x + cb[i]) / 2), [0, 0, 0]];
    for (let i = 0; i < 16; i++) { const c = cols[(idx >> (2 * i)) & 3]; s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; n++; }
  }
  return (Math.round(s[0] / n) << 16) | (Math.round(s[1] / n) << 8) | Math.round(s[2] / n);
}

// Props do CS:GO usados no Lily: [regra, medidas em unidades (comprimento x, largura y, altura z), cor, sólido].
const WOOD = [0xb48d5c, 0x8f6a44], TARP = 0x6d7a63, METAL = 0x6d767c, DARK = 0x2e3236;
const PROPS = [
  [/nuke_light|light_fixture|fluorescent|truck_(interior|glass|wheels|boards)|taxi_(interior|glass|wheels)/, null],
  [/crate_assembly_(\d+)x(\d+)/, m => { const d = m.match(/(\d+)x(\d+)/); return { size: [+d[1], +d[2], 96], color: WOOD[0], top: /tarp/.test(m) ? TARP : null, solid: true }; }],
  [/dust_crate_style_0(\d)_(\d+)x(\d+)x(\d+)/, m => { const d = m.match(/style_0(\d)_(\d+)x(\d+)x(\d+)/); return { size: [+d[2], +d[3], +d[4]], color: WOOD[+d[1] - 1] ?? WOOD[0], top: /tarp/.test(m) ? TARP : null, solid: true }; }],
  [/dust_trash_bag_pile/, () => ({ size: [72, 64, 26], color: DARK, solid: true })],
  [/dust_trash_bag/, () => ({ size: [26, 22, 18], color: DARK, solid: false })],
  [/dust_garbage_container/, () => ({ size: [76, 44, 52], color: 0x3f6b4a, solid: true })],
  [/barrel/, () => ({ size: [30, 30, 44], color: 0x6b4a2e, cyl: true, solid: true })],
  // Veículos do hr_dust: o eixo comprido é o y do modelo (medido pelo chão andável do CS em volta de cada um).
  [/flatbed_truck_body/, () => ({ parts: [{ at: [0, -40, 0], size: [90, 330, 112] }], color: 0x8a8f8c, solid: true })],
  [/taxi_body/, () => ({ parts: [{ at: [0, 8, 0], size: [70, 186, 58] }], color: 0xd6b33a, solid: true })],
  [/forklift/, () => ({ size: [50, 110, 86], color: 0xd99a1e, solid: true })],
];
const propSpec = model => { const r = PROPS.find(([re]) => re.test(model)); return r ? r[1] && r[1](model) : undefined; };

function boxFaces(lo, hi, xf, rot, color, top, cyl) {
  const [x0, y0, z0] = lo, [x1, y1, z1] = hi, n = cyl ? 10 : 4;
  const ring = cyl ? Array.from({ length: n }, (_, i) => { const a = (i + .5) / n * 2 * Math.PI; return [(x0 + x1) / 2 + Math.cos(a) * (x1 - x0) / 2, (y0 + y1) / 2 + Math.sin(a) * (y1 - y0) / 2]; }) : [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const loR = ring.map(([x, y]) => xf([x, y, z0])), hiR = ring.map(([x, y]) => xf([x, y, z1])), up = rot([0, 0, 1]), faces = [{ p: hiR.slice(), n: up, c: top ?? color }];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, [ax, ay] = ring[i], [bx, by] = ring[j], l = Math.hypot(by - ay, bx - ax) || 1; faces.push({ p: [loR[i], loR[j], hiR[j], hiR[i]], n: rot([(by - ay) / l, -(bx - ax) / l, 0]), c: color }); }
  return faces;
}

export function compileLily(file) {
  let bspRef = null; const colors = new Map();
  const map = compileSourceMap(file, 'lily', { materialColor: m => colors.get(m) });
  // 1ª passada só para ler as texturas embutidas; depois recompila com as cores exatas.
  bspRef = map.bsp; for (const k of bspRef.pak.keys()) if (k.endsWith('.vtf') && k.startsWith('materials/') && !/cubemap/.test(k)) { const c = vtfColor(bspRef.asset(k)); if (c !== null) colors.set(k.slice(10, -4), c); }
  const lily = compileSourceMap(file, 'lily', { materialColor: m => colors.get(m) });
  lily.name = 'Lily'; lily.report.materialColors = Object.fromEntries([...colors].map(([k, v]) => [k, '#' + v.toString(16).padStart(6, '0')]));
  const { bsp, convert, center, scale } = lily, plane = (n, d) => [n[0], n[2], -n[1], (d - dot(n, center)) * scale];
  // Props: blocos nas medidas e na posição/rotação do BSP (origem na base, no centro).
  const stats = { blocks: 0, skipped: 0, unknown: new Set() };
  for (const prop of bsp.staticProps()) {
    const spec = propSpec(prop.model); if (spec === null) { stats.skipped++; continue; } if (!spec) { stats.unknown.add(prop.model); continue; }
    const rot = rotation(prop.angles), s = prop.scale || 1, xf = p => add(rot(mul(p, s)), prop.origin);
    for (const part of spec.parts || [{ at: [0, 0, 0], size: spec.size }]) {
      const [L, W, H] = part.size, lo = [part.at[0] - L / 2, part.at[1] - W / 2, part.at[2]], hi = [part.at[0] + L / 2, part.at[1] + W / 2, part.at[2] + H];
      const faces = boxFaces(lo, hi, xf, rot, spec.color, spec.top, spec.cyl);
      for (const f of faces) lily.polygons.push({ p: f.p.map(convert), n: [f.n[0], f.n[2], -f.n[1]], c: f.c, glass: false, tag: 'prop' });
      if (spec.solid) { const pts = faces.flatMap(f => f.p).map(convert); lily.hulls.push({ planes: faces.map(f => plane(f.n, dot(f.n, f.p[0]))).concat([plane(mul(rot([0, 0, 1]), -1), -dot(rot([0, 0, 1]), xf(lo)))]), min: [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))), max: [0, 1, 2].map(i => Math.max(...pts.map(p => p[i]))), mask: 3, src: 'prop:' + prop.model }); }
      stats.blocks++;
    }
  }
  lily.report.props = { blocks: stats.blocks, skipped: stats.skipped, unknown: [...stats.unknown] };
  // Conferência com a navegação original do CS: nenhum bloco sólido pode cobrir chão onde o jogador anda no CS.
  const navFile = [...bsp.pak.keys()].find(k => k.endsWith('.nav')), nav = navFile ? readNav(bsp.asset(navFile)) : null;
  // Barreiras da compra: bordas das zonas de compra de cada time (TeamNum 2 = TR, 3 = CT).
  const zones = bsp.entities.filter(e => e.classname === 'func_buyzone').map(e => { const m = bsp.models[+e.model.slice(1)], a = convert(m.min), b = convert(m.max); return { team: +e.TeamNum, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[2], b[2]), z1: Math.max(a[2], b[2]) }; });
  lily.buyZones = zones;
  return { map: lily, nav };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const { map } = compileLily(resolve(process.argv[2]));
  // barreiras = bordas das zonas de compra (no sistema do mapa antes do recentro)
  const barriers = []; for (const z of map.buyZones) barriers.push([z.x0, z.z0, z.x1, z.z0], [z.x1, z.z0, z.x1, z.z1], [z.x1, z.z1, z.x0, z.z1], [z.x0, z.z1, z.x0, z.z0]);
  const before = map.center.slice(); bakeNavigation(map);
  const dx = (map.center[0] - before[0]) * map.scale, dz = -(map.center[1] - before[1]) * map.scale;
  map.barriers = barriers.map(b => [b[0] - dx, b[1] - dz, b[2] - dx, b[3] - dz].map(v => +v.toFixed(3)));
  { const native = new globalThis.SourceMaps.NativeMap(packMap(map)); for (const p of map.t.concat(map.ct)) { const y = native.ground(p[0], p[1], p[3]); if (p[3] - y > .05 && p[3] - y < 3) p[3] = y; } }
  pruneNavigation(map);
  delete map.bsp; delete map.convert;
  const packed = packMap(map), bytes = gzipSync(Buffer.from(JSON.stringify(packed)), { level: 9 }), out = resolve(import.meta.dirname, '../assets/maps');
  writeFileSync(resolve(out, 'lily.js'), '// Lily: convertido do BSP enviado pelo usuário por tools/import-lily.mjs. Cores chapadas dos materiais do mapa, sem textura.\n(globalThis.SOURCE_MAP_PAYLOADS??={}).lily=' + JSON.stringify(bytes.toString('base64')) + ';\n');
  const file = resolve(out, 'warface-catalog.js'), ctx = {}; try { new Function('globalThis', readFileSync(file, 'utf8'))(ctx); } catch {}
  const catalog = ctx.WARFACE_MAP_CATALOG || {}; catalog.lily = { name: map.name, ax: map.ax, az: map.az, t: map.t, ct: map.ct, sites: map.sites, barriers: map.barriers, modes: ['5v5'] };
  writeFileSync(file, '// Metadata only; geometry is lazy loaded.\nglobalThis.WARFACE_MAP_CATALOG=' + JSON.stringify(catalog) + ';\n');
  const tris = Buffer.from(packed.mesh.index, 'base64').length / 12;
  console.log('lily', bytes.length + ' bytes gzipped', tris + ' triangles', map.hulls.length + ' hulls', JSON.stringify({ nav: map.report.navigation, props: map.report.props, colors: map.report.materialColors, sites: map.sites.map(s => s.name), zones: map.buyZones.length }));
}
