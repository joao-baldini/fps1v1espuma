const {test}=require('node:test');
const assert=require('node:assert/strict');

test('Sanctum rebuild gives pallets their low profile, keeps stacked crate heights and preserves tilted solids',async()=>{
  const {sanctumPropParts}=await import('../tools/import-sanctum.mjs');
  const pallet=sanctumPropParts('models/props/de_inferno/shell_pallet.mdl');
  assert.equal(pallet[0].size[2],10);assert.ok(pallet.every(p=>p.center[2]+p.size[2]/2<=12));
  const wine=sanctumPropParts('models/props/de_inferno/hr_i/wine_crate_a/wine_crate_a.mdl');
  assert.deepEqual(wine[0].size,[64,64,61]);assert.equal(wine[0].solid,true);
  const tilted=sanctumPropParts('models/props/de_dust/hr_dust/dust_crates/dust_crate_style_02_37x37x74.mdl');
  assert.deepEqual(tilted[0].size,[37,37,74]);assert.equal(tilted[0].solid,true);
  const fence=sanctumPropParts('models/props/de_nuke/hr_nuke/chainlink_fence_001/chainlink_fence_001_256.mdl');
  assert.equal(fence[0].mask,1);assert.equal(fence[0].colliderOnly,true);
  assert.ok(fence.filter(p=>!p.colliderOnly).length>10,'visible fence has actual rails instead of a solid wall');
});

const cube=[[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],[[1,1,0],[0,1,0],[0,1,1],[1,1,1]],[[0,1,0],[0,0,0],[0,0,1],[0,1,1]]];
const volume=faces=>Math.abs(faces.reduce((sum,f)=>sum+f.slice(1,-1).reduce((s,b,i)=>{const a=f[0],c=f[i+2];return s+(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6},0),0));
test('spawn-clearance subtraction preserves volume and creates closed outward-facing convex pieces',async()=>{
  const {subtractBox}=await import('../tools/convex-cut.mjs');
  for(const [lo,hi,expected] of [[[.25,-1,-1],[.75,2,2],.5],[[.25,.25,.25],[.75,.75,.75],.875],[[2,2,2],[3,3,3],1],[[-1,-1,-1],[2,2,2],0]]){
    const parts=subtractBox(cube,lo,hi);assert.ok(Math.abs(parts.reduce((s,f)=>s+volume(f),0)-expected)<1e-8);
    for(const faces of parts){const points=faces.flat(),center=[0,1,2].map(i=>points.reduce((s,p)=>s+p[i],0)/points.length);
      for(const face of faces){const a=face[0],b=face[1],c=face[2],u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        assert.ok(n.reduce((s,x,i)=>s+x*(center[i]-a[i]),0)<=1e-8,'outward cap');
      }
    }
  }
});
