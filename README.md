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
   - Click **QUICK PLAY** (or create a room).
3. Open Browser Window 2 (or Incognito) at `http://localhost:5173`:
   - Enter callsign `Ghost_Beta`.
   - Click **QUICK PLAY**.
4. Test Combat Interactions:
   - Walk both players into visual contact in the Container Yard.
   - Switch weapons with `1`, `2`, `3`.
   - Fire at each other: observe real-time health bar depletion, red damage screen vignette on the victim, and hitmarkers/floating damage numbers on the shooter.
   - Inflict lethal damage: observe victim elimination, death overlay with 3s countdown, and top-right kill-feed entry.
   - Verify victim respawns with 100 HP, 5s glowing spawn protection shield, and full primary ammunition restored.

---

## Chunk 4 — Private Rooms, Team Deathmatch (TDM) & Free-For-All (FFA)

### 1. Private Room System
- **Create Room**: Generates an isolated room with a unique 6-character alphanumeric room code (e.g., `LBHAF5`). The creator is automatically designated host and assigned to the RED team.
- **Join Room**: Players can enter any 6-character code to join the private session. Server checks for room existence, non-empty codes, and caps room capacity at 10 players.
- **Lobby Management & Host Migration**: Disconnects or host leaves trigger server-side host re-assignment to the next remaining player. When all players leave, the room is safely garbage-collected from in-memory storage.
- **Copy Room Code**: One-click tactical copy button with visual `COPIED!` status feedback.
- **Strict Room Isolation**: All movement updates, weapon shots, combat damage, health updates, and match scores are routed exclusively to players in the same room.

### 2. Game Modes: TDM & Free-For-All
- **Team Deathmatch (TDM)**:
  - 2 balanced teams: **RED** and **BLUE** (max 5 players per team).
  - Kill limit: **30 team kills**; Match duration: **10 minutes** (600 seconds).
  - Server-enforced **friendly fire rejection**: Teammates cannot damage each other.
  - Team switching with server-side capacity validation.
- **Free For All (FFA)**:
  - Solo competition (up to 10 players).
  - Kill limit: **20 individual kills**; Match duration: **10 minutes** (600 seconds).
  - Individual scoreboards and rankings.

### 3. Dedicated Team Spawns & 5-Second Spawn Protection (Mandatory Requirements A & B)
- **Separate Team Spawn Zones**:
  - **Red Team Spawns**: Confined exclusively to West sector ($x \le -44.0\text{ m}$).
  - **Blue Team Spawns**: Confined exclusively to East sector ($x \ge 44.0\text{ m}$).
  - **FFA Neutral Spawns**: Distributed centrally across open cover lanes ($|x| \le 35.0\text{ m}$).
  - Server selects safest candidate spawn point furthest from active enemies to prevent spawn camping.
- **5-Second Spawn Protection**:
  - Applied automatically on initial match spawn and every 3-second respawn.
  - **Offensive Lock**: Protected player cannot fire firearms, attack with knife, or deal damage to opponents.
  - **Invulnerability**: Protected player cannot take damage from any enemy attacks.
  - Reloading and weapon switching remain available.
  - HUD displays a glowing shield icon and countdown banner (`5.0s ... 0.0s`), while remote peers display an ethereal blue protective shield.

### 4. Running Chunk 4 Automated Tests
```powershell
# Maven test suite (25 tests covering rooms, spawns, 5s protection, combat, isolation)
cd backend
$env:JAVA_HOME = "C:\Program Files\Java\jdk-26.0.2"
.\mvnw.cmd test

# Frontend production bundle validation
cd ../frontend
npm run build

# Node E2E multi-client automated test (Room creation, join, TDM match, 5s protection, kill, respawn, lobby return)
node ../scratch/test-chunk4-e2e.mjs

# Node rules test (Friendly-fire rejection, host migration, FFA neutral spawns)
node ../scratch/test-chunk4-tdm-ffa-rules.mjs
```

### 5. Steps to Test Private Rooms with Two Browser Windows
1. Ensure the Spring Boot backend (`http://localhost:8081`) and Vite frontend (`http://localhost:5173`) are running.
2. **Browser Window 1 (Host)**:
   - Navigate to `http://localhost:5173`.
   - Enter callsign `AlphaLeader`.
   - Click **CREATE PRIVATE ROOM**.
   - Note the 6-character room code (e.g., `ABC123`) and click **COPY**.
   - Observe Host status badge, selected mode (`TDM (30)`), and Red team roster card.
3. **Browser Window 2 (Peer / Incognito)**:
   - Navigate to `http://localhost:5173`.
   - Enter callsign `BravoGhost`.
   - Paste the 6-character code into the room code input and click **JOIN ROOM**.
   - Observe automatic team balancing placing `BravoGhost` onto **BLUE TEAM**.
