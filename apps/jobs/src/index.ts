import './load-env.js';
import { prisma } from '@getvinyls/db';
// Importing env here validates the environment at boot (fail fast on missing/invalid vars).
import './env.js';
import { runTrackDurations } from './jobs/track-durations.js';

// The jobs registry. Each job is addressable by name from the CLI: `node dist/index.js <name>`.
// Add a new job by appending an entry here and pointing it at its `run` function.
type Job = {
  name: string;
  description: string;
  run: () => Promise<void>;
};

const jobs: readonly Job[] = [
  {
    name: 'track-durations',
    description: 'Backfill tracks.duration_seconds by reading each track preview audio.',
    run: runTrackDurations,
  },
];

function printUsage(): void {
  console.error('Usage: jobs <job-name>');
  console.error('Available jobs:');
  for (const job of jobs) {
    console.error(`  ${job.name}  ${job.description}`);
  }
}

async function main(): Promise<void> {
  const name = process.argv[2];
  if (name === undefined) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const job = jobs.find((candidate) => candidate.name === name);
  if (job === undefined) {
    console.error(`Unknown job: ${name}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  console.log(`[jobs] starting "${job.name}"`);
  await job.run();
  console.log(`[jobs] finished "${job.name}" in ${Date.now() - startedAt}ms`);
}

main()
  .catch((error: unknown) => {
    console.error('[jobs] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
