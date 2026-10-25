// test-live-combat.mjs
// Verifies end-to-end two-client multiplayer combat:
// 1. Client A and Client B connect
// 2. Client A and Client B position in line of sight
// 3. Client A switches weapon to PISTOL and shoots Client B
// 4. Server hit confirmation, PLAYER_HIT, and HEALTH_UPDATED received
// 5. Client A deals lethal damage -> PLAYER_DIED and KILL_FEED received
// 6. Automatic respawn after 3 seconds -> PLAYER_RESPAWNED with 100 HP

const WS_URL = 'ws://localhost:8081/ws/game';

function createClient(username) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const client = {
      ws,
      username,
      playerId: null,
      health: 100,
      messages: [],
      events: new Map()
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'JOIN', username }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      client.messages.push(msg);

      if (msg.type === 'WELCOME') {
        client.playerId = msg.playerId;
        resolve(client);
      }

      if (msg.type === 'HEALTH_UPDATED') {
        client.health = msg.health;
      }

      const listeners = client.events.get(msg.type) || [];
      listeners.forEach(fn => fn(msg));
    };

    ws.onerror = (err) => reject(err);
  });
}

function onEvent(client, eventType) {
  return new Promise((resolve) => {
    const list = client.events.get(eventType) || [];
    list.push((msg) => resolve(msg));
    client.events.set(eventType, list);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('=== STARTING MULTIPLAYER COMBAT INTEGRATION TEST ===');

  console.log('[1/7] Connecting Client A (Viper_01) and Client B (Ghost_02)...');
  const clientA = await createClient('Viper_01');
  const clientB = await createClient('Ghost_02');

  console.log(`✓ Both clients connected: Client A=${clientA.playerId}, Client B=${clientB.playerId}`);

  console.log('[2/7] Moving players into combat positions...');
  // Client A at origin (0, 0, 0)
  clientA.ws.send(JSON.stringify({
    type: 'MOVE',
    x: 0.0, y: 0.0, z: 0.0,
    yaw: 0.0, pitch: 0.0,
    isMoving: false, isSprinting: false
  }));

  // Client B at (0, 0, 10.0) directly along +Z axis
  clientB.ws.send(JSON.stringify({
    type: 'MOVE',
    x: 0.0, y: 0.0, z: 10.0,
    yaw: Math.PI, pitch: 0.0,
    isMoving: false, isSprinting: false
  }));

  console.log('[3/7] Waiting 2.2s for spawn protection to expire...');
  await sleep(2200);

  console.log('[4/7] Client A switches to PISTOL...');
  clientA.ws.send(JSON.stringify({
    type: 'SWITCH_WEAPON',
    weapon: 'PISTOL'
  }));
  await sleep(250);

  console.log('[5/7] Client A shoots Client B with PISTOL (chest/head level)...');
  let hitPromise = onEvent(clientA, 'PLAYER_HIT');
  let healthPromise = onEvent(clientB, 'HEALTH_UPDATED');

  clientA.ws.send(JSON.stringify({
    type: 'SHOOT',
    shotId: 1,
    weapon: 'PISTOL',
    originX: 0.0,
    originY: 1.62,
    originZ: 0.0,
    dirX: 0.0,
    dirY: 0.0,
    dirZ: 1.0
  }));

  const hitMsg = await hitPromise;
  const healthMsg = await healthPromise;

  console.log(`✓ Hit registered! Damage: ${hitMsg.damage}, isHeadshot: ${hitMsg.isHeadshot}, Target HP: ${healthMsg.health}`);
  if (healthMsg.health >= 100) {
    throw new Error('Health did not decrease after hit!');
  }

  console.log('[6/7] Client A fires follow-up shots for elimination...');
  const deathPromise = onEvent(clientB, 'PLAYER_DIED');
  const killFeedPromise = onEvent(clientA, 'KILL_FEED');

  let seq = 2;
  while (clientB.health > 0) {
    await sleep(270); // Respect fire cooldown
    clientA.ws.send(JSON.stringify({
      type: 'SHOOT',
      shotId: seq++,
      weapon: 'PISTOL',
      originX: 0.0,
      originY: 1.62,
      originZ: 0.0,
      dirX: 0.0,
      dirY: 0.0,
      dirZ: 1.0
    }));

    // Check if death occurred
    const result = await Promise.race([
      deathPromise,
      sleep(300).then(() => null)
    ]);
    if (result) break;
  }

  const deathMsg = await deathPromise;
  const killFeedMsg = await killFeedPromise;

  console.log(`✓ Elimination confirmed! Killer: ${deathMsg.killerName}, Victim: ${deathMsg.victimName}, Weapon: ${deathMsg.weapon}`);
  console.log(`✓ Kill feed broadcast received: "${killFeedMsg.killerName} [${killFeedMsg.weapon}] ${killFeedMsg.victimName}"`);

  console.log('[7/7] Waiting for automatic respawn (3.0s delay)...');
  const respawnPromise = onEvent(clientB, 'PLAYER_RESPAWNED');
  const respawnMsg = await respawnPromise;

  console.log(`✓ Client B automatically respawned! New position: (${respawnMsg.x.toFixed(1)}, ${respawnMsg.y.toFixed(1)}, ${respawnMsg.z.toFixed(1)}), Health: ${respawnMsg.health}`);

  if (respawnMsg.health !== 100) {
    throw new Error(`Respawn health expected 100, got ${respawnMsg.health}`);
  }

  clientA.ws.close();
  clientB.ws.close();

  console.log('\n=== MULTIPLAYER COMBAT INTEGRATION TEST PASSED SUCCESSFULLY! ===\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
