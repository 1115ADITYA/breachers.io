import * as THREE from 'three';

/**
 * PhysicsDebugger
 * Development-only real-time physics wireframe visualizer for Breachers.io.
 * Renders active Rapier colliders (capsule, cuboids, static walls, ground plane, dynamic props)
 * using Three.js LineSegments with vertex colors.
 * Toggleable via F3 or P key; disabled by default in production.
 */
export class PhysicsDebugger {
  constructor(scene, physicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.enabled = false;

    // LineSegments visualizer
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthTest: true
    });
    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.visible = false;
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);

    // On-screen debug overlay element
    this.overlay = this.createDebugOverlay();

    this.initKeyboardListener();
  }

  createDebugOverlay() {
    const el = document.createElement('div');
    el.id = 'physics-debug-overlay';
    el.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: rgba(11, 15, 23, 0.85);
      border: 1px solid #f97316;
      border-radius: 6px;
      padding: 10px 14px;
      font-family: monospace;
      font-size: 11px;
      color: #f3f4f6;
      z-index: 100;
      pointer-events: none;
      display: none;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(el);
    return el;
  }

  initKeyboardListener() {
    window.addEventListener('keydown', (e) => {
      // Toggle with F3 or key P (if not typing in text field)
      if (e.code === 'F3' || (e.code === 'KeyP' && document.activeElement.tagName !== 'INPUT')) {
        this.toggle();
        e.preventDefault();
      }
    });
  }

  toggle() {
    this.setEnabled(!this.enabled);
  }

  setEnabled(val) {
    this.enabled = val;
    this.lines.visible = this.enabled;
    this.overlay.style.display = this.enabled ? 'block' : 'none';
    console.log(`[PhysicsDebugger] Physics debug view: ${this.enabled ? 'ENABLED (F3 to toggle)' : 'DISABLED'}`);
  }

  update(playerController = null) {
    if (!this.enabled || !this.physicsWorld || !this.physicsWorld.isReady) {
      if (this.lines.visible) this.lines.visible = false;
      return;
    }

    const debugData = this.physicsWorld.debugRender();
    if (!debugData) return;

    const { vertices, colors } = debugData;

    this.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    this.geometry.computeBoundingSphere();
    this.lines.visible = true;

    // Update overlay metrics
    const grounded = playerController ? playerController.isGrounded : false;
    const pos = playerController ? playerController.position : { x: 0, y: 0, z: 0 };
    const staticCount = this.physicsWorld.staticBodies.length;
    const dynamicCount = this.physicsWorld.dynamicProps.length;

    this.overlay.innerHTML = `
      <div style="color: #f97316; font-weight: bold; margin-bottom: 4px;">PHYSICS DEBUG VIEW [F3]</div>
      <div>Engine: <span style="color: #22c55e;">Rapier 3D (WASM)</span></div>
      <div>Static Colliders: ${staticCount}</div>
      <div>Dynamic Props: ${dynamicCount}</div>
      <div>Grounded: <span style="color: ${grounded ? '#22c55e' : '#ef4444'}; font-weight: bold;">${grounded ? 'YES' : 'AIRBORNE'}</span></div>
      <div>Player Pos: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}</div>
    `;
  }

  dispose() {
    if (this.lines) {
      this.scene.remove(this.lines);
      this.geometry.dispose();
      this.material.dispose();
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}
