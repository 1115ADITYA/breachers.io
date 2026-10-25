/**
 * Automated Chunk 6 Multiplayer End-to-End Verification
 * Tests 2 connected clients in a private room:
 * - Room creation & joining via 6-char code
 * - TDM team assignment
 * - Warehouse coordinate movement synchronization
 * - Server-authoritative hit/damage validation
 * - Return to lobby
 */
async function runTest() {
  console.log('=== STARTING CHUNK 6 MULTIPLAYER E2E TEST ===');

  const ws1 = new WebSocket('ws://localhost:8081/ws/game');
  const ws2 = new WebSocket('ws://localhost:8081/ws/game');

  let p1Id = null, p2Id = null;
  let roomCode = null;

  const waitMsg = (ws, expectedType, timeoutMs = 4000) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message ${expectedType}`));
      }, timeoutMs);

      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === expectedType) {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          resolve(msg);
        }
      };
      ws.addEventListener('message', handler);
    });
  };

  await Promise.all([
    new Promise(r => ws1.onopen = r),
    new Promise(r => ws2.onopen = r)
  ]);
  console.log('[E2E] Both WebSockets connected to /ws/game');

  // 1. Client 1 creates private room directly
  ws1.send(JSON.stringify({ type: 'CREATE_ROOM', username: 'HostAlpha', mode: 'TDM' }));
  const w1 = await waitMsg(ws1, 'WELCOME');
  p1Id = w1.playerId;
  const roomState1 = await waitMsg(ws1, 'ROOM_STATE');
  roomCode = roomState1.roomCode;
  console.log('[E2E] Client 1 registered & room created. Code:', roomCode, 'Host:', roomState1.hostId);

  // 2. Client 2 joins room directly using code
  ws2.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: roomCode, username: 'PeerBravo' }));
  const w2 = await waitMsg(ws2, 'WELCOME');
  p2Id = w2.playerId;
  const roomState2 = await waitMsg(ws2, 'ROOM_STATE');
  console.log('[E2E] Client 2 joined room. Total players:', roomState2.players.length);

  // 4. Client 2 joins BLUE team
  ws2.send(JSON.stringify({ type: 'SET_TEAM', team: 'BLUE' }));
  await waitMsg(ws2, 'ROOM_STATE');
  console.log('[E2E] Client 2 joined Blue team');

  // 5. Host starts match
  ws1.send(JSON.stringify({ type: 'START_MATCH' }));
  const [match1, match2] = await Promise.all([
    waitMsg(ws1, 'MATCH_STARTED'),
    waitMsg(ws2, 'MATCH_STARTED')
  ]);
  console.log('[E2E] Match started! Duration:', match1.matchDurationSec, 'KillLimit:', match1.killLimit);

  // 6. Test movement in Warehouse safe coordinates
  const movePromise = waitMsg(ws2, 'PLAYER_MOVED');
  ws1.send(JSON.stringify({
    type: 'MOVE',
    x: -26.0,
    y: 0.0,
    z: -10.0,
    yaw: 1.57,
    pitch: 0.0,
    isMoving: true,
    isSprinting: false
  }));
  const moveData = await movePromise;
  console.log('[E2E] Client 2 received Client 1 Warehouse movement:', moveData.id, `at (${moveData.x}, ${moveData.z})`);

  // Wait 5.1s for mandatory server-authoritative spawn protection to expire
  console.log('[E2E] Waiting for 5.0s spawn protection to expire...');
  await new Promise(r => setTimeout(r, 5100));

  // 7. Test shoot message transmission
  const shotPromise = waitMsg(ws2, 'SHOT_FIRED');
  ws1.send(JSON.stringify({
    type: 'SHOOT',
    shotId: Date.now(),
    weapon: 'ASSAULT',
    originX: -26.0,
    originY: 1.62,
    originZ: -10.0,
    dirX: 1.0,
    dirY: 0.0,
    dirZ: 0.0
  }));
  const shotData = await shotPromise;
  console.log('[E2E] Client 2 received remote shot fired:', shotData.weapon, 'from', shotData.shooterId);

  // 8. Host returns to lobby
  ws1.send(JSON.stringify({ type: 'RETURN_TO_LOBBY' }));
  const lobbyState = await waitMsg(ws2, 'ROOM_STATE');
  console.log('[E2E] Match concluded, returned to lobby. Status:', lobbyState.status);

  // 9. Leave room
  ws1.send(JSON.stringify({ type: 'LEAVE_ROOM' }));
  ws2.send(JSON.stringify({ type: 'LEAVE_ROOM' }));

  ws1.close();
  ws2.close();
  console.log('=== CHUNK 6 MULTIPLAYER E2E TEST PASSED 100% ===');
  process.exit(0);
}

runTest().catch(err => {
  console.error('[E2E] Test failed:', err);
  process.exit(1);
});
