// Reader for the CS:GO navigation mesh (.nav, version 16, sub-version 1) embedded in the supplied BSPs.
// Layout follows CNavMesh::Load / CNavArea::Load from the public Source SDK, plus the CS:GO approach-area block.
export function readNav(buf) {
  let p = 0;
  const u8 = () => buf[p++], u16 = () => { const v = buf.readUInt16LE(p); p += 2; return v; };
  const u32 = () => { const v = buf.readUInt32LE(p); p += 4; return v; }, f32 = () => { const v = buf.readFloatLE(p); p += 4; return v; };
  if (u32() !== 0xFEEDFACE) throw Error('Not a nav file');
  const version = u32(), sub = version >= 10 ? u32() : 0;
  if (version >= 4) u32();
  if (version >= 14) u8();
  const places = u16();
  for (let i = 0; i < places; i++) { const n = u16(); p += n; }
  if (version > 11) u8();
  const count = u32(), areas = [];
  for (let i = 0; i < count; i++) {
    const id = u32(), flags = version <= 8 ? u8() : version < 13 ? u16() : u32();
    const nw = [f32(), f32(), f32()], se = [f32(), f32(), f32()], neZ = f32(), swZ = f32();
    const links = [];
    for (let d = 0; d < 4; d++) { const n = u32(); for (let k = 0; k < n; k++) links.push(u32()); }
    { const n = u8(); p += n * 17; }
    if (version < 15) { const n = u8(); p += n * 14; }
    const paths = u32();
    for (let e = 0; e < paths; e++) { p += 10; { const n = u8(); p += n * 5; } }
    u16();
    for (let l = 0; l < 2; l++) { const n = u32(); p += n * 4; }
    if (version >= 8) p += 8;
    if (version >= 11) p += 16;
    if (version >= 16) { { const n = u32(); p += n * 5; } u32(); }
    if (sub >= 1) { const n = u8(); p += n * 14; }
    areas.push({ id, flags, links, x0: nw[0], y0: nw[1], x1: se[0], y1: se[1], z: [nw[2], neZ, se[2], swZ] });
  }
  return { version, sub, areas };
}

// Height of the nav surface at (x, y) for every area that covers the point (Source units).
export function navHeightsAt(nav, x, y) {
  const out = [];
  for (const a of nav.areas) {
    if (x < a.x0 || x > a.x1 || y < a.y0 || y > a.y1) continue;
    const u = (x - a.x0) / Math.max(1e-6, a.x1 - a.x0), v = (y - a.y0) / Math.max(1e-6, a.y1 - a.y0);
    const north = a.z[0] + (a.z[1] - a.z[0]) * u, south = a.z[3] + (a.z[2] - a.z[3]) * u;
    out.push(north + (south - north) * v);
  }
  return out;
}
