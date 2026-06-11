-- AlterTable
-- New column defaults to false, so every existing genre starts unvalidated (hidden from the public
-- API) until a human validates it. Newly scraped genres also start false.
ALTER TABLE "genres" ADD COLUMN     "validated" BOOLEAN NOT NULL DEFAULT false;
