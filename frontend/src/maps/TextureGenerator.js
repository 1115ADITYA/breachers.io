import * as THREE from 'three';

/**
 * TextureGenerator
 * Generates high-performance procedural canvas textures for Breachers.io.
 * Creates stylized, crisp industrial textures for ground, containers, wood,
 * warning hazard chevrons, signs, and metal surfaces without any external assets.
 */
export class TextureGenerator {
  static cache = new Map();

  /**
   * Procedural industrial concrete and asphalt ground with lane markings,
   * expansion joints, drainage seams, and tire tracks.
   */
  static createGroundTexture() {
    const key = 'ground_asphalt_concrete';
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 1. Base industrial asphalt/concrete slab color
    ctx.fillStyle = '#222731';
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. Concrete slab expansion joints / grid seams
    ctx.strokeStyle = '#181c24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 512); ctx.lineTo(1024, 512);
    ctx.moveTo(512, 0); ctx.lineTo(512, 1024);
    ctx.stroke();

    // 3. Fine surface aggregate noise and speckle
    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 26;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise + 2)); // slight cool industrial tint
    }
    ctx.putImageData(imgData, 0, 0);

    // 4. Subtle weathered oil patches and tire marks
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const r = 20 + Math.random() * 60;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(12, 15, 20, 0.35)');
      grad.addColorStop(0.6, 'rgba(15, 18, 24, 0.15)');
      grad.addColorStop(1, 'rgba(20, 24, 32, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Crisp painted traffic lines (white dashed lane divider)
    ctx.strokeStyle = 'rgba(240, 245, 255, 0.75)';
    ctx.lineWidth = 8;
    ctx.setLineDash([48, 36]);
    ctx.beginPath();
    ctx.moveTo(128, 0); ctx.lineTo(128, 1024);
    ctx.moveTo(896, 0); ctx.lineTo(896, 1024);
    ctx.stroke();

    // 6. Yellow container crane guideline
    ctx.strokeStyle = 'rgba(245, 166, 35, 0.85)';
    ctx.lineWidth = 10;
    ctx.setLineDash([64, 40]);
    ctx.beginPath();
    ctx.moveTo(0, 256); ctx.lineTo(1024, 256);
    ctx.moveTo(0, 768); ctx.lineTo(1024, 768);
    ctx.stroke();
    ctx.setLineDash([]);

    // 7. Tactical bay stencils ("BAY A", "BAY B", "SPEED 15")
    ctx.fillStyle = 'rgba(230, 235, 245, 0.22)';
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CRANE TRACK 01', 320, 240);
    ctx.fillText('CRANE TRACK 02', 320, 750);
    ctx.fillText('SECTOR DOCK-04', 700, 500);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 8);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Corrugated metal container wall texture with vertical structural ridges,
   * subtle ambient occlusion grooves, rivet lines, and industrial wear.
   */
  static createCorrugatedContainerTexture(baseColorHex, stencilText = '') {
    const key = `container_${baseColorHex}_${stencilText}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base color
    ctx.fillStyle = baseColorHex;
    ctx.fillRect(0, 0, 512, 256);

    // Vertical corrugated ridges
    const ribWidth = 24;
    for (let x = 0; x < 512; x += ribWidth) {
      // Highlight side of ridge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(x, 0, ribWidth * 0.45, 256);

      // Shadowed trough of ridge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fillRect(x + ribWidth * 0.45, 0, ribWidth * 0.55, 256);

      // Deep groove line
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(x + ribWidth - 2, 0, 2, 256);
    }

    // Top and bottom rail shadow
    const railGradTop = ctx.createLinearGradient(0, 0, 0, 24);
    railGradTop.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    railGradTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = railGradTop;
    ctx.fillRect(0, 0, 512, 24);

    const railGradBottom = ctx.createLinearGradient(0, 232, 0, 256);
    railGradBottom.addColorStop(0, 'rgba(0, 0, 0, 0)');
    railGradBottom.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    ctx.fillStyle = railGradBottom;
    ctx.fillRect(0, 232, 512, 24);

    // Weathering scratches & rust speckles
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(70, 30, 10, 0.35)' : 'rgba(255, 255, 255, 0.15)';
      const sx = Math.random() * 512;
      const sy = Math.random() * 256;
      ctx.fillRect(sx, sy, Math.random() * 4 + 1, Math.random() * 2 + 1);
    }

    // Industrial stenciled shipping code
    if (stencilText) {
      ctx.fillStyle = 'rgba(240, 245, 255, 0.82)';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(stencilText, 496, 48);

      ctx.font = '13px monospace';
      ctx.fillText('MAX WT 30480 KG', 496, 70);
      ctx.fillText('PAYLOAD 28250 KG', 496, 88);
      ctx.fillText('CUBE 33.2 CUM', 496, 106);
    }

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Container door end face with twin swinging doors, locking bars,
   * rubber seal perimeter, cam handles, and caution markings.
   */
  static createContainerDoorTexture(baseColorHex, containerId = 'BRCH-01') {
    const key = `container_door_${baseColorHex}_${containerId}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base color
    ctx.fillStyle = baseColorHex;
    ctx.fillRect(0, 0, 256, 256);

    // Outer rubber seal border
    ctx.strokeStyle = '#11141a';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 246, 246);

    // Center door split line
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(126, 0, 4, 256);

    // Locking bars (2 vertical steel pipes per door)
    const barPositions = [45, 95, 161, 211];
    barPositions.forEach(bx => {
      // Bar shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(bx + 4, 15, 8, 226);

      // Steel bar
      const barGrad = ctx.createLinearGradient(bx, 0, bx + 8, 0);
      barGrad.addColorStop(0, '#788294');
      barGrad.addColorStop(0.5, '#c5cedb');
      barGrad.addColorStop(1, '#485262');
      ctx.fillStyle = barGrad;
      ctx.fillRect(bx, 15, 8, 226);

      // Top and bottom cam brackets
      ctx.fillStyle = '#222834';
      ctx.fillRect(bx - 4, 12, 16, 16);
      ctx.fillRect(bx - 4, 228, 16, 16);

      // Center handle
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(bx - 6, 130, 20, 8);
    });

    // Stencil markings
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(containerId, 22, 45);

    ctx.font = '10px monospace';
    ctx.fillText('TARE: 2200 KG', 22, 65);
    ctx.fillText('2.6M HIGH', 22, 80);

    // Hazard diamond
    ctx.fillStyle = '#d92d20';
    ctx.beginPath();
    ctx.moveTo(70, 185);
    ctx.lineTo(82, 173);
    ctx.lineTo(94, 185);
    ctx.lineTo(82, 197);
    ctx.closePath();
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Yellow and black 45-degree tactical hazard warning chevrons
   */
  static createHazardStripeTexture(width = 512, height = 64) {
    const key = `hazard_stripe_${width}x${height}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Yellow background
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, width, height);

    // 45-degree black diagonal stripes
    ctx.fillStyle = '#111827';
    const stripeWidth = 24;
    for (let x = -height; x < width + height; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth + height, height);
      ctx.lineTo(x + height, height);
      ctx.closePath();
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Weathered wood grain for pallets and supply crates
   */
  static createWoodTexture(isDark = false) {
    const key = `wood_${isDark ? 'dark' : 'light'}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = isDark ? '#6b4f2c' : '#a37a4c';
    ctx.fillRect(0, 0, 256, 256);

    // Wood grain lines
    for (let y = 0; y < 256; y += 4) {
      ctx.strokeStyle = `rgba(40, 25, 10, ${0.1 + Math.random() * 0.25})`;
      ctx.lineWidth = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + (Math.random() - 0.5) * 8, 180, y + (Math.random() - 0.5) * 8, 256, y);
      ctx.stroke();
    }

    // Wood plank borders
    ctx.strokeStyle = 'rgba(25, 15, 5, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 252);

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Warehouse corrugated metal wall siding
   */
  static createWarehouseWallTexture() {
    const key = 'warehouse_metal_wall';
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#27303f';
    ctx.fillRect(0, 0, 512, 512);

    // Horizontal metal panels with rivet lines
    const panelHeight = 64;
    for (let y = 0; y < 512; y += panelHeight) {
      // Panel top highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(0, y, 512, 4);

      // Panel seam shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, y + panelHeight - 4, 512, 4);

      // Rivets
      ctx.fillStyle = '#8f9ba8';
      for (let x = 16; x < 512; x += 48) {
        ctx.beginPath();
        ctx.arc(x, y + 8, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y + panelHeight - 12, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Concrete jersey barrier texture with aggregate and formwork lines
   */
  static createConcreteBarrierTexture() {
    const key = 'concrete_barrier';
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, 256, 128);

    // Subtle aggregate noise
    const imgData = ctx.getImageData(0, 0, 256, 128);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 32;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Base splash dirt
    const dirtGrad = ctx.createLinearGradient(0, 80, 0, 128);
    dirtGrad.addColorStop(0, 'rgba(40, 35, 30, 0)');
    dirtGrad.addColorStop(1, 'rgba(40, 35, 30, 0.45)');
    ctx.fillStyle = dirtGrad;
    ctx.fillRect(0, 80, 256, 48);

    // Yellow bottom reflector strip
    ctx.fillStyle = '#eab308';
    ctx.fillRect(18, 100, 220, 12);

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set(key, texture);
    return texture;
  }
}
