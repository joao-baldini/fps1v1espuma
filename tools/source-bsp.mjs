// Offline reader for the Source 20/21 (CS:GO) BSP files supplied by the user.
// Format references: Valve's public bspfile.h/gamebspfile.h and SourceIO's PHY reader.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const vec = (b, p) => [b.readFloatLE(p), b.readFloatLE(p + 4), b.readFloatLE(p + 8)];
const add = (a,b) => a.map((v,i)=>v+b[i]);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const mul = (a,s) => a.map(v=>v*s);
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = a => mul(a,1/(Math.hypot(...a)||1));
const bounds = points => {const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const p of points)for(let i=0;i<3;i++){b[i]=Math.min(b[i],p[i]);b[i+3]=Math.max(b[i+3],p[i]);}return b;};
const numbers = s => (s||'0 0 0').trim().split(/\s+/).map(Number);
const text = (b,p,n) => b.toString('utf8',p,p+n).split('\0')[0];

export class SourceBsp {
  constructor(file) {
    this.bytes=readFileSync(file);const b=this.bytes;
    this.version=b.readInt32LE(4);if(b.toString('ascii',0,4)!=='VBSP'||(this.version!==20&&this.version!==21))throw new Error('Expected a Source 20/21 BSP: '+file);
    this.sha256=createHash('sha256').update(b).digest('hex');
    this.lumps=Array.from({length:64},(_,i)=>{const p=8+i*16,offset=b.readInt32LE(p),length=b.readInt32LE(p+4);if(offset<0||length<0||offset+length>b.length)throw Error('Invalid BSP lump');const data=b.subarray(offset,offset+length);if(data.toString('ascii',0,4)==='LZMA')throw Error('Compressed BSP lump requires offline decompression');return {offset,length,version:b.readInt32LE(p+8),data};});
    this.entities=[...this.lump(0).toString('utf8').matchAll(/\{([^}]+)\}/g)].map(m=>Object.fromEntries([...m[1].matchAll(/"([^"\n]+)"\s*"([^"\n]*)"/g)].map(k=>[k[1],k[2]])));
    const read=(id,stride,fn)=>Array.from({length:this.lump(id).length/stride},(_,i)=>fn(this.lump(id),i*stride));
    this.planes=read(1,20,(b,p)=>[...vec(b,p),b.readFloatLE(p+12)]);
    this.vertices=read(3,12,vec);
    this.edges=read(12,4,(b,p)=>[b.readUInt16LE(p),b.readUInt16LE(p+2)]);
    this.surfEdges=read(13,4,(b,p)=>b.readInt32LE(p));
    // texture vectors (s,t) map world units to texels; texdata keeps the texture size, used for the light textures.
    this.texInfo=read(6,72,(b,p)=>({s:[b.readFloatLE(p),b.readFloatLE(p+4),b.readFloatLE(p+8),b.readFloatLE(p+12)],t:[b.readFloatLE(p+16),b.readFloatLE(p+20),b.readFloatLE(p+24),b.readFloatLE(p+28)],flags:b.readInt32LE(p+64),data:b.readInt32LE(p+68)}));
    this.texSize=read(2,32,(b,p)=>[b.readInt32LE(p+16)||256,b.readInt32LE(p+20)||256]);
    const names=this.lump(43),strings=read(44,4,(b,p)=>text(names,b.readInt32LE(p),names.length-b.readInt32LE(p)));
    this.materials=read(2,32,(b,p)=>strings[b.readInt32LE(p+12)]?.toLowerCase()||'');
    // BSP texdata retains the material's average RGB: bake one flat colour, never a texture.
    this.materialColors=new Map(read(2,32,(b,p)=>[strings[b.readInt32LE(p+12)]?.toLowerCase()||'',vec(b,p)]));
    this.faces=read(7,56,(b,p)=>({plane:b.readUInt16LE(p),side:b[p+2],edge:b.readInt32LE(p+4),count:b.readInt16LE(p+8),tex:b.readInt16LE(p+10),disp:b.readInt16LE(p+12)}));
    this.models=read(14,48,(b,p)=>({min:vec(b,p),max:vec(b,p+12),origin:vec(b,p+24),node:b.readInt32LE(p+36),face:b.readInt32LE(p+40),count:b.readInt32LE(p+44)}));
    this.sides=read(19,8,(b,p)=>({plane:b.readUInt16LE(p),tex:b.readInt16LE(p+2),disp:b.readInt16LE(p+4),bevel:b.readInt16LE(p+6)}));
    this.brushes=read(18,12,(b,p)=>({side:b.readInt32LE(p),count:b.readInt32LE(p+4),contents:b.readUInt32LE(p+8)}));
    this.pak=this.readPak();
  }
  lump(id){return this.lumps[id].data;}
  readPak(){
    const b=this.lump(40),out=new Map();let end=b.length-22;
    while(end>=0&&b.readUInt32LE(end)!==0x06054b50)end--;if(end<0)return out;
    let p=b.readUInt32LE(end+16);const count=b.readUInt16LE(end+10);
    for(let i=0;i<count;i++){
      if(b.readUInt32LE(p)!==0x02014b50)throw Error('Invalid embedded ZIP directory');
      const n=b.readUInt16LE(p+28),extra=b.readUInt16LE(p+30),comment=b.readUInt16LE(p+32),name=b.toString('utf8',p+46,p+46+n).replaceAll('\\','/').toLowerCase();
      out.set(name,{method:b.readUInt16LE(p+10),size:b.readUInt32LE(p+24),packed:b.readUInt32LE(p+20),offset:b.readUInt32LE(p+42)});p+=46+n+extra+comment;
    }return out;
  }
  asset(name){
    const entry=this.pak.get(name.toLowerCase());if(!entry)return null;
    const b=this.lump(40),p=entry.offset+30+b.readUInt16LE(entry.offset+26)+b.readUInt16LE(entry.offset+28),raw=b.subarray(p,p+entry.packed);
    const out=entry.method===0?raw:entry.method===8?inflateRawSync(raw):null;
    if(!out||out.length!==entry.size)throw Error('Invalid packed model: '+name);return out;
  }
  faceVertices(face){return Array.from({length:face.count},(_,i)=>{const edge=this.surfEdges[face.edge+i];return this.vertices[this.edges[Math.abs(edge)][edge<0?1:0]];});}
  material(face){return this.materials[this.texInfo[face.tex]?.data]||'';}
  modelBrushes(model){
    const nodes=this.lump(5),leaves=this.lump(10),indices=this.lump(17),stride=this.lumps[10].version===0?56:32,result=new Set(),visited=new Set(),stack=[model.node];
    while(stack.length){const id=stack.pop();if(visited.has(id))continue;visited.add(id);if(id<0){const p=(-id-1)*stride;if(p+28>leaves.length)continue;const first=leaves.readUInt16LE(p+24),count=leaves.readUInt16LE(p+26);for(let i=0;i<count;i++)result.add(indices.readUInt16LE((first+i)*2));}else{const p=id*32;if(p+12>nodes.length)throw Error('Invalid BSP node');stack.push(nodes.readInt32LE(p+4),nodes.readInt32LE(p+8));}}
    return [...result];
  }
  staticProps(){
    const g=this.lump(35),out=[];
    for(let i=0;i<g.readInt32LE(0);i++){
      const p=4+i*16;if(g.toString('ascii',p,p+4)!=='prps')continue;
      const version=g.readUInt16LE(p+6),start=g.readInt32LE(p+8),length=g.readInt32LE(p+12),b=this.bytes;
      if(version!==10&&version!==11)throw Error('Unsupported static prop version '+version);
      const n=b.readInt32LE(start),names=Array.from({length:n},(_,i)=>text(b,start+4+i*128,128).toLowerCase());
      let q=start+4+n*128;q+=4+b.readInt32LE(q)*2;const count=b.readInt32LE(q);q+=4;const stride=(start+length-q)/count;
      if(![72,76,80].includes(stride))throw Error('Unsupported static prop layout '+stride);
      // v11 (CS:GO) appends a uniform scale at byte 76.
      for(let j=0;j<count;j++){const k=q+j*stride,scale=stride===80?b.readFloatLE(k+76):1;out.push({model:names[b.readUInt16LE(k+24)],origin:vec(b,k),angles:vec(b,k+12),solid:b[k+30],scale:scale>0&&scale<20?scale:1});}
    }return out;
  }
}

