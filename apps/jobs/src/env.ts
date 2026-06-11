import { z } from "zod";

// Env is loaded by ./load-env.ts, which the entrypoint imports before this module.
// Typed env loader: validate at boot, fail fast on missing/invalid vars (no scattered
// process.env reads). Mirrors the apps/api env pattern.
const EnvSchema = z.object({
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),

	// The scheduler daemon binds a small HTTP liveness endpoint here (GET /health) so the platform
	// can health-check the always-on machine and report job status.
	JOBS_PORT: z.coerce.number().int().positive().default(8080),
	// IANA timezone the cron schedules are evaluated in (e.g. "Europe/Paris"). UTC by default so a
	// schedule means the same thing regardless of where the machine runs.
	JOB_TIMEZONE: z.string().min(1).default("UTC"),

	// Cron expression (5-field) for the track-durations job in scheduler mode. Default: daily 03:00.
	TRACK_DURATIONS_CRON: z.string().min(1).default("* * * * *"),

	// How many preview downloads run at once. Keep modest to stay polite to the preview hosts.
	JOB_CONCURRENCY: z.coerce.number().int().positive().default(8),
	// How many candidate tracks are pulled from the DB per page (keyset paginated).
	JOB_BATCH_SIZE: z.coerce.number().int().positive().default(100),
	// Abort a single preview download after this many ms so one slow host cannot stall the run.
	JOB_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
	// Optional cap on how many tracks a single run will process (handy for a first smoke run).
	// Unset means process every candidate.
	JOB_MAX_TRACKS: z.coerce.number().int().positive().optional(),

	// Scrapyd (apps/scraper) ----------------------------------------------------------------------
	// Scrapyd has no scheduler of its own, so this daemon drives it: each scrape-<spider> job POSTs a
	// run to schedule.json on its cron. SCRAPYD_URL is the daemon's base URL; the default is the
	// always-on getvinyls-scraper Fly app reached over the private network (no public port).
	SCRAPYD_URL: z.string().url().default("http://getvinyls-scraper.internal:6800"),
	// The Scrapy project name Scrapyd serves (matches apps/scraper/scrapy.cfg + the baked egg).
	SCRAPYD_PROJECT: z.string().min(1).default("getvinyls_scraper"),

	// Per-spider cron expressions (5-field, evaluated in JOB_TIMEZONE). Every 30 minutes for all
	// shops; the scheduler also fires each shop scrape once at launch so the first crawl does not
	// wait for the next tick (see jobs/registry.ts runOnStart + scheduler.ts).
	SCRAPE_DISCOGS_CRON: z.string().min(1).default("*/30 * * * *"),
	SCRAPE_COLDCUTSHOTWAX_CRON: z.string().min(1).default("*/30 * * * *"),
	SCRAPE_DEEJAY_CRON: z.string().min(1).default("*/30 * * * *"),
	SCRAPE_DANCINGVINYL_CRON: z.string().min(1).default("*/30 * * * *"),

	// How often to poll Scrapyd's listjobs.json while waiting for a crawl to finish, and the longest a
	// single crawl may run before the job gives up waiting (the crawl is not killed, the wait just ends
	// so a stuck crawl cannot pin the scheduler slot forever).
	SCRAPE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
	SCRAPE_MAX_WAIT_MS: z.coerce.number().int().positive().default(1_800_000),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
	console.error("Invalid environment configuration:");
	console.error(z.treeifyError(parsed.error));
	process.exit(1);
}

export const env = parsed.data;
