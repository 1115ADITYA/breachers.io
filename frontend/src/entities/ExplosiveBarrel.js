import * as THREE from 'three';
import { sounds } from '../audio/SoundEffects.js';

/**
 * ExplosiveBarrel.js
 * Interactive explosive barrel with hazard warning bands, pulsing strobe LED,
 * fuse sparks, procedural particles, camera shake, and physics synchronization.
 */
export class ExplosiveBarrel {
  /**
   * @param {string} barrelId
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {object} [physicsWorld]
   */
  constructor(barrelId, x, y, z, physicsWorld = null) {
    this.barrelId = barrelId;
    this.initialPosition = new THREE.Vector3(x, y, z);
    this.physicsWorld = physicsWorld;

    this.group = new THREE.Group();
    this.group.position.set(x, y + 0.55, z);
    this.group.userData = { isExplosiveBarrel: true, barrelId: this.barrelId, entity: this };

    this.isIgnited = false;
    this.isExploded = false;
    this.fuseTimeRemaining = 0;
    this.elapsedTime = 0;

    // Materials
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcca010, // Hazard amber yellow
      roughness: 0.45,
      metalness: 0.55
    });

    this.darkRimMat = new THREE.MeshStandardMaterial({
      color: 0x1f242d,
      roughness: 0.6,
      metalness: 0.8
    });

    this.glowingBandMat = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff3300,
      emissiveIntensity: 0.65,
      roughness: 0.3
    });

    this.beaconMat = new THREE.MeshBasicMaterial({
      color: 0xff6600
    });

    this.scorchedMat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.95,
      metalness: 0.1
    });

    this.buildMesh();

    // Register into physics world as dynamic prop if available
    this.rigidBody = null;
    if (this.physicsWorld && this.physicsWorld.enabled) {
      this.rigidBody = this.physicsWorld.createDynamicProp(this.group, 'barrel', 35.0);
    }

    // Particle system for ignition fuse sparks
    this.sparkParticles = [];
  }

  buildMesh() {
    // 1. Barrel main cylinder
    const bodyGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.1, 16);
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.bodyMesh.userData = { isExplosiveBarrel: true, barrelId: this.barrelId, entity: this };
    this.group.add(this.bodyMesh);

    // 2. Chime expansion rings
    const ringGeo = new THREE.TorusGeometry(0.385, 0.02, 6, 18);
    ringGeo.rotateX(Math.PI / 2);

    const ringTop = new THREE.Mesh(ringGeo, this.darkRimMat);
    ringTop.position.y = 0.32;
    this.group.add(ringTop);

    const ringBot = new THREE.Mesh(ringGeo, this.darkRimMat);
    ringBot.position.y = -0.32;
    this.group.add(ringBot);

    // 3. Middle Glowing Orange Hazard Band
    const bandGeo = new THREE.CylinderGeometry(0.385, 0.385, 0.22, 16);
    this.hazardBand = new THREE.Mesh(bandGeo, this.glowingBandMat);
    this.hazardBand.position.y = 0;
    this.hazardBand.userData = { isExplosiveBarrel: true, barrelId: this.barrelId, entity: this };
    this.group.add(this.hazardBand);

    // 4. Strobe Warning Light / LED Beacon on top
    const beaconBaseGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8);
    const beaconBase = new THREE.Mesh(beaconBaseGeo, this.darkRimMat);
    beaconBase.position.set(0, 0.57, 0);
    this.group.add(beaconBase);

    const beaconGeo = new THREE.SphereGeometry(0.035, 8, 8);
    this.beaconLight = new THREE.Mesh(beaconGeo, this.beaconMat);
    this.beaconLight.position.set(0, 0.60, 0);
    this.group.add(this.beaconLight);

    // Bounding Box for interaction and collision fallback
    this.colliderBox = new THREE.Box3(
      new THREE.Vector3(this.initialPosition.x - 0.4, this.initialPosition.y, this.initialPosition.z - 0.4),
      new THREE.Vector3(this.initialPosition.x + 0.4, this.initialPosition.y + 1.15, this.initialPosition.z + 0.4)
    );
  }

  /**
   * Ignite barrel fuse
   */
  ignite(fuseDurationSec = 0.6) {
    if (this.isIgnited || this.isExploded) return;
    this.isIgnited = true;
    this.fuseTimeRemaining = fuseDurationSec;
    sounds.playFuseSound();
  }

  /**
   * Detonate barrel visually
   * @param {THREE.Scene} scene
   * @param {THREE.Vector3} cameraPos
   * @param {Function} [cameraShakeCallback]
   */
  explode(scene, cameraPos = null, cameraShakeCallback = null) {
    if (this.isExploded) return;
    this.isExploded = true;
    this.isIgnited = false;

    const currentPos = this.group.position.clone();

    // Distance to camera for audio & shake
    let dist = 10;
    if (cameraPos) {
      dist = currentPos.distanceTo(cameraPos);
    }
    sounds.playExplosionSound(dist);

    if (cameraShakeCallback && dist < 35.0) {
      // Shake intensity falls off with distance
      const intensity = Math.max(0.1, 1.0 - (dist / 35.0));
      cameraShakeCallback(intensity * 1.5, 0.45);
    }

    // Visual Explosion: Fireball + Smoke Plume + Shockwave
    this.spawnExplosionVFX(scene, currentPos);

    // Physical impulse push in Rapier physics world
    if (this.physicsWorld && this.physicsWorld.enabled) {
      this.physicsWorld.applyExplosionImpulse(currentPos, 8.0, 350.0);
    }

    // Collapse and scorch barrel mesh
    this.bodyMesh.material = this.scorchedMat;
    this.hazardBand.visible = false;
    this.beaconLight.visible = false;
    this.group.scale.set(1.1, 0.25, 1.1);
    this.group.position.y = this.initialPosition.y + 0.14;

    if (this.rigidBody && this.physicsWorld && this.physicsWorld.world) {
      // Remove rigid body or set to static
      try {
        this.physicsWorld.world.removeRigidBody(this.rigidBody);
        this.rigidBody = null;
      } catch (e) {
        // ignore
      }
    }
  }

  spawnExplosionVFX(scene, pos) {
    // 1. Expanding Fireball Core
    const coreGeo = new THREE.SphereGeometry(1.2, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.95
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.copy(pos);
    scene.add(coreMesh);

    // 2. Outer Fireball Mesh
    const outerGeo = new THREE.SphereGeometry(2.0, 10, 10);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.8
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.position.copy(pos);
    scene.add(outerMesh);

    // 3. Shockwave Ring
    const ringGeo = new THREE.RingGeometry(0.3, 1.2, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(pos.x, pos.y - 0.45, pos.z);
    scene.add(ringMesh);

    // 4. Animate and clean up explosion meshes
    const startTime = performance.now();
    const duration = 550; // ms

    const animateVfx = () => {
      const now = performance.now();
      const progress = (now - startTime) / duration;

      if (progress < 1.0) {
        // Expand
        const scale = 1.0 + progress * 2.8;
        coreMesh.scale.setScalar(scale);
        outerMesh.scale.setScalar(scale * 1.3);
        ringMesh.scale.setScalar(1.0 + progress * 6.0);

        // Fade out
        coreMat.opacity = Math.max(0, 0.95 * (1.0 - progress));
        outerMat.opacity = Math.max(0, 0.8 * (1.0 - progress));
        ringMat.opacity = Math.max(0, 0.8 * (1.0 - progress));

        requestAnimationFrame(animateVfx);
      } else {
        scene.remove(coreMesh);
        scene.remove(outerMesh);
        scene.remove(ringMesh);
        coreGeo.dispose();
        coreMat.dispose();
        outerGeo.dispose();
        outerMat.dispose();
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    requestAnimationFrame(animateVfx);
  }

  update(delta) {
    this.elapsedTime += delta;

    if (this.isExploded) return;

    if (this.isIgnited) {
      this.fuseTimeRemaining -= delta;

      // Rapid strobe flashing during fuse
      const strobe = Math.sin(this.elapsedTime * 35) > 0;
      this.beaconMat.color.setHex(strobe ? 0xff0000 : 0xffaa00);
      this.glowingBandMat.emissiveIntensity = strobe ? 1.8 : 0.4;
    } else {
      // Subtle pulsing idle LED beacon
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 4.0);
      this.glowingBandMat.emissiveIntensity = 0.4 + 0.4 * pulse;
      this.beaconMat.color.setHex(pulse > 0.6 ? 0xff6600 : 0xaa3300);
    }
  }

  checkHit(ray, maxDist = 80) {
    if (this.isExploded) return null;
    const currentPos = this.group.position;
    this.colliderBox.min.set(currentPos.x - 0.45, currentPos.y - 0.6, currentPos.z - 0.45);
    this.colliderBox.max.set(currentPos.x + 0.45, currentPos.y + 0.6, currentPos.z + 0.45);
    const target = new THREE.Vector3();
    const hit = ray.intersectBox(this.colliderBox, target);
    if (hit) {
      const dist = ray.origin.distanceTo(hit);
      if (dist <= maxDist) {
        return { point: hit, distance: dist, barrel: this };
      }
    }
    return null;
  }

  reset() {
    this.isIgnited = false;
    this.isExploded = false;
    this.fuseTimeRemaining = 0;
    this.group.scale.set(1, 1, 1);
    this.group.position.copy(this.initialPosition).setY(this.initialPosition.y + 0.55);
    this.bodyMesh.material = this.bodyMat;
    this.hazardBand.visible = true;
    this.beaconLight.visible = true;
  }
}
