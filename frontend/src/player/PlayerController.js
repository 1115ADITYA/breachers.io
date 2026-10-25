import * as THREE from 'three';

/**
 * PlayerController
 * First-person shooter controls with Pointer Lock, WASD movement,
 * tactical sprint, jumping, gravity, weapon selection (1, 2, 3),
 * automatic firing, and death state disabling.
 */
export class PlayerController {
  constructor(camera, domElement, collisionSystem, hud) {
    this.camera = camera;
    this.domElement = domElement;
    this.collisionSystem = collisionSystem;
    this.hud = hud;

    // Dimensions
    this.radius = 0.45;
    this.height = 1.8;
    this.eyeHeight = 1.62;

    // Movement Parameters (Fast & snappy FPS mechanics)
    this.walkSpeed = 8.5;     // m/s
    this.sprintSpeed = 13.5;  // m/s
    this.jumpForce = 9.8;     // m/s
    this.gravity = 28.0;      // m/s²
    this.airControl = 0.65;   // Responsiveness while airborne

    // State
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.isGrounded = false;
    this.isSprinting = false;
    this.isMoving = false;
    this.isDead = false;
    this.isMouseDown = false;

    // Camera Rotation
    this.pitch = 0; // Look up/down (-Math.PI/2 to +Math.PI/2)
    this.yaw = 0;   // Look left/right
    this.mouseSensitivity = 0.0022;

    // Keys State
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false
    };

    // 5-second spawn protection state (Mandatory Requirement B)
    this.spawnProtectedUntil = performance.now() + 5000;
    this.wasProtected = true;

    // Pointer Lock State
    this.isLocked = false;
    this.enabled = false; // Disabled by default on menu screens (Chunk 6 requirement)

    // Weapon reference
    this.weapon = null;

