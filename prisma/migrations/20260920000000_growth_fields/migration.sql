-- CreateEnum
CREATE TYPE "ArticleKind" AS ENUM ('GUIDE', 'PREVIEW', 'COMPARISON', 'SCORECARD');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "metrics" JSONB,
ADD COLUMN     "socialPostedAt" TIMESTAMP(3),
ADD COLUMN     "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "ArticleKind" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "tickers" TEXT[],
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_kind_publishedAt_idx" ON "Article"("kind", "publishedAt");


-- Reports published before this migration must not be announced by the
-- social cron; only reports published from here on should be.
UPDATE "Report" SET "socialPostedAt" = NOW();
