package io.breachers.multiplayer.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public sealed interface ServerMessage {

    String type();

    record Welcome(
            String type,
            String playerId,
            String username,
            double x,
            double y,
            double z,
            double yaw,
            List<PlayerState> players
    ) implements ServerMessage {
        public Welcome(String playerId, String username, double x, double y, double z, double yaw, List<PlayerState> players) {
            this("WELCOME", playerId, username, x, y, z, yaw, players);
        }
    }

    record PlayerJoined(
            String type,
            PlayerState player
    ) implements ServerMessage {
        public PlayerJoined(PlayerState player) {
            this("PLAYER_JOINED", player);
        }
    }

    record PlayerMoved(
            String type,
            String id,
            double x,
            double y,
            double z,
            double yaw,
            double pitch,
            boolean isMoving,
            boolean isSprinting,
            long timestamp
    ) implements ServerMessage {
        public PlayerMoved(String id, double x, double y, double z, double yaw, double pitch, boolean isMoving, boolean isSprinting, long timestamp) {
            this("PLAYER_MOVED", id, x, y, z, yaw, pitch, isMoving, isSprinting, timestamp);
        }
    }

    record PlayerLeft(
            String type,
            String id
    ) implements ServerMessage {
        public PlayerLeft(String id) {
            this("PLAYER_LEFT", id);
        }
    }

    record Error(
            String type,
            String message
    ) implements ServerMessage {
        public Error(String message) {
            this("ERROR", message);
        }
    }

    record Pong(
            String type,
            long timestamp
    ) implements ServerMessage {
        public Pong() {
            this("PONG", System.currentTimeMillis());
        }
    }

    record ShotFired(
            String type,
            String shooterId,
            String weapon,
            double originX,
            double originY,
            double originZ,
            double dirX,
            double dirY,
            double dirZ,
            Double hitX,
            Double hitY,
            Double hitZ
    ) implements ServerMessage {
        public ShotFired(String shooterId, String weapon, double originX, double originY, double originZ,
                         double dirX, double dirY, double dirZ, Double hitX, Double hitY, Double hitZ) {
            this("SHOT_FIRED", shooterId, weapon, originX, originY, originZ, dirX, dirY, dirZ, hitX, hitY, hitZ);
        }
    }

    record WeaponState(
            String type,
            String weapon,
            int clip,
            int reserve,
            boolean isReloading
    ) implements ServerMessage {
        public WeaponState(String weapon, int clip, int reserve, boolean isReloading) {
            this("WEAPON_STATE", weapon, clip, reserve, isReloading);
        }
    }

    record HealthUpdated(
            String type,
            String playerId,
            int health,
            int maxHealth
    ) implements ServerMessage {
        public HealthUpdated(String playerId, int health, int maxHealth) {
            this("HEALTH_UPDATED", playerId, health, maxHealth);
        }
    }

    record PlayerHit(
            String type,
            String shooterId,
            String victimId,
            int damage,
            boolean isHeadshot,
            int healthRemaining
    ) implements ServerMessage {
        public PlayerHit(String shooterId, String victimId, int damage, boolean isHeadshot, int healthRemaining) {
            this("PLAYER_HIT", shooterId, victimId, damage, isHeadshot, healthRemaining);
        }
    }

    record PlayerDied(
            String type,
            String victimId,
            String killerId,
            String killerName,
            String victimName,
            String weapon
    ) implements ServerMessage {
        public PlayerDied(String victimId, String killerId, String killerName, String victimName, String weapon) {
            this("PLAYER_DIED", victimId, killerId, killerName, victimName, weapon);
        }
    }

    record PlayerRespawned(
            String type,
            String playerId,
            double x,
            double y,
            double z,
            double yaw,
            int health
    ) implements ServerMessage {
        public PlayerRespawned(String playerId, double x, double y, double z, double yaw, int health) {
            this("PLAYER_RESPAWNED", playerId, x, y, z, yaw, health);
        }
    }

    record KillFeed(
            String type,
            String killerName,
            String victimName,
            String weapon
    ) implements ServerMessage {
        public KillFeed(String killerName, String victimName, String weapon) {
            this("KILL_FEED", killerName, victimName, weapon);
        }
    }

    // --- Chunk 4: Private Rooms & Match System Messages ---

    record RoomPlayerInfo(
            String id,
            String username,
            String team,
            boolean isHost,
            boolean isReady,
            int kills,
            int deaths
    ) {}

    record PlayerMatchResult(
            String id,
            String username,
            String team,
            int kills,
            int deaths,
            int score
    ) {}

    record RoomState(
            String type,
            String roomCode,
            String hostId,
            String mode,
            String status,
            List<RoomPlayerInfo> players,
            int redScore,
            int blueScore,
            int killLimit,
            int timeRemainingSec
    ) implements ServerMessage {
        public RoomState(String roomCode, String hostId, String mode, String status,
                         List<RoomPlayerInfo> players, int redScore, int blueScore, int killLimit, int timeRemainingSec) {
            this("ROOM_STATE", roomCode, hostId, mode, status, players, redScore, blueScore, killLimit, timeRemainingSec);
        }
    }

    record MatchStarted(
            String type,
            String roomCode,
            String mode,
            int matchDurationSec,
            int killLimit
    ) implements ServerMessage {
        public MatchStarted(String roomCode, String mode, int matchDurationSec, int killLimit) {
            this("MATCH_STARTED", roomCode, mode, matchDurationSec, killLimit);
        }
    }

    record ScoreUpdate(
            String type,
            int redScore,
            int blueScore,
            Map<String, Integer> playerKills,
            Map<String, Integer> playerDeaths
    ) implements ServerMessage {
        public ScoreUpdate(int redScore, int blueScore, Map<String, Integer> playerKills, Map<String, Integer> playerDeaths) {
            this("SCORE_UPDATE", redScore, blueScore, playerKills, playerDeaths);
        }
    }

    record MatchEnded(
            String type,
            String winner,
            String reason,
            int redScore,
            int blueScore,
            List<PlayerMatchResult> leaderboard
    ) implements ServerMessage {
        public MatchEnded(String winner, String reason, int redScore, int blueScore, List<PlayerMatchResult> leaderboard) {
            this("MATCH_ENDED", winner, reason, redScore, blueScore, leaderboard);
        }
    }

    record SpawnProtection(
            String type,
            String playerId,
            int durationMs,
            boolean active
    ) implements ServerMessage {
        public SpawnProtection(String playerId, int durationMs, boolean active) {
            this("SPAWN_PROTECTION", playerId, durationMs, active);
        }
    }
}
