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
  if(nav.audit.spawnsConnected!==nav.audit.spawnsTotal)throw Error(map.key+': some source spawns are disconnected');
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
