-- CreateEnum
CREATE TYPE "ReportOrigin" AS ENUM ('ADMIN', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'PUBLISHED');

-- DropIndex
DROP INDEX "Report_companyId_year_period_key";

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "authorEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "origin" "ReportOrigin" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "submitterHash" TEXT;

-- CreateIndex
CREATE INDEX "Report_origin_status_publishedAt_idx" ON "Report"("origin", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "Report_submitterHash_publishedAt_idx" ON "Report"("submitterHash", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_companyId_year_period_authorEmail_key" ON "Report"("companyId", "year", "period", "authorEmail");

