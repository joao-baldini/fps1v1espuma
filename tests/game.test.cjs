const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
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
  const context = vm.createContext({
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
    applyFov() {}, hitmark() {}, dmgNumber() {}, dmgDir() {}, flashRed() {}, addDecal() {}, tracer() {},
    remoteShotFx() {}, banner() {}, killBanner() {}, healFx() {}, spat: () => ({ v:.5, pan:0 }), addFeed: (killer,victim,w,hs) => events.push({topic:'feed',killer,victim,w,hs}),
    netSend: e => events.push(e), emit: (topic, data) => events.push({ topic, data }),
    botEmit: (topic, data) => events.push({ topic, data }),
    spawnPoint: (side,spec) => ({ x: spec?spec[0]:0, y: spec?context.groundAt(spec[0], spec[1]):0, z: spec?spec[1]:0, yaw: spec?spec[2]:0 }),
    setTimeout() {}, console,
  });
  vm.runInContext(section('const V3 =', '/* ================= Configurações').replace('const V3 = THREE.Vector3, ', 'const '), context);
  vm.runInContext(section('const DEFAULTS =', '/* ================= Render'), context);
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
    cx.buildMap('aimbotz');cx.G.mode='aimbotz';g.spawnSelf(0,[0,9,0]);cx.aimbotzSetup();cx.aimbotzSetBots(1);cx.aimbotzEquip(weapon);
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

test('Aimbotz board controls match their visible positions and equip every available weapon', () => {
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
    if (b.weapon) { cx.aimbotzEquip(b.weapon); assert.equal(g.P.weapon, b.weapon); }
  }
  assert.equal(buttons.filter(b => b.weapon).length, Object.keys(g.W).length);
  assert.equal(cx.aimbotzButtonAt(from, [0, 0, -1]), null);
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
  assert.deepEqual(Array.from(g.ORDER), ['rifle', 'pistol', 'butterfly', 'sniper']);
  assert.equal(g.S.botWeapon, 'rifle');
  assert.equal(g.S.startSlot, 'rifle');
});

test('all 24 equipment combinations equip, switch, shoot and reload each selected gun', () => {
  const g = game(); let combinations = 0;
  for (const rifle of g.CATEGORIES.rifle) for (const pistol of g.CATEGORIES.pistol)
    for (const knife of g.CATEGORIES.knife) for (const sniper of g.CATEGORIES.sniper) {
      g.S.loadout = { rifle, pistol, knife, sniper }; g.spawnSelf(0);
      assert.deepEqual(Array.from(g.ORDER), [rifle, pistol, knife, sniper]);
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
  assert.equal(combinations, 24);
});

test('equipment edits take effect on the next spawn, with the chosen starting slot', () => {
  const g = game(); g.spawnSelf(0);
  g.S.loadout.rifle = 'm4a4'; g.S.startSlot = 'sniper';
  g.selectWeapon('m4a4'); assert.equal(g.P.weapon, 'rifle');
  g.spawnSelf(0); assert.equal(g.P.weapon, 'sniper');
  g.selectWeapon('m4a4'); assert.equal(g.P.weapon, 'm4a4');
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
  for (const key of Object.keys(g.W).filter(k => !g.W[k].melee)) {
    g.context.G.view.ph = 'freeze';
    g.S.botWeapon = key; g.S.botHelmet = false; g.botSpawn(1);
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
  assert.ok(held[14]<-2);assert.ok(Math.abs(held[7])>.5); // exibição: lâmina em pé e cabo solto aberto em V
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
  cx.G.mode = 'team'; g.S.map = 'caixas'; g.S.mode = 'xvx'; g.S.xvx = { mine: 1, foes: 5 }; g.S.target = 2; g.S.roundTime = 40;
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
    cx.G.mode = 'team'; g.S.map = 'caixas'; g.S.mode = '2v2'; g.S.teamSetup = 'versus';
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
