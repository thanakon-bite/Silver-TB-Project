// Starts the backend (nodemon, :5000) and the frontend (CRA, :3000) together: `npm start` at the repo root.
const fs = require('fs');
const net = require('net');
const path = require('path');
const concurrently = require('concurrently');

const root = path.resolve(__dirname, '..');

// Avast Web Shield intercepts HTTPS; without its root certificate every Supabase call fails
// with UNABLE_TO_VERIFY_LEAF_SIGNATURE. Use it when present, unless the shell already set one.
const AVAST_CERT = 'C:\\ProgramData\\Avast Software\\Avast\\wscert.pem';
const env = { ...process.env };
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

(async () => {
  const busy = [];
  for (const port of [5000, 3000]) if (await portInUse(port)) busy.push(port);
  if (busy.length) {
    console.error(`Port ${busy.join(' and ')} already in use: stop the servers that are running first.`);
    process.exit(1);
  }

  if (env.NODE_EXTRA_CA_CERTS) console.log(`NODE_EXTRA_CA_CERTS=${env.NODE_EXTRA_CA_CERTS}`);
  const { result } = concurrently(
    [
      { command: 'npm --prefix backend run dev', name: 'api', prefixColor: 'yellow' },
      { command: 'npm --prefix frontend start', name: 'web', prefixColor: 'cyan' },
    ],
    { cwd: root, env, killOthers: ['failure', 'success'] }
  );
  result.then(
    () => process.exit(0),
    () => process.exit(1)
  );
})();
