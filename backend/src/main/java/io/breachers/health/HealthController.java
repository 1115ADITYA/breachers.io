package io.breachers.health;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final String appVersion;

    public HealthController(@Value("${app.version:0.1.0}") String appVersion) {
        this.appVersion = appVersion;
    }

    @GetMapping("/health")
    public ResponseEntity<HealthResponse> getHealth() {
        HealthResponse response = new HealthResponse(
                "UP",
                "breachers-backend",
                Instant.now(),
                appVersion
        );
        return ResponseEntity.ok(response);
    }
}
