-- CreateEnum
CREATE TYPE "AppReviewStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateTable
CREATE TABLE "app_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AppReviewStatus" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_reviews_userId_key" ON "app_reviews"("userId");
CREATE INDEX "app_reviews_status_createdAt_idx" ON "app_reviews"("status", "createdAt");
CREATE INDEX "app_reviews_status_rating_idx" ON "app_reviews"("status", "rating");

ALTER TABLE "app_reviews" ADD CONSTRAINT "app_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
