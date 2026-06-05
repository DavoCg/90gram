/*
  Warnings:

  - You are about to drop the `records` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "stock_status" AS ENUM ('in_stock', 'out_of_stock', 'preorder', 'unknown');

-- DropTable
DROP TABLE "records";

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinyls" (
    "id" TEXT NOT NULL,
    "catalog_source" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "year" INTEGER,
    "cover_art_url" TEXT,
    "label" TEXT,
    "catalog_number" TEXT,
    "format" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vinyls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinyl_genres" (
    "vinyl_id" TEXT NOT NULL,
    "genre_id" TEXT NOT NULL,

    CONSTRAINT "vinyl_genres_pkey" PRIMARY KEY ("vinyl_id","genre_id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "vinyl_id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "preview_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "vinyl_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "source_url" TEXT,
    "stock_status" "stock_status" NOT NULL DEFAULT 'unknown',
    "condition" TEXT,
    "current_price" DECIMAL(10,2),
    "current_currency" TEXT,
    "scraped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shops_slug_key" ON "shops"("slug");

-- CreateIndex
CREATE INDEX "vinyls_artist_idx" ON "vinyls"("artist");

-- CreateIndex
CREATE UNIQUE INDEX "vinyls_catalog_source_catalog_id_key" ON "vinyls"("catalog_source", "catalog_id");

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE INDEX "vinyl_genres_genre_id_idx" ON "vinyl_genres"("genre_id");

-- CreateIndex
CREATE INDEX "tracks_vinyl_id_idx" ON "tracks"("vinyl_id");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_vinyl_id_position_key" ON "tracks"("vinyl_id", "position");

-- CreateIndex
CREATE INDEX "offers_vinyl_id_idx" ON "offers"("vinyl_id");

-- CreateIndex
CREATE INDEX "offers_shop_id_idx" ON "offers"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "offers_source_external_id_key" ON "offers"("source", "external_id");

-- CreateIndex
CREATE INDEX "prices_offer_id_observed_at_idx" ON "prices"("offer_id", "observed_at");

-- AddForeignKey
ALTER TABLE "vinyl_genres" ADD CONSTRAINT "vinyl_genres_vinyl_id_fkey" FOREIGN KEY ("vinyl_id") REFERENCES "vinyls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinyl_genres" ADD CONSTRAINT "vinyl_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_vinyl_id_fkey" FOREIGN KEY ("vinyl_id") REFERENCES "vinyls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_vinyl_id_fkey" FOREIGN KEY ("vinyl_id") REFERENCES "vinyls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
