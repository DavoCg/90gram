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
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
	console.error("Invalid environment configuration:");
	console.error(z.treeifyError(parsed.error));
	process.exit(1);
}

export const env = parsed.data;
