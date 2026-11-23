// Lily (gi): o BSP é um mapa de desenvolvimento sem texturas, só com materiais de cor lisa (custom/lightergray,
// custom/gray, custom/lightred...). Os mesmos materiais aparecem em estruturas diferentes, então a classificação usa
// o material, a orientação da face, a altura e o contexto (o que há em cima e embaixo).
// Identidade visual: a mesma dos outros mapas (estilo VALORANT, como o Ascent): paleta quente e restrita, com um padrão
// que se repete em todas as estruturas:
// - casas em só três acabamentos (reboco pêssego, reboco creme e tijolo), um por casa, sempre com rodapé de pedra;
// - arcadas sempre de tijolo (as casas com arcos inteiras); colunas, sacadas e muretas em pedra clara; telhado de telha cerâmica num tom só; beirais de madeira;
// - ruas em lajes de pedra quente, calçadas e plataformas em lajotas, interiores em reboco creme com piso de madeira;
// - o viaduto quebrado (acima de ~12,5 m, na faixa do tabuleiro) é o elemento industrial: concreto, com asfalto e
//   faixas de pista no tabuleiro; as faixas vermelhas no chão (borda dos bombsites) continuam pintadas.
import { PATTERNS as P } from './source-bsp.mjs';

const ROOF = [0x9c5a40, 0x93533b];
// Acabamentos das casas (cor, padrão): reboco pêssego, reboco creme e tijolo terracota.
const BRICK = 0xa8644f;
const FINISH = [[0xe7a873, 'plain'], [0xead3aa, 'plain'], [BRICK, 'brick'], [0xe7a873, 'plain'], [0xead3aa, 'plain']];
const C = {
  plaster: 0xe2cba3, stoneBase: 0xb4a28a, stoneTrim: 0xe3d5bb, fascia: 0x6a4a34, soffit: 0x7a5639, interior: 0xe6d2b0, ceiling: 0xeadfc9,
  interiorFloor: 0x9a7150, street: 0xcdc0aa, sidewalk: 0xddd0b8, yard: 0xc6b9a3, outer: 0xccbfa9, paint: 0xcf4a2e,
  bridge: 0xa9a69f, bridgeDark: 0x8f8d88, asphalt: 0x6b6e73, reflector: 0xd8542c, pillarDark: 0x8a857d,
};
const PLINTH = .85;
const hash = n => { let t = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); t ^= t >>> 13; t = Math.imul(t, 0xc2b2ae35); return (t ^ (t >>> 16)) >>> 0; };
const centroid = p => [0, 1, 2].map(i => p.reduce((s, q) => s + q[i], 0) / p.length);
// Corta um polígono convexo pelo plano horizontal y = h; devolve as partes de baixo e de cima (ou null se não corta).
function splitY(p, h) {
  const below = [], above = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    // Cópias: etapas seguintes do importador mexem nos vértices no lugar, então nada pode ser compartilhado.
    if (a[1] <= h) below.push(a.slice()); if (a[1] >= h) above.push(a.slice());
    if ((a[1] - h) * (b[1] - h) < 0) { const t = (h - a[1]) / (b[1] - a[1]), q = [a[0] + (b[0] - a[0]) * t, h, a[2] + (b[2] - a[2]) * t]; below.push(q); above.push(q.slice()); }
  }
  return below.length >= 3 && above.length >= 3 ? { below, above } : null;
}
// uv planar em metros/2 (o mesmo tamanho de padrão das faces do BSP), pelo eixo dominante da normal.
function planarUv(p, n) {
  const a = n.map(Math.abs), ax = a[0] > a[1] && a[0] > a[2] ? [2, 1] : a[1] > a[2] ? [0, 2] : [0, 1];
  return p.map(q => [q[ax[0]] / 1.6256, q[ax[1]] / 1.6256]);
}

