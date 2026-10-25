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

// Procedural Atmospheric Sky Gradient
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 256;
skyCanvas.height = 512;
const skyCtx = skyCanvas.getContext('2d');
const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
skyGrad.addColorStop(0.0, '#090d16');  // Deep maritime night zenith
skyGrad.addColorStop(0.45, '#131b2e'); // Midnight steel blue
skyGrad.addColorStop(0.85, '#243048'); // Atmospheric horizon glow
skyGrad.addColorStop(1.0, '#384860');  // Industrial dock horizon haze
skyCtx.fillStyle = skyGrad;
skyCtx.fillRect(0, 0, 256, 512);
const skyTexture = new THREE.CanvasTexture(skyCanvas);
scene.background = skyTexture;

// Subtle competitive distance fog (preserves target silhouette clarity up to 70m)
scene.fog = new THREE.FogExp2(0x182030, 0.011);

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
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

// -------------------------------------------------------------
// 2. Map & Environmental Lighting
// -------------------------------------------------------------
// Coherent hemisphere light: cool maritime sky bounce vs dark concrete ground bounce
const hemiLight = new THREE.HemisphereLight(0xa0b4d4, 0x18202c, 0.95);
scene.add(hemiLight);

// Key directional sunlight (warm tactical golden-hour sun)
const sunLight = new THREE.DirectionalLight(0xfff3e5, 1.45);
sunLight.position.set(45, 65, 32);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 160;
sunLight.shadow.camera.left = -65;
sunLight.shadow.camera.right = 65;
sunLight.shadow.camera.top = 55;
sunLight.shadow.camera.bottom = -55;
sunLight.shadow.bias = -0.0004;
scene.add(sunLight);

// Cool ambient fill light to soften harsh shadows
const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
fillLight.position.set(-45, 35, -35);
scene.add(fillLight);

// Subtle ambient baseline to prevent pitch-black container interiors
const ambientBase = new THREE.AmbientLight(0x161c28, 0.25);
scene.add(ambientBase);

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
  },
  onCreateRoom: (username, mode) => {
    gameNetwork.createRoom(username, mode);
  },
  onJoinRoom: (code, username) => {
    gameNetwork.joinRoom(code, username);
  },
  onLeaveRoom: () => {
    gameNetwork.leaveRoom();
  },
  onSetGameMode: (mode) => {
    gameNetwork.setGameMode(mode);
  },
  onSetTeam: (team) => {
    gameNetwork.setTeam(team);
  },
  onStartMatch: () => {
    gameNetwork.startMatch();
  },
  onReturnToLobby: () => {
    gameNetwork.returnToLobby();
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
  hud.showError(errMsg);
};

// -------------------------------------------------------------
// 5. Local Player Controller & Weapon
// -------------------------------------------------------------
player = new PlayerController(camera, renderer.domElement, collisionSystem, hud);

// Initial fallback spawn before server welcome
const startSpawn = map.getRandomSpawn('red');
player.spawnAt(startSpawn.x, startSpawn.y, startSpawn.z, startSpawn.rotationY);

// Weapon setup
const weapon = new Weapon(camera, scene, collisionSystem, hud, gameNetwork);
player.setWeapon(weapon);

// -------------------------------------------------------------
// 5b. Combat Networking Event Routing
// -------------------------------------------------------------
gameNetwork.onShotFired = (data) => {
  // If shot was fired by another connected peer, render remote muzzle flash & tracer
  if (data.shooterId !== gameNetwork.playerId) {
    remotePlayerManager.triggerRemoteShot(data.shooterId, data.origin, data.direction, data.weapon);
  }
};

gameNetwork.onWeaponState = (data) => {
  weapon.syncServerWeaponState(data);
};

gameNetwork.onHealthUpdated = (data) => {
  if (data.playerId === gameNetwork.playerId) {
    hud.updateHealth(data.health);
  }
};

gameNetwork.onPlayerHit = (data) => {
  // If shooter is local player, show crosshair hitmarker & floating damage feedback
  if (data.shooterId === gameNetwork.playerId) {
    hud.showHitmarker(data.isHeadshot);
    hud.showDamageNumber(data.damage, data.isHeadshot, window.innerWidth / 2, window.innerHeight / 2);
    weapon.playHitmarkerSound(data.isHeadshot);
  }

  // If victim is local player, trigger damage screen flash vignette
  if (data.victimId === gameNetwork.playerId) {
    hud.flashDamageVignette();
  }
};

gameNetwork.onPlayerDied = (data) => {
  console.log(`[Combat] Elimination: ${data.killerName} killed ${data.victimName} with ${data.weapon}`);

  if (data.victimId === gameNetwork.playerId) {
    player.setDead(true);
    hud.updateHealth(0);
    hud.showDeathScreen(data.killerName, data.weapon, 3);
  } else {
    remotePlayerManager.setPlayerDead(data.victimId, true);
  }
};

gameNetwork.onPlayerRespawned = (data) => {
  console.log(`[Combat] Respawn: Player ${data.playerId} at (${data.x}, ${data.y}, ${data.z})`);

  if (data.playerId === gameNetwork.playerId) {
    player.spawnAt(data.x, data.y, data.z, data.yaw);
    hud.hideDeathScreen();
    hud.updateHealth(data.health);
    weapon.selectWeapon(0); // Restore primary assault rifle
  } else {
    remotePlayerManager.respawnPlayer(data.playerId, data.x, data.y, data.z, data.yaw);
  }
};

gameNetwork.onKillFeed = (data) => {
  hud.addKillFeedEntry(data.killerName, data.victimName, data.weapon);
};

// -------------------------------------------------------------
// 5c. Chunk 4: Private Rooms, TDM/FFA Matches & Spawn Protection
// -------------------------------------------------------------
gameNetwork.onRoomState = (roomState) => {
  hud.updateRoomState(roomState, gameNetwork.playerId);
  if (roomState.players) {
    roomState.players.forEach((p) => {
      if (p.id !== gameNetwork.playerId) {
        remotePlayerManager.setPlayerTeam(p.id, p.team);
      }
    });
  }
};

gameNetwork.onMatchStarted = (data) => {
  console.log(`[Match] Started in room ${data.roomCode} (${data.mode})`);
  hud.setPaused(false);
  if (player) {
    player.spawnAt(data.x, data.y, data.z, data.yaw);
    player.requestLock();
  }
  hud.updateHealth(100);
  if (weapon) {
    weapon.selectWeapon(0);
  }
};

gameNetwork.onScoreUpdate = (data) => {
  hud.updateScore(data.redScore, data.blueScore, data.kills, data.deaths);
};

gameNetwork.onMatchEnded = (data) => {
  console.log(`[Match] Concluded in room ${data.roomCode} - Winner: ${data.winner}`);
  if (player) {
    player.exitLock();
  }
  hud.showMatchEnded(data.winner, data.reason, data.redScore, data.blueScore, data.leaderboard);
};

gameNetwork.onSpawnProtection = (data) => {
  if (data.playerId === gameNetwork.playerId) {
    if (player && data.active) {
      player.applySpawnProtection(data.durationMs || 5000);
    }
  } else {
    remotePlayerManager.setSpawnProtection(data.playerId, data.durationMs || 5000, data.active);
  }
};

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
