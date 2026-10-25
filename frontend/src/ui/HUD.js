/**
 * HUD
 * Tactical FPS heads-up display managing crosshairs, hitmarkers, health,
 * weapon slots, ammo counters, kill feed, damage vignette, and death/respawn modal.
 */
export class HUD {
  constructor(options = {}) {
    this.onPlayClick = options.onPlayClick || null;
    this.container = document.getElementById('hud-overlay');

    // Default username generator
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    this.defaultUsername = localStorage.getItem('breachers_username') || `Operator_${randomSuffix}`;

    this.hitmarkerTimeout = null;
    this.vignetteTimeout = null;
    this.deathCountdownInterval = null;

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

      <!-- Kill Feed (Top Right beneath header) -->
      <div id="kill-feed-container" class="kill-feed-container"></div>

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

      <!-- Multiplayer Deploy & Pause Screen -->
      <div id="pause-screen" class="pause-screen">
        <div class="pause-card">
          <div class="brand-title">BREACHERS<span class="accent">.IO</span></div>
          <div class="badge-pill">CHUNK 3 — MULTIPLAYER COMBAT SYSTEM</div>
          <h2>CONTAINER YARD</h2>
          <p class="desc">Server-authoritative Spring Boot WebSocket tactical FPS arena.</p>

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
            <div class="ctrl-row"><span>Left Click</span><span>Fire / Melee Attack</span></div>
            <div class="ctrl-row"><span>1, 2, 3</span><span>Select Assault / Pistol / Knife</span></div>
            <div class="ctrl-row"><span>R</span><span>Reload Firearm</span></div>
            <div class="ctrl-row"><span>Space / Shift</span><span>Jump / Sprint</span></div>
            <div class="ctrl-row"><span>Esc</span><span>Pause / Unlock Mouse</span></div>
          </div>

          <button id="btn-deploy" class="btn-deploy" type="button">
            DEPLOY TO COMBAT
          </button>
        </div>
      </div>
    `;

    // Cache elements
    this.crosshairContainer = document.getElementById('crosshair-container');
    this.hitmarker = document.getElementById('hitmarker');
    this.damageLayer = document.getElementById('damage-numbers-layer');
    this.damageVignette = document.getElementById('damage-vignette');
    this.killFeedContainer = document.getElementById('kill-feed-container');

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

    // Fade out and remove after 4.5 seconds
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
}
