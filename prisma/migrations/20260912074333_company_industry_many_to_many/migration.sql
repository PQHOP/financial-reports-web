-- CreateTable
CREATE TABLE "Industry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "country" TEXT NOT NULL,
    "exchange" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "author" TEXT NOT NULL DEFAULT 'Claude',
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CompanyToIndustry" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CompanyToIndustry_A_fkey" FOREIGN KEY ("A") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CompanyToIndustry_B_fkey" FOREIGN KEY ("B") REFERENCES "Industry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Industry_slug_key" ON "Industry"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Report_companyId_year_period_key" ON "Report"("companyId", "year", "period");

-- CreateIndex
CREATE UNIQUE INDEX "_CompanyToIndustry_AB_unique" ON "_CompanyToIndustry"("A", "B");

-- CreateIndex
CREATE INDEX "_CompanyToIndustry_B_index" ON "_CompanyToIndustry"("B");
