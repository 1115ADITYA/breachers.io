package io.breachers.multiplayer.config;

import io.breachers.multiplayer.handler.GameWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.Arrays;
import java.util.List;

/**
 * WebSocketConfig
 * Configures Spring WebSocket transport at endpoint `/ws/game`.
 * Supports persistent real-time multiplayer connections and production origin filtering
 * matching the deployed Vercel frontend domain.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final GameWebSocketHandler gameWebSocketHandler;
    private final List<String> allowedOrigins;

    public WebSocketConfig(
            GameWebSocketHandler gameWebSocketHandler,
            @Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String originsConfig
    ) {
        this.gameWebSocketHandler = gameWebSocketHandler;
        this.allowedOrigins = Arrays.stream(originsConfig.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.endsWith("/") ? s.substring(0, s.length() - 1) : s)
                .toList();
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(gameWebSocketHandler, "/ws/game")
                .setAllowedOriginPatterns(allowedOrigins.toArray(new String[0]));
    }

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }
}
