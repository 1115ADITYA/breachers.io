import * as THREE from 'three';
import { CollisionSystem } from './core/CollisionSystem.js';
import { ContainerYardMap } from './maps/ContainerYardMap.js';
import { PlayerController } from './player/PlayerController.js';
import { Weapon } from './player/Weapon.js';
import { DummyTarget } from './entities/DummyTarget.js';
import { RemotePlayerManager } from './entities/RemotePlayerManager.js';
import { GameNetwork } from './network/GameNetwork.js';
import { HUD } from './ui/HUD.js';

// -------------------------------------------------------------
// 1. Scene & Renderer Initialization
// -------------------------------------------------------------
const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121620);
scene.fog = new THREE.FogExp2(0x121620, 0.015);

const camera = new THREE.PerspectiveCamera(
  80, // FOV 80 for competitive tactical FPS feel
  window.innerWidth / window.innerHeight,
  0.05,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

// -------------------------------------------------------------
// 2. Map & Environmental Lighting
// -------------------------------------------------------------
const hemiLight = new THREE.HemisphereLight(0x90b0d0, 0x222630, 0.85);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff0dd, 1.4);
sunLight.position.set(40, 60, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 150;
sunLight.shadow.camera.left = -60;
sunLight.shadow.camera.right = 60;
sunLight.shadow.camera.top = 50;
sunLight.shadow.camera.bottom = -50;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x406080, 0.4);
fillLight.position.set(-40, 30, -30);
scene.add(fillLight);

// -------------------------------------------------------------
// 3. Collision System & Container Yard Map
// -------------------------------------------------------------
const collisionSystem = new CollisionSystem();

const map = new ContainerYardMap();
scene.add(map.getMesh());
collisionSystem.setColliders(map.getColliders());

// -------------------------------------------------------------
// 4. Remote Player Manager & Networking Setup
// -------------------------------------------------------------
const remotePlayerManager = new RemotePlayerManager(scene);
const gameNetwork = new GameNetwork();

let player = null;

const hud = new HUD({
  onPlayClick: (username) => {
    // 1. Connect to Spring Boot WebSocket if not already connected
    if (!gameNetwork.isConnected && !gameNetwork.isConnecting) {
      gameNetwork.connect(username);
    }
    // 2. Request pointer lock for first-person controls
    if (player) {
      player.requestLock();
    }
  }
});

// Configure Network Callbacks
gameNetwork.onStatusChange = (status, playerId) => {
  hud.setNetworkStatus(status, playerId);
};

gameNetwork.onPlayerCountChange = (count) => {
  hud.setPlayerCount(count);
};

gameNetwork.onWelcome = (welcomeMsg) => {
  console.log(`[Multiplayer] Welcomed by server as ${welcomeMsg.username} (${welcomeMsg.playerId})`);
  hud.setNetworkStatus('connected', welcomeMsg.playerId);

  // Position local player at server-assigned spawn point
  if (player) {
    player.spawnAt(welcomeMsg.x, welcomeMsg.y, welcomeMsg.z, welcomeMsg.yaw);
  }

  // Populate existing peers in current session
  remotePlayerManager.clear();
  if (welcomeMsg.players) {
    welcomeMsg.players.forEach((p) => {
      remotePlayerManager.addPlayer(p);
    });
  }
};

gameNetwork.onPlayerJoined = (playerData) => {
  console.log(`[Multiplayer] Player joined: ${playerData.username} (${playerData.id})`);
  remotePlayerManager.addPlayer(playerData);
};

gameNetwork.onPlayerMoved = (moveData) => {
  remotePlayerManager.updatePlayer(moveData);
};

gameNetwork.onPlayerLeft = (leftData) => {
  console.log(`[Multiplayer] Player left: ${leftData.id}`);
  remotePlayerManager.removePlayer(leftData.id);
};

gameNetwork.onError = (errMsg) => {
  console.warn(`[Multiplayer] Error: ${errMsg}`);
};

// -------------------------------------------------------------
// 5. Local Player Controller & Weapon
// -------------------------------------------------------------
player = new PlayerController(camera, renderer.domElement, collisionSystem, hud);

// Initial fallback spawn before server welcome
const startSpawn = map.getRandomSpawn('red');
player.spawnAt(startSpawn.x, startSpawn.y, startSpawn.z, startSpawn.rotationY);

// Weapon setup
const weapon = new Weapon(camera, scene, collisionSystem, hud);
player.setWeapon(weapon);

// -------------------------------------------------------------
// 6. Practice Target Dummies (Shooting Feedback)
// -------------------------------------------------------------
const targets = [
  new DummyTarget(0, 0, 0, -Math.PI / 2, 'target'),
  new DummyTarget(-10, 0, -22, Math.PI / 4, 'blue'),
  new DummyTarget(10, 0, 22, -Math.PI / 4, 'blue'),
  new DummyTarget(0, 2.6, 0, 0, 'red')
];

targets.forEach(target => {
  scene.add(target.group);
});
weapon.setTargets(targets);

// -------------------------------------------------------------
// 7. Window Resize Handling
// -------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -------------------------------------------------------------
// 8. Main Game Loop
// -------------------------------------------------------------
let clock = new THREE.Clock();
let frameCount = 0;
let lastFpsTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);

  // 1. Update Local Player Physics & Camera
  player.update(delta);

  // 2. Transmit Local Movement over WebSocket (rate-limited inside GameNetwork to 20Hz)
  if (gameNetwork.isConnected && player.isLocked) {
    gameNetwork.sendMovement(
      player.position.x,
      player.position.y,
      player.position.z,
      player.yaw,
      player.pitch,
      player.isMoving,
      player.isSprinting
    );
  }

  // 3. Update Remote Peer Models & Interpolation
  remotePlayerManager.update(delta);

  // 4. Update Target Dummies
  targets.forEach(t => t.update(delta, camera.position));

  // 5. Render Scene
  renderer.render(scene, camera);

  // 6. Update FPS Counter
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    hud.setFps(frameCount);
    frameCount = 0;
    lastFpsTime = now;
  }
}

// Start loop
animate();
