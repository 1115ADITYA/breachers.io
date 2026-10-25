package io.breachers.persistence;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class MatchPersistenceServiceTest {

    @Autowired
    private MatchPersistenceService persistenceService;

    @Test
    @DisplayName("Should persist match record and update player statistics")
    void testRecordMatchAndQuery() {
        String roomCode = "TEST99";
        LocalDateTime now = LocalDateTime.now();

        List<MatchRecord.PlayerResult> players = List.of(
                new MatchRecord.PlayerResult("Striker", "RED", 12, 3, 1125, true),
                new MatchRecord.PlayerResult("Defender", "BLUE", 5, 8, 300, false)
        );

        MatchRecord record = new MatchRecord(
                roomCode,
                "TDM",
                "container_yard",
                "RED",
                25,
                18,
                2,
                "Kill limit reached",
                145,
                now,
                players
        );

        // Synchronous write test
        persistenceService.recordMatch(record);

        // Verify match in match_history
        List<MatchSummary> recentMatches = persistenceService.getRecentMatches(10);
        assertFalse(recentMatches.isEmpty(), "Recent matches should not be empty");

        MatchSummary match = recentMatches.stream()
                .filter(m -> roomCode.equals(m.roomCode()))
                .findFirst()
                .orElse(null);

        assertNotNull(match, "Match with roomCode " + roomCode + " should exist in DB");
        assertEquals("TDM", match.gameMode());
        assertEquals("RED", match.winner());
        assertEquals(25, match.redScore());
        assertEquals(18, match.blueScore());

        // Verify player statistics updated
        Optional<PlayerStats> strikerStats = persistenceService.getPlayerStats("Striker");
        assertTrue(strikerStats.isPresent(), "Striker player stats should be recorded");
        assertTrue(strikerStats.get().matchesPlayed() >= 1);
        assertTrue(strikerStats.get().kills() >= 12);
        assertTrue(strikerStats.get().wins() >= 1);

        Optional<PlayerStats> defenderStats = persistenceService.getPlayerStats("Defender");
        assertTrue(defenderStats.isPresent(), "Defender player stats should be recorded");
        assertTrue(defenderStats.get().losses() >= 1);

        // Verify top players query
        List<PlayerStats> topPlayers = persistenceService.getTopPlayers(10);
        assertFalse(topPlayers.isEmpty());

        // Verify global metrics
        Map<String, Object> global = persistenceService.getGlobalStats();
        assertNotNull(global);
        assertTrue((int) global.get("totalMatches") >= 1);
        assertTrue((int) global.get("registeredOperators") >= 2);
    }

    @Test
    @DisplayName("Should safely handle null record without throwing exceptions")
    void testSafeHandlingOfNullRecord() {
        assertDoesNotThrow(() -> persistenceService.recordMatch(null));
        assertDoesNotThrow(() -> persistenceService.recordMatchAsync(null));
    }
}
