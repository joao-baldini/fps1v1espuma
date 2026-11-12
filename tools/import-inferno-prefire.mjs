import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Source2Gltf } from './source2-gltf.mjs';
import { packMap } from './import-source-maps.mjs';
import '../assets/maps/runtime.js';

const SCALE=.0254,CENTER=[1300,2200,64];
// Source coordinates: only Banana, B and the CT route up to the parked APC/truck.
const REGIONS=[[-260,780,1050,2220],[-120,2100,1170,3380],[980,2400,2850,3040],[2100,2090,2850,2790]];
const START=[-60,880,55],SPOTS=[
  ['Logs',65,1430,114,180,1280],['Canto da Banana',367,1692,128,200,1450],
  ['Meia parede',394,1802,132,300,1650],['Sandbags',800,1900,140,330,1700],
  ['Car',450,2100,140,450,1850],['Topo da Banana',850,2210,144,650,2030],
  ['Primeiras caixas',560,2550,168,790,2390],['Segundas caixas',170,2640,168,700,2500],
  ['Fonte',380,2960,168,700,2520],['Dark',35,3080,168,650,2600],
  ['New box',340,3150,168,600,2600],['Coffins',560,3000,168,400,2700],
  ['CT',900,2700,137,700,2570],['Passagem CT',1450,2820,136,950,2750],
  ['Truck',2320,2490,133,1700,2700],
];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/(Math.hypot(...a)||1));
const convert=p=>[(p[0]-CENTER[0])*SCALE,(p[2]-CENTER[2])*SCALE,-(p[1]-CENTER[1])*SCALE],key=p=>p.map(v=>Math.round(v*10000)).join(',');
const encode=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
function rectangles(){
  const ys=[...new Set(REGIONS.flatMap(r=>[r[1],r[3]]))].sort((a,b)=>a-b),out=[];
  for(let i=1;i<ys.length;i++){const y=(ys[i-1]+ys[i])/2,intervals=REGIONS.filter(r=>y>r[1]&&y<r[3]).map(r=>[r[0],r[2]]).sort((a,b)=>a[0]-b[0]),merged=[];
    for(const r of intervals){const last=merged.at(-1);if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push(r.slice());}
    for(const [x0,x1]of merged)out.push([x0,ys[i-1],x1,ys[i]]);
  }return out;
}
function clip(vertices,axis,value,sign){const out=[];for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;if(da>=-1e-6)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}return out;}
function colour(name,p,n){
  if(/plastic/.test(name))return 0x4e83a0;
  if(/wood/.test(name))return 0x947858;
  if(/metal|bell/.test(name))return 0x667574;
  if(/grass/.test(name))return 0x7f8b57;
  if(/dirt/.test(name))return 0x9d9273;
  if(/glass/.test(name))return 0x90a9ae;
  if(n[1]>.7)return p[1]>6?0xa45e45:0xc9c6b8;
  if(/rock|concrete|tile/.test(name))return 0xb0ac99;
  // Warm plaster, brick and stone, selected by the original street/site side.
  return p[0]<-26&&p[2]>0?0xba8058:p[2]>0?0xd5b98b:0xc3b99e;
}
function mergeCoplanar(faces){
  const edges=new Map(),finished=[];
  const group=f=>f.mask+'|'+f.c+'|'+f.n.map(v=>Math.round(v*100000)).join(',')+'|'+Math.round(dot(f.n,f.p[0])*1000);
  for(let face of faces){
    let again=true;
    while(again){again=false;const g=group(face);
      for(let i=0;i<face.p.length;i++){
        const a=key(face.p[i]),b=key(face.p[(i+1)%face.p.length]),other=edges.get(g+'|'+b+'>'+a);
        if(!other||other.face.dead)continue;const f=other.face,j=other.edge;
        let p=Array.from({length:face.p.length},(_,k)=>face.p[(i+1+k)%face.p.length]).concat(Array.from({length:f.p.length-2},(_,k)=>f.p[(j+2+k)%f.p.length]));
        p=p.filter((v,k)=>Math.hypot(...cross(sub(v,p[(k+p.length-1)%p.length]),sub(p[(k+1)%p.length],v)))>1e-8);
        if(p.length<3||p.length>24||p.some((v,k)=>dot(cross(sub(p[(k+1)%p.length],v),sub(p[(k+2)%p.length],p[(k+1)%p.length])),face.n)<-1e-6))continue;
        f.dead=true;face={...face,p};again=true;break;
      }
    }
    finished.push(face);const g=group(face);for(let i=0;i<face.p.length;i++)edges.set(g+'|'+key(face.p[i])+'>'+key(face.p[(i+1)%face.p.length]),{face,edge:i});
  }return finished.filter(f=>!f.dead);
}
function surfaceHull(face){
  // Walkable triangles form downward columns. Normal extrusions produce slanted
  // internal edge planes that can snag a capsule crossing two terrain triangles.
  if(face.n[1]>.69){
    const low=Math.min(...face.p.map(p=>p[1]))-.4,planes=[[...face.n,dot(face.n,face.p[0])],[0,-1,0,-low]];
    for(let i=0;i<face.p.length;i++){const a=face.p[i],b=face.p[(i+1)%face.p.length],edge=unit(cross(sub(b,a),[0,1,0]));if(Math.hypot(...edge)>.9)planes.push([...edge,dot(edge,a)]);}
    return {planes,min:[Math.min(...face.p.map(p=>p[0])),low,Math.min(...face.p.map(p=>p[2]))],max:[0,1,2].map(i=>Math.max(...face.p.map(p=>p[i]))),mask:face.mask|4};
  }
  const n=face.n,d=dot(n,face.p[0]),bottom=face.p.map(p=>sub(p,mul(n,.025))),points=face.p.concat(bottom),planes=[[...n,d],[...mul(n,-1),-d+.025]];
  for(let i=0;i<face.p.length;i++){const a=face.p[i],b=face.p[(i+1)%face.p.length],edge=unit(cross(sub(b,a),n));if(Math.hypot(...edge)>.9)planes.push([...edge,dot(edge,a)]);}
  return {planes,min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))),mask:face.mask};
}
function bake(map){
  const native=new SourceMaps.NativeMap(packMap(map)),nav=native.buildNav(map.ax,map.az),X=id=>nav.minX+(id%nav.w)*nav.step,Z=id=>nav.minZ+Math.floor((id%nav.plane)/nav.w)*nav.step;
  const spots=[];
  for(const [name,x,y,z,aimX,aimY]of SPOTS){
    const wanted=convert([x,y,z]);let best=-1,score=Infinity;
    for(const id of nav.walk){const xx=X(id),zz=Z(id),yy=nav.height[id],dy=Math.abs(yy-wanted[1]);if(dy>1||native.overlap(xx,yy+.005,zz,1.8,.3))continue;const d=(xx-wanted[0])**2+(zz-wanted[2])**2+dy*dy;if(d<score){score=d;best=id;}}
    if(best<0||score>16)throw Error('No reachable floor at '+name+' ('+score+')');
    const p=[X(best),nav.height[best],Z(best)],aim=convert([aimX,aimY,z]),yaw=Math.atan2(p[0]-aim[0],p[2]-aim[2]);
    spots.push({name,x:p[0],y:p[1],z:p[2],yaw,source:[p[0]/SCALE+CENTER[0],CENTER[1]-p[2]/SCALE,p[1]/SCALE+CENTER[2]]});
  }
  const start=map.t[0];start[3]=native.ground(start[0],start[1],start[3]);
  if(native.overlap(start[0],start[3]+.005,start[1],1.8,.3))throw Error('Prefire spawn intersects geometry');
  for(const spot of spots)for(const height of [.7,1.2,1.65])for(const side of [-.25,0,.25]){
    const eye=[spot.x,spot.y+1.62,spot.z],delta=[start[0]+side-eye[0],start[3]+height-eye[1],start[1]-eye[2]],distance=Math.hypot(...delta),hit=native.ray(eye,mul(delta,1/distance),distance);
    if(!hit||hit.t>distance-.01)throw Error(spot.name+' has line of sight to the protected spawn');
  }
  map.report.spawnProtected=true;
  const lookup=new Int32Array(nav.open.length).fill(-1);nav.walk.forEach((id,i)=>lookup[id]=i);const links=[];for(const id of nav.walk)for(let d=0;d<4;d++){const next=nav.links[id*4+d];links.push(next<0?-1:lookup[next]);}
  nav.audit.spawnsConnected=nav.audit.spawnsTotal=spots.length+1;
  nav.audit.regions[0].spawns=spots.length+1;
  map.navigation={step:nav.step,minX:nav.minX,minZ:nav.minZ,w:nav.w,h:nav.h,x:encode(Float32Array.from(nav.walk,X)),z:encode(Float32Array.from(nav.walk,Z)),height:encode(Float32Array.from(nav.walk,id=>nav.height[id])),links:encode(new Int32Array(links)),audit:nav.audit};
  map.prefire={spawn:map.t[0],spots};map.ct=spots.map(s=>[s.x,s.z,s.yaw,s.y]);map.report.navigation=nav.audit;
  map.playBounds=[Math.min(...nav.walk.map(X)),Math.min(...nav.walk.map(Z)),Math.max(...nav.walk.map(X)),Math.max(...nav.walk.map(Z))];
}

