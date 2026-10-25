import * as THREE from 'three';

// -------------------------------------------------------------
// Three.js Scene Setup (Runnable MVP Foundation)
// -------------------------------------------------------------
const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c10);
scene.fog = new THREE.FogExp2(0x0a0c10, 0.035);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 3, 6);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xff6600, 1.2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const cyanLight = new THREE.PointLight(0x00e5ff, 2, 20);
cyanLight.position.set(-4, 3, -2);
scene.add(cyanLight);

// Grid and Target Marker Geometry
const grid = new THREE.GridHelper(30, 30, 0xff6600, 0x1f2633);
grid.position.y = 0;
scene.add(grid);

// Central Holo-Cube / Anchor to verify 3D rendering
const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const cubeMaterial = new THREE.MeshStandardMaterial({
  color: 0x111622,
  roughness: 0.2,
  metalness: 0.8,
});
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(0, 1.2, 0);
scene.add(cube);

const wireGeometry = new THREE.WireframeGeometry(cubeGeometry);
const wireLine = new THREE.LineSegments(
  wireGeometry,
  new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.7 })
);
cube.add(wireLine);

// Floating tactical ring
const ringGeometry = new THREE.RingGeometry(1.8, 1.85, 32);
const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0xff6600,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.5,
});
const ring = new THREE.Mesh(ringGeometry, ringMaterial);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.05;
scene.add(ring);

// -------------------------------------------------------------
// Resize Handling
// -------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -------------------------------------------------------------
// FPS Counter & Render Loop
// -------------------------------------------------------------
let frameCount = 0;
let lastTime = performance.now();
const fpsElement = document.getElementById('fps-counter');

function animate(currentTime) {
  requestAnimationFrame(animate);

  // Rotate demo mesh
  cube.rotation.y += 0.008;
  cube.rotation.x += 0.004;
  ring.rotation.z += 0.005;

  // FPS calculation
  frameCount++;
  if (currentTime - lastTime >= 1000) {
    if (fpsElement) {
      fpsElement.textContent = `FPS: ${frameCount}`;
    }
    frameCount = 0;
    lastTime = currentTime;
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// -------------------------------------------------------------
// Backend Health Check & CORS Diagnostics
// -------------------------------------------------------------
const backendBadge = document.getElementById('backend-status');
const apiDetail = document.getElementById('api-status-detail');
const recheckBtn = document.getElementById('btn-recheck-health');

// Configure API endpoint: direct CORS or via Vite proxy
const API_URL = 'http://localhost:8081/api/health';

async function checkBackendHealth() {
  if (backendBadge) {
    backendBadge.className = 'status-badge checking';
    backendBadge.innerHTML = '<span class="indicator-dot"></span><span class="status-label">BACKEND: CHECKING</span>';
  }
  if (apiDetail) {
    apiDetail.className = 'diag-val checking';
    apiDetail.textContent = 'Pinging :8080/api/health...';
  }

  const startTime = performance.now();

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const elapsed = Math.round(performance.now() - startTime);

    if (backendBadge) {
      backendBadge.className = 'status-badge online';
      backendBadge.innerHTML = `<span class="indicator-dot"></span><span class="status-label">BACKEND: ${data.status} (${elapsed}ms)</span>`;
    }
    if (apiDetail) {
      apiDetail.className = 'diag-val active';
      apiDetail.textContent = `${data.service} v${data.version} — UP (${elapsed}ms)`;
    }
  } catch (error) {
    if (backendBadge) {
      backendBadge.className = 'status-badge offline';
      backendBadge.innerHTML = '<span class="indicator-dot"></span><span class="status-label">BACKEND: OFFLINE</span>';
    }
    if (apiDetail) {
      apiDetail.className = 'diag-val offline';
      apiDetail.textContent = 'Unavailable (Start Spring Boot :8081)';
    }
  }
}

if (recheckBtn) {
  recheckBtn.addEventListener('click', () => {
    checkBackendHealth();
  });
}

// Initial health check on page load
checkBackendHealth();
