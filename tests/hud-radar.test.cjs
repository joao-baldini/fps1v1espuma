const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const radar=require('../assets/ui/hud-radar.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('radar rotates the actual facing direction upward at every yaw',()=>{
  for(let yaw=-Math.PI;yaw<=Math.PI;yaw+=.17){
    const p=radar.project(3-Math.sin(yaw)*10,-8-Math.cos(yaw)*10,{x:3,z:-8,yaw},384,20);
    near(p.x,192);near(p.y,105);assert.equal(p.edge,false);
  }
});
test('radar preserves distances on both axes and clamps distant markers to its rim',()=>{
  const pose={x:0,z:0,yaw:.72};
  const a=radar.project(6,0,pose,384,20),b=radar.project(0,6,pose,384,20);
  near(Math.hypot(a.x-192,a.y-192),Math.hypot(b.x-192,b.y-192));
  const far=radar.project(100,-200,pose,384,20);
  assert.equal(far.edge,true);near(Math.hypot(far.x-192,far.y-192),174);
});
test('Finder uses the same uniform inverse transform on rectangular and square maps',()=>{
  for(const [ax,az] of [[27,28],[30,19],[27,32],[40,40]])for(const size of [384,512]){
    const metrics=radar.overview(ax,az,size),rect={left:73,top:111,width:337,height:337};
    for(const [x,z] of [[0,0],[-ax*.95,-az*.95],[ax*.95,az*.95],[-ax*.95,az*.95],[ax*.95,-az*.95],[3,-4]]){
      const px=rect.left+(size/2+x*metrics.scale)/size*rect.width;
      const py=rect.top+(size/2+z*metrics.scale)/size*rect.height;
      const world=radar.unproject(px,py,rect,metrics);assert.ok(world);near(world[0],x);near(world[1],z);
    }
  }
});
test('Finder rejects outside-circle, outside-map and unmeasurable clicks',()=>{
  const metrics=radar.overview(30,19,512),rect={left:0,top:0,width:512,height:512};
  for(const [x,y] of [[0,0],[512,512],[-1,256],[513,256],[256,20]])assert.equal(radar.unproject(x,y,rect,metrics),null);
  assert.equal(radar.unproject(0,0,{left:0,top:0,width:0,height:0},metrics),null);
});
test('all four map corners fit inside the circular Finder without stretching the map',()=>{
  for(const [ax,az] of [[27,28],[30,19],[27,32],[22,29]]){
    const m=radar.overview(ax,az,512);
    near(ax*m.scale/ax,az*m.scale/az);assert.ok(Math.hypot(ax*m.scale,az*m.scale)<254);
  }
});

function markerContext(mode,tdm=false){
  const P={id:'me',team:0,alive:true,pos:{x:0,z:0}};
  const actors=[P,{id:'ally',team:0,alive:true,pos:{x:3,z:4}},{id:'enemy',team:1,alive:true,pos:{x:8,z:9}},{id:'dead',team:0,alive:false,pos:{x:12,z:13}}];
  const context={G:{mode},P,DM:{tdm,actors},GHOSTS:[{x:20,z:21,team:0,until:200},{x:22,z:23,team:0,until:50},{x:24,z:25,team:1,until:200}],bombOn:()=>mode==='team',dmAllies:(a,b)=>a.team===b.team};
  const html=readFileSync(resolve(__dirname,'../index.html'),'utf8');
  const start=html.indexOf('function radarMarkers(t)'),end=html.indexOf('function radarSites()',start);
  vm.createContext(context);vm.runInContext(html.slice(start,end),context);return context;
}
test('radar shows live allies and authorized unexpired scan positions, never live enemies',()=>{
  const c=markerContext('team'),markers=c.radarMarkers(100);
  assert.deepEqual(Array.from(markers,p=>[p.x,p.z]),[[3,4],[20,21]]);
});
test('FFA and duels have no enemy radar; TDM shows only living teammates',()=>{
  for(const mode of ['dm','bot','online','aimbotz'])assert.equal(markerContext(mode).radarMarkers(100).length,0);
  assert.deepEqual(Array.from(markerContext('dm',true).radarMarkers(100),p=>[p.x,p.z]),[[3,4]]);
});
