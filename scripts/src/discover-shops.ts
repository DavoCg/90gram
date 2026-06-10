// discover-shops: surface candidate vinyl shops to add next.
//
// For each canonical vinyl's catalog number, this searches Google for "Vinyl {catalogNumber}",
// takes the first ~10 organic results, and extracts their domains. Aggregated across many vinyls,
// the most frequently appearing domains are the shops most worth adding a scraper spider for.
// Domains we already cover (from existing shop_vinyls.source_url) are flagged so they drop out.
//
// Search runs through a headless Chromium (Playwright), because Google no longer serves parseable
// results to plain HTTP clients: it returns a JS-only shell. A real browser executes that JS and
// renders the results we read from the DOM. We apply light stealth (a real UA, locale/viewport,
// hiding navigator.webdriver) and human-like randomized delays. This is NOT immune to Google's
// anti-bot defenses: at volume it WILL eventually serve a CAPTCHA / "unusual traffic" page. We
// detect that and report it as a blocked query rather than a silent zero. Keep --limit modest and
// --delay generous; use --headful to watch (and solve a CAPTCHA by hand) if you get blocked.
//
// First-time setup (downloads the browser binary, ~150MB):
//   pnpm --filter @getvinyls/scripts exec playwright install chromium
//
// Usage (runs against whatever DATABASE_URL points at; export a prod URL to hit prod):
//   pnpm --filter @getvinyls/scripts discover-shops -- [--limit N] [--delay MS] [--out FILE] [--headful]
import "./load-env.js";
import { writeFile } from "node:fs/promises";
import { prisma } from "@getvinyls/db";
import {
	chromium,
	type Browser,
	type BrowserContext,
	type Page,
} from "playwright";

type Args = {
	limit: number;
	delayMs: number;
	out: string | undefined;
	headful: boolean;
};

function parseArgs(argv: string[]): Args {
	let limit = 100;
	let delayMs = 6000;
	let out: string | undefined;
	let headful = false;
	for (let i = 0; i < argv.length; i++) {
		const flag = argv[i];
		const value = argv[i + 1];
		if (flag === "--limit" && value !== undefined) {
			limit = Number.parseInt(value, 10);
			i++;
		} else if (flag === "--delay" && value !== undefined) {
			delayMs = Number.parseInt(value, 10);
			i++;
		} else if (flag === "--out" && value !== undefined) {
			out = value;
			i++;
		} else if (flag === "--headful") {
			headful = true;
		}
	}
	if (!Number.isFinite(limit) || limit <= 0) limit = 100;
	if (!Number.isFinite(delayMs) || delayMs < 0) delayMs = 6000;
	return { limit, delayMs, out, headful };
}

// Domains that are never a vinyl shop worth adding (search noise / non-retail).
const NOISE_DOMAINS = new Set([
	"google.com",
	"gstatic.com",
	"googleusercontent.com",
	"youtube.com",
	"youtu.be",
	"facebook.com",
	"instagram.com",
	"twitter.com",
	"x.com",
	"wikipedia.org",
	"reddit.com",
	"tiktok.com",
	"pinterest.com",
	"spotify.com",
	"apple.com",
	"amazon.com",
]);

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reduce a hostname to its registrable-ish domain: strip "www." and keep the last two labels
// (last three for known two-level public suffixes like .co.uk). Good enough to group a shop.
const TWO_LEVEL_TLDS = new Set([
	"co.uk",
	"org.uk",
	"com.au",
	"co.jp",
	"co.nz",
	"com.br",
]);
function registrableDomain(hostname: string): string {
	const host = hostname.toLowerCase().replace(/^www\./, "");
	const parts = host.split(".");
	if (parts.length <= 2) return host;
	const lastTwo = parts.slice(-2).join(".");
	if (TWO_LEVEL_TLDS.has(lastTwo)) return parts.slice(-3).join(".");
	return lastTwo;
}

