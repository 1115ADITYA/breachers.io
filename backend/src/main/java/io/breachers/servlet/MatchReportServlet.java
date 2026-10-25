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
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * MatchReportServlet
 * Dedicated Java Servlet demonstration for academic evaluation.
 * Mapped explicitly to `/academic/match-report` using Spring Boot's ServletRegistrationBean.
 * Handles HTTP GET requests to generate server-authoritative combat performance reports
 * backed by JDBC persistence and H2 database storage.
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

        try {
            if ("json".equalsIgnoreCase(format)) {
                renderJson(resp);
            } else {
                renderHtml(resp);
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

    private void renderHtml(HttpServletResponse resp) throws IOException {
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("text/html;charset=UTF-8");

        Map<String, Object> globalStats = persistenceService != null
                ? persistenceService.getGlobalStats()
                : Map.of();
        List<MatchSummary> matches = persistenceService != null
                ? persistenceService.getRecentMatches(25)
                : List.of();
        List<PlayerStats> topPlayers = persistenceService != null
                ? persistenceService.getTopPlayers(10)
                : List.of();

        PrintWriter out = resp.getWriter();

        out.println("<!DOCTYPE html>");
        out.println("<html lang=\"en\">");
        out.println("<head>");
        out.println("  <meta charset=\"UTF-8\">");
        out.println("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        out.println("  <title>Breachers.io — Academic Match & Persistence Report</title>");
        out.println("  <style>");
        out.println("    :root {");
        out.println("      --bg: #0b0f17;");
        out.println("      --card: #111827;");
        out.println("      --border: #1f2937;");
        out.println("      --orange: #f97316;");
        out.println("      --text: #f3f4f6;");
        out.println("      --muted: #9ca3af;");
        out.println("      --red: #ef4444;");
        out.println("      --blue: #3b82f6;");
        out.println("      --green: #22c55e;");
        out.println("    }");
        out.println("    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }");
        out.println("    body { background-color: var(--bg); color: var(--text); padding: 32px 24px; line-height: 1.5; }");
        out.println("    .container { max-width: 1100px; margin: 0 auto; }");
        out.println("    header { border-bottom: 2px solid var(--border); padding-bottom: 20px; margin-bottom: 28px; }");
        out.println("    .badge { display: inline-block; background: rgba(249, 115, 22, 0.15); color: var(--orange); border: 1px solid var(--orange); border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }");
        out.println("    h1 { font-size: 26px; font-weight: 800; letter-spacing: 0.5px; color: #fff; }");
        out.println("    .tagline { color: var(--muted); font-size: 14px; margin-top: 4px; }");
        out.println("    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px; }");
        out.println("    .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 18px; }");
        out.println("    .stat-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.75px; }");
        out.println("    .stat-val { font-size: 28px; font-weight: 800; color: var(--orange); margin-top: 4px; }");
        out.println("    section { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 22px; margin-bottom: 28px; }");
        out.println("    h2 { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #fff; display: flex; align-items: center; justify-content: space-between; }");
        out.println("    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }");
        out.println("    th { background: #0e131d; color: var(--muted); font-weight: 600; padding: 10px 12px; border-bottom: 1px solid var(--border); text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }");
        out.println("    td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }");
        out.println("    tr:hover td { background: rgba(255,255,255,0.02); }");
        out.println("    .tag-red { color: var(--red); font-weight: 700; }");
        out.println("    .tag-blue { color: var(--blue); font-weight: 700; }");
        out.println("    .tag-tie { color: var(--muted); font-weight: 700; }");
        out.println("    .pill { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }");
        out.println("    .pill-tdm { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #3b82f6; }");
        out.println("    .pill-ffa { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }");
        out.println("    .empty-state { padding: 32px; text-align: center; color: var(--muted); font-style: italic; }");
        out.println("    footer { margin-top: 40px; border-top: 1px solid var(--border); padding-top: 16px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; align-items: center; }");
        out.println("    a { color: var(--orange); text-decoration: none; }");
        out.println("    a:hover { text-decoration: underline; }");
        out.println("  </style>");
        out.println("</head>");
        out.println("<body>");
        out.println("  <div class=\"container\">");
        out.println("    <header>");
        out.println("      <div class=\"badge\">ACADEMIC SERVLET &amp; JDBC INTEGRATION</div>");
        out.println("      <h1>BREACHERS.IO — COMBAT PERSISTENCE REPORT</h1>");
        out.println("      <p class=\"tagline\">Lock In. Team Up. Breach Out. | Servlet: <code>io.breachers.servlet.MatchReportServlet</code></p>");
        out.println("    </header>");

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
        out.println("        <div class=\"stat-val\" style=\"font-size: 20px; margin-top: 8px;\">H2 / JDBC</div>");
        out.println("      </div>");
        out.println("    </div>");

        // Recent Match History Table
        out.println("    <section>");
        out.println("      <h2><span>Recent Match History (SQL Table: <code>match_history</code>)</span> <span style=\"font-size: 12px; font-weight: normal; color: var(--muted);\">Limit: 25</span></h2>");
        if (matches.isEmpty()) {
            out.println("      <div class=\"empty-state\">No matches recorded in the database yet. Complete a match in any multiplayer room to view persisted results here.</div>");
        } else {
            out.println("      <table>");
            out.println("        <thead>");
            out.println("          <tr>");
            out.println("            <th>ID</th>");
            out.println("            <th>Room</th>");
            out.println("            <th>Mode</th>");
            out.println("            <th>Map</th>");
            out.println("            <th>Winner</th>");
            out.println("            <th>Score (Red : Blue)</th>");
            out.println("            <th>Players</th>");
            out.println("            <th>Duration</th>");
            out.println("            <th>Completed At</th>");
            out.println("          </tr>");
            out.println("        </thead>");
            out.println("        <tbody>");
            for (MatchSummary m : matches) {
                String winClass = "tag-tie";
                if ("RED".equalsIgnoreCase(m.winner())) winClass = "tag-red";
                else if ("BLUE".equalsIgnoreCase(m.winner())) winClass = "tag-blue";

                String modePill = "pill-tdm";
                if ("FFA".equalsIgnoreCase(m.gameMode())) modePill = "pill-ffa";

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

        // Top Operators Leaderboard Table
        out.println("    <section>");
        out.println("      <h2><span>Top Operator Standings (SQL Table: <code>player_statistics</code>)</span> <span style=\"font-size: 12px; font-weight: normal; color: var(--muted);\">Top 10 Career</span></h2>");
        if (topPlayers.isEmpty()) {
            out.println("      <div class=\"empty-state\">No operator statistics recorded yet.</div>");
        } else {
            out.println("      <table>");
            out.println("        <thead>");
            out.println("          <tr>");
            out.println("            <th>Operator Callsign</th>");
            out.println("            <th>Matches Played</th>");
            out.println("            <th>Wins</th>");
            out.println("            <th>Losses</th>");
            out.println("            <th>Win Rate</th>");
            out.println("            <th>Kills</th>");
            out.println("            <th>Deaths</th>");
            out.println("            <th>K/D Ratio</th>");
            out.println("            <th>Career Score</th>");
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

        // Academic Architecture & Verification Footer
        out.println("    <footer>");
        out.println("      <div>Breachers.io &bull; Spring Boot 3.4.3 &bull; Embedded Tomcat &bull; Spring JDBC Template &bull; H2 Database</div>");
        out.println("      <div>Raw JSON endpoint: <a href=\"/academic/match-report?format=json\">?format=json</a></div>");
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
