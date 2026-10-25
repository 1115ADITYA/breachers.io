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

---

## Chunk 6 — Complete Game Frontend + Warehouse GLB Map Integration

### 1. Application State & Navigation Flow
- **Clean Tactical Application Lifecycle**:
  `BOOT -> MAIN MENU -> OPERATORS / LOADOUT / MAPS -> LOBBY -> MATCH LOADING -> GAMEPLAY -> MATCH END -> LOBBY`
- **Zero Auto-Deploy**: The application opens directly into a polished full-screen Main Menu on page load, rather than forcing first-person gameplay immediately.
- **Pointer Lock Safety**: Mouse cursor is completely unlocked in menus and only acquired upon intentional deployment into gameplay.
- **Unified Scene & Single Event Loop**: Reuses the core Three.js WebGL renderer, camera, and collision engine without duplicate render loops, listeners, or socket leaks.

### 2. PUBG-Inspired Main Menu & Presentation
- **Visual Aesthetic**: Sleek dark charcoal (`#0b0f17`) and midnight navy backdrop with restrained tactical orange accents (`#f97316`).
- **Brand Identity**: Original `BREACHERS.IO` logo and official tagline: *"Lock In. Team Up. Breach Out."*
- **Top Navigation Bar**: Direct navigation tabs for `HOME`, `OPERATORS`, `LOADOUT`, `MAPS`, and `SETTINGS`.
- **3D Operative Preview Pedestal**: Interactive Three.js 3D operator model standing on a glowing orange ring deployment platform with click-and-drag 360° rotation controls and breathing animation.
- **Quick Deployment Hub**: Prominent `QUICK PLAY` button, `CREATE PRIVATE ROOM` action, direct 6-character room code joiner, and callsign customization.

### 3. Operator Selection System
- **Operative Classes**:
  1. **Vanguard**: Frontline Assault — Heavy composite armor with maritime spec-ops camo.
  2. **Ghost**: Recon Infiltrator — Carbon-fiber stealth suit with infrared red night vision.
  3. **Stryker**: Desert Operator — Sand dust ballistic gear with amber gold thermal optics.
  4. **Enforcer**: Heavy Pointman — Reinforced olive drab armor with emerald thermal target lock.
- **Material & Camo Variants**: Selectable uniforms (Covert Blackout, Arctic Ghost, Hazard Orange, Desert Dune, etc.).
- **Local Persistence**: Remembers selected operator and camo finish in `localStorage`.

