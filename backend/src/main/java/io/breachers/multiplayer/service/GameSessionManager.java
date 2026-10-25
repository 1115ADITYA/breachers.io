package io.breachers.multiplayer.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.breachers.multiplayer.dto.ClientMessage;
import io.breachers.multiplayer.dto.PlayerState;
import io.breachers.multiplayer.dto.ServerMessage;
import io.breachers.multiplayer.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;

@Service
public class GameSessionManager {

    private static final Logger log = LoggerFactory.getLogger(GameSessionManager.class);
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]{2,16}$");
    private static final char[] CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    public static final String DEFAULT_ROOM_CODE = "PUBLIC";

    // Container Yard Map Playable Boundaries (with small tolerance)
    public static final double MIN_X = -58.0;
    public static final double MAX_X = 58.0;
    public static final double MIN_Z = -43.0;
    public static final double MAX_Z = 43.0;
    public static final double MIN_Y = -2.0;
    public static final double MAX_Y = 25.0;

    // Rate limiting: 35 movement messages/sec per client
    public static final int MAX_UPDATES_PER_SECOND = 35;

    private final ObjectMapper objectMapper;
    private final Map<String, PlayerSession> sessionsBySocketId = new ConcurrentHashMap<>();
    private final Map<String, PlayerSession> sessionsByPlayerId = new ConcurrentHashMap<>();
    private final Map<String, GameRoom> roomsByCode = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    public GameSessionManager(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        // Initialize default room for backward-compatible quick joining and Chunks 0-3 tests
        GameRoom defaultRoom = new GameRoom(DEFAULT_ROOM_CODE, null, GameMode.TDM);
        roomsByCode.put(DEFAULT_ROOM_CODE, defaultRoom);
    }

    /**
     * Generate unique 6-character alphanumeric room code
     */
    public static String generateRoomCode() {
        char[] buf = new char[6];
        for (int i = 0; i < 6; i++) {
            buf[i] = CODE_CHARS[RANDOM.nextInt(CODE_CHARS.length)];
        }
        return new String(buf);
    }

    /**
     * Register a player into the session (backward-compatible legacy join)
     */
    public synchronized PlayerSession registerPlayer(WebSocketSession rawSession, String rawUsername) {
        return registerPlayerInternal(rawSession, rawUsername, DEFAULT_ROOM_CODE);
    }

    private synchronized PlayerSession registerPlayerInternal(WebSocketSession rawSession, String rawUsername, String targetRoomCode) {
        String socketId = rawSession.getId();

        // Check if already registered
        if (sessionsBySocketId.containsKey(socketId)) {
            return sessionsBySocketId.get(socketId);
        }

        WebSocketSession session = new ConcurrentWebSocketSessionDecorator(rawSession, 5000, 64 * 1024);
        String playerId = "p_" + UUID.randomUUID().toString().substring(0, 8);
        String username = sanitizeUsername(rawUsername);

        GameRoom room = roomsByCode.computeIfAbsent(targetRoomCode, code -> new GameRoom(code, null, GameMode.TDM));

        PlayerState initialState = new PlayerState(
                playerId,
                username,
                0.0,
                0.0,
                0.0,
                0.0,
                0.0,
                false,
                false,
                100,
                false,
                WeaponType.ASSAULT.getId()
        );

        PlayerSession playerSession = new PlayerSession(socketId, playerId, username, session, initialState);
        sessionsBySocketId.put(socketId, playerSession);
        sessionsByPlayerId.put(playerId, playerSession);

        room.addPlayer(playerSession);

        // Get safe spawn point for player
        double[] spawn = room.getSpawnPointForPlayer(playerSession);
        playerSession.respawn(spawn[0], spawn[1], spawn[2], spawn[3]);

        log.info("Player registered: playerId={}, username={}, room={}", playerId, username, room.getRoomCode());

        // Send WELCOME snapshot of other players in THIS ROOM only
        List<PlayerState> roomPeers = room.getPlayers().stream()
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
                roomPeers
        );
        send(playerSession, welcome);
        sendWeaponState(playerSession);

        // Broadcast to other players in this room only
        broadcastToRoom(room.getRoomCode(), new ServerMessage.PlayerJoined(initialState), playerId);
        broadcastToRoom(room.getRoomCode(), room.buildRoomStateMessage(), null);

        return playerSession;
    }

    /**
     * Create a private room directly from WebSocketSession
     */
    public synchronized GameRoom createRoom(WebSocketSession rawSession, String username, String modeStr) {
        PlayerSession existing = sessionsBySocketId.get(rawSession.getId());
        if (existing != null) {
            return createRoom(rawSession.getId(), username, modeStr);
        }

        String roomCode;
        do {
            roomCode = generateRoomCode();
        } while (roomsByCode.containsKey(roomCode));

        GameMode mode = GameMode.fromString(modeStr);
        GameRoom room = new GameRoom(roomCode, null, mode);
        roomsByCode.put(roomCode, room);

        PlayerSession player = registerPlayerInternal(rawSession, username, roomCode);
        room.setHostPlayerId(player.getPlayerId());
        log.info("Private room created: code={}, host={}, mode={}", roomCode, player.getUsername(), mode);
        return room;
    }

    /**
     * Create a private room by socketId
     */
    public synchronized GameRoom createRoom(String socketId, String username, String modeStr) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null) {
            log.warn("createRoom: session not found for socketId {}", socketId);
            return null;
        }

        // Generate unique 6-character room code
        String roomCode;
        do {
            roomCode = generateRoomCode();
        } while (roomsByCode.containsKey(roomCode));

        GameMode mode = GameMode.fromString(modeStr);
        GameRoom room = new GameRoom(roomCode, player.getPlayerId(), mode);
        roomsByCode.put(roomCode, room);

        // Remove from old room
        leaveCurrentRoom(player);

        // Add to new room
        room.addPlayer(player);
        double[] spawn = room.getSpawnPointForPlayer(player);
        player.respawn(spawn[0], spawn[1], spawn[2], spawn[3]);

        log.info("Private room created: code={}, host={}, mode={}", roomCode, player.getUsername(), mode);

        // Send WELCOME with new room state
        ServerMessage.Welcome welcome = new ServerMessage.Welcome(
                player.getPlayerId(),
                player.getUsername(),
                spawn[0],
                spawn[1],
                spawn[2],
                spawn[3],
                Collections.emptyList()
        );
        send(player, welcome);
        sendWeaponState(player);
        send(player, room.buildRoomStateMessage());

        return room;
    }

    public synchronized boolean joinRoom(WebSocketSession rawSession, String roomCode, String username) {
        PlayerSession existing = sessionsBySocketId.get(rawSession.getId());
        if (existing != null) {
            return joinRoom(rawSession.getId(), roomCode, username);
        }

        if (roomCode == null || roomCode.trim().isEmpty()) {
            sendRaw(rawSession, new ServerMessage.Error("Room code is required"));
            return false;
        }

        String normalizedCode = roomCode.trim().toUpperCase();
        GameRoom targetRoom = roomsByCode.get(normalizedCode);
        if (targetRoom == null) {
            log.warn("joinRoom rejected: room {} not found", normalizedCode);
            sendRaw(rawSession, new ServerMessage.Error("Room " + normalizedCode + " not found"));
            return false;
        }

        if (targetRoom.isFull()) {
            log.warn("joinRoom rejected: room {} is full", normalizedCode);
            sendRaw(rawSession, new ServerMessage.Error("Room " + normalizedCode + " is full (max 10 players)"));
            return false;
        }

        registerPlayerInternal(rawSession, username, normalizedCode);
        return true;
    }

    /**
     * Join an existing room by room code
     */
    public synchronized boolean joinRoom(String socketId, String roomCode, String username) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null) {
            log.warn("joinRoom: session not found for socketId {}", socketId);
            return false;
        }

        if (roomCode == null || roomCode.trim().isEmpty()) {
            send(player, new ServerMessage.Error("Room code is required"));
            return false;
        }

        String normalizedCode = roomCode.trim().toUpperCase();
        GameRoom targetRoom = roomsByCode.get(normalizedCode);

        if (targetRoom == null) {
            log.warn("joinRoom rejected: room {} not found", normalizedCode);
            send(player, new ServerMessage.Error("Room " + normalizedCode + " not found"));
            return false;
        }

        if (targetRoom.isFull()) {
            log.warn("joinRoom rejected: room {} is full", normalizedCode);
            send(player, new ServerMessage.Error("Room " + normalizedCode + " is full (max 10 players)"));
            return false;
        }

        // Leave existing room
        leaveCurrentRoom(player);

        // Add to target room
        targetRoom.addPlayer(player);
        double[] spawn = targetRoom.getSpawnPointForPlayer(player);
        player.respawn(spawn[0], spawn[1], spawn[2], spawn[3]);

        log.info("Player {} joined room {}. Team: {}", player.getUsername(), normalizedCode, player.getTeam());

        // Send WELCOME to joining player with current room peers
        List<PlayerState> roomPeers = targetRoom.getPlayers().stream()
                .filter(p -> !p.getPlayerId().equals(player.getPlayerId()))
                .map(PlayerSession::getState)
                .toList();

        ServerMessage.Welcome welcome = new ServerMessage.Welcome(
                player.getPlayerId(),
                player.getUsername(),
                spawn[0],
                spawn[1],
                spawn[2],
                spawn[3],
                roomPeers
        );
        send(player, welcome);
        sendWeaponState(player);

        // Notify room members
        broadcastToRoom(normalizedCode, new ServerMessage.PlayerJoined(player.getState()), player.getPlayerId());
        broadcastToRoom(normalizedCode, targetRoom.buildRoomStateMessage(), null);

        return true;
    }

    /**
     * Leave current room and return to public lobby
     */
    public synchronized void leaveRoom(String socketId) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null) return;

        leaveCurrentRoom(player);

        // Return to public room
        GameRoom publicRoom = roomsByCode.computeIfAbsent(DEFAULT_ROOM_CODE, code -> new GameRoom(code, null, GameMode.TDM));
        publicRoom.addPlayer(player);
        double[] spawn = publicRoom.getSpawnPointForPlayer(player);
        player.respawn(spawn[0], spawn[1], spawn[2], spawn[3]);

        send(player, publicRoom.buildRoomStateMessage());
    }

    private void leaveCurrentRoom(PlayerSession player) {
        String currentCode = player.getCurrentRoomCode();
        if (currentCode == null) return;

        GameRoom room = roomsByCode.get(currentCode);
        if (room != null) {
            room.removePlayer(player.getPlayerId());

            if (!currentCode.equals(DEFAULT_ROOM_CODE) && room.isEmpty()) {
                room.cancelMatchTimer();
                roomsByCode.remove(currentCode);
                log.info("Empty room {} cleaned up", currentCode);
            } else {
                broadcastToRoom(currentCode, new ServerMessage.PlayerLeft(player.getPlayerId()), player.getPlayerId());
                broadcastToRoom(currentCode, room.buildRoomStateMessage(), null);
            }
        }
    }

    /**
     * Set game mode (Host only)
     */
    public synchronized void setGameMode(String socketId, String modeStr) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null) return;

        GameRoom room = getRoomForPlayer(player);
        if (room == null) return;

        if (!player.getPlayerId().equals(room.getHostPlayerId())) {
            send(player, new ServerMessage.Error("Only the room host can change game mode"));
            return;
        }

        if (room.getStatus() == MatchStatus.IN_PROGRESS) {
            send(player, new ServerMessage.Error("Cannot change mode while match is in progress"));
            return;
        }

        GameMode mode = GameMode.fromString(modeStr);
        room.setMode(mode);
        log.info("Room {} mode changed to {}", room.getRoomCode(), mode);

        broadcastToRoom(room.getRoomCode(), room.buildRoomStateMessage(), null);
    }

    /**
     * Switch team for player (TDM only)
     */
    public synchronized void setTeam(String socketId, String teamStr) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null) return;

        GameRoom room = getRoomForPlayer(player);
        if (room == null || room.getMode() != GameMode.TDM) return;

        if (room.getStatus() == MatchStatus.IN_PROGRESS) {
            send(player, new ServerMessage.Error("Cannot change team during an active match"));
            return;
        }

        boolean success = room.switchTeam(player.getPlayerId(), teamStr);
        if (!success) {
            send(player, new ServerMessage.Error("Team " + teamStr + " is full (max 5 players)"));
            return;
        }

        log.info("Player {} switched team to {}", player.getUsername(), player.getTeam());
        broadcastToRoom(room.getRoomCode(), room.buildRoomStateMessage(), null);
    }

    /**
     * Start match (Host only)
     */
    public synchronized void startMatch(String socketId) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null) return;

        GameRoom room = getRoomForPlayer(player);
        if (room == null) return;

        if (!player.getPlayerId().equals(room.getHostPlayerId())) {
            send(player, new ServerMessage.Error("Only the room host can start the match"));
            return;
        }

        if (room.getStatus() == MatchStatus.IN_PROGRESS) {
            return;
        }

        room.setStatus(MatchStatus.IN_PROGRESS);
        room.resetScores();

        log.info("Match starting in room {}: mode={}, players={}", room.getRoomCode(), room.getMode(), room.getPlayerCount());

        // Respawn all room players at team/mode-specific spawn points and apply 5s spawn protection
        for (PlayerSession p : room.getPlayers()) {
            double[] spawn = room.getSpawnPointForPlayer(p);
            p.respawn(spawn[0], spawn[1], spawn[2], spawn[3]);
            p.applySpawnProtection(); // 5-second mandatory server protection

            broadcastToRoom(room.getRoomCode(), new ServerMessage.PlayerRespawned(
                    p.getPlayerId(), spawn[0], spawn[1], spawn[2], spawn[3], 100), null);
            broadcastToRoom(room.getRoomCode(), new ServerMessage.SpawnProtection(
                    p.getPlayerId(), 5000, true), null);
            sendWeaponState(p);
        }

        broadcastToRoom(room.getRoomCode(), new ServerMessage.MatchStarted(
                room.getRoomCode(), room.getMode().name(), room.getTimeRemainingSec(), room.getKillLimit()), null);
        broadcastToRoom(room.getRoomCode(), room.buildRoomStateMessage(), null);
        broadcastToRoom(room.getRoomCode(), new ServerMessage.ScoreUpdate(
                room.getRedScore(), room.getBlueScore(), getKillsMap(room), getDeathsMap(room)), null);

        // Start match ticker for duration countdown
        startMatchTicker(room);
    }

    private void startMatchTicker(GameRoom room) {
        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            try {
                if (room.getStatus() != MatchStatus.IN_PROGRESS) {
                    return;
                }

                room.decrementTimeRemaining();

                // Broadcast time update every 5 seconds or when nearing end
                if (room.getTimeRemainingSec() % 5 == 0 || room.getTimeRemainingSec() <= 10) {
                    broadcastToRoom(room.getRoomCode(), room.buildRoomStateMessage(), null);
                }

                if (room.getTimeRemainingSec() <= 0) {
                    // Match expired by time
                    handleMatchTimerExpiration(room);
                }
            } catch (Exception e) {
                log.error("Error in match ticker for room {}", room.getRoomCode(), e);
            }
        }, 1, 1, TimeUnit.SECONDS);

        room.setMatchTimerFuture(future);
    }

    private synchronized void handleMatchTimerExpiration(GameRoom room) {
        if (room.getStatus() != MatchStatus.IN_PROGRESS) return;

        String winner = "TIE";
        if (room.getMode() == GameMode.TDM) {
            if (room.getRedScore() > room.getBlueScore()) {
                winner = "RED";
            } else if (room.getBlueScore() > room.getRedScore()) {
                winner = "BLUE";
            }
        } else {
            // FFA: player with highest kills
            PlayerSession topPlayer = room.getPlayers().stream()
                    .max(Comparator.comparingInt(PlayerSession::getKills))
                    .orElse(null);
            winner = topPlayer != null ? topPlayer.getUsername() : "TIE";
        }

        endMatch(room, winner, "Time expired");
    }

    private synchronized void endMatch(GameRoom room, String winner, String reason) {
        room.cancelMatchTimer();
        room.setStatus(MatchStatus.ENDED);

        log.info("Match ended in room {}: winner={}, reason={}", room.getRoomCode(), winner, reason);

        List<ServerMessage.PlayerMatchResult> leaderboard = room.buildLeaderboard();
        broadcastToRoom(room.getRoomCode(), new ServerMessage.MatchEnded(
                winner, reason, room.getRedScore(), room.getBlueScore(), leaderboard), null);
        broadcastToRoom(room.getRoomCode(), room.buildRoomStateMessage(), null);
    }

    /**
     * Return to lobby from match end screen
     */
    public synchronized void returnToLobby(String socketId) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null) return;

        GameRoom room = getRoomForPlayer(player);
        if (room == null) return;

        room.cancelMatchTimer();
        room.setStatus(MatchStatus.LOBBY);
        room.resetScores();

        log.info("Room {} returned to lobby", room.getRoomCode());
        broadcastToRoom(room.getRoomCode(), room.buildRoomStateMessage(), null);
    }

    /**
     * Handle local movement message from client with validation, rate limiting, and room isolation
     */
    public void handleMovement(String socketId, ClientMessage.Move move) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null || player.isDead()) {
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
                move.isSprinting(),
                player.getHealth(),
                player.isDead(),
                player.getEquippedWeapon().getId()
        );
        player.updateState(updatedState);

        // 4. Broadcast movement update to peers in the SAME ROOM ONLY
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
        broadcastToRoom(player.getCurrentRoomCode(), movedMsg, player.getPlayerId());
    }

    /**
     * Handle shooting request with room isolation, friendly-fire check, and 5-second spawn protection
     */
    public synchronized void handleShoot(String socketId, ClientMessage.Shoot shoot) {
        PlayerSession shooter = sessionsBySocketId.get(socketId);
        if (shooter == null || shooter.isDead()) {
            return;
        }

        // Requirement B: Protected player cannot fire weapons or attack with knife
        if (shooter.isSpawnProtected()) {
            log.debug("Shot rejected: Shooter {} is spawn-protected", shooter.getPlayerId());
            return;
        }

        WeaponType weapon = WeaponType.fromString(shoot.weapon());

        // Validate weapon selection and cooldown/ammo
        if (!shooter.canFire(shoot.shotId(), weapon)) {
            log.debug("Shot rejected for player {}: weapon={}, shotId={}",
                    shooter.getPlayerId(), weapon, shoot.shotId());
            return;
        }

        // Validate direction vector
        double dirX = shoot.dirX();
        double dirY = shoot.dirY();
        double dirZ = shoot.dirZ();
        double dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

        if (!Double.isFinite(dirLen) || dirLen < 0.0001) {
            log.warn("Invalid shot direction vector from player {}", shooter.getPlayerId());
            return;
        }

        // Normalized direction
        dirX /= dirLen;
        dirY /= dirLen;
        dirZ /= dirLen;

        // Authoritative origin
        PlayerState shooterState = shooter.getState();
        double originX = shooterState.x();
        double originY = shooterState.y() + 1.62;
        double originZ = shooterState.z();

        if (Double.isFinite(shoot.originX()) && Math.hypot(originX - shoot.originX(), originZ - shoot.originZ()) <= 3.0) {
            originX = shoot.originX();
            originY = shoot.originY();
            originZ = shoot.originZ();
        }

        // Consume ammo
        shooter.recordFire(shoot.shotId());
        sendWeaponState(shooter);

        GameRoom room = getRoomForPlayer(shooter);
        if (room == null) return;

        double maxRange = weapon.getMaxRange();
        PlayerSession closestVictim = null;
        double closestDistance = maxRange;
        boolean isHeadshot = false;
        double hitX = 0, hitY = 0, hitZ = 0;

        // Raycast ONLY against other players in the SAME ROOM
        for (PlayerSession other : room.getPlayers()) {
            if (other.getPlayerId().equals(shooter.getPlayerId())) continue;
            if (other.isDead() || other.isSpawnProtected()) continue;

            // Friendly fire check: Reject damage to teammates in TDM
            if (room.isFriendlyFire(shooter, other)) {
                continue;
            }

            PlayerState victimState = other.getState();
            HitResult hit = intersectRayPlayer(
                    originX, originY, originZ,
                    dirX, dirY, dirZ,
                    victimState.x(), victimState.y(), victimState.z(),
                    maxRange
            );

            if (hit != null && hit.distance < closestDistance) {
                closestDistance = hit.distance;
                closestVictim = other;
                isHeadshot = hit.isHeadshot;
                hitX = hit.pointX;
                hitY = hit.pointY;
                hitZ = hit.pointZ;
            }
        }

        // Broadcast SHOT_FIRED to peers in this room
        ServerMessage.ShotFired shotMsg = new ServerMessage.ShotFired(
                shooter.getPlayerId(),
                weapon.getId(),
                originX, originY, originZ,
                dirX, dirY, dirZ,
                closestVictim != null ? hitX : null,
                closestVictim != null ? hitY : null,
                closestVictim != null ? hitZ : null
        );
        broadcastToRoom(room.getRoomCode(), shotMsg, shooter.getPlayerId());

        // Process hit
        if (closestVictim != null) {
            int baseDamage = weapon.getDamage();
            int finalDamage = isHeadshot ? (int) Math.round(baseDamage * 1.8) : baseDamage;

            int remainingHealth = closestVictim.takeDamage(finalDamage);

            log.info("Hit registered in room {}: shooter={}, victim={}, damage={}, headshot={}, healthLeft={}",
                    room.getRoomCode(), shooter.getPlayerId(), closestVictim.getPlayerId(), finalDamage, isHeadshot, remainingHealth);

            // Send PLAYER_HIT to shooter and victim
            ServerMessage.PlayerHit hitMsg = new ServerMessage.PlayerHit(
                    shooter.getPlayerId(),
                    closestVictim.getPlayerId(),
                    finalDamage,
                    isHeadshot,
                    remainingHealth
            );
            send(shooter, hitMsg);
            send(closestVictim, hitMsg);

            // Broadcast HEALTH_UPDATED to room
            ServerMessage.HealthUpdated healthMsg = new ServerMessage.HealthUpdated(
                    closestVictim.getPlayerId(),
                    remainingHealth,
                    PlayerSession.MAX_HEALTH
            );
            broadcastToRoom(room.getRoomCode(), healthMsg, null);

            // Check lethal elimination
            if (remainingHealth <= 0) {
                closestVictim.setDead(true);
                shooter.incrementKills();
                closestVictim.incrementDeaths();

                log.info("Elimination in room {}: killer={}, victim={}, weapon={}",
                        room.getRoomCode(), shooter.getUsername(), closestVictim.getUsername(), weapon.getId());

                ServerMessage.PlayerDied diedMsg = new ServerMessage.PlayerDied(
                        closestVictim.getPlayerId(),
                        shooter.getPlayerId(),
                        shooter.getUsername(),
                        closestVictim.getUsername(),
                        weapon.getId()
                );
                broadcastToRoom(room.getRoomCode(), diedMsg, null);

                ServerMessage.KillFeed killFeedMsg = new ServerMessage.KillFeed(
                        shooter.getUsername(),
                        closestVictim.getUsername(),
                        weapon.getId()
                );
                broadcastToRoom(room.getRoomCode(), killFeedMsg, null);

                // Update room score
                boolean matchEnded = false;
                String matchWinner = null;

                if (room.getMode() == GameMode.TDM) {
                    if ("RED".equalsIgnoreCase(shooter.getTeam())) {
                        room.incrementRedScore();
                    } else if ("BLUE".equalsIgnoreCase(shooter.getTeam())) {
                        room.incrementBlueScore();
                    }
                    if (room.getRedScore() >= room.getKillLimit()) {
                        matchEnded = true;
                        matchWinner = "RED";
                    } else if (room.getBlueScore() >= room.getKillLimit()) {
                        matchEnded = true;
                        matchWinner = "BLUE";
                    }
                } else {
                    if (shooter.getKills() >= room.getKillLimit()) {
                        matchEnded = true;
                        matchWinner = shooter.getUsername();
                    }
                }

                broadcastToRoom(room.getRoomCode(), new ServerMessage.ScoreUpdate(
                        room.getRedScore(), room.getBlueScore(), getKillsMap(room), getDeathsMap(room)), null);

                if (matchEnded) {
                    endMatch(room, matchWinner, "Kill limit reached");
                } else {
                    // Schedule automated respawn after 3 seconds with mode/team specific spawn
                    final String respawnPlayerId = closestVictim.getPlayerId();
                    final String currentRoomCode = room.getRoomCode();
                    scheduler.schedule(() -> respawnPlayer(respawnPlayerId, currentRoomCode), 3000, TimeUnit.MILLISECONDS);
                }
            }
        }
    }

    /**
     * Respawn player at designated team/mode spawn point with 5-second spawn protection
     */
    public synchronized void respawnPlayer(String playerId, String roomCode) {
        GameRoom room = roomsByCode.get(roomCode != null ? roomCode : DEFAULT_ROOM_CODE);
        if (room == null) return;

        PlayerSession player = room.getPlayer(playerId);
        if (player == null || !player.isDead()) {
            return;
        }

        double[] spawn = room.getSpawnPointForPlayer(player);
        player.respawn(spawn[0], spawn[1], spawn[2], spawn[3]);
        player.applySpawnProtection(); // 5.0 seconds mandatory spawn protection

        log.info("Player respawned in room {}: id={}, x={}, z={}, team={}",
                room.getRoomCode(), playerId, spawn[0], spawn[2], player.getTeam());

        ServerMessage.PlayerRespawned respawnMsg = new ServerMessage.PlayerRespawned(
                playerId,
                spawn[0],
                spawn[1],
                spawn[2],
                spawn[3],
                PlayerSession.MAX_HEALTH
        );
        broadcastToRoom(room.getRoomCode(), respawnMsg, null);
        broadcastToRoom(room.getRoomCode(), new ServerMessage.SpawnProtection(playerId, 5000, true), null);
        sendWeaponState(player);
    }

    // Overload for backward compatibility with 1-arg respawn
    public void respawnPlayer(String playerId) {
        PlayerSession player = sessionsByPlayerId.get(playerId);
        if (player != null) {
            respawnPlayer(playerId, player.getCurrentRoomCode());
        }
    }

    public synchronized void handleReload(String socketId) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null || player.isDead()) return;

        if (player.startReload()) {
            sendWeaponState(player);
            scheduler.schedule(() -> {
                if (player.completeReloadIfReady()) {
                    sendWeaponState(player);
                }
            }, player.getEquippedWeapon().getReloadDurationMs(), TimeUnit.MILLISECONDS);
        }
    }

    public synchronized void handleSwitchWeapon(String socketId, String weaponStr) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null || player.isDead()) return;

        WeaponType weapon = WeaponType.fromString(weaponStr);
        player.switchWeapon(weapon);
        sendWeaponState(player);
    }

    public void sendWeaponState(PlayerSession player) {
        WeaponType weapon = player.getEquippedWeapon();
        ServerMessage.WeaponState msg = new ServerMessage.WeaponState(
                weapon.getId(),
                player.getClip(weapon),
                player.getReserve(weapon),
                player.isReloading()
        );
        send(player, msg);
    }

    public static HitResult intersectRayPlayer(double ox, double oy, double oz,
                                              double dx, double dy, double dz,
                                              double px, double py, double pz,
                                              double maxRange) {
        double halfWidth = 0.55;
        double minX = px - halfWidth, maxX = px + halfWidth;
        double minY = py, maxY = py + 1.85;
        double minZ = pz - halfWidth, maxZ = pz + halfWidth;

        double tMinX = (dx != 0.0) ? (minX - ox) / dx : (ox >= minX && ox <= maxX ? Double.NEGATIVE_INFINITY : Double.POSITIVE_INFINITY);
        double tMaxX = (dx != 0.0) ? (maxX - ox) / dx : (ox >= minX && ox <= maxX ? Double.POSITIVE_INFINITY : Double.NEGATIVE_INFINITY);
        if (tMinX > tMaxX) { double tmp = tMinX; tMinX = tMaxX; tMaxX = tmp; }

        double tMinY = (dy != 0.0) ? (minY - oy) / dy : (oy >= minY && oy <= maxY ? Double.NEGATIVE_INFINITY : Double.POSITIVE_INFINITY);
        double tMaxY = (dy != 0.0) ? (maxY - oy) / dy : (oy >= minY && oy <= maxY ? Double.POSITIVE_INFINITY : Double.NEGATIVE_INFINITY);
        if (tMinY > tMaxY) { double tmp = tMinY; tMinY = tMaxY; tMaxY = tmp; }

        double tMinZ = (dz != 0.0) ? (minZ - oz) / dz : (oz >= minZ && oz <= maxZ ? Double.NEGATIVE_INFINITY : Double.POSITIVE_INFINITY);
        double tMaxZ = (dz != 0.0) ? (maxZ - oz) / dz : (oz >= minZ && oz <= maxZ ? Double.POSITIVE_INFINITY : Double.NEGATIVE_INFINITY);
        if (tMinZ > tMaxZ) { double tmp = tMinZ; tMinZ = tMaxZ; tMaxZ = tmp; }

        double tEnter = Math.max(Math.max(tMinX, tMinY), tMinZ);
        double tExit = Math.min(Math.min(tMaxX, tMaxY), tMaxZ);

        if (tEnter <= tExit && tExit >= 0.0 && tEnter <= maxRange) {
            if (tEnter < 0.0) tEnter = 0.0;
            double hitPointX = ox + dx * tEnter;
            double hitPointY = oy + dy * tEnter;
            double hitPointZ = oz + dz * tEnter;
            boolean isHeadshot = hitPointY >= (py + 1.40);

            return new HitResult(tEnter, hitPointX, hitPointY, hitPointZ, isHeadshot);
        }

        return null;
    }

    public static record HitResult(double distance, double pointX, double pointY, double pointZ, boolean isHeadshot) {}

    /**
     * Remove player upon disconnection
     */
    public synchronized void removePlayer(String socketId) {
        PlayerSession player = sessionsBySocketId.remove(socketId);
        if (player != null) {
            sessionsByPlayerId.remove(player.getPlayerId());
            log.info("Player disconnected: playerId={}, username={}", player.getPlayerId(), player.getUsername());
            leaveCurrentRoom(player);
        }
    }

    /**
     * Broadcast to players in a specific room only
     */
    public void broadcastToRoom(String roomCode, ServerMessage message, String excludePlayerId) {
        if (roomCode == null) return;
        GameRoom room = roomsByCode.get(roomCode);
        if (room == null) return;

        for (PlayerSession session : room.getPlayers()) {
            if (excludePlayerId != null && excludePlayerId.equals(session.getPlayerId())) {
                continue;
            }
            send(session, message);
        }
    }

    public void broadcast(ServerMessage message, String excludePlayerId) {
        broadcastToRoom(DEFAULT_ROOM_CODE, message, excludePlayerId);
    }

    public void send(PlayerSession playerSession, ServerMessage message) {
        if (!playerSession.isOpen()) {
            return;
        }

        try {
            String json = objectMapper.writeValueAsString(message);
            playerSession.getSession().sendMessage(new TextMessage(json));
        } catch (Exception e) {
            log.debug("Failed to send message to player {}: {}", playerSession.getPlayerId(), e.getMessage());
        }
    }

    public void sendRaw(WebSocketSession session, ServerMessage message) {
        if (session == null || !session.isOpen()) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(message);
            session.sendMessage(new TextMessage(json));
        } catch (Exception e) {
            log.debug("Failed to send raw message: {}", e.getMessage());
        }
    }

    public GameRoom getRoom(String roomCode) {
        return roomsByCode.get(roomCode);
    }

    public GameRoom getRoomForPlayer(PlayerSession player) {
        if (player == null || player.getCurrentRoomCode() == null) {
            return roomsByCode.get(DEFAULT_ROOM_CODE);
        }
        return roomsByCode.getOrDefault(player.getCurrentRoomCode(), roomsByCode.get(DEFAULT_ROOM_CODE));
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

    public String sanitizeUsername(String raw) {
        String clean = (raw == null) ? "" : raw.trim();
        if (!USERNAME_PATTERN.matcher(clean).matches()) {
            clean = "Operator_" + ThreadLocalRandom.current().nextInt(100, 999);
        }

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

    private Map<String, Integer> getKillsMap(GameRoom room) {
        Map<String, Integer> map = new HashMap<>();
        for (PlayerSession p : room.getPlayers()) {
            map.put(p.getPlayerId(), p.getKills());
        }
        return map;
    }

    private Map<String, Integer> getDeathsMap(GameRoom room) {
        Map<String, Integer> map = new HashMap<>();
        for (PlayerSession p : room.getPlayers()) {
            map.put(p.getPlayerId(), p.getDeaths());
        }
        return map;
    }
}
