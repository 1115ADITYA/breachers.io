import * as THREE from 'three';

/**
 * DummyTarget
 * Low-poly humanoid player dummy model for testing shooting, hit detection, and damage.
 */
export class DummyTarget {
  constructor(x, y, z, rotationY = 0, team = 'target') {
    this.initialPos = new THREE.Vector3(x, y, z);
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.group.rotation.y = rotationY;

    this.maxHealth = 100;
    this.health = 100;
    this.isDead = false;
    this.respawnTimer = 0;

    this.hitboxes = []; // { box: THREE.Box3, part: 'head'|'torso'|'limbs', damageMult: number }
    this.materials = this.initMaterials(team);
    this.buildModel();
  }

  initMaterials(team) {
    const mainColor = team === 'red' ? 0xff3344 : (team === 'blue' ? 0x0088ff : 0xe67e22);
    return {
      body: new THREE.MeshStandardMaterial({
        color: mainColor,
        roughness: 0.6,
        metalness: 0.2
      }),
      head: new THREE.MeshStandardMaterial({
        color: 0xf5d0b5,
        roughness: 0.7,
        metalness: 0.0
      }),
      visor: new THREE.MeshStandardMaterial({
        color: 0x111622,
        roughness: 0.1,
        metalness: 0.9
      }),
      vest: new THREE.MeshStandardMaterial({
        color: 0x222a35,
        roughness: 0.8,
        metalness: 0.1
      }),
      limbs: new THREE.MeshStandardMaterial({
        color: 0x1a212d,
        roughness: 0.7,
        metalness: 0.1
      })
    };
  }

  buildModel() {
    // 1. Torso & Tactical Vest (Y: 0.8 to 1.4)
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.6, 0.3);
    this.torso = new THREE.Mesh(torsoGeo, this.materials.vest);
    this.torso.position.y = 1.1;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // 2. Head & Visor (Y: 1.4 to 1.75)
    const headGeo = new THREE.BoxGeometry(0.3, 0.32, 0.3);
    this.head = new THREE.Mesh(headGeo, this.materials.head);
    this.head.position.y = 1.58;
    this.head.castShadow = true;
    this.group.add(this.head);

    const visorGeo = new THREE.BoxGeometry(0.24, 0.1, 0.08);
    const visor = new THREE.Mesh(visorGeo, this.materials.visor);
    visor.position.set(0, 1.6, 0.15);
    this.group.add(visor);

