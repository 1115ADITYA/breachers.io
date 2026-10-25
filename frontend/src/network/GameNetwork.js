/**
 * GameNetwork
 * Manages WebSocket connection to the Spring Boot backend (/ws/game),
 * structured protocol serialization, rate-limited movement transmission,
 * combat messaging (SHOOT, RELOAD, SWITCH_WEAPON), and session state.
 */
export class GameNetwork {
  constructor(options = {}) {
    const defaultHost = window.location.hostname || 'localhost';
    const defaultPort = '8081';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    this.url = options.url || `${protocol}//${defaultHost}:${defaultPort}/ws/game`;
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.localPlayerId = null;
    this.localUsername = null;

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

    this.onlinePlayerCount = 1;
  }

  connect(username = 'Operator') {
    if (this.socket && (this.isConnected || this.isConnecting)) {
      console.warn('GameNetwork: WebSocket is already connecting or connected.');
      return;
    }

    this.localUsername = username;
    this.isConnecting = true;
    this.notifyStatus('connecting');

    try {
      this.socket = new WebSocket(this.url);
    } catch (err) {
      console.error('GameNetwork: Failed to instantiate WebSocket:', err);
      this.isConnecting = false;
      this.notifyStatus('error');
      if (this.onError) this.onError(err.message);
      return;
    }

    this.socket.onopen = () => {
      this.isConnected = true;
      this.isConnecting = false;
      this.notifyStatus('connected');

      // Send JOIN handshake
      this.send({
        type: 'JOIN',
        username: this.localUsername
      });
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.socket.onerror = (err) => {
      console.error('GameNetwork: WebSocket transport error:', err);
      this.notifyStatus('error');
      if (this.onError) this.onError('WebSocket connection error');
    };

    this.socket.onclose = (event) => {
      this.isConnected = false;
      this.isConnecting = false;
      this.localPlayerId = null;
      this.onlinePlayerCount = 1;
      this.notifyStatus('disconnected');
      if (this.onPlayerCountChange) this.onPlayerCountChange(1);
    };
  }

  disconnect() {
    if (this.socket) {
      if (this.isConnected) {
        try {
          this.send({ type: 'LEAVE' });
        } catch (e) {
          // Socket might already be closing
        }
      }
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.localPlayerId = null;
    this.notifyStatus('disconnected');
  }

  send(messageObj) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      this.socket.send(JSON.stringify(messageObj));
    } catch (e) {
      console.error('GameNetwork: Failed to send message:', e);
    }
  }

  /**
   * Rate-limited player movement transmission (20Hz)
   */
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

  /**
   * Send a SHOOT combat message to the server
   */
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

  /**
   * Send a RELOAD command to the server
   */
  sendReload() {
    if (!this.isConnected || !this.localPlayerId) return;
    this.send({ type: 'RELOAD' });
  }

  /**
   * Send a SWITCH_WEAPON command to the server
   */
  sendSwitchWeapon(weapon) {
    if (!this.isConnected || !this.localPlayerId) return;
    this.send({
      type: 'SWITCH_WEAPON',
      weapon
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
