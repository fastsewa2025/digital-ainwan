#!/usr/bin/env node
/**
 * Starts the API (http://localhost:5000) and the website (http://localhost:5173) together.
 * Open http://localhost:5173 in the browser. Press Ctrl+C once to stop both.
 *
 *   npm run dev
 *
 * Needs MongoDB running on this computer (or set MONGO_URI to another one).
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const windows = process.platform === 'win32';

const jobs = [
  { label: 'api ', dir: 'server' },
  { label: 'site', dir: 'client' },
].map((job) => {
  const child = spawn('npm run dev', {
    cwd: path.join(root, job.dir),
    shell: true,
    detached: !windows, // own process group, so the whole tree can be stopped below
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const forward = (stream, out) => {
    let rest = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      const lines = (rest + chunk).split(/\r?\n/);
      rest = lines.pop();
      for (const line of lines) out.write(`[${job.label}] ${line}\n`);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  return { ...job, child };
});

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const { child } of jobs) {
    try {
      if (windows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(code), 300);
}

for (const { label, child } of jobs) {
  child.on('exit', (code) => {
    if (stopping) return;
    console.error(`\n[${label}] stopped (code ${code}). Stopping the other one too.`);
    stopAll(code ?? 1);
  });
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
