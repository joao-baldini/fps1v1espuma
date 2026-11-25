(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const palette = { floor: '#829299', upper: '#a9b5ba', cover: '#536168', wall: '#27343a', site: '#e0c89f', ally: '#9bc6d4', self: '#f4f5ef' };

  // World axes have one scale. Rotation follows the actual camera yaw, never stretches the map.
  function project(x, z, pose, size, range, clampToEdge = true) {
    const radius = size / 2 - 18, scale = radius / range, dx = x - pose.x, dz = z - pose.z;
    const cs = Math.cos(pose.yaw), sn = Math.sin(pose.yaw);
    let sx = (cs * dx - sn * dz) * scale, sy = (sn * dx + cs * dz) * scale;
    const distance = Math.hypot(sx, sy), edge = distance > radius;
    if (edge && clampToEdge) { sx *= radius / distance; sy *= radius / distance; }
    return { x: size / 2 + sx, y: size / 2 + sy, edge, distance: Math.hypot(dx, dz) };
  }
  // Giro do mapa (rot): tela = R(rot)·mundo, como no radar que gira com a câmera.
  const turn = (x, z, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * x - s * z, s * x + c * z]; };
  function overview(halfWidth, halfHeight, size, rot = 0) {
    return { size, halfWidth, halfHeight, rot, scale: size * .46 / Math.hypot(halfWidth, halfHeight) };
  }
  function unproject(px, py, rect, metrics) {
    if (!(rect.width > 0 && rect.height > 0)) return null;
    const x = ((px - rect.left) / rect.width - .5) * metrics.size, z = ((py - rect.top) / rect.height - .5) * metrics.size;
    if (Math.hypot(x, z) > metrics.size / 2) return null;
    const [wx, wz] = turn(x / metrics.scale, z / metrics.scale, -(metrics.rot || 0));
    return Math.abs(wx) <= metrics.halfWidth && Math.abs(wz) <= metrics.halfHeight ? [wx, wz] : null;
  }

  // Join navigation cells into filled contours. Rounded joins avoid a mosaic of little squares.
  function contours(ctx, mask, w, h, nav, X, Z) {
    const edges = new Map(), cell = (x, z) => x >= 0 && z >= 0 && x < w && z < h && mask[z * w + x];
    const edge = (ax, az, bx, bz) => { const k = az * (w + 1) + ax; if (!edges.has(k)) edges.set(k, []); edges.get(k).push([bx, bz]); };
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (cell(x, z)) {
      if (!cell(x, z - 1)) edge(x, z, x + 1, z);
      if (!cell(x + 1, z)) edge(x + 1, z, x + 1, z + 1);
      if (!cell(x, z + 1)) edge(x + 1, z + 1, x, z + 1);
      if (!cell(x - 1, z)) edge(x, z + 1, x, z);
    }
    const point = ([x, z]) => [X(nav.minX + (x - .5) * nav.step), Z(nav.minZ + (z - .5) * nav.step)];
    ctx.beginPath();
    while (edges.size) {
      const first = edges.keys().next().value, chain = [[first % (w + 1), Math.floor(first / (w + 1))]];
      let key = first;
      for (let guard = 0; guard < w * h * 4 + 4; guard++) {
        const list = edges.get(key); if (!list?.length) break;
        const next = list.pop(); if (!list.length) edges.delete(key);
        key = next[1] * (w + 1) + next[0]; if (key === first) break; chain.push(next);
      }
      if (chain.length < 3) continue;
      const p = chain.map(point), last = p[p.length - 1];
      ctx.moveTo((last[0] + p[0][0]) / 2, (last[1] + p[0][1]) / 2);
      for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  function makeMap(data) {
    const { halfWidth: ax, halfHeight: az, nav, boxes = [], water = [] } = data;
    const canvas = document.createElement('canvas'), factor = 768 / (2 * Math.max(ax, az));
    canvas.width = Math.round(2 * ax * factor); canvas.height = Math.round(2 * az * factor);
    const ctx = canvas.getContext('2d'), X = v => (v + ax) * factor, Z = v => (v + az) * factor;
    if (nav) {
      const mask = new Uint8Array(nav.w * nav.h), upper = new Uint8Array(mask.length);
      for (const id of nav.walk) {
        const wx = nav.compact ? nav.x[id] : nav.minX + id % nav.w * nav.step;
        const wz = nav.compact ? nav.z[id] : nav.minZ + Math.floor(id % nav.plane / nav.w) * nav.step;
        const x = Math.round((wx - nav.minX) / nav.step), z = Math.round((wz - nav.minZ) / nav.step), i = z * nav.w + x;
        if (x < 0 || z < 0 || x >= nav.w || z >= nav.h) continue;
        mask[i] = 1; if (nav.height[id] > 2.4) upper[i] = 1;
      }
      ctx.fillStyle = palette.floor; contours(ctx, mask, nav.w, nav.h, nav, X, Z);
      ctx.fillStyle = palette.upper; contours(ctx, upper, nav.w, nav.h, nav, X, Z);
    } else {
      ctx.fillStyle = palette.floor; ctx.fillRect(X(-ax + .5), Z(-az + .5), (2 * ax - 1) * factor, (2 * az - 1) * factor);
      for (const [x0, z0, x1, z1] of water) { ctx.fillStyle = '#507682'; ctx.fillRect(X(x0), Z(z0), (x1 - x0) * factor, (z1 - z0) * factor); }
      for (const b of boxes.slice().sort((a, b) => a.max[1] - b.max[1])) {
        const height = b.max[1] - b.min[1], width = b.max[0] - b.min[0], depth = b.max[2] - b.min[2];
        if (b.max[1] < .3 || height < .04 || b.min[1] < -.5) continue;
        ctx.fillStyle = b.deck || height < 3 && width * depth > 16 ? palette.upper : b.max[1] > 4 ? palette.wall : palette.cover;
        ctx.fillRect(X(b.min[0]), Z(b.min[2]), width * factor, depth * factor);
      }
    }
    return { canvas, halfWidth: ax, halfHeight: az };
  }
  function triangle(ctx, x, y, angle, color, size = 12) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * .7, size * .7); ctx.lineTo(0, size * .38); ctx.lineTo(-size * .7, size * .7); ctx.closePath();
    ctx.fillStyle = color; ctx.strokeStyle = '#17232a'; ctx.lineWidth = 2.5; ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function dot(ctx, x, y, color, radius = 7) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#17232a'; ctx.lineWidth = 2.5; ctx.stroke();
  }
  function drawRadar(ctx, map, state) {
    // view: centro e giro do radar (jogador no centro e girando com a câmera, ou mapa parado / norte para cima)
    const { size, range, pose, view = pose, markers, sites = [], bomb, alive = true } = state, c = size / 2, scale = (c - 18) / range;
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(c, c, c - 2, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(15,24,30,.72)'; ctx.fillRect(0, 0, size, size);
    ctx.save(); ctx.translate(c, c); ctx.rotate(view.yaw); ctx.scale(scale, scale); ctx.translate(-view.x, -view.z); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(map.canvas, -map.halfWidth, -map.halfHeight, map.halfWidth * 2, map.halfHeight * 2); ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 25px "Plex UI",sans-serif';
    for (const site of sites) {
      const p = project(site.lx ?? (site.x0 + site.x1) / 2, site.lz ?? (site.z0 + site.z1) / 2, view, size, range);
      ctx.lineWidth = 5; ctx.strokeStyle = '#24323a'; ctx.strokeText(site.name || 'A', p.x, p.y); ctx.fillStyle = palette.site; ctx.fillText(site.name || 'A', p.x, p.y);
    }
    for (const marker of markers) {
      const p = project(marker.x, marker.z, view, size, range), color = marker.color || palette.ally;
      ctx.globalAlpha = p.edge ? .75 : 1;
      if (p.edge) triangle(ctx, p.x, p.y, Math.atan2(p.x - c, -(p.y - c)), color, 8); else dot(ctx, p.x, p.y, color, marker.ghost ? 7.5 : 6.5);
    }
    ctx.globalAlpha = 1;
    if (bomb) { const p = project(bomb.x, bomb.z, view, size, range); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#e7bc97'; ctx.fillRect(-6, -6, 12, 12); ctx.restore(); }
    if (alive) { const p = project(pose.x, pose.z, view, size, range); triangle(ctx, p.x, p.y, view.yaw - pose.yaw, palette.self, 12); }
    ctx.font = '500 22px "Plex UI",sans-serif'; ctx.fillStyle = '#ecf0ed'; ctx.fillText('N', c + Math.sin(view.yaw) * (c - 14), c - Math.cos(view.yaw) * (c - 14));
    ctx.restore(); ctx.beginPath(); ctx.arc(c, c, c - 2, 0, TAU); ctx.strokeStyle = 'rgba(221,234,238,.28)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function drawOverview(ctx, map, state) {
    const { size, markers, sites = [], pose, selected, scanRadius, range, rot = 0 } = state, metrics = overview(map.halfWidth, map.halfHeight, size, rot), c = size / 2;
    const point = (x, z) => { const [u, v] = turn(x, z, rot); return { x: c + u * metrics.scale, y: c + v * metrics.scale }; };
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(c, c, c - 2, 0, TAU); ctx.clip(); ctx.fillStyle = '#18252deb'; ctx.fillRect(0, 0, size, size);
    ctx.save(); ctx.translate(c, c); ctx.rotate(rot); ctx.drawImage(map.canvas, -map.halfWidth * metrics.scale, -map.halfHeight * metrics.scale, map.halfWidth * metrics.scale * 2, map.halfHeight * metrics.scale * 2); ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 18px "Plex UI",sans-serif';
    for (const site of sites) { const p = point(site.lx ?? (site.x0 + site.x1) / 2, site.lz ?? (site.z0 + site.z1) / 2); ctx.fillStyle = palette.site; ctx.fillText(site.name || 'A', p.x, p.y); }
    for (const marker of markers) { const p = point(marker.x, marker.z); dot(ctx, p.x, p.y, marker.color || palette.ally, 4.5); }
    // Alcance da habilidade (como a smoke do Brimstone): fora do círculo o mapa escurece; a borda fica marcada.
    if (pose && range) {
      const p = point(pose.x, pose.z), r = range * metrics.scale;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, size, size); ctx.arc(p.x, p.y, r, 0, TAU, true); ctx.fillStyle = 'rgba(6,12,16,.62)'; ctx.fill('evenodd');
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.setLineDash([10, 7]); ctx.strokeStyle = 'rgba(155,198,212,.85)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    if (pose) { const p = point(pose.x, pose.z); triangle(ctx, p.x, p.y, rot - pose.yaw, palette.self, 8); }
    if (selected) { const p = point(...selected); ctx.beginPath(); ctx.arc(p.x, p.y, scanRadius * metrics.scale, 0, TAU); ctx.fillStyle = '#9bc6d42b'; ctx.fill(); ctx.strokeStyle = '#c5e2e9'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore(); return metrics;
  }
  // Mapa da habilidade com alcance (como o do Brimstone no Valorant): zoom centrado no jogador, o círculo mostra só a
  // área que a habilidade alcança (raio = range), em holograma na cor do agente, com anel de marcas em volta.
  function rangeMetrics(size, range, pose, rot = 0) { const radius = size / 2 - 40; return { size, radius, scale: radius / range, cx: pose.x, cz: pose.z, range, rot }; }
  function unprojectRange(px, py, rect, m) {
    if (!(rect.width > 0 && rect.height > 0)) return null;
    const x = ((px - rect.left) / rect.width - .5) * m.size, z = ((py - rect.top) / rect.height - .5) * m.size, [dx, dz] = turn(x / m.scale, z / m.scale, -(m.rot || 0));
    return [m.cx + dx, m.cz + dz];
  }
  function drawRangeMap(ctx, map, state) {
    const { size, markers = [], sites = [], pose, selected, scanRadius, range, color = '#3ff4ff', t = 0, rot = 0 } = state, c = size / 2, m = rangeMetrics(size, range, pose, rot), R = m.radius;
    const point = (x, z) => { const [u, v] = turn(x - m.cx, z - m.cz, rot); return { x: c + u * m.scale, y: c + v * m.scale }; };
    ctx.clearRect(0, 0, size, size);
    // anel externo de marcas (gira devagar)
    ctx.save(); ctx.translate(c, c); ctx.rotate(t * .00012); ctx.strokeStyle = color; ctx.globalAlpha = .55;
    for (let i = 0; i < 96; i++) { const a = i / 96 * TAU, long = i % 8 === 0, r0 = R + 12, r1 = R + (long ? 30 : 22); ctx.lineWidth = long ? 3 : 1.6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
    ctx.restore();
    // dentro do alcance: o mapa recortado e tingido, sobre um fundo translúcido, com grade de holograma
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.clip();
    ctx.globalAlpha = .95; ctx.save(); ctx.translate(c, c); ctx.rotate(rot); ctx.scale(m.scale, m.scale); ctx.translate(-m.cx, -m.cz);
    ctx.drawImage(map.canvas, -map.halfWidth, -map.halfHeight, map.halfWidth * 2, map.halfHeight * 2); ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = color; ctx.globalAlpha = .38; ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'destination-over'; ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(6,34,42,.55)'; ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; ctx.globalAlpha = .1; ctx.lineWidth = 1;
    // grade de 5 m presa ao mapa (gira junto)
    ctx.save(); ctx.translate(c, c); ctx.rotate(rot); ctx.scale(m.scale, m.scale); ctx.translate(-m.cx, -m.cz); ctx.lineWidth = 1 / m.scale;
    const g0x = Math.floor((m.cx - range * 1.5) / 5) * 5, g0z = Math.floor((m.cz - range * 1.5) / 5) * 5;
    for (let x = g0x; x <= m.cx + range * 1.5; x += 5) { ctx.beginPath(); ctx.moveTo(x, m.cz - range * 1.5); ctx.lineTo(x, m.cz + range * 1.5); ctx.stroke(); }
    for (let z = g0z; z <= m.cz + range * 1.5; z += 5) { ctx.beginPath(); ctx.moveTo(m.cx - range * 1.5, z); ctx.lineTo(m.cx + range * 1.5, z); ctx.stroke(); }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 26px "Plex UI",sans-serif';
    for (const site of sites) { const p = point(site.lx ?? (site.x0 + site.x1) / 2, site.lz ?? (site.z0 + site.z1) / 2); ctx.fillStyle = '#f2fbff'; ctx.globalAlpha = .85; ctx.fillText(site.name || 'A', p.x, p.y); }
    ctx.globalAlpha = 1;
    for (const marker of markers) { const p = point(marker.x, marker.z); dot(ctx, p.x, p.y, marker.color || palette.ally, 6); }
    triangle(ctx, c, c, rot - pose.yaw, '#f4f5ef', 11);
    if (selected) {
      const p = point(...selected), r = Math.max(10, scanRadius * m.scale);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fillStyle = 'rgba(63,244,255,.22)'; ctx.fill();
      ctx.strokeStyle = '#e9feff'; ctx.lineWidth = 3; ctx.setLineDash([r * .9, r * .67]); ctx.lineDashOffset = -t * .02; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fillStyle = '#e9feff'; ctx.fill();
    }
    ctx.restore();
    // borda brilhante do alcance
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.stroke(); ctx.restore();
    return m;
  }
  const api = { project, overview, unproject, makeMap, drawRadar, drawOverview, rangeMetrics, unprojectRange, drawRangeMap };
  root.HudRadar = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
