import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';
import { ContainerFactory } from './ContainerFactory.js';
import { IndustrialProps } from './IndustrialProps.js';

/**
 * ContainerYardMap
 * Complete, highly polished competitive 3D FPS map for Breachers.io.
 * Features an authentic industrial freight terminal with corrugated ISO containers,
 * detailed wooden pallets, cargo crates, jersey barriers, chemical barrels,
 * tire stacks, cable reels, floodlight towers, a warehouse loading facade,
 * exterior harbor gantry cranes, and strictly separated Red/Blue/FFA spawns.
 */
export class ContainerYardMap {
  constructor() {
    this.name = 'Container Yard';
    this.group = new THREE.Group();
    this.colliders = []; // Array of { box: THREE.Box3, type: string, mesh: THREE.Object3D }

    // Map Dimensions (X from -55 to +55, Z from -40 to +40)
    this.width = 110;
    this.depth = 80;
    this.wallHeight = 6.0;

    // Preserved Server-Authoritative Spawn Points
    this.spawns = {
      red: [
        { x: -46, y: 0, z: -10, rotationY: Math.PI / 2 },
        { x: -46, y: 0, z: 10, rotationY: Math.PI / 2 },
        { x: -48, y: 0, z: 0, rotationY: Math.PI / 2 },
        { x: -44, y: 0, z: -20, rotationY: Math.PI / 2 }
      ],
      blue: [
        { x: 46, y: 0, z: -10, rotationY: -Math.PI / 2 },
        { x: 46, y: 0, z: 10, rotationY: -Math.PI / 2 },
        { x: 48, y: 0, z: 0, rotationY: -Math.PI / 2 },
        { x: 44, y: 0, z: 20, rotationY: -Math.PI / 2 }
      ],
      ffa: [
        { x: -35, y: 0, z: -25, rotationY: 0.8 },
        { x: -35, y: 0, z: 25, rotationY: 2.3 },
        { x: -15, y: 0, z: 0, rotationY: 1.57 },
        { x: 0, y: 0, z: -28, rotationY: 0 },
        { x: 0, y: 0, z: 28, rotationY: Math.PI },
        { x: 15, y: 0, z: 0, rotationY: -1.57 },
        { x: 35, y: 0, z: -25, rotationY: -0.8 },
        { x: 35, y: 0, z: 25, rotationY: -2.3 }
      ]
    };

    this.containerFactory = new ContainerFactory();
    this.props = new IndustrialProps();
    this.materials = this.initMaterials();

    this.buildMap();
  }

