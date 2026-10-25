# Breachers.io — Browser 3D Multiplayer FPS

A fast-paced browser-based 3D multiplayer first-person shooter inspired by Krunker.io.

## Architecture

The project is structured into two cleanly decoupled services:

```
breachers.io/
├── backend/                  # Java 21 Spring Boot server
│   ├── src/
│   │   ├── main/java/        # Application source code & controllers
│   │   ├── main/resources/   # application.yml configuration
│   │   └── test/java/        # Unit & Integration tests
│   ├── mvnw / mvnw.cmd       # Maven Wrapper
│   └── pom.xml               # Maven dependencies & build setup
├── frontend/                 # Client application
│   ├── src/
│   │   ├── main.js           # Three.js scene & diagnostics
│   │   └── style.css         # HUD styling & UI
│   ├── index.html            # Web entry point
│   ├── package.json          # Node dependencies (Three.js, Vite)
│   └── vite.config.js        # Vite dev server & proxy setup
└── README.md
```

- **Frontend**: JavaScript, Vite, Three.js (WebGL renderer, tactical HUD).
- **Backend**: Java 21, Spring Boot 3.4.x, Spring WebSocket, Maven.
- **Decoupled Architecture**: Frontend and backend configurations are strictly isolated. No backend credentials or internal configs are exposed to the client.

---

## Prerequisites

Ensure you have the following installed on your system:

1. **Java Development Kit (JDK 21 or higher)**
   - Verify with: `java -version`
   - Ensure `JAVA_HOME` environment variable is set to your JDK installation path (e.g. `C:\Program Files\Java\jdk-26.0.2` on Windows).
2. **Node.js (v18.0.0 or higher, v20+ / v24+ recommended)**
   - Verify with: `node -v` and `npm -v`
3. **Maven (Optional - Maven Wrapper included)**
   - Maven wrapper (`mvnw.cmd` on Windows, `./mvnw` on Unix) is bundled in the `backend/` directory.

---

## Getting Started

### 1. Running the Backend (Spring Boot)

Navigate to the `backend` directory:

```bash
cd backend
```

Ensure `JAVA_HOME` is set (if not already globally configured):

**Windows (PowerShell):**
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-26.0.2"
.\mvnw.cmd spring-boot:run
```

**Linux / macOS:**
```bash
export JAVA_HOME=/path/to/jdk-21
./mvnw spring-boot:run
```

The server starts on `http://localhost:8081` (configurable via `SERVER_PORT`, defaulting to `8081` to prevent port collisions on `8080`).

#### Verify Health Endpoint
Open a browser or run:
```bash
curl http://localhost:8081/api/health
```

Expected JSON response:
```json
{
  "status": "UP",
  "service": "breachers-backend",
  "timestamp": "2026-10-25T06:50:21.000Z",
  "version": "0.1.0"
}
```

#### Run Backend Tests & Package
```powershell
.\mvnw.cmd test
.\mvnw.cmd package
```

---

### 2. Running the Frontend (Vite + Three.js)

Open a separate terminal and navigate to the `frontend` directory:

```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```

Open your browser at:
```
http://localhost:5173
```

You will see:
- 3D perspective scene with ambient/directional lighting, ground grid, and rotating tactical geometry rendered via Three.js.
- Realtime FPS indicator.
- Diagnostics panel with live backend ping status verifying CORS and REST connectivity to `http://localhost:8081/api/health`.

#### Build Frontend for Production
```bash
npm run build
```
Production assets are generated in `frontend/dist/`.

---

## Configuration & CORS

- **Backend CORS**: Configured in `backend/src/main/java/io/breachers/config/CorsConfig.java` and `backend/src/main/resources/application.yml`.
  - Allowed origin by default: `http://localhost:5173`, `http://127.0.0.1:5173`.
  - Allowed methods: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`, `PATCH`.
- **Frontend Proxy**: Configured in `frontend/vite.config.js` to proxy `/api` requests to `http://localhost:8081` in local development.

---

## Real-Time Multiplayer (Spring WebSocket)

The multiplayer backend is implemented using native Spring Boot WebSocket support at endpoint:

```
ws://localhost:8081/ws/game
```

### Protocol Overview

1. **Client $\to$ Server**:
   - `JOIN`: `{"type":"JOIN","username":"Operator_Name"}`
   - `MOVE`: `{"type":"MOVE","x":0.0,"y":0.0,"z":0.0,"yaw":1.57,"pitch":0.0,"isMoving":true,"isSprinting":false}` (transmitted at 20Hz)
   - `LEAVE`: `{"type":"LEAVE"}`
   - `PING`: `{"type":"PING"}`
