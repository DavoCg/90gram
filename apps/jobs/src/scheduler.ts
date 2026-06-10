import { Cron } from 'croner';
import { env } from './env.js';
import { jobs, type Job } from './jobs/registry.js';

// In-process cron scheduler. The jobs machine stays up and this owns the timing: one Cron per job,
// each firing job.run() on its schedule. `protect: true` skips a tick if the previous run of the
// same job is still going, so a slow run never overlaps itself. A throwing run is caught and
// recorded; it never tears down the daemon.

export type JobRunState = {
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  ok: boolean | null;
  error: string | null;
};

export type JobStatus = {
  name: string;
  description: string;
  cron: string;
  timezone: string;
  running: boolean;
  nextRun: string | null;
  lastRun: JobRunState | null;
};

export class Scheduler {
  private readonly crons: Cron[] = [];
  private readonly lastRun = new Map<string, JobRunState>();

  start(): void {
    for (const job of jobs) {
      const cron = new Cron(
        job.cron,
        { name: job.name, timezone: env.JOB_TIMEZONE, protect: true },
        () => this.execute(job),
      );
      this.crons.push(cron);
      const next = cron.nextRun();
      console.log(
        `[scheduler] registered "${job.name}" cron="${job.cron}" tz=${env.JOB_TIMEZONE} ` +
          `next=${next === null ? 'never' : next.toISOString()}`,
      );
    }
  }

  private async execute(job: Job): Promise<void> {
    const startedAt = new Date();
    this.lastRun.set(job.name, {
      startedAt: startedAt.toISOString(),
      finishedAt: null,
      durationMs: null,
      ok: null,
      error: null,
    });
    console.log(`[scheduler] starting "${job.name}"`);
    try {
      await job.run();
      const finishedAt = new Date();
      this.lastRun.set(job.name, {
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        ok: true,
        error: null,
      });
      console.log(`[scheduler] finished "${job.name}" in ${finishedAt.getTime() - startedAt.getTime()}ms`);
    } catch (error) {
      const finishedAt = new Date();
      const message = error instanceof Error ? error.message : String(error);
      this.lastRun.set(job.name, {
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        ok: false,
        error: message,
      });
      console.error(`[scheduler] job "${job.name}" failed:`, error);
    }
  }

  status(): JobStatus[] {
    return this.crons.map((cron, index) => {
      const job = jobs[index];
      const next = cron.nextRun();
      return {
        name: job?.name ?? cron.name ?? '',
        description: job?.description ?? '',
        cron: job?.cron ?? '',
        timezone: env.JOB_TIMEZONE,
        running: cron.isBusy(),
        nextRun: next === null ? null : next.toISOString(),
        lastRun: this.lastRun.get(job?.name ?? '') ?? null,
      };
    });
  }

  isAnyJobRunning(): boolean {
    return this.crons.some((cron) => cron.isBusy());
  }

  stop(): void {
    for (const cron of this.crons) cron.stop();
  }
}