export function rotation(angles){
  const [p,y,r]=angles.map(v=>v*Math.PI/180),cp=Math.cos(p),sp=Math.sin(p),cy=Math.cos(y),sy=Math.sin(y),cr=Math.cos(r),sr=Math.sin(r);
  return v=>[cp*cy*v[0]+(sr*sp*cy-cr*sy)*v[1]+(cr*sp*cy+sr*sy)*v[2],cp*sy*v[0]+(sr*sp*sy+cr*cy)*v[1]+(cr*sp*sy-sr*cy)*v[2],-sp*v[0]+sr*cp*v[1]+cr*cp*v[2]];
}
function brushBounds(planes){
  const min=[-32768,-32768,-32768],max=[32768,32768,32768];
  for(const p of planes)for(let i=0;i<3;i++){if(p[i]>.99999)max[i]=Math.min(max[i],p[3]/p[i]);else if(p[i]<-.99999)min[i]=Math.max(min[i],p[3]/p[i]);}
  return [...min,...max];
}
function corners(b){return Array.from({length:8},(_,i)=>[b[i&1?3:0],b[i&2?4:1],b[i&4?5:2]]);}
function hullFromTriangles(vertices,triangles){
  const center=mul(vertices.reduce((s,v)=>add(s,v),[0,0,0]),1/vertices.length),planes=[],keys=new Set();
  for(const [ia,ib,ic]of triangles){const a=vertices[ia],b=vertices[ib],c=vertices[ic];if(!a||!b||!c)throw Error('Bad PHY vertex index');let n=unit(cross(sub(b,a),sub(c,a)));if(Math.hypot(...n)<.1)continue;let d=dot(n,a);if(dot(n,center)>d){n=mul(n,-1);d=-d;}const key=[...n.map(v=>Math.round(v*10000)),Math.round(d*1000)].join(',');if(!keys.has(key)){keys.add(key);planes.push([...n,d]);}}
  return {vertices,triangles,planes};
}
// PHY stores convex hull vertices in metres, with physics axes (x, -z, y).
export function readPhy(b){
  if(!b||b.length<20)return [];
  const solids=b.readUInt32LE(8),hulls=[];let start=b.readUInt32LE(0);
  for(let i=0;i<solids;i++){
    const size=b.readUInt32LE(start);if(b.toString('ascii',start+4,start+8)!=='VPHY')throw Error('Unsupported PHY signature');
    const model=start+32,tree=model+b.readUInt32LE(model+32),visited=new Set();
    const walk=p=>{
      if(visited.has(p)||p<start||p+28>start+size+4)return;visited.add(p);
      const right=b.readInt32LE(p),leaf=b.readInt32LE(p+4);
      if(right===0&&leaf){const q=p+leaf,vo=q+b.readInt32LE(q),count=b.readUInt16LE(q+12),triangles=[];let max=-1;
        for(let j=0;j<count;j++){const t=q+16+j*16,ids=[b.readUInt16LE(t+4),b.readUInt16LE(t+8),b.readUInt16LE(t+12)];triangles.push(ids);max=Math.max(max,...ids);}
        if(vo<start||vo+(max+1)*16>start+size+4)throw Error('Invalid PHY vertex range');
        const ids=[...new Set(triangles.flat())],remap=new Map(ids.map((id,i)=>[id,i]));
        const vertices=ids.map(id=>{const a=vec(b,vo+id*16);return [a[0]/.0254,a[2]/.0254,-a[1]/.0254];});
        if(count&&vertices.length)hulls.push(hullFromTriangles(vertices,triangles.map(tri=>tri.map(id=>remap.get(id)))));
      }else if(right){walk(p+28);walk(p+right);}
    };walk(tree);start+=size+4;
  }return hulls;
}

