package io.breachers.persistence;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("DatabaseConfig Cloud URL Parsing & Normalization Tests")
class DatabaseConfigTest {

    @Test
    @DisplayName("Should preserve standard H2 in-memory URL for development")
    void testH2UrlParsing() {
        String h2 = "jdbc:h2:mem:breachersdb;DB_CLOSE_DELAY=-1";
        DatabaseConfig.ParsedDbConfig parsed = DatabaseConfig.parseUrl(h2, "sa", "");

        assertEquals(h2, parsed.jdbcUrl());
        assertEquals("sa", parsed.username());
        assertEquals("", parsed.password());
        assertEquals("org.h2.Driver", parsed.driverClassName());
    }

    @Test
    @DisplayName("Should normalize Render / Railway style postgres:// URL into standard JDBC")
    void testRenderPostgresUrlNormalization() {
        String renderUrl = "postgres://operator_admin:secret_pass_123@dpg-c123456789-a.oregon-postgres.render.com:5432/breachers_db";
        DatabaseConfig.ParsedDbConfig parsed = DatabaseConfig.parseUrl(renderUrl, "fallback", "fallback");

        assertEquals("jdbc:postgresql://dpg-c123456789-a.oregon-postgres.render.com:5432/breachers_db", parsed.jdbcUrl());
        assertEquals("operator_admin", parsed.username());
        assertEquals("secret_pass_123", parsed.password());
        assertEquals("org.postgresql.Driver", parsed.driverClassName());
    }

    @Test
    @DisplayName("Should normalize postgresql:// URL with query parameters like sslmode=require")
    void testPostgresqlUrlWithQuery() {
        String neonUrl = "postgresql://neon_user:neon_pass@ep-cool-flower-123.us-east-2.aws.neon.tech/neondb?sslmode=require";
        DatabaseConfig.ParsedDbConfig parsed = DatabaseConfig.parseUrl(neonUrl, "fallback", "fallback");

        assertEquals("jdbc:postgresql://ep-cool-flower-123.us-east-2.aws.neon.tech:5432/neondb?sslmode=require", parsed.jdbcUrl());
        assertEquals("neon_user", parsed.username());
        assertEquals("neon_pass", parsed.password());
        assertEquals("org.postgresql.Driver", parsed.driverClassName());
    }

    @Test
    @DisplayName("Should preserve standard jdbc:postgresql:// URL unchanged")
    void testStandardJdbcPostgresqlUrl() {
        String standardJdbc = "jdbc:postgresql://localhost:5432/breachersdb";
        DatabaseConfig.ParsedDbConfig parsed = DatabaseConfig.parseUrl(standardJdbc, "postgres", "postgres");

        assertEquals(standardJdbc, parsed.jdbcUrl());
        assertEquals("postgres", parsed.username());
        assertEquals("postgres", parsed.password());
        assertEquals("org.postgresql.Driver", parsed.driverClassName());
    }
}
