package io.breachers.multiplayer.model;

public enum WeaponType {
    ASSAULT("ASSAULT", "Assault Rifle", 24, 0.11, 30, 90, 1.8, 120.0, false),
    PISTOL("PISTOL", "Tactical Pistol", 38, 0.25, 12, 36, 1.4, 80.0, false),
    KNIFE("KNIFE", "Combat Knife", 55, 0.50, 0, 0, 0.0, 2.5, true);

    private final String id;
    private final String displayName;
    private final int baseDamage;
    private final double fireCooldownSec;
    private final int magCapacity;
    private final int maxReserve;
    private final double reloadDurationSec;
    private final double maxRange;
    private final boolean melee;

    WeaponType(String id, String displayName, int baseDamage, double fireCooldownSec,
               int magCapacity, int maxReserve, double reloadDurationSec, double maxRange, boolean melee) {
        this.id = id;
        this.displayName = displayName;
        this.baseDamage = baseDamage;
        this.fireCooldownSec = fireCooldownSec;
        this.magCapacity = magCapacity;
        this.maxReserve = maxReserve;
        this.reloadDurationSec = reloadDurationSec;
        this.maxRange = maxRange;
        this.melee = melee;
    }

    public String getId() {
        return id;
    }

    public String getDisplayName() {
        return displayName;
    }

    public int getBaseDamage() {
        return baseDamage;
    }

    public int getDamage() {
        return baseDamage;
    }

    public long getFireCooldownMs() {
        return (long) (fireCooldownSec * 1000);
    }

    public int getMagCapacity() {
        return magCapacity;
    }

    public int getMaxReserve() {
        return maxReserve;
    }

    public long getReloadDurationMs() {
        return (long) (reloadDurationSec * 1000);
    }

    public double getMaxRange() {
        return maxRange;
    }

    public boolean isMelee() {
        return melee;
    }

    public static WeaponType fromString(String raw) {
        if (raw == null) return ASSAULT;
        for (WeaponType w : values()) {
            if (w.name().equalsIgnoreCase(raw) || w.getId().equalsIgnoreCase(raw)) {
                return w;
            }
        }
        return ASSAULT;
    }
}
