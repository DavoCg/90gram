import { prisma } from "@getvinyls/db";
import { parseBuffer } from "music-metadata";
import { forEachWithConcurrency } from "../concurrency.js";
import { env } from "../env.js";

// Backfill `tracks.duration_seconds` from each track's preview audio.
//
// The scraper often writes a `previewUrl` without a duration. This job fetches the preview, reads
// its duration from the audio container metadata, and writes it back. It is a pure row-writer: it
// only UPDATEs an existing column, so Prisma stays the sole schema owner (no DDL here).
//
// Idempotent and resumable: it only ever looks at tracks with a preview and no duration yet, so a
// rerun picks up exactly what is still missing (including ones that failed last time). Within a run
// it keyset-paginates by `id`, so a track that fails to parse is left null and simply retried on the
// next run rather than looping forever inside this one.

type Candidate = { id: string; previewUrl: string };

// Read a preview's duration in whole seconds, or null if it cannot be determined. Network and parse
// failures are swallowed (logged) so one bad preview never aborts the batch; the row stays null and
// is retried on a later run.
async function fetchDurationSeconds(url: string): Promise<number | null> {
	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		env.JOB_REQUEST_TIMEOUT_MS,
	);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) {
			console.warn(`[track-durations] fetch failed (${res.status}) for ${url}`);
			return null;
		}
		const buffer = new Uint8Array(await res.arrayBuffer());
		const contentType = res.headers.get("content-type") ?? undefined;
		const metadata = await parseBuffer(buffer, {
			mimeType: contentType,
			size: buffer.byteLength,
		});
		const duration = metadata.format.duration;
		if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
			console.warn(`[track-durations] no usable duration in ${url}`);
			return null;
		}
		return Math.round(duration);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`[track-durations] error reading ${url}: ${message}`);
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

export async function runTrackDurations(): Promise<void> {
	let updated = 0;
	let failed = 0;
	let scanned = 0;
	let cursor: string | undefined;

	for (;;) {
		const remaining =
			env.JOB_MAX_TRACKS === undefined
				? env.JOB_BATCH_SIZE
				: env.JOB_MAX_TRACKS - scanned;
		if (remaining <= 0) break;
		const take = Math.min(env.JOB_BATCH_SIZE, remaining);

		const rows = await prisma.track.findMany({
			where: { previewUrl: { not: null }, durationSeconds: null },
			select: { id: true, previewUrl: true },
			orderBy: { id: "asc" },
			take,
			...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
		});
		if (rows.length === 0) break;

		cursor = rows[rows.length - 1]?.id;
		scanned += rows.length;

		// `previewUrl: { not: null }` guarantees a non-null url at runtime; narrow it for the types.
		const batch: Candidate[] = rows.flatMap((row) =>
			row.previewUrl === null
				? []
				: [{ id: row.id, previewUrl: row.previewUrl }],
		);

		await forEachWithConcurrency(batch, env.JOB_CONCURRENCY, async (track) => {
			const durationSeconds = await fetchDurationSeconds(track.previewUrl);
			if (durationSeconds === null) {
				failed += 1;
				return;
			}
			await prisma.track.update({
				where: { id: track.id },
				data: { durationSeconds },
			});
			updated += 1;
		});

		console.log(
			`[track-durations] progress: scanned=${scanned} updated=${updated} failed=${failed}`,
		);
	}

	console.log(
		`[track-durations] done: scanned=${scanned} updated=${updated} failed=${failed}`,
	);
}
