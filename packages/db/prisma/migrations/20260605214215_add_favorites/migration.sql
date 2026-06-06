-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vinyl_id" TEXT,
    "track_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_vinyl_id_key" ON "favorites"("user_id", "vinyl_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_track_id_key" ON "favorites"("user_id", "track_id");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_vinyl_id_fkey" FOREIGN KEY ("vinyl_id") REFERENCES "vinyls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A favorite targets EXACTLY ONE of a vinyl or a track (never both, never neither).
-- Not expressible in the Prisma schema, so it is enforced here as a CHECK constraint.
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_exactly_one_target"
    CHECK ((("vinyl_id" IS NOT NULL)::int + ("track_id" IS NOT NULL)::int) = 1);
