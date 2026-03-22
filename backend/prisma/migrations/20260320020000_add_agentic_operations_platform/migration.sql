-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('PLANNING', 'EXECUTING', 'AWAITING_APPROVAL', 'REVIEWING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'COMPLETE', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MemoryScope" AS ENUM ('GLOBAL', 'GOAL', 'CONTACT');

-- CreateEnum
CREATE TYPE "WatchTriggerType" AS ENUM ('CRON', 'THRESHOLD', 'WEBHOOK_EVENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskRecurrence" AS ENUM ('ONCE', 'INTERVAL', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "TaskEvidenceType" AS ENUM ('PHOTO', 'TEXT', 'PHOTO_AND_TEXT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VETTING', 'PASSED', 'FAILED', 'MISSED', 'RESUBMITTED');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ONBOARDING');

-- AlterEnum
ALTER TYPE "NodeType" ADD VALUE 'ORCHESTRATOR';
ALTER TYPE "NodeType" ADD VALUE 'REFLECT';
ALTER TYPE "NodeType" ADD VALUE 'APPROVAL_GATE';
ALTER TYPE "NodeType" ADD VALUE 'REPORT';
ALTER TYPE "NodeType" ADD VALUE 'AGENT_WATCH';

-- AlterTable
ALTER TABLE "support_chat_sessions" ADD COLUMN "flowState" JSONB;

-- CreateTable
CREATE TABLE "agent_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'PLANNING',
    "decomposedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reportingChannelId" TEXT,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "currentRetries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tasks" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAgent" TEXT,
    "tool" TEXT,
    "input" JSONB,
    "output" JSONB,
    "blockerReason" TEXT,
    "dependsOn" TEXT[],
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "retries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "scope" "MemoryScope" NOT NULL DEFAULT 'GLOBAL',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "expiresAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_watches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "WatchTriggerType" NOT NULL,
    "cronExpression" TEXT,
    "thresholdCondition" JSONB,
    "actionWorkflowId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_watches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supportAgentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "evidenceType" "TaskEvidenceType" NOT NULL DEFAULT 'PHOTO',
    "recurrenceType" "TaskRecurrence" NOT NULL DEFAULT 'DAILY',
    "recurrenceInterval" INTEGER,
    "scheduledTimes" JSONB NOT NULL DEFAULT '[]',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "acceptanceRules" JSONB NOT NULL DEFAULT '[]',
    "scoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "resubmissionAllowed" BOOLEAN NOT NULL DEFAULT true,
    "reportTime" TEXT NOT NULL DEFAULT '18:00',
    "reportChannelId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "human_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_workers" (
    "id" TEXT NOT NULL,
    "humanTaskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "platform" "ChatPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "supportChannelId" TEXT,
    "role" TEXT,
    "status" "WorkerStatus" NOT NULL DEFAULT 'ONBOARDING',
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "human_workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_submissions" (
    "id" TEXT NOT NULL,
    "humanTaskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "latenessSeconds" INTEGER,
    "imageUrl" TEXT,
    "rawMessage" TEXT,
    "aiScore" INTEGER,
    "aiFindings" TEXT,
    "aiFeedback" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "vetAttempts" INTEGER NOT NULL DEFAULT 0,
    "reportIncluded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_compliance_reports" (
    "id" TEXT NOT NULL,
    "humanTaskId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "summaryMarkdown" TEXT NOT NULL,
    "totalSubmissions" INTEGER NOT NULL DEFAULT 0,
    "missedCount" INTEGER NOT NULL DEFAULT 0,
    "avgScore" DOUBLE PRECISION,
    "passRate" DOUBLE PRECISION,
    "flaggedWorkerIds" TEXT[],
    "deliveredAt" TIMESTAMP(3),
    "deliveredTo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_compliance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_goals_userId_idx" ON "agent_goals"("userId");

-- CreateIndex
CREATE INDEX "agent_goals_status_idx" ON "agent_goals"("status");

-- CreateIndex
CREATE INDEX "agent_tasks_goalId_idx" ON "agent_tasks"("goalId");

-- CreateIndex
CREATE INDEX "agent_tasks_status_idx" ON "agent_tasks"("status");

-- CreateIndex
CREATE INDEX "agent_memories_userId_idx" ON "agent_memories"("userId");

-- CreateIndex
CREATE INDEX "agent_memories_goalId_idx" ON "agent_memories"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_memories_userId_scope_key_key" ON "agent_memories"("userId", "scope", "key");

-- CreateIndex
CREATE INDEX "agent_watches_userId_idx" ON "agent_watches"("userId");

-- CreateIndex
CREATE INDEX "agent_watches_goalId_idx" ON "agent_watches"("goalId");

-- CreateIndex
CREATE INDEX "human_tasks_userId_idx" ON "human_tasks"("userId");

-- CreateIndex
CREATE INDEX "human_tasks_status_idx" ON "human_tasks"("status");

-- CreateIndex
CREATE INDEX "human_workers_humanTaskId_idx" ON "human_workers"("humanTaskId");

-- CreateIndex
CREATE INDEX "human_workers_platform_externalId_idx" ON "human_workers"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "human_workers_humanTaskId_platform_externalId_key" ON "human_workers"("humanTaskId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "task_submissions_humanTaskId_idx" ON "task_submissions"("humanTaskId");

-- CreateIndex
CREATE INDEX "task_submissions_workerId_idx" ON "task_submissions"("workerId");

-- CreateIndex
CREATE INDEX "task_submissions_status_idx" ON "task_submissions"("status");

-- CreateIndex
CREATE INDEX "task_submissions_dueAt_idx" ON "task_submissions"("dueAt");

-- CreateIndex
CREATE INDEX "task_compliance_reports_humanTaskId_idx" ON "task_compliance_reports"("humanTaskId");

-- CreateIndex
CREATE INDEX "task_compliance_reports_periodStart_idx" ON "task_compliance_reports"("periodStart");

-- AddForeignKey
ALTER TABLE "agent_goals" ADD CONSTRAINT "agent_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_goals" ADD CONSTRAINT "agent_goals_reportingChannelId_fkey" FOREIGN KEY ("reportingChannelId") REFERENCES "support_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "agent_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "agent_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_watches" ADD CONSTRAINT "agent_watches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_watches" ADD CONSTRAINT "agent_watches_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "agent_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_watches" ADD CONSTRAINT "agent_watches_actionWorkflowId_fkey" FOREIGN KEY ("actionWorkflowId") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_tasks" ADD CONSTRAINT "human_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_tasks" ADD CONSTRAINT "human_tasks_supportAgentId_fkey" FOREIGN KEY ("supportAgentId") REFERENCES "support_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_tasks" ADD CONSTRAINT "human_tasks_reportChannelId_fkey" FOREIGN KEY ("reportChannelId") REFERENCES "support_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_workers" ADD CONSTRAINT "human_workers_humanTaskId_fkey" FOREIGN KEY ("humanTaskId") REFERENCES "human_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_workers" ADD CONSTRAINT "human_workers_supportChannelId_fkey" FOREIGN KEY ("supportChannelId") REFERENCES "support_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_humanTaskId_fkey" FOREIGN KEY ("humanTaskId") REFERENCES "human_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "human_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_compliance_reports" ADD CONSTRAINT "task_compliance_reports_humanTaskId_fkey" FOREIGN KEY ("humanTaskId") REFERENCES "human_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
