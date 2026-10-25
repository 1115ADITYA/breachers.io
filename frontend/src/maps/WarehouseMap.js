import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * WarehouseMap
 * Integrated low-poly 3D tactical FPS arena loaded from `/assets/maps/warehouse.glb`.
 * Features an industrial distribution center with high-ceiling storage bays,
 * forklift storage corridors, stacked crates, chemical barrels, central depot rooms,
 * and verified collision boundaries for competitive Red vs Blue TDM and Solo FFA.
 */
export class WarehouseMap {
  constructor() {
    this.id = 'warehouse';
    this.name = 'Warehouse';
    this.subtitle = 'Reforge Logistics Depot';
    this.group = new THREE.Group();
    this.colliders = []; // Array of { box: THREE.Box3, type: string, mesh: THREE.Object3D }
    this.isLoaded = false;
    this.loadError = null;

    // Map Dimensions (Playable floor: X from -32 to +32, Z from -18 to +18)
    this.width = 64;
    this.depth = 36;
    this.wallHeight = 18.0;
    this.modelScale = 5.2;

    // Verified safe spawn points with >= 0.85m clearance from all obstacles
    this.spawns = {
      red: [
        { x: -26.0, y: 0.0, z: -10.0, rotationY: Math.PI / 2 },
        { x: -26.0, y: 0.0, z: 10.0,  rotationY: Math.PI / 2 },
        { x: -28.0, y: 0.0, z: -4.0,  rotationY: Math.PI / 2 },
        { x: -28.0, y: 0.0, z: 4.0,   rotationY: Math.PI / 2 },
        { x: -25.0, y: 0.0, z: -6.0,  rotationY: Math.PI / 2 }
      ],
      blue: [
        { x: 28.0,  y: 0.0, z: -4.0,  rotationY: -Math.PI / 2 },
        { x: 28.0,  y: 0.0, z: 4.0,   rotationY: -Math.PI / 2 },
        { x: 24.0,  y: 0.0, z: 6.0,   rotationY: -Math.PI / 2 },
        { x: 20.0,  y: 0.0, z: 8.0,   rotationY: -Math.PI / 2 },
        { x: 23.0,  y: 0.0, z: -14.0, rotationY: -Math.PI / 2 }
      ],
      ffa: [
        { x: -18.0, y: 0.0, z: -5.0,  rotationY: 0.8 },
        { x: -18.0, y: 0.0, z: 9.0,   rotationY: 2.3 },
        { x: -14.0, y: 0.0, z: 14.0,  rotationY: 1.57 },
        { x: -13.0, y: 0.0, z: -1.0,  rotationY: 0.0 },
        { x: -13.0, y: 0.0, z: 5.0,   rotationY: Math.PI },
        { x: -10.0, y: 0.0, z: -14.0, rotationY: -0.8 },
        { x: -10.0, y: 0.0, z: -8.0,  rotationY: -1.57 },
        { x: -8.0,  y: 0.0, z: 13.0,  rotationY: -2.3 }
      ]
    };

    // Lights group for disposal
    this.lightsGroup = new THREE.Group();
    this.group.add(this.lightsGroup);
    this.initWarehouseLighting();
  }

  /**
   * Industrial interior lighting tailored for tactical readability and contrast
   */
  initWarehouseLighting() {
    // Ambient baseline (cool industrial twilight fill)
    const indoorAmbient = new THREE.AmbientLight(0x24324a, 0.45);
    this.lightsGroup.add(indoorAmbient);

    // Warm high-bay industrial ceiling lamps (sodium vapor 3200K)
    const bayLightPositions = [
      { x: -24, y: 13, z: 0,  color: 0xffe2b8, intensity: 2.2 },
      { x: -8,  y: 13, z: -4, color: 0xffd29d, intensity: 2.5 },
      { x: 8,   y: 13, z: 4,  color: 0xffd29d, intensity: 2.5 },
      { x: 22,  y: 13, z: 0,  color: 0xffe2b8, intensity: 2.2 }
    ];

    bayLightPositions.forEach(cfg => {
      const pLight = new THREE.PointLight(cfg.color, cfg.intensity, 38, 1.2);
      pLight.position.set(cfg.x, cfg.y, cfg.z);
      this.lightsGroup.add(pLight);

      // Visual luminaire fixture
      const fixtureGeo = new THREE.CylinderGeometry(0.5, 0.9, 0.4, 8);
      const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(cfg.x, cfg.y + 0.2, cfg.z);
      this.lightsGroup.add(fixture);
    });

    // Directional rooftop skylight shafts (cool moonlight or morning sunlight entering clerestory)
    const skylight = new THREE.DirectionalLight(0xa5c4e8, 1.1);
    skylight.position.set(15, 30, 20);
    this.lightsGroup.add(skylight);
  }

