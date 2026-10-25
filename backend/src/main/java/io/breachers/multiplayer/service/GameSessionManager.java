package io.breachers.multiplayer.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.breachers.multiplayer.dto.ClientMessage;
import io.breachers.multiplayer.dto.PlayerState;
import io.breachers.multiplayer.dto.ServerMessage;
import io.breachers.multiplayer.model.PlayerSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

@Service
public class GameSessionManager {

    private static final Logger log = LoggerFactory.getLogger(GameSessionManager.class);
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]{2,16}$");

    // Container Yard Map Playable Boundaries (with small tolerance)
    public static final double MIN_X = -58.0;
    public static final double MAX_X = 58.0;
    public static final double MIN_Z = -43.0;
    public static final double MAX_Z = 43.0;
    public static final double MIN_Y = -2.0;
    public static final double MAX_Y = 25.0;

    // Rate limiting: 35 movement messages/sec per client
    public static final int MAX_UPDATES_PER_SECOND = 35;

    // Valid Container Yard Spawn Points
    private static final double[][] SPAWNS = new double[][] {
            { -46.0, 0.0, -10.0, 1.57 },
            { -46.0, 0.0, 10.0, 1.57 },
            { -48.0, 0.0, 0.0, 1.57 },
            { 46.0, 0.0, -10.0, -1.57 },
            { 46.0, 0.0, 10.0, -1.57 },
            { 48.0, 0.0, 0.0, -1.57 },
            { 0.0, 0.0, -28.0, 0.0 },
            { 0.0, 0.0, 28.0, 3.14 }
    };

    private final ObjectMapper objectMapper;
    private final Map<String, PlayerSession> sessionsBySocketId = new ConcurrentHashMap<>();
    private final Map<String, PlayerSession> sessionsByPlayerId = new ConcurrentHashMap<>();

    public GameSessionManager(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Register and join a player into the authoritative development session
     */
    public synchronized PlayerSession registerPlayer(WebSocketSession rawSession, String rawUsername) {
        String socketId = rawSession.getId();

        // Check if already registered
        if (sessionsBySocketId.containsKey(socketId)) {
            return sessionsBySocketId.get(socketId);
        }

        // Decorate session for thread-safe concurrent message sending
        WebSocketSession session = new ConcurrentWebSocketSessionDecorator(rawSession, 5000, 64 * 1024);

        // Server-assigned unique player ID
        String playerId = "p_" + UUID.randomUUID().toString().substring(0, 8);

        // Sanitize and validate username
        String username = sanitizeUsername(rawUsername);

        // Pick a valid spawn point
        double[] spawn = getRandomSpawn();
        PlayerState initialState = new PlayerState(
                playerId,
                username,
                spawn[0],
                spawn[1],
                spawn[2],
                spawn[3],
                0.0,
                false,
                false
        );

        PlayerSession playerSession = new PlayerSession(socketId, playerId, username, session, initialState);
        sessionsBySocketId.put(socketId, playerSession);
        sessionsByPlayerId.put(playerId, playerSession);

        log.info("Player joined session: playerId={}, username={}, socketId={}", playerId, username, socketId);

        // 1. Send WELCOME snapshot to newly joined player
        List<PlayerState> existingPlayers = sessionsByPlayerId.values().stream()
                .filter(ps -> !ps.getPlayerId().equals(playerId))
                .map(PlayerSession::getState)
                .toList();

        ServerMessage.Welcome welcome = new ServerMessage.Welcome(
                playerId,
                username,
                spawn[0],
                spawn[1],
                spawn[2],
                spawn[3],
                existingPlayers
        );
        send(playerSession, welcome);

        // 2. Broadcast PLAYER_JOINED to all other players in the session
        ServerMessage.PlayerJoined joined = new ServerMessage.PlayerJoined(initialState);
        broadcast(joined, playerId);

        return playerSession;
    }

    /**
     * Handle local movement message from client with validation and rate limiting
     */
    public void handleMovement(String socketId, ClientMessage.Move move) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null) {
            return;
        }

        // 1. Rate Limiting Check
        if (!player.checkRateLimit(MAX_UPDATES_PER_SECOND)) {
            log.warn("Rate limit exceeded for player: {}", player.getPlayerId());
            return;
        }

        // 2. Validate coordinates and angles (reject NaN, Inf, out of bounds)
        if (!isValidCoordinate(move.x(), MIN_X, MAX_X) ||
            !isValidCoordinate(move.y(), MIN_Y, MAX_Y) ||
            !isValidCoordinate(move.z(), MIN_Z, MAX_Z) ||
            !Double.isFinite(move.yaw()) ||
            !Double.isFinite(move.pitch())) {
            log.warn("Invalid move coordinates rejected from player {}: x={}, y={}, z={}",
                    player.getPlayerId(), move.x(), move.y(), move.z());
            send(player, new ServerMessage.Error("Invalid movement coordinates"));
            return;
        }

        // 3. Update authoritative player state
        PlayerState updatedState = new PlayerState(
                player.getPlayerId(),
                player.getUsername(),
                move.x(),
                move.y(),
                move.z(),
                move.yaw(),
                move.pitch(),
                move.isMoving(),
                move.isSprinting()
        );
        player.updateState(updatedState);

        // 4. Broadcast movement update to all other players
        ServerMessage.PlayerMoved movedMsg = new ServerMessage.PlayerMoved(
                player.getPlayerId(),
                move.x(),
                move.y(),
                move.z(),
                move.yaw(),
                move.pitch(),
                move.isMoving(),
                move.isSprinting(),
                System.currentTimeMillis()
        );
        broadcast(movedMsg, player.getPlayerId());
    }

    /**
     * Remove player upon disconnection
     */
    public synchronized void removePlayer(String socketId) {
        PlayerSession player = sessionsBySocketId.remove(socketId);
        if (player != null) {
            sessionsByPlayerId.remove(player.getPlayerId());
            log.info("Player disconnected: playerId={}, username={}", player.getPlayerId(), player.getUsername());

            // Broadcast departure to remaining players
            ServerMessage.PlayerLeft leftMsg = new ServerMessage.PlayerLeft(player.getPlayerId());
            broadcast(leftMsg, player.getPlayerId());
        }
    }

    /**
     * Broadcast a message to all connected sessions (optionally excluding one player)
     */
    public void broadcast(ServerMessage message, String excludePlayerId) {
        for (PlayerSession session : sessionsByPlayerId.values()) {
            if (excludePlayerId != null && excludePlayerId.equals(session.getPlayerId())) {
                continue;
            }
            send(session, message);
        }
    }

    /**
     * Send a message to a specific player session
     */
    public void send(PlayerSession playerSession, ServerMessage message) {
        if (!playerSession.isOpen()) {
            return;
        }

        try {
            String json = objectMapper.writeValueAsString(message);
            playerSession.getSession().sendMessage(new TextMessage(json));
        } catch (IOException e) {
            log.error("Failed to send message to player {}: {}", playerSession.getPlayerId(), e.getMessage());
        }
    }

    public int getConnectedPlayerCount() {
        return sessionsByPlayerId.size();
    }

    public Collection<PlayerSession> getAllSessions() {
        return Collections.unmodifiableCollection(sessionsByPlayerId.values());
    }

    public PlayerSession getSessionByPlayerId(String playerId) {
        return sessionsByPlayerId.get(playerId);
    }

    public PlayerSession getSessionBySocketId(String socketId) {
        return sessionsBySocketId.get(socketId);
    }

    /**
     * Validate and sanitize display name, ensuring uniqueness
     */
    public String sanitizeUsername(String raw) {
        String clean = (raw == null) ? "" : raw.trim();
        if (!USERNAME_PATTERN.matcher(clean).matches()) {
            clean = "Operator_" + ThreadLocalRandom.current().nextInt(100, 999);
        }

        // Deduplicate name if another player in session has exact same name
        String candidate = clean;
        int suffix = 1;
        while (isUsernameTaken(candidate)) {
            candidate = clean + "_" + suffix++;
        }
        return candidate;
    }

    private boolean isUsernameTaken(String username) {
        return sessionsByPlayerId.values().stream()
                .anyMatch(p -> p.getUsername().equalsIgnoreCase(username));
    }

    private boolean isValidCoordinate(double val, double min, double max) {
        return Double.isFinite(val) && val >= min && val <= max;
    }

    private double[] getRandomSpawn() {
        int idx = ThreadLocalRandom.current().nextInt(SPAWNS.length);
        return SPAWNS[idx].clone();
    }
}
