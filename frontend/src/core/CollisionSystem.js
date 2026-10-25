import * as THREE from 'three';

/**
 * Robust Axis-Aligned Bounding Box (AABB) Collision System for FPS gameplay.
 * Handles swept horizontal sliding, vertical ground detection, step-ups, and raycasting.
 */
export class CollisionSystem {
  constructor() {
    this.colliders = []; // Array of { box: THREE.Box3, type: string, mesh: THREE.Mesh }
  }

  /**
   * Register a collection of colliders
   * @param {Array<{box: THREE.Box3, type: string, mesh?: THREE.Mesh}>} colliders
   */
  setColliders(colliders) {
    this.colliders = colliders;
  }

  addCollider(box, type = 'solid', mesh = null) {
    this.colliders.push({ box, type, mesh });
  }

  clear() {
    this.colliders = [];
  }

  /**
   * Resolves player movement and collision against all static colliders.
   * Uses capsule-approximated AABB with horizontal sliding and vertical support.
   * 
   * @param {THREE.Vector3} currentPos - Current bottom-center position of player
   * @param {THREE.Vector3} desiredMove - Desired delta movement Vector3(dx, dy, dz)
   * @param {number} radius - Player collision radius
   * @param {number} height - Player collision height
   * @param {number} stepHeight - Maximum step-up height (e.g., 0.45m)
   * @returns {{
   *   position: THREE.Vector3,
   *   velocityCorrection: THREE.Vector3,
   *   isGrounded: boolean,
   *   hitHead: boolean
   * }}
   */
  movePlayer(currentPos, desiredMove, radius = 0.45, height = 1.8, stepHeight = 0.45) {
    const finalPos = currentPos.clone();
    let isGrounded = false;
    let hitHead = false;

    // Helper: test if player at pos overlaps any box
    const testOverlap = (pos, expand = 0) => {
      const pBox = new THREE.Box3(
        new THREE.Vector3(pos.x - radius - expand, pos.y, pos.z - radius - expand),
        new THREE.Vector3(pos.x + radius + expand, pos.y + height, pos.z + radius + expand)
      );

      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        if (pBox.intersectsBox(c.box)) {
          return c;
        }
      }
      return null;
    };

    // 1. HORIZONTAL MOVEMENT WITH SLIDING & STEP-UP
    const horizontalMove = new THREE.Vector3(desiredMove.x, 0, desiredMove.z);
    if (horizontalMove.lengthSq() > 0.000001) {
      // Test X axis movement
      let targetX = finalPos.x + horizontalMove.x;
      let testPos = new THREE.Vector3(targetX, finalPos.y, finalPos.z);
      let hit = testOverlap(testPos);

      // Try stepping up if obstructed
      if (hit && stepHeight > 0) {
        const steppedPos = new THREE.Vector3(targetX, finalPos.y + stepHeight, finalPos.z);
        if (!testOverlap(steppedPos)) {
          // Find exact step height via downward check
          let groundBelow = this.getGroundHeight(steppedPos, radius, stepHeight + 0.1);
          if (groundBelow !== null && groundBelow <= finalPos.y + stepHeight) {
            finalPos.y = groundBelow;
            hit = null;
          }
        }
      }

      if (!hit) {
        finalPos.x = targetX;
      }

      // Test Z axis movement
      let targetZ = finalPos.z + horizontalMove.z;
      testPos = new THREE.Vector3(finalPos.x, finalPos.y, targetZ);
      hit = testOverlap(testPos);

      if (hit && stepHeight > 0) {
        const steppedPos = new THREE.Vector3(finalPos.x, finalPos.y + stepHeight, targetZ);
        if (!testOverlap(steppedPos)) {
          let groundBelow = this.getGroundHeight(steppedPos, radius, stepHeight + 0.1);
          if (groundBelow !== null && groundBelow <= finalPos.y + stepHeight) {
            finalPos.y = groundBelow;
            hit = null;
          }
        }
      }

      if (!hit) {
        finalPos.z = targetZ;
      }
    }

