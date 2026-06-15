-- Vinyl identity moves from "catalog number only" to a match rule: catalog AND (artist OR label).
-- A bare catalog number is only unique within a label (many labels reuse "001", "DR004", ...), so
-- catalog-only collapsed unrelated releases into one Vinyl. See docs/match-key-design.md.

-- match_key is no longer a unique identity; it is just the normalized catalog key now.
DROP INDEX "vinyls_match_key_key";

-- Normalized match keys the scraper sets. Nullable: a Vinyl may have no label, and existing rows
-- (if any) get NULL until re-scraped.
ALTER TABLE "vinyls" ADD COLUMN "artist_key" TEXT;
ALTER TABLE "vinyls" ADD COLUMN "label_key" TEXT;

-- Per-listing label, kept alongside the other raw_* values for transparency and re-matching.
ALTER TABLE "shop_vinyls" ADD COLUMN "raw_label" TEXT;

-- Back the match-or-create lookup: WHERE match_key = ? AND (artist_key = ? OR label_key = ?).
CREATE INDEX "vinyls_match_key_artist_key_idx" ON "vinyls"("match_key", "artist_key");
CREATE INDEX "vinyls_match_key_label_key_idx" ON "vinyls"("match_key", "label_key");
