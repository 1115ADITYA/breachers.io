package io.breachers.multiplayer.model;

import io.breachers.multiplayer.dto.PlayerState;
import org.springframework.web.socket.WebSocketSession;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class PlayerSession {

    public static final int MAX_HEALTH = 100;
    // Exactly 5 seconds of spawn protection as mandated by Chunk 4 Additional Requirements
    public static final long SPAWN_PROTECTION_DURATION_MS = 5000L;

    private final String socketId;
    private final String playerId;
    private final String username;
    private final WebSocketSession session;

    private volatile PlayerState state;

    // Room and match state
    private volatile String currentRoomCode = "PUBLIC";
    private volatile String team = "NONE"; // "RED", "BLUE", "FFA", "NONE"
    private volatile boolean ready = false;
    private final AtomicInteger kills = new AtomicInteger(0);
    private final AtomicInteger deaths = new AtomicInteger(0);

    // Combat state
    private volatile int health = MAX_HEALTH;
    private volatile boolean dead = false;
    private volatile long spawnProtectedUntilMs;
    private volatile WeaponType equippedWeapon = WeaponType.ASSAULT;

    private final Map<WeaponType, Integer> ammoClips = new ConcurrentHashMap<>();
    private final Map<WeaponType, Integer> ammoReserves = new ConcurrentHashMap<>();

    private volatile long lastFireTimeMs = 0;
    private volatile long reloadingUntilMs = 0;

    // Bounded processed shot IDs cache (sliding window of max 200 IDs)
    private final Set<Long> processedShotIds = Collections.synchronizedSet(
            Collections.newSetFromMap(new LinkedHashMap<Long, Boolean>(200, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<Long, Boolean> eldest) {
                    return size() > 200;
                }
            })
    );

    // Rate limiting tracking
    private volatile long windowStartTimeMs;
    private final AtomicInteger messageCountInWindow = new AtomicInteger(0);

    public PlayerSession(String socketId, String playerId, String username, WebSocketSession session, PlayerState initialState) {
        this.socketId = socketId;
        this.playerId = playerId;
        this.username = username;
        this.session = session;
        this.state = initialState;
        this.windowStartTimeMs = System.currentTimeMillis();
        this.spawnProtectedUntilMs = System.currentTimeMillis() + SPAWN_PROTECTION_DURATION_MS;

        // Initialize weapon ammo
        resetAmmo();
    }

    public void resetAmmo() {
        for (WeaponType w : WeaponType.values()) {
            ammoClips.put(w, w.getMagCapacity());
            ammoReserves.put(w, w.getMaxReserve());
        }
    }

    public void resetScore() {
        kills.set(0);
        deaths.set(0);
    }

    public String getSocketId() {
        return socketId;
    }

    public String getPlayerId() {
        return playerId;
    }

    public String getUsername() {
        return username;
    }

    public WebSocketSession getSession() {
        return session;
    }

    public PlayerState getState() {
        return state;
    }

    public void updateState(PlayerState newState) {
        this.state = newState;
    }

    public String getCurrentRoomCode() {
        return currentRoomCode;
    }

    public void setCurrentRoomCode(String roomCode) {
        this.currentRoomCode = roomCode;
    }

    public String getTeam() {
        return team;
    }

    public void setTeam(String team) {
        this.team = team != null ? team.toUpperCase() : "NONE";
    }

    public boolean isReady() {
        return ready;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }

    public int getKills() {
        return kills.get();
    }

    public void incrementKills() {
        kills.incrementAndGet();
    }

    public int getDeaths() {
        return deaths.get();
    }

    public void incrementDeaths() {
        deaths.incrementAndGet();
    }

    public int getHealth() {
        return health;
    }

    public boolean isDead() {
        return dead;
    }

    public void setDead(boolean dead) {
        this.dead = dead;
        if (dead) {
            this.health = 0;
        }
    }

    public boolean isSpawnProtected() {
        return System.currentTimeMillis() < spawnProtectedUntilMs;
    }

    public long getSpawnProtectedUntilMs() {
        return spawnProtectedUntilMs;
    }

    public long getSpawnProtectionRemainingMs() {
        long rem = spawnProtectedUntilMs - System.currentTimeMillis();
        return Math.max(0, rem);
    }

    public void applySpawnProtection() {
        this.spawnProtectedUntilMs = System.currentTimeMillis() + SPAWN_PROTECTION_DURATION_MS;
    }

    public void clearSpawnProtection() {
        this.spawnProtectedUntilMs = 0;
    }

    public WeaponType getEquippedWeapon() {
        return equippedWeapon;
    }

    public void switchWeapon(WeaponType newWeapon) {
        if (newWeapon == null || this.equippedWeapon == newWeapon) return;
        this.equippedWeapon = newWeapon;
        this.reloadingUntilMs = 0;
    }

    public int getClip(WeaponType weapon) {
        return ammoClips.getOrDefault(weapon, 0);
    }

    public int getReserve(WeaponType weapon) {
        return ammoReserves.getOrDefault(weapon, 0);
    }

    public boolean isReloading() {
        return System.currentTimeMillis() < reloadingUntilMs;
    }

    public boolean startReload() {
        if (dead || isReloading() || equippedWeapon.isMelee()) {
            return false;
        }
        int currentClip = getClip(equippedWeapon);
        int reserve = getReserve(equippedWeapon);
        if (currentClip >= equippedWeapon.getMagCapacity() || reserve <= 0) {
            return false;
        }

        this.reloadingUntilMs = System.currentTimeMillis() + equippedWeapon.getReloadDurationMs();
        return true;
    }

    public boolean completeReloadIfReady() {
        if (reloadingUntilMs > 0 && System.currentTimeMillis() >= reloadingUntilMs) {
            reloadingUntilMs = 0;
            int needed = equippedWeapon.getMagCapacity() - getClip(equippedWeapon);
            int reserve = getReserve(equippedWeapon);
            int transfer = Math.min(needed, reserve);

            ammoClips.put(equippedWeapon, getClip(equippedWeapon) + transfer);
            ammoReserves.put(equippedWeapon, reserve - transfer);
            return true;
        }
        return false;
    }

    public void setLastFireTimeMs(long timeMs) {
        this.lastFireTimeMs = timeMs;
    }

    /**
     * Check if player can fire the requested shot.
     * Enforces that players cannot fire while dead, while reloading,
     * or during the mandatory 5-second spawn protection period.
     */
    public boolean canFire(long shotId, WeaponType requestedWeapon) {
        if (dead) return false;
        // Requirement B: Protected player cannot fire weapons or attack with knife
        if (isSpawnProtected()) return false;
        if (requestedWeapon != equippedWeapon) return false;
        if (isReloading()) return false;

        // Check duplicate shot sequence ID
        if (shotId > 0 && processedShotIds.contains(shotId)) {
            return false;
        }

        // Fire rate cooldown check
        long now = System.currentTimeMillis();
        if (now - lastFireTimeMs < equippedWeapon.getFireCooldownMs()) {
            return false;
        }

        // Check ammo for firearms
        if (!equippedWeapon.isMelee()) {
            int clip = getClip(equippedWeapon);
            if (clip <= 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Record accepted shot
     */
    public void recordFire(long shotId) {
        lastFireTimeMs = System.currentTimeMillis();
        if (shotId > 0) {
            processedShotIds.add(shotId);
        }

        if (!equippedWeapon.isMelee()) {
            int current = getClip(equippedWeapon);
            ammoClips.put(equippedWeapon, Math.max(0, current - 1));
        }
    }

    /**
     * Apply damage to player. Returns resulting health.
     * Enforces that dead or spawn-protected players cannot take damage.
     */
    public int takeDamage(int amount) {
        if (dead || isSpawnProtected() || amount <= 0) {
            return health;
        }

        health = Math.max(0, health - amount);
        if (health == 0) {
            dead = true;
        }
        return health;
    }

    /**
     * Restore player state upon respawn
     */
    public void respawn(double x, double y, double z, double yaw) {
        this.health = MAX_HEALTH;
        this.dead = false;
        // Reapply mandatory 5-second spawn protection on every respawn
        applySpawnProtection();
        this.lastFireTimeMs = 0;
        this.reloadingUntilMs = 0;
        resetAmmo();

        this.state = new PlayerState(
                playerId,
                username,
                x,
                y,
                z,
                yaw,
                0.0,
                false,
                false,
                MAX_HEALTH,
                false,
                equippedWeapon.getId()
        );
    }

    public boolean checkRateLimit(int maxPerSecond) {
        long now = System.currentTimeMillis();
        if (now - windowStartTimeMs >= 1000) {
            windowStartTimeMs = now;
            messageCountInWindow.set(1);
            return true;
        }

        int current = messageCountInWindow.incrementAndGet();
        return current <= maxPerSecond;
    }

    public boolean isOpen() {
        return session != null && session.isOpen();
    }
}
