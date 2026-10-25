package io.breachers.multiplayer.config;

import io.breachers.multiplayer.handler.GameWebSocketHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistration;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WebSocketConfigTest {

    @Test
    @DisplayName("WebSocketConfig separates exact origins and wildcard patterns correctly")
    void testOriginSeparation() {
        WebSocketConfig config = new WebSocketConfig(null, "http://localhost:5173, https://breachers.vercel.app, https://*.vercel.app");

        List<String> exact = config.getExactOrigins();
        List<String> patterns = config.getPatternOrigins();

        assertEquals(2, exact.size());
        assertTrue(exact.contains("http://localhost:5173"));
        assertTrue(exact.contains("https://breachers.vercel.app"));

        assertEquals(1, patterns.size());
        assertTrue(patterns.contains("https://*.vercel.app"));

        assertFalse(config.isHasGlobalWildcard());
    }

    @Test
    @DisplayName("WebSocketConfig registers exact origins and wildcard patterns on registry")
    void testWebSocketConfigWithExactAndPattern() {
        WebSocketHandlerRegistry mockRegistry = Mockito.mock(WebSocketHandlerRegistry.class);
        WebSocketHandlerRegistration mockRegistration = Mockito.mock(WebSocketHandlerRegistration.class);

        when(mockRegistry.addHandler(any(), eq("/ws/game"))).thenReturn(mockRegistration);
        when(mockRegistration.setAllowedOrigins(any(String[].class))).thenReturn(mockRegistration);
        when(mockRegistration.setAllowedOriginPatterns(any(String[].class))).thenReturn(mockRegistration);

        WebSocketConfig config = new WebSocketConfig(null, "http://localhost:5173, https://*.vercel.app");
        config.registerWebSocketHandlers(mockRegistry);

        verify(mockRegistry).addHandler(null, "/ws/game");
        verify(mockRegistration).setAllowedOrigins("http://localhost:5173");
        verify(mockRegistration).setAllowedOriginPatterns("https://*.vercel.app");
    }

    @Test
    @DisplayName("WebSocketConfig configures global wildcard '*' safely")
    void testWebSocketConfigWithGlobalWildcard() {
        WebSocketHandlerRegistry mockRegistry = Mockito.mock(WebSocketHandlerRegistry.class);
        WebSocketHandlerRegistration mockRegistration = Mockito.mock(WebSocketHandlerRegistration.class);

        when(mockRegistry.addHandler(any(), eq("/ws/game"))).thenReturn(mockRegistration);
        when(mockRegistration.setAllowedOrigins(any(String[].class))).thenReturn(mockRegistration);

        WebSocketConfig config = new WebSocketConfig(null, "*");
        config.registerWebSocketHandlers(mockRegistry);

        verify(mockRegistration).setAllowedOrigins("*");
        verify(mockRegistration, never()).setAllowedOriginPatterns(any());
        assertTrue(config.isHasGlobalWildcard());
    }

    @Test
    @DisplayName("WebSocketConfig handles whitespace and trailing slashes correctly")
    void testTrimmingAndTrailingSlashes() {
        WebSocketConfig config = new WebSocketConfig(null, "  http://localhost:5173/ ,   https://*.vercel.app/  ");

        assertEquals(1, config.getExactOrigins().size());
        assertEquals("http://localhost:5173", config.getExactOrigins().get(0));

        assertEquals(1, config.getPatternOrigins().size());
        assertEquals("https://*.vercel.app", config.getPatternOrigins().get(0));
    }
}
