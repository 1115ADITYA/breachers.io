import * as THREE from 'three';
import { CollisionSystem } from './core/CollisionSystem.js';
import { ContainerYardMap } from './maps/ContainerYardMap.js';
import { WarehouseMap } from './maps/WarehouseMap.js';
import { getMapConfig, DEFAULT_MAP_ID } from './maps/MapRegistry.js';
import { PlayerController } from './player/PlayerController.js';
import { Weapon } from './player/Weapon.js';
import { DummyTarget } from './entities/DummyTarget.js';
import { RemotePlayerManager } from './entities/RemotePlayerManager.js';
import { GameNetwork } from './network/GameNetwork.js';
import { HUD } from './ui/HUD.js';
import { MenuPreviewScene } from './menu/MenuPreviewScene.js';
import { MenuController } from './ui/MenuController.js';

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

// Subtle competitive distance fog
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
// 2. Environmental Lighting
// -------------------------------------------------------------
const hemiLight = new THREE.HemisphereLight(0xa0b4d4, 0x18202c, 0.95);
scene.add(hemiLight);

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

const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
fillLight.position.set(-45, 35, -35);
scene.add(fillLight);

const ambientBase = new THREE.AmbientLight(0x161c28, 0.25);
scene.add(ambientBase);

// -------------------------------------------------------------
// 3. Collision System & Map Management
// -------------------------------------------------------------
const collisionSystem = new CollisionSystem();

let currentMap = null;
let currentMapId = null;

// Target Dummies group
const targetsGroup = new THREE.Group();
scene.add(targetsGroup);
let targets = [];

function setupTargets(mapId) {
  // Clear old targets
  while (targetsGroup.children.length > 0) {
    targetsGroup.remove(targetsGroup.children[0]);
  }

  if (mapId === 'warehouse') {
    targets = [
      new DummyTarget(0, 0, 6, -Math.PI / 2, 'target'),
      new DummyTarget(-10, 0, -6, Math.PI / 4, 'blue'),
      new DummyTarget(10, 0, 6, -Math.PI / 4, 'blue'),
      new DummyTarget(-20, 0, 0, Math.PI / 2, 'red')
    ];
  } else {
    // Container Yard default targets
    targets = [
      new DummyTarget(0, 0, 0, -Math.PI / 2, 'target'),
      new DummyTarget(-10, 0, -22, Math.PI / 4, 'blue'),
      new DummyTarget(10, 0, 22, -Math.PI / 4, 'blue'),
      new DummyTarget(0, 2.6, 0, 0, 'red')
    ];
  }

  targets.forEach(t => targetsGroup.add(t.group));
  if (weapon) {
    weapon.setTargets(targets);
  }
}

/**
 * Load or switch active playable map
 * @param {string} mapId 'container_yard' | 'warehouse'
 * @param {Function} [onProgress]
 * @returns {Promise<void>}
 */
async function loadMap(mapId, onProgress = null) {
  if (currentMap && currentMapId === mapId && currentMap.isLoaded !== false) {
    return;
  }

  // Remove existing map from scene
  if (currentMap) {
    scene.remove(currentMap.getMesh());
    if (currentMap.dispose) {
      currentMap.dispose();
    }
    collisionSystem.clear();
  }

  currentMapId = mapId;

  if (mapId === 'warehouse') {
    const warehouse = new WarehouseMap();
    await warehouse.load(onProgress);
    currentMap = warehouse;
  } else {
    currentMap = new ContainerYardMap();
    if (onProgress) onProgress(100);
  }

  scene.add(currentMap.getMesh());
  collisionSystem.setColliders(currentMap.getColliders());
  setupTargets(mapId);

  const arenaTitle = `${currentMap.name.toUpperCase()} — ${currentMap.subtitle ? currentMap.subtitle.toUpperCase() : 'SECTOR 04'}`;
  hud.setArenaName(arenaTitle);
  console.log(`[MapLoader] Switched active map to: ${currentMap.name} (${currentMap.getColliders().length} colliders registered)`);
}

// -------------------------------------------------------------
// 4. Remote Player Manager & Networking Setup
// -------------------------------------------------------------
const remotePlayerManager = new RemotePlayerManager(scene);
const gameNetwork = new GameNetwork();

let player = null;
let weapon = null;

