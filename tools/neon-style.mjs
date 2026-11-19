// Acabamento do Neon (Akihabara, de zelzstorm): cores e padrões dos materiais conforme as fotos do mapa original,
// objetos de obra que o BSP não traz, e tapumes onde o jogador batia em paredes invisíveis.
// Nada de imagens: as cores vêm dos próprios arquivos do BSP (VMT/VTF embutidos) e o desenho é o padrão procedural
// do jogo (PATTERNS). O resto do pipeline é o mesmo dos outros mapas do Wingman.
import { PATTERNS as P, rotation as rotationOf } from './source-bsp.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Refletividade do BSP/VTF é linear; as cores do jogo são de tela (sRGB).
const srgb = v => { v = clamp(v, 0, 1); return v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055; };
const hex = rgb => rgb.reduce((c, v) => (c << 8) | Math.round(clamp(v, .05, .94) * 255), 0);
const fromHex = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255].map(v => v / 255);

// Lê o VMT embutido (seguindo "patch" → "include") e devolve textura base e tinta ($color).
function readVmt(bsp, name) {
  let text = bsp.asset('materials/' + name + '.vmt')?.toString('utf8');
  for (let depth = 0; text && depth < 3; depth++) {
    const inc = text.match(/"include"\s+"([^"]+)"/i);
    if (!inc) break;
    text = bsp.asset(inc[1].replaceAll('\\', '/').toLowerCase())?.toString('utf8');
  }
  if (!text) return null;
  text = text.replace(/\/\/[^\n]*/g, '');
  const get = key => text.match(new RegExp('"?\\' + key + '"?\\s+"?([\\[{][^\\]}]*[\\]}]|[^"\\s}]+)', 'i'))?.[1];
  const parse = s => { if (!s) return null; const n = s.replace(/[[\]{}"]/g, ' ').trim().split(/\s+/).map(Number); if (n.length < 3 || n.some(Number.isNaN)) return null; return /^\s*"?\{/.test(s) ? n.map(v => v / 255) : n; };
  return { base: get('$basetexture')?.replaceAll('\\', '/').toLowerCase().replace(/\.vtf$/, ''), tint: parse(get('$color')), translucent: /\$translucent"?\s+"?1/i.test(text) };
}

// Exceções vistas nas fotos: o vidro das fachadas reflete o céu (azul), a água da vala é escura e esverdeada.
const OVERRIDES = [
  [/exterior_glass_opaque/, { c: 0x6f93bf, pat: P.tile }],
  [/exterior_glass_translucent|glass\/urban_window/, { c: 0xa9c8e4, pat: P.plain }],
  [/liquids\/akiba_water|dev_waterbeneath/, { c: 0x3c5a5a, pat: P.plain, glass: true }],
  [/tactile_paving/, { pat: P.tile }],
  [/metallic_panelling_stripe/, { pat: P.metal }],
  [/metallic_panelling|plastic_wall|marble_wall/, { pat: P.tile }],
  [/ads\/|signs_blank|signage/, { pat: P.plain }],
  [/rollup_door|shutters/, { pat: P.metal }],
  // Sable (Itália): ruas de laje e calçamento, painéis de madeira nos corredores.
  [/flagstone/, { pat: P.tile }],
  [/cobblestone|cobble/, { pat: P.cobble }],
  [/wainscot|wood_int_0[28]|woodm$/, { pat: P.panel }],
];

export function neonStyler(bsp) {
  const cache = new Map();
  return material => {
    if (cache.has(material)) return cache.get(material);
    const rule = OVERRIDES.find(([re]) => re.test(material))?.[1] || {};
    let rgb = null;
    const vmt = readVmt(bsp, material);
    if (vmt) {
      const vtf = vmt.base && bsp.asset('materials/' + vmt.base + '.vtf');
      const refl = vtf && vtf.length > 44 && vtf.toString('ascii', 0, 3) === 'VTF' ? [vtf.readFloatLE(32), vtf.readFloatLE(36), vtf.readFloatLE(40)] : bsp.materialColors.get(material);
      if (refl) rgb = refl.map((v, i) => v * (vmt.tint ? vmt.tint[i] : 1));
    }
    if (!rgb) rgb = bsp.materialColors.get(material) || null;
    const style = { c: rule.c ?? (rgb ? hex(rgb.map(srgb)) : null), pat: rule.pat, glass: rule.glass };
    cache.set(material, style);
    return style;
  };
}

// Reaplica cor/padrão nas faces compiladas do BSP (paredes, chão e modelos com colisão embutida).
export function styleNeon(map) {
  const style = neonStyler(map.bsp);
  for (const face of map.polygons) {
    if (!face.material) continue;
    if (face.tag === 'prop') { face.c = hex(fromHex(face.c).map(v => srgb(v))); continue; } // média do modelo, linear
    const s = style(face.material);
    if (s.c != null) face.c = s.c;
    if (s.pat != null) face.pat = s.pat;
    if (s.glass) face.glass = true;
    delete face.material;
  }
  for (const face of map.polygons) delete face.material;
}

// Objetos de obra do CS que não vêm dentro do BSP (medidas em unidades Source, base no chão).
export const NEON_PROPS = [
  [/ibc_1_(metal|plastic)/, () => ({ size: [48, 40, 46], color: 0x2f62a8, pat: P.metal })],
  [/dizzy_cinderblock/, () => ({ size: [16, 8, 8], color: 0x9d9a94, pat: P.concrete })],
  [/concrete_bag_a/, () => ({ size: [28, 18, 7], color: 0xbcb3a0, pat: P.concrete })],
  [/i_beam_(\d+)/, m => ({ size: [Number(m.match(/i_beam_(\d+)/)[1]), 8, 10], color: 0x8a5a3c, pat: P.metal, elongated: true })],
  [/police_barrier/, () => ({ size: [80, 6, 40], color: 0xc9ced3, pat: P.metal, mask: 1, glass: true, elongated: true })],
  [/rebar_stack/, () => ({ size: [96, 24, 10], color: 0x6b4a36, pat: P.metal })],
];

// Paredes invisíveis (colisões só de movimento, sem nada desenhado) onde o jogador batia: o fim das ruas e da escada
// que saem do mapa. Cada uma ganha um tapume de obra (painéis brancos com faixa azul, como nas fotos) no mesmo lugar.
// [x0, z0, x1, z1] em metros no mapa final; y do chão vem da própria colisão.
export const NEON_HOARDINGS = [
  [22.6, -4.97, 22.6, 5.65], // praça coberta a leste
  [22.78, 7.84, 22.78, 19.72],
  [17.81, -31.79, 17.81, -25.29], // escada para fora do mapa, atrás dos cones
  [5.62, -43.27, 11.31, -43.27], // rua norte (spawn CT)
  [2.37, -43.27, 5.62, -43.27],
  [-1.9, -43.4, 2.37, -43.4],
  [-5.56, -44.1, -1.9, -44.1],
  [-10.03, -45.0, -5.56, -45.0],
  [-7.94, 37.65, -4.34, 37.65], // rua sul
  [-4.44, 37.2, 0.03, 37.2],
  [0.03, 36.64, 6.33, 36.64],
  [4.81, 37.4, 9.38, 37.4],
  [8.97, 39.9, 13.44, 39.9],
  [27.5, 37.5, 27.5, 45.43], // saída sul do spawn TR
  [-26.1, -16.65, -26.1, -11.88], // rua oeste, depois do andaime
  [8.26, 19.99, 11.56, 19.99], // beco entre o contêiner azul e o prédio
  [23.42, 23.99, 23.42, 27.7],
];

// Cor média de uma textura VTF (DXT1/3/5) só nos pixels visíveis, e a fração visível. Usa o mip de até 128 px;
// rect = [u0, u1, v0, v1] limita a média ao recorte do atlas usado pelo overlay.
export function vtfColor(vtf, rect = [0, 1, 0, 1]) {
  if (!vtf || vtf.toString('ascii', 0, 3) !== 'VTF') return null;
  const hdr = vtf.readUInt32LE(12), w0 = vtf.readUInt16LE(16), h0 = vtf.readUInt16LE(18), fmt = vtf.readInt32LE(52), mips = vtf[56];
  const lowFmt = vtf.readInt32LE(57), lw = vtf[61], lh = vtf[62];
  const block = { 13: 8, 14: 16, 15: 16 }[fmt]; if (!block) return null;
  const size = (w, h, b) => Math.max(1, Math.ceil(w / 4)) * Math.max(1, Math.ceil(h / 4)) * b;
  let p = hdr + (lowFmt === 13 && lw ? size(lw, lh, 8) : 0), level = mips - 1;
  let target = 0; while ((w0 >> target) > 128 && target < mips - 1) target++;
  for (; level > target; level--) p += size(Math.max(1, w0 >> level), Math.max(1, h0 >> level), block);
  const w = Math.max(1, w0 >> level), h = Math.max(1, h0 >> level), sum = [0, 0, 0]; let seen = 0, total = 0;
  const c565 = v => [((v >> 11) & 31) / 31, ((v >> 5) & 63) / 63, (v & 31) / 31];
  for (let by = 0; by < Math.ceil(h / 4); by++) for (let bx = 0; bx < Math.ceil(w / 4); bx++, p += block) {
    const q = block === 16 ? p + 8 : p, a0 = vtf.readUInt16LE(q), a1 = vtf.readUInt16LE(q + 2), c0 = c565(a0), c1 = c565(a1), bits = vtf.readUInt32LE(q + 4);
    const pal = a0 > a1 || block === 16 ? [c0, c1, c0.map((v, i) => (2 * v + c1[i]) / 3), c0.map((v, i) => (v + 2 * c1[i]) / 3)] : [c0, c1, c0.map((v, i) => (v + c1[i]) / 2), null];
    for (let k = 0; k < 16; k++) {
      const u = (bx * 4 + (k & 3) + .5) / w, v = (by * 4 + (k >> 2) + .5) / h;
      if (u < rect[0] || u > rect[1] || v < rect[2] || v > rect[3]) continue;
      let alpha = 1; const idx = (bits >> (2 * k)) & 3;
      if (block === 16 && fmt === 14) alpha = ((vtf.readUInt16LE(p + (k >> 2) * 2) >> ((k & 3) * 4)) & 15) / 15;
      if (block === 16 && fmt === 15) {
        const e0 = vtf[p], e1 = vtf[p + 1], ab = Number((vtf.readBigUInt64LE(p) >> 16n) >> BigInt(3 * k) & 7n);
        alpha = (ab === 0 ? e0 : ab === 1 ? e1 : e0 > e1 ? ((8 - ab) * e0 + (ab - 1) * e1) / 7 : ab === 6 ? 0 : ab === 7 ? 255 : ((6 - ab) * e0 + (ab - 1) * e1) / 5) / 255;
      }
      const col = pal[idx]; if (!col) alpha = 0;
      total++; if (alpha > .5) { seen++; for (let i = 0; i < 3; i++) sum[i] += col[i] ** 2.2; } // média em espaço linear
    }
  }
  return seen ? { rgb: sum.map(v => v / seen), coverage: seen / total } : { rgb: [0, 0, 0], coverage: 0 };
}

// Placas e telões: os overlays grandes de propaganda e o logotipo da Stein viram painéis coloridos, encostados na
// parede (3 cm à frente), sem colisão. Overlays pequenos (manchas, marcas de rua) ficam de fora.
export function addNeonSignage(map) {
  const { bsp, convert } = map, L = bsp.lump(45), seen = new Map();
  const color = (name, rect) => {
    const key = name + rect.map(v => v.toFixed(2)).join(',');
    if (seen.has(key)) return seen.get(key);
    const vmt = readVmt(bsp, name), vtf = vmt?.base && bsp.asset('materials/' + vmt.base + '.vtf'), info = vtfColor(vtf, rect);
    const out = info && info.coverage > .3 ? hex(info.rgb.map((v, i) => srgb(Math.min(1, v * (vmt.tint ? vmt.tint[i] : 1))))) : null;
    seen.set(key, out); return out;
  };
  // O overlay só vale se a parede onde ele foi colado existe no mapa convertido (senão ficaria flutuando).
  const walls = map.polygons.filter(f => f.tag === 'world' && Math.abs(f.n[1]) < .3);
  const onWall = (c, n) => walls.some(f => {
    if (f.n[0] * n[0] + f.n[1] * n[1] + f.n[2] * n[2] < .95) return false;
    const d = f.n[0] * (c[0] - f.p[0][0]) + f.n[1] * (c[1] - f.p[0][1]) + f.n[2] * (c[2] - f.p[0][2]); if (Math.abs(d) > .12) return false;
    const lo = [0, 1, 2].map(i => Math.min(...f.p.map(q => q[i])) - .3), hi = [0, 1, 2].map(i => Math.max(...f.p.map(q => q[i])) + .3);
    return c.every((v, i) => v >= lo[i] && v <= hi[i]);
  });
  const vec = p => [L.readFloatLE(p), L.readFloatLE(p + 4), L.readFloatLE(p + 8)];
  let added = 0;
  for (let p = 0; p + 352 <= L.length; p += 352) {
    const material = bsp.materials[bsp.texInfo[L.readInt16LE(p + 4)]?.data] || '';
    if (!/ads\/|stein_crosshair|signage/.test(material)) continue;
    const uv = [0, 1, 2, 3].map(i => vec(p + 280 + i * 12)), origin = vec(p + 328), n = vec(p + 340);
    const U = [uv[0][2], uv[1][2], uv[2][2]], V = [n[1] * U[2] - n[2] * U[1], n[2] * U[0] - n[0] * U[2], n[0] * U[1] - n[1] * U[0]];
    const xs = uv.map(a => a[0]), ys = uv.map(a => a[1]), area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) * .0254 ** 2;
    if (area < 4) continue;
    const fu = [L.readFloatLE(p + 264), L.readFloatLE(p + 268)].sort((a, b) => a - b), fv = [L.readFloatLE(p + 272), L.readFloatLE(p + 276)].sort((a, b) => a - b);
    const c = color(material, [fu[0], fu[1], fv[0], fv[1]]); if (c == null) continue;
    const nn = [n[0], n[2], -n[1]];
    if (!onWall(convert(origin), nn)) continue;
    const pts = uv.map(([u, v]) => convert(origin.map((o, i) => o + u * U[i] + v * V[i] + n[i] * 1.2)));
    map.polygons.push({ p: pts, n: nn, c, glass: false, tag: 'sign', uv: pts.map(() => [0, 0]), pat: P.plain });
    map.polygons.push({ p: pts.slice().reverse(), n: nn.map(v => -v), c, glass: false, tag: 'sign', uv: pts.map(() => [0, 0]), pat: P.plain });
    added++;
  }
  // Letreiros em 3D (Stein, Switch+, ZURA...): caixa com as medidas do próprio modelo e a cor da arte.
  for (const prop of bsp.staticProps()) {
    if (!/akiba_signage\//.test(prop.model)) continue;
    const mdl = bsp.asset(prop.model); if (!mdl || mdl.toString('ascii', 0, 4) !== 'IDST') continue;
    const lo = [mdl.readFloatLE(104), mdl.readFloatLE(108), mdl.readFloatLE(112)], hi = [mdl.readFloatLE(116), mdl.readFloatLE(120), mdl.readFloatLE(124)];
    if (hi.some((v, i) => v - lo[i] <= 0 || v - lo[i] > 2000)) continue;
    const base = prop.model.replace(/^models\//, '').replace(/\.mdl$/, ''), name = base.split('/').pop().replace(/_b$/, '');
    const vtf = bsp.asset('materials/akihabara/models/props/exterior/akiba_signage/' + name + '.vtf'), info = vtfColor(vtf);
    const c = info && info.coverage > .2 ? hex(info.rgb.map(srgb)) : 0xe6e6e6;
    const rot = rotationOf(prop.angles), xf = v => convert(rot(v).map((x, i) => x * prop.scale + prop.origin[i]));
    const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map(k => xf(k.map((t, i) => t ? hi[i] : lo[i])));
    for (const [ids, ln] of [[[4, 5, 6, 7], [0, 0, 1]], [[3, 2, 1, 0], [0, 0, -1]], [[0, 1, 5, 4], [0, -1, 0]], [[2, 3, 7, 6], [0, 1, 0]], [[3, 0, 4, 7], [-1, 0, 0]], [[1, 2, 6, 5], [1, 0, 0]]]) {
      const w = rot(ln); map.polygons.push({ p: ids.map(i => corners[i]), n: [w[0], w[2], -w[1]], c, glass: false, tag: 'sign', uv: ids.map(() => [0, 0]), pat: P.plain });
    }
    added++;
  }
  map.report.signage = added;
}

// Sable (dorg): objetos padrão do CS usados no mapa que as regras gerais não cobrem.
// Varal de lanternas de papel acesas (corredor coberto do Sable): três cordões com lanternas penduradas e curvatura.
function lanternStrings(box) {
  const out = [], cord = 0x2a2420;
  const strand = (alongX, off) => {
    for (let t = -60; t <= 60; t += 20) {
      const sag = 10 * (1 - (t / 66) ** 2), zc = -8 - sag, x = alongX ? t : off, y = alongX ? off : t;
      out.push({ faces: box(x - 5.5, x + 5.5, y - 5.5, y + 5.5, zc - 12, zc, true), mask: 0, color: 0xffb35c, pat: P.lantern, faceUv: true });
      out.push({ faces: box(x - .6, x + .6, y - .6, y + .6, zc, zc + 4 + sag * .2, false), mask: 0, color: cord, pat: P.plain });
    }
    for (let t = -70; t < 70; t += 10) {
      const m = t + 5, sag = 10 * (1 - (m / 66) ** 2), z = -4 - sag, x = alongX ? m : off, y = alongX ? off : m;
      out.push({ faces: alongX ? box(x - 5.2, x + 5.2, y - .5, y + .5, z - .5, z + .5) : box(x - .5, x + .5, y - 5.2, y + 5.2, z - .5, z + .5), mask: 0, color: cord, pat: P.plain });
    }
  };
  strand(true, -22); strand(true, 22); strand(false, 0);
  return out;
}

export const SABLE_PROPS = [
  [/street_lanterns0[12]/, () => ({ custom: lanternStrings })],
  [/ornate_lamp|it_lantern|light02_32/, () => ({ custom: box => [{ faces: box(-5, 5, -5, 5, -14, -2, true), mask: 0, color: 0xffd08a, pat: P.lantern, faceUv: true }] })],
  // Medidas reais tiradas das pilhas do próprio mapa (o nome do modelo não é a medida): a lona é só um pano por cima
  // do caixote que já existe no mesmo lugar, então fica de fora para não criar um caixote flutuando.
  [/_tarp/, () => null],
  [/dust_crate_style_01_32x64x64/, () => ({ size: [32, 64, 53], color: 0xb08850, pat: P.crate, faceUv: true })],
  [/inferno_wine_crate/, () => ({ size: [22, 14, 8], color: 0xb08850, pat: P.crate, faceUv: true })],
  [/wine_crate_[ab]/, () => ({ size: [62, 62, 62], color: 0xb08850, pat: P.crate, faceUv: true })],
  [/dust_crate_style_\d+_(\d+)x(\d+)x(\d+)/, m => { const d = m.match(/(\d+)x(\d+)x(\d+)/); return { size: [+d[1], +d[2], +d[3]], color: 0xb08850, pat: P.crate, faceUv: true }; }],
  [/wooden_crate_(\d+)x(\d+)/, m => { const d = m.match(/(\d+)x(\d+)/); return { size: [+d[1], +d[2], +d[2]], color: 0xb08850, pat: P.crate, faceUv: true }; }],
  [/barrel_a_full|barrel_a\//, () => ({ size: [30, 30, 44], cyl: true, color: 0x8a5a34, pat: P.barrel, faceUv: true })],
  [/inferno_vespa/, () => ({ size: [72, 28, 44], color: 0x6fa7a0, pat: P.metal })],
  [/furniture_couch0[12]a/, () => ({ size: [80, 36, 34], color: 0x3e5f86, pat: P.plain })],
  [/inferno_chair|dust_patio_chair/, () => ({ size: [20, 20, 36], color: 0x7a5a3a, pat: P.wood })],
  [/dust_detruis_sack|dust_flour_sack/, () => ({ size: [36, 24, 14], color: 0xc8b796, pat: P.concrete })],
  [/inferno_planter\.mdl$|inferno_planter$/, () => ({ size: [64, 24, 28], color: 0x9a6a48, pat: P.brick })],
];
