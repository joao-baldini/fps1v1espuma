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
  function overview(halfWidth, halfHeight, size) {
    return { size, halfWidth, halfHeight, scale: size * .46 / Math.hypot(halfWidth, halfHeight) };
  }
  function unproject(px, py, rect, metrics) {
    if (!(rect.width > 0 && rect.height > 0)) return null;
    const x = ((px - rect.left) / rect.width - .5) * metrics.size, z = ((py - rect.top) / rect.height - .5) * metrics.size;
    if (Math.hypot(x, z) > metrics.size / 2) return null;
    const wx = x / metrics.scale, wz = z / metrics.scale;
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
    const { size, range, pose, markers, sites = [], bomb, alive = true } = state, c = size / 2, scale = (c - 18) / range;
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(c, c, c - 2, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(15,24,30,.72)'; ctx.fillRect(0, 0, size, size);
    ctx.save(); ctx.translate(c, c); ctx.rotate(pose.yaw); ctx.scale(scale, scale); ctx.translate(-pose.x, -pose.z); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(map.canvas, -map.halfWidth, -map.halfHeight, map.halfWidth * 2, map.halfHeight * 2); ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 25px "Plex UI",sans-serif';
    for (const site of sites) {
      const p = project(site.lx ?? (site.x0 + site.x1) / 2, site.lz ?? (site.z0 + site.z1) / 2, pose, size, range);
      ctx.lineWidth = 5; ctx.strokeStyle = '#24323a'; ctx.strokeText(site.name || 'A', p.x, p.y); ctx.fillStyle = palette.site; ctx.fillText(site.name || 'A', p.x, p.y);
    }
    for (const marker of markers) {
      const p = project(marker.x, marker.z, pose, size, range), color = marker.color || palette.ally;
      ctx.globalAlpha = p.edge ? .75 : 1;
      if (p.edge) triangle(ctx, p.x, p.y, Math.atan2(p.x - c, -(p.y - c)), color, 8); else dot(ctx, p.x, p.y, color, marker.ghost ? 7.5 : 6.5);
    }
    ctx.globalAlpha = 1;
    if (bomb) { const p = project(bomb.x, bomb.z, pose, size, range); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#e7bc97'; ctx.fillRect(-6, -6, 12, 12); ctx.restore(); }
    if (alive) triangle(ctx, c, c, 0, palette.self, 12);
    ctx.font = '500 22px "Plex UI",sans-serif'; ctx.fillStyle = '#ecf0ed'; ctx.fillText('N', c + Math.sin(pose.yaw) * (c - 14), c - Math.cos(pose.yaw) * (c - 14));
    ctx.restore(); ctx.beginPath(); ctx.arc(c, c, c - 2, 0, TAU); ctx.strokeStyle = 'rgba(221,234,238,.28)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function drawOverview(ctx, map, state) {
    const { size, markers, sites = [], pose, selected, scanRadius } = state, metrics = overview(map.halfWidth, map.halfHeight, size), c = size / 2;
    const point = (x, z) => ({ x: c + x * metrics.scale, y: c + z * metrics.scale });
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(c, c, c - 2, 0, TAU); ctx.clip(); ctx.fillStyle = '#18252deb'; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(map.canvas, c - map.halfWidth * metrics.scale, c - map.halfHeight * metrics.scale, map.halfWidth * metrics.scale * 2, map.halfHeight * metrics.scale * 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 18px "Plex UI",sans-serif';
    for (const site of sites) { const p = point(site.lx ?? (site.x0 + site.x1) / 2, site.lz ?? (site.z0 + site.z1) / 2); ctx.fillStyle = palette.site; ctx.fillText(site.name || 'A', p.x, p.y); }
    for (const marker of markers) { const p = point(marker.x, marker.z); dot(ctx, p.x, p.y, marker.color || palette.ally, 4.5); }
    if (pose) { const p = point(pose.x, pose.z); triangle(ctx, p.x, p.y, -pose.yaw, palette.self, 8); }
    if (selected) { const p = point(...selected); ctx.beginPath(); ctx.arc(p.x, p.y, scanRadius * metrics.scale, 0, TAU); ctx.fillStyle = '#9bc6d42b'; ctx.fill(); ctx.strokeStyle = '#c5e2e9'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore(); return metrics;
  }
  const api = { project, overview, unproject, makeMap, drawRadar, drawOverview };
  root.HudRadar = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
