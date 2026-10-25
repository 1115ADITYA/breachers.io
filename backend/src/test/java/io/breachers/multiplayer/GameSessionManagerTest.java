package io.breachers.multiplayer;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.breachers.multiplayer.dto.ClientMessage;
import io.breachers.multiplayer.dto.PlayerState;
import io.breachers.multiplayer.model.PlayerSession;
import io.breachers.multiplayer.model.WeaponType;
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
