package io.breachers.persistence;

import java.time.LocalDateTime;
import java.util.List;

public record MatchRecord(
        String roomCode,
        String gameMode,
        String mapId,
        String winner,
        int redScore,
        int blueScore,
        int playerCount,
        String endReason,
        int durationSeconds,
        LocalDateTime completedAt,
        List<PlayerResult> playerResults
) {
    public record PlayerResult(
            String username,
            String team,
            int kills,
            int deaths,
            int score,
            boolean won
    ) {}
}
