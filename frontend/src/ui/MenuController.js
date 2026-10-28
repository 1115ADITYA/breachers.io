import { MAP_REGISTRY, DEFAULT_MAP_ID, getMapConfig, getAllMaps } from '../maps/MapRegistry.js';
import { OPERATOR_REGISTRY, DEFAULT_OPERATOR_ID, getOperator, getAllOperators } from '../menu/OperatorRegistry.js';
import { WEAPONS } from '../player/Weapon.js';

/**
 * MenuController
 * Complete application navigation, screen management, and tactical menu interface
 * inspired by modern tactical shooters (PUBG / Krunker).
 * Manages Home, Operator Selection, Loadout, Map Selection, Lobby, Settings, and Loading states.
 */
export class MenuController {
  constructor(options = {}) {
    this.previewScene = options.previewScene || null;
    this.onDeployMatch = options.onDeployMatch || null;
    this.onCreateRoom = options.onCreateRoom || null;
    this.onJoinRoom = options.onJoinRoom || null;
    this.onLeaveRoom = options.onLeaveRoom || null;
    this.onSetGameMode = options.onSetGameMode || null;
    this.onSetTeam = options.onSetTeam || null;
    this.onStartMatch = options.onStartMatch || null;
    this.onReturnToLobby = options.onReturnToLobby || null;
    this.onSettingsChanged = options.onSettingsChanged || null;

    // Persisted User State
    this.username = localStorage.getItem('breachers_username') || `Operator_${Math.floor(100 + Math.random() * 900)}`;
    this.selectedOperatorId = localStorage.getItem('breachers_selected_operator') || DEFAULT_OPERATOR_ID;
    this.selectedVariantId = localStorage.getItem('breachers_selected_variant') || 'standard';
    this.selectedMapId = localStorage.getItem('breachers_selected_map') || DEFAULT_MAP_ID;

    // Settings
    this.settings = {
      masterVolume: parseFloat(localStorage.getItem('breachers_volume') || '0.8'),
      mouseSensitivity: parseFloat(localStorage.getItem('breachers_sensitivity') || '1.0'),
      graphicsQuality: localStorage.getItem('breachers_graphics') || 'high',
      showFps: localStorage.getItem('breachers_show_fps') !== 'false'
    };

    // Current Active Screen: 'HOME' | 'OPERATORS' | 'LOADOUT' | 'MAPS' | 'SETTINGS' | 'LOBBY' | 'LOADING'
    this.currentScreen = 'HOME';
    this.currentRoomState = null;
    this.localPlayerId = null;
    this.customServerUrl = (typeof window !== 'undefined' && window.localStorage)
      ? (window.localStorage.getItem('breachers_backend_ws_url') || '')
      : '';
    this.lobbyTimeout = null;
    this.bannerTimeout = null;

    this.container = document.getElementById('menu-container');
    this.initDOM();
    this.bindEvents();
    this.checkBackendHealth();
    this.healthInterval = setInterval(() => this.checkBackendHealth(), 4000);
    if (this.previewScene) {
      this.updatePreview();
    }
  }

  setPreviewScene(previewScene) {
    this.previewScene = previewScene;
    const mount = document.getElementById('preview-canvas-mount');
    if (mount && this.previewScene) {
      this.previewScene.mount(mount);
    }
    this.updatePreview();
  }

