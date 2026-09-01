-- CreateTable
CREATE TABLE "skin_diary_entries" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "overall" INTEGER NOT NULL,
    "hasBreakouts" BOOLEAN NOT NULL DEFAULT false,
    "hasDryness" BOOLEAN NOT NULL DEFAULT false,
    "hasIrritation" BOOLEAN NOT NULL DEFAULT false,
    "hasRedness" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skin_diary_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skin_diary_entries_profileId_date_key" ON "skin_diary_entries"("profileId", "date");

ALTER TABLE "skin_diary_entries" ADD CONSTRAINT "skin_diary_entries_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "beauty_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