// Turn a list of result URLs (collected from the rendered page) into ordered, deduped shop
// domains. `rawCount` is how many valid http(s) URLs were present BEFORE noise/dedupe filtering,
// so the caller can tell "the page had no results" apart from "every result was filtered out".
function domainsFromUrls(urls: string[]): { domains: string[]; rawCount: number } {
	const domains: string[] = [];
	const seen = new Set<string>();
	let rawCount = 0;
	for (const raw of urls) {
		if (!raw.startsWith("http://") && !raw.startsWith("https://")) continue;
		let hostname: string;
		try {
			hostname = new URL(raw).hostname;
		} catch {
			continue;
		}
		rawCount++;
		const domain = registrableDomain(hostname);
		if (NOISE_DOMAINS.has(domain)) continue;
		if (seen.has(domain)) continue;
		seen.add(domain);
		domains.push(domain);
	}
	return { domains, rawCount };
}

// The outcome of one search. A "blocked" result is Google's CAPTCHA / "unusual traffic" wall, which
// the caller counts as a failure (and backs off on); "empty" and "filtered" are honest zero results.
type SearchOutcome =
	| { kind: "ok"; domains: string[] }
	| { kind: "blocked" }
	| { kind: "empty" }
	| { kind: "filtered"; rawCount: number };

const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Wraps a single long-lived browser/context/page. One page reused across queries keeps cookies and
// looks more like a human session than a fresh context per request.
class Searcher {
	private constructor(
		private readonly browser: Browser,
		private readonly context: BrowserContext,
		private readonly page: Page,
	) {}

	static async create(headful: boolean): Promise<Searcher> {
		const browser = await chromium.launch({
			headless: !headful,
			args: ["--disable-blink-features=AutomationControlled"],
		});
		const context = await browser.newContext({
			userAgent: USER_AGENT,
			locale: "en-US",
			timezoneId: "America/New_York",
			viewport: { width: 1280, height: 800 },
		});
		// Hide the most obvious automation tell before any page script runs.
		await context.addInitScript(() => {
			Object.defineProperty(navigator, "webdriver", { get: () => undefined });
		});
		const page = await context.newPage();
		return new Searcher(browser, context, page);
	}

	async close(): Promise<void> {
		await this.context.close();
		await this.browser.close();
	}

	// Google's EU consent interstitial blocks the results until dismissed. Click whichever
	// accept/reject control is present; ignore if there is none.
	private async dismissConsent(): Promise<void> {
		const selectors = [
			"#L2AGLb", // "Accept all" button id on the consent page
			"#W0wltc", // "Reject all"
			"button:has-text('Accept all')",
			"button:has-text('Reject all')",
		];
		for (const sel of selectors) {
			const btn = await this.page.$(sel);
			if (!btn) continue;
			try {
				await btn.click({ timeout: 3000 });
				await this.page.waitForLoadState("domcontentloaded");
			} catch {
				// consent layout changed or already gone; carry on
			}
			return;
		}
	}

