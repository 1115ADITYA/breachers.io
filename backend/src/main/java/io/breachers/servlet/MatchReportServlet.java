package io.breachers.servlet;

import io.breachers.persistence.MatchPersistenceService;
import io.breachers.persistence.MatchSummary;
import io.breachers.persistence.PlayerStats;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * MatchReportServlet
 * Dedicated Java Servlet demonstration for academic evaluation in Breachers.io.
 * Mapped explicitly to `/academic/match-report` using Spring Boot's ServletRegistrationBean.
 * Handles HTTP GET requests to generate server-authoritative combat performance reports,
 * raw JSON data, downloadable markdown documentation, and Telegram-ready technical summaries.
 */
public class MatchReportServlet extends HttpServlet {

    private static final Logger log = LoggerFactory.getLogger(MatchReportServlet.class);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final MatchPersistenceService persistenceService;

    public MatchReportServlet(MatchPersistenceService persistenceService) {
        this.persistenceService = persistenceService;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String format = req.getParameter("format");
        boolean isDownload = "true".equalsIgnoreCase(req.getParameter("download")) || "download".equalsIgnoreCase(format);

        try {
            if ("json".equalsIgnoreCase(format)) {
                renderJson(resp);
            } else if ("md".equalsIgnoreCase(format) || "markdown".equalsIgnoreCase(format)) {
                renderMarkdown(resp, isDownload);
            } else if ("telegram".equalsIgnoreCase(format) || "tg".equalsIgnoreCase(format)) {
                renderTelegram(resp);
            } else {
                renderHtml(resp, isDownload);
            }
        } catch (Exception e) {
            log.error("Error generating match report in MatchReportServlet: {}", e.getMessage(), e);
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.setContentType("text/plain;charset=UTF-8");
            resp.getWriter().println("500 Internal Server Error: Failed to generate academic match report.");
        }
    }

