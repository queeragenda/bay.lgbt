-- CreateTable
CREATE TABLE "UrlSource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceID" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceCity" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastScraped" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etagLastScrape" TEXT
);

-- CreateTable
CREATE TABLE "UrlEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UrlEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "UrlSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UrlEventImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "eventID" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    CONSTRAINT "UrlEventImage_eventID_fkey" FOREIGN KEY ("eventID") REFERENCES "UrlEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UrlEvent_url_key" ON "UrlEvent"("url");