	async search(query: string): Promise<SearchOutcome> {
		const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&num=10&gl=us`;
		await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
		await this.dismissConsent();

		// CAPTCHA / "unusual traffic" wall: Google redirects to /sorry/ or renders a robot notice.
		if (this.page.url().includes("/sorry/")) return { kind: "blocked" };
		const bodyText = (await this.page.textContent("body")) ?? "";
		if (/unusual traffic|are you a robot|detected unusual/i.test(bodyText)) {
			return { kind: "blocked" };
		}

		// Wait for the results container, then read every result anchor's resolved (absolute) href.
		try {
			await this.page.waitForSelector("#search a[href], #rso a[href]", {
				timeout: 8000,
			});
		} catch {
			// no results container appeared
		}
		const hrefs = await this.page.$$eval<string[], HTMLAnchorElement>(
			"#search a[href], #rso a[href]",
			(els) => els.map((el) => el.href),
		);

		const { domains, rawCount } = domainsFromUrls(hrefs);
		const top = domains.slice(0, 10);
		if (top.length > 0) return { kind: "ok", domains: top };
		if (rawCount === 0) return { kind: "empty" };
		return { kind: "filtered", rawCount };
	}
}

type DomainStat = {
	domain: string;
	vinylCount: number; // number of distinct vinyls this domain appeared for
	totalHits: number; // total appearances across all queries
	alreadyCovered: boolean;
};

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));

	// Domains we already scrape, derived from existing shop listing URLs, so we can flag them.
	const coveredRows = await prisma.shopVinyl.findMany({
		where: { sourceUrl: { not: null } },
		select: { sourceUrl: true },
		distinct: ["sourceUrl"],
	});
	const coveredDomains = new Set<string>();
	for (const { sourceUrl } of coveredRows) {
		if (!sourceUrl) continue;
		try {
			coveredDomains.add(registrableDomain(new URL(sourceUrl).hostname));
		} catch {
			// ignore unparseable stored URLs
		}
	}

	// Distinct catalog numbers from the canonical vinyls (every vinyl is catalog-keyed).
	const vinyls = await prisma.vinyl.findMany({
		where: { catalogNumber: { not: null } },
		select: { catalogNumber: true },
		distinct: ["catalogNumber"],
		take: args.limit,
		orderBy: { id: "asc" },
	});
	const catalogNumbers = vinyls
		.map((v) => v.catalogNumber)
		.filter((c): c is string => c !== null && c.trim().length > 0);

	console.log(
		`Searching ${catalogNumbers.length} catalog numbers via headless Google (base delay ${args.delayMs}ms + jitter, covered domains flagged with *)...\n`,
	);

	let searcher: Searcher;
	try {
		searcher = await Searcher.create(args.headful);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Failed to launch Chromium: ${message}`);
		console.error(
			"If the browser is not installed, run: pnpm --filter @getvinyls/scripts exec playwright install chromium",
		);
		await prisma.$disconnect();
		process.exit(1);
	}

	const stats = new Map<string, DomainStat>();
	let queried = 0;
	let failures = 0;

	try {
		for (const catalogNumber of catalogNumbers) {
			const query = `Vinyl ${catalogNumber}`;
			queried++;
			const tag = `[${queried}/${catalogNumbers.length}] "${query}"`;
			let outcome: SearchOutcome;
			try {
				outcome = await searcher.search(query);
			} catch (err) {
				failures++;
				const message = err instanceof Error ? err.message : String(err);
				console.warn(`  ${tag} failed: ${message}`);
				await sleep(args.delayMs);
				continue;
			}

			if (outcome.kind === "ok") {
				for (const domain of outcome.domains) {
					const existing = stats.get(domain);
					if (existing) {
						existing.vinylCount += 1;
						existing.totalHits += 1;
					} else {
						stats.set(domain, {
							domain,
							vinylCount: 1,
							totalHits: 1,
							alreadyCovered: coveredDomains.has(domain),
						});
					}
				}
				console.log(`  ${tag} -> ${outcome.domains.length} domains`);
			} else if (outcome.kind === "blocked") {
				// Google's anti-bot wall: count it, and back off harder before trying again.
				failures++;
				console.warn(
					`  ${tag} -> 0 domains: blocked by Google (CAPTCHA/unusual traffic). Backing off; rerun with --headful to solve by hand.`,
				);
				await sleep(args.delayMs * 4);
				continue;
			} else if (outcome.kind === "empty") {
				console.warn(
					`  ${tag} -> 0 domains: no search results for this catalog number`,
				);
			} else {
				console.warn(
					`  ${tag} -> 0 domains: all ${outcome.rawCount} results filtered out (noise/duplicates)`,
				);
			}

			// Human-like wait: base delay plus up to one extra base delay of jitter.
			if (queried < catalogNumbers.length) {
				await sleep(args.delayMs + Math.floor(Math.random() * args.delayMs));
			}
		}
	} finally {
		await searcher.close();
	}

	const ranked = [...stats.values()].sort(
		(a, b) => b.vinylCount - a.vinylCount || b.totalHits - a.totalHits,
	);

	console.log(
		`\nDone. ${queried} queried, ${failures} failed, ${ranked.length} distinct domains.\n`,
	);
	console.log(
		"Candidate shops by how many vinyls they showed up for (* = already covered):\n",
	);
	console.log("  vinyls  hits  domain");
	console.log("  ------  ----  ------");
	for (const s of ranked) {
		const flag = s.alreadyCovered ? "*" : " ";
		console.log(
			`${flag} ${String(s.vinylCount).padStart(6)}  ${String(s.totalHits).padStart(4)}  ${s.domain}`,
		);
	}

	if (args.out) {
		await writeFile(args.out, JSON.stringify(ranked, null, 2), "utf8");
		console.log(`\nWrote ${ranked.length} rows to ${args.out}`);
	}

	await prisma.$disconnect();
}

main().catch(async (err: unknown) => {
	console.error(err);
	await prisma.$disconnect();
	process.exit(1);
});
