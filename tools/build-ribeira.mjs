// Ribeira: mapa original do Wingman (2v2, um bombsite), feito para este jogo.
// Usage: node tools/build-ribeira.mjs
// A planta é uma grade de células de 2 m (ZONES); prédios, fachadas, telhados, adereços, escadas e a colisão saem dela
// e das listas abaixo. Texturas leves: padrões procedurais do shader do jogo (nenhuma imagem).
//
// Rotas (T no sul, CT no norte, bombsite A no noroeste):
//   Long   - cais comprido à beira do canal, entra no bombsite pelo Portão (oeste).
//   Varanda- escadaria que sai do Long e sobe a um terraço de 3,2 m com parapeito sobre o bombsite (pode pular dentro).
//   Meio   - rua do T, Mercado coberto com bancas, Praça com chafariz e os Arcos que abrem no bombsite (leste).
//   Beco   - liga o Mercado ao Long (rotação dos T).
//   CT     - corredor direto ao bombsite (norte) e a Rua CT até a Praça para disputar o meio.
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { PATTERNS as P } from './source-bsp.mjs';
import { packMap, bakeNavigation } from './import-source-maps.mjs';
import { pruneNavigation, playerReach } from './import-wingman-maps.mjs';
import '../assets/maps/runtime.js';

export const RIBEIRA = { key: 'ribeira', name: 'Ribeira' };

// ---------------------------------------------------------------- planta
const W = 32, H = 38, CELL = 2, X0 = -32, Z0 = -38;
const cx = i => X0 + i * CELL, cz = j => Z0 + j * CELL;
// [i0, j0, i1, j1, tipo] (inclusive). '#' prédio, 'l' cais, 'p' praça, '.' rua, 'b' beco, 's' bombsite, 'a' arcos,
// 'm' mercado, 'u' terraço (3,2 m), 'e' escadaria, 'T'/'C' spawns, '~' canal.
const ZONES = [
  [0, 6, 0, 31, '~'],
  [1, 6, 3, 33, 'l'],
  [4, 12, 4, 13, 's'],          // Portão
  [5, 6, 12, 14, 's'],          // bombsite
  [9, 5, 11, 5, '.'],           // entrada CT
  [9, 3, 16, 4, '.'],           // corredor CT
  [17, 1, 25, 5, 'C'],          // spawn CT
  [20, 6, 23, 9, '.'],          // Rua CT
  [15, 10, 25, 18, 'p'],        // Praça
  [13, 8, 14, 12, 'a'],         // Arcos
  [5, 15, 12, 18, 'u'],         // Varanda (terraço)
  [4, 19, 4, 20, 'l'],          // passagem do Long para a escadaria
  [5, 19, 7, 20, 'e'],          // escadaria
  [8, 19, 9, 20, 'u'],          // patamar
  [4, 25, 15, 26, 'b'],         // Beco
  [16, 19, 23, 27, 'm'],        // Mercado
  [17, 28, 20, 29, '.'],        // rua do T
  [9, 30, 22, 34, 'T'],         // spawn T
  [4, 31, 8, 33, 'l'],          // saída do T para o Long
];
const grid = Array.from({ length: H }, () => Array(W).fill('#'));
for (const [i0, j0, i1, j1, t] of ZONES) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j][i] = t;
const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? null : grid[j][i];
const TERRACE = 3.2;

// ---------------------------------------------------------------- utilidades de geometria
const polygons = [], hulls = [];
const UVS = { [P.plain]: .5, [P.brick]: .8, [P.tile]: .6, [P.wood]: 1, [P.concrete]: .3, [P.metal]: .6, [P.ground]: .5, [P.stone]: .7, [P.asphalt]: .5, [P.roof]: .55, [P.foliage]: .5 };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const hash = (...v) => { let h = 2166136261; for (const x of v) { h ^= Math.round(x * 1000) | 0; h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

// Face plana (convexa). uv: projeção do mundo no plano da face, na escala do padrão (ou dada).
function face(pts, c, pat = P.plain, o = {}) {
  const n = o.n || unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  const s = o.s ?? UVS[pat] ?? .5;
  const ax = Math.abs(n[1]) > .7 ? [0, 2] : Math.abs(n[0]) > Math.abs(n[2]) ? [2, 1] : [0, 1];
  const uv = o.uv || pts.map(p => [p[ax[0]] * s + (o.du || 0), p[ax[1]] * s + (o.dv || 0)]);
  polygons.push({ p: pts.map(p => p.slice()), n, c, glass: !!o.glass, tag: o.tag || 'world', uv, pat });
}
function solid(x0, y0, z0, x1, y1, z1, mask = 3) {
  hulls.push({ planes: [[1, 0, 0, x1], [-1, 0, 0, -x0], [0, 1, 0, y1], [0, -1, 0, -y0], [0, 0, 1, z1], [0, 0, -1, -z0]], min: [x0, y0, z0], max: [x1, y1, z1], mask, src: 'ribeira' });
}
// Caixa: faces voltadas para fora; o.skip lista as faces que não aparecem; o.mask 0 = só visual.
function box(x0, y0, z0, x1, y1, z1, c, pat = P.plain, o = {}) {
  const sk = new Set(o.skip || ['-y']), top = o.top ?? c, tp = o.topPat ?? pat;
  if (!sk.has('+y')) face([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], top, tp, { ...o, n: [0, 1, 0] });
  if (!sk.has('-y')) face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], o.under ?? c, pat, { ...o, n: [0, -1, 0] });
  if (!sk.has('+x')) face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], c, pat, { ...o, n: [1, 0, 0] });
  if (!sk.has('-x')) face([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], c, pat, { ...o, n: [-1, 0, 0] });
  if (!sk.has('+z')) face([[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], c, pat, { ...o, n: [0, 0, 1] });
  if (!sk.has('-z')) face([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], c, pat, { ...o, n: [0, 0, -1] });
  if (o.mask !== 0) solid(x0, y0, z0, x1, y1, z1, o.mask ?? 3);
}
// Prisma vertical de n lados (barris, colunas, chafariz). Colisão convexa pelos mesmos planos.
function cyl(x, z, r, y0, y1, c, pat = P.plain, o = {}) {
  const n = o.seg || 10, ring = Array.from({ length: n }, (_, k) => { const a = (k + .5) * 2 * Math.PI / n; return [x + Math.cos(a) * r, z + Math.sin(a) * r]; });
  for (let k = 0; k < n; k++) {
    const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n], m = (k + 1) * 2 * Math.PI / n, nn = [Math.cos(m), 0, Math.sin(m)];
    const len = Math.hypot(bx - ax, bz - az), u0 = k * len * (o.s ?? UVS[pat]);
    face([[ax, y0, az], [ax, y1, az], [bx, y1, bz], [bx, y0, bz]], c, pat, { ...o, n: nn, uv: [[u0, y0 * (o.s ?? UVS[pat])], [u0, y1 * (o.s ?? UVS[pat])], [u0 + len * (o.s ?? UVS[pat]), y1 * (o.s ?? UVS[pat])], [u0 + len * (o.s ?? UVS[pat]), y0 * (o.s ?? UVS[pat])]] });
  }
  if (!o.noTop) face(ring.map(([px, pz]) => [px, y1, pz]).reverse(), o.top ?? c, o.topPat ?? pat, { ...o, n: [0, 1, 0] });
  if (o.mask !== 0) {
    const planes = [[0, 1, 0, y1], [0, -1, 0, -y0]];
    for (let k = 0; k < n; k++) { const m = (k + 1) * 2 * Math.PI / n, nn = [Math.cos(m), 0, Math.sin(m)], [ax, az] = ring[k]; planes.push([nn[0], 0, nn[2], nn[0] * ax + nn[2] * az]); }
    hulls.push({ planes, min: [x - r, y0, z - r], max: [x + r, y1, z + r], mask: o.mask ?? 3, src: 'ribeira' });
  }
}

