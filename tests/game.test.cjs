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
}
function game(saved) {
  let clock = 10000, seed = 92741;
  const events = [], keys = new Set();
  const floor = { min: [-1000, -1, -1000], max: [1000, 0, 1000] };
  const context = vm.createContext({
    performance: { now: () => clock }, localStorage: { getItem: () => saved ? JSON.stringify(saved) : null }, V3: Vec,
    boxes: [floor], ramps: [], STEP_UP: .5, AX: 30, AZ: 30, C: 1.2, MS: .95,
    MAP: { spawn: { hx: 2, z0: 20, z1: 24 }, exit: { zc: -20, hw: 7 } },
    G: { mode: 'bot', me: 'A', opp: 'B', stats: {}, names: {}, view: { ph: 'live', m: 'match', r: 1 } },
    PCOLORS: { red:'#d8432c', orange:'#f08a24', yellow:'#f2c230', green:'#3fae4a', purple:'#8a4fd8', pink:'#e85aa8', black:'#2b2d33' },
    Math: Object.assign(Object.create(Math), { random: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) }),
    OPP: { cur: null, flashUntil: 0 }, keys, K: key => keys.has(key), locked: true,
    AU: new Proxy({}, { get: () => () => {} }),
    applyFov() {}, hitmark() {}, dmgNumber() {}, dmgDir() {}, flashRed() {}, addDecal() {}, tracer() {},
    remoteShotFx() {}, banner() {}, spat: () => ({ v:.5, pan:0 }), addFeed: (killer,victim,w,hs) => events.push({topic:'feed',killer,victim,w,hs}),
    netSend: e => events.push(e), emit: (topic, data) => events.push({ topic, data }),
    botEmit: (topic, data) => events.push({ topic, data }),
    spawnPoint: (side,spec) => ({ x: spec?spec[0]:0, y: 0, z: spec?spec[1]:0, yaw: spec?spec[2]:0 }),
    setTimeout() {}, console,
  });
  vm.runInContext(section('const V3 =', '/* ================= Configurações').replace('const V3 = THREE.Vector3, ', 'const '), context);
  vm.runInContext(section('const DEFAULTS =', '/* ================= Render'), context);
  vm.runInContext(section('const MAPS =', 'const MAP_IDS'), context);
  vm.runInContext(section('function stat(', '/* ================= Rede P2P'), context);
  vm.runInContext(section('function rampHeightAt', 'function groundAt'), context);
  vm.runInContext(section('function overlap(', '/* ================= Áudio'), context);
  vm.runInContext(section('const P =', 'const G ='), context);
  vm.runInContext(section('function spawnSelf(', '/* ================= Oponente na tela'), context);
  vm.runInContext(section('const KNIFE_REST =', 'function knifePalm'), context);
  const state = vm.runInContext('({P, S, W, ORDER, CATEGORIES, BOT, LEVELS, configureLoadout, damageFor, physics, playerInput, inaccuracy, spawnSelf, selectWeapon, inspect, shoot, updateWeapon, startReload, botSpawn, botUpdate, botDamage, sampleKnifePose, sampleKnifeAnimation, beginKnifeAnimation, BF_DRAW, BF_INSPECT, KNIFE_CLIPS, KNIFE_DURATIONS, KARAMBIT_CLIPS, KARAMBIT_DURATIONS, sampleKarambitPose, sampleKarambitIdle, PHYS_STEP, BHOP_CAP, MAPS, DM, DM_POOLS, DM_BOT_NAMES, dmLoadoutOrder, dmBuildNav, dmSetup, dmTick, dmDamage, dmRespawn, dmChooseSpawn, dmRefreshTargets, dmCell, dmFindPath, dmWalkClear, dmBotFire, dmRanking, dmFinish, dmStop, trace, clearLine, overlapAny, stat})', context);
  return Object.assign(state, { context, events, keys, tick: value => { clock = value; }, floor });
}
function deathmatch(category='all',level='medio') {
  const g=game(), map=g.MAPS.deathmatch;
  g.context.G.mode='dm';g.context.G.opp=null;g.S.dmWeapons=category;g.S.dmLevel=level;
  g.context.MAP=map;g.context.AX=map.ax;g.context.AZ=map.az;
  g.context.boxes=[g.floor];
  g.context.boxes.push({min:[-23,0,-23],max:[-22,7,23]},{min:[22,0,-23],max:[23,7,23]},{min:[-22,0,-23],max:[22,7,-22]},{min:[-22,0,22],max:[22,7,23]});
  map.build({box(x,z,w,d,h,color,y=0){g.context.boxes.push({min:[x-w/2,y,z-d/2],max:[x+w/2,y+h,z+d/2]});}},{});
  g.dmBuildNav();g.dmSetup(10000);
  g.advance=(milliseconds,dt=1/60)=>{const end=g.time+milliseconds;while(g.time<end){g.time=Math.min(end,g.time+dt*1000);g.tick(g.time);g.dmTick(dt,g.time);}};
  g.time=10000;return g;
}
function entity(x = 0, z = 0) {
  return { pos: new Vec(x, 0, z), vel: new Vec(), h: 1.8, onGround: true, crouch: false, landSpread: 0 };
}

