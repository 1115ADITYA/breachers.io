package io.breachers.academic.awt;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * TacticalRadarRasterizer
 * Demonstrates Java AWT (Abstract Window Toolkit) graphics rendering in Breachers.io.
 * Generates server-side 2D tactical radar and minimap schematics using java.awt.Graphics2D,
 * BufferedImage, Color, Font, and BasicStroke, exportable as PNG image streams.
 */
public class TacticalRadarRasterizer {

    public static byte[] generateRadarPng(String mapId) throws IOException {
        int width = 512;
        int height = 512;

        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();

        // Enable high-quality anti-aliasing
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        // 1. Dark tactical radar background
        g.setColor(new Color(11, 15, 23));
        g.fillRect(0, 0, width, height);

        // 2. Faint tactical grid lines (AWT BasicStroke & Color)
        g.setColor(new Color(30, 41, 59));
        g.setStroke(new BasicStroke(1.0f));
        int gridSize = 32;
        for (int x = 0; x <= width; x += gridSize) {
            g.drawLine(x, 0, x, height);
        }
        for (int y = 0; y <= height; y += gridSize) {
            g.drawLine(0, y, width, y);
        }

        // 3. Concentric range rings
        g.setColor(new Color(14, 165, 233, 40));
        g.setStroke(new BasicStroke(1.5f));
        int centerX = width / 2;
        int centerY = height / 2;
        g.drawOval(centerX - 80, centerY - 80, 160, 160);
        g.drawOval(centerX - 160, centerY - 160, 320, 320);
        g.drawOval(centerX - 220, centerY - 220, 440, 440);

        // 4. Center tactical crosshairs
        g.setColor(new Color(249, 115, 22, 120));
        g.drawLine(centerX - 240, centerY, centerX + 240, centerY);
        g.drawLine(centerX, centerY - 240, centerX, centerY + 240);

        // 5. Procedural Map Layout (Container Yard vs Warehouse)
        if ("warehouse".equalsIgnoreCase(mapId)) {
            renderWarehouseLayout(g, centerX, centerY);
        } else {
            renderContainerYardLayout(g, centerX, centerY);
        }

        // 6. Tactical Map Header & Legend (AWT Font rendering)
        g.setFont(new Font("Monospaced", Font.BOLD, 14));
        g.setColor(new Color(249, 115, 22));
        g.drawString("BREACHERS.IO // AWT TACTICAL RADAR", 20, 30);

        g.setFont(new Font("SansSerif", Font.PLAIN, 10));
        g.setColor(new Color(148, 163, 184));
        g.drawString("SECTOR: " + (mapId != null ? mapId.toUpperCase() : "CONTAINER YARD") + " | ENGINE: JAVA.AWT.GRAPHICS2D", 20, 46);

        // Compass / Orientation indicator
        g.setColor(new Color(239, 68, 68));
        g.fillPolygon(new int[]{width - 35, width - 40, width - 30}, new int[]{25, 45, 45}, 3);
        g.setColor(Color.WHITE);
        g.setFont(new Font("Monospaced", Font.BOLD, 10));
        g.drawString("N", width - 38, 20);

        g.dispose();

        // Convert to PNG byte array
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, "PNG", baos);
        return baos.toByteArray();
    }

    private static void renderContainerYardLayout(Graphics2D g, int cx, int cy) {
        // Red Spawn Sector (North)
        g.setColor(new Color(239, 68, 68, 50));
        g.fillRect(cx - 70, cy - 190, 140, 50);
        g.setColor(new Color(239, 68, 68));
        g.drawRect(cx - 70, cy - 190, 140, 50);
        g.setFont(new Font("SansSerif", Font.BOLD, 9));
        g.drawString("ALPHA SPAWN (RED)", cx - 55, cy - 160);

        // Blue Spawn Sector (South)
        g.setColor(new Color(59, 130, 246, 50));
        g.fillRect(cx - 70, cy + 140, 140, 50);
        g.setColor(new Color(59, 130, 246));
        g.drawRect(cx - 70, cy + 140, 140, 50);
        g.drawString("OMEGA SPAWN (BLUE)", cx - 55, cy + 170);

        // Shipping Containers (AWT Rectangles & Labels)
        drawContainer(g, cx - 120, cy - 90, 60, 24, new Color(185, 28, 28), "RED-01");
        drawContainer(g, cx + 60, cy - 90, 60, 24, new Color(30, 64, 175), "BLU-01");
        drawContainer(g, cx - 140, cy + 10, 70, 24, new Color(180, 83, 9), "YEL-01");
        drawContainer(g, cx + 70, cy + 10, 70, 24, new Color(4, 120, 87), "GRN-01");

        // Central Engagement Zone & Gantry Crane Tower
        g.setColor(new Color(249, 115, 22, 40));
        g.fillRect(cx - 40, cy - 40, 80, 80);
        g.setColor(new Color(249, 115, 22));
        g.setStroke(new BasicStroke(2.0f));
        g.drawRect(cx - 40, cy - 40, 80, 80);
        g.setFont(new Font("SansSerif", Font.BOLD, 10));
        g.drawString("GANTRY HUB", cx - 35, cy + 5);

        // Hazard Explosive Barrels (Yellow/Orange circles)
        g.setColor(new Color(234, 179, 8));
        g.fillOval(cx - 90, cy - 30, 10, 10);
        g.fillOval(cx + 80, cy + 50, 10, 10);
        g.fillOval(cx + 40, cy - 80, 10, 10);
    }

    private static void renderWarehouseLayout(Graphics2D g, int cx, int cy) {
        // Warehouse Outer Walls
        g.setColor(new Color(71, 85, 105));
        g.setStroke(new BasicStroke(3.0f));
        g.drawRect(cx - 180, cy - 180, 360, 360);

        // High Storage Shelving Bays
        g.setColor(new Color(51, 65, 85));
        for (int i = -120; i <= 120; i += 60) {
            g.fillRect(cx - 140, cy + i - 10, 100, 20);
            g.fillRect(cx + 40, cy + i - 10, 100, 20);
        }

        // Forklift Alleys & Loading Dock
        g.setColor(new Color(14, 165, 233));
        g.setFont(new Font("SansSerif", Font.BOLD, 10));
        g.drawString("CENTRAL FORKLIFT ALLEY", cx - 70, cy + 4);
    }

    private static void drawContainer(Graphics2D g, int x, int y, int w, int h, Color color, String tag) {
        g.setColor(color);
        g.fillRect(x, y, w, h);
        g.setColor(Color.WHITE);
        g.setStroke(new BasicStroke(1.0f));
        g.drawRect(x, y, w, h);
        g.setFont(new Font("Monospaced", Font.PLAIN, 8));
        g.drawString(tag, x + 4, y + h - 6);
    }
}

