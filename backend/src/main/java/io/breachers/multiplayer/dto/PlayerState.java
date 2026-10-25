package io.breachers.multiplayer.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PlayerState(
        String id,
        String username,
        double x,
        double y,
        double z,
        double yaw,
        double pitch,
        boolean isMoving,
        boolean isSprinting,
        int health,
        boolean isDead,
        String weapon
) {
    public PlayerState(String id, String username, double x, double y, double z, double yaw, double pitch, boolean isMoving, boolean isSprinting) {
        this(id, username, x, y, z, yaw, pitch, isMoving, isSprinting, 100, false, "ASSAULT");
    }
}
