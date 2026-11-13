import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { compileSourceMap } from './source-bsp.mjs';
import '../assets/maps/runtime.js';

const encode = array => Buffer.from(array.buffer,array.byteOffset,array.byteLength).toString('base64');
export function packMap(map) {
  const p=[],n=[],c=[],uv=[],pat=[],indices=[],transparent=[],known=new Map(),textured=map.polygons.some(f=>f.uv);
  for(const face of map.polygons){
    const rgb=[(face.c>>16)&255,(face.c>>8)&255,face.c&255],ids=face.p.map((v,k)=>{
      const t=textured?(face.uv?face.uv[k]:[0,0]):null,key=v.concat(face.n).map(v=>Math.round(v*1e6)).concat(rgb,t?[Math.round(t[0]*1e4),Math.round(t[1]*1e4),face.pat|0]:[]).join(',');let id=known.get(key);
      if(id===undefined){id=p.length/3;known.set(key,id);p.push(...v);n.push(...face.n);c.push(...rgb);if(t){uv.push(t[0],t[1]);pat.push(face.pat|0);}}return id;
    });
    const out=face.glass?transparent:indices;
    for(let i=1;i<ids.length-1;i++)out.push(ids[0],ids[i],ids[i+1]);
  }
  const planes=[],offsets=[0],b=[],masks=[];
  for(const h of map.hulls){if(h.planes.length<4)continue;for(const plane of h.planes)planes.push(...plane);offsets.push(planes.length/4);b.push(...h.min,...h.max);masks.push(h.mask);}
  const opaque=indices.length;for(const i of transparent)indices.push(i);
  const meta={key:map.key,name:map.name||map.key,...(map.credit?{credit:map.credit}:{}),scale:map.scale,center:map.center,bounds:map.bounds,ax:map.ax,az:map.az,playBounds:map.playBounds,t:map.t,ct:map.ct,sites:map.sites,ladders:map.ladders,sourceSha256:map.report.sourceSha256,...(map.prefire?{prefire:map.prefire}:{}),...(map.surfaceCollision?{surfaceCollision:true}:{})};
  const mesh={position:encode(new Float32Array(p)),normal:encode(new Float32Array(n)),color:encode(new Uint8Array(c)),index:encode(new Uint32Array(indices)),opaque};
  if(textured){mesh.uv=encode(new Float32Array(uv));mesh.pattern=encode(new Uint8Array(pat));}
  return {version:1,meta,mesh,collision:{planes:encode(new Float32Array(planes)),offsets:encode(new Uint32Array(offsets)),bounds:encode(new Float32Array(b)),masks:encode(new Uint8Array(masks))},...(map.navigation?{navigation:map.navigation}:{})};
}

