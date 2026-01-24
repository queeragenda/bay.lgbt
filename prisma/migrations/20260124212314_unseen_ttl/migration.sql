-- AlterTable
ALTER TABLE "UrlSource" ADD COLUMN "unseenEventTTLSecs" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UrlEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hideAfter" DATETIME,
    "extendedProps" TEXT,
    CONSTRAINT "UrlEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "UrlSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UrlEvent" ("createdAt", "end", "extendedProps", "id", "sourceId", "start", "title", "url") SELECT "createdAt", "end", "extendedProps", "id", "sourceId", "start", "title", "url" FROM "UrlEvent";
DROP TABLE "UrlEvent";
ALTER TABLE "new_UrlEvent" RENAME TO "UrlEvent";
CREATE UNIQUE INDEX "UrlEvent_url_key" ON "UrlEvent"("url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