const [input,vpk]=process.argv.slice(2);if(!input)throw Error('Usage: node tools/import-inferno-prefire.mjs <collision_physics.gltf> [de_inferno.vpk]');
const source=new Source2Gltf(resolve(input)),regions=rectangles(),faces=[],seen=new Set();let sourceTriangles=0;
for(const triangle of source.physicsTriangles()){
  sourceTriangles++;const mask=/playerclip/.test(triangle.material)?1:3;
  for(const [x0,y0,x1,y1]of regions){
    let p=triangle.p;if(p.every(p=>p[0]<x0)||p.every(p=>p[0]>x1)||p.every(p=>p[1]<y0)||p.every(p=>p[1]>y1)||p.every(p=>p[2]<-128)||p.every(p=>p[2]>800))continue;
    for(const [axis,value,sign]of [[0,x0,1],[0,x1,-1],[1,y0,1],[1,y1,-1],[2,-128,1],[2,800,-1]]){p=clip(p,axis,value,sign);if(p.length<3)break;}
    if(p.length<3)continue;p=p.map(convert);const n=unit(cross(sub(p[1],p[0]),sub(p[2],p[0])));if(Math.hypot(...n)<.9)continue;
    const hash=mask+'|'+p.map(key).sort().join(';');if(seen.has(hash))continue;seen.add(hash);
    faces.push({p,n,c:colour(triangle.material,p[0],n),mask,glass:/glass/.test(triangle.material),tag:'native-physics'});
  }
}
// Seal only the exterior edges of the rectangular union; keep every internal route open.
const xs=[...new Set(REGIONS.flatMap(r=>[r[0],r[2]]))].sort((a,b)=>a-b),ys=[...new Set(REGIONS.flatMap(r=>[r[1],r[3]]))].sort((a,b)=>a-b);
const inside=(x,y)=>REGIONS.some(r=>x>r[0]&&x<r[2]&&y>r[1]&&y<r[3]);
for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
  const [x0,x1,y0,y1]=[xs[i-1],xs[i],ys[j-1],ys[j]];
  if(!inside((x0+x1)/2,(y0+y1)/2))continue;
  for(const [a,b,out]of [[[x0,y0],[x1,y0],[0,-1]],[[x1,y0],[x1,y1],[1,0]],[[x1,y1],[x0,y1],[0,1]],[[x0,y1],[x0,y0],[-1,0]]]){
    if(inside((a[0]+b[0])/2+out[0],(a[1]+b[1])/2+out[1]))continue;
    const p=[[...a,-128],[...a,800],[...b,800],[...b,-128]].map(convert),n=unit(cross(sub(p[1],p[0]),sub(p[2],p[0])));
    faces.push({p,n,c:0x9b8668,mask:3,tag:'course-boundary'});
  }
}
const merged=mergeCoplanar(faces),spawnPoint=convert(START),startAim=convert([150,920,85]),spawn=[spawnPoint[0],spawnPoint[2],Math.atan2(spawnPoint[0]-startAim[0],spawnPoint[2]-startAim[2]),spawnPoint[1]],bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
for(const f of merged)for(const p of f.p)for(let i=0;i<3;i++){bounds[i]=Math.min(bounds[i],p[i]);bounds[i+3]=Math.max(bounds[i+3],p[i]);}
const map={key:'inferno',surfaceCollision:true,name:'Inferno · Prefire',scale:SCALE,center:CENTER,bounds,ax:Math.ceil(Math.max(Math.abs(bounds[0]),Math.abs(bounds[3]))+1),az:Math.ceil(Math.max(Math.abs(bounds[2]),Math.abs(bounds[5]))+1),playBounds:[bounds[0],bounds[2],bounds[3],bounds[5]],t:[spawn],ct:[],sites:[],ladders:[],polygons:merged.filter(f=>f.mask===3),hulls:merged.map(surfaceHull),report:{sourceSha256:createHash('sha256').update(readFileSync(resolve(vpk||input))).digest('hex'),sourceTriangles,clippedPolygons:faces.length,mergedPolygons:merged.length,source:'User-supplied de_inferno_cs2.4.rar / de_inferno.vpk',regions:REGIONS}};
// Keep the 0.7 m navigation grid anchored when extending the crop towards T Ramp.
// Integer extents grow in 7 m chunks, preserving the previously validated cells.
map.az=32+7*Math.ceil((map.az-32)/7);
bake(map);const packed=packMap(map),compressed=gzipSync(Buffer.from(JSON.stringify(packed)),{level:9}),out=resolve(import.meta.dirname,'../assets/maps');
writeFileSync(resolve(out,'inferno.js'),'// Generated, clipped Source 2 physics. Flat colours only, no Source runtime or textures.\n(globalThis.SOURCE_MAP_PAYLOADS??={}).inferno='+JSON.stringify(compressed.toString('base64'))+';\n');
writeFileSync(resolve(out,'prefire-catalog.js'),'// Prefire metadata only; geometry is lazy loaded.\nglobalThis.INFERNO_PREFIRE='+JSON.stringify({name:map.name,ax:map.ax,az:map.az,...map.prefire})+';\n');
writeFileSync(resolve(out,'inferno-source.json'),JSON.stringify({...map.report,bounds:map.bounds,triangles:Buffer.from(packed.mesh.index,'base64').length/12,hulls:map.hulls.length,assetBytes:compressed.length,...map.prefire},null,2)+'\n');
console.log(JSON.stringify({triangles:Buffer.from(packed.mesh.index,'base64').length/12,hulls:map.hulls.length,bytes:compressed.length,navigation:map.report.navigation,spots:map.prefire.spots.map(s=>({name:s.name,source:s.source}))},null,2));
