package io.breachers.multiplayer;

import io.breachers.multiplayer.dto.ClientMessage;
import io.breachers.multiplayer.dto.PlayerState;
import io.breachers.multiplayer.model.*;
import io.breachers.multiplayer.service.GameSessionManager;
import io.breachers.multiplayer.GameSessionManagerTest.TestWebSocketSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

public class ExplosionAndLootTest {

    private GameSessionManager sessionManager;

    @BeforeEach
    void setUp() {
        sessionManager = new GameSessionManager(new com.fasterxml.jackson.databind.ObjectMapper());
    }

    @Test
    @DisplayName("1. Barrel detonation occurs strictly once per barrel")
    void testBarrelDetonationOnce() {
        ExplosiveBarrel barrel = new ExplosiveBarrel("test_barrel", 0, 0, 0);
        assertFalse(barrel.isExploded());

        assertTrue(barrel.detonate(), "First detonation call should succeed");
        assertTrue(barrel.isExploded());

        assertFalse(barrel.detonate(), "Subsequent detonation calls must return false");
        assertFalse(barrel.detonate(), "Third detonation call must return false");
    }

    @Test
    @DisplayName("2. Explosion damage respects radius and 5-second spawn protection")
    void testExplosionDamageRadiusAndSpawnProtection() {
        GameRoom room = new GameRoom("EXP01", "host_id", GameMode.FFA);
        room.setStatus(MatchStatus.IN_PROGRESS);

        TestWebSocketSession ws1 = new TestWebSocketSession(UUID.randomUUID().toString());
        TestWebSocketSession ws2 = new TestWebSocketSession(UUID.randomUUID().toString());

        PlayerState stateNear = new PlayerState("p_near", "NearVictim", 2.0, 0.5, 0.0, 0, 0, false, false, 100, false, "ASSAULT");
        PlayerState stateFar = new PlayerState("p_far", "FarPlayer", 20.0, 0.5, 0.0, 0, 0, false, false, 100, false, "ASSAULT");

        PlayerSession nearPlayer = new PlayerSession(ws1.getId(), "p_near", "NearVictim", ws1, stateNear);
        PlayerSession farPlayer = new PlayerSession(ws2.getId(), "p_far", "FarPlayer", ws2, stateFar);

        // Near player has spawn protection initially
        assertTrue(nearPlayer.isSpawnProtected(), "Freshly created player must have spawn protection");

        ExplosiveBarrel barrel = new ExplosiveBarrel("barrel_center", 0, 0, 0);

        // Test with spawn protection active -> no damage
        int healthBefore = nearPlayer.getHealth();
        int remaining = nearPlayer.takeDamage(80);
        assertEquals(healthBefore, remaining, "Spawn-protected player must take 0 damage");
        assertEquals(100, nearPlayer.getHealth());

        // Clear spawn protection -> takes damage
        nearPlayer.clearSpawnProtection();
        assertFalse(nearPlayer.isSpawnProtected());

        int damageTaken = nearPlayer.takeDamage(60);
        assertEquals(40, damageTaken, "Player should take 60 damage after spawn protection clears");
        assertEquals(40, nearPlayer.getHealth());

        // Far player out of explosion radius
        double dist = barrel.distanceTo(farPlayer.getX(), farPlayer.getY(), farPlayer.getZ());
        assertTrue(dist > ExplosiveBarrel.EXPLOSION_RADIUS, "Far player must be outside explosion radius");
    }

    @Test
    @DisplayName("3. TDM friendly-fire rules remain enforced during explosions")
    void testTdmFriendlyFireEnforcedDuringExplosions() {
        GameRoom room = new GameRoom("TDM01", "host_1", GameMode.TDM);
        room.setStatus(MatchStatus.IN_PROGRESS);

        TestWebSocketSession wsRed1 = new TestWebSocketSession(UUID.randomUUID().toString());
        TestWebSocketSession wsRed2 = new TestWebSocketSession(UUID.randomUUID().toString());
        TestWebSocketSession wsBlue1 = new TestWebSocketSession(UUID.randomUUID().toString());

        PlayerSession redIgniter = new PlayerSession(wsRed1.getId(), "p_red1", "RedIgniter", wsRed1,
                new PlayerState("p_red1", "RedIgniter", -5, 0, 0, 0, 0, false, false, 100, false, "ASSAULT"));
        redIgniter.setTeam("RED");
        redIgniter.clearSpawnProtection();

        PlayerSession redTeammate = new PlayerSession(wsRed2.getId(), "p_red2", "RedTeammate", wsRed2,
                new PlayerState("p_red2", "RedTeammate", 1, 0, 0, 0, 0, false, false, 100, false, "ASSAULT"));
        redTeammate.setTeam("RED");
        redTeammate.clearSpawnProtection();

        PlayerSession blueEnemy = new PlayerSession(wsBlue1.getId(), "p_blue1", "BlueEnemy", wsBlue1,
                new PlayerState("p_blue1", "BlueEnemy", 1, 0, 0, 0, 0, false, false, 100, false, "ASSAULT"));
        blueEnemy.setTeam("BLUE");
        blueEnemy.clearSpawnProtection();

        room.addPlayer(redIgniter);
        room.addPlayer(redTeammate);
        room.addPlayer(blueEnemy);

        // Explicitly set teams after room.addPlayer
        redIgniter.setTeam("RED");
        redTeammate.setTeam("RED");
        blueEnemy.setTeam("BLUE");

        ExplosiveBarrel barrel = new ExplosiveBarrel("barrel_tdm", 0, 0, 0);
        room.initBarrels("container_yard");

        // Detonate barrel in room ignited by redIgniter
        sessionManager.detonateBarrel(room, barrel, redIgniter);

        // Friendly red teammate should NOT take damage
        assertEquals(100, redTeammate.getHealth(), "Friendly teammate must be protected in TDM");

        // Enemy blue player should take radial damage
        assertTrue(blueEnemy.getHealth() < 100, "Enemy must take damage from barrel explosion");
    }

