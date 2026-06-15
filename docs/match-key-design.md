# Vinyl match key: design comparison and decision

Status: implemented (2026-06-15), pending a full wipe + re-scrape to populate the new keys.
Owner: scraper + db.

## The problem

`Vinyl` identity is `matchKey`, defined today as the normalized catalog number and nothing
else (`_match_key` in `apps/scraper/getvinyls_scraper/pipelines.py`, `schema.prisma` Vinyl doc).
Catalog numbers are only unique within a label, not globally, so unrelated releases that share a
catalog number collapse into one `Vinyl`. Symptoms: wrong offers on a detail page, a wrong
`lowestPrice`, and a title/artist that flip-flops on every scrape (last writer wins).

Worked example, vinyl `f997d2fb8ab047659336e6cd1e155131`, `matchKey = DR004`. Five different
releases on five different labels, all carrying catalog `DR004` (several labels abbreviate to
"DR" and each numbered its release 004), were merged into one row:

| artist / title              | label (live)            | catalog |
| --------------------------- | ----------------------- | ------- |
| Ntrip, DR:004               | DU:RA                   | DR:004  |
| Dabeull, Intimate Fonk      | Dabeull Records         | DR004   |
| Lesser Of, Within My Frag.  | Depth.Request           | DR004   |
| NINA INDI, Drive EP         | Dionysian Mysteries     | DR004   |
| Duke Hugh, Common Ground EP | Dance Regular Recordings| DR004   |

## Scope of the bug

- 1,879 catalog clusters mix 2+ genuinely distinct artists (strict normalization). Under a
  looser normalization the count is 3,455; either way it is several thousand polluted vinyls.
- Worst offenders are short, reused catalog numbers: `A5`, `001`, `B1`, `A20`, `AR001`.

## Two failure directions

Every candidate trades between two opposite errors:

- False merge: different releases share a key, so one page shows offers for many records. This is
  today's bug. It is the worse error for this app, because cross-shop price comparison becomes wrong.
- False split: the same release gets different keys across shops, so it appears as duplicate vinyls
  and the cheaper copy is hidden.

## Candidates measured

All counts are against the live production data. "Over-split" = clusters where one real release
would be split because shops disagree on the added field. Normalization mirrors `_normalize_key_part`
(uppercase, drop non-alphanumeric).

| key                       | unmatchable listings | false splits | true residual merges        |
| ------------------------- | -------------------- | ------------ | --------------------------- |
| catalog only (today)      | 0                    | 0            | ~1,879 clusters (the bug)   |
| title + catalog           | 0                    | 1,844        | generic-title merges remain |
| first-track + catalog     | 10,272 (15.9%)       | 1,077        | 739                         |
| artist + catalog          | 0                    | 960          | ~0 (see note)               |
| label + catalog           | 0 (label 99.95% pop) | not measured | not measured                |

Notes:

- artist + catalog "true residual merges ~0": the naive upper bound is 1,843 (cat,artist) groups
  that span 2+ titles, but a random sample of those is entirely the same release with title
  decoration (`Waves` vs `Waves LP 2x12"`, `Vol 3` vs `Volume 3`). Almost none are genuinely
  different releases, so the real cross-release merge rate is negligible.
- title + catalog is the worst add-on: titles carry the most cross-shop decoration (format
  suffixes, `(LP)`, `(remastered)`, casing, punctuation).
- first-track + catalog is disqualified: 1 in 6 listings have no tracklist at all, so they would
  be dropped, and it still leaves 739 cross-release merges.
- label + catalog cannot be measured today: `shop_vinyls` has no `raw_label`, and `vinyls.label`
  is one row per catalog (last writer wins), so the per-release labels needed to measure it were
  destroyed by the very merges we are fixing. Label coverage is 99.95% and label text is fairly
  clean in aggregate, but cross-shop label-text variance is real: the same Dabeull release reports
  `Dabeull Records` on deejay and `Dabeull` (Shopify vendor) on coldcutshotwax, which a naive
  label key would split.

## The multi-key idea, and why pure OR is wrong

Proposal considered: give each listing several keys and match if at least one matches.

- If bare catalog stays one of the keys, nothing improves: every `DR004` listing still shares it,
  so all five releases re-merge. The bug is untouched.
- OR-matching is only as precise as its loosest key, and it chains transitively. Matching becomes a
  graph (listing = node, shared key = edge) and a `Vinyl` becomes a connected component. A single
  bridge listing (a compilation tagged with one artist, a generic reused title) can fuse two
  unrelated releases: A matches B on one key, B matches C on another, A and C share nothing yet all
  collapse. The result is order-dependent and non-deterministic, and over-merges are hard to detect
  and unwind. It also requires a real rewrite (a keys table plus union-find merge of existing
  vinyls, moving offers/tracks/shop_vinyls and reconciling canonical fields).

## Recommended approach: threshold, not union

Use multiple signals with a threshold rather than OR. Require the strong signal plus one
corroborating signal:

    merge if catalog matches AND (artist matches OR label matches)

This keeps the tolerance the OR idea was after (artist or label can carry the match, so cross-shop
variance in one field does not split a release) without collapsing to the loosest key and without
transitive chaining.

- Floor (measured): `catalog AND artist`. Splits all 1,879 polluted clusters, ~0 true residual
  merges, costs 960 false splits where artist text varies across shops.
- The `OR label` half is designed to recover most of those 960 (a release whose artist text differs
  across shops, like `Prince And The Revolution` vs `Prince, The Revolution`, usually agrees on
  label). Added merge risk is small: it requires two different releases to share both a catalog and
  a label, which means a label reusing its own catalog number (rare, usually a data error).

## Decision and next steps

Direction: identity is `catalog AND (artist OR label)`. Shipped in one change (the owner chose to
wipe and re-scrape rather than backfill, so no in-place re-split was needed).

What landed:

- `migrations/20260615000000_matchkey_artist_label`: drops the `match_key` unique index, adds
  `vinyls.artist_key` / `vinyls.label_key` and `shop_vinyls.raw_label`, and adds the two composite
  match indexes.
- `schema.prisma`: `Vinyl.matchKey` becomes `catalogKey` (same `match_key` column, no longer
  unique) plus `artistKey` / `labelKey`; `ShopVinyl.rawLabel` added; identity doc rewritten.
- `pipelines.py`: `_artist_key` and `_label_key` (label type-words like `Records`/`Recordings`/
  `Music`/`Ltd` and any sub-label after the first comma stripped, so `Dabeull Records` and `Dabeull`
  collapse). `_upsert_vinyl` is now match-or-create: a per-catalog transaction advisory lock, then
  `WHERE match_key = ? AND (artist_key = ? OR label_key = ?)`, else insert. Match keys are written
  once on create and never overwritten, so a later listing's variant spelling cannot shift an
  existing Vinyl's keys.

Operational note: the new keys only exist for rows written after this change, so it requires a wipe
and full re-scrape (or a backfill) to take effect. The owner wiped the scraper-owned tables (vinyls,
shop_vinyls, tracks, offers, prices, vinyl_genres, shops, favorites), keeping the curated `genres`
(the `validated` flag) and all auth tables.

Follow-up worth doing once data is back: re-run the artist/label over-split queries with the real
per-listing `raw_label` to measure `catalog AND (artist OR label)` exactly, and tune
`_LABEL_NOISE_RE` if needed.
