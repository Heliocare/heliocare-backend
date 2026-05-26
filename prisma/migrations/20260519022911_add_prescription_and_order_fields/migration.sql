-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "coldChain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discreetPackaging" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "pdfS3Key" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
