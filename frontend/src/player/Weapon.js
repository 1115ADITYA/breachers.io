import * as THREE from 'three';

/**
 * Weapon
 * Manages first-person viewmodel, raycasting shooting, muzzle flashes, bullet tracers,
 * procedural Web Audio gunshot/hit sounds, recoil, and ammo management.
 */
export class Weapon {
  constructor(camera, scene, collisionSystem, hud) {
    this.camera = camera;
    this.scene = scene;
    this.collisionSystem = collisionSystem;
    this.hud = hud;

    // Weapon Specifications: BREACHER-V1 Assault Rifle
    this.name = 'BREACHER-V1 (ASSAULT)';
    this.fireRate = 0.11; // ~540 RPM
    this.damage = 28;
    this.maxClip = 30;
    this.clip = 30;
    this.reserveAmmo = 90;
    this.reloadDuration = 1.8;
    this.isReloading = false;
    this.canFire = true;
    this.lastFireTime = 0;
    this.reloadTimer = 0;

    // Targets list
    this.targets = [];

    // Weapon viewmodel positioning
    this.basePos = new THREE.Vector3(0.32, -0.32, -0.55);
    this.baseRot = new THREE.Vector3(0.04, -0.05, 0.0);
    this.recoilOffset = new THREE.Vector3();
    this.recoilRot = new THREE.Vector3();

    // Bobbing
    this.bobTimer = 0;

    // Audio Context (procedural Web Audio API)
    this.initAudio();

    // Build procedural 3D weapon viewmodel
    this.buildViewModel();

    // Tracers and effects pool
    this.tracers = [];
    this.sparks = [];

    this.updateHUD();
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

  playGunshotSound() {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const t = this.audioCtx.currentTime;
    
    // Low frequency punch
    const osc = this.audioCtx.createOscillator();
    const oscGain = this.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);

    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(oscGain);
    oscGain.connect(this.audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.15);

    // Noise burst for gunshot crack
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
    noiseFilter.frequency.value = 1800;
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

  buildViewModel() {
    this.viewmodelGroup = new THREE.Group();

    // Weapon Materials
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1f242d,
      roughness: 0.35,
      metalness: 0.85
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0e1116,
      roughness: 0.8,
      metalness: 0.2
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      roughness: 0.4,
      metalness: 0.5
    });

    // 1. Receiver body
    const bodyGeo = new THREE.BoxGeometry(0.07, 0.1, 0.45);
    const body = new THREE.Mesh(bodyGeo, metalMat);
    this.viewmodelGroup.add(body);

    // 2. Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.35, 10);
    const barrel = new THREE.Mesh(barrelGeo, metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.35);
    this.viewmodelGroup.add(barrel);

    // 3. Muzzle Brake
    const muzzleGeo = new THREE.BoxGeometry(0.035, 0.035, 0.06);
    const muzzle = new THREE.Mesh(muzzleGeo, darkMat);
    muzzle.position.set(0, 0.02, -0.52);
    this.viewmodelGroup.add(muzzle);

    // 4. Magazine
    const magGeo = new THREE.BoxGeometry(0.045, 0.18, 0.09);
    const mag = new THREE.Mesh(magGeo, darkMat);
    mag.position.set(0, -0.11, -0.05);
    mag.rotation.x = 0.2;
    this.viewmodelGroup.add(mag);

    // 5. Stock
    const stockGeo = new THREE.BoxGeometry(0.05, 0.08, 0.2);
    const stock = new THREE.Mesh(stockGeo, darkMat);
    stock.position.set(0, -0.02, 0.28);
    this.viewmodelGroup.add(stock);

    // 6. Tactical Top Rail & Holographic Sight
    const railGeo = new THREE.BoxGeometry(0.04, 0.02, 0.3);
    const rail = new THREE.Mesh(railGeo, accentMat);
    rail.position.set(0, 0.06, -0.05);
    this.viewmodelGroup.add(rail);

    const sightGeo = new THREE.BoxGeometry(0.05, 0.06, 0.08);
    const sight = new THREE.Mesh(sightGeo, darkMat);
    sight.position.set(0, 0.095, -0.05);
    this.viewmodelGroup.add(sight);

