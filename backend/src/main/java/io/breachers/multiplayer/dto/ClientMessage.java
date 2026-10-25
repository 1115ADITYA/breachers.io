package io.breachers.multiplayer.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
        @JsonSubTypes.Type(value = ClientMessage.Join.class, name = "JOIN"),
        @JsonSubTypes.Type(value = ClientMessage.Move.class, name = "MOVE"),
        @JsonSubTypes.Type(value = ClientMessage.Leave.class, name = "LEAVE"),
        @JsonSubTypes.Type(value = ClientMessage.Ping.class, name = "PING"),
        @JsonSubTypes.Type(value = ClientMessage.Shoot.class, name = "SHOOT"),
        @JsonSubTypes.Type(value = ClientMessage.Reload.class, name = "RELOAD"),
        @JsonSubTypes.Type(value = ClientMessage.SwitchWeapon.class, name = "SWITCH_WEAPON")
})
@JsonIgnoreProperties(ignoreUnknown = true)
public sealed interface ClientMessage {

    record Join(String username) implements ClientMessage {}

    record Move(
            double x,
            double y,
            double z,
            double yaw,
            double pitch,
            boolean isMoving,
            boolean isSprinting
    ) implements ClientMessage {}

    record Leave() implements ClientMessage {}

    record Ping() implements ClientMessage {}

    record Shoot(
            long shotId,
            String weapon,
            double originX,
            double originY,
            double originZ,
            double dirX,
            double dirY,
            double dirZ
    ) implements ClientMessage {}

    record Reload() implements ClientMessage {}

    record SwitchWeapon(String weapon) implements ClientMessage {}
}
