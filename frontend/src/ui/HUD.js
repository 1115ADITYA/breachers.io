/**
 * HUD
 * Tactical FPS heads-up display managing crosshairs, hitmarkers, health,
 * weapon ammo, damage numbers, and multiplayer connection modal.
 */
export class HUD {
  constructor(options = {}) {
    this.onPlayClick = options.onPlayClick || null;
    this.container = document.getElementById('hud-overlay');

    // Default username generator
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    this.defaultUsername = localStorage.getItem('breachers_username') || `Operator_${randomSuffix}`;

    this.initHUD();
  }

  initHUD() {
    this.container.innerHTML = `
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

      <!-- Top Header / Sector & Multiplayer Session Info -->
      <header class="hud-top">
        <div class="arena-tag">
          <span class="arena-badge">ARENA</span>
          <span class="arena-name">CONTAINER YARD — SECTOR 04</span>
        </div>
        <div class="hud-top-right">
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
          <div class="weapon-meta">
            <span class="weapon-type">PRIMARY</span>
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

      <!-- Multiplayer Deploy & Pause Screen -->
      <div id="pause-screen" class="pause-screen">
        <div class="pause-card">
          <div class="brand-title">BREACHERS<span class="accent">.IO</span></div>
          <div class="badge-pill">CHUNK 2 — REAL-TIME MULTIPLAYER</div>
          <h2>CONTAINER YARD</h2>
          <p class="desc">Spring Boot WebSocket real-time synchronized FPS arena.</p>

          <!-- Connection Panel -->
          <div class="connection-panel">
            <div class="form-row">
              <label for="input-username">OPERATOR CALLSIGN</label>
              <input id="input-username" type="text" maxlength="16" value="${this.defaultUsername}" placeholder="Enter callsign..." autocomplete="off" />
            </div>

            <div class="status-summary">
              <div class="status-row">
                <span class="status-key">NETWORK STATUS:</span>
                <span id="modal-net-status" class="status-val disconnected">Disconnected</span>
              </div>
              <div class="status-row">
                <span class="status-key">ASSIGNED ID:</span>
                <span id="modal-player-id" class="status-val">Not Connected</span>
              </div>
              <div class="status-row">
                <span class="status-key">PLAYERS IN YARD:</span>
                <span id="modal-player-count" class="status-val">1 Player</span>
              </div>
            </div>
          </div>

          <!-- Controls Guide -->
          <div class="controls-guide">
            <div class="ctrl-row"><span>WASD</span><span>Move & Slide</span></div>
            <div class="ctrl-row"><span>Mouse</span><span>Aim & Look</span></div>
            <div class="ctrl-row"><span>Left Click</span><span>Fire Weapon</span></div>
            <div class="ctrl-row"><span>Space</span><span>Jump / Mantle</span></div>
            <div class="ctrl-row"><span>Shift</span><span>Tactical Sprint</span></div>
            <div class="ctrl-row"><span>R</span><span>Reload Weapon</span></div>
            <div class="ctrl-row"><span>Esc</span><span>Pause / Unlock Mouse</span></div>
          </div>

          <button id="btn-deploy" class="btn-deploy" type="button">
            DEPLOY ONLINE
          </button>
        </div>
      </div>
    `;

    // Cache elements
    this.crosshairContainer = document.getElementById('crosshair-container');
    this.hitmarker = document.getElementById('hitmarker');
    this.damageLayer = document.getElementById('damage-numbers-layer');
    this.healthValue = document.getElementById('health-value');
    this.healthBarFill = document.getElementById('health-bar-fill');
    this.weaponName = document.getElementById('weapon-name');
    this.ammoClip = document.getElementById('ammo-clip');
    this.ammoReserve = document.getElementById('ammo-reserve');
    this.reloadIndicator = document.getElementById('reload-indicator');
    this.fpsCounter = document.getElementById('fps-counter');
    this.pauseScreen = document.getElementById('pause-screen');
    this.btnDeploy = document.getElementById('btn-deploy');
    this.inputUsername = document.getElementById('input-username');
    this.netStatusBadge = document.getElementById('net-status-badge');
    this.netStatusText = document.getElementById('net-status-text');
    this.modalNetStatus = document.getElementById('modal-net-status');
    this.modalPlayerId = document.getElementById('modal-player-id');
    this.playerCountText = document.getElementById('player-count-text');
    this.modalPlayerCount = document.getElementById('modal-player-count');

    this.btnDeploy.addEventListener('click', () => {
      const username = this.getUsername();
      localStorage.setItem('breachers_username', username);
      if (this.onPlayClick) {
        this.onPlayClick(username);
      }
    });

    this.hitmarkerTimeout = null;
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
    if (this.modalNetStatus) {
      this.modalNetStatus.textContent = label;
      this.modalNetStatus.className = `status-val ${className}`;
    }
    if (this.modalPlayerId && playerId) {
      this.modalPlayerId.textContent = playerId;
    }
  }

  setPlayerCount(count) {
    const text = `PLAYERS ONLINE: ${count}`;
    if (this.playerCountText) {
      this.playerCountText.textContent = text;
    }
    if (this.modalPlayerCount) {
      this.modalPlayerCount.textContent = `${count} Player${count === 1 ? '' : 's'}`;
    }
  }

  updateHealth(current, max = 100) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    this.healthValue.textContent = Math.round(current);
    this.healthBarFill.style.width = `${pct}%`;

    if (pct > 50) {
      this.healthBarFill.style.background = 'linear-gradient(90deg, #00ff88, #00d672)';
    } else if (pct > 25) {
      this.healthBarFill.style.background = 'linear-gradient(90deg, #ffaa00, #ff8800)';
    } else {
      this.healthBarFill.style.background = 'linear-gradient(90deg, #ff3344, #d92030)';
    }
  }

  updateAmmo(clip, reserve, isReloading = false) {
    this.ammoClip.textContent = clip;
    this.ammoReserve.textContent = reserve;

    if (isReloading) {
      this.reloadIndicator.classList.remove('hidden');
    } else {
      this.reloadIndicator.classList.add('hidden');
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
}