test('the complete game script parses', () => new vm.Script(script));

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
  for(const p of g.DM.spawnPoints){assert.equal(g.overlapAny(p.x,.03,p.z,1.8),false);assert.ok(n.open[g.dmCell(p.x,p.z)]);}
  for(const a of g.DM.actors)for(const b of g.DM.actors)if(a!==b)assert.ok(Math.hypot(a.pos.x-b.pos.x,a.pos.z-b.pos.z)>5);
  const bot=g.DM.bots[0];let paths=0;
  for(const p of g.DM.spawnPoints)if(g.dmFindPath(bot,p.x,p.z)){paths++;for(const id of bot.path)assert.ok(n.open[id]);}
  assert.ok(paths>=15);
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
    for(const b of g.DM.bots){assert.ok(Number.isFinite(b.pos.x)&&Number.isFinite(b.pos.z));assert.ok(Math.abs(b.pos.x)<22&&Math.abs(b.pos.z)<22);}
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

test('M4s need more than one helmeted headshot; AK, Deagle and Scout retain lethal HS', () => {
  const g = game();
  for (const key of ['m4a4', 'm4a1s']) assert.ok(g.damageFor(g.W[key], 'head', true) < 100);
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
      const before = Array.from(g.sampleKnifePose(poses, poses[i][0] - 1e-6));
      const after = Array.from(g.sampleKnifePose(poses, poses[i][0] + 1e-6));
      assert.ok(before.every((v,j) => Math.abs(v-after[j]) < 1e-5));
    }
  }
});

test('butterfly follows the reference timing: a short draw and a stable inspection display', () => {
  const g = game({ loadout:{knife:'butterfly'},startSlot:'knife' });g.spawnSelf(0);
  assert.equal(g.P.kAnim.duration,800);
  g.P.drawEnd=0;g.tick(12000);g.inspect();
  assert.equal(g.P.kAnim.duration,4200);
  const first=Array.from(g.sampleKnifeAnimation(g.P.kAnim,12000+4200*.35));
  const held=Array.from(g.sampleKnifeAnimation(g.P.kAnim,12000+4200*.65));
  assert.deepEqual(first,held);
  assert.equal(held[12],1);assert.equal(held[13],1);
  for(let i=0;i<=200;i++){
    const pose=g.sampleKnifeAnimation(g.P.kAnim,12000+4200*i/200);
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
  const end = Array.from(g.sampleKnifeAnimation(g.P.kAnim,14000));
  assert.ok(end.every((v,i) => Math.abs(i === 6 || i === 7 ? Math.sin(v) : v) < 1e-6));
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
  assert.equal(g.P.kAnim.duration,650);
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
  assert.equal(g.P.kAnim.duration,2800);
  const before=Array.from(g.sampleKnifeAnimation(g.P.kAnim,13000));g.shoot(13000,true);
  const after=Array.from(g.sampleKnifeAnimation(g.P.kAnim,13000));
  for(let i=0;i<before.length;i++)assert.ok(Math.abs(i===6||i===7 ? Math.sin(before[i]-after[i]) : before[i]-after[i])<2e-6);
  const impact=g.sampleKnifeAnimation(g.P.kAnim,13000+g.P.kAnim.duration*.44);
  assert.equal(g.P.kAnim.type,'stab');assert.equal(impact[12],0);assert.equal(impact[6],0);
});
