import * as THREE from 'three';

/**
 * RemotePlayer
 * Renders an animated low-poly 3D character for a remote multiplayer peer,
 * with overhead canvas nameplate, held weapon switching, muzzle flashes,
 * tracers, and death/respawn visual states.
 */
export class RemotePlayer {
  constructor(playerData, scene) {
    this.id = playerData.id;
    this.username = playerData.username || 'Operator';
    this.scene = scene;

    this.group = new THREE.Group();
    this.group.position.set(playerData.x || 0, playerData.y || 0, playerData.z || 0);
    this.group.rotation.y = playerData.yaw || 0;

    // Interpolation targets
    this.targetPos = new THREE.Vector3(playerData.x || 0, playerData.y || 0, playerData.z || 0);
    this.targetYaw = playerData.yaw || 0;
    this.targetPitch = playerData.pitch || 0;
    this.isMoving = playerData.isMoving || false;
    this.isSprinting = playerData.isSprinting || false;
    this.isDead = playerData.isDead || false;
    this.currentWeapon = playerData.weapon || 'ASSAULT';

    // Animation timer for limb swinging
    this.animTimer = 0;

    // Held weapon models
    this.heldWeapons = {};

    this.buildModel();
    this.buildNameplate();
    this.buildSpawnShield();

    this.scene.add(this.group);

    if (this.isDead) {
      this.setDead(true);
    }
  }

