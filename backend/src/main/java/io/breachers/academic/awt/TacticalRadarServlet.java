package io.breachers.academic.awt;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

/**
 * TacticalRadarServlet
 * Serves live AWT-generated 2D tactical radar schematics directly over HTTP.
 * Mapped to `/academic/radar`. Demonstrates Java AWT BufferedImage and Graphics2D
 * integration inside a Jakarta Servlet web pipeline.
 */
public class TacticalRadarServlet extends HttpServlet {

    private static final Logger log = LoggerFactory.getLogger(TacticalRadarServlet.class);

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String mapId = req.getParameter("map");
        if (mapId == null || mapId.isBlank()) {
            mapId = "container_yard";
        }

        try {
            byte[] pngBytes = TacticalRadarRasterizer.generateRadarPng(mapId);
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.setContentType("image/png");
            resp.setContentLength(pngBytes.length);
            resp.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            resp.getOutputStream().write(pngBytes);
            resp.getOutputStream().flush();
        } catch (Exception e) {
            log.error("Failed to generate AWT radar image: {}", e.getMessage(), e);
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.setContentType("text/plain");
            resp.getWriter().println("500 Internal Server Error: AWT rasterization failed.");
        }
    }
}

