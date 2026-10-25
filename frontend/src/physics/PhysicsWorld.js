import * as THREE from 'three';

/**
 * PhysicsWorld
 * Integrates @dimforge/rapier3d-compat WebAssembly physics engine with Three.js.
 * Provides fixed timestep simulation, capsule kinematic character controller with
 * autostep and ground snapping, static map colliders, interactive dynamic props
 * (crates, barrels), bullet impulses, and development debug wireframe rendering.
 */
export class PhysicsWorld {
  constructor() {
    this.RAPIER = null;
    this.world = null;
    this.characterController = null;
    this.playerBody = null;
    this.playerCollider = null;

    this.isReady = false;
    this.initError = null;

    // Simulation configuration
    this.fixedTimeStep = 1 / 60; // 60 Hz fixed timestep
    this.accumulator = 0;
    this.gravity = -28.0;

    // Player capsule specs (1.8m total height, 0.45m radius)
    this.playerRadius = 0.45;
    this.playerHalfHeight = 0.45; // total height = 2*halfHeight + 2*radius = 0.9 + 0.9 = 1.8m

    // Dynamic props tracking for Three.js synchronization: Array<{ mesh: THREE.Object3D, body: RAPIER.RigidBody }>
    this.dynamicProps = [];

    // Static colliders tracking for cleanup
    this.staticBodies = [];
  }

  /**
   * Asynchronously initialize Rapier WASM module and create physics world
   * @returns {Promise<boolean>}
   */
  async init() {
    if (this.isReady) return true;

    try {
      const rapierModule = await import('@dimforge/rapier3d-compat');
      const RAPIER = rapierModule.default || rapierModule;
      await RAPIER.init();

      this.RAPIER = RAPIER;
      this.world = new RAPIER.World({ x: 0.0, y: this.gravity, z: 0.0 });

      // Create Kinematic Character Controller
      this.initCharacterController();

      this.isReady = true;
      console.log('[PhysicsWorld] Rapier3D physics world initialized successfully.');
      return true;
    } catch (err) {
      console.warn('[PhysicsWorld] Failed to initialize Rapier WASM physics. Falling back to AABB CollisionSystem:', err);
      this.initError = err;
      this.isReady = false;
      return false;
    }
  }

  initCharacterController() {
    const RAPIER = this.RAPIER;

    // Create player rigid body (kinematic position-based)
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, 1.0, 0);
    this.playerBody = this.world.createRigidBody(bodyDesc);

    // Player capsule collider
    const colliderDesc = RAPIER.ColliderDesc.capsule(this.playerHalfHeight, this.playerRadius)
      .setFriction(0.1)
      .setRestitution(0.0);
    this.playerCollider = this.world.createCollider(colliderDesc, this.playerBody);