    // 2. VERTICAL MOVEMENT (GRAVITY / JUMP)
    if (desiredMove.y > 0) {
      // Moving upward (jumping)
      const targetY = finalPos.y + desiredMove.y;
      const testPos = new THREE.Vector3(finalPos.x, targetY, finalPos.z);
      const hit = testOverlap(testPos);
      if (hit) {
        // Hit ceiling - clamp position to bottom of colliding box
        finalPos.y = hit.box.min.y - height - 0.001;
        hitHead = true;
      } else {
        finalPos.y = targetY;
      }
    } else if (desiredMove.y <= 0) {
      // Falling or standing
      const targetY = finalPos.y + desiredMove.y;
      const testPos = new THREE.Vector3(finalPos.x, targetY, finalPos.z);
      const hit = testOverlap(testPos);

      if (hit) {
        // Landed on top of an object/ground
        finalPos.y = hit.box.max.y;
        isGrounded = true;
      } else {
        // Check small probe below feet to prevent micro-bounce when running on ground
        const probeDist = Math.max(0.1, -desiredMove.y + 0.05);
        const groundHeight = this.getGroundHeight(finalPos, radius, probeDist);
        if (groundHeight !== null && finalPos.y - groundHeight <= probeDist) {
          finalPos.y = groundHeight;
          isGrounded = true;
        } else {
          finalPos.y = targetY;
        }
      }
    }

    return {
      position: finalPos,
      isGrounded,
      hitHead
    };
  }

  /**
   * Find highest ground height directly under a cylinder footprint
   */
  getGroundHeight(pos, radius, maxDist = 2.0) {
    const footX = pos.x;
    const footZ = pos.z;
    const footY = pos.y;
    let highestGround = null;

    const probeBox = new THREE.Box3(
      new THREE.Vector3(footX - radius * 0.7, footY - maxDist, footZ - radius * 0.7),
      new THREE.Vector3(footX + radius * 0.7, footY + 0.1, footZ + radius * 0.7)
    );

    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (probeBox.intersectsBox(c.box)) {
        // Box is underneath or touching
        if (c.box.max.y <= footY + 0.15) {
          if (highestGround === null || c.box.max.y > highestGround) {
            highestGround = c.box.max.y;
          }
        }
      }
    }

    return highestGround;
  }

  /**
   * Fast raycast against all static colliders for weapon hits
   * @param {THREE.Ray} ray
   * @param {number} maxDistance
   * @returns {{ point: THREE.Vector3, distance: number, normal: THREE.Vector3, collider: Object } | null}
   */
  raycast(ray, maxDistance = 200) {
    let closestHit = null;
    let minDistance = maxDistance;

    const hitPoint = new THREE.Vector3();

    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const intersect = ray.intersectBox(c.box, hitPoint);
      if (intersect) {
        const dist = ray.origin.distanceTo(hitPoint);
        if (dist < minDistance) {
          minDistance = dist;

          // Estimate surface normal based on box faces
          const normal = new THREE.Vector3();
          const eps = 0.05;
          if (Math.abs(hitPoint.x - c.box.min.x) < eps) normal.set(-1, 0, 0);
          else if (Math.abs(hitPoint.x - c.box.max.x) < eps) normal.set(1, 0, 0);
          else if (Math.abs(hitPoint.y - c.box.min.y) < eps) normal.set(0, -1, 0);
          else if (Math.abs(hitPoint.y - c.box.max.y) < eps) normal.set(0, 1, 0);
          else if (Math.abs(hitPoint.z - c.box.min.z) < eps) normal.set(0, 0, -1);
          else if (Math.abs(hitPoint.z - c.box.max.z) < eps) normal.set(0, 0, 1);
          else normal.set(0, 1, 0);

          closestHit = {
            point: hitPoint.clone(),
            distance: dist,
            normal,
            collider: c
          };
        }
      }
    }

    return closestHit;
  }
}
