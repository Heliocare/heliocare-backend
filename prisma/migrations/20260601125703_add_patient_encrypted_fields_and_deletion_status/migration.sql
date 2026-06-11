-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccountStatus" ADD VALUE 'DELETION_REQUESTED';
ALTER TYPE "AccountStatus" ADD VALUE 'DELETION_SCHEDULED';

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "addressEnc" TEXT,
ADD COLUMN     "dobEnc" TEXT,
ADD COLUMN     "firstNameEnc" TEXT,
ADD COLUMN     "genderEnc" TEXT,
ADD COLUMN     "lastNameEnc" TEXT,
ADD COLUMN     "scheduledForDeletionAt" TIMESTAMP(3),
ADD COLUMN     "stateOfResidenceEnc" TEXT;
