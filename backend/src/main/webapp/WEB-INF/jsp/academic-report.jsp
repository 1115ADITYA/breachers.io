<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Breachers.io — Academic JSP Dynamic View</title>
    <style>
        body { background: #090d14; color: #f3f4f6; font-family: -apple-system, sans-serif; padding: 30px; }
        .card { background: #111827; border: 1px solid #1e293b; border-radius: 8px; padding: 24px; max-width: 900px; margin: 0 auto; }
        h1 { color: #f97316; font-size: 22px; margin-bottom: 8px; }
        .pill { display: inline-block; background: rgba(249,115,22,0.15); color: #f97316; border: 1px solid #f97316; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
        th, td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: left; }
        th { background: #0e1420; color: #94a3b8; }
        .tech-box { background: rgba(255,255,255,0.03); border: 1px solid #1e293b; border-radius: 6px; padding: 14px; margin-top: 16px; font-size: 13px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="card">
        <div class="pill">JAVA SERVER PAGES (JSP) &bull; MODEL-2 ARCHITECTURE</div>
        <h1>BREACHERS.IO — JSP REPORT TEMPLATE</h1>
        <p style="color: #94a3b8; font-size: 13px;">This page demonstrates server-side dynamic template rendering using JavaServer Pages (JSP), JSTL Expression Language, and MVC request forwarding.</p>

        <div class="tech-box">
            <strong>JSP Context Attributes:</strong><br>
            • Technology: JavaServer Pages (.jsp)<br>
            • Dispatcher: <code>io.breachers.academic.jsp.AcademicJspReportServlet</code><br>
            • Total Matches: <strong><%= request.getAttribute("totalMatches") != null ? request.getAttribute("totalMatches") : "42" %></strong><br>
            • Registered Operators: <strong><%= request.getAttribute("registeredOperators") != null ? request.getAttribute("registeredOperators") : "18" %></strong><br>
            • Total Kills: <strong><%= request.getAttribute("totalCombatKills") != null ? request.getAttribute("totalCombatKills") : "315" %></strong>
        </div>

        <p style="margin-top: 20px; font-size: 12px; color: #64748b;">
            Rendered natively by Apache Tomcat Jasper Servlet Engine &bull; Spring Boot 3.4.3
        </p>
    </div>
</body>
</html>

