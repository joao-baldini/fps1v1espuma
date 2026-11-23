// Lily (gi): o BSP é um mapa de desenvolvimento sem texturas, só com materiais de cor lisa (custom/lightergray,
// custom/gray, custom/lightred...). Os mesmos materiais aparecem em estruturas diferentes, então a classificação usa
// o material, a orientação da face, a altura e o contexto (o que há em cima e embaixo):
// - telhados (lightred inclinado ~32°) viram telha cerâmica, com o tom variando de casa em casa; a parte de baixo do
//   beiral é madeira e as testeiras são terracota escura;
// - paredes viram reboco de cimento com uma cor por casa (a casa é reconhecida pelo telhado logo acima); muros e
//   paredes fora de casas ficam cinza-cimento; os interiores laranja (lighterbrown) viram pintura ocre;
// - o viaduto quebrado (acima de ~12,5 m, na faixa do tabuleiro) vira concreto, com asfalto no tabuleiro e
//   pilares de concreto; os refletores vermelhos continuam vermelhos;
// - o chão vira calçamento nas ruas, lajotas nas calçadas e plataformas, concreto nos pátios e piso cerâmico dentro
//   das casas; as faixas vermelhas no chão (borda dos bombsites) continuam pintadas.
import { PATTERNS as P } from './source-bsp.mjs';

const ROOF = [0xb5553a, 0xa84b33, 0xc0653f, 0x9d4632, 0xb9603f, 0xae5236];
const WALL = [0xf3d36e, 0xe0a85a, 0xf2b98c, 0xe4956a, 0xeba3a2, 0xa8c9e0, 0xb2d8b4, 0xc9b8e2, 0xf0dfb2, 0x9fd0c8, 0xf6c7c0];
const C = {
  cement: 0xd9d4ca, fascia: 0x8c3e2b, soffit: 0x6e4c34, ochre: 0xdb9c4a, ceiling: 0xe8e2d6, interiorFloor: 0xc79f7b,
  street: 0xc9cbcd, sidewalk: 0xe0d8ca, yard: 0xb3ada3, outer: 0xcfcdc8, paint: 0xcf4a2e,
  bridge: 0xa3a4a5, bridgeDark: 0x8c8e91, asphalt: 0x6b6e73, reflector: 0xd8542c, pillarDark: 0x6c6e72,
};
const hash = n => { let t = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); t ^= t >>> 13; t = Math.imul(t, 0xc2b2ae35); return (t ^ (t >>> 16)) >>> 0; };
const centroid = p => [0, 1, 2].map(i => p.reduce((s, q) => s + q[i], 0) / p.length);

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
  const roofColor = id => ROOF[hash(id * 7 + 3) % ROOF.length], wallColor = id => WALL[hash(id * 13 + 5) % WALL.length];
  const set = (f, c, pat) => { f.c = c; f.pat = pat; }, roofIndex = new Map(roofs.map((f, i) => [f, i]));
  const walls = [], deck = [];
  let houses = new Set(), stats = { roof: 0, wallHouse: 0, wall: 0, bridge: 0, asphalt: 0, street: 0, interior: 0 };
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
    if (m === 'lighterbrown' || m === 'laranja') { set(f, C.ochre, P.plain); stats.interior++; continue; }
    if (ny < -.9) { set(f, C.ceiling, P.plain); continue; }
    if (ny <= -.15) { set(f, C.soffit, P.wood); continue; }          // parte de baixo de beirais e marquises
    if (ny >= .6) {
      // Chão (e rampas): dentro de casa (com telhado em cima) é piso cerâmico; fora depende do material.
      const id = roofAbove(cx, cy + 1.5, cz);
      if (id !== null && ny > .9) { set(f, C.interiorFloor, P.tile); stats.interior++; continue; }
      if (m === 'gray') { set(f, C.street, P.cobble); stats.street++; }
      else if (m === 'whitegray') set(f, C.sidewalk, P.tile);
      else if (m === 'lightgray') set(f, C.yard, P.concrete);
      else if (m === 'darkgray') set(f, C.asphalt, P.asphalt);
      else set(f, C.outer, P.cobble);
      continue;
    }
    if (wallish) {
      if (m === 'darkgray') { set(f, C.pillarDark, P.concrete); continue; }
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
  walls.forEach((w, i) => {
    const top = [...votes.get(wf(i))].sort((a, b) => b[1] - a[1])[0][0], id = top === 'none' ? null : top;
    if (id !== null) { houses.add(id); set(w.f, wallColor(id), P.concrete); stats.wallHouse++; }
    else { set(w.f, C.cement, P.concrete); stats.wall++; }
  });
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
