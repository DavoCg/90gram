import { env } from '../env.js';
import { scrapeSpider } from './scrapyd.js';
import { runTrackDurations } from './track-durations.js';
import { runReindexVinyls } from './reindex-vinyls.js';

// The single source of truth for what jobs exist. Both the scheduler (cron mode) and the one-off
// CLI runner read from here. Each job carries its cron expression so the always-on daemon knows
// when to fire it; the expression is sourced from env so it is tunable without a code change.
export type Job = {
  name: string;
  description: string;
  // 5-field cron expression, evaluated in env.JOB_TIMEZONE by the scheduler.
  cron: string;
  // When true, the scheduler also fires this job once at daemon launch (in addition to its cron),
  // so the first run does not wait for the next tick.
  runOnStart?: boolean;
  run: () => Promise<void>;
};

// A scrape-<spider> job: on its cron it asks Scrapyd (apps/scraper) to run the spider and waits for
// it to finish. Scrapyd is the daemon that actually crawls; this daemon only owns the timing. Flagged
// runOnStart so a fresh deploy kicks one crawl immediately rather than waiting up to a full interval.
function spiderJob(spider: string, shop: string, cron: string): Job {
  return {
    name: `scrape-${spider}`,
    description: `Crawl ${shop} via Scrapyd (spider "${spider}") into Postgres.`,
    cron,
    runOnStart: true,
    run: () => scrapeSpider(spider),
  };
}

export const jobs: readonly Job[] = [
  {
    name: 'track-durations',
    description: 'Backfill tracks.duration_seconds by reading each track preview audio.',
    cron: env.TRACK_DURATIONS_CRON,
    run: runTrackDurations,
  },
  {
    name: 'reindex-vinyls',
    description: 'Rebuild the Meilisearch vinyls index from Postgres (derived, additive upsert).',
    cron: env.REINDEX_VINYLS_CRON,
    // Build the index once on launch so search works on a fresh deploy without waiting for the cron.
    runOnStart: true,
    run: runReindexVinyls,
  },
  spiderJob('discogs', 'Discogs', env.SCRAPE_DISCOGS_CRON),
  spiderJob('coldcutshotwax', 'ColdCuts // HotWax', env.SCRAPE_COLDCUTSHOTWAX_CRON),
  spiderJob('deejay', 'deejay.de', env.SCRAPE_DEEJAY_CRON),
  spiderJob('dancingvinyl', 'Dancing Vinyl', env.SCRAPE_DANCINGVINYL_CRON),
];

export function findJob(name: string): Job | undefined {
  return jobs.find((job) => job.name === name);
}
