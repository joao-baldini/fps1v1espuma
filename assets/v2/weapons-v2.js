// AIM.DUELO 2.0 — PBR Weapon Materials, Tactical Arms/Gloves, Volumetric Muzzle Flash & Pooled Particles/Casings
(() => {
  'use strict';

  function createWeaponMaterial(THREE, mats) {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.48,
      envMapIntensity: 0.9,
      normalMap: mats?.gunMaps?.normalMap || null,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughnessMap: mats?.gunMaps?.roughnessMap || null,
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
#ifdef USE_COLOR
  diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(2.2));
#endif`
      );
    };
    mat.customProgramCacheKey = () => 'v2-weapon-pbr';
    return mat;
  }

  // Sculpted tactical gloved hand (palm, curled fingers, thumb, carbon knuckle guard, wrist cuff)
  function createGloveGeometry(THREE) {
    const parts = [];
    const pushPart = (geo, tx, ty, tz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, hex = 0x242930) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      g.scale(sx, sy, sz);
      if (rx) g.rotateX(rx);
      if (ry) g.rotateY(ry);
      if (rz) g.rotateZ(rz);
      g.translate(tx, ty, tz);
      const count = g.attributes.position.count;
      const c = new THREE.Color(hex);
      const cols = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      parts.push(g);
    };
    // Main palm
    pushPart(new THREE.CylinderGeometry(0.036, 0.04, 0.088, 10), 0, 0, 0.005, Math.PI / 2, 0, 0, 1.05, 1, 0.85, 0x262b33);
    // Carbon knuckle armor plate
    pushPart(new THREE.BoxGeometry(0.068, 0.022, 0.028), 0, 0.024, -0.022, 0.15, 0, 0, 1, 1, 1, 0x16191f);
    // Curled fingers
    for (let i = 0; i < 4; i++) {
      const fx = -0.024 + i * 0.016;
      pushPart(new THREE.CylinderGeometry(0.0085, 0.0075, 0.044, 6), fx, -0.012, -0.042, 1.15, 0, 0, 1, 1, 1, 0x2e343d);
    }
    // Thumb
    pushPart(new THREE.CylinderGeometry(0.01, 0.009, 0.046, 7), -0.038, 0.016, -0.016, 0.7, 0.3, 0.55, 1, 1, 1, 0x2e343d);
    // Tactical wrist watch / strap cuff
    pushPart(new THREE.CylinderGeometry(0.042, 0.044, 0.032, 10), 0, 0, 0.048, Math.PI / 2, 0, 0, 1.05, 1, 0.9, 0x191d22);

    // Merge parts
    let total = 0;
    for (const g of parts) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let offset = 0;
    for (const g of parts) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, offset * 3);
      nrm.set(g.attributes.normal.array, offset * 3);
      col.set(g.attributes.color.array, offset * 3);
      offset += n;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
    merged.computeBoundingSphere();
    return merged;
  }

  // Tapered anatomical forearm sleeve (Y is length axis [-0.5..0.5], +Y = wrist, -Y = elbow)
  function createSleeveGeometry(THREE) {
    return new THREE.CylinderGeometry(0.92, 1.32, 1.0, 12, 1, false);
  }

  // 3D volumetric star muzzle flash geometry
  function createMuzzleFlashGeometry(THREE) {
    const p = [], c = [];
    const inner = new THREE.Color(0xfff6d6), outer = new THREE.Color(0xff8e2b);
    const addStar = (rx, ry, rz, spikes = 8, innerR = 0.02, outerR = 0.075) => {
      for (let i = 0; i < spikes; i++) {
        const a0 = (i / spikes) * Math.PI * 2;
        const a1 = ((i + 1) / spikes) * Math.PI * 2;
        const r0 = i % 2 ? innerR : outerR;
        const r1 = (i + 1) % 2 ? innerR : outerR;
        const v0 = [0, 0, 0];
        const v1 = [Math.cos(a0) * r0, Math.sin(a0) * r0, 0];
        const v2 = [Math.cos(a1) * r1, Math.sin(a1) * r1, 0];
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
        const t1 = new THREE.Vector3(...v1).applyMatrix4(m);
        const t2 = new THREE.Vector3(...v2).applyMatrix4(m);
        p.push(v0[0], v0[1], v0[2], t1.x, t1.y, t1.z, t2.x, t2.y, t2.z);
        c.push(inner.r, inner.g, inner.b, outer.r, outer.g, outer.b, outer.r, outer.g, outer.b);
      }
    };
    addStar(0, 0, 0, 12, 0.018, 0.082);
    addStar(Math.PI / 2, 0, 0, 8, 0.014, 0.068);
    addStar(0, Math.PI / 2, 0, 8, 0.014, 0.068);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    return g;
  }

  // Object-pooled InstancedMesh particle + brass shell casing system (2 draw calls total!)
  function createFXPool(THREE, scene) {
    const MAX_PARTICLES = 160;
    const MAX_SHELLS = 48;

    const pGeo = new THREE.IcosahedronGeometry(0.022, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    const pMesh = new THREE.InstancedMesh(pGeo, pMat, MAX_PARTICLES);
    pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3).fill(1), 3);
    pMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    pMesh.frustumCulled = false;
    pMesh.count = 0;
    scene.add(pMesh);

    const sGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.024, 6);
    sGeo.rotateX(Math.PI / 2);
    const sMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.88, roughness: 0.24 });
    const sMesh = new THREE.InstancedMesh(sGeo, sMat, MAX_SHELLS);
    sMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    sMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SHELLS * 3).fill(1), 3);
    sMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    sMesh.frustumCulled = false;
    sMesh.count = 0;
    scene.add(sMesh);

    const particles = Array.from({ length: MAX_PARTICLES }, () => ({
      alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grav: 9.8, life: 0, maxLife: 0.3, scale: 1, r: 1, g: 1, b: 1,
    }));
    const shells = Array.from({ length: MAX_SHELLS }, () => ({
      alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, vrx: 0, vry: 0, vrz: 0, life: 0, maxLife: 1.8, r: 0.85, g: 0.68, b: 0.25, floorY: 0, bounced: false,
    }));

    let pIdx = 0, sIdx = 0;
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    let densityMul = 1.0;

    function setDensity(level) {
      densityMul = level === 'low' ? 0.35 : level === 'medium' ? 0.7 : 1.0;
    }

    function spawnParticle(x, y, z, vx, vy, vz, hex, scale, life, grav = 9.8) {
      const p = particles[pIdx++ % MAX_PARTICLES];
      p.alive = true; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
      p.scale = scale; p.life = 0; p.maxLife = life; p.grav = grav;
      col.setHex(hex);
      p.r = col.r; p.g = col.g; p.b = col.b;
    }

    function spawnImpact(point, normal, kind = 'wall') {
      if (densityMul <= 0) return;
      const n = normal || [0, 1, 0];
      if (kind === 'head') {
        const count = Math.max(3, Math.round(9 * densityMul));
        for (let i = 0; i < count; i++) {
          const sp = 2.0 + Math.random() * 4.5;
          spawnParticle(
            point[0], point[1], point[2],
            (Math.random() - 0.5) * sp + n[0] * 1.5,
            Math.random() * sp * 0.8 + n[1] * 1.5,
            (Math.random() - 0.5) * sp + n[2] * 1.5,
            i % 2 ? 0xffe48a : 0xff6b4a, 0.85 + Math.random() * 0.7, 0.16 + Math.random() * 0.14, 7.5
          );
        }
      } else if (kind === 'body') {
        const count = Math.max(2, Math.round(6 * densityMul));
        for (let i = 0; i < count; i++) {
          const sp = 1.4 + Math.random() * 2.5;
          spawnParticle(
            point[0], point[1], point[2],
            (Math.random() - 0.5) * sp + n[0] * 1.0,
            Math.random() * sp * 0.6,
            (Math.random() - 0.5) * sp + n[2] * 1.0,
            0xc43429, 0.7 + Math.random() * 0.55, 0.16 + Math.random() * 0.1, 8.5
          );
        }
      } else {
        // Wall impact: crisp spark + concrete/wood dust puffs
        const count = Math.max(2, Math.round(6 * densityMul));
        for (let i = 0; i < count; i++) {
          const isSpark = i < 2;
          const sp = isSpark ? (3.5 + Math.random() * 4.0) : (1.1 + Math.random() * 1.8);
          spawnParticle(
            point[0] + n[0] * 0.02, point[1] + n[1] * 0.02, point[2] + n[2] * 0.02,
            n[0] * sp + (Math.random() - 0.5) * 2.4,
            n[1] * sp + Math.random() * 1.6,
            n[2] * sp + (Math.random() - 0.5) * 2.4,
            isSpark ? 0xffd27a : 0xc8c3ba,
            isSpark ? 0.45 : (1.1 + Math.random() * 0.9),
            isSpark ? (0.12 + Math.random() * 0.08) : (0.24 + Math.random() * 0.16),
            isSpark ? 11.0 : 1.8
          );
        }
      }
    }

    function spawnMuzzleSmoke(pos, dir) {
      if (densityMul < 0.5) return;
      for (let i = 0; i < 2; i++) {
        spawnParticle(
          pos[0], pos[1], pos[2],
          dir[0] * 1.2 + (Math.random() - 0.5) * 0.35,
          dir[1] * 1.2 + 0.5 + Math.random() * 0.4,
          dir[2] * 1.2 + (Math.random() - 0.5) * 0.35,
          0xbec5cc, 1.3 + Math.random() * 0.7, 0.28 + Math.random() * 0.12, -0.8
        );
      }
    }

    function ejectShell(pos, yaw, pitch, weaponKey, handSide = 1, floorY = 0) {
      if (densityMul < 0.5) return;
      const sh = shells[sIdx++ % MAX_SHELLS];
      const rx = Math.cos(yaw) * handSide, rz = -Math.sin(yaw) * handSide;
      const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
      const speed = 2.0 + Math.random() * 1.2;
      sh.alive = true; sh.life = 0; sh.maxLife = 1.6; sh.floorY = floorY + 0.01; sh.bounced = false;
      sh.x = pos[0] + rx * 0.08; sh.y = pos[1] + 0.02; sh.z = pos[2] + rz * 0.08;
      sh.vx = rx * speed + fwdX * 0.5 + (Math.random() - 0.5) * 0.4;
      sh.vy = 1.4 + Math.random() * 0.8 + Math.sin(pitch) * 0.4;
      sh.vz = rz * speed + fwdZ * 0.5 + (Math.random() - 0.5) * 0.4;
      sh.rx = Math.random() * 6; sh.ry = Math.random() * 6; sh.rz = Math.random() * 6;
      sh.vrx = 12 + Math.random() * 14; sh.vry = 9 + Math.random() * 10; sh.vrz = 8 + Math.random() * 12;
      if (weaponKey === 'bucky') { sh.r = 0.72; sh.g = 0.14; sh.b = 0.14; }
      else { sh.r = 0.86; sh.g = 0.68; sh.b = 0.24; }
    }

    function update(dt) {
      let pc = 0;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (!p.alive) continue;
        p.life += dt;
        if (p.life >= p.maxLife) { p.alive = false; continue; }
        p.vy -= p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const k = 1 - p.life / p.maxLife;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(p.scale * (0.35 + 0.65 * k));
        dummy.updateMatrix();
        pMesh.setMatrixAt(pc, dummy.matrix);
        col.setRGB(p.r, p.g, p.b);
        pMesh.setColorAt(pc, col);
        pc++;
      }
      pMesh.count = pc;
      if (pc > 0) { pMesh.instanceMatrix.needsUpdate = true; pMesh.instanceColor.needsUpdate = true; }
      pMesh.visible = pc > 0;

      let sc = 0;
      for (let i = 0; i < MAX_SHELLS; i++) {
        const sh = shells[i];
        if (!sh.alive) continue;
        sh.life += dt;
        if (sh.life >= sh.maxLife) { sh.alive = false; continue; }
        sh.vy -= 13.5 * dt;
        sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.z += sh.vz * dt;
        if (sh.y <= sh.floorY) {
          sh.y = sh.floorY;
          if (!sh.bounced && Math.abs(sh.vy) > 0.6) {
            sh.bounced = true;
            sh.vy = -sh.vy * 0.38;
            sh.vx *= 0.55; sh.vz *= 0.55;
            sh.vrx *= 0.4; sh.vry *= 0.4;
          } else {
            sh.vy = 0; sh.vx *= 0.85; sh.vz *= 0.85;
            sh.vrx = sh.vry = sh.vrz = 0;
          }
        }
        sh.rx += sh.vrx * dt; sh.ry += sh.vry * dt; sh.rz += sh.vrz * dt;
        const fade = sh.life > sh.maxLife - 0.3 ? (sh.maxLife - sh.life) / 0.3 : 1;
        dummy.position.set(sh.x, sh.y, sh.z);
        dummy.rotation.set(sh.rx, sh.ry, sh.rz);
        dummy.scale.setScalar(fade);
        dummy.updateMatrix();
        sMesh.setMatrixAt(sc, dummy.matrix);
        col.setRGB(sh.r, sh.g, sh.b);
        sMesh.setColorAt(sc, col);
        sc++;
      }
      sMesh.count = sc;
      if (sc > 0) { sMesh.instanceMatrix.needsUpdate = true; sMesh.instanceColor.needsUpdate = true; }
      sMesh.visible = sc > 0;
    }

    function clear() {
      for (const p of particles) p.alive = false;
      for (const s of shells) s.alive = false;
      pMesh.count = 0; pMesh.visible = false;
      sMesh.count = 0; sMesh.visible = false;
    }

    return { setDensity, spawnImpact, spawnMuzzleSmoke, ejectShell, update, clear };
  }

  globalThis.V2Weapons = {
    createWeaponMaterial,
    createGloveGeometry,
    createSleeveGeometry,
    createMuzzleFlashGeometry,
    createFXPool,
  };
})();
