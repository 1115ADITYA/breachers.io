package io.breachers.multiplayer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GameWebSocketIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void testClientCanConnectJoinAndReceiveWelcome() throws Exception {
        StandardWebSocketClient client = new StandardWebSocketClient();
        BlockingQueue<String> messagesReceived = new ArrayBlockingQueue<>(10);

        WebSocketSession session = client.execute(new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                messagesReceived.offer(message.getPayload());
            }
        }, "ws://localhost:" + port + "/ws/game").get(5, TimeUnit.SECONDS);

        assertTrue(session.isOpen());

        // Send JOIN message
        String joinPayload = "{\"type\":\"JOIN\",\"username\":\"Tester_01\"}";
        session.sendMessage(new TextMessage(joinPayload));

        // Await WELCOME message
        String response = messagesReceived.poll(5, TimeUnit.SECONDS);
        assertNotNull(response, "Should receive WELCOME response from server");

        JsonNode json = objectMapper.readTree(response);
        assertEquals("WELCOME", json.get("type").asText());
        assertEquals("Tester_01", json.get("username").asText());
        assertTrue(json.has("playerId"));
        assertTrue(json.get("playerId").asText().startsWith("p_"));
        assertTrue(json.has("players"));

        session.close();
    }
}