    // Kinematic Character Controller with autostep & ground snapping
    this.characterController = this.world.createCharacterController(0.015);
    this.characterController.enableAutostep(0.45, 0.2, true); // autostep up to 0.45m curbs/crates
    this.characterController.enableSnapToGround(0.35); // snap to ground up to 0.35m
    this.characterController.setMaxSlopeClimbAngle((48 * Math.PI) / 180); // 48 deg max climb
    this.characterController.setMinSlopeSlideAngle((50 * Math.PI) / 180); // 50 deg slide
  }

  /**
   * Set player position in the physics world (e.g., on spawn or teleport)
   */
  setPlayerPosition(x, y, z) {
    if (!this.isReady || !this.playerBody) return;
    // Rapier capsule center is at bottom y + radius + halfHeight = y + 0.9
    const centerY = y + this.playerRadius + this.playerHalfHeight;
    this.playerBody.setTranslation({ x, y: centerY, z }, true);
  }

  /**
   * Moves player using Rapier Kinematic Character Controller.
   * Resolves collisions with walls, ground, autostep over obstacles, and pushes dynamic props.
   * 
   * @param {THREE.Vector3} currentBottomPos - Current player bottom-center position
   * @param {THREE.Vector3} desiredDeltaMove - Desired displacement Vector3(dx, dy, dz)
   * @returns {{ position: THREE.Vector3, isGrounded: boolean }}
   */
  movePlayer(currentBottomPos, desiredDeltaMove) {
    if (!this.isReady || !this.characterController || !this.playerCollider) {
      return {
        position: currentBottomPos.clone().add(desiredDeltaMove),
        isGrounded: currentBottomPos.y <= 0.05
      };
    }

    // Set body to current position before computing movement
    const centerY = currentBottomPos.y + this.playerRadius + this.playerHalfHeight;
    this.playerBody.setTranslation({ x: currentBottomPos.x, y: centerY, z: currentBottomPos.z }, true);

    // Compute collider movement against world colliders
    this.characterController.computeColliderMovement(
      this.playerCollider,
      { x: desiredDeltaMove.x, y: desiredDeltaMove.y, z: desiredDeltaMove.z }
    );

    const computed = this.characterController.computedMovement();
    const isGrounded = this.characterController.computedGrounded();

    // Calculate new position
    const newBottomPos = new THREE.Vector3(
      currentBottomPos.x + computed.x,
      currentBottomPos.y + computed.y,
      currentBottomPos.z + computed.z
    );

    // Update body translation to keep physics body in sync
    this.playerBody.setTranslation({
      x: newBottomPos.x,
      y: newBottomPos.y + this.playerRadius + this.playerHalfHeight,
      z: newBottomPos.z
    }, true);

    return {
      position: newBottomPos,
      isGrounded
    };
  }

  /**
   * Step the physics world with fixed timestep and synchronize dynamic props
   * @param {number} delta - Frame delta time in seconds
   */
  step(delta) {
    if (!this.isReady || !this.world) return;

    // Prevent spiral of death on lag spikes
    const cappedDelta = Math.min(delta, 0.1);
    this.accumulator += cappedDelta;

    while (this.accumulator >= this.fixedTimeStep) {
      this.world.step();
      this.accumulator -= this.fixedTimeStep;
    }

    // Synchronize dynamic rigid body transforms to Three.js meshes
    for (let i = 0; i < this.dynamicProps.length; i++) {
      const prop = this.dynamicProps[i];
      if (prop.mesh && prop.body) {
        const t = prop.body.translation();
        const r = prop.body.rotation();
        prop.mesh.position.set(t.x, t.y, t.z);
        prop.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
    }
  }

  /**
   * Register a static Box3 collider into Rapier
   * @param {THREE.Box3} box 
   */
  addStaticBox(box) {
    if (!this.isReady || !this.world) return null;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const halfX = Math.max(0.01, size.x / 2);
    const halfY = Math.max(0.01, size.y / 2);
    const halfZ = Math.max(0.01, size.z / 2);

    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed()
      .setTranslation(center.x, center.y, center.z);
    const body = this.world.createRigidBody(bodyDesc);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ)
      .setFriction(0.4)
      .setRestitution(0.0);
    this.world.createCollider(colliderDesc, body);

    this.staticBodies.push(body);
    return body;
  }

  /**
   * Register a static Trimesh collider from a Three.js mesh geometry (e.g. hollow rooms, complex architecture)
   * @param {THREE.Mesh} mesh 
   */
  addTrimeshFromMesh(mesh) {
    if (!this.isReady || !this.world || !mesh || !mesh.geometry) return null;

    try {
      const geo = mesh.geometry.clone();
      mesh.updateWorldMatrix(true, false);
      geo.applyMatrix4(mesh.matrixWorld);

      const posAttr = geo.attributes.position;
      const vertices = new Float32Array(posAttr.array);

      let indices;
      if (geo.index) {
        indices = new Uint32Array(geo.index.array);
      } else {
        indices = new Uint32Array(posAttr.count);
        for (let i = 0; i < posAttr.count; i++) indices[i] = i;
      }
      geo.dispose();

      const bodyDesc = this.RAPIER.RigidBodyDesc.fixed();
      const body = this.world.createRigidBody(bodyDesc);

      const colliderDesc = this.RAPIER.ColliderDesc.trimesh(vertices, indices)
        .setFriction(0.5)
        .setRestitution(0.0);
      this.world.createCollider(colliderDesc, body);

      this.staticBodies.push(body);
      return body;
    } catch (err) {
      console.warn('[PhysicsWorld] Failed to create trimesh from mesh:', err);
      return null;
    }
  }

  /**
   * Register a dynamic interactive prop (e.g. crate or barrel)
   * @param {THREE.Object3D} mesh - Visual Three.js mesh
   * @param {'box' | 'cylinder'} shape - Collider shape
   * @param {Object} dimensions - { width, height, depth } or { radius, height }
   * @param {number} mass - Prop mass in kg (default 25kg)
   */
  addDynamicProp(mesh, shape = 'box', dimensions = {}, mass = 25.0) {
    if (!this.isReady || !this.world) return null;

    const pos = mesh.position;
    const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(0.8)
      .setAngularDamping(0.9);

    const body = this.world.createRigidBody(bodyDesc);

    let colliderDesc;
    if (shape === 'cylinder') {
      const radius = dimensions.radius || 0.4;
      const halfHeight = (dimensions.height || 1.0) / 2;
      colliderDesc = this.RAPIER.ColliderDesc.cylinder(halfHeight, radius);
    } else {
      const halfX = (dimensions.width || 1.0) / 2;
      const halfY = (dimensions.height || 1.0) / 2;
      const halfZ = (dimensions.depth || 1.0) / 2;
      colliderDesc = this.RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ);
    }

    colliderDesc.setMass(mass)
      .setFriction(0.6)
      .setRestitution(0.15);

    this.world.createCollider(colliderDesc, body);

    this.dynamicProps.push({ mesh, body });
    return body;
  }

  /**
   * Apply directional bullet impulse to dynamic props near hit point
   * @param {THREE.Vector3} hitPoint 
   * @param {THREE.Vector3} shotDirection 
   * @param {number} force 
   */
  applyBulletImpulse(hitPoint, shotDirection, force = 45.0) {
    if (!this.isReady) return;

    for (let i = 0; i < this.dynamicProps.length; i++) {
      const prop = this.dynamicProps[i];
      if (!prop.body) continue;

      const t = prop.body.translation();
      const dist = Math.hypot(t.x - hitPoint.x, t.y - hitPoint.y, t.z - hitPoint.z);

      if (dist < 1.8) {
        // Apply impulse in shot direction
        const impulse = {
          x: shotDirection.x * force,
          y: Math.max(4.0, shotDirection.y * force + 10.0), // add slight upward pop
          z: shotDirection.z * force
        };
        prop.body.applyImpulseAtPoint(impulse, { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z }, true);
      }
    }
  }

  /**
   * Clear all map colliders and dynamic props (called when switching maps)
   */
  clearMapColliders() {
    if (!this.isReady || !this.world) return;

    // Remove dynamic props
    for (const prop of this.dynamicProps) {
      if (prop.body) {
        this.world.removeRigidBody(prop.body);
      }
    }
    this.dynamicProps = [];

    // Remove static bodies
    for (const body of this.staticBodies) {
      this.world.removeRigidBody(body);
    }
    this.staticBodies = [];
  }

  /**
   * Fast raycast against physics colliders for weapon hits
   * @param {THREE.Ray} ray 
   * @param {number} maxDistance 
   */
  castRay(ray, maxDistance = 200) {
    if (!this.isReady || !this.world) return null;

    const rayOrigin = { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z };
    const rayDir = { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z };
    const rapierRay = new this.RAPIER.Ray(rayOrigin, rayDir);

    const hit = this.world.castRayAndGetNormal(
      rapierRay,
      maxDistance,
      true,
      this.RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC // Ignore player capsule itself
    );

    if (hit) {
      const hitPoint = new THREE.Vector3(
        ray.origin.x + ray.direction.x * hit.toi,
        ray.origin.y + ray.direction.y * hit.toi,
        ray.origin.z + ray.direction.z * hit.toi
      );
      const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);

      return {
        point: hitPoint,
        distance: hit.toi,
        normal,
        collider: hit.collider
      };
    }

    return null;
  }

  /**
   * Returns debug rendering line vertices and colors for development visualization
   */
  debugRender() {
    if (!this.isReady || !this.world) return null;
    return this.world.debugRender();
  }

  dispose() {
    this.clearMapColliders();
    if (this.playerBody && this.world) {
      this.world.removeRigidBody(this.playerBody);
      this.playerBody = null;
    }
    this.world = null;
    this.isReady = false;
  }
}
