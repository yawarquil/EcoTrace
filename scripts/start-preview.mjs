import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const viteBin = join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const port = process.env.PORT || '4173';

if (!existsSync(viteBin)) {
  console.error('Vite is not installed. Run npm install before starting EcoTrace.');
  process.exit(1);
}

const server = spawn(process.execPath, [viteBin, 'preview', '--host', '0.0.0.0', '--port', port], {
  cwd: rootDir,
  stdio: 'inherit'
});

server.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