  initMaterials() {
    return {
      ground: new THREE.MeshStandardMaterial({
        map: TextureGenerator.createGroundTexture(),
        roughness: 0.85,
        metalness: 0.15
      }),
      perimeterWall: new THREE.MeshStandardMaterial({
        color: 0x1e2530,
        roughness: 0.7,
        metalness: 0.25
      }),
      warehouseWall: new THREE.MeshStandardMaterial({
        map: TextureGenerator.createWarehouseWallTexture(),
        roughness: 0.65,
        metalness: 0.4
      }),
      wallTrim: new THREE.MeshStandardMaterial({
        map: TextureGenerator.createHazardStripeTexture(512, 32),
        roughness: 0.5,
        metalness: 0.2
      }),
      spawnPadRed: new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.55,
        metalness: 0.2
      }),
      spawnPadBlue: new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.55,
        metalness: 0.2
      }),
      chainlinkFence: new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.4,
        metalness: 0.8,
        wireframe: true
      })
    };
  }

  buildMap() {
    this.buildGround();
    this.buildPerimeterWalls();
    this.buildWarehouseLoadingBay();
    this.buildSpawnZones();
    this.buildShippingContainers();
    this.buildTacticalProps();
    this.buildLightingStructures();
    this.buildExteriorLandmarks();
  }

  buildGround() {
    const groundGeo = new THREE.PlaneGeometry(this.width, this.depth);
    const ground = new THREE.Mesh(groundGeo, this.materials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Solid ground plane collider at y = 0
    const groundBox = new THREE.Box3(
      new THREE.Vector3(-this.width / 2, -1.0, -this.depth / 2),
      new THREE.Vector3(this.width / 2, 0.0, this.depth / 2)
    );
    this.colliders.push({ box: groundBox, type: 'ground', mesh: ground });
  }

  buildPerimeterWalls() {
    const halfW = this.width / 2;
    const halfD = this.depth / 2;
    const thickness = 2.0;
    const h = this.wallHeight;

    const wallConfigs = [
      // North Wall (Behind Warehouse Bay)
      { w: this.width + thickness * 2, h, d: thickness, x: 0, y: h / 2, z: -halfD - thickness / 2 },
      // South Wall
      { w: this.width + thickness * 2, h, d: thickness, x: 0, y: h / 2, z: halfD + thickness / 2 },
      // West Wall (Red Spawn Side)
      { w: thickness, h, d: this.depth, x: -halfW - thickness / 2, y: h / 2, z: 0 },
      // East Wall (Blue Spawn Side)
      { w: thickness, h, d: this.depth, x: halfW + thickness / 2, y: h / 2, z: 0 }
    ];

    wallConfigs.forEach(c => {
      const geo = new THREE.BoxGeometry(c.w, c.h, c.d);
      const wall = new THREE.Mesh(geo, this.materials.perimeterWall);
      wall.position.set(c.x, c.y, c.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);

      // Warning hazard cap on top of perimeter wall
      const trimGeo = new THREE.BoxGeometry(c.w, 0.25, c.d + 0.1);
      const trim = new THREE.Mesh(trimGeo, this.materials.wallTrim);
      trim.position.set(c.x, h + 0.125, c.z);
      this.group.add(trim);

      // Industrial chainlink security fencing on top of wall
      const fenceGeo = new THREE.BoxGeometry(c.w, 1.8, 0.05);
      const fence = new THREE.Mesh(fenceGeo, this.materials.chainlinkFence);
      fence.position.set(c.x, h + 1.15, c.z);
      this.group.add(fence);

      // AABB Wall Collider
      const box = new THREE.Box3();
      box.setFromObject(wall);
      this.colliders.push({ box, type: 'wall', mesh: wall });
    });
  }

  /**
   * North perimeter architectural warehouse dock facade
   */
  buildWarehouseLoadingBay() {
    const bayGroup = new THREE.Group();
    bayGroup.position.set(0, 0, -38.5);

    // Raised concrete loading dock platform
    const dockGeo = new THREE.BoxGeometry(50, 0.9, 3.0);
    const dock = new THREE.Mesh(dockGeo, this.materials.perimeterWall);
    dock.position.set(0, 0.45, 0);
    dock.castShadow = true;
    dock.receiveShadow = true;
    bayGroup.add(dock);

    // Hazard stripe on loading dock ledge
    const stripeGeo = new THREE.BoxGeometry(50, 0.12, 0.2);
    const stripe = new THREE.Mesh(stripeGeo, this.materials.wallTrim);
    stripe.position.set(0, 0.85, 1.45);
    bayGroup.add(stripe);

    // 3 Industrial roll-up shutter doors
    const doorGeo = new THREE.BoxGeometry(9.0, 4.2, 0.3);
    const shutterMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.6
    });

    [-16, 0, 16].forEach(dx => {
      const shutter = new THREE.Mesh(doorGeo, shutterMat);
      shutter.position.set(dx, 3.0, -0.8);
      bayGroup.add(shutter);
    });

    this.group.add(bayGroup);

    // Dock platform collider
    const box = new THREE.Box3(
      new THREE.Vector3(-25, 0, -40),
      new THREE.Vector3(25, 0.9, -37)
    );
    this.colliders.push({ box, type: 'dock', mesh: dock });
  }

  buildSpawnZones() {
    // Red Base (West) Ground Tactical Pad
    const redBase = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.04, 18),
      this.materials.spawnPadRed
    );
    redBase.position.set(-46, 0.02, 0);
    redBase.receiveShadow = true;
    this.group.add(redBase);

    // Blue Base (East) Ground Tactical Pad
    const blueBase = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.04, 18),
      this.materials.spawnPadBlue
    );
    blueBase.position.set(46, 0.02, 0);
    blueBase.receiveShadow = true;
    this.group.add(blueBase);

    // Protective bunker containers behind each spawn zone
    this.placeContainer(-50, 0, 0, 2.5, 2.6, 14, '#b91c1c', 0, 'RED-BASE');
    this.placeContainer(50, 0, 0, 2.5, 2.6, 14, '#1d4ed8', 0, 'BLUE-BASE');
  }

  /**
   * Helper to place a stylized ISO container and register its AABB collider
   */
  placeContainer(x, y, z, width, height, length, baseColorHex, rotY = 0, stencilCode = 'BRCH') {
    const { group, colliderBox } = this.containerFactory.createContainer(
      x, y, z, width, height, length, baseColorHex, rotY, stencilCode
    );
    this.group.add(group);
    this.colliders.push({ box: colliderBox, type: 'container', mesh: group });
    return group;
  }

  buildShippingContainers() {
    // ---------------------------------------------------------
    // 1. CENTRAL COMBAT ARENA (Balanced cover, broken sightlines)
    // ---------------------------------------------------------
    // Center forward containers (40ft)
    this.placeContainer(-6, 0, -4, 2.5, 2.6, 12, '#c2410c', 0, 'CTR-01');
    this.placeContainer(6, 0, 4, 2.5, 2.6, 12, '#1e40af', 0, 'CTR-02');

    // Stacked center high-ground container (20ft)
    this.placeContainer(0, 2.6, 0, 2.5, 2.6, 6, '#7c2d12', Math.PI / 2, 'HIGH-01');

    // Center lateral barriers (North / South chokepoints)
    this.placeContainer(0, 0, -18, 2.5, 2.6, 10, '#b91c1c', Math.PI / 2, 'LAT-N');
    this.placeContainer(0, 0, 18, 2.5, 2.6, 10, '#15803d', Math.PI / 2, 'LAT-S');

    // ---------------------------------------------------------
    // 2. WEST / RED APPROACH LANES
    // ---------------------------------------------------------
    this.placeContainer(-26, 0, -12, 2.5, 2.6, 12, '#b91c1c', 0, 'RED-FWD');
    this.placeContainer(-26, 2.6, -12, 2.5, 2.6, 6, '#475569', 0, 'RED-TIER2'); // Tier 2 stack

    this.placeContainer(-26, 0, 14, 2.5, 2.6, 12, '#9a3412', 0, 'RED-FLANK');
    this.placeContainer(-34, 0, 2, 2.5, 2.6, 6, '#c2410c', Math.PI / 4, 'RED-ANG');
    this.placeContainer(-34, 0, -20, 2.5, 2.6, 6, '#1d4ed8', 0, 'RED-OUT');

    // ---------------------------------------------------------
    // 3. EAST / BLUE APPROACH LANES
    // ---------------------------------------------------------
    this.placeContainer(26, 0, 12, 2.5, 2.6, 12, '#1d4ed8', 0, 'BLU-FWD');
    this.placeContainer(26, 2.6, 12, 2.5, 2.6, 6, '#c2410c', 0, 'BLU-TIER2'); // Tier 2 stack

    this.placeContainer(26, 0, -14, 2.5, 2.6, 12, '#b91c1c', 0, 'BLU-FLANK');
    this.placeContainer(34, 0, -2, 2.5, 2.6, 6, '#15803d', -Math.PI / 4, 'BLU-ANG');
    this.placeContainer(34, 0, 20, 2.5, 2.6, 6, '#475569', 0, 'BLU-OUT');

    // ---------------------------------------------------------
    // 4. NORTH FLANKING CORRIDOR (Depot / Warehouse Side)
    // ---------------------------------------------------------
    this.placeContainer(-16, 0, -30, 2.5, 2.6, 12, '#1e40af', Math.PI / 2, 'DEPOT-W');
    this.placeContainer(16, 0, -30, 2.5, 2.6, 12, '#9a3412', Math.PI / 2, 'DEPOT-E');
    this.placeContainer(-38, 0, -32, 2.5, 2.6, 6, '#c2410c', 0, 'DEPOT-W2');
    this.placeContainer(38, 0, -32, 2.5, 2.6, 6, '#b91c1c', 0, 'DEPOT-E2');

    // ---------------------------------------------------------
    // 5. SOUTH FLANKING CORRIDOR (Crane Rail Line / Long Sightlines)
    // ---------------------------------------------------------
    this.placeContainer(-16, 0, 30, 2.5, 2.6, 12, '#15803d', Math.PI / 2, 'RAIL-W');
    this.placeContainer(16, 0, 30, 2.5, 2.6, 12, '#c2410c', Math.PI / 2, 'RAIL-E');
    this.placeContainer(-38, 0, 32, 2.5, 2.6, 6, '#475569', 0, 'RAIL-W2');
    this.placeContainer(38, 0, 32, 2.5, 2.6, 6, '#1d4ed8', 0, 'RAIL-E2');
  }

  buildTacticalProps() {
    // 1. Concrete Jersey Barriers (Tactical cover in open cross-lanes)
    const addBarrier = (x, z, rotY = 0) => {
      const { group, colliderBox } = this.props.createJerseyBarrier(x, 0, z, rotY);
      this.group.add(group);
      this.colliders.push({ box: colliderBox, type: 'barrier', mesh: group });
    };

    addBarrier(-12, 0, 0);
    addBarrier(12, 0, 0);
    addBarrier(-8, -12, Math.PI / 3);
    addBarrier(8, 12, Math.PI / 3);
    addBarrier(0, -10, Math.PI / 2);
    addBarrier(0, 10, Math.PI / 2);
    addBarrier(-22, -26, 0);
    addBarrier(22, 26, 0);
    addBarrier(-40, 14, Math.PI / 6);
    addBarrier(40, -14, -Math.PI / 6);

    // 2. Supply Crates (Stepping stones to high-ground containers & waist-high cover)
    const addCrate = (x, y, z, size, isMetal, rotY = 0) => {
      const { group, colliderBox } = this.props.createCrate(x, y, z, size, isMetal, rotY);
      this.group.add(group);
      this.colliders.push({ box: colliderBox, type: 'crate', mesh: group });
    };

    // Stairs to Center High-Ground Container
    addCrate(-2.5, 0, -8, 1.0, false);
    addCrate(-2.5, 0.95, -8, 0.9, true);
    addCrate(-1.5, 0, -5, 1.4, false);
    addCrate(1.5, 0, 5, 1.4, false);

    // Stairs to West Container Stack (-26, 0, -12)
    addCrate(-23, 0, -16, 1.0, false);
    addCrate(-23, 0.95, -15, 0.9, true);
    addCrate(-24, 1.85, -14, 0.9, false);

    // Stairs to East Container Stack (26, 0, 12)
    addCrate(23, 0, 16, 1.0, false);
    addCrate(23, 0.95, 15, 0.9, true);
    addCrate(24, 1.85, 14, 0.9, false);

    // Additional tactical cover crates throughout yard
    addCrate(-18, 0, 10, 1.2, false);
    addCrate(18, 0, -10, 1.2, false);
    addCrate(-30, 0, -8, 1.1, true);
    addCrate(30, 0, 8, 1.1, true);
    addCrate(-6, 0, 22, 1.2, false);
    addCrate(6, 0, -22, 1.2, false);

    // 3. Wooden Euro-Pallet Stacks (Industrial staging near containers)
    const addPalletStack = (x, z, count = 3, rotY = 0) => {
      const { group, colliderBox } = this.props.createPalletStack(x, 0, z, count, rotY);
      this.group.add(group);
      this.colliders.push({ box: colliderBox, type: 'pallet', mesh: group });
    };

    addPalletStack(-18, -4, 4, 0.15);
    addPalletStack(18, 4, 4, -0.12);
    addPalletStack(-30, 20, 3, 0.4);
    addPalletStack(30, -20, 3, -0.3);

    // 4. Industrial Steel Drums / Chemical Barrels (Clusters for cover)
    const addBarrel = (x, z, color = 'red') => {
      const { group, colliderBox } = this.props.createSteelBarrel(x, 0, z, color);
      this.group.add(group);
      this.colliders.push({ box: colliderBox, type: 'barrel', mesh: group });
    };

    addBarrel(-14, 3, 'red');
    addBarrel(-14.7, 3.4, 'yellow');
    addBarrel(14, -3, 'red');
    addBarrel(14.7, -3.4, 'yellow');
    addBarrel(-28, 22, 'red');
    addBarrel(28, -22, 'yellow');
    addBarrel(0, -24, 'red');
    addBarrel(0, 24, 'yellow');

    // 5. Heavy Vehicle Tire Stacks (Near corners)
    const addTireStack = (x, z, count = 3) => {
      const { group, colliderBox } = this.props.createTireStack(x, 0, z, count);
      this.group.add(group);
      this.colliders.push({ box: colliderBox, type: 'tires', mesh: group });
    };

    addTireStack(-42, -26, 3);
    addTireStack(42, 26, 3);
    addTireStack(-10, 24, 2);
    addTireStack(10, -24, 2);

    // 6. Wooden Cable Reels
    const addReel = (x, z, rotY = 0) => {
      const { group, colliderBox } = this.props.createCableReel(x, 0, z, 0.75, 1.0);
      this.group.add(group);
      this.colliders.push({ box: colliderBox, type: 'reel', mesh: group });
    };

    addReel(-32, -14);
    addReel(32, 14);

    // 7. High-Visibility Safety Bollards
    const addBollard = (x, z) => {
      const { group, colliderBox } = this.props.createSafetyBollard(x, 0, z);
      this.group.add(group);
      this.colliders.push({ box: colliderBox, type: 'bollard', mesh: group });
    };

    // Bollards flanking warehouse bay platform
    addBollard(-26, -36.5);
    addBollard(26, -36.5);
    addBollard(-12, -36.5);
    addBollard(12, -36.5);

    // 8. Parked Industrial Forklift in Depot Bay (Landmark & Solid Cover)
    const { group: forklift, colliderBox: forkBox } = this.props.createForklift(20, 0, -24, -Math.PI / 4);
    this.group.add(forklift);
    this.colliders.push({ box: forkBox, type: 'forklift', mesh: forklift });
  }

  buildLightingStructures() {
    // 4 High-mast industrial floodlight towers in yard corners
    const towerCoords = [
      [-48, -34],
      [48, -34],
      [-48, 34],
      [48, 34]
    ];

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x1e2530,
      roughness: 0.6,
      metalness: 0.4
    });

    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xffaa44,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });

    towerCoords.forEach(([tx, tz]) => {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(tx, 0, tz);

      // Steel mast pole (Height 8.5m)
      const poleGeo = new THREE.CylinderGeometry(0.2, 0.3, 8.5, 8);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4.25;
      pole.castShadow = true;
      towerGroup.add(pole);

      // Floodlight housing bracket
      const headGeo = new THREE.BoxGeometry(1.2, 0.4, 0.8);
      const head = new THREE.Mesh(headGeo, poleMat);
      head.position.y = 8.6;
      towerGroup.add(head);

      // Glowing floodlight fixture
      const bulbGeo = new THREE.BoxGeometry(1.0, 0.2, 0.6);
      const bulb = new THREE.Mesh(bulbGeo, lampMat);
      bulb.position.y = 8.45;
      towerGroup.add(bulb);

      // Warm ambient point light (restrained intensity for performance)
      const pointLight = new THREE.PointLight(0xffedd5, 0.85, 32);
      pointLight.position.set(0, 8.0, 0);
      towerGroup.add(pointLight);

      this.group.add(towerGroup);

      // Pole collision cylinder
      const box = new THREE.Box3(
        new THREE.Vector3(tx - 0.35, 0, tz - 0.35),
        new THREE.Vector3(tx + 0.35, 8.5, tz + 0.35)
      );
      this.colliders.push({ box, type: 'lightpole', mesh: pole });
    });
  }

  /**
   * Giant Harbor Gantry Cranes in Exterior Skybox
   * Placed outside perimeter walls to establish grand container terminal atmosphere
   */
  buildExteriorLandmarks() {
    // Giant maritime gantry crane towering to the North (Z = -68)
    const craneNorth = this.props.createExteriorGantryCrane(0, 0, -68, 0);
    this.group.add(craneNorth);

    // Giant maritime gantry crane towering to the South (Z = 68)
    const craneSouth = this.props.createExteriorGantryCrane(-25, 0, 68, Math.PI);
    this.group.add(craneSouth);

    // Container stack silhouettes in exterior perimeter
    const extMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      metalness: 0.1
    });

    const extBlock1 = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 8), extMat);
    extBlock1.position.set(-65, 5, 0);
    this.group.add(extBlock1);

    const extBlock2 = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 8), extMat);
    extBlock2.position.set(65, 5, 0);
    this.group.add(extBlock2);
  }

  /**
   * Returns spawn coordinates for specified team
   * @param {'red' | 'blue' | 'ffa'} team
   */
  getSpawns(team = 'ffa') {
    return this.spawns[team] || this.spawns.ffa;
  }

  /**
   * Returns a random spawn point for the specified team
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
}
