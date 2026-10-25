package io.breachers.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CorsConfigTest {

    @SuppressWarnings("unchecked")
    private CorsConfiguration extractCorsConfiguration(CorsRegistry registry) throws Exception {
        Field field = CorsRegistry.class.getDeclaredField("registrations");
        field.setAccessible(true);
        List<CorsRegistration> registrations = (List<CorsRegistration>) field.get(registry);
        assertNotNull(registrations, "Registrations list should not be null");
        assertFalse(registrations.isEmpty(), "Registrations list should not be empty");

        Field configField = CorsRegistration.class.getDeclaredField("config");
        configField.setAccessible(true);
        return (CorsConfiguration) configField.get(registrations.get(0));
    }

    @Test
    @DisplayName("Exact URLs are mapped to allowedOrigins with credentials enabled")
    void testExactOriginsWithCredentials() throws Exception {
        CorsConfig config = new CorsConfig("http://localhost:5173, http://127.0.0.1:5173, https://breachers.vercel.app");
        CorsRegistry registry = new CorsRegistry();
        config.addCorsMappings(registry);

        CorsConfiguration corsConfig = extractCorsConfiguration(registry);

        // Exact origins should be in allowedOrigins
        assertNotNull(corsConfig.getAllowedOrigins());
        assertTrue(corsConfig.getAllowedOrigins().contains("http://localhost:5173"));
        assertTrue(corsConfig.getAllowedOrigins().contains("http://127.0.0.1:5173"));
        assertTrue(corsConfig.getAllowedOrigins().contains("https://breachers.vercel.app"));
        assertFalse(corsConfig.getAllowedOrigins().contains("*"));

        // Credentials should be true
        assertTrue(Boolean.TRUE.equals(corsConfig.getAllowCredentials()));

        // Spring validation should pass without IllegalArgumentException
        assertDoesNotThrow(corsConfig::validateAllowCredentials);
    }

    @Test
    @DisplayName("Wildcard subdomains are mapped to allowedOriginPatterns with credentials enabled")
    void testWildcardSubdomainsWithCredentials() throws Exception {
        CorsConfig config = new CorsConfig("https://*.vercel.app, https://*.onrender.com");
        CorsRegistry registry = new CorsRegistry();
        config.addCorsMappings(registry);

        CorsConfiguration corsConfig = extractCorsConfiguration(registry);

        // allowedOrigins should NOT contain "*" or wildcard patterns
        assertTrue(corsConfig.getAllowedOrigins() == null || corsConfig.getAllowedOrigins().isEmpty());

        // Wildcard patterns should be in allowedOriginPatterns
        assertNotNull(corsConfig.getAllowedOriginPatterns());
        assertTrue(corsConfig.getAllowedOriginPatterns().contains("https://*.vercel.app"));
        assertTrue(corsConfig.getAllowedOriginPatterns().contains("https://*.onrender.com"));

        // Credentials should be true
        assertTrue(Boolean.TRUE.equals(corsConfig.getAllowCredentials()));

        // Spring validation should pass
        assertDoesNotThrow(corsConfig::validateAllowCredentials);
    }

    @Test
    @DisplayName("Mixed exact URLs and wildcard subdomains are safely separated")
    void testMixedExactAndWildcardSubdomains() throws Exception {
        CorsConfig config = new CorsConfig("http://localhost:5173, https://*.vercel.app");
        CorsRegistry registry = new CorsRegistry();
        config.addCorsMappings(registry);

        CorsConfiguration corsConfig = extractCorsConfiguration(registry);

        assertNotNull(corsConfig.getAllowedOrigins());
        assertTrue(corsConfig.getAllowedOrigins().contains("http://localhost:5173"));
        assertFalse(corsConfig.getAllowedOrigins().contains("*"));

        assertNotNull(corsConfig.getAllowedOriginPatterns());
        assertTrue(corsConfig.getAllowedOriginPatterns().contains("https://*.vercel.app"));

        assertTrue(Boolean.TRUE.equals(corsConfig.getAllowCredentials()));
        assertDoesNotThrow(corsConfig::validateAllowCredentials);
    }

    @Test
    @DisplayName("Global wildcard '*' disables credentials and does not use '*' with credentials")
    void testGlobalWildcardDisablesCredentials() throws Exception {
        CorsConfig config = new CorsConfig("*");
        CorsRegistry registry = new CorsRegistry();
        config.addCorsMappings(registry);

        CorsConfiguration corsConfig = extractCorsConfiguration(registry);

        // When '*' is used, allowCredentials must NOT be true
        assertFalse(Boolean.TRUE.equals(corsConfig.getAllowCredentials()));

        // Spring validation should pass because credentials are false
        assertDoesNotThrow(corsConfig::validateAllowCredentials);
    }

    @Test
    @DisplayName("Comma-separated values with whitespace and trailing slashes are trimmed correctly")
    void testWhitespaceAndTrailingSlashesTrimming() {
        CorsConfig config = new CorsConfig("  http://localhost:5173/ ,   https://breachers.vercel.app/ , https://*.vercel.app/  ");

        assertEquals(3, config.getRawOrigins().size());
        assertEquals("http://localhost:5173", config.getExactOrigins().get(0));
        assertEquals("https://breachers.vercel.app", config.getExactOrigins().get(1));
        assertEquals("https://*.vercel.app", config.getPatternOrigins().get(0));
        assertFalse(config.isHasGlobalWildcard());
        assertTrue(config.isAllowCredentials());
    }

    @Test
    @DisplayName("Null or blank origins fallback to localhost:5173 defaults")
    void testFallbackDefaults() {
        CorsConfig config = new CorsConfig("");
        assertTrue(config.getExactOrigins().contains("http://localhost:5173"));
        assertTrue(config.getExactOrigins().contains("http://127.0.0.1:5173"));
        assertTrue(config.isAllowCredentials());
    }
}
