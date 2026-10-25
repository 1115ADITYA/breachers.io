import { RemotePlayer } from './RemotePlayer.js';

/**
 * RemotePlayerManager
 * Tracks active remote players in the game session, routes movement and combat updates,
 * triggers shot effects, and handles death/respawn states.
 */
export class RemotePlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map(); // id -> RemotePlayer
  }

  addPlayer(playerData) {
    if (!playerData || !playerData.id) return null;

    if (this.players.has(playerData.id)) {
      this.updatePlayer(playerData);
      return this.players.get(playerData.id);
    }

    const remotePlayer = new RemotePlayer(playerData, this.scene);
    this.players.set(playerData.id, remotePlayer);
    return remotePlayer;
  }

  updatePlayer(moveData) {
    if (!moveData || !moveData.id) return;

    const player = this.players.get(moveData.id);
    if (player) {
      player.updateState(moveData);
    }
  }

  triggerRemoteShot(shooterId, origin, dir, hitPoint) {
    const player = this.players.get(shooterId);
    if (player) {
      player.triggerShotEffect(hitPoint);
    }
  }

  setPlayerDead(playerId, isDead) {
    const player = this.players.get(playerId);
    if (player) {
      player.setDead(isDead);
    }
  }

  respawnPlayer(playerId, x, y, z, yaw) {
    const player = this.players.get(playerId);
    if (player) {
      player.respawn(x, y, z, yaw);
    }
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.destroy();
      this.players.delete(playerId);
    }
  }

  clear() {
    this.players.forEach(player => player.destroy());
    this.players.clear();
  }

  update(delta) {
    this.players.forEach(player => player.update(delta));
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  getPlayerCount() {
    return this.players.size;
  }
}
