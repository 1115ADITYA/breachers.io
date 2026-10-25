package io.breachers.multiplayer.model;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Server-authoritative Explosive Barrel model.
 * Handles hit points, fuse countdown, detonation state, and chain reaction prevention.
 */
public class ExplosiveBarrel {

    public static final int INITIAL_HEALTH = 50;
    public static final double EXPLOSION_RADIUS = 8.0;
    public static final int MAX_EXPLOSION_DAMAGE = 120;
    public static final double FUSE_DURATION_SEC = 0.6;

    private final String barrelId;
    private final double x;
    private final double y;
    private final double z;

    private int health = INITIAL_HEALTH;
    private final AtomicBoolean ignited = new AtomicBoolean(false);
    private final AtomicBoolean exploded = new AtomicBoolean(false);

    private volatile PlayerSession ignitedBy;
    private volatile long igniteTimestamp = 0;

    public ExplosiveBarrel(String barrelId, double x, double y, double z) {
        this.barrelId = barrelId;
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public String getBarrelId() {
        return barrelId;
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

    public int getHealth() {
        return health;
    }

    public boolean isIgnited() {
        return ignited.get();
    }

    public boolean isExploded() {
        return exploded.get();
    }

    public PlayerSession getIgnitedBy() {
        return ignitedBy;
    }

    public long getIgniteTimestamp() {
        return igniteTimestamp;
    }

    /**
     * Apply bullet damage to barrel.
     * @return true if this damage caused barrel to ignite for the first time
     */
    public synchronized boolean takeDamage(int damage, PlayerSession shooter) {
        if (exploded.get()) {
            return false;
        }

        health -= damage;
        if (health <= 0 || !ignited.get()) {
            return ignite(shooter);
        }
        return false;
    }

    /**
     * Ignite barrel fuse.
     * @return true if successfully ignited, false if already ignited or exploded
     */
    public boolean ignite(PlayerSession shooter) {
        if (exploded.get()) {
            return false;
        }
        if (ignited.compareAndSet(false, true)) {
            this.ignitedBy = shooter;
            this.igniteTimestamp = System.currentTimeMillis();
            return true;
        }
        return false;
    }

    /**
     * Authoritatively detonate barrel.
     * @return true if detonation transitioned from unexploded to exploded (ensures exactly ONCE detonation)
     */
    public boolean detonate() {
        ignited.set(true);
        return exploded.compareAndSet(false, true);
    }

    /**
     * Reset barrel for room restart
     */
    public synchronized void reset() {
        health = INITIAL_HEALTH;
        ignited.set(false);
        exploded.set(false);
        ignitedBy = null;
        igniteTimestamp = 0;
    }

    /**
     * Calculate 3D Euclidean distance to point
     */
    public double distanceTo(double targetX, double targetY, double targetZ) {
        double dx = this.x - targetX;
        double dy = this.y - targetY;
        double dz = this.z - targetZ;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
