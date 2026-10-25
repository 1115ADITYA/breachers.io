package io.breachers.multiplayer.model;

public enum GameMode {
    TDM("Team Deathmatch", 30, 600), // 30 kills, 10 minutes (600s)
    FFA("Free For All", 20, 600);    // 20 kills, 10 minutes (600s)

    private final String displayName;
    private final int defaultKillLimit;
    private final int defaultDurationSeconds;

    GameMode(String displayName, int defaultKillLimit, int defaultDurationSeconds) {
        this.displayName = displayName;
        this.defaultKillLimit = defaultKillLimit;
        this.defaultDurationSeconds = defaultDurationSeconds;
    }

    public String getDisplayName() {
        return displayName;
    }

    public int getDefaultKillLimit() {
        return defaultKillLimit;
    }

    public int getDefaultDurationSeconds() {
        return defaultDurationSeconds;
    }

    public static GameMode fromString(String val) {
        if (val == null) return TDM;
        try {
            return GameMode.valueOf(val.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return TDM;
        }
    }
}