export function bakeNavigation(map){
  const native=new globalThis.SourceMaps.NativeMap(packMap(map)),b=map.bounds,nav=native.buildNav(Math.ceil(Math.max(Math.abs(b[0]),Math.abs(b[3])))+.5,Math.ceil(Math.max(Math.abs(b[2]),Math.abs(b[5])))+.5);
  if(nav.audit.spawnsConnected!==nav.audit.spawnsTotal)throw Error(map.key+': some source spawns are disconnected '+JSON.stringify(nav.audit)+' '+JSON.stringify({t:map.t,ct:map.ct}));
  const X=id=>nav.minX+(id%nav.w)*nav.step,Z=id=>nav.minZ+Math.floor((id%nav.plane)/nav.w)*nav.step,oldToNew=new Int32Array(nav.open.length).fill(-1),x=nav.walk.map(X),z=nav.walk.map(Z),dx=(Math.min(...x)+Math.max(...x))/2,dz=(Math.min(...z)+Math.max(...z))/2;
  nav.walk.forEach((id,i)=>oldToNew[id]=i);
  const links=[];for(const id of nav.walk)for(let d=0;d<4;d++){const next=nav.links[id*4+d];links.push(next<0?-1:oldToNew[next]);}
  map.navigation={step:nav.step,minX:nav.minX-dx,minZ:nav.minZ-dz,w:nav.w,h:nav.h,x:encode(Float32Array.from(x,v=>v-dx)),z:encode(Float32Array.from(z,v=>v-dz)),height:encode(Float32Array.from(nav.walk,id=>nav.height[id])),links:encode(new Int32Array(links)),audit:nav.audit};
  const shift=p=>{p[0]-=dx;p[2]-=dz;};for(const p of map.polygons)for(const v of p.p)shift(v);
  for(const h of map.hulls){shift(h.min);shift(h.max);for(const p of h.planes)p[3]-=p[0]*dx+p[2]*dz;}
  for(const list of [map.t,map.ct])for(const p of list){p[0]-=dx;p[1]-=dz;}
  for(const s of map.sites){s.x0-=dx;s.x1-=dx;s.lx-=dx;s.z0-=dz;s.z1-=dz;s.lz-=dz;}
  for(const b of map.ladders){b[0]-=dx;b[3]-=dx;b[2]-=dz;b[5]-=dz;}
  map.bounds=[b[0]-dx,b[1],b[2]-dz,b[3]-dx,b[4],b[5]-dz];map.center[0]+=dx/map.scale;map.center[1]-=dz/map.scale;
  map.playBounds=[Math.min(...x)-dx,Math.min(...z)-dz,Math.max(...x)-dx,Math.max(...z)-dz];map.ax=Math.ceil(Math.max(Math.abs(map.playBounds[0]),Math.abs(map.playBounds[2]))+2);map.az=Math.ceil(Math.max(Math.abs(map.playBounds[1]),Math.abs(map.playBounds[3]))+2);
  map.report.navigation=nav.audit;
}

