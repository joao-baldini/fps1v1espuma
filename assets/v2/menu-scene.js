// AIM.DUELO 2.0 — Live 3D Tactical Lobby Showcase Backdrop
(() => {
  'use strict';

  function createMenuScene(THREE, mats, buildWeaponMeshFn) {
    const mScene = new THREE.Scene();
    mScene.background = new THREE.Color(0x0d1218);
    mScene.fog = new THREE.FogExp2(0x0d1218, 0.055);
    if (mats && mats.envMap) mScene.environment = mats.envMap;

    const mCam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 60);
    mCam.position.set(1.15, 1.38, -3.15);
    mCam.lookAt(-0.18, 1.12, 0);

    // Moody 3-point tactical lighting
    mScene.add(new THREE.HemisphereLight(0x7fb4e6, 0x1a2028, 0.6));
    const key = new THREE.DirectionalLight(0xffe9cf, 1.35);
    key.position.set(2.5, 4.2, -3.0);
    mScene.add(key);

    const rimCyan = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimCyan.position.set(-3.2, 2.4, 2.5);
    mScene.add(rimCyan);

    const rimAmber = new THREE.PointLight(0xf97316, 0.85, 8);
    rimAmber.position.set(2.2, 1.4, 1.8);
    mScene.add(rimAmber);

    // Tactical concrete floor pad + steel pedestal ring
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x182029,
      roughness: 0.72,
      metalness: 0.18,
      normalMap: mats?.worldPacked?.floor ? null : mats?.gunMaps?.normalMap || null,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48).rotateX(-Math.PI / 2), floorMat);
    mScene.add(floor);

    const padMat = new THREE.MeshStandardMaterial({ color: 0x202934, roughness: 0.48, metalness: 0.55 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.06, 36), padMat);
    pad.position.set(0.32, 0.03, 0);
    mScene.add(pad);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.02, 1.055, 48).rotateX(-Math.PI / 2), ringMat);
    ring.position.set(0.32, 0.062, 0);
    mScene.add(ring);

    // Distant architectural monoliths in background fog
    const bgMat = new THREE.MeshStandardMaterial({ color: 0x141b23, roughness: 0.85, metalness: 0.15 });
    for (const [x, z, w, h, d] of [
      [-3.5, 5.5, 1.8, 5.5, 1.4], [-1.0, 7.2, 2.4, 6.8, 1.6], [2.4, 6.0, 1.6, 4.8, 1.4],
      [4.5, 4.5, 2.0, 5.8, 1.8], [-5.2, 3.2, 1.4, 4.2, 1.6],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bgMat);
      m.position.set(x, h / 2, z);
      mScene.add(m);
    }

    // Subtle floating dust motes
    const moteCount = 48;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * 6;
      motePos[i * 3 + 1] = 0.2 + Math.random() * 2.4;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0x9ad8ff, size: 0.025, transparent: true, opacity: 0.45 }));
    mScene.add(motes);

    // Showcase Operator Rig
    const opGroup = new THREE.Group();
    opGroup.position.set(0.32, 0.06, 0);
    mScene.add(opGroup);

    const charMat = globalThis.V2Operators ? globalThis.V2Operators.createCharacterMaterial(THREE, mats) : new THREE.MeshBasicMaterial({ vertexColors: true });
    let currentOpKey = '', currentWeaponKey = '', currentSkinKey = '';
    let upperGrp = null, headGrp = null, weaponMesh = null;

    function syncShowcase(opId, isBomb, weaponKey, skinId) {
      const key = (isBomb ? 'op:' + opId : 'team:coalition');
      if (key !== currentOpKey && globalThis.V2Operators) {
        currentOpKey = key;
        opGroup.clear();
        const geos = globalThis.V2Operators.getRigGeometries(THREE, isBomb ? opId : 'coalition', isBomb);
        opGroup.add(new THREE.Mesh(geos.hip, charMat));
        const legL = new THREE.Mesh(geos.legL, charMat); legL.position.set(-0.11, 0, 0);
        const legR = new THREE.Mesh(geos.legR, charMat); legR.position.set(0.11, 0, 0);
        opGroup.add(legL, legR);
        upperGrp = new THREE.Group();
        upperGrp.add(new THREE.Mesh(geos.body, charMat));
        headGrp = new THREE.Group();
        const hd = new THREE.Mesh(geos.head, charMat); hd.position.y = -1.64;
        const hm = new THREE.Mesh(geos.helmet, charMat); hm.position.y = -1.64;
        headGrp.position.y = 1.64;
        headGrp.add(hd, hm);
        upperGrp.add(headGrp);
        opGroup.add(upperGrp);
        currentWeaponKey = '';
      }
      if ((weaponKey !== currentWeaponKey || skinId !== currentSkinKey) && upperGrp && buildWeaponMeshFn) {
        currentWeaponKey = weaponKey;
        currentSkinKey = skinId;
        if (weaponMesh) {
          upperGrp.remove(weaponMesh);
          weaponMesh.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
        }
        weaponMesh = buildWeaponMeshFn(weaponKey, skinId);
        weaponMesh.position.set(0.16, 1.26, -0.12);
        weaponMesh.scale.setScalar(0.85);
        upperGrp.add(weaponMesh);
      }
    }

    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function render(renderer, t, opId, isBomb, weaponKey, skinId) {
      syncShowcase(opId, isBomb, weaponKey, skinId);
      const time = reduced ? 0 : t * 0.001;
      opGroup.rotation.y = 0.28 + Math.sin(time * 0.35) * 0.04;
      if (upperGrp) upperGrp.position.y = Math.sin(time * 1.4) * 0.004;
      if (headGrp) headGrp.rotation.y = -0.18 + Math.sin(time * 0.5) * 0.03;
      motes.rotation.y = time * 0.04;

      const w = innerWidth, h = innerHeight;
      if (mCam.aspect !== w / h) { mCam.aspect = w / h; mCam.updateProjectionMatrix(); }
      mCam.position.set(1.15 + Math.sin(time * 0.25) * 0.08, 1.38 + Math.cos(time * 0.3) * 0.02, -3.15);
      mCam.lookAt(-0.18, 1.12, 0);

      renderer.clear();
      renderer.render(mScene, mCam);
    }

    return { scene: mScene, camera: mCam, render };
  }

  globalThis.V2MenuScene = { createMenuScene };
})();
