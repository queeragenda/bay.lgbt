/*
  Warnings:

  - You are about to drop the `InstagramNonEvent` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `InstagramEvent` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `igId` on the `InstagramEvent` table. All the data in the column will be lost.
  - Added the required column `postID` to the `InstagramEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "InstagramNonEvent_organizerId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InstagramNonEvent";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "InstagramPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "organizerId" INTEGER NOT NULL,
    "postDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "extractedText" TEXT,
    "caption" TEXT,
    CONSTRAINT "InstagramPost_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "InstagramEventOrganizer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InstagramEvent" (
    "postID" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "url" TEXT NOT NULL,
    "organizerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramEvent_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "InstagramEventOrganizer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstagramEvent_postID_fkey" FOREIGN KEY ("postID") REFERENCES "InstagramPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InstagramEvent" ("createdAt", "end", "organizerId", "start", "title", "url") SELECT "createdAt", "end", "organizerId", "start", "title", "url" FROM "InstagramEvent";
DROP TABLE "InstagramEvent";
ALTER TABLE "new_InstagramEvent" RENAME TO "InstagramEvent";
CREATE INDEX "InstagramEvent_organizerId_idx" ON "InstagramEvent"("organizerId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
