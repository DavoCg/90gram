-- Tracks now belong to a shop_vinyl instead of directly to a vinyl. Existing rows have no
-- shop_vinyl association to back-fill, and tracks are fully reproducible by re-running the scraper,
-- so we clear the table before adding the NOT NULL shop_vinyl_id (otherwise the ADD COLUMN fails on
-- any populated table). Re-scrape after deploy to repopulate. Track-level favorites cascade away
-- (Favorite.track ON DELETE CASCADE); vinyl favorites are unaffected.
DELETE FROM "tracks";

-- DropForeignKey
ALTER TABLE "tracks" DROP CONSTRAINT "tracks_vinyl_id_fkey";

-- AlterTable
ALTER TABLE "tracks" ADD COLUMN     "shop_vinyl_id" TEXT NOT NULL,
ALTER COLUMN "vinyl_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "tracks_shop_vinyl_id_idx" ON "tracks"("shop_vinyl_id");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_shop_vinyl_id_position_key" ON "tracks"("shop_vinyl_id", "position");

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_shop_vinyl_id_fkey" FOREIGN KEY ("shop_vinyl_id") REFERENCES "shop_vinyls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_vinyl_id_fkey" FOREIGN KEY ("vinyl_id") REFERENCES "vinyls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
