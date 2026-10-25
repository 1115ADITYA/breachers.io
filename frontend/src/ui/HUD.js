/**
 * HUD
 * Tactical FPS heads-up display managing crosshairs, hitmarkers, health,
 * weapon slots, ammo counters, kill feed, damage vignette, 5-second spawn shield,
 * private room lobby, match scoreboard, and match-end victory screen.
 */
export class HUD {
  constructor(options = {}) {
    this.onPlayClick = options.onPlayClick || null;
    this.onCreateRoom = options.onCreateRoom || null;
    this.onJoinRoom = options.onJoinRoom || null;
    this.onLeaveRoom = options.onLeaveRoom || null;
    this.onSetGameMode = options.onSetGameMode || null;
    this.onSetTeam = options.onSetTeam || null;
    this.onStartMatch = options.onStartMatch || null;
    this.onReturnToLobby = options.onReturnToLobby || null;

    this.container = document.getElementById('hud-overlay');

    // Default username generator
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    this.defaultUsername = localStorage.getItem('breachers_username') || `Operator_${randomSuffix}`;

    this.hitmarkerTimeout = null;
    this.vignetteTimeout = null;
    this.deathCountdownInterval = null;
    this.currentRoomState = null;
    this.localPlayerId = null;

    this.initHUD();
  }

