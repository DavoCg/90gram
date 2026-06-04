-- CreateTable
CREATE TABLE "records" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "year" INTEGER,
    "cover_art_url" TEXT,
    "preview_url" TEXT,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "source_url" TEXT,
    "price" DECIMAL(10,2),
    "currency" TEXT,
    "availability" TEXT,
    "scraped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "records_source_idx" ON "records"("source");

-- CreateIndex
CREATE UNIQUE INDEX "records_source_external_id_key" ON "records"("source", "external_id");
