package io.breachers.multiplayer.model;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Server-authoritative Ammo Loot Drop.
 * Spawned on player elimination. Guarantees single-collector atomic pickup and automatic expiry.
 */
public class LootDrop {

    public static final long DEFAULT_LIFETIME_MS = 30_000L; // 30 seconds expiry
    public static final double MAX_PICKUP_DISTANCE = 3.5;    // 3.5 meters max pickup range

    private final String lootId;
    private final double x;
    private final double y;
    private final double z;
    private final String ammoType;
    private final int amount;
    private final long createdAt;
    private final long expiresAt;

    private final AtomicBoolean collected = new AtomicBoolean(false);
    private volatile String collectedBy;

    public LootDrop(String lootId, double x, double y, double z, String ammoType, int amount) {
        this(lootId, x, y, z, ammoType, amount, DEFAULT_LIFETIME_MS);
    }

    public LootDrop(String lootId, double x, double y, double z, String ammoType, int amount, long lifetimeMs) {
        this.lootId = lootId;
        this.x = x;
        this.y = y;
        this.z = z;
        this.ammoType = ammoType;
        this.amount = amount;
        this.createdAt = System.currentTimeMillis();
        this.expiresAt = this.createdAt + lifetimeMs;
    }

    public String getLootId() {
        return lootId;
    }

    public double getX() {
        return x;
    }

    public double getY() {
        return y;
    }

    public double getZ() {
        return z;
    }

    public String getAmmoType() {
        return ammoType;
    }

    public int getAmount() {
        return amount;
    }

    public boolean isCollected() {
        return collected.get();
    }

    public String getCollectedBy() {
        return collectedBy;
    }

    public boolean isExpired(long now) {
        return !collected.get() && now >= expiresAt;
    }

    /**
     * Atomically attempt to collect this loot drop.
     * @return true if successfully collected by this player, false if already collected or out of range
     */
    public boolean tryCollect(PlayerSession player) {
        if (collected.get()) {
            return false;
        }

        // Distance check
        double dx = this.x - player.getX();
        double dy = this.y - player.getY();
        double dz = this.z - player.getZ();
        double dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > MAX_PICKUP_DISTANCE) {
            return false;
        }

        if (collected.compareAndSet(false, true)) {
            this.collectedBy = player.getUsername();
            return true;
        }
        return false;
    }
}
