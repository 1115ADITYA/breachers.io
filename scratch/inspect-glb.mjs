import fs from 'fs';

const buf = fs.readFileSync('frontend/public/assets/maps/warehouse.glb');
const magic = buf.readUInt32LE(0);
const version = buf.readUInt32LE(4);
const length = buf.readUInt32LE(8);

console.log('GLB Header:', {
  magic: '0x' + magic.toString(16),
  version,
  totalLength: length
});

const chunk0Length = buf.readUInt32LE(12);
const chunk0Type = buf.readUInt32LE(16);
const chunk0JsonStr = buf.toString('utf8', 20, 20 + chunk0Length);
const gltf = JSON.parse(chunk0JsonStr);

console.log('Scenes count:', gltf.scenes?.length);
console.log('Nodes count:', gltf.nodes?.length);
console.log('Meshes count:', gltf.meshes?.length);
console.log('Materials count:', gltf.materials?.length);
console.log('Accessors count:', gltf.accessors?.length);

// Print node names and hierarchy
console.log('\nTop-level nodes in scene:');
const defaultScene = gltf.scenes[gltf.scene || 0];
defaultScene.nodes.forEach(nodeIdx => {
  const node = gltf.nodes[nodeIdx];
  console.log(`Node [${nodeIdx}]: "${node.name}"`, {
    mesh: node.mesh !== undefined ? gltf.meshes[node.mesh]?.name : undefined,
    children: node.children?.length,
    translation: node.translation,
    scale: node.scale,
    rotation: node.rotation
  });
});

// Calculate global min/max bounding box from position accessors
let minX = Infinity, minY = Infinity, minZ = Infinity;
let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

(gltf.meshes || []).forEach((mesh, mIdx) => {
  mesh.primitives.forEach((prim, pIdx) => {
    const posAccessorIdx = prim.attributes.POSITION;
    if (posAccessorIdx !== undefined) {
      const accessor = gltf.accessors[posAccessorIdx];
      if (accessor.min && accessor.max) {
        minX = Math.min(minX, accessor.min[0]);
        minY = Math.min(minY, accessor.min[1]);
        minZ = Math.min(minZ, accessor.min[2]);
        maxX = Math.max(maxX, accessor.max[0]);
        maxY = Math.max(maxY, accessor.max[1]);
        maxZ = Math.max(maxZ, accessor.max[2]);
      }
    }
  });
});

console.log('\nGlobal Accessor Bounds (Raw Model Units):');
console.log({
  min: [minX, minY, minZ],
  max: [maxX, maxY, maxZ],
  size: [maxX - minX, maxY - minY, maxZ - minZ],
  center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
});

// List materials
console.log('\nMaterials:');
(gltf.materials || []).slice(0, 15).forEach((mat, idx) => {
  console.log(`Material [${idx}]: "${mat.name}"`, mat.pbrMetallicRoughness);
});

// List mesh names
console.log('\nMeshes:');
(gltf.meshes || []).forEach((mesh, idx) => {
  console.log(`Mesh [${idx}]: "${mesh.name}" (primitives: ${mesh.primitives.length})`);
});
