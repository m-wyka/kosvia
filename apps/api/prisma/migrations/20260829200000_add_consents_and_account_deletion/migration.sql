-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'BEAUTY_PROFILE_HEALTH', 'AI_PROCESSING', 'MARKETING_EMAIL');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('PENDING', 'CANCELLED', 'EXECUTED');

-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "birthDate" TIMESTAMP(3),
    ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DeletionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executeAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_audits" (
    "id" TEXT NOT NULL,
    "idHash" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_consents_userId_type_createdAt_idx" ON "user_consents"("userId", "type", "createdAt");
CREATE UNIQUE INDEX "account_deletion_requests_userId_key" ON "account_deletion_requests"("userId");
CREATE INDEX "account_deletion_requests_status_executeAt_idx" ON "account_deletion_requests"("status", "executeAt");

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
