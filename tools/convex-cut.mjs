// Convex solid minus an axis-aligned walking volume. Shared faces and collision use the same result.
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const epsilon=1e-7;
export function splitConvex(faces,plane){
  const result=[],cap=[];
  for(const face of faces){
    const out=[];
    for(let i=0;i<face.length;i++){
      const a=face[i],b=face[(i+1)%face.length],da=dot(plane.slice(0,3),a)-plane[3],db=dot(plane.slice(0,3),b)-plane[3];
      if(da<=epsilon)out.push(a);
      if((da<0)!==(db<0)){const t=da/(da-db),p=a.map((v,j)=>v+(b[j]-v)*t);out.push(p);cap.push(p);}
    }
    const clean=out.filter((p,i)=>Math.hypot(...sub(p,out[(i+out.length-1)%out.length]))>epsilon);
    if(clean.length>=3)result.push(clean);
  }
  const unique=[...new Map(cap.map(p=>[p.map(v=>v.toFixed(6)).join(','),p])).values()];
  if(unique.length>=3){
    const center=[0,1,2].map(i=>unique.reduce((n,p)=>n+p[i],0)/unique.length),normal=plane.slice(0,3);
    let u=cross(normal,Math.abs(normal[1])<.9?[0,1,0]:[1,0,0]);const len=Math.hypot(...u);u=u.map(v=>v/len);const v=cross(normal,u);
    unique.sort((a,b)=>Math.atan2(dot(sub(a,center),v),dot(sub(a,center),u))-Math.atan2(dot(sub(b,center),v),dot(sub(b,center),u)));
    result.push(unique);
  }
  return result;
}
export function subtractBox(faces,lo,hi){
  const vertices=faces.flat();
  for(let axis=0;axis<3;axis++)if(Math.max(...vertices.map(p=>p[axis]))<=lo[axis]+epsilon||Math.min(...vertices.map(p=>p[axis]))>=hi[axis]-epsilon)return [faces];
  let inside=faces;const outside=[];
  for(let axis=0;axis<3;axis++)for(const sign of [1,-1]){
    const p=[0,0,0,sign===1?hi[axis]:-lo[axis]];p[axis]=sign;
    const remainder=splitConvex(inside,p.map(v=>-v));if(remainder.length>=4)outside.push(remainder);
    inside=splitConvex(inside,p);if(inside.length<4)return outside;
  }
  return outside;
}
