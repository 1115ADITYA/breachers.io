import * as THREE from 'three';
import { sounds } from '../audio/SoundEffects.js';

/**
 * LootManager.js
 * Manages 3D Ammo Loot Crates dropped on player eliminations.
 * Features floating rotating ammo magazines, vertical light shafts, bobbing animation,
 * proximity alerts, and single-collector pickup resolution.
 */
export class LootManager {
  /**
   * @param {THREE.Scene} scene
   * @param {object} hud
   */
  constructor(scene, hud) {
    this.scene = scene;
    this.hud = hud;
    this.lootDrops = new Map(); // lootId -> { group, baseY, ammoType, amount, iconMesh, beaconMesh }
    this.nearbyAlertShown = new Set(); // lootId -> boolean
    this.currentTargetLoot = null;

    // Materials
    this.crateMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark tactical slate
      roughness: 0.6,
      metalness: 0.4
    });

    this.accentMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Glowing tactical cyan
      emissive: 0x0891b2,
      emissiveIntensity: 0.7,
      roughness: 0.3
    });

    this.ammoMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber gold brass
      roughness: 0.3,
      metalness: 0.9
    });

    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
  }

  /**
   * Spawn a 3D loot drop at coordinates
   */
  spawnLoot(lootId, x, y, z, ammoType = 'ASSAULT', amount = 30) {
    if (this.lootDrops.has(lootId)) return;

    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { isLootDrop: true, lootId, ammoType, amount };

    // 1. Military Ammo Crate Body
    const crateGeo = new THREE.BoxGeometry(0.55, 0.35, 0.35);
    const crateMesh = new THREE.Mesh(crateGeo, this.crateMat);
    crateMesh.castShadow = true;
    crateMesh.receiveShadow = true;
    crateMesh.position.y = 0.175;
    group.add(crateMesh);

    // Cyan glowing rim / latch
    const latchGeo = new THREE.BoxGeometry(0.57, 0.06, 0.37);
    const latchMesh = new THREE.Mesh(latchGeo, this.accentMat);
    latchMesh.position.y = 0.22;
    group.add(latchMesh);

    // 2. Floating Rotating Ammo Icon / Magazine
    const iconGroup = new THREE.Group();
    iconGroup.position.set(0, 0.55, 0);

    const magGeo = new THREE.BoxGeometry(0.12, 0.22, 0.06);
    const magMesh = new THREE.Mesh(magGeo, this.ammoMat);
    iconGroup.add(magMesh);

    group.add(iconGroup);

    // 3. Vertical Cyan Light Shaft / Beacon
    const beamGeo = new THREE.CylinderGeometry(0.04, 0.25, 2.5, 8);
    const beamMesh = new THREE.Mesh(beamGeo, this.beamMat);
    beamMesh.position.y = 1.35;
    group.add(beamMesh);

    this.scene.add(group);

    this.lootDrops.set(lootId, {
      lootId,
      group,
      baseY: y,
      ammoType,
      amount,
      iconGroup,
      beamMesh,
      x,
      y,
      z
    });
  }

  /**
   * Update floating animations and proximity checks
   * @param {number} delta
   * @param {number} time
   * @param {THREE.Vector3} playerPos
   * @returns {object|null} targetLoot within pickup range
   */
  update(delta, time, playerPos) {
    let closestCandidate = null;
    let closestDist = 2.5; // Max interaction distance

    for (const [lootId, item] of this.lootDrops.entries()) {
      // 1. Hover bobbing animation
      const bob = Math.sin(time * 3.2 + item.x) * 0.06;
      item.group.position.y = item.baseY + bob;

      // 2. Icon rotation
      item.iconGroup.rotation.y += delta * 2.8;

      // 3. Proximity distance check
      if (playerPos) {
        const dist = playerPos.distanceTo(item.group.position);

        // Nearby alert (< 8m)
        if (dist < 8.0 && !this.nearbyAlertShown.has(lootId)) {
          this.nearbyAlertShown.add(lootId);
          if (this.hud && this.hud.showNearbyAmmoAlert) {
            this.hud.showNearbyAmmoAlert();
          }
        }

        // Interaction range candidate (< 2.5m)
        if (dist < closestDist) {
          closestDist = dist;
          closestCandidate = item;
        }
      }
    }

    this.currentTargetLoot = closestCandidate;
    return closestCandidate;
  }

  /**
   * Collect loot drop
   */
  collectLoot(lootId, isLocalPlayer = false) {
    const item = this.lootDrops.get(lootId);
    if (!item) return;

    if (isLocalPlayer) {
      sounds.playPickupSound();
      if (this.hud && this.hud.showAmmoCollected) {
        this.hud.showAmmoCollected(item.amount, item.ammoType);
      }
    }

    this.removeLootMesh(item);
    this.lootDrops.delete(lootId);
    this.nearbyAlertShown.delete(lootId);

    if (this.currentTargetLoot && this.currentTargetLoot.lootId === lootId) {
      this.currentTargetLoot = null;
    }
  }

  /**
   * Expire loot drop
   */
  expireLoot(lootId) {
    const item = this.lootDrops.get(lootId);
    if (!item) return;

    this.removeLootMesh(item);
    this.lootDrops.delete(lootId);
    this.nearbyAlertShown.delete(lootId);

    if (this.currentTargetLoot && this.currentTargetLoot.lootId === lootId) {
      this.currentTargetLoot = null;
    }
  }

  removeLootMesh(item) {
    this.scene.remove(item.group);
  }

  clear() {
    for (const item of this.lootDrops.values()) {
      this.scene.remove(item.group);
    }
    this.lootDrops.clear();
    this.nearbyAlertShown.clear();
    this.currentTargetLoot = null;
  }
}
