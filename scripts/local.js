const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const local = path.join(root, '.local');
const port = Number(process.env.PORT || 4173);
const url = `http://127.0.0.1:${port}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function health() {
  try { const response = await fetch(url + '/health', { signal: AbortSignal.timeout(1500) }); return response.ok ? await response.json() : null; } catch { return null; }
}
(async () => {
  fs.mkdirSync(local, { recursive: true });
  const running = await health();
  if (running?.app === 'btechhelpline') {
    if (!process.argv.includes('--restart')) { console.log(`BtechHelpline is already running: http://localhost:${port}/`); return; }
    const saved = JSON.parse(fs.readFileSync(path.join(local, 'server.json'), 'utf8'));
    if (running.parentPid !== saved.pid) throw new Error('The server is not this launcher’s process; it has been left running.');
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(saved.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else process.kill(-saved.pid, 'SIGTERM');
    await sleep(1000);
  }
  const log = fs.openSync(path.join(local, 'server.log'), 'a');
  const child = spawn(process.execPath, ['--watch', path.join(root, 'scripts/local-server.js')], {
    cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log],
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'development' }
  });
  child.unref();
  fs.closeSync(log);
  fs.writeFileSync(path.join(local, 'server.json'), JSON.stringify({ pid: child.pid, port, startedAt: new Date().toISOString() }, null, 2));
  for (let i = 0; i < 600; i++) {
    await sleep(500);
    if ((await health())?.app === 'btechhelpline') { console.log(`BtechHelpline is running: http://localhost:${port}/\nLogs: ${path.join(local, 'server.log')}`); return; }
  }
  throw new Error(`Server could not start. Check ${path.join(local, 'server.log')}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