    // 3. Arms
    const armGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);
    this.leftArm = new THREE.Mesh(armGeo, this.materials.limbs);
    this.leftArm.position.set(-0.38, 1.1, 0);
    this.leftArm.castShadow = true;
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, this.materials.limbs);
    this.rightArm.position.set(0.38, 1.1, 0);
    this.rightArm.castShadow = true;
    this.group.add(this.rightArm);

    // 4. Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.22);
    this.leftLeg = new THREE.Mesh(legGeo, this.materials.limbs);
    this.leftLeg.position.set(-0.16, 0.4, 0);
    this.leftLeg.castShadow = true;
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, this.materials.limbs);
    this.rightLeg.position.set(0.16, 0.4, 0);
    this.rightLeg.castShadow = true;
    this.group.add(this.rightLeg);

    // 5. Overhead 3D Health Bar
    const hbBgGeo = new THREE.PlaneGeometry(0.8, 0.1);
    const hbBgMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
    this.healthBarBg = new THREE.Mesh(hbBgGeo, hbBgMat);
    this.healthBarBg.position.set(0, 1.95, 0);
    this.group.add(this.healthBarBg);

    const hbFillGeo = new THREE.PlaneGeometry(0.78, 0.08);
    this.hbFillMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide });
    this.healthBarFill = new THREE.Mesh(hbFillGeo, this.hbFillMat);
    this.healthBarFill.position.set(0, 1.95, 0.005);
    this.group.add(this.healthBarFill);
  }

  /**
   * Update world-space hitboxes
   */
  updateHitboxes() {
    if (this.isDead) {
      this.hitboxes = [];
      return;
    }

    const pos = this.group.position;
    // Head hitbox (Critical 2x)
    const headBox = new THREE.Box3(
      new THREE.Vector3(pos.x - 0.25, pos.y + 1.4, pos.z - 0.25),
      new THREE.Vector3(pos.x + 0.25, pos.y + 1.8, pos.z + 0.25)
    );

    // Body hitbox (Torso 1.0x)
    const bodyBox = new THREE.Box3(
      new THREE.Vector3(pos.x - 0.45, pos.y + 0.75, pos.z - 0.3),
      new THREE.Vector3(pos.x + 0.45, pos.y + 1.4, pos.z + 0.3)
    );

    // Legs hitbox (0.75x)
    const legsBox = new THREE.Box3(
      new THREE.Vector3(pos.x - 0.35, pos.y, pos.z - 0.3),
      new THREE.Vector3(pos.x + 0.35, pos.y + 0.75, pos.z + 0.3)
    );

    this.hitboxes = [
      { box: headBox, part: 'head', damageMult: 2.0 },
      { box: bodyBox, part: 'torso', damageMult: 1.0 },
      { box: legsBox, part: 'limbs', damageMult: 0.75 }
    ];
  }

  /**
   * Test incoming bullet ray against dummy hitboxes
   * @param {THREE.Ray} ray
   * @param {number} baseDamage
   * @returns {{ hit: boolean, point?: THREE.Vector3, isHeadshot?: boolean, damage?: number } | null}
   */
  checkHit(ray, baseDamage = 25) {
    if (this.isDead) return null;

    this.updateHitboxes();

    let closestHit = null;
    let minDistance = Infinity;
    const hitPoint = new THREE.Vector3();

    for (const hb of this.hitboxes) {
      const intersect = ray.intersectBox(hb.box, hitPoint);
      if (intersect) {
        const dist = ray.origin.distanceTo(hitPoint);
        if (dist < minDistance) {
          minDistance = dist;
          closestHit = {
            point: hitPoint.clone(),
            isHeadshot: hb.part === 'head',
            damage: Math.round(baseDamage * hb.damageMult)
          };
        }
      }
    }

    if (closestHit) {
      this.takeDamage(closestHit.damage);
      return closestHit;
    }

    return null;
  }

  takeDamage(amount) {
    if (this.isDead) return;

    this.health = Math.max(0, this.health - amount);
    this.updateHealthBar();

    // Damage flash animation
    this.flashDamage();

    if (this.health <= 0) {
      this.die();
    }
  }

  flashDamage() {
    const originalColor = this.torso.material.color.getHex();
    this.torso.material.color.setHex(0xffffff);
    this.head.material.color.setHex(0xff3333);

    // Slight knockback wobble
    this.group.rotation.z = (Math.random() - 0.5) * 0.2;

    setTimeout(() => {
      this.torso.material.color.setHex(originalColor);
      this.head.material.color.setHex(0xf5d0b5);
      this.group.rotation.z = 0;
    }, 120);
  }

  updateHealthBar() {
    const ratio = this.health / this.maxHealth;
    this.healthBarFill.scale.x = Math.max(0.001, ratio);
    this.healthBarFill.position.x = -(0.78 * (1 - ratio)) / 2;

    if (ratio > 0.5) {
      this.hbFillMat.color.setHex(0x00ff88);
    } else if (ratio > 0.25) {
      this.hbFillMat.color.setHex(0xffaa00);
    } else {
      this.hbFillMat.color.setHex(0xff3344);
    }
  }

  die() {
    this.isDead = true;
    this.respawnTimer = 4.0; // Respawn after 4 seconds
    this.group.visible = false;
  }

  respawn() {
    this.isDead = false;
    this.health = this.maxHealth;
    this.updateHealthBar();
    this.group.position.copy(this.initialPos);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
  }

  update(delta, cameraPosition) {
    // Billboard health bar towards camera
    if (this.group.visible && cameraPosition) {
      this.healthBarBg.lookAt(cameraPosition.x, 1.95, cameraPosition.z);
      this.healthBarFill.lookAt(cameraPosition.x, 1.95, cameraPosition.z);
    }

    if (this.isDead) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
    }
  }
}
