import { env } from "../env.js";

// Minimal Scrapyd client. Scrapyd (apps/scraper) is a daemon with no scheduler of its own: you POST a
// spider run to schedule.json and poll listjobs.json for completion. This jobs daemon owns the timing
// and drives Scrapyd over Fly's private network (getvinyls-scraper.internal:6800), so Scrapyd never
// needs a public port. Each crawl writes idempotently to the shared Postgres via the scraper's
// PostgresPipeline, so a retried or overlapping run is safe.

type ScheduleResponse = { status: string; jobid?: string; message?: string };
type JobRef = { id: string };
type ListJobsResponse = {
	status: string;
	pending: JobRef[];
	running: JobRef[];
	finished: JobRef[];
};

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

// Queue a spider on Scrapyd and return its jobid. Throws on a transport error or a non-"ok" status.
async function postSchedule(spider: string): Promise<string> {
	const body = new URLSearchParams({
		project: env.SCRAPYD_PROJECT,
		spider,
	});
	const res = await fetch(`${env.SCRAPYD_URL}/schedule.json`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body,
	});
	if (!res.ok) {
		throw new Error(`scrapyd schedule.json returned HTTP ${res.status}`);
	}
	const data = (await res.json()) as ScheduleResponse;
	if (data.status !== "ok" || data.jobid === undefined) {
		throw new Error(
			`scrapyd refused to schedule "${spider}": ${data.message ?? data.status}`,
		);
	}
	return data.jobid;
}

type JobState = "pending" | "running" | "finished";

// Where the given jobid currently sits in Scrapyd's queues. A jobid Scrapyd no longer lists (it trims
// old finished jobs) is treated as finished: it is no longer pending or running, which is all we wait on.
async function jobState(jobid: string): Promise<JobState> {
	const url = `${env.SCRAPYD_URL}/listjobs.json?project=${encodeURIComponent(
		env.SCRAPYD_PROJECT,
	)}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`scrapyd listjobs.json returned HTTP ${res.status}`);
	}
	const data = (await res.json()) as ListJobsResponse;
	if (data.running.some((job) => job.id === jobid)) return "running";
	if (data.pending.some((job) => job.id === jobid)) return "pending";
	return "finished";
}

// Schedule a spider and wait until Scrapyd reports it finished (or SCRAPE_MAX_WAIT_MS elapses).
// Waiting keeps the scheduler's per-job no-overlap guard meaningful and lets /health report real run
// timing. Note: Scrapyd's listjobs.json does not expose per-job success/failure, so "finished" is
// reported here as success; a crawl that errors surfaces in the Scrapyd logs (and any spidermon
// checks), not as a thrown error here. A wait that times out DOES throw, so a stuck crawl is visible.
export async function scrapeSpider(spider: string): Promise<void> {
	const jobid = await postSchedule(spider);
	console.log(`[scrape:${spider}] scheduled on scrapyd (jobid=${jobid})`);

	const deadline = Date.now() + env.SCRAPE_MAX_WAIT_MS;
	for (;;) {
		await sleep(env.SCRAPE_POLL_INTERVAL_MS);
		const state = await jobState(jobid);
		if (state === "finished") {
			console.log(`[scrape:${spider}] finished (jobid=${jobid})`);
			return;
		}
		if (Date.now() > deadline) {
			throw new Error(
				`scrape "${spider}" still ${state} after ${env.SCRAPE_MAX_WAIT_MS}ms (jobid=${jobid})`,
			);
		}
	}
}
