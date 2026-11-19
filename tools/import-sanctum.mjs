// Independent Sanctum rebuild. Read the supplied BSP, never the previous sanctum.js.
// Runtime output contains only flat-colour geometry, convex collision and baked navigation.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {compileSourceMap,rotation} from './source-bsp.mjs';
import {packMap,bakeNavigation} from './import-source-maps.mjs';
import {readNav} from './source-nav.mjs';
import {subtractBox} from './convex-cut.mjs';
import '../assets/maps/runtime.js';

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const C={stone:0xb6b2a5,wall:0xb7b8ad,brick:0xa79b88,wood:0x997c59,edge:0x6c5842,metal:0x778482,barrel:0x758575,leaves:0x69815b,trunk:0x78624d,hay:0xc5af75,cloth:0xb5ad95,vehicle:0x7e898c};
const bounds=points=>[...[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),...[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))];

function architectureColor(face){
  const m=face.material||'';
  if(/glass|window/.test(m))return 0xa6bdc4;
  if(/grass|dirt|blend|mud/.test(m))return 0xa0a384;
  if(/roof|shingle/.test(m))return 0x8e7760;
  if(/wood|plywood/.test(m))return /white|ext_a03/.test(m)?0xb4b8b1:C.wood;
  if(/metal|grate|manhole/.test(m))return C.metal;
  if(/brick/.test(m))return /ground/.test(m)?0xc3bbae:C.brick;
  if(/stone|tile/.test(m))return C.stone;
  return face.n[1]>.7?0xcdcec3:C.wall;
}

