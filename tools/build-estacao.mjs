// Estação: mapa original do Wingman (2v2, um bombsite), pátio ferroviário na neve.
// Usage: node tools/build-estacao.mjs
// Estrutura dos Wingman do CS (Inferno, Cobblestone, Nuke): um bombsite com três entradas para o TR e uma base CT logo
// atrás dele. Cada objeto tem função tática (cobertura, ângulo ou ponto de subir); nada de enfeite solto.
//
//   Trilhos  - rota longa pelo oeste (como a Banana): linha de trem, vagão no meio; entra pelo portão oeste do bombsite.
//   Passarela- o meio: escada do TR sobe a uma passarela de 3,2 m sobre o lado sul do bombsite; o CT sobe pela escada do
//              outro lado, então ela é disputada (os dois chegam em ~6 s). Dela se pula dentro do bombsite (como o drop
//              da Cobble).
//   Galpão   - entrada principal coberta pelo leste: Doca (carreta) e o corredor do galpão até a porta leste.
//   Conector - liga o meio à Doca (rotação do TR).
//   Base CT  - logo ao norte, duas entradas curtas no bombsite.
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { PATTERNS as P } from './source-bsp.mjs';
import { packMap, bakeNavigation } from './import-source-maps.mjs';
import { pruneNavigation } from './import-wingman-maps.mjs';
import { createKit, hash, unit } from './map-kit.mjs';
import '../assets/maps/runtime.js';

const W = 24, H = 38, CELL = 2, X0 = -24, Z0 = -36;
const cx = i => X0 + i * CELL, cz = j => Z0 + j * CELL;
// [tipo, i0, j0, i1, j1]. '#' prédio · C base CT · '.' passagens · s bombsite · r Trilhos · T base TR · M meio ·
// u passarela (3,2 m) · e escadas · g galpão (coberto) · d Doca · k Conector
const ZONES = [
  ['C', 8, 1, 15, 2], ['.', 8, 3, 9, 4], ['.', 14, 3, 15, 4],
  ['s', 7, 5, 16, 12], ['.', 5, 9, 6, 10], ['g', 17, 9, 17, 10],
  ['r', 1, 9, 4, 35], ['.', 5, 32, 6, 35], ['T', 7, 33, 16, 35],
  ['M', 10, 19, 13, 32], ['e', 10, 16, 13, 18], ['u', 9, 13, 14, 15], ['e', 15, 13, 16, 15],
  ['g', 18, 9, 21, 19], ['g', 19, 20, 20, 20], ['d', 17, 21, 21, 35], ['k', 14, 23, 16, 24],
];
const grid = Array.from({ length: H }, () => Array(W).fill('#'));
for (const [t, i0, j0, i1, j1] of ZONES) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j][i] = t;
const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? null : grid[j][i];
const INDOOR = new Set(['g']), TOP = { u: 3.2 };

const COL = {
  snow: 0xe8edf1, snowRoad: 0xd5dbe0, gravel: 0x8b857d, asphalt: 0x6c7074, concrete: 0x9a9893, hall: 0x8b8984, office: 0x9d9a93,
  rail: 0x5a5f63, sleeper: 0x4a3a2e, boxcar: 0x7a2e24, boxcar2: 0x2f4f6b, trailer: 0xd9dcdc, crate: 0x9c7a50, crateEdge: 0x5e4630,
  barrier: 0xb9b6ae, steel: 0x3d4448, yellow: 0xd9b23a, glass: 0x2a3640, frame: 0x30363a, lamp: 0xf4d58b, paint: 0xc9a227, roofSnow: 0xf2f5f7,
};
const WALLS = [[0x7c3a2c, P.metal], [0x4d5f55, P.metal], [0x6b7378, P.metal], [0x5d6f86, P.metal], [0x7d4433, P.brick], [0x9b978f, P.concrete], [0x8a5a3c, P.metal]];

