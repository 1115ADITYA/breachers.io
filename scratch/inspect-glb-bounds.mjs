import fs from 'fs';

const buf = fs.readFileSync('frontend/public/assets/maps/warehouse.glb');
const chunk0Length = buf.readUInt32LE(12);
const chunk0JsonStr = buf.toString('utf8', 20, 20 + chunk0Length);
const gltf = JSON.parse(chunk0JsonStr);

console.log('Scenes count:', gltf.scenes?.length);
const defaultScene = gltf.scenes[gltf.scene || 0];
console.log('Scene name:', defaultScene.name);

// Print root nodes in the default scene
defaultScene.nodes.forEach(nodeIdx => {
  const node = gltf.nodes[nodeIdx];
  console.log(`\nRoot Node [${nodeIdx}]: "${node.name}"`);
  console.log('  mesh:', node.mesh !== undefined ? gltf.meshes[node.mesh]?.name : undefined);
  console.log('  children count:', node.children?.length);
  console.log('  translation:', node.translation);
  console.log('  scale:', node.scale);
  console.log('  rotation:', node.rotation);
  if (node.children) {
    console.log('  first 10 children:');
    node.children.slice(0, 10).forEach(cIdx => {
      const c = gltf.nodes[cIdx];
      console.log(`    Child [${cIdx}]: "${c.name}", mesh=${c.mesh !== undefined ? gltf.meshes[c.mesh]?.name : 'none'}, translation=${c.translation}, scale=${c.scale}`);
    });
  }
});

// Calculate bounds per mesh / node
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

console.log('\n=== GLOBAL BOUNDS SUMMARY ===');
console.log('Min coords: [X, Y, Z] =', [minX, minY, minZ]);
console.log('Max coords: [X, Y, Z] =', [maxX, maxY, maxZ]);
console.log('Dimensions (Width, Height, Depth) =', [maxX - minX, maxY - minY, maxZ - minZ]);
console.log('Center =', [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]);

// Find floor nodes (meshes with "floor", "ground", "plane", or lowest Y)
console.log('\nFloor/Ground candidates:');
(gltf.nodes || []).forEach((node, idx) => {
  const name = (node.name || '').toLowerCase();
  const meshName = node.mesh !== undefined ? (gltf.meshes[node.mesh]?.name || '').toLowerCase() : '';
  if (name.includes('floor') || name.includes('ground') || name.includes('plane') ||
      meshName.includes('floor') || meshName.includes('ground') || meshName.includes('plane') ||
      name.includes('base') || name.includes('wall')) {
    console.log(`Node [${idx}]: name="${node.name}", mesh="${meshName}", pos=${node.translation}`);
  }
});
