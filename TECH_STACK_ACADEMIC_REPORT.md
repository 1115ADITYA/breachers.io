# Breachers.io — Complete Technical Architecture & Syllabus Specification

**Project:** Breachers.io — Browser 3D Multiplayer Tactical FPS  
**Target Architecture:** Java 21 • Spring Boot 3.4.3 • Jakarta EE • Embedded Tomcat • Three.js WebGL • WebSocket  
**Documentation Version:** 1.0.0  
**Verification Date:** October 2026  

---

## Executive Summary

Breachers.io is a modern browser-based tactical first-person shooter featuring a decoupled, microservice-inspired architecture. Real-time gameplay runs over low-latency binary/JSON WebSockets synchronized with high-precision client prediction and client-side Rapier 3D physics. 

In addition to cutting-edge real-time 3D multiplayer mechanics, the system implements and integrates the fundamental Java enterprise and desktop technologies mandated by academic and industry syllabi:

1. **AWT (Abstract Window Toolkit)** — Procedural server-side 2D radar rasterization & image generation.
2. **Swing** — Desktop administrator telemetry, active room monitor, and operations console.
3. **JDBC Database** — ACID-compliant relational data persistence with pure raw JDBC and Spring JDBC Template.
4. **Servlet Web Application** — Native Jakarta `HttpServlet` handling multi-format content negotiation and file downloads.
5. **JSP (JavaServer Pages)** — Classic MVC Model-2 dynamic view presentation with RequestDispatcher and Expression Language.

---

## 1. AWT (Abstract Window Toolkit) Implementation

