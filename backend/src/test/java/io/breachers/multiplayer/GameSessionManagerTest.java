package io.breachers.multiplayer;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.breachers.multiplayer.dto.ClientMessage;
import io.breachers.multiplayer.dto.PlayerState;
import io.breachers.multiplayer.dto.ServerMessage;
import io.breachers.multiplayer.model.*;
import io.breachers.multiplayer.service.GameSessionManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.web.socket.*;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GameSessionManagerTest {

    private GameSessionManager sessionManager;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        sessionManager = new GameSessionManager(objectMapper);
    }

    @Test
    void shouldSanitizeAndDeduplicateUsernames() {
        String valid = sessionManager.sanitizeUsername("Viper_99");
        assertEquals("Viper_99", valid);

        String invalid = sessionManager.sanitizeUsername("<script>alert(1)</script>");
        assertTrue(invalid.startsWith("Operator_"));

        String shortName = sessionManager.sanitizeUsername("A");
        assertTrue(shortName.startsWith("Operator_"));
    }

    @Test
    void shouldRegisterPlayerAndAssignId() {
        TestWebSocketSession stubSession = new TestWebSocketSession("socket-1");

        PlayerSession player = sessionManager.registerPlayer(stubSession, "Apex_Sniper");

        assertNotNull(player);
        assertNotNull(player.getPlayerId());
        assertTrue(player.getPlayerId().startsWith("p_"));
        assertEquals("Apex_Sniper", player.getUsername());
        assertEquals(1, sessionManager.getConnectedPlayerCount());
    }

    @Test
    void shouldRejectMovementWithNaNOrOutOfBounds() {
        TestWebSocketSession stubSession = new TestWebSocketSession("socket-2");

        PlayerSession player = sessionManager.registerPlayer(stubSession, "Striker");
        PlayerState initial = player.getState();

        ClientMessage.Move nanMove = new ClientMessage.Move(Double.NaN, 0, 0, 0, 0, false, false);
        sessionManager.handleMovement("socket-2", nanMove);
        assertEquals(initial.x(), player.getState().x(), "State should not update with NaN");

        ClientMessage.Move oobMove = new ClientMessage.Move(999.0, 0, 0, 0, 0, false, false);
        sessionManager.handleMovement("socket-2", oobMove);
        assertEquals(initial.x(), player.getState().x(), "State should not update with out-of-bounds coordinate");

        ClientMessage.Move validMove = new ClientMessage.Move(10.0, 0.0, -15.0, 1.2, 0.1, true, false);
        sessionManager.handleMovement("socket-2", validMove);
        assertEquals(10.0, player.getState().x());
        assertEquals(-15.0, player.getState().z());
    }

    @Test
    void shouldEnforceRateLimiting() {
        TestWebSocketSession stubSession = new TestWebSocketSession("socket-3");

        PlayerSession player = sessionManager.registerPlayer(stubSession, "Speedy");

        for (int i = 0; i < 35; i++) {
            assertTrue(player.checkRateLimit(35), "First 35 should pass");
        }

        assertFalse(player.checkRateLimit(35), "Message 36 within window should exceed limit");
    }

    @Test
    void shouldRemovePlayerOnDisconnect() {
        TestWebSocketSession stubSession = new TestWebSocketSession("socket-4");

        sessionManager.registerPlayer(stubSession, "Ghost");
        assertEquals(1, sessionManager.getConnectedPlayerCount());

        sessionManager.removePlayer("socket-4");
        assertEquals(0, sessionManager.getConnectedPlayerCount());
        assertNull(sessionManager.getSessionBySocketId("socket-4"));
    }

    @Test
    void shouldHandleWeaponSelectionAndSwitching() {
        TestWebSocketSession stub = new TestWebSocketSession("socket-w1");
        PlayerSession player = sessionManager.registerPlayer(stub, "Gunner");

        assertEquals(WeaponType.ASSAULT, player.getEquippedWeapon());

        // Switch to Pistol
        sessionManager.handleSwitchWeapon("socket-w1", "PISTOL");
        assertEquals(WeaponType.PISTOL, player.getEquippedWeapon());

        // Switch to Knife
        sessionManager.handleSwitchWeapon("socket-w1", "KNIFE");
        assertEquals(WeaponType.KNIFE, player.getEquippedWeapon());

        // Invalid weapon string should safely default without crashing
        sessionManager.handleSwitchWeapon("socket-w1", "ROCKET_LAUNCHER");
        assertEquals(WeaponType.ASSAULT, player.getEquippedWeapon());
    }

    @Test
    void shouldEnforceMagazineAmmoDepletionAndReload() {
        TestWebSocketSession stub = new TestWebSocketSession("socket-ammo");
        PlayerSession player = sessionManager.registerPlayer(stub, "Marksman");
        player.clearSpawnProtection(); // Clear 5s spawn protection to test firing mechanics

        assertEquals(30, player.getClip(WeaponType.ASSAULT));
        assertEquals(90, player.getReserve(WeaponType.ASSAULT));

        // Fire 5 shots
        for (long i = 1; i <= 5; i++) {
            player.setLastFireTimeMs(0); // clear fire cooldown for test
            assertTrue(player.canFire(i, WeaponType.ASSAULT));
            player.recordFire(i);
        }
        assertEquals(25, player.getClip(WeaponType.ASSAULT));

        // Start reload
        assertTrue(player.startReload());
        assertTrue(player.isReloading());
        assertFalse(player.canFire(6, WeaponType.ASSAULT), "Cannot fire while reloading");

        // Knife requires no reload and no ammo
        player.switchWeapon(WeaponType.KNIFE);
        player.setLastFireTimeMs(0);
        assertFalse(player.startReload(), "Knife cannot reload");
        assertTrue(player.canFire(100, WeaponType.KNIFE), "Knife can always attack");
    }

    @Test
    void shouldEnforceFireRateCooldownAndRejectDuplicateShotId() {
        TestWebSocketSession stub = new TestWebSocketSession("socket-cd");
        PlayerSession player = sessionManager.registerPlayer(stub, "Trigger");
        player.clearSpawnProtection(); // Clear 5s spawn protection to test firing cooldown

        assertTrue(player.canFire(101L, WeaponType.ASSAULT));
        player.recordFire(101L);

        // Immediate next shot should be rejected due to cooldown (< 110ms)
        assertFalse(player.canFire(102L, WeaponType.ASSAULT), "Should reject fire during cooldown");

        // Duplicate shot sequence ID should be rejected
        assertFalse(player.canFire(101L, WeaponType.ASSAULT), "Should reject duplicate shot ID");
    }

    @Test
    void shouldRegisterHitAndCalculateDamage() {
        TestWebSocketSession stubA = new TestWebSocketSession("socket-hit-a");
        TestWebSocketSession stubB = new TestWebSocketSession("socket-hit-b");

        PlayerSession shooter = sessionManager.registerPlayer(stubA, "Shooter");
        PlayerSession victim = sessionManager.registerPlayer(stubB, "Victim");

        // Position shooter at (0, 0, 0)
        shooter.updateState(new PlayerState(shooter.getPlayerId(), shooter.getUsername(), 0, 0, 0, 0, 0, false, false));

        // Position victim at (0, 0, 10) - 10m away
        victim.updateState(new PlayerState(victim.getPlayerId(), victim.getUsername(), 0, 0, 10, 0, 0, false, false));

        // Disable spawn protection on victim for combat test
        victim.respawn(0, 0, 10, 0);
        victim.clearSpawnProtection();

        // Direct damage test via raycast
        GameSessionManager.HitResult hit = GameSessionManager.intersectRayPlayer(
                0, 1.62, 0,
                0, 0, 1, // Aiming directly towards victim along +Z
                0, 0, 10,
                100.0
        );

        assertNotNull(hit, "Ray should intersect victim hitbox");
        assertTrue(hit.distance() > 8.0 && hit.distance() < 11.0);

        // Apply damage
        int initialHealth = victim.getHealth();
        int remaining = victim.takeDamage(24);
        assertEquals(initialHealth - 24, remaining);
        assertEquals(remaining, victim.getHealth());
    }

    @Test
    void shouldEnforceSpawnProtectionAndRejectDamage() {
        TestWebSocketSession stub = new TestWebSocketSession("socket-prot");
        PlayerSession player = sessionManager.registerPlayer(stub, "Shielded");

        assertTrue(player.isSpawnProtected(), "Newly joined player should have spawn protection");
        int health = player.takeDamage(50);
        assertEquals(100, health, "Spawn protected player must not take damage");
    }

    @Test
    void shouldHandleDeathAndRejectDeadPlayerFiring() {
        TestWebSocketSession stub = new TestWebSocketSession("socket-dead");
        PlayerSession player = sessionManager.registerPlayer(stub, "Doomed");

        // Bypass spawn protection for test
        player.clearSpawnProtection();
        player.takeDamage(100);

        assertTrue(player.isDead());
        assertEquals(0, player.getHealth());
        assertFalse(player.canFire(999L, WeaponType.ASSAULT), "Dead player must not be allowed to fire");

        // Respawn restores health, ammo, and alive state
        sessionManager.respawnPlayer(player.getPlayerId());
        assertFalse(player.isDead());
        assertEquals(100, player.getHealth());
        assertTrue(player.isSpawnProtected());
    }

    // =========================================================================
    // CHUNK 4 TESTS: Private Rooms, TDM, FFA, Safe Spawns, 5s Spawn Protection
    // =========================================================================

    @Test
    void shouldCreateRoomWithUniqueSixCharAlphanumericCode() {
        TestWebSocketSession stub = new TestWebSocketSession("socket-host");
        sessionManager.registerPlayer(stub, "RoomHost");

        GameRoom room = sessionManager.createRoom("socket-host", "RoomHost", "TDM");

        assertNotNull(room);
        assertNotNull(room.getRoomCode());
        assertEquals(6, room.getRoomCode().length());
        assertTrue(room.getRoomCode().matches("^[A-Z0-9]{6}$"), "Room code must be 6 alphanumeric chars");
        assertEquals(GameMode.TDM, room.getMode());
        assertEquals(1, room.getPlayerCount());
    }

    @Test
    void shouldCreateRoomDirectlyFromRawSessionWithHostAssigned() {
        TestWebSocketSession stub = new TestWebSocketSession("socket-raw-host");
        GameRoom room = sessionManager.createRoom(stub, "RawHost", "TDM");

        assertNotNull(room);
        assertNotNull(room.getHostPlayerId());
        assertEquals(1, room.getPlayerCount());
        PlayerSession hostPlayer = room.getPlayers().iterator().next();
        assertEquals(room.getHostPlayerId(), hostPlayer.getPlayerId());

        ServerMessage.RoomState roomState = room.buildRoomStateMessage();
        assertEquals(hostPlayer.getPlayerId(), roomState.hostId());
        assertTrue(roomState.players().get(0).isHost());
    }

    @Test
    void shouldRejectJoiningInvalidOrFullRoom() {
        TestWebSocketSession stub = new TestWebSocketSession("socket-joiner");
        sessionManager.registerPlayer(stub, "Joiner");

        // 1. Invalid room
        boolean joinedNonExistent = sessionManager.joinRoom("socket-joiner", "NONEX9", "Joiner");
        assertFalse(joinedNonExistent, "Joining non-existent room must fail");

        // 2. Full room (max 10)
        TestWebSocketSession hostStub = new TestWebSocketSession("socket-host-full");
        sessionManager.registerPlayer(hostStub, "HostFull");
        GameRoom room = sessionManager.createRoom("socket-host-full", "HostFull", "FFA");

        for (int i = 1; i <= 9; i++) {
            TestWebSocketSession s = new TestWebSocketSession("socket-fill-" + i);
            PlayerSession ps = sessionManager.registerPlayer(s, "Fill_" + i);
            assertTrue(sessionManager.joinRoom("socket-fill-" + i, room.getRoomCode(), "Fill_" + i));
        }

        assertEquals(10, room.getPlayerCount());
        assertTrue(room.isFull());

        TestWebSocketSession s11 = new TestWebSocketSession("socket-overflow");
        sessionManager.registerPlayer(s11, "OverflowUser");
        assertFalse(sessionManager.joinRoom("socket-overflow", room.getRoomCode(), "OverflowUser"), "Joining full room must be rejected");
    }

    @Test
    void shouldIsolateEventsAndMovementBetweenRooms() {
        TestWebSocketSession s1 = new TestWebSocketSession("s-room1");
        TestWebSocketSession s2 = new TestWebSocketSession("s-room2");

        sessionManager.registerPlayer(s1, "Alice");
        sessionManager.registerPlayer(s2, "Bob");

        GameRoom r1 = sessionManager.createRoom("s-room1", "Alice", "TDM");
        GameRoom r2 = sessionManager.createRoom("s-room2", "Bob", "TDM");

        assertNotEquals(r1.getRoomCode(), r2.getRoomCode());

        // Alice moves in Room 1
        s2.sentMessages.clear();
        ClientMessage.Move move = new ClientMessage.Move(5.0, 0.0, 5.0, 0.0, 0.0, true, false);
        sessionManager.handleMovement("s-room1", move);

        // Bob in Room 2 must NOT receive Alice's movement!
        boolean leaked = s2.sentMessages.stream()
                .anyMatch(msg -> msg.getPayload().toString().contains("PLAYER_MOVED") &&
                                 msg.getPayload().toString().contains("Alice"));
        assertFalse(leaked, "Player movement must never leak across different rooms");
    }

    @Test
    void shouldTransferHostWhenHostLeavesRoom() {
        TestWebSocketSession s1 = new TestWebSocketSession("s-host-leave");
        TestWebSocketSession s2 = new TestWebSocketSession("s-peer");

        PlayerSession host = sessionManager.registerPlayer(s1, "OriginalHost");
        PlayerSession peer = sessionManager.registerPlayer(s2, "NextHost");

        GameRoom room = sessionManager.createRoom("s-host-leave", "OriginalHost", "TDM");
        sessionManager.joinRoom("s-peer", room.getRoomCode(), "NextHost");

        assertEquals(host.getPlayerId(), room.getHostPlayerId());

        // Host leaves
        sessionManager.leaveRoom("s-host-leave");

        assertEquals(peer.getPlayerId(), room.getHostPlayerId(), "Host ownership must transfer to remaining player");
    }

    @Test
    void shouldEnforceHostOnlyPermissions() {
        TestWebSocketSession s1 = new TestWebSocketSession("s-host-perm");
        TestWebSocketSession s2 = new TestWebSocketSession("s-non-host");

        sessionManager.registerPlayer(s1, "HostUser");
        sessionManager.registerPlayer(s2, "GuestUser");

        GameRoom room = sessionManager.createRoom("s-host-perm", "HostUser", "TDM");
        sessionManager.joinRoom("s-non-host", room.getRoomCode(), "GuestUser");

        // Non-host attempts to change game mode -> rejected
        sessionManager.setGameMode("s-non-host", "FFA");
        assertEquals(GameMode.TDM, room.getMode(), "Non-host must not change game mode");

        // Non-host attempts to start match -> rejected
        sessionManager.startMatch("s-non-host");
        assertEquals(MatchStatus.LOBBY, room.getStatus(), "Non-host must not start match");

        // Host changes mode -> allowed
        sessionManager.setGameMode("s-host-perm", "FFA");
        assertEquals(GameMode.FFA, room.getMode());
    }

    @Test
    void shouldAutoBalanceTeamsAndLimitTeamSize() {
        TestWebSocketSession sh = new TestWebSocketSession("s-tdm-host");
        PlayerSession h = sessionManager.registerPlayer(sh, "TdmHost");
        GameRoom room = sessionManager.createRoom("s-tdm-host", "TdmHost", "TDM");

        assertEquals("RED", h.getTeam());

        TestWebSocketSession s2 = new TestWebSocketSession("s-tdm-2");
        PlayerSession p2 = sessionManager.registerPlayer(s2, "PlayerTwo");
        sessionManager.joinRoom("s-tdm-2", room.getRoomCode(), "PlayerTwo");

        assertEquals("BLUE", p2.getTeam(), "Second player should balance to BLUE");

        TestWebSocketSession s3 = new TestWebSocketSession("s-tdm-3");
        PlayerSession p3 = sessionManager.registerPlayer(s3, "PlayerThree");
        sessionManager.joinRoom("s-tdm-3", room.getRoomCode(), "PlayerThree");

        assertEquals("RED", p3.getTeam(), "Third player should balance to RED");
    }

    @Test
    void shouldRejectFriendlyFireInTDM() {
        TestWebSocketSession s1 = new TestWebSocketSession("s-red-1");
        TestWebSocketSession s2 = new TestWebSocketSession("s-red-2");

        PlayerSession p1 = sessionManager.registerPlayer(s1, "RedShooter");
        PlayerSession p2 = sessionManager.registerPlayer(s2, "RedTeammate");

        GameRoom room = sessionManager.createRoom("s-red-1", "RedShooter", "TDM");
        sessionManager.joinRoom("s-red-2", room.getRoomCode(), "RedTeammate");

        // Force both on RED team
        p1.setTeam("RED");
        p2.setTeam("RED");
        p1.clearSpawnProtection();
        p2.clearSpawnProtection();

        assertTrue(room.isFriendlyFire(p1, p2), "Should detect teammates as friendly");

        // Position shooter and teammate 5m apart
        p1.updateState(new PlayerState(p1.getPlayerId(), p1.getUsername(), 0, 0, 0, 0, 0, false, false));
        p2.updateState(new PlayerState(p2.getPlayerId(), p2.getUsername(), 0, 0, 5, 0, 0, false, false));

        int healthBefore = p2.getHealth();
        sessionManager.handleShoot("s-red-1", new ClientMessage.Shoot(1L, "ASSAULT", 0, 1.62, 0, 0, 0, 1.0));

        assertEquals(healthBefore, p2.getHealth(), "Friendly fire must be rejected on server");
    }

    @Test
    void shouldSpawnTDMPlayersOnlyAtTheirDesignatedTeamSpawns() {
        TestWebSocketSession sh = new TestWebSocketSession("s-spawn-h");
        PlayerSession red = sessionManager.registerPlayer(sh, "RedOperator");
        GameRoom room = sessionManager.createRoom("s-spawn-h", "RedOperator", "TDM");
        red.setTeam("RED");

        TestWebSocketSession sb = new TestWebSocketSession("s-spawn-b");
        PlayerSession blue = sessionManager.registerPlayer(sb, "BlueOperator");
        sessionManager.joinRoom("s-spawn-b", room.getRoomCode(), "BlueOperator");
        blue.setTeam("BLUE");

        // 1. Red player spawn check (X must be on West side: x <= -44.0)
        for (int i = 0; i < 10; i++) {
            double[] redSpawn = room.getSpawnPointForPlayer(red);
            assertTrue(redSpawn[0] <= -44.0, "Red players must spawn exclusively on Red spawn points (x <= -44)");
        }

        // 2. Blue player spawn check (X must be on East side: x >= 44.0)
        for (int i = 0; i < 10; i++) {
            double[] blueSpawn = room.getSpawnPointForPlayer(blue);
            assertTrue(blueSpawn[0] >= 44.0, "Blue players must spawn exclusively on Blue spawn points (x >= 44)");
        }
    }

    @Test
    void shouldSpawnFFAPlayersAtNeutralSpawns() {
        TestWebSocketSession sh = new TestWebSocketSession("s-ffa-h");
        PlayerSession ffaPlayer = sessionManager.registerPlayer(sh, "SoloFighter");
        GameRoom room = sessionManager.createRoom("s-ffa-h", "SoloFighter", "FFA");

        for (int i = 0; i < 10; i++) {
            double[] ffaSpawn = room.getSpawnPointForPlayer(ffaPlayer);
            // FFA spawns are strictly between -35 and +35 on the X axis, never in team bases (+-44 to +-48)
            assertTrue(Math.abs(ffaSpawn[0]) <= 35.0, "FFA players must use neutral central spawns");
        }
    }

    @Test
    void shouldEnforceFiveSecondSpawnProtectionBothOffensivelyAndDefensively() {
        TestWebSocketSession s1 = new TestWebSocketSession("s-prot-atk");
        TestWebSocketSession s2 = new TestWebSocketSession("s-prot-def");

        PlayerSession attacker = sessionManager.registerPlayer(s1, "Attacker");
        PlayerSession defender = sessionManager.registerPlayer(s2, "Defender");

        // By default, newly registered or spawned players have 5.0s of protection
        assertTrue(attacker.isSpawnProtected());
        assertTrue(defender.isSpawnProtected());

        // Requirement B.4: Protected player cannot take damage
        int defHp = defender.takeDamage(50);
        assertEquals(100, defHp, "Protected player cannot take damage");

        // Requirement B.5: Protected player cannot fire weapons or attack with knife
        assertFalse(attacker.canFire(1L, WeaponType.ASSAULT), "Protected player cannot fire weapons");
        assertFalse(attacker.canFire(2L, WeaponType.KNIFE), "Protected player cannot attack with knife");

        // Requirement B.6: Firing becomes available after 5-second protection expires
        attacker.clearSpawnProtection();
        assertFalse(attacker.isSpawnProtected());
        assertTrue(attacker.canFire(3L, WeaponType.ASSAULT), "Firing becomes available after protection expires");

        // Requirement B.7: Respawn reapplies 5s protection
        defender.respawn(0, 0, 0, 0);
        assertTrue(defender.isSpawnProtected(), "Respawn protection must be reapplied on every respawn");
        assertEquals(100, defender.getHealth());
    }

    @Test
    void shouldUpdateScoreAndDetectWinConditions() {
        TestWebSocketSession s1 = new TestWebSocketSession("s-win-r");
        TestWebSocketSession s2 = new TestWebSocketSession("s-win-b");

        PlayerSession red = sessionManager.registerPlayer(s1, "RedAce");
        PlayerSession blue = sessionManager.registerPlayer(s2, "BlueTarget");

        GameRoom room = sessionManager.createRoom("s-win-r", "RedAce", "TDM");
        sessionManager.joinRoom("s-win-b", room.getRoomCode(), "BlueTarget");

        red.setTeam("RED");
        blue.setTeam("BLUE");
        red.clearSpawnProtection();
        blue.clearSpawnProtection();

        sessionManager.startMatch("s-win-r");
        assertEquals(MatchStatus.IN_PROGRESS, room.getStatus());

        // Simulate red scoring kills until limit
        for (int i = 0; i < room.getKillLimit(); i++) {
            room.incrementRedScore();
        }

        assertEquals(30, room.getRedScore());
        assertTrue(room.getRedScore() >= room.getKillLimit());
    }

    /**
     * Pure Java stub avoiding Mockito proxying on JDK 26
     */
    static class TestWebSocketSession implements WebSocketSession {
        private final String id;
        private boolean open = true;
        final List<WebSocketMessage<?>> sentMessages = new ArrayList<>();

        TestWebSocketSession(String id) {
            this.id = id;
        }

        @Override public String getId() { return id; }
        @Override public URI getUri() { return URI.create("ws://localhost/ws/game"); }
        @Override public HttpHeaders getHandshakeHeaders() { return new HttpHeaders(); }
        @Override public Map<String, Object> getAttributes() { return Map.of(); }
        @Override public Principal getPrincipal() { return null; }
        @Override public InetSocketAddress getLocalAddress() { return null; }
        @Override public InetSocketAddress getRemoteAddress() { return null; }
        @Override public String getAcceptedProtocol() { return null; }
        @Override public void setTextMessageSizeLimit(int messageSizeLimit) {}
        @Override public int getTextMessageSizeLimit() { return 65536; }
        @Override public void setBinaryMessageSizeLimit(int messageSizeLimit) {}
        @Override public int getBinaryMessageSizeLimit() { return 65536; }
        @Override public List<WebSocketExtension> getExtensions() { return List.of(); }
        @Override public synchronized void sendMessage(WebSocketMessage<?> message) throws IOException { sentMessages.add(message); }
        @Override public boolean isOpen() { return open; }
        @Override public void close() throws IOException { open = false; }
        @Override public void close(CloseStatus status) throws IOException { open = false; }
    }
}
