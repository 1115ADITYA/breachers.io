import * as THREE from 'three';
import { getOperator } from './OperatorRegistry.js';

/**
 * MenuPreviewScene
 * Manages the high-end 3D tactical Operator & Weapon preview in the Main Menu,
 * Operator Selection, and Loadout screens. Supports interactive drag rotation,
 * idle breathing animations, and dynamic material/variant switching.
 */
export class MenuPreviewScene {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 1.25, 3.8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(480, 600);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.domElement = this.renderer.domElement;
    this.domElement.className = 'operator-preview-canvas';
    if (this.container) {
      this.container.appendChild(this.domElement);
    }

    this.operatorGroup = new THREE.Group();
    this.weaponPreviewGroup = new THREE.Group();
    this.scene.add(this.operatorGroup);
    this.scene.add(this.weaponPreviewGroup);
    this.weaponPreviewGroup.visible = false;

    // Interactive Drag Rotation
    this.isDragging = false;
    this.prevMouseX = 0;
    this.targetRotationY = 0.25;
    this.currentRotationY = 0.25;
    this.rotationVelocity = 0;
    this.autoRotate = true;

    // Materials dictionary
    this.materials = {};

    this.initLighting();
    this.initPedestal();
    this.initEventListeners();
    this.loadOperator('vanguard');

