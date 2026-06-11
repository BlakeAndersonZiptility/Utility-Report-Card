-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "resumeToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "rubricVersion" TEXT NOT NULL DEFAULT '2.1',
    "systemName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pwsId" TEXT,
    "connections" INTEGER,
    "email" TEXT,
    "contactName" TEXT,
    "role" TEXT,
    "consentBenchmarking" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB NOT NULL,
    "overall" TEXT,
    "technical" TEXT,
    "managerial" TEXT,
    "financial" TEXT,
    "practicalGrade" TEXT,
    "redlineFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_resumeToken_key" ON "Assessment"("resumeToken");

-- CreateIndex
CREATE INDEX "Assessment_state_idx" ON "Assessment"("state");

-- CreateIndex
CREATE INDEX "Assessment_email_idx" ON "Assessment"("email");

-- CreateIndex
CREATE INDEX "Assessment_status_completedAt_idx" ON "Assessment"("status", "completedAt");
