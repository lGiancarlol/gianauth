-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Request" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedNote" TEXT,
    "discordMessageId" TEXT,
    "licenseSnapshot" TEXT,
    "licenseDeleted" BOOLEAN NOT NULL DEFAULT false,
    "licenseId" INTEGER,
    "resellerId" INTEGER NOT NULL,
    CONSTRAINT "Request_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Request_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Request" ("comment", "createdAt", "discordMessageId", "id", "licenseId", "resellerId", "resolvedAt", "resolvedNote", "status", "type") SELECT "comment", "createdAt", "discordMessageId", "id", "licenseId", "resellerId", "resolvedAt", "resolvedNote", "status", "type" FROM "Request";
DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
CREATE INDEX "Request_resellerId_idx" ON "Request"("resellerId");
CREATE INDEX "Request_status_idx" ON "Request"("status");
CREATE INDEX "Request_licenseId_idx" ON "Request"("licenseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