// Application State Machine: 'MENU' | 'LOBBY' | 'LOADING' | 'GAMEPLAY'
let appState = 'MENU';

// -------------------------------------------------------------
// 5. In-Game HUD Initialization
// -------------------------------------------------------------
const hud = new HUD({
  onPlayClick: () => {
    // If paused in-game, resume pointer lock
    if (player && player.enabled) {
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
    returnToMenu();
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
    returnToLobby();
  }
});

// Initially hide in-game HUD until player enters match
hud.hide();

// -------------------------------------------------------------
const menuController = new MenuController({
  onDeployMatch: (selectedMapId, username) => {
    deployIntoMatch(selectedMapId, username);
  },
  onCreateRoom: (username, mode, selectedMapId) => {
    if (!gameNetwork.isConnected && !gameNetwork.isConnecting) {
      gameNetwork.connect(username);
    }
    gameNetwork.createRoom(username, mode);
  },
  onJoinRoom: (code, username) => {
    if (!gameNetwork.isConnected && !gameNetwork.isConnecting) {
      gameNetwork.connect(username);
    }
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
  },
  onSettingsChanged: (newSettings) => {
    applySettings(newSettings);
  }
});

// -------------------------------------------------------------
// 6. 3D Menu Preview Scene Initialization
// -------------------------------------------------------------
const previewMount = document.getElementById('preview-canvas-mount');
const menuPreviewScene = new MenuPreviewScene(previewMount);
menuController.setPreviewScene(menuPreviewScene);

function applySettings(settings) {
  if (player && settings.mouseSensitivity !== undefined) {
    player.mouseSensitivity = 0.0022 * settings.mouseSensitivity;
  }
  const fpsPill = document.getElementById('fps-counter');
  if (fpsPill) {
    fpsPill.style.display = settings.showFps ? 'flex' : 'none';
  }
}

// -------------------------------------------------------------
// 7. Local Player Controller & Weapon
// -------------------------------------------------------------
player = new PlayerController(camera, renderer.domElement, collisionSystem, hud);

// Weapons setup
weapon = new Weapon(camera, scene, collisionSystem, hud, gameNetwork);
player.setWeapon(weapon);

// Initially player is disabled (Menu mode: mouse unlocked, no controls)
player.setEnabled(false);

// Apply initial settings
applySettings(menuController.getSettings());

// -------------------------------------------------------------
// 8. Match Deployment & State Transition Methods
// -------------------------------------------------------------
async function deployIntoMatch(selectedMapId, username) {
  appState = 'LOADING';
  const cfg = getMapConfig(selectedMapId);

  menuController.showLoading(cfg.name, async () => {
    try {
      await loadMap(selectedMapId);

      // Connect to Spring Boot WebSocket if not connected
      if (!gameNetwork.isConnected && !gameNetwork.isConnecting) {
        gameNetwork.connect(username);
      }

      // Safe spawn point from active map
      const startSpawn = currentMap.getRandomSpawn('red');
      player.spawnAt(startSpawn.x, startSpawn.y, startSpawn.z, startSpawn.rotationY);

      // Switch to gameplay state
      menuController.hideMenu();
      hud.show();
      player.setEnabled(true);
      player.requestLock();
      hud.updateHealth(100);
      weapon.selectWeapon(0);

      appState = 'GAMEPLAY';
      console.log(`[Deploy] Deployed into ${cfg.name} as ${username}`);
    } catch (err) {
      console.error('[Deploy] Failed to load map:', err);
      alert(`Failed to load ${cfg.name}: ${err.message || 'Asset loading error'}. Reverting to Container Yard.`);
      await loadMap('container_yard');
      menuController.hideLoading();
      menuController.showMenu();
      appState = 'MENU';
    }
  });
}

function returnToMenu() {
  appState = 'MENU';
  if (player) {
    player.setEnabled(false);
  }
  hud.hide();
  menuController.showMenu();
}

function returnToLobby() {
  appState = 'LOBBY';
  if (player) {
    player.setEnabled(false);
  }
  hud.hide();
  menuController.showMenu();
  menuController.navigateTo('LOBBY');
}

// -------------------------------------------------------------
// 9. Configure Network Callbacks
// -------------------------------------------------------------
gameNetwork.onStatusChange = (status, playerId) => {
  hud.setNetworkStatus(status, playerId);
};

gameNetwork.onPlayerCountChange = (count) => {
  hud.setPlayerCount(count);
};

gameNetwork.onWelcome = (welcomeMsg) => {
  console.log(`[Multiplayer] Welcomed by server as ${welcomeMsg.username} (${welcomeMsg.playerId})`);
  hud.setNetworkStatus('connected', welcomeMsg.playerId);

  // Position local player at safe spawn point
  if (player && appState === 'GAMEPLAY') {
    // If on warehouse, check if server coordinates are safe, otherwise use map spawn
    if (currentMapId === 'warehouse') {
      const safeSpawn = currentMap.getRandomSpawn('red');
      player.spawnAt(safeSpawn.x, safeSpawn.y, safeSpawn.z, safeSpawn.rotationY);
    } else {
      player.spawnAt(welcomeMsg.x, welcomeMsg.y, welcomeMsg.z, welcomeMsg.yaw);
    }
  }

  // Populate existing peers
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

// Combat Networking Event Routing
gameNetwork.onShotFired = (data) => {
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
  if (data.shooterId === gameNetwork.playerId) {
    hud.showHitmarker(data.isHeadshot);
    hud.showDamageNumber(data.damage, data.isHeadshot, window.innerWidth / 2, window.innerHeight / 2);
    weapon.playHitmarkerSound(data.isHeadshot);
  }

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
    // If warehouse, ensure respawn is safely inside warehouse bounds
    if (currentMapId === 'warehouse') {
      const team = player.team || 'red';
      const safeSpawn = currentMap.getRandomSpawn(team.toLowerCase());
      player.spawnAt(safeSpawn.x, safeSpawn.y, safeSpawn.z, safeSpawn.rotationY);
    } else {
      player.spawnAt(data.x, data.y, data.z, data.yaw);
    }
    hud.hideDeathScreen();
    hud.updateHealth(data.health);
    weapon.selectWeapon(0);
  } else {
    remotePlayerManager.respawnPlayer(data.playerId, data.x, data.y, data.z, data.yaw);
  }
};

gameNetwork.onKillFeed = (data) => {
  hud.addKillFeedEntry(data.killerName, data.victimName, data.weapon);
};

// Private Rooms, TDM/FFA Matches & Spawn Protection
gameNetwork.onRoomState = (roomState) => {
  menuController.updateRoomState(roomState, gameNetwork.playerId);
  hud.updateRoomState(roomState, gameNetwork.playerId);
  if (roomState.players) {
    roomState.players.forEach((p) => {
      if (p.id !== gameNetwork.playerId) {
        remotePlayerManager.setPlayerTeam(p.id, p.team);
      }
    });
  }
};

gameNetwork.onMatchStarted = async (data) => {
  console.log(`[Match] Started in room ${data.roomCode} (${data.mode})`);
  hud.setPaused(false);

  // Deploy into selected map
  const selectedMapId = menuController.getSelectedMapId();
  await loadMap(selectedMapId);

  menuController.hideMenu();
  hud.show();
  player.setEnabled(true);

  if (currentMapId === 'warehouse') {
    const team = (data.team || 'red').toLowerCase();
    const spawn = currentMap.getRandomSpawn(team);
    player.spawnAt(spawn.x, spawn.y, spawn.z, spawn.rotationY);
  } else {
    player.spawnAt(data.x, data.y, data.z, data.yaw);
  }

  player.requestLock();
  hud.updateHealth(100);
  weapon.selectWeapon(0);
  appState = 'GAMEPLAY';
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
// 10. Initial Map Preload (Container Yard)
// -------------------------------------------------------------
loadMap('container_yard');

// -------------------------------------------------------------
// 11. Window Resize Handling
// -------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -------------------------------------------------------------
// 12. Main Game Loop
// -------------------------------------------------------------
let clock = new THREE.Clock();
let frameCount = 0;
let lastFpsTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);

  // 1. Update Local Player Physics & Camera (Only during gameplay when unlocked)
  if (player && player.enabled) {
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
  } else {
    // In menu mode: slowly rotate camera around arena for cinematic background effect
    camera.position.x = Math.sin(performance.now() * 0.0001) * 35;
    camera.position.z = Math.cos(performance.now() * 0.0001) * 35;
    camera.position.y = 15;
    camera.lookAt(0, 4, 0);
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

// Start rendering loop
animate();
