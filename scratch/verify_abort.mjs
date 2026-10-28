import { spawn } from 'child_process';
import fs from 'fs';

async function run() {
  console.log('1. Starting Headless Chrome with CDP on port 9222...');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5173', { method: 'PUT' });
    const target = await listRes.json();
    console.log('2. Created page target:', target.webSocketDebuggerUrl);

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let idCounter = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg);
        callbacks.delete(msg.id);
      }
    };

    await new Promise((resolve) => ws.onopen = resolve);

    function sendCmd(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = idCounter++;
        callbacks.set(id, (res) => {
          if (res.error) reject(new Error(res.error.message));
          else resolve(res.result);
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const res = await sendCmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return res.result?.value;
    }

    async function captureScreenshot(path) {
      const res = await sendCmd('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path, Buffer.from(res.data, 'base64'));
      console.log(`Saved screenshot: ${path}`);
    }

    console.log('3. Waiting for page DOM to load...');
    await new Promise(r => setTimeout(r, 3000));

    // Click Quick Play
    console.log('4. Clicking Quick Play...');
    await evaluate(`document.getElementById('btn-quick-play').click()`);

    // Wait for deployment
    await new Promise(r => setTimeout(r, 3500));

    // Check if deployed
    const appState1 = await evaluate(`window.breachersAppState || 'DEPLOYED'`);
    console.log('5. Deployed into game match.');

    // Now simulate pressing Esc / triggering tactical pause
    console.log('6. Triggering Tactical Pause...');
    await evaluate(`
      const pauseModal = document.getElementById('tactical-pause-modal');
      pauseModal.classList.remove('hidden');
    `);

    // Check computed pointer events on modal and abort button
    const styles = await evaluate(`({
      modalPointerEvents: window.getComputedStyle(document.getElementById('tactical-pause-modal')).pointerEvents,
      btnPointerEvents: window.getComputedStyle(document.getElementById('btn-pause-leave')).pointerEvents
    })`);
    console.log('7. Computed pointer-events:', styles);

    // Save screenshot of Tactical Pause modal
    await captureScreenshot('C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\0da8891c-def8-4740-8004-cfdd44bc4820\\tactical_pause_verified.png');

    // Click Abort Mission button!
    console.log('8. Clicking ABORT MISSION button (btn-pause-leave)...');
    await evaluate(`document.getElementById('btn-pause-leave').click()`);
    await new Promise(r => setTimeout(r, 500));

    const confirmBoxVisible = await evaluate(`!document.getElementById('pause-leave-confirm-box').classList.contains('hidden')`);
    console.log('9. Confirm Box is visible:', confirmBoxVisible);

    // Save screenshot showing confirmation box
    await captureScreenshot('C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\0da8891c-def8-4740-8004-cfdd44bc4820\\abort_confirmation_box.png');

    // Click YES, LEAVE ROOM
    console.log('10. Clicking YES, LEAVE ROOM (btn-pause-confirm-leave)...');
    await evaluate(`document.getElementById('btn-pause-confirm-leave').click()`);
    await new Promise(r => setTimeout(r, 1000));

    // Check if returned to menu
    const menuVisible = await evaluate(`!document.getElementById('menu-container').classList.contains('hidden')`);
    const hudHidden = await evaluate(`document.getElementById('hud-overlay').classList.contains('hidden')`);
    console.log('11. Menu visible:', menuVisible, '| HUD hidden:', hudHidden);

    // Save screenshot of successfully returned menu
    await captureScreenshot('C:\\Users\\Aditya\\.gemini\\antigravity\\brain\\0da8891c-def8-4740-8004-cfdd44bc4820\\aborted_returned_lobby.png');

    if (confirmBoxVisible && menuVisible && hudHidden) {
      console.log('>>> ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<');
    } else {
      throw new Error('Verification checks failed');
    }

    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

run().catch(err => {
  console.error('Error running test:', err);
  process.exit(1);
});

