-- CreateTable
CREATE TABLE "InstagramEventOrganizer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "contextClues" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InstagramEvent" (
    "igId" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "url" TEXT NOT NULL,
    "organizerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramEvent_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "InstagramEventOrganizer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstagramNonEvent" (
    "igId" TEXT NOT NULL PRIMARY KEY,
    "organizerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramNonEvent_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "InstagramEventOrganizer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramEventOrganizer_username_key" ON "InstagramEventOrganizer"("username");

-- CreateIndex
CREATE INDEX "InstagramEvent_organizerId_idx" ON "InstagramEvent"("organizerId");

-- CreateIndex
CREATE INDEX "InstagramNonEvent_organizerId_idx" ON "InstagramNonEvent"("organizerId");
