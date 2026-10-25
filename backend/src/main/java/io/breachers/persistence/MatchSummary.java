package io.breachers.persistence;

import java.time.LocalDateTime;

public record MatchSummary(
        long id,
        String roomCode,
        String gameMode,
        String mapId,
        String winner,
        int redScore,
        int blueScore,
        int playerCount,
        String endReason,
        int durationSeconds,
        LocalDateTime completedAt
) {}
