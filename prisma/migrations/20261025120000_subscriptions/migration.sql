-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSentAt" TIMESTAMP(3),
    "submitterHash" TEXT,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_token_key" ON "Subscription"("token");

-- CreateIndex
CREATE INDEX "Subscription_ticker_confirmedAt_idx" ON "Subscription"("ticker", "confirmedAt");

-- CreateIndex
CREATE INDEX "Subscription_submitterHash_createdAt_idx" ON "Subscription"("submitterHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_email_ticker_key" ON "Subscription"("email", "ticker");
