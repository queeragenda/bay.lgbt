/*
  Warnings:

  - You are about to drop the column `mediaUrlsJson` on the `InstagramPost` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "InstagramImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "postID" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    CONSTRAINT "InstagramImage_postID_fkey" FOREIGN KEY ("postID") REFERENCES "InstagramPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InstagramPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "organizerId" INTEGER NOT NULL,
    "postDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "InstagramPost_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "InstagramEventOrganizer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InstagramPost" ("caption", "completedAt", "createdAt", "id", "organizerId", "postDate", "url") SELECT "caption", "completedAt", "createdAt", "id", "organizerId", "postDate", "url" FROM "InstagramPost";
DROP TABLE "InstagramPost";
ALTER TABLE "new_InstagramPost" RENAME TO "InstagramPost";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
