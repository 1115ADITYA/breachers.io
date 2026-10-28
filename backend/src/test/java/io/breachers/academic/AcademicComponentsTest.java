package io.breachers.academic;

import io.breachers.academic.awt.TacticalRadarRasterizer;
import io.breachers.academic.swing.BreachersServerAdminConsole;
import io.breachers.persistence.MatchPersistenceService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class AcademicComponentsTest {

    @Autowired
    private MatchPersistenceService persistenceService;

    @Test
    @DisplayName("AWT Radar Rasterizer generates valid PNG image with standard magic header")
    void testAwtRadarRasterizer() throws IOException {
        byte[] yardPng = TacticalRadarRasterizer.generateRadarPng("container_yard");
        assertNotNull(yardPng, "AWT generated PNG bytes must not be null");
        assertTrue(yardPng.length > 500, "AWT generated PNG must contain image payload");

        // Verify standard PNG magic header: 0x89 'P' 'N' 'G'
        assertEquals((byte) 0x89, yardPng[0]);
        assertEquals((byte) 'P', yardPng[1]);
        assertEquals((byte) 'N', yardPng[2]);
        assertEquals((byte) 'G', yardPng[3]);

        byte[] warehousePng = TacticalRadarRasterizer.generateRadarPng("warehouse");
        assertNotNull(warehousePng);
        assertTrue(warehousePng.length > 500);
    }

    @Test
    @DisplayName("Swing Admin Console initializes safely and manages table model")
    void testSwingAdminConsole() {
        BreachersServerAdminConsole console = new BreachersServerAdminConsole();
        assertNotNull(console.getTableModel());
        assertEquals(6, console.getTableModel().getColumnCount());
        assertTrue(console.getRowCount() >= 3, "Console should contain initial seeded room telemetry");

        console.addRoomRow("ROOM99", "TDM", "Warehouse", "8 / 10", "15 : 12", "COMPLETED");
        assertEquals(4, console.getRowCount());

        // Test refresh handler without throwing
        assertDoesNotThrow(() -> console.handleRefresh(null));
    }

    @Test
    @DisplayName("JDBC Database executes pure raw Connection, PreparedStatement, and ResultSet queries")
    void testRawJdbcExecution() throws SQLException {
        assertNotNull(persistenceService);
        List<Map<String, Object>> rows = persistenceService.executeRawJdbcQuery(
                "SELECT COUNT(*) AS total_count FROM match_history"
        );
        assertNotNull(rows);
        assertFalse(rows.isEmpty());
        assertTrue(rows.get(0).containsKey("TOTAL_COUNT") || rows.get(0).containsKey("total_count"));
    }
}

