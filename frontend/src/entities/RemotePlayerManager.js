import { RemotePlayer } from './RemotePlayer.js';

/**
 * RemotePlayerManager
 * Tracks active remote players in the game session, routes movement updates,
 * and handles safe instantiation and cleanup.
 */
export class RemotePlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map(); // id -> RemotePlayer
  }

  addPlayer(playerData) {
    if (!playerData || !playerData.id) return null;

    // Avoid duplicates
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

  getPlayerCount() {
    return this.players.size;
  }
}