    private void renderJson(HttpServletResponse resp) throws IOException {
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("application/json;charset=UTF-8");

        Map<String, Object> globalStats = persistenceService != null
                ? persistenceService.getGlobalStats()
                : Map.of();
        List<MatchSummary> matches = persistenceService != null
                ? persistenceService.getRecentMatches(20)
                : List.of();
        List<PlayerStats> topPlayers = persistenceService != null
                ? persistenceService.getTopPlayers(10)
                : List.of();

        PrintWriter out = resp.getWriter();
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"status\": \"OK\",\n");
        sb.append("  \"servlet\": \"io.breachers.servlet.MatchReportServlet\",\n");
        sb.append("  \"databaseEngine\": \"Spring JDBC / H2\",\n");
        sb.append("  \"techStack\": [\n");
        sb.append("    \"AWT (Abstract Window Toolkit - Radar Rasterizer)\",\n");
        sb.append("    \"Swing (Desktop Server Operations Console)\",\n");
        sb.append("    \"JDBC Database (Connection, PreparedStatement, ResultSet)\",\n");
        sb.append("    \"Servlet Web Application (Jakarta HttpServlet)\",\n");
        sb.append("    \"JSP (JavaServer Pages & JSTL Architecture)\"\n");
        sb.append("  ],\n");
        sb.append("  \"global\": {\n");
        sb.append("    \"totalMatches\": ").append(globalStats.getOrDefault("totalMatches", 0)).append(",\n");
        sb.append("    \"registeredOperators\": ").append(globalStats.getOrDefault("registeredOperators", 0)).append(",\n");
        sb.append("    \"totalCombatKills\": ").append(globalStats.getOrDefault("totalCombatKills", 0)).append("\n");
        sb.append("  },\n");
        sb.append("  \"recentMatchesCount\": ").append(matches.size()).append(",\n");
        sb.append("  \"topPlayersCount\": ").append(topPlayers.size()).append("\n");
        sb.append("}");
        out.print(sb.toString());
    }

    private void renderTelegram(HttpServletResponse resp) throws IOException {
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("text/plain;charset=UTF-8");

        Map<String, Object> globalStats = persistenceService != null ? persistenceService.getGlobalStats() : Map.of();
        PrintWriter out = resp.getWriter();
        out.println("🛡 BREACHERS.IO — TECHNICAL ARCHITECTURE BRIEFING");
        out.println("=================================================");
        out.println("Status: ONLINE | Generated: " + LocalDateTime.now().format(TIME_FMT));
        out.println("");
        out.println("📊 PERSISTENCE METRICS (JDBC):");
        out.println("• Matches Played: " + globalStats.getOrDefault("totalMatches", 0));
        out.println("• Operators Enrolled: " + globalStats.getOrDefault("registeredOperators", 0));
        out.println("• Combat Kills: " + globalStats.getOrDefault("totalCombatKills", 0));
        out.println("");
        out.println("🏛 REQUIRED TECH STACK IMPLEMENTATION:");
        out.println("1. AWT (Abstract Window Toolkit):");
        out.println("   - Class: io.breachers.academic.awt.TacticalRadarRasterizer");
        out.println("   - Usage: Procedural 2D tactical radar and minimap rasterization using java.awt.Graphics2D, BufferedImage, and ImageIO.");
        out.println("");
        out.println("2. Swing (Desktop GUI):");
        out.println("   - Class: io.breachers.academic.swing.BreachersServerAdminConsole");
        out.println("   - Usage: Standalone server telemetry GUI with JFrame, JTable, and DefaultTableModel.");
        out.println("");
        out.println("3. JDBC Database:");
        out.println("   - Class: io.breachers.persistence.MatchPersistenceService");
        out.println("   - Usage: ACID persistence over H2/PostgreSQL with PreparedStatement, ResultSet, and connection pooling.");
        out.println("");
        out.println("4. Servlet Web Application:");
        out.println("   - Class: io.breachers.servlet.MatchReportServlet");
        out.println("   - Usage: Jakarta HttpServlet mapped to /academic/match-report handling multi-format dispatching.");
        out.println("");
        out.println("5. JSP (JavaServer Pages):");
        out.println("   - Template: /WEB-INF/jsp/academic-report.jsp");
        out.println("   - Usage: MVC Model-2 dynamic view rendering with JSTL expression language.");
    }

    private void renderMarkdown(HttpServletResponse resp, boolean asDownload) throws IOException {
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("text/markdown;charset=UTF-8");
        if (asDownload) {
            resp.setHeader("Content-Disposition", "attachment; filename=\"breachers-tech-stack-report.md\"");
        }

        Map<String, Object> globalStats = persistenceService != null ? persistenceService.getGlobalStats() : Map.of();
        List<MatchSummary> matches = persistenceService != null ? persistenceService.getRecentMatches(10) : List.of();

        PrintWriter out = resp.getWriter();
        out.println("# Breachers.io — Comprehensive Technical Architecture & Syllabus Report");
        out.println("");
        out.println("**Generated:** " + LocalDateTime.now().format(TIME_FMT) + "  ");
        out.println("**Backend:** Java 21 • Spring Boot 3.4.3 • Embedded Tomcat  ");
        out.println("**Frontend:** Three.js • Vite • Vanilla ES6+  ");
        out.println("");
        out.println("---");
        out.println("");
        out.println("## 1. Executive Summary & Live Persistence Telemetry");
        out.println("- **Total Matches Persisted (JDBC):** " + globalStats.getOrDefault("totalMatches", 0));
        out.println("- **Registered Operators:** " + globalStats.getOrDefault("registeredOperators", 0));
        out.println("- **Total Combat Kills:** " + globalStats.getOrDefault("totalCombatKills", 0));
        out.println("- **Storage Engine:** H2 In-Memory / PostgreSQL via JDBC");
        out.println("");
        out.println("---");
        out.println("");
        out.println("## 2. Five Core Technologies — In-Depth Analysis");
        out.println("");
        out.println("### A. AWT (Abstract Window Toolkit)");
        out.println("- **Package:** `io.breachers.academic.awt.TacticalRadarRasterizer`");
        out.println("- **Where Used:** Server-side procedural radar generation for multiplayer tactical maps.");
        out.println("- **Key Classes:** `java.awt.Graphics2D`, `java.awt.image.BufferedImage`, `java.awt.Color`, `java.awt.Font`, `java.awt.BasicStroke`, `javax.imageio.ImageIO`.");
        out.println("- **Operation:** Draws vector grids, container outlines, coordinate crosshairs, and spawn zones into a 512x512 BufferedImage, then streams it as a PNG via the `/academic/radar` servlet.");
        out.println("");
        out.println("### B. Swing (Java Desktop GUI)");
        out.println("- **Package:** `io.breachers.academic.swing.BreachersServerAdminConsole`");
        out.println("- **Where Used:** Dedicated desktop server administrator console.");
        out.println("- **Key Classes:** `javax.swing.JFrame`, `javax.swing.JPanel`, `javax.swing.JTable`, `javax.swing.table.DefaultTableModel`, `javax.swing.JButton`, `javax.swing.JLabel`, `javax.swing.JScrollPane`.");
        out.println("- **Operation:** Visualizes active multiplayer rooms, JVM heap memory telemetry, and match controls in a native Swing desktop window.");
        out.println("");
        out.println("### C. JDBC Database");
        out.println("- **Package:** `io.breachers.persistence.MatchPersistenceService` & `DatabaseConfig`");
        out.println("- **Where Used:** Relational persistence of completed match summaries and operator career combat records.");
        out.println("- **Key Classes:** `java.sql.Connection`, `java.sql.PreparedStatement`, `java.sql.ResultSet`, `org.springframework.jdbc.core.JdbcTemplate`.");
        out.println("- **Operation:** Executes schema verification (`schema.sql`) and ACID transactions on tables `match_history` and `player_statistics`.");
        out.println("");
        out.println("### D. Servlet Web Application");
        out.println("- **Package:** `io.breachers.servlet.MatchReportServlet`");
        out.println("- **Where Used:** HTTP request-response pipeline for academic auditing and data exports.");
        out.println("- **Key Classes:** `jakarta.servlet.http.HttpServlet`, `HttpServletRequest`, `HttpServletResponse`, `ServletRegistrationBean`.");
        out.println("- **Operation:** Registered in Tomcat at `/academic/match-report`, dispatches format requests (HTML, JSON, Markdown, Telegram).");
        out.println("");
        out.println("### E. JSP (JavaServer Pages)");
        out.println("- **Package:** `backend/src/main/webapp/WEB-INF/jsp/academic-report.jsp`");
        out.println("- **Where Used:** Server-side MVC Model-2 dynamic view presentation.");
        out.println("- **Key Classes:** `AcademicJspReportServlet`, Jakarta Standard Tag Library (JSTL), Expression Language (EL).");
        out.println("- **Operation:** Controller populates request attributes (`req.setAttribute()`), forwarding to JSP template for clean presentation.");
        out.println("");
        out.println("---");
        out.println("");
        out.println("## 3. Recent Match Records (SQL Table: `match_history`)");
        out.println("| ID | Room | Mode | Map | Winner | Score (Red:Blue) | Players |");
        out.println("|---|---|---|---|---|---|---|");
        for (MatchSummary m : matches) {
            out.printf("| #%d | %s | %s | %s | %s | %d : %d | %d |%n",
                    m.id(), m.roomCode(), m.gameMode(), m.mapId(), m.winner(), m.redScore(), m.blueScore(), m.playerCount());
        }
    }

    private void renderHtml(HttpServletResponse resp, boolean asDownload) throws IOException {
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("text/html;charset=UTF-8");
        if (asDownload) {
            resp.setHeader("Content-Disposition", "attachment; filename=\"breachers-academic-report.html\"");
        }

        Map<String, Object> globalStats = persistenceService != null ? persistenceService.getGlobalStats() : Map.of();
        List<MatchSummary> matches = persistenceService != null ? persistenceService.getRecentMatches(25) : List.of();
        List<PlayerStats> topPlayers = persistenceService != null ? persistenceService.getTopPlayers(10) : List.of();

        PrintWriter out = resp.getWriter();
        out.println("<!DOCTYPE html>");
        out.println("<html lang=\"en\">");
        out.println("<head>");
        out.println("  <meta charset=\"UTF-8\">");
        out.println("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        out.println("  <title>Breachers.io — Academic Tech Stack & Persistence Report</title>");
        out.println("  <style>");
        out.println("    :root {");
        out.println("      --bg: #090d14;");
        out.println("      --card: #111827;");
        out.println("      --border: #1e293b;");
        out.println("      --orange: #f97316;");
        out.println("      --text: #f3f4f6;");
        out.println("      --muted: #94a3b8;");
        out.println("      --red: #ef4444;");
        out.println("      --blue: #3b82f6;");
        out.println("      --green: #22c55e;");
        out.println("    }");
        out.println("    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }");
        out.println("    body { background-color: var(--bg); color: var(--text); padding: 32px 20px; line-height: 1.5; }");
        out.println("    .container { max-width: 1100px; margin: 0 auto; }");
        out.println("    header { border-bottom: 2px solid var(--border); padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }");
        out.println("    .badge { display: inline-block; background: rgba(249, 115, 22, 0.15); color: var(--orange); border: 1px solid var(--orange); border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }");
        out.println("    h1 { font-size: 26px; font-weight: 800; color: #fff; letter-spacing: 0.5px; }");
        out.println("    .tagline { color: var(--muted); font-size: 14px; margin-top: 4px; }");
        out.println("    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px; }");
        out.println("    .btn { background: #1e293b; color: #fff; text-decoration: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }");
        out.println("    .btn:hover { background: #334155; }");
        out.println("    .btn.orange { background: var(--orange); border-color: var(--orange); }");
        out.println("    .btn.orange:hover { background: #ea580c; }");
        out.println("    .btn.telegram { background: #0284c7; border-color: #0284c7; }");
        out.println("    .btn.telegram:hover { background: #0369a1; }");
        out.println("    .tech-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 32px; }");
        out.println("    .tech-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }");
        out.println("    .tech-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }");
        out.println("    .tech-desc { font-size: 13px; color: var(--muted); line-height: 1.6; }");
        out.println("    code { background: rgba(255,255,255,0.06); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: monospace; }");
        out.println("    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }");
        out.println("    .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 18px; }");
        out.println("    .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.75px; }");
        out.println("    .stat-val { font-size: 26px; font-weight: 800; color: var(--orange); margin-top: 4px; }");
        out.println("    section { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 22px; margin-bottom: 28px; }");
        out.println("    h2 { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #fff; display: flex; align-items: center; justify-content: space-between; }");
        out.println("    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }");
        out.println("    th { background: #0e1420; color: var(--muted); font-weight: 600; padding: 10px 12px; border-bottom: 1px solid var(--border); text-transform: uppercase; font-size: 11px; }");
        out.println("    td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }");
        out.println("    tr:hover td { background: rgba(255,255,255,0.02); }");
        out.println("    .tag-red { color: var(--red); font-weight: 700; }");
        out.println("    .tag-blue { color: var(--blue); font-weight: 700; }");
        out.println("    .tag-tie { color: var(--muted); font-weight: 700; }");
        out.println("    .pill { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }");
        out.println("    .pill-tdm { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #3b82f6; }");
        out.println("    .pill-ffa { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }");
        out.println("    footer { margin-top: 40px; border-top: 1px solid var(--border); padding-top: 16px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; align-items: center; }");
        out.println("  </style>");
        out.println("</head>");
        out.println("<body>");
        out.println("  <div class=\"container\">");
        out.println("    <header>");
        out.println("      <div>");
        out.println("        <div class=\"badge\">ACADEMIC SERVLET &amp; JDBC INTEGRATION &bull; TECHNICAL SPECIFICATION</div>");
        out.println("        <h1>BREACHERS.IO — COMBAT PERSISTENCE REPORT</h1>");
        out.println("        <p class=\"tagline\">Lock In. Team Up. Breach Out. | Servlet: <code>io.breachers.servlet.MatchReportServlet</code></p>");
        out.println("      </div>");
        out.println("    </header>");

        // Download & Action Toolbar
        out.println("    <div class=\"toolbar\">");
        out.println("      <a class=\"btn orange\" href=\"/academic/match-report?format=md&download=true\">📥 Download Markdown (.md)</a>");
        out.println("      <a class=\"btn\" href=\"/academic/match-report?download=true\">📄 Download HTML (.html)</a>");
        out.println("      <a class=\"btn telegram\" href=\"https://t.me/share/url?url=http://localhost:8081/academic/match-report&text=" + escape("Breachers.io Academic Technical Report — AWT, Swing, JDBC, Servlet, and JSP implementation overview.") + "\" target=\"_blank\">✈️ Share on Telegram</a>");
        out.println("      <a class=\"btn\" href=\"/academic/radar?map=yard\" target=\"_blank\">🗺 Live AWT Radar PNG</a>");
        out.println("      <a class=\"btn\" href=\"/academic/match-report?format=json\" target=\"_blank\">{ } Raw JSON API</a>");
        out.println("    </div>");

        // The 5 Core Technologies In Depth
        out.println("    <div class=\"tech-grid\">");
        out.println("      <div class=\"tech-card\">");
        out.println("        <div class=\"tech-title\"><span>1. AWT (Abstract Window Toolkit)</span> <span style=\"color: var(--orange); font-size: 12px;\">ACTIVE</span></div>");
        out.println("        <p class=\"tech-desc\">Server-side rasterization engine in <code>io.breachers.academic.awt.TacticalRadarRasterizer</code> using <code>Graphics2D</code>, <code>BufferedImage</code>, and <code>ImageIO</code> to render 2D overhead tactical radar maps.</p>");
        out.println("      </div>");
        out.println("      <div class=\"tech-card\">");
        out.println("        <div class=\"tech-title\"><span>2. Swing Desktop GUI</span> <span style=\"color: var(--orange); font-size: 12px;\">ACTIVE</span></div>");
        out.println("        <p class=\"tech-desc\">Desktop server telemetry console in <code>io.breachers.academic.swing.BreachersServerAdminConsole</code> with <code>JFrame</code>, <code>JTable</code>, <code>DefaultTableModel</code>, and memory diagnostics.</p>");
        out.println("      </div>");
        out.println("      <div class=\"tech-card\">");
        out.println("        <div class=\"tech-title\"><span>3. JDBC Database Persistence</span> <span style=\"color: var(--orange); font-size: 12px;\">ACTIVE</span></div>");
        out.println("        <p class=\"tech-desc\">Server-authoritative match persistence via <code>MatchPersistenceService</code> with raw JDBC (<code>Connection</code>, <code>PreparedStatement</code>, <code>ResultSet</code>) and Spring <code>JdbcTemplate</code>.</p>");
        out.println("      </div>");
        out.println("      <div class=\"tech-card\">");
        out.println("        <div class=\"tech-title\"><span>4. Servlet Web Application</span> <span style=\"color: var(--orange); font-size: 12px;\">ACTIVE</span></div>");
        out.println("        <p class=\"tech-desc\">Native Jakarta <code>HttpServlet</code> mapped at <code>/academic/match-report</code> delivering multi-format report exports and file attachments.</p>");
        out.println("      </div>");
        out.println("      <div class=\"tech-card\">");
        out.println("        <div class=\"tech-title\"><span>5. JSP (JavaServer Pages)</span> <span style=\"color: var(--orange); font-size: 12px;\">ACTIVE</span></div>");
        out.println("        <p class=\"tech-desc\">Server-side MVC Model-2 dynamic view rendering with JSTL expression language in <code>/WEB-INF/jsp/academic-report.jsp</code>.</p>");
        out.println("      </div>");
        out.println("    </div>");

        // Top Statistics Grid
        out.println("    <div class=\"grid\">");
        out.println("      <div class=\"stat-card\">");
        out.println("        <div class=\"stat-label\">Completed Matches</div>");
        out.println("        <div class=\"stat-val\">" + globalStats.getOrDefault("totalMatches", 0) + "</div>");
        out.println("      </div>");
        out.println("      <div class=\"stat-card\">");
        out.println("        <div class=\"stat-label\">Registered Operators</div>");
        out.println("        <div class=\"stat-val\">" + globalStats.getOrDefault("registeredOperators", 0) + "</div>");
        out.println("      </div>");
        out.println("      <div class=\"stat-card\">");
        out.println("        <div class=\"stat-label\">Total Combat Kills</div>");
        out.println("        <div class=\"stat-val\">" + globalStats.getOrDefault("totalCombatKills", 0) + "</div>");
        out.println("      </div>");
        out.println("      <div class=\"stat-card\">");
        out.println("        <div class=\"stat-label\">Storage Engine</div>");
        out.println("        <div class=\"stat-val\" style=\"font-size: 18px; margin-top: 8px;\">H2 / JDBC</div>");
        out.println("      </div>");
        out.println("    </div>");

        // Match History Table
        out.println("    <section>");
        out.println("      <h2><span>Recent Match History (SQL Table: <code>match_history</code>)</span> <span style=\"font-size: 12px; font-weight: normal; color: var(--muted);\">Limit: 25</span></h2>");
        if (matches.isEmpty()) {
            out.println("      <div style=\"padding: 24px; text-align: center; color: var(--muted);\">No matches recorded yet.</div>");
        } else {
            out.println("      <table>");
            out.println("        <thead>");
            out.println("          <tr>");
            out.println("            <th>ID</th><th>Room</th><th>Mode</th><th>Map</th><th>Winner</th><th>Score</th><th>Players</th><th>Duration</th><th>Completed At</th>");
            out.println("          </tr>");
            out.println("        </thead>");
            out.println("        <tbody>");
            for (MatchSummary m : matches) {
                String winClass = "tag-tie";
                if ("RED".equalsIgnoreCase(m.winner())) winClass = "tag-red";
                else if ("BLUE".equalsIgnoreCase(m.winner())) winClass = "tag-blue";
                String modePill = "FFA".equalsIgnoreCase(m.gameMode()) ? "pill-ffa" : "pill-tdm";
                String formattedDate = m.completedAt() != null ? m.completedAt().format(TIME_FMT) : "N/A";

                out.println("          <tr>");
                out.println("            <td>#" + m.id() + "</td>");
                out.println("            <td><strong>" + escape(m.roomCode()) + "</strong></td>");
                out.println("            <td><span class=\"pill " + modePill + "\">" + escape(m.gameMode()) + "</span></td>");
                out.println("            <td>" + escape(m.mapId()) + "</td>");
                out.println("            <td class=\"" + winClass + "\">" + escape(m.winner()) + "</td>");
                out.println("            <td>" + m.redScore() + " : " + m.blueScore() + "</td>");
                out.println("            <td>" + m.playerCount() + "</td>");
                out.println("            <td>" + m.durationSeconds() + "s</td>");
                out.println("            <td>" + formattedDate + "</td>");
                out.println("          </tr>");
            }
            out.println("        </tbody>");
            out.println("      </table>");
        }
        out.println("    </section>");

        // Top Operators
        out.println("    <section>");
        out.println("      <h2><span>Top Operator Standings (SQL Table: <code>player_statistics</code>)</span> <span style=\"font-size: 12px; font-weight: normal; color: var(--muted);\">Top 10 Career</span></h2>");
        if (topPlayers.isEmpty()) {
            out.println("      <div style=\"padding: 24px; text-align: center; color: var(--muted);\">No operators recorded yet.</div>");
        } else {
            out.println("      <table>");
            out.println("        <thead>");
            out.println("          <tr>");
            out.println("            <th>Operator Callsign</th><th>Matches</th><th>Wins</th><th>Losses</th><th>Win %</th><th>Kills</th><th>Deaths</th><th>K/D</th><th>Score</th>");
            out.println("          </tr>");
            out.println("        </thead>");
            out.println("        <tbody>");
            for (PlayerStats p : topPlayers) {
                out.println("          <tr>");
                out.println("            <td><strong>" + escape(p.username()) + "</strong></td>");
                out.println("            <td>" + p.matchesPlayed() + "</td>");
                out.println("            <td style=\"color: var(--green);\">" + p.wins() + "</td>");
                out.println("            <td style=\"color: var(--red);\">" + p.losses() + "</td>");
                out.println("            <td>" + p.getWinRatePercent() + "%</td>");
                out.println("            <td>" + p.kills() + "</td>");
                out.println("            <td>" + p.deaths() + "</td>");
                out.println("            <td>" + p.getKillDeathRatio() + "</td>");
                out.println("            <td style=\"color: var(--orange); font-weight: 700;\">" + p.score() + "</td>");
                out.println("          </tr>");
            }
            out.println("        </tbody>");
            out.println("      </table>");
        }
        out.println("    </section>");

        out.println("    <footer>");
        out.println("      <div>Breachers.io &bull; Spring Boot 3.4.3 &bull; Embedded Tomcat &bull; Spring JDBC &bull; H2 Database</div>");
        out.println("      <div>Endpoints: <a href=\"/academic/match-report?format=json\" style=\"color:var(--orange);\">JSON</a> | <a href=\"/academic/match-report?format=md\" style=\"color:var(--orange);\">Markdown</a> | <a href=\"/academic/match-report?format=telegram\" style=\"color:var(--orange);\">Telegram Text</a></div>");
        out.println("    </footer>");
        out.println("  </div>");
        out.println("</body>");
        out.println("</html>");
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#x27;");
    }
}
