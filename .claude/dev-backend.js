// Preview launcher for the backend: same Avast certificate handling as scripts/start.js, port 5000.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const AVAST_CERT = 'C:/ProgramData/Avast Software/Avast/wscert.pem';
const env = { ...process.env, PORT: '5000' };
if (!env.NODE_EXTRA_CA_CERTS && fs.existsSync(AVAST_CERT)) env.NODE_EXTRA_CA_CERTS = AVAST_CERT;

const child = spawn('npm', ['--prefix', 'backend', 'run', 'dev'], { cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
