// Native Source-map geometry and convex collision. No Source materials or engine code.
(() => {
  'use strict';
  const EPS=.00005,cache=new Map(),pending=new Map();
  const array=(Type,text)=>{const s=atob(text),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return new Type(b.buffer);};
  class NativeMap {
    constructor(data){
      this.meta=data.meta;this.mesh=data.mesh;const c=data.collision;
      this.planes=array(Float32Array,c.planes);this.offsets=array(Uint32Array,c.offsets);this.bounds=array(Float32Array,c.bounds);this.masks=array(Uint8Array,c.masks);
      this.count=this.masks.length;this.marks=new Uint32Array(this.count);this.stamp=0;this.tile=2;
      const b=this.meta.bounds;this.minX=b[0]-1;this.minZ=b[2]-1;this.w=Math.ceil((b[3]-this.minX+1)/this.tile);this.h=Math.ceil((b[5]-this.minZ+1)/this.tile);
      const buckets=Array.from({length:this.w*this.h},()=>[]);
      for(let i=0;i<this.count;i++){
        const p=i*6,x0=this.cx(this.bounds[p]),z0=this.cz(this.bounds[p+2]),x1=this.cx(this.bounds[p+3]),z1=this.cz(this.bounds[p+5]);
        for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)buckets[z*this.w+x].push(i);
      }
      this.gridStarts=new Uint32Array(buckets.length+1);let total=0;for(let i=0;i<buckets.length;i++){this.gridStarts[i]=total;total+=buckets[i].length;}this.gridStarts[buckets.length]=total;
      this.gridIds=new Uint32Array(total);for(let i=0;i<buckets.length;i++)this.gridIds.set(buckets[i],this.gridStarts[i]);
      this.floorMin=Math.min(...this.meta.t.concat(this.meta.ct).map(p=>p[3]))-10;
      this.floorMax=Math.max(...this.meta.t.concat(this.meta.ct).map(p=>p[3]))+6;
      if(data.navigation){const n=data.navigation,x=array(Float32Array,n.x),count=x.length;this.bakedNav={source:true,compact:true,step:n.step,minX:n.minX,minZ:n.minZ,w:n.w,h:n.h,layers:4,plane:n.w*n.h,layered:true,x,z:array(Float32Array,n.z),height:array(Float32Array,n.height),links:array(Int32Array,n.links),open:new Uint8Array(count).fill(1),seen:new Int32Array(count),parent:new Int32Array(count),queue:new Int32Array(count),stamp:0,walk:Array.from({length:count},(_,i)=>i),audit:n.audit};}
    }
    cx(x){return Math.max(0,Math.min(this.w-1,Math.floor((x-this.minX)/this.tile)));}
    cz(z){return Math.max(0,Math.min(this.h-1,Math.floor((z-this.minZ)/this.tile)));}
    each(x0,z0,x1,z1,mask,visit){
      let stamp=++this.stamp;if(stamp>=4294967295){this.marks.fill(0);this.stamp=stamp=1;}
      const ax=this.cx(x0),az=this.cz(z0),bx=this.cx(x1),bz=this.cz(z1);
      for(let z=az;z<=bz;z++)for(let x=ax;x<=bx;x++){
        const cell=z*this.w+x;
        for(let j=this.gridStarts[cell];j<this.gridStarts[cell+1];j++){
          const id=this.gridIds[j];if(this.marks[id]===stamp||!(this.masks[id]&mask))continue;this.marks[id]=stamp;
          const p=id*6,b=this.bounds;if(b[p]>x1||b[p+3]<x0||b[p+2]>z1||b[p+5]<z0)continue;
          const hit=visit(id);if(hit)return hit;
        }
      }return null;
    }
    overlap(x,y,z,height,radius=.32,mask=1){
      const b=this.bounds,ps=this.planes,off=this.offsets;
      return !!this.each(x-radius,z-radius,x+radius,z+radius,mask,id=>{
        const q=id*6;if(y>=b[q+4]-EPS||y+height<=b[q+1]+EPS)return false;
        for(let k=off[id]*4;k<off[id+1]*4;k+=4){const nx=ps[k],ny=ps[k+1],nz=ps[k+2],r=(this.masks[id]&4)||ny>.69?0:radius;if(nx*x+ny*(ny<0?y+height:y)+nz*z-r*(Math.abs(nx)+Math.abs(nz))>=ps[k+3]-EPS)return false;}
        return true;
      });
    }
    hullRay(id,o,d,limit,radius=0,height=0){
      // Terrain uses a centre-foot contact, like the procedural ramps. Expanding
      // individual floor triangles sideways creates false ridges at shared edges.
      if(height&&(this.masks[id]&4))radius=0;
      const ps=this.planes;let enter=-Infinity,leave=limit,normal=null,inside=true;
      // Physics files can contain open, zero-thickness decorative hulls. Their authored AABB
      // remains part of the hull; a plane intersection must never escape those bounds.
      for(let axis=0;axis<3;axis++){
        const lo=this.bounds[id*6+axis]-(axis===1?height:radius),hi=this.bounds[id*6+axis+3]+(axis===1?0:radius);
        if(o[axis]<lo-EPS||o[axis]>hi+EPS)inside=false;
        if(Math.abs(d[axis])<1e-10){if(o[axis]<lo-EPS||o[axis]>hi+EPS)return null;continue;}
        let a=(lo-o[axis])/d[axis],b=(hi-o[axis])/d[axis],sign=-1;if(a>b){[a,b]=[b,a];sign=1;}
        if(a>enter){enter=a;normal=[0,0,0];normal[axis]=sign;}leave=Math.min(leave,b);if(enter>leave+EPS)return null;
      }
      for(let p=this.offsets[id]*4;p<this.offsets[id+1]*4;p+=4){
        const nx=ps[p],ny=ps[p+1],nz=ps[p+2],dist=ps[p+3]+radius*(Math.abs(nx)+Math.abs(nz))-Math.min(ny,0)*height;
        const s=nx*o[0]+ny*o[1]+nz*o[2]-dist,den=nx*d[0]+ny*d[1]+nz*d[2];if(s>EPS)inside=false;
        if(Math.abs(den)<1e-10){if(s>EPS)return null;continue;}
        const t=-s/den;
        if(den<0){if(t>enter){enter=t;normal=[nx,ny,nz];}}else leave=Math.min(leave,t);
        if(enter>leave+EPS)return null;
      }
      if(enter< -EPS||enter>limit+EPS||leave<0||!normal)return null;
      return {t:Math.max(0,enter),n:normal,inside,id};
    }
    sweep(o,d,limit=1,radius=0,height=0,mask=2){
      const end=[o[0]+d[0]*limit,o[1]+d[1]*limit,o[2]+d[2]*limit],lowY=Math.min(o[1],end[1]),highY=Math.max(o[1],end[1])+height,b=this.bounds;let best=null;
      this.each(Math.min(o[0],end[0])-radius,Math.min(o[2],end[2])-radius,Math.max(o[0],end[0])+radius,Math.max(o[2],end[2])+radius,mask,id=>{
        const p=id*6;if(b[p+1]>highY+EPS||b[p+4]<lowY-EPS)return;
        const hit=this.hullRay(id,o,d,best?best.t:limit,radius,height);if(hit&&(!best||hit.t<best.t))best=hit;
      });return best;
    }
    ray(o,d,limit=300){
      // A two-dimensional grid walk avoids scanning every cell in a long diagonal shot.
      const b=this.bounds,ps=this.planes;let best=null,stamp=++this.stamp;if(stamp>=4294967295){this.marks.fill(0);this.stamp=stamp=1;}
      const end=[o[0]+d[0]*limit,o[2]+d[2]*limit];let x=this.cx(o[0]),z=this.cz(o[2]),ex=this.cx(end[0]),ez=this.cz(end[1]);
      const sx=Math.sign(d[0]),sz=Math.sign(d[2]),stepX=sx?this.tile/Math.abs(d[0]):Infinity,stepZ=sz?this.tile/Math.abs(d[2]):Infinity;
      let tx=sx?(this.minX+(x+(sx>0?1:0))*this.tile-o[0])/d[0]:Infinity,tz=sz?(this.minZ+(z+(sz>0?1:0))*this.tile-o[2])/d[2]:Infinity;
      for(let visited=0;visited<this.w+this.h+4;visited++){
        const cell=z*this.w+x;
        for(let k=this.gridStarts[cell];k<this.gridStarts[cell+1];k++){
          const id=this.gridIds[k];if(this.marks[id]===stamp||!(this.masks[id]&2))continue;this.marks[id]=stamp;
          const p=id*6,max=best?best.t:limit,minY=Math.min(o[1],o[1]+d[1]*max),maxY=Math.max(o[1],o[1]+d[1]*max);
          if(b[p+1]>maxY||b[p+4]<minY)continue;
          const hit=this.hullRay(id,o,d,max);if(hit&&(!best||hit.t<best.t))best=hit;
        }
        if((x===ex&&z===ez)||Math.min(tx,tz)>(best?best.t:limit))break;
        if(tx<tz){x+=sx;tx+=stepX;}else{z+=sz;tz+=stepZ;}
        if(x<0||z<0||x>=this.w||z>=this.h)break;
      }return best;
    }
    floors(x,z,min=this.floorMin,max=this.floorMax){
      const ps=this.planes,b=this.bounds,result=[];
      this.each(x,z,x,z,1,id=>{
        const q=id*6;if(b[q+4]<min||b[q+1]>max)return;
        for(let p=this.offsets[id]*4;p<this.offsets[id+1]*4;p+=4){
          if(ps[p+1]<.69)continue;const y=(ps[p+3]-ps[p]*x-ps[p+2]*z)/ps[p+1];if(y<min-EPS||y>max+EPS||y<b[q+1]-.001||y>b[q+4]+.001)continue;
          let valid=true;for(let k=this.offsets[id]*4;k<this.offsets[id+1]*4;k+=4)if(ps[k]*x+ps[k+1]*y+ps[k+2]*z>ps[k+3]+.001){valid=false;break;}
          if(valid&&!result.some(v=>Math.abs(v-y)<.015))result.push(y);
        }
      });return result.sort((a,b)=>a-b);
    }
    ground(x,z,reference=this.floorMax){const floors=this.floors(x,z,this.meta.bounds[1]-1,Math.min(this.meta.bounds[4]+1,reference+.505));return floors.length?floors.at(-1):this.meta.bounds[1]-1000;}
    spawnGround(x,z){
      const spawn=this.meta.t.concat(this.meta.ct).find(p=>Math.hypot(p[0]-x,p[1]-z)<.2);
      const reference=spawn?spawn[3]:this.bakedNav?this.bakedNav.height[this.cell(this.bakedNav,x,z,NaN)]:this.floorMax;
      return this.ground(x,z,reference);
    }
    slide(position,velocity,height,dt,radius){
      const p=position.slice(),v=velocity.slice();let time=dt,ground=false,wall=false;
      for(let i=0;i<4&&time>1e-6;i++){
        const d=v.map(a=>a*time),hit=this.sweep(p,d,1,radius,height,1),t=hit?Math.max(0,hit.t-1e-5):1;
        for(let a=0;a<3;a++)p[a]+=d[a]*t;if(!hit)break;
        time*=1-hit.t;if(hit.n[1]>.69)ground=true;else if(Math.abs(hit.n[1])<.69)wall=true;
        const into=v[0]*hit.n[0]+v[1]*hit.n[1]+v[2]*hit.n[2];if(into>=0)break;
        for(let a=0;a<3;a++)v[a]-=hit.n[a]*into;
      }return {p,v,ground,wall};
    }
    move(e,dt,radius=.32,step=.5){
      const p=[e.pos.x,e.pos.y,e.pos.z],v=[e.vel.x,e.vel.y,e.vel.z],wasGround=e.onGround;
      if(wasGround&&v[1]<=.5&&!e.climbing){
        // Sweep the body above the step window, then place the feet on the actual
        // supporting surfaces. Triangle seams and stair risers are not side walls.
        const lift=step+.008,horizontal=this.slide([p[0],p[1]+lift,p[2]],[v[0],0,v[2]],e.h-lift,dt,radius);
        let floor=-Infinity;
        const foot=radius+.003;
        for(const [dx,dz]of [[0,0],[-foot,-foot],[-foot,foot],[foot,-foot],[foot,foot]]){
          for(const y of this.floors(horizontal.p[0]+dx,horizontal.p[2]+dz,p[1]-.34,p[1]+step+.002))floor=Math.max(floor,y);
        }
        if(Number.isFinite(floor)&&!this.overlap(horizontal.p[0],floor+.002,horizontal.p[2],e.h,radius)){
          e.pos.set(horizontal.p[0],floor+.002,horizontal.p[2]);e.vel.set(horizontal.v[0],0,horizontal.v[2]);e.onGround=true;return;
        }
        if(!Number.isFinite(floor)){
          const fall=this.slide([horizontal.p[0],p[1],horizontal.p[2]],[0,v[1],0],e.h,dt,radius);
          e.pos.set(...fall.p);e.vel.set(horizontal.v[0],fall.v[1],horizontal.v[2]);e.onGround=fall.ground;return;
        }
      }
      // A surface-mesh floor can slope underneath the player's footprint. Place grounded
      // feet on the swept footprint, rather than inside a thin prism at its centre height.
      if(this.meta.surfaceCollision&&wasGround&&v[1]<=.5){
        const support=this.sweep([p[0],p[1]+step+.01,p[2]],[0,-step-.03,0],1,radius,e.h,1);
        if(support&&support.n[1]>.69){const y=p[1]+step+.01-(step+.03)*support.t;
          if(y>p[1]&&y-p[1]<=step&&!this.overlap(p[0],y+.001,p[2],e.h,radius))p[1]=y+.0001;
        }
      }
      let result=this.slide(p,v,e.h,dt,radius);
      // Degrau: tenta subir só o necessário (6 cm, 12 cm ... até o limite). Levantar sempre o máximo fazia a cabeça
      // bater no teto de escadas cobertas e arcos, e o degrau baixo era recusado.
      // Também quando a quina do degrau devolve uma "rampa" (normal inclinada conta como chão e não como parede):
      // sem isso o boneco era jogado para cima, perdia o chão e subia a escada se arrastando.
      const want=Math.hypot(v[0],v[2])*dt,flat=Math.hypot(result.p[0]-p[0],result.p[2]-p[2]);
      if(wasGround&&v[1]<=.5&&want>1e-4&&(result.wall||flat<want*.9||result.v[1]>.5)){
        for(const h of [.06,.12,.2,.3,.4,step]){
          if(h>step)break;const lift=this.sweep(p,[0,h+.005,0],1,radius,e.h,1);if(lift)break;
          const raised=[p[0],p[1]+h+.005,p[2]],up=this.slide(raised,[v[0],0,v[2]],e.h,dt,radius),down=this.sweep(up.p,[0,-h-.1,0],1,radius,e.h,1);
          if(!down||down.n[1]<=.69)continue;const y=up.p[1]-(h+.1)*down.t;
          if(y<=p[1]+h+.002&&Math.hypot(up.p[0]-p[0],up.p[2]-p[2])>flat+.0001&&!this.overlap(up.p[0],y+.001,up.p[2],e.h,radius)){result={p:[up.p[0],y,up.p[2]],v:[up.v[0],0,up.v[2]],ground:true};break;}
        }
      }
      if(wasGround&&v[1]<=0&&!result.ground){const snap=this.sweep([result.p[0],result.p[1]+.015,result.p[2]],[0,-.34,0],1,radius,e.h,1);if(snap&&snap.n[1]>.69){result.p[1]+=.015-.34*snap.t;result.v[1]=0;result.ground=true;}}
      e.pos.set(...result.p);e.vel.set(...result.v);e.onGround=result.ground;
      if(!wasGround&&e.onGround){e.landSpread=Math.min(.025,Math.abs(v[1])*.0014);if(v[1]<-5.5&&e.onLand)e.onLand(v[1]);}
    }
    climb(e,wx,wz,jump,radius=.3){
      const p=e.pos,ladder=!jump&&(this.meta.ladders||[]).find(b=>p.y+e.h>b[1]&&p.y<b[4]+.1&&p.x>b[0]-radius-.08&&p.x<b[3]+radius+.08&&p.z>b[2]-radius-.08&&p.z<b[5]+radius+.08);
      if(!ladder){e.climbing=false;return;}
      const axis=ladder[3]-ladder[0]<ladder[5]-ladder[2]?'x':'z',center=axis==='x'?(ladder[0]+ladder[3])/2:(ladder[2]+ladder[5])/2,direction=Math.sign(center-p[axis])||1,toward=(axis==='x'?wx:wz)*direction;
      // Source ladder triggers extend to head height. The usable landing may be
      // below the trigger's top and beside the shaft, rather than behind it.
      if(toward>.1&&p.y+e.h>=ladder[4]-.5){
        const a=axis==='x'?0:2,side=2-a,base=[p.x,p.y,p.z],targets=[];
        for(const reach of [.16,.35,radius+.38]){const at=base.slice();at[a]=center+direction*reach;targets.push(at);}
        {const at=base.slice();at[a]-=direction*.8;targets.push(at);}
        for(const sign of [-1,1]){const at=base.slice();at[side]+=sign*(radius+.75);targets.push(at);}
        for(const at of targets){
          const y=this.ground(at[0],at[2],p.y),rise=y+.002-p.y;
          if(rise>=-.15&&rise<=.502&&!this.overlap(at[0],y+.002,at[2],e.h,radius)){
            const lifted=[p.x,y+.002,p.z],delta=[at[0]-p.x,0,at[2]-p.z];
            if((rise<=0||!this.sweep([p.x,p.y,p.z],[0,rise,0],1,radius,e.h,1))&&!this.sweep(lifted,delta,1,radius,e.h,1)){
              p.set(at[0],y+.002,at[2]);e.vel.y=0;e.vel[axis]=0;e.climbing=false;e.onGround=true;return;
            }
          }
        }
      }
      e.climbing=true;e.onGround=false;e.vel.y=Math.abs(toward)>.1?Math.sign(toward)*3:0;e.vel[axis]=0;
    }
    navClear(x,y,z){return !this.overlap(x,y+.46,z,1.8-.46);}
    navStep(ax,az,y,bx,bz,steps=5){for(let i=1;i<=steps;i++){const k=i/steps,x=ax+(bx-ax)*k,z=az+(bz-az)*k,next=this.ground(x,z,y);if(Math.abs(next-y)>.505||!this.navClear(x,next,z))return NaN;y=next;}return y;}
    buildNav(ax,az){
      if(this.bakedNav){this.bakedNav.seen.fill(0);this.bakedNav.stamp=0;return this.bakedNav;}
      const step=.7,minX=-ax+.5,minZ=-az+.5,w=Math.ceil((ax*2-1)/step)+1,h=Math.ceil((az*2-1)/step)+1,plane=w*h,layers=4,n=plane*layers;
      const nav={source:true,step,minX,minZ,w,h,plane,layers,layered:true,open:new Uint8Array(n),links:new Int32Array(n*4).fill(-1),height:new Float32Array(n),seen:new Int32Array(n),parent:new Int32Array(n),queue:new Int32Array(n),stamp:0,walk:[]};
      const X=id=>minX+(id%w)*step,Z=id=>minZ+Math.floor((id%plane)/w)*step;
      for(let id=0;id<plane;id++){
        const x=X(id),z=Z(id),candidates=this.floors(x,z),floors=candidates.filter(y=>!candidates.some(other=>other>y+.01&&other<y+1.8)&&this.navClear(x,y,z));
        for(let layer=0;layer<Math.min(floors.length,layers);layer++){const q=id+layer*plane;nav.height[q]=floors[layer];nav.open[q]=1;}
      }
      for(let id=0;id<n;id++)if(nav.open[id]){
        const cell=id%plane,x=cell%w,z=Math.floor(cell/w),next=[x?cell-1:-1,x<w-1?cell+1:-1,z?cell-w:-1,z<h-1?cell+w:-1];
        for(let d=0;d<4;d++)if(next[d]>=0){
          const endY=this.navStep(X(id),Z(id),nav.height[id],X(next[d]),Z(next[d]));if(!Number.isFinite(endY))continue;
          let target=-1,distance=.05;for(let layer=0;layer<layers;layer++){const q=next[d]+layer*plane,delta=Math.abs(nav.height[q]-endY);if(nav.open[q]&&delta<distance){distance=delta;target=q;}}nav.links[id*4+d]=target;
        }
      }
      for(let p=0;p<nav.links.length;p++){const next=nav.links[p];if(next>=0&&nav.links[next*4+((p%4)^1)]!==(p>>2))nav.links[p]=-1;}
      // Select the playable component containing the actual BSP spawns, not the scenery outside the map.
      const starts=this.meta.t.concat(this.meta.ct),components=[];
      for(let first=0;first<n;first++)if(nav.open[first]&&!nav.seen[first]){
        let head=0,tail=1;nav.queue[0]=first;nav.seen[first]=components.length+1;
        while(head<tail){const id=nav.queue[head++];for(let d=0;d<4;d++){const next=nav.links[id*4+d];if(next>=0&&!nav.seen[next]){nav.seen[next]=components.length+1;nav.queue[tail++]=next;}}}
        components.push(Array.from(nav.queue.subarray(0,tail)));
      }
      const scores=components.map(()=>0);
      for(const p of starts){const cell=this.cell(nav,p[0],p[1],this.ground(p[0],p[1],p[3]),true),component=nav.seen[cell]-1;if(component>=0)scores[component]++;}
      let best=-1;for(let i=0;i<components.length;i++)if(best<0||scores[i]>scores[best]||scores[i]===scores[best]&&components[i].length>components[best].length)best=i;
      if(best<0)throw Error('Source map has no navigable floor');nav.walk=components[best];nav.open.fill(0);for(const id of nav.walk)nav.open[id]=1;nav.seen.fill(0);
      nav.audit={components:components.length,spawnsConnected:scores[best],spawnsTotal:starts.length,nodes:nav.walk.length,regions:components.map((c,i)=>({nodes:c.length,spawns:scores[i]})).sort((a,b)=>b.spawns-a.spawns||b.nodes-a.nodes).slice(0,8)};return nav;
    }
    cell(nav,x,z,y=this.floorMax,initial=false){
      if(nav.compact){
        if(!nav.cells){nav.cells=new Map();for(let i=0;i<nav.x.length;i++){const key=Math.round((nav.z[i]-nav.minZ)/nav.step)*nav.w+Math.round((nav.x[i]-nav.minX)/nav.step);if(!nav.cells.has(key))nav.cells.set(key,[]);nav.cells.get(key).push(i);}}
        const cx=Math.round((x-nav.minX)/nav.step),cz=Math.round((z-nav.minZ)/nav.step);let best=-1,distance=Infinity;
        for(let r=0;r<=5;r++){for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(r&&Math.abs(dx)!==r&&Math.abs(dz)!==r)continue;for(const id of nav.cells.get((cz+dz)*nav.w+cx+dx)||[]){const dy=Number.isFinite(y)?Math.abs(nav.height[id]-y):0;if(dy>1.1)continue;const d=(nav.x[id]-x)**2+(nav.z[id]-z)**2+dy*dy;if(d<distance){distance=d;best=id;}}}if(best>=0&&r*nav.step>Math.sqrt(distance)+nav.step)break;}
        return best>=0?best:initial?-1:0;
      }
      const cx=Math.max(0,Math.min(nav.w-1,Math.round((x-nav.minX)/nav.step))),cz=Math.max(0,Math.min(nav.h-1,Math.round((z-nav.minZ)/nav.step)));let best=-1,bestDistance=Infinity;
      for(let r=0;r<=5;r++){for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
        if(r&&Math.abs(dx)!==r&&Math.abs(dz)!==r)continue;const ix=cx+dx,iz=cz+dz;if(ix<0||iz<0||ix>=nav.w||iz>=nav.h)continue;
        for(let layer=0;layer<nav.layers;layer++){const q=iz*nav.w+ix+layer*nav.plane;if(!nav.open[q])continue;const vertical=Math.abs(nav.height[q]-y);if(vertical>1.1)continue;const distance=(nav.minX+ix*nav.step-x)**2+(nav.minZ+iz*nav.step-z)**2+vertical*vertical;if(distance<bestDistance){bestDistance=distance;best=q;}}
      }if(best>=0&&r*nav.step>Math.sqrt(bestDistance)+nav.step)break;}
      return best>=0?best:initial?-1:nav.walk[0];
    }
    geometry(THREE){
      const g=new THREE.BufferGeometry(),m=this.mesh,colors=array(Uint8Array,m.color),c=new Float32Array(colors.length);for(let i=0;i<c.length;i++)c[i]=colors[i]/255;
      g.setAttribute('position',new THREE.BufferAttribute(array(Float32Array,m.position),3));g.setAttribute('normal',new THREE.BufferAttribute(array(Float32Array,m.normal),3));g.setAttribute('color',new THREE.BufferAttribute(c,3));g.setIndex(new THREE.BufferAttribute(array(Uint32Array,m.index),1));
      // Textura leve (mapas do Wingman): coordenadas de textura e o padrão procedural de cada vértice.
      if(m.uv){g.setAttribute('uv',new THREE.BufferAttribute(array(Float32Array,m.uv),2));const pat=array(Uint8Array,m.pattern),f=new Float32Array(pat.length);for(let i=0;i<f.length;i++)f[i]=pat[i];g.setAttribute('pattern',new THREE.BufferAttribute(f,1));}
      g.addGroup(0,m.opaque,0);const total=g.index.count;if(total>m.opaque)g.addGroup(m.opaque,total-m.opaque,1);g.computeBoundingSphere();return g;
    }
  }
  async function load(id){
    if(cache.has(id))return cache.get(id);if(pending.has(id))return pending.get(id);
    if(!['ribeira','estacao','sanctum','neon','forge','overgrowth','inferno','palace','factory'].includes(id))throw Error('Unknown Source map');
    const job=(async()=>{
      if(!globalThis.SOURCE_MAP_PAYLOADS?.[id])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/maps/'+id+'.js';script.onload=resolve;script.onerror=()=>reject(Error('Não foi possível carregar '+id));document.head.append(script);});
      const packed=array(Uint8Array,globalThis.SOURCE_MAP_PAYLOADS[id]),stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip')),data=JSON.parse(await new Response(stream).text());
      const map=new NativeMap(data);cache.set(id,map);delete globalThis.SOURCE_MAP_PAYLOADS[id];return map;
    })();pending.set(id,job);try{return await job;}finally{pending.delete(id);}
  }
  globalThis.SourceMaps={NativeMap,load,get:id=>cache.get(id),register:(id,data)=>{const map=new NativeMap(data);cache.set(id,map);return map;}};
})();