  initHUD() {
    this.container.innerHTML = `
      <!-- Damage Vignette Effect -->
      <div id="damage-vignette" class="damage-vignette"></div>

      <!-- Crosshair System -->
      <div id="crosshair-container">
        <div class="crosshair-part crosshair-top"></div>
        <div class="crosshair-part crosshair-bottom"></div>
        <div class="crosshair-part crosshair-left"></div>
        <div class="crosshair-part crosshair-right"></div>
        <div class="crosshair-dot"></div>
      </div>

      <!-- Hitmarker Feedback -->
      <div id="hitmarker" class="hitmarker-hidden">
        <div class="hm-line hm-tl"></div>
        <div class="hm-line hm-tr"></div>
        <div class="hm-line hm-bl"></div>
        <div class="hm-line hm-br"></div>
      </div>

      <!-- Floating Damage Numbers Container -->
      <div id="damage-numbers-layer"></div>

      <!-- Top Header / Sector & Match Score Bar -->
      <header class="hud-top">
        <div class="arena-tag">
          <span class="arena-badge">ARENA</span>
          <span class="arena-name">CONTAINER YARD — SECTOR 04</span>
        </div>

        <!-- Center Match Scoreboard Bar (Visible during match) -->
        <div id="match-score-bar" class="match-score-bar hidden">
          <div id="score-team-red" class="team-score red">
            <span class="team-label">RED</span>
            <span id="score-red-val" class="score-val">0</span>
          </div>
          <div class="match-meta-center">
            <span id="match-mode-label" class="match-mode-label">TDM (30)</span>
            <span id="match-timer-val" class="match-timer-val">10:00</span>
          </div>
          <div id="score-team-blue" class="team-score blue">
            <span id="score-blue-val" class="score-val">0</span>
            <span class="team-label">BLUE</span>
          </div>
        </div>

        <div class="hud-top-right">
          <div id="room-code-badge" class="hud-pill hidden">
            <span class="indicator-dot online"></span>
            <span id="room-code-badge-text">ROOM: ------</span>
          </div>
          <div id="player-count-badge" class="hud-pill online">
            <span class="indicator-dot"></span>
            <span id="player-count-text">PLAYERS ONLINE: 1</span>
          </div>
          <div id="net-status-badge" class="hud-pill connecting">
            <span class="indicator-dot"></span>
            <span id="net-status-text">WS: DISCONNECTED</span>
          </div>
          <div id="fps-counter" class="hud-pill">FPS: --</div>
        </div>
      </header>

      <!-- Kill Feed (Top Right beneath header) -->
      <div id="kill-feed-container" class="kill-feed-container"></div>

      <!-- Interactive Crosshair Hover & Pickup Prompt -->
      <div id="interaction-prompt-container" class="interaction-prompt hidden">
        <span id="interaction-prompt-text" class="prompt-text">[E] PICK UP AMMO</span>
      </div>

      <!-- Gameplay Toasts -->
      <div id="ammo-alert-toast" class="gameplay-toast alert hidden">
        <span class="toast-icon">📦</span>
        <span class="toast-text">AMMO DROPPED NEARBY</span>
      </div>

      <div id="ammo-collected-toast" class="gameplay-toast collected hidden">
        <span class="toast-icon">⚡</span>
        <span id="ammo-collected-text" class="toast-text">AMMO COLLECTED +30</span>
      </div>

      <div id="bounce-boost-toast" class="gameplay-toast bounce hidden">
        <span class="toast-icon">🚀</span>
        <span class="toast-text">BOUNCE BOOST!</span>
      </div>

      <div id="breach-bonus-toast" class="gameplay-toast breach hidden">
        <span class="toast-icon">💥</span>
        <div class="toast-content">
          <span class="toast-title">BREACH BONUS!</span>
          <span class="toast-sub">+100 PTS • BARREL DETONATION</span>
        </div>
      </div>

      <!-- Live Tab Scoreboard Overlay -->
      <div id="tab-scoreboard-overlay" class="tab-scoreboard-overlay hidden">
        <div class="tab-scoreboard-card">
          <div class="tab-scoreboard-header">
            <div class="tab-title">OPERATIONAL SCOREBOARD</div>
            <div class="tab-meta">
              <span id="tab-room-code">ROOM: PUBLIC</span> •
              <span id="tab-mode">TDM</span> •
              <span id="tab-time-left">10:00</span>
            </div>
          </div>
          <div id="tab-scores-row" class="tab-scores-row">
            <div class="tab-team-score red">RED TEAM: <span id="tab-red-score">0</span></div>
            <div class="tab-team-score blue">BLUE TEAM: <span id="tab-blue-score">0</span></div>
          </div>
          <table class="tab-score-table">
            <thead>
              <tr>
                <th>OPERATOR</th>
                <th>TEAM</th>
                <th>KILLS</th>
                <th>DEATHS</th>
                <th>K/D</th>
              </tr>
            </thead>
            <tbody id="tab-score-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- 5-Second Spawn Shield Notification Banner (Mandatory Requirement B) -->
      <div id="spawn-shield-banner" class="spawn-shield-banner hidden">
        <div class="shield-icon">🛡️</div>
        <div class="shield-text">
          <span class="shield-title">SPAWN PROTECTION ACTIVE</span>
          <span class="shield-sub">WEAPONS LOCKED • <span id="shield-timer-val">5.0</span>s</span>
        </div>
      </div>

      <!-- Bottom HUD: Health and Weapon Ammo -->
      <footer class="hud-bottom">
        <!-- Health Group -->
        <div class="health-group">
          <div class="stat-label">
            <span>OPERATOR HEALTH</span>
            <span id="health-value" class="stat-num">100</span>
          </div>
          <div class="health-bar-track">
            <div id="health-bar-fill" class="health-bar-fill"></div>
          </div>
        </div>

        <!-- Weapon & Ammo Group -->
        <div class="weapon-group">
          <!-- Weapon Slot Switcher Badges -->
          <div class="weapon-slot-bar">
            <div id="slot-badge-1" class="slot-badge active"><span class="badge-num">1</span> AR</div>
            <div id="slot-badge-2" class="slot-badge"><span class="badge-num">2</span> TAC-9</div>
            <div id="slot-badge-3" class="slot-badge"><span class="badge-num">3</span> KNIFE</div>
          </div>

          <div class="weapon-meta">
            <span id="weapon-type-badge" class="weapon-type">SLOT 1 • PRIMARY</span>
            <span id="weapon-name" class="weapon-name">BREACHER-V1 (ASSAULT)</span>
          </div>
          <div class="ammo-display">
            <span id="ammo-clip" class="ammo-clip">30</span>
            <span class="ammo-slash">/</span>
            <span id="ammo-reserve" class="ammo-reserve">90</span>
          </div>
          <div id="reload-indicator" class="reload-indicator hidden">RELOADING...</div>
        </div>
      </footer>

      <!-- Death & Respawn Screen -->
      <div id="death-overlay" class="death-overlay hidden">
        <div class="death-card">
          <div class="death-title">ELIMINATED</div>
          <div class="death-killer-info">
            KILLED BY <span id="death-killer-name" class="killer-name">ENEMY</span> WITH <span id="death-weapon-name" class="killer-weapon">WEAPON</span>
          </div>
          <div class="respawn-timer-container">
            RESPAWNING IN <span id="death-timer" class="respawn-seconds">3</span>s
          </div>
        </div>
      </div>

      <!-- Match End Screen Overlay -->
      <div id="match-end-overlay" class="match-end-overlay hidden">
        <div class="match-end-card">
          <div class="match-end-badge">MATCH CONCLUDED</div>
          <h1 id="match-winner-title" class="match-winner-title">RED TEAM WINS</h1>
          <p id="match-end-reason" class="match-end-reason">Score limit reached (30 Kills)</p>

          <div class="match-end-scores">
            <div class="end-score-box red">
              <span class="end-score-label">RED TEAM</span>
              <span id="end-red-score" class="end-score-num">30</span>
            </div>
            <div class="end-score-divider">VS</div>
            <div class="end-score-box blue">
              <span class="end-score-label">BLUE TEAM</span>
              <span id="end-blue-score" class="end-score-num">22</span>
            </div>
          </div>

          <!-- Final Leaderboard Table -->
          <div class="leaderboard-table-container">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>OPERATOR</th>
                  <th>TEAM</th>
                  <th>KILLS</th>
                  <th>DEATHS</th>
                  <th>SCORE</th>
                </tr>
              </thead>
              <tbody id="leaderboard-tbody">
              </tbody>
            </table>
          </div>

          <button id="btn-return-lobby" class="btn-deploy" type="button">
            RETURN TO LOBBY
          </button>
        </div>
      </div>

      <!-- Tactical Pause / Lobby / Deploy Screen -->
      <div id="pause-screen" class="pause-screen hidden">
        <div class="pause-card">
          <div class="brand-title">BREACHERS<span class="accent">.IO</span></div>
          <div class="badge-pill">CHUNK 4 — PRIVATE ROOMS • TDM • FFA</div>

          <!-- Error Alert Banner -->
          <div id="lobby-error-banner" class="lobby-error-banner hidden"></div>

          <!-- Top Callsign Row -->
          <div class="form-row callsign-row">
            <label for="input-username">OPERATOR CALLSIGN</label>
            <input id="input-username" type="text" maxlength="16" value="${this.defaultUsername}" placeholder="Enter callsign..." autocomplete="off" />
          </div>

          <!-- VIEW 1: Main Menu Mode / Room Selection -->
          <div id="panel-menu" class="lobby-panel">
            <div class="menu-action-grid">
              <button id="btn-deploy-public" class="btn-menu-action primary" type="button">
                <span class="btn-icon">⚡</span>
                <span class="btn-title">QUICK PLAY</span>
                <span class="btn-desc">Instant Container Yard Combat</span>
              </button>

              <button id="btn-create-room" class="btn-menu-action" type="button">
                <span class="btn-icon">🔒</span>
                <span class="btn-title">CREATE PRIVATE ROOM</span>
                <span class="btn-desc">Host TDM or FFA Match</span>
              </button>
            </div>

            <!-- Join by Code Input Box -->
            <div class="join-code-box">
              <input id="input-join-code" type="text" maxlength="6" placeholder="ENTER 6-CHAR ROOM CODE" autocomplete="off" />
              <button id="btn-join-room" class="btn-secondary" type="button">JOIN ROOM</button>
            </div>

            <!-- Controls Guide -->
            <div class="controls-guide">
              <div class="ctrl-row"><span>WASD</span><span>Move & Slide</span></div>
              <div class="ctrl-row"><span>Mouse</span><span>Aim & Look</span></div>
              <div class="ctrl-row"><span>Left Click</span><span>Fire / Melee Attack</span></div>
              <div class="ctrl-row"><span>1, 2, 3</span><span>Select Assault / Pistol / Knife</span></div>
              <div class="ctrl-row"><span>R</span><span>Reload Firearm</span></div>
              <div class="ctrl-row"><span>Esc</span><span>Pause / Unlock Mouse</span></div>
            </div>
          </div>

          <!-- VIEW 2: Private Room Lobby Panel -->
          <div id="panel-room-lobby" class="lobby-panel hidden">
            <div class="room-header-row">
              <div class="room-code-tag">
                <span class="tag-label">ROOM CODE:</span>
                <span id="room-code-display" class="tag-code">------</span>
                <button id="btn-copy-code" class="btn-copy" type="button" title="Copy Room Code">COPY</button>
              </div>

              <!-- Mode Selection (Host Only) -->
              <div class="room-mode-selector">
                <span class="tag-label">MODE:</span>
                <button id="btn-mode-tdm" class="btn-mode active" type="button">TDM (30)</button>
                <button id="btn-mode-ffa" class="btn-mode" type="button">FFA (20)</button>
              </div>
            </div>

            <!-- TDM Rosters Container -->
            <div id="tdm-rosters-container" class="tdm-rosters-grid">
              <div class="team-roster red">
                <div class="roster-header">
                  <span class="roster-title">RED TEAM (<span id="count-red">0</span>/5)</span>
                  <button id="btn-join-red" class="btn-join-team red" type="button">JOIN RED</button>
                </div>
                <div id="roster-list-red" class="roster-player-list"></div>
              </div>

              <div class="team-roster blue">
                <div class="roster-header">
                  <span class="roster-title">BLUE TEAM (<span id="count-blue">0</span>/5)</span>
                  <button id="btn-join-blue" class="btn-join-team blue" type="button">JOIN BLUE</button>
                </div>
                <div id="roster-list-blue" class="roster-player-list"></div>
              </div>
            </div>

            <!-- FFA Rosters Container -->
            <div id="ffa-rosters-container" class="ffa-rosters-box hidden">
              <div class="roster-header">
                <span class="roster-title">SOLO OPERATORS (<span id="count-ffa">0</span>/10)</span>
              </div>
              <div id="roster-list-ffa" class="roster-player-list ffa"></div>
            </div>

            <div class="room-actions-bar">
              <button id="btn-start-match" class="btn-deploy" type="button">START MATCH</button>
              <button id="btn-leave-room" class="btn-secondary" type="button">LEAVE ROOM</button>
            </div>
            <div id="lobby-wait-text" class="lobby-wait-text hidden">Waiting for room host to start match...</div>
          </div>
        </div>
      </div>
    `;

    // Cache elements
    this.crosshairContainer = document.getElementById('crosshair-container');
    this.hitmarker = document.getElementById('hitmarker');
    this.damageLayer = document.getElementById('damage-numbers-layer');
    this.damageVignette = document.getElementById('damage-vignette');
    this.killFeedContainer = document.getElementById('kill-feed-container');

    this.spawnShieldBanner = document.getElementById('spawn-shield-banner');
    this.shieldTimerVal = document.getElementById('shield-timer-val');

    this.matchScoreBar = document.getElementById('match-score-bar');
    this.scoreRedVal = document.getElementById('score-red-val');
    this.scoreBlueVal = document.getElementById('score-blue-val');
    this.matchModeLabel = document.getElementById('match-mode-label');
    this.matchTimerVal = document.getElementById('match-timer-val');

    this.healthValue = document.getElementById('health-value');
    this.healthBarFill = document.getElementById('health-bar-fill');

    this.slotBadge1 = document.getElementById('slot-badge-1');
    this.slotBadge2 = document.getElementById('slot-badge-2');
    this.slotBadge3 = document.getElementById('slot-badge-3');
    this.weaponTypeBadge = document.getElementById('weapon-type-badge');
    this.weaponName = document.getElementById('weapon-name');
    this.ammoClip = document.getElementById('ammo-clip');
    this.ammoReserve = document.getElementById('ammo-reserve');
    this.reloadIndicator = document.getElementById('reload-indicator');

    this.deathOverlay = document.getElementById('death-overlay');
    this.deathKillerName = document.getElementById('death-killer-name');
    this.deathWeaponName = document.getElementById('death-weapon-name');
    this.deathTimer = document.getElementById('death-timer');

    this.matchEndOverlay = document.getElementById('match-end-overlay');
    this.matchWinnerTitle = document.getElementById('match-winner-title');
    this.matchEndReason = document.getElementById('match-end-reason');
    this.endRedScore = document.getElementById('end-red-score');
    this.endBlueScore = document.getElementById('end-blue-score');
    this.leaderboardTbody = document.getElementById('leaderboard-tbody');
    this.btnReturnLobby = document.getElementById('btn-return-lobby');

    this.fpsCounter = document.getElementById('fps-counter');
    this.pauseScreen = document.getElementById('pause-screen');
    this.inputUsername = document.getElementById('input-username');
    this.netStatusBadge = document.getElementById('net-status-badge');
    this.netStatusText = document.getElementById('net-status-text');
    this.playerCountText = document.getElementById('player-count-text');
    this.roomCodeBadge = document.getElementById('room-code-badge');
    this.roomCodeBadgeText = document.getElementById('room-code-badge-text');

    // Lobby Elements
    this.lobbyErrorBanner = document.getElementById('lobby-error-banner');
    this.panelMenu = document.getElementById('panel-menu');
    this.panelRoomLobby = document.getElementById('panel-room-lobby');
    this.btnDeployPublic = document.getElementById('btn-deploy-public');
    this.btnCreateRoom = document.getElementById('btn-create-room');
    this.inputJoinCode = document.getElementById('input-join-code');
    this.btnJoinRoom = document.getElementById('btn-join-room');

    this.roomCodeDisplay = document.getElementById('room-code-display');
    this.btnCopyCode = document.getElementById('btn-copy-code');
    this.btnModeTdm = document.getElementById('btn-mode-tdm');
    this.btnModeFfa = document.getElementById('btn-mode-ffa');
    this.tdmRostersContainer = document.getElementById('tdm-rosters-container');
    this.ffaRostersContainer = document.getElementById('ffa-rosters-container');
    this.countRed = document.getElementById('count-red');
    this.countBlue = document.getElementById('count-blue');
    this.countFfa = document.getElementById('count-ffa');
    this.rosterListRed = document.getElementById('roster-list-red');
    this.rosterListBlue = document.getElementById('roster-list-blue');
    this.rosterListFfa = document.getElementById('roster-list-ffa');
    this.btnJoinRed = document.getElementById('btn-join-red');
    this.btnJoinBlue = document.getElementById('btn-join-blue');
    this.btnStartMatch = document.getElementById('btn-start-match');
    this.btnLeaveRoom = document.getElementById('btn-leave-room');
    this.lobbyWaitText = document.getElementById('lobby-wait-text');

    // Chunk 8 Elements
    this.killFeedContainer = document.getElementById('kill-feed-container');
    this.interactionPromptContainer = document.getElementById('interaction-prompt-container');
    this.interactionPromptText = document.getElementById('interaction-prompt-text');
    this.ammoAlertToast = document.getElementById('ammo-alert-toast');
    this.ammoCollectedToast = document.getElementById('ammo-collected-toast');
    this.ammoCollectedText = document.getElementById('ammo-collected-text');
    this.bounceBoostToast = document.getElementById('bounce-boost-toast');
    this.breachBonusToast = document.getElementById('breach-bonus-toast');
    this.tabScoreboardOverlay = document.getElementById('tab-scoreboard-overlay');
    this.tabRoomCode = document.getElementById('tab-room-code');
    this.tabMode = document.getElementById('tab-mode');
    this.tabTimeLeft = document.getElementById('tab-time-left');
    this.tabScoresRow = document.getElementById('tab-scores-row');
    this.tabRedScore = document.getElementById('tab-red-score');
    this.tabBlueScore = document.getElementById('tab-blue-score');
    this.tabScoreTbody = document.getElementById('tab-score-tbody');

    this.initEventListeners();
  }