// Each navigation link is walked with the game's own ground movement (friction 5.2, acceleration 5.5, gravity, 0.5 m
// steps, the same as physics() in index.html), from the centre and from 6 cm to each side.
// Links that the body cannot actually cross (an invisible player clip on a kerb, a step that is a bit too tall) are
// removed, so bots never plan through them. Spawns and bombsites must stay connected afterwards.
export function pruneNavigation(map) {
  const nav = map.navigation, read = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
  const X = read(nav.x, Float32Array), Z = read(nav.z, Float32Array), H = read(nav.height, Float32Array), L = read(nav.links, Int32Array), n = X.length;
  const native = new globalThis.SourceMaps.NativeMap(packMap(map));
  class V { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
  const dt = 1 / 128, step = (e, wx, wz, maxS, world = native) => {
    if (e.onGround) {
      const sp = Math.hypot(e.vel.x, e.vel.z);
      if (sp > 0) { const ns = Math.max(0, sp - Math.max(sp, 2.032) * 5.2 * dt); e.vel.x *= ns / sp; e.vel.z *= ns / sp; }
      const add = maxS - (e.vel.x * wx + e.vel.z * wz);
      if (add > 0) { const as = Math.min(5.5 * maxS * dt, add); e.vel.x += as * wx; e.vel.z += as * wz; }
    } else { const add = Math.min(.762, maxS) - (e.vel.x * wx + e.vel.z * wz); if (add > 0) { const a = Math.min(add, 12 * maxS * dt); e.vel.x += wx * a; e.vel.z += wz * a; } }
    e.vel.y -= 20.32 * dt; world.move(e, dt, .3, .5);
  };
  const walk = (a, b) => {
    const ux = X[b] - X[a], uz = Z[b] - Z[a], ul = Math.hypot(ux, uz) || 1;
    for (const off of [-.06, 0, .06]) {
      const x = X[a] - uz / ul * off, z = Z[a] + ux / ul * off, y = native.ground(x, z, H[a]);
      if (native.overlap(x, y + .005, z, 1.8, .3)) continue;
      const e = { pos: new V(x, y + .002, z), vel: new V(), h: 1.8, onGround: true }; let ok = false;
      for (let f = 0; f < 250 && !ok; f++) { const dx = X[b] - e.pos.x, dz = Z[b] - e.pos.z, d = Math.hypot(dx, dz); if (d < .12) { ok = Math.abs(e.pos.y - H[b]) < .6; break; } step(e, dx / d, dz / d, Math.min(4.5, d * 10)); }
      if (!ok) return false;
    }
    return true;
  };
  let cut = 0;
  for (let a = 0; a < n; a++) for (let d = 0; d < 4; d++) { const b = L[a * 4 + d]; if (b < 0) continue; if (!walk(a, b)) { L[a * 4 + d] = -1; cut++; } }
  const nearest = (x, z, y) => { let best = -1, bd = Infinity; for (let i = 0; i < n; i++) { const dd = (X[i] - x) ** 2 + (Z[i] - z) ** 2 + (H[i] - y) ** 2; if (dd < bd) { bd = dd; best = i; } } return best; };
  const reach = new Uint8Array(n), queue = [nearest(map.t[0][0], map.t[0][1], map.t[0][3])]; reach[queue[0]] = 1;
  while (queue.length) { const a = queue.pop(); for (let d = 0; d < 4; d++) { const b = L[a * 4 + d]; if (b >= 0 && !reach[b]) { reach[b] = 1; queue.push(b); } } }
  const goals = map.ct.map(p => nearest(p[0], p[1], p[3])).concat(map.sites.map(s => nearest((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, s.y0)));
  if (!goals.every(g => reach[g])) throw Error(map.key + ': pruning the navigation disconnected a spawn or bombsite');
  nav.links = Buffer.from(L.buffer).toString('base64');
  map.report.navigationPruned = cut + followRoutes(map, step, V);
}

// The bots' own route search (breadth-first, same neighbour order as dmFindPath in index.html) from the attackers'
// spawn to the defenders' spawn and to every bombsite, followed continuously with the game's movement. Wherever the
// body stops (a cell that only just fits beside a slanted clip), that link is removed and the route is searched again.
function followRoutes(map, stepFn, V) {
  const native = new globalThis.SourceMaps.NativeMap(packMap(map)), nav = native.buildNav(1, 1), from = map.t[0];
  const targets = [map.ct[0], ...map.sites.map(s => [(s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, 0, NaN])];
  const bfs = (start, goal) => {
    const parent = new Int32Array(nav.x.length).fill(-2), queue = [start]; parent[start] = -1;
    for (let head = 0; head < queue.length && parent[goal] === -2; head++) { const id = queue[head]; for (let d = 0; d < 4; d++) { const next = nav.links[id * 4 + d]; if (next >= 0 && parent[next] === -2) { parent[next] = id; queue.push(next); } } }
    if (parent[goal] === -2) return null; const path = []; for (let id = goal; id !== start && id >= 0; id = parent[id]) path.push(id); return path.reverse();
  };
  const unlink = (a, b) => { for (let d = 0; d < 4; d++) { if (nav.links[a * 4 + d] === b) nav.links[a * 4 + d] = -1; if (nav.links[b * 4 + d] === a) nav.links[b * 4 + d] = -1; } };
  let cut = 0;
  const step = (e, wx, wz, maxS) => stepFn(e, wx, wz, maxS, native);
  for (const goal of targets) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const y0 = native.ground(from[0], from[1], from[3]), e = { pos: new V(from[0], y0, from[1]), vel: new V(), h: 1.8, onGround: true };
      const gy = Number.isFinite(goal[3]) ? goal[3] : native.ground(goal[0], goal[1]);
      const start = native.cell(nav, e.pos.x, e.pos.z, e.pos.y), end = native.cell(nav, goal[0], goal[1], gy), path = bfs(start, end);
      if (!path) throw Error(map.key + ': no route from the attackers to a goal after pruning');
      let stuck = -1, prev = start;
      for (const id of path) {
        let frames = 0;
        while (Math.hypot(nav.x[id] - e.pos.x, nav.z[id] - e.pos.z) > .12 && frames++ < 400) { const dx = nav.x[id] - e.pos.x, dz = nav.z[id] - e.pos.z, d = Math.hypot(dx, dz); step(e, dx / d, dz / d, 4.5); }
        if (frames >= 400) { stuck = id; break; }
        prev = id;
      }
      if (stuck < 0) break;
      unlink(prev, stuck); cut++;
    }
  }
  map.navigation.links = Buffer.from(nav.links.buffer, nav.links.byteOffset, nav.links.byteLength).toString('base64');
  return cut;
}