// ---------------------------------------------------------------- paleta
const COL = {
  cobble: 0x9b9285, quay: 0xa49c8f, praca: 0xb5ab9b, pracaRing: 0x8f8579, beco: 0x8a8378, site: 0xcdb89c, siteDark: 0xa98f72,
  arcade: 0xbca78d, market: 0x8e8a83, terrace: 0xb46c4c, tspawn: 0x938d82, ctspawn: 0xa9a59d, stone: 0xb9b2a5, plinth: 0x8f877b,
  crate: 0xa57c4f, crateEdge: 0x6e5236, crate2: 0x8c6a45, metal: 0x6d7880, iron: 0x2f3438, roof: 0xb4593b, roofDark: 0x9a4a31,
  water: 0x2f6470, frame: 0xece5d6, glass: 0x26303a, door: 0x5b3b25, foliage: 0x4f7a3a, palm: 0x5d8a3c, trunk: 0x7a6248,
  paint: 0xb8402c, flat: 0x8f8a82, lamp: 0xf2d68a,
};
const FACADES = [0xe9d9b6, 0xd9a675, 0xcf8a70, 0xa9c6cf, 0xece7dc, 0xdcbf63, 0xb2c9a2, 0xe2b9a5, 0xc6d3dc];
const SHUTTERS = [0x3f6b4f, 0x3b5f86, 0x7a3b2e, 0x2f5a5c, 0x6b5a2e];

// ---------------------------------------------------------------- chão
const FLOOR = { l: [COL.quay, P.stone, .55], p: [COL.praca, P.stone, .8], '.': [COL.cobble, P.stone, 1.4], b: [COL.beco, P.stone, 1.4], s: [COL.site, P.tile, .32],
  a: [COL.arcade, P.tile, .7], m: [COL.market, P.concrete, .35], T: [COL.tspawn, P.stone, 1.0], C: [COL.ctspawn, P.tile, .5], u: [COL.terrace, P.tile, .6] };
function floors() {
  // Retângulos gulosos por tipo de chão: menos polígonos, textura contínua (uv pelo mundo).
  const done = Array.from({ length: H }, () => Array(W).fill(false));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const t = grid[j][i]; if (done[j][i] || !FLOOR[t]) continue;
    let w = 1; while (i + w < W && grid[j][i + w] === t && !done[j][i + w]) w++;
    let h = 1; outer: while (j + h < H) { for (let k = 0; k < w; k++) if (grid[j + h][i + k] !== t || done[j + h][i + k]) break outer; h++; }
    for (let a = 0; a < h; a++) for (let k = 0; k < w; k++) done[j + a][i + k] = true;
    const [c, pat, s] = FLOOR[t], y = t === 'u' ? TERRACE : 0;
    face([[cx(i), y, cz(j)], [cx(i), y, cz(j + h)], [cx(i + w), y, cz(j + h)], [cx(i + w), y, cz(j)]], c, pat, { n: [0, 1, 0], s });
  }
  // Uma laje de colisão sob tudo (o canal fica fora: a grade de ferro do cais impede chegar lá).
  solid(-30, -1, Z0, X0 + W * CELL, 0, Z0 + H * CELL);
}

// ---------------------------------------------------------------- prédios
// Células '#' viram lotes de até 4×4 células (8 m), cada um com altura, cor, janelas e telhado próprios.
const lots = [];
function buildingLots() {
  const id = Array.from({ length: H }, () => Array(W).fill(-1));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (grid[j][i] !== '#' || id[j][i] >= 0) continue;
    const maxW = 2 + Math.floor(hash(i, j, 1) * 3), maxH = 2 + Math.floor(hash(i, j, 2) * 3);
    let w = 1; while (w < maxW && i + w < W && grid[j][i + w] === '#' && id[j][i + w] < 0) w++;
    let h = 1; outer: while (h < maxH && j + h < H) { for (let k = 0; k < w; k++) if (grid[j + h][i + k] !== '#' || id[j + h][i + k] >= 0) break outer; h++; }
    const n = lots.length, r = hash(i, j, 3);
    for (let a = 0; a < h; a++) for (let k = 0; k < w; k++) id[j + a][i + k] = n;
    const style = r < .14 ? 'azulejo' : r < .24 ? 'brick' : 'plaster';
    lots.push({ i, j, w, h, height: 7 + Math.round(hash(i, j, 4) * 7) * .5, color: FACADES[Math.floor(hash(i, j, 5) * FACADES.length)], shutter: SHUTTERS[Math.floor(hash(i, j, 6) * SHUTTERS.length)],
      style, roof: hash(i, j, 7) < .68 ? 'gable' : 'flat' });
  }
  return id;
}
// Altura do topo de cada célula: chão andável 0, terraço 3,2, canal -1,5, prédio a altura do lote.
function topOf(i, j, lotId) {
  const t = at(i, j); if (t === null) return Infinity;
  if (t === '#') return lots[lotId[j][i]].height;
  if (t === 'u') return TERRACE; if (t === '~') return -1.5;
  return 0;
}
function buildings(lotId) {
  for (const L of lots) {
    const x0 = cx(L.i), x1 = cx(L.i + L.w), z0 = cz(L.j), z1 = cz(L.j + L.h), hgt = L.height;
    solid(x0, 0, z0, x1, hgt, z1);
    // Paredes: por célula da borda, só a parte acima do vizinho (rua, terraço ou prédio mais baixo).
    const wallPat = L.style === 'brick' ? P.brick : L.style === 'azulejo' ? P.tile : P.concrete;
    const wallCol = L.style === 'brick' ? 0xa8664a : L.style === 'azulejo' ? 0x9cb8d6 : L.color, wallS = L.style === 'azulejo' ? 1.5 : L.style === 'brick' ? .8 : .25;
    for (let j = L.j; j < L.j + L.h; j++) for (let i = L.i; i < L.i + L.w; i++) {
      for (const [di, dj, nn] of [[1, 0, [1, 0, 0]], [-1, 0, [-1, 0, 0]], [0, 1, [0, 0, 1]], [0, -1, [0, 0, -1]]]) {
        const ni = i + di, nj = j + dj; if (at(ni, nj) === null) continue;
        if (at(ni, nj) === '#' && lotId[nj][ni] === lotId[j][i]) continue;
        const below = topOf(ni, nj, lotId); if (below >= hgt) continue;
        const y0 = Math.max(below, -1.5);
        // pontos da aresta da célula nessa direção
        let a, b;
        if (di === 1) { a = [cx(i + 1), z0Of(j)]; b = [cx(i + 1), z1Of(j)]; } else if (di === -1) { a = [cx(i), z1Of(j)]; b = [cx(i), z0Of(j)]; }
        else if (dj === 1) { a = [cx(i + 1), cz(j + 1)]; b = [cx(i), cz(j + 1)]; } else { a = [cx(i), cz(j)]; b = [cx(i + 1), cz(j)]; }
        face([[a[0], y0, a[1]], [a[0], hgt, a[1]], [b[0], hgt, b[1]], [b[0], y0, b[1]]], wallCol, wallPat, { n: nn, s: wallS });
        const street = at(ni, nj) !== '#';
        facade(L, a, b, nn, y0, hgt, street, at(ni, nj));
      }
    }
    roof(L, x0, z0, x1, z1, hgt);
  }
}
const z0Of = j => cz(j), z1Of = j => cz(j + 1);

