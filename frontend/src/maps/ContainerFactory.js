import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

/**
 * ContainerFactory
 * Constructs highly detailed, stylized ISO shipping containers for Breachers.io.
 * Features corrugated metal sides, authentic door hardware (locking rods, cams, handles),
 * roof ribs, corner casting blocks, and clean AABB physics collision envelopes.
 */
export class ContainerFactory {
  constructor() {
    this.materialsCache = new Map();
    this.sharedCornerPostGeo = new THREE.BoxGeometry(0.18, 2.6, 0.18);
    this.sharedCornerBlockGeo = new THREE.BoxGeometry(0.24, 0.22, 0.24);
    this.sharedRailHGeo = null;
    this.sharedRailLGeo = null;

    // Dark structural steel material for frames, corner castings, and locking rods
    this.frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f242d,
      roughness: 0.65,
      metalness: 0.4
    });

    this.silverMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.8
    });
  }

  /**
   * Retrieves or creates a set of multi-face materials for a container color variant
   */
  getContainerMaterials(baseColorHex, stencilCode = 'BRCH') {
    const key = `${baseColorHex}_${stencilCode}`;
    if (this.materialsCache.has(key)) return this.materialsCache.get(key);

    const sideTex = TextureGenerator.createCorrugatedContainerTexture(baseColorHex, stencilCode);
    sideTex.wrapS = THREE.RepeatWrapping;
    sideTex.wrapT = THREE.ClampToEdgeWrapping;

    const doorTex = TextureGenerator.createContainerDoorTexture(baseColorHex, `${stencilCode}-04`);
    const rearTex = TextureGenerator.createCorrugatedContainerTexture(baseColorHex, '');

    // Materials: [right, left, top, bottom, front (door), back]
    const materials = [
      // 0: Right side (+X)
      new THREE.MeshStandardMaterial({
        map: sideTex,
        roughness: 0.6,
        metalness: 0.25
      }),
      // 1: Left side (-X)
      new THREE.MeshStandardMaterial({
        map: sideTex,
        roughness: 0.6,
        metalness: 0.25
      }),
      // 2: Top roof (+Y)
      new THREE.MeshStandardMaterial({
        color: baseColorHex,
        roughness: 0.8,
        metalness: 0.3
      }),
      // 3: Bottom floor (-Y)
      new THREE.MeshStandardMaterial({
        color: 0x1a1e24,
        roughness: 0.9,
        metalness: 0.1
      }),
      // 4: Front face (+Z) -> Container Double Doors
      new THREE.MeshStandardMaterial({
        map: doorTex,
        roughness: 0.55,
        metalness: 0.35
      }),
      // 5: Back face (-Z) -> Closed corrugated end
      new THREE.MeshStandardMaterial({
        map: rearTex,
        roughness: 0.6,
        metalness: 0.25
      })
    ];

    this.materialsCache.set(key, materials);
    return materials;
  }

  /**
   * Builds an authentic ISO shipping container
   * 
   * @param {number} x - Center X position
   * @param {number} y - Bottom Y position (e.g. 0 for ground)
   * @param {number} z - Center Z position
   * @param {number} width - Container width (typically 2.5m)
   * @param {number} height - Container height (typically 2.6m)
   * @param {number} length - Container length (typically 6.0m or 12.0m)
   * @param {string} baseColorHex - Hex color code (e.g. '#c2410c')
   * @param {number} rotY - Rotation in radians
   * @param {string} stencilCode - Custom stencil code (e.g. 'RED-01')
   * @returns {{ group: THREE.Group, colliderBox: THREE.Box3 }}
   */
  createContainer(x, y, z, width = 2.5, height = 2.6, length = 12.0, baseColorHex = '#c2410c', rotY = 0, stencilCode = 'BRCH') {
    const group = new THREE.Group();
    group.position.set(x, y + height / 2, z);
    group.rotation.y = rotY;

    const materials = this.getContainerMaterials(baseColorHex, stencilCode);

    // 1. Main Body Box with specialized face textures
    const bodyGeo = new THREE.BoxGeometry(width, height, length);
    const bodyMesh = new THREE.Mesh(bodyGeo, materials);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // 2. Heavy Steel Perimeter Structural Framework
    const halfW = width / 2;
    const halfH = height / 2;
    const halfL = length / 2;

    // 4 Vertical corner posts with corner casting blocks
    const cornerOffsets = [
      [-halfW, -halfL],
      [halfW, -halfL],
      [-halfW, halfL],
      [halfW, halfL]
    ];

    cornerOffsets.forEach(([cx, cz]) => {
      // Main vertical post
      const post = new THREE.Mesh(this.sharedCornerPostGeo, this.frameMaterial);
      post.position.set(cx, 0, cz);
      group.add(post);

      // Top corner casting
      const topCasting = new THREE.Mesh(this.sharedCornerBlockGeo, this.silverMetalMaterial);
      topCasting.position.set(cx, halfH - 0.1, cz);
      group.add(topCasting);

      // Bottom corner casting
      const btmCasting = new THREE.Mesh(this.sharedCornerBlockGeo, this.silverMetalMaterial);
      btmCasting.position.set(cx, -halfH + 0.1, cz);
      group.add(btmCasting);
    });

    // Top and Bottom Longitudinal Rails (along length)
    const longRailGeo = new THREE.BoxGeometry(0.12, 0.14, length);
    const railPositions = [
      [-halfW, halfH - 0.07, 0],
      [halfW, halfH - 0.07, 0],
      [-halfW, -halfH + 0.07, 0],
      [halfW, -halfH + 0.07, 0]
    ];

    railPositions.forEach(([rx, ry, rz]) => {
      const rail = new THREE.Mesh(longRailGeo, this.frameMaterial);
      rail.position.set(rx, ry, rz);
      group.add(rail);
    });

    // Top and Bottom End Rails (along width)
    const endRailGeo = new THREE.BoxGeometry(width, 0.14, 0.12);
    const endRailPositions = [
      [0, halfH - 0.07, -halfL],
      [0, halfH - 0.07, halfL],
      [0, -halfH + 0.07, -halfL],
      [0, -halfH + 0.07, halfL]
    ];

    endRailPositions.forEach(([rx, ry, rz]) => {
      const rail = new THREE.Mesh(endRailGeo, this.frameMaterial);
      rail.position.set(rx, ry, rz);
      group.add(rail);
    });

    // 3. Roof Reinforcement Ribs (subtle 3D ridges across roof)
    const ribCount = Math.floor(length / 1.2);
    const roofRibGeo = new THREE.BoxGeometry(width - 0.2, 0.06, 0.08);
    for (let i = 0; i < ribCount; i++) {
      const rz = -halfL + 0.6 + i * 1.2;
      const roofRib = new THREE.Mesh(roofRibGeo, this.frameMaterial);
      roofRib.position.set(0, halfH + 0.02, rz);
      group.add(roofRib);
    }

    // 4. Clean Physics AABB Collider (Accurately matches outer envelope)
    group.updateMatrixWorld(true);
    const colliderBox = new THREE.Box3().setFromObject(group);

    return { group, colliderBox };
  }
}
