import * as THREE from 'three';

/**
 * Weapon Definitions & Balance Values
 */
export const WEAPONS = {
  ASSAULT: {
    id: 'ASSAULT',
    name: 'BREACHER-V1 (ASSAULT)',
    slot: 1,
    fireRate: 0.11, // ~545 RPM
    damage: 24,
    maxClip: 30,
    maxReserve: 90,
    reloadDuration: 1.8,
    isMelee: false,
    auto: true,
    range: 120.0
  },
  PISTOL: {
    id: 'PISTOL',
    name: 'TAC-9 (PISTOL)',
    slot: 2,
    fireRate: 0.25, // Semi-auto
    damage: 38,
    maxClip: 12,
    maxReserve: 36,
    reloadDuration: 1.4,
    isMelee: false,
    auto: false,
    range: 80.0
  },
  KNIFE: {
    id: 'KNIFE',
    name: 'TACTICAL TRENCH KNIFE',
    slot: 3,
    fireRate: 0.50, // Melee attack
    damage: 55,
    maxClip: 0,
    maxReserve: 0,
    reloadDuration: 0.0,
    isMelee: true,
    auto: false,
    range: 2.5
  }
};

/**
 * Weapon
 * Manages 3 selectable weapons (Assault, Pistol, Knife), first-person viewmodels,
 * firing audio synthesis, reload animations, and network combat integration.
 */
export class Weapon {
  constructor(camera, scene, collisionSystem, hud, network = null) {
    this.camera = camera;
    this.scene = scene;
    this.collisionSystem = collisionSystem;
    this.hud = hud;
    this.network = network;

    // Equipped weapon state
    this.currentType = 'ASSAULT';
    this.currentStats = WEAPONS.ASSAULT;

    // Local ammo tracking
    this.ammo = {
      ASSAULT: { clip: 30, reserve: 90 },
      PISTOL: { clip: 12, reserve: 36 },
      KNIFE: { clip: 0, reserve: 0 }
    };

    this.isReloading = false;
    this.reloadTimer = 0;
    this.lastFireTime = 0;
    this.isSwitching = false;
    this.switchTimer = 0;

    // Practice targets
    this.targets = [];

    // Viewmodel positioning & animation
    this.basePos = new THREE.Vector3(0.32, -0.32, -0.55);
    this.baseRot = new THREE.Vector3(0.04, -0.05, 0.0);
    this.recoilOffset = new THREE.Vector3();
    this.recoilRot = new THREE.Vector3();
    this.bobTimer = 0;

    // Audio Context
    this.initAudio();

    // Viewmodel container
    this.viewmodelRoot = new THREE.Group();
    this.camera.add(this.viewmodelRoot);

    // Build models for all 3 weapons
    this.weaponModels = {};
    this.buildWeaponModels();
    this.activateWeaponModel('ASSAULT');

    // Visual effect pools
    this.tracers = [];
    this.sparks = [];

    this.updateHUD();
  }

  setNetwork(network) {
    this.network = network;
  }