    // Muzzle Flash effect (child of weapon)
    const flashGeo = new THREE.OctahedronGeometry(0.06, 0);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.9
    });
    this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlash.position.set(0, 0.02, -0.58);
    this.muzzleFlash.visible = false;
    this.viewmodelGroup.add(this.muzzleFlash);

    // Muzzle point light for ambient flare
    this.flashLight = new THREE.PointLight(0xff7700, 0, 8);
    this.flashLight.position.set(0, 0.02, -0.58);
    this.viewmodelGroup.add(this.flashLight);

    // Add viewmodel directly to camera
    this.camera.add(this.viewmodelGroup);
    this.viewmodelGroup.position.copy(this.basePos);
    this.viewmodelGroup.rotation.set(this.baseRot.x, this.baseRot.y, this.baseRot.z);
  }

  shoot() {
    if (this.isReloading) return;
    if (this.clip <= 0) {
      this.reload();
      return;
    }

    const now = performance.now() / 1000;
    if (now - this.lastFireTime < this.fireRate) return;

    this.lastFireTime = now;
    this.clip--;
    this.updateHUD();

    // Trigger visual and sound feedback
    this.playGunshotSound();
    this.triggerMuzzleFlash();
    this.triggerRecoil();
    this.hud.triggerCrosshairBloom();

    // Raycast from camera center
    const ray = new THREE.Ray();
    this.camera.getWorldPosition(ray.origin);
    this.camera.getWorldDirection(ray.direction);

    // 1. Check hits against shootable targets (Dummy Targets)
    let hitTarget = null;
    let closestTargetDist = Infinity;
    let targetHitResult = null;

    for (const target of this.targets) {
      const res = target.checkHit(ray, this.damage);
      if (res) {
        const dist = ray.origin.distanceTo(res.point);
        if (dist < closestTargetDist) {
          closestTargetDist = dist;
          hitTarget = target;
          targetHitResult = res;
        }
      }
    }

    // 2. Check hits against world geometry (Colliders)
    const worldHit = this.collisionSystem.raycast(ray, 150);

    let finalHitPoint = null;
    let isHeadshot = false;

    if (targetHitResult && (!worldHit || closestTargetDist <= worldHit.distance)) {
      // Dummy Target was hit!
      finalHitPoint = targetHitResult.point;
      isHeadshot = targetHitResult.isHeadshot;

      this.hud.showHitmarker(isHeadshot);
      this.playHitmarkerSound(isHeadshot);

      // Project target hit point to screen space for floating damage number
      const screenPos = finalHitPoint.clone().project(this.camera);
      const screenX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
      this.hud.showDamageNumber(targetHitResult.damage, isHeadshot, screenX, screenY);

      this.spawnImpactSparks(finalHitPoint, new THREE.Vector3(0, 1, 0), 0xff3344);
    } else if (worldHit) {
      // Hit a static wall / container / crate
      finalHitPoint = worldHit.point;
      this.spawnImpactSparks(finalHitPoint, worldHit.normal, 0xffaa00);
    } else {
      // No hit; bullet travels into distance
      finalHitPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(100));
    }

    // Spawn glowing bullet tracer
    this.spawnTracer(finalHitPoint);
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

  triggerRecoil() {
    // Kickback position
    this.recoilOffset.z = 0.08;
    this.recoilOffset.y = 0.02;

    // Upward pitch rotation
    this.recoilRot.x = 0.12;
    this.recoilRot.y = (Math.random() - 0.5) * 0.03;
  }

  reload() {
    if (this.isReloading) return;
    if (this.clip >= this.maxClip) return;
    if (this.reserveAmmo <= 0) return;

    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;
    this.hud.updateAmmo(this.clip, this.reserveAmmo, true);

    // Audio reload cue
    if (this.audioCtx) {
      const t = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.setValueAtTime(250, t + 0.1);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }

  completeReload() {
    const needed = this.maxClip - this.clip;
    const added = Math.min(needed, this.reserveAmmo);
    this.clip += added;
    this.reserveAmmo -= added;
    this.isReloading = false;
    this.updateHUD();
  }

  updateHUD() {
    this.hud.updateAmmo(this.clip, this.reserveAmmo, this.isReloading);
  }

  spawnTracer(targetPoint) {
    // Muzzle world position
    const muzzleWorld = new THREE.Vector3();
    this.muzzleFlash.getWorldPosition(muzzleWorld);

    const dir = targetPoint.clone().sub(muzzleWorld);
    const dist = dir.length();
    dir.normalize();

    // Low-poly luminous cylinder tracer line
    const geo = new THREE.CylinderGeometry(0.015, 0.015, Math.min(dist, 4.0), 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe680,
      transparent: true,
      opacity: 0.95
    });

    const tracer = new THREE.Mesh(geo, mat);
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    tracer.position.copy(muzzleWorld).add(dir.clone().multiplyScalar(2.0));

    this.scene.add(tracer);

    this.tracers.push({
      mesh: tracer,
      velocity: dir.multiplyScalar(160), // Tracer speed 160m/s
      currentDist: 0,
      maxDist: dist,
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

      // Reflect velocity along normal with random spray
      const vel = normal.clone().multiplyScalar(3.0)
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3,
          (Math.random() - 0.5) * 4
        ));

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
    // 1. Reload timer handling
    if (this.isReloading) {
      this.reloadTimer -= delta;
      // Weapon dip animation during reload
      this.recoilOffset.y = -0.15;
      if (this.reloadTimer <= 0) {
        this.completeReload();
      }
    }

    // 2. Weapon Bobbing
    if (isMoving) {
      const bobFreq = isSprinting ? 14 : 9;
      const bobAmp = isSprinting ? 0.025 : 0.012;
      this.bobTimer += delta * bobFreq;

      const bobX = Math.cos(this.bobTimer) * bobAmp;
      const bobY = Math.abs(Math.sin(this.bobTimer)) * bobAmp * 1.5;

      this.viewmodelGroup.position.x = this.basePos.x + this.recoilOffset.x + bobX;
      this.viewmodelGroup.position.y = this.basePos.y + this.recoilOffset.y - bobY;
      this.viewmodelGroup.position.z = this.basePos.z + this.recoilOffset.z;
    } else {
      // Idle breathing
      const idleY = Math.sin(performance.now() * 0.002) * 0.003;
      this.viewmodelGroup.position.x = this.basePos.x + this.recoilOffset.x;
      this.viewmodelGroup.position.y = this.basePos.y + this.recoilOffset.y + idleY;
      this.viewmodelGroup.position.z = this.basePos.z + this.recoilOffset.z;
    }

    // 3. Recoil Recovery (smooth lerp back to 0)
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 18);
    this.recoilRot.lerp(new THREE.Vector3(0, 0, 0), delta * 20);

    this.viewmodelGroup.rotation.x = this.baseRot.x + this.recoilRot.x;
    this.viewmodelGroup.rotation.y = this.baseRot.y + this.recoilRot.y;

    // 4. Update Bullet Tracers
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

    // 5. Update Impact Sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.mesh.position.addScaledVector(sp.velocity, delta);
      sp.velocity.y -= 9.8 * delta; // Gravity on sparks
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