// Detalhes de uma fachada de 2 m: rodapé de pedra, janelas com venezianas, portas, sacadas e cornija.
function facade(L, a, b, n, y0, y1, street, neighbour) {
  const out = (p, d) => [p[0] + n[0] * d, p[1], p[2] + n[2] * d];
  const along = unit([b[0] - a[0], 0, b[1] - a[1]]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const P3 = (u, y, d) => out([mid[0] + along[0] * u, y, mid[1] + along[2] * u], d);
  const rect = (u0, u1, ya, yb, d, c, pat, o = {}) => face([P3(u0, ya, d), P3(u0, yb, d), P3(u1, yb, d), P3(u1, ya, d)].reverse(), c, pat, { n, ...o });
  const slab = (u0, u1, ya, yb, d0, d1, c, pat) => { // caixa saliente (visual)
    rect(u0, u1, ya, yb, d1, c, pat);
    face([P3(u0, yb, d0), P3(u0, yb, d1), P3(u1, yb, d1), P3(u1, yb, d0)], c, pat, { n: [0, 1, 0] });
    face([P3(u0, ya, d0), P3(u1, ya, d0), P3(u1, ya, d1), P3(u0, ya, d1)], c, pat, { n: [0, -1, 0] });
    face([P3(u0, ya, d0), P3(u0, ya, d1), P3(u0, yb, d1), P3(u0, yb, d0)], c, pat, { n: [-along[0], 0, -along[2]] });
    face([P3(u1, ya, d1), P3(u1, ya, d0), P3(u1, yb, d0), P3(u1, yb, d1)], c, pat, { n: along });
  };
  const k = hash(mid[0], mid[1], n[0], n[2]);
  // cornija
  slab(-1, 1, y1 - .28, y1 - .06, 0, .14, L.style === 'plaster' ? 0xf1ebe0 : 0xd8d0c2, P.concrete);
  if (!street || y0 > 1) {
    // fachada acima de outro prédio ou do terraço: só janelas altas
    if (y1 - y0 > 3.5 && k < .6) win(L, rect, slab, y0 + 1.3, k);
    return;
  }
  // rodapé
  slab(-1, 1, 0, .5, 0, .04, COL.plinth, P.stone);
  // térreo: porta, vitrine ou janela com grade
  if (k < .3) {
    rect(-.62, .62, .5, 2.42, .02, COL.frame, P.plain); rect(-.52, .52, .5, 2.32, .035, COL.door, P.wood, { s: 1.4 });
    slab(-.7, .7, 0, .12, 0, .3, COL.stone, P.stone);
  } else if (k < .72) {
    rect(-.55, .55, 1.0, 2.3, .02, COL.frame, P.plain); rect(-.45, .45, 1.08, 2.22, .03, COL.glass, P.plain);
    for (const u of [-.3, -.1, .1, .3]) rect(u - .018, u + .018, 1.08, 2.22, .05, COL.iron, P.plain);
    slab(-.6, .6, .92, 1.0, 0, .12, COL.stone, P.stone);
  }
  // andares de cima
  for (let y = 3.2; y + 2 < y1; y += 3) win(L, rect, slab, y, hash(k, y));
}
function win(L, rect, slab, y, k) {
  if (k > .82) return;
  rect(-.55, .55, y, y + 1.5, .02, COL.frame, P.plain); rect(-.45, .45, y + .08, y + 1.42, .03, COL.glass, P.plain);
  rect(-.02, .02, y + .08, y + 1.42, .036, COL.frame, P.plain); rect(-.45, .45, y + .9, y + .94, .036, COL.frame, P.plain);
  rect(-1.0, -.56, y + .02, y + 1.48, .04, L.shutter, P.wood, { s: 2.2 }); rect(.56, 1.0, y + .02, y + 1.48, .04, L.shutter, P.wood, { s: 2.2 });
  if (k < .18) { // sacadinha de ferro
    slab(-.75, .75, y - .1, y, 0, .5, COL.stone, P.stone);
    rect(-.75, .75, y + .82, y + .86, .5, COL.iron, P.plain);
    for (let u = -.7; u <= .71; u += .14) rect(u - .012, u + .012, y, y + .84, .5, COL.iron, P.plain);
  } else slab(-.6, .6, y - .06, y, 0, .12, COL.stone, P.stone);
}
function roof(L, x0, z0, x1, z1, h) {
  face([[x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0]], COL.flat, P.concrete, { n: [0, 1, 0] });
  if (L.roof === 'flat') {
    // platibanda e caixa d'água
    for (const [a, b, c, d] of [[x0, z0, x1, z0 + .2], [x0, z1 - .2, x1, z1], [x0, z0, x0 + .2, z1], [x1 - .2, z0, x1, z1]]) box(a, h, b, c, h + .6, d, L.color, P.concrete, { mask: 0, s: .25 });
    if (hash(x0, z0, 9) < .5) cyl((x0 + x1) / 2 + .6, (z0 + z1) / 2, .55, h, h + 1.1, 0x5f6b72, P.metal, { mask: 0, seg: 8 });
    return;
  }
  const o = .35, alongX = (x1 - x0) >= (z1 - z0), rise = Math.min(2.2, (alongX ? z1 - z0 : x1 - x0) * .32);
  const ax0 = x0 - o, ax1 = x1 + o, az0 = z0 - o, az1 = z1 + o, base = h - .05;
  if (alongX) {
    const zm = (z0 + z1) / 2, half = (az1 - az0) / 2, slope = Math.hypot(half, rise), s = UVS[P.roof];
    const uv = (pts, sign) => pts.map(p => [p[0] * s, (sign < 0 ? p[2] - az0 : az1 - p[2]) / half * slope * s]);
    let pts = [[ax0, base, az0], [ax0, h + rise, zm], [ax1, h + rise, zm], [ax1, base, az0]]; face(pts, COL.roof, P.roof, { uv: uv(pts, -1) });
    pts = [[ax1, base, az1], [ax1, h + rise, zm], [ax0, h + rise, zm], [ax0, base, az1]]; face(pts, COL.roof, P.roof, { uv: uv(pts, 1) });
    face([[x0, h, z0], [x0, h + rise - .02, zm], [x0, h, z1]], L.color, P.concrete, { n: [-1, 0, 0], s: .25 });
    face([[x1, h, z1], [x1, h + rise - .02, zm], [x1, h, z0]], L.color, P.concrete, { n: [1, 0, 0], s: .25 });
    box(ax0, h + rise - .02, zm - .12, ax1, h + rise + .12, zm + .12, COL.roofDark, P.roof, { mask: 0, skip: ['-y'] });
  } else {
    const xm = (x0 + x1) / 2, half = (ax1 - ax0) / 2, slope = Math.hypot(half, rise), s = UVS[P.roof];
    const uv = (pts, sign) => pts.map(p => [p[2] * s, (sign < 0 ? p[0] - ax0 : ax1 - p[0]) / half * slope * s]);
    let pts = [[ax0, base, az1], [xm, h + rise, az1], [xm, h + rise, az0], [ax0, base, az0]]; face(pts, COL.roof, P.roof, { uv: uv(pts, -1) });
    pts = [[ax1, base, az0], [xm, h + rise, az0], [xm, h + rise, az1], [ax1, base, az1]]; face(pts, COL.roof, P.roof, { uv: uv(pts, 1) });
    face([[x0, h, z0], [xm, h + rise - .02, z0], [x1, h, z0]], L.color, P.concrete, { n: [0, 0, -1], s: .25 });
    face([[x1, h, z1], [xm, h + rise - .02, z1], [x0, h, z1]], L.color, P.concrete, { n: [0, 0, 1], s: .25 });
    box(xm - .12, h + rise - .02, az0, xm + .12, h + rise + .12, az1, COL.roofDark, P.roof, { mask: 0, skip: ['-y'] });
  }
}

// ---------------------------------------------------------------- adereços
function crate(x0, z0, w, d, h, y = 0, c = COL.crate) {
  const x1 = x0 + w, z1 = z0 + d, y1 = y + h;
  box(x0, y, z0, x1, y1, z1, c, P.wood, { s: 1.6 });
  // moldura escura nas arestas (visual)
  const e = .07, f = .015, ec = COL.crateEdge, m = { mask: 0, s: 1.6 };
  for (const [a, b] of [[x0 - f, x0 + e], [x1 - e, x1 + f]]) for (const [c2, d2] of [[z0 - f, z0 + e], [z1 - e, z1 + f]]) box(a, y, c2, b, y1 + f, d2, ec, P.wood, m);
  for (const [c2, d2] of [[z0 - f, z0 + e], [z1 - e, z1 + f]]) { box(x0 + e, y1 - e, c2, x1 - e, y1 + f, d2, ec, P.wood, m); box(x0 + e, y, c2, x1 - e, y + e, d2, ec, P.wood, m); }
  for (const [a, b] of [[x0 - f, x0 + e], [x1 - e, x1 + f]]) { box(a, y1 - e, z0 + e, b, y1 + f, z1 - e, ec, P.wood, m); box(a, y, z0 + e, b, y + e, z1 - e, ec, P.wood, m); }
}
function barrel(x, z, y = 0, c = 0x4f6a7a) {
  cyl(x, z, .33, y, y + .95, c, P.metal, { seg: 10, top: 0x55606a, s: 1.2 });
  for (const yy of [.2, .72]) cyl(x, z, .345, y + yy, y + yy + .05, 0x3b4248, P.metal, { seg: 10, mask: 0, noTop: true });
}
function bollard(x, z) { cyl(x, z, .14, 0, .6, COL.iron, P.metal, { seg: 8 }); cyl(x, z, .18, .6, .7, COL.iron, P.metal, { seg: 8, mask: 0 }); }
function lamp(x, z, h = 3.6) {
  cyl(x, z, .07, 0, h, COL.iron, P.metal, { seg: 6 });
  box(x - .16, h, z - .16, x + .16, h + .42, z + .16, COL.lamp, P.plain, { mask: 0, skip: [] });
  box(x - .22, h + .42, z - .22, x + .22, h + .5, z + .22, COL.iron, P.metal, { mask: 0, skip: [] });
}
function palm(x, z, h = 6) {
  cyl(x, z, .75, 0, .5, COL.stone, P.stone, { seg: 8, top: 0x6b5a45, topPat: P.ground });
  let px = x, pz = z, y = .5; const lean = hash(x, z) * 2 * Math.PI, segs = 6;
  for (let s = 0; s < segs; s++) {
    const nx = x + Math.cos(lean) * .5 * ((s + 1) / segs) ** 2, nz = z + Math.sin(lean) * .5 * ((s + 1) / segs) ** 2, ny = .5 + (h - .5) * (s + 1) / segs;
    cyl((px + nx) / 2, (pz + nz) / 2, .19 - s * .015, y, ny + .02, COL.trunk, P.wood, { seg: 7, mask: s < 3 ? 3 : 0, noTop: true, s: 2.5 });
    px = nx; pz = nz; y = ny;
  }
  for (let f = 0; f < 9; f++) { // folhas: lâminas arqueadas
    const a = f * 2 * Math.PI / 9 + hash(f, x), L2 = 2.4 + hash(f, z) * .6, dx = Math.cos(a), dz = Math.sin(a), sx = -dz * .35, sz = dx * .35;
    const p0 = [px, y + .1, pz], p1 = [px + dx * L2 * .5, y + .55, pz + dz * L2 * .5], p2 = [px + dx * L2, y - .5, pz + dz * L2];
    face([p0, [p1[0] + sx, p1[1], p1[2] + sz], [p1[0] - sx, p1[1], p1[2] - sz]], COL.palm, P.foliage, { n: [0, 1, 0] });
    face([[p1[0] - sx, p1[1], p1[2] - sz], [p1[0] + sx, p1[1], p1[2] + sz], p2], COL.palm, P.foliage, { n: [0, 1, 0] });
  }
}
function tree(x, z, h = 5.5, r = 2.2) {
  cyl(x, z, .2, 0, h - 1.2, COL.trunk, P.wood, { seg: 7, s: 2.5 });
  cyl(x, z, r, h - 2.2, h - .4, COL.foliage, P.foliage, { seg: 9, mask: 0 });
  cyl(x, z, r * .7, h - .4, h + .5, 0x5a8744, P.foliage, { seg: 9, mask: 0 });
}
// Escadaria: degraus de 20 cm na vista; a colisão é a rampa por baixo deles (como as escadas do CS).
function stairs(x0, z0, x1, z1, y0, y1, c, pat) {
  const n = Math.round((y1 - y0) / .2), rise = (y1 - y0) / n, run = (x1 - x0) / n;
  for (let k = 0; k < n; k++) box(x0 + k * run, y0, z0, x0 + (k + 1) * run, y0 + rise * (k + 1), z1, c, pat, { mask: 0, skip: ['-y', '-z', '+z', '+x'], top: 0xc9bfae, topPat: P.stone, s: .9 });
  const yA = y0 + rise / 2, g = (y1 - yA) / (x1 - x0), l = Math.hypot(g, 1), nTop = [-g / l, 1 / l, 0];
  hulls.push({ planes: [[nTop[0], nTop[1], 0, nTop[0] * x0 + nTop[1] * yA], [0, -1, 0, -y0], [1, 0, 0, x1], [-1, 0, 0, -x0], [0, 0, 1, z1], [0, 0, -1, -z0]], min: [x0, y0, z0], max: [x1, y1, z1], mask: 3, src: 'ribeira' });
  // corrimão de ferro do lado aberto (visual)
}
function stall(x0, z0, x1, z1, awning) {
  box(x0, 0, z0, x1, 1.0, z1, 0x8a6440, P.wood, { s: 1.3, top: 0x9b744b });
  for (const [x, z] of [[x0 + .06, z0 + .06], [x1 - .06, z0 + .06], [x0 + .06, z1 - .06], [x1 - .06, z1 - .06]]) box(x - .04, 1.0, z - .04, x + .04, 2.55, z + .04, 0x4b3a2a, P.wood, { mask: 0 });
  // toldo listrado (bloqueia o corpo: ninguém fica de pé em cima do balcão; tiros passam)
  const ax0 = x0 - .55, ax1 = x1 + .55, n = Math.max(2, Math.round((z1 - z0) / .5));
  for (let k = 0; k < n; k++) {
    const za = z0 + (z1 - z0) * k / n, zb = z0 + (z1 - z0) * (k + 1) / n, c = k % 2 ? 0xf3ece0 : awning;
    face([[ax0, 2.3, za], [(x0 + x1) / 2, 2.6, za], [(x0 + x1) / 2, 2.6, zb], [ax0, 2.3, zb]], c, P.plain, { n: unit([-.3, 1, 0]) });
    face([[(x0 + x1) / 2, 2.6, za], [ax1, 2.3, za], [ax1, 2.3, zb], [(x0 + x1) / 2, 2.6, zb]], c, P.plain, { n: unit([.3, 1, 0]) });
  }
  solid(ax0, 2.3, z0, ax1, 2.6, z1, 1);
  // frutas e caixotes sobre o balcão
  for (let z = z0 + .3; z < z1 - .4; z += .7) {
    const c = [0xd9822b, 0xc2362c, 0x7aa63a, 0xe0c341][Math.floor(hash(z, x0) * 4)];
    box(x0 + .15, 1.0, z, x1 - .15, 1.18, z + .5, 0x9b7a52, P.wood, { mask: 0 });
    box(x0 + .22, 1.18, z + .07, x1 - .22, 1.26, z + .43, c, P.foliage, { mask: 0, s: 3 });
  }
}
function cart(x0, z0, x1, z1) {
  box(x0, .55, z0, x1, 1.25, z1, 0x7d5a3a, P.wood, { s: 1.6, skip: [] , mask: 0 });
  solid(x0, 0, z0, x1, 1.25, z1);
  const r = .5, zs = [z0 - .03, z1 + .03];
  for (const z of zs) { const xc = (x0 + x1) / 2 - .3, pts = []; for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; pts.push([xc + Math.cos(a) * r, .5 + Math.sin(a) * r, z]); } face(pts, 0x4a3524, P.wood, { n: [0, 0, z === zs[0] ? -1 : 1] }); }
  box(x1, .9, (z0 + z1) / 2 - .5, x1 + 1.3, .98, (z0 + z1) / 2 - .42, 0x5a4029, P.wood, { mask: 0 });
  box(x1, .9, (z0 + z1) / 2 + .42, x1 + 1.3, .98, (z0 + z1) / 2 + .5, 0x5a4029, P.wood, { mask: 0 });
}
function fence(x, z0, z1, h) { // gradil de ferro do cais (bloqueia o corpo, tiros passam)
  box(x - .04, h - .08, z0, x + .04, h, z1, COL.iron, P.metal, { mask: 0 });
  box(x - .04, .9, z0, x + .04, .96, z1, COL.iron, P.metal, { mask: 0 });
  for (let z = z0 + .1; z < z1; z += .18) { box(x - .015, 0, z - .015, x + .015, h + .14, z + .015, COL.iron, P.metal, { mask: 0, skip: ['-y', '+y'] }); }
  for (let z = z0; z <= z1 + .01; z += 3) box(x - .07, 0, z - .07, x + .07, h + .2, z + .07, COL.iron, P.metal, { mask: 0 });
  solid(x - .06, 0, z0, x + .06, h, z1, 1);
}
function paintA(x, z, s) { // letra A pintada no chão do bombsite
  const y = .012, c = COL.paint, bar = (ax, az, bx, bz, w) => { const d = unit([bx - ax, 0, bz - az]), nx = -d[2] * w, nz = d[0] * w; face([[ax - nx, y, az - nz], [bx - nx, y, bz - nz], [bx + nx, y, bz + nz], [ax + nx, y, az + nz]], c, P.concrete, { n: [0, 1, 0], s: .8 }); };
  bar(x - s * .5, z + s * .6, x, z - s * .6, s * .09); bar(x + s * .5, z + s * .6, x, z - s * .6, s * .09); bar(x - s * .26, z + s * .12, x + s * .26, z + s * .12, s * .08);
  const r = s * .95; for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, b = (k + 1) * Math.PI / 12; face([[x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x + Math.cos(b) * r, y, z + Math.sin(b) * r], [x + Math.cos(b) * (r - .12), y, z + Math.sin(b) * (r - .12)], [x + Math.cos(a) * (r - .12), y, z + Math.sin(a) * (r - .12)]], c, P.concrete, { n: [0, 1, 0], s: .8 }); }
}