  initDOM() {
    this.container.innerHTML = `
      <div id="tactical-menu-root" class="tactical-menu-root">
        <!-- Top Navigation Bar -->
        <header class="menu-topbar">
          <div class="brand-group">
            <div class="brand-logo">BREACHERS<span class="accent">.IO</span></div>
            <div class="brand-tagline">LOCK IN. TEAM UP. BREACH OUT.</div>
          </div>

          <nav class="menu-nav-tabs">
            <button class="nav-tab active" data-screen="HOME">HOME</button>
            <button class="nav-tab" data-screen="OPERATORS">OPERATORS</button>
            <button class="nav-tab" data-screen="LOADOUT">LOADOUT</button>
            <button class="nav-tab" data-screen="MAPS">MAPS</button>
            <button class="nav-tab" data-screen="SETTINGS">SETTINGS</button>
            <button class="nav-tab nav-tab-report" id="btn-academic-report" title="View Academic Tech Stack Specification">
              <svg class="nav-tab-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>REPORT</span>
            </button>
          </nav>

          <div class="topbar-user-panel">
            <div class="server-status-badge" id="menu-server-status" title="Multiplayer Backend Connection Status">
              <span class="status-dot disconnected" id="menu-server-dot"></span>
              <span class="status-label" id="menu-server-label">SERVER: CONNECTING</span>
            </div>
            <div class="user-callsign-badge">
              <span class="user-role-tag" id="topbar-role-tag">ASSAULT</span>
              <span class="user-name" id="topbar-username">${this.username}</span>
            </div>
            <div class="version-tag">CHUNK 6 • v0.6.0</div>
          </div>
        </header>

        <!-- Main Screen Body Area -->
        <main class="menu-body">
          <!-- Left 3D Viewport Column (Common to Home & Operators & Loadout) -->
          <div id="menu-preview-column" class="menu-preview-column">
            <div class="preview-header">
              <span class="preview-badge" id="preview-badge-label">TACTICAL OPERATOR PREVIEW</span>
              <span class="preview-operator-name" id="preview-operator-title">VANGUARD-01</span>
            </div>

            <!-- Mount point for 3D canvas -->
            <div id="preview-canvas-mount" class="preview-canvas-mount"></div>

            <div class="preview-controls">
              <button id="btn-rot-left" class="btn-preview-tool" title="Rotate Left">⟲</button>
              <span class="preview-tip">DRAG TO ROTATE 360°</span>
              <button id="btn-rot-right" class="btn-preview-tool" title="Rotate Right">⟳</button>
            </div>
          </div>

          <!-- Right Content Column: Switched per screen -->
          <div class="menu-content-column">
            <!-- Global Tactical Alert / Error Banner -->
            <div id="menu-alert-banner" class="menu-alert-banner hidden">
              <span class="alert-icon">⚠️</span>
              <span id="menu-alert-message" class="alert-message"></span>
              <button id="btn-menu-alert-close" class="btn-alert-close" title="Dismiss notice">✕</button>
            </div>

            <!-- SCREEN 1: HOME -->
            <section id="screen-home" class="menu-screen active">
              <div class="home-deploy-card">
                <div class="home-card-header">
                  <div class="intel-tag">TACTICAL ENGAGEMENT BRIEFING</div>
                  <h1 class="intel-title">COMBAT READINESS: ARMED</h1>
                </div>

                <!-- Callsign Editing Input -->
                <div class="callsign-input-box">
                  <label for="input-callsign">OPERATOR CALLSIGN</label>
                  <div class="input-with-button">
                    <input id="input-callsign" type="text" maxlength="16" value="${this.username}" placeholder="Enter callsign..." autocomplete="off" />
                    <button id="btn-save-callsign" class="btn-callsign-save">SAVE</button>
                  </div>
                </div>

                <!-- Selected Map Indicator Card -->
                <div class="selected-map-card" id="home-map-card">
                  <div class="map-card-badge" id="home-map-status">AVAILABLE</div>
                  <div class="map-card-info">
                    <span class="map-card-label">DEPLOYMENT ZONE</span>
                    <h2 class="map-card-title" id="home-map-name">CONTAINER YARD</h2>
                    <p class="map-card-desc" id="home-map-desc">Freight shipping depot with corrugated containers and tactical chokepoints.</p>
                  </div>
                  <button id="btn-home-change-map" class="btn-change-map">CHANGE MAP</button>
                </div>

                <!-- Large Action Buttons -->
                <div class="home-actions-grid">
                  <button id="btn-quick-play" class="btn-main-play">
                    <span class="play-icon">⚡</span>
                    <div class="play-text">
                      <span class="play-primary">QUICK PLAY</span>
                      <span class="play-sub">Instant Multiplayer Match</span>
                    </div>
                  </button>

                  <button id="btn-create-lobby" class="btn-secondary-action">
                    <span class="action-icon">🔒</span>
                    <div class="action-text">
                      <span class="action-primary">CREATE PRIVATE ROOM</span>
                      <span class="action-sub">Host TDM or FFA match</span>
                    </div>
                  </button>
                </div>

                <!-- Join by Code Input Box -->
                <div class="join-room-row">
                  <input id="input-menu-join-code" type="text" maxlength="6" placeholder="ENTER 6-CHAR ROOM CODE" autocomplete="off" />
                  <button id="btn-menu-join-room" class="btn-join-action">JOIN ROOM</button>
                </div>

                <!-- Quick Controls Reference Bar -->
                <div class="home-controls-banner">
                  <div class="ctrl-chip"><span>WASD</span> Move</div>
                  <div class="ctrl-chip"><span>Shift</span> Sprint</div>
                  <div class="ctrl-chip"><span>Space</span> Jump</div>
                  <div class="ctrl-chip"><span>L-Click</span> Shoot</div>
                  <div class="ctrl-chip"><span>1, 2, 3</span> Weapons</div>
                  <div class="ctrl-chip"><span>R</span> Reload</div>
                  <div class="ctrl-chip"><span>Esc</span> Unlock Mouse</div>
                </div>
              </div>
            </section>

            <!-- SCREEN 2: OPERATORS -->
            <section id="screen-operators" class="menu-screen">
              <div class="screen-header">
                <h2>OPERATOR SELECTION</h2>
                <p>Select your operative class, tactical armor profile, and camo finish.</p>
              </div>

              <div class="operators-grid" id="operators-list-container">
                <!-- Dynamically populated -->
              </div>

              <!-- Camo Variants Selector -->
              <div class="operator-variants-box">
                <span class="variants-label">MATERIAL / CAMO FINISH:</span>
                <div class="variants-options" id="operator-variants-list"></div>
              </div>

              <div class="screen-action-row">
                <button id="btn-operator-back" class="btn-screen-back">← BACK TO HOME</button>
                <button id="btn-operator-confirm" class="btn-screen-confirm">CONFIRM OPERATOR</button>
              </div>
            </section>

            <!-- SCREEN 3: LOADOUT -->
            <section id="screen-loadout" class="menu-screen">
              <div class="screen-header">
                <h2>WEAPON LOADOUT</h2>
                <p>Inspect authentic server-authoritative combat specifications and ballistics.</p>
              </div>

              <div class="loadout-weapon-grid" id="loadout-list-container">
                <!-- Dynamically populated from WEAPONS -->
              </div>

              <div class="screen-action-row">
                <button id="btn-loadout-back" class="btn-screen-back">← BACK TO HOME</button>
                <button id="btn-loadout-confirm" class="btn-screen-confirm">EQUIP LOADOUT</button>
              </div>
            </section>

            <!-- SCREEN 4: MAPS -->
            <section id="screen-maps" class="menu-screen">
              <div class="screen-header">
                <h2>THEATRE OF WAR — MAP SELECTION</h2>
                <p>Select the combat arena for your next multiplayer deployment.</p>
              </div>

              <div class="maps-selection-grid" id="maps-list-container">
                <!-- Dynamically populated from MAP_REGISTRY -->
              </div>

              <div class="screen-action-row">
                <button id="btn-maps-back" class="btn-screen-back">← BACK TO HOME</button>
                <button id="btn-maps-confirm" class="btn-screen-confirm">CONFIRM SELECTION</button>
              </div>
            </section>

            <!-- SCREEN 5: SETTINGS -->
            <section id="screen-settings" class="menu-screen">
              <div class="screen-header">
                <h2>TACTICAL SETTINGS</h2>
                <p>Fine-tune audio, input sensitivity, and rendering performance.</p>
              </div>

              <div class="settings-form-grid">
                <!-- Master Volume -->
                <div class="setting-item">
                  <div class="setting-label-row">
                    <label for="setting-volume">MASTER VOLUME</label>
                    <span id="label-volume-val" class="setting-val-chip">${Math.round(this.settings.masterVolume * 100)}%</span>
                  </div>
                  <input id="setting-volume" type="range" min="0" max="1" step="0.05" value="${this.settings.masterVolume}" />
                </div>

                <!-- Mouse Sensitivity -->
                <div class="setting-item">
                  <div class="setting-label-row">
                    <label for="setting-sensitivity">LOOK SENSITIVITY</label>
                    <span id="label-sensitivity-val" class="setting-val-chip">${this.settings.mouseSensitivity.toFixed(1)}x</span>
                  </div>
                  <input id="setting-sensitivity" type="range" min="0.2" max="3.0" step="0.1" value="${this.settings.mouseSensitivity}" />
                </div>

                <!-- Graphics Preset -->
                <div class="setting-item">
                  <div class="setting-label-row">
                    <label for="setting-graphics">GRAPHICS QUALITY PRESET</label>
                  </div>
                  <select id="setting-graphics" class="setting-select">
                    <option value="high" ${this.settings.graphicsQuality === 'high' ? 'selected' : ''}>HIGH (Soft Shadows, Anti-Aliasing, 2048px Maps)</option>
                    <option value="medium" ${this.settings.graphicsQuality === 'medium' ? 'selected' : ''}>MEDIUM (Hard Shadows, Balanced)</option>
                    <option value="low" ${this.settings.graphicsQuality === 'low' ? 'selected' : ''}>LOW (No Shadows, Max FPS)</option>
                  </select>
                </div>

                <!-- FPS Display -->
                <div class="setting-item">
                  <div class="setting-label-row">
                    <label for="setting-show-fps">FPS COUNTER DISPLAY</label>
                    <input id="setting-show-fps" type="checkbox" ${this.settings.showFps ? 'checked' : ''} />
                  </div>
                  <span class="setting-subtext">Toggle real-time rendering frame-rate indicator</span>
                </div>

                <!-- Multiplayer Server URL Configuration -->
                <div class="setting-item">
                  <div class="setting-label-row">
                    <label for="setting-server-url">MULTIPLAYER SERVER URL</label>
                    <span class="setting-val-chip" id="label-server-status-chip">CLOUD READY</span>
                  </div>
                  <input id="setting-server-url" class="setting-input-text" type="text" placeholder="wss://breachers-io.onrender.com/ws/game" value="${this.customServerUrl}" autocomplete="off" />
                  <span class="setting-subtext">Backend WebSocket URL. Leave empty to use default auto-detected backend.</span>
                </div>
              </div>

              <div class="screen-action-row">
                <button id="btn-settings-reset" class="btn-screen-back">RESET DEFAULTS</button>
                <button id="btn-settings-save" class="btn-screen-confirm">APPLY & SAVE</button>
              </div>
            </section>

            <!-- SCREEN 6: LOBBY -->
            <section id="screen-lobby" class="menu-screen">
              <div class="screen-header">
                <h2>TACTICAL PRIVATE ROOM LOBBY</h2>
                <div class="lobby-room-badge">
                  <span>ROOM CODE:</span>
                  <span id="lobby-code-display" class="lobby-code-val">------</span>
                  <button id="btn-lobby-copy" class="btn-copy-code">COPY</button>
                </div>
              </div>

              <!-- Lobby Sub-header: Mode & Map Info -->
              <div class="lobby-meta-strip">
                <div class="lobby-meta-item">
                  <span class="meta-label">MATCH MODE:</span>
                  <div class="mode-toggles">
                    <button id="btn-lobby-mode-tdm" class="btn-mode-toggle active">TDM (30)</button>
                    <button id="btn-lobby-mode-ffa" class="btn-mode-toggle">FFA (20)</button>
                  </div>
                </div>
                <div class="lobby-meta-item">
                  <span class="meta-label">SELECTED MAP:</span>
                  <span id="lobby-selected-map" class="meta-val">CONTAINER YARD</span>
                </div>
              </div>

              <!-- Team Rosters for TDM -->
              <div id="lobby-tdm-rosters" class="lobby-rosters-grid">
                <div class="lobby-roster red">
                  <div class="roster-header red">
                    <span>RED TEAM (<span id="lobby-red-count">0</span>/5)</span>
                    <button id="btn-lobby-join-red" class="btn-join-team-pill red">JOIN RED</button>
                  </div>
                  <div id="lobby-red-list" class="roster-list"></div>
                </div>

                <div class="lobby-roster blue">
                  <div class="roster-header blue">
                    <span>BLUE TEAM (<span id="lobby-blue-count">0</span>/5)</span>
                    <button id="btn-lobby-join-blue" class="btn-join-team-pill blue">JOIN BLUE</button>
                  </div>
                  <div id="lobby-blue-list" class="roster-list"></div>
                </div>
              </div>

              <!-- FFA Roster -->
              <div id="lobby-ffa-box" class="lobby-ffa-box hidden">
                <div class="roster-header ffa">
                  <span>SOLO COMBATANTS (<span id="lobby-ffa-count">0</span>/10)</span>
                </div>
                <div id="lobby-ffa-list" class="roster-list ffa"></div>
              </div>

              <!-- Host & Navigation Controls -->
              <div class="lobby-actions-bar">
                <button id="btn-lobby-leave" class="btn-screen-back">LEAVE ROOM</button>
                <button id="btn-lobby-start" class="btn-main-play" disabled>START MATCH (HOST ONLY)</button>
              </div>
            </section>

          </div>
        </main>

        <!-- Academic Tech Stack & Architecture Modal -->
        <div id="academic-modal" class="academic-modal hidden">
          <div class="academic-modal-card">
            <div class="academic-modal-header">
              <div class="academic-header-left">
                <div class="academic-tag">SYLLABUS &amp; ARCHITECTURE VERIFICATION</div>
                <h2 class="academic-title">BREACHERS.IO &bull; TECH STACK SPECIFICATION</h2>
              </div>
              <button id="btn-academic-modal-close" class="btn-academic-close" type="button" title="Close Modal">✕</button>
            </div>

            <div class="academic-modal-toolbar">
              <button id="btn-download-md" class="btn-academic-tool" type="button">
                <span>📥</span> DOWNLOAD REPORT (.MD)
              </button>
              <button id="btn-download-html" class="btn-academic-tool" type="button">
                <span>📄</span> DOWNLOAD REPORT (.HTML)
              </button>
              <button id="btn-share-telegram" class="btn-academic-tool telegram" type="button">
                <span>✈️</span> SEND TO TELEGRAM
              </button>
              <button id="btn-copy-telegram" class="btn-academic-tool" type="button">
                <span>📋</span> COPY TELEGRAM BRIEFING
              </button>
            </div>

            <div id="academic-toast" class="academic-toast hidden"></div>

            <div class="academic-modal-body">
              <div class="tech-spec-grid">
                <!-- 1. AWT -->
                <div class="tech-card">
                  <div class="tech-card-badge">JAVA 21 SE</div>
                  <h3 class="tech-card-title">1. AWT (Abstract Window Toolkit)</h3>
                  <p class="tech-card-desc">
                    Used for server-side rasterization and procedural graphics rendering.
                    <code>io.breachers.academic.awt.TacticalRadarRasterizer</code> utilizes <code>java.awt.Graphics2D</code>,
                    <code>java.awt.image.BufferedImage</code>, <code>Color</code>, and <code>BasicStroke</code> to procedurally
                    draw 2D tactical radar grids, container blueprints, spawn sectors, and coordinate grids for live matches.
                  </p>
                  <div class="tech-card-link-row">
                    <span class="tech-card-status">STATUS: IMPLEMENTED &amp; ACTIVE</span>
                    <a href="/academic/radar?map=yard" target="_blank" class="tech-card-link">VIEW LIVE AWT PNG ↗</a>
                  </div>
                </div>

                <!-- 2. Swing -->
                <div class="tech-card">
                  <div class="tech-card-badge">JAVA 21 SE</div>
                  <h3 class="tech-card-title">2. Swing Desktop GUI</h3>
                  <p class="tech-card-desc">
                    Used for dedicated server administration and live telemetry monitoring.
                    <code>io.breachers.academic.swing.BreachersServerAdminConsole</code> provides a desktop GUI featuring
                    <code>javax.swing.JFrame</code>, <code>JTable</code> with <code>DefaultTableModel</code>,
                    live memory gauges (Heap / Non-Heap), active room participant counters, and admin command triggers.
                  </p>
                  <div class="tech-card-link-row">
                    <span class="tech-card-status">STATUS: STANDALONE &amp; HEADLESS-SAFE</span>
                  </div>
                </div>

                <!-- 3. JDBC Database -->
                <div class="tech-card">
                  <div class="tech-card-badge">DATA PERSISTENCE</div>
                  <h3 class="tech-card-title">3. JDBC Database Persistence</h3>
                  <p class="tech-card-desc">
                    Used for reliable, ACID-compliant combat match recording and career operator standings.
                    Implemented via <code>schema.sql</code>, <code>DatabaseConfig</code>, and <code>MatchPersistenceService</code>
                    with both Spring <code>JdbcTemplate</code> and raw JDBC (<code>java.sql.Connection</code>,
                    <code>PreparedStatement</code>, <code>ResultSet</code>) over H2 in-memory and PostgreSQL.
                  </p>
                  <div class="tech-card-link-row">
                    <span class="tech-card-status">TABLES: match_history &bull; player_statistics</span>
                  </div>
                </div>

                <!-- 4. Servlet Web Application -->
                <div class="tech-card">
                  <div class="tech-card-badge">JAKARTA EE</div>
                  <h3 class="tech-card-title">4. Servlet Web Application</h3>
                  <p class="tech-card-desc">
                    Used for server-authoritative combat performance auditing and match history retrieval.
                    <code>io.breachers.servlet.MatchReportServlet</code> extends standard <code>jakarta.servlet.http.HttpServlet</code>,
                    overriding <code>doGet()</code> to serve dynamic HTML, raw JSON, markdown, and attachment downloads via
                    Spring Boot's <code>ServletRegistrationBean</code> at <code>/academic/match-report</code>.
                  </p>
                  <div class="tech-card-link-row">
                    <span class="tech-card-status">ENDPOINT: /academic/match-report</span>
                    <a href="/academic/match-report" target="_blank" class="tech-card-link">OPEN SERVLET ↗</a>
                  </div>
                </div>

                <!-- 5. JSP -->
                <div class="tech-card">
                  <div class="tech-card-badge">JAKARTA EE</div>
                  <h3 class="tech-card-title">5. JSP (JavaServer Pages)</h3>
                  <p class="tech-card-desc">
                    Used for server-side dynamic template rendering adhering to the classic MVC Model-2 architecture.
                    <code>academic-report.jsp</code> demonstrates JSTL tags and Expression Language (EL)
                    populated by <code>AcademicJspReportServlet</code> via <code>req.setAttribute()</code> and <code>RequestDispatcher.forward()</code>.
                  </p>
                  <div class="tech-card-link-row">
                    <span class="tech-card-status">TEMPLATE: /WEB-INF/jsp/academic-report.jsp</span>
                    <a href="/academic/jsp-report" target="_blank" class="tech-card-link">OPEN JSP VIEW ↗</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading Overlay (Shown during map loading / GLB parsing) -->
        <div id="loading-overlay" class="menu-loading-overlay hidden">
          <div class="loading-modal">
            <div class="loading-spinner"></div>
            <h2 id="loading-title">DEPLOYING TO SECTOR...</h2>
            <p id="loading-subtitle">Initializing tactical terrain and physics colliders</p>
            <div class="loading-bar-track">
              <div id="loading-bar-fill" class="loading-bar-fill"></div>
            </div>
            <div id="loading-percent" class="loading-percent">0%</div>
          </div>
        </div>

      </div>
    `;

    // Mount preview canvas into preview column
    if (this.previewScene) {
      const mount = document.getElementById('preview-canvas-mount');
      if (mount) {
        mount.appendChild(this.previewScene.domElement);
      }
    }

    this.renderOperatorsScreen();
    this.renderLoadoutScreen();
    this.renderMapsScreen();
    this.updateHomeMapDisplay();
  }

