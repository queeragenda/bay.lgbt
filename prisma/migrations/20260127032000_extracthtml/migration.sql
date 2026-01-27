-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UrlSource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceID" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceCity" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastScraped" DATETIME NOT NULL,
    "etagLastScrape" TEXT,
    "unseenEventTTLSecs" INTEGER,
    "extraDataJson" TEXT NOT NULL DEFAULT '{}',
    "extractImagesFromBody" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_UrlSource" ("etagLastScrape", "extraDataJson", "id", "lastScraped", "sourceCity", "sourceID", "sourceName", "sourceType", "unseenEventTTLSecs", "url") SELECT "etagLastScrape", "extraDataJson", "id", "lastScraped", "sourceCity", "sourceID", "sourceName", "sourceType", "unseenEventTTLSecs", "url" FROM "UrlSource";
DROP TABLE "UrlSource";
ALTER TABLE "new_UrlSource" RENAME TO "UrlSource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
