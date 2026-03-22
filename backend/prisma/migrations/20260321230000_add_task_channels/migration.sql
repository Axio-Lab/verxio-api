-- CreateTable
CREATE TABLE "task_channels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Task Channel',
    "platform" "ChatPlatform" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "telegramBotToken" TEXT,
    "telegramBotUsername" TEXT,
    "whatsappSessionId" TEXT,
    "slackBotToken" TEXT,
    "slackSigningSecret" TEXT,
    "slackTeamId" TEXT,
    "slackChannelId" TEXT,
    "discordBotToken" TEXT,
    "discordGuildId" TEXT,
    "discordChannelId" TEXT,
    "webhookUrl" TEXT,
    "sharedSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_channels_pkey" PRIMARY KEY ("id")
);

-- AlterTable: HumanTask
ALTER TABLE "human_tasks" ADD COLUMN "taskChannelId" TEXT;

-- AlterTable: HumanWorker
ALTER TABLE "human_workers" ADD COLUMN "taskChannelId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "task_channels_whatsappSessionId_key" ON "task_channels"("whatsappSessionId");

-- CreateIndex
CREATE INDEX "task_channels_userId_idx" ON "task_channels"("userId");

-- CreateIndex
CREATE INDEX "task_channels_platform_idx" ON "task_channels"("platform");

-- AddForeignKey
ALTER TABLE "task_channels" ADD CONSTRAINT "task_channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_channels" ADD CONSTRAINT "task_channels_whatsappSessionId_fkey" FOREIGN KEY ("whatsappSessionId") REFERENCES "whatsapp_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_tasks" ADD CONSTRAINT "human_tasks_taskChannelId_fkey" FOREIGN KEY ("taskChannelId") REFERENCES "task_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_workers" ADD CONSTRAINT "human_workers_taskChannelId_fkey" FOREIGN KEY ("taskChannelId") REFERENCES "task_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