function props() {
  // --- Cais (Long) e canal
  fence(-30, -26, 26, 3.2);
  face([[-46, -.7, -26], [-46, -.7, 26], [-30, -.7, 26], [-30, -.7, -26]], COL.water, P.concrete, { n: [0, 1, 0], s: .12 });
  face([[-30, -.7, -26], [-30, 0, -26], [-30, 0, 26], [-30, -.7, 26]].reverse(), COL.stone, P.stone, { n: [-1, 0, 0], s: .7 });
  box(-48, -.7, -26, -40, .2, 26, COL.stone, P.stone, { mask: 0, skip: ['-y'] });
  for (let z = -26, k = 0; z < 26; z += 7 + hash(k) * 3, k++) { // casario da outra margem (só cenário)
    const w = 6 + hash(k, 1) * 3, h = 6 + Math.round(hash(k, 2) * 6) * .5, col = FACADES[k % FACADES.length], ze = Math.min(26, z + w);
    box(-46, .2, z, -40.5, h, ze, col, P.concrete, { mask: 0, s: .25, skip: ['-y'] });
    for (let y = 1.5; y < h - 1.5; y += 3) for (let zz = z + 1; zz < ze - 1; zz += 2.2) { face([[-40.48, y, zz + 1], [-40.48, y + 1.4, zz + 1], [-40.48, y + 1.4, zz], [-40.48, y, zz]], COL.glass, P.plain, { n: [1, 0, 0] }); }
    face([[-46.3, h, z], [-43.2, h + 1.8, z], [-43.2, h + 1.8, ze], [-46.3, h, ze]], COL.roof, P.roof, { n: unit([-.5, 1, 0]) });
    face([[-43.2, h + 1.8, z], [-40.2, h, z], [-40.2, h, ze], [-43.2, h + 1.8, ze]], COL.roof, P.roof, { n: unit([.5, 1, 0]) });
  }
  // barco atracado
  { const x = -33.5, z0 = -6, z1 = 0.5; face([[x - 1.2, -.3, z0 + 1], [x + 1.2, -.3, z0 + 1], [x + 1.2, -.3, z1], [x - 1.2, -.3, z1]], 0x6e4b30, P.wood, { n: [0, 1, 0] });
    for (const s of [-1, 1]) face([[x + s * 1.2, -.8, z0 + 1.3], [x + s * 1.2, .3, z0 + 1], [x + s * 1.2, .3, z1], [x + s * 1.2, -.8, z1 - .2]], 0x2f5f86, P.wood, { n: [s, 0, 0] });
    face([[x - 1.2, .3, z0 + 1], [x, .3, z0 - .4], [x + 1.2, .3, z0 + 1]], 0x2f5f86, P.wood, { n: [0, 1, 0] }); }
  // cobertura no Long
  crate(-25.4, 20.4, 1.3, 2.4, 2.4); crate(-26.8, 20.6, 1.2, 1.2, 1.2, 0, COL.crate2);
  barrel(-26.6, 10.6); barrel(-26.1, 11.3); barrel(-25.4, 10.5, 0, 0x7a4b3a);
  crate(-26.2, 4.8, 1.2, 1.2, 1.2); crate(-25.2, 5.1, 1.0, 1.0, 1.0, 0, COL.crate2);
  cart(-27, -5.2, -25.6, -2.6);
  crate(-27.4, -25.4, 1.3, 1.3, 1.3); crate(-26, -25.6, 1.2, 1.2, 2.4, 0, COL.crate2); crate(-27.1, -24.1, 1.0, 1.0, 1.0);
  for (const z of [-20, -10, 0, 10, 20]) bollard(-28.6, z + 1.5);
  for (const z of [-17, 7, 25]) lamp(-24.35, z);
  // --- bombsite A
  paintA(-13.2, -11.6, 2.2);
  crate(-15.2, -18.2, 2.4, 2.4, 2.4); crate(-14.8, -17.8, 1.2, 1.2, 1.2, 2.4, COL.crate2); crate(-12.8, -17.6, 1.2, 1.2, 1.2, 0, COL.crate2);
  crate(-21.4, -17.4, 1.2, 2.4, 1.2);
  crate(-20, -11.4, 1.2, 1.2, 1.2, 0, COL.crate2);
  crate(-9.6, -23.4, 1.2, 1.2, 1.2); crate(-9.4, -23.2, 1.0, 1.0, 1.0, 1.2, COL.crate2);
  cart(-19.6, -24.6, -17, -23.2);
  box(-11.6, 0, -11.6, -8, .95, -10.8, COL.stone, P.stone, { top: 0x5b4a38, topPat: P.ground }); // canteiro
  for (const x of [-11.1, -10.2, -9.3, -8.5]) cyl(x, -11.2, .32, .95, 1.45, COL.foliage, P.foliage, { seg: 7, mask: 0 });
  cyl(-18.5, -20.6, .8, 0, .85, COL.stone, P.stone, { seg: 10, top: 0x1e2a30 }); // poço
  for (const s of [-1, 1]) box(-18.5 + s * .7 - .05, .85, -20.65, -18.5 + s * .7 + .05, 2.3, -20.55, 0x5a4029, P.wood, { mask: 0 });
  box(-19.4, 2.3, -21.2, -17.6, 2.4, -20, COL.roof, P.roof, { mask: 0, skip: [] });
  barrel(-7.4, -24.6); barrel(-6.9, -23.9);
  // --- Arcos
  for (const [z0, z1] of [[-22, -21.4], [-19, -18.4], [-15.6, -15.0], [-12.6, -12]]) box(-6.3, 0, z0, -5.7, 4.5, z1, COL.stone, P.stone, { s: .9 });
  for (const [z0, z1] of [[-18, -17.4], [-15.3, -14.7], [-12.6, -12]]) box(-2.3, 0, z0, -1.7, 4.5, z1, COL.stone, P.stone, { s: .9 });
  box(-6.3, 3.2, -22, -5.7, 4.5, -12, 0xe9dcc0, P.concrete, { s: .3 }); box(-2.3, 3.2, -18, -1.7, 4.5, -12, 0xe9dcc0, P.concrete, { s: .3 });
  box(-6.4, 4.5, -22.2, -1.6, 4.9, -11.8, 0xe9dcc0, P.concrete, { s: .3, under: 0xcfc2a8 });
  for (const [z0, z1] of [[-21.4, -19], [-18.4, -15.6], [-15.0, -12.6]]) for (const x of [-6.32, -5.68]) { // arcos (visual)
    const zc = (z0 + z1) / 2, r = (z1 - z0) / 2, pts = [[x, 3.2, z0]]; for (let k = 0; k <= 8; k++) { const a = Math.PI - k * Math.PI / 8; pts.push([x, 2.6 + Math.sin(a) * .55, zc + Math.cos(a) * r]); } pts.push([x, 3.2, z1]);
    for (let k = 1; k < pts.length - 2; k++) face([pts[k], [x, 3.2, pts[k][2]], [x, 3.2, pts[k + 1][2]], pts[k + 1]], 0xe9dcc0, P.concrete, { n: [x < -6 ? -1 : 1, 0, 0], s: .3 });
  }
  roofStrip(-6.6, -22.4, -1.4, -11.6, 4.9, 1.0);
  // --- Varanda (terraço) com parapeito sobre o bombsite
  box(-22, 0, -8, -6, TERRACE, 0, 0xe3d3b4, P.concrete, { skip: ['-y', '+y', '-x', '+x', '+z'], s: .25 });
  box(-22, TERRACE, -8, -6, TERRACE + 1.0, -7.7, 0xe3d3b4, P.concrete, { s: .25, top: 0xcfc4b0, topPat: P.stone });
  for (const x of [-20, -16, -12, -8]) { // portas em arco no térreo da casa, voltadas ao bombsite
    face([[x - .7, 0, -8.02], [x - .7, 2.3, -8.02], [x + .7, 2.3, -8.02], [x + .7, 0, -8.02]], COL.door, P.wood, { n: [0, 0, -1], s: 1.4 });
    face([[x - .85, 0, -8.03], [x - .85, .5, -8.03], [x + .85, .5, -8.03], [x + .85, 0, -8.03]], COL.plinth, P.stone, { n: [0, 0, -1] });
  }
  for (const x of [-21, -17.4, -13.8, -10.2, -6.6]) cyl(x + .3, -7.85, .12, TERRACE + 1.0, TERRACE + 1.25, 0xd9cdb6, P.stone, { seg: 6, mask: 0 }); // vasos
  for (const x of [-21, -17.4, -13.8, -10.2, -6.6]) cyl(x + .3, -7.85, .2, TERRACE + 1.25, TERRACE + 1.55, COL.foliage, P.foliage, { seg: 6, mask: 0 });
  box(-21.6, TERRACE, -3.6, -19.4, TERRACE + 2.5, -1.2, 0x9cb8d6, P.tile, { s: 1.5, top: COL.roof, topPat: P.roof }); // casinha no terraço
  crate(-9.8, -3.2, 1.2, 1.2, 1.0, TERRACE, COL.crate2);
  for (const x of [-15, -11]) { box(x, TERRACE, -.5, x + 1.6, TERRACE + .45, 0, 0x7b5a3c, P.wood, { s: 1.6 }); }
  face([[-22, 0, 0], [-22, TERRACE, 0], [-16, TERRACE, 0], [-16, 0, 0]], 0xe3d3b4, P.concrete, { n: [0, 0, 1], s: .25 }); // lado do terraço junto à escada
  // fim do canal: casas sobre a água fecham as duas pontas
  for (const [z0, z1] of [[-30, -26], [26, 30]]) box(-48, -.7, z0, -30, 9, z1, FACADES[z0 < 0 ? 2 : 6], P.concrete, { mask: 0, s: .25, skip: ['-y', '-x'] });
  // escadaria do Long até o patamar (sobe para +x)
  stairs(-22, 0, -16, 4, 0, TERRACE, 0xb9b2a5, P.stone);
  box(-16, 0, 0, -12, TERRACE, 4, 0xb9b2a5, P.stone, { skip: ['-y', '+y', '-x', '-z', '+x', '+z'] });
  // --- Praça
  { const x = 9, z = -9;
    cyl(x, z, 3.3, 0, .02, COL.pracaRing, P.stone, { seg: 16, mask: 0, s: 1.2 });
    cyl(x, z, 2.2, 0, .7, COL.stone, P.stone, { seg: 12, top: 0xcfc8ba, s: .9 });
    face(Array.from({ length: 12 }, (_, k) => { const a = (k + .5) * Math.PI / 6; return [x + Math.cos(a) * 1.9, .72, z + Math.sin(a) * 1.9]; }).reverse(), COL.water, P.concrete, { n: [0, 1, 0], s: .4 });
    cyl(x, z, .42, .7, 2.3, COL.stone, P.stone, { seg: 8, s: .9 });
    cyl(x, z, .95, 1.55, 1.75, COL.stone, P.stone, { seg: 10, mask: 0 });
    cyl(x, z, .2, 2.3, 2.9, 0x7c8a6e, P.metal, { seg: 6, mask: 0 }); }
  box(14.6, 0, -16.2, 17.2, 2.6, -13.6, 0x2f5a46, P.metal, { s: .9, top: 0x2a3a33 }); // banca de jornal
  box(14.3, 2.6, -16.5, 17.5, 2.75, -13.3, 0x24463a, P.metal, { mask: 0, skip: [] });
  face([[14.58, 1.0, -15.6], [14.58, 2.2, -15.6], [14.58, 2.2, -14.2], [14.58, 1.0, -14.2]], 0xd8c79a, P.plain, { n: [-1, 0, 0] });
  palm(1, -16.2, 6.5); palm(17.8, -2.2, 6); palm(-0.4, -1.6, 5.5); palm(18.4, -11, 6.2);
  crate(3, -3.6, 1.2, 1.2, 1.2); crate(3.1, -2.3, 1.0, 1.0, 1.0, 0, COL.crate2);
  crate(12.2, -4.2, 1.3, 1.3, 1.3);
  cart(4.2, -14.8, 6.8, -13.4);
  box(8.4, 0, -17.6, 11.4, 1.0, -17.0, COL.stone, P.stone, { top: 0x5b4a38, topPat: P.ground });
  for (const x of [8.9, 9.9, 10.9]) cyl(x, -17.3, .3, 1.0, 1.45, COL.foliage, P.foliage, { seg: 7, mask: 0 });
  for (const [x, z] of [[2.6, -10.5], [15.5, -6.5], [-1.4, -6]]) lamp(x, z);
  box(5.5, 0, -5.8, 7.5, .45, -5.4, 0x6d5137, P.wood, { s: 1.6 }); box(11, 0, -5.8, 13, .45, -5.4, 0x6d5137, P.wood, { s: 1.6 });
  // --- Mercado coberto
  for (const [x, z] of [[4.9, .4], [11.1, .4], [4.9, 9], [11.1, 9], [4.9, 17.6], [11.1, 17.6], [.3, 6], [15.7, 6], [.3, 12], [15.7, 12]]) box(x - .16, 0, z - .16, x + .16, 5, z + .16, 0x3e4a52, P.metal, { s: 1 });
  box(0, 5, 0, 16, 5.3, 18, 0x56606a, P.metal, { s: .6, under: 0x4a5258 });
  for (const z of [0.4, 9, 17.6]) box(0, 4.65, z - .12, 16, 5, z + .12, 0x3e4a52, P.metal, { mask: 0 });
  roofStrip(-.4, -.4, 16.4, 18.4, 5.3, 1.4, 0x6f7b84, P.metal);
  stall(4.2, 2, 5.8, 7.4, 0xc0392b); stall(10.2, 2, 11.8, 7.4, 0x2f6fae); stall(4.2, 10.6, 5.8, 16, 0x2e8b57); stall(10.2, 10.6, 11.8, 16, 0xd4a017);
  crate(1, 14.5, 1.2, 1.2, 1.2); crate(14, 3, 1.2, 1.2, 1.2, 0, COL.crate2); barrel(7.9, 9.3); barrel(8.5, 8.7, 0, 0x7a4b3a);
  for (const x of [1.5, 3, 13, 14.5]) for (const z of [8.6]) box(x - .3, 0, z - .3, x + .3, .55, z + .3, 0x9b7a52, P.wood, { s: 1.6 });
  // --- Beco
  barrel(-10, 15.3); barrel(-9.3, 15.4, 0, 0x7a4b3a); crate(-4, 12.2, 1.2, 1.2, 1.2); crate(-19.5, 15, 1.0, 1.0, 1.0, 0, COL.crate2);
  for (const x of [-20, -14, -8, -2]) { box(x, 3.6, 12, x + .03, 3.63, 16, 0x3a3a3a, P.plain, { mask: 0, skip: [] });
    for (let z = 12.4; z < 15.6; z += .9) face([[x + .015, 3.6, z], [x + .015, 2.9, z], [x + .015, 2.9, z + .6], [x + .015, 3.6, z + .6]], [0xe8e2d4, 0xc0392b, 0x2f6fae, 0xe0c341][Math.floor(hash(x, z) * 4)], P.plain, { n: [1, 0, 0] }); }
  lamp(-6, 15.6, 3.2);
  // --- rua e spawn do T
  crate(8.4, 18.6, 1.2, 1.2, 1.2); crate(2.2, 20.5, 1.0, 1.0, 1.0, 0, COL.crate2);
  { const x0 = -11.5, z0 = 23, x1 = -6.9, z1 = 25.1; // furgão
    box(x0, .35, z0, x1, 2.2, z1, 0xe7e2d6, P.metal, { s: .5, mask: 0, skip: [] }); solid(x0, 0, z0, x1, 2.2, z1);
    face([[x1 + .01, 1.3, z0 + .2], [x1 + .01, 2.0, z0 + .2], [x1 + .01, 2.0, z1 - .2], [x1 + .01, 1.3, z1 - .2]], COL.glass, P.plain, { n: [1, 0, 0] });
    for (const z of [z0 - .01, z1 + .01]) face([[x1 - 1.3, 1.3, z], [x1 - 1.3, 2.0, z], [x1 - .2, 2.0, z], [x1 - .2, 1.3, z]], COL.glass, P.plain, { n: [0, 0, z < z0 ? -1 : 1] });
    for (const x of [x0 + .8, x1 - .9]) for (const z of [z0 - .02, z1 + .02]) cyl(x, z, .36, 0, .1, 0x1d1f22, P.plain, { mask: 0, seg: 8 }); }
  crate(6, 23, 1.2, 1.2, 1.2); crate(7.2, 23.1, 1.2, 1.2, 2.4, 0, COL.crate2); crate(-1.2, 30.4, 1.2, 1.2, 1.2);
  tree(11.5, 30.2, 5.5, 1.8); tree(-12, 30, 5.2, 1.7);
  crate(-17.8, 24.3, 1.2, 1.2, 1.2); barrel(-21.5, 29.2); lamp(-15.5, 29.6);
  // --- spawn e corredor do CT
  crate(3, -27.4, 1.2, 1.2, 1.2); crate(17.6, -28.2, 1.3, 1.3, 1.3, 0, COL.crate2); crate(18.8, -28, 1.0, 1.0, 1.0);
  tree(4.5, -34.5, 5.2, 1.7); tree(19, -34.6, 5.5, 1.8);
  barrel(-12.4, -31.3); barrel(-11.7, -31.5, 0, 0x7a4b3a); crate(-2, -29.4, 1.2, 1.2, 1.2);
  crate(9, -22, 1.2, 1.2, 1.2); lamp(15.6, -21);
}
// Telhado de duas águas sobre uma área coberta (só visual, acima da laje).
function roofStrip(x0, z0, x1, z1, y, rise, c = COL.roof, pat = P.roof) {
  const alongX = x1 - x0 >= z1 - z0, s = UVS[pat];
  if (alongX) { const zm = (z0 + z1) / 2; face([[x0, y, z0], [x0, y + rise, zm], [x1, y + rise, zm], [x1, y, z0]], c, pat, { s }); face([[x1, y, z1], [x1, y + rise, zm], [x0, y + rise, zm], [x0, y, z1]], c, pat, { s }); }
  else { const xm = (x0 + x1) / 2; face([[x0, y, z1], [xm, y + rise, z1], [xm, y + rise, z0], [x0, y, z0]], c, pat, { s }); face([[x1, y, z0], [xm, y + rise, z0], [xm, y + rise, z1], [x1, y, z1]], c, pat, { s }); }
}

