package io.breachers.multiplayer.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.breachers.multiplayer.dto.ClientMessage;
import io.breachers.multiplayer.dto.PlayerState;
import io.breachers.multiplayer.dto.ServerMessage;
import io.breachers.multiplayer.model.PlayerSession;
import io.breachers.multiplayer.model.WeaponType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
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
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

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
                false,
                100,
                false,
                WeaponType.ASSAULT.getId()
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

        // Send initial weapon state to the joined player
        sendWeaponState(playerSession);

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
     * Handle shooting request with full server-authoritative validation & hit calculation
     */
    public synchronized void handleShoot(String socketId, ClientMessage.Shoot shoot) {
        PlayerSession shooter = sessionsBySocketId.get(socketId);
        if (shooter == null || shooter.isDead()) {
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

        // Derive authoritative origin from shooter's latest server position
        PlayerState shooterState = shooter.getState();
        double originX = shooterState.x();
        double originY = shooterState.y() + 1.62; // Eye height
        double originZ = shooterState.z();

        // If client origin is close enough (within 3m), use it for precise sight alignment
        double distToClientOrigin = Math.hypot(originX - shoot.originX(), originZ - shoot.originZ());
        if (Double.isFinite(shoot.originX()) && distToClientOrigin <= 3.0) {
            originX = shoot.originX();
            originY = shoot.originY();
            originZ = shoot.originZ();
        }

        // Record shot execution and consume ammo
        shooter.recordFire(shoot.shotId());
        sendWeaponState(shooter);

        // Raycast against all other alive players in the session
        double maxRange = weapon.getMaxRange();
        PlayerSession closestVictim = null;
        double closestDistance = maxRange;
        boolean isHeadshot = false;
        double hitX = 0, hitY = 0, hitZ = 0;

        for (PlayerSession other : sessionsByPlayerId.values()) {
            if (other.getPlayerId().equals(shooter.getPlayerId())) continue;
            if (other.isDead() || other.isSpawnProtected()) continue;

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

        // If a victim was hit, calculate and apply server-authoritative damage
        if (closestVictim != null) {
            int damage = (int) Math.round(weapon.getBaseDamage() * (isHeadshot ? 1.8 : 1.0));
            int remainingHealth = closestVictim.takeDamage(damage);

            log.info("Hit registered: shooter={}, victim={}, weapon={}, damage={}, headshot={}, healthLeft={}",
                    shooter.getPlayerId(), closestVictim.getPlayerId(), weapon.getId(), damage, isHeadshot, remainingHealth);

            // Broadcast hit feedback and health update
            ServerMessage.PlayerHit hitMsg = new ServerMessage.PlayerHit(
                    shooter.getPlayerId(),
                    closestVictim.getPlayerId(),
                    damage,
                    isHeadshot,
                    remainingHealth
            );
            broadcast(hitMsg, null);

            ServerMessage.HealthUpdated healthMsg = new ServerMessage.HealthUpdated(
                    closestVictim.getPlayerId(),
                    remainingHealth,
                    PlayerSession.MAX_HEALTH
            );
            broadcast(healthMsg, null);

            // Check for elimination
            if (remainingHealth <= 0) {
                closestVictim.setDead(true);

                log.info("Player eliminated: victim={}, killer={}, weapon={}",
                        closestVictim.getPlayerId(), shooter.getPlayerId(), weapon.getId());

                ServerMessage.PlayerDied diedMsg = new ServerMessage.PlayerDied(
                        closestVictim.getPlayerId(),
                        shooter.getPlayerId(),
                        shooter.getUsername(),
                        closestVictim.getUsername(),
                        weapon.getId()
                );
                broadcast(diedMsg, null);

                ServerMessage.KillFeed killFeedMsg = new ServerMessage.KillFeed(
                        shooter.getUsername(),
                        closestVictim.getUsername(),
                        weapon.getId()
                );
                broadcast(killFeedMsg, null);

                // Schedule automated respawn after 3 seconds
                final String respawnPlayerId = closestVictim.getPlayerId();
                scheduler.schedule(() -> respawnPlayer(respawnPlayerId), 3000, TimeUnit.MILLISECONDS);
            }
        }

        // Broadcast shot visual/audio effect to all connected players
        Double bHitX = (closestVictim != null) ? hitX : null;
        Double bHitY = (closestVictim != null) ? hitY : null;
        Double bHitZ = (closestVictim != null) ? hitZ : null;

        ServerMessage.ShotFired shotFiredMsg = new ServerMessage.ShotFired(
                shooter.getPlayerId(),
                weapon.getId(),
                originX, originY, originZ,
                dirX, dirY, dirZ,
                bHitX, bHitY, bHitZ
        );
        broadcast(shotFiredMsg, null);
    }

    /**
     * Handle weapon switch request
     */
    public synchronized void handleSwitchWeapon(String socketId, String weaponStr) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null || player.isDead()) return;

        WeaponType newWeapon = WeaponType.fromString(weaponStr);
        player.switchWeapon(newWeapon);

        // Update player state with new weapon ID
        PlayerState cur = player.getState();
        PlayerState updated = new PlayerState(
                cur.id(), cur.username(), cur.x(), cur.y(), cur.z(), cur.yaw(), cur.pitch(),
                cur.isMoving(), cur.isSprinting(), player.getHealth(), player.isDead(), newWeapon.getId()
        );
        player.updateState(updated);

        // Send updated weapon state to player
        sendWeaponState(player);

        // Broadcast player state update so peers see the changed weapon model
        ServerMessage.PlayerMoved movedMsg = new ServerMessage.PlayerMoved(
                player.getPlayerId(), cur.x(), cur.y(), cur.z(), cur.yaw(), cur.pitch(),
                cur.isMoving(), cur.isSprinting(), System.currentTimeMillis()
        );
        broadcast(movedMsg, player.getPlayerId());
    }

    /**
     * Handle reload request
     */
    public synchronized void handleReload(String socketId) {
        PlayerSession player = sessionsBySocketId.get(socketId);
        if (player == null || player.isDead()) return;

        if (player.startReload()) {
            sendWeaponState(player);
            long duration = player.getEquippedWeapon().getReloadDurationMs();

            scheduler.schedule(() -> {
                synchronized (this) {
                    if (player.completeReloadIfReady()) {
                        sendWeaponState(player);
                    }
                }
            }, duration, TimeUnit.MILLISECONDS);
        }
    }

    /**
     * Respawn a dead player at a valid map spawn point
     */
    public synchronized void respawnPlayer(String playerId) {
        PlayerSession player = sessionsByPlayerId.get(playerId);
        if (player == null) return;

        double[] spawn = getRandomSpawn();
        player.respawn(spawn[0], spawn[1], spawn[2], spawn[3]);

        log.info("Player respawned: playerId={}, x={}, z={}", playerId, spawn[0], spawn[2]);

        ServerMessage.PlayerRespawned respawnedMsg = new ServerMessage.PlayerRespawned(
                playerId,
                spawn[0],
                spawn[1],
                spawn[2],
                spawn[3],
                PlayerSession.MAX_HEALTH
        );
        broadcast(respawnedMsg, null);

        ServerMessage.HealthUpdated healthMsg = new ServerMessage.HealthUpdated(
                playerId,
                PlayerSession.MAX_HEALTH,
                PlayerSession.MAX_HEALTH
        );
        broadcast(healthMsg, null);

        sendWeaponState(player);
    }

    public void sendWeaponState(PlayerSession player) {
        WeaponType eq = player.getEquippedWeapon();
        ServerMessage.WeaponState stateMsg = new ServerMessage.WeaponState(
                eq.getId(),
                player.getClip(eq),
                player.getReserve(eq),
                player.isReloading()
        );
        send(player, stateMsg);
    }

    /**
     * Ray vs Player Hitbox (AABB / Cylinder approximation)
     */
    public static HitResult intersectRayPlayer(
            double ox, double oy, double oz,
            double dx, double dy, double dz,
            double px, double py, double pz,
            double maxDist
    ) {
        // Player hitbox box: radius 0.55m, height 1.85m
        double minX = px - 0.55;
        double maxX = px + 0.55;
        double minY = py;
        double maxY = py + 1.85;
        double minZ = pz - 0.55;
        double maxZ = pz + 0.55;

        // Slab method intersection
        double tx1 = (minX - ox) / (dx == 0 ? 1e-9 : dx);
        double tx2 = (maxX - ox) / (dx == 0 ? 1e-9 : dx);
        double tminX = Math.min(tx1, tx2);
        double tmaxX = Math.max(tx1, tx2);

        double ty1 = (minY - oy) / (dy == 0 ? 1e-9 : dy);
        double ty2 = (maxY - oy) / (dy == 0 ? 1e-9 : dy);
        double tminY = Math.min(ty1, ty2);
        double tmaxY = Math.max(ty1, ty2);

        double tz1 = (minZ - oz) / (dz == 0 ? 1e-9 : dz);
        double tz2 = (maxZ - oz) / (dz == 0 ? 1e-9 : dz);
        double tminZ = Math.min(tz1, tz2);
        double tmaxZ = Math.max(tz1, tz2);

        double tEnter = Math.max(Math.max(tminX, tminY), tminZ);
        double tExit = Math.min(Math.min(tmaxX, tmaxY), tmaxZ);

        if (tExit >= Math.max(0.0, tEnter) && tEnter <= maxDist) {
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

            // Broadcast departure to remaining players
            ServerMessage.PlayerLeft leftMsg = new ServerMessage.PlayerLeft(player.getPlayerId());
            broadcast(leftMsg, player.getPlayerId());
        }
    }

    public void broadcast(ServerMessage message, String excludePlayerId) {
        for (PlayerSession session : sessionsByPlayerId.values()) {
            if (excludePlayerId != null && excludePlayerId.equals(session.getPlayerId())) {
                continue;
            }
            send(session, message);
        }
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

    public double[] getRandomSpawn() {
        int idx = ThreadLocalRandom.current().nextInt(SPAWNS.length);
        return SPAWNS[idx].clone();
    }
}
