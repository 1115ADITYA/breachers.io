package io.breachers.persistence;

import java.time.LocalDateTime;

public record PlayerStats(
        String username,
        int matchesPlayed,
        int wins,
        int losses,
        int kills,
        int deaths,
        int score,
        LocalDateTime lastPlayedAt
) {
    public double getKillDeathRatio() {
        if (deaths == 0) {
            return kills;
        }
        return Math.round(((double) kills / deaths) * 100.0) / 100.0;
    }

    public double getWinRatePercent() {
        if (matchesPlayed == 0) {
            return 0.0;
        }
        return Math.round(((double) wins / matchesPlayed) * 1000.0) / 10.0;
    }
}
