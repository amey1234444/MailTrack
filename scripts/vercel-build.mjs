import { spawnSync } from 'node:child_process';
import { validateEnvironment } from './config.mjs';
const errors = validateEnvironment(process.env);
if (errors.length) {
  console.error('Deployment configuration errors:\n' + errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}
// Validate and compile before touching the database. Migration failure blocks release.
run('npm', ['test']);
run('npm', ['run', 'build']);
run(process.execPath, ['scripts/migrate.mjs']);
