package io.breachers.multiplayer.handler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.breachers.multiplayer.dto.ClientMessage;
import io.breachers.multiplayer.dto.ServerMessage;
import io.breachers.multiplayer.model.PlayerSession;
import io.breachers.multiplayer.service.GameSessionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameWebSocketHandler.class);

    private final GameSessionManager sessionManager;
    private final ObjectMapper objectMapper;

    public GameWebSocketHandler(GameSessionManager sessionManager, ObjectMapper objectMapper) {
        this.sessionManager = sessionManager;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.debug("WebSocket connection opened: id={}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();
        ClientMessage clientMessage;

        try {
            clientMessage = objectMapper.readValue(payload, ClientMessage.class);
        } catch (JsonProcessingException e) {
            log.warn("Malformed JSON received from {}: {}", session.getId(), e.getMessage());
            sendError(session, "Malformed message payload");
            return;
        }

        switch (clientMessage) {
            case ClientMessage.Join join -> {
                sessionManager.registerPlayer(session, join.username());
            }
            case ClientMessage.Move move -> {
                sessionManager.handleMovement(session.getId(), move);
            }
            case ClientMessage.Leave leave -> {
                sessionManager.removePlayer(session.getId());
            }
            case ClientMessage.Ping ping -> {
                PlayerSession playerSession = sessionManager.getSessionBySocketId(session.getId());
                if (playerSession != null) {
                    sessionManager.send(playerSession, new ServerMessage.Pong());
                }
            }
            case ClientMessage.Shoot shoot -> {
                sessionManager.handleShoot(session.getId(), shoot);
            }
            case ClientMessage.Reload reload -> {
                sessionManager.handleReload(session.getId());
            }
            case ClientMessage.SwitchWeapon switchWeapon -> {
                sessionManager.handleSwitchWeapon(session.getId(), switchWeapon.weapon());
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.debug("WebSocket connection closed: id={}, status={}", session.getId(), status);
        sessionManager.removePlayer(session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("WebSocket transport error for id={}: {}", session.getId(), exception.getMessage());
        sessionManager.removePlayer(session.getId());
    }

    private void sendError(WebSocketSession session, String errorMsg) {
        if (!session.isOpen()) return;
        try {
            String json = objectMapper.writeValueAsString(new ServerMessage.Error(errorMsg));
            session.sendMessage(new TextMessage(json));
        } catch (Exception e) {
            log.error("Failed to send error message to session {}: {}", session.getId(), e.getMessage());
        }
    }
}
