/*
  Warnings:

  - You are about to drop the `InstagramEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InstagramEventOrganizer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InstagramImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InstagramPost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InstagramEvent";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InstagramEventOrganizer";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InstagramImage";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InstagramPost";
PRAGMA foreign_keys=on;
