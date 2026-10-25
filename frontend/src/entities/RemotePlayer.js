import * as THREE from 'three';

/**
 * RemotePlayer
 * Renders an animated low-poly 3D character for a remote multiplayer peer,
 * with overhead canvas nameplate and smooth position/rotation interpolation.
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

    // Animation timer for limb swinging
    this.animTimer = 0;

    this.buildModel();
    this.buildNameplate();

    this.scene.add(this.group);
  }

  buildModel() {
    // Distinct Tactical Materials for Remote Players
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

    // 1. Torso & Tactical Vest (Y: 0.8 to 1.4)
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.6, 0.3);
    this.torso = new THREE.Mesh(torsoGeo, armorMat);
    this.torso.position.y = 1.1;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // 2. Head & Visor (Y: 1.4 to 1.75)
    const headGeo = new THREE.BoxGeometry(0.3, 0.32, 0.3);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 1.58;
    this.head.castShadow = true;
    this.group.add(this.head);

    const visorGeo = new THREE.BoxGeometry(0.24, 0.09, 0.08);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.6, 0.15);
    this.group.add(visor);

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

    // 4. Weapon model in right hand
    const gunGeo = new THREE.BoxGeometry(0.06, 0.1, 0.4);
    const gun = new THREE.Mesh(gunGeo, weaponMat);
    gun.position.set(0.36, 1.05, 0.3);
    this.group.add(gun);

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
  }

  buildNameplate() {
    // Generate high-resolution 2D Canvas for username label
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(12, 10, 232, 44, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Text
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
  }

  update(delta) {
    // 1. Smooth Position Interpolation (Lerp)
    const lerpSpeed = 16.0;
    this.group.position.lerp(this.targetPos, Math.min(1.0, delta * lerpSpeed));

    // 2. Smooth Yaw Rotation (handling angular wrap-around)
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
      // Return limbs to neutral
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 12);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 12);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 12);
    }
  }

  destroy() {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }

    // Recursive cleanup of geometries and materials
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }
}
