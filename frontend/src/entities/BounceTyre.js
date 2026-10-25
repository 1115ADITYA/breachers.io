import * as THREE from 'three';
import { sounds } from '../audio/SoundEffects.js';

/**
 * BounceTyre.js
 * Interactive rubber tyre stack that acts as a bounce boost launchpad.
 * Features textured hazard grip bands, springy physics reaction, and particle puff feedback.
 */
export class BounceTyre {
  /**
   * @param {string} tyreId
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} [count=3]
   */
  constructor(tyreId, x, y, z, count = 3) {
    this.tyreId = tyreId;
    this.x = x;
    this.y = y;
    this.z = z;
    this.count = count;
    this.radius = 0.65;
    this.height = count * 0.42;

    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.group.userData = {
      isBounceTyre: true,
      tyreId: this.tyreId,
      bounceForce: 15.0,
      topY: y + this.height,
      radius: this.radius,
      entity: this
    };

    // Materials
    this.rubberMat = new THREE.MeshStandardMaterial({
      color: 0x15181c,
      roughness: 0.85,
      metalness: 0.1
    });

    this.hazardStripeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber gold hazard
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      roughness: 0.4
    });

    this.buildMesh();

    // Axis-aligned bounding box for baseline collision
    this.colliderBox = new THREE.Box3(
      new THREE.Vector3(x - this.radius, y, z - this.radius),
      new THREE.Vector3(x + this.radius, y + this.height, z + this.radius)
    );

    this.lastBounceTime = 0;
  }

  /**
   * Check if player feet landed or stepped on the tyre stack
   * @param {THREE.Vector3} playerPos
   * @param {number} playerVelY
   * @returns {boolean}
   */
  checkPlayerBounce(playerPos, playerVelY) {
    const now = performance.now();
    if (this.lastBounceTime && now - this.lastBounceTime < 350) {
      return false; // Prevent oscillation exploit
    }
    const dx = playerPos.x - this.x;
    const dz = playerPos.z - this.z;
    const distSq = dx * dx + dz * dz;
    const topY = this.y + this.height;

    // Check if player's feet are within tyre radius and near top surface
    if (distSq <= (this.radius + 0.35) * (this.radius + 0.35)) {
      if (playerPos.y >= topY - 0.45 && playerPos.y <= topY + 0.95 && playerVelY <= 2.0) {
        this.lastBounceTime = now;
        return true;
      }
    }
    return false;
  }

  buildMesh() {
    for (let i = 0; i < this.count; i++) {
      const tireGeo = new THREE.TorusGeometry(0.52, 0.22, 10, 20);
      tireGeo.rotateX(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, this.rubberMat);
      tire.position.y = 0.22 + i * 0.42;
      tire.castShadow = true;
      tire.receiveShadow = true;
      tire.userData = { isBounceTyre: true, tyreId: this.tyreId, entity: this };
      this.group.add(tire);
    }

    // Top Tyre: Accent Grip Stripe Ring
    const stripeGeo = new THREE.TorusGeometry(0.53, 0.04, 8, 20);
    stripeGeo.rotateX(Math.PI / 2);
    const stripe = new THREE.Mesh(stripeGeo, this.hazardStripeMat);
    stripe.position.y = 0.22 + (this.count - 1) * 0.42 + 0.12;
    this.group.add(stripe);
  }

  /**
   * Trigger bounce effect when player lands/steps on tyre
   * @param {THREE.Scene} scene
   */
  triggerBounce(scene) {
    sounds.playBounceSound();

    // Visual squash/spring bounce animation on tyre group
    const initialScaleY = 1.0;
    this.group.scale.set(1.15, 0.75, 1.15); // Compress on impact

    const startTime = performance.now();
    const duration = 300; // ms

    const animateSpring = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1.0) {
        // Elastic rebound
        const rebound = Math.sin(progress * Math.PI) * 0.35;
        this.group.scale.y = 0.75 + progress * 0.25 + rebound;
        this.group.scale.x = 1.15 - progress * 0.15;
        this.group.scale.z = 1.15 - progress * 0.15;
        requestAnimationFrame(animateSpring);
      } else {
        this.group.scale.set(1, 1, 1);
      }
    };
    requestAnimationFrame(animateSpring);

    // Spawn puff ring particles at tyre rim
    this.spawnPuffParticles(scene);
  }

  spawnPuffParticles(scene) {
    const puffGroup = new THREE.Group();
    puffGroup.position.set(this.x, this.y + this.height - 0.1, this.z);
    scene.add(puffGroup);

    const particleCount = 10;
    const particles = [];
    const mat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.75
    });

    for (let i = 0; i < particleCount; i++) {
      const geo = new THREE.SphereGeometry(0.08, 6, 6);
      const mesh = new THREE.Mesh(geo, mat);
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 1.8 + Math.random() * 0.8;
      mesh.userData = {
        vx: Math.cos(angle) * speed,
        vy: 0.6 + Math.random() * 0.6,
        vz: Math.sin(angle) * speed
      };
      mesh.position.set(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5);
      puffGroup.add(mesh);
      particles.push(mesh);
    }

    const start = performance.now();
    const duration = 350;

    const animatePuff = () => {
      const now = performance.now();
      const p = (now - start) / duration;
      if (p < 1.0) {
        particles.forEach(m => {
          m.position.x += m.userData.vx * 0.016;
          m.position.y += m.userData.vy * 0.016;
          m.position.z += m.userData.vz * 0.016;
          m.scale.setScalar(1.0 + p * 1.5);
        });
        mat.opacity = 0.75 * (1.0 - p);
        requestAnimationFrame(animatePuff);
      } else {
        scene.remove(puffGroup);
        mat.dispose();
      }
    };
    requestAnimationFrame(animatePuff);
  }
}
