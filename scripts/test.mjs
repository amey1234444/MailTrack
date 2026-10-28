import { spawnSync } from 'node:child_process';
// Vercel sets NODE_ENV=production. React's production bundle omits act(),
// so launch tests in a separate test environment before React is imported.
// This does not change the environment of the subsequent production build.
const result = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  },
);
if (result.error) console.error('Unable to start tests:', result.error.message);
process.exit(result.status ?? 1);
