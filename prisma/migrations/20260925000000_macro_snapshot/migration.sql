-- CreateTable
CREATE TABLE "MacroSnapshot" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MacroSnapshot_pkey" PRIMARY KEY ("id")
);