  buildModel() {
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, // Tactical Navy Blue
      roughness: 0.5,
      metalness: 0.3
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xe0ac69,
      roughness: 0.7,
      metalness: 0.0
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2
    });

    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      roughness: 0.1,
      metalness: 0.9
    });

    const weaponMat = new THREE.MeshStandardMaterial({
      color: 0x222a35,
      roughness: 0.4,
      metalness: 0.8
    });

    // 1. Torso & Tactical Vest
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.6, 0.3);
    this.torso = new THREE.Mesh(torsoGeo, armorMat);
    this.torso.position.y = 1.1;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // Front Chest Molle Plate Carrier & Pouches
    const plateGeo = new THREE.BoxGeometry(0.57, 0.46, 0.34);
    const plate = new THREE.Mesh(plateGeo, darkMat);
    plate.position.y = 1.12;
    this.group.add(plate);

    for (let i = -1; i <= 1; i++) {
      const pouchGeo = new THREE.BoxGeometry(0.11, 0.16, 0.06);
      const pouch = new THREE.Mesh(pouchGeo, darkMat);
      pouch.position.set(i * 0.14, 1.02, 0.19);
      this.group.add(pouch);
    }

    // 2. Head, Combat Helmet & Visor
    const headGeo = new THREE.BoxGeometry(0.28, 0.30, 0.28);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 1.58;
    this.head.castShadow = true;
    this.group.add(this.head);

    const helmetGeo = new THREE.BoxGeometry(0.32, 0.20, 0.32);
    const helmet = new THREE.Mesh(helmetGeo, armorMat);
    helmet.position.set(0, 1.66, 0);
    helmet.castShadow = true;
    this.group.add(helmet);

    const visorGeo = new THREE.BoxGeometry(0.28, 0.08, 0.06);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.58, 0.15);
    this.group.add(visor);

    // Comms Earcups
    const cupGeo = new THREE.BoxGeometry(0.05, 0.10, 0.08);
    const cupLeft = new THREE.Mesh(cupGeo, darkMat);
    cupLeft.position.set(-0.16, 1.60, 0);
    this.group.add(cupLeft);

    const cupRight = new THREE.Mesh(cupGeo, darkMat);
    cupRight.position.set(0.16, 1.60, 0);
    this.group.add(cupRight);

    // 3. Arms
    const armGeo = new THREE.BoxGeometry(0.15, 0.55, 0.15);
    this.leftArm = new THREE.Mesh(armGeo, darkMat);
    this.leftArm.position.set(-0.36, 1.1, 0);
    this.leftArm.castShadow = true;
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, darkMat);
    this.rightArm.position.set(0.36, 1.1, 0.1);
    this.rightArm.rotation.x = -Math.PI / 4;
    this.rightArm.castShadow = true;
    this.group.add(this.rightArm);

    // 4. Held Weapons: Assault, Pistol, Knife
    const arMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.45), weaponMat);
    arMesh.position.set(0.36, 1.05, 0.3);
    this.group.add(arMesh);
    this.heldWeapons.ASSAULT = arMesh;

    const pistolMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.22), weaponMat);
    pistolMesh.position.set(0.36, 1.05, 0.22);
    pistolMesh.visible = false;
    this.group.add(pistolMesh);
    this.heldWeapons.PISTOL = pistolMesh;

    const knifeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.25), weaponMat);
    knifeMesh.position.set(0.36, 1.05, 0.2);
    knifeMesh.visible = false;
    this.group.add(knifeMesh);
    this.heldWeapons.KNIFE = knifeMesh;

    // Remote Muzzle Flash
    const flashGeo = new THREE.OctahedronGeometry(0.06, 0);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });
    this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlash.position.set(0.36, 1.05, 0.55);
    this.muzzleFlash.visible = false;
    this.group.add(this.muzzleFlash);

    // 5. Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.75, 0.2);
    this.leftLeg = new THREE.Mesh(legGeo, darkMat);
    this.leftLeg.position.set(-0.16, 0.38, 0);
    this.leftLeg.castShadow = true;
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, darkMat);
    this.rightLeg.position.set(0.16, 0.38, 0);
    this.rightLeg.castShadow = true;
    this.group.add(this.rightLeg);

    // Tactical Polymer Knee Pads
    for (let side of [-0.16, 0.16]) {
      const kneeGeo = new THREE.BoxGeometry(0.19, 0.14, 0.06);
      const knee = new THREE.Mesh(kneeGeo, armorMat);
      knee.position.set(side, 0.40, 0.11);
      this.group.add(knee);
    }
  }

  buildNameplate() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(12, 10, 232, 44, 8);
    ctx.fill();

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.username, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });

    this.nameplate = new THREE.Sprite(spriteMat);
    this.nameplate.position.set(0, 2.05, 0);
    this.nameplate.scale.set(1.6, 0.4, 1.0);

    this.group.add(this.nameplate);
  }

  buildSpawnShield() {
    const geo = new THREE.CylinderGeometry(0.7, 0.7, 1.9, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    this.spawnShield = new THREE.Mesh(geo, mat);
    this.spawnShield.position.y = 0.95;
    this.spawnShield.visible = false;
    this.group.add(this.spawnShield);
  }

  switchHeldWeapon(weaponType) {
    if (!weaponType) return;
    this.currentWeapon = weaponType;
    Object.keys(this.heldWeapons).forEach(k => {
      this.heldWeapons[k].visible = (k === weaponType);
    });
  }

  triggerShotEffect(hitPoint) {
    if (this.currentWeapon !== 'KNIFE') {
      this.muzzleFlash.visible = true;
      setTimeout(() => {
        this.muzzleFlash.visible = false;
      }, 45);

      if (hitPoint) {
        // Spawn remote tracer to hit point
        const origin = new THREE.Vector3();
        this.muzzleFlash.getWorldPosition(origin);
        const target = new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z);

        const dir = target.clone().sub(origin);
        const dist = dir.length();
        dir.normalize();

        const geo = new THREE.CylinderGeometry(0.015, 0.015, Math.min(dist, 4.0), 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffe680, transparent: true, opacity: 0.95 });
        const tracer = new THREE.Mesh(geo, mat);
        tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        tracer.position.copy(origin).add(dir.clone().multiplyScalar(2.0));

        this.scene.add(tracer);

        let life = 0.25;
        const tickTracer = () => {
          tracer.position.addScaledVector(dir, 160 * 0.016);
          life -= 0.016;
          if (life <= 0) {
            this.scene.remove(tracer);
            tracer.geometry.dispose();
            tracer.material.dispose();
          } else {
            requestAnimationFrame(tickTracer);
          }
        };
        requestAnimationFrame(tickTracer);
      }
    }
  }

  setDead(isDead) {
    this.isDead = isDead;
    if (isDead) {
      this.nameplate.visible = false;
      this.group.rotation.x = Math.PI / 2; // Collapse to ground
      this.group.position.y = 0.2;
    } else {
      this.nameplate.visible = true;
      this.group.rotation.x = 0;
    }
  }

  setTeam(team) {
    this.team = team;
    let color = 0x1d4ed8;
    if (team === 'RED') color = 0xd92030;
    else if (team === 'BLUE') color = 0x0077ff;
    else if (team === 'FFA') color = 0xe67e00;

    if (this.torso && this.torso.material) {
      this.torso.material.color.setHex(color);
    }
  }

  setSpawnProtection(durationMs = 5000, active = true) {
    if (this.shieldTimeout) clearTimeout(this.shieldTimeout);
    this.spawnShield.visible = active;
    if (active && durationMs > 0) {
      this.shieldTimeout = setTimeout(() => {
        this.spawnShield.visible = false;
      }, durationMs);
    }
  }

  respawn(x, y, z, yaw) {
    this.targetPos.set(x, y, z);
    this.group.position.set(x, y, z);
    this.targetYaw = yaw;
    this.group.rotation.set(0, yaw, 0);
    this.setDead(false);

    // Show temporary 5-second spawn shield (Mandatory Requirement B)
    this.setSpawnProtection(5000, true);
  }

  updateState(moveData) {
    if (moveData.x !== undefined) {
      this.targetPos.set(moveData.x, moveData.y, moveData.z);
    }
    if (moveData.yaw !== undefined) {
      this.targetYaw = moveData.yaw;
    }
    if (moveData.pitch !== undefined) {
      this.targetPitch = moveData.pitch;
    }
    if (moveData.isMoving !== undefined) {
      this.isMoving = moveData.isMoving;
    }
    if (moveData.isSprinting !== undefined) {
      this.isSprinting = moveData.isSprinting;
    }
    if (moveData.weapon !== undefined && moveData.weapon !== this.currentWeapon) {
      this.switchHeldWeapon(moveData.weapon);
    }
    if (moveData.isDead !== undefined && moveData.isDead !== this.isDead) {
      this.setDead(moveData.isDead);
    }
  }

  update(delta) {
    if (this.isDead) return;

    // 1. Smooth Position Interpolation
    const lerpSpeed = 16.0;
    this.group.position.lerp(this.targetPos, Math.min(1.0, delta * lerpSpeed));

    // 2. Smooth Yaw Rotation
    const diff = (this.targetYaw - this.group.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    this.group.rotation.y += diff * Math.min(1.0, delta * lerpSpeed);

    // 3. Head Pitch
    if (this.head) {
      this.head.rotation.x = this.targetPitch * 0.8;
    }

    // 4. Limb swing animation
    if (this.isMoving) {
      const speed = this.isSprinting ? 16 : 10;
      this.animTimer += delta * speed;
      const swing = Math.sin(this.animTimer) * 0.45;

      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.6;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 12);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 12);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 12);
    }

    // Spawn shield pulse
    if (this.spawnShield.visible) {
      this.spawnShield.rotation.y += delta * 2.0;
    }
  }

  destroy() {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }

    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }
}
