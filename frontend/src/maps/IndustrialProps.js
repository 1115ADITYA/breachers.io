import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

/**
 * IndustrialProps
 * Factory for highly optimized, stylized industrial environmental props:
 * wooden pallets, supply crates, concrete barriers, steel drums, tire stacks,
 * cable reels, safety bollards, warning signage, and exterior gantry cranes.
 */
export class IndustrialProps {
  constructor() {
    this.woodMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createWoodTexture(false),
      roughness: 0.75,
      metalness: 0.05
    });

    this.darkWoodMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createWoodTexture(true),
      roughness: 0.8,
      metalness: 0.05
    });

    this.metalCrateMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.65
    });

    this.barrierMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createConcreteBarrierTexture(),
      roughness: 0.85,
      metalness: 0.1
    });

    this.hazardStripeMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createHazardStripeTexture(),
      roughness: 0.5,
      metalness: 0.2
    });

    this.rubberMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.9,
      metalness: 0.05
    });

    this.yellowBollardMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.4,
      metalness: 0.3
    });

    this.darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.5
    });

    this.redBarrelMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.35,
      metalness: 0.45
    });

    this.yellowBarrelMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.45
    });

    this.cableCoilMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.9,
      metalness: 0.1
    });
  }

  /**
   * Standard Euro-Pallet (1.2m x 0.15m x 0.8m)
   */
  createPallet(x, y, z, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y + 0.075, z);
    group.rotation.y = rotY;

    // 3 Bottom skids
    const skidGeo = new THREE.BoxGeometry(1.2, 0.05, 0.1);
    [-0.32, 0, 0.32].forEach(sz => {
      const skid = new THREE.Mesh(skidGeo, this.darkWoodMat);
      skid.position.set(0, -0.05, sz);
      skid.castShadow = true;
      group.add(skid);
    });

    // 5 Top planks
    const plankGeo = new THREE.BoxGeometry(0.14, 0.03, 0.8);
    [-0.48, -0.24, 0, 0.24, 0.48].forEach(px => {
      const plank = new THREE.Mesh(plankGeo, this.woodMat);
      plank.position.set(px, 0.06, 0);
      plank.castShadow = true;
      plank.receiveShadow = true;
      group.add(plank);
    });

    const box = new THREE.Box3(
      new THREE.Vector3(x - 0.6, y, z - 0.4),
      new THREE.Vector3(x + 0.6, y + 0.15, z + 0.4)
    );

    return { group, colliderBox: box };
  }

  /**
   * Stacked Euro-Pallets (3 layers)
   */
  createPalletStack(x, y, z, count = 3, rotY = 0) {
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const pallet = this.createPallet(x, y + i * 0.15, z, rotY + (i % 2 === 1 ? 0.08 : 0));
      group.add(pallet.group);
    }
    const box = new THREE.Box3(
      new THREE.Vector3(x - 0.65, y, z - 0.45),
      new THREE.Vector3(x + 0.65, y + count * 0.15, z + 0.45)
    );
    return { group, colliderBox: box };
  }

  /**
   * Detailed Wooden or Metal Supply Crate with corner angle brackets
   */
  createCrate(x, y, z, size = 1.2, isMetal = false, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y + size / 2, z);
    group.rotation.y = rotY;

    // Main cube body
    const bodyGeo = new THREE.BoxGeometry(size, size, size);
    const bodyMat = isMetal ? this.metalCrateMat : this.woodMat;
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Structural framing bands
    const frameGeo = new THREE.BoxGeometry(size + 0.02, 0.06, size + 0.02);
    const frameMat = isMetal ? this.darkSteelMat : this.darkWoodMat;
    const fTop = new THREE.Mesh(frameGeo, frameMat);
    fTop.position.y = size / 2 - 0.04;
    group.add(fTop);
    const fBtm = new THREE.Mesh(frameGeo, frameMat);
    fBtm.position.y = -size / 2 + 0.04;
    group.add(fBtm);

    // Hazard stencil banner on metal crates
    if (isMetal) {
      const hazardGeo = new THREE.BoxGeometry(size + 0.03, 0.14, size * 0.6);
      const hazard = new THREE.Mesh(hazardGeo, this.hazardStripeMat);
      hazard.position.y = 0;
      group.add(hazard);
    }

    const box = new THREE.Box3().setFromObject(group);
    return { group, colliderBox: box };
  }

  /**
   * Concrete Jersey Barrier with bottom drainage / forklift slots
   */
  createJerseyBarrier(x, y, z, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    // Base section (wider)
    const baseGeo = new THREE.BoxGeometry(0.65, 0.35, 3.0);
    const base = new THREE.Mesh(baseGeo, this.barrierMat);
    base.position.y = 0.175;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Top section (tapered)
    const topGeo = new THREE.BoxGeometry(0.35, 0.85, 3.0);
    const top = new THREE.Mesh(topGeo, this.barrierMat);
    top.position.y = 0.775;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // Yellow warning hazard cap
    const capGeo = new THREE.BoxGeometry(0.37, 0.06, 2.9);
    const cap = new THREE.Mesh(capGeo, this.hazardStripeMat);
    cap.position.y = 1.2;
    group.add(cap);

    const box = new THREE.Box3(
      new THREE.Vector3(x - 0.35, y, z - 1.55),
      new THREE.Vector3(x + 0.35, y + 1.25, z + 1.55)
    );
    if (Math.abs(rotY) > 0.01) {
      group.updateMatrixWorld(true);
      box.setFromObject(group);
    }

    return { group, colliderBox: box };
  }

  /**
   * Industrial Steel Drum / Barrel with chime ribs and bung caps
   */
  createSteelBarrel(x, y, z, color = 'red') {
    const group = new THREE.Group();
    group.position.set(x, y + 0.55, z);

    const mat = color === 'yellow' ? this.yellowBarrelMat : this.redBarrelMat;

    // Barrel cylinder body
    const bodyGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.1, 14);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 2 Rolled chime expansion rings
    const ringGeo = new THREE.TorusGeometry(0.385, 0.018, 6, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ring1 = new THREE.Mesh(ringGeo, this.darkSteelMat);
    ring1.position.y = 0.18;
    group.add(ring1);
    const ring2 = new THREE.Mesh(ringGeo, this.darkSteelMat);
    ring2.position.y = -0.18;
    group.add(ring2);

    // Top bung cap
    const capGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 8);
    const cap = new THREE.Mesh(capGeo, this.darkSteelMat);
    cap.position.set(0.18, 0.56, 0.08);
    group.add(cap);

    const box = new THREE.Box3(
      new THREE.Vector3(x - 0.4, y, z - 0.4),
      new THREE.Vector3(x + 0.4, y + 1.15, z + 0.4)
    );

    return { group, colliderBox: box };
  }

  /**
   * Stacked Heavy Vehicle / Crane Tires
   */
  createTireStack(x, y, z, count = 3) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    for (let i = 0; i < count; i++) {
      const tireGeo = new THREE.TorusGeometry(0.5, 0.22, 8, 18);
      tireGeo.rotateX(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, this.rubberMat);
      tire.position.y = 0.22 + i * 0.42;
      tire.castShadow = true;
      tire.receiveShadow = true;
      group.add(tire);
    }

    const totalHeight = 0.22 + count * 0.42;
    const box = new THREE.Box3(
      new THREE.Vector3(x - 0.65, y, z - 0.65),
      new THREE.Vector3(x + 0.65, y + totalHeight, z + 0.65)
    );

    return { group, colliderBox: box };
  }

  /**
   * Wooden Cable Spool / Cable Reel
   */
  createCableReel(x, y, z, radius = 0.75, height = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Two wooden flange discs
    const discGeo = new THREE.CylinderGeometry(radius, radius, 0.06, 16);
    const dBottom = new THREE.Mesh(discGeo, this.darkWoodMat);
    dBottom.position.y = 0.03;
    dBottom.castShadow = true;
    group.add(dBottom);

    const dTop = new THREE.Mesh(discGeo, this.darkWoodMat);
    dTop.position.y = height - 0.03;
    dTop.castShadow = true;
    group.add(dTop);

    // Central core cylinder with coiled cable
    const coreGeo = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, height - 0.06, 16);
    const core = new THREE.Mesh(coreGeo, this.cableCoilMat);
    core.position.y = height / 2;
    core.castShadow = true;
    group.add(core);

    const box = new THREE.Box3(
      new THREE.Vector3(x - radius, y, z - radius),
      new THREE.Vector3(x + radius, y + height, z + radius)
    );

    return { group, colliderBox: box };
  }

  /**
   * High-Visibility Steel Safety Bollard
   */
  createSafetyBollard(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Main yellow post
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.1, 10);
    const post = new THREE.Mesh(postGeo, this.yellowBollardMat);
    post.position.y = 0.55;
    post.castShadow = true;
    group.add(post);

    // Black domed cap
    const capGeo = new THREE.SphereGeometry(0.12, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, this.darkSteelMat);
    cap.position.y = 1.1;
    group.add(cap);

    // White reflective collar band
    const collarGeo = new THREE.CylinderGeometry(0.125, 0.125, 0.15, 10);
    const collar = new THREE.Mesh(collarGeo, this.silverMetalMaterial);
    collar.position.y = 0.95;
    group.add(collar);

    const box = new THREE.Box3(
      new THREE.Vector3(x - 0.18, y, z - 0.18),
      new THREE.Vector3(x + 0.18, y + 1.2, z + 0.18)
    );

    return { group, colliderBox: box };
  }

  /**
   * Stylized Industrial Forklift Landmark / Heavy Cover
   */
  createForklift(x, y, z, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    // 1. Chassis Body (Industrial Orange)
    const chassisGeo = new THREE.BoxGeometry(1.6, 0.8, 2.6);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.45,
      metalness: 0.35
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.set(0, 0.65, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);

    // 2. Heavy Rear Counterweight
    const counterGeo = new THREE.BoxGeometry(1.55, 0.75, 0.65);
    const counter = new THREE.Mesh(counterGeo, this.darkSteelMat);
    counter.position.set(0, 0.68, 1.05);
    counter.castShadow = true;
    group.add(counter);

    // 3. Roll Cage / Overhead Guard
    const cageGeo = new THREE.BoxGeometry(1.3, 1.4, 1.4);
    const cageWire = new THREE.Mesh(cageGeo, this.darkSteelMat);
    cageWire.position.set(0, 1.75, -0.1);
    group.add(cageWire);

    // 4. Front Mast Mast Rails
    const mastGeo = new THREE.BoxGeometry(0.15, 2.4, 0.15);
    const mastL = new THREE.Mesh(mastGeo, this.darkSteelMat);
    mastL.position.set(-0.55, 1.25, -1.4);
    group.add(mastL);
    const mastR = new THREE.Mesh(mastGeo, this.darkSteelMat);
    mastR.position.set(0.55, 1.25, -1.4);
    group.add(mastR);

    // 5. Forks Carriage
    const forkGeo = new THREE.BoxGeometry(0.12, 0.05, 1.4);
    const forkL = new THREE.Mesh(forkGeo, this.silverMetalMaterial);
    forkL.position.set(-0.35, 0.1, -2.05);
    group.add(forkL);
    const forkR = new THREE.Mesh(forkGeo, this.silverMetalMaterial);
    forkR.position.set(0.35, 0.1, -2.05);
    group.add(forkR);

    // 6. 4 Heavy Duty Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelCoords = [
      [-0.85, 0.35, -0.75],
      [0.85, 0.35, -0.75],
      [-0.85, 0.35, 0.75],
      [0.85, 0.35, 0.75]
    ];
    wheelCoords.forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wheelGeo, this.rubberMat);
      w.position.set(wx, wy, wz);
      w.castShadow = true;
      group.add(w);
    });

    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);

    return { group, colliderBox: box };
  }

  /**
   * Giant Harbor Gantry Cranes in Exterior Skybox
   * Placed outside perimeter walls (Z = -65, Z = 65, X = -85) to create
   * grand port atmosphere without any gameplay collision.
   */
  createExteriorGantryCrane(x, y, z, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const craneMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Vibrant maritime cyan blue
      roughness: 0.5,
      metalness: 0.5
    });

    // 4 Massive angled A-frame legs (Height 32m)
    const legGeo = new THREE.BoxGeometry(1.2, 32, 1.2);
    const legConfigs = [
      [-9, 16, -7, 0.12, 0],
      [9, 16, -7, -0.12, 0],
      [-9, 16, 7, 0.12, 0],
      [9, 16, 7, -0.12, 0]
    ];
    legConfigs.forEach(([lx, ly, lz, rx, rz]) => {
      const leg = new THREE.Mesh(legGeo, craneMat);
      leg.position.set(lx, ly, lz);
      leg.rotation.z = rx;
      group.add(leg);
    });

    // Main Overhead Boom Girder (Length 55m)
    const boomGeo = new THREE.BoxGeometry(60, 2.8, 3.5);
    const boom = new THREE.Mesh(boomGeo, craneMat);
    boom.position.set(0, 31, 0);
    group.add(boom);

    // Operator Cabin & Trolley Hoist
    const cabinGeo = new THREE.BoxGeometry(4.0, 3.0, 4.0);
    const cabin = new THREE.Mesh(cabinGeo, this.yellowBollardMat);
    cabin.position.set(-6, 27.5, 0);
    group.add(cabin);

    // Cables & Container Spreader
    const spreaderGeo = new THREE.BoxGeometry(12, 0.6, 2.5);
    const spreader = new THREE.Mesh(spreaderGeo, this.hazardStripeMat);
    spreader.position.set(-6, 18, 0);
    group.add(spreader);

    return group;
  }
}
