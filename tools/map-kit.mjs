// Peças de geometria para os mapas originais (polígonos texturizados pelos padrões do shader + colisão convexa).
import { PATTERNS as P } from './source-bsp.mjs';

export const UVS = { [P.plain]: .5, [P.brick]: .8, [P.tile]: .6, [P.wood]: 1, [P.concrete]: .3, [P.metal]: .6, [P.ground]: .5, [P.stone]: .7, [P.asphalt]: .5, [P.roof]: .55, [P.foliage]: .5 };
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
export const hash = (...v) => { let h = 2166136261; for (const x of v) { h ^= Math.round(x * 1000) | 0; h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

export function createKit(src) {
  const polygons = [], hulls = [];
  // Face plana convexa; uv pela projeção do mundo no plano da face, na escala do padrão (ou dada).
  function face(pts, c, pat = P.plain, o = {}) {
    const n = o.n || unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))), s = o.s ?? UVS[pat] ?? .5;
    const ax = Math.abs(n[1]) > .7 ? [0, 2] : Math.abs(n[0]) > Math.abs(n[2]) ? [2, 1] : [0, 1];
    const uv = o.uv || pts.map(p => [p[ax[0]] * s, p[ax[1]] * s]);
    polygons.push({ p: pts.map(p => p.slice()), n, c, glass: !!o.glass, tag: o.tag || 'world', uv, pat });
  }
  function solid(x0, y0, z0, x1, y1, z1, mask = 3) {
    hulls.push({ planes: [[1, 0, 0, x1], [-1, 0, 0, -x0], [0, 1, 0, y1], [0, -1, 0, -y0], [0, 0, 1, z1], [0, 0, -1, -z0]], min: [x0, y0, z0], max: [x1, y1, z1], mask, src });
  }
  // Caixa com faces para fora; o.skip lista faces omitidas (padrão: a de baixo); o.mask 0 = só visual.
  function box(x0, y0, z0, x1, y1, z1, c, pat = P.plain, o = {}) {
    const sk = new Set(o.skip || ['-y']), top = o.top ?? c, tp = o.topPat ?? pat, side = o.side ?? c;
    if (!sk.has('+y')) face([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], top, tp, { ...o, n: [0, 1, 0], s: o.topS ?? o.s });
    if (!sk.has('-y')) face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], o.under ?? c, pat, { ...o, n: [0, -1, 0] });
    if (!sk.has('+x')) face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], side, pat, { ...o, n: [1, 0, 0] });
    if (!sk.has('-x')) face([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], side, pat, { ...o, n: [-1, 0, 0] });
    if (!sk.has('+z')) face([[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], c, pat, { ...o, n: [0, 0, 1] });
    if (!sk.has('-z')) face([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], c, pat, { ...o, n: [0, 0, -1] });
    if (o.mask !== 0) solid(x0, y0, z0, x1, y1, z1, o.mask ?? 3);
  }
  // Prisma vertical de n lados (tambores, colunas); colisão convexa pelos mesmos planos.
  function cyl(x, z, r, y0, y1, c, pat = P.plain, o = {}) {
    const n = o.seg || 10, s = o.s ?? UVS[pat], ring = Array.from({ length: n }, (_, k) => { const a = (k + .5) * 2 * Math.PI / n; return [x + Math.cos(a) * r, z + Math.sin(a) * r]; });
    for (let k = 0; k < n; k++) {
      const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n], m = (k + 1) * 2 * Math.PI / n, len = Math.hypot(bx - ax, bz - az), u0 = k * len * s;
      face([[ax, y0, az], [ax, y1, az], [bx, y1, bz], [bx, y0, bz]], c, pat, { ...o, n: [Math.cos(m), 0, Math.sin(m)], uv: [[u0, y0 * s], [u0, y1 * s], [u0 + len * s, y1 * s], [u0 + len * s, y0 * s]] });
    }
    if (!o.noTop) face(ring.map(([px, pz]) => [px, y1, pz]).reverse(), o.top ?? c, o.topPat ?? pat, { ...o, n: [0, 1, 0] });
    if (o.mask !== 0) {
      const planes = [[0, 1, 0, y1], [0, -1, 0, -y0]];
      for (let k = 0; k < n; k++) { const m = (k + 1) * 2 * Math.PI / n, [ax, az] = ring[k]; planes.push([Math.cos(m), 0, Math.sin(m), Math.cos(m) * ax + Math.sin(m) * az]); }
      hulls.push({ planes, min: [x - r, y0, z - r], max: [x + r, y1, z + r], mask: o.mask ?? 3, src });
    }
  }
  // Escada: degraus de ~20 cm na vista, rampa lisa na colisão (como as escadas do CS). dir: lado para onde sobe.
  function stairs(x0, z0, x1, z1, y0, y1, dir, c, pat, o = {}) {
    const n = Math.max(2, Math.round((y1 - y0) / .2)), rise = (y1 - y0) / n, alongX = dir === '+x' || dir === '-x', len = alongX ? x1 - x0 : z1 - z0, up = dir[0] === '+';
    for (let k = 0; k < n; k++) {
      const a = up ? k / n : 1 - (k + 1) / n, b = up ? (k + 1) / n : 1 - k / n, top = y0 + rise * (k + 1);
      if (alongX) box(x0 + len * a, y0, z0, x0 + len * b, top, z1, c, pat, { mask: 0, top: o.tread ?? c, topPat: o.treadPat ?? pat, skip: ['-y'] });
      else box(x0, y0, z0 + len * a, x1, top, z0 + len * b, c, pat, { mask: 0, top: o.tread ?? c, topPat: o.treadPat ?? pat, skip: ['-y'] });
    }
    const yA = y0 + rise / 2, g = (y1 - yA) / len, l = Math.hypot(g, 1);
    let nt, pt;
    if (alongX) { nt = up ? [-g / l, 1 / l, 0] : [g / l, 1 / l, 0]; pt = up ? [x0, yA, z0] : [x1, yA, z0]; }
    else { nt = up ? [0, 1 / l, -g / l] : [0, 1 / l, g / l]; pt = up ? [x0, yA, z0] : [x0, yA, z1]; }
    hulls.push({ planes: [[nt[0], nt[1], nt[2], nt[0] * pt[0] + nt[1] * pt[1] + nt[2] * pt[2]], [0, -1, 0, -y0], [1, 0, 0, x1], [-1, 0, 0, -x0], [0, 0, 1, z1], [0, 0, -1, -z0]], min: [x0, y0, z0], max: [x1, y1, z1], mask: 3, src });
  }
  // Guarda-corpo de ferro: barras na vista; bloqueia o corpo, tiros passam.
  function railing(x0, z0, x1, z1, y, h, c) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), L = alongX ? x1 - x0 : z1 - z0, t = .025;
    const bar = (a, b, ya, yb) => alongX ? box(a, ya, z0 - t, b, yb, z0 + t, c, P.metal, { mask: 0 }) : box(x0 - t, ya, a, x0 + t, yb, b, c, P.metal, { mask: 0 });
    const a0 = alongX ? x0 : z0;
    bar(a0, a0 + L, y + h - .05, y + h); bar(a0, a0 + L, y + .5, y + .54);
    for (let k = 0; k <= Math.round(L / 1.2); k++) { const a = a0 + Math.min(L - .05, k * L / Math.round(L / 1.2)); bar(a, a + .05, y, y + h); }
    if (alongX) solid(x0, y, z0 - .05, x1, y + h, z0 + .05, 1); else solid(x0 - .05, y, z0, x0 + .05, y + h, z1, 1);
  }
  return { polygons, hulls, face, solid, box, cyl, stairs, railing };
}