4. **Host Starts Match**:
   - In Browser 1, click **START MATCH**.
   - Both browser screens transition instantly into first-person 3D gameplay.
   - Notice AlphaLeader spawned at West Red base ($x \le -44$) and BravoGhost spawned at East Blue base ($x \ge 44$).
   - Both players see the **SPAWN PROTECTION ACTIVE (5.0s)** banner; attempts to fire while shielded are rejected.
   - Top center scoreboard bar displays `RED 0` vs `0 BLUE` and 10-minute timer countdown.
5. **Combat & Elimination**:
   - After 5 seconds, shield expires and weapon crosshairs unlock.
   - Fire at opponent: notice friendly fire disabled if on same team, and enemy damage registering.
   - Once eliminated, death overlay displays a 3s countdown, score bar updates (`RED 1` vs `0 BLUE`), and eliminated player respawns at their designated team spawn with a renewed 5s shield!
6. **Return to Lobby**:
   - Host clicks **RETURN TO LOBBY** (or upon match conclusion); both players return seamlessly to the tactical lobby ready for the next round without refreshing.

---

## Chunk 5 — Container Yard: Professional Map Visual Overhaul

### 1. Visual Overhaul Features
- **Atmospheric Sky & Lighting**:
  - Procedural atmospheric sky gradient canvas transitioning from deep maritime twilight at zenith (`#090d16`) to industrial dock horizon glow (`#384860`).
  - Subtle depth fog (`0x182030`, density 0.011) that softens distant perimeter boundaries while keeping target silhouettes razor-sharp at 50–70m.
  - Directional sunlight (`0xfff3e5`, 1.45 intensity) casting soft PCF shadows, balanced with a cool sky fill light (`0x38bdf8`) and ambient fill light (`0x161c28`) to eliminate pitch-black nooks.
- **Layered Industrial Ground Surface**:
  - Procedural asphalt and concrete slab ground texture with aggregate speckle, slab expansion seams, weathered oil/dirt patches, painted dashed traffic lines, and yellow container crane guidelines with tactical stencils.
- **Authentic ISO Shipping Containers**:
  - Built with [`ContainerFactory.js`](file:///frontend/src/maps/ContainerFactory.js).
  - High-detail corrugated metal side panels, structural steel corner posts, corner casting blocks with lifting eye holes, roof reinforcement ribs, and double rear cargo doors equipped with vertical locking bars, cam brackets, handles, and stenciled weight/height ratings.
  - Cohesive industrial color palette: rust/burnt orange (`#c2410c`), deep maritime blue (`#1e40af`), tactical green (`#15803d`), crimson red (`#b91c1c`), and storm grey (`#475569`).
  - Clean decoupled AABB physics collision representation (`THREE.Box3`) bounding the outer envelope.
- **Tactical Environmental Props**:
  - Built with [`IndustrialProps.js`](file:///frontend/src/maps/IndustrialProps.js).
  - **Wooden Euro-Pallets**: Multi-slat wooden pallets in single and multi-tier stacks.
  - **Supply Crates**: Stepping-stone wooden and reinforced metal crates with hazard markings allowing parkour access to upper container tiers.
  - **Concrete Jersey Barriers**: Highway barriers with bottom drainage/forklift slots and yellow reflector caps.
  - **Steel Chemical Drums / Barrels**: Fuel and chemical barrels with rolled chime rings and bung caps.
  - **Heavy Vehicle Tire Stacks**: Rubber tire stacks near corners and vehicle bays.
  - **Cable Spools / Wooden Cable Reels**: Round wooden reels with coiled black electrical cables.
  - **Safety Bollards**: High-visibility yellow safety bollards with white reflective collars.
  - **Parked Industrial Forklift**: Low-poly stylized forklift serving as solid cover and landmark in the North loading lane.
- **Architectural Landmarks**:
  - **Warehouse Loading Bay Facade**: North wall features a concrete loading dock platform with yellow hazard ledge and 3 industrial roll-up shutter doors.
  - **Giant Harbor Gantry Cranes**: Exterior skybox features massive 32m maritime gantry cranes with overhead booms, operator cabins, and container spreaders towering outside the perimeter walls.
  - **Perimeter Security Fencing**: Concrete boundary walls topped with hazard trim and industrial chain-link security wire.

### 2. Verification & Performance
- **Zero External Dependencies**: All textures are generated procedurally on startup using HTML5 Canvas (`TextureGenerator.js`), eliminating network latency, CORS failures, and heavy asset downloads.
- **Solid 60+ FPS Performance**: Measured in-browser at **61 to 69 FPS** with smooth player sliding, collision, and raycasting.
- **100% Gameplay & Combat Compatibility**: All existing spawn coordinates, 5-second spawn protection, friendly fire rejection, and hit detection remain intact.




