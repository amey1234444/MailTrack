// Accept standard Next.js options and the host/port flags used by preview runners.
import { spawn } from 'node:child_process';
import './pdf-worker.mjs';
const args = process.argv
  .slice(2)
  .filter((arg) => arg !== '--strictPort')
  .map((arg) => (arg === '--host' ? '--hostname' : arg));
// Preview runners use the production build, matching Vercel behavior. Run npm run build first.
const mode = process.argv.includes('--strictPort') ? 'start' : 'dev';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', mode, ...args], {
  stdio: 'inherit',
  env: process.env,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