// Every part uses the authored model origin, angles and scale, including props lying on their side.
// Box dimensions are in Source units. Visual detailing never enlarges the collision envelope.
export function sanctumPropParts(model){
  const box=(size,color=C.wood,center=[0,0,size[2]/2],solid=true)=>({size,color,center,solid});
  const cylinder=(r,h,color=C.barrel,z=0)=>({ring:true,r,h,color,z,solid:true});
  const crate=(size)=>{
    const [x,y,z]=size,out=[box(size)];
    for(const h of [3,z-3])out.push(box([x+.5,y+.5,5],C.edge,[0,0,h],false));
    return out;
  };
  const pallet=()=>[box([64,48,10],C.wood),...[-19,0,19].map(y=>box([64,7,3],C.edge,[0,y,10.5],false))];
  const m=model.toLowerCase();
  if(/skybox|grass01|debris|flat_stones|paint_roller|wall_trim|swamp_grass|caseofbeer|grenade_box|floor_rubble|tile_set|wall_hole/.test(m))return [];
  const dims=m.match(/crate[^/]*?(\d+)x(\d+)x(\d+)/);
  if(dims)return crate(dims.slice(1).map(Number));
  if(/crate_assembly/.test(m)){
    if(/tarp/.test(m))return []; // Separate overlay at the same origin; the assembly already contains the cover.
    return [...crate([100,100,96]),box([102,103,2],0x879085,[0,0,97],false)];
  }
  if(/wine_crate/.test(m))return crate([64,64,61]);
  if(/weapon_crate/.test(m))return crate([64,40,30]);
  if(/shell_pallet|coop_wooden_pallet|pallet_01/.test(m))return pallet();
  if(/pallet_stack/.test(m))return [box([64,48,30]),...pallet().map(p=>({...p,center:p.center.map((v,i)=>i===2?v+24:v),solid:false}))];
  if(/bomb_shells/.test(m))return [box([60,44,48],0x7d7f64),box([62,46,4],C.edge,[0,0,46],false)];
  if(/bomb_tanks|processor_tank/.test(m))return [-22,22].map(x=>({...cylinder(19,78,C.metal),centerX:x}));
  if(/wine_barrel/.test(m))return [cylinder(22,43,C.wood)];
  if(/barrel|drum/.test(m))return [cylinder(16,44),... [4,36].map(z=>({...cylinder(16.5,3,C.metal,z),solid:false}))];
  if(/hedge_(\d+)_(\d+)/.test(m)){const d=m.match(/hedge_(\d+)_(\d+)/);return [box([+d[1],36,+d[2]],C.leaves)];}
  if(/cypress/.test(m))return [cylinder(6,38,C.trunk),{foliage:true,r:31,h:260,z:25,color:C.leaves,solid:false}];
  if(/tree/.test(m))return [cylinder(9,145,C.trunk),{foliage:true,r:94,h:130,z:120,color:C.leaves,solid:false}];
  if(/bush/.test(m))return [{foliage:true,r:34,h:48,z:0,color:C.leaves,solid:false}];
  if(/hay_bale/.test(m))return [box([64,32,32],C.hay)];
  if(/concrete_bags_stack/.test(m))return [box([60,44,22],C.cloth)];
  if(/concrete_bag/.test(m))return [box([29,17,9],C.cloth)];
  if(/plywood.*stack|construction_stack|wood_pile/.test(m))return [box([96,48,24]),box([97,49,2],C.edge,[0,0,23],false)];
  if(/plywood/.test(m))return [box([48,2,96],C.wood)];
  if(/nuclearcontainer/.test(m))return [box([64,64,64],C.metal)];
  if(/swat_van/.test(m))return [box([200,80,50],C.vehicle,[0,0,35]),box([120,76,35],C.vehicle,[15,0,77.5])];
  if(/truck.*trailer/.test(m))return [box([380,94,105],0xa9aca7,[0,0,64])];
  if(/truck/.test(m))return [box([240,94,38],C.vehicle,[0,0,36]),box([75,90,66],C.vehicle,[-72,0,88])];
  if(/chainlink_fence_cover/.test(m))return [box([64,2,64],0x80918c)];
  if(/fence|gate/.test(m)){
    const width=/002b/.test(m)?64:/002c/.test(m)?128:256;
    return [{...box([width,2,112],C.metal,[0,0,56]),colliderOnly:true,mask:1},...[-width/2,width/2].map(x=>box([4,4,116],C.metal,[x,0,58])),...[0,56,112].map(z=>box([width,2,1],C.metal,[0,0,z],false)),...Array.from({length:Math.floor(width/16)},(_,i)=>box([.6,.6,112],C.metal,[-width/2+8+i*16,0,56],false))];
  }
  if(/scaffolding_walkway|walkway_platform/.test(m))return [box([128,96,6],C.wood,[0,0,0])];
  if(/scaffolding_end/.test(m))return [-43,43].map(y=>box([4,4,128],C.metal,[0,y,64]));
  if(/wood_scaffold|aztec_scaffolding/.test(m))return [box([116,32,6],C.wood,[0,0,96]),...[-52,52].map(x=>box([6,6,96],C.wood,[x,0,48]))];
  if(/ladder/.test(m))return [...[-10,10].map(x=>box([3,4,128],C.metal,[x,0,64],false)),...[16,40,64,88,112].map(z=>box([20,3,3],C.metal,[0,0,z],false))];
  if(/rockwall/.test(m))return [box([128,32,96],C.stone)];
  if(/rocka|militiarock/.test(m))return [{foliage:true,r:50,h:50,z:0,color:C.stone,solid:true}];
  if(/door/.test(m))return [box([/89x106/.test(m)?89:80,4,/89x106/.test(m)?106:128],C.wood)];
  if(/table/.test(m))return [box([64,34,4],C.wood,[0,0,30]),...[-26,26].flatMap(x=>[-12,12].map(y=>box([4,4,28],C.edge,[x,y,14])))];
  if(/shelves/.test(m))return [box([56,18,76],C.metal)];
  if(/toolchest|signalbox|hvac_controller/.test(m))return [box([40,24,48],C.metal)];
  if(/tirestack/.test(m))return [cylinder(18,48,0x525957)];
  if(/cart/.test(m))return [box([60,32,35],C.metal)];
  if(/metal_panel.*64x128/.test(m))return [box([64,3,128],C.metal)];
  if(/duct.*128/.test(m))return [box([128,30,30],C.metal)];
  if(/planter/.test(m))return [box([40,16,14],C.stone)];
  return [];
}

