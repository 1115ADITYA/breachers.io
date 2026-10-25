package io.breachers.persistence;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

/**
 * DatabaseConfig
 * Configures the primary DataSource for Breachers.io.
 * Automatically normalizes cloud provider database URLs (e.g. Render / Railway / Heroku postgres://)
 * into standard JDBC format while preserving local H2 database for development and testing.
 */
@Configuration
public class DatabaseConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    @Value("${spring.datasource.url:jdbc:h2:mem:breachersdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE}")
    private String rawUrl;

    @Value("${spring.datasource.driverClassName:org.h2.Driver}")
    private String driverClassName;

    @Value("${spring.datasource.username:sa}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    public static ParsedDbConfig parseUrl(String rawUrl, String defaultUser, String defaultPass) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return new ParsedDbConfig(rawUrl, defaultUser, defaultPass, "org.h2.Driver");
        }

        if (rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://")) {
            try {
                // Convert scheme prefix to http to leverage java.net.URI parser for host/port/userInfo/path
                String tempUrl = rawUrl.startsWith("postgresql://")
                        ? "http" + rawUrl.substring("postgresql".length())
                        : "http" + rawUrl.substring("postgres".length());

                URI uri = new URI(tempUrl);
                String host = uri.getHost();
                int port = uri.getPort() != -1 ? uri.getPort() : 5432;
                String path = uri.getPath();
                String query = uri.getQuery() != null ? "?" + uri.getQuery() : "";

                String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + path + query;
                String user = defaultUser;
                String pass = defaultPass;

                if (uri.getUserInfo() != null) {
                    String[] userInfo = uri.getUserInfo().split(":", 2);
                    user = userInfo[0];
                    if (userInfo.length > 1) {
                        pass = userInfo[1];
                    }
                }
                return new ParsedDbConfig(jdbcUrl, user, pass, "org.postgresql.Driver");
            } catch (Exception e) {
                log.warn("Failed to parse cloud database URI '{}', falling back to raw: {}", rawUrl, e.getMessage());
            }
        }

        String driver = rawUrl.contains("postgresql") ? "org.postgresql.Driver" : "org.h2.Driver";
        return new ParsedDbConfig(rawUrl, defaultUser, defaultPass, driver);
    }

    @Bean
    @Primary
    public DataSource dataSource() {
        ParsedDbConfig parsed = parseUrl(rawUrl, username, password);

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(parsed.jdbcUrl());
        config.setUsername(parsed.username());
        config.setPassword(parsed.password());
        config.setDriverClassName(parsed.driverClassName());

        log.info("Initialized primary DataSource: URL={}, Driver={}, User={}",
                parsed.jdbcUrl().replaceAll(":([^:@]+)@", ":****@"),
                parsed.driverClassName(),
                parsed.username());

        return new HikariDataSource(config);
    }

    public record ParsedDbConfig(String jdbcUrl, String username, String password, String driverClassName) {}
}
