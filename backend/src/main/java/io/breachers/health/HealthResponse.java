package io.breachers.health;

import java.time.Instant;

public record HealthResponse(
        String status,
        String service,
        Instant timestamp,
        String version
) {}
