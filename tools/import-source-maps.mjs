import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { compileSourceMap } from './source-bsp.mjs';
import '../assets/maps/runtime.js';

const encode = array => Buffer.from(array.buffer,array.byteOffset,array.byteLength).toString('base64');
export function packMap(map) {
  const p=[],n=[],c=[],indices=[],transparent=[],known=new Map();
  for(const face of map.polygons){
    const rgb=[(face.c>>16)&255,(face.c>>8)&255,face.c&255],ids=face.p.map(v=>{
      const key=v.concat(face.n).map(v=>Math.round(v*1e6)).concat(rgb).join(',');let id=known.get(key);
      if(id===undefined){id=p.length/3;known.set(key,id);p.push(...v);n.push(...face.n);c.push(...rgb);}return id;
    });
    const out=face.glass?transparent:indices;
    for(let i=1;i<ids.length-1;i++)out.push(ids[0],ids[i],ids[i+1]);
  }
  const planes=[],offsets=[0],b=[],masks=[];
  for(const h of map.hulls){if(h.planes.length<4)continue;for(const plane of h.planes)planes.push(...plane);offsets.push(planes.length/4);b.push(...h.min,...h.max);masks.push(h.mask);}
  const opaque=indices.length;for(const i of transparent)indices.push(i);
  const meta={key:map.key,name:map.key==='guard'?'Guard':'Elysion',scale:map.scale,center:map.center,bounds:map.bounds,ax:map.ax,az:map.az,playBounds:map.playBounds,t:map.t,ct:map.ct,sites:map.sites,ladders:map.ladders,sourceSha256:map.report.sourceSha256};
  return {version:1,meta,mesh:{position:encode(new Float32Array(p)),normal:encode(new Float32Array(n)),color:encode(new Uint8Array(c)),index:encode(new Uint32Array(indices)),opaque},collision:{planes:encode(new Float32Array(planes)),offsets:encode(new Uint32Array(offsets)),bounds:encode(new Float32Array(b)),masks:encode(new Uint8Array(masks))},...(map.navigation?{navigation:map.navigation}:{})};
}

function bakeNavigation(map){
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

// The supplied CSS port adds a B trigger in the lounge. The reference is Wingman:
// keep that room as a passage, retain A only, and discard the exterior building shell.
function elysionWingman(map){
  const before={polygons:map.polygons.length,hulls:map.hulls.length,sites:map.sites.length,spawns:map.t.length+map.ct.length};
  const [x0,z0,x1,z1]=map.playBounds,margin=1,lo=[x0-margin,-2,z0-margin],hi=[x1+margin,12,z1+margin];
  const clip=(vertices,axis,value,sign)=>{
    const out=[];
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i],b=vertices[(i+1)%vertices.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;
      if(da>=-1e-7)out.push(a);
      if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((v,j)=>v+(b[j]-v)*t));}
    }return out;
  };
  map.polygons=map.polygons.flatMap(face=>{
    let p=face.p;for(let axis=0;axis<3;axis++){p=clip(p,axis,lo[axis],1);if(p.length<3)return [];p=clip(p,axis,hi[axis],-1);if(p.length<3)return [];}
    return [{...face,p}];
  });
  map.hulls=map.hulls.filter(h=>h.min.every((v,i)=>v<=hi[i])&&h.max.every((v,i)=>v>=lo[i]));
  for(const h of map.hulls)for(let axis=0;axis<3;axis++){
    h.min[axis]=Math.max(h.min[axis],lo[axis]);h.max[axis]=Math.min(h.max[axis],hi[axis]);
    const positive=[0,0,0,hi[axis]],negative=[0,0,0,-lo[axis]];positive[axis]=1;negative[axis]=-1;h.planes.push(positive,negative);
  }
  map.sites=map.sites.filter(s=>s.name==='A');
  // Select actual BSP spawn points in the green rooms shown in the reference,
  // rather than inventing positions or spawning in the reception's far corner.
  const ref=p=>[303+(p[0]-x0)*410/(x1-x0),82+(p[1]-z0)*492/(z1-z0)];
  const room=(starts,box)=>starts.filter(p=>{const [x,y]=ref(p);return x>=box[0]&&x<=box[2]&&y>=box[1]&&y<=box[3];});
  map.t=room(map.t,[347,516,417,575]);map.ct=room(map.ct,[381,81,462,119]);
  if(map.t.length<2||map.ct.length<2||map.sites.length!==1)throw Error('Invalid Elysion Wingman selection');
  map.bounds=[...lo,...hi];delete map.navigation;
  map.report.wingman={site:'A',reference:'User-supplied Elysion Wingman loading screen',lounge:'Retained as a passage, without the CSS port B trigger',before,clipBounds:[...lo,...hi],spawns:map.t.length+map.ct.length,polygons:map.polygons.length,hulls:map.hulls.length};
}

if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
  const args=process.argv.slice(2);if(args.length!==2)throw Error('Usage: node tools/import-source-maps.mjs <de_guard_csgo.bsp> <de_elysion.bsp>');
  const out=resolve(import.meta.dirname,'../assets/maps');mkdirSync(out,{recursive:true});
  const catalog={};
  for(const [i,key] of ['guard','elysion'].entries()){
    const map=compileSourceMap(resolve(args[i]),key);bakeNavigation(map);if(key==='elysion'){elysionWingman(map);bakeNavigation(map);}const packed=packMap(map),bytes=gzipSync(Buffer.from(JSON.stringify(packed)),{level:9});
    catalog[key]={name:packed.meta.name,ax:map.ax,az:map.az,t:map.t,ct:map.ct,sites:map.sites};
    writeFileSync(resolve(out,key+'.js'),'// Generated from the user-supplied BSP. No materials, textures, sounds or Source runtime.\n(globalThis.SOURCE_MAP_PAYLOADS??={}).'+key+'='+JSON.stringify(bytes.toString('base64'))+';\n');
    writeFileSync(resolve(out,key+'-source.json'),JSON.stringify({...map.report,sourceFile:args[i].replaceAll('\\','/').split('/').at(-1),center:map.center,scale:map.scale,bounds:map.bounds,playBounds:map.playBounds,ax:map.ax,az:map.az,spawns:{t:map.t,ct:map.ct},sites:map.sites,vertices:Buffer.from(packed.mesh.position,'base64').length/12,triangles:Buffer.from(packed.mesh.index,'base64').length/12,collisionHulls:Buffer.from(packed.collision.masks,'base64').length,assetBytes:bytes.length},null,2)+'\n');
    console.log(key,bytes.length+' bytes gzipped',map.polygons.reduce((s,p)=>s+p.p.length-2,0)+' triangles',map.hulls.length+' hulls');
  }
  writeFileSync(resolve(out,'catalog.js'),'// Metadata only: the geometry is loaded when a map is played.\nglobalThis.SOURCE_MAP_CATALOG='+JSON.stringify(catalog)+';\n');
}