    this.initEventListeners();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.isLocked = false;
      this.isMouseDown = false;
      this.velocity.set(0, 0, 0);
      Object.keys(this.keys).forEach(k => this.keys[k] = false);
      this.exitLock();
    }
  }

  setWeapon(weapon) {
    this.weapon = weapon;
  }

  isProtected() {
    return performance.now() < this.spawnProtectedUntil;
  }

  applySpawnProtection(durationMs = 5000) {
    this.spawnProtectedUntil = performance.now() + durationMs;
    this.wasProtected = true;
  }

  setDead(isDead) {
    this.isDead = isDead;
    if (isDead) {
      this.isMouseDown = false;
      this.velocity.set(0, 0, 0);
      Object.keys(this.keys).forEach(k => this.keys[k] = false);
    }
  }

  spawnAt(x, y, z, rotationY = 0) {
    this.position.set(x, y, z);
    this.yaw = rotationY;
    this.pitch = 0;
    this.velocity.set(0, 0, 0);
    this.setDead(false);
    this.applySpawnProtection(5000); // 5-second mandatory spawn protection on every spawn
    this.updateCamera();
  }

  requestLock() {
    if (!this.enabled) return;
    try {
      if (this.domElement && this.domElement.requestPointerLock) {
        this.domElement.requestPointerLock();
      }
    } catch (e) {
      console.warn('Pointer lock request error:', e);
    }
  }

  exitLock() {
    try {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch (e) {
      console.warn('Exit pointer lock error:', e);
    }
  }

  initEventListeners() {
    // Pointer Lock change listener
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      if (this.hud && this.enabled) {
        this.hud.setPaused(!this.isLocked);
      }
    });

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.isLocked || this.isDead) return;

      this.yaw -= e.movementX * this.mouseSensitivity;
      this.pitch -= e.movementY * this.mouseSensitivity;

      // Clamp vertical pitch to avoid camera flipping
      const maxPitch = (Math.PI / 2) - 0.02;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });

    // Mouse click for shooting or acquiring pointer lock
    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.isLocked) {
        this.requestLock();
        return;
      }

      if (e.button === 0 && !this.isDead) {
        this.isMouseDown = true;
        // Requirement B: Protected player cannot fire weapons or attack with knife
        if (this.isProtected()) {
          return;
        }
        if (this.weapon) {
          this.weapon.shoot();
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || this.isDead) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'Space':
          this.keys.jump = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = true;
          break;
        case 'KeyR':
          if (this.weapon) this.weapon.reload();
          break;
        case 'Digit1':
          if (this.weapon) this.weapon.switchWeapon('ASSAULT');
          break;
        case 'Digit2':
          if (this.weapon) this.weapon.switchWeapon('PISTOL');
          break;
        case 'Digit3':
          if (this.weapon) this.weapon.switchWeapon('KNIFE');
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.enabled) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'Space':
          this.keys.jump = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = false;
          break;
      }
    });
  }

  update(delta) {
    if (!this.enabled || !this.isLocked) {
      this.updateCamera();
      return;
    }

    // Update spawn shield countdown in HUD
    if (this.isProtected()) {
      const remainingSec = Math.max(0, (this.spawnProtectedUntil - performance.now()) / 1000);
      if (this.hud && this.hud.updateSpawnShield) {
        this.hud.updateSpawnShield(remainingSec);
      }
    } else if (this.wasProtected) {
      this.wasProtected = false;
      if (this.hud && this.hud.hideSpawnShield) {
        this.hud.hideSpawnShield();
      }
    }

    // Handle continuous automatic fire when mouse is held (disabled while spawn protected)
    if (this.isMouseDown && !this.isDead && !this.isProtected() && this.weapon && this.weapon.currentStats.auto) {
      this.weapon.shoot();
    }

    if (this.isDead) {
      // While dead, don't update movement physics
      if (this.weapon) {
        this.weapon.update(delta, false, false);
      }
      return;
    }

    // 1. Calculate desired horizontal movement vector based on camera yaw
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const inputDir = new THREE.Vector3();
    if (this.keys.forward) inputDir.add(forward);
    if (this.keys.backward) inputDir.sub(forward);
    if (this.keys.right) inputDir.add(right);
    if (this.keys.left) inputDir.sub(right);

    this.isMoving = inputDir.lengthSq() > 0.001;
    this.isSprinting = this.keys.sprint && this.keys.forward;

    const currentSpeed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;

    if (this.isMoving) {
      inputDir.normalize();
      const targetVelX = inputDir.x * currentSpeed;
      const targetVelZ = inputDir.z * currentSpeed;

      const accel = this.isGrounded ? 18.0 : 6.0;
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelX, delta * accel);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelZ, delta * accel);
    } else {
      const friction = this.isGrounded ? 22.0 : 3.0;
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, delta * friction);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, delta * friction);
    }

    // 2. Jumping & Gravity
    if (this.isGrounded) {
      if (this.keys.jump) {
        this.velocity.y = this.jumpForce;
        this.isGrounded = false;
      } else {
        this.velocity.y = -1.0;
      }
    } else {
      this.velocity.y -= this.gravity * delta;
      this.velocity.y = Math.max(-45, this.velocity.y);
    }

    // 3. Move and resolve collisions via CollisionSystem
    const desiredMove = new THREE.Vector3(
      this.velocity.x * delta,
      this.velocity.y * delta,
      this.velocity.z * delta
    );

    const collisionResult = this.collisionSystem.movePlayer(
      this.position,
      desiredMove,
      this.radius,
      this.height,
      0.45
    );

    this.position.copy(collisionResult.position);
    this.isGrounded = collisionResult.isGrounded;

    if (collisionResult.hitHead && this.velocity.y > 0) {
      this.velocity.y = 0;
    }
    if (this.isGrounded && this.velocity.y < 0) {
      this.velocity.y = 0;
    }

    // 4. Update First-person camera transform
    this.updateCamera();

    // 5. Update weapon viewmodel
    if (this.weapon) {
      this.weapon.update(delta, this.isMoving, this.isSprinting);
    }
  }

  updateCamera() {
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = this.pitch;
    euler.y = this.yaw;
    this.camera.quaternion.setFromEuler(euler);
  }
}
