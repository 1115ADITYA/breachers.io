// Simulates a remote multiplayer peer walking in Container Yard
const WS_URL = 'ws://localhost:8081/ws/game';

const ws = new WebSocket(WS_URL);

ws.addEventListener('open', () => {
  ws.send(JSON.stringify({ type: 'JOIN', username: 'Ghost_Operative' }));
});

let angle = 0;
let posX = -40;
let posZ = -5;

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'WELCOME') {
    console.log('[Bot] Joined as:', msg.username, msg.playerId);

    // Broadcast movement updates at 20Hz (every 50ms)
    setInterval(() => {
      angle += 0.05;
      posX = -40 + Math.sin(angle) * 4;
      posZ = -5 + Math.cos(angle) * 4;

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'MOVE',
          x: Math.round(posX * 100) / 100,
          y: 0.0,
          z: Math.round(posZ * 100) / 100,
          yaw: angle,
          pitch: 0.0,
          isMoving: true,
          isSprinting: false
        }));
      }
    }, 50);
  }
});