### 4. Weapon Loadout Inspection
- **Authentic Combat Ballistics**: Reads authoritative values directly from [`Weapon.js`](file:///frontend/src/player/Weapon.js):
  - **Breacher-V1 (Assault Rifle)**: 24 base damage (43 headshot 1.8x), 545 RPM, 30/90 capacity, 120m range.
  - **TAC-9 (Pistol)**: 38 base damage (68 headshot 1.8x), 240 RPM, 12/36 capacity, 80m range.
  - **Tactical Trench Knife (Melee)**: 55 base damage (99 headshot 1.8x), 120 RPM, melee range 2.5m.
- **Interactive 3D Armory**: Click `INSPECT 3D VIEW` to preview high-detail 3D viewmodels of weapons with full rotation.

### 5. Modular Map Registry & Selection
- **Modular Registry ([`MapRegistry.js`](file:///frontend/src/maps/MapRegistry.js))**:
  - **Container Yard**: `AVAILABLE` — Open-air shipping container terminal.
  - **Warehouse**: `AVAILABLE` — Low-poly tactical indoor logistics depot.
  - **Desert Outpost**: `COMING SOON` — Disabled military checkpoint.
  - **Urban Streets**: `COMING SOON` — Disabled downtown avenue grid.
- **Guaranteed Active Selection**: Selecting a map card actively changes the scene and terrain that loads when deploying.

### 6. Warehouse GLB Map Integration ([`WarehouseMap.js`](file:///frontend/src/maps/WarehouseMap.js))
- **GLB Model Asset**: `frontend/public/assets/maps/warehouse.glb` (3.41 MB).
- **Transforms & Alignment**:
  - Scaled by `5.2x` and rotated by `90°` around Y axis, aligning the warehouse's 85m length with the West (Red) vs East (Blue) axis.
  - Bottom floor aligned at `Y = 0.0`.
  - Dimensions fit safely within server boundaries ($|X| \le 32m$, $|Z| \le 18m$, $|Y| \le 20m$).
- **Verified Collision System**:
  - Outer perimeter containment walls preventing players from escaping the facility.
  - Solid floor collider preventing falling through ground.
  - Decoupled AABB obstacle colliders for all interior crates, pallets, barrels, and room partitions.
- **Guaranteed Safe Spawns**:
  - Red Spawns (West): Safe positions with $\ge 0.85m$ clearance ($X \in [-28, -25], Z \in [-10, 10]$).
  - Blue Spawns (East): Safe positions with $\ge 0.85m$ clearance ($X \in [20, 28], Z \in [-14, 8]$).
  - FFA Spawns: Distributed across clear floor lanes.
- **Indoor Tactical Lighting**:
  - 4 warm high-bay ceiling point lights (3200K sodium vapor) with visible lamp fixtures.
  - Directional clerestory skylight entering from roof trusses.
  - Cool industrial twilight ambient fill.

### 7. Tactical Settings & Preferences
- Real-time **Master Volume** (0% to 100%).
- Real-time **Look Sensitivity** (0.2x to 3.0x).
- **Graphics Quality Presets** (High, Medium, Low).
- Real-time **FPS Counter Display** toggle.

---

## Academic Demonstration & Realistic Physics (Chunk 7)

### 1. Realistic Game Physics with Rapier 3D WebAssembly

#### Why Rapier Was Selected
- **WebAssembly Performance**: `@dimforge/rapier3d-compat` compiles Rust's high-performance Rapier physics engine to WebAssembly. This delivers deterministic, near-native execution speeds directly inside the browser event loop without the garbage-collection stutters common in pure JavaScript physics engines.
- **Dedicated Kinematic Character Controller**: Rapier provides a first-class `KinematicCharacterController` specifically engineered for FPS games. It natively supports capsule collision sliding, step-handling over low obstacles/curbs (`enableAutostep(0.45, 0.2, true)`), slope sliding without snagging, and ground snapping (`enableSnapToGround(0.35)`).
- **Exact Trimesh Colliders**: Solves the classic "invisible wall" problem by generating exact triangle-mesh colliders from complex GLTF/GLB architectural nodes instead of approximating hollow structures with oversized AABB boxes.

#### Three.js & Physics Synchronization
- The physics world operates on a fixed 60 Hz physics timestep (`dt = 1/60` s) with an accumulator loop in [`main.js`](file:///frontend/src/main.js):
  ```javascript
  physicsWorld.step(deltaTime);
  ```
- **Player Kinematic Capsule**: The player is represented as a vertical capsule (radius `0.45m`, total height `1.8m`). During each frame, [`PlayerController.js`](file:///frontend/src/player/PlayerController.js) calculates desired movement translations and passes them to `physicsWorld.moveCharacter(...)`. The character controller solves contacts against static walls, trimeshes, and dynamic props, returning the collision-resolved translation to update the Three.js camera and audio listener.
- **Dynamic Interactive Props**: Selected tactical props (shipping crates, industrial oil barrels) are instantiated as Rapier dynamic rigid bodies. When shot by bullets ([`Weapon.js`](file:///frontend/src/player/Weapon.js)), ballistic impulses are applied (`applyBulletImpulse(hitPoint, direction, impulse)`), knocking barrels over and sliding crates across the floor. In each physics tick, the dynamic rigid bodies' positions and quaternions are copied directly to their Three.js mesh counterparts.
- **Graceful Fallback**: If WebAssembly fails to compile or load, the client gracefully falls back to the baseline AABB [`CollisionSystem.js`](file:///frontend/src/physics/CollisionSystem.js) with zero crashes.

#### Collision Debugging View (`F3` / `P`)
- A dedicated development visualizer ([`PhysicsDebugger.js`](file:///frontend/src/physics/PhysicsDebugger.js)) extracts wireframe buffers via `world.debugRender()`:
  - Yellow/cyan lines indicate active static and trimesh colliders.
  - White capsule wireframe outlines the player's physical contact volume.
  - Green indicator shows grounded status; magenta shows airborne state.
  - Toggle live in-game by pressing **`F3`** or **`P`**.
  - Automatically disabled by default in production builds.

#### Invisible-Wall Root Cause & Resolution
- **Root Cause**: In the GLB Warehouse model, the node named `room` spans `32.2m x 12.5m x 10.4m`. Generating a bounding box (AABB) around `room` enclosed the entire hollow indoor playable area in a single solid box, blocking doorways and interior corridors with invisible walls.
- **Resolution**: In [`WarehouseMap.js`](file:///frontend/src/maps/WarehouseMap.js), compound structural meshes (`room`, `Cube.004`, `Cube.016`) are converted into exact Rapier Trimesh colliders, allowing players to walk freely through open doors while respecting exterior walls.

---

### 2. Spring Boot JDBC Persistence & SQL Architecture

#### What JDBC Does in the Project
The backend uses Spring Boot's `JdbcTemplate` ([`MatchPersistenceService.java`](file:///backend/src/main/java/io/breachers/persistence/MatchPersistenceService.java)) to provide robust, thread-safe, and parameterized relational persistence for game sessions. High-frequency movement and combat packets remain non-blocking; completed matches are dispatched to a dedicated single-threaded daemon executor that writes match summaries and updates cumulative player career statistics.

#### Relational Database Engine & Schema
- **Database Engine**: Embedded H2 relational database in memory (`jdbc:h2:mem:breachersdb;DB_CLOSE_DELAY=-1`).
- **Data Definition (`schema.sql`)**:
  - `match_history`: Stores completed match records with primary key `match_id` (UUID), room code, game mode (TDM/FFA), winning team/player, match duration in seconds, total kills, completion timestamp, and a JSON summary of participants.
  - `player_statistics`: Stores persistent career stats for operators keyed by `username`, tracking matches played, wins, losses, kills, deaths, headshots, and calculated K/D ratio and win rate percentage.
- **SQL Operations Implemented**:
  - Parameterized `INSERT INTO match_history (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`.
  - Upsert on `player_statistics` (checking existing record via parameterized `SELECT`, followed by `INSERT` or cumulative `UPDATE`).
  - Query for recent matches ordered by `completed_at DESC LIMIT ?`.
  - Query for leaderboard / top career operators ordered by `kills DESC LIMIT ?`.
  - Aggregated global statistics (`COUNT(*)`, `SUM(total_kills)`).

---

### 3. Java Servlet Academic Demonstration

#### Architecture & Registration
To demonstrate traditional Java Enterprise Servlet programming integrated alongside modern Spring Boot architectures, the project includes an explicitly configured HTTP Servlet:
- **Servlet Class**: [`MatchReportServlet.java`](file:///backend/src/main/java/io/breachers/servlet/MatchReportServlet.java) (extends `HttpServlet`).
- **Registration**: Registered via [`ServletRegistrationBean`](file:///backend/src/main/java/io/breachers/config/AcademicServletConfig.java) at `/academic/match-report`.
- **Service Access**: Directly wired with `MatchPersistenceService` via Spring dependency injection.

#### Endpoints & Formats
1. **HTML Tactical Report**:
   ```
   GET http://localhost:8081/academic/match-report
   ```
   Renders a responsive, cyber-tactical dark-mode HTML document containing:
   - Global persistence statistics (total matches recorded, registered operators, total kills).
   - Recent match history table (Match ID, Room, Mode, Winner, Duration, Kills, Timestamp).
   - Career Leaderboard table (Operator, Matches, Wins, Losses, Kills, Deaths, K/D Ratio, Win Rate).
   - Full HTML entity escaping on user-provided strings to prevent Cross-Site Scripting (XSS).
2. **JSON Machine-Readable Report**:
   ```
   GET http://localhost:8081/academic/match-report?format=json
   ```
   Returns the raw persisted dataset serialized into structured JSON.

---

### 4. How to Demonstrate the Feature

1. **Start the Backend**:
   ```powershell
   cd backend
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-26.0.2"
   .\mvnw.cmd spring-boot:run
   ```
2. **Start the Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
3. **Play and Complete a Match**:
   - Open `http://localhost:5173/` in your browser.
   - Deploy into **Warehouse** or **Container Yard**, or host a private room with 2 players.
   - Press **`F3`** to inspect the active Rapier 3D colliders and ground contacts in real time.
   - Fire at wooden crates and oil barrels to observe physical bullet impulses.
   - Conclude the match (reach kill limit or host clicks return to lobby).
4. **View the Persisted Report**:
   - Open `http://localhost:8081/academic/match-report` in any browser.
   - Observe the newly recorded match ID, authoritative server scores, and updated operator career K/D ratios.
   - Append `?format=json` to inspect the raw JSON output.

#### Deployment Scope
- **Local Demonstration**: Embedded H2 database and Rapier WebAssembly client run locally with zero external database dependencies.
---

## Chunk 8 — Explosive Environment, Loot Drops, Kill Feed & Signature Gameplay

Breachers.io Chunk 8 introduces dynamic environmental hazards, physical boost mechanics, tactical ammo drops, and competitive scoreboard & kill feed systems.

### 1. Interactive Explosive Barrels 💥
- **Visual Design**: Amber yellow barrels featuring rolled dark steel chimes, glowing hazard bands, warning symbols, and a pulsing LED beacon strobe.
- **Ignition & Fuse**: On bullet or knife impact, the barrel begins a 0.6s fuse countdown with rapid red/amber strobe flashing and a procedural Web Audio fuse sizzle.
- **Detonation & VFX**:
  - Expanding core and outer fireballs, expanding shockwave ring, procedural smoke plume.
  - Sub-bass explosion audio with distance falloff attenuation.
  - Procedural camera shake on nearby players (< 35m) scaled by proximity.
  - Rapier physics radial impulse pushing surrounding dynamic rigid bodies.
- **Server-Authoritative Radial Damage**:
  - Authoritatively validated by the Spring Boot backend (`GameSessionManager.detonateBarrel`).
  - Maximum damage: 110 HP at epicenter, linear distance falloff within 8.0m radius.
  - Spawn protection (5s) and TDM friendly-fire immunity strictly enforced.
  - Single-detonation guarantee via `AtomicBoolean` — cannot be detonated repeatedly.
  - **Chain Reactions**: Detonating barrels ignite adjacent unexploded barrels within explosion radius with a staggered delay (0.25s).
  - **Breach Bonus**: Eliminating an opponent with an explosive barrel awards a `BREACH BONUS (+100 PTS)` notification!

### 2. Bounceable Tyres & Fun Physics
- **Design & Placement**: Heavy vehicle rubber tyre stacks with amber/cyan grip stripes located in tactical corners of Container Yard and Warehouse.
- **Physics Boost**: Stepping or jumping onto a designated tyre stack launches the player upward with a controlled vertical velocity (`15.0 m/s`, launching the player ~3.5–4.0m into the air).
- **Feedback**:
  - Squash & spring elastic rebound animation on the tyre stack.
  - Radial puff ring dust particles at the rim.
  - Resonant spring boing audio synthesis.
  - HUD notification: `BOUNCE BOOST!`.
  - Built-in 350ms cooldown prevents infinite bounce oscillations or ceiling clipping.

### 3. Ammo Loot Drops on Player Elimination
- **Spawn on Death**: When a player is eliminated, an ammo crate is dropped at their death coordinates containing ammunition for their equipped weapon.
- **3D Asset & Visuals**: Slate military crate with glowing tactical cyan latch, floating and rotating ammo magazine icon, and a vertical light shaft beacon.
- **Proximity Detection & HUD Prompts**:
  - Within 8m: Small alert banner `AMMO DROPPED NEARBY` (fades automatically after 2s).
  - Within 2.5m: Interaction prompt `[E] PICK UP AMMO (+[amount] [type])`.
  - On collection: `AMMO COLLECTED +[amount]` toast and immediate HUD reserve ammo update.
- **Authoritative & Atomic Pickup**:
  - Client sends `PICKUP_LOOT` with `lootId`.
  - Server atomically verifies distance (`<= 3.5m`), availability (`AtomicBoolean`), and player ammo capacity.
  - Prevents race conditions — exactly one player can collect a given drop.
  - Uncollected loot drops automatically expire after 30 seconds (`cleanExpiredLoot`).

### 4. Live Kill Feed & In-Game Scoreboard
- **Top-Right Live Kill Feed**:
  - Real-time notifications: `[PlayerA] 🔫 AR ➔ [PlayerB]` or `[PlayerA] 💥 BARREL [BREACH BONUS] ➔ [PlayerB]`.
  - Automatically fades out after 5 seconds. Maximum 5 simultaneous visible entries.
- **In-Game Tactical Scoreboard (`Tab` Key)**:
  - Hold `Tab` to display real-time connected player list.
  - Displays Username, Team, Kills, Deaths, and K/D Ratio.
  - TDM mode shows Red vs Blue team scores; FFA mode shows individual standings.
  - Excludes practice dummies — only server-confirmed real connected sessions are listed.

### 5. Demo Characters Lifecycle
- Practice dummies (`DummyTarget`) are used solely for local single-player training.
- When two or more real players connect to a room (`onlinePlayerCount >= 2`), practice dummies are immediately hidden and excluded from weapon target collision lists.
- If player count drops to 1, practice dummies are safely restored for practice.
- Dummies never appear in scoreboards, match summaries, or kill feeds.

---

### Controls Quick Reference

| Key | Action |
| --- | --- |
| `W`, `A`, `S`, `D` | Tactical Movement |
| `Shift` (Hold) | Sprint |
| `Space` | Jump |
| `Mouse 1` (Left Click) | Shoot / Attack / Acquire Pointer Lock |
| `1` | Select Assault Rifle (`BREACHER-V1`) |
| `2` | Select Pistol (`TAC-9`) |
| `3` | Select Tactical Knife |
| `R` | Reload Weapon |
| `E` | Pick Up Ammo Loot Crate |
| `Tab` (Hold) | View In-Game Scoreboard |
| `F3` | Toggle Rapier 3D Physics Debugger |
| `Esc` | Pause / Release Pointer Lock |

---

### Testing & Verification

1. **Backend Tests (Maven + JUnit 5)**:
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-26.0.2"
   .\mvnw.cmd test
   ```
   - **Result**: **37 / 37 passed** (0 failures, 0 errors).
   - Validates barrel detonation, friendly fire rules, spawn protection immunity, chain reactions, atomic single-collector loot pickup, ammo reserve caps, dummy exclusion, JDBC persistence, and Servlet reports.

2. **Frontend Production Build (Vite)**:
   ```bash
   cd frontend
   npm run build
   ```
   - **Result**: Built successfully with zero errors.

3. **Multiplayer Two-Client E2E Test**:
   ```bash
   node scratch/test-chunk8-e2e.mjs
   ```
   - **Result**: Verified two concurrent live WebSocket clients, room formation, match start, barrel ignition/detonation broadcast, duplicate prevention, elimination loot drop, and atomic single-collector pickup.