// ---------------------------------------------------------------- montagem
export function buildRibeira() {
  polygons.length = 0; hulls.length = 0; lots.length = 0; seed = 7;
  floors();
  const lotId = buildingLots();
  buildings(lotId);
  props();
  const yaw = { north: 0, west: Math.PI / 2 }; // no jogo, yaw 0 olha para -z (norte) e PI/2 para -x (oeste)
  const map = {
    key: RIBEIRA.key, name: RIBEIRA.name, scale: 1, center: [0, 0, 0], bounds: [-50, -3, -41, 35, 24, 41],
    t: [[-8, 28.5, yaw.north, 0], [-4, 30.1, yaw.north, 0], [0, 28.5, yaw.north, 0], [4, 30.1, yaw.north, 0], [8, 28.5, yaw.north, 0]],
    ct: [[3.5, -33, yaw.west, 0], [6, -30.6, yaw.west, 0], [8.5, -33, yaw.west, 0], [11, -30.6, yaw.west, 0], [13.5, -33, yaw.west, 0]],
    sites: [{ name: 'A', x0: -21.5, z0: -25.5, x1: -6.5, z1: -8.5, y0: -.2, y1: 3.0, lx: -13.2, lz: -11.6 }],
    ladders: [], polygons, hulls,
    report: { sourceSha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex') },
  };
  bakeNavigation(map);
  pruneNavigation(map);
  return map;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const map = buildRibeira(), packed = packMap(map), bytes = gzipSync(Buffer.from(JSON.stringify(packed)), { level: 9 });
  const out = resolve(import.meta.dirname, '../assets/maps');
  writeFileSync(resolve(out, 'ribeira.js'), '// Ribeira: mapa original do Wingman feito para este jogo (tools/build-ribeira.mjs). Texturas procedurais leves, sem imagens.\n(globalThis.SOURCE_MAP_PAYLOADS??={}).ribeira=' + JSON.stringify(bytes.toString('base64')) + ';\n');
  // Catálogo: mantém os outros mapas e atualiza só a Ribeira.
  const file = resolve(out, 'catalog.js'), ctx = {}; new Function('globalThis', readFileSync(file, 'utf8'))(ctx);
  const { ribeira: _old, ...others } = ctx.SOURCE_MAP_CATALOG || {}, catalog = { ribeira: { name: map.name, original: true, ax: map.ax, az: map.az, t: map.t, ct: map.ct, sites: map.sites }, ...others };
  writeFileSync(file, '// Metadata only: the geometry is loaded when a map is played.\nglobalThis.SOURCE_MAP_CATALOG=' + JSON.stringify(catalog) + ';\n');
  const tris = Buffer.from(packed.mesh.index, 'base64').length / 12;
  console.log('ribeira', bytes.length + ' bytes gzipped', tris + ' triangles', map.hulls.length + ' hulls', 'nav', JSON.stringify({ nodes: map.report.navigation.nodes, spawns: map.report.navigation.spawnsConnected + '/' + map.report.navigation.spawnsTotal, pruned: map.report.navigationPruned }));
}
