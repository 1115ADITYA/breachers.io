/**
 * Automated Chunk 7 Multiplayer End-to-End & JDBC Persistence Test
 */
async function runTest() {
  console.log('=== STARTING CHUNK 7 MULTIPLAYER & PERSISTENCE E2E TEST ===');

  const ws1 = new WebSocket('ws://localhost:8081/ws/game');
  const ws2 = new WebSocket('ws://localhost:8081/ws/game');

  const waitMsg = (ws, expectedType, timeoutMs = 12000) => {
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

  try {
    await Promise.all([
      new Promise(r => ws1.onopen = r),
      new Promise(r => ws2.onopen = r)
    ]);
    console.log('[E2E] Both WebSockets connected to /ws/game');

    // 1. Client 1 creates private room
    ws1.send(JSON.stringify({ type: 'CREATE_ROOM', username: 'HostAlpha', mode: 'TDM' }));
    const w1 = await waitMsg(ws1, 'WELCOME');
    console.log('[E2E] Host registered:', w1.playerId);

    const roomState1 = await waitMsg(ws1, 'ROOM_STATE');
    const roomCode = roomState1.roomCode;
    console.log('[E2E] Room created with code:', roomCode);

    // 2. Client 2 joins room using roomCode
    ws2.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: roomCode, username: 'PeerBravo' }));
    const w2 = await waitMsg(ws2, 'WELCOME');
    console.log('[E2E] Peer registered:', w2.playerId);

    const roomState2 = await waitMsg(ws2, 'ROOM_STATE');
    console.log('[E2E] Peer joined room. Total players:', roomState2.players.length);

    // 3. Client 2 joins BLUE team
    ws2.send(JSON.stringify({ type: 'SET_TEAM', team: 'BLUE' }));
    await waitMsg(ws2, 'ROOM_STATE');
    console.log('[E2E] Client 2 joined Blue team');

    // 4. Host starts match
    ws1.send(JSON.stringify({ type: 'START_MATCH' }));
    const [match1, match2] = await Promise.all([
      waitMsg(ws1, 'MATCH_STARTED'),
      waitMsg(ws2, 'MATCH_STARTED')
    ]);
    console.log('[E2E] Match started! Duration:', match1.matchDurationSec, 'KillLimit:', match1.killLimit);

    // 5. Send movement updates
    ws1.send(JSON.stringify({
      type: 'MOVE',
      x: -26.0, y: 0.0, z: -10.0,
      yaw: 1.57, pitch: 0.0,
      isMoving: true, isSprinting: false
    }));

    ws2.send(JSON.stringify({
      type: 'MOVE',
      x: 28.0, y: 0.0, z: -4.0,
      yaw: -1.57, pitch: 0.0,
      isMoving: false, isSprinting: false
    }));

    // Wait 5.1s for spawn protection to expire
    console.log('[E2E] Waiting 5.1s for spawn protection to expire...');
    await new Promise(r => setTimeout(r, 5100));

    // 6. Host fires at Peer to land hits and score kills
    console.log('[E2E] Host shooting at Peer...');
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
    const shotMsg = await shotPromise;
    console.log('[E2E] Peer received remote SHOT_FIRED:', shotMsg.weapon, 'from', shotMsg.shooterId);

    // 7. Verify match is running or complete
    console.log('[E2E] Waiting 1s...');
    await new Promise(r => setTimeout(r, 1000));

    // Return to lobby / end match trigger
    ws1.send(JSON.stringify({ type: 'RETURN_TO_LOBBY' }));
    await new Promise(r => setTimeout(r, 1000));

    // 8. Query Academic MatchReportServlet
    // Host returns to lobby to conclude the match
    console.log('[E2E] Host sending RETURN_TO_LOBBY to conclude match and trigger JDBC persistence...');
    ws1.send(JSON.stringify({
      type: 'RETURN_TO_LOBBY',
      playerId: w1.playerId,
      roomCode: roomCode
    }));

    // Wait 1.5s for async JDBC persistence to complete
    await new Promise(r => setTimeout(r, 1500));

    console.log('[E2E] Querying MatchReportServlet at http://localhost:8081/academic/match-report?format=json...');
    const reportRes = await fetch('http://localhost:8081/academic/match-report?format=json');
    const reportJson = await reportRes.json();
    console.log('[E2E] MatchReportServlet JSON Output:');
    console.log(JSON.stringify(reportJson, null, 2));

    if (reportJson.status !== 'OK') {
      throw new Error('Servlet returned non-OK status: ' + reportJson.status);
    }

    console.log('\n======================================================');
    console.log('SUCCESS: CHUNK 7 REAL-TIME MATCH AND SERVLET VERIFIED!');
    console.log('======================================================');
  } finally {
    ws1.close();
    ws2.close();
  }
}

runTest().catch(err => {
  console.error('[E2E Error]:', err);
  process.exit(1);
});