2. **Server $\to$ Client**:
   - `WELCOME`: `{"type":"WELCOME","playerId":"p_xxxxxxxx","username":"Operator_Name","x":...,"y":...,"z":...,"yaw":...,"players":[...]}`
   - `PLAYER_JOINED`: `{"type":"PLAYER_JOINED","player":{...}}`
   - `PLAYER_MOVED`: `{"type":"PLAYER_MOVED","id":"p_xxxxxxxx","x":...,"y":...,"z":...,"yaw":...,"pitch":...,"isMoving":...,"isSprinting":...,"timestamp":...}`
   - `PLAYER_LEFT`: `{"type":"PLAYER_LEFT","id":"p_xxxxxxxx"}`
   - `ERROR`: `{"type":"ERROR","message":"..."}`
   - `PONG`: `{"type":"PONG","timestamp":...}`

### Testing Multiplayer (2+ Clients)

#### Automated Test Suite
To execute the automated 2-client synchronization test (verifies join, snapshot receipt, bidirectional movement replication, and departure broadcast):
```bash
node scratch/test-multiplayer-two-clients.js
```

---

## Chunk 3: Multiplayer Combat System

Chunk 3 implements complete, server-authoritative multiplayer combat across all connected clients.

### Weapon Specifications & Balance Values

| Weapon | Slot | RPM / Fire Rate | Base Damage | Headshot (1.8x) | Magazine / Reserve | Reload Duration | Range | Mode |
|---|---|---|---|---|---|---|---|---|
| **Assault Rifle** (Breacher-V1) | 1 | ~545 RPM (0.11s) | 24 | 43 | 30 / 90 | 1.8s | 120m | Automatic |
| **Pistol** (TAC-9) | 2 | Semi-auto (0.25s) | 38 | 68 | 12 / 36 | 1.4s | 80m | Semi-Automatic |
| **Tactical Knife** | 3 | Melee (0.50s) | 55 | 99 | $\infty$ / — | Instant | 2.5m | Close-Range Melee |

### Combat Controls
- `1`, `2`, `3`: Select Assault Rifle, Pistol, or Knife.
- `Left Click`: Fire firearm or melee attack.
- `R`: Reload firearm.
- `Esc`: Pause / unlock mouse cursor.

### Server-Authoritative Architecture & Hit Validation
All damage calculations, hit validation, ammo consumption, cooldown checks, and death attribution are performed exclusively on the Java 21 Spring Boot backend:
1. **Shot Submission (`SHOOT`)**: The client requests a shot with weapon ID, sequence ID, and ray direction.
2. **Authoritative Origin & Bounds**: The server derives the ray origin from the shooter's verified position $(x, y + 1.62\text{ m}, z)$ and clamps client offsets to within 3m. Rate limits, cooldowns, and ammo availability are strictly enforced.
3. **Ray-Hitbox Intersection**: Target players are modeled with axis-aligned hitboxes $(x \pm 0.55\text{ m}, z \pm 0.55\text{ m}, y \dots y + 1.85\text{ m})$.
4. **Headshot Detection**: Hits where ray intersection $y \ge position.y + 1.40\text{ m}$ inflict a $1.8\times$ critical headshot multiplier.
5. **Spawn Protection & State**: Players enjoy 2 seconds of invulnerability upon spawn/respawn. Eliminated players are placed into a dead state, disabling fire and movement while queuing automated respawn after 3 seconds at a valid map spawn point.
6. **Synchronized Broadcasts**: Confirmed shot impacts (`SHOT_FIRED`), health updates (`HEALTH_UPDATED`), eliminations (`PLAYER_DIED`), respawns (`PLAYER_RESPAWNED`), and global kill-feed notifications (`KILL_FEED`) are broadcast to all clients in real time.

### Automated Combat Test Suite
Run the live end-to-end combat integration tests:
```bash
# Run Pistol combat & respawn flow
node scratch/test-live-combat.mjs

# Run Knife melee attack & Assault Rifle elimination flow
node scratch/test-knife-and-rifle.mjs
```

### Manual Dual-Browser Combat Test
1. Ensure the Spring Boot backend (`:8081`) and Vite frontend (`:5173`) are running.
2. Open Browser Window 1 at `http://localhost:5173`:
   - Enter callsign `Striker_Alpha`.
   - Click **DEPLOY TO COMBAT**.
3. Open Browser Window 2 (or Incognito) at `http://localhost:5173`:
   - Enter callsign `Ghost_Beta`.
   - Click **DEPLOY TO COMBAT**.
4. Test Combat Interactions:
   - Walk both players into visual contact in the Container Yard.
   - Switch weapons with `1`, `2`, `3`.
   - Fire at each other: observe real-time health bar depletion, red damage screen vignette on the victim, and hitmarkers/floating damage numbers on the shooter.
   - Inflict lethal damage: observe victim elimination, death overlay with 3s countdown, and top-right kill-feed entry.
   - Verify victim respawns with 100 HP, 2s glowing spawn protection shield, and full primary ammunition restored.


