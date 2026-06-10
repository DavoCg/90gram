import { env } from '../env.js';
import { runTrackDurations } from './track-durations.js';

// The single source of truth for what jobs exist. Both the scheduler (cron mode) and the one-off
// CLI runner read from here. Each job carries its cron expression so the always-on daemon knows
// when to fire it; the expression is sourced from env so it is tunable without a code change.
export type Job = {
  name: string;
  description: string;
  // 5-field cron expression, evaluated in env.JOB_TIMEZONE by the scheduler.
  cron: string;
  run: () => Promise<void>;
};

export const jobs: readonly Job[] = [
  {
    name: 'track-durations',
    description: 'Backfill tracks.duration_seconds by reading each track preview audio.',
    cron: env.TRACK_DURATIONS_CRON,
    run: runTrackDurations,
  },
];

export function findJob(name: string): Job | undefined {
  return jobs.find((job) => job.name === name);
}
