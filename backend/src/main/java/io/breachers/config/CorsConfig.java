package io.breachers.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.List;

/**
 * CorsConfig
 * Configures production-safe Cross-Origin Resource Sharing (CORS) for Breachers.io.
 * Supports configurable origins via CORS_ALLOWED_ORIGINS or app.cors.allowed-origins,
 * trimming whitespace, and supporting wildcards (e.g. https://*.vercel.app) via allowedOriginPatterns.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final List<String> allowedOrigins;

    public CorsConfig(@Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String originsConfig) {
        this.allowedOrigins = Arrays.stream(originsConfig.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.endsWith("/") ? s.substring(0, s.length() - 1) : s)
                .toList();
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOrigins.toArray(new String[0]))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }
}