export function buildEstacao() {
  const K = createKit('estacao'), { face, solid, box, cyl, stairs, railing } = K;

  // ------------------------------------------------------------ chão
  const FLOOR = { C: [COL.concrete, P.concrete, .35], '.': [COL.snowRoad, P.ground, .5], s: [COL.snow, P.ground, .5], r: [COL.gravel, P.ground, .5], T: [COL.snowRoad, P.ground, .5],
    M: [COL.asphalt, P.asphalt, .5], u: [0x6f767b, P.metal, .9], g: [COL.hall, P.concrete, .35], d: [COL.concrete, P.concrete, .3], k: [COL.snowRoad, P.ground, .5] };
  const done = Array.from({ length: H }, () => Array(W).fill(false));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const t = grid[j][i]; if (done[j][i] || !FLOOR[t]) continue;
    let w = 1; while (i + w < W && grid[j][i + w] === t && !done[j][i + w]) w++;
    let h = 1; outer: while (j + h < H) { for (let k = 0; k < w; k++) if (grid[j + h][i + k] !== t || done[j + h][i + k]) break outer; h++; }
    for (let a = 0; a < h; a++) for (let k = 0; k < w; k++) done[j + a][i + k] = true;
    const [c, pat, s] = FLOOR[t];
    const y = TOP[t] || 0;
    face([[cx(i), y, cz(j)], [cx(i), y, cz(j + h)], [cx(i + w), y, cz(j + h)], [cx(i + w), y, cz(j)]], c, pat, { n: [0, 1, 0], s });
  }
  solid(X0, -1, Z0, X0 + W * CELL, 0, Z0 + H * CELL);

  // ------------------------------------------------------------ galpões e prédios
  const lots = [], lotId = Array.from({ length: H }, () => Array(W).fill(-1));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (grid[j][i] !== '#' || lotId[j][i] >= 0) continue;
    const maxW = 2 + Math.floor(hash(i, j, 1) * 3), maxH = 2 + Math.floor(hash(i, j, 2) * 3);
    let w = 1; while (w < maxW && i + w < W && grid[j][i + w] === '#' && lotId[j][i + w] < 0) w++;
    let h = 1; outer: while (h < maxH && j + h < H) { for (let k = 0; k < w; k++) if (grid[j + h][i + k] !== '#' || lotId[j + h][i + k] >= 0) break outer; h++; }
    for (let a = 0; a < h; a++) for (let k = 0; k < w; k++) lotId[j + a][i + k] = lots.length;
    const [color, pat] = WALLS[Math.floor(hash(i, j, 5) * WALLS.length)];
    lots.push({ i, j, w, h, height: 7.5 + Math.round(hash(i, j, 4) * 7) * .5, color, pat, roof: hash(i, j, 7) < .6 ? 'gable' : 'flat' });
  }
  const topOf = (i, j) => { const t = at(i, j); return t === null ? Infinity : t === '#' ? lots[lotId[j][i]].height : TOP[t] || 0; };
  for (const L of lots) {
    const x0 = cx(L.i), x1 = cx(L.i + L.w), z0 = cz(L.j), z1 = cz(L.j + L.h), hgt = L.height;
    solid(x0, 0, z0, x1, hgt, z1);
    for (let j = L.j; j < L.j + L.h; j++) for (let i = L.i; i < L.i + L.w; i++) for (const [di, dj, n] of [[1, 0, [1, 0, 0]], [-1, 0, [-1, 0, 0]], [0, 1, [0, 0, 1]], [0, -1, [0, 0, -1]]]) {
      const ni = i + di, nj = j + dj; if (at(ni, nj) === null || (at(ni, nj) === '#' && lotId[nj][ni] === lotId[j][i])) continue;
      const below = topOf(ni, nj); if (below >= hgt) continue;
      let a, b;
      if (di === 1) { a = [cx(i + 1), cz(j)]; b = [cx(i + 1), cz(j + 1)]; } else if (di === -1) { a = [cx(i), cz(j + 1)]; b = [cx(i), cz(j)]; }
      else if (dj === 1) { a = [cx(i + 1), cz(j + 1)]; b = [cx(i), cz(j + 1)]; } else { a = [cx(i), cz(j)]; b = [cx(i + 1), cz(j)]; }
      const indoor = INDOOR.has(at(ni, nj));
      face([[a[0], below, a[1]], [a[0], hgt, a[1]], [b[0], hgt, b[1]], [b[0], below, b[1]]], indoor ? 0x8f8c86 : L.color, indoor ? P.concrete : L.pat, { n, s: indoor ? .3 : L.pat === P.metal ? .6 : L.pat === P.brick ? .8 : .3 });
      if (at(ni, nj) !== '#') facade(a, b, n, hgt, indoor, below);
    }
    roof(L, x0, z0, x1, z1, hgt);
  }
  // Fachada industrial de 2 m: barra de concreto embaixo; às vezes janela alta em fita ou porta de enrolar.
  function facade(a, b, n, top, indoor, base = 0) {
    const along = unit([b[0] - a[0], 0, b[1] - a[1]]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const Pt = (u, y, d) => [m[0] + along[0] * u + n[0] * d, y, m[1] + along[2] * u + n[2] * d];
    const rect = (u0, u1, y0, y1, d, c, pat, s) => face([Pt(u0, y0, d), Pt(u0, y1, d), Pt(u1, y1, d), Pt(u1, y0, d)], c, pat, { n, s });
    rect(-1, 1, base, base + (indoor ? 1.2 : .7), .02, indoor ? 0x6f6d69 : 0x8d8a84, P.concrete, .4);
    if (indoor) return;
    const k = hash(m[0], m[1], n[0], n[2]);
    if (k < .13 && base === 0) { rect(-.85, .85, 0, 2.9, .03, 0x7e868b, P.metal, 1.4); rect(-.95, .95, 2.9, 3.1, .04, COL.frame, P.plain); }
    else if (k < .42 && top > 6) { rect(-.9, .9, 4.1, 5.3, .02, COL.frame, P.plain); rect(-.82, .82, 4.17, 5.23, .03, COL.glass, P.plain); for (const u of [-.27, .27]) rect(u - .02, u + .02, 4.17, 5.23, .04, COL.frame, P.plain); }
  }
  function roof(L, x0, z0, x1, z1, h) {
    face([[x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0]], COL.roofSnow, P.ground, { n: [0, 1, 0] });
    if (L.roof === 'flat') { for (const [a, b, c, d] of [[x0, z0, x1, z0 + .25], [x0, z1 - .25, x1, z1], [x0, z0, x0 + .25, z1], [x1 - .25, z0, x1, z1]]) box(a, h, b, c, h + .5, d, L.color, L.pat, { mask: 0, top: COL.roofSnow, topPat: P.ground }); return; }
    const o = .3, alongX = x1 - x0 >= z1 - z0, rise = Math.min(2.4, (alongX ? z1 - z0 : x1 - x0) * .3), base = h - .05;
    if (alongX) {
      const zm = (z0 + z1) / 2;
      face([[x0 - o, base, z0 - o], [x0 - o, h + rise, zm], [x1 + o, h + rise, zm], [x1 + o, base, z0 - o]], COL.roofSnow, P.ground);
      face([[x1 + o, base, z1 + o], [x1 + o, h + rise, zm], [x0 - o, h + rise, zm], [x0 - o, base, z1 + o]], COL.roofSnow, P.ground);
      for (const x of [x0, x1]) face([[x, h, z0], [x, h + rise - .02, zm], [x, h, z1]], L.color, L.pat, { n: [x === x0 ? -1 : 1, 0, 0] });
    } else {
      const xm = (x0 + x1) / 2;
      face([[x0 - o, base, z1 + o], [xm, h + rise, z1 + o], [xm, h + rise, z0 - o], [x0 - o, base, z0 - o]], COL.roofSnow, P.ground);
      face([[x1 + o, base, z0 - o], [xm, h + rise, z0 - o], [xm, h + rise, z1 + o], [x1 + o, base, z1 + o]], COL.roofSnow, P.ground);
      for (const z of [z0, z1]) face([[x0, h, z], [xm, h + rise - .02, z], [x1, h, z]], L.color, L.pat, { n: [0, 0, z === z0 ? -1 : 1] });
    }
  }

  // ------------------------------------------------------------ peças
  const crate = (x0, z0, w, d, h, y = 0, c = COL.crate) => {
    box(x0, y, z0, x0 + w, y + h, z0 + d, c, P.wood, { s: 1.5 });
    const e = .08, f = .012, m = { mask: 0, s: 1.5 };
    for (const [a, b] of [[x0 - f, x0 + e], [x0 + w - e, x0 + w + f]]) for (const [c2, d2] of [[z0 - f, z0 + e], [z0 + d - e, z0 + d + f]]) box(a, y, c2, b, y + h + f, d2, COL.crateEdge, P.wood, m);
    box(x0 - f, y + h - e, z0 - f, x0 + w + f, y + h + f, z0 + d + f, COL.crateEdge, P.wood, { ...m, skip: ['-y'] });
  };
  const barrier = (x0, z0, x1, z1) => { // barreira de concreto (New Jersey), 1,05 m
    const alongX = x1 - x0 > z1 - z0;
    box(x0, 0, z0, x1, .35, z1, COL.barrier, P.concrete, { s: .8 });
    if (alongX) box(x0, .35, z0 + .12, x1, 1.05, z1 - .12, COL.barrier, P.concrete, { s: .8, mask: 0 }); else box(x0 + .12, .35, z0, x1 - .12, 1.05, z1, COL.barrier, P.concrete, { s: .8, mask: 0 });
    solid(x0, 0, z0, x1, 1.05, z1);
    if (alongX) box(x0, .62, z0 + .1, x1, .75, z1 - .1, COL.yellow, P.plain, { mask: 0, skip: ['-y', '+y'] }); else box(x0 + .1, .62, z0, x1 - .1, .75, z1, COL.yellow, P.plain, { mask: 0, skip: ['-y', '+y'] });
  };
  const drum = (x, z) => { cyl(x, z, .3, 0, .9, 0x2f5f86, P.metal, { seg: 10, top: 0x3d4a52, s: 1.2 }); cyl(x, z, .315, .3, .34, 0x24485f, P.metal, { seg: 10, mask: 0, noTop: true }); };
  const lamp = (x, z, h = 5) => { cyl(x, z, .08, 0, h, COL.steel, P.metal, { seg: 6 }); box(x - .5, h - .1, z - .12, x + .5, h + .05, z + .12, COL.steel, P.metal, { mask: 0, skip: [] }); box(x - .42, h - .14, z - .08, x + .42, h - .1, z + .08, COL.lamp, P.plain, { mask: 0, skip: [] }); };
  const paint = (letter, x, z, s, y = .012) => {
    const bar = (ax, az, bx, bz, w) => { const d = unit([bx - ax, 0, bz - az]), nx = -d[2] * w, nz = d[0] * w; face([[ax - nx, y, az - nz], [bx - nx, y, bz - nz], [bx + nx, y, bz + nz], [ax + nx, y, az + nz]], COL.paint, P.concrete, { n: [0, 1, 0], s: .8 }); };
    if (letter === 'A') { bar(x - s * .5, z + s * .6, x, z - s * .6, s * .09); bar(x + s * .5, z + s * .6, x, z - s * .6, s * .09); bar(x - s * .26, z + s * .12, x + s * .26, z + s * .12, s * .08); }
    else { bar(x - s * .4, z - s * .6, x - s * .4, z + s * .6, s * .09); for (const [za, zb, r] of [[-.6, 0, .32], [0, .6, .4]]) { const zc = z + s * (za + zb) / 2, rr = s * (zb - za) / 2; let px = x - s * .4, pz = z + s * za; for (let k = 1; k <= 8; k++) { const a = -Math.PI / 2 + k * Math.PI / 8, qx = x - s * .4 + s * r + Math.cos(a) * s * .3 * (r / .32) * .9 - s * r * 0, qz = zc + Math.sin(a) * rr; bar(px, pz, k === 8 ? x - s * .4 : qx, qz, s * .08); px = k === 8 ? x - s * .4 : qx; pz = qz; } } }
    const r = s * .95; for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, b = (k + 1) * Math.PI / 12; face([[x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x + Math.cos(b) * r, y, z + Math.sin(b) * r], [x + Math.cos(b) * (r - .12), y, z + Math.sin(b) * (r - .12)], [x + Math.cos(a) * (r - .12), y, z + Math.sin(a) * (r - .12)]], COL.paint, P.concrete, { n: [0, 1, 0], s: .8 }); }
  };
  // Vagão fechado sobre os trilhos (3,4 m: ninguém sobe; cobre e divide a passagem em duas faixas).
  const boxcar = (z0, z1, c) => {
    const x0 = -23.3, x1 = -20.7;
    box(x0, .95, z0, x1, 3.4, z1, c, P.metal, { s: .6, top: COL.roofSnow, topPat: P.ground, mask: 0, skip: [] });
    box(x0 + .25, .25, z0 + .4, x1 - .25, .95, z1 - .4, 0x23272a, P.metal, { mask: 0 });
    for (const z of [z0 + 1.1, z0 + 2, z1 - 2, z1 - 1.1]) for (const x of [x0 + .2, x1 - .2]) box(x - .06, 0, z - .42, x + .06, .84, z + .42, 0x1d2023, P.metal, { mask: 0, skip: ['-y'] });
    const zm = (z0 + z1) / 2; for (const x of [x0 - .02, x1 + .02]) { face([[x, 1.1, zm - 1.3], [x, 3.0, zm - 1.3], [x, 3.0, zm + 1.3], [x, 1.1, zm + 1.3]], 0x5a2219, P.metal, { n: [x < x0 ? -1 : 1, 0, 0], s: .6 }); }
    solid(x0, 0, z0, x1, 3.4, z1);
  };

  // Trilho em linha qualquer (só visual): dois boletos e dormentes.
  const track = (ax, az, bx, bz, sleepers = true) => {
    const d = unit([bx - ax, 0, bz - az]), nx = -d[2], nz = d[0], L = Math.hypot(bx - ax, bz - az);
    for (const off of [-.72, .72]) { const p = (t, h, o2) => [ax + d[0] * t + nx * (off + o2), h, az + d[2] * t + nz * (off + o2)];
      face([p(0, .12, -.035), p(0, .12, .035), p(L, .12, .035), p(L, .12, -.035)], COL.rail, P.metal, { n: [0, 1, 0] });
      for (const s2 of [-.035, .035]) face([p(0, 0, s2), p(0, .12, s2), p(L, .12, s2), p(L, 0, s2)], COL.rail, P.metal, { n: [nx * Math.sign(s2), 0, nz * Math.sign(s2)] }); }
    if (sleepers) for (let t = .3; t < L; t += .65) { const c = [ax + d[0] * t, az + d[2] * t], q = (u, v) => [c[0] + nx * u + d[0] * v, .05, c[1] + nz * u + d[2] * v]; face([q(-1.3, -.11), q(1.3, -.11), q(1.3, .11), q(-1.3, .11)], COL.sleeper, P.wood, { n: [0, 1, 0], s: 2 }); }
  };
  // Vagão fechado (3,4 m: ninguém sobe; cobre e divide a passagem).
  const wagon = (x0, z0, x1, z1, c) => {
    const alongZ = z1 - z0 > x1 - x0;
    box(x0, .95, z0, x1, 3.4, z1, c, P.metal, { s: .6, top: COL.roofSnow, topPat: P.ground, mask: 0, skip: [] });
    box(x0 + .25, .25, z0 + .25, x1 - .25, .95, z1 - .25, 0x23272a, P.metal, { mask: 0 });
    const m = alongZ ? (z0 + z1) / 2 : (x0 + x1) / 2;
    if (alongZ) for (const x of [x0 - .02, x1 + .02]) face([[x, 1.1, m - 1.3], [x, 3.0, m - 1.3], [x, 3.0, m + 1.3], [x, 1.1, m + 1.3]], 0x4a1f18, P.metal, { n: [x < x0 ? -1 : 1, 0, 0], s: .6 });
    else for (const z of [z0 - .02, z1 + .02]) face([[m - 1.3, 1.1, z], [m - 1.3, 3.0, z], [m + 1.3, 3.0, z], [m + 1.3, 1.1, z]], 0x4a1f18, P.metal, { n: [0, 0, z < z0 ? -1 : 1], s: .6 });
    solid(x0, 0, z0, x1, 3.4, z1);
  };

  // ------------------------------------------------------------ linha de trem: desce os Trilhos e entra no bombsite
  track(-18, 38, -18, -12); track(-18, -12, -15, -16.5, false); track(-15, -16.5, -12, -18, false); track(-12, -18, 6, -18);
  box(5.6, 0, -19.4, 6.2, .9, -16.6, COL.yellow, P.metal, { s: .6 }); // para-choque no fim da linha

  // ------------------------------------------------------------ bombsite (pátio de carga)
  wagon(-7, -19.3, 2, -16.7, COL.boxcar);                                          // vagão: divide norte (CT) e sul (passarela)
  crate(-8.6, -14, 2, 2, 2); crate(-6.6, -13.6, 1, 1, 1, 0, 0x8a6a45);             // pilha junto ao portão oeste (sobe pela pequena)
  crate(6.8, -24.8, 1.2, 1.2, 1.2); crate(-8.2, -24.6, 1.2, 1.2, 1.2, 0, 0x8a6a45); // entradas CT
  barrier(5.4, -15.4, 7.6, -14.8);                                                 // segura a porta leste
  crate(-2.2, -12.2, 1.2, 1.2, 1.2);                                               // embaixo da passarela (pouso do pulo)
  paint('A', 3.2, -22, 2.2);
  lamp(9.2, -11, 5.4);
  // ------------------------------------------------------------ Trilhos (longo, oeste)
  wagon(-19.3, 4, -16.7, 13, COL.boxcar2);
  crate(-21.6, 24.5, 1.2, 1.2, 1.2); crate(-15.4, -6, 1.2, 1.2, 1.2, 0, 0x8a6a45);
  barrier(-21.6, -14.4, -19.5, -13.8);
  lamp(-14.6, 18, 5.2);
  // ------------------------------------------------------------ Passarela (meio elevado)
  box(-6, 0, -10, 6, 3.2, -4, 0x8d8a84, P.concrete, { s: .3, skip: ['-y', '+y', '-x', '+z', '+x'] });     // muro sul do bombsite
  for (const x of [-5, -1.6, 1.8, 5.2]) box(x - .2, 0, -10.25, x + .2, 3.2, -10, COL.steel, P.metal, { mask: 0 });
  box(-6, 3.0, -10.3, 6, 3.2, -10, COL.yellow, P.plain, { mask: 0, skip: ['-y'] });
  railing(-6, -10, 6, -10, 3.2, 1.05, COL.yellow);                                // pula-se por cima para cair no bombsite
  stairs(-4, -4, 4, 2, 0, 3.2, '-z', 0x7a8086, P.metal, { tread: 0x8c9297 });        // escada do TR (sobe para o norte)
  stairs(6, -10, 10, -4, 0, 3.2, '+z', 0x7a8086, P.metal, { tread: 0x8c9297 });      // escada do CT (do bombsite, sobe para o sul)
  face([[6, 0, -4], [6, 3.2, -4], [6, 3.2, -10], [6, 0, -10]], 0x8d8a84, P.concrete, { n: [1, 0, 0], s: .3 }); // lado da passarela junto à escada do CT
  box(-4.6, 3.2, -6.8, -3.4, 4.2, -5.6, COL.crate, P.wood, { s: 1.5 });           // caixote no alto: cobre quem segura a escada
  // ------------------------------------------------------------ meio (lado TR)
  crate(2.4, 21, 1.2, 1.2, 1.2); barrier(-3.6, 10, -1.5, 10.6);
  lamp(-3.6, 28, 5.2);
  // ------------------------------------------------------------ Galpão (coberto, leste) e Doca
  box(12, 6.5, -18, 20, 6.8, 6, 0x5a5e61, P.metal, { under: 0x4b4f52, skip: ['-x', '+x', '-z', '+z'] });
  box(10, 4.0, -18, 12, 6.8, -14, 0x6b7378, P.metal, { s: .6 });                  // verga da porta leste
  box(14, 4.0, 4, 18, 6.8, 6, 0x6b7378, P.metal, { s: .6 });                       // verga do portão para a Doca
  for (const z of [-15, -7, 1]) for (const x of [12.3, 19.7]) box(x - .2, 0, z - .2, x + .2, 6.5, z + .2, COL.steel, P.metal);
  for (const z of [-12, -4, 2]) box(15.6, 6.0, z, 16.4, 6.1, z + .3, COL.lamp, P.plain, { mask: 0, skip: [] });
  crate(17, -10, 2.4, 2.4, 2.4); crate(16, -9.4, 1, 1.2, 1.2, 0, 0x8a6a45);      // meio do galpão
  crate(12.8, -2, 1.2, 1.2, 1.2); drum(18.8, 3); drum(19.2, 2.3);
  { const x0 = 15.4, x1 = 18, z0 = 14, z1 = 26; // carreta na Doca
    box(x0, 1.2, z0, x1, 3.6, z1, COL.trailer, P.metal, { s: .5, top: COL.roofSnow, topPat: P.ground, mask: 0, skip: [] });
    box(x0 + .3, .5, z0 + .3, x1 - .3, 1.2, z0 + 2.4, 0x2a2d30, P.metal, { mask: 0 }); box(x0 + .3, .5, z1 - 3.5, x1 - .3, 1.2, z1 - .3, 0x2a2d30, P.metal, { mask: 0 });
    for (const z of [z1 - 2.8, z1 - 1.6]) for (const x of [x0 + .15, x1 - .15]) box(x - .1, 0, z - .45, x + .1, .9, z + .45, 0x1b1d1f, P.metal, { mask: 0 });
    face([[x0 - .02, 1.4, z0 + 1], [x0 - .02, 3.3, z0 + 1], [x0 - .02, 3.3, z1 - 1], [x0 - .02, 1.4, z1 - 1]].reverse(), 0xc23b2c, P.metal, { n: [-1, 0, 0], s: .5 });
    solid(x0, 0, z0, x1, 3.6, z1); }
  barrier(11, 9, 13.1, 9.6);
  lamp(19.4, 10, 5.4);
  // ------------------------------------------------------------ bases
  crate(-9.6, 32.6, 1.2, 1.2, 1.2); crate(8.6, 32.2, 1.2, 1.2, 1.2, 0, 0x8a6a45);
  crate(-5.6, -31.6, 1.2, 1.2, 1.2, 0, 0x8a6a45);
  lamp(0, -34.6, 5.2); lamp(-4, 38.6, 5.2);

  // ------------------------------------------------------------ montanhas ao fundo (só cenário)
  // Cordilheira contínua: silhueta suave, pedra embaixo e neve nos picos.
  const N = 48, R = 66, ridge = Array.from({ length: N }, (_, k) => 9 + 7 * Math.sin(k * .9) ** 2 + 9 * hash(k) * Math.abs(Math.sin(k * .37)) + 4 * Math.sin(k * .23 + 1));
  for (let k = 0; k < N; k++) {
    const a0 = k / N * 2 * Math.PI, a1 = (k + 1) / N * 2 * Math.PI, h0 = ridge[k], h1 = ridge[(k + 1) % N], P0 = r => [Math.cos(a0) * r, 0, Math.sin(a0) * r], P1 = r => [Math.cos(a1) * r, 0, Math.sin(a1) * r];
    const at = (pt, y) => [pt[0], y, pt[2]], sn = .68;
    face([at(P0(R), -1), at(P0(R + 3), h0 * sn), at(P1(R + 3), h1 * sn), at(P1(R), -1)], 0x66737c, P.ground, { s: .08 });
    face([at(P0(R + 3), h0 * sn), at(P0(R + 6), h0), at(P1(R + 6), h1), at(P1(R + 3), h1 * sn)], 0xeef2f5, P.ground, { s: .08 });
  }

  const yaw = { north: 0, south: Math.PI };
  const map = {
    key: 'estacao', name: 'Estação', scale: 1, center: [0, 0, 0], bounds: [-76, -3, -76, 76, 45, 76],
    t: [[-6, 33.4, yaw.north, 0], [-2, 34.8, yaw.north, 0], [2, 33.4, yaw.north, 0], [6, 34.8, yaw.north, 0], [0, 32, yaw.north, 0]],
    ct: [[-5, -32.6, yaw.south, 0], [-2, -31.2, yaw.south, 0], [2, -32.6, yaw.south, 0], [5, -31.2, yaw.south, 0], [0, -33.4, yaw.south, 0]],
    sites: [{ name: 'A', x0: -9.5, z0: -25.5, x1: 9.5, z1: -10.5, y0: -.2, y1: 2.2, lx: 3.2, lz: -22 }],
    ladders: [], polygons: K.polygons, hulls: K.hulls,
    report: { sourceSha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex') },
  };
  bakeNavigation(map);
  pruneNavigation(map);
  return map;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const map = buildEstacao(), packed = packMap(map), bytes = gzipSync(Buffer.from(JSON.stringify(packed)), { level: 9 });
  const out = resolve(import.meta.dirname, '../assets/maps');
  writeFileSync(resolve(out, 'estacao.js'), '// Estação: mapa original do Wingman feito para este jogo (tools/build-estacao.mjs). Texturas procedurais leves, sem imagens.\n(globalThis.SOURCE_MAP_PAYLOADS??={}).estacao=' + JSON.stringify(bytes.toString('base64')) + ';\n');
  // Catálogo: os mapas originais vêm primeiro; os outros ficam como estão.
  const file = resolve(out, 'catalog.js'), ctx = {}; new Function('globalThis', readFileSync(file, 'utf8'))(ctx);
  const old = ctx.SOURCE_MAP_CATALOG || {}, entry = { name: map.name, original: true, ax: map.ax, az: map.az, t: map.t, ct: map.ct, sites: map.sites }, catalog = {};
  for (const [k, v] of Object.entries(old)) if (v.original && k !== 'estacao') catalog[k] = v;
  catalog.estacao = entry; for (const [k, v] of Object.entries(old)) if (!v.original) catalog[k] = v;
  writeFileSync(file, '// Metadata only: the geometry is loaded when a map is played.\nglobalThis.SOURCE_MAP_CATALOG=' + JSON.stringify(catalog) + ';\n');
  const tris = Buffer.from(packed.mesh.index, 'base64').length / 12;
  console.log('estacao', bytes.length + ' bytes gzipped', tris + ' triangles', map.hulls.length + ' hulls', 'nav', JSON.stringify({ nodes: map.report.navigation.nodes, spawns: map.report.navigation.spawnsConnected + '/' + map.report.navigation.spawnsTotal, pruned: map.report.navigationPruned }));
}