const hiddenMaterial = name => /(^tools\/|tools?\/tools|trigger|nodraw|invis[ai]?ble|skybox|sky_day|sky_cs)/.test(name);
const colorFor = (name,n,key) => {
  if(/glass|window/.test(name))return 0x8faaba;
  if(/wood|crate|pallet|plywood|cardboard/.test(name))return 0x92734e;
  if(/metal|pipe|railing|rail_|vent|steel|ladder/.test(name))return 0x647681;
  if(/water/.test(name))return 0x457d96;
  if(/grass|dirt|ground|nature/.test(name))return 0x9ca395;
  if(n[2]>.7)return 0xd8d3c5;
  return 0xa99d89;
};

// Textura leve: em vez de imagens, um padrão procedural escolhido pelo nome do material (0 = grade lisa de sempre).
export const PATTERNS={plain:0,brick:1,tile:2,wood:3,concrete:4,metal:5,ground:6,stone:7,asphalt:8,roof:9,foliage:10};
export function patternFor(name){
  if(/glass|window/.test(name))return 0;
  if(/brick/.test(name))return 1;
  if(/roof|shingle|terracotta_tile|rooftile/.test(name))return 9;
  if(/tile|ceramic|mosaic/.test(name))return 2;
  if(/wood|plank|crate|board|plywood|pallet|timber|beam/.test(name))return 3;
  if(/asphalt|road|street|tarmac/.test(name))return 8;
  if(/leaf|leaves|hedge|ivy|foliage|bush|tree|vine|plant/.test(name))return 10;
  if(/grass|dirt|ground|sand|gravel|mud|soil|blend|nature|terrain|moss/.test(name))return 6;
  if(/stone|cobble|rock|marble|paving|pavement|granite|flagstone|slate/.test(name))return 7;
  if(/metal|steel|iron|corrugat|rust|sheet|tin|alum|pipe|vent|grate|grating/.test(name))return 5;
  if(/concrete|cement|plaster|stucco|wall|cinder|render|adobe|block/.test(name))return 4;
  return 0;
}
const flatColor=rgb=>rgb.reduce((c,v)=>(c<<8)|Math.round(Math.max(.055,Math.min(.96,v))*255),0);
function propColor(bsp,name){
  const mdl=bsp.asset(name);if(!mdl||mdl.length<220||mdl.toString('ascii',0,4)!=='IDST')return null;
  const count=mdl.readInt32LE(204),start=mdl.readInt32LE(208),dirCount=mdl.readInt32LE(212),dirStart=mdl.readInt32LE(216),colors=[];
  if(count<0||count>256||dirCount<0||dirCount>64)return null;
  const dirs=Array.from({length:dirCount},(_,i)=>{const p=mdl.readInt32LE(dirStart+i*4);return text(mdl,p,mdl.length-p).replaceAll('\\','/');});
  for(let i=0;i<count;i++){
    const q=start+i*64,p=q+mdl.readInt32LE(q),material=text(mdl,p,mdl.length-p).toLowerCase();
    for(const dir of dirs){
      const full=(dir+material).replace(/^materials\//,'').replace(/\.vmt$/,'').toLowerCase(),original=bsp.materialColors.get(full);
      if(original){colors.push(original);break;}
      const vmt=bsp.asset('materials/'+full+'.vmt');if(!vmt)continue;
      const definition=vmt.toString('utf8'),texture=definition.match(/"?\$basetexture"?\s+"?([^"\s}]+)/i)?.[1];
      const vtf=texture&&bsp.asset('materials/'+texture.replaceAll('\\','/').replace(/\.vtf$/i,'')+'.vtf');
      if(vtf&&vtf.length>44&&vtf.toString('ascii',0,3)==='VTF')colors.push(vec(vtf,32));
      break;
    }
  }
  return colors.length?flatColor(colors.reduce((sum,rgb)=>add(sum,rgb),[0,0,0]).map(v=>v/colors.length)):null;
}

