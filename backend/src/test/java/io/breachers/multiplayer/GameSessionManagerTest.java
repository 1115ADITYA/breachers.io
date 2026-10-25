package io.breachers.multiplayer;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.breachers.multiplayer.dto.ClientMessage;
import io.breachers.multiplayer.dto.PlayerState;
import io.breachers.multiplayer.model.PlayerSession;
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

        // Invalid characters should fallback to Operator_XXX
        String invalid = sessionManager.sanitizeUsername("<script>alert(1)</script>");
        assertTrue(invalid.startsWith("Operator_"));

        // Too short should fallback
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

        // 1. Send NaN
        ClientMessage.Move nanMove = new ClientMessage.Move(Double.NaN, 0, 0, 0, 0, false, false);
        sessionManager.handleMovement("socket-2", nanMove);
        assertEquals(initial.x(), player.getState().x(), "State should not update with NaN");

        // 2. Send out of bounds coordinate (e.g. x = 999m beyond yard walls)
        ClientMessage.Move oobMove = new ClientMessage.Move(999.0, 0, 0, 0, 0, false, false);
        sessionManager.handleMovement("socket-2", oobMove);
        assertEquals(initial.x(), player.getState().x(), "State should not update with out-of-bounds coordinate");

        // 3. Send valid move
        ClientMessage.Move validMove = new ClientMessage.Move(10.0, 0.0, -15.0, 1.2, 0.1, true, false);
        sessionManager.handleMovement("socket-2", validMove);
        assertEquals(10.0, player.getState().x());
        assertEquals(-15.0, player.getState().z());
    }

    @Test
    void shouldEnforceRateLimiting() {
        TestWebSocketSession stubSession = new TestWebSocketSession("socket-3");

        PlayerSession player = sessionManager.registerPlayer(stubSession, "Speedy");

        // Send 35 messages within limit
        for (int i = 0; i < 35; i++) {
            assertTrue(player.checkRateLimit(35), "First 35 should pass");
        }

        // 36th message in same window should be blocked
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