function facesForPart(part){
  if(part.ring||part.foliage){
    const n=8,z=part.z||0,r=part.r,top=part.foliage?r*.16:r;
    const lo=Array.from({length:n},(_,i)=>[Math.cos(i*Math.PI*2/n)*r,Math.sin(i*Math.PI*2/n)*r,z]);
    const hi=lo.map(p=>[p[0]*top/r,p[1]*top/r,z+part.h]);
    const rings=[lo,hi];
    if(part.foliage)rings.splice(1,0,lo.map(p=>[p[0]*1.05,p[1]*1.05,z+part.h*.25]));
    const out=[lo.slice().reverse(),hi];for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++)out.push([rings[j][i],rings[j][(i+1)%n],rings[j+1][(i+1)%n],rings[j+1][i]]);
    return out.map(f=>f.map(p=>[p[0]+(part.centerX||0),p[1],p[2]]));
  }
  const [a,b,c]=part.size.map(v=>v/2),v=[[-a,-b,-c],[a,-b,-c],[a,b,-c],[-a,b,-c],[-a,-b,c],[a,-b,c],[a,b,c],[-a,b,c]];
  return [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(f=>f.map(i=>v[i].map((x,j)=>x+part.center[j])));
}

export function rebuildSanctum(file,{bake=true}={}){
  const map=compileSourceMap(file,'sanctum',{materialNames:true});map.name='Sanctum';map.credit='alicate madeira 4';
  const report=map.report;report.rebuild={version:2,method:'Fresh BSP geometry plus independently rebuilt lightweight props',externalModelsEmbedded:0,standardGameGrid:true,props:[],omitted:[]};
  for(const face of map.polygons){face.c=architectureColor(face);delete face.material;}
  const navName=[...map.bsp.pak.keys()].find(n=>n.endsWith('.nav')),authoredNav=readNav(map.bsp.asset(navName));
  const sourceToWorld=p=>map.convert(p),props=map.bsp.staticProps();
  const corridors=[];
  for(const p of map.t.concat(map.ct))corridors.push({lo:[p[0]-.8,-1000,p[1]-.8],hi:[p[0]+.8,1000,p[1]+.8],floor:p[3]-.3});
  report.rebuild.spawnClearanceVolumes=corridors.length;report.rebuild.carvedParts=0;report.rebuild.settled=0;
  // Assentar caixotes, barris e paletes: de baixo para cima, cada um desce (ou sobe um pouco) até o chão visível ou até
  // o topo do objeto já assentado embaixo, para nada ficar flutuando nem afundado.
  const support=new globalThis.SourceMaps.NativeMap(packMap({...map,hulls:map.hulls.filter(h=>h.mask&2)})),placed=[];
  const SETTLE=/crate|barrel|drum|pallet|hay_bale|concrete_bag|plywood.*stack|construction_stack|wood_pile|nuclearcontainer|tirestack/;
  const order=[...props.entries()].sort((a,b)=>a[1].origin[2]-b[1].origin[2]);
  for(const [index,prop]of order){
    const parts=sanctumPropParts(prop.model);if(!parts.length){report.rebuild.omitted.push({index,model:prop.model});continue;}
    const rot=rotation(prop.angles),xf=p=>sourceToWorld(rot(p.map(v=>v*prop.scale)).map((v,i)=>v+prop.origin[i]));
    if(SETTLE.test(prop.model)){
      const solidPoints=()=>parts.filter(p=>p.solid).flatMap(p=>facesForPart(p).flat().map(xf));
      let pts=solidPoints();
      if(pts.length){
        const bb=bounds(pts),cx=(bb[0]+bb[3])/2,cz=(bb[2]+bb[5])/2,bottom=bb[1];
        let top=support.ground(cx,cz,bottom-.3);
        for(const b of placed)if(cx>=b.x0&&cx<=b.x1&&cz>=b.z0&&cz<=b.z1&&b.top<=bottom+.25&&b.top>top)top=b.top;
        const gap=bottom-top;
        if(top>-1e3&&((gap>.015&&gap<3.5)||(gap<-.015&&gap>-.45))){prop.origin=[prop.origin[0],prop.origin[1],prop.origin[2]-gap/map.scale];report.rebuild.settled++;pts=solidPoints();}
        const b2=bounds(pts);placed.push({x0:b2[0],x1:b2[3],z0:b2[2],z1:b2[5],top:b2[4]});
      }
    }
    const entry={index,model:prop.model,origin:prop.origin,angles:prop.angles,scale:prop.scale,parts:parts.length,solidParts:0};
    const propBounds=bounds(parts.flatMap(p=>facesForPart(p).flat().map(xf)));
    const cuts=corridors.filter(c=>propBounds[4]>c.floor+.5&&propBounds[1]<c.floor+1.8);
    for(const part of parts){
      const faces=facesForPart(part).map(f=>f.map(xf));let pieces=[faces];
      // Preserve every original spawn. Missing stock meshes have simplified envelopes, so trim only a spawn
      // clearance that overlaps a reconstructed prop; cut the visible surface and collider together.
      if(!part.foliage&&prop.solid)for(const c of cuts)pieces=pieces.flatMap(f=>subtractBox(f,c.lo,c.hi));
      if(pieces.length!==1||JSON.stringify(pieces[0])!==JSON.stringify(faces))report.rebuild.carvedParts++;
      for(const piece of pieces){
        const bb=bounds(piece.flat()),planes=[];
        for(const p of piece){const n=cross(sub(p[1],p[0]),sub(p[2],p[0])),len=Math.hypot(...n);if(len<1e-9)continue;for(let i=0;i<3;i++)n[i]/=len;planes.push([...n,dot(n,p[0])]);if(!part.colliderOnly)map.polygons.push({p,n,c:part.color,tag:'reconstructed-prop'});}
        if(part.solid&&prop.solid){map.hulls.push({planes,min:bb.slice(0,3),max:bb.slice(3),mask:part.mask||3});entry.solidParts++;}
      }
    }
    report.rebuild.props.push(entry);
  }
  // Preserve the authored spatial extent instead of cropping the buildings to a coarse navigation component.
  map.bounds=bounds(map.polygons.flatMap(f=>f.p));
  if(!bake)return map;
  bakeNavigation(map);
  const native=new globalThis.SourceMaps.NativeMap(packMap(map));
  for(const p of map.t.concat(map.ct)){
    const y=native.ground(p[0],p[1],p[3]);if(!Number.isFinite(y)||native.overlap(p[0],y+.01,p[1],1.8,.3))throw Error('Blocked source spawn');p[3]=y;
  }
  report.rebuild.originalNavAreas=authoredNav.areas.length;
  report.rebuild.preservedWorldFaces=report.worldFaces;
  delete map.bsp;delete map.convert;return map;
}

