import * as THREE from 'three';

/**
 * ContainerYardMap
 * Complete, playable low-poly 3D FPS map for Breachers.io.
 * Generates an industrial freight shipping yard with containers, tactical cover,
 * flanking routes, perimeter security walls, and dedicated TDM / FFA spawn zones.
 */
export class ContainerYardMap {
  constructor() {
    this.name = 'Container Yard';
    this.group = new THREE.Group();
    this.colliders = []; // { box: THREE.Box3, type: string, mesh: THREE.Mesh }

    // Map Dimensions
    this.width = 110;  // X axis: -55 to +55 (West to East)
    this.depth = 80;   // Z axis: -40 to +40 (North to South)
    this.wallHeight = 6.0;

    // Spawns
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

    this.materials = this.initMaterials();
    this.buildMap();
  }

  initMaterials() {
    // Procedural asphalt texture via Canvas
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const ctx = groundCanvas.getContext('2d');
    
    // Dark asphalt base
    ctx.fillStyle = '#1c2028';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle concrete/asphalt noise
    for (let i = 0; i < 4000; i++) {
      const alpha = Math.random() * 0.08;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Yellow tactical ground lane stripes
    ctx.strokeStyle = '#e69500';
    ctx.lineWidth = 6;
    ctx.setLineDash([24, 24]);
    ctx.beginPath();
    ctx.moveTo(64, 0); ctx.lineTo(64, 512);
    ctx.moveTo(448, 0); ctx.lineTo(448, 512);
    ctx.moveTo(0, 256); ctx.lineTo(512, 256);
    ctx.stroke();

    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(12, 9);

    // Shared Materials
    return {
      ground: new THREE.MeshStandardMaterial({
        map: groundTex,
        roughness: 0.85,
        metalness: 0.1
      }),
      wall: new THREE.MeshStandardMaterial({
        color: 0x242a36,
        roughness: 0.7,
        metalness: 0.2
      }),
      wallTrim: new THREE.MeshStandardMaterial({
        color: 0xff6600,
        roughness: 0.4,
        metalness: 0.5
      }),
      barrier: new THREE.MeshStandardMaterial({
        color: 0x596475,
        roughness: 0.8,
        metalness: 0.1
      }),
      crateWood: new THREE.MeshStandardMaterial({
        color: 0xa87544,
        roughness: 0.7,
        metalness: 0.05
      }),
      crateMetal: new THREE.MeshStandardMaterial({
        color: 0x3d4757,
        roughness: 0.5,
        metalness: 0.6
      }),
      barrelRed: new THREE.MeshStandardMaterial({
        color: 0xd92d20,
        roughness: 0.4,
        metalness: 0.4
      }),
      barrelYellow: new THREE.MeshStandardMaterial({
        color: 0xfdb022,
        roughness: 0.4,
        metalness: 0.4
      }),
      // Container color variants
      containerRed: new THREE.MeshStandardMaterial({
        color: 0xb42318,
        roughness: 0.6,
        metalness: 0.3
      }),
      containerBlue: new THREE.MeshStandardMaterial({
        color: 0x175cd3,
        roughness: 0.6,
        metalness: 0.3
      }),
      containerOrange: new THREE.MeshStandardMaterial({
        color: 0xf79009,
        roughness: 0.6,
        metalness: 0.3
      }),
      containerGreen: new THREE.MeshStandardMaterial({
        color: 0x067647,
        roughness: 0.6,
        metalness: 0.3
      }),
      containerGray: new THREE.MeshStandardMaterial({
        color: 0x475467,
        roughness: 0.6,
        metalness: 0.3
      }),
      containerRust: new THREE.MeshStandardMaterial({
        color: 0x7a3a22,
        roughness: 0.7,
        metalness: 0.3
      }),
      spawnPadRed: new THREE.MeshStandardMaterial({
        color: 0xff3344,
        roughness: 0.5,
        metalness: 0.2
      }),
      spawnPadBlue: new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        roughness: 0.5,
        metalness: 0.2
      })
    };
  }

  buildMap() {
    this.buildGround();
    this.buildPerimeterWalls();
    this.buildSpawnZones();
    this.buildShippingContainers();
    this.buildTacticalCover();
    this.buildLightingStructures();
  }

  buildGround() {
    const groundGeo = new THREE.PlaneGeometry(this.width, this.depth);
    const ground = new THREE.Mesh(groundGeo, this.materials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Ground collider: solid plane at y = 0
    const groundBox = new THREE.Box3(
      new THREE.Vector3(-this.width / 2, -1, -this.depth / 2),
      new THREE.Vector3(this.width / 2, 0, this.depth / 2)
    );
    this.colliders.push({ box: groundBox, type: 'ground', mesh: ground });
  }

  buildPerimeterWalls() {
    const halfW = this.width / 2;
    const halfD = this.depth / 2;
    const thickness = 2.0;
    const h = this.wallHeight;

    const wallConfigs = [
      // North Wall
      { w: this.width + thickness * 2, h, d: thickness, x: 0, y: h / 2, z: -halfD - thickness / 2 },
      // South Wall
      { w: this.width + thickness * 2, h, d: thickness, x: 0, y: h / 2, z: halfD + thickness / 2 },
      // West Wall
      { w: thickness, h, d: this.depth, x: -halfW - thickness / 2, y: h / 2, z: 0 },
      // East Wall
      { w: thickness, h, d: this.depth, x: halfW + thickness / 2, y: h / 2, z: 0 }
    ];

    wallConfigs.forEach(c => {
      const geo = new THREE.BoxGeometry(c.w, c.h, c.d);
      const wall = new THREE.Mesh(geo, this.materials.wall);
      wall.position.set(c.x, c.y, c.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);

      // Hazard top trim
      const trimGeo = new THREE.BoxGeometry(c.w, 0.3, c.d + 0.2);
      const trim = new THREE.Mesh(trimGeo, this.materials.wallTrim);
      trim.position.set(c.x, h + 0.15, c.z);
      this.group.add(trim);

      // Add wall collider
      const box = new THREE.Box3();
      box.setFromObject(wall);
      this.colliders.push({ box, type: 'wall', mesh: wall });
    });
  }

  buildSpawnZones() {
    // Red Base (West)
    const redBase = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.05, 18),
      this.materials.spawnPadRed
    );
    redBase.position.set(-46, 0.025, 0);
    redBase.receiveShadow = true;
    this.group.add(redBase);

    // Blue Base (East)
    const blueBase = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.05, 18),
      this.materials.spawnPadBlue
    );
    blueBase.position.set(46, 0.025, 0);
    blueBase.receiveShadow = true;
    this.group.add(blueBase);

    // Protective bunker containers behind each spawn
    this.createContainer(-50, 0, 0, 2.5, 2.6, 14, this.materials.containerRed);
    this.createContainer(50, 0, 0, 2.5, 2.6, 14, this.materials.containerBlue);
  }

  /**
   * Helper to create a solid shipping container with structural ribs
   */
  createContainer(x, y, z, width, height, length, material, rotY = 0) {
    const containerGroup = new THREE.Group();
    containerGroup.position.set(x, y + height / 2, z);
    containerGroup.rotation.y = rotY;

    // Main box body
    const bodyGeo = new THREE.BoxGeometry(width, height, length);
    const body = new THREE.Mesh(bodyGeo, material);
    body.castShadow = true;
    body.receiveShadow = true;
    containerGroup.add(body);

    // Corner posts (industrial detail)
    const postGeo = new THREE.BoxGeometry(0.25, height + 0.05, 0.25);
    const postMat = this.materials.wall;
    const halfW = width / 2;
    const halfL = length / 2;

    const corners = [
      [-halfW, -halfL],
      [halfW, -halfL],
      [-halfW, halfL],
      [halfW, halfL]
    ];

    corners.forEach(([cx, cz]) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(cx, 0, cz);
      containerGroup.add(post);
    });

    this.group.add(containerGroup);

    // Register AABB Collider for physics/collision
    const box = new THREE.Box3();
    box.setFromObject(containerGroup);
    this.colliders.push({ box, type: 'container', mesh: containerGroup });

    return containerGroup;
  }

  buildShippingContainers() {
    // Standard sizes:
    // 20ft: width 2.5, height 2.6, length 6.0
    // 40ft: width 2.5, height 2.6, length 12.0

    // ---------------------------------------------------------
    // 1. CENTRAL COMBAT ARENA (Balanced layout with chokepoints)
    // ---------------------------------------------------------
    // Center cluster: broken sightlines between West and East
    this.createContainer(-6, 0, -4, 2.5, 2.6, 12, this.materials.containerOrange);
    this.createContainer(6, 0, 4, 2.5, 2.6, 12, this.materials.containerBlue);
    
    // Stacked high-ground container in the center
    this.createContainer(0, 2.6, 0, 2.5, 2.6, 6, this.materials.containerRust, Math.PI / 2);

    // Center lateral barriers
    this.createContainer(0, 0, -18, 2.5, 2.6, 10, this.materials.containerRed, Math.PI / 2);
    this.createContainer(0, 0, 18, 2.5, 2.6, 10, this.materials.containerGreen, Math.PI / 2);

    // ---------------------------------------------------------
    // 2. WEST / RED APPROACH
    // ---------------------------------------------------------
    // West Forward Container Stack (1st and 2nd tier)
    this.createContainer(-26, 0, -12, 2.5, 2.6, 12, this.materials.containerRed);
    this.createContainer(-26, 2.6, -12, 2.5, 2.6, 6, this.materials.containerGray); // Tier 2

    this.createContainer(-26, 0, 14, 2.5, 2.6, 12, this.materials.containerRust);
    this.createContainer(-34, 0, 2, 2.5, 2.6, 6, this.materials.containerOrange, Math.PI / 4);
    this.createContainer(-34, 0, -20, 2.5, 2.6, 6, this.materials.containerBlue);

    // ---------------------------------------------------------
    // 3. EAST / BLUE APPROACH
    // ---------------------------------------------------------
    // East Forward Container Stack (1st and 2nd tier)
    this.createContainer(26, 0, 12, 2.5, 2.6, 12, this.materials.containerBlue);
    this.createContainer(26, 2.6, 12, 2.5, 2.6, 6, this.materials.containerOrange); // Tier 2

    this.createContainer(26, 0, -14, 2.5, 2.6, 12, this.materials.containerRed);
    this.createContainer(34, 0, -2, 2.5, 2.6, 6, this.materials.containerGreen, -Math.PI / 4);
    this.createContainer(34, 0, 20, 2.5, 2.6, 6, this.materials.containerGray);

    // ---------------------------------------------------------
    // 4. NORTH FLANKING LANE (Depot / Tight Corridor)
    // ---------------------------------------------------------
    this.createContainer(-16, 0, -30, 2.5, 2.6, 12, this.materials.containerBlue, Math.PI / 2);
    this.createContainer(16, 0, -30, 2.5, 2.6, 12, this.materials.containerRust, Math.PI / 2);
    this.createContainer(-38, 0, -32, 2.5, 2.6, 6, this.materials.containerOrange);
    this.createContainer(38, 0, -32, 2.5, 2.6, 6, this.materials.containerRed);

    // ---------------------------------------------------------
    // 5. SOUTH FLANKING LANE (Train Line / Long Sightlines)
    // ---------------------------------------------------------
    this.createContainer(-16, 0, 30, 2.5, 2.6, 12, this.materials.containerGreen, Math.PI / 2);
    this.createContainer(16, 0, 30, 2.5, 2.6, 12, this.materials.containerOrange, Math.PI / 2);
    this.createContainer(-38, 0, 32, 2.5, 2.6, 6, this.materials.containerGray);
    this.createContainer(38, 0, 32, 2.5, 2.6, 6, this.materials.containerBlue);
  }

  buildTacticalCover() {
    // ---------------------------------------------------------
    // 1. Concrete Jersey Barriers (Height ~1.1m, Width ~0.5m, Length ~3m)
    // ---------------------------------------------------------
    const createBarrier = (x, z, rotY = 0) => {
      const geo = new THREE.BoxGeometry(0.5, 1.1, 3.0);
      const mesh = new THREE.Mesh(geo, this.materials.barrier);
      mesh.position.set(x, 0.55, z);
      mesh.rotation.y = rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ box, type: 'barrier', mesh });
    };

    // Barriers in combat lanes and chokepoints
    createBarrier(-12, 0, 0);
    createBarrier(12, 0, 0);
    createBarrier(-8, -12, Math.PI / 3);
    createBarrier(8, 12, Math.PI / 3);
    createBarrier(0, -10, Math.PI / 2);
    createBarrier(0, 10, Math.PI / 2);
    createBarrier(-22, -26, 0);
    createBarrier(22, 26, 0);
    createBarrier(-40, 14, Math.PI / 6);
    createBarrier(40, -14, -Math.PI / 6);

    // ---------------------------------------------------------
    // 2. Wooden & Metal Supply Crates (Climbable stepping stones)
    // ---------------------------------------------------------
    const createCrate = (x, y, z, size, material) => {
      const geo = new THREE.BoxGeometry(size, size, size);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y + size / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ box, type: 'crate', mesh });
    };

    // Parkour Stairs up to Center Tier 2 Container
    createCrate(-2.5, 0, -8, 1.0, this.materials.crateWood);
    createCrate(-2.5, 0.9, -8, 0.9, this.materials.crateMetal);
    createCrate(-1.5, 0, -5, 1.4, this.materials.crateWood);
    createCrate(1.5, 0, 5, 1.4, this.materials.crateWood);

    // Stairs up to West Container Stack (-26, 0, -12)
    createCrate(-23, 0, -16, 1.0, this.materials.crateWood);
    createCrate(-23, 0.9, -15, 0.9, this.materials.crateMetal);
    createCrate(-24, 1.8, -14, 0.9, this.materials.crateWood);

    // Stairs up to East Container Stack (26, 0, 12)
    createCrate(23, 0, 16, 1.0, this.materials.crateWood);
    createCrate(23, 0.9, 15, 0.9, this.materials.crateMetal);
    createCrate(24, 1.8, 14, 0.9, this.materials.crateWood);

    // Additional tactical cover crates throughout map
    createCrate(-18, 0, 10, 1.2, this.materials.crateWood);
    createCrate(18, 0, -10, 1.2, this.materials.crateWood);
    createCrate(-30, 0, -8, 1.1, this.materials.crateMetal);
    createCrate(30, 0, 8, 1.1, this.materials.crateMetal);
    createCrate(-6, 0, 22, 1.2, this.materials.crateWood);
    createCrate(6, 0, -22, 1.2, this.materials.crateWood);

    // ---------------------------------------------------------
    // 3. Industrial Barrels (Radius 0.4m, Height 1.1m)
    // ---------------------------------------------------------
    const createBarrel = (x, z, material) => {
      const geo = new THREE.CylinderGeometry(0.4, 0.4, 1.1, 10);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, 0.55, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      // Approximate cylinder with bounding box for collision
      const box = new THREE.Box3(
        new THREE.Vector3(x - 0.4, 0, z - 0.4),
        new THREE.Vector3(x + 0.4, 1.1, z + 0.4)
      );
      this.colliders.push({ box, type: 'barrel', mesh });
    };

    createBarrel(-14, 3, this.materials.barrelRed);
    createBarrel(-14.7, 3.4, this.materials.barrelYellow);
    createBarrel(14, -3, this.materials.barrelRed);
    createBarrel(14.7, -3.4, this.materials.barrelYellow);
    createBarrel(-28, 22, this.materials.barrelRed);
    createBarrel(28, -22, this.materials.barrelYellow);
    createBarrel(0, -24, this.materials.barrelRed);
    createBarrel(0, 24, this.materials.barrelYellow);
  }

  buildLightingStructures() {
    // 4 Corner floodlight towers
    const towerCoords = [
      [-48, -34],
      [48, -34],
      [-48, 34],
      [48, 34]
    ];

    towerCoords.forEach(([tx, tz]) => {
      const poleGeo = new THREE.CylinderGeometry(0.2, 0.25, 7, 8);
      const pole = new THREE.Mesh(poleGeo, this.materials.wall);
      pole.position.set(tx, 3.5, tz);
      pole.castShadow = true;
      this.group.add(pole);

      const lampHeadGeo = new THREE.BoxGeometry(0.8, 0.4, 0.8);
      const lampHead = new THREE.Mesh(lampHeadGeo, this.materials.wallTrim);
      lampHead.position.set(tx, 7.2, tz);
      this.group.add(lampHead);

      // Light source
      const light = new THREE.PointLight(0xffeedd, 1.2, 35);
      light.position.set(tx, 6.8, tz);
      this.group.add(light);

      // Register pole collision
      const box = new THREE.Box3(
        new THREE.Vector3(tx - 0.3, 0, tz - 0.3),
        new THREE.Vector3(tx + 0.3, 7.2, tz + 0.3)
      );
      this.colliders.push({ box, type: 'lightpole', mesh: pole });
    });
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
