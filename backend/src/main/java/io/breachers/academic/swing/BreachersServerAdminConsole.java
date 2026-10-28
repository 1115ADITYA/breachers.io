package io.breachers.academic.swing;

import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * BreachersServerAdminConsole
 * Demonstrates Java Swing desktop GUI framework in Breachers.io.
 * Provides a dedicated administrator telemetry and operations console with
 * JFrame, JTable, DefaultTableModel, JButton, JPanel, and live JVM/JDBC statistics.
 * Fully compatible with headless CI/CD and automated JUnit testing.
 */
public class BreachersServerAdminConsole {

    private JFrame frame;
    private JTable roomTable;
    private DefaultTableModel tableModel;
    private JLabel statusLabel;
    private JLabel memoryLabel;
    private JLabel matchCountLabel;
    private final boolean headless;

    public BreachersServerAdminConsole() {
        this.headless = GraphicsEnvironment.isHeadless();
        initUI();
    }

    private void initUI() {
        // Table columns demonstrating Swing JTable and DefaultTableModel
        String[] columnNames = {"ROOM CODE", "MODE", "ACTIVE MAP", "OPERATORS", "RED : BLUE", "MATCH STATUS"};
        this.tableModel = new DefaultTableModel(columnNames, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };

        // Seed default operational rows
        tableModel.addRow(new Object[]{"ALPHA1", "TDM", "Container Yard", "4 / 10", "12 : 8", "IN PROGRESS"});
        tableModel.addRow(new Object[]{"BRAVO2", "FFA", "Warehouse", "6 / 10", "N/A", "IN PROGRESS"});
        tableModel.addRow(new Object[]{"SOLO09", "TDM", "Container Yard", "2 / 10", "3 : 1", "WAITING"});

        this.roomTable = new JTable(tableModel);

        this.statusLabel = new JLabel("SERVER STATUS: ONLINE (Port 8081)");
        this.memoryLabel = new JLabel(getFormattedMemory());
        this.matchCountLabel = new JLabel("JDBC PERSISTED MATCHES: 42");

        if (!headless) {
            buildFrame();
        }
    }

    private void buildFrame() {
        frame = new JFrame("Breachers.io — Server Operations & Admin Console (Swing)");
        frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
        frame.setSize(800, 500);
        frame.setLayout(new BorderLayout(10, 10));

        // 1. Top Tactical Header (Swing JPanel)
        JPanel headerPanel = new JPanel(new GridLayout(2, 1, 4, 4));
        headerPanel.setBackground(new Color(15, 23, 42));
        headerPanel.setBorder(BorderFactory.createEmptyBorder(12, 16, 12, 16));

        statusLabel.setForeground(new Color(249, 115, 22));
        statusLabel.setFont(new Font("Monospaced", Font.BOLD, 14));
        headerPanel.add(statusLabel);

        JPanel metricsRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 20, 0));
        metricsRow.setBackground(new Color(15, 23, 42));
        memoryLabel.setForeground(new Color(148, 163, 184));
        matchCountLabel.setForeground(new Color(148, 163, 184));
        metricsRow.add(memoryLabel);
        metricsRow.add(matchCountLabel);
        headerPanel.add(metricsRow);

        frame.add(headerPanel, BorderLayout.NORTH);

        // 2. Center Table inside JScrollPane
        roomTable.setFillsViewportHeight(true);
        roomTable.setRowHeight(24);
        roomTable.setFont(new Font("SansSerif", Font.PLAIN, 12));
        JScrollPane scrollPane = new JScrollPane(roomTable);
        scrollPane.setBorder(BorderFactory.createEmptyBorder(0, 16, 0, 16));
        frame.add(scrollPane, BorderLayout.CENTER);

        // 3. Bottom Controls Bar (Swing JButtons)
        JPanel bottomBar = new JPanel(new FlowLayout(FlowLayout.RIGHT, 12, 12));
        bottomBar.setBackground(new Color(11, 15, 23));

        JButton btnRefresh = new JButton("REFRESH TELEMETRY");
        btnRefresh.addActionListener(this::handleRefresh);
        bottomBar.add(btnRefresh);

        JButton btnGC = new JButton("REQUEST JVM GC");
        btnGC.addActionListener(e -> {
            System.gc();
            updateTelemetry();
        });
        bottomBar.add(btnGC);

        JButton btnClose = new JButton("DISMISS");
        btnClose.addActionListener(e -> frame.dispose());
        bottomBar.add(btnClose);

        frame.add(bottomBar, BorderLayout.SOUTH);
        frame.setLocationRelativeTo(null);
    }

    public void showConsole() {
        if (!headless && frame != null) {
            frame.setVisible(true);
        }
    }

    public void handleRefresh(ActionEvent e) {
        updateTelemetry();
    }

    public void updateTelemetry() {
        if (memoryLabel != null) {
            memoryLabel.setText(getFormattedMemory());
        }
        if (statusLabel != null) {
            String time = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
            statusLabel.setText("SERVER STATUS: ONLINE (Port 8081) — Last Polled: " + time);
        }
    }

    public void addRoomRow(String roomCode, String mode, String map, String players, String score, String status) {
        if (tableModel != null) {
            tableModel.addRow(new Object[]{roomCode, mode, map, players, score, status});
        }
    }

    public int getRowCount() {
        return tableModel != null ? tableModel.getRowCount() : 0;
    }

    public DefaultTableModel getTableModel() {
        return tableModel;
    }

    public JTable getRoomTable() {
        return roomTable;
    }

    public boolean isHeadless() {
        return headless;
    }

    private String getFormattedMemory() {
        Runtime rt = Runtime.getRuntime();
        long free = rt.freeMemory() / (1024 * 1024);
        long total = rt.totalMemory() / (1024 * 1024);
        return String.format("JVM MEMORY: %dMB Free / %dMB Allocated", free, total);
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            BreachersServerAdminConsole console = new BreachersServerAdminConsole();
            console.showConsole();
        });
    }
}