    this.animTimer = 0;
    this.isActive = true;
    this.animate();
  }

  mount(canvasContainer) {
    this.container = canvasContainer;
    if (this.container && !this.container.contains(this.domElement)) {
      this.container.appendChild(this.domElement);
    }
  }

  initLighting() {
    // Soft ambient fill
    const ambient = new THREE.AmbientLight(0x182030, 0.85);
    this.scene.add(ambient);

    // Key Light (Warm tactical rim)
    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    keyLight.position.set(3, 4, 3);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    // Rim / Backlight (Cool cyber-tactical cyan rim)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.8);
    rimLight.position.set(-3, 3, -3);
    this.scene.add(rimLight);

    // Subtle orange underglow
    const underGlow = new THREE.PointLight(0xf97316, 1.4, 6);
    underGlow.position.set(0, 0.1, 0.5);
    this.scene.add(underGlow);
  }

  initPedestal() {
    // High-tech circular deployment platform
    const platformGeo = new THREE.CylinderGeometry(1.3, 1.4, 0.1, 32);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.8
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.05;
    platform.receiveShadow = true;
    this.scene.add(platform);

    // Glowing perimeter ring
    const ringGeo = new THREE.RingGeometry(1.22, 1.28, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    this.scene.add(ring);
  }

  initEventListeners() {
    this.domElement.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.autoRotate = false;
      this.prevMouseX = e.clientX;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.prevMouseX;
      this.prevMouseX = e.clientX;
      this.targetRotationY += deltaX * 0.012;
      this.rotationVelocity = deltaX * 0.012;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch support for mobile / touchpads
    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.autoRotate = false;
        this.prevMouseX = e.touches[0].clientX;
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - this.prevMouseX;
      this.prevMouseX = e.touches[0].clientX;
      this.targetRotationY += deltaX * 0.015;
    });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  loadOperator(operatorId, variantId = 'standard') {
    const config = getOperator(operatorId);
    let armorColor = config.armorColor;
    let visorColor = config.visorColor;

    if (variantId && config.variants) {
      const v = config.variants.find(x => x.id === variantId);
      if (v) {
        armorColor = v.armor;
        visorColor = v.visor;
      }
    }

    // Clear old model
    while (this.operatorGroup.children.length > 0) {
      const child = this.operatorGroup.children[0];
      this.operatorGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    // Build stylized military operator
    this.materials.armor = new THREE.MeshStandardMaterial({
      color: armorColor,
      roughness: 0.5,
      metalness: 0.3
    });

    this.materials.vest = new THREE.MeshStandardMaterial({
      color: config.vestColor || 0x0f172a,
      roughness: 0.7,
      metalness: 0.2
    });

    this.materials.visor = new THREE.MeshStandardMaterial({
      color: visorColor,
      roughness: 0.1,
      metalness: 0.9,
      emissive: visorColor,
      emissiveIntensity: 0.75
    });

    this.materials.skin = new THREE.MeshStandardMaterial({
      color: 0xdeb887,
      roughness: 0.8,
      metalness: 0.0
    });

    this.materials.dark = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.7,
      metalness: 0.4
    });

    this.materials.accent = new THREE.MeshStandardMaterial({
      color: config.accentColor || 0xf97316,
      roughness: 0.4,
      metalness: 0.5
    });

    // 1. Torso & Molle Plate Carrier
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.65, 0.32);
    const torso = new THREE.Mesh(torsoGeo, this.materials.armor);
    torso.position.y = 1.15;
    torso.castShadow = true;
    this.operatorGroup.add(torso);

    const plateGeo = new THREE.BoxGeometry(0.57, 0.48, 0.35);
    const plate = new THREE.Mesh(plateGeo, this.materials.vest);
    plate.position.y = 1.17;
    plate.castShadow = true;
    this.operatorGroup.add(plate);

    // Ammo Mag Pouches
    for (let i = -1; i <= 1; i++) {
      const pouchGeo = new THREE.BoxGeometry(0.12, 0.18, 0.08);
      const pouch = new THREE.Mesh(pouchGeo, this.materials.dark);
      pouch.position.set(i * 0.15, 1.05, 0.20);
      this.operatorGroup.add(pouch);
    }

    // 2. Head & Combat Helmet
    const headGeo = new THREE.BoxGeometry(0.28, 0.30, 0.28);
    const head = new THREE.Mesh(headGeo, this.materials.skin);
    head.position.y = 1.62;
    head.castShadow = true;
    this.operatorGroup.add(head);

    const helmetGeo = new THREE.BoxGeometry(0.33, 0.22, 0.33);
    const helmet = new THREE.Mesh(helmetGeo, this.materials.armor);
    helmet.position.set(0, 1.70, 0);
    helmet.castShadow = true;
    this.operatorGroup.add(helmet);

    // Visor with glowing HUD effect
    const visorGeo = new THREE.BoxGeometry(0.29, 0.09, 0.06);
    const visor = new THREE.Mesh(visorGeo, this.materials.visor);
    visor.position.set(0, 1.62, 0.15);
    this.operatorGroup.add(visor);

    // 3. Arms & Shoulders
    const shoulderPadGeo = new THREE.BoxGeometry(0.18, 0.16, 0.22);
    const leftPad = new THREE.Mesh(shoulderPadGeo, this.materials.armor);
    leftPad.position.set(-0.36, 1.40, 0);
    this.operatorGroup.add(leftPad);

    const rightPad = new THREE.Mesh(shoulderPadGeo, this.materials.armor);
    rightPad.position.set(0.36, 1.40, 0);
    this.operatorGroup.add(rightPad);

    const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.16);
    const leftArm = new THREE.Mesh(armGeo, this.materials.vest);
    leftArm.position.set(-0.35, 1.10, 0.05);
    leftArm.rotation.x = -0.35;
    leftArm.rotation.z = 0.15;
    this.operatorGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, this.materials.vest);
    rightArm.position.set(0.35, 1.10, 0.05);
    rightArm.rotation.x = -0.35;
    rightArm.rotation.z = -0.15;
    this.operatorGroup.add(rightArm);

    // 4. Legs & Kneepads & Boots
    const legGeo = new THREE.BoxGeometry(0.20, 0.65, 0.22);
    const leftLeg = new THREE.Mesh(legGeo, this.materials.armor);
    leftLeg.position.set(-0.16, 0.50, 0);
    leftLeg.castShadow = true;
    this.operatorGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, this.materials.armor);
    rightLeg.position.set(0.16, 0.50, 0);
    rightLeg.castShadow = true;
    this.operatorGroup.add(rightLeg);

    // Kneepads
    const kneeGeo = new THREE.BoxGeometry(0.18, 0.14, 0.06);
    const leftKnee = new THREE.Mesh(kneeGeo, this.materials.dark);
    leftKnee.position.set(-0.16, 0.50, 0.12);
    this.operatorGroup.add(leftKnee);

    const rightKnee = new THREE.Mesh(kneeGeo, this.materials.dark);
    rightKnee.position.set(0.16, 0.50, 0.12);
    this.operatorGroup.add(rightKnee);

    // Boots
    const bootGeo = new THREE.BoxGeometry(0.22, 0.18, 0.30);
    const leftBoot = new THREE.Mesh(bootGeo, this.materials.dark);
    leftBoot.position.set(-0.16, 0.09, 0.04);
    this.operatorGroup.add(leftBoot);

    const rightBoot = new THREE.Mesh(bootGeo, this.materials.dark);
    rightBoot.position.set(0.16, 0.09, 0.04);
    this.operatorGroup.add(rightBoot);

    // 5. Held Assault Rifle (Breacher-V1)
    const rifleGroup = new THREE.Group();
    const receiverGeo = new THREE.BoxGeometry(0.08, 0.14, 0.55);
    const receiver = new THREE.Mesh(receiverGeo, this.materials.dark);
    rifleGroup.add(receiver);

    const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8);
    const barrel = new THREE.Mesh(barrelGeo, this.materials.dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.38);
    rifleGroup.add(barrel);

    const magGeo = new THREE.BoxGeometry(0.06, 0.22, 0.12);
    const mag = new THREE.Mesh(magGeo, this.materials.accent);
    mag.position.set(0, -0.12, 0.08);
    mag.rotation.x = 0.2;
    rifleGroup.add(mag);

    const holoGeo = new THREE.BoxGeometry(0.06, 0.08, 0.14);
    const holo = new THREE.Mesh(holoGeo, this.materials.vest);
    holo.position.set(0, 0.10, -0.05);
    rifleGroup.add(holo);

    rifleGroup.position.set(0.18, 1.05, 0.32);
    rifleGroup.rotation.set(-0.25, 0.35, -0.15);
    this.operatorGroup.add(rifleGroup);
  }

  showWeaponPreview(weaponType) {
    this.operatorGroup.visible = false;
    this.weaponPreviewGroup.visible = true;

    while (this.weaponPreviewGroup.children.length > 0) {
      const child = this.weaponPreviewGroup.children[0];
      this.weaponPreviewGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3, metalness: 0.6 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2, metalness: 0.9 });

    if (weaponType === 'KNIFE') {
      const bladeGeo = new THREE.BoxGeometry(0.04, 0.12, 0.7);
      const blade = new THREE.Mesh(bladeGeo, silverMat);
      blade.position.y = 1.0;
      this.weaponPreviewGroup.add(blade);

      const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8);
      const handle = new THREE.Mesh(handleGeo, darkMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, 1.0, -0.45);
      this.weaponPreviewGroup.add(handle);
    } else if (weaponType === 'PISTOL') {
      const slideGeo = new THREE.BoxGeometry(0.12, 0.15, 0.65);
      const slide = new THREE.Mesh(slideGeo, silverMat);
      slide.position.set(0, 1.0, 0);
      this.weaponPreviewGroup.add(slide);

      const gripGeo = new THREE.BoxGeometry(0.10, 0.38, 0.18);
      const grip = new THREE.Mesh(gripGeo, darkMat);
      grip.position.set(0, 0.82, -0.18);
      grip.rotation.x = 0.25;
      this.weaponPreviewGroup.add(grip);
    } else {
      // Default: Assault Rifle
      const bodyGeo = new THREE.BoxGeometry(0.12, 0.22, 1.1);
      const body = new THREE.Mesh(bodyGeo, darkMat);
      body.position.set(0, 1.0, 0);
      this.weaponPreviewGroup.add(body);

      const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
      const barrel = new THREE.Mesh(barrelGeo, darkMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 1.04, 0.75);
      this.weaponPreviewGroup.add(barrel);

      const magGeo = new THREE.BoxGeometry(0.08, 0.42, 0.22);
      const mag = new THREE.Mesh(magGeo, accentMat);
      mag.position.set(0, 0.78, 0.15);
      mag.rotation.x = 0.2;
      this.weaponPreviewGroup.add(mag);

      const stockGeo = new THREE.BoxGeometry(0.10, 0.25, 0.45);
      const stock = new THREE.Mesh(stockGeo, darkMat);
      stock.position.set(0, 0.98, -0.68);
      this.weaponPreviewGroup.add(stock);
    }
  }

  showOperatorPreview() {
    this.operatorGroup.visible = true;
    this.weaponPreviewGroup.visible = false;
  }

  rotateLeft() {
    this.targetRotationY -= 0.75;
    this.autoRotate = false;
  }

  rotateRight() {
    this.targetRotationY += 0.75;
    this.autoRotate = false;
  }

  resetRotation() {
    this.targetRotationY = 0.25;
    this.autoRotate = true;
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    if (!this.isActive) return;
    requestAnimationFrame(() => this.animate());

    this.animTimer += 0.025;

    // Smooth rotation interpolation
    if (this.autoRotate) {
      this.targetRotationY += 0.004;
    }
    this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.12;
    this.operatorGroup.rotation.y = this.currentRotationY;
    this.weaponPreviewGroup.rotation.y = this.currentRotationY;

    // Subtle breathing / floating animation
    const breath = Math.sin(this.animTimer) * 0.015;
    this.operatorGroup.position.y = breath;
    this.weaponPreviewGroup.position.y = breath;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.isActive = false;
    if (this.domElement && this.domElement.parentElement) {
      this.domElement.parentElement.removeChild(this.domElement);
    }
    this.renderer.dispose();
  }
}
