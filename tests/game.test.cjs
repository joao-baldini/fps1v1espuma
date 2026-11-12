const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');
require('../assets/maps/runtime.js');
require('../assets/agents/models.js');
const sourceCatalog={};vm.runInNewContext(readFileSync(resolve(__dirname,'../assets/maps/catalog.js'),'utf8'),sourceCatalog);
vm.runInNewContext(readFileSync(resolve(__dirname,'../assets/maps/prefire-catalog.js'),'utf8'),sourceCatalog);
vm.runInNewContext(readFileSync(resolve(__dirname,'../assets/maps/warface-catalog.js'),'utf8'),sourceCatalog);
const sourcePacked={};
for(const id of ['guard','elysion','inferno','palace','factory']){
  const text=readFileSync(resolve(__dirname,'../assets/maps/'+id+'.js'),'utf8'),encoded=text.match(/\.(?:guard|elysion|inferno|palace|factory)=("[A-Za-z0-9+/=]+");/);
  assert.ok(encoded,'Missing generated BSP payload: '+id);sourcePacked[id]=JSON.parse(gunzipSync(Buffer.from(JSON.parse(encoded[1]),'base64')));
}
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Run the game's actual simulation functions without WebGL, networking or a browser.
function section(start, end) {
  const a = script.indexOf(start), b = script.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Missing source section: ${start}`);
  return script.slice(a, b);
}
class Vec {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  normalize() { const n = Math.hypot(this.x, this.y, this.z); return this.set(this.x / n, this.y / n, this.z / n); }
  negate() { return this.set(-this.x, -this.y, -this.z); }
}
function game(saved) {
  let clock = 10000, seed = 92741;
  const events = [], keys = new Set();
  const floor = { min: [-1000, -1, -1000], max: [1000, 0, 1000] };
  const sourceInstances=new Map(),SourceMaps={get:id=>{if(!sourceInstances.has(id)){const map=new globalThis.SourceMaps.NativeMap(sourcePacked[id]);map.geometry=()=>({dispose(){}});sourceInstances.set(id,map);}return sourceInstances.get(id);}};
  const context = vm.createContext({
    SOURCE_MAP_CATALOG:sourceCatalog.SOURCE_MAP_CATALOG,INFERNO_PREFIRE:sourceCatalog.INFERNO_PREFIRE,WARFACE_MAP_CATALOG:sourceCatalog.WARFACE_MAP_CATALOG,SourceMaps,sourceWorld:null,sourceGlassMat:null,
    performance: { now: () => clock }, localStorage: { getItem: () => saved ? JSON.stringify(saved) : null }, V3: Vec,
    boxes: [floor], ramps: [], STEP_UP: .5, AX: 30, AZ: 30, C: 1.2, WALL_H: 7,
    THREE: { Color: class {}, Mesh: class { constructor(geometry) { this.geometry = geometry; } } },
    scene: { add() {}, remove() {} }, worldMat: null, worldMesh: null,
    addBoxTo() {}, geoFrom() { return { dispose() {} }; },
    MAP: { spawn: { hx: 2, z0: 20, z1: 24 }, exit: { zc: -20, hw: 7 } },
    G: { mode: 'bot', me: 'A', opp: 'B', stats: {}, names: {}, view: { ph: 'live', m: 'match', r: 1 } },
    PCOLORS: { red:'#d8432c', orange:'#f08a24', yellow:'#f2c230', green:'#3fae4a', purple:'#8a4fd8', pink:'#e85aa8', black:'#2b2d33' },
    Math: Object.assign(Object.create(Math), { random: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) }),
    OPP: { cur: null, flashUntil: 0 }, keys, K: key => keys.has(key), locked: true,
    AU: new Proxy({}, { get: () => () => {} }),
    applyFov() {}, hitmark() {}, dmgDir() {}, flashRed() {}, addDecal() {}, tracer() {},
    remoteShotFx() {}, banner() {}, killBanner() {}, healFx() {}, spat: () => ({ v:.5, pan:0 }), addFeed: (killer,victim,w,hs) => events.push({topic:'feed',killer,victim,w,hs}),
    netSend: e => events.push(e), emit: (topic, data) => events.push({ topic, data }),
    botEmit: (topic, data) => events.push({ topic, data }),
    spawnPoint: (side,spec) => ({ x: spec?spec[0]:0, y: spec?context.groundAt(spec[0], spec[1]):0, z: spec?spec[1]:0, yaw: spec?spec[2]:0 }),
    setTimeout() {}, console,
  });
  vm.runInContext(section('const V3 =', '/* ================= Configurações').replace('const V3 = THREE.Vector3, ', 'const '), context);
  vm.runInContext(section('const VIEWMODEL_LIMITS =', '/* ================= Render'), context);
  vm.runInContext(section('const THEMES =', 'const RAMP_FLIP'), context);
  vm.runInContext(section('function stat(', '/* ================= Rede P2P'), context);
  vm.runInContext(section('const RAMP_FLIP', '// Rotação:'), context);
  vm.runInContext(section('function overlap(', '/* ================= Áudio'), context);
  vm.runInContext(section('const P =', 'const G ='), context);
  vm.runInContext(section('const INTERP =', '/* ================= Rodadas'), context);
  vm.runInContext(section('function spawnSelf(', '/* ================= Oponente na tela'), context);
  vm.runInContext(section('const KNIFE_REST =', 'function fitKnifeArm'), context);
  const state = vm.runInContext('({P, S, W, ORDER, CATEGORIES, BOT, LEVELS, configureLoadout, damageFor, physics, playerInput, inaccuracy, spawnSelf, selectWeapon, inspect, shoot, updateWeapon, startReload, botSpawn, botUpdate, botDamage, sampleKnifePose, sampleKnifeAnimation, beginKnifeAnimation, BF_DRAW, BF_INSPECT, KNIFE_CLIPS, KNIFE_DURATIONS, KARAMBIT_CLIPS, KARAMBIT_DURATIONS, sampleKarambitPose, sampleKarambitIdle, PHYS_STEP, BHOP_CAP, MAPS, DM, DM_POOLS, DM_BOT_NAMES, dmLoadoutOrder, dmBuildNav, dmSetup, dmTick, dmDamage, dmRespawn, dmChooseSpawn, dmRefreshTargets, dmCell, dmFindPath, dmWalkClear, dmBotFire, dmRanking, dmFinish, dmStop, dmKillReward, trace, clearLine, overlapAny, stat})', context);
  return Object.assign(state, { context, events, keys, tick: value => { clock = value; }, floor });
}
function dmWorld(g, map='deathmatch') {
  g.context.G.mode='dm';g.context.G.opp=null;
  g.context.buildMap(map);
  g.dmBuildNav();return g;
}
function deathmatch(category='all',level='medio',map='deathmatch') {
  const g=dmWorld(game(),map);g.S.dmWeapons=category;g.S.dmLevel=level;
  g.dmSetup(10000);
  g.advance=(milliseconds,dt=1/60)=>{const end=g.time+milliseconds;while(g.time<end){g.time=Math.min(end,g.time+dt*1000);g.tick(g.time);g.dmTick(dt,g.time);}};
  g.time=10000;return g;
}
function entity(x = 0, z = 0) {
  return { pos: new Vec(x, 0, z), vel: new Vec(), h: 1.8, onGround: true, crouch: false, landSpread: 0 };
}

test('the complete game script parses', () => new vm.Script(script));

test('all five agents have distinct, bounded, outward-facing low-poly models without texture assets',()=>{
  const ids=vm.runInContext('Object.keys(OPS)',game().context),models=globalThis.AgentModels;
  assert.deepEqual(Array.from(ids),Object.keys(models.styles));
  const signatures=new Set();
  for(const id of ids){
    const parts=models.parts(id);assert.equal(models.parts(id),parts);signatures.add(JSON.stringify(parts));
    let triangles=0;
    for(const list of Object.values(parts))for(const [lo,hi,color,mesh]of list){
      assert.ok(Number.isInteger(color)&&color>=0&&color<=0xffffff);triangles+=mesh?mesh.indices.length/3:12;
      const points=mesh?Array.from({length:mesh.vertices.length/3},(_,i)=>mesh.vertices.slice(i*3,i*3+3)):[lo,hi];
      for(const p of points){assert.ok(p.every(Number.isFinite));assert.ok(Math.abs(p[0])<.42&&p[1]>=0&&p[1]<1.9&&Math.abs(p[2])<.6,id+' model exceeds actor silhouette');}
      if(mesh){
        const center=[0,1,2].map(axis=>points.reduce((sum,p)=>sum+p[axis],0)/points.length);
        for(let i=0;i<mesh.indices.length;i+=3){const [a,b,c]=mesh.indices.slice(i,i+3).map(id=>points[id]),u=b.map((v,j)=>v-a[j]),v=c.map((n,j)=>n-a[j]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(n.reduce((sum,n,j)=>sum+n*(a[j]-center[j]),0)>1e-10,id+' inward-facing triangle');}
      }
    }
    assert.ok(triangles<1200,id+' exceeds character triangle budget');
  }
  assert.equal(signatures.size,5);
});

test('agent instances replace the default body only in bomb mode and follow the shared crouch pose',()=>{
  const g=game(),cx=g.context,ids=Object.keys(globalThis.AgentModels.styles),instance=()=>({count:0,instanceMatrix:{},placed:[],setMatrixAt(i,p){this.placed[i]=p;},setColorAt(){}});
  const base={legs:instance(),body:instance(),head:instance()},agents=Object.fromEntries(ids.map(id=>[id,{legs:instance(),body:instance(),head:instance()}])),bands=instance();
  const dummy={position:new Vec(),scale:new Vec(),rotation:new Vec(),updateMatrix(){this.matrix={y:this.position.y,sy:this.scale.y};}};
  g.DM.mode='team';g.P.team=0;vm.runInContext('ARENA.bomb=true',cx);
  const actors=ids.map((op,index)=>({id:'agent'+index,op,team:1,alive:true,pos:new Vec(index,0,0),vel:new Vec(),yaw:0,crouch:index%2===0,w:'rifle',color:0x3e6fb0}));
  g.DM.actors=[g.P,...actors];g.DM.render={...base,agents,agentBands:bands,guns:{},dummy,color:{set(){}},meshes:[...Object.values(base),bands,...Object.values(agents).flatMap(Object.values)]};
  cx.dmRender(10000);assert.equal(base.body.count,0);assert.equal(bands.count,5);
  for(const actor of actors){const r=agents[actor.op];assert.equal(r.body.count,1);assert.ok(Math.abs(r.head.placed[0].y-(actor.crouch?-.65:0))<1e-8);assert.ok(Math.abs(r.legs.placed[0].sy-(actor.crouch?1-.65/.81:1))<1e-8);}
  vm.runInContext('ARENA.bomb=false',cx);cx.dmRender(10000);assert.equal(base.body.count,5);assert.ok(Object.values(agents).every(r=>r.body.count===0));
});

test('only exact KQLY snaps a real shot to a head through walls, consuming normal ammo', () => {
  for(const name of ['KQLY','kqly','Kqly',' KQLY','KQLY ','forsaken','Jogador']){
    const g=game({name}),cx=g.context;
    g.spawnSelf(0,[0,0,0]);g.botSpawn(1,[8,-12,0]);g.BOT.helmet=true;
    cx.OPP.cur={x:8,y:0,z:-12,a:1,c:0,helmet:true};
    cx.boxes.push({min:[-30,0,-5],max:[30,5,-4]});
    g.P.yaw=g.P.pitch=0;
    const ammo=g.P.ammo.rifle.mag;
    assert.equal(g.BOT.hp,100);
    g.shoot(12000,false);
    assert.equal(g.P.ammo.rifle.mag,ammo-1,name);
    if(name==='KQLY'){
      assert.equal(g.BOT.alive,false);
      assert.equal(g.P.recoilP,0);assert.equal(g.P.recoilY,0);
      assert.ok(Math.abs(g.P.yaw-Math.atan2(-8,12))<1e-12);
      assert.ok(g.events.some(e=>e.topic==='dead'&&e.data.h===1));
    }else{
      assert.equal(g.BOT.hp,100,name);
      assert.equal(g.P.yaw,0,name);assert.equal(g.P.pitch,0,name);
    }
  }
});

test('KQLY picks the closest angular head and ignores allies, corpses and protected spawns', () => {
  const g=game({name:'KQLY'}),cx=g.context;
  cx.G.mode='team';g.DM.mode='team';g.spawnSelf(0,[0,0,0]);g.P.team=0;
  const actor=(id,x,z,opts={})=>({id,pos:new Vec(x,0,z),alive:true,team:1,...opts});
  const far=actor('far',.25,-20),near=actor('near',3,-5);
  g.DM.actors=[g.P,actor('ally',0,-3,{team:0}),actor('dead',0,-6,{alive:false}),
    actor('safe',0,-8,{safeUntil:20000}),near,far];
  g.P.yaw=g.P.pitch=0;
  assert.equal(cx.aimbotTarget(cx.eyePos(),10000).actor,'far');
  assert.equal(g.P.yaw,0); // Choosing a candidate alone never changes the camera.
  far.pos.y=3;far.crouch=true;
  g.P.pitch=Math.atan2(3+1.15-.14-g.P.eyeOff,20);g.P.recoilY=.1;g.P.yaw=-.045;
  const aim=cx.aimbotTarget(cx.eyePos(),10000);
  assert.equal(aim.actor,'far');assert.ok(Math.abs(aim.point[1]-4.01)<1e-12);
  far.alive=near.alive=false;
  assert.equal(cx.aimbotTarget(cx.eyePos(),10000),null);
});

test('KQLY leaves empty shots and knives alone and sends headshot damage in online duels', () => {
  const g=game({name:'KQLY'}),cx=g.context;
  g.spawnSelf(0,[0,0,0]);g.botSpawn(1,[8,-12,0]);g.P.yaw=g.P.pitch=0;
  g.P.ammo.rifle.mag=0;g.shoot(12000,false);
  assert.equal(g.P.yaw,0);assert.equal(g.BOT.hp,100);
  g.selectWeapon('knife');g.shoot(13000,false);
  assert.equal(g.P.yaw,0);assert.equal(g.BOT.hp,100);
  cx.G.mode='online';cx.G.view.ph='live';
  cx.OPP.cur={x:8,y:2,z:-12,c:1,a:1,helmet:false};
  cx.boxes.push({min:[-20,0,-5],max:[20,6,-4]});
  g.selectWeapon('rifle');g.P.ammo.rifle.mag=30;g.shoot(15000,false);
  const hit=g.events.findLast(e=>e.topic==='hit');
  assert.ok(hit);assert.equal(hit.data.p,'head');assert.equal(hit.data.w,'rifle');
  assert.ok(hit.data.d>=100);
  cx.OPP.cur.a=0;
  assert.equal(cx.aimbotTarget(cx.eyePos(),15000),null);
});

test('KQLY deals head damage to the selected actor in DM, teams and Aimbotz', () => {
  for(const mode of ['dm','team','aimbotz']){
    const g=game({name:'KQLY'}),cx=g.context;
    cx.buildMap('aimbotz');g.spawnSelf(0,[0,9,0]);cx.G.mode='aimbotz';cx.aimbotzSetup();
    cx.aimbotzSetBots(2);cx.G.mode=mode;cx.G.view.ph='live';
    g.DM.mode=mode==='team'?'team':'dm';g.DM.active=true;g.DM.phase='live';g.DM.endsAt=100000;
    const [target,other]=g.DM.actors.slice(1);g.P.team=0;target.team=1;other.team=mode==='team'?0:1;
    target.pos.set(4,0,-4);other.pos.set(-7,0,-4);target.hp=200;target.helmet=true;
    g.dmRefreshTargets();g.P.yaw=g.P.pitch=0;
    cx.boxes.push({min:[-20,0,5],max:[20,5,6]});
    g.shoot(12000,false);
    assert.equal(target.hp,200-g.damageFor(g.W.rifle,'head',true,Math.hypot(4,13,.26)),mode);
    assert.equal(other.hp,100,mode);
  }
});

test('scope input keeps its timing gates and passes weapon, skin and zoom level to audio', () => {
  const g=game(),cx=g.context,events=[];
  cx.AU=new Proxy({}, {get:(_,key)=>(...args)=>{if(key==='scope')events.push(args);}});
  g.P.weapon='sniper';g.P.alive=true;g.P.drawEnd=11000;
  assert.equal(cx.toggleScope(10000),false);assert.equal(events.length,0);
  g.P.drawEnd=0;
  for(const level of [1,2,0]){assert.equal(cx.toggleScope(12000),true);assert.equal(g.P.zoom,level);}
  assert.deepEqual(events.map(e=>e[2]),[1,2,0]);
  g.S.skins.sniper='neon';cx.toggleScope(13000);assert.equal(events.at(-1)[1],'neon');
  g.P.reloadEnd=14000;assert.equal(cx.toggleScope(13500),false);
});

test('AWP has ten rounds and scope stays closed until reload finishes, including the empty-magazine frame', () => {
  const g=game(),cx=g.context;
  assert.equal(g.W.sniper.mag,10);
  for(const weapon of ['sniper','ssg']){
    g.P.weapon=weapon;g.P.drawEnd=0;g.P.alive=true;g.P.reloadEnd=0;g.P.zoom=2;
    g.P.ammo[weapon]={mag:0,res:30};g.startReload(20000);
    const end=g.P.reloadEnd;
    assert.equal(g.P.zoom,0);
    for(const t of [20000,end-100,end-1]){assert.equal(cx.toggleScope(t),false);assert.equal(g.P.zoom,0);}
    g.P.zoom=1;g.updateWeapon(0,end-1);assert.equal(g.P.zoom,0);
    assert.equal(cx.toggleScope(end),true);assert.equal(g.P.zoom,1);
    assert.equal(g.P.ammo[weapon].mag,10);assert.equal(g.P.ammo[weapon].res,20);assert.equal(g.P.reloadEnd,0);
    g.updateWeapon(0,end);assert.equal(g.P.ammo[weapon].res,20);
    g.P.zoom=0;g.P.ammo[weapon].mag=0;
    assert.equal(cx.toggleScope(end+1000),false);
    assert.equal(g.P.zoom,0);assert.ok(g.P.reloadEnd>end+1000);
  }
});

test('AWP and headshots use lightweight synthesis and retain skin sounds without loading MP3', () => {
  const cx=vm.createContext({S:{},SKINS:{neon:{}},Math});
  vm.runInContext(section('const AU =','/* ================= Viewmodel'),cx);
  const au=vm.runInContext('AU',cx),events=[];
  for(const kind of ['tone','noise','skinShot'])au[kind]=(...args)=>events.push({kind,args});
  au.shot('sniper',1,.25,'padrao');
  assert.ok(events.some(e=>e.kind==='tone'&&e.args[0]<70));
  assert.ok(events.some(e=>e.kind==='noise'&&e.args[1]===1050));
  events.length=0;au.shot('sniper',1,.25,'neon');
  assert.equal(events.length,1);assert.equal(events[0].kind,'skinShot');
  events.length=0;au.hit(true,true,'padrao');const helmet=events.map(e=>e.args[0]);
  events.length=0;au.hit(true,false,'padrao');assert.notDeepEqual(events.map(e=>e.args[0]),helmet);
  events.length=0;au.hit(true,true,'neon');
  assert.equal(events.length,1);assert.equal(events[0].args[0],1500);
  assert.equal(au.loadSamples,undefined);assert.ok(!html.includes('<script src="assets/audio/'));
  for(const name of ['awp-shot','awp-scope','headshot-no-helmet-1','headshot-no-helmet-2','headshot-no-helmet-pitched','headshot-helmet-1','headshot-helmet-2']){
    assert.ok(readFileSync(resolve(__dirname,'../assets/audio/'+name+'.mp3')).length>1000);
  }
});

test('detailed weapon models: every gun stays within a triangle budget and supports every skin; the Deagle keeps its moving slide', () => {
  const g=game(),cx=g.context;
  cx.THREE.Color=class {
    constructor(hex){this.setHex(hex||0);}
    setHex(hex){this.r=(hex>>16&255)/255;this.g=(hex>>8&255)/255;this.b=(hex&255)/255;return this;}
    getHSL(out){out.l=(Math.max(this.r,this.g,this.b)+Math.min(this.r,this.g,this.b))/2;return out;}
  };
  cx.basicMat={};cx.geoFrom=out=>out;
  vm.runInContext(section('const FACES =','function geoFrom'),cx);
  vm.runInContext(section('function weaponMesh(','/* ================= Mapas'),cx);
  vm.runInContext(section('// Modelos das armas:','// braços: mão'),cx);
  const guns=vm.runInContext('GUNS',cx);
  // Perfil côncavo (um L): o corte em orelhas cobre exatamente a área do contorno, sem triângulos para fora.
  const L=cx.weaponShape([[0,0],[.2,0],[.2,.05],[.05,.05],[.05,.2],[0,.2]],.01,0x808080)[3];
  let area=0;
  const v=L.vertices,cap=[];for(let i=0;i<L.indices.length;i+=3){const [a,b,c]=[L.indices[i],L.indices[i+1],L.indices[i+2]];if(a<6&&b<6&&c<6)cap.push([a,b,c]);}
  for(const [a,b,c] of cap){const A=[v[a*3+2],v[a*3+1]],B=[v[b*3+2],v[b*3+1]],C=[v[c*3+2],v[c*3+1]];area+=Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]))/2;}
  assert.equal(cap.length,4);assert.ok(Math.abs(area-(.2*.05+.05*.15))<1e-9,String(area));
  // As duas M4 dividem o corpo; muda só a frente (trilhos e quebra-chamas na M4A4, guarda-mão fino e silenciador na M4A1-S).
  const body=vm.runInContext('M4_BODY.length',cx);assert.ok(body>20);
  for(let i=0;i<body;i++){assert.equal(guns.m4a4[i],guns.m4a1s[i]);}
  const minZ=k=>Math.min(...guns[k].map(p=>p[0][2]));
  assert.ok(Math.abs(minZ('m4a4')+.785)<1e-9);assert.ok(minZ('m4a1s')<-.94&&minZ('m4a1s')>-.95);
  const tris=k=>cx.boxModel(guns[k]).geometry.p.length/9;
  for(const key of ['rifle','m4a4','m4a1s','galil','famas','ump','bucky','ssg','sniper','usps','glock','medgun','he','flash','smoke','c4','pistol']){
    assert.ok(tris(key)>(['he','flash','smoke','c4'].includes(key)?150:300),key+' tem detalhe: '+tris(key));
    for(const skin of ['padrao','neon','brasa','glacial']){
      const geo=cx.boxModel(cx.skinPartsFor(key,skin,guns[key])).geometry;
      assert.ok(geo.p.every(Number.isFinite));assert.ok(geo.n.every(Number.isFinite));assert.ok(geo.c.every(Number.isFinite));
      assert.equal(geo.p.length,geo.n.length);assert.equal(geo.p.length,geo.c.length);
      assert.ok(geo.p.length/9<1500,key+' '+skin+' '+geo.p.length/9);
      for(let i=0;i<geo.n.length;i+=3)assert.ok(Math.abs(Math.hypot(geo.n[i],geo.n[i+1],geo.n[i+2])-1)<1e-6);
    }
  }
  // AK Sublime: mesmo modelo da AK, recolorido em marfim, ouro e ciano.
  const sub=cx.skinPartsFor('rifle','sublime',guns.rifle);assert.ok(sub.length>guns.rifle.length);
  for(let i=0;i<guns.rifle.length;i++)assert.equal(sub[i][3],guns.rifle[i][3]);
  assert.ok(sub.some(p=>p[2]===0xefe7d6)&&sub.some(p=>p[2]===0xd9a93a)&&sub.some(p=>p[2]===0x5ff6ff));
  // Deagle: cano fixo detalhado e o ferrolho de trás separado (é ele que recua no tiro).
  const slide=vm.runInContext('DEAGLE_SLIDE',cx),deagle=cx.boxModel(guns.pistol.concat(slide)).geometry.p.length/9;
  assert.ok(guns.pistol.length>20&&slide.length>14);assert.ok(deagle>500&&deagle<1500,String(deagle));
  assert.ok(slide.every(p=>p[0][2]>=-.165),'o ferrolho fica atrás do cano');
  // AWP do CS: coronha vazada (thumbhole) e luneta de objetiva grande.
  assert.ok(tris('sniper')>900);
});

test('Deagle draw follows the reference turn and joins the support hand before the firing gate opens',()=>{
  const g=game(),cx=g.context;g.spawnSelf(0);g.tick(12000);g.selectWeapon('pistol');
  assert.equal(g.W.pistol.draw,800);assert.equal(g.P.drawEnd,12800);
  const pose=t=>Array.from(cx.sampleDeaglePose(t)),start=pose(12000),turn=pose(12400),settled=pose(12800);
  assert.ok(start[1]<-.2&&start[10]<-.2);assert.ok(turn[3]>.9&&turn[7]>Math.PI);assert.ok(turn[10]<-.15);
  assert.ok(settled.every(v=>Math.abs(v)<1e-6));assert.ok(Math.abs(pose(12799)[7]-Math.PI*2)<1e-5);
  let previous=pose(12000);for(let t=12002;t<12800;t+=2){const next=pose(t);assert.ok(next.every(Number.isFinite));for(let i=0;i<14;i++)assert.ok(Math.abs(next[i]-previous[i])<.17,'draw jumps between frames');previous=next;}
  g.P.m1Press=true;g.updateWeapon(0,12799);assert.equal(g.P.ammo.pistol.mag,7);
  g.P.m1Press=true;g.updateWeapon(0,12800);assert.equal(g.P.ammo.pistol.mag,6);
});
test('Deagle shot is time-based, blends fast follow-up shots and locks the slide only for an empty magazine',()=>{
  const g=game(),cx=g.context;g.spawnSelf(0);g.selectWeapon('pistol');g.P.drawEnd=0;
  const pose=t=>Array.from(cx.sampleDeaglePose(t));g.shoot(20000,false);
  assert.equal(g.P.ammo.pistol.mag,6);assert.equal(g.P.nextFire,20225);
  assert.ok(pose(20020)[13]>.04);assert.ok(pose(20065)[3]>.5);assert.ok(pose(20100)[13]<.001);assert.ok(pose(20410).every(v=>Math.abs(v)<1e-6));
  const before=pose(20225);g.shoot(20225,false);const after=pose(20225);for(let i=0;i<14;i++)assert.ok(Math.abs(before[i]-after[i])<1e-6,'second shot snaps at channel '+i);
  g.P.ammo.pistol.mag=1;g.shoot(21000,false);assert.ok(pose(21450)[13]>.05);assert.equal(g.P.ammo.pistol.mag,0);
  const last=g.P.deagleShot;g.shoot(21450,false);assert.equal(g.P.deagleShot,last,'dry fire must not start recoil');
  cx.completeReload(g.P.reloadEnd);assert.equal(g.P.ammo.pistol.mag,7);assert.equal(pose(25000)[13],0);
  g.selectWeapon('rifle');assert.equal(g.P.deagleShot,null);
});
test('Deagle sound has a low body, leading crack and delayed metal, and draw sounds cannot repeat or arrive late',()=>{
  const audio=vm.createContext({S:{},SKINS:{neon:{}},Math});vm.runInContext(section('const AU =','/* ================= Viewmodel'),audio);
  const au=vm.runInContext('AU',audio),events=[];for(const kind of ['tone','noise','skinShot'])au[kind]=(...args)=>events.push({kind,args});
  au.shot('pistol',1,.2,'padrao');assert.ok(events.some(e=>e.kind==='tone'&&e.args[0]<90));assert.ok(events.some(e=>e.kind==='noise'&&e.args[1]===430));assert.ok(events.some(e=>e.kind==='noise'&&e.args[5]==='highpass'));assert.ok(events.some(e=>e.kind==='noise'&&e.args[6]>.05));
  events.length=0;au.shot('pistol',.5,-.3,'neon');assert.ok(events.some(e=>e.kind==='skinShot'));assert.ok(events.filter(e=>e.kind==='noise').every(e=>e.args[4]===-.3));
  const g=game(),cx=g.context,cues=[];cx.AU={deagleDraw:stage=>cues.push(stage)};g.spawnSelf(0);g.tick(12000);g.selectWeapon('pistol');
  for(const t of [12000,12110,12110,12599,12600,12600,12799,12800])cx.deagleDrawTick(t);
  assert.deepEqual(cues,[0,1]);g.tick(13000);g.selectWeapon('rifle');g.selectWeapon('pistol');cx.deagleDrawTick(13750);assert.deepEqual(cues,[0,1]);
});
test('exclusive skins: Vanguarda (AWP), Alien (AK), Blaster (M4A1-S) and Buzzer (M4A4) recolor their own model, add details, own tracers and sounds', () => {
  const g=game(),cx=g.context;
  cx.THREE.Color=class{constructor(h){this.setHex(h||0);}setHex(h){this.r=(h>>16&255)/255;this.g=(h>>8&255)/255;this.b=(h&255)/255;return this;}getHSL(o){o.l=(Math.max(this.r,this.g,this.b)+Math.min(this.r,this.g,this.b))/2;return o;}};
  cx.basicMat={};cx.geoFrom=out=>out;
  vm.runInContext(section('const FACES =','function geoFrom'),cx);vm.runInContext(section('function weaponMesh(','/* ================= Mapas'),cx);vm.runInContext(section('// Modelos das armas:','// braços: mão'),cx);
  const guns=vm.runInContext('GUNS',cx),fn=n=>vm.runInContext(n,cx);
  const want={vanguarda:['sniper',[0xf4f4f2,0xff6a13,0x1c1c1e],0xff7a2a],alien:['rifle',[0x9cff2e,0x121314,0xf2f2f2],0x7dff3a],blaster:['m4a1s',[0xf4f6f8,0x5ec8ff,0x121416],0xff3030],buzzer:['m4a4',[0xffc81a,0x141414],0xffc81a]};
  for(const [id,[gun,colors,tracer]] of Object.entries(want)){
    assert.ok(fn('skinFits')(gun,id));for(const other of ['rifle','m4a4','m4a1s','sniper','pistol'].filter(k=>k!==gun))assert.equal(fn('skinFits')(other,id),false,id+' em '+other);
    assert.equal(fn('skinUnlocked')(id),true,'liberada');
    const parts=cx.skinPartsFor(gun,id,guns[gun]);assert.ok(parts.length>guns[gun].length,'tem detalhes extras');
    for(let i=0;i<guns[gun].length;i++)assert.equal(parts[i][3],guns[gun][i][3],'mesma geometria');
    for(const c of colors)assert.ok(parts.some(p=>p[2]===c),id+' usa '+c.toString(16));
    const geo=cx.boxModel(parts).geometry;assert.ok(geo.p.every(Number.isFinite));assert.ok(geo.p.length/9<1800,id+' '+geo.p.length/9);
    assert.equal(fn('skinTracer')(id),tracer);assert.equal(cx.skinPartsFor(gun,id,guns[gun]),parts,'modelo guardado');
  }
  assert.equal(fn('skinTracer')('padrao'),vm.runInContext('TRACER_HEX',cx));assert.equal(fn('skinTracer')('neon'),vm.runInContext('TRACER_HEX',cx));
  // Sons próprios: cada skin tem tiro e abate diferentes entre si e do som padrão.
  const audio=vm.createContext({S:{},SKINS:{vanguarda:{},alien:{},blaster:{},buzzer:{}},Math,clamp:(v,a,b)=>Math.min(b,Math.max(a,v))});vm.runInContext(section('const AU =','/* ================= Viewmodel'),audio);
  const au=vm.runInContext('AU',audio),record=fn=>{const ev=[];au.tone=(...a)=>ev.push(['t',...a.slice(0,4)]);au.noise=(...a)=>ev.push(['n',...a.slice(0,3)]);au.kill=()=>ev.push(['k']);fn();return JSON.stringify(ev);};
  const shots=new Set(),kills=new Set();
  for(const [id,[gun]] of Object.entries(want)){shots.add(record(()=>au.skinShot(id,gun,1,0)));kills.add(record(()=>au.skinKill(id,1)));}
  assert.equal(shots.size,4);assert.equal(kills.size,4);assert.ok(![...shots].includes('[]'));assert.ok(![...kills].some(k=>k==='[["k"]]'),'abate próprio, não o padrão');
});
test('scope cannot open during the firing interval and unlocks exactly when the next shot is ready', () => {
  for(const weapon of ['sniper','ssg']){
    const g=game(),cx=g.context;g.P.weapon=weapon;g.P.drawEnd=0;g.P.zoom=1;
    g.shoot(12000,false);const ready=g.P.nextFire;
    assert.equal(ready,12000+g.W[weapon].rof);assert.equal(g.P.zoom,0);
    for(const t of [12001,ready-1]){assert.equal(cx.toggleScope(t),false);assert.equal(g.P.zoom,0);}
    assert.equal(cx.toggleScope(ready),true);assert.equal(g.P.zoom,1);
  }
});

test('screen-shake preference preserves old defaults and changes no bullets, damage or spray', () => {
  assert.equal(game().S.smoothRecoil,true);
  assert.equal(game({smoothRecoil:'invalid'}).S.smoothRecoil,true);
  const soft=game({smoothRecoil:true}),full=game({smoothRecoil:false}),shots=[[],[]];
  assert.equal(soft.context.viewRecoilScale(),.45);assert.equal(full.context.viewRecoilScale(),.7);
  for(const [i,g] of [soft,full].entries()){
    g.spawnSelf(0,[0,0,0]);g.P.yaw=g.P.pitch=0;
    g.context.tracer=(start,end)=>shots[i].push(Array.from(end));
    for(let n=0;n<20;n++)g.shoot(12000+n*100,false);
  }
  assert.deepEqual(shots[0],shots[1]);
  assert.equal(soft.P.recoilP,full.P.recoilP);assert.equal(soft.P.recoilY,full.P.recoilY);
  assert.equal(soft.damageFor(soft.W.rifle,'head',true),full.damageFor(full.W.rifle,'head',true));
});

test('inventory selections equip weapon and skin atomically and reject locked, incompatible or restricted items', () => {
  const g=game(),cx=g.context;
  vm.runInContext(section('const slotOf =','const hexCss ='),cx);
  vm.runInContext(section('function applyLoadoutSelection(','function buyEquip('),cx);
  assert.equal(cx.applyLoadoutSelection('usps','neon'),true);
  assert.equal(g.S.loadout.pistol,'usps');assert.equal(g.S.skins.usps,'neon');
  assert.equal(cx.applyLoadoutSelection('pistol','brasa'),true);
  assert.equal(g.S.loadout.pistol,'pistol');assert.equal(g.S.skins.pistol,'brasa');
  assert.equal(cx.applyLoadoutSelection('usps','padrao'),true);assert.equal(g.S.skins.usps,undefined);
  const before=JSON.stringify({loadout:g.S.loadout,skins:g.S.skins});
  for(const [weapon,skin] of [['rifle','sublime'],['knife','neon'],['unknown','padrao']])assert.equal(cx.applyLoadoutSelection(weapon,skin),false);
  assert.equal(JSON.stringify({loadout:g.S.loadout,skins:g.S.skins}),before);
  cx.G.mode='dm';g.DM.active=true;g.DM.category='rifle';
  assert.equal(cx.applyLoadoutSelection('usps','neon'),false);
  assert.equal(cx.applyLoadoutSelection('m4a1s','glacial'),true);assert.equal(g.S.loadout.rifle,'m4a1s');
  assert.equal(cx.applyLoadoutSelection('butterfly','padrao'),true);assert.equal(g.S.loadout.knife,'butterfly');
});

test('Aimbotz kills the old bot and immediately spawns a damageable replacement at a different spot', () => {
  const g = game(), cx = g.context;
  cx.buildMap('aimbotz'); cx.G.mode = 'aimbotz'; cx.G.view.ph = 'practice';
  g.spawnSelf(0, [0, 9, 0]); cx.aimbotzSetup();
  const bot = g.DM.actors[1], original = [...Object.values(bot.pos)];
  assert.equal(g.DM.actors.length, 9);
  assert.equal(g.DM.playerTargets.length, 24);
  cx.aimbotzSetBots(40);
  assert.equal(g.DM.playerTargets.length, 36);
  cx.aimbotzSetBots(0);
  assert.equal(g.DM.actors.length, 2);
  assert.equal(g.DM.byId.size, 2);
  assert.equal(g.DM.playerTargets.length, 3);
  assert.equal(g.DM.actors[1], bot);
  cx.aimbotzHit(27, 'body', 'rifle', bot.id);
  assert.equal(bot.hp, 73);

  g.P.pitch = Math.atan2(1.64 - cx.eyePos()[1], 13);
  g.shoot(12000, false);
  assert.equal(g.stat(cx.G.me).k, 1);
  assert.equal(bot.hp, 0);
  assert.equal(bot.alive, false);
  const replacement = g.DM.byId.get(bot.id);
  assert.notEqual(replacement, bot);
  assert.equal(g.DM.actors[1], replacement);
  assert.equal(replacement.hp, 100);
  assert.equal(replacement.alive, true);
  assert.notDeepEqual(Object.values(replacement.pos), original);
  assert.ok(Math.hypot(replacement.pos.x-bot.pos.x,replacement.pos.z-bot.pos.z)>=2);
  assert.equal(g.DM.playerTargets[0].actor, bot.id);
  assert.equal(g.DM.playerTargets[0].min[0],replacement.pos.x-.15);
  // There is no invulnerability window or delay before hitting the replacement.
  cx.aimbotzHit(100, 'body', 'rifle', bot.id);
  assert.equal(replacement.alive, false);
  assert.equal(g.stat(cx.G.me).k, 2);
  assert.equal(g.DM.byId.get(bot.id).hp, 100);
  assert.equal(g.DM.playerTargets.length, 3);

  // Repeated kills keep the live target count constant.
  for (let i = 0; i < 30; i++) cx.aimbotzHit(100, 'body', 'rifle', bot.id);
  assert.equal(g.DM.actors.length, 2);
  assert.equal(g.DM.byId.size, 2);
});

test('Aimbotz always changes spots without overlaps at every bot count and when adding bots again', () => {
  for(const count of [1,8,12]){
    const g=game(),cx=g.context;
    cx.buildMap('aimbotz');cx.G.mode='aimbotz';g.spawnSelf(0,[0,-4,0]);cx.aimbotzSetup();cx.aimbotzSetBots(count);
    const check=()=>{
      assert.equal(g.DM.actors.length,count+1);
      assert.equal(g.DM.playerTargets.length,count*3);
      for(const bot of g.DM.actors.slice(1)){
        assert.equal(bot.alive,true);assert.equal(bot.hp,100);
        assert.equal(bot.pos.y,cx.groundAt(bot.pos.x,bot.pos.z));
        assert.equal(g.overlapAny(bot.pos.x,bot.pos.y+.03,bot.pos.z,1.8),false);
        for(const other of g.DM.actors)if(other!==bot)assert.ok(Math.hypot(bot.pos.x-other.pos.x,bot.pos.z-other.pos.z)>=1.4);
      }
    };
    check();
    for(let i=0;i<240;i++){
      const old=g.DM.actors[1+i%count];
      cx.aimbotzHit(100,'head','rifle',old.id);
      const replacement=g.DM.byId.get(old.id);
      assert.ok(Math.hypot(replacement.pos.x-old.pos.x,replacement.pos.z-old.pos.z)>=2);
      check();
    }
    cx.aimbotzSetBots(1);cx.aimbotzSetBots(count);check();
  }
});

test('every available weapon kills Aimbotz targets with actual shots or knife attacks', () => {
  for (const weapon of Object.keys(game().W)) {
    const g=game(),cx=g.context;
    cx.buildMap('aimbotz');cx.G.mode='aimbotz';if(g.W[weapon].melee)g.S.loadout.knife=weapon;
    g.spawnSelf(0,[0,9,0]);cx.aimbotzSetup();cx.aimbotzSetBots(1);
    if(g.W[weapon].melee)g.selectWeapon(weapon);else cx.aimbotzEquip(weapon);
    const bot=g.DM.actors[1];g.P.pos.set(bot.pos.x,bot.pos.y,bot.pos.z+1.2);
    g.P.pitch=Math.atan2(1.05-cx.eyePos()[1],1.2);g.P.yaw=0;
    for(let n=0;n<8&&bot.alive;n++){
      g.P.recoilP=g.P.recoilY=g.P.spread=0;g.shoot(12000+n*1000,false);
    }
    assert.equal(bot.alive,false,weapon);
    assert.equal(g.stat(cx.G.me).k,1,weapon);
    assert.equal(g.DM.byId.get(bot.id).hp,100,weapon);
  }
});

test('Aimbotz renders only live targets at the new spots without a falling body', () => {
  const g = game(), cx = g.context;
  cx.buildMap('aimbotz'); cx.G.mode = 'aimbotz'; g.spawnSelf(0, [0, 9, 0]); cx.aimbotzSetup();
  cx.aimbotzHit(100, 'head', 'rifle', g.DM.actors[1].id);
  let pose;
  const mesh = () => ({count:0, visible:false, poses:[], instanceMatrix:{},
    setMatrixAt(i) { this.poses[i] = {...pose}; }, setColorAt() {}});
  const legs=mesh(),body=mesh(),head=mesh();
  g.DM.render = {meshes:[legs,body,head],legs,body,head,guns:{},color:{set(){}},
    dummy:{position:new Vec(),rotation:{set(x,y,z){pose={tilt:z,yaw:y};}},scale:{set(){}},updateMatrix(){pose={...pose,x:this.position.x,z:this.position.z};}}};
  for(const time of [10000,10180,10360]){
    cx.dmRender(time);
    assert.equal(head.count,8);
    assert.equal(body.count,8);
    assert.equal(legs.count,8);
    assert.ok(head.poses.slice(0,head.count).every(p=>p.tilt===0));
    assert.equal(head.poses[0].x,g.DM.actors[1].pos.x);
    assert.equal(head.poses[0].z,g.DM.actors[1].pos.z);
  }
});

test('AK-47 has exactly five percent less vertical and horizontal recoil across a full spray', () => {
  const current=game(), previous=game();
  previous.W.rifle.recoilScale=.92; previous.W.rifle.recoilJitter=.002;
  for(let shot=0;shot<30;shot++){
    current.context.applyRecoil(current.W.rifle); previous.context.applyRecoil(previous.W.rifle);
    assert.ok(Math.abs(current.P.recoilP-previous.P.recoilP*.95)<1e-12);
    assert.ok(Math.abs(current.P.recoilY-previous.P.recoilY*.95)<1e-12);
  }
  assert.equal(current.W.m4a4.recoilScale,.69);
  assert.equal(current.W.m4a1s.recoilScale,.53);
});

test('Aimbotz board controls match their visible positions and select only guns with a permanent knife', () => {
  const g = game(), cx = g.context;
  cx.buildMap('aimbotz'); cx.G.mode = 'aimbotz'; g.spawnSelf(0, [0, 9, 0]); cx.aimbotzSetup();
  const { board, buttons, duelMaps } = vm.runInContext('({board:AIMBOTZ_BOARD,buttons:AIMBOTZ_BUTTONS,duelMaps:MAP_IDS})', cx);
  assert.ok(!duelMaps.includes('aimbotz'));
  const from = cx.eyePos();
  for (const b of buttons) {
    const x = (.5 - (b.x + b.w / 2) / board.width) * board.w;
    const y = board.y + (.5 - (b.y + b.h / 2) / board.height) * board.h;
    const direction = [x - from[0], y - from[1], board.z - from[2]];
    assert.equal(cx.aimbotzButtonAt(from, direction), b);
    if (b.weapon) {
      cx.aimbotzEquip(b.weapon); assert.equal(g.P.weapon, b.weapon);
      assert.deepEqual(Array.from(g.ORDER),[b.weapon,g.S.loadout.knife]);
      g.selectWeapon(g.S.loadout.knife);assert.equal(g.P.weapon,g.S.loadout.knife);
      g.selectWeapon(b.weapon);assert.equal(g.P.weapon,b.weapon);
    }
  }
  assert.equal(buttons.filter(b => b.weapon).length, Object.values(g.W).filter(w=>!w.melee&&!w.grenade&&!w.bomb&&!w.medgun).length);
  assert.ok(buttons.every(b=>!b.weapon||!g.W[b.weapon].melee));
  for(const invalid of ['knife','butterfly','invalid']){cx.aimbotzEquip(invalid);assert.equal(g.S.aimbotzWeapon,'rifle');assert.equal(g.ORDER.length,2);}
  assert.equal(cx.aimbotzButtonAt(from, [0, 0, -1]), null);
});

test('Aimbotz infinite magazines cancel a reload, keep every gun full, and stay exclusive to training', () => {
  const g=game(),cx=g.context;cx.G.mode='aimbotz';g.spawnSelf(0,[0,9,0]);cx.aimbotzSetup();
  assert.equal(cx.infiniteMagazine(),false);
  g.P.ammo.rifle.mag=0;cx.startReload(11000);assert.ok(g.P.reloadEnd>11000);
  cx.aimbotzSetInfiniteAmmo(true);assert.equal(g.P.reloadEnd,0);
  for(const weapon of Object.keys(g.W).filter(k=>!g.W[k].melee&&!g.W[k].grenade&&!g.W[k].bomb&&!g.W[k].medgun)){
    cx.aimbotzEquip(weapon);const w=g.W[weapon];
    for(let n=0;n<w.mag*3;n++){
      g.shoot(15000+n*w.rof,false);assert.equal(g.P.ammo[weapon].mag,w.mag);assert.equal(g.P.nextFire,15000+(n+1)*w.rof);
    }
    cx.startReload(80000);assert.equal(g.P.reloadEnd,0);
  }
  cx.aimbotzSetInfiniteAmmo(false);cx.aimbotzEquip('rifle');g.shoot(90000,false);assert.equal(g.P.ammo.rifle.mag,29);
  cx.aimbotzSetInfiniteAmmo(true);
  for(const mode of ['bot','online','team','dm']){
    cx.G.mode=mode;assert.equal(cx.infiniteMagazine(),false);g.P.ammo.rifle.mag=0;g.P.reloadEnd=0;cx.startReload(95000);assert.equal(g.P.reloadEnd,97500);
  }
  assert.equal(game({aimbotzInfiniteAmmo:'yes'}).S.aimbotzInfiniteAmmo,false);
});

test('weapon size on screen: +45% around the trigger hand, with per-weapon fits that keep every gun in the AK standard', () => {
  const g = game(), cx = g.context, ev = s => vm.runInContext(s, cx);
  assert.equal(ev('VM_SIZE'), 1.45);
  const fake = () => { const v = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }); return { scale: v(), position: v() }; };
  const A = ev('VM_ANCHOR');
  for (const [w, side] of [['rifle', 1], ['sniper', 1], ['rifle', -1], ['knife', 1], ['pistol', 1]]) {
    const h = fake(); cx.applyVmSize(h, side, w); const fit = ev(`VM_FIT['${w}']||{}`), k = 1.45 * (fit.s || 1);
    assert.ok(Math.abs(h.scale.y - k) < 1e-12 && Math.abs(h.scale.x - side * k) < 1e-12, w);
    // A mão do gatilho (âncora) fica parada na tela: só a arma cresce em volta dela.
    const ax = side * A[0], fixed = [h.position.x + h.scale.x * A[0], h.position.y + k * A[1], h.position.z + k * A[2]];
    assert.ok(Math.abs(fixed[0] - ax) < 1e-12 && Math.abs(fixed[1] - A[1] - (fit.y || 0)) < 1e-12 && Math.abs(fixed[2] - A[2]) < 1e-12, w);
  }
  // Os fuzis seguem o padrão puro; a Deagle (vista de trás) fica menor e mais baixa para não subir até o meio da tela.
  for (const w of ['rifle', 'm4a4', 'm4a1s', 'galil', 'famas', 'ump', 'bucky', 'ssg', 'sniper', 'usps', 'glock']) assert.equal(ev(`VM_FIT['${w}']`), undefined, w);
  assert.ok(ev("VM_FIT.pistol.s") < 1 && ev("VM_FIT.pistol.y") < 0);
});
test('viewmodel settings migrate, clamp each axis, reset, and change only the held model', () => {
  const g=game(),cx=g.context;
  assert.deepEqual(JSON.parse(JSON.stringify(g.S.viewmodel)),{x:0,y:0,z:0});
  assert.deepEqual(JSON.parse(JSON.stringify(game({viewmodel:{x:200,y:-10,z:'2'}}).S.viewmodel)),{x:2.5,y:-2,z:0});
  assert.deepEqual(JSON.parse(JSON.stringify(game({viewmodel:null}).S.viewmodel)),{x:0,y:0,z:0});
  assert.equal(cx.setViewmodelAxis('x',2.57),true);assert.equal(g.S.viewmodel.x,2.5);
  cx.setViewmodelAxis('y',-10);cx.setViewmodelAxis('z',.16);
  assert.deepEqual(JSON.parse(JSON.stringify(g.S.viewmodel)),{x:2.5,y:-2,z:.2});
  const unchanged=JSON.stringify(g.S.viewmodel);
  for(const [axis,value] of [['q',0],['__proto__',1],['x',NaN],['y',Infinity]])assert.equal(cx.setViewmodelAxis(axis,value),false);
  assert.equal(JSON.stringify(g.S.viewmodel),unchanged);
  const position=new Vec(.15,-.16,-.4);cx.offsetViewmodel(position);
  assert.ok(Math.abs(position.x-.2125)<1e-9);assert.ok(Math.abs(position.y+.156)<1e-9);assert.ok(Math.abs(position.z+.35)<1e-9);
  cx.resetViewmodel();assert.equal(g.S.viewmodel.x,0);assert.equal(g.S.viewmodel.y,0);assert.equal(g.S.viewmodel.z,0);
  const shots=[[],[]];
  for(const [i,viewmodel] of [{x:0,y:0,z:0},{x:-2,y:2,z:2}].entries()){
    const gameState=game({viewmodel});gameState.spawnSelf(0,[0,0,0]);gameState.P.yaw=gameState.P.pitch=0;
    gameState.context.tracer=(start,end)=>shots[i].push(Array.from(end));
    for(let n=0;n<20;n++)gameState.shoot(12000+n*100,false);
  }
  assert.deepEqual(shots[0],shots[1]);
});

test('all viewmodel board buttons match world-space hits, update the shared setting, and reset', () => {
  const g=game(),cx=g.context;cx.buildMap('aimbotz');cx.G.mode='aimbotz';g.spawnSelf(0,[0,9,0]);cx.aimbotzSetup();
  cx.aimbotzDrawBoard=()=>{};cx.syncInputs=()=>{};cx.saveS=()=>{};
  const {board,buttons}=vm.runInContext('({board:AIMBOTZ_VIEWMODEL_BOARD,buttons:AIMBOTZ_VIEWMODEL_BUTTONS})',cx),from=cx.eyePos();
  for(const button of buttons){
    const x=board.x+(.5-(button.x+button.w/2)/board.width)*board.w,y=board.y+(.5-(button.y+button.h/2)/board.height)*board.h;
    const direction=[x-from[0],y-from[1],board.z-from[2]],distance=Math.hypot(...direction);
    assert.equal(cx.aimbotzViewmodelButtonAt(from,direction),button);
    g.P.yaw=Math.atan2(-direction[0],-direction[2]);g.P.pitch=Math.asin(direction[1]/distance);g.P.recoilP=g.P.recoilY=g.P.punch=0;
    g.P.zoom=1;g.P.m1=g.P.m1Press=true;
    assert.equal(cx.aimbotzClickBoard(),true);
    assert.equal(g.P.zoom,0);assert.equal(g.P.m1,false);assert.equal(g.P.m1Press,false);
    if(button.axis)assert.equal(g.S.viewmodel[button.axis],button.value);
    else assert.deepEqual(JSON.parse(JSON.stringify(g.S.viewmodel)),{x:0,y:0,z:0});
  }
  assert.equal(cx.aimbotzViewmodelButtonAt(from,[0,0,-1]),null);
});

test('round audio ticks once at 3, 2 and 1 and ends once despite repeated or jittered round states', () => {
  for(const mode of ['bot','online','team','dm']){
    const g=game(),cx=g.context,events=[];cx.G.mode=mode;
    cx.AU={freezeTick:()=>events.push('tick'),roundEnd:()=>events.push('end')};
    vm.runInContext(section('const ROUND_AUDIO =','/* ================= Viewmodel'),cx);
    cx.G.view={m:'series',r:1,ph:'freeze',endsAt:15000};
    for(let t=10000;t<15000;t+=10){if(t===13100)cx.G.view.endsAt+=80;cx.updateRoundAudio(t);}
    assert.deepEqual(events,['tick','tick','tick'],mode);
    cx.G.view.ph='live';for(let t=15000;t<18000;t+=10)cx.updateRoundAudio(t);
    cx.G.view.ph='end';cx.updateRoundAudio(18000);cx.updateRoundAudio(18010);
    cx.G.view.ph='over';cx.updateRoundAudio(18020);assert.deepEqual(events,['tick','tick','tick','end']);
    cx.G.view.r=2;cx.G.view.ph='freeze';cx.G.view.endsAt=22000;cx.updateRoundAudio(19000);cx.updateRoundAudio(19010);
    assert.equal(events.filter(e=>e==='tick').length,4);
    cx.G.view.endsAt=Infinity;cx.updateRoundAudio(20000);assert.equal(events.length,5);
    cx.G.mode='aimbotz';cx.G.view.ph='end';cx.updateRoundAudio(21000);assert.equal(events.length,5);
    cx.G.mode=null;cx.updateRoundAudio(22000);
  }
});

test('DM has ten distinct participants, the requested names and a full five-minute live phase', () => {
  const g=deathmatch();
  assert.equal(g.DM.actors.length,10);assert.equal(new Set(g.DM.actors.map(e=>e.id)).size,10);
  assert.deepEqual(Array.from(g.DM.bots,e=>e.name),['donk','ZywOo','m0NESY','NiKo','KSCERATO','ropz','YEKINDAR','molodoy','coldzera']);
  assert.equal(g.DM.startsAt,13000);assert.equal(g.DM.endsAt-g.DM.startsAt,300000);
  assert.equal(g.DM.phase,'freeze');g.dmTick(0,12999);assert.equal(g.DM.phase,'freeze');
  g.dmTick(0,13000);assert.equal(g.DM.phase,'live');assert.equal(g.context.G.view.endsAt,313000);
});

test('DM spawn points and routes are free, connected and spread across the arena', () => {
  const g=deathmatch(), n=g.DM.nav;
  assert.ok(g.DM.spawnPoints.length>=16);assert.ok(n.walk.length>400);
  for(const p of g.DM.spawnPoints){assert.equal(g.overlapAny(p.x,p.y+.03,p.z,1.8),false);assert.ok(n.open[g.dmCell(p.x,p.z)]);}
  for(const a of g.DM.actors)for(const b of g.DM.actors)if(a!==b)assert.ok(Math.hypot(a.pos.x-b.pos.x,a.pos.z-b.pos.z)>5);
  const bot=g.DM.bots[0];let paths=0;
  for(const p of g.DM.spawnPoints)if(g.dmFindPath(bot,p.x,p.z)){paths++;for(const id of bot.path)assert.ok(n.open[id]);}
  assert.ok(paths>=15);
});

test('Dust II connects both levels of the CT crossing to the Deathmatch routes', () => {
  const g = deathmatch('all', 'dificil', 'dust2'), n = g.DM.nav, bot = g.DM.bots[0];
  assert.equal(g.context.G.view.mp, 'dust2');
  assert.equal(g.DM.actors.length, 10);
  assert.ok(g.DM.spawnPoints.length >= 25);
  const under = g.dmCell(9.5, -16, .75), over = g.dmCell(9.5, -16, 4.25);
  assert.equal(under, over + n.plane);
  assert.ok(n.open[over] && n.open[under]);
  assert.equal(g.clearLine([9.5, 2.4, -16], [9.5, 5.9, -16]), false);

  bot.pos.set(3.5, .75, -16);
  assert.ok(g.dmFindPath(bot, 9.5, -16, .75));
  assert.equal(bot.path.at(-1), under);
  assert.ok(g.dmWalkClear(3.5, -16, 16.5, -16, .75, 1.03));
  assert.equal(g.dmWalkClear(9.5, -16, 9.5, -16, .75, 4.25), false);
  bot.pos.set(9.5, 2.65, -5.3);
  assert.ok(g.dmFindPath(bot, 14, -23, 4.25));
  assert.ok(bot.path.every(id => id < n.plane));
  assert.ok(bot.path.some(id => n.height[id] === 4.25));

  const ct = entity(3.5, -16), short = entity(9.5, -5.3);
  ct.pos.y = .75;
  short.pos.y = 2.65;
  for (let i = 0; i < 360; i++) {
    g.physics(ct, 1, 0, 5.5, false, g.PHYS_STEP);
    g.physics(short, 0, -1, 5.5, false, g.PHYS_STEP);
  }
  assert.ok(ct.pos.x > 17 && ct.pos.y < 1.4);
  assert.ok(short.pos.z < -18 && short.pos.y === 4.25);
});

test('each DM category constrains player switching and bot weapons at every respawn', () => {
  for(const category of ['pistol','sniper','rifle','all']){
    const g=deathmatch(category), pool=Array.from(g.DM_POOLS[category]);
    for(let round=0;round<5;round++){
      for(const b of g.DM.bots){g.dmRespawn(b,15000+round*2000);assert.ok(pool.includes(b.w));assert.equal(b.mag,g.W[b.w].mag);}
      g.dmRespawn(g.P,15000+round*2000);
      assert.deepEqual(Array.from(g.ORDER),Array.from(g.dmLoadoutOrder(g.S.loadout,category)));
      assert.ok(pool.includes(g.P.weapon));
      const before=g.P.weapon;for(const key of Object.keys(g.W).filter(k=>!pool.includes(k)&&!g.W[k].melee)){g.selectWeapon(key);assert.equal(g.P.weapon,before);}
    }
    g.S.dmWeapons=category==='all'?'pistol':'all';g.S.dmLevel='dificil';
    assert.equal(g.DM.category,category);assert.equal(g.DM.level,'medio');
    // Precisão e rifles usam o slot 1; só a categoria pistola (ou tudo) traz a pistola.
    const order=Array.from(g.dmLoadoutOrder({rifle:'ssg',pistol:'usps',knife:'knife'},category));
    assert.deepEqual(order,{pistol:['usps','knife'],sniper:['ssg','knife'],rifle:['rifle','knife'],all:['ssg','usps','knife']}[category]);
  }
});

test('DM protection blocks damage, ends on movement, and kills credit the actual attacker only once', () => {
  const g=deathmatch(), a=g.DM.bots[0],b=g.DM.bots[1];g.dmTick(0,13000);
  assert.equal(g.dmDamage(b,200,'head','pistol',a,13000),0);
  b.safeUntil=0;
  assert.equal(g.dmDamage(b,200,'head','pistol',a,13001),100);
  assert.equal(g.dmDamage(b,200,'head','pistol',a,13002),0);
  assert.deepEqual({...g.stat(a.id)},{k:1,d:0,hs:1});assert.equal(g.stat(b.id).d,1);
  assert.equal(b.respawnAt,14501);assert.equal(g.events.filter(e=>e.topic==='feed').length,1);
  g.DM.bots.forEach(e=>{e.readyAt=1e9;});g.dmTick(0,14500);assert.equal(b.alive,false);
  g.tick(14501);g.dmTick(0,14501);assert.equal(b.alive,true);assert.equal(b.hp,100);assert.equal(b.safeUntil,16301);
  g.keys.add('KeyW');g.playerInput(1/60,14502);assert.equal(g.P.safeUntil,0);
});

test('DM raycasts distinguish actors, stop at walls and use each target helmet', () => {
  const g=deathmatch('pistol'), b=g.DM.bots[0],victim=g.DM.bots[1];
  g.dmTick(0,13000);g.tick(16000);g.context.boxes=[g.floor];
  for(const e of g.DM.actors){e.pos.set(50+(e.index||10),0,50);e.safeUntil=0;}
  b.pos.set(0,0,0);victim.pos.set(0,0,-5);b.yaw=b.pitch=0;b.w='usps';b.mag=12;b.shots=0;b.fireReady=true;b.nextFire=b.pauseUntil=b.reloadEnd=0;b.readyAt=0;
  g.LEVELS.medio.spread=0;victim.helmet=true;g.dmRefreshTargets();
  const ray=g.trace([0,1.64,0],[0,0,-1],100,g.DM.hitboxes,b.id);assert.equal(ray.actor,victim.id);assert.equal(ray.part,'head');
  g.dmBotFire(b,16000,g.LEVELS.medio);assert.ok(victim.hp>0&&victim.hp<100);assert.equal(g.stat(b.id).k,0);
  victim.hp=100;victim.helmet=false;b.fireReady=true;b.nextFire=b.pauseUntil=0;
  g.dmBotFire(b,18000,g.LEVELS.medio);assert.equal(victim.alive,false);assert.equal(g.stat(b.id).k,1);
  victim.alive=true;victim.hp=100;b.fireReady=true;b.nextFire=b.pauseUntil=0;g.context.boxes.push({min:[-2,0,-3],max:[2,4,-2]});
  g.dmBotFire(b,20000,g.LEVELS.medio);assert.equal(victim.hp,100);
});

test('nine DM bots navigate and kill one another with real shots on the actual map', () => {
  for(const category of ['pistol','sniper','rifle','all']){
    const g=deathmatch(category,'dificil');g.advance(45000,1/30);
    const kills=g.events.filter(e=>e.topic==='feed'&&e.killer!=='A'&&e.victim!=='A');
    assert.ok(kills.length>=6,category+': '+kills.length+' bot kills');
    assert.ok(new Set(kills.map(e=>e.killer)).size>=3,category);
    assert.ok(kills.every(e=>g.DM_POOLS[category].includes(e.w)),category);
    const stats=Object.values(g.context.G.stats);assert.equal(stats.reduce((s,e)=>s+e.k,0),stats.reduce((s,e)=>s+e.d,0));
    for(const b of g.DM.bots){assert.ok(Number.isFinite(b.pos.x)&&Number.isFinite(b.pos.z));assert.ok(Math.abs(b.pos.x)<g.MAPS.deathmatch.ax&&Math.abs(b.pos.z)<g.MAPS.deathmatch.az);}
  }
});

test('DM reloads indefinitely, ends exactly on deadline and freezes final results and respawns', () => {
  const g=deathmatch('rifle'),b=g.DM.bots[0];g.dmTick(0,13000);g.P.safeUntil=0;
  g.P.ammo.rifle.mag=0;g.P.ammo.rifle.res=0;g.startReload(16000);g.updateWeapon(0,g.P.reloadEnd);assert.equal(g.P.ammo.rifle.mag,30);assert.ok(g.P.ammo.rifle.res>0);
  b.mag=0;b.readyAt=1e9;g.dmTick(0,17000);assert.ok(b.reloadEnd>17000);g.dmTick(0,b.reloadEnd);assert.equal(b.mag,g.W[b.w].mag);
  g.stat(b.id).k=5;g.stat(b.id).hs=2;g.stat(g.P.id).k=4;
  g.dmTick(0,g.DM.endsAt-1);assert.equal(g.DM.phase,'live');
  g.dmTick(0,g.DM.endsAt);assert.equal(g.DM.phase,'over');assert.deepEqual(Array.from(g.DM.winners),[b.id]);
  const stats=JSON.stringify(g.context.G.stats);g.P.alive=false;g.P.respawnAt=g.DM.endsAt;
  assert.equal(g.dmDamage(b,1000,'head','pistol',g.DM.bots[1],g.DM.endsAt),0);
  g.dmTick(1,g.DM.endsAt+10000);assert.equal(g.P.alive,false);assert.equal(JSON.stringify(g.context.G.stats),stats);
  g.dmStop();assert.equal(g.DM.active,false);assert.equal(g.DM.actors.length,0);assert.equal(g.DM.hitboxes.length,0);
});

test('old settings migrate and invalid equipment falls back to usable slots', () => {
  const g = game({ sens: 1.25, loadout: { rifle: 'missing', knife: 'butterfly' }, botWeapon: 'butterfly', startSlot: 'missing' });
  assert.equal(g.S.sens, 1.25);
  assert.deepEqual(Array.from(g.ORDER), ['rifle', 'pistol', 'butterfly']);
  assert.equal(g.S.botWeapon, 'rifle');
  assert.equal(g.S.startSlot, 'rifle');
  // O antigo slot de precisão (tecla 4) some: quem nascia com ele passa a ter a arma na primária.
  const old = game({ loadout: { rifle: 'm4a4', sniper: 'ssg' }, startSlot: 'sniper' });
  assert.equal(old.S.loadout.rifle, 'ssg'); assert.equal(old.S.startSlot, 'rifle'); assert.equal(old.S.loadout.sniper, undefined);
  assert.deepEqual(Array.from(old.ORDER), ['ssg', 'pistol', 'knife']);
  const kept = game({ loadout: { rifle: 'm4a4', sniper: 'ssg' }, startSlot: 'pistol' });
  assert.equal(kept.S.loadout.rifle, 'm4a4'); assert.equal(kept.S.loadout.sniper, undefined);
});

test('every element the page script looks up by id exists in the HTML (a missing one stops the whole page)', () => {
  const html = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');
  const ids = new Set([...html.matchAll(/\bid=["']([\w-]+)["']/g)].map(m => m[1]));
  const refs = new Set([...html.matchAll(/\$\(\s*'([\w-]+)'\s*\)/g), ...html.matchAll(/getElementById\(\s*'([\w-]+)'\s*\)/g)].map(m => m[1]));
  assert.ok(refs.size > 50);
  assert.deepEqual([...refs].filter(id => !ids.has(id)), []);
});
test('modes: 1v1, 2v2 and XvX become Elimination; the 2v2 Plant the Bomb becomes Wingman and 5v5 becomes Plant the Bomb', () => {
  const mig = o => { const g = game(o); return [g.S.mode, g.S.xvx.mine, g.S.xvx.foes, vm.runInContext('isBombMode()', g.context)]; };
  assert.deepEqual(mig({ mode: '1v1', xvx: { mine: 3, foes: 4 } }), ['elim', 1, 1, false]);
  assert.deepEqual(mig({ mode: '2v2' }), ['elim', 2, 2, false]);
  assert.deepEqual(mig({ mode: 'xvx', xvx: { mine: 2, foes: 6 } }), ['elim', 2, 6, false]);
  assert.deepEqual(mig({ mode: 'bomb' }), ['wingman', 1, 1, true]);
  assert.deepEqual(mig({ mode: '5v5' }).slice(0, 1).concat(mig({ mode: '5v5' })[3]), ['bomb', true]);
  // Já no formato novo, nada muda (o Plant the Bomb salvo continua 5v5).
  assert.deepEqual(mig({ mode: 'bomb', modeV: 2 })[0], 'bomb'); assert.deepEqual(mig({ mode: 'wingman', modeV: 2 })[0], 'wingman');
  assert.deepEqual(mig({})[0], 'elim'); assert.deepEqual(mig({ mode: 'xvx', modeV: 2 })[0], 'elim');
  assert.deepEqual(mig({ mode: 'elim', modeV: 2, xvx: { mine: 99, foes: 0 } }).slice(1, 3), [8, 1]);
});
test('every equipment combination equips, switches, shoots and reloads each selected gun', () => {
  const g = game(); let combinations = 0;
  for (const rifle of g.CATEGORIES.rifle) for (const pistol of g.CATEGORIES.pistol)
    for (const knife of g.CATEGORIES.knife) {
      g.S.loadout = { rifle, pistol, knife }; g.spawnSelf(0);
      assert.deepEqual(Array.from(g.ORDER), [rifle, pistol, knife]);
      for (const key of g.ORDER) {
        g.selectWeapon(key);
        assert.equal(g.P.weapon, key);
        if (!g.W[key].melee) {
          const before = g.P.ammo[key].mag;
          g.shoot(20000, false); assert.equal(g.P.ammo[key].mag, before - 1);
          g.startReload(21000); assert.ok(g.P.reloadEnd > 21000);
          g.P.drawEnd = 0; g.updateWeapon(0, g.P.reloadEnd);
          assert.equal(g.P.ammo[key].mag, g.W[key].mag);
          assert.equal(g.P.ammo[key].res, g.W[key].res - 1);
        }
      }
      combinations++;
    }
  assert.equal(combinations, Object.values(g.CATEGORIES).reduce((n, c) => n * c.length, 1));
});

test('equipment edits take effect on the next spawn, with the chosen starting slot', () => {
  const g = game(); g.spawnSelf(0);
  g.S.loadout.rifle = 'm4a4'; g.S.startSlot = 'pistol';
  g.selectWeapon('m4a4'); assert.equal(g.P.weapon, 'rifle');
  g.spawnSelf(0); assert.equal(g.P.weapon, 'pistol');
  g.selectWeapon('m4a4'); assert.equal(g.P.weapon, 'm4a4');
  // AWP e Scout são primárias: entram no slot 1, no lugar do fuzil.
  assert.ok(g.CATEGORIES.rifle.includes('sniper') && g.CATEGORIES.rifle.includes('ssg')); assert.equal(g.CATEGORIES.sniper, undefined);
  g.S.loadout.rifle = 'sniper'; g.S.startSlot = 'rifle'; g.spawnSelf(0);
  assert.equal(g.P.weapon, 'sniper'); assert.deepEqual(Array.from(g.ORDER), ['sniper', g.S.loadout.pistol, g.S.loadout.knife]);
});

test('outside Plant the Bomb: free shop with every gun (no grenades or gear); kevlar and helmet are default and can be turned off', () => {
  const g = game(), cx = g.context, ev = s => vm.runInContext(s, cx);
  cx.G.mode = 'bot'; g.spawnSelf(0);
  assert.equal(ev('bombOn()'), false); assert.equal(ev('freeShopOn()'), true);
  const listed = [...ev('shopColsFor(P)').flatMap(([, items]) => [...items])];
  for (const k of ['glock', 'usps', 'pistol', 'ump', 'bucky', 'galil', 'rifle', 'famas', 'm4a4', 'm4a1s', 'ssg', 'sniper']) assert.ok(listed.includes(k), k);
  for (const k of ['he', 'flash', 'smoke', 'kevlar', 'helmet', 'kit']) assert.ok(!listed.includes(k), k);
  assert.ok(listed.every(k => ev(`freeShopBlock('${k}')`) === ''));
  cx.G.mode = 'aimbotz'; assert.equal(ev('freeShopOn()'), false); cx.G.mode = 'bot';
  // Colete e capacete padrão: no corpo o dano cai pela penetração da arma; pernas passam direto; o colete gasta.
  assert.equal(g.P.armor, 100); assert.equal(g.P.helmet, true);
  g.botSpawn(1); assert.equal(g.BOT.armor, 100); assert.equal(g.BOT.helmet, true);
  const e = { armor: 100, helmet: true };
  assert.equal(ev('armorCut')(e, 36, 'body', 'rifle'), 36 * g.W.rifle.helmetPen); assert.ok(e.armor < 100);
  assert.equal(ev('armorCut')(e, 27, 'leg', 'rifle'), 27);
  assert.equal(ev('armorCut')({ armor: 0, helmet: false }, 36, 'body', 'rifle'), 36);
  g.S.armor = false; g.spawnSelf(0); g.botSpawn(1);
  assert.equal(g.P.armor, 0); assert.equal(g.P.helmet, false); assert.equal(g.BOT.armor, 0); assert.equal(g.BOT.helmet, false);
  // Configuração antiga "Bot com capacete" vira a nova opção.
  assert.equal(game({ botHelmet: false }).S.armor, false); assert.equal(game({}).S.armor, true);
  // DM: a loja respeita a categoria da partida.
  const dm = deathmatch('pistol');
  assert.equal(vm.runInContext("freeShopBlock('rifle')", dm.context), 'Fora da categoria'); assert.equal(vm.runInContext("freeShopBlock('usps')", dm.context), '');
  assert.equal(dm.P.armor, 100);
});
test('USP-S HS kills an unhelmeted target at close range and survives with a helmet', () => {
  const g = game();
  assert.equal(g.damageFor(g.W.usps, 'head', false), 140);
  for (const distance of [0, 10, 20, 30]) {
    assert.ok(g.damageFor(g.W.usps, 'head', false, distance) >= 100);
    assert.ok(g.damageFor(g.W.usps, 'head', true, distance) < 100);
  }
  assert.equal(g.damageFor(g.W.pistol, 'body', false), 40);
  assert.equal(g.damageFor(g.W.rifle, 'body', false), 27);
  assert.equal(g.damageFor(g.W.sniper, 'body', false), 115);
});

test('M4s kill with one headshot through helmets up to 35 meters', () => {
  const g = game();
  for (const key of ['m4a4', 'm4a1s']) {
    const w = g.W[key];
    for (const distance of [0, 10, 34.99, 35]) {
      for (const helmet of [false, true]) assert.ok(g.damageFor(w, 'head', helmet, distance) >= 100);
      assert.equal(g.damageFor(w, 'body', true, distance), w.dmg);
      assert.equal(g.damageFor(w, 'leg', true, distance), Math.round(w.dmg * .75));
    }
    for (const distance of [35.01, 50, 100]) assert.ok(g.damageFor(w, 'head', true, distance) < 100);
  }
  for (const key of ['rifle', 'pistol', 'ssg']) assert.ok(g.damageFor(g.W[key], 'head', true) >= 100);
});

test('moving and jumping reduce precision; counter-strafing restores it sooner than coasting', () => {
  const g = game(), coast = entity(), counter = entity();
  coast.vel.x = counter.vel.x = g.W.rifle.speed;
  const idle = g.inaccuracy(entity(), g.W.rifle, false, 0);
  assert.ok(g.inaccuracy(coast, g.W.rifle, false, 0) > idle * 10);
  for (let i = 0; i < 14; i++) {
    g.physics(coast, 0, 0, g.W.rifle.speed, false, g.PHYS_STEP);
    g.physics(counter, -1, 0, g.W.rifle.speed, false, g.PHYS_STEP);
  }
  assert.ok(Math.abs(counter.vel.x) < Math.abs(coast.vel.x));
  assert.ok(g.inaccuracy(counter, g.W.rifle, false, 0) < g.inaccuracy(coast, g.W.rifle, false, 0));
  counter.onGround = false;
  assert.ok(g.inaccuracy(counter, g.W.rifle, false, 0) > idle * 50);
});

test('diagonal input does not gain or lose ground speed', () => {
  const g = game(), straight = entity(), diagonal = entity();
  for (let i = 0; i < 256; i++) {
    g.physics(straight, 1, 0, 6.35, false, g.PHYS_STEP);
    g.physics(diagonal, 1, 1, 6.35, false, g.PHYS_STEP);
  }
  assert.ok(Math.abs(Math.hypot(diagonal.vel.x, diagonal.vel.z) - Math.abs(straight.vel.x)) < 1e-9);
});

test('the same input at 30, 60 and 144 FPS yields the same simulation result', () => {
  const results = [30, 60, 144].map(fps => {
    const g = game(); g.spawnSelf(0); g.keys.add('KeyD');
    for (let i = 0; i < fps * 3; i++) g.playerInput(1 / fps, 10000 + i * 1000 / fps);
    return g.P.pos.x;
  });
  assert.ok(Math.max(...results) - Math.min(...results) < .05, results.join(', '));
});

test('stopping matches CS2 numbers: 215 u/s top speed with the AK, ~0.2 s to be accurate after release, under 0.09 s with a counter-strafe', () => {
  const g = game(); g.spawnSelf(0); const cx = g.context, W = g.W.rifle;
  assert.ok(Math.abs(W.speed / .0254 - 215) < .1, 'AK a 215 u/s');
  const run = () => { g.P.vel.set(0, 0, 0); g.P.onGround = true; for (let i = 0; i < 128; i++) cx.physics(g.P, 1, 0, W.speed, false, g.PHYS_STEP); };
  const until = (wx, cond) => { let n = 0; while (!cond() && n < 400) { cx.physics(g.P, wx, 0, W.speed, false, g.PHYS_STEP); n++; } return n * 1000 / 128; };
  run(); assert.ok(Math.abs(Math.hypot(g.P.vel.x, g.P.vel.z) - W.speed) < 1e-6, 'chega à velocidade máxima');
  const release = until(0, () => Math.hypot(g.P.vel.x, g.P.vel.z) < W.speed * .34);
  run(); const counter = until(-1, () => g.P.vel.x < W.speed * .34);
  run(); const full = until(0, () => Math.hypot(g.P.vel.x, g.P.vel.z) < .01);
  assert.ok(release > 180 && release < 230, 'soltar: ' + release); assert.ok(counter > 40 && counter < 90, 'counter-strafe: ' + counter);
  assert.ok(full > 340 && full < 420, 'parada total: ' + full);
});
test('movement on screen is smooth like CS: the camera interpolates between 128 Hz physics steps, and key presses count from their exact time', () => {
  const cx = g => g.context, ev = (g, s) => vm.runInContext(s, cx(g));
  // A 144 FPS a física dá 0 ou 1 passo por quadro: a posição crua "engasga"; a interpolada anda o mesmo a cada quadro.
  const g = game(); g.spawnSelf(0); g.keys.add('KeyD');
  for (let i = 0; i < 144; i++) g.playerInput(1 / 144, 10000 + i * 1000 / 144);
  const raw = [], smooth = []; let pr = g.P.pos.x, ps = ev(g, 'renderPos().x');
  for (let i = 144; i < 288; i++) { g.playerInput(1 / 144, 10000 + i * 1000 / 144); const r = g.P.pos.x, s = ev(g, 'renderPos().x'); raw.push(r - pr); smooth.push(s - ps); pr = r; ps = s; }
  assert.ok(Math.min(...raw) < 1e-9, 'sem interpolação há quadros parados');
  assert.ok(Math.min(...smooth) > .8 * Math.max(...smooth), 'interpolado: ' + Math.min(...smooth) + ' / ' + Math.max(...smooth));
  // Subtick: soltar a tecla no meio de um quadro longo para no mesmo lugar que a 144 FPS.
  const stopAt = fps => { const h = game(); h.spawnSelf(0); vm.runInContext("keyEvent('KeyD',true,10000)", h.context); h.keys.add('KeyD');
    const release = 10503; let released = false;
    for (let i = 1; i <= fps * 2; i++) { const t = 10000 + i * 1000 / fps; if (!released && t >= release) { vm.runInContext(`keyEvent('KeyD',false,${release})`, h.context); h.keys.delete('KeyD'); released = true; } h.playerInput(1 / fps, t); }
    return h.P.pos.x; };
  const at30 = stopAt(30), at144 = stopAt(144); assert.ok(Math.abs(at30 - at144) < .03, at30 + ' vs ' + at144);
  // Teleporte (spawn) não interpola.
  g.P.pos.set(50, 0, 50); assert.equal(ev(g, 'renderPos()'), g.P.pos);
});
test('assisted bunnyhop repeats jumps and preserves forward speed on landing', () => {
  const g = game(); g.spawnSelf(0); g.keys.add('Space');
  g.P.vel.x = 6.35; let jumps = 0, previousV = 0;
  for (let i = 0; i < 128 * 4; i++) {
    g.playerInput(g.PHYS_STEP, 10000 + i * 1000 / 128);
    if (g.P.vel.y > 0 && previousV <= 0) jumps++;
    previousV = g.P.vel.y;
  }
  assert.ok(jumps >= 4); assert.ok(g.P.vel.x > 6);
});

test('manual jump is buffered once and holding Space does not repeat it', () => {
  const g = game(); g.spawnSelf(0); g.S.autoBhop = false; g.keys.add('Space'); g.P.jumpUntil = 10100;
  let jumps = 0, previousV = 0;
  for (let i = 0; i < 128 * 3; i++) {
    g.playerInput(g.PHYS_STEP, 10000 + i * 1000 / 128);
    if (g.P.vel.y > 0 && previousV <= 0) jumps++;
    previousV = g.P.vel.y;
  }
  assert.equal(jumps, 1); assert.equal(g.P.onGround, true);
});

test('air strafing accelerates sideways while obeying the speed cap', () => {
  const g = game(), e = entity(); e.pos.y = 5; e.onGround = false; e.vel.z = -6.35;
  g.physics(e, 1, 0, 6.35, false, g.PHYS_STEP);
  assert.ok(e.vel.x > 0); assert.equal(e.vel.z, -6.35);
  e.vel.x = 30; g.physics(e, 1, 0, 6.35, false, g.PHYS_STEP);
  assert.ok(Math.hypot(e.vel.x, e.vel.z) <= g.BHOP_CAP + 1e-9);
});

test('collisions still block walls, land on boxes, and climb ramps', () => {
  const g = game(), e = entity();
  g.context.boxes.push({ min: [2, 0, -1], max: [3, 3, 1] });
  for (let i = 0; i < 128; i++) g.physics(e, 1, 0, 6.35, false, g.PHYS_STEP);
  assert.ok(e.pos.x < 1.701);
  e.pos.set(2.5, 5, 0); e.vel.set(0, 0, 0); e.onGround = false;
  for (let i = 0; i < 128; i++) g.physics(e, 0, 0, 6.35, false, g.PHYS_STEP);
  assert.equal(e.pos.y, 3); assert.equal(e.onGround, true);
  g.context.boxes = [g.floor]; g.context.ramps.push({ x0: 0, x1: 2, z0: 0, z1: 8, y0: 0, y1: 2, dir: '+z' });
  e.pos.set(1, 0, .05); e.vel.set(0, 0, 0); e.onGround = true;
  for (let i = 0; i < 100; i++) g.physics(e, 0, 1, 5, false, g.PHYS_STEP);
  assert.ok(e.pos.y > .5); assert.equal(e.onGround, true);
});

test('all seven bot weapons use the selected ammo, reload time, fire rate and damage identity', () => {
  const g = game();
  for (const key of Object.keys(g.W).filter(k => !g.W[k].melee && !g.W[k].grenade && !g.W[k].bomb && !g.W[k].medgun)) {
    g.context.G.view.ph = 'freeze';
    g.S.botWeapon = key; g.S.armor = false; g.botSpawn(1);
    assert.equal(g.BOT.w, key); assert.equal(g.BOT.helmet, false);
    assert.equal(g.BOT.mag, g.W[key].mag);
    g.BOT.mag = 0; g.botUpdate(0, 20000);
    assert.equal(g.BOT.reloadEnd, 20000 + g.W[key].reload);
    g.botUpdate(0, g.BOT.reloadEnd);
    assert.equal(g.BOT.mag, g.W[key].mag);
    g.context.G.view.ph = 'live'; g.LEVELS.medio.spread = 0; g.events.length = 0;
    g.BOT.see = true; g.BOT.yaw = 0; g.BOT.pitch = 0; g.BOT.pos.set(0, 0, 10); g.P.pos.set(0, 0, 0);
    g.BOT.pitch = Math.atan2(1.2 - 1.62, 10);
    g.BOT.reactAt = 0; g.BOT.errT = 100000; g.BOT.ex = g.BOT.ey = 0; g.BOT.burst = 1;
    g.BOT.nextFire = 0; g.BOT.aimHead = false;
    g.botUpdate(0, 30000);
    assert.equal(g.BOT.mag, g.W[key].mag - 1, key);
    assert.equal(g.BOT.nextFire, 30000 + g.W[key].rof, key);
    const hit = g.events.filter(e => e.topic === 'hit').at(-1);
    assert.ok(hit, key); assert.equal(hit.data.w, key);
  }
});

test('hard bot travels with the knife, can miss a hop, and waits for the gun draw on contact', () => {
  const g = game({ botLevel: 'dificil' }), b = g.BOT;
  g.context.Math.random = () => .1;
  g.botSpawn(0, [0, 20, 0]);
  b.wp = new Vec(0, 0, -20); b.route = [];
  g.P.alive = false;
  let t = 10000, tookOff = false, landed = false, maxSpeed = 0;
  for (; t < 12800 && !landed; t += 1000 / 60) {
    g.tick(t); g.botUpdate(1 / 60, t);
    if (!b.onGround) tookOff = true;
    if (tookOff && b.onGround) landed = true;
    if (b.knifeOut) maxSpeed = Math.max(maxSpeed, Math.hypot(b.vel.x, b.vel.z));
  }
  assert.ok(landed && maxSpeed > g.W.rifle.speed);
  assert.equal(b.hopsLeft, 0);
  assert.equal(b.knifeOut, true);
  const ammo = b.mag;
  g.P.alive = true; g.P.pos.set(b.pos.x, 0, b.pos.z - 8); b.yaw = 0;
  g.tick(t); g.botUpdate(1 / 60, t);
  assert.equal(b.knifeOut, false);
  assert.ok(b.nextFire >= t + g.W.rifle.draw);
  assert.equal(b.mag, ammo);
});

test('hard bot strafes between bursts and fires some shots crouched from a stable stance', () => {
  const g = game({ botLevel: 'dificil' }), b = g.BOT;
  g.context.Math.random = () => .25;
  g.botSpawn(0, [0, 0, 0]); g.P.pos.set(0, 0, -10);
  let fired = 0, crouched = 0, movedBetweenBursts = false;
  for (let t = 10000; t < 16500; t += 1000 / 60) {
    const ammo = b.mag;
    g.tick(t); g.botUpdate(1 / 60, t);
    const speed = Math.hypot(b.vel.x, b.vel.z);
    if (b.mag < ammo) {
      fired++;
      if (b.crouch) { crouched++; assert.equal(b.h, 1.15); }
      assert.ok(b.onGround && speed < 1);
    }
    if (fired && t < b.pauseUntil && speed > 2) movedBetweenBursts = true;
  }
  assert.ok(crouched > 0 && crouched < fired && movedBetweenBursts);
});

test('2v2 crouch snapshot lowers head, gun and hitbox while keeping the feet at floor height', () => {
  const g = game(), cx = g.context, proxy = cx.arenaMakeProxy('B', 1);
  const instance = () => ({ count: 0, instanceMatrix: {}, placed: [],
    setMatrixAt(i, pose) { this.placed[i] = pose; },
    setColorAt() {},
  });
  const legs = instance(), body = instance(), head = instance(), gun = instance(), helmet = instance();
  const dummy = { position: new Vec(), scale: new Vec(), rotation: new Vec(), updateMatrix() {
    this.matrix = { y: this.position.y, sy: this.scale.y };
  } };
  g.DM.mode = 'team'; g.P.team = 0; proxy.team = 1; proxy.pz = -5;
  g.DM.actors.push(g.P, proxy);
  g.DM.render = { legs, body, head, helmet, guns: { rifle: gun }, meshes: [legs, body, head, gun, helmet], dummy, color: { set() {} } };
  cx.proxyPush(proxy, 0, 0, -5, 0, 0, 1, 'rifle', 100, 1, 1, 1);
  cx.arenaUpdateProxies(10060); g.dmRefreshTargets(); cx.dmRender(10060);
  assert.equal(proxy.crouch, true);
  assert.equal(legs.placed[0].y, 0);
  assert.ok(legs.placed[0].sy < .21);
  assert.ok(Math.abs(head.placed[0].y + .65) < 1e-8);
  assert.equal(gun.placed[0].y, head.placed[0].y);
  assert.equal(g.trace([0, 1, 0], [0, 0, -1], 10, g.DM.playerTargets).part, 'head');
  assert.equal(g.trace([0, 1.64, 0], [0, 0, -1], 10, g.DM.playerTargets), null);
});

test('semiautomatic weapons require a fresh press, automatic rifles continue while held', () => {
  const g = game(); g.spawnSelf(0); g.selectWeapon('pistol'); g.P.drawEnd = 0; g.P.m1 = true; g.P.m1Press = true;
  g.updateWeapon(0, 20000); assert.equal(g.P.ammo.pistol.mag, 6);
  g.updateWeapon(0, 21000); assert.equal(g.P.ammo.pistol.mag, 6);
  g.selectWeapon('rifle'); g.P.drawEnd = 0; g.P.nextFire = 0;
  g.updateWeapon(0, 22000); g.updateWeapon(0, 22100); assert.equal(g.P.ammo.rifle.mag, 28);
});

test('every knife animation settles to the held pose and remains continuous between keys', () => {
  const g = game();
  for (const poses of Object.values(g.KNIFE_CLIPS)) {
    for (let i = 0; i <= 200; i++) assert.ok(Array.from(g.sampleKnifePose(poses, i / 200)).every(Number.isFinite));
    const final = Array.from(g.sampleKnifePose(poses, 1));
    for (let i = 0; i < final.length; i++) assert.ok(Math.abs(i === 6 || i === 7 ? Math.sin(final[i]) : final[i]) < 1e-6);
    for (let i = 1; i < poses.length - 1; i++) {
      const k = poses[i][0], e = 1e-5;
      const before = Array.from(g.sampleKnifePose(poses, k - 1e-9)), at = Array.from(g.sampleKnifePose(poses, k));
      const after = Array.from(g.sampleKnifePose(poses, k + 1e-9)), later = Array.from(g.sampleKnifePose(poses, k + e)), earlier = Array.from(g.sampleKnifePose(poses, k - e));
      assert.ok(before.every((v,j) => Math.abs(v-after[j]) < 1e-6));
      // velocidade contínua: a butterfly não para mais em cada pose-chave
      assert.ok(at.every((v,j) => Math.abs((v-earlier[j])/e - (later[j]-v)/e) < .3));
    }
  }
});

test('butterfly follows the reference timing: a short draw and a stable inspection display', () => {
  const g = game({ loadout:{knife:'butterfly'},startSlot:'knife' });g.spawnSelf(0);
  assert.equal(g.P.kAnim.duration,800);
  g.P.drawEnd=0;g.tick(12000);g.inspect();
  assert.equal(g.P.kAnim.duration,3000);
  const first=Array.from(g.sampleKnifeAnimation(g.P.kAnim,12000+3000*.35));
  const held=Array.from(g.sampleKnifeAnimation(g.P.kAnim,12000+3000*.65));
  assert.deepEqual(first,held);
  assert.ok(held[14]<-1.5);assert.ok(Math.abs(held[7])>.5); // exibição: lâmina em pé e cabo solto aberto em V
  for(let i=0;i<=200;i++){
    const pose=g.sampleKnifeAnimation(g.P.kAnim,12000+3000*i/200);
    assert.ok(pose[12]>=0&&pose[12]<=1);assert.ok(pose[13]>=0&&pose[13]<=1);
  }
});

test('left and right mouse triggers play distinct knife attacks, respecting their cooldowns', () => {
  for (const knife of ['knife','butterfly']) {
    const g = game({ loadout: { knife }, startSlot: 'knife' }); g.spawnSelf(0); g.P.drawEnd = 0;
    g.P.m1 = g.P.m1Press = true; g.updateWeapon(0,12000);
    assert.equal(g.P.kAnim.type,'slash'); assert.equal(g.P.nextFire,12450);
    g.updateWeapon(.1,12100); assert.equal(g.P.kAnim.t0,12000);
    g.updateWeapon(0,12450); assert.equal(g.P.kAnim.type,'backslash');
    g.P.m1 = false; g.P.m2 = g.P.m2Press = true; g.updateWeapon(0,12900);
    assert.equal(g.P.kAnim.type,'stab'); assert.equal(g.P.nextFire,13900);
    g.updateWeapon(0,13000); assert.equal(g.P.kAnim.t0,12900);
    g.updateWeapon(0,13900); assert.equal(g.P.kAnim.type,'stab'); assert.equal(g.P.kAnim.t0,13900);
  }
});

test('attacking during inspection blends from the exact current pose without a one-frame snap', () => {
  const g = game({ loadout: { knife:'butterfly' }, startSlot:'knife' }); g.spawnSelf(0); g.P.drawEnd = 0;
  g.tick(12000); g.inspect(); const inspection = g.P.kAnim;
  g.tick(12650); g.inspect(); assert.equal(g.P.kAnim,inspection);
  const before = Array.from(g.sampleKnifeAnimation(inspection,12650));
  g.shoot(12650,false); const after = Array.from(g.sampleKnifeAnimation(g.P.kAnim,12650));
  assert.ok(before.every((v,i) => Math.abs(i === 6 || i === 7 ? Math.sin(v-after[i]) : v-after[i]) < 1e-6));
  g.tick(12700); g.inspect(); assert.equal(g.P.kAnim.type,'slash');
  const end = Array.from(g.sampleKnifeAnimation(g.P.kAnim,14000)), idle = Array.from(g.context.sampleButterflyIdle(14000));
  assert.ok(end.every((v,i) => Math.abs(i === 6 || i === 7 ? Math.sin(v - idle[i]) : v - idle[i]) < 1e-6));
});

test('both knife attacks retain their original damage and switching clears their animations', () => {
  for (const heavy of [false,true]) {
    const g = game({ loadout: { knife:'butterfly' }, startSlot:'knife' }); g.spawnSelf(0);
    g.BOT.alive = true; g.BOT.hp = 100;
    g.context.OPP.cur = { a:1,c:0,x:0,y:0,z:-1 };
    g.shoot(12000,heavy); assert.equal(g.BOT.hp,heavy ? 35 : 60);
    g.selectWeapon('rifle'); assert.equal(g.P.kAnim,null);
    g.selectWeapon('butterfly'); assert.equal(g.P.kAnim.type,'draw'); assert.equal(g.P.kAnim.from,null);
  }
});

test('karambit clips remain bounded and keep velocity continuous across pose keys', () => {
  const g=game();
  for(const [type,poses] of Object.entries(g.KARAMBIT_CLIPS)){
    for(let i=1;i<poses.length;i++)for(let step=0;step<=10;step++){
      const a=poses[i-1],b=poses[i],pose=g.sampleKarambitPose(poses,a[0]+(b[0]-a[0])*step/10);
      assert.ok(Array.from(pose).every(Number.isFinite),type);
      for(let j=0;j<pose.length;j++)assert.ok(pose[j]>=Math.min(a[j+1]||0,b[j+1]||0)-2e-6&&pose[j]<=Math.max(a[j+1]||0,b[j+1]||0)+2e-6,`${type}: channel ${j} overshot`);
    }
    for(let i=1;i<poses.length-1;i++){
      const k=poses[i][0],e=1e-5,a=Array.from(g.sampleKarambitPose(poses,k-e)),b=Array.from(g.sampleKarambitPose(poses,k)),c=Array.from(g.sampleKarambitPose(poses,k+e));
      for(let j=0;j<b.length;j++)assert.ok(Math.abs((b[j]-a[j])/e-(c[j]-b[j])/e)<.16,`${type}: channel ${j} changed velocity abruptly`);
    }
  }
});

test('karambit transitions into its idle motion without snapping at animation completion', () => {
  const g=game({startSlot:'knife'});g.spawnSelf(0);
  assert.equal(g.P.kAnim.duration,800); // 24 quadros a 30 fps, como na puxada do CS2
  for(const type of Object.keys(g.KARAMBIT_CLIPS)){
    g.tick(12000);g.beginKnifeAnimation(type,12000);const end=12000+g.P.kAnim.duration;
    const completed=Array.from(g.sampleKnifeAnimation(g.P.kAnim,end));
    const idle=Array.from(g.sampleKarambitIdle(end));
    for(let i=0;i<idle.length;i++)assert.ok(Math.abs(i===6||i===7 ? Math.sin(completed[i]-idle[i]) : completed[i]-idle[i])<3e-6,`${type}: channel ${i} snapped to idle`);
  }
  const before=Array.from(g.sampleKarambitIdle(20000)),after=Array.from(g.sampleKarambitIdle(20016));
  assert.ok(before.some((v,i)=>v!==after[i]));assert.ok(before.every((v,i)=>Math.abs(v-after[i])<.001));
});

test('a karambit attack interrupts inspection at the current pose and keeps the grip closed', () => {
  const g=game({startSlot:'knife'});g.spawnSelf(0);g.P.drawEnd=0;g.tick(12000);g.inspect();
  assert.equal(g.P.kAnim.duration,3000); // tempo da inspeção no vídeo do CS2
  const before=Array.from(g.sampleKnifeAnimation(g.P.kAnim,13000));g.shoot(13000,true);
  const after=Array.from(g.sampleKnifeAnimation(g.P.kAnim,13000));
  for(let i=0;i<before.length;i++)assert.ok(Math.abs(i===6||i===7 ? Math.sin(before[i]-after[i]) : before[i]-after[i])<2e-6);
  const impact=g.sampleKnifeAnimation(g.P.kAnim,13000+g.P.kAnim.duration*.44);
  assert.equal(g.P.kAnim.type,'stab');assert.equal(impact[12],0);assert.equal(impact[6],0);
});

test('the Sublime AK stays locked until the right code, which is never stored in plain text', () => {
  const g = game();
  assert.ok(!html.includes('THEB2026'));
  g.S.skins = { rifle: 'sublime', m4a4: 'sublime', pistol: 'neon' };
  assert.equal(g.context.skinOf('rifle'), 'padrao');
  assert.equal(g.context.skinOf('m4a4'), 'padrao');
  assert.equal(g.context.skinOf('pistol'), 'neon');
  assert.deepEqual(Array.from(g.context.unlockSkinCode('errado')), []);
  assert.equal(g.context.skinOf('rifle'), 'padrao');
  assert.deepEqual(Array.from(g.context.unlockSkinCode(' theb2026 ')), ['sublime']);
  assert.equal(g.context.skinOf('rifle'), 'sublime');
  assert.equal(g.context.skinOf('m4a4'), 'padrao');
  assert.equal(g.context.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(g.context.skinOf('rifle', { rifle: 'sublime' }), 'sublime');
});

test('skin kills escalate the Valorant-style streak and reset on spawn; default skins keep the old sound', () => {
  const g = game(), banners = [];
  g.context.killBanner = (id, n) => banners.push([id, n]);
  g.S.skins = { rifle: 'brasa' }; g.spawnSelf(0);
  for (let i = 0; i < 6; i++) g.context.onMyKill('rifle');
  assert.deepEqual(banners.map(b => b[1]), [1, 2, 3, 4, 5, 6]);
  assert.ok(banners.every(b => b[0] === 'brasa'));
  g.spawnSelf(0); g.context.onMyKill('pistol'); g.context.onMyKill('knife');
  assert.equal(banners.length, 6); assert.equal(g.P.streak, 2);
});

test('Medina, Depósito and Borgo start with no two participants in sight of each other, facing open routes, with reachable high ground', () => {
  for (const map of ['deathmatch', 'dmdeposito', 'dmborgo']) for (let run = 0; run < 3; run++) {
    const g = deathmatch('all', 'medio', map), n = g.DM.nav, first = g.DM.actors.map(a => g.DM.spawnPoints.findIndex(p => Math.abs(p.x - a.pos.x) < .01 && Math.abs(p.z - a.pos.z) < .01));
    assert.ok(first.every(i => i >= 0));
    for (const a of first) for (const b of first) if (a !== b) assert.equal(g.DM.spawnVis[a][b], 0, `spawns ${a} and ${b} see each other`);
    for (const p of g.DM.spawnPoints) { const hit = g.context.traceMap([p.x, p.y + 1.64, p.z], vm.runInContext(`dirFrom(${p.yaw},0)`, g.context), 40); assert.ok(!hit || hit.t >= 6, 'spawn faces a wall'); }
    const high = n.walk.filter(id => n.height[id] > 1.1);
    assert.ok(high.length > 20, 'elevated sites are part of the navigation');
    const bot = g.DM.bots[0], target = high[0];
    bot.pos.set(0, 0, -1);
    assert.ok(g.dmFindPath(bot, n.minX + (target % n.w) * n.step, n.minZ + Math.floor(target / n.w) * n.step));
  }
});

test('2v2 with bots plays full rounds: teams of two, no friendly fire and consistent scoring', () => {
  const g = game({ mode: 'elim', xvx: { mine: 2, foes: 2 } }), cx = g.context, map = g.MAPS.caixas;
  vm.runInContext(section('let mapQueue', 'const SUN ='), cx);
  cx.MAP = Object.assign({ id: 'caixas' }, map); cx.AX = map.ax; cx.AZ = map.az; cx.boxes = [g.floor]; cx.ramps = [];
  const X = map.ax, Z = map.az;
  cx.boxes.push({ min: [-X - 1, 0, -Z - 1], max: [-X, 7, Z + 1] }, { min: [X, 0, -Z - 1], max: [X + 1, 7, Z + 1] }, { min: [-X, 0, -Z - 1], max: [X, 7, -Z] }, { min: [-X, 0, Z], max: [X, 7, Z + 1] });
  const B = { box(x, z, w, d, h, c, y = 0) { cx.boxes.push({ min: [x - w / 2, y, z - d / 2], max: [x + w / 2, y + h, z + d / 2] }); },
    pair(x, z, w, d, h, c, y = 0) { B.box(x, z, w, d, h, c, y); B.box(-x, -z, w, d, h, c, y); },
    shield(zc, hw) { cx.MAP.exit = { zc, hw }; B.box(0, zc, hw * 2, .8, 3.2); B.box(0, -zc, hw * 2, .8, 3.2); } };
  map.build(B, {});
  Object.assign(cx, { clearDecals() {}, sleeveMat: { color: { set() {} } }, MAP_IDS: ['caixas'] });
  cx.G.mode = 'team'; cx.G.opp = null; g.S.map = 'caixas'; g.S.target = 3; g.S.roundTime = 40; g.S.botLevel = 'dificil';
  let t = 10000; g.tick(t); vm.runInContext('teamSetup(10000,false)', cx);
  const T = vm.runInContext('ARENA', cx);
  assert.deepEqual(Array.from(g.DM.actors, e => e.team).sort(), [0, 0, 1, 1]);
  const phases = new Set(); let checkedFriendlyFire = false;
  while (t < 10000 + 400000 && !(g.DM.phase === 'over')) {
    t += 1000 / 30; g.tick(t); vm.runInContext(`teamTick(1/30,${t})`, cx); phases.add(g.DM.phase);
    if (!checkedFriendlyFire && g.DM.phase === 'live') {
      const ally = g.DM.actors.find(e => e !== g.P && e.team === g.P.team && e.alive);
      if (ally && g.P.alive) { assert.equal(g.dmDamage(ally, 80, 'body', 'rifle', g.P, t), 0); assert.equal(ally.hp, 100); checkedFriendlyFire = true; }
    }
  }
  assert.ok(checkedFriendlyFire);
  assert.equal(g.DM.phase, 'over'); assert.equal(Math.max(...T.sc), 3);
  for (const p of ['freeze', 'live', 'end', 'over']) assert.ok(phases.has(p), p);
  const kills = g.events.filter(e => e.topic === 'feed');
  assert.ok(kills.length >= 3);
  for (const k of kills) assert.notEqual(g.DM.byId.get(k.killer).team, g.DM.byId.get(k.victim).team);
  const stats = Object.values(cx.G.stats); assert.equal(stats.reduce((s, e) => s + e.k, 0), stats.reduce((s, e) => s + e.d, 0));
  assert.equal(stats.reduce((s, e) => s + e.k, 0), kills.length);
});

test('DM kills refill the magazine at once and headshot kills heal 50, for the player and for bots', () => {
  const g = deathmatch('rifle'), bot = g.DM.bots[0], victim = g.DM.bots[1], other = g.DM.bots[2];
  g.dmTick(0, 13000); for (const e of g.DM.actors) e.safeUntil = 0;
  g.P.weapon = 'rifle'; g.P.ammo.rifle.mag = 3; g.P.reloadEnd = 99999; g.P.hp = 30;
  assert.equal(g.dmDamage(victim, 200, 'body', 'rifle', g.P, 13001), 100);
  assert.equal(g.P.ammo.rifle.mag, 30); assert.equal(g.P.reloadEnd, 0); assert.equal(g.P.hp, 30);
  assert.equal(g.dmDamage(other, 200, 'head', 'rifle', g.P, 13002), 100);
  assert.equal(g.P.hp, 80);
  g.P.hp = 90; const third = g.DM.bots[3]; g.dmDamage(third, 200, 'head', 'rifle', g.P, 13003); assert.equal(g.P.hp, 100);
  bot.hp = 20; bot.mag = 1; const fourth = g.DM.bots[4];
  g.dmDamage(fourth, 200, 'head', bot.w, bot, 13004);
  assert.equal(bot.hp, 70); assert.equal(bot.mag, g.W[bot.w].mag);
});

// Sala online simulada: PeerJS falso que entrega as mensagens reais do protocolo entre anfitrião e convidado.
function fakeNet(g) {
  const peers = [];
  class FakeConn { constructor() { this.handlers = {}; this.open = false; this.sent = []; } on(ev, fn) { this.handlers[ev] = fn; } send(m) { this.sent.push(JSON.parse(JSON.stringify(m))); } close() {} }
  class FakePeer { constructor(id) { this.id = id; this.handlers = {}; peers.push(this); } on(ev, fn) { this.handlers[ev] = fn; } connect() { this.conn = new FakeConn(); return this.conn; } destroy() {} reconnect() {} }
  const node = () => ({ hidden: true, textContent: '', disabled: false, classList: { add() {}, remove() {}, toggle() {} }, replaceChildren() {}, style: { setProperty() {} } });
  Object.assign(g.context, { Peer: FakePeer, ICE: {}, PEER_OPTS: {}, INTERP: 55, clearTimeout() {}, toast() {}, leaveSession() {}, sleeveMat: { color: { set() {} } }, clearDecals() {},
    document: { getElementById: node }, el: { feed: node(), hud: node() } });
  g.peers = peers; g.FakeConn = FakeConn; return g;
}
function connect(host, guest, code) {
  vm.runInContext(`arenaNetStart('${code}')`, host.context); host.peers.at(-1).handlers.open();
  vm.runInContext(`arenaNetStart('${code}')`, guest.context); guest.peers.at(-1).handlers.error({ type: 'unavailable-id' });
  const gp = guest.peers.at(-1); gp.handlers.open(); const toHost = gp.conn, toGuest = new host.FakeConn();
  host.peers[0].handlers.connection(toGuest); toGuest.open = toHost.open = true; toGuest.handlers.open(); toHost.handlers.open();
  return () => { for (let i = 0; i < 4; i++) { const a = toGuest.sent.splice(0), b = toHost.sent.splice(0); a.forEach(m => toHost.handlers.data(m)); b.forEach(m => toGuest.handlers.data(m)); } };
}

test('DM room: a friend joins the host map, takes a bot slot, and shares respawns, kills, rewards and scores', () => {
  const host = fakeNet(dmWorld(game(), 'dust2')), guest = fakeNet(dmWorld(game()));
  for (const g of [host, guest]) { g.S.dmWeapons = 'rifle'; g.S.name = g === host ? 'Ana' : 'Beto'; vm.runInContext("ARENA.kind='dm';ARENA.net=true;ARENA.host=true", g.context); }
  let t = 10000; const tick = ms => { t += ms; host.tick(t); guest.tick(t); };
  tick(0); const pump = connect(host, guest, 'amigos');
  pump(); tick(400); host.dmTick(0, t); pump();
  vm.runInContext('arenaNetTick(now())', host.context); pump();
  assert.equal(guest.context.MAP.id, 'dust2');
  assert.equal(guest.context.G.view.mp, 'dust2');
  assert.equal(host.DM.actors.length, 10); assert.equal(host.DM.bots.length, 8);
  assert.equal(guest.context.G.me, 'B'); assert.equal(guest.DM.actors.length, 10);
  assert.deepEqual(Array.from(host.DM.actors, e => e.id).sort(), Array.from(guest.DM.actors, e => e.id).sort());
  assert.equal(guest.P.alive, true, 'guest spawned by the host');
  tick(3200); host.dmTick(0, t); vm.runInContext('dmGuestTick(0,now())', guest.context);
  assert.equal(host.DM.phase, 'live'); assert.equal(guest.DM.phase, 'live');
  guest.P.safeUntil = 0; host.P.safeUntil = 0;
  for (let i = 0; i < 3; i++) { tick(40); vm.runInContext('arenaNetTick(now())', guest.context); pump(); vm.runInContext('arenaUpdateProxies(now()+100)', host.context); }
  const proxyB = host.DM.byId.get('B'); assert.equal(proxyB.alive, true); proxyB.safeUntil = 0;
  host.P.hp = 40; host.P.weapon = 'rifle'; host.P.ammo.rifle.mag = 2;
  assert.ok(host.dmDamage(proxyB, 200, 'head', 'rifle', host.P, t) > 0);
  pump(); pump();
  assert.equal(guest.P.alive, false);
  assert.equal(host.stat('A').k, 1); assert.equal(guest.stat('A').k, 1); assert.equal(guest.stat('B').d, 1);
  assert.equal(host.P.hp, 90); assert.equal(host.P.ammo.rifle.mag, 30);
  tick(1600); host.dmTick(0, t); pump();
  assert.equal(guest.P.alive, true, 'guest respawned after the DM delay');
  for (let i = 0; i < 3; i++) { tick(40); vm.runInContext('arenaNetTick(now())', guest.context); pump(); vm.runInContext('arenaUpdateProxies(now()+100)', host.context); }
  assert.equal(host.DM.byId.get('B').alive, true, 'host sees the respawned friend');
  const bot = host.DM.bots[0]; bot.safeUntil = 0; bot.alive = true; bot.hp = 100;
  guest.P.hp = 30; guest.P.safeUntil = 0;
  const botProxy = guest.DM.byId.get(bot.id); botProxy.alive = true; botProxy.safeUntil = 0;
  assert.ok(guest.dmDamage(botProxy, 200, 'head', 'rifle', guest.P, t) > 0);
  pump(); pump();
  assert.equal(bot.alive, false); assert.equal(host.stat('B').k, 1); assert.equal(guest.stat('B').k, 1); assert.equal(guest.P.hp, 80);
});

test('XvX: 1v5 against bots respects team sizes and plays rounds with only cross-team kills', () => {
  const g = game(), cx = g.context, map = g.MAPS.caixas;
  vm.runInContext(section('let mapQueue', 'const SUN ='), cx);
  cx.MAP = Object.assign({ id: 'caixas' }, map); cx.AX = map.ax; cx.AZ = map.az; cx.boxes = [g.floor]; cx.ramps = [];
  const X = map.ax, Z = map.az;
  cx.boxes.push({ min: [-X - 1, 0, -Z - 1], max: [-X, 7, Z + 1] }, { min: [X, 0, -Z - 1], max: [X + 1, 7, Z + 1] }, { min: [-X, 0, -Z - 1], max: [X, 7, -Z] }, { min: [-X, 0, Z], max: [X, 7, Z + 1] });
  const B = { box(x, z, w, d, h, c, y = 0) { cx.boxes.push({ min: [x - w / 2, y, z - d / 2], max: [x + w / 2, y + h, z + d / 2] }); },
    pair(x, z, w, d, h, c, y = 0) { B.box(x, z, w, d, h, c, y); B.box(-x, -z, w, d, h, c, y); },
    shield(zc, hw) { cx.MAP.exit = { zc, hw }; B.box(0, zc, hw * 2, .8, 3.2); B.box(0, -zc, hw * 2, .8, 3.2); } };
  map.build(B, {});
  Object.assign(cx, { clearDecals() {}, sleeveMat: { color: { set() {} } }, MAP_IDS: ['caixas'] });
  cx.G.mode = 'team'; g.S.map = 'caixas'; g.S.mode = 'elim'; g.S.xvx = { mine: 1, foes: 5 }; g.S.target = 2; g.S.roundTime = 40;
  let t = 10000; g.tick(t); vm.runInContext('teamSetup(10000,false)', cx);
  assert.deepEqual(Array.from(g.DM.actors, e => e.team).sort(), [0, 1, 1, 1, 1, 1]);
  const T = vm.runInContext('ARENA', cx);
  while (t < 10000 + 300000 && g.DM.phase !== 'over') { t += 1000 / 30; g.tick(t); vm.runInContext(`teamTick(1/30,${t})`, cx); }
  assert.equal(g.DM.phase, 'over'); assert.equal(Math.max(...T.sc), 2);
  const kills = g.events.filter(e => e.topic === 'feed');
  for (const k of kills) assert.notEqual(g.DM.byId.get(k.killer).team, g.DM.byId.get(k.victim).team);
});

test('Team room: people on opposite sides, bots fill the rest, and a networked kill counts on both sides', () => {
  const setup = g => {
    const cx = g.context, map = g.MAPS.caixas; vm.runInContext(section('let mapQueue', 'const SUN ='), cx);
    cx.MAP = Object.assign({ id: 'caixas' }, map); cx.AX = map.ax; cx.AZ = map.az; cx.boxes = [g.floor]; cx.ramps = []; cx.MAP_IDS = ['caixas'];
    cx.G.mode = 'team'; g.S.map = 'caixas'; g.S.mode = 'elim'; g.S.xvx = { mine: 2, foes: 2 }; g.S.teamSetup = 'versus';
    vm.runInContext("ARENA.kind='team';ARENA.host=true", cx); vm.runInContext('teamSetup(now(),true)', cx); return g;
  };
  const host = setup(fakeNet(game())), guest = setup(fakeNet(game()));
  let t = 10000; host.tick(t); guest.tick(t);
  const pump = connect(host, guest, 'times'); pump();
  t += 1600; host.tick(t); guest.tick(t); vm.runInContext(`teamTick(0,${t})`, host.context); pump();
  const roster = vm.runInContext('ARENA.roster', host.context);
  assert.deepEqual(Array.from(roster, r => r[0] + r[1] + r[3][0]), ['A0h', 'X10b', 'B1h', 'X21b']);
  assert.equal(guest.context.G.me, 'B'); assert.equal(guest.P.team, 1); assert.equal(guest.DM.actors.length, 4);
  t += 3100; host.tick(t); guest.tick(t); vm.runInContext(`teamTick(0,${t})`, host.context); pump();
  assert.equal(host.DM.phase, 'live'); assert.equal(guest.DM.phase, 'live');
  for (let i = 0; i < 3; i++) { t += 40; host.tick(t); guest.tick(t); vm.runInContext('arenaNetTick(now())', guest.context); vm.runInContext('arenaNetTick(now())', host.context); pump(); }
  vm.runInContext('arenaUpdateProxies(now()+100)', guest.context);
  const proxyA = guest.DM.byId.get('A'); assert.equal(proxyA.alive, true);
  assert.ok(guest.dmDamage(proxyA, 200, 'head', 'usps', guest.P, t) > 0); pump(); pump();
  assert.equal(host.P.alive, false); assert.equal(host.stat('B').k, 1); assert.equal(guest.stat('B').k, 1); assert.equal(guest.stat('A').d, 1);
  const ally = guest.DM.actors.find(e => e !== guest.P && e.team === guest.P.team);
  assert.equal(guest.dmDamage(ally, 50, 'body', 'usps', guest.P, t), 0, 'no friendly fire across the network either');
});

test('bots fight across the Depósito and Borgo maps and use their elevated parts', () => {
  for (const map of ['dmdeposito', 'dmborgo']) {
    const g = deathmatch('rifle', 'dificil', map); let high = 0;
    assert.ok(g.DM.spawnPoints.length >= 26, map);
    const end = g.time + 60000;
    while (g.time < end) { g.advance(1000, 1/30); high += g.DM.bots.filter(b => b.alive && b.pos.y > 1).length; }
    const kills = g.events.filter(e => e.topic === 'feed' && e.killer !== 'A' && e.victim !== 'A');
    assert.ok(kills.length >= 5, map + ': ' + kills.length + ' kills');
    assert.ok(high > 0, map + ': bots never climbed');
    for (const b of g.DM.bots) assert.ok(Math.abs(b.pos.x) < 24 && Math.abs(b.pos.z) < 24 && Number.isFinite(b.pos.y));
  }
});

function nadeWorld() {
  const g = game(), cx = g.context;
  cx.G.mode = 'dm'; vm.runInContext("DM.active=true;DM.phase='live';DM.mode='dm';DM.endsAt=Infinity;DM.startsAt=0;", cx);
  const bot = (i, x, z, yaw = 0) => { const b = cx.dmMakeBot(i); b.pos.set(x, 0, z); b.alive = true; b.hp = 100; b.yaw = yaw; b.pitch = 0; b.safeUntil = 0; return b; };
  g.spawnSelf(0, [0, 0, 0]); g.P.safeUntil = 0;
  const run = (from, ms) => { for (let t = from; t <= from + ms; t += 1000 / 60) { g.tick(t); cx.nadesTick(1 / 60, t); } };
  const actors = list => { cx.__list = list; vm.runInContext('DM.actors.length=0;DM.byId.clear();for(const e of __list){DM.actors.push(e);DM.byId.set(e.id,e);}', cx); };
  return { g, cx, bot, run, actors, N: vm.runInContext('NADE', cx) };
}
test('grenades bounce off walls instead of passing through them and settle on the floor', () => {
  const { g, cx, run, N } = nadeWorld();
  cx.boxes.push({ min: [-5, 0, -3.2], max: [5, 4, -3] });
  const n = cx.throwNade(g.P, 'smoke', [0, 1.6, 0], 0, 0, 15, 10000, null);
  run(10000, 600); assert.ok(n.pos.z > -3.05, 'atravessou a parede: ' + n.pos.z); assert.ok(n.vel.z >= 0 || n.vel.z > -1);
  run(10600, 2500); assert.equal(N.list.length, 0); assert.equal(N.clouds.length, 1);
});
test('HE damage falls with distance, respects cover and keeps counting after the thrower dies', () => {
  const { g, cx, bot, run, actors, N } = nadeWorld();
  const near = bot(0, 0, -2.4), mid = bot(1, 0, -5.5), far = bot(2, 0, -9), hidden = bot(3, 3, 0);
  cx.boxes.push({ min: [1.4, 0, -1], max: [1.7, 3, 1] });
  actors([g.P, near, mid, far, hidden]);
  cx.throwNade(g.P, 'he', [0, .3, -.4], 0, -1.5, 0, 10000, null); g.P.alive = false;
  run(10000, 1700);
  assert.equal(N.list.length, 0);
  assert.ok(near.hp < mid.hp && mid.hp < 100, near.hp + ' ' + mid.hp);
  assert.equal(far.hp, 100); assert.equal(hidden.hp, 100);
});
test('flash blinds who looks at it much longer than who turns away, and smoke hides both ways', () => {
  const { g, cx, bot, run, actors, N } = nadeWorld();
  const facing = bot(0, 0, 5, 0), away = bot(1, 0, -5, 0);
  actors([g.P, facing, away]);
  g.P.alive = false;
  cx.throwNade(g.P, 'flash', [0, 1.6, 0], 0, 0, 0, 10000, null); N.list[0].vel.set(0, 0, 0);
  run(10000, 1650);
  assert.ok(facing.blindUntil - 11650 > 2000, String(facing.blindUntil));
  assert.ok(away.blindUntil - 11650 < 600, String(away.blindUntil));
  const s = cx.throwNade(g.P, 'smoke', [0, .2, 20], 0, -1.5, 0, 20000, null);
  run(20000, 2000);
  assert.equal(N.clouds.length, 1);
  assert.equal(cx.smokeBlocks([-8, 1.6, 20], [8, 1.6, 20]), true);
  assert.equal(vm.runInContext('seeLine([-8, 1.6, 30], [8, 1.6, 30])', cx), true);
  run(22000, 19000); assert.equal(N.clouds.length, 0);
});
test('hitmarker: no damage numbers, no marker through smoke, and it can be turned off', () => {
  const { g, cx, bot, actors, N } = nadeWorld();
  const foe = bot(0, 0, -8, Math.PI); actors([g.P, foe]); cx.dmRefreshTargets();
  const marks = []; cx.hitmark = kind => marks.push({ kind, smoke: vm.runInContext('HIT.smoke', cx) });
  const fire = t => { g.selectWeapon('rifle'); g.P.drawEnd = 0; g.P.nextFire = 0; g.P.ammo.rifle.mag = 30; g.P.yaw = 0; g.P.pitch = -.04; g.P.vel.set(0, 0, 0); g.P.shots = 0; g.P.recoilP = g.P.recoilY = 0; foe.hp = 100; foe.alive = true; g.shoot(t, false); return 100 - foe.hp; };
  assert.ok(fire(20000) > 0, 'o tiro acerta'); assert.equal(marks.length, 1); assert.equal(marks[0].smoke, false);
  N.clouds.push({ x: 0, y: 1.5, z: -4, r: 3, t0: 0, until: Infinity });
  marks.length = 0; assert.ok(fire(21000) > 0, 'pela smoke o dano continua');
  assert.ok(marks.every(m => m.smoke), 'pela smoke o hitmarker não aparece');
  assert.equal(vm.runInContext('HIT.smoke', cx), false, 'a marca da smoke só vale durante o tiro');
  const html = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!/id="dmgn"|dmgNumber/.test(html), 'sem número de dano');
  assert.match(html, /data-k="hitmarker"/); assert.match(html, /if \(!S\.hitmarker \|\| HIT\.smoke\) return;/);
});
test('grenades throw like CS: pressing pulls the pin and holds, releasing swings the arm and the grenade leaves mid-throw; the last one switches back to a gun', () => {
  const { g, cx } = nadeWorld();
  g.P.nades = { he: 1, flash: 0, smoke: 0 }; g.ORDER.splice(0, g.ORDER.length, 'rifle', 'pistol', 'knife', 'he');
  g.selectWeapon('he'); g.P.drawEnd = 0; g.P.nextFire = 0; g.P.m1Press = true; g.P.m1 = true;
  const thrown = () => vm.runInContext('NADE.list.length', cx);
  g.updateWeapon(0, 30000);
  assert.equal(thrown(), 0, 'apertar só puxa o pino'); assert.ok(g.P.nadePrep);
  g.updateWeapon(0, 31500); assert.equal(thrown(), 0, 'segurando, a granada fica na mão');
  g.P.m1 = false; g.updateWeapon(0, 31600);
  assert.equal(thrown(), 0, 'soltou: começa o arremesso'); assert.ok(g.P.nadePending);
  g.updateWeapon(0, 31760);
  assert.equal(g.P.nades.he, 0); assert.equal(thrown(), 1, 'sai da mão no meio do movimento');
  g.updateWeapon(0, 32300);
  assert.notEqual(g.P.weapon, 'he'); assert.ok(!g.ORDER.includes('he')); assert.ok(g.ORDER.includes(g.P.weapon));
});
test('a quick click still waits for the pin, and both buttons throw at medium range', () => {
  const { g, cx } = nadeWorld();
  g.P.nades = { he: 0, flash: 2, smoke: 0 }; g.ORDER.splice(0, g.ORDER.length, 'rifle', 'pistol', 'knife', 'flash');
  g.selectWeapon('flash'); g.P.drawEnd = 0; g.P.nextFire = 0; g.P.m1Press = true; g.P.m1 = true; g.P.m2 = true;
  g.updateWeapon(0, 40000); g.P.m1 = g.P.m2 = false; g.updateWeapon(0, 40050);
  assert.ok(g.P.nadePrep && !g.P.nadePending, 'o pino ainda não saiu');
  g.updateWeapon(0, 40330); assert.equal(g.P.nadePending.mode, 'mid');
  g.updateWeapon(0, 40500); assert.equal(vm.runInContext('NADE.list.length', cx), 1);
});

function bombWorld(map = 'guard', setup) {
  const g = game({ mode: 'bomb' }), cx = g.context;
  cx.G.mode = 'team'; cx.buildMap(map); vm.runInContext('dmBuildNav([])', cx);
  Object.assign(cx, { clearDecals() {}, sleeveMat: { color: { set() {} } } });
  cx.G.mode = 'team'; cx.G.opp = null; g.S.mode = 'wingman'; g.S.botLevel = 'dificil';
  if (setup) vm.runInContext(setup, cx);
  g.tick(10000); vm.runInContext('teamSetup(10000,false)', cx);
  const A = vm.runInContext('ARENA', cx), BM = vm.runInContext('BOMB', cx);
  const step = (from, ms, each) => { let t = from; for (; t < from + ms; t += 1000 / 30) { g.tick(t); vm.runInContext(`teamTick(1/30,${t});nadesTick(1/30,${t})`, cx); if (each && each(t)) break; } return t; };
  return { g, cx, A, BM, step };
}
test('native maps retain BSP spawn coordinates, angles and connected floors in their selected regions',()=>{
  const originals={guard:{t:[720.804,1248,-80,225],ct:[1108,-1984,-88,135],count:10,sites:1},elysion:{t:[-304,-1392,9616,90],ct:[-192,928,9744,270],count:27,sites:1}};
  for(const [key,expected]of Object.entries(originals)){
    const g=game({mode:'bomb'}),cx=g.context;cx.buildMap(key);g.dmBuildNav([]);const source=cx.sourceWorld,meta=source.meta;
    for(const side of ['t','ct']){const p=meta[side][0],raw=[p[0]/meta.scale+meta.center[0],meta.center[1]-p[1]/meta.scale,p[3]/meta.scale+meta.center[2],p[2]*180/Math.PI+90];for(let i=0;i<4;i++)assert.ok(Math.abs(raw[i]-expected[side][i])<.00001,key+' '+side+' '+i);}
    assert.equal(g.DM.nav.audit.spawnsConnected,expected.count);assert.equal(g.DM.nav.audit.spawnsTotal,expected.count);assert.equal(meta.sites.length,expected.sites);
    for(const p of meta.t.concat(meta.ct)){const y=source.ground(p[0],p[1],p[3]);assert.ok(Number.isFinite(y)&&Math.abs(y-p[3])<1);assert.equal(source.overlap(p[0],y+.03,p[1],1.8,.3),false);}
    for(const site of meta.sites){const x=(site.x0+site.x1)/2,z=(site.z0+site.z1)/2;assert.equal(cx.bombInSite(x,z,site.y0),true);assert.equal(cx.bombInSite(x,z,site.y1+1.8),false,'cannot plant from a floor above the site');}
    assert.ok(source.mesh.opaque>0);assert.ok(source.count<40000);assert.ok(source.meta.sourceSha256.length===64);
  }
});
test('Elysion keeps only Wingman A and the reference passages, with cropped geometry and original flat colours',()=>{
  const map=sourcePacked.elysion,meta=map.meta,report=JSON.parse(readFileSync(resolve(__dirname,'../assets/maps/elysion-source.json'),'utf8'));
  assert.deepEqual(meta.sites.map(s=>s.name),['A']);assert.equal(report.wingman.before.sites,2);
  assert.ok(report.triangles<65000&&report.wingman.polygons<report.wingman.before.polygons*.6);
  const positions=Buffer.from(map.mesh.position,'base64');for(let p=0;p<positions.length;p+=12)for(let axis=0;axis<3;axis++){const v=positions.readFloatLE(p+axis*4);assert.ok(v>=meta.bounds[axis]-.001&&v<=meta.bounds[axis+3]+.001);}
  const g=game(),cx=g.context;cx.buildMap('elysion');g.dmBuildNav([]);
  // The lounge shown at lower right is still connected, but the CSS port's B is not plantable.
  assert.equal(cx.bombInSite(21.6321,9.1776),false);
  const nav=g.DM.nav;assert.ok(nav.walk.some(id=>nav.x[id]>19&&nav.z[id]>7&&nav.z[id]<12));
  assert.ok(Math.abs((meta.playBounds[2]-meta.playBounds[0])/(meta.playBounds[3]-meta.playBounds[1])-410/492)<.02);
  const colors=new Set();const bytes=Buffer.from(map.mesh.color,'base64');for(let p=0;p<bytes.length;p+=3)colors.add(bytes.subarray(p,p+3).toString('hex'));
  assert.ok(colors.has('f5f5f5'));assert.ok(colors.has('372e28'));assert.ok(colors.has('d6d6d6'));
  assert.equal(report.flatColors.models,71);assert.ok(map.mesh.opaque>0);
  const guardReport=JSON.parse(readFileSync(resolve(__dirname,'../assets/maps/guard-source.json'),'utf8'));
  assert.ok(guardReport.flatColors.materials>200&&guardReport.flatColors.models>100);
});
test('actual player physics follows the native paths from T to CT and to every active bombsite',()=>{
  for(const key of ['guard','elysion']){
    const g=game({mode:'bomb'}),cx=g.context;cx.buildMap(key);g.dmBuildNav([]);const map=g.MAPS[key],nav=g.DM.nav,from=map.plant.t[0],targets=[map.plant.ct[0],...map.plant.sites.map(s=>[(s.x0+s.x1)/2,(s.z0+s.z1)/2,0])];
    for(const goal of targets){const actor={pos:new Vec(from[0],cx.groundAt(from[0],from[1],from[3]),from[1]),vel:new Vec(),h:1.8,onGround:true,crouch:false,path:[],pathAt:0,landSpread:0};
      assert.equal(g.dmFindPath(actor,goal[0],goal[1]),true);assert.ok(actor.path.length>20);
      for(const id of actor.path){const tx=nav.x[id],tz=nav.z[id];let frames=0;while(Math.hypot(tx-actor.pos.x,tz-actor.pos.z)>.12&&frames++<400){const dx=tx-actor.pos.x,dz=tz-actor.pos.z,d=Math.hypot(dx,dz);g.physics(actor,dx/d,dz/d,4.5,false,1/128);}
        assert.ok(frames<400,key+' blocked at '+id);assert.ok(actor.pos.y>-15&&Number.isFinite(actor.pos.y));
      }
      assert.ok(Math.hypot(actor.pos.x-goal[0],actor.pos.z-goal[1])<3.5,key+' did not reach destination');
    }
  }
});
test('native spatial ray queries match all convex hulls and keep player clips out of bullet collisions',()=>{
  for(const key of ['guard','elysion']){
    const g=game(),cx=g.context;cx.buildMap(key);g.dmBuildNav([]);const map=cx.sourceWorld,nav=g.DM.nav;
    for(let i=0;i<36;i++){
      const id=nav.walk[(i*71)%nav.walk.length],o=[nav.x[id],nav.height[id]+1.64,nav.z[id]],a=i*2.39996,d=[Math.cos(a)*.98,Math.sin(i*1.27)*.2,Math.sin(a)*.98];let brute=null;
      for(let id=0;id<map.count;id++)if(map.masks[id]&2){const hit=map.hullRay(id,o,d,brute?brute.t:120);if(hit&&(!brute||hit.t<brute.t))brute=hit;}
      const fast=map.ray(o,d,120);assert.equal(!!fast,!!brute,key+' ray '+i);if(fast)assert.ok(Math.abs(fast.t-brute.t)<.001,key+' ray '+i+' '+fast.t+'/'+brute.t);
    }
  }
});
test('Guard retains its vertical ladder and jumping releases the ladder',()=>{
  const g=game(),cx=g.context;cx.buildMap('guard');const map=cx.sourceWorld,b=map.meta.ladders[0];assert.ok(b);
  const x=(b[0]+b[3])/2,z=b[2]-.31;g.P.pos.set(x,(b[1]+b[4])/2,z);g.P.vel.set(0,0,0);g.P.h=1.8;
  map.climb(g.P,0,1,false,.3);assert.equal(g.P.climbing,true);assert.equal(g.P.vel.y,3);
  map.climb(g.P,0,-1,false,.3);assert.equal(g.P.vel.y,-3);
  map.climb(g.P,0,1,true,.3);assert.equal(g.P.climbing,false);
});
test('Plant the Bomb buys follow Wingman prices, sides and limits, and round rewards follow the CS economy', () => {
  const { g, cx, A, BM, step } = bombWorld();
  let t = step(10000, 1000);
  assert.equal(A.bomb, true); assert.equal(g.DM.phase, 'freeze');
  assert.equal(g.P.money, 800); for (const e of g.DM.bots) assert.ok(e.money <= 800 && e.money >= 0, String(e.money));
  const side = vm.runInContext('sideOf(P)', cx), rifle = side === 't' ? 'm4a4' : 'rifle';
  assert.equal(cx.bombBuyBlock(g.P, rifle, t), side === 't' ? 'Só Defensores' : 'Só Atacantes');
  assert.equal(cx.bombBuy(g.P, 'kevlar', t), true); assert.equal(g.P.money, 150); assert.equal(g.P.inv.armor, 100);
  assert.equal(cx.bombBuyBlock(g.P, 'kevlar', t), 'Já tem');
  assert.equal(cx.bombBuy(g.P, 'flash', t), false); assert.equal(cx.bombBuyBlock(g.P, 'smoke', t), 'Sem dinheiro');
  g.P.money = 8000; assert.ok(cx.bombBuy(g.P, 'flash', t)); assert.ok(cx.bombBuy(g.P, 'flash', t)); assert.equal(cx.bombBuyBlock(g.P, 'flash', t), 'Limite');
  assert.ok(cx.bombBuy(g.P, 'ump', t)); assert.ok(g.ORDER.includes('ump')); assert.equal(g.P.weapon, 'ump');
  // fim da rodada (Wingman): vencedor +3000 por bomba, perdedor +2000 (+600 se plantou), teto de $8.000
  t = step(t, 11000); assert.equal(g.DM.phase, 'live');
  const money = new Map(g.DM.actors.map(e => [e, e.money]));
  BM.plantedBy = null; cx.bombEndRound(t, BM.tTeam, 'bomb');
  for (const e of g.DM.actors) assert.equal(e.money, Math.min(8000, money.get(e) + (e.team === BM.tTeam ? 3000 : 2000)), e.name);
  assert.equal(A.sc[BM.tTeam], 1); assert.equal(g.DM.phase, 'end');
});
test('the player plants only inside the site, the bomb defuses faster with a kit, and a defuse wins for SWAT', () => {
  const { g, cx, A, BM, step } = bombWorld();
  let t = step(10000, 11500);
  const s = vm.runInContext('MAP.plant.site', cx);
  for (const e of g.DM.bots) { e.alive = false; e.respawnAt = Infinity; }
  BM.tTeam = g.P.team; BM.carrier = g.P.id; cx.bombEquip(g.P, t, false); g.keys.add('KeyE');
  g.P.pos.set(0, 0, 20); g.P.vel.set(0, 0, 0); cx.bombPlayerAction(1 / 30, t); assert.equal(g.P.plantUntil, 0);
  // um inimigo vivo para a rodada não acabar por eliminação
  const foe = g.DM.actors.find(e => e.team !== g.P.team); foe.alive = true; foe.pos.set(-18, 0, 20);
  g.P.pos.set((s.x0 + s.x1) / 2, 0, (s.z0 + s.z1) / 2); cx.bombPlayerAction(1 / 30, t); assert.ok(g.P.plantUntil > t, JSON.stringify({alive:g.P.alive,ph:g.DM.phase,c:BM.carrier,id:g.P.id,ins:cx.bombInSite(g.P.pos.x,g.P.pos.z),g:g.P.onGround,v:[g.P.vel.x,g.P.vel.z],on:vm.runInContext("bombOn()",cx),pl:!!BM.planted}));
  cx.bombPlayerAction(1 / 30, t + 3300); assert.ok(BM.planted); assert.ok(!g.ORDER.includes('c4'));
  assert.equal(A.roundEnd, BM.planted.t + 40000);
  // troca: o jogador vira SWAT com kit e desarma em 5 s
  BM.tTeam = 1 - g.P.team; g.P.inv.kit = true; foe.alive = true;
  cx.bombPlayerAction(1 / 30, t + 4000); assert.equal(g.P.defuseUntil, t + 4000 + 5000);
  cx.bombPlayerAction(1 / 30, t + 9100); assert.equal(g.DM.phase, 'end'); assert.equal(A.why, 'defuse'); assert.equal(A.win, g.P.team);
});
test('a short bot match plays rounds with plants or eliminations, swaps sides at the half and ends at the target', () => {
  const { g, cx, A, BM, step } = bombWorld('guard', 'BOMB.half=2;BOMB.target=3;BOMB.maxRounds=4;');
  const sides = [], reasons = new Set(); let plants = 0, lastRound = 0;
  let t = step(10000, 900000, t => {
    if (A.r !== lastRound) { lastRound = A.r; sides.push(BM.tTeam); }
    if (BM.planted && !BM.planted.counted) { BM.planted.counted = true; plants++; }
    if (g.DM.phase === 'end') reasons.add(A.why);
    if (A.m) for (const e of g.DM.actors) assert.ok(e.money >= 0 && e.money <= 8000, e.name + ' ' + e.money);
    return g.DM.phase === 'over';
  });
  assert.equal(g.DM.phase, 'over', 'partida não terminou');
  assert.ok(Math.max(...A.sc) === 3 || A.r === 4, JSON.stringify(A.sc));
  assert.notEqual(sides[0], sides[2], 'não trocou de lado');
  assert.ok(reasons.size >= 1); assert.ok([...reasons].every(r => ['kill', 'time', 'bomb', 'defuse'].includes(r)), [...reasons].join());
});
test('crouching cuts recoil by 15%, and each shot kicks the gun back on a smooth spring like CS:GO', () => {
  const g = game(), cx = g.context; g.spawnSelf(0); g.selectWeapon('rifle');
  const kick = crouch => { g.P.recoilP = g.P.recoilY = 0; g.P.shots = 4; g.P.crouch = crouch; g.P.onGround = true; cx.applyRecoil(g.W.rifle); return g.P.recoilP; };
  const stand = kick(false), duck = kick(true); assert.ok(stand > 0); assert.ok(Math.abs(duck - stand * .85) < 1e-12, duck + ' vs ' + stand);
  const awp = c => { g.P.recoilP = 0; g.P.crouch = c; cx.applyRecoil(g.W.sniper); return g.P.recoilP; };
  assert.ok(Math.abs(awp(true) - awp(false) * .85) < 1e-12);
  g.P.recoilP = 0; g.P.shots = 4; g.P.crouch = true; g.P.onGround = false; cx.applyRecoil(g.W.rifle); assert.ok(Math.abs(g.P.recoilP - stand) < 1e-12, 'no ar não conta como agachado');
  // Coice: sobe rápido, passa por um pico pequeno e volta sozinho, sem tremer, a qualquer FPS.
  for (const fps of [30, 60, 144]) {
    g.P.vmKick = { z: 0, v: 0 }; cx.vmKickImpulse('rifle'); let peak = 0, low = 0, t = 0, z = 0;
    for (; t < .5; t += 1 / fps) { z = cx.vmKickStep(1 / fps); peak = Math.max(peak, z); low = Math.min(low, z); }
    assert.ok(peak > .02 && peak < .06, fps + ' pico ' + peak); assert.ok(low > -peak * .15, 'quase sem rebote'); assert.ok(Math.abs(z) < .002, 'voltou');
  }
  g.P.vmKick = { z: 0, v: 0 }; cx.vmKickImpulse('sniper'); let awpPeak = 0; for (let i = 0; i < 30; i++) awpPeak = Math.max(awpPeak, cx.vmKickStep(1 / 60));
  g.P.vmKick = { z: 0, v: 0 }; cx.vmKickImpulse('ump'); let umpPeak = 0; for (let i = 0; i < 30; i++) umpPeak = Math.max(umpPeak, cx.vmKickStep(1 / 60));
  assert.ok(awpPeak > umpPeak * 2, 'AWP dá um coice bem maior que a UMP');
});
test('AWP accuracy follows CS: precise only when (almost) still, wild while moving scoped, quickscope needs a moment', () => {
  const g = game(), w = g.W.sniper, e = { vel: { x: 0, z: 0 }, onGround: true, crouch: false, landSpread: 0 };
  const at = (speed, zoomed, crouch = false) => { e.vel.x = speed; e.crouch = crouch; return g.inaccuracy(e, w, zoomed, 0); };
  assert.ok(at(0, true) < .001);
  assert.ok(at(w.scopedSpeed, true) > .15, 'andando de scope deveria errar');
  assert.ok(at(w.speed * .52 * .5, true) < .001, 'andando devagar (shift) de scope continua preciso');
  assert.ok(at(0, true, true) < at(0, true));
  assert.ok(at(0, false) >= w.noscope);
  // tiro logo depois de abrir o scope: ainda carrega parte da imprecisão sem scope
  g.S.loadout.rifle = 'sniper'; g.spawnSelf(0, [0, 0, 0]); g.selectWeapon('sniper'); g.P.drawEnd = 0; g.P.nextFire = 0;
  g.context.toggleScope(20000); assert.equal(g.P.zoomAt, 20000);
});
test('XvX goes up to 8 per team: sixteen actors with distinct names spawn apart and rounds still finish', () => {
  const g = game({ mode: 'xvx', xvx: { mine: 8, foes: 8 }, target: 1, roundTime: 60 }), cx = g.context;
  assert.deepEqual(JSON.parse(JSON.stringify(g.S.xvx)), { mine: 8, foes: 8 });
  cx.G.mode = 'team'; cx.buildMap('caixas'); vm.runInContext('dmBuildNav([])', cx);
  Object.assign(cx, { clearDecals() {}, sleeveMat: { color: { set() {} } }, pickMap: () => 'caixas',
    randSpawn: side => { const sp = cx.MAP.spawn, x = (Math.random() * 2 - 1) * sp.hx, z = -(sp.z0 + Math.random() * (sp.z1 - sp.z0)); return side ? [-x, -z, 0] : [x, z, Math.PI]; } });
  g.tick(10000); vm.runInContext('teamSetup(10000,false)', cx);
  let t = 10000; for (; t < 10000 + 120000 && g.DM.phase !== 'over'; t += 1000 / 30) { g.tick(t); vm.runInContext(`teamTick(1/30,${t})`, cx); }
  assert.equal(g.DM.actors.length, 16);
  assert.equal(new Set(g.DM.actors.map(e => e.name)).size, 16);
  assert.deepEqual(Array.from(vm.runInContext('ARENA.sizes', cx)), [8, 8]);
  assert.ok(['end', 'over', 'live', 'freeze'].includes(g.DM.phase));
  assert.ok(vm.runInContext('ARENA.r', cx) >= 1);
});
test('TDM: two teams on a DM map, no friendly fire, team score counts kills and ends at the target', () => {
  const g = game({ mode: 'tdm', tdmSize: 4, dmLevel: 'dificil' }), cx = g.context;
  cx.G.mode = 'dm'; cx.buildMap('deathmatch'); g.dmBuildNav(); Object.assign(cx, { sleeveMat: { color: { set() {} } } });
  g.dmSetup(10000);
  assert.equal(g.DM.actors.length, 8);
  const teams = [0, 1].map(team => g.DM.actors.filter(e => e.team === team));
  assert.deepEqual(teams.map(t => t.length), [4, 4]); assert.equal(g.P.team, 0);
  // começo: cada time numa metade do mapa (z)
  const meanZ = list => list.reduce((s, e) => s + e.pos.z, 0) / list.length;
  assert.ok(meanZ(teams[0]) > meanZ(teams[1]));
  const ally = teams[0].find(e => e !== g.P);
  assert.equal(g.dmDamage(ally, 50, 'body', 'rifle', g.P, 14000), 0);
  let t = 10000; for (; t < 10000 + 240000 && g.DM.phase !== 'over'; t += 1000 / 30) { g.tick(t); g.dmTick(1 / 30, t); }
  const DMs = vm.runInContext('DM', cx), kills = team => teams[team].reduce((n, e) => n + vm.runInContext(`stat('${e.id}').k`, cx), 0);
  assert.ok(DMs.teamScore[0] + DMs.teamScore[1] > 0);
  assert.equal(DMs.teamScore[0], kills(0)); assert.equal(DMs.teamScore[1], kills(1));
  if (g.DM.phase === 'over') assert.ok(Math.max(...DMs.teamScore) >= DMs.target || t >= DMs.endsAt);
});
test('Plant the Bomb shop sells back what was bought this round for the full price, restoring the previous gear', () => {
  const { g, cx, A, BM, step } = bombWorld();
  let t = step(10000, 1500);
  g.P.money = 5000;
  assert.ok(cx.bombBuy(g.P, 'pistol', t)); assert.equal(g.P.inv.secondary, 'pistol'); assert.equal(g.P.money, 4300);
  assert.ok(cx.bombBuy(g.P, 'helmet', t)); assert.ok(cx.bombBuy(g.P, 'flash', t)); assert.equal(g.P.money, 3100);
  const start = vm.runInContext('bombPistol(P)', cx); assert.ok(cx.bombSell(g.P, 'pistol', t)); assert.equal(g.P.inv.secondary, start); assert.equal(g.P.money, 3800); assert.ok(g.ORDER.includes(start));
  assert.ok(cx.bombSell(g.P, 'helmet', t)); assert.equal(g.P.inv.armor, 0); assert.equal(g.P.inv.helmet, false);
  assert.ok(cx.bombSell(g.P, 'flash', t)); assert.equal(g.P.nades.flash, 0); assert.equal(g.P.money, 5000);
  assert.equal(cx.bombSell(g.P, 'kevlar', t), false);
  assert.ok(cx.bombBuy(g.P, 'kevlar', t));
  t = step(t, 30000); // passou o tempo de compra
  assert.equal(cx.bombSell(g.P, 'kevlar', t), false);
});
test('operators: Finder reveals enemies inside a 20 m scan, Detector alarm hides from far enemies, trips, reveals and breaks', () => {
  const { g, cx, A, BM, step } = bombWorld();
  let t = step(10000, 11500);
  assert.equal(g.DM.phase, 'live');
  const foes = g.DM.actors.filter(e => e.team !== g.P.team), ally = g.DM.actors.find(e => e !== g.P && e.team === g.P.team);
  for (const e of g.DM.actors) if (e !== g.P) { e.alive = true; }
  assert.ok(g.DM.actors.every(e => ['finder', 'detector', 'doctor', 'ghost', 'brutus'].includes(e.op)));
  assert.notEqual(ally.op, g.P.op);
  // Finder
  g.P.op = 'finder'; g.P.charges = 1; g.P.alive = true;
  foes[0].pos.set(0, 0, 0); foes[1].pos.set(30, 0, 0);
  assert.ok(cx.finderScan(g.P, 2, 2, t)); assert.equal(g.P.charges, 0); assert.equal(cx.finderScan(g.P, 2, 2, t), false);
  cx.scanTick(t + 800);
  assert.ok(foes[0].revealUntil > t + 800 && foes[0].revealTeam === g.P.team); assert.ok(!(foes[1].revealUntil > t + 800));
  // a marcação é uma silhueta parada onde a pessoa estava, não segue
  const GH = vm.runInContext('GHOSTS', cx); assert.equal(GH.length, 1); assert.deepEqual([GH[0].x, GH[0].z], [0, 0]);
  foes[0].pos.set(20, 0, 20); assert.deepEqual([GH[0].x, GH[0].z], [0, 0]);
  // segunda marcação 1 s depois: nova silhueta onde ela estiver agora
  cx.scanTick(t + 1850); assert.equal(GH.length, 2); assert.deepEqual([GH[1].x, GH[1].z], [20, 20]);
  // diâmetro de 10 m: 6 m do centro já fica fora
  g.P.charges = 1; foes[1].pos.set(8, 0, 2); foes[1].revealUntil = 0; assert.ok(cx.finderScan(g.P, 2, 2, t + 3000)); cx.scanTick(t + 3800); assert.ok(!(foes[1].revealUntil > 0));
  // Detector
  // Alarm timing/range is independent of map layout; use a clear floor here.
  cx.sourceWorld=null;cx.boxes.splice(0,cx.boxes.length,g.floor);cx.ramps.length=0;
  g.P.op = 'detector'; g.P.charges = 1; g.P.pos.set(0, 0, 10); g.P.yaw = 0;
  foes[0].pos.set(30, 0, 30); foes[1].pos.set(-30, 0, -30);
  assert.ok(cx.detectorPlace(g.P, t)); const AL = vm.runInContext('ALARM', cx), a = AL.list[0];
  assert.ok(a && Math.hypot(a.x - 0, a.z - 10) <= 2.6);
  assert.equal(cx.alarmVisibleTo(a, foes[0]), false);
  foes[0].pos.set(a.x + 5, 0, a.z); assert.equal(cx.alarmVisibleTo(a, foes[0]), true);
  cx.alarmsTick(t + 500); assert.equal(a.tripAt, 0, 'ainda armando');
  foes[0].pos.set(a.x + 1.5, 0, a.z); cx.alarmsTick(t + 1200);
  assert.ok(a.tripAt > 0); assert.ok(foes[0].revealUntil >= t + 1200 + 4000 - 1);
  cx.alarmsTick(t + 1900); assert.equal(AL.list.length, 0, 'autodestruição');
  // destruído a tiro
  g.P.charges = 1; foes[0].pos.set(30, 0, 30); assert.ok(cx.detectorPlace(g.P, t + 2000));
  const b = AL.list[0]; assert.ok(cx.alarmDamage(b.id, 25, foes[0])); assert.equal(AL.list.length, 0);
});
test('operators exist only in Plant the Bomb: after a bomb match, 2v2 has no ability, alarms or operator gear', () => {
  const { g, cx, step } = bombWorld();
  let t = step(10000, 11500);
  assert.ok(g.DM.actors.every(e => e.op));
  g.S.mode = 'elim'; g.S.xvx = { mine: 2, foes: 2 }; cx.MAP_IDS = ['caixas']; cx.buildMap('caixas'); vm.runInContext('dmBuildNav([])', cx);
  Object.assign(cx, { pickMap: () => 'caixas', randSpawn: side => side ? [0, -20, 0] : [0, 20, Math.PI] });
  vm.runInContext(`teamSetup(${t},false)`, cx); t = step(t, 2000);
  assert.equal(vm.runInContext('ARENA.bomb', cx), false);
  assert.equal(vm.runInContext('bombOn()', cx), false);
  g.P.charges = 1; cx.useAbility(t); assert.equal(vm.runInContext('ALARM.list.length', cx), 0);
  assert.equal(vm.runInContext('SCAN.pending', cx), null);
});
test('Wingman loss bonus: $2,000 +$300 per consecutive loss up to $2,900, +$600 for Terrorists who planted, reset after a win', () => {
  const { g, cx, A, BM, step } = bombWorld();
  let t = step(10000, 11500);
  const tTeam = BM.tTeam, ct = 1 - tTeam, pay = [];
  for (let round = 0; round < 5; round++) {
    for (const e of g.DM.actors) e.money = 0;
    g.DM.phase = 'live'; BM.plantedBy = round === 1 ? 'x' : null;
    cx.bombEndRound(t, ct, 'time');
    pay.push(g.DM.actors.find(e => e.team === tTeam).money, g.DM.actors.find(e => e.team === ct).money);
  }
  assert.deepEqual(pay, [2000, 2750, 2900, 2750, 2600, 2750, 2900, 2750, 2900, 2750]);
  for (const e of g.DM.actors) e.money = 0; g.DM.phase = 'live'; BM.plantedBy = null; cx.bombEndRound(t, tTeam, 'bomb');
  assert.equal(g.DM.actors.find(e => e.team === tTeam).money, 3000);
  for (const e of g.DM.actors) e.money = 0; g.DM.phase = 'live'; cx.bombEndRound(t, ct, 'defuse');
  assert.equal(g.DM.actors.find(e => e.team === ct).money, 3000);
  assert.equal(g.DM.actors.find(e => e.team === tTeam).money, 2000, 'bônus voltou ao início depois da vitória');
});
test('Doctor: the dart really flies (a miss spends the charge and sticks), heals +50 on arrival, and right click injects yourself mid-animation', () => {
  const { g, cx, step } = bombWorld();
  let t = step(10000, 11500);
  // This ability fixture needs a clear shooting lane, independent of the map's authored walls.
  cx.sourceWorld=null;cx.boxes.splice(0,cx.boxes.length,g.floor);cx.ramps.length=0;
  const ally = g.DM.actors.find(e => e !== g.P && e.team === g.P.team), darts = () => vm.runInContext('DART.list', cx);
  g.P.op = 'doctor'; g.P.charges = 1; g.P.hp = 100;
  g.P.pos.set(0, 0, 10); g.P.yaw = 0; g.P.pitch = 0; ally.alive = true; ally.hp = 30; ally.pos.set(0, 0, 0);
  for (const e of g.DM.actors) if (e.team !== g.P.team) e.pos.set(30, 0, 30);
  cx.useAbility(t); assert.equal(g.P.weapon, 'medgun'); g.P.drawEnd = 0; g.P.nextFire = 0;
  // erra (mira para cima): o dardo sai, gasta a carga e fica cravado
  g.P.pitch = 1.2; g.P.m1Press = true; g.updateWeapon(0, t + 10);
  assert.equal(g.P.charges, 0); assert.equal(darts().length, 1); assert.equal(darts()[0].target, null);
  vm.runInContext(`dartsTick(${t + 2000})`, cx); assert.equal(ally.hp, 30); assert.equal(darts().length, 1, 'cravado');
  vm.runInContext(`dartsTick(${t + 10000})`, cx); assert.equal(darts().length, 0);
  // acerta: cura quando o dardo chega
  g.P.charges = 1; g.P.afterHeal = 0; g.P.drawEnd = 0; g.P.nextFire = 0; assert.equal(g.P.weapon, 'medgun');
  g.P.pitch = Math.atan2(1.2 - 1.64, 10); g.P.m1Press = true; g.updateWeapon(0, t + 120);
  const d = darts()[0]; assert.equal(d.target, ally); assert.equal(ally.hp, 30, 'ainda voando'); assert.equal(g.P.charges, 0);
  vm.runInContext(`dartsTick(${t + 120 + d.dur + 1})`, cx); assert.equal(ally.hp, 80);
  // em si mesmo (botão direito): crava no antebraço; a cura entra no meio da animação
  g.P.afterHeal = 0; g.P.charges = 1; g.P.hp = 70; g.P.drawEnd = 0; g.P.nextFire = 0; g.P.m2Press = true; g.updateWeapon(0, t + 1010);
  assert.ok(g.P.injectT > 0); assert.equal(g.P.hp, 70);
  g.updateWeapon(0, t + 1010 + 720 * .5); assert.equal(g.P.hp, 100); assert.equal(g.P.charges, 0);
  // bot Doctor: se cura na hora; num aliado, manda o dardo
  const doc = ally; doc.op = 'doctor'; doc.charges = 1; doc.hp = 20; doc.seen = false; doc.opAt = 1;
  vm.runInContext(`botsUseAbilities(${t + 2000})`, cx); assert.equal(doc.hp, 70); assert.equal(doc.charges, 0);
});
test('crouch like CS: the view lowers over ~0.22 s, speed drops with the duck amount, and spamming makes ducking slower until it recovers', () => {
  const g = game(); g.spawnSelf(0, [0, 0, 0]); g.context.G.view.ph = 'live';
  let t = 10000; const run = ms => { for (const end = t + ms; t < end; t += 1000 / 128) { g.tick(t); g.playerInput(1 / 128, t); } };
  g.keys.add('KeyC'); run(60);
  assert.ok(g.P.duck > .1 && g.P.duck < .6, 'meio do caminho: ' + g.P.duck); assert.ok(g.P.eyeOff < 1.64 && g.P.eyeOff > 1.0);
  run(250); assert.equal(g.P.duck, 1); assert.equal(g.P.crouch, true); assert.ok(Math.abs(g.P.eyeOff - 1.0) < 1e-6);
  g.keys.delete('KeyC'); run(300); assert.equal(g.P.duck, 0); assert.equal(g.P.crouch, false);
  // spam: várias agachadas seguidas deixam a próxima bem mais lenta
  for (let i = 0; i < 5; i++) { g.keys.add('KeyC'); run(40); g.keys.delete('KeyC'); run(40); }
  const slow = g.P.duckSpeed; assert.ok(slow < 2.5, 'stamina: ' + slow);
  g.keys.add('KeyC'); run(150); assert.ok(g.P.duck < .8, 'agachar mais lento depois do spam'); g.keys.delete('KeyC');
  run(3000); assert.ok(g.P.duckSpeed > 4.5, 'recuperou');
});
test('Ghost: five seconds of silent footsteps that bots cannot hear, one charge per round', () => {
  const { g, cx, step } = bombWorld();
  let t = step(10000, 11500);
  const foe = g.DM.actors.find(e => e.team !== g.P.team), listener = foe;
  g.P.op = 'ghost'; g.P.charges = 1; g.P.alive = true;
  g.P.pos.set(listener.pos.x + 3, listener.pos.y, listener.pos.z); g.P.vel.set(5, 0, 0); g.P.onGround = true; g.P.crouch = false;
  listener.cautionUntil = 0; cx.botListen(listener, g.P, 9, t); assert.ok(listener.cautionUntil > t, 'ouve os passos normais');
  cx.useAbility(t); assert.equal(g.P.charges, 0); assert.equal(g.P.silentUntil, t + 5000);
  listener.cautionUntil = 0; cx.botListen(listener, g.P, 9, t + 100); assert.equal(listener.cautionUntil, 0, 'passos mudos');
  listener.cautionUntil = 0; cx.botListen(listener, g.P, 9, t + 5100); assert.ok(listener.cautionUntil > t + 5100, 'voltou a ouvir');
});
test('ability HUD: each operator has an icon; ready, active countdown, and cooldown until the next round', () => {
  const { g, cx, step } = bombWorld();
  let t = step(10000, 11500);
  const icons = vm.runInContext('ABILITY_ICONS', cx);
  for (const op of ['finder', 'doctor', 'ghost', 'detector']) assert.match(icons[op], /^<svg/);
  const state = t2 => vm.runInContext(`abilityState(${t2})`, cx);
  g.P.op = 'ghost'; g.P.charges = 1; g.P.silentUntil = 0;
  assert.equal(state(t).state, 'ready');
  cx.useAbility(t); assert.deepEqual(JSON.parse(JSON.stringify(state(t + 1200))), { state: 'active', s: 4 });
  const cd = state(t + 5100); assert.equal(cd.state, 'cd'); assert.ok(cd.s >= 5, 'conta até a próxima rodada: ' + cd.s);
});
test('operators: 45 s cooldown after use, back at the start of each round', () => {
  const { g, cx, step } = bombWorld();
  let t = step(10000, 11500);
  g.P.op = 'ghost'; g.P.charges = 1; g.P.alive = true;
  cx.useAbility(t); assert.equal(g.P.charges, 0); assert.equal(g.P.cdUntil, t + 45000);
  const state = t2 => JSON.parse(JSON.stringify(vm.runInContext(`abilityState(${t2})`, cx)));
  assert.deepEqual(state(t + 6000), { state: 'cd', s: 39 });
  vm.runInContext(`opsCooldownTick(${t + 44900})`, cx); assert.equal(g.P.charges, 0);
  vm.runInContext(`opsCooldownTick(${t + 45000})`, cx); assert.equal(g.P.charges, 1); assert.equal(state(t + 45000).state, 'ready');
  cx.useAbility(t + 46000); vm.runInContext('opsResetRound()', cx); assert.equal(g.P.charges, 1); assert.equal(g.P.cdUntil, 0);
});
test('Brutus: 10% less damage for 5 s except headshots, then back to normal', () => {
  const { g, cx, step } = bombWorld();
  let t = step(10000, 11500);
  const foe = g.DM.actors.find(e => e.team !== g.P.team);
  g.P.op = 'brutus'; g.P.charges = 1; g.P.alive = true; g.P.armor = 0; g.P.hp = 100;
  cx.useAbility(t); assert.equal(g.P.toughUntil, t + 5000); assert.equal(g.P.charges, 0);
  assert.equal(cx.dmDamage(g.P, 30, 'body', 'rifle', foe, t + 100), 27);
  assert.equal(cx.dmDamage(g.P, 30, 'head', 'rifle', foe, t + 200), 30, 'headshot não reduz');
  g.P.hp = 100; assert.equal(cx.dmDamage(g.P, 30, 'body', 'rifle', foe, t + 5100), 30, 'acabou o efeito');
  // Bot Brutus liga ao entrar em combate.
  const bot = g.DM.bots.find(b => b.team === foe.team); bot.op = 'brutus'; bot.charges = 1; bot.alive = true; bot.seen = true;
  vm.runInContext(`botsUseAbilities(${t + 5200})`, cx); assert.ok(bot.toughUntil > t + 5200);
});
test('Plant the Bomb sides are Atacantes and Defensores, outfits follow the operator, and the enemy outline setting is validated', () => {
  const { g, cx } = bombWorld();
  const names = vm.runInContext('SIDE_NAMES', cx); assert.deepEqual(JSON.parse(JSON.stringify(names)), { t: 'Atacantes', ct: 'Defensores' });
  const ops = vm.runInContext('OPS', cx);
  const tops = Object.values(ops).map(o => o.outfit[0]); assert.equal(new Set(tops).size, tops.length, 'cada operador tem a sua roupa');
  for (const o of Object.values(ops)) assert.equal(o.outfit.length, 2);
  assert.equal(vm.runInContext('typeof SIDE_COLORS', cx), 'undefined', 'sem uniforme de lado');
  assert.equal(vm.runInContext('S.enemyOutline', cx), 'vermelho');
});
test('Plant the Bomb bots: the map study finds attacker entrances, hidden gathering points and defender angles, and defenders split across them', () => {
  for (const map of ['guard', 'elysion']) {
    const { g, cx, A, step } = bombWorld(map);
    const ev = s => vm.runInContext(s, cx);
    ev('ARENA.sizes = DM.byId.get(G.me).team===0 ? [3,2] : [2,3]; arenaBuildActors(teamRoster()); dmRefreshTargets();');
    const study = ev('bombStudy()'), site = study.sites[0];
    assert.ok(site.tEntries.length >= 1 && site.tEntries.length <= 3, map);
    for (const e of site.tEntries) {
      const toSite = Math.hypot(e.stage.x - site.center.x, e.stage.z - site.center.z);
      assert.ok(toSite > 8, map + ': reunião longe do site ' + toSite);
      for (const h of e.holds) assert.ok(Math.hypot(h.x - e.x, h.z - e.z) >= 3.5, map + ': defensor não fica em cima da entrada');
    }
    let t = step(10000, 200); while (ev('DM.phase') !== 'live') t = step(t, 500, () => { g.P.alive = false; });
    t = step(t, 300, () => { g.P.alive = false; });
    const plan = ev('BRAIN.plan'); assert.ok(plan && ['exec', 'rush', 'split'].includes(plan.style));
    const cts = ev("DM.bots.filter(b=>sideOf(b)==='ct')"), ts = ev("DM.bots.filter(b=>sideOf(b)==='t')");
    assert.equal(cts.length, 2); assert.equal(ts.length, 2);
    const [a, b] = cts.map(o => o.ai.hold); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 3, map + ': defensores em posições diferentes');
    if (plan.style !== 'split') assert.equal(ts[0].ai.entry, ts[1].ai.entry, 'atacantes juntos na mesma entrada');
  }
});
test('Plant the Bomb bots walk together: the one far ahead waits, the group executes together, and holders watch instead of chasing noise', () => {
  const { g, cx, step } = bombWorld('guard');
  const ev = s => vm.runInContext(s, cx);
  ev('ARENA.sizes = DM.byId.get(G.me).team===0 ? [3,2] : [2,3]; arenaBuildActors(teamRoster()); dmRefreshTargets();');
  let t = step(10000, 200); while (ev('DM.phase') !== 'live') t = step(t, 500, () => { g.P.alive = false; });
  const plan = ev('BRAIN.plan'); plan.style = 'exec'; plan.exec = false; plan.execAt = Infinity;
  const [lead, back] = ev("DM.bots.filter(b=>sideOf(b)==='t')"); back.ai.entry = lead.ai.entry;
  const st = lead.ai.entry.stage, n = ev('DM.nav');
  lead.pos.set(st.x + 1, st.y, st.z); back.pos.set(st.x + 14, st.y, st.z + 1);
  const goal = b => { const c = cx.bombGoalCell(b, t); return [ev(`navX(DM.nav,${c})`), ev(`navZ(DM.nav,${c})`)]; };
  const ahead = goal(lead); assert.ok(Math.hypot(ahead[0] - lead.pos.x, ahead[1] - lead.pos.z) < 1.5, 'quem está na frente espera');
  back.pos.set(st.x - 1, st.y, st.z + .5); vm.runInContext(`bombBrainTick(${t})`, cx); t += 2000; vm.runInContext(`bombBrainTick(${t})`, cx); t += 2000; vm.runInContext(`bombBrainTick(${t})`, cx);
  assert.equal(plan.exec, true, 'reunidos: entram juntos');
  const holder = ev("DM.bots.find(b=>sideOf(b)==='ct')"); holder.ai.task = 'hold'; holder.knowsUntil = t + 3000; holder.lastSeen.set(holder.pos.x + 9, holder.pos.y, holder.pos.z);
  assert.equal(ev(`bombHoldsPost(DM.bots.find(b=>sideOf(b)==='ct'))`), true); vm.runInContext(`bombBrainTick(${t})`, cx);
  assert.equal(holder.watch, holder.lastSeen, 'só vira para o barulho, sem sair da posição');
});
test('Plant the Bomb bots use their operator skills with the plan: Detector alarms its entrance, attackers pop Ghost/Brutus/Finder on the execute', () => {
  const { g, cx, step } = bombWorld('guard');
  const ev = s => vm.runInContext(s, cx);
  ev('ARENA.sizes = DM.byId.get(G.me).team===0 ? [3,2] : [2,3]; arenaBuildActors(teamRoster()); dmRefreshTargets();');
  let t = step(10000, 200); while (ev('DM.phase') !== 'live') t = step(t, 500, () => { g.P.alive = false; });
  const [t1, t2] = ev("DM.bots.filter(b=>sideOf(b)==='t')"), [c1] = ev("DM.bots.filter(b=>sideOf(b)==='ct')");
  t1.op = 'ghost'; t2.op = 'brutus'; c1.op = 'detector'; for (const b of [t1, t2, c1]) { b.charges = 1; b.seen = false; }
  c1.ai.task = 'alarm'; c1.pos.set(c1.ai.alarmSpot.x, c1.ai.entry.y, c1.ai.alarmSpot.z);
  const S = ev('planSite()'); for (const b of [t1, t2]) b.pos.set(S.center.x + 9, S.center.y, S.center.z);
  const plan = ev('BRAIN.plan'); plan.exec = true; plan.execStart = t;
  vm.runInContext(`botsUseAbilities(${t})`, cx);
  assert.ok(ev('ALARM.list.length') >= 1 && c1.ai.task === 'hold', 'alarme colocado na entrada e volta para a posição');
  assert.ok(t1.silentUntil > t, 'Ghost liga os passos mudos na entrada'); assert.ok(t2.toughUntil > t, 'Brutus liga a couraça na entrada');
});
test('falling into the Elysion abyss kills after the fall, counts as a death without giving anyone a kill, and drops the bomb', () => {
  const { g, cx, step } = bombWorld('elysion');
  const ev = s => vm.runInContext(s, cx);
  let t = step(10000, 200); while (ev('DM.phase') !== 'live') t = step(t, 500);
  const floor = ev('sourceWorld.floorMin');
  const bot = ev("DM.bots.find(b=>b.alive)"); ev(`BOMB.carrier=${JSON.stringify(bot.id)}`);
  bot.onGround = true; vm.runInContext(`fallTick(${t})`, cx); const ledge = { x: bot.pos.x, y: bot.pos.y, z: bot.pos.z }; bot.onGround = false;
  bot.pos.y = floor - 5; vm.runInContext(`fallTick(${t})`, cx); assert.equal(bot.alive, true, 'ainda caindo');
  bot.pos.y = floor - 30; vm.runInContext(`fallTick(${t})`, cx);
  assert.equal(bot.alive, false); assert.equal(ev(`stat(${JSON.stringify(bot.id)}).d`), 1); assert.equal(ev(`stat(${JSON.stringify(bot.id)}).k`), 0);
  const d = ev('BOMB.dropped'); assert.ok(d, 'a bomba cai junto');
  assert.ok(Math.hypot(d.x - ledge.x, d.z - ledge.z) < .5 && Math.abs(d.y - ledge.y) < 1, 'a bomba volta para o último chão firme');
  g.P.pos.y = floor - 30; vm.runInContext(`fallTick(${t})`, cx);
  assert.equal(g.P.alive, false); assert.equal(g.P.killedBy.w, 'fall');
});
test('the C4 beep comes from the bomb: silent far away, louder as you get closer', () => {
  const { g, cx, step } = bombWorld();
  const ev = s => vm.runInContext(s, cx);
  let t = step(10000, 200); while (ev('DM.phase') !== 'live') t = step(t, 500);
  const beeps = []; cx.AU = new Proxy({}, { get: (_, k) => k === 'beep' ? v => beeps.push(v) : () => {} });
  const s = ev('MAP.plant.site'), p = { x: (s.x0 + s.x1) / 2, y: s.y0, z: (s.z0 + s.z1) / 2 };
  ev(`BOMB.planted={x:${p.x},y:${p.y},z:${p.z},t:${t},site:'A'};BOMB.beepAt=0;ARENA.roundEnd=${t}+BOMB.bombMs;`);
  const hear = (d) => { beeps.length = 0; g.P.pos.set(p.x + d, p.y, p.z); ev('BOMB.beepAt=0'); vm.runInContext(`bombTick(1/30,${t += 30})`, cx); return beeps[0] || 0; };
  assert.equal(hear(60), 0, 'longe: não ouve');
  const mid = hear(18), near = hear(2); assert.ok(mid > 0 && near > mid, `perto ${near} > meio ${mid}`);
});
test('Glock and FAMAS: right click fires a 3-round burst, then waits; left click is a normal single shot', () => {
  const g = game(), cx = g.context;
  cx.buildMap('aimbotz'); cx.G.mode = 'aimbotz'; g.spawnSelf(0, [0, 9, 0]); cx.aimbotzSetup();
  for (const [weapon, gap] of [['glock', 55], ['famas', 75]]) {
    cx.aimbotzEquip(weapon); g.P.drawEnd = 0; g.P.nextFire = 0; g.P.reloadEnd = 0;
    const am = g.P.ammo[weapon], start = am.mag; let t = 50000;
    g.P.m2Press = true; g.updateWeapon(0, t); assert.equal(start - am.mag, 1, weapon + ': primeiro tiro na hora');
    g.updateWeapon(0, t + gap - 5); assert.equal(start - am.mag, 1);
    g.updateWeapon(0, t + gap); g.updateWeapon(0, t + 2 * gap); assert.equal(start - am.mag, 3, weapon + ': três tiros');
    g.updateWeapon(0, t + 3 * gap + 5); assert.equal(start - am.mag, 3, 'a rajada para no terceiro');
    g.P.m2Press = true; g.updateWeapon(0, t + 3 * gap + 10); assert.equal(start - am.mag, 3, 'espera antes da próxima rajada');
  }
});
test('Plant the Bomb: Glock is the Attackers starting pistol, USP-S the Defenders; Galil is Attackers-only and FAMAS Defenders-only', () => {
  const { g, cx, step } = bombWorld();
  const ev = s => vm.runInContext(s, cx);
  let t = step(10000, 1500);
  for (const e of ev('DM.actors')) assert.equal(e.inv.secondary, ev('sideOf')(e) === 't' ? 'glock' : 'usps');
  const t1 = ev("DM.actors.find(e=>sideOf(e)==='t')"), c1 = ev("DM.actors.find(e=>sideOf(e)==='ct')");
  for (const e of [t1, c1]) e.money = 9000;
  assert.equal(ev('bombBuyBlock')(t1, 'famas', t), 'Só Defensores'); assert.equal(ev('bombBuyBlock')(c1, 'galil', t), 'Só Atacantes');
  assert.ok(cx.bombBuy(t1, 'galil', t)); assert.equal(t1.inv.primary, 'galil'); assert.equal(t1.money, 9000 - 1800);
  assert.ok(cx.bombBuy(c1, 'famas', t)); assert.equal(c1.inv.primary, 'famas'); assert.equal(c1.money, 9000 - 2050);
  // A loja não lista o que é exclusivo do outro lado.
  const listed = e => [...ev('shopColsFor')(e).flatMap(([, items]) => items)];
  assert.deepEqual(listed(t1).filter(i => ['glock', 'galil', 'rifle', 'usps', 'famas', 'm4a4', 'm4a1s', 'kit'].includes(i)).sort().join(), 'galil,glock,rifle');
  assert.deepEqual(listed(c1).filter(i => ['glock', 'galil', 'rifle', 'usps', 'famas', 'm4a4', 'm4a1s', 'kit'].includes(i)).sort().join(), 'famas,kit,m4a1s,m4a4,usps');
  for (const e of [t1, c1]) for (const i of ['pistol', 'ump', 'bucky', 'ssg', 'sniper', 'he', 'flash', 'smoke', 'kevlar', 'helmet']) assert.ok(listed(e).includes(i), i);
});
test('stairs: the player runs up a covered Guard staircase at full speed instead of being bounced by the step edges', () => {
  const { g, cx, step } = bombWorld('guard');
  const ev = s => vm.runInContext(s, cx);
  let t = step(10000, 200); while (ev('DM.phase') !== 'live') t = step(t, 500);
  for (const b of ev('DM.bots')) { b.alive = false; b.pos.set(999, -999, 999); }
  g.P.pos.set(13.3, ev('groundAt(13.3,-35,1)') + .02, -35); g.P.vel.set(0, 0, 0); g.P.onGround = true; g.P.yaw = Math.PI; g.P.pitch = 0;
  g.keys.clear(); g.keys.add('KeyW');
  for (let i = 0; i < 330; i++) { t += 1000 / 128; g.playerInput(1 / 128, t); }
  g.keys.clear();
  assert.ok(g.P.pos.y > 2.6, 'subiu a escada: y ' + g.P.pos.y.toFixed(2)); assert.ok(g.P.pos.z > -23, 'sem perder velocidade: z ' + g.P.pos.z.toFixed(2));
});


function prefireFixture(begin=true){
  const g=game(),cx=g.context;
  cx.buildMap('infernoprefire');cx.G.mode='aimbotz';g.P.id=cx.G.me;
  cx.resetSession=spawn=>{cx.G.stats={};cx.G.names={};cx.G.view={ph:'practice',sc:{}};g.spawnSelf(0,spawn);};
  cx.dmEnsureRender=()=>{};cx.dmRender=()=>{};cx.toast=()=>{};
  vm.runInContext('PREFIRE.active=true;prefireSetup(10000)',cx);
  if(begin)cx.prefireBegin(10000);
  g.prefire=vm.runInContext('PREFIRE',cx);return g;
}

test('Prefire: the cropped Inferno connects the Banana start to all fifteen fixed, unobstructed spots with real player physics',()=>{
  const g=prefireFixture(),cx=g.context,map=cx.sourceWorld,meta=cx.INFERNO_PREFIRE;
  g.dmBuildNav();const nav=g.DM.nav;
  assert.equal(meta.spots.length,15);assert.equal(g.DM.actors.length,16);
  assert.ok(map.mesh.opaque/3<50000);assert.ok(map.count<30000);
  for(let i=0;i<map.planes.length;i+=4){assert.ok(Number.isFinite(map.planes[i+3]));assert.ok(Math.abs(Math.hypot(...map.planes.slice(i,i+3))-1)<1e-5);}
  assert.equal(new Set(meta.spots.map(p=>p.x+','+p.y+','+p.z)).size,15);
  const actor={pos:new Vec(meta.spawn[0],cx.groundAt(meta.spawn[0],meta.spawn[1],meta.spawn[3]),meta.spawn[1]),vel:new Vec(),h:1.8,onGround:true,crouch:false,path:[],pathAt:0,landSpread:0};
  for(const spot of meta.spots){
    assert.equal(map.overlap(spot.x,spot.y+.005,spot.z,1.8,.3),false,spot.name);
    const start=g.dmCell(actor.pos.x,actor.pos.z,actor.pos.y),goal=g.dmCell(spot.x,spot.z,spot.y),queue=[start],parent=new Map([[start,-1]]);
    for(let head=0;head<queue.length&&!parent.has(goal);head++)for(let d=0;d<4;d++){const next=nav.links[queue[head]*4+d];if(next>=0&&!parent.has(next)){parent.set(next,queue[head]);queue.push(next);}}
    assert.ok(parent.has(goal),spot.name);actor.path=[];for(let id=goal;id!==start;id=parent.get(id))actor.path.unshift(id);
    for(const id of actor.path){let frames=0;const tx=nav.x[id],tz=nav.z[id];
      while(Math.hypot(tx-actor.pos.x,tz-actor.pos.z)>.12&&frames++<400){const dx=tx-actor.pos.x,dz=tz-actor.pos.z,d=Math.hypot(dx,dz);g.physics(actor,dx/d,dz/d,Math.min(4.5,d*10),false,1/128);}
      assert.ok(frames<400,spot.name+' blocked at '+id+' position '+JSON.stringify(actor.pos));
      assert.ok(actor.pos.y>-5&&Number.isFinite(actor.pos.y));
    }
    assert.ok(Math.hypot(actor.pos.x-spot.x,actor.pos.z-spot.z)<1,spot.name);
  }
  assert.ok(actor.pos.x>25,'the course reaches the truck, beyond CT');
});

test('Prefire: bots have 100 HP, take real weapon damage, disappear once, and never respawn in the course',()=>{
  const g=prefireFixture(),cx=g.context,bot=g.DM.bots[0];
  assert.ok(g.DM.bots.every(b=>b.hp===100&&b.alive&&!b.helmet));
  assert.equal(g.ORDER.length,2);assert.ok(g.W[g.ORDER[1]].melee);
  cx.aimbotzHit(27,'body','rifle',bot.id);assert.equal(bot.hp,73);
  cx.aimbotzHit(100,'head','rifle',bot.id);cx.aimbotzHit(100,'head','rifle',bot.id);
  assert.equal(bot.alive,false);assert.equal(bot.respawnAt,Infinity);
  assert.equal(g.prefire.killed,1);assert.equal(g.stat(g.P.id).k,1);
  assert.ok(!g.DM.playerTargets.some(h=>h.actor===bot.id));
  cx.locked=false;cx.prefireTick(1,1000000);assert.equal(bot.alive,false);assert.equal(g.prefire.killed,1);
  assert.equal(g.dmDamage(g.DM.bots[1],100,'body','m4a4',g.DM.bots[2],10001),0);
});

test('Prefire: defenders react, shoot and reload without moving, and walls block their vision and bullets',()=>{
  const g=prefireFixture(),cx=g.context,positions=g.DM.bots.map(b=>JSON.stringify(b.pos));g.P.hp=10000;
  g.P.pos.set((120-1300)*.0254,cx.groundAt((120-1300)*.0254,-(1050-2200)*.0254,1),-(1050-2200)*.0254);
  for(let t=10000;t<24000;t+=1000/60){g.tick(t);cx.prefireTick(1/60,t);}
  assert.ok(g.DM.bots.some(b=>b.lastShot>0));assert.ok(g.P.hp<10000,'defenders must deal damage');
  assert.deepEqual(g.DM.bots.map(b=>JSON.stringify(b.pos)),positions);
  assert.ok(g.DM.bots.slice(6).every(b=>!b.lastShot),'site defenders cannot shoot through Banana walls');
  assert.ok(g.DM.bots.some(b=>b.reloadEnd||b.mag>0));
  const hp=g.P.hp;cx.locked=false;cx.prefireTick(1,40000);assert.equal(g.P.hp,hp);
});

test('Prefire: death resets all targets and time, elapsed time has no limit, and pausing stops it',()=>{
  const g=prefireFixture(),cx=g.context;
  cx.aimbotzHit(100,'head','rifle',g.DM.bots[0].id);cx.prefireTick(.1,10100);
  assert.equal(g.prefire.elapsed,100);
  g.dmDamage(g.P,100,'body','m4a4',g.DM.bots[1],10200);assert.equal(g.P.alive,false);
  g.tick(11600);cx.prefireTick(.1,11600);
  assert.equal(g.P.hp,100);assert.equal(g.P.alive,true);assert.equal(g.prefire.killed,0);assert.equal(g.prefire.elapsed,0);
  assert.ok(g.DM.bots.every(b=>b.hp===100&&b.alive));
  assert.equal(g.prefire.phase,'ready');cx.prefireBegin(11600);
  g.DM.bots.forEach(b=>b.alive=false);cx.prefireTick(1,11600+7200000);
  assert.equal(g.prefire.phase,'live');assert.equal(g.prefire.elapsed,7200000);assert.equal(cx.prefireTime(g.prefire.elapsed),'120:00.00');
  cx.locked=false;cx.prefireTick(1,11600+7300000);assert.equal(g.prefire.elapsed,7200000);
  cx.locked=true;cx.prefireTick(.1,11600+7300100);assert.equal(g.prefire.elapsed,7200100);
});

test('Prefire: the fifteenth kill ends once, plays the cue, and returns automatically to normal Aimbotz',()=>{
  const g=prefireFixture(),cx=g.context,events=[];
  cx.AU=new Proxy({}, {get:(_,key)=>()=>{if(key==='roundEnd')events.push('sound');}});
  cx.startSession=mode=>{events.push(mode);cx.prefireStop();cx.buildMap('aimbotz');cx.aimbotzSetup();};
  g.prefire.elapsed=45678;
  for(const bot of g.DM.bots.slice())cx.aimbotzHit(100,'head','rifle',bot.id);
  assert.equal(g.prefire.killed,15);assert.equal(g.prefire.phase,'complete');assert.deepEqual(events,['sound']);
  cx.aimbotzHit(100,'head','rifle',g.DM.bots[0].id);assert.deepEqual(events,['sound']);
  assert.equal(g.DM.playerTargets.length,0);cx.prefireTick(.1,11799);assert.equal(g.prefire.active,true);
  cx.prefireTick(.1,11800);assert.deepEqual(events,['sound','aimbotz']);
  assert.equal(g.prefire.active,false);assert.equal(g.DM.actors.length,g.S.aimbotzBots+1);assert.equal(g.DM.bots.length,0);
});

test('Prefire: the small board starts the lazy-loaded course and leaving while loading cancels entry',async()=>{
  const g=game(),cx=g.context;cx.buildMap('aimbotz');cx.G.mode='aimbotz';g.spawnSelf(0,[0,9,0]);cx.aimbotzSetup();
  const b=vm.runInContext('AIMBOTZ_PREFIRE_BOARD',cx),origin=[0,1.8,9],target=[b.x,b.y,b.z],d=target.map((v,i)=>v-origin[i]),len=Math.hypot(...d);
  assert.equal(cx.aimbotzPrefireButtonAt(origin,d.map(v=>v/len)).prefire,true);
  let ready;cx.SourceMaps.load=()=>new Promise(resolve=>ready=resolve);cx.toast=()=>{};vm.runInContext('let sessionLoadId=1;',cx);
  const pending=cx.startPrefire();assert.equal(vm.runInContext('PREFIRE.loading',cx),true);
  vm.runInContext('sessionLoadId++;prefireStop();',cx);cx.G.mode=null;ready();await pending;
  assert.equal(vm.runInContext('PREFIRE.active',cx),false);assert.equal(cx.MAP.id,'aimbotz');
});


test('Prefire: spawn stays behind cover and waiting never starts the timer or causes a spawn death, including retries',()=>{
  const g=prefireFixture(false),cx=g.context;
  for(let run=0;run<2;run++){
    assert.equal(g.prefire.phase,'ready');
    const p=g.P.pos;
    assert.equal(cx.sourceWorld.overlap(p.x,p.y+.005,p.z,1.8,.3),false);
    for(const bot of g.DM.bots)for(const h of [.7,1.2,1.65])for(const dx of [-.25,0,.25]){
      assert.equal(g.clearLine([bot.pos.x,bot.pos.y+1.62,bot.pos.z],[p.x+dx,p.y+h,p.z]),false,bot.name+' can see spawn');
    }
    for(let t=10000;t<=70000;t+=100){g.tick(t);cx.prefireTick(.1,t);}
    assert.equal(g.P.hp,100);assert.equal(g.P.alive,true);assert.equal(g.prefire.elapsed,0);
    assert.ok(g.DM.bots.every(b=>!b.lastShot));
    cx.prefireSetup(10000);
  }
});

test('Prefire: moving out begins only after drawing the weapon; a real shot starts immediately',()=>{
  const g=prefireFixture(false),cx=g.context;
  g.P.pos.x+=1;cx.prefireTick(.1,10100);assert.equal(g.prefire.phase,'ready');
  g.P.pos.x+=2;g.P.drawEnd=11000;cx.prefireTick(.1,10500);assert.equal(g.prefire.phase,'ready');
  g.tick(11000);cx.prefireTick(.1,11000);assert.equal(g.prefire.phase,'live');assert.equal(g.prefire.elapsed,0);
  cx.prefireTick(.1,11100);assert.equal(g.prefire.elapsed,100);
  cx.prefireSetup(12000);g.tick(13000);g.P.drawEnd=0;g.shoot(13000,false);
  assert.equal(g.prefire.phase,'live');assert.equal(g.prefire.elapsed,0);
  assert.ok(g.DM.bots.every(b=>b.readyAt>=13650&&!b.fireReady));
});

test('Prefire: the first approach opens one holding angle instead of several simultaneous defenders',()=>{
  const g=prefireFixture(),cx=g.context,x=(120-1300)*.0254,z=-(1050-2200)*.0254,y=cx.groundAt(x,z,1);
  const visible=g.DM.bots.filter(b=>g.clearLine([b.pos.x,b.pos.y+1.62,b.pos.z],[x,y+1.2,z]));
  assert.equal(visible.length,1);assert.equal(visible[0].name,'Logs');
  for(let i=0;i<g.DM.bots.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(g.DM.bots[i].pos.x-g.DM.bots[j].pos.x,g.DM.bots[i].pos.z-g.DM.bots[j].pos.z)>1.4);
});


test('Warface 5v5: two maps, separate Wingman choices, ten distinct safe spawns and connected bombsites',()=>{
  for(const key of ['palace','factory']){
    const g=game({mode:'5v5',warfaceMap:key}),cx=g.context;cx.buildMap(key);g.dmBuildNav();
    assert.equal(g.S.mode,'bomb');assert.equal(g.S.warfaceMap,key);assert.equal(g.MAPS[key].warface,true);
    assert.deepEqual(Array.from(vm.runInContext('BOMB_MAPS',cx)),['guard','elysion']);
    assert.equal(cx.MAP.plant.t.length,5);assert.equal(cx.MAP.plant.ct.length,5);
    for(const side of ['t','ct'])for(let i=0;i<5;i++){const p=cx.MAP.plant[side][i];assert.equal(cx.sourceWorld.overlap(p[0],p[3]+.005,p[1],1.8,.3),false);for(let j=0;j<i;j++){const q=cx.MAP.plant[side][j];assert.ok(Math.hypot(p[0]-q[0],p[1]-q[1])>=1.35);}}
    if(key==='palace')assert.ok(cx.MAP.plant.ct.every(p=>p[1]<0)&&cx.MAP.plant.t.every(p=>p[1]>0),'Palace defenders at top, attackers at bottom');
    else assert.ok(cx.MAP.plant.ct.every(p=>p[0]<0)&&cx.MAP.plant.t.every(p=>p[0]>0),'Factory follows the original blue-left/red-right bases');
    assert.equal(cx.MAP.plant.sites.length,2);assert.ok(cx.sourceWorld.mesh.opaque/3<3000);
    const report=JSON.parse(readFileSync(resolve(__dirname,'../assets/maps/'+key+'-source.json'),'utf8'));assert.ok(report.sourceSha256.length===64);
  }
});

test('Warface: actual walking reaches both bombsites and the opposite base from both teams without jumping',()=>{
  for(const key of ['palace','factory']){
    const g=game({mode:'5v5',warfaceMap:key}),cx=g.context;cx.buildMap(key);g.dmBuildNav();const nav=g.DM.nav,map=cx.MAP;
    for(const side of ['t','ct'])for(const goal of [...map.plant.sites.map(s=>[s.lx,s.lz,0,s.y0+.1]),map.plant[side==='t'?'ct':'t'][0]]){
      const start=map.plant[side][0],actor={pos:new Vec(start[0],start[3]+.002,start[1]),vel:new Vec(),h:1.8,onGround:true,crouch:false,path:[],pathAt:0,landSpread:0};
      assert.equal(g.dmFindPath(actor,goal[0],goal[1],goal[3]),true);
      for(const id of actor.path){const x=nav.x[id],z=nav.z[id];let frames=0;
        while(Math.hypot(x-actor.pos.x,z-actor.pos.z)>.16&&frames++<400){const dx=x-actor.pos.x,dz=z-actor.pos.z,d=Math.hypot(dx,dz);g.physics(actor,dx/d,dz/d,Math.min(4.5,d*10),false,1/128);}
        assert.ok(frames<400,key+' '+side+' blocked at '+id+' '+JSON.stringify(actor.pos));assert.ok(Number.isFinite(actor.pos.y)&&actor.pos.y>-5);
      }
      assert.ok(Math.hypot(actor.pos.x-goal[0],actor.pos.z-goal[1])<1,key+' missed destination');
    }
  }
});


test('5v5 starts ten actors on the authored attacking and defending bases using the existing bomb rules',()=>{
  for(const key of ['palace','factory']){const {g,cx,A,BM,step}=bombWorld(key,"S.mode='bomb'");step(10000,1100);
    assert.deepEqual(Array.from(A.sizes),[5,5]);assert.equal(A.bomb,true);assert.equal(g.DM.bots.length,9);assert.equal(g.DM.actors.length,10);
    assert.equal(g.DM.phase,'freeze');assert.ok(g.DM.actors.every(e=>e.alive&&e.hp===100));
    for(const e of g.DM.actors){const side=e.team===BM.tTeam?'t':'ct';assert.ok(cx.MAP.plant[side].some(p=>Math.hypot(e.pos.x-p[0],e.pos.z-p[1])<.1));}
    assert.equal(g.DM.byId.get(BM.carrier).team,BM.tTeam);
  }
});

test('native stairs and slopes stay walkable with varied approach offsets in Guard, Elysion, Prefire and Palace',()=>{
  for(const key of ['guard','elysion','infernoprefire','palace']){
    const g=game(),cx=g.context;cx.buildMap(key);g.dmBuildNav();const n=g.DM.nav,map=cx.sourceWorld,edges=[];
    for(const a of n.walk)for(let d=0;d<4;d++){const b=n.links[a*4+d];if(b<0)continue;const rise=n.height[b]-n.height[a];if(rise<.08||rise>.505)continue;if(map.overlap(n.x[a],n.height[a]+.005,n.z[a],1.8,.3)||map.overlap(n.x[b],n.height[b]+.005,n.z[b],1.8,.3))continue;edges.push([a,b]);}
    assert.ok(edges.length>20,key);let attempts=0;
    for(let k=0;k<Math.min(edges.length,45);k++){const [a,b]=edges[Math.floor(k*edges.length/Math.min(edges.length,45))];for(const offset of [-.06,0,.06]){
      const dx=n.x[b]-n.x[a],dz=n.z[b]-n.z[a],len=Math.hypot(dx,dz),x=n.x[a]-dz/len*offset,z=n.z[a]+dx/len*offset,y=map.ground(x,z,n.height[a]);if(map.overlap(x,y+.005,z,1.8,.3))continue;
      const actor={pos:new Vec(x,y+.002,z),vel:new Vec(),h:1.8,onGround:true,crouch:false,landSpread:0};let frames=0;
      while(Math.hypot(n.x[b]-actor.pos.x,n.z[b]-actor.pos.z)>.17&&frames++<250){const dx=n.x[b]-actor.pos.x,dz=n.z[b]-actor.pos.z,d=Math.hypot(dx,dz);g.physics(actor,dx/d,dz/d,Math.min(4.5,d*10),false,1/128);}
      assert.ok(frames<250,key+' stuck at stair '+a+'/'+b+' offset '+offset);attempts++;
    }}assert.ok(attempts>100,key+' needs varied approaches');
  }
});

test('native movement climbs a full staircase at 30/60/144 FPS and still blocks a wall taller than a step',async()=>{
  const {packMap}=await import('../tools/import-source-maps.mjs'),hulls=[];
  const box=(min,max)=>hulls.push({min,max,mask:3,planes:[[1,0,0,max[0]],[-1,0,0,-min[0]],[0,1,0,max[1]],[0,-1,0,-min[1]],[0,0,1,max[2]],[0,0,-1,-min[2]]]});
  box([-3,-1,-2],[10,0,2]);for(let i=0;i<8;i++)box([i*.65,0,-1.4],[(i+1)*.65,(i+1)*.25,1.4]);box([5.2,0,-1.4],[9,2,1.4]);box([7,2,-1.4],[7.3,4.5,1.4]);
  const packed=packMap({key:'stairs',name:'Stairs',scale:1,center:[0,0,0],bounds:[-3,-1,-2,10,4.5,2],ax:11,az:3,playBounds:[-3,-2,10,2],t:[[-1,0,0,0]],ct:[[6,0,0,2]],sites:[],ladders:[],polygons:[],hulls,report:{sourceSha256:'test'}});
  for(const hz of [30,60,144]){const g=game();g.context.sourceWorld=new SourceMaps.NativeMap(packed);const e=entity(-1,0);e.pos.y=.002;
    for(let i=0;i<hz*3;i++)g.physics(e,1,0,4.5,false,1/hz);
    assert.ok(e.pos.x>6.4&&e.pos.x<6.701,'stairs/wall at '+hz+' FPS '+JSON.stringify(e.pos));assert.ok(Math.abs(e.pos.y-2)<.03);assert.equal(e.onGround,true);
  }
});


test('Guard ladder lets the player climb from the bottom onto the upper landing without bouncing at the lip',()=>{
  const g=game(),cx=g.context;cx.buildMap('guard');const ladder=cx.sourceWorld.meta.ladders[0],x=(ladder[0]+ladder[3])/2,z=ladder[2]-.31;
  g.spawnSelf(0,[x,z,0,ladder[1]+.02]);g.P.pos.set(x,ladder[1]+.02,z);g.P.h=1.8;
  let frames=0;while(!(g.P.onGround&&g.P.pos.y>=ladder[4]-1.85)&&frames++<360)g.physics(g.P,0,1,4.5,false,1/60);
  assert.ok(frames<360,JSON.stringify(g.P.pos));assert.equal(g.P.climbing,false);assert.ok(Math.hypot(g.P.pos.x-x,g.P.pos.z-z)>.5);
  assert.equal(cx.sourceWorld.overlap(g.P.pos.x,g.P.pos.y,g.P.pos.z,g.P.h,.3),false);
});
test('walking gait: legs alternate along the movement in all eight directions, amplitude follows speed and drops to zero when stopped', () => {
  const g = game(), cx = g.context, ev = s => vm.runInContext(s, cx);
  assert.equal(ev('typeof gaitUpdate'), 'function');
  for (let d = 0; d < 8; d++) {
    const a = d * Math.PI / 4, yaw = .7, f = Math.cos(a), r = Math.sin(a), s = Math.sin(yaw), c = Math.cos(yaw);
    const vx = (-s * f + c * r) * 5, vz = (-c * f - s * r) * 5, gait = {}; let x = 0, z = 0, minL = 0, maxL = 0, opposite = true;
    for (let i = 0; i < 180; i++) { x += vx / 60; z += vz / 60; cx.gaitUpdate(gait, x, z, yaw, 1 / 60, false); const L = cx.gaitLeg(gait, 1), R = cx.gaitLeg(gait, -1); if (Math.abs(L) > .01 && Math.sign(L) === Math.sign(R)) opposite = false; minL = Math.min(minL, L); maxL = Math.max(maxL, L); }
    assert.ok(Math.abs(gait.f - f) < .05 && Math.abs(gait.r - r) < .05, 'direção ' + d);
    assert.ok(maxL > .2 && minL < -.2, 'passada ' + d); assert.ok(opposite, 'pernas alternadas ' + d);
    for (let i = 0; i < 90; i++) cx.gaitUpdate(gait, x, z, yaw, 1 / 60, false);
    assert.ok(gait.amp < .02, 'parado: pernas voltam');
  }
});
test('Elysion: the upper-floor glass railings and the black terrace curtain block walking but let bullets through', () => {
  const { g, cx } = bombWorld('elysion');
  const W = cx.sourceWorld, shotHit = (o, d, len) => g.trace(o, d, len, []);
  // vidro entre os pilares do andar de cima
  assert.equal(shotHit([11.9, 3.8, -21.6], [0, 0, -1], 1.4), null, 'tiro atravessa o vidro');
  assert.equal(W.overlap(11.9, 3.27, -22.47, 1.8, .3, 1), true, 'o vidro bloqueia o boneco');
  // cortina preta na passagem do terraço
  assert.equal(shotHit([18.1, 1.2, -21.3], [1, 0, 0], 1.2), null, 'tiro atravessa a cortina embaixo');
  assert.equal(shotHit([18.1, 4.2, -18.8], [1, 0, 0], 1.2), null, 'tiro atravessa a faixa de cima');
  assert.equal(W.overlap(18.75, .02, -21.3, 1.8, .3, 1), true, 'a cortina bloqueia o boneco');
  assert.equal(shotHit([18.4, 1.2, -12], [1, 0, 0], .36), null, 'tiro atravessa a cortina até o pilar');
  assert.equal(W.overlap(18.75, .02, -12, 1.8, .3, 1), true, 'e continua bloqueando o boneco');
});
test('walking gait: running opens wider steps than walking, at a natural cadence instead of a fast jitter', () => {
  const g = game(), cx = g.context;
  const measure = speed => { const gait = {}; let x = 0, crossings = 0, last = 0; for (let i = 0; i < 240; i++) { x += speed / 60; cx.gaitUpdate(gait, 0, x, Math.PI, 1 / 60, false, { x: 0, z: speed }); const L = cx.gaitLeg(gait, 1); if (i > 60 && Math.sign(L) !== Math.sign(last) && last) crossings++; last = L; } return { amp: gait.amp, stepsPerSecond: crossings / 3 }; };
  const run = measure(5.6), walk = measure(2.9);
  assert.ok(run.amp > walk.amp + .15, `correndo abre mais: ${run.amp.toFixed(2)} x ${walk.amp.toFixed(2)}`);
  assert.ok(run.stepsPerSecond > 3 && run.stepsPerSecond < 6.5, 'cadência correndo ' + run.stepsPerSecond);
  assert.ok(walk.stepsPerSecond > 2 && walk.stepsPerSecond < 5.5, 'cadência andando ' + walk.stepsPerSecond);
});
test('Plant the Bomb weapon drops: G drops the gun in hand with its ammo, the dead drop their best gun, walking over picks up into an empty slot and E swaps', () => {
  const { g, cx, step } = bombWorld();
  const ev = s => vm.runInContext(s, cx);
  let t = step(10000, 1500);
  g.P.money = 9000; const rifle = ev('sideOf(P)') === 't' ? 'rifle' : 'm4a4';
  assert.ok(cx.bombBuy(g.P, rifle, t)); g.selectWeapon(rifle); g.P.ammo[rifle].mag = 17;
  ev(`playerDropWeapon(${t})`);
  assert.equal(g.P.inv.primary, null); assert.ok(!g.ORDER.includes(rifle)); assert.notEqual(g.P.weapon, rifle);
  const drop = ev('WDROP.list')[0]; assert.equal(drop.w, rifle); assert.equal(drop.mag, 17);
  // quem largou não pega de volta na hora; depois, passando por cima, pega com a munição
  g.P.pos.set(drop.x, drop.y, drop.z); ev(`weaponPickups(${t + 200})`); assert.equal(g.P.inv.primary, null);
  ev(`weaponPickups(${t + 2000})`); assert.equal(g.P.inv.primary, rifle); assert.equal(g.P.ammo[rifle].mag, 17); assert.equal(ev('WDROP.list.length'), 0);
  // E troca: a sua cai, a do chão vem
  const foe = ev('DM.actors.find(e=>e.team!==P.team)'); foe.inv.primary = 'sniper'; foe.alive = true; foe.pos.set(g.P.pos.x + 3, g.P.pos.y, g.P.pos.z);
  ev(`bombOnDeath(DM.actors.find(e=>e.team!==P.team),${t + 2100})`);
  const awp = ev('WDROP.list').find(d => d.w === 'sniper'); assert.ok(awp, 'morto deixa cair a arma mais forte'); assert.equal(foe.inv.primary, null);
  g.P.pos.set(awp.x, awp.y, awp.z); assert.equal(ev(`weaponSwapNear(${t + 2600})`), true);
  assert.equal(g.P.inv.primary, 'sniper'); assert.ok(ev('WDROP.list').some(d => d.w === rifle), 'a sua arma ficou no chão');
});
test('spectator: when dead you watch living teammates in first person, never the enemy, cycling with Mouse 1 and Mouse 2', () => {
  const { g, cx, step } = bombWorld();
  const ev = s => vm.runInContext(s, cx);
  let t = step(10000, 1500);
  g.P.alive = false; g.P.deathT = t - 2000;
  const allies = ev('DM.actors.filter(e=>e!==P&&e.alive&&dmAllies(P,e)).length');
  const list = ev('specTargets()'); assert.equal(list.length, allies); assert.ok(list.length >= 1);
  assert.ok(list.every(e => e.ally && e.id !== ev('G.me')), 'só companheiros vivos');
  assert.equal(ev(`specActive(${t})`), true); assert.equal(ev(`specActive(${g.P.deathT + 500})`), false, 'primeiro a câmera da morte');
  if (!cx.camera) { const v = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }); cx.camera = { position: v(), rotation: v() }; }
  const s = ev('specCurrent()'); ev(`specCamera(1/30,${t})`);
  assert.equal(ev('SPEC.view'), s.id); const cam = ev('[camera.position.x,camera.position.y,camera.position.z]');
  assert.ok(Math.hypot(cam[0] - s.x, cam[2] - s.z) < 1e-6 && Math.abs(cam[1] - s.y - 1.62) < .6, 'câmera nos olhos do companheiro');
  // Morto o último aliado, não sobra ninguém para assistir (o inimigo nunca entra na lista).
  ev('for(const e of DM.actors)if(e!==P&&dmAllies(P,e))e.alive=false');
  assert.equal(ev('specTargets().length'), 0); assert.equal(ev('specCurrent()'), null);
  ev(`specCamera(1/30,${t})`); assert.equal(ev('SPEC.view'), null);
  // Com mais companheiros, Mouse 1 avança e Mouse 2 volta.
  const ids = ['a', 'b', 'c']; cx.__fake = ids.map(id => ({ id, alive: true, pos: { x: 0, y: 0, z: 0 }, yaw: 0, team: g.P.team }));
  ev('DM.actors.push(...__fake)'); const order = ev('specTargets()').map(e => e.id);
  ev('SPEC.id=null;specCurrent()'); assert.equal(ev('SPEC.id'), order[0]);
  ev('specNext(1)'); assert.equal(ev('SPEC.id'), order[1]); ev('specNext(-1)'); ev('specNext(-1)'); assert.equal(ev('SPEC.id'), order[order.length - 1]);
});