  initEventListeners() {
    this.btnDeployPublic.addEventListener('click', () => {
      const username = this.getUsername();
      localStorage.setItem('breachers_username', username);
      if (this.onPlayClick) this.onPlayClick(username);
    });

    this.btnCreateRoom.addEventListener('click', () => {
      const username = this.getUsername();
      localStorage.setItem('breachers_username', username);
      if (this.onCreateRoom) this.onCreateRoom(username, 'TDM');
    });

    this.btnJoinRoom.addEventListener('click', () => {
      const username = this.getUsername();
      const code = (this.inputJoinCode.value || '').trim();
      if (!code) {
        this.showError('Please enter a 6-character room code.');
        return;
      }
      localStorage.setItem('breachers_username', username);
      if (this.onJoinRoom) this.onJoinRoom(code, username);
    });

    this.inputJoinCode.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        this.btnJoinRoom.click();
      }
    });

    this.btnCopyCode.addEventListener('click', () => {
      if (this.currentRoomState && this.currentRoomState.roomCode) {
        navigator.clipboard.writeText(this.currentRoomState.roomCode).then(() => {
          this.btnCopyCode.textContent = 'COPIED!';
          setTimeout(() => {
            this.btnCopyCode.textContent = 'COPY';
          }, 1500);
        });
      }
    });

    this.btnModeTdm.addEventListener('click', () => {
      if (this.onSetGameMode) this.onSetGameMode('TDM');
    });

    this.btnModeFfa.addEventListener('click', () => {
      if (this.onSetGameMode) this.onSetGameMode('FFA');
    });

    this.btnJoinRed.addEventListener('click', () => {
      if (this.onSetTeam) this.onSetTeam('RED');
    });

    this.btnJoinBlue.addEventListener('click', () => {
      if (this.onSetTeam) this.onSetTeam('BLUE');
    });

    this.btnStartMatch.addEventListener('click', () => {
      if (this.onStartMatch) this.onStartMatch();
    });

    this.btnLeaveRoom.addEventListener('click', () => {
      if (this.onLeaveRoom) this.onLeaveRoom();
      this.showMenuPanel();
    });

    this.btnReturnLobby.addEventListener('click', () => {
      this.matchEndOverlay.classList.add('hidden');
      if (this.onReturnToLobby) this.onReturnToLobby();
    });
  }

  showError(msg) {
    if (!this.lobbyErrorBanner) return;
    this.lobbyErrorBanner.textContent = msg;
    this.lobbyErrorBanner.classList.remove('hidden');
    setTimeout(() => {
      this.lobbyErrorBanner.classList.add('hidden');
    }, 4000);
  }

  showMenuPanel() {
    this.panelMenu.classList.remove('hidden');
    this.panelRoomLobby.classList.add('hidden');
    this.roomCodeBadge.classList.add('hidden');
    this.matchScoreBar.classList.add('hidden');
  }

  showRoomLobbyPanel() {
    this.panelMenu.classList.add('hidden');
    this.panelRoomLobby.classList.remove('hidden');
  }

  updateRoomState(roomState, localPlayerId) {
    this.currentRoomState = roomState;
    this.localPlayerId = localPlayerId || this.localPlayerId;

    if (!roomState || roomState.roomCode === 'PUBLIC') {
      this.showMenuPanel();
      return;
    }

    this.showRoomLobbyPanel();
    this.roomCodeDisplay.textContent = roomState.roomCode;
    this.roomCodeBadgeText.textContent = `ROOM: ${roomState.roomCode}`;
    this.roomCodeBadge.classList.remove('hidden');

    const isHost = this.localPlayerId && this.localPlayerId === roomState.hostId;
    const isTdm = roomState.mode === 'TDM';

    // Mode buttons state
    this.btnModeTdm.classList.toggle('active', isTdm);
    this.btnModeFfa.classList.toggle('active', !isTdm);
    this.btnModeTdm.disabled = !isHost;
    this.btnModeFfa.disabled = !isHost;

    if (isTdm) {
      this.tdmRostersContainer.classList.remove('hidden');
      this.ffaRostersContainer.classList.add('hidden');
    } else {
      this.tdmRostersContainer.classList.add('hidden');
      this.ffaRostersContainer.classList.remove('hidden');
    }

    // Host controls
    if (isHost) {
      this.btnStartMatch.classList.remove('hidden');
      this.lobbyWaitText.classList.add('hidden');
    } else {
      this.btnStartMatch.classList.add('hidden');
      this.lobbyWaitText.classList.remove('hidden');
    }

    // Render players in roster
    const players = roomState.players || [];
    let redPlayers = [];
    let bluePlayers = [];

    this.rosterListRed.innerHTML = '';
    this.rosterListBlue.innerHTML = '';
    this.rosterListFfa.innerHTML = '';

    players.forEach(p => {
      const isMe = p.id === this.localPlayerId;
      const el = document.createElement('div');
      el.className = `roster-player-item ${isMe ? 'is-me' : ''}`;
      el.innerHTML = `
        <span class="player-name">${p.username} ${p.isHost ? '<span class="host-tag">HOST</span>' : ''} ${isMe ? '<span class="you-tag">(YOU)</span>' : ''}</span>
        <span class="player-stats">${p.kills}K / ${p.deaths}D</span>
      `;

      if (isTdm) {
        if (p.team === 'RED') {
          redPlayers.push(p);
          this.rosterListRed.appendChild(el);
        } else {
          bluePlayers.push(p);
          this.rosterListBlue.appendChild(el);
        }
      } else {
        this.rosterListFfa.appendChild(el);
      }
    });

    this.countRed.textContent = redPlayers.length;
    this.countBlue.textContent = bluePlayers.length;
    this.countFfa.textContent = players.length;

    // In-game score bar updates
    if (roomState.status === 'IN_PROGRESS') {
      this.matchScoreBar.classList.remove('hidden');
      this.matchModeLabel.textContent = `${roomState.mode} (${roomState.killLimit})`;
      this.scoreRedVal.textContent = roomState.redScore;
      this.scoreBlueVal.textContent = roomState.blueScore;

      const min = Math.floor(roomState.timeRemainingSec / 60);
      const sec = roomState.timeRemainingSec % 60;
      this.matchTimerVal.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    } else {
      this.matchScoreBar.classList.add('hidden');
    }
  }

  updateScore(redScore, blueScore, killsMap, deathsMap) {
    if (this.scoreRedVal) this.scoreRedVal.textContent = redScore;
    if (this.scoreBlueVal) this.scoreBlueVal.textContent = blueScore;
  }

  showMatchEnded(winner, reason, redScore, blueScore, leaderboard) {
    if (!this.matchEndOverlay) return;

    let title = 'VICTORY';
    if (winner === 'RED') title = 'RED TEAM WINS!';
    else if (winner === 'BLUE') title = 'BLUE TEAM WINS!';
    else if (winner === 'TIE') title = 'MATCH TIED!';
    else title = `${winner} WINS!`;

    this.matchWinnerTitle.textContent = title;
    this.matchEndReason.textContent = reason || 'Match concluded';
    this.endRedScore.textContent = redScore;
    this.endBlueScore.textContent = blueScore;

    this.leaderboardTbody.innerHTML = '';
    (leaderboard || []).forEach((entry, idx) => {
      const row = document.createElement('tr');
      row.className = entry.team ? `team-${entry.team.toLowerCase()}` : '';
      row.innerHTML = `
        <td>#${idx + 1}</td>
        <td><strong>${entry.username}</strong></td>
        <td>${entry.team || 'SOLO'}</td>
        <td>${entry.kills}</td>
        <td>${entry.deaths}</td>
        <td><strong>${entry.score}</strong></td>
      `;
      this.leaderboardTbody.appendChild(row);
    });

    this.matchEndOverlay.classList.remove('hidden');
  }

  updateSpawnShield(remainingSec) {
    if (!this.spawnShieldBanner) return;
    this.spawnShieldBanner.classList.remove('hidden');
    this.shieldTimerVal.textContent = remainingSec.toFixed(1);
  }

  hideSpawnShield() {
    if (!this.spawnShieldBanner) return;
    this.spawnShieldBanner.classList.add('hidden');
  }

  getUsername() {
    if (!this.inputUsername) return this.defaultUsername;
    const val = this.inputUsername.value.trim();
    return val.length >= 2 ? val : this.defaultUsername;
  }

  setPaused(isPaused) {
    if (isPaused) {
      this.pauseScreen.classList.remove('hidden');
    } else {
      this.pauseScreen.classList.add('hidden');
    }
  }

  setFps(fps) {
    if (this.fpsCounter) {
      this.fpsCounter.textContent = `FPS: ${fps}`;
    }
  }

  setNetworkStatus(status, playerId = null) {
    let label = 'DISCONNECTED';
    let className = 'disconnected';

    if (status === 'connected') {
      label = playerId ? `CONNECTED (${playerId})` : 'CONNECTED';
      className = 'online';
      if (playerId) this.localPlayerId = playerId;
    } else if (status === 'connecting') {
      label = 'CONNECTING...';
      className = 'connecting';
    } else if (status === 'error') {
      label = 'ERROR';
      className = 'error';
    }

    if (this.netStatusBadge) {
      this.netStatusBadge.className = `hud-pill ${className}`;
    }
    if (this.netStatusText) {
      this.netStatusText.textContent = `WS: ${label}`;
    }
  }

  setPlayerCount(count) {
    const text = `PLAYERS ONLINE: ${count}`;
    if (this.playerCountText) {
      this.playerCountText.textContent = text;
    }
  }

  updateHealth(current, max = 100) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    this.healthValue.textContent = Math.round(current);
    this.healthBarFill.style.width = `${pct}%`;

    if (pct > 50) {
      this.healthBarFill.style.background = 'linear-gradient(90deg, #00ff88, #00d672)';
      this.healthBarFill.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.5)';
    } else if (pct > 25) {
      this.healthBarFill.style.background = 'linear-gradient(90deg, #ffaa00, #ff8800)';
      this.healthBarFill.style.boxShadow = '0 0 10px rgba(255, 170, 0, 0.5)';
    } else {
      this.healthBarFill.style.background = 'linear-gradient(90deg, #ff3344, #d92030)';
      this.healthBarFill.style.boxShadow = '0 0 10px rgba(255, 51, 68, 0.7)';
    }
  }

  updateWeaponDisplay(state) {
    if (!state) return;

    if (this.weaponName) this.weaponName.textContent = state.name;
    if (this.ammoClip) this.ammoClip.textContent = state.clip;
    if (this.ammoReserve) this.ammoReserve.textContent = state.reserve;

    // Slot badge highlight
    if (this.slotBadge1) this.slotBadge1.classList.toggle('active', state.slot === 1);
    if (this.slotBadge2) this.slotBadge2.classList.toggle('active', state.slot === 2);
    if (this.slotBadge3) this.slotBadge3.classList.toggle('active', state.slot === 3);

    if (this.weaponTypeBadge) {
      if (state.slot === 1) this.weaponTypeBadge.textContent = 'SLOT 1 • PRIMARY AR';
      else if (state.slot === 2) this.weaponTypeBadge.textContent = 'SLOT 2 • SECONDARY TAC-9';
      else this.weaponTypeBadge.textContent = 'SLOT 3 • MELEE KNIFE';
    }

    if (this.reloadIndicator) {
      if (state.isReloading) {
        this.reloadIndicator.classList.remove('hidden');
      } else {
        this.reloadIndicator.classList.add('hidden');
      }
    }
  }

  triggerCrosshairBloom() {
    if (!this.crosshairContainer) return;
    this.crosshairContainer.classList.add('bloom');
    setTimeout(() => {
      this.crosshairContainer.classList.remove('bloom');
    }, 80);
  }

  showHitmarker(isHeadshot = false) {
    if (!this.hitmarker) return;

    if (this.hitmarkerTimeout) {
      clearTimeout(this.hitmarkerTimeout);
    }

    this.hitmarker.className = isHeadshot ? 'hitmarker-active headshot' : 'hitmarker-active';

    this.hitmarkerTimeout = setTimeout(() => {
      this.hitmarker.className = 'hitmarker-hidden';
    }, 120);
  }

  showDamageNumber(damage, isHeadshot, screenX, screenY) {
    if (!this.damageLayer) return;

    const el = document.createElement('div');
    el.className = isHeadshot ? 'dmg-number headshot' : 'dmg-number';
    el.textContent = `${isHeadshot ? 'CRIT ' : ''}${damage}`;
    el.style.left = `${screenX + (Math.random() - 0.5) * 40}px`;
    el.style.top = `${screenY - 20 + (Math.random() - 0.5) * 20}px`;

    this.damageLayer.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 700);
  }

  flashDamageVignette() {
    if (!this.damageVignette) return;
    if (this.vignetteTimeout) clearTimeout(this.vignetteTimeout);

    this.damageVignette.classList.add('flash');
    this.vignetteTimeout = setTimeout(() => {
      this.damageVignette.classList.remove('flash');
    }, 300);
  }

  addKillFeedEntry(killer, victim, weapon) {
    if (!this.killFeedContainer) return;

    const entry = document.createElement('div');
    entry.className = 'kill-feed-entry';

    let iconText = '🔫';
    if (weapon === 'KNIFE') iconText = '🔪';
    else if (weapon === 'PISTOL') iconText = '🎯';

    entry.innerHTML = `
      <span class="kill-killer">${killer}</span>
      <span class="kill-weapon">${iconText} [${weapon}]</span>
      <span class="kill-victim">${victim}</span>
    `;

    this.killFeedContainer.prepend(entry);

    setTimeout(() => {
      entry.classList.add('fade-out');
      setTimeout(() => {
        if (entry.parentNode) {
          entry.parentNode.removeChild(entry);
        }
      }, 500);
    }, 4000);
  }

  showDeathScreen(killer, weapon, countdownSeconds = 3) {
    if (!this.deathOverlay) return;

    this.deathKillerName.textContent = killer || 'UNKNOWN';
    this.deathWeaponName.textContent = weapon || 'WEAPON';
    this.deathTimer.textContent = countdownSeconds;
    this.deathOverlay.classList.remove('hidden');

    if (this.deathCountdownInterval) {
      clearInterval(this.deathCountdownInterval);
    }

    let remaining = countdownSeconds;
    this.deathCountdownInterval = setInterval(() => {
      remaining -= 1;
      if (remaining >= 0) {
        this.deathTimer.textContent = remaining;
      }
      if (remaining <= 0) {
        clearInterval(this.deathCountdownInterval);
      }
    }, 1000);
  }

  hideDeathScreen() {
    if (!this.deathOverlay) return;
    if (this.deathCountdownInterval) {
      clearInterval(this.deathCountdownInterval);
    }
    this.deathOverlay.classList.add('hidden');
  }

  setArenaName(arenaName) {
    const el = this.container ? this.container.querySelector('.arena-name') : null;
    if (el) {
      el.textContent = arenaName;
    }
  }

  show() {
    if (this.container) {
      this.container.classList.remove('hidden');
    }
  }

  hide() {
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }

  // ==========================================
  // Chunk 8 Methods: Kill Feed, Prompts & Scoreboard
  // ==========================================

  /**
   * Add entry to live Kill Feed (Top-Right)
   */
  addKillFeedEntry(killerName, victimName, weapon = 'ASSAULT', isBreachBonus = false, killerTeam = 'NONE', victimTeam = 'NONE') {
    if (!this.killFeedContainer) return;

    const item = document.createElement('div');
    item.className = 'kill-feed-item' + (isBreachBonus ? ' barrel-breach' : '');

    const killerSpan = document.createElement('span');
    killerSpan.className = 'kill-feed-killer' + (killerTeam === 'RED' ? ' team-red' : killerTeam === 'BLUE' ? ' team-blue' : '');
    killerSpan.textContent = killerName || 'Unknown';

    const weaponBadge = document.createElement('span');
    weaponBadge.className = 'kill-feed-weapon';
    if (weapon === 'BARREL') {
      weaponBadge.innerHTML = '💥 BARREL';
    } else if (weapon === 'PISTOL') {
      weaponBadge.innerHTML = '🔫 TAC-9';
    } else if (weapon === 'KNIFE') {
      weaponBadge.innerHTML = '🗡️ KNIFE';
    } else {
      weaponBadge.innerHTML = '🔫 AR';
    }

    const arrow = document.createElement('span');
    arrow.style.color = '#64748b';
    arrow.textContent = '➔';

    const victimSpan = document.createElement('span');
    victimSpan.className = 'kill-feed-victim' + (victimTeam === 'RED' ? ' team-red' : victimTeam === 'BLUE' ? ' team-blue' : '');
    victimSpan.textContent = victimName || 'Enemy';

    item.appendChild(killerSpan);
    item.appendChild(weaponBadge);

    if (isBreachBonus) {
      const breachBadge = document.createElement('span');
      breachBadge.className = 'breach-badge';
      breachBadge.textContent = 'BREACH BONUS';
      item.appendChild(breachBadge);
    }

    item.appendChild(arrow);
    item.appendChild(victimSpan);

    this.killFeedContainer.appendChild(item);

    // Keep up to 5 entries max
    while (this.killFeedContainer.children.length > 5) {
      this.killFeedContainer.removeChild(this.killFeedContainer.children[0]);
    }

    // Auto-remove after 5s with smooth transition
    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateX(40px)';
      setTimeout(() => {
        if (item.parentNode) {
          item.parentNode.removeChild(item);
        }
      }, 400);
    }, 5000);
  }

  showNearbyAmmoAlert() {
    if (!this.ammoAlertToast) return;
    this.ammoAlertToast.classList.remove('hidden');
    clearTimeout(this.ammoAlertTimeout);
    this.ammoAlertTimeout = setTimeout(() => {
      this.ammoAlertToast.classList.add('hidden');
    }, 2000);
  }

  showAmmoCollected(amount, type = 'ASSAULT') {
    if (!this.ammoCollectedToast) return;
    if (this.ammoCollectedText) {
      this.ammoCollectedText.textContent = `AMMO COLLECTED +${amount} (${type})`;
    }
    this.ammoCollectedToast.classList.remove('hidden');
    clearTimeout(this.ammoCollectedTimeout);
    this.ammoCollectedTimeout = setTimeout(() => {
      this.ammoCollectedToast.classList.add('hidden');
    }, 2200);
  }

  showBounceBoost() {
    if (!this.bounceBoostToast) return;
    this.bounceBoostToast.classList.remove('hidden');
    clearTimeout(this.bounceBoostTimeout);
    this.bounceBoostTimeout = setTimeout(() => {
      this.bounceBoostToast.classList.add('hidden');
    }, 1800);
  }

  showBreachBonus(killerName) {
    if (!this.breachBonusToast) return;
    this.breachBonusToast.classList.remove('hidden');
    clearTimeout(this.breachBonusTimeout);
    this.breachBonusTimeout = setTimeout(() => {
      this.breachBonusToast.classList.add('hidden');
    }, 2800);
  }

  showInteractionPrompt(text, type = 'ammo') {
    if (!this.interactionPromptContainer || !this.interactionPromptText) return;
    this.interactionPromptText.textContent = text;
    this.interactionPromptContainer.className = 'interaction-prompt ' + type;
  }

  hideInteractionPrompt() {
    if (!this.interactionPromptContainer) return;
    this.interactionPromptContainer.className = 'interaction-prompt hidden';
  }

  toggleScoreboard(forceState = null) {
    if (!this.tabScoreboardOverlay) return;
    const isVisible = !this.tabScoreboardOverlay.classList.contains('hidden');
    const newState = forceState !== null ? forceState : !isVisible;
    if (newState) {
      this.tabScoreboardOverlay.classList.remove('hidden');
    } else {
      this.tabScoreboardOverlay.classList.add('hidden');
    }
  }

  updateScoreboard(roomState) {
    if (!roomState) return;
    this.currentRoomState = roomState;

    if (this.tabRoomCode) this.tabRoomCode.textContent = `ROOM: ${roomState.roomCode}`;
    if (this.tabMode) this.tabMode.textContent = roomState.mode || 'TDM';
    if (this.tabRedScore) this.tabRedScore.textContent = roomState.redScore || 0;
    if (this.tabBlueScore) this.tabBlueScore.textContent = roomState.blueScore || 0;

    if (this.tabScoreTbody && roomState.players) {
      this.tabScoreTbody.innerHTML = '';
      const isTdm = (roomState.mode || '').toUpperCase() === 'TDM';
      if (this.tabScoresRow) {
        this.tabScoresRow.style.display = isTdm ? 'flex' : 'none';
      }

      // Sort by kills descending
      const sorted = [...roomState.players].sort((a, b) => (b.kills || 0) - (a.kills || 0));

      sorted.forEach(p => {
        const tr = document.createElement('tr');
        const isLocal = p.id === this.localPlayerId || (this.getUsername() && p.username === this.getUsername());
        tr.className = 'tab-score-row' + (isLocal ? ' local-player' : '');

        const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : p.kills.toFixed(1);
        const teamColor = p.team === 'RED' ? '#fca5a5' : p.team === 'BLUE' ? '#93c5fd' : '#e2e8f0';

        tr.innerHTML = `
          <td>${p.username}${p.isHost ? ' 👑' : ''}</td>
          <td style="color: ${teamColor}; font-weight: 700;">${p.team}</td>
          <td style="font-weight: 700; color: #f8fafc;">${p.kills || 0}</td>
          <td style="color: #94a3b8;">${p.deaths || 0}</td>
          <td style="color: #38bdf8;">${kd}</td>
        `;
        this.tabScoreTbody.appendChild(tr);
      });
    }
  }
}
