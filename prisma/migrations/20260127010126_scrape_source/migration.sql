-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InstagramPostScrapeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "scrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" INTEGER,
    CONSTRAINT "InstagramPostScrapeRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "UrlSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InstagramPostScrapeRecord" ("id", "scrapedAt", "url") SELECT "id", "scrapedAt", "url" FROM "InstagramPostScrapeRecord";
DROP TABLE "InstagramPostScrapeRecord";
ALTER TABLE "new_InstagramPostScrapeRecord" RENAME TO "InstagramPostScrapeRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
