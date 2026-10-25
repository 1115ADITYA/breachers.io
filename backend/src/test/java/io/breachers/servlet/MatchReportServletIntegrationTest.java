package io.breachers.servlet;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MatchReportServletIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    @DisplayName("GET /academic/match-report should return 200 OK with HTML content")
    void testGetMatchReportHtml() {
        String url = "http://localhost:" + port + "/academic/match-report";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getHeaders().getContentType());
        assertTrue(response.getHeaders().getContentType().toString().contains("text/html"));

        String body = response.getBody();
        assertNotNull(body);
        assertTrue(body.contains("BREACHERS.IO — COMBAT PERSISTENCE REPORT"), "HTML must contain header");
        assertTrue(body.contains("ACADEMIC SERVLET &amp; JDBC INTEGRATION"), "HTML must contain academic badge");
        assertTrue(body.contains("MatchReportServlet"), "HTML must mention servlet class");
    }

    @Test
    @DisplayName("GET /academic/match-report?format=json should return 200 OK with JSON structure")
    void testGetMatchReportJson() {
        String url = "http://localhost:" + port + "/academic/match-report?format=json";
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getHeaders().getContentType());
        assertTrue(response.getHeaders().getContentType().toString().contains("application/json"));

        String body = response.getBody();
        assertNotNull(body);
        assertTrue(body.contains("\"status\": \"OK\""));
        assertTrue(body.contains("\"servlet\": \"io.breachers.servlet.MatchReportServlet\""));
        assertTrue(body.contains("\"databaseEngine\": \"Spring JDBC / H2\""));
    }
}