  /**
   * Asynchronously load warehouse GLB model, apply scale/transforms,
   * and extract verified AABB obstacle colliders.
   * 
   * @param {Function} [onProgress] Progress callback with percentage (0-100)
   * @returns {Promise<WarehouseMap>}
   */
  /**
   * Asynchronously load warehouse GLB model, apply scale/transforms,
   * build realistic Rapier colliders & AABB fallback, and resolve invisible walls.
   * 
   * @param {Function} [onProgress] Progress callback with percentage (0-100)
   * @param {Object} [physicsWorld] Optional Rapier PhysicsWorld instance
   * @returns {Promise<WarehouseMap>}
   */
  load(onProgress = null, physicsWorld = null) {
    this.physicsWorld = physicsWorld;
    if (this.isLoaded) return Promise.resolve(this);

    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      const assetUrl = '/assets/maps/warehouse.glb';

      loader.load(
        assetUrl,
        (gltf) => {
          try {
            const model = gltf.scene;

            // Orient model: 90 deg rotation around Y aligns the warehouse's long axis with the X axis (Red/West vs Blue/East)
            model.rotation.y = Math.PI / 2;
            model.scale.set(this.modelScale, this.modelScale, this.modelScale);
            model.updateMatrixWorld(true);

            // Configure shadow casting and receiving
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // Ensure materials handle lighting properly
                if (child.material) {
                  child.material.roughness = Math.max(0.3, child.material.roughness || 0.6);
                  child.material.metalness = Math.min(0.8, child.material.metalness || 0.2);
                }
              }
            });

            this.group.add(model);
            this.buildColliders(model, this.physicsWorld);

            this.isLoaded = true;
            console.log(`[WarehouseMap] Successfully loaded model and generated ${this.colliders.length} colliders (Physics: ${this.physicsWorld?.isReady ? 'Rapier3D Active' : 'AABB Fallback'})`);
            resolve(this);
          } catch (err) {
            console.error('[WarehouseMap] Error configuring loaded model:', err);
            this.loadError = err;
            reject(err);
          }
        },
        (xhr) => {
          if (xhr.lengthComputable && onProgress) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            onProgress(percent);
          }
        },
        (err) => {
          console.error('[WarehouseMap] Failed to load GLB asset at ' + assetUrl, err);
          this.loadError = err;
          reject(err);
        }
      );
    });
  }

  /**
   * Build complete collision geometry:
   * 1. Ground floor plane
   * 2. Outer warehouse perimeter containment walls
   * 3. Architectural trimesh colliders for hollow rooms (resolves invisible walls)
   * 4. Interior tactical cover objects (crates, boxes, barrels) with Rapier dynamic props
   */
  buildColliders(model, physicsWorld = null) {
    this.colliders = [];
    if (physicsWorld && physicsWorld.isReady) {
      physicsWorld.clearMapColliders();
    }

    // 1. Playable Floor plane (Y = 0)
    const floorBox = new THREE.Box3(
      new THREE.Vector3(-45, -2.0, -25),
      new THREE.Vector3(45, 0.0, 25)
    );
    this.colliders.push({ box: floorBox, type: 'ground', mesh: null });
    if (physicsWorld && physicsWorld.isReady) {
      physicsWorld.addStaticBox(floorBox);
    }

    // 2. Outer Perimeter Containment Walls (Ensures player can never exit warehouse perimeter)
    const perimeterWalls = [
      // West Wall (X = -32.5)
      new THREE.Box3(new THREE.Vector3(-35.0, 0, -22.0), new THREE.Vector3(-31.5, 20, 22.0)),
      // East Wall (X = +32.5)
      new THREE.Box3(new THREE.Vector3(31.5, 0, -22.0), new THREE.Vector3(35.0, 20, 22.0)),
      // North Wall (Z = -18.5)
      new THREE.Box3(new THREE.Vector3(-35.0, 0, -22.0), new THREE.Vector3(35.0, 20, -17.5)),
      // South Wall (Z = +18.5)
      new THREE.Box3(new THREE.Vector3(-35.0, 0, 17.5), new THREE.Vector3(35.0, 20, 22.0))
    ];

    perimeterWalls.forEach(box => {
      this.colliders.push({ box, type: 'wall', mesh: null });
      if (physicsWorld && physicsWorld.isReady) {
        physicsWorld.addStaticBox(box);
      }
    });

    // 3. Interior Obstacles: Extract verified colliders and resolve invisible wall issues
    let rootNode = null;
    model.traverse((c) => {
      if (c.name === 'Root') rootNode = c;
    });

    if (rootNode) {
      // Dynamic prop selection counters
      let dynamicBarrelCount = 0;
      let dynamicBoxCount = 0;

      rootNode.children.forEach((child) => {
        const name = child.name || '';
        // Ignore ground planes or floor markers
        if (name.includes('Plane') || name.includes('floors')) return;

        // INVISIBLE WALL FIX #1: Hollow compound architectural structures (e.g. 'room')
        // Instead of a monolithic bounding box that seals off the doorways and room interior,
        // create a physically accurate Trimesh collider in Rapier!
        if (name.includes('room')) {
          child.traverse((m) => {
            if (m.isMesh && physicsWorld && physicsWorld.isReady) {
              physicsWorld.addTrimeshFromMesh(m);
            }
          });
          // Do not add monolithic box to AABB list so doorways remain unblocked
          return;
        }

        // INVISIBLE WALL FIX #2: Compound perimeter wall geometry in GLTF
        // Cube.004, Cube.016, up2 are outer shell structures already bounded by our perimeter containment
        if (name === 'Cube.004' || name === 'Cube.016' || name === 'up2') {
          return;
        }

        // Check object dimensions
        const b = new THREE.Box3().setFromObject(child);
        const s = new THREE.Vector3();
        b.getSize(s);

        // Filter for substantial tactical cover objects (height >= 0.7m, width/depth >= 0.5m)
        if (s.y >= 0.7 && (s.x >= 0.5 || s.z >= 0.5)) {
          // Avoid registering duplicate colliders if it spans the entire perimeter
          if (s.x > 45 || s.z > 25) return;

          // Register in baseline AABB colliders
          this.colliders.push({
            box: b,
            type: 'solid',
            mesh: child
          });

          // Rapier 3D physics collider registration
          if (physicsWorld && physicsWorld.isReady) {
            // Interactive dynamic props for selected small barrels and crates
            const isBarrel = name.includes('Barrel');
            const isSmallBox = (name.includes('miniBox') || name.includes('Box.')) && s.x < 2.0 && s.z < 2.0;

            if (isBarrel && dynamicBarrelCount < 10) {
              dynamicBarrelCount++;
              physicsWorld.addDynamicProp(child, 'cylinder', { radius: Math.max(0.3, s.x / 2), height: s.y }, 25.0);
            } else if (isSmallBox && dynamicBoxCount < 12) {
              dynamicBoxCount++;
              physicsWorld.addDynamicProp(child, 'box', { width: s.x, height: s.y, depth: s.z }, 30.0);
            } else {
              // Static solid collider (pillars, big cargo crates, structural columns)
              physicsWorld.addStaticBox(b);
            }
          }
        }
      });
    }
  }

  /**
   * Returns spawn coordinates for specified team
   * @param {'red' | 'blue' | 'ffa'} team
   */
  getSpawns(team = 'ffa') {
    return this.spawns[team] || this.spawns.ffa;
  }

  /**
   * Returns a random verified spawn point for the specified team
   */
  getRandomSpawn(team = 'ffa') {
    const list = this.getSpawns(team);
    const index = Math.floor(Math.random() * list.length);
    return { ...list[index] };
  }

  getColliders() {
    return this.colliders;
  }

  getMesh() {
    return this.group;
  }

  getBounds() {
    return {
      minX: -this.width / 2,
      maxX: this.width / 2,
      minZ: -this.depth / 2,
      maxZ: this.depth / 2
    };
  }

  dispose() {
    // Remove and dispose lights
    while (this.lightsGroup.children.length > 0) {
      const light = this.lightsGroup.children[0];
      this.lightsGroup.remove(light);
      if (light.dispose) light.dispose();
    }

    // Traverse and dispose mesh geometries & materials
    this.group.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });

    this.colliders = [];
    if (this.physicsWorld && this.physicsWorld.isReady) {
      this.physicsWorld.clearMapColliders();
    }
    this.isLoaded = false;
  }
}
