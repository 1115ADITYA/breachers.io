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
