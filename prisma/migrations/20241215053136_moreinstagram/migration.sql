/*
  Warnings:

  - You are about to drop the column `extractedText` on the `InstagramPost` table. All the data in the column will be lost.
  - Added the required column `mediaUrlsJson` to the `InstagramPost` table without a default value. This is not possible if the table is not empty.
  - Made the column `caption` on table `InstagramPost` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InstagramPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "mediaUrlsJson" TEXT NOT NULL,
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
