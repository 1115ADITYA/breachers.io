package io.breachers.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * CorsConfig
 * Configures production-safe Cross-Origin Resource Sharing (CORS) for Breachers.io.
 * Reads allowed origins from the CORS_ALLOWED_ORIGINS environment variable or app.cors.allowed-origins property.
 *
 * Rules:
 * 1. Exact URLs are mapped to explicit allowedOrigins.
 * 2. Wildcard subdomains (e.g. https://*.vercel.app) are mapped to allowedOriginPatterns.
 * 3. Never passes "*" to allowedOrigins when credentials are enabled.
 * 4. If a global wildcard ("*") is configured, credentials are automatically disabled.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final List<String> rawOrigins;
    private final List<String> exactOrigins = new ArrayList<>();
    private final List<String> patternOrigins = new ArrayList<>();
    private final boolean hasGlobalWildcard;
    private final boolean allowCredentials;

    @org.springframework.beans.factory.annotation.Autowired
    public CorsConfig(
            @Value("${CORS_ALLOWED_ORIGINS:${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}}") String originsConfig,
            @Value("${app.cors.allow-credentials:true}") boolean configuredAllowCredentials
    ) {
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

        // Keep credentials enabled only if "*" is not an allowed origin
        this.allowCredentials = configuredAllowCredentials && !this.hasGlobalWildcard;
    }

    // Convenience constructor for tests
    public CorsConfig(String originsConfig) {
        this(originsConfig, true);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        CorsRegistration registration = registry.addMapping("/**")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .maxAge(3600);

        if (hasGlobalWildcard) {
            // When credentials are false, "*" in allowedOrigins is safe and standard
            registration.allowedOrigins("*");
            registration.allowCredentials(false);
        } else {
            if (!exactOrigins.isEmpty()) {
                registration.allowedOrigins(exactOrigins.toArray(new String[0]));
            }
            if (!patternOrigins.isEmpty()) {
                registration.allowedOriginPatterns(patternOrigins.toArray(new String[0]));
            }
            registration.allowCredentials(allowCredentials);
        }
    }

    public List<String> getAllowedOrigins() {
        return rawOrigins;
    }

    public List<String> getRawOrigins() {
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

    public boolean isAllowCredentials() {
        return allowCredentials;
    }
}
