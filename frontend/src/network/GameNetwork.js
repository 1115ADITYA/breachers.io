/**
 * GameNetwork
 * Manages WebSocket connection to the Spring Boot backend (/ws/game),
 * structured protocol serialization, rate-limited movement transmission,
 * and session state.
 */
export class GameNetwork {
  constructor(options = {}) {
    // Configurable endpoint with auto-detection of host
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
    this.pendingMove = null;

    // Callbacks
    this.onWelcome = null;
    this.onPlayerJoined = null;
    this.onPlayerMoved = null;
    this.onPlayerLeft = null;
    this.onStatusChange = null;
    this.onError = null;
    this.onPlayerCountChange = null;

    // Track total players online in session
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
        // Only process remote player movement (prevent self-echoes)
        if (msg.id !== this.localPlayerId) {
          if (this.onPlayerMoved) this.onPlayerMoved(msg);
        }
        break;

      case 'PLAYER_LEFT':
        this.onlinePlayerCount = Math.max(1, this.onlinePlayerCount - 1);
        if (this.onPlayerCountChange) this.onPlayerCountChange(this.onlinePlayerCount);
        if (this.onPlayerLeft) this.onPlayerLeft(msg);
        break;

      case 'ERROR':
        console.warn('GameNetwork: Server error:', msg.message);
        if (this.onError) this.onError(msg.message);
        break;

      case 'PONG':
        // Heartbeat response
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
