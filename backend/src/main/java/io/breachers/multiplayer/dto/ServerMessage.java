package io.breachers.multiplayer.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

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
}
