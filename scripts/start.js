// Starts the backend (nodemon, :5000) and the frontend (CRA, :3000) together: `npm start` at the repo root.
const { execSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const concurrently = require('concurrently');

const root = path.resolve(__dirname, '..');

// Avast Web Shield intercepts HTTPS; without its root certificate every Supabase call fails
// with UNABLE_TO_VERIFY_LEAF_SIGNATURE. Use it when present, unless the shell already set one.
// Set on process.env itself: the servers inherit it (concurrently 8 ignores a top-level env option).
const AVAST_CERT = 'C:\\ProgramData\\Avast Software\\Avast\\wscert.pem';
const env = process.env;
if (!env.NODE_EXTRA_CA_CERTS && fs.existsSync(AVAST_CERT)) env.NODE_EXTRA_CA_CERTS = AVAST_CERT;

for (const app of ['backend', 'frontend']) {
  if (!fs.existsSync(path.join(root, app, 'node_modules'))) {
    console.error(`${app}/node_modules is missing. Run \`npm run install-all\` first.`);
    process.exit(1);
  }
}
if (!fs.existsSync(path.join(root, 'backend', '.env'))) {
  console.error('backend/.env is missing. Copy backend/.env.example and fill it in.');
  process.exit(1);
}

const portInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => socket.end(() => resolve(true)));
    socket.once('error', () => resolve(false));
  });

/** The process listening on a port, read from netstat (Windows only; elsewhere returns null). */
function listenerPid(port) {
  if (process.platform !== 'win32') return null;
  try {
    const listening = new RegExp(`:${port}\\s+\\S+\\s+LISTENING`);
    const line = execSync('netstat -ano -p tcp', { encoding: 'utf8' })
      .split(/\r?\n/)
      .find((l) => listening.test(l));
    return line ? line.trim().split(/\s+/).pop() : null;
  } catch {
    return null;
  }
}

/**
 * The topmost node/npm process above `pid` (e.g. `npm run dev` → nodemon → server.js). Killing only
 * server.js lets nodemon start it again, so the stop hint names the whole tree's root.
 */
function serverTreeRoot(pid) {
  try {
    const rows = JSON.parse(
      execSync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress"',
        { encoding: 'utf8' }
      )
    );
    const byId = new Map(rows.map((r) => [String(r.ProcessId), r]));
    let top = String(pid);
    for (let p = byId.get(top); p && byId.get(String(p.ParentProcessId))?.Name === 'node.exe'; p = byId.get(top)) {
      top = String(p.ParentProcessId);
    }
    return top;
  } catch {
    return String(pid);
  }
}

(async () => {
  let busy = false;
  for (const port of [5000, 3000]) {
    if (!(await portInUse(port))) continue;
    busy = true;
    const pid = listenerPid(port);
    console.error(`Port ${port} is already in use${pid ? ` by PID ${pid}` : ''}.`);
    if (pid) console.error(`  Stop it with: taskkill /PID ${serverTreeRoot(pid)} /T /F`);
  }
  if (busy) {
    console.error('Stop the servers that are already running (an earlier `npm start` or `npm run dev`), then try again.');
    process.exit(1);
  }

  if (env.NODE_EXTRA_CA_CERTS) console.log(`NODE_EXTRA_CA_CERTS=${env.NODE_EXTRA_CA_CERTS}`);
  const { result } = concurrently(
    [
      { command: 'npm --prefix backend run dev', name: 'api', prefixColor: 'yellow' },
      { command: 'npm --prefix frontend start', name: 'web', prefixColor: 'cyan' },
    ],
    { cwd: root, killOthers: ['failure', 'success'] }
  );
  result.then(
    () => process.exit(0),
    () => process.exit(1)
  );
})();
