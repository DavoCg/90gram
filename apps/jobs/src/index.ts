import './load-env.js';
import type { Server } from 'node:http';
import { prisma } from '@getvinyls/db';
import { env } from './env.js';
import { jobs, findJob } from './jobs/registry.js';
import { Scheduler } from './scheduler.js';
import { startHealthServer } from './health-server.js';

// Entry points two ways:
//   (default | "serve")   long-running scheduler daemon: stays up and fires jobs on their crons.
//                         This is what the always-on machine runs.
//   "run <job-name>"      run a single job once and exit (manual backfills / ops).
//   "list"                print the registered jobs and their schedules.

function printJobs(stream: 'log' | 'error'): void {
  const write = stream === 'log' ? console.log.bind(console) : console.error.bind(console);
  write('Available jobs:');
  for (const job of jobs) {
    write(`  ${job.name}  (cron "${job.cron}")  ${job.description}`);
  }
}

function printUsage(): void {
  console.error('Usage:');
  console.error('  jobs                 start the scheduler daemon (default)');
  console.error('  jobs run <job-name>  run a single job once and exit');
  console.error('  jobs list            list registered jobs');
  printJobs('error');
}

async function runOnce(name: string | undefined): Promise<void> {
  if (name === undefined) {
    console.error('Missing job name.');
    printUsage();
    process.exitCode = 1;
    return;
  }
  const job = findJob(name);
  if (job === undefined) {
    console.error(`Unknown job: ${name}`);
    printUsage();
    process.exitCode = 1;
    return;
  }
  const startedAt = Date.now();
  console.log(`[jobs] running "${job.name}" once`);
  await job.run();
  console.log(`[jobs] finished "${job.name}" in ${Date.now() - startedAt}ms`);
}

function startDaemon(): void {
  const scheduler = new Scheduler();
  scheduler.start();
  const server = startHealthServer(env.JOBS_PORT, scheduler);
  console.log('[jobs] scheduler daemon running');

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[jobs] received ${signal}, shutting down`);
    scheduler.stop();
    closeServer(server)
      .then(() => prisma.$disconnect())
      .catch((error: unknown) => {
        console.error('[jobs] error during shutdown:', error);
      })
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === undefined || command === 'serve' || command === 'scheduler') {
    startDaemon();
    return; // process stays alive on the health server + cron timers
  }

  if (command === 'list') {
    printJobs('log');
    return;
  }

  if (command === 'run') {
    await runOnce(rest[0]);
    await prisma.$disconnect();
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exitCode = 1;
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error('[jobs] fatal:', error);
  void prisma.$disconnect().finally(() => process.exit(1));
});