export function compileSourceMap(file,key,options={}){
  const bsp=new SourceBsp(file),spawns=bsp.entities.filter(e=>/info_player_(terrorist|counterterrorist)$/.test(e.classname));
  if(!spawns.length)throw Error('Map has no player spawns');
  const sourceSpawns=spawns.map(e=>numbers(e.origin)),base=Math.min(...sourceSpawns.map(p=>p[2]))-16;
  const world=bsp.models[0],wmin=numbers(bsp.entities[0].world_mins||world.min.join(' ')),wmax=numbers(bsp.entities[0].world_maxs||world.max.join(' '));
  const center=[(wmin[0]+wmax[0])/2,(wmin[1]+wmax[1])/2,base],scale=.0254;
  const convert=p=>[(p[0]-center[0])*scale,(p[2]-center[2])*scale,-(p[1]-center[1])*scale];
  const normal=n=>[n[0],n[2],-n[1]];
  const plane=p=>[...normal(p), (p[3]-dot(p,center))*scale];
  const polygons=[],hulls=[],report={sourceSha256:bsp.sha256,worldFaces:0,displacementTriangles:0,brushes:0,propHulls:0,propModels:0,missingModels:[],unsupportedProps:[]};
  const keep=points=>points.some(p=>p[2]>=base-512)&&points.every(p=>p.every(Number.isFinite));
  const propColors=new Map();
  // options.textures: guarda coordenadas de textura (texinfo do BSP, na escala real da textura) e o padrão do material.
  const planarUv=(points,n)=>{const a=Math.abs(n[0])>Math.abs(n[1])&&Math.abs(n[0])>Math.abs(n[2])?[1,2]:Math.abs(n[1])>Math.abs(n[2])?[0,2]:[0,1];return points.map(p=>[p[a[0]]/64,p[a[1]]/64]);};
  const emit=(points,n,material,tag='world',tex=-1)=>{if(points.length<3||!keep(points))return;const rgb=bsp.materialColors.get(material),c=rgb?flatColor(rgb):propColors.get(material)??colorFor(material,n,key),face={p:points.map(convert),n:normal(n),c,glass:/glass|window/.test(material),tag};
    if(options.textures){const ti=bsp.texInfo[tex],size=ti&&bsp.texSize[ti.data];face.uv=ti&&size?points.map(p=>[(ti.s[0]*p[0]+ti.s[1]*p[1]+ti.s[2]*p[2]+ti.s[3])/size[0],(ti.t[0]*p[0]+ti.t[1]*p[1]+ti.t[2]*p[2]+ti.t[3])/size[1]]):planarUv(points,n);face.pat=patternFor(material);}
    polygons.push(face);};
  const collision=(ps,b,mask=3)=>{if(b[5]<base-512)return;const pts=corners(b).map(convert),bb=bounds(pts);hulls.push({planes:ps.map(plane),min:bb.slice(0,3),max:bb.slice(3),mask});};
  const surfaceCollider=(points,n)=>{
    const top=points.map(convert),wn=normal(n),bottom=top.map(p=>sub(p,mul(wn,.025))),vertices=top.concat(bottom),count=top.length,tris=[];
    for(let i=1;i<count-1;i++)tris.push([0,i,i+1],[count,count+i+1,count+i]);
    for(let i=0;i<count;i++){const j=(i+1)%count;tris.push([i,count+i,count+j],[i,count+j,j]);}
    const h=hullFromTriangles(vertices,tris),bb=bounds(vertices);hulls.push({planes:h.planes,min:bb.slice(0,3),max:bb.slice(3),mask:3});
  };
  const drawModel=(index,origin=[0,0,0],angles=[0,0,0],solid=true)=>{
    const model=bsp.models[index],rot=rotation(angles),transform=p=>add(rot(p),origin);
    for(let i=model.face;i<model.face+model.count;i++){
      const f=bsp.faces[i],material=bsp.material(f);if(hiddenMaterial(material)||!f.count)continue;
      const ps=bsp.faceVertices(f),pn=bsp.planes[f.plane],n=rot(mul(pn.slice(0,3),f.side?-1:1));
      if(f.disp>=0){
        const d=bsp.lump(26),v=bsp.lump(33),q=f.disp*176,power=d.readInt32LE(q+20),start=vec(d,q),first=d.readInt32LE(q+12),size=(1<<power)+1;
        if(ps.length!==4||power<2||power>4)throw Error('Unsupported displacement');
        let corner=0;for(let j=1;j<4;j++)if(Math.hypot(...sub(ps[j],start))<Math.hypot(...sub(ps[corner],start)))corner=j;
        const p=[0,1,2,3].map(j=>ps[(corner+j)%4]),grid=[];
        for(let y=0;y<size;y++)for(let x=0;x<size;x++){
          const u=x/(size-1),t=y/(size-1),a=add(mul(p[0],1-t),mul(p[1],t)),b=add(mul(p[3],1-t),mul(p[2],t)),off=(first+y*size+x)*20;
          grid.push(transform(add(add(mul(a,1-u),mul(b,u)),mul(vec(v,off),v.readFloatLE(off+12)))));
        }
        const quad=[grid[0],grid[(size-1)*size],grid[size*size-1],grid[size-1]],qn=unit(cross(sub(quad[1],quad[0]),sub(quad[2],quad[0])));
        if(grid.every(v=>Math.abs(dot(qn,sub(v,quad[0])))<.0001)){
          const normal=dot(qn,n)<0?mul(qn,-1):qn;if(dot(qn,n)<0)quad.reverse();
          emit(quad,normal,material,'displacement',f.tex);report.displacementTriangles+=2;if(solid)surfaceCollider(quad,normal);continue;
        }
        for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){
          const a=y*size+x,b=a+1,c=a+size+1,d=a+size,ts=(x+y)%2?[[a,b,d],[b,c,d]]:[[a,b,c],[a,c,d]];
          for(const ids of ts){let points=ids.map(i=>grid[i]),tn=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));if(dot(tn,n)<0){points.reverse();tn=mul(tn,-1);}if(!keep(points))continue;
            emit(points,tn,material,'displacement',f.tex);report.displacementTriangles++;
            if(solid)surfaceCollider(points,tn);
          }
        }
      }else{emit(ps.map(transform),n,material,'world',f.tex);report.worldFaces++;}
    }
    if(solid)for(const id of bsp.modelBrushes(model)){
      const b=bsp.brushes[id],sides=bsp.sides.slice(b.side,b.side+b.count),mask=(b.contents&0x10000)?1:(b.contents&(1|2|8|0x4000))?3:0;
      if(!mask)continue;
      const ps=sides.map(s=>bsp.planes[s.plane]),bb=brushBounds(ps);if(bb.some(v=>Math.abs(v)>=32768)||bb[5]<base-512)continue;
      const transformed=ps.map(p=>{const n=rot(p.slice(0,3));return [...n,p[3]+dot(n,origin)];});
      const rb=bounds(corners(bb).map(transform));collision(transformed,rb,mask);report.brushes++;
    }
  };
  drawModel(0);
  const brushEntities=bsp.entities.filter(e=>/^\*\d+$/.test(e.model||'')&&!/^(func_bomb_target|func_buyzone|func_areaportal|trigger_|func_dust)/.test(e.classname)&&e.StartDisabled!=='1');
  for(const e of brushEntities)drawModel(Number(e.model.slice(1)),numbers(e.origin),numbers(e.angles),e.Solidity!=='1');
  const modelCache=new Map();
  const props=bsp.staticProps().concat(bsp.entities.filter(e=>/^(prop_dynamic|prop_physics)/.test(e.classname)).map(e=>({model:(e.model||'').toLowerCase(),origin:numbers(e.origin),angles:numbers(e.angles),solid:Number(e.solid??6),scale:Number(e.modelscale)||1})));
  for(const prop of props){
    if(!prop.model||prop.origin[2]<base-512||!prop.solid)continue;
    let model=modelCache.get(prop.model);
    if(model===undefined){const phy=bsp.asset(prop.model.replace(/\.mdl$/,'.phy'));try{model=phy?readPhy(phy):null;propColors.set(prop.model,propColor(bsp,prop.model));}catch(err){report.unsupportedProps.push([prop.model,err.message]);model=null;}modelCache.set(prop.model,model);}
    if(!model){if(!report.missingModels.includes(prop.model))report.missingModels.push(prop.model);continue;}
    const rot=rotation(prop.angles),transform=p=>add(rot(mul(p,prop.scale)),prop.origin);report.propModels++;
    for(const h of model){const vertices=h.vertices.map(transform),ps=h.planes.map(p=>{const n=rot(p.slice(0,3));return [...n,p[3]*prop.scale+dot(n,prop.origin)];}),bb=bounds(vertices);if(!keep(vertices))continue;
      collision(ps,bb,3);report.propHulls++;
      for(const ids of h.triangles){const p=ids.map(i=>vertices[i]);let n=unit(cross(sub(p[1],p[0]),sub(p[2],p[0])));const middle=mul(vertices.reduce((s,v)=>add(s,v),[0,0,0]),1/vertices.length);if(dot(n,sub(middle,p[0]))>0)n=mul(n,-1);emit(p,n,prop.model,'prop');}
    }
  }
  const sites=bsp.entities.filter(e=>e.classname==='func_bomb_target').map((e,i)=>{const m=bsp.models[Number(e.model.slice(1))],bb=bounds(corners([...m.min,...m.max]).map(convert));return {name:String.fromCharCode(65+i),x0:bb[0],z0:bb[2],x1:bb[3],z1:bb[5],y0:bb[1],y1:bb[4],lx:(bb[0]+bb[3])/2,lz:(bb[2]+bb[5])/2};});
  const starts=type=>spawns.filter(e=>e.classname==='info_player_'+type).map(e=>{const p=convert(numbers(e.origin));return [p[0],p[2],(numbers(e.angles)[1]-90)*Math.PI/180,p[1]];});
  const ladders=bsp.entities.filter(e=>e.classname==='info_ladder').map(e=>{const lo=['x','y','z'].map(k=>Number(e['mins.'+k])),hi=['x','y','z'].map(k=>Number(e['maxs.'+k]));return bounds(corners([...lo,...hi]).map(convert));});
  const allBounds=bounds(polygons.flatMap(p=>p.p));
  report.flatColors={method:'Original BSP material reflectivity and embedded model material averages; no runtime textures',materials:bsp.materialColors.size,models:[...propColors.values()].filter(c=>c!==null).length,samples:Object.fromEntries([...bsp.materialColors].filter(([name])=>/wall_concrete_02|housedeck01|floor_tile_white_01|plasterwall|plaster_wall/.test(name)).slice(0,12).map(([name,rgb])=>[name,flatColor(rgb).toString(16).padStart(6,'0')]))};
  return {key,scale,center,bounds:allBounds,t:starts('terrorist'),ct:starts('counterterrorist'),sites,ladders,polygons,hulls,report,bsp,convert,base};
}