  bindEvents() {
    // Nav Tabs
    const tabs = this.container.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-screen');
        if (target) {
          if (target === 'HOME' && this.currentScreen === 'LOBBY') {
            this.currentRoomState = null;
            if (this.onLeaveRoom) this.onLeaveRoom();
          }
          this.navigateTo(target);
        }
      });
    });

        // Academic Tech Stack Modal & Tools
    const academicModal = document.getElementById("academic-modal");
    const btnReport = document.getElementById("btn-academic-report");
    const btnCloseAcademic = document.getElementById("btn-academic-modal-close");
    const btnDownloadMd = document.getElementById("btn-download-md");
    const btnDownloadHtml = document.getElementById("btn-download-html");
    const btnShareTelegram = document.getElementById("btn-share-telegram");
    const btnCopyTelegram = document.getElementById("btn-copy-telegram");
    const academicToast = document.getElementById("academic-toast");

    const getApiBase = () => {
      return (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL)
        ? import.meta.env.VITE_API_BASE_URL
        : (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
          ? "http://localhost:8081"
          : "https://breachers-io.onrender.com");
    };

    const showAcademicToast = (msg) => {
      if (!academicToast) return;
      academicToast.textContent = msg;
      academicToast.classList.remove("hidden");
      setTimeout(() => academicToast.classList.add("hidden"), 3000);
    };

    if (btnReport && academicModal) {
      btnReport.addEventListener("click", () => {
        academicModal.classList.remove("hidden");
      });
    }

    if (academicModal && (window.location.hash === "#report" || window.location.search.includes("report=true"))) {
      academicModal.classList.remove("hidden");
    }

    if (btnCloseAcademic && academicModal) {
      btnCloseAcademic.addEventListener("click", () => {
        academicModal.classList.add("hidden");
      });
    }

    if (btnDownloadMd) {
      btnDownloadMd.addEventListener("click", () => {
        window.open(`${getApiBase()}/academic/match-report?format=md&download=true`, "_blank");
      });
    }

    if (btnDownloadHtml) {
      btnDownloadHtml.addEventListener("click", () => {
        window.open(`${getApiBase()}/academic/match-report?download=true`, "_blank");
      });
    }

    if (btnShareTelegram) {
      btnShareTelegram.addEventListener("click", () => {
        const text = "Breachers.io Technical Architecture Briefing: Complete implementation report covering AWT, Swing, JDBC Database, Servlet Web App, and JSP.";
        const url = `${getApiBase()}/academic/match-report`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
      });
    }

    if (btnCopyTelegram) {
      btnCopyTelegram.addEventListener("click", () => {
        const summary = [
          "🛡 BREACHERS.IO — TECHNICAL ARCHITECTURE SUMMARY",
          "• AWT: io.breachers.academic.awt.TacticalRadarRasterizer (Graphics2D / BufferedImage)",
          "• Swing: io.breachers.academic.swing.BreachersServerAdminConsole (JFrame / JTable)",
          "• JDBC: io.breachers.persistence.MatchPersistenceService (PreparedStatement / H2 / Postgres)",
          "• Servlet: io.breachers.servlet.MatchReportServlet (/academic/match-report)",
          "• JSP: /WEB-INF/jsp/academic-report.jsp (JSTL Expression Language)",
          "Live Report: " + getApiBase() + "/academic/match-report"
        ].join("\n");

        navigator.clipboard.writeText(summary).then(() => {
          showAcademicToast("TELEGRAM BRIEFING COPIED TO CLIPBOARD!");
        });
      });
    }

    // Callsign Save
    const btnSaveCallsign = document.getElementById('btn-save-callsign');
    const inputCallsign = document.getElementById('input-callsign');
    if (btnSaveCallsign && inputCallsign) {
      btnSaveCallsign.addEventListener('click', () => {
        const val = inputCallsign.value.trim();
        if (val) {
          this.username = val;
          localStorage.setItem('breachers_username', val);
          const topName = document.getElementById('topbar-username');
          if (topName) topName.textContent = val;
          alert('Callsign updated to: ' + val);
        }
      });
    }

    // Home Quick Play
    const btnQuickPlay = document.getElementById('btn-quick-play');
    if (btnQuickPlay) {
      btnQuickPlay.addEventListener('click', () => {
        if (this.onDeployMatch) {
          this.onDeployMatch(this.selectedMapId, this.username);
        }
      });
    }

    // Home Change Map
    const btnChangeMap = document.getElementById('btn-home-change-map');
    if (btnChangeMap) {
      btnChangeMap.addEventListener('click', () => {
        this.navigateTo('MAPS');
      });
    }

    // Dismiss Alert Banner
    const btnAlertClose = document.getElementById('btn-menu-alert-close');
    if (btnAlertClose) {
      btnAlertClose.addEventListener('click', () => {
        const banner = document.getElementById('menu-alert-banner');
        if (banner) banner.classList.add('hidden');
      });
    }

    // Home Create Room
    const btnCreateLobby = document.getElementById('btn-create-lobby');
    if (btnCreateLobby) {
      btnCreateLobby.addEventListener('click', () => {
        if (this.onCreateRoom) {
          this.setLobbyButtonLoading(true, 'CREATING ROOM...');
          this.onCreateRoom(this.username, 'TDM', this.selectedMapId);
        }
      });
    }

    // Home Join Room
    const btnJoinRoom = document.getElementById('btn-menu-join-room');
    const inputJoinCode = document.getElementById('input-menu-join-code');
    if (btnJoinRoom && inputJoinCode) {
      btnJoinRoom.addEventListener('click', () => {
        const code = inputJoinCode.value.trim().toUpperCase();
        if (code.length === 6 && this.onJoinRoom) {
          this.setLobbyButtonLoading(true, 'JOINING ROOM...');
          this.onJoinRoom(code, this.username);
        } else {
          this.showErrorBanner('Please enter a valid 6-character room code.');
        }
      });
    }

    // Rotation Tools
    const btnRotLeft = document.getElementById('btn-rot-left');
    const btnRotRight = document.getElementById('btn-rot-right');
    if (btnRotLeft && this.previewScene) {
      btnRotLeft.addEventListener('click', () => this.previewScene.rotateLeft());
    }
    if (btnRotRight && this.previewScene) {
      btnRotRight.addEventListener('click', () => this.previewScene.rotateRight());
    }

    // Screen Back Buttons
    const backOps = document.getElementById('btn-operator-back');
    const backLoadout = document.getElementById('btn-loadout-back');
    const backMaps = document.getElementById('btn-maps-back');
    if (backOps) backOps.addEventListener('click', () => this.navigateTo('HOME'));
    if (backLoadout) backLoadout.addEventListener('click', () => this.navigateTo('HOME'));
    if (backMaps) backMaps.addEventListener('click', () => this.navigateTo('HOME'));

    // Confirm Buttons
    const confOps = document.getElementById('btn-operator-confirm');
    const confLoadout = document.getElementById('btn-loadout-confirm');
    const confMaps = document.getElementById('btn-maps-confirm');
    if (confOps) {
      confOps.addEventListener('click', () => {
        localStorage.setItem('breachers_selected_operator', this.selectedOperatorId);
        localStorage.setItem('breachers_selected_variant', this.selectedVariantId);
        this.navigateTo('HOME');
      });
    }
    if (confLoadout) confLoadout.addEventListener('click', () => this.navigateTo('HOME'));
    if (confMaps) {
      confMaps.addEventListener('click', () => {
        localStorage.setItem('breachers_selected_map', this.selectedMapId);
        this.updateHomeMapDisplay();
        this.navigateTo('HOME');
      });
    }

    // Settings Sliders & Form
    const setVol = document.getElementById('setting-volume');
    const setSens = document.getElementById('setting-sensitivity');
    const setGraph = document.getElementById('setting-graphics');
    const setShowFps = document.getElementById('setting-show-fps');
    const setServer = document.getElementById('setting-server-url');
    const btnSaveSettings = document.getElementById('btn-settings-save');
    const btnResetSettings = document.getElementById('btn-settings-reset');

    if (setVol) {
      setVol.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.settings.masterVolume = val;
        const chip = document.getElementById('label-volume-val');
        if (chip) chip.textContent = Math.round(val * 100) + '%';
      });
    }

    if (setSens) {
      setSens.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.settings.mouseSensitivity = val;
        const chip = document.getElementById('label-sensitivity-val');
        if (chip) chip.textContent = val.toFixed(1) + 'x';
      });
    }

    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => {
        this.settings.graphicsQuality = setGraph.value;
        this.settings.showFps = setShowFps.checked;
        if (setServer) {
          const val = setServer.value.trim();
          this.customServerUrl = val;
          if (val) {
            localStorage.setItem('breachers_backend_ws_url', val);
          } else {
            localStorage.removeItem('breachers_backend_ws_url');
          }
        }
        localStorage.setItem('breachers_volume', this.settings.masterVolume);
        localStorage.setItem('breachers_sensitivity', this.settings.mouseSensitivity);
        localStorage.setItem('breachers_graphics', this.settings.graphicsQuality);
        localStorage.setItem('breachers_show_fps', this.settings.showFps);
        if (this.onSettingsChanged) {
          this.onSettingsChanged(this.settings);
        }
        this.showToast('Settings applied and saved!');
        this.navigateTo('HOME');
      });
    }

    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', () => {
        this.settings = { masterVolume: 0.8, mouseSensitivity: 1.0, graphicsQuality: 'high', showFps: true };
        setVol.value = '0.8';
        setSens.value = '1.0';
        setGraph.value = 'high';
        setShowFps.checked = true;
        if (setServer) setServer.value = '';
        this.customServerUrl = '';
        localStorage.removeItem('breachers_backend_ws_url');
        document.getElementById('label-volume-val').textContent = '80%';
        document.getElementById('label-sensitivity-val').textContent = '1.0x';
      });
    }

    // Lobby Actions
    const btnLobbyLeave = document.getElementById('btn-lobby-leave');
    const btnLobbyStart = document.getElementById('btn-lobby-start');
    const btnLobbyCopy = document.getElementById('btn-lobby-copy');
    const btnJoinRed = document.getElementById('btn-lobby-join-red');
    const btnJoinBlue = document.getElementById('btn-lobby-join-blue');
    const btnModeTdm = document.getElementById('btn-lobby-mode-tdm');
    const btnModeFfa = document.getElementById('btn-lobby-mode-ffa');

    if (btnLobbyLeave) {
      btnLobbyLeave.addEventListener('click', () => {
        if (this.onLeaveRoom) this.onLeaveRoom();
        this.navigateTo('HOME');
      });
    }

    if (btnLobbyStart) {
      btnLobbyStart.addEventListener('click', () => {
        if (this.onStartMatch) this.onStartMatch();
      });
    }

    if (btnLobbyCopy) {
      btnLobbyCopy.addEventListener('click', () => {
        if (this.currentRoomState && this.currentRoomState.roomCode) {
          navigator.clipboard.writeText(this.currentRoomState.roomCode).then(() => {
            btnLobbyCopy.textContent = 'COPIED!';
            setTimeout(() => { btnLobbyCopy.textContent = 'COPY'; }, 1500);
          });
        }
      });
    }

    if (btnJoinRed && this.onSetTeam) btnJoinRed.addEventListener('click', () => this.onSetTeam('RED'));
    if (btnJoinBlue && this.onSetTeam) btnJoinBlue.addEventListener('click', () => this.onSetTeam('BLUE'));
    if (btnModeTdm && this.onSetGameMode) btnModeTdm.addEventListener('click', () => this.onSetGameMode('TDM'));
    if (btnModeFfa && this.onSetGameMode) btnModeFfa.addEventListener('click', () => this.onSetGameMode('FFA'));
  }

  navigateTo(screenName) {
    this.currentScreen = screenName;

    // Update Topbar nav tabs
    const tabs = this.container.querySelectorAll('.nav-tab');
    tabs.forEach(t => {
      if (t.getAttribute('data-screen') === screenName) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    // Toggle screen sections
    const screens = this.container.querySelectorAll('.menu-screen');
    screens.forEach(s => {
      if (s.id === `screen-${screenName.toLowerCase()}`) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });

    // Control 3D Preview Column visibility & mode
    const previewCol = document.getElementById('menu-preview-column');
    if (previewCol) {
      if (screenName === 'MAPS' || screenName === 'SETTINGS' || screenName === 'LOBBY') {
        previewCol.classList.add('hidden');
      } else {
        previewCol.classList.remove('hidden');
      }
    }

    if (this.previewScene) {
      if (screenName === 'LOADOUT') {
        this.previewScene.showWeaponPreview('ASSAULT');
        document.getElementById('preview-badge-label').textContent = 'WEAPON ARMORY INSPECTION';
        document.getElementById('preview-operator-title').textContent = 'BREACHER-V1 (ASSAULT)';
      } else {
        this.previewScene.showOperatorPreview();
        this.updatePreview();
      }
    }
  }

  updatePreview() {
    const op = getOperator(this.selectedOperatorId);
    if (this.previewScene) {
      this.previewScene.loadOperator(this.selectedOperatorId, this.selectedVariantId);
    }
    const title = document.getElementById('preview-operator-title');
    const badge = document.getElementById('preview-badge-label');
    const topRole = document.getElementById('topbar-role-tag');
    if (title) title.textContent = op.callsign || op.name.toUpperCase();
    if (badge) badge.textContent = `OPERATIVE PROFILE • ${op.role.toUpperCase()}`;
    if (topRole) {
      const shortRole = op.role ? (op.role.split(' ').pop() || op.role).toUpperCase() : 'ASSAULT';
      topRole.textContent = shortRole;
    }
  }

  updateHomeMapDisplay() {
    const mapCfg = getMapConfig(this.selectedMapId);
    const title = document.getElementById('home-map-name');
    const desc = document.getElementById('home-map-desc');
    const status = document.getElementById('home-map-status');
    if (title) title.textContent = mapCfg.name.toUpperCase();
    if (desc) desc.textContent = mapCfg.description;
    if (status) {
      status.textContent = mapCfg.badgeText;
      status.style.background = mapCfg.previewBadgeColor;
    }
  }

  renderOperatorsScreen() {
    const container = document.getElementById('operators-list-container');
    if (!container) return;

    const ops = getAllOperators();
    container.innerHTML = ops.map(op => `
      <div class="operator-card ${op.id === this.selectedOperatorId ? 'selected' : ''}" data-id="${op.id}">
        <div class="op-card-header">
          <span class="op-role-pill">${op.role}</span>
          <span class="op-callsign">${op.callsign}</span>
        </div>
        <h3 class="op-name">${op.name}</h3>
        <p class="op-desc">${op.description}</p>
        <div class="op-stats-row">
          <div class="op-stat"><span>ARMOR</span><span>${op.stats.armor}</span></div>
          <div class="op-stat"><span>SPEED</span><span>${op.stats.mobility}</span></div>
          <div class="op-stat"><span>BREACH</span><span>${op.stats.breach}</span></div>
        </div>
      </div>
    `).join('');

    // Click handler for operator selection
    const cards = container.querySelectorAll('.operator-card');
    cards.forEach(c => {
      c.addEventListener('click', () => {
        cards.forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        this.selectedOperatorId = c.getAttribute('data-id');
        this.selectedVariantId = 'standard';
        this.updatePreview();
        this.renderOperatorVariants();
      });
    });

    this.renderOperatorVariants();
  }

  renderOperatorVariants() {
    const container = document.getElementById('operator-variants-list');
    if (!container) return;

    const op = getOperator(this.selectedOperatorId);
    if (!op.variants || op.variants.length === 0) {
      container.innerHTML = '<span class="no-variants">Standard issue uniform</span>';
      return;
    }

    container.innerHTML = op.variants.map(v => `
      <button class="variant-pill ${v.id === this.selectedVariantId ? 'selected' : ''}" data-variant="${v.id}">
        <span class="variant-color-dot" style="background-color: #${v.armor.toString(16).padStart(6, '0')}"></span>
        <span class="variant-name">${v.name}</span>
      </button>
    `).join('');

    const pills = container.querySelectorAll('.variant-pill');
    pills.forEach(p => {
      p.addEventListener('click', () => {
        pills.forEach(x => x.classList.remove('selected'));
        p.classList.add('selected');
        this.selectedVariantId = p.getAttribute('data-variant');
        this.updatePreview();
      });
    });
  }

  renderLoadoutScreen() {
    const container = document.getElementById('loadout-list-container');
    if (!container) return;

    const weaponsList = [
      { key: 'ASSAULT', meta: WEAPONS.ASSAULT, title: 'SLOT 1 • PRIMARY ASSAULT RIFLE', rpm: '~545 RPM', rangeStr: '120m' },
      { key: 'PISTOL', meta: WEAPONS.PISTOL, title: 'SLOT 2 • SECONDARY SIDEARM', rpm: '~240 RPM', rangeStr: '80m' },
      { key: 'KNIFE', meta: WEAPONS.KNIFE, title: 'SLOT 3 • TACTICAL COMBAT BLADE', rpm: '~120 RPM', rangeStr: '2.5m Melee' }
    ];

    container.innerHTML = weaponsList.map(w => `
      <div class="loadout-weapon-card" data-weapon="${w.key}">
        <div class="weapon-card-top">
          <span class="slot-tag">${w.title}</span>
          <span class="weapon-id">${w.meta.id}</span>
        </div>
        <h3 class="weapon-name">${w.meta.name}</h3>
        <div class="weapon-stat-bars">
          <div class="stat-bar-group">
            <div class="stat-header"><span>DAMAGE (BODY / HEAD)</span><span>${w.meta.damage} / ${Math.round(w.meta.damage * 1.8)}</span></div>
            <div class="stat-track"><div class="stat-fill" style="width: ${(w.meta.damage / 70) * 100}%"></div></div>
          </div>
          <div class="stat-bar-group">
            <div class="stat-header"><span>FIRE RATE</span><span>${w.rpm}</span></div>
            <div class="stat-track"><div class="stat-fill" style="width: ${w.meta.auto ? '85%' : (w.meta.isMelee ? '35%' : '55%')}"></div></div>
          </div>
          <div class="stat-bar-group">
            <div class="stat-header"><span>MAGAZINE / CAPACITY</span><span>${w.meta.maxClip > 0 ? `${w.meta.maxClip} / ${w.meta.maxReserve}` : 'UNLIMITED MELEE'}</span></div>
            <div class="stat-track"><div class="stat-fill" style="width: ${w.meta.maxClip > 0 ? (w.meta.maxClip / 30) * 100 : 100}%"></div></div>
          </div>
          <div class="stat-bar-group">
            <div class="stat-header"><span>EFFECTIVE RANGE</span><span>${w.rangeStr}</span></div>
            <div class="stat-track"><div class="stat-fill" style="width: ${(w.meta.range / 120) * 100}%"></div></div>
          </div>
        </div>
        <button class="btn-inspect-weapon" data-weapon="${w.key}">INSPECT 3D VIEW</button>
      </div>
    `).join('');

    const inspectBtns = container.querySelectorAll('.btn-inspect-weapon');
    inspectBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wKey = btn.getAttribute('data-weapon');
        if (this.previewScene) {
          this.previewScene.showWeaponPreview(wKey);
          document.getElementById('preview-operator-title').textContent = WEAPONS[wKey].name;
        }
      });
    });
  }

  renderMapsScreen() {
    const container = document.getElementById('maps-list-container');
    if (!container) return;

    const maps = getAllMaps();
    container.innerHTML = maps.map(m => `
      <div class="map-select-card ${m.id === this.selectedMapId ? 'selected' : ''} ${!m.isAvailable ? 'disabled' : ''}" data-map-id="${m.id}">
        <div class="map-card-banner ${m.id}">
          <span class="map-status-badge ${m.isAvailable ? 'available' : 'coming-soon'}">${m.badgeText}</span>
        </div>
        <div class="map-card-details">
          <h3 class="map-title">${m.name}</h3>
          <span class="map-subtitle">${m.subtitle}</span>
          <p class="map-desc">${m.description}</p>
          <div class="map-modes-row">
            ${m.modes.map(mode => `<span class="mode-pill">${mode}</span>`).join('')}
            <span class="players-pill">MAX ${m.maxPlayers} PLAYERS</span>
          </div>
        </div>
      </div>
    `).join('');

    const cards = container.querySelectorAll('.map-select-card');
    cards.forEach(c => {
      c.addEventListener('click', () => {
        const id = c.getAttribute('data-map-id');
        const cfg = getMapConfig(id);
        if (!cfg.isAvailable) {
          alert(`"${cfg.name}" is currently under tactical construction and will be deployed in a future chunk.`);
          return;
        }
        cards.forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        this.selectedMapId = id;
      });
    });
  }

  /**
   * Update Room Lobby UI when backend broadcasts room state
   */
  updateRoomState(roomState, localPlayerId) {
    this.setLobbyButtonLoading(false);

    if (!roomState || roomState.roomCode === 'PUBLIC') {
      this.currentRoomState = null;
      if (this.currentScreen === 'LOBBY') {
        this.navigateTo('HOME');
      }
      return;
    }

    this.currentRoomState = roomState;
    this.localPlayerId = localPlayerId;

    if (this.currentScreen !== 'LOBBY') {
      this.navigateTo('LOBBY');
    }

    const codeDisplay = document.getElementById('lobby-code-display');
    const mapDisplay = document.getElementById('lobby-selected-map');
    const btnStart = document.getElementById('btn-lobby-start');
    const redCount = document.getElementById('lobby-red-count');
    const blueCount = document.getElementById('lobby-blue-count');
    const redList = document.getElementById('lobby-red-list');
    const blueList = document.getElementById('lobby-blue-list');
    const ffaBox = document.getElementById('lobby-ffa-box');
    const ffaCount = document.getElementById('lobby-ffa-count');
    const ffaList = document.getElementById('lobby-ffa-list');
    const tdmRosters = document.getElementById('lobby-tdm-rosters');

    if (codeDisplay) codeDisplay.textContent = roomState.roomCode;
    if (mapDisplay) {
      const cfg = getMapConfig(this.selectedMapId);
      mapDisplay.textContent = cfg.name.toUpperCase();
    }

    const isHost = Boolean(
      (roomState.hostId && roomState.hostId === localPlayerId) ||
      ((roomState.players || []).some(p => p.id === localPlayerId && p.isHost))
    );

    if (btnStart) {
      btnStart.disabled = !isHost;
      btnStart.textContent = isHost ? 'START MATCH (HOST)' : 'WAITING FOR HOST TO START...';
    }

    const isTdm = roomState.mode === 'TDM';
    if (tdmRosters) tdmRosters.classList.toggle('hidden', !isTdm);
    if (ffaBox) ffaBox.classList.toggle('hidden', isTdm);

    // Update Mode Toggles
    const btnTdm = document.getElementById('btn-lobby-mode-tdm');
    const btnFfa = document.getElementById('btn-lobby-mode-ffa');
    if (btnTdm) btnTdm.classList.toggle('active', isTdm);
    if (btnFfa) btnFfa.classList.toggle('active', !isTdm);

    // Populate Players
    const players = roomState.players || [];
    const redPlayers = players.filter(p => p.team === 'RED');
    const bluePlayers = players.filter(p => p.team === 'BLUE');
    const ffaPlayers = players.filter(p => p.team === 'FFA');

    if (redCount) redCount.textContent = redPlayers.length;
    if (blueCount) blueCount.textContent = bluePlayers.length;
    if (ffaCount) ffaCount.textContent = ffaPlayers.length;

    const renderRoster = (list, targetEl) => {
      if (!targetEl) return;
      targetEl.innerHTML = list.map(p => `
        <div class="roster-player-chip ${p.id === localPlayerId ? 'local' : ''}">
          <span class="player-icon">${p.isHost ? '👑' : '🎖️'}</span>
          <span class="player-name">${p.username}</span>
          ${p.id === localPlayerId ? '<span class="you-badge">(YOU)</span>' : ''}
        </div>
      `).join('');
    };

    renderRoster(redPlayers, redList);
    renderRoster(bluePlayers, blueList);
    renderRoster(ffaPlayers, ffaList);
  }

  setLobbyButtonLoading(isLoading, label = 'CREATING ROOM...') {
    const btn = document.getElementById('btn-create-lobby');
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      if (!btn.dataset.originalHtml) {
        btn.dataset.originalHtml = btn.innerHTML;
      }
      btn.innerHTML = `
        <span class="action-spinner"></span>
        <div class="action-text">
          <span class="action-primary">${label}</span>
          <span class="action-sub">Connecting to multiplayer backend...</span>
        </div>
      `;
      if (this.lobbyTimeout) clearTimeout(this.lobbyTimeout);
      this.lobbyTimeout = setTimeout(() => {
        if (btn && btn.disabled) {
          this.setLobbyButtonLoading(false);
          this.showErrorBanner('Multiplayer server connection taking longer than expected. If hosted on Render, please allow 30-45s for free-tier wake up, then try again.');
        }
      }, 18000);
    } else {
      if (this.lobbyTimeout) {
        clearTimeout(this.lobbyTimeout);
        this.lobbyTimeout = null;
      }
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
      }
    }
  }

  showErrorBanner(message, durationMs = 8000) {
    const banner = document.getElementById('menu-alert-banner');
    const msgEl = document.getElementById('menu-alert-message');
    if (!banner || !msgEl) return;
    msgEl.textContent = message;
    banner.classList.remove('hidden');
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      banner.classList.add('hidden');
    }, durationMs);
  }

  showToast(message, durationMs = 3000) {
    this.showErrorBanner(message, durationMs);
  }

  async checkBackendHealth() {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
      ? import.meta.env.VITE_API_BASE_URL
      : (isLocal ? 'http://localhost:8081' : 'https://breachers-io.onrender.com');

    try {
      const res = await fetch(`${apiBase}/api/health`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'UP') {
          this.setNetworkStatus('connected', apiBase);
          return true;
        }
      }
      this.setNetworkStatus('disconnected', apiBase);
    } catch (e) {
      this.setNetworkStatus('disconnected', apiBase);
    }
    return false;
  }

  setNetworkStatus(status, url = '') {
    const dot = document.getElementById('menu-server-dot');
    const label = document.getElementById('menu-server-label');
    const badge = document.getElementById('menu-server-status');
    if (!dot || !label) return;

    dot.className = 'status-dot ' + status;
    if (status === 'connected') {
      label.textContent = 'SERVER: ONLINE';
      if (badge) badge.title = `Connected to: ${url}`;
    } else if (status === 'connecting') {
      label.textContent = 'SERVER: CONNECTING...';
      if (badge) badge.title = `Connecting to: ${url}`;
    } else {
      label.textContent = 'SERVER: OFFLINE';
      if (badge) badge.title = url ? `Offline (${url})` : 'Server Unreachable (Spinning up on Render...)';
    }
  }

  showLoading(mapName, onComplete) {
    const overlay = document.getElementById('loading-overlay');
    const bar = document.getElementById('loading-bar-fill');
    const percentEl = document.getElementById('loading-percent');
    const titleEl = document.getElementById('loading-title');

    if (!overlay) return;
    overlay.classList.remove('hidden');
    if (titleEl) titleEl.textContent = `DEPLOYING TO ${mapName.toUpperCase()}...`;

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 20) + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          overlay.classList.add('hidden');
          if (onComplete) onComplete();
        }, 300);
      }
      if (bar) bar.style.width = `${progress}%`;
      if (percentEl) percentEl.textContent = `${progress}%`;
    }, 80);
  }

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  hideMenu() {
    this.container.classList.add('hidden');
  }

  showMenu() {
    this.container.classList.remove('hidden');
    this.navigateTo('HOME');
  }

  getSelectedMapId() {
    return this.selectedMapId;
  }

  getSettings() {
    return { ...this.settings };
  }
}
