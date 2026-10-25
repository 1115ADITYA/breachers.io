package io.breachers.multiplayer.model;

import io.breachers.multiplayer.dto.PlayerState;
import io.breachers.multiplayer.dto.ServerMessage;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class GameRoom {

    public static final int MAX_ROOM_PLAYERS = 10;
    public static final int MAX_TEAM_PLAYERS = 5;

    // Dedicated Red Team Spawns (West side of Container Yard)
    public static final double[][] RED_SPAWNS = new double[][] {
            { -46.0, 0.0, -10.0, 1.57 },
            { -46.0, 0.0, 10.0, 1.57 },
            { -48.0, 0.0, 0.0, 1.57 },
            { -44.0, 0.0, -20.0, 1.57 },
            { -44.0, 0.0, 20.0, 1.57 }
    };

    // Dedicated Blue Team Spawns (East side of Container Yard)
    public static final double[][] BLUE_SPAWNS = new double[][] {
            { 46.0, 0.0, -10.0, -1.57 },
            { 46.0, 0.0, 10.0, -1.57 },
            { 48.0, 0.0, 0.0, -1.57 },
            { 44.0, 0.0, 20.0, -1.57 },
            { 44.0, 0.0, -20.0, -1.57 }
    };

    // Dedicated Neutral FFA Spawns (Distributed around central arena & cover lanes)
    public static final double[][] FFA_SPAWNS = new double[][] {
            { -35.0, 0.0, -25.0, 0.8 },
            { -35.0, 0.0, 25.0, 2.3 },
            { -15.0, 0.0, 0.0, 1.57 },
            { 0.0, 0.0, -28.0, 0.0 },
            { 0.0, 0.0, 28.0, 3.14 },
            { 15.0, 0.0, 0.0, -1.57 },
            { 35.0, 0.0, -25.0, -0.8 },
            { 35.0, 0.0, 25.0, -2.3 }
    };

    private final String roomCode;
    private volatile String hostPlayerId;
    private volatile GameMode mode = GameMode.TDM;
    private volatile MatchStatus status = MatchStatus.LOBBY;

    private final Map<String, PlayerSession> players = new ConcurrentHashMap<>();
    private final AtomicInteger redScore = new AtomicInteger(0);
    private final AtomicInteger blueScore = new AtomicInteger(0);

    private volatile int killLimit = GameMode.TDM.getDefaultKillLimit();
    private volatile int matchDurationSec = GameMode.TDM.getDefaultDurationSeconds();
    private volatile int timeRemainingSec = GameMode.TDM.getDefaultDurationSeconds();

    private final AtomicInteger spawnCounter = new AtomicInteger(0);
    private ScheduledFuture<?> matchTimerFuture;

    // --- Chunk 8: Explosive Barrels & Loot Drops ---
    private volatile String currentMapId = "container_yard";
    private final Map<String, ExplosiveBarrel> barrels = new ConcurrentHashMap<>();
    private final Map<String, LootDrop> lootDrops = new ConcurrentHashMap<>();

    public GameRoom(String roomCode, String hostPlayerId, GameMode mode) {
        this.roomCode = roomCode;
        this.hostPlayerId = hostPlayerId;
        this.mode = mode != null ? mode : GameMode.TDM;
        this.killLimit = this.mode.getDefaultKillLimit();
        this.matchDurationSec = this.mode.getDefaultDurationSeconds();
        this.timeRemainingSec = this.matchDurationSec;
        initBarrels(this.currentMapId);
    }

    public String getRoomCode() {
        return roomCode;
    }

    public String getHostPlayerId() {
        return hostPlayerId;
    }

    public void setHostPlayerId(String hostPlayerId) {
        this.hostPlayerId = hostPlayerId;
    }

    public GameMode getMode() {
        return mode;
    }

    public void setMode(GameMode mode) {
        this.mode = mode;
        this.killLimit = mode.getDefaultKillLimit();
        this.matchDurationSec = mode.getDefaultDurationSeconds();
        this.timeRemainingSec = this.matchDurationSec;

        // If switched to TDM, rebalance players across Red and Blue
        if (mode == GameMode.TDM) {
            balanceTeams();
        } else {
            for (PlayerSession p : players.values()) {
                p.setTeam("FFA");
            }
        }
    }

    public MatchStatus getStatus() {
        return status;
    }

    public void setStatus(MatchStatus status) {
        this.status = status;
    }

    public int getPlayerCount() {
        return players.size();
    }

    public boolean isFull() {
        return players.size() >= MAX_ROOM_PLAYERS;
    }

    public boolean isEmpty() {
        return players.isEmpty();
    }

    public Collection<PlayerSession> getPlayers() {
        return Collections.unmodifiableCollection(players.values());
    }

    public PlayerSession getPlayer(String playerId) {
        return players.get(playerId);
    }

    public boolean hasPlayer(String playerId) {
        return players.containsKey(playerId);
    }

    /**
     * Add a player to the room with balanced team assignment
     */
    public synchronized boolean addPlayer(PlayerSession session) {
        if (isFull()) return false;

        session.setTeam("NONE");
        session.setCurrentRoomCode(roomCode);

        if (mode == GameMode.TDM) {
            int redCount = getTeamCount("RED");
            int blueCount = getTeamCount("BLUE");
            if (redCount <= blueCount && redCount < MAX_TEAM_PLAYERS) {
                session.setTeam("RED");
            } else if (blueCount < MAX_TEAM_PLAYERS) {
                session.setTeam("BLUE");
            } else {
                session.setTeam("RED");
            }
        } else {
            session.setTeam("FFA");
        }

        players.put(session.getPlayerId(), session);

        // Host assignment if host is missing
        if (hostPlayerId == null || !players.containsKey(hostPlayerId)) {
            hostPlayerId = session.getPlayerId();
        }

        return true;
    }

    /**
     * Remove player from room and handle host transfer
     */
    public synchronized boolean removePlayer(String playerId) {
        PlayerSession removed = players.remove(playerId);
        if (removed != null) {
            // Transfer host if necessary
            if (playerId.equals(hostPlayerId)) {
                if (!players.isEmpty()) {
                    hostPlayerId = players.keySet().iterator().next();
                } else {
                    hostPlayerId = null;
                }
            }
            return true;
        }
        return false;
    }

    public int getTeamCount(String team) {
        int count = 0;
        for (PlayerSession p : players.values()) {
            if (team.equalsIgnoreCase(p.getTeam())) {
                count++;
            }
        }
        return count;
    }

    public synchronized void balanceTeams() {
        List<PlayerSession> all = new ArrayList<>(players.values());
        all.sort((a, b) -> {
            if (a.getPlayerId().equals(hostPlayerId)) return -1;
            if (b.getPlayerId().equals(hostPlayerId)) return 1;
            return a.getPlayerId().compareTo(b.getPlayerId());
        });
        for (int i = 0; i < all.size(); i++) {
            all.get(i).setTeam(i % 2 == 0 ? "RED" : "BLUE");
        }
    }

    public synchronized boolean switchTeam(String playerId, String targetTeam) {
        if (mode != GameMode.TDM) return false;
        String desired = targetTeam != null ? targetTeam.toUpperCase() : "RED";
        if (!desired.equals("RED") && !desired.equals("BLUE")) return false;

        PlayerSession player = players.get(playerId);
        if (player == null || player.getTeam().equals(desired)) return true;

        if (getTeamCount(desired) >= MAX_TEAM_PLAYERS) {
            return false;
        }

        player.setTeam(desired);
        return true;
    }

    public boolean isFriendlyFire(PlayerSession shooter, PlayerSession victim) {
        if (mode != GameMode.TDM) return false;
        return shooter.getTeam().equals(victim.getTeam());
    }

    /**
     * Select a spawn point respecting mode and team assignment.
     * Guaranteed safe: Red spawns only at Red points, Blue only at Blue points, FFA only at neutral points.
     */
    public double[] getSpawnPointForPlayer(PlayerSession player) {
        if (player == null) {
            return selectBestSpawn(RED_SPAWNS, null);
        }
        if (mode == GameMode.TDM) {
            if ("BLUE".equalsIgnoreCase(player.getTeam())) {
                return selectBestSpawn(BLUE_SPAWNS, "RED");
            } else {
                return selectBestSpawn(RED_SPAWNS, "BLUE");
            }
        } else {
            return selectBestSpawn(FFA_SPAWNS, null);
        }
    }

    /**
     * Select safe spawn by rotating or picking furthest from enemies
     */
    private double[] selectBestSpawn(double[][] candidateSpawns, String enemyTeam) {
        if (candidateSpawns == null || candidateSpawns.length == 0) {
            return new double[] { 0.0, 0.0, 0.0, 0.0 };
        }

        // If no enemies in session, round-robin rotation
        int idx = Math.abs(spawnCounter.getAndIncrement() % candidateSpawns.length);
        double[] chosen = candidateSpawns[idx];

        // Find enemies
        List<PlayerSession> enemies = new ArrayList<>();
        for (PlayerSession p : players.values()) {
            if (p.isDead()) continue;
            if (enemyTeam != null && enemyTeam.equalsIgnoreCase(p.getTeam())) {
                enemies.add(p);
            } else if (enemyTeam == null) {
                enemies.add(p);
            }
        }

        if (enemies.isEmpty()) {
            return chosen;
        }

        // Pick candidate spawn with the greatest minimum distance to any enemy
        double maxMinDist = -1;
        double[] safest = chosen;

        for (double[] spawn : candidateSpawns) {
            double minDist = Double.MAX_VALUE;
            for (PlayerSession enemy : enemies) {
                PlayerState es = enemy.getState();
                if (es == null) continue;
                double dist = Math.hypot(spawn[0] - es.x(), spawn[2] - es.z());
                if (dist < minDist) {
                    minDist = dist;
                }
            }
            if (minDist > maxMinDist) {
                maxMinDist = minDist;
                safest = spawn;
            }
        }

        return safest;
    }

    public int getRedScore() {
        return redScore.get();
    }

    public int getBlueScore() {
        return blueScore.get();
    }

    public void incrementRedScore() {
        redScore.incrementAndGet();
    }

    public void incrementBlueScore() {
        blueScore.incrementAndGet();
    }

    public int getKillLimit() {
        return killLimit;
    }

    public int getTimeRemainingSec() {
        return timeRemainingSec;
    }

    public void setTimeRemainingSec(int sec) {
        this.timeRemainingSec = Math.max(0, sec);
    }

    public void decrementTimeRemaining() {
        if (timeRemainingSec > 0) {
            timeRemainingSec--;
        }
    }

    public void resetScores() {
        redScore.set(0);
        blueScore.set(0);
        timeRemainingSec = matchDurationSec;
        for (PlayerSession p : players.values()) {
            p.resetScore();
        }
    }

    public void setMatchTimerFuture(ScheduledFuture<?> future) {
        if (this.matchTimerFuture != null && !this.matchTimerFuture.isDone()) {
            this.matchTimerFuture.cancel(true);
        }
        this.matchTimerFuture = future;
    }

    public void cancelMatchTimer() {
        if (this.matchTimerFuture != null && !this.matchTimerFuture.isDone()) {
            this.matchTimerFuture.cancel(true);
            this.matchTimerFuture = null;
        }
    }

    /**
     * Build ServerMessage.RoomState snapshot
     */
    public ServerMessage.RoomState buildRoomStateMessage() {
        List<ServerMessage.RoomPlayerInfo> playerInfos = new ArrayList<>();
        for (PlayerSession p : players.values()) {
            playerInfos.add(new ServerMessage.RoomPlayerInfo(
                    p.getPlayerId(),
                    p.getUsername(),
                    p.getTeam(),
                    p.getPlayerId().equals(hostPlayerId),
                    p.isReady(),
                    p.getKills(),
                    p.getDeaths()
            ));
        }

        return new ServerMessage.RoomState(
                roomCode,
                hostPlayerId,
                mode.name(),
                status.name(),
                playerInfos,
                redScore.get(),
                blueScore.get(),
                killLimit,
                timeRemainingSec
        );
    }

    /**
     * Build final match leaderboard results
     */
    public List<ServerMessage.PlayerMatchResult> buildLeaderboard() {
        List<ServerMessage.PlayerMatchResult> results = new ArrayList<>();
        for (PlayerSession p : players.values()) {
            int score = p.getKills() * 100 - p.getDeaths() * 25;
            results.add(new ServerMessage.PlayerMatchResult(
                    p.getPlayerId(),
                    p.getUsername(),
                    p.getTeam(),
                    p.getKills(),
                    p.getDeaths(),
                    Math.max(0, score)
            ));
        }
        results.sort((a, b) -> Integer.compare(b.score(), a.score()));
        return results;
    }

    // --- Chunk 8 Methods: Explosive Barrels & Loot Drops ---

    public String getCurrentMapId() {
        return currentMapId;
    }

    public synchronized void setCurrentMapId(String mapId) {
        if (mapId != null && !mapId.equals(this.currentMapId)) {
            this.currentMapId = mapId;
            initBarrels(mapId);
            clearLoot();
        }
    }

    public synchronized void initBarrels(String mapId) {
        barrels.clear();
        if ("warehouse".equalsIgnoreCase(mapId)) {
            addBarrel(new ExplosiveBarrel("barrel_wh_1", -5.0, 0.55, 8.0));
            addBarrel(new ExplosiveBarrel("barrel_wh_2", 5.0, 0.55, -8.0));
            addBarrel(new ExplosiveBarrel("barrel_wh_3", -15.0, 0.55, 12.0));
            addBarrel(new ExplosiveBarrel("barrel_wh_4", 15.0, 0.55, -12.0));
            addBarrel(new ExplosiveBarrel("barrel_wh_5", 0.0, 0.55, 16.0));
            addBarrel(new ExplosiveBarrel("barrel_wh_6", 0.0, 0.55, -16.0));
            addBarrel(new ExplosiveBarrel("barrel_wh_7", -10.0, 0.55, -6.0));
            addBarrel(new ExplosiveBarrel("barrel_wh_8", 10.0, 0.55, 6.0));
        } else {
            // Container Yard default barrels
            addBarrel(new ExplosiveBarrel("barrel_cy_1", -14.7, 0.55, 3.4));
            addBarrel(new ExplosiveBarrel("barrel_cy_2", 14.7, 0.55, -3.4));
            addBarrel(new ExplosiveBarrel("barrel_cy_3", 28.0, 0.55, -22.0));
            addBarrel(new ExplosiveBarrel("barrel_cy_4", 0.0, 0.55, 24.0));
            addBarrel(new ExplosiveBarrel("barrel_cy_5", -14.0, 0.55, 3.0));
            addBarrel(new ExplosiveBarrel("barrel_cy_6", 14.0, 0.55, -3.0));
            addBarrel(new ExplosiveBarrel("barrel_cy_7", -28.0, 0.55, 22.0));
            addBarrel(new ExplosiveBarrel("barrel_cy_8", 0.0, 0.55, -24.0));
        }
    }

    private void addBarrel(ExplosiveBarrel barrel) {
        barrels.put(barrel.getBarrelId(), barrel);
    }

    public ExplosiveBarrel getBarrel(String barrelId) {
        return barrels.get(barrelId);
    }

    public Collection<ExplosiveBarrel> getAllBarrels() {
        return Collections.unmodifiableCollection(barrels.values());
    }

    public synchronized void resetBarrels() {
        for (ExplosiveBarrel b : barrels.values()) {
            b.reset();
        }
    }

    public LootDrop spawnLoot(double x, double y, double z, String ammoType, int amount) {
        String lootId = "loot_" + UUID.randomUUID().toString().substring(0, 8);
        LootDrop drop = new LootDrop(lootId, x, y, z, ammoType, amount);
        lootDrops.put(lootId, drop);
        return drop;
    }

    public LootDrop collectLoot(String lootId, PlayerSession player) {
        LootDrop drop = lootDrops.get(lootId);
        if (drop != null && drop.tryCollect(player)) {
            lootDrops.remove(lootId);
            return drop;
        }
        return null;
    }

    public List<LootDrop> cleanExpiredLoot() {
        long now = System.currentTimeMillis();
        List<LootDrop> expired = new ArrayList<>();
        for (Iterator<Map.Entry<String, LootDrop>> it = lootDrops.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<String, LootDrop> entry = it.next();
            if (entry.getValue().isExpired(now)) {
                expired.add(entry.getValue());
                it.remove();
            }
        }
        return expired;
    }

    public void clearLoot() {
        lootDrops.clear();
    }

    public int getRealPlayerCount() {
        return players.size();
    }
}