### Where It Is Used
- **Source File:** [`backend/src/main/java/io/breachers/academic/awt/TacticalRadarRasterizer.java`](file:///c:/Users/Aditya/breachers.io/backend/src/main/java/io/breachers/academic/awt/TacticalRadarRasterizer.java)
- **Servlet Bridge:** [`backend/src/main/java/io/breachers/academic/awt/TacticalRadarServlet.java`](file:///c:/Users/Aditya/breachers.io/backend/src/main/java/io/breachers/academic/awt/TacticalRadarServlet.java)
- **Live HTTP Endpoint:** `http://localhost:8081/academic/radar?map=yard` (or `?map=warehouse`)
- **Unit Test:** [`backend/src/test/java/io/breachers/academic/AcademicComponentsTest.java`](file:///c:/Users/Aditya/breachers.io/backend/src/test/java/io/breachers/academic/AcademicComponentsTest.java)

### Technical Details & Code Operation
Java AWT provides low-level 2D graphics rasterization directly on the server without requiring an external graphics rendering card. In Breachers.io, AWT is utilized to dynamically generate 512×512 overhead tactical radar maps:
- `java.awt.image.BufferedImage`: Allocated as `BufferedImage.TYPE_INT_ARGB` to serve as the server-side offscreen canvas.
- `java.awt.Graphics2D`: Initialized with `RenderingHints.KEY_ANTIALIASING` for sub-pixel vector rendering.
- `java.awt.BasicStroke`: Configured for military grid lines, distance range circles, and boundary walls.
- `java.awt.Color`: Uses alpha blending (e.g. `new Color(239, 68, 68, 50)`) to denote Red and Blue tactical team spawn zones.
- `java.awt.Font`: Renders coordinate markers, north compass rose, and shipping container telemetry IDs (`RED-01`, `BLU-01`, `GANTRY HUB`).
- `javax.imageio.ImageIO`: Encodes the raw rasterized pixel buffer into standard PNG byte streams delivered over HTTP with `Content-Type: image/png`.

---

## 2. Swing (Java Desktop GUI) Implementation

### Where It Is Used
- **Source File:** [`backend/src/main/java/io/breachers/academic/swing/BreachersServerAdminConsole.java`](file:///c:/Users/Aditya/breachers.io/backend/src/main/java/io/breachers/academic/swing/BreachersServerAdminConsole.java)
- **Desktop Launcher:** Standalone executable `public static void main(String[] args)`
- **Unit Test:** [`backend/src/test/java/io/breachers/academic/AcademicComponentsTest.java`](file:///c:/Users/Aditya/breachers.io/backend/src/test/java/io/breachers/academic/AcademicComponentsTest.java)

### Technical Details & Code Operation
Java Swing is utilized for dedicated, on-premises desktop administration of the Breachers game server:
- `javax.swing.JFrame`: Primary desktop application window with tactical dark-slate styling and responsive layouts.
- `javax.swing.JTable` & `javax.swing.table.DefaultTableModel`: Presents live telemetry of all active multiplayer rooms (Room Code, Game Mode, Active Map, Connected Operators, Team Scores, Match State).
- `javax.swing.JPanel`: Organizes metrics into modular visual zones using `BorderLayout`, `GridLayout`, and `FlowLayout`.
- `javax.swing.JButton`: Dispatches administration events (`REFRESH TELEMETRY`, `REQUEST JVM GC`, `DISMISS`).
- `javax.swing.JLabel`: Surfaces live JVM Heap and Non-Heap memory allocation (`Runtime.getRuntime()`) and database counters.
- **Headless Safety:** Detects `GraphicsEnvironment.isHeadless()` so that automated continuous integration (CI) and automated tests run cleanly without throwing `HeadlessException`.

---

## 3. JDBC Database Persistence Implementation

### Where It Is Used
- **Service Layer:** [`backend/src/main/java/io/breachers/persistence/MatchPersistenceService.java`](file:///c:/Users/Aditya/breachers.io/backend/src/main/java/io/breachers/persistence/MatchPersistenceService.java)
- **Database Configuration:** [`backend/src/main/java/io/breachers/persistence/DatabaseConfig.java`](file:///c:/Users/Aditya/breachers.io/backend/src/main/java/io/breachers/persistence/DatabaseConfig.java)
- **Schema DDL:** [`backend/src/main/resources/schema.sql`](file:///c:/Users/Aditya/breachers.io/backend/src/main/resources/schema.sql)
- **Engines Supported:** H2 In-Memory (development/evaluation) & PostgreSQL (production)

### Technical Details & Code Operation
Breachers.io implements relational database persistence to ensure that combat records, match summaries, and operator statistics survive server restarts:
- **Raw JDBC Demonstration:** Exposes `executeRawJdbcQuery(String sql, Object... params)` which directly borrows a `java.sql.Connection` from HikariCP, constructs a parameterized `java.sql.PreparedStatement` to prevent SQL injection, executes the statement, and extracts columns via `java.sql.ResultSet` and `java.sql.ResultSetMetaData`.
- **Spring JdbcTemplate:** Powers high-throughput asynchronous persistence via a dedicated single-thread worker executor (`breachers-jdbc-worker`).
- **Relational Tables:**
  - `match_history`: Stores `id`, `room_code`, `game_mode`, `map_id`, `winner`, `red_score`, `blue_score`, `player_count`, `duration_seconds`, and `completed_at`.
  - `player_statistics`: Stores career operator stats including `username`, `matches_played`, `wins`, `losses`, `kills`, `deaths`, `score`, and `last_played_at`.

---

## 4. Servlet Web Application Implementation

### Where It Is Used
- **Servlet Class:** [`backend/src/main/java/io/breachers/servlet/MatchReportServlet.java`](file:///c:/Users/Aditya/breachers.io/backend/src/main/java/io/breachers/servlet/MatchReportServlet.java)
- **Container Registration:** [`backend/src/main/java/io/breachers/config/AcademicServletConfig.java`](file:///c:/Users/Aditya/breachers.io/backend/src/main/java/io/breachers/config/AcademicServletConfig.java)
- **Live Endpoint:** `http://localhost:8081/academic/match-report`
- **Integration Test:** [`backend/src/test/java/io/breachers/servlet/MatchReportServletIntegrationTest.java`](file:///c:/Users/Aditya/breachers.io/backend/src/test/java/io/breachers/servlet/MatchReportServletIntegrationTest.java)

### Technical Details & Code Operation
The web reporting pipeline demonstrates the Jakarta Servlet specification:
- Extends `jakarta.servlet.http.HttpServlet` and overrides `doGet(HttpServletRequest req, HttpServletResponse resp)`.
- Explicitly registered via Spring Boot's `ServletRegistrationBean` at url-pattern `/academic/match-report`.
- **Content Negotiation:**
  - Default: Renders a styled, responsive dark-mode HTML report.
  - `?format=json`: Emits raw machine-readable JSON data.
  - `?format=md`: Emits Markdown documentation.
  - `?format=telegram`: Emits plain text optimized for Telegram messaging.
  - `?download=true`: Adds HTTP response header `Content-Disposition: attachment; filename="..."` to force browser download.

---

## 5. JSP (JavaServer Pages) Implementation

### Where It Is Used
- **JSP Template:** [`backend/src/main/webapp/WEB-INF/jsp/academic-report.jsp`](file:///c:/Users/Aditya/breachers.io/backend/src/main/webapp/WEB-INF/jsp/academic-report.jsp)
- **MVC Forwarder:** [`backend/src/main/java/io/breachers/academic/jsp/AcademicJspReportServlet.java`](file:///c:/Users/Aditya/breachers.io/backend/src/main/java/io/breachers/academic/jsp/AcademicJspReportServlet.java)
- **Live Endpoint:** `http://localhost:8081/academic/jsp-report`

### Technical Details & Code Operation
JSP is implemented following the classic Model-View-Controller (Model-2) architecture:
- **Controller:** `AcademicJspReportServlet` extracts data from `MatchPersistenceService`, populates the `HttpServletRequest` attribute map (`req.setAttribute("totalMatches", ...)`), and calls `req.getRequestDispatcher("/WEB-INF/jsp/academic-report.jsp").forward(req, resp)`.
- **View:** `academic-report.jsp` defines the view using standard directives (`<%@ page contentType="text/html;charset=UTF-8" language="java" %>`) and Expression Language (`${param}`, `${globalStats}`).
- Demonstrates server-side separation of concerns between business logic (Java servlets) and presentation (JSP).

---

## 6. How to Download & Export to Telegram

For users working in remote environments (SSH, Remote Desktops, Web IDEs), the report can be downloaded or shared instantly:

1. **In-Game UI Toolbar:**
   - Click the **REPORT 📊** tab in the main menu top bar.
   - Click **DOWNLOAD REPORT (.MD)** or **DOWNLOAD REPORT (.HTML)** for instant browser download.
   - Click **SEND TO TELEGRAM** to open Telegram's native web sharing intent (`https://t.me/share/url?url=...&text=...`).
   - Click **COPY TELEGRAM BRIEFING** to copy the formatted text directly to your clipboard.

2. **Via Command Line / Remote Terminal:**
   ```bash
   # Download Markdown Report
   curl -o report.md "http://localhost:8081/academic/match-report?format=md&download=true"

   # Download HTML Report
   curl -o report.html "http://localhost:8081/academic/match-report?download=true"

   # Fetch Plaintext Telegram Briefing
   curl "http://localhost:8081/academic/match-report?format=telegram"
   ```

3. **Telegram Bot Webhook / API Send (Optional):**
   ```bash
   curl -s -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
     -d chat_id="<YOUR_CHAT_ID>" \
     -d text="$(curl -s http://localhost:8081/academic/match-report?format=telegram)"
   ```