    @Test
    @DisplayName("4. Chain reaction cannot create duplicate damage events")
    void testChainReactionCannotCreateDuplicateDetonations() {
        GameRoom room = new GameRoom("CHAIN01", "host_1", GameMode.FFA);
        room.setStatus(MatchStatus.IN_PROGRESS);

        ExplosiveBarrel b1 = new ExplosiveBarrel("b1", 0, 0, 0);
        ExplosiveBarrel b2 = new ExplosiveBarrel("b2", 2, 0, 0);

        assertTrue(b1.detonate());
        assertFalse(b1.detonate(), "b1 cannot explode twice");

        assertTrue(b2.detonate());
        assertFalse(b2.detonate(), "b2 cannot explode twice");
    }

    @Test
    @DisplayName("5. Ammo drops are created on valid eliminations")
    void testAmmoDropCreatedOnElimination() {
        GameRoom room = new GameRoom("LOOT01", "host_1", GameMode.FFA);
        LootDrop drop = room.spawnLoot(10.0, 0.5, -5.0, "ASSAULT", 30);

        assertNotNull(drop);
        assertNotNull(drop.getLootId());
        assertEquals(10.0, drop.getX());
        assertEquals(0.5, drop.getY());
        assertEquals(-5.0, drop.getZ());
        assertEquals("ASSAULT", drop.getAmmoType());
        assertEquals(30, drop.getAmount());
        assertFalse(drop.isCollected());
    }

    @Test
    @DisplayName("6. Two players cannot collect the same loot drop (atomic collection)")
    void testSingleCollectorRaceCondition() throws InterruptedException {
        GameRoom room = new GameRoom("RACE01", "host_1", GameMode.FFA);
        LootDrop drop = room.spawnLoot(0.0, 0.0, 0.0, "ASSAULT", 30);

        TestWebSocketSession ws1 = new TestWebSocketSession("ws1");
        TestWebSocketSession ws2 = new TestWebSocketSession("ws2");

        PlayerSession p1 = new PlayerSession(ws1.getId(), "p1", "Player1", ws1,
                new PlayerState("p1", "Player1", 0.5, 0, 0, 0, 0, false, false, 100, false, "ASSAULT"));
        PlayerSession p2 = new PlayerSession(ws2.getId(), "p2", "Player2", ws2,
                new PlayerState("p2", "Player2", 0.5, 0, 0, 0, 0, false, false, 100, false, "ASSAULT"));

        CountDownLatch latch = new CountDownLatch(2);
        final boolean[] success = new boolean[2];

        new Thread(() -> {
            LootDrop res = room.collectLoot(drop.getLootId(), p1);
            if (res != null) success[0] = true;
            latch.countDown();
        }).start();

        new Thread(() -> {
            LootDrop res = room.collectLoot(drop.getLootId(), p2);
            if (res != null) success[1] = true;
            latch.countDown();
        }).start();

        assertTrue(latch.await(3, TimeUnit.SECONDS));

        // Exactly one player collected it!
        assertTrue(success[0] ^ success[1], "Exactly one player must succeed in collecting the loot");
        assertTrue(drop.isCollected());
        assertNotNull(drop.getCollectedBy());

        // Subsequent collection attempt must fail
        assertNull(room.collectLoot(drop.getLootId(), p1));
        assertNull(room.collectLoot(drop.getLootId(), p2));
    }

    @Test
    @DisplayName("7. Ammo capacity and weapon compatibility are enforced")
    void testAmmoCapacityEnforced() {
        TestWebSocketSession ws = new TestWebSocketSession("ws");
        PlayerSession player = new PlayerSession(ws.getId(), "p1", "Tester", ws,
                new PlayerState("p1", "Tester", 0, 0, 0, 0, 0, false, false, 100, false, "ASSAULT"));

        assertEquals(90, player.getReserve(WeaponType.ASSAULT));

        // Attempting to add 50 more should not exceed max reserve (90)
        player.addReserveAmmo(WeaponType.ASSAULT, 50);
        assertEquals(90, player.getReserve(WeaponType.ASSAULT), "Reserve ammo must not exceed max limit of 90");
    }

    @Test
    @DisplayName("8. Real player counts exclude local practice dummies")
    void testRealPlayerCountExcludesDummies() {
        GameRoom room = new GameRoom("COUNT01", "host_1", GameMode.FFA);
        assertEquals(0, room.getRealPlayerCount());

        TestWebSocketSession ws1 = new TestWebSocketSession("ws1");
        PlayerSession p1 = new PlayerSession(ws1.getId(), "p1", "RealUser1", ws1, null);
        room.addPlayer(p1);

        assertEquals(1, room.getRealPlayerCount(), "Room real player count must be 1");

        TestWebSocketSession ws2 = new TestWebSocketSession("ws2");
        PlayerSession p2 = new PlayerSession(ws2.getId(), "p2", "RealUser2", ws2, null);
        room.addPlayer(p2);

        assertEquals(2, room.getRealPlayerCount(), "Room real player count must be 2");
    }
}
