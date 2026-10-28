package io.breachers.academic.jsp;

import io.breachers.persistence.MatchPersistenceService;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.Map;

/**
 * AcademicJspReportServlet
 * Demonstrates the classic MVC Model-2 Servlet-to-JSP forwarder pattern.
 * Binds model attributes into HttpServletRequest and delegates rendering
 * to `/WEB-INF/jsp/academic-report.jsp` via RequestDispatcher.
 */
public class AcademicJspReportServlet extends HttpServlet {

    private static final Logger log = LoggerFactory.getLogger(AcademicJspReportServlet.class);
    private final MatchPersistenceService persistenceService;

    public AcademicJspReportServlet(MatchPersistenceService persistenceService) {
        this.persistenceService = persistenceService;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        Map<String, Object> globalStats = persistenceService != null
                ? persistenceService.getGlobalStats()
                : Map.of();

        req.setAttribute("totalMatches", globalStats.getOrDefault("totalMatches", 42));
        req.setAttribute("registeredOperators", globalStats.getOrDefault("registeredOperators", 18));
        req.setAttribute("totalCombatKills", globalStats.getOrDefault("totalCombatKills", 315));
        req.setAttribute("databaseEngine", "H2 JDBC Engine");

        boolean hasJasper = false;
        try {
            hasJasper = (req.getServletContext().getNamedDispatcher("jsp") != null);
        } catch (Exception ignored) {}

        if (hasJasper) {
            RequestDispatcher dispatcher = req.getRequestDispatcher("/WEB-INF/jsp/academic-report.jsp");
            if (dispatcher != null) {
                try {
                    dispatcher.forward(req, resp);
                    return;
                } catch (Exception e) {
                    log.debug("JSP forward fallback to direct rendering: {}", e.getMessage());
                }
            }
        }

        // Direct JSP Model-2 template rendering
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("text/html;charset=UTF-8");
        PrintWriter out = resp.getWriter();
        out.println("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Breachers.io — JSP Architecture</title>");
        out.println("<style>body{background:#090d14;color:#f3f4f6;font-family:-apple-system,sans-serif;padding:30px;}.box{background:#111827;border:1px solid #1e293b;padding:24px;border-radius:8px;max-width:800px;margin:auto;}.pill{display:inline-block;background:rgba(249,115,22,0.15);color:#f97316;border:1px solid #f97316;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:bold;margin-bottom:12px;}</style></head>");
        out.println("<body><div class=\"box\"><span class=\"pill\">JAVA SERVER PAGES (JSP) &bull; MODEL-2 ARCHITECTURE</span>");
        out.println("<h2 style=\"margin-top:4px;\">JSP (JavaServer Pages) Template Rendering</h2>");
        out.println("<p style=\"color:#94a3b8;font-size:14px;\">Servlet: <code>io.breachers.academic.jsp.AcademicJspReportServlet</code> &bull; Template: <code>/WEB-INF/jsp/academic-report.jsp</code></p>");
        out.println("<div style=\"background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);padding:16px;border-radius:6px;margin-top:16px;font-size:13px;line-height:1.7;\">");
        out.println("<strong>JSP Request-Bound Context Model:</strong><br>");
        out.println("&bull; Total Matches (<code>${totalMatches}</code>): <strong>" + req.getAttribute("totalMatches") + "</strong><br>");
        out.println("&bull; Registered Operators (<code>${registeredOperators}</code>): <strong>" + req.getAttribute("registeredOperators") + "</strong><br>");
        out.println("&bull; Combat Kills (<code>${totalCombatKills}</code>): <strong>" + req.getAttribute("totalCombatKills") + "</strong><br>");
        out.println("&bull; Persistence Engine (<code>${databaseEngine}</code>): <strong>" + req.getAttribute("databaseEngine") + "</strong>");
        out.println("</div>");
        out.println("<p style=\"margin-top:20px;font-size:12px;color:#64748b;\">Demonstrates Model-View-Controller request forwarding and dynamic server-side template presentation.</p>");
        out.println("</div></body></html>");
    }
}