export function styleLily(map) {
  const faces = map.polygons.filter(f => f.material);
  const mat = f => f.material.replace(/^custom\//, '').replace(/^\//, '');
  // 1. Viaduto: células de 2 m onde há tabuleiro (teto ou piso) acima de 12,5 m.
  const cell = 2, key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell), bridge = new Set();
  for (const f of faces) {
    const c = centroid(f.p); if (c[1] < 12.5 || Math.abs(f.n[1]) < .9) continue;
    const xs = f.p.map(q => q[0]), zs = f.p.map(q => q[2]);
    for (let x = Math.min(...xs); x <= Math.max(...xs) + cell; x += cell) for (let z = Math.min(...zs); z <= Math.max(...zs) + cell; z += cell) bridge.add(key(x, z));
  }
  const inBridge = (x, z) => bridge.has(key(x, z));
  // 2. Telhados: faces lightred voltadas para cima com inclinação de telhado; componentes ligados = uma casa.
  const roofs = faces.filter(f => mat(f) === 'lightred' && f.n[1] > .6 && f.n[1] < .95 && !(centroid(f.p)[1] > 12.5 && inBridge(centroid(f.p)[0], centroid(f.p)[2])));
  const parent = roofs.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const vkey = q => q.map(v => Math.round(v * 10)).join(','), owner = new Map();
  roofs.forEach((f, i) => { for (const q of f.p) { const k = vkey(q); if (owner.has(k)) parent[find(i)] = find(owner.get(k)); else owner.set(k, i); } });
  // Triângulos dos telhados no plano XZ, para achar o telhado acima de um ponto.
  const tris = [];
  roofs.forEach((f, i) => { for (let k = 1; k < f.p.length - 1; k++) tris.push({ a: f.p[0], b: f.p[k], c: f.p[k + 1], id: find(i), y: Math.min(f.p[0][1], f.p[k][1], f.p[k + 1][1]), top: Math.max(f.p[0][1], f.p[k][1], f.p[k + 1][1]) }); });
  const inside = (x, z, t) => {
    const s = (p, q) => (q[0] - p[0]) * (z - p[2]) - (q[2] - p[2]) * (x - p[0]);
    const d1 = s(t.a, t.b), d2 = s(t.b, t.c), d3 = s(t.c, t.a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const roofAbove = (x, y, z) => { let best = null; for (const t of tris) if (t.top > y - .2 && (!best || t.y < best.y) && inside(x, z, t)) best = t; return best && best.id; };
  const roofColor = id => ROOF[hash(id * 7 + 3) % ROOF.length], finish = id => FINISH[hash(id * 13 + 5) % FINISH.length];
  const set = (f, c, pat) => { f.c = c; f.pat = pat; }, roofIndex = new Map(roofs.map((f, i) => [f, i]));
  const walls = [], deck = [];
  // 2b. Arcadas: a parte de baixo dos arcos (faces inclinadas para baixo entre 1 e 8 m, fora o telhado e o viaduto).
  // As casas com arcos e tudo que fica a até 2,5 m de um arco (pilares, frente dos arcos, fundo da arcada) é tijolo.
  const arches = faces.filter(f => { const c = centroid(f.p); return mat(f) !== 'lightred' && f.n[1] < -.15 && f.n[1] > -.97 && c[1] > 1 && c[1] < 8 && !inBridge(c[0], c[2]); });
  const archSet = new Set(arches), archPts = arches.map(f => centroid(f.p)), archHouses = new Set();
  for (const c of archPts) { const id = roofAbove(c[0], c[1], c[2]); if (id !== null) archHouses.add(id); }
  const nearArch = (x, y, z) => { for (const c of archPts) if (Math.abs(c[0] - x) < 2.5 && Math.abs(c[2] - z) < 2.5 && Math.abs(c[1] - y) < 4 && Math.hypot(c[0] - x, c[1] - y, c[2] - z) < 2.5) return true; return false; };
  let houses = new Set(), stats = { roof: 0, wallHouse: 0, wall: 0, trim: 0, plinth: 0, bridge: 0, asphalt: 0, street: 0, interior: 0 };
  const floorGrid = new Map(), fcell = 1.5, fkey = (x, z) => Math.floor(x / fcell) + ',' + Math.floor(z / fcell);
  for (const f of faces) {
    const m = mat(f), [cx, cy, cz] = centroid(f.p), ny = f.n[1], wallish = Math.abs(ny) < .6;
    // Viaduto
    if (cy > 12.5 && inBridge(cx, cz) || m === 'darkgray' && inBridge(cx, cz)) {
      stats.bridge++;
      if (m === 'lightred' && !(ny > .9)) set(f, C.reflector, P.plain);
      else if (ny > .9) { set(f, C.asphalt, P.asphalt); stats.asphalt++; if (cy > 19) deck.push(f); }
      else set(f, m === 'darkgray' ? C.bridgeDark : C.bridge, P.concrete);
      continue;
    }
    if (m === 'lightred') {
      if (ny > .6 && ny < .95) { set(f, roofColor(find(roofIndex.get(f) ?? 0)), P.roof); stats.roof++; }
      else if (ny <= -.15) set(f, C.soffit, P.wood);
      else if (ny >= .95 && cy < 2.5) set(f, C.paint, P.plain);   // faixas vermelhas no chão (borda dos bombsites)
      else set(f, C.fascia, P.plain);
      continue;
    }
    if (m === 'lighterbrown' || m === 'laranja') { set(f, C.interior, P.plain); stats.interior++; continue; }
    if (ny < -.9) { set(f, C.ceiling, P.plain); continue; }
    if (archSet.has(f)) { set(f, BRICK, P.brick); stats.arch = (stats.arch || 0) + 1; continue; }
    if (ny <= -.15) { set(f, C.soffit, P.wood); continue; }          // parte de baixo de beirais e marquises
    if (ny >= .6) {
      // Chão (e rampas): dentro de casa (com telhado em cima) é piso cerâmico; fora depende do material.
      if (ny > .9) { const xs = f.p.map(q => q[0]), zs = f.p.map(q => q[2]); for (let x = Math.min(...xs); x <= Math.max(...xs) + fcell; x += fcell) for (let z = Math.min(...zs); z <= Math.max(...zs) + fcell; z += fcell) { const k = fkey(x, z); (floorGrid.get(k) || floorGrid.set(k, []).get(k)).push(cy); } }
      const id = roofAbove(cx, cy + 1.5, cz);
      if (id !== null && ny > .9) { set(f, C.interiorFloor, P.wood); stats.interior++; continue; }
      if (m === 'gray') { set(f, C.street, P.stone); stats.street++; }
      else if (m === 'whitegray') set(f, C.sidewalk, P.tile);
      else if (m === 'lightgray') set(f, C.yard, P.tile);
      else if (m === 'darkgray') set(f, C.asphalt, P.asphalt);
      else set(f, C.outer, P.stone);
      continue;
    }
    if (wallish) {
      if (m === 'darkgray') { set(f, C.pillarDark, P.concrete); continue; }
      // Arcadas, colunas, sacadas, muretas e bases (whitegray/lightgray): pedra clara, em todo o mapa.
      if (m === 'whitegray' || m === 'lightgray') {
        if (nearArch(cx, cy, cz) || archHouses.has(roofAbove(cx - f.n[0] * .45, cy, cz - f.n[2] * .45))) { set(f, BRICK, P.brick); stats.arch = (stats.arch || 0) + 1; continue; }
        set(f, C.stoneTrim, P.stone); stats.trim++; continue;
      }
      // Ponto logo atrás da parede (dentro do volume) para achar a casa pelo telhado de cima.
      walls.push({ f, id: roofAbove(cx - f.n[0] * .45, cy, cz - f.n[2] * .45) });
    }
  }
  // 3. Parede sem telhado logo acima (térreo de sobrado, muro colado na casa, oitão): fica com a cor do telhado mais
  // próximo, até 3,5 m; muros e plataformas longe de casas ficam em cimento claro.
  const near = (x, z) => {
    let best = null, bd = 3.5;
    for (const t of tris) for (const q of [t.a, t.b, t.c]) { const d = Math.hypot(q[0] - x, q[2] - z); if (d < bd) { bd = d; best = t.id; } }
    return best;
  };
  for (const w of walls) { const [cx, , cz] = centroid(w.f.p); w.id = w.id ?? near(cx - w.f.n[0] * .45, cz - w.f.n[2] * .45); }
  // O BSP divide uma mesma parede em várias faces: faces do mesmo plano que se tocam ficam com a cor da maioria.
  const wp = walls.map((_, i) => i), wf = i => wp[i] === i ? i : (wp[i] = wf(wp[i])), edges = new Map();
  walls.forEach((w, i) => {
    const n = w.f.n, d = n[0] * w.f.p[0][0] + n[1] * w.f.p[0][1] + n[2] * w.f.p[0][2], plane = n.map(v => Math.round(v * 20)).join(',') + ':' + Math.round(d * 5);
    for (let k = 0; k < w.f.p.length; k++) { const a = vkey(w.f.p[k]), b = vkey(w.f.p[(k + 1) % w.f.p.length]), e = plane + '|' + (a < b ? a + '|' + b : b + '|' + a); if (edges.has(e)) wp[wf(i)] = wf(edges.get(e)); else edges.set(e, i); }
  });
  const votes = new Map();
  walls.forEach((w, i) => { const r = wf(i), v = votes.get(r) || new Map(), k = w.id === null ? 'none' : w.id; v.set(k, (v.get(k) || 0) + w.f.p.length); votes.set(r, v); });
  const floorAt = (x, z, y) => { let best = -Infinity; for (const h of floorGrid.get(fkey(x, z)) || []) if (h <= y + .3 && h > best) best = h; return best; };
  walls.forEach((w, i) => {
    const top = [...votes.get(wf(i))].sort((a, b) => b[1] - a[1])[0][0], id = top === 'none' ? null : top;
    const [wx, wy, wz] = centroid(w.f.p), arcade = archHouses.has(id) || nearArch(wx, wy, wz);
    const [c, pat] = arcade ? [BRICK, 'brick'] : id !== null ? finish(id) : [C.plaster, 'plain'];
    if (id !== null) { houses.add(id); stats.wallHouse++; } else stats.wall++;
    set(w.f, c, P[pat]);
    // Rodapé de pedra: só em parede vertical cuja base está no chão em frente a ela.
    if (Math.abs(w.f.n[1]) > .15) return;
    const ys = w.f.p.map(q => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys), [cx, , cz] = centroid(w.f.p);
    const floor = floorAt(cx + w.f.n[0] * .6, cz + w.f.n[2] * .6, y0);
    if (!(Math.abs(y0 - floor) < .35) || y1 - y0 < 1.6) return;
    const cut = splitY(w.f.p, floor + PLINTH);
    if (!cut) return;
    w.f.p = cut.above;
    const base = { ...w.f, p: cut.below, c: C.stoneBase, pat: P.stone, uv: planarUv(cut.below, w.f.n) }; delete base.material; map.polygons.push(base);
    stats.plinth++;
  });
  // Escala única de textura em todo o mapa (um padrão a cada 64 unidades, como nos objetos).
  for (const f of faces) f.uv = planarUv(f.p, f.n);
  stats.roadLines = roadMarkings(map, deck);
  for (const f of faces) delete f.material;
  map.report.lilyStyle = { ...stats, houses: houses.size, bridgeCells: bridge.size };
  return map;
}

// Faixas da pista no tabuleiro do viaduto: a direção vem do eixo principal das faces do tabuleiro; em cada trecho
// ligado, bordas contínuas a 0,5 m da beirada e faixa central tracejada (3 m pintados, 3 m vazios), recortadas
// dentro de cada face (convexa), 2 cm acima do asfalto.
function roadMarkings(map, deck) {
  if (!deck.length) return 0;
  const cs = deck.map(f => centroid(f.p)), mx = cs.reduce((s, c) => s + c[0], 0) / cs.length, mz = cs.reduce((s, c) => s + c[2], 0) / cs.length;
  let sxx = 0, sxz = 0, szz = 0; for (const c of cs) { const x = c[0] - mx, z = c[2] - mz; sxx += x * x; sxz += x * z; szz += z * z; }
  const ang = .5 * Math.atan2(2 * sxz, sxx - szz), d = [Math.cos(ang), Math.sin(ang)], n = [-d[1], d[0]];
  // Trechos: faces que se tocam (vértices em comum) na mesma altura.
  const par = deck.map((_, i) => i), fd = i => par[i] === i ? i : (par[i] = fd(par[i])), own = new Map();
  deck.forEach((f, i) => { for (const q of f.p) { const k = q.map(v => Math.round(v * 10)).join(','); if (own.has(k)) par[fd(i)] = fd(own.get(k)); else own.set(k, i); } });
  const groups = new Map(); deck.forEach((f, i) => { const r = fd(i); (groups.get(r) || groups.set(r, []).get(r)).push(f); });
  let count = 0; const w = .15, paint = 0xefeee8;
  const quad = (f, s0, t0, t1) => {
    // Recorte da reta s = s0 (coordenada perpendicular) pela face convexa, no intervalo [t0, t1] ao longo da pista.
    const y = f.p[0][1] + .02, pts = f.p.map(q => [q[0] * d[0] + q[2] * d[1], q[0] * n[0] + q[2] * n[1]]);
    let lo = t0, hi = t1;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length], ex = b[0] - a[0], es = b[1] - a[1], area = pts.reduce((acc, p, i) => { const q = pts[(i + 1) % pts.length]; return acc + p[0] * q[1] - q[0] * p[1]; }, 0);
      // lado interno: sinal da área; ponto (t, s0) dentro se cross(e, p - a) tem o mesmo sinal
      const sign = Math.sign(area), cst = ex * (s0 - a[1]), ct = -es; // cross = ex*(s0-a1) - es*(t-a0)
      // cross(t) = cst - es*(t - a[0]) ; precisa sign*cross >= 0
      if (Math.abs(es) < 1e-9) { if (sign * cst < 0) return; continue; }
      const tc = a[0] + cst / es; // onde cross = 0
      if (sign * (-es) > 0) lo = Math.max(lo, tc); else hi = Math.min(hi, tc);
      void ct;
    }
    if (hi - lo < .05) return;
    const P2 = (t, s) => [t * d[0] + s * n[0], y, t * d[1] + s * n[1]];
    const p = [P2(lo, s0 - w), P2(hi, s0 - w), P2(hi, s0 + w), P2(lo, s0 + w)];
    // normal para cima: ordem anti-horária vista de cima
    const cr = (p[1][0] - p[0][0]) * (p[2][2] - p[0][2]) - (p[1][2] - p[0][2]) * (p[2][0] - p[0][0]);
    const pp = cr > 0 ? p.slice().reverse() : p;
    map.polygons.push({ p: pp, n: [0, 1, 0], c: paint, glass: false, tag: 'road', uv: pp.map(q => [q[0] / 2, q[2] / 2]), pat: P.plain }); count++;
  };
  for (const g of groups.values()) {
    let smin = Infinity, smax = -Infinity, tmin = Infinity, tmax = -Infinity;
    for (const f of g) for (const q of f.p) { const t = q[0] * d[0] + q[2] * d[1], s = q[0] * n[0] + q[2] * n[1]; smin = Math.min(smin, s); smax = Math.max(smax, s); tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); }
    if (smax - smin < 4 || tmax - tmin < 8) continue;
    for (const f of g) {
      for (const s0 of [smin + .5, smax - .5]) quad(f, s0, tmin, tmax);
      for (let t = Math.floor(tmin / 6) * 6; t < tmax; t += 6) quad(f, (smin + smax) / 2, t, t + 3);
    }
  }
  return count;
}
