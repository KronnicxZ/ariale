-- CreateTable
CREATE TABLE "AppRelease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "buildNumber" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AppRelease_buildNumber_idx" ON "AppRelease"("buildNumber");
