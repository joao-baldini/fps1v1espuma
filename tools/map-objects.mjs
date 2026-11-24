// Objetos dos mapas convertidos que não são parede fixa:
// - vidraças (func_breakable de vidro e brushes WINDOW do BSP): seguram o corpo, mas o tiro atravessa, e quebram com tiro
//   ou granada; viram objetos separados para sumirem quando quebram;
// - portas (prop_door_rotating e portas com dobradiça entre dois espaços andáveis): abrem com E, giram 90° na dobradiça;
// - grades, gradis, portões de barras e cercas: em vez do bloco maciço do .phy (ou de nada, quando não eram sólidas no CS),
//   barras de verdade; o corpo continua barrado (quando era sólido) e o tiro passa entre as barras;
// - brushes GRATE do BSP: o tiro passa (como no CS) e o desenho vira barras.
// Cada face e peça de colisão chega marcada com a origem (`src` e `brush`, de tools/source-bsp.mjs).
import { readPhy, rotation, SEE_THROUGH, PATTERNS as P } from './source-bsp.mjs';

export const MASK = { move: 1, shot: 2, glass: 8 };
const GLASS_MASK = MASK.move | MASK.glass;
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, k) => a.map(v => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
const IRON = 0x5b636b, WOOD = 0x8a6a48, WIRE = 0x8d969c, DOOR_WOOD = 0x8f6a46;

// Caixa (em coordenadas locais) levada ao espaço do jogo por `xf`: faces com normal para fora e o casco convexo.
function box(xf, x0, x1, y0, y1, z0, z1) {
  const c = [0, 1, 2, 3, 4, 5, 6, 7].map(i => xf([i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0]));
  const mid = mul(c.reduce(add, [0, 0, 0]), 1 / 8), faces = [];
  for (const q of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) {
    // Vértices copiados: a navegação desloca cada vértice no lugar, e um vértice compartilhado andaria duas vezes.
    let p = q.map(i => c[i].slice()), n = unit(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    if (dot(n, sub(p[0], mid)) < 0) { p = p.reverse(); n = mul(n, -1); }
    faces.push({ p, n });
  }
  const lo = [0, 1, 2].map(i => Math.min(...c.map(v => v[i]))), hi = [0, 1, 2].map(i => Math.max(...c.map(v => v[i])));
  return { faces, hull: { planes: faces.map(f => [...f.n, dot(f.n, f.p[0])]), min: lo, max: hi } };
}
const polygon = (f, c, pat, glass = false) => ({ p: f.p, n: f.n, c, glass, tag: 'prop', pat, uv: f.p.map(v => { const a = Math.abs(f.n[0]) > Math.abs(f.n[2]) ? 2 : 0; return [v[a] / 1.6, v[1] / 1.6]; }) });

// Barras dentro de uma caixa local (unidades Source). kind: 'bars' (barras verticais com travessas), 'mesh' (tela de
// arame em quadrados), 'lattice' (treliça de madeira). Painel vertical no eixo horizontal mais comprido; se a caixa é
// mais baixa que larga e funda, vira grelha de piso.
export function barBoxes(lo, hi, kind = 'bars') {
  const ext = [0, 1, 2].map(i => hi[i] - lo[i]), out = [];
  if (ext[2] < Math.min(ext[0], ext[1]) && ext[2] < 12) {
    const y = hi[2], step = 6;
    for (let x = lo[0] + step / 2; x < hi[0]; x += step) out.push([x - .5, x + .5, lo[1], hi[1], y - 1.5, y]);
    for (let v = lo[1] + step / 2; v < hi[1]; v += step) out.push([lo[0], hi[0], v - .4, v + .4, y - 1.2, y - .2]);
    return out;
  }
  const a = ext[0] >= ext[1] ? 0 : 1, t = 1 - a, c = (lo[t] + hi[t]) / 2, z0 = lo[2], z1 = hi[2];
  const along = (u0, u1, w, za, zb) => { const b = [0, 0, 0, 0, za, zb]; b[a * 2] = u0; b[a * 2 + 1] = u1; b[t * 2] = c - w; b[t * 2 + 1] = c + w; return b; };
  const step = kind === 'mesh' ? 7 : kind === 'lattice' ? 8 : 6, w = kind === 'mesh' ? .3 : kind === 'lattice' ? .8 : .6;
  for (let u = lo[a] + step / 2; u < hi[a]; u += step) out.push(along(u - w, u + w, w, z0, z1));
  if (kind !== 'bars') for (let z = z0 + step / 2; z < z1; z += step) out.push(along(lo[a], hi[a], w, z - w, z + w));
  const r = kind === 'mesh' ? 1 : 1.1;
  out.push(along(lo[a], hi[a], r, Math.max(z0, z1 - 2), z1), along(lo[a], hi[a], r, z0, Math.min(z1, z0 + 2)));
  if (kind === 'bars' && ext[2] > 60) out.push(along(lo[a], hi[a], r * .8, (z0 + z1) / 2 - 1, (z0 + z1) / 2 + 1));
  out.push(along(lo[a], lo[a] + 2, r * 1.3, z0, z1), along(hi[a] - 2, hi[a], r * 1.3, z0, z1));
  return out;
}
const kindOf = model => /chainlink|wire|gate_fence|fence_gate/.test(model) ? 'mesh' : /lattice/.test(model) ? 'lattice' : 'bars';
const colorOf = kind => kind === 'lattice' ? WOOD : kind === 'mesh' ? WIRE : IRON;

const insideHull = (h, p, eps) => h.planes.every(q => q[0] * p[0] + q[1] * p[1] + q[2] * p[2] <= q[3] + eps);
const centroid = f => mul(f.p.reduce(add, [0, 0, 0]), 1 / f.p.length);
const rotY = (v, s, c) => [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
// Casco girado em torno do eixo vertical que passa pela dobradiça (ângulo em radianos).
function rotateHull(h, hinge, ang) {
  const s = Math.sin(ang), c = Math.cos(ang);
  const planes = h.planes.map(q => { const n = rotY(q, s, c); return [...n, q[3] - dot(q, hinge) + dot(n, hinge)]; });
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i & 1 ? h.max[0] : h.min[0], i & 2 ? h.max[1] : h.min[1], i & 4 ? h.max[2] : h.min[2]]).map(p => add(rotY(sub(p, hinge), s, c), hinge));
  return { planes, min: [0, 1, 2].map(i => Math.min(...corners.map(v => v[i]))), max: [0, 1, 2].map(i => Math.max(...corners.map(v => v[i]))) };
}
const boundsOf = list => [[0, 1, 2].map(i => Math.min(...list.map(h => h.min[i]))), [0, 1, 2].map(i => Math.max(...list.map(h => h.max[i])))];

export function extractMapObjects(map, { packMap, nav, navHeightsAt } = {}) {
  const { bsp, convert } = map, report = { panes: 0, panesStatic: 0, doors: 0, doorsStatic: 0, grateProps: 0, grateBrushes: 0, barsFaces: 0 }, detail = { panesThick: 0, panesClosed: 0, doorList: [], staticDoors: [] };
  const phyCache = new Map(), phyBounds = model => {
    if (!phyCache.has(model)) {
      const a = bsp.asset(model.replace(/\.mdl$/, '.phy')); let b = null;
      if (a) { const v = readPhy(a).flatMap(h => h.vertices); if (v.length) b = [[0, 1, 2].map(i => Math.min(...v.map(q => q[i]))), [0, 1, 2].map(i => Math.max(...v.map(q => q[i])))]; }
      phyCache.set(model, b);
    }
    return phyCache.get(model);
  };
  // Lado de lá da porta faz parte do mapa jogável do CS? (navegação original dos dois lados, a 30 unidades da folha)
  const navBoth = (pr, hingeLocal, otherLocal) => {
    if (!nav || !navHeightsAt) return true;
    const r = rotation(pr.angles), s = pr.scale || 1, P0 = add(r(mul(hingeLocal, s)), pr.origin), P1 = add(r(mul(otherLocal, s)), pr.origin);
    const m = mul(add(P0, P1), .5), u = unit([P1[0] - P0[0], P1[1] - P0[1], 0]), n = [-u[1], u[0], 0];
    return [1, -1].every(sg => navHeightsAt(nav, m[0] + n[0] * sg * 30, m[1] + n[1] * sg * 30).some(h => Math.abs(h - P0[2]) < 40));
  };
  const frame = pr => { const r = rotation(pr.angles), s = pr.scale || 1; return p => convert(add(r(mul(p, s)), pr.origin)); };
  const drop = new Set(), extraFaces = [];

  // 1. Grades com .phy: o bloco do casco sai do desenho; entram barras. Sólida no CS: o corpo continua barrado, o tiro passa.
  const groups = new Map();
  for (const f of map.polygons) if (f.src?.prop && SEE_THROUGH.test(f.src.prop.model)) { (groups.get(f.src) || groups.set(f.src, { faces: [], hulls: [] }).get(f.src)).faces.push(f); }
  for (const h of map.hulls) if (h.src?.prop && SEE_THROUGH.test(h.src.prop.model)) { (groups.get(h.src) || groups.set(h.src, { faces: [], hulls: [] }).get(h.src)).hulls.push(h); }
  for (const [src, g] of groups) {
    const pr = src.prop, b = phyBounds(pr.model); if (!b) continue;
    for (const f of g.faces) drop.add(f);
    for (const h of g.hulls) h.mask = pr.solid ? MASK.move : 0;
    const kind = kindOf(pr.model), xf = frame(pr);
    for (const bb of barBoxes(b[0], b[1], kind)) for (const f of box(xf, ...bb).faces) extraFaces.push(polygon(f, colorOf(kind), kind === 'lattice' ? P.wood : P.metal));
    report.grateProps++;
  }

  // 2. Brushes GRATE (grelha/gradil desenhado num cartão): o tiro passa e o cartão vira barras.
  const flat = map.polygons.filter(f => f.tag === 'world' && !(f.src && f.src.prop)).map(f => [f, centroid(f)]);
  const facesIn = h => flat.filter(([f, c]) => f.src === h.src && c.every((v, i) => v >= h.min[i] - .05 && v <= h.max[i] + .05) && insideHull(h, c, .03)).map(([f]) => f);
  for (const h of map.hulls) {
    if (!h.brush || !(h.brush.contents & 8) || (h.brush.contents & 1)) continue;
    h.mask = MASK.move;
    for (const f of facesIn(h)) drop.add(f);
    const lo = h.min, hi = h.max, gameBox = p => p; // caixa já no espaço do jogo (Y para cima)
    const local = [lo[0], hi[0], lo[2], hi[2], lo[1], hi[1]].map(v => v / .0254);
    for (const bb of barBoxes([local[0], local[2], local[4]], [local[1], local[3], local[5]], 'bars')) {
      const [x0, x1, z0, z1, y0, y1] = bb.map(v => v * .0254);
      for (const f of box(gameBox, x0, x1, y0, y1, z0, z1).faces) extraFaces.push(polygon(f, IRON, P.metal));
    }
    report.grateBrushes++;
  }

  // 3. Vidraças: func_breakable de vidro (material 0) e brushes WINDOW do mundo, cada uma um objeto.
  const objects = [], panes = [];
  const entGroups = new Map();
  for (const f of map.polygons) if (f.src?.ent && /^func_breakable/.test(f.src.ent) && (f.src.material == null || f.src.material === '0' || f.src.ent === 'func_breakable_surf')) (entGroups.get(f.src) || entGroups.set(f.src, { faces: [], hulls: [] }).get(f.src)).faces.push(f);
  for (const h of map.hulls) if (h.src?.ent && entGroups.has(h.src)) entGroups.get(h.src).hulls.push(h);
  for (const g of entGroups.values()) if (g.hulls.length) panes.push(g);
  for (const h of map.hulls) if (h.brush && (h.brush.contents & 2) && !(h.brush.contents & 1) && !(h.src && entGroups.has(h.src))) panes.push({ faces: facesIn(h), hulls: [h] });

  // 4. Portas: prop_door_rotating e portas de folha única (.phy fina e alta) com dobradiça na ponta mais perto da origem.
  const doors = [], doorGroups = new Map();
  const DOOR = /door/, NOT_DOOR = /frame|trim|bell|mailbox|knob|handle|sign|stop|refrigerator|rollup|_button|panel_|lock\.mdl|window/;
  for (const f of map.polygons) if (f.src?.prop && DOOR.test(f.src.prop.model) && !NOT_DOOR.test(f.src.prop.model) && f.src.prop.solid) (doorGroups.get(f.src) || doorGroups.set(f.src, { faces: [], hulls: [] }).get(f.src)).faces.push(f);
  for (const h of map.hulls) if (h.src && doorGroups.has(h.src)) doorGroups.get(h.src).hulls.push(h);
  for (const [src, g] of doorGroups) {
    const pr = src.prop, b = phyBounds(pr.model); if (!b || !g.hulls.length) continue;
    const ext = sub(b[1], b[0]), a = ext[0] >= ext[1] ? 0 : 1, t = 1 - a;
    const rotating = pr.cls === 'prop_door_rotating';
    if (!rotating && (ext[t] > 8 || ext[2] < 80 || ext[a] < 24 || ext[a] > 140)) continue;
    const hingeLocal = [0, 0, b[0][2]]; hingeLocal[a] = Math.abs(b[0][a]) <= Math.abs(b[1][a]) ? b[0][a] : b[1][a]; hingeLocal[t] = (b[0][t] + b[1][t]) / 2;
    const otherLocal = hingeLocal.slice(); otherLocal[a] = hingeLocal[a] === b[0][a] ? b[1][a] : b[0][a];
    const xf = frame(pr);
    doors.push({ ...g, rotating, hinge: xf(hingeLocal), tip: xf(otherLocal), height: ext[2] * (pr.scale || 1) * .0254, model: pr.model, navBoth: navBoth(pr, hingeLocal, otherLocal) });
  }
  // Portas do Dust sem .phy (antes invisíveis): folha WxH centrada na origem, espessura no +Y (como a versão _lod que tem .phy).
  for (const pr of bsp.staticProps()) {
    const m = pr.model.match(/dust_doors\/dust_door_(\d+)x(\d+)_\d+\.mdl$/); if (!m || bsp.pak.has(pr.model.replace(/\.mdl$/, '.phy'))) continue;
    const W = +m[1], H = +m[2], xf = frame(pr), piece = box(xf, -W / 2, W / 2, 0, 3, 0, H), src = { prop: { ...pr, cls: 'static' } };
    const faces = piece.faces.map(f => ({ ...polygon(f, DOOR_WOOD, P.wood), src })), hull = { ...piece.hull, mask: pr.solid ? 3 : 0, src };
    // Na navegação do CS alguém anda onde a folha estaria: era porta aberta ou de enfeite, fica só o desenho.
    if (nav && navHeightsAt) { let hit = 0; for (const k of [.2, .5, .8]) { const q = add(pr.origin, rotation(pr.angles)([(k - .5) * W, 1.5, 0])); if (navHeightsAt(nav, q[0], q[1]).some(hh => Math.abs(hh - pr.origin[2]) < 30)) hit++; } if (hit >= 2) hull.mask = 0; }
    map.polygons.push(...faces); map.hulls.push(hull);
    doors.push({ faces, hulls: [hull], rotating: false, hinge: xf([-W / 2, 1.5, 0]), tip: xf([W / 2, 1.5, 0]), height: H * .0254, model: pr.model, navBoth: navBoth(pr, [-W / 2, 1.5, 0], [W / 2, 1.5, 0]) });
  }

  // Validação no espaço do mapa: vidraça precisa de espaço livre dos dois lados (senão é janela pintada na parede, que
  // fica como está); porta precisa de chão andável dos dois lados (senão é porta de enfeite, que fica fechada).
  map.polygons = map.polygons.filter(f => !drop.has(f)).concat(extraFaces); report.barsFaces = extraFaces.length;
  for (const p of panes) for (const h of p.hulls) h.mask = 3;
  for (const d of doors) { d.saved = d.hulls.map(h => h.mask); for (const h of d.hulls) h.mask = 0; }
  const native = packMap ? new globalThis.SourceMaps.NativeMap(packMap(map)) : null;
  const free = (o, d, len) => { const hit = native.ray(o, d, len); return !hit || hit.t >= len; };
  for (const p of panes) {
    const [lo, hi] = boundsOf(p.hulls), ext = sub(hi, lo), c = mul(add(lo, hi), .5);
    const axis = ext[0] <= ext[2] ? 0 : 2, thin = ext[axis];
    if (thin > .45 || Math.max(ext[0], ext[2]) < .15 || ext[1] < .15) { report.panesStatic++; detail.panesThick++; if (detail.thickSizes = detail.thickSizes || [], detail.thickSizes.length < 12) detail.thickSizes.push(ext.map(v => v.toFixed(2)).join('x') + (p.faces[0]?.src?.ent ? ' ' + p.faces[0].src.ent : ' world') + ' f' + p.faces.length); continue; }
    const n = [0, 0, 0]; n[axis] = 1;
    const ok = !native || [1, -1].every(sg => free(add(c, mul(n, sg * (thin / 2 + .02))), mul(n, sg), .9));
    if (!ok) { report.panesStatic++; detail.panesClosed++; continue; }
    const id = objects.length; objects.push({ k: 'glass', c, n: [n[0], n[2]], hp: 1 });
    for (const h of p.hulls) { h.mask = GLASS_MASK; h.obj = id; }
    for (const f of p.faces) { f.obj = id; f.glass = true; }
    report.panes++;
  }
  for (const d of doors) {
    const ax = sub(d.tip, d.hinge); ax[1] = 0; const len = Math.hypot(ax[0], ax[2]);
    const restore = () => d.hulls.forEach((h, i) => { h.mask = d.saved[i]; });
    if (len < .3) { restore(); continue; }
    const u = mul(ax, 1 / len), n = [-u[2], 0, u[0]], mid = add(d.hinge, mul(u, len / 2)), y = Math.min(...d.hulls.map(h => h.min[1]));
    const walk = (x, z) => { const g = native.ground(x, z, y + .55); return g > y - .6 && g < y + .6 && !native.overlap(x, g + .03, z, 1.8, .3); };
    const both = !native || [1, -1].every(sg => walk(mid[0] + n[0] * sg * .75, mid[2] + n[2] * sg * .75));
    if (!d.rotating && (!both || !d.navBoth)) { restore(); report.doorsStatic++; detail.staticDoors.push(d.model.split('/').pop()); continue; }
    const id = objects.length, closed = d.hulls.slice();
    objects.push({ k: 'door', hinge: d.hinge, mid, n: [n[0], n[2]], len, h: d.height });
    closed.forEach(h => { h.mask = 3; h.obj = id; h.variant = 0; });
    for (const f of d.faces) { f.obj = id; f.glass = false; }
    // Duas posições abertas (girando para um lado ou para o outro), já prontas na colisão e desligadas.
    for (const [variant, ang] of [[1, Math.PI / 2], [2, -Math.PI / 2]]) for (const h of closed) map.hulls.push({ ...rotateHull(h, d.hinge, ang), mask: 0, obj: id, variant });
    report.doors++; detail.doorList.push(d.model.split('/').pop() + '@' + mid.map(v => v.toFixed(1)).join(','));
  }
  // Colisões de enfeite (máscara 0) não precisam ir para o jogo.
  map.hulls = map.hulls.filter(h => h.mask || h.obj != null);
  map.objects = objects;
  map.report.objects = report; map.report.objectDetail = detail;
  return report;
}

// Abre as portas na colisão enquanto `fn` roda (navegação e poda de caminhos tratam a porta como passagem).
export function withDoorsOpen(map, fn) {
  const saved = [];
  for (const h of map.hulls) if (h.obj != null && map.objects?.[h.obj]?.k === 'door' && h.variant === 0) { saved.push([h, h.mask]); h.mask = 0; }
  try { return fn(); } finally { for (const [h, m] of saved) h.mask = m; }
}