  setTargets(targets) {
    this.targets = targets;
  }

  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }

  playGunshotSound(type = 'ASSAULT') {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const t = this.audioCtx.currentTime;

    if (type === 'KNIFE') {
      // Knife whoosh / slash sound
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
      return;
    }

    // Firearms: Low punch
    const osc = this.audioCtx.createOscillator();
    const oscGain = this.audioCtx.createGain();
    osc.type = 'sawtooth';
    const startFreq = type === 'ASSAULT' ? 140 : 210;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + (type === 'ASSAULT' ? 0.12 : 0.09));

    oscGain.gain.setValueAtTime(type === 'ASSAULT' ? 0.6 : 0.45, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(oscGain);
    oscGain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.14);

    // Crack / Noise burst
    const bufferSize = this.audioCtx.sampleRate * 0.08;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = type === 'ASSAULT' ? 1800 : 2600;
    noiseFilter.Q.value = 1.0;

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.audioCtx.destination);
    noise.start(t);
    noise.stop(t + 0.08);
  }

  playDryFireSound() {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  playHitmarkerSound(isHeadshot = false) {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isHeadshot ? 1600 : 900, t);
    osc.frequency.setValueAtTime(isHeadshot ? 2200 : 1200, t + 0.03);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playReloadSound() {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.setValueAtTime(220, t + 0.1);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  buildWeaponModels() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, roughness: 0.35, metalness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.8, metalness: 0.2 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.4, metalness: 0.5 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xd8e0e8, roughness: 0.15, metalness: 0.95 });

    // 1. Assault Rifle Model
    const arGroup = new THREE.Group();
    const arBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.45), metalMat);
    arGroup.add(arBody);

    const arBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.35, 10), metalMat);
    arBarrel.rotation.x = Math.PI / 2;
    arBarrel.position.set(0, 0.02, -0.35);
    arGroup.add(arBarrel);

    const arMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.06), darkMat);
    arMuzzle.position.set(0, 0.02, -0.52);
    arGroup.add(arMuzzle);

    const arMag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.18, 0.09), darkMat);
    arMag.position.set(0, -0.11, -0.05);
    arMag.rotation.x = 0.2;
    arGroup.add(arMag);

    const arRail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.3), accentMat);
    arRail.position.set(0, 0.06, -0.05);
    arGroup.add(arRail);

    // 2. Pistol Model
    const pistolGroup = new THREE.Group();
    const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.24), metalMat);
    pSlide.position.set(0, 0.04, -0.12);
    pistolGroup.add(pSlide);

    const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.06), darkMat);
    pGrip.position.set(0, -0.04, -0.02);
    pGrip.rotation.x = 0.2;
    pistolGroup.add(pGrip);

    const pAccent = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.12), accentMat);
    pAccent.position.set(0, 0.07, -0.12);
    pistolGroup.add(pAccent);

    // 3. Knife Model
    const knifeGroup = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(0.015, 0.045, 0.28);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 0.02, -0.16);
    knifeGroup.add(blade);

    const handleGeo = new THREE.BoxGeometry(0.03, 0.04, 0.14);
    const handle = new THREE.Mesh(handleGeo, darkMat);
    handle.position.set(0, 0.0, 0.05);
    knifeGroup.add(handle);

    const guardGeo = new THREE.BoxGeometry(0.04, 0.08, 0.02);
    const guard = new THREE.Mesh(guardGeo, accentMat);
    guard.position.set(0, 0.01, -0.02);
    knifeGroup.add(guard);

    // Shared Muzzle Flash
    const flashGeo = new THREE.OctahedronGeometry(0.05, 0);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });
    this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlash.visible = false;
    this.viewmodelRoot.add(this.muzzleFlash);

    this.flashLight = new THREE.PointLight(0xff7700, 0, 8);
    this.viewmodelRoot.add(this.flashLight);

    this.weaponModels = {
      ASSAULT: arGroup,
      PISTOL: pistolGroup,
      KNIFE: knifeGroup
    };

    Object.values(this.weaponModels).forEach(g => {
      g.visible = false;
      this.viewmodelRoot.add(g);
    });

    this.viewmodelRoot.position.copy(this.basePos);
    this.viewmodelRoot.rotation.set(this.baseRot.x, this.baseRot.y, this.baseRot.z);
  }

  activateWeaponModel(type) {
    Object.keys(this.weaponModels).forEach(k => {
      this.weaponModels[k].visible = (k === type);
    });

    // Muzzle flash tip position adjustment
    if (type === 'ASSAULT') {
      this.muzzleFlash.position.set(0, 0.02, -0.58);
      this.flashLight.position.set(0, 0.02, -0.58);
    } else if (type === 'PISTOL') {
      this.muzzleFlash.position.set(0, 0.04, -0.28);
      this.flashLight.position.set(0, 0.04, -0.28);
    } else {
      this.muzzleFlash.visible = false;
      this.flashLight.intensity = 0;
    }
  }

  switchWeapon(slotOrType) {
    let targetType = null;
    if (slotOrType === 1 || slotOrType === '1' || slotOrType === 'ASSAULT') targetType = 'ASSAULT';
    else if (slotOrType === 2 || slotOrType === '2' || slotOrType === 'PISTOL') targetType = 'PISTOL';
    else if (slotOrType === 3 || slotOrType === '3' || slotOrType === 'KNIFE') targetType = 'KNIFE';

    if (!targetType || targetType === this.currentType || this.isSwitching) return;

    this.currentType = targetType;
    this.currentStats = WEAPONS[targetType];
    this.isReloading = false;
    this.isSwitching = true;
    this.switchTimer = 0.2; // 200ms weapon draw delay

    // Switch draw drop animation
    this.recoilOffset.y = -0.25;

    this.activateWeaponModel(targetType);
    this.playDryFireSound(); // Switch mechanical click
    this.updateHUD();

    // Inform server of weapon switch
    if (this.network) {
      this.network.sendSwitchWeapon(targetType);
    }
  }

  shoot() {
    if (this.isReloading || this.isSwitching) return;

    const stats = this.currentStats;
    const now = performance.now() / 1000;
    if (now - this.lastFireTime < stats.fireRate) return;

    const ammoInfo = this.ammo[this.currentType];

    // Check empty magazine for firearms
    if (!stats.isMelee && ammoInfo.clip <= 0) {
      this.playDryFireSound();
      this.reload();
      return;
    }

    this.lastFireTime = now;

    if (!stats.isMelee) {
      ammoInfo.clip--;
    }

    this.updateHUD();

    // Trigger visual/sound feedback
    this.playGunshotSound(this.currentType);
    if (!stats.isMelee) {
      this.triggerMuzzleFlash();
    }
    this.triggerRecoil(stats.isMelee);
    this.hud.triggerCrosshairBloom();

    // Camera origin & direction
    const ray = new THREE.Ray();
    this.camera.getWorldPosition(ray.origin);
    this.camera.getWorldDirection(ray.direction);

    // 1. Practice Mode Check: Raycast against local practice dummies
    let hitDummy = null;
    let dummyMinDist = stats.range;
    let dummyHitResult = null;

    for (const target of this.targets) {
      const res = target.checkHit(ray, stats.damage);
      if (res) {
        const dist = ray.origin.distanceTo(res.point);
        if (dist < dummyMinDist) {
          dummyMinDist = dist;
          hitDummy = target;
          dummyHitResult = res;
        }
      }
    }

    if (dummyHitResult) {
      // Local dummy hit
      this.hud.showHitmarker(dummyHitResult.isHeadshot);
      this.playHitmarkerSound(dummyHitResult.isHeadshot);

      const screenPos = dummyHitResult.point.clone().project(this.camera);
      const screenX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
      this.hud.showDamageNumber(dummyHitResult.damage, dummyHitResult.isHeadshot, screenX, screenY);

      this.spawnImpactSparks(dummyHitResult.point, new THREE.Vector3(0, 1, 0), 0xff3344);
      if (!stats.isMelee) {
        this.spawnTracer(dummyHitResult.point);
      }
    } else {
      // World geometry hit for local visual feedback
      const worldHit = this.collisionSystem.raycast(ray, stats.range);
      if (worldHit) {
        this.spawnImpactSparks(worldHit.point, worldHit.normal, 0xffaa00);
        if (!stats.isMelee) {
          this.spawnTracer(worldHit.point);
        }
      } else if (!stats.isMelee) {
        const farPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(stats.range));
        this.spawnTracer(farPoint);
      }
    }

    // 2. Server-Authoritative Combat: Submit shot to Spring Boot backend
    if (this.network && this.network.isConnected) {
      this.network.sendShoot(this.currentType, ray.origin, ray.direction);
    }
  }

  triggerMuzzleFlash() {
    this.muzzleFlash.visible = true;
    this.muzzleFlash.rotation.z = Math.random() * Math.PI;
    this.flashLight.intensity = 2.5;

    setTimeout(() => {
      this.muzzleFlash.visible = false;
      this.flashLight.intensity = 0;
    }, 45);
  }

  triggerRecoil(isMelee = false) {
    if (isMelee) {
      // Forward knife thrust / stab animation
      this.recoilOffset.z = -0.14;
      this.recoilRot.y = 0.2;
      this.recoilRot.z = -0.15;
    } else {
      // Gun upward kick
      const kick = this.currentType === 'ASSAULT' ? 0.08 : 0.12;
      const pitch = this.currentType === 'ASSAULT' ? 0.12 : 0.18;
      this.recoilOffset.z = kick;
      this.recoilOffset.y = 0.02;
      this.recoilRot.x = pitch;
      this.recoilRot.y = (Math.random() - 0.5) * 0.03;
    }
  }

  reload() {
    if (this.isReloading || this.currentStats.isMelee) return;

    const ammoInfo = this.ammo[this.currentType];
    if (ammoInfo.clip >= this.currentStats.maxClip || ammoInfo.reserve <= 0) return;

    this.isReloading = true;
    this.reloadTimer = this.currentStats.reloadDuration;
    this.playReloadSound();
    this.updateHUD();

    if (this.network) {
      this.network.sendReload();
    }
  }

  completeReload() {
    const stats = this.currentStats;
    const ammoInfo = this.ammo[this.currentType];
    const needed = stats.maxClip - ammoInfo.clip;
    const added = Math.min(needed, ammoInfo.reserve);

    ammoInfo.clip += added;
    ammoInfo.reserve -= added;
    this.isReloading = false;
    this.updateHUD();
  }

  syncServerWeaponState(stateMsg) {
    if (!stateMsg) return;
    const type = stateMsg.weapon;
    if (this.ammo[type]) {
      this.ammo[type].clip = stateMsg.clip;
      this.ammo[type].reserve = stateMsg.reserve;
    }
    this.isReloading = stateMsg.isReloading;
    this.updateHUD();
  }

  updateHUD() {
    const stats = this.currentStats;
    const ammoInfo = this.ammo[this.currentType];

    this.hud.updateWeaponDisplay({
      type: this.currentType,
      name: stats.name,
      slot: stats.slot,
      clip: stats.isMelee ? '∞' : ammoInfo.clip,
      reserve: stats.isMelee ? '—' : ammoInfo.reserve,
      isReloading: this.isReloading
    });
  }

  spawnTracer(targetPoint) {
    const muzzleWorld = new THREE.Vector3();
    this.muzzleFlash.getWorldPosition(muzzleWorld);

    const dir = targetPoint.clone().sub(muzzleWorld);
    const dist = dir.length();
    dir.normalize();

    const geo = new THREE.CylinderGeometry(0.015, 0.015, Math.min(dist, 4.0), 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe680, transparent: true, opacity: 0.95 });

    const tracer = new THREE.Mesh(geo, mat);
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    tracer.position.copy(muzzleWorld).add(dir.clone().multiplyScalar(2.0));

    this.scene.add(tracer);

    this.tracers.push({
      mesh: tracer,
      velocity: dir.multiplyScalar(160),
      life: 0.25
    });
  }

  spawnImpactSparks(point, normal, color = 0xffaa00) {
    const sparkCount = 6;
    for (let i = 0; i < sparkCount; i++) {
      const geo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
      const mat = new THREE.MeshBasicMaterial({ color });
      const spark = new THREE.Mesh(geo, mat);
      spark.position.copy(point);

      const vel = normal.clone().multiplyScalar(3.0)
        .add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));

      this.scene.add(spark);
      this.sparks.push({
        mesh: spark,
        velocity: vel,
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  update(delta, isMoving, isSprinting) {
    // 1. Weapon Switch Recovery
    if (this.isSwitching) {
      this.switchTimer -= delta;
      if (this.switchTimer <= 0) {
        this.isSwitching = false;
      }
    }

    // 2. Reload Timer Handling
    if (this.isReloading) {
      this.reloadTimer -= delta;
      this.recoilOffset.y = -0.15;
      if (this.reloadTimer <= 0) {
        this.completeReload();
      }
    }

    // 3. Viewmodel Bobbing
    if (isMoving) {
      const bobFreq = isSprinting ? 14 : 9;
      const bobAmp = isSprinting ? 0.025 : 0.012;
      this.bobTimer += delta * bobFreq;

      const bobX = Math.cos(this.bobTimer) * bobAmp;
      const bobY = Math.abs(Math.sin(this.bobTimer)) * bobAmp * 1.5;

      this.viewmodelRoot.position.x = this.basePos.x + this.recoilOffset.x + bobX;
      this.viewmodelRoot.position.y = this.basePos.y + this.recoilOffset.y - bobY;
      this.viewmodelRoot.position.z = this.basePos.z + this.recoilOffset.z;
    } else {
      const idleY = Math.sin(performance.now() * 0.002) * 0.003;
      this.viewmodelRoot.position.x = this.basePos.x + this.recoilOffset.x;
      this.viewmodelRoot.position.y = this.basePos.y + this.recoilOffset.y + idleY;
      this.viewmodelRoot.position.z = this.basePos.z + this.recoilOffset.z;
    }

    // 4. Recoil Recovery
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 18);
    this.recoilRot.lerp(new THREE.Vector3(0, 0, 0), delta * 20);

    this.viewmodelRoot.rotation.x = this.baseRot.x + this.recoilRot.x;
    this.viewmodelRoot.rotation.y = this.baseRot.y + this.recoilRot.y;

    // 5. Update Tracers & Sparks
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.mesh.position.addScaledVector(tr.velocity, delta);
      tr.life -= delta;
      if (tr.life <= 0) {
        this.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.mesh.position.addScaledVector(sp.velocity, delta);
      sp.velocity.y -= 9.8 * delta;
      sp.life -= delta;
      const scale = Math.max(0.01, sp.life / sp.maxLife);
      sp.mesh.scale.set(scale, scale, scale);
      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        sp.mesh.material.dispose();
        this.sparks.splice(i, 1);
      }
    }
  }
}
