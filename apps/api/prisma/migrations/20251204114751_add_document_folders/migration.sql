-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "path" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "document_folders" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
