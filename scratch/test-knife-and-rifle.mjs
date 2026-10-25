// test-knife-and-rifle.mjs
const WS_URL = 'ws://localhost:8081/ws/game';

function createClient(username) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const client = { ws, username, playerId: null, health: 100, events: new Map() };
    ws.onopen = () => ws.send(JSON.stringify({ type: 'JOIN', username }));
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'WELCOME') {
        client.playerId = msg.playerId;
        resolve(client);
      }
      if (msg.type === 'HEALTH_UPDATED') {
        client.health = msg.health;
      }
      const list = client.events.get(msg.type) || [];
      list.forEach(fn => fn(msg));
    };
    ws.onerror = reject;
  });
}

function onEvent(client, eventType) {
  return new Promise(resolve => {
    const list = client.events.get(eventType) || [];
    list.push(resolve);
    client.events.set(eventType, list);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== VERIFYING KNIFE & ASSAULT RIFLE COMBAT ===');
  const attacker = await createClient('Blade_01');
  const defender = await createClient('Target_02');

  attacker.ws.send(JSON.stringify({ type: 'MOVE', x: 0, y: 0, z: 0, yaw: 0, pitch: 0, isMoving: false, isSprinting: false }));
  // Defender within knife reach (1.5m away)
  defender.ws.send(JSON.stringify({ type: 'MOVE', x: 0, y: 0, z: 1.5, yaw: Math.PI, pitch: 0, isMoving: false, isSprinting: false }));

  console.log('Waiting 2.2s for spawn protection to expire...');
  await sleep(2200);

  // 1. Switch to KNIFE
  console.log('Switching to KNIFE...');
  attacker.ws.send(JSON.stringify({ type: 'SWITCH_WEAPON', weapon: 'KNIFE' }));
  await sleep(200);

  // Attack with Knife to the body (originY = 1.0)
  console.log('Attacking with KNIFE (body hit)...');
  const hitPromise = onEvent(attacker, 'PLAYER_HIT');
  attacker.ws.send(JSON.stringify({
    type: 'SHOOT',
    shotId: 10,
    weapon: 'KNIFE',
    originX: 0, originY: 1.0, originZ: 0,
    dirX: 0, dirY: 0, dirZ: 1.0
  }));

  const hit = await hitPromise;
  console.log(`✓ Knife body hit! Damage: ${hit.damage}, Target HP remaining: ${hit.healthRemaining}`);
  if (hit.damage !== 55) throw new Error(`Expected knife body damage 55, got ${hit.damage}`);

  // 2. Switch back to ASSAULT
  console.log('Switching to ASSAULT rifle...');
  attacker.ws.send(JSON.stringify({ type: 'SWITCH_WEAPON', weapon: 'ASSAULT' }));
  await sleep(250);

  // Finish with Assault rifle
  const deathPromise = onEvent(defender, 'PLAYER_DIED');
  const killFeedPromise = onEvent(attacker, 'KILL_FEED');

  attacker.ws.send(JSON.stringify({
    type: 'SHOOT',
    shotId: 11,
    weapon: 'ASSAULT',
    originX: 0, originY: 1.62, originZ: 0,
    dirX: 0, dirY: 0, dirZ: 1.0
  }));
  await sleep(150);
  attacker.ws.send(JSON.stringify({
    type: 'SHOOT',
    shotId: 12,
    weapon: 'ASSAULT',
    originX: 0, originY: 1.62, originZ: 0,
    dirX: 0, dirY: 0, dirZ: 1.0
  }));

  const death = await deathPromise;
  const killFeed = await killFeedPromise;

  console.log(`✓ Assault rifle elimination! Killer: ${death.killerName}, Victim: ${death.victimName}, Weapon: ${death.weapon}`);
  console.log(`✓ Kill feed: ${killFeed.killerName} [${killFeed.weapon}] ${killFeed.victimName}`);

  attacker.ws.close();
  defender.ws.close();
  console.log('=== KNIFE & ASSAULT RIFLE VERIFICATION PASSED! ===');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