if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
  if(process.argv.length!==3)throw Error('Usage: node tools/import-sanctum.mjs <wg_sanctum.bsp>');
  const map=rebuildSanctum(resolve(process.argv[2])),packed=packMap(map),data=gzipSync(Buffer.from(JSON.stringify(packed)),{level:9});
  const out=resolve(import.meta.dirname,'../assets/maps');
  writeFileSync(resolve(out,'sanctum.js'),'// Sanctum rebuilt directly from the supplied BSP: flat game materials, independent props, no Source assets.\n(globalThis.SOURCE_MAP_PAYLOADS??={}).sanctum='+JSON.stringify(data.toString('base64'))+';\n');
  const catalogSource=readFileSync(resolve(out,'catalog.js'),'utf8'),catalog=JSON.parse(catalogSource.match(/SOURCE_MAP_CATALOG=(.*);/)[1]);
  catalog.sanctum={name:map.name,credit:map.credit,ax:map.ax,az:map.az,t:map.t,ct:map.ct,sites:map.sites};
  writeFileSync(resolve(out,'catalog.js'),'// Metadata only: the geometry is loaded when a map is played.\nglobalThis.SOURCE_MAP_CATALOG='+JSON.stringify(catalog)+';\n');
  const audit={...map.report,sourceFile:'wg_sanctum.bsp',center:map.center,scale:map.scale,bounds:map.bounds,playBounds:map.playBounds,ax:map.ax,az:map.az,spawns:{t:map.t,ct:map.ct},sites:map.sites,triangles:Buffer.from(packed.mesh.index,'base64').length/12,collisionHulls:Buffer.from(packed.collision.masks,'base64').length,assetBytes:data.length};
  writeFileSync(resolve(out,'sanctum-source.json'),JSON.stringify(audit,null,2)+'\n');
  console.log(JSON.stringify({triangles:audit.triangles,bytes:data.length,hulls:audit.collisionHulls,nav:map.report.navigation,props:map.report.rebuild.props.length}));
}
