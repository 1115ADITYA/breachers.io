package io.breachers.multiplayer.config;

import io.breachers.multiplayer.handler.GameWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistration;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * WebSocketConfig
 * Configures Spring WebSocket transport at endpoint `/ws/game`.
 * Supports persistent real-time multiplayer connections and production origin filtering
 * consistent with CORS_ALLOWED_ORIGINS environment variable.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final GameWebSocketHandler gameWebSocketHandler;
    private final List<String> rawOrigins;
    private final List<String> exactOrigins = new ArrayList<>();
    private final List<String> patternOrigins = new ArrayList<>();
    private final boolean hasGlobalWildcard;

    public WebSocketConfig(
            GameWebSocketHandler gameWebSocketHandler,
            @Value("${CORS_ALLOWED_ORIGINS:${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}}") String originsConfig
    ) {
        this.gameWebSocketHandler = gameWebSocketHandler;

        String input = (originsConfig == null || originsConfig.isBlank())
                ? "http://localhost:5173,http://127.0.0.1:5173"
                : originsConfig;

        this.rawOrigins = Arrays.stream(input.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> (s.length() > 1 && s.endsWith("/")) ? s.substring(0, s.length() - 1) : s)
                .toList();

        boolean wildcardFound = false;
        for (String origin : this.rawOrigins) {
            if ("*".equals(origin)) {
                wildcardFound = true;
            } else if (origin.contains("*")) {
                this.patternOrigins.add(origin);
            } else {
                this.exactOrigins.add(origin);
            }
        }
        this.hasGlobalWildcard = wildcardFound;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        WebSocketHandlerRegistration registration = registry.addHandler(gameWebSocketHandler, "/ws/game");

        if (hasGlobalWildcard) {
            registration.setAllowedOrigins("*");
        } else {
            if (!exactOrigins.isEmpty()) {
                registration.setAllowedOrigins(exactOrigins.toArray(new String[0]));
            }
            if (!patternOrigins.isEmpty()) {
                registration.setAllowedOriginPatterns(patternOrigins.toArray(new String[0]));
            }
        }
    }

    public List<String> getAllowedOrigins() {
        return rawOrigins;
    }

    public List<String> getExactOrigins() {
        return exactOrigins;
    }

    public List<String> getPatternOrigins() {
        return patternOrigins;
    }

    public boolean isHasGlobalWildcard() {
        return hasGlobalWildcard;
    }
}
