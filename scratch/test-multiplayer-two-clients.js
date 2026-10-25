// Node.js automated 2-client multiplayer verification test (uses native WebSocket in Node 24)
const WS_URL = 'ws://localhost:8081/ws/game';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runMultiplayerTest() {
  console.log('=== Starting Real-Time 2-Client Multiplayer Verification ===');

  let c1Id = null;
  let c2Id = null;
  let c1SawC2Join = false;
  let c2SawC1InSnapshot = false;
  let c2SawC1Move = false;
  let c1SawC2Move = false;
  let c2SawC1Leave = false;

  // 1. Connect Client 1 (Viper_01)
  console.log('[Test] Connecting Client 1 (Viper_01)...');
  const ws1 = new WebSocket(WS_URL);

  await new Promise((resolve, reject) => {
    ws1.addEventListener('open', () => {
      ws1.send(JSON.stringify({ type: 'JOIN', username: 'Viper_01' }));
    });

    ws1.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'WELCOME') {
        c1Id = msg.playerId;
        console.log(`[Client 1] WELCOME received. PlayerId: ${c1Id}, initial players: ${msg.players.length}`);
        resolve();
      } else if (msg.type === 'PLAYER_JOINED') {
        console.log(`[Client 1] Detected peer joined: ${msg.player.username} (${msg.player.id})`);
        if (msg.player.username.startsWith('Ghost_02')) {
          c1SawC2Join = true;
        }
      } else if (msg.type === 'PLAYER_MOVED') {
        if (msg.id === c2Id) {
          console.log(`[Client 1] Received peer movement: x=${msg.x}, z=${msg.z}`);
          c1SawC2Move = true;
        }
      }
    });

    ws1.addEventListener('error', reject);
  });

  await sleep(150);

  // 2. Connect Client 2 (Ghost_02)
  console.log('[Test] Connecting Client 2 (Ghost_02)...');
  const ws2 = new WebSocket(WS_URL);

  await new Promise((resolve, reject) => {
    ws2.addEventListener('open', () => {
      ws2.send(JSON.stringify({ type: 'JOIN', username: 'Ghost_02' }));
    });

    ws2.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'WELCOME') {
        c2Id = msg.playerId;
        console.log(`[Client 2] WELCOME received. PlayerId: ${c2Id}, snapshot players: ${msg.players.length}`);
        const foundC1 = msg.players.some(p => p.id === c1Id);
        if (foundC1) {
          console.log('[Client 2] Successfully verified Client 1 is in snapshot!');
          c2SawC1InSnapshot = true;
        }
        resolve();
      } else if (msg.type === 'PLAYER_MOVED') {
        if (msg.id === c1Id) {
          console.log(`[Client 2] Received peer movement: x=${msg.x}, z=${msg.z}`);
          c2SawC1Move = true;
        }
      } else if (msg.type === 'PLAYER_LEFT') {
        if (msg.id === c1Id) {
          console.log(`[Client 2] Detected Client 1 left session: ${msg.id}`);
          c2SawC1Leave = true;
        }
      }
    });

    ws2.addEventListener('error', reject);
  });

  await sleep(200);

  // 3. Client 1 sends movement
  console.log('[Test] Client 1 moving to x=12.5, z=-5.2...');
  ws1.send(JSON.stringify({
    type: 'MOVE',
    x: 12.5,
    y: 0.0,
    z: -5.2,
    yaw: 1.57,
    pitch: 0.1,
    isMoving: true,
    isSprinting: false
  }));

  await sleep(200);

  // 4. Client 2 sends movement
  console.log('[Test] Client 2 moving to x=-8.0, z=14.1...');
  ws2.send(JSON.stringify({
    type: 'MOVE',
    x: -8.0,
    y: 0.0,
    z: 14.1,
    yaw: -0.8,
    pitch: -0.05,
    isMoving: true,
    isSprinting: true
  }));

  await sleep(200);

  // 5. Client 1 leaves session
  console.log('[Test] Client 1 disconnecting...');
  ws1.close();

  await sleep(300);

  ws2.close();

  console.log('\n=== Multi-Client Verification Summary ===');
  console.log(`- Client 1 ID assigned by server: ${c1Id} [${c1Id ? 'OK' : 'FAIL'}]`);
  console.log(`- Client 2 ID assigned by server: ${c2Id} [${c2Id ? 'OK' : 'FAIL'}]`);
  console.log(`- Client 2 received Client 1 in initial snapshot: [${c2SawC1InSnapshot ? 'OK' : 'FAIL'}]`);
  console.log(`- Client 1 received Client 2 PLAYER_JOINED broadcast: [${c1SawC2Join ? 'OK' : 'FAIL'}]`);
  console.log(`- Client 2 replicated Client 1 movement: [${c2SawC1Move ? 'OK' : 'FAIL'}]`);
  console.log(`- Client 1 replicated Client 2 movement: [${c1SawC2Move ? 'OK' : 'FAIL'}]`);
  console.log(`- Client 2 received Client 1 PLAYER_LEFT on disconnect: [${c2SawC1Leave ? 'OK' : 'FAIL'}]`);

  const allPassed = c1Id && c2Id && c2SawC1InSnapshot && c1SawC2Join && c2SawC1Move && c1SawC2Move && c2SawC1Leave;
  if (allPassed) {
    console.log('\n>>> ALL MULTIPLAYER REALTIME SYNCHRONIZATION TESTS PASSED <<<');
    process.exit(0);
  } else {
    console.error('\n>>> SOME TESTS FAILED <<<');
    process.exit(1);
  }
}

runMultiplayerTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
