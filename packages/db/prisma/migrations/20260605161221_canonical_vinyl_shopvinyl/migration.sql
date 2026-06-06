-- DropForeignKey
ALTER TABLE "offers" DROP CONSTRAINT "offers_shop_id_fkey";

-- DropForeignKey
ALTER TABLE "offers" DROP CONSTRAINT "offers_vinyl_id_fkey";

-- DropIndex
DROP INDEX "offers_shop_id_idx";

-- DropIndex
DROP INDEX "offers_vinyl_id_idx";

-- DropIndex
DROP INDEX "vinyls_catalog_source_catalog_id_key";

-- AlterTable
ALTER TABLE "offers" DROP COLUMN "shop_id",
DROP COLUMN "source_url",
DROP COLUMN "vinyl_id",
ADD COLUMN     "shop_vinyl_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "vinyls" DROP COLUMN "catalog_id",
DROP COLUMN "catalog_source",
ADD COLUMN     "match_key" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "shop_vinyls" (
    "id" TEXT NOT NULL,
    "vinyl_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "source_url" TEXT,
    "raw_title" TEXT,
    "raw_artist" TEXT,
    "raw_catalog_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_vinyls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shop_vinyls_vinyl_id_idx" ON "shop_vinyls"("vinyl_id");

-- CreateIndex
CREATE INDEX "shop_vinyls_shop_id_idx" ON "shop_vinyls"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_vinyls_source_external_id_key" ON "shop_vinyls"("source", "external_id");

-- CreateIndex
CREATE INDEX "offers_shop_vinyl_id_idx" ON "offers"("shop_vinyl_id");

-- CreateIndex
CREATE UNIQUE INDEX "vinyls_match_key_key" ON "vinyls"("match_key");

-- AddForeignKey
ALTER TABLE "shop_vinyls" ADD CONSTRAINT "shop_vinyls_vinyl_id_fkey" FOREIGN KEY ("vinyl_id") REFERENCES "vinyls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_vinyls" ADD CONSTRAINT "shop_vinyls_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_shop_vinyl_id_fkey" FOREIGN KEY ("shop_vinyl_id") REFERENCES "shop_vinyls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
