/**
 * GameNetwork
 * Manages WebSocket connection to the Spring Boot backend (/ws/game),
 * structured protocol serialization, rate-limited movement transmission,
 * combat messaging, private rooms, team assignments, and match lifecycle.
 */
export class GameNetwork {
  static normalizeWsUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let clean = url.trim();
    // Convert HTTP(S) to WS(S)
    if (clean.startsWith('https://')) {
      clean = 'wss://' + clean.slice(8);
    } else if (clean.startsWith('http://')) {
      clean = 'ws://' + clean.slice(7);
    } else if (!clean.startsWith('ws://') && !clean.startsWith('wss://')) {
      clean = 'wss://' + clean;
    }
    // Remove trailing slashes
    clean = clean.replace(/\/+$/, '');
    // Ensure /ws/game path is present if path was omitted
    if (!clean.endsWith('/ws/game')) {
      if (clean.endsWith('/ws')) {
        clean = clean + '/game';
      } else {
        clean = clean + '/ws/game';
      }
    }
    return clean;
  }

  static resolveWebSocketUrl(customUrl = null) {
    // 1. Explicit option passed
    if (customUrl) return GameNetwork.normalizeWsUrl(customUrl);

    // 2. User-configured override in localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem('breachers_backend_ws_url');
        if (stored && stored.trim()) return GameNetwork.normalizeWsUrl(stored.trim());
      } catch (e) {
        // Ignore localStorage access errors
      }
    }

    // 3. Vite environment variable VITE_WS_URL
    const envWsUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL)
      ? import.meta.env.VITE_WS_URL
      : null;
    if (envWsUrl && envWsUrl.trim()) {
      return GameNetwork.normalizeWsUrl(envWsUrl.trim());
    }

    // 4. Host-aware auto-detection
    if (typeof window !== 'undefined' && window.location) {
      const host = window.location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.startsWith('192.168.') || host.endsWith('.local');
      if (!isLocal) {
        // Hosted on Vercel or cloud provider: default to live Render backend
        console.info('[GameNetwork] Running on production host without explicit VITE_WS_URL. Falling back to default cloud backend.');
        return 'wss://breachers-backend.onrender.com/ws/game';
      }

      // Local development fallback
      const defaultPort = '8081';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${host}:${defaultPort}/ws/game`;
    }

    return 'ws://localhost:8081/ws/game';
  }

  constructor(options = {}) {
    this.url = GameNetwork.resolveWebSocketUrl(options.url);
    console.log(`[GameNetwork] Initialized with endpoint: ${this.url}`);

    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.localPlayerId = null;
    this.localUsername = null;
    this.currentRoomCode = null;

    // Transmission Rate Limiting: 20 updates per second (50ms interval)
    this.updateIntervalMs = 50;
    this.lastSendTime = 0;

    // Shot sequence generator
    this.shotSequence = 0;

    // Callbacks
    this.onWelcome = null;
    this.onPlayerJoined = null;
    this.onPlayerMoved = null;
    this.onPlayerLeft = null;
    this.onStatusChange = null;
    this.onError = null;
    this.onPlayerCountChange = null;

    // Combat Callbacks
    this.onShotFired = null;
    this.onWeaponState = null;
    this.onHealthUpdated = null;
    this.onPlayerHit = null;
    this.onPlayerDied = null;
    this.onPlayerRespawned = null;
    this.onKillFeed = null;

    // Chunk 4 Room & Match Callbacks
    this.onRoomState = null;
    this.onMatchStarted = null;
    this.onScoreUpdate = null;
    this.onMatchEnded = null;
    this.onSpawnProtection = null;

    // Chunk 8 Callbacks
    this.onBarrelIgnited = null;
    this.onBarrelExploded = null;
    this.onLootSpawned = null;
    this.onLootCollected = null;
    this.onLootExpired = null;
    this.onBreachBonus = null;

    this.onlinePlayerCount = 1;
    this.pendingAction = null;
  }

  get playerId() {
    return this.localPlayerId;
  }

  setUrl(newUrl) {
    const normalized = GameNetwork.normalizeWsUrl(newUrl);
    if (normalized && normalized !== this.url) {
      this.url = normalized;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('breachers_backend_ws_url', normalized);
      }
      if (this.isConnected || this.isConnecting) {
        this.disconnect();
      }
    }
  }

  connect(username = 'Operator', initialAction = null) {
    this.localUsername = username;
    if (initialAction) {
      this.pendingAction = initialAction;
    }

    if (this.socket && (this.isConnected || this.isConnecting)) {
      if (this.pendingAction && this.isConnected) {
        this.executePendingAction();
      }
      return;
    }

    this.isConnecting = true;
    this.notifyStatus('connecting');

    try {
      console.log(`[GameNetwork] Connecting to WebSocket at: ${this.url}`);
      this.socket = new WebSocket(this.url);
    } catch (err) {
      console.error('[GameNetwork] Failed to instantiate WebSocket:', err);
      this.isConnecting = false;
      this.notifyStatus('error');
      if (this.onError) this.onError(err.message || 'WebSocket instantiation error');
      return;
    }

    this.socket.onopen = () => {
      console.log(`[GameNetwork] Connected successfully to ${this.url}`);
      this.isConnected = true;
      this.isConnecting = false;
      this.notifyStatus('connected');

      // Execute pending room action or fallback to standard join
      if (this.pendingAction) {
        this.executePendingAction();
      } else {
        this.send({
          type: 'JOIN',
          username: this.localUsername
        });
      }
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.socket.onerror = (err) => {
      console.error('[GameNetwork] WebSocket transport error at:', this.url, err);
      this.notifyStatus('error');
      if (this.onError) {
        this.onError(`Failed to connect to multiplayer server at ${this.url}. If hosted on Render, the free-tier service may be waking up (takes ~30-45s) or check Vercel environment variables.`);
      }
    };

    this.socket.onclose = (event) => {
      this.isConnected = false;
      this.isConnecting = false;
      this.localPlayerId = null;
      this.onlinePlayerCount = 1;
      this.currentRoomCode = null;
      this.notifyStatus('disconnected');
      if (this.onPlayerCountChange) this.onPlayerCountChange(1);
    };
  }

  executePendingAction() {
    if (!this.pendingAction) return;
    const action = this.pendingAction;
    this.pendingAction = null;

    if (action.type === 'CREATE_ROOM') {
      this.createRoom(action.username, action.mode);
    } else if (action.type === 'JOIN_ROOM') {
      this.joinRoom(action.roomCode, action.username);
    }
  }

  disconnect() {
    if (this.socket) {
      if (this.isConnected) {
        this.send({ type: 'LEAVE' });
      }
      this.socket.close();
      this.socket = null;
    }
  }

  send(data) {
    if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      this.socket.send(JSON.stringify(data));
    } catch (e) {
      console.error('GameNetwork: Failed to send frame:', e);
    }
  }

  sendMovement(x, y, z, yaw, pitch, isMoving, isSprinting) {
    if (!this.isConnected || !this.localPlayerId) return;

    const now = performance.now();
    if (now - this.lastSendTime >= this.updateIntervalMs) {
      this.lastSendTime = now;

      this.send({
        type: 'MOVE',
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
        z: Math.round(z * 1000) / 1000,
        yaw: Math.round(yaw * 1000) / 1000,
        pitch: Math.round(pitch * 1000) / 1000,
        isMoving,
        isSprinting
      });
    }
  }

  sendShoot(weapon, origin, dir) {
    if (!this.isConnected || !this.localPlayerId) return;

    this.shotSequence++;
    this.send({
      type: 'SHOOT',
      shotId: this.shotSequence,
      weapon,
      originX: Math.round(origin.x * 1000) / 1000,
      originY: Math.round(origin.y * 1000) / 1000,
      originZ: Math.round(origin.z * 1000) / 1000,
      dirX: Math.round(dir.x * 10000) / 10000,
      dirY: Math.round(dir.y * 10000) / 10000,
      dirZ: Math.round(dir.z * 10000) / 10000
    });
  }

  sendReload() {
    if (!this.isConnected || !this.localPlayerId) return;
    this.send({ type: 'RELOAD' });
  }

  sendSwitchWeapon(weapon) {
    if (!this.isConnected || !this.localPlayerId) return;
    this.send({
      type: 'SWITCH_WEAPON',
      weapon
    });
  }

  // --- Chunk 4 Room Actions ---

  createRoom(username, mode = 'TDM') {
    this.localUsername = username || this.localUsername || 'Operator';
    if (!this.isConnected) {
      this.connect(this.localUsername, { type: 'CREATE_ROOM', username: this.localUsername, mode });
      return;
    }
    this.send({
      type: 'CREATE_ROOM',
      username: this.localUsername,
      mode
    });
  }

  joinRoom(roomCode, username) {
    this.localUsername = username || this.localUsername || 'Operator';
    const code = (roomCode || '').trim().toUpperCase();
    if (!this.isConnected) {
      this.connect(this.localUsername, { type: 'JOIN_ROOM', roomCode: code, username: this.localUsername });
      return;
    }
    this.send({
      type: 'JOIN_ROOM',
      roomCode: code,
      username: this.localUsername
    });
  }

  leaveRoom() {
    if (!this.isConnected) return;
    this.send({ type: 'LEAVE_ROOM' });
  }

  setGameMode(mode) {
    if (!this.isConnected) return;
    this.send({
      type: 'SET_GAME_MODE',
      mode
    });
  }

  setTeam(team) {
    if (!this.isConnected) return;
    this.send({
      type: 'SET_TEAM',
      team
    });
  }

  startMatch() {
    if (!this.isConnected) return;
    this.send({ type: 'START_MATCH' });
  }

  returnToLobby() {
    if (!this.isConnected) return;
    this.send({ type: 'RETURN_TO_LOBBY' });
  }

  shootBarrel(barrelId, weapon, hitPoint) {
    if (!this.isConnected || !this.localPlayerId) return;
    this.send({
      type: 'SHOOT_BARREL',
      barrelId,
      weapon,
      hitX: Math.round((hitPoint?.x || 0) * 1000) / 1000,
      hitY: Math.round((hitPoint?.y || 0) * 1000) / 1000,
      hitZ: Math.round((hitPoint?.z || 0) * 1000) / 1000
    });
  }

  pickupLoot(lootId) {
    if (!this.isConnected || !this.localPlayerId) return;
    this.send({
      type: 'PICKUP_LOOT',
      lootId
    });
  }

  handleMessage(rawString) {
    let msg;
    try {
      msg = JSON.parse(rawString);
    } catch (e) {
      console.error('GameNetwork: Failed to parse incoming JSON:', rawString);
      return;
    }

    switch (msg.type) {
      case 'WELCOME':
        this.localPlayerId = msg.playerId;
        this.localUsername = msg.username;
        this.onlinePlayerCount = 1 + (msg.players ? msg.players.length : 0);
        if (this.onPlayerCountChange) this.onPlayerCountChange(this.onlinePlayerCount);
        if (this.onWelcome) this.onWelcome(msg);
        break;

      case 'PLAYER_JOINED':
        this.onlinePlayerCount++;
        if (this.onPlayerCountChange) this.onPlayerCountChange(this.onlinePlayerCount);
        if (this.onPlayerJoined) this.onPlayerJoined(msg.player);
        break;

      case 'PLAYER_MOVED':
        if (msg.id !== this.localPlayerId) {
          if (this.onPlayerMoved) this.onPlayerMoved(msg);
        }
        break;

      case 'PLAYER_LEFT':
        this.onlinePlayerCount = Math.max(1, this.onlinePlayerCount - 1);
        if (this.onPlayerCountChange) this.onPlayerCountChange(this.onlinePlayerCount);
        if (this.onPlayerLeft) this.onPlayerLeft(msg);
        break;

      case 'SHOT_FIRED':
        if (this.onShotFired) this.onShotFired(msg);
        break;

      case 'WEAPON_STATE':
        if (this.onWeaponState) this.onWeaponState(msg);
        break;

      case 'HEALTH_UPDATED':
        if (this.onHealthUpdated) this.onHealthUpdated(msg);
        break;

      case 'PLAYER_HIT':
        if (this.onPlayerHit) this.onPlayerHit(msg);
        break;

      case 'PLAYER_DIED':
        if (this.onPlayerDied) this.onPlayerDied(msg);
        break;

      case 'PLAYER_RESPAWNED':
        if (this.onPlayerRespawned) this.onPlayerRespawned(msg);
        break;

      case 'KILL_FEED':
        if (this.onKillFeed) this.onKillFeed(msg);
        break;

      case 'ROOM_STATE':
        this.currentRoomCode = msg.roomCode;
        if (msg.players) {
          this.onlinePlayerCount = msg.players.length;
          if (this.onPlayerCountChange) this.onPlayerCountChange(this.onlinePlayerCount);
        }
        if (this.onRoomState) this.onRoomState(msg);
        break;

      case 'MATCH_STARTED':
        if (this.onMatchStarted) this.onMatchStarted(msg);
        break;

      case 'SCORE_UPDATE':
        if (this.onScoreUpdate) this.onScoreUpdate(msg);
        break;

      case 'MATCH_ENDED':
        if (this.onMatchEnded) this.onMatchEnded(msg);
        break;

      case 'SPAWN_PROTECTION':
        if (this.onSpawnProtection) this.onSpawnProtection(msg);
        break;

      case 'BARREL_IGNITED':
        if (this.onBarrelIgnited) this.onBarrelIgnited(msg);
        break;

      case 'BARREL_EXPLODED':
        if (this.onBarrelExploded) this.onBarrelExploded(msg);
        break;

      case 'LOOT_SPAWNED':
        if (this.onLootSpawned) this.onLootSpawned(msg);
        break;

      case 'LOOT_COLLECTED':
        if (this.onLootCollected) this.onLootCollected(msg);
        break;

      case 'LOOT_EXPIRED':
        if (this.onLootExpired) this.onLootExpired(msg);
        break;

      case 'BREACH_BONUS':
        if (this.onBreachBonus) this.onBreachBonus(msg);
        break;

      case 'ERROR':
        console.warn('GameNetwork: Server error:', msg.message);
        if (this.onError) this.onError(msg.message);
        break;

      case 'PONG':
        break;

      default:
        console.debug('GameNetwork: Unknown message type:', msg.type);
    }
  }

  notifyStatus(status) {
    if (this.onStatusChange) {
      this.onStatusChange(status, this.localPlayerId);
    }
  }
}
