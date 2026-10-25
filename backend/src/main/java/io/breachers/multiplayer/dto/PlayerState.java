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
        boolean isSprinting
) {}
