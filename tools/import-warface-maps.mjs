import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Gltf} from './gltf.mjs';
import {packMap} from './import-source-maps.mjs';
import '../assets/maps/runtime.js';

const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=v=>v.map(x=>x/(Math.hypot(...v)||1));
const encode=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
// Escala [horizontal, vertical] aplicada depois das transformações do GLB. Palace mantém 1,25 em tudo. O Factory 5v5
// (guilhxrme e João) usa 1,5 na horizontal e a altura original do modelo: corredores com folga para 5v5 e paredes,
// caixas e contêineres na proporção do jogador (paredes ~4,5 m, caixas 2 m), sem o efeito de "cânion" do 1,25 uniforme.
const MODEL_SCALE=1.25;
const CONFIG={
  palace:{name:'Palace',scale:[MODEL_SCALE,MODEL_SCALE],floor:-2.63194,t:[-8,12],ct:[1,-22],sites:[[-23,-12],[6,-3]],palette:[0xc9c9bb,0xa9a698,0x657348,0x477a9c,0x70a4b3,0x80684e]},
  factory:{name:'Factory',scale:[1.5,1],floor:-.184,t:[0,16],ct:[-3,-8],sites:[[-7,-12],[7,-12]],palette:[0x9a6650,0xc4c3b5,0xc5a053,0x825749,0x51778b]},
};
function hull(face){
  const {p,n}=face,walk=n[1]>.69,low=Math.min(...p.map(p=>p[1]))-.25,back=p.map(p=>p.map((v,i)=>v-n[i]*.035)),planes=[[...n,dot(n,p[0])],walk?[0,-1,0,-low]:[...n.map(v=>-v),-dot(n,p[0])+.035]];
  for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],edge=unit(cross(sub(b,a),walk?[0,1,0]:n));if(Math.hypot(...edge)>.9)planes.push([...edge,dot(edge,a)]);}
  const points=walk?p.concat(p.map(p=>[p[0],low,p[2]])):p.concat(back);
  return {planes,min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))),mask:walk?7:3};
}
function compile(id,file){
  const cfg=CONFIG[id],input=new Gltf(file),raw=[...input.triangles()],rawBounds=[0,1,2].map(i=>Math.min(...raw.flatMap(f=>f.p.map(p=>p[i])))).concat([0,1,2].map(i=>Math.max(...raw.flatMap(f=>f.p.map(p=>p[i])))));
  const center=[(rawBounds[0]+rawBounds[3])/2,(rawBounds[2]+rawBounds[5])/2],[hs,vs]=cfg.scale,convert=([x,y,z])=>(id==='factory'?[z-center[1],y-cfg.floor,-x+center[0]]:[x-center[0],y-cfg.floor,z-center[1]]).map((v,i)=>v*(i===1?vs:hs));
  const polygons=[];
  for(const t of raw){const p=t.p.map(convert),n=unit(cross(sub(p[1],p[0]),sub(p[2],p[0])));if(Math.hypot(...n)<.9)continue;
    let c=cfg.palette[t.material];const height=p.reduce((s,p)=>s+p[1],0)/3;
    if(id==='palace'&&t.material===2&&height>1)c=0xd1cbb9;
    if(id==='palace'&&t.material===0&&n[1]>.69)c=0xc6c4b5;
    if(id==='factory'&&t.material===0){if(n[1]>.69)c=height<.5?0x999b93:0xbcbcaf;else if(height<1.7)c=0x7a827b;}
    polygons.push({p,n,c,glass:id==='palace'&&t.material===4,material:t.material});
  }
  const all=polygons.flatMap(f=>f.p),bounds=[0,1,2].map(i=>Math.min(...all.map(p=>p[i]))).concat([0,1,2].map(i=>Math.max(...all.map(p=>p[i]))));
  const spawn=(p,yaw)=>{const q=convert([p[0],cfg.floor,p[1]]);return [q[0],q[2],yaw,0];};
  const map={key:id,name:cfg.name,scale:cfg.scale,center,surfaceCollision:true,bounds,ax:Math.ceil(Math.max(Math.abs(bounds[0]),Math.abs(bounds[3]))+1),az:Math.ceil(Math.max(Math.abs(bounds[2]),Math.abs(bounds[5]))+1),playBounds:[bounds[0],bounds[2],bounds[3],bounds[5]],t:[spawn(cfg.t,0)],ct:[spawn(cfg.ct,Math.PI)],sites:[],ladders:[],polygons,hulls:polygons.map(hull),report:{sourceSha256:createHash('sha256').update(readFileSync(file)).digest('hex'),inputTriangles:raw.length,originalBounds:rawBounds,reference:id==='palace'?'https://ps.wfclutch.com/en/news/111.html':'https://store.steampowered.com/news/posts/?appids=291480&enddate=1532340210'}};
  // Repeated risers identify stairs. Add movement-only walk slopes above the visible
  // steps; keep the authored mesh and bullet collision unchanged.
  const risers=[],known=new Set();
  for(const f of polygons){if(Math.abs(f.n[1])>.01)continue;const min=[0,1,2].map(i=>Math.min(...f.p.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...f.p.map(p=>p[i]))),height=max[1]-min[1],axis=Math.abs(f.n[0])>.99?0:Math.abs(f.n[2])>.99?2:-1;if(axis<0||height<.28||height>.9||max[2-axis]-min[2-axis]<1)continue;const key=[...min,...max,...f.n].map(v=>Math.round(v*1000)).join(',');if(known.has(key))continue;known.add(key);risers.push({min,max,n:f.n,axis,height});}
  let walkRamps=0;
  for(const r of risers){const along=2-r.axis,near=risers.filter(s=>s!==r&&s.axis===r.axis&&dot(s.n,r.n)>.99&&Math.abs(s.min[along]-r.min[along])<.15&&Math.abs(s.max[along]-r.max[along])<.15&&Math.abs(s.min[r.axis]-r.min[r.axis])>.15&&Math.abs(s.min[r.axis]-r.min[r.axis])<2&&(s.min[1]-r.min[1])*(s.min[r.axis]-r.min[r.axis])*r.n[r.axis]<0&&Math.min(Math.abs(s.min[1]-r.max[1]),Math.abs(r.min[1]-s.max[1]))<.08);if(!near.length)continue;
    const run=Math.max(.5,r.height/.7),a=[...r.min],b=[...r.min];a[1]=b[1]=r.max[1]+.003;b[along]=r.max[along];const c=a.map((v,i)=>v+r.n[i]*run),d=b.map((v,i)=>v+r.n[i]*run);c[1]=d[1]=r.min[1]+.003;
    for(let p of [[a,b,c],[b,d,c]]){let n=unit(cross(sub(p[1],p[0]),sub(p[2],p[0])));if(n[1]<0){p=p.slice().reverse();n=n.map(v=>-v);}const h=hull({p,n});h.mask=5;map.hulls.push(h);}walkRamps++;
  }
  map.report.walkRamps=walkRamps;
  const native=new SourceMaps.NativeMap(packMap(map));
  for(const side of ['t','ct'])for(const p of map[side]){const floors=native.floors(p[0],p[1]);if(floors.length)p[3]=floors.find(y=>!native.overlap(p[0],y+.005,p[1],1.8,.3))??floors[0];}
  const nav=native.buildNav(map.ax,map.az),X=id=>nav.minX+(id%nav.w)*nav.step,Z=id=>nav.minZ+Math.floor((id%nav.plane)/nav.w)*nav.step;
  if(process.env.MAP_IMPORT_DEBUG){writeFileSync(resolve(process.env.MAP_IMPORT_DEBUG,id+'-debug.json'),JSON.stringify(packMap(map)));console.log(id,'nav',JSON.stringify(nav.audit),'ground samples',JSON.stringify({t:native.floors(map.t[0][0],map.t[0][1]),ct:native.floors(map.ct[0][0],map.ct[0][1])}));}
  const near=(x,z,y=0)=>nav.walk.filter(id=>Math.abs(nav.height[id]-y)<2&&!native.overlap(X(id),nav.height[id]+.005,Z(id),1.8,.3)).sort((a,b)=>(X(a)-x)**2+(Z(a)-z)**2+(nav.height[a]-y)**2-((X(b)-x)**2+(Z(b)-z)**2+(nav.height[b]-y)**2));
  for(const side of ['t','ct']){const at=map[side][0],selected=[];for(const id of near(at[0],at[1],at[3])){const x=X(id),z=Z(id);if(Math.hypot(x-at[0],z-at[1])>5)break;if(selected.some(p=>Math.hypot(p[0]-x,p[1]-z)<1.35))continue;selected.push([x,z,Math.atan2(x,z),nav.height[id]]);if(selected.length===5)break;}if(selected.length!==5)throw Error(id+' needs five safe '+side+' spawns near '+at.slice(0,2));map[side]=selected;}
  for(const p of map.t.concat(map.ct)){const toward=Math.atan2(p[0],p[1]);let score=-Infinity;
    for(let i=-8;i<=8;i++){const yaw=toward+i*Math.PI/24,dir=[-Math.sin(yaw),0,-Math.cos(yaw)],hit=native.ray([p[0],p[3]+1.64,p[1]],dir,16),open=hit?hit.t:16,ground=native.ground(p[0]+dir[0]*3,p[1]+dir[2]*3,p[3]);if(ground<p[3]-2)continue;const value=Math.min(12,open)-Math.abs(i)*.12;if(value>score){score=value;p[2]=yaw;}}
  }
  for(const [i,p]of cfg.sites.entries()){const q=convert([p[0],cfg.floor,p[1]]),siteY=native.floors(q[0],q[2]).find(y=>!native.overlap(q[0],y+.005,q[2],1.8,.3))??0,at=near(q[0],q[2],siteY)[0];if(at===undefined)throw Error('No site floor');const x=X(at),z=Z(at),y=nav.height[at];map.sites.push({name:i?'B':'A',x0:x-1.8,z0:z-1.8,x1:x+1.8,z1:z+1.8,y0:y-.1,y1:y+.4,lx:x,lz:z});}
  const lookup=new Int32Array(nav.open.length).fill(-1);nav.walk.forEach((id,i)=>lookup[id]=i);const links=[];for(const id of nav.walk)for(let d=0;d<4;d++){const next=nav.links[id*4+d];links.push(next<0?-1:lookup[next]);}
  map.navigation={step:nav.step,minX:nav.minX,minZ:nav.minZ,w:nav.w,h:nav.h,x:encode(Float32Array.from(nav.walk,X)),z:encode(Float32Array.from(nav.walk,Z)),height:encode(Float32Array.from(nav.walk,id=>nav.height[id])),links:encode(new Int32Array(links)),audit:{...nav.audit,spawnsConnected:10,spawnsTotal:10}};
  map.report.navigation=map.navigation.audit;
  map.navigation.audit.regions[0].spawns=10;
  const px=x=>(x+map.ax)/(2*map.ax)*512,pz=z=>(z+map.az)/(2*map.az)*512*map.az/map.ax,rects=[];
  const rows=new Map();for(const id of nav.walk){const z=Z(id),y=nav.height[id],key=Math.round(z*1000)+':'+Math.round(y*2);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(id);}
  for(const row of rows.values()){row.sort((a,b)=>X(a)-X(b));let a=0;for(let b=1;b<=row.length;b++)if(b===row.length||X(row[b])-X(row[b-1])>nav.step+.01){const first=row[a],last=row[b-1],x=px(X(first)-nav.step/2),z=pz(Z(first)-nav.step/2),width=px(X(last)+nav.step/2)-x,height=nav.step*512/(2*map.ax);rects.push('<rect x="'+x.toFixed(2)+'" y="'+z.toFixed(2)+'" width="'+(width+.3).toFixed(2)+'" height="'+(height+.3).toFixed(2)+'" fill="'+(id==='palace'?(nav.height[first]>1?'#c4beb0':'#a19e8d'):(nav.height[first]>1?'#8b9c9f':'#737f80'))+'"/>');a=b;}}
  const label=(x,z,text,color,r=12)=>'<circle cx="'+px(x).toFixed(2)+'" cy="'+pz(z).toFixed(2)+'" r="'+r+'" fill="#10191d" stroke="'+color+'" stroke-width="2"/><text x="'+px(x).toFixed(2)+'" y="'+(pz(z)+4).toFixed(2)+'" text-anchor="middle" fill="'+color+'" font-family="Arial,sans-serif" font-weight="bold" font-size="11">'+text+'</text>';
  for(const side of ['t','ct']){const list=map[side],x=list.reduce((s,p)=>s+p[0],0)/5,z=list.reduce((s,p)=>s+p[1],0)/5;rects.push(label(x,z,side==='ct'?'DEF':'ATQ',side==='ct'?'#6bc1ff':'#ef8977',16));}
  for(const s of map.sites)rects.push(label(s.lx,s.lz,s.name,'#f0ba6c'));
  writeFileSync(resolve(import.meta.dirname,'../assets/maps/'+id+'-minimap.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 '+(512*map.az/map.ax).toFixed(2)+'" width="512" height="'+Math.round(512*map.az/map.ax)+'"><title>'+cfg.name+' · Defensor azul, Atacante vermelho</title><rect width="100%" height="100%" fill="#10191d"/>'+rects.join('')+'</svg>\n');
  const packed=packMap(map),data=gzipSync(Buffer.from(JSON.stringify(packed)),{level:9}),out=resolve(import.meta.dirname,'../assets/maps');
  writeFileSync(resolve(out,id+'.js'),'// Converted offline from the user-supplied GLB.\n(globalThis.SOURCE_MAP_PAYLOADS??={}).'+id+'='+JSON.stringify(data.toString('base64'))+';\n');
  writeFileSync(resolve(out,id+'-source.json'),JSON.stringify({...map.report,triangles:polygons.length,hulls:map.hulls.length,assetBytes:data.length,t:map.t,ct:map.ct,sites:map.sites},null,2)+'\n');
  return {map,metadata:{name:cfg.name,ax:map.ax,az:map.az,t:map.t,ct:map.ct,sites:map.sites},packed};
}
// Uso: node tools/import-warface-maps.mjs palace=caminho/DVORETS.glb factory=caminho/Factory_5v5_guilhxrme_Joao.glb
// (um ou os dois). O catálogo mantém os mapas que não foram reimportados.
const jobs=process.argv.slice(2).map(a=>a.split(/=(.*)/s)).filter(([id,file])=>CONFIG[id]&&file);
if(!jobs.length)throw Error('Usage: node tools/import-warface-maps.mjs palace=palace.glb factory=factory.glb');
const catalogFile=resolve(import.meta.dirname,'../assets/maps/warface-catalog.js'),catalog={};
try{const text=readFileSync(catalogFile,'utf8');Object.assign(catalog,JSON.parse(text.slice(text.indexOf('=')+1,text.lastIndexOf(';'))));}catch{}
for(const [id,file]of jobs){const {map,metadata}=compile(id,resolve(file));catalog[id]=metadata;console.log(id,JSON.stringify({triangles:map.polygons.length,navigation:map.report.navigation,t:map.t,ct:map.ct,sites:map.sites}));}
writeFileSync(catalogFile,'// Metadata only; geometry is lazy loaded.\nglobalThis.WARFACE_MAP_CATALOG='+JSON.stringify(catalog)+';\n');
