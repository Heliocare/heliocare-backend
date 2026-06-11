-- AlterTable
ALTER TABLE "LabResult" ADD COLUMN     "annotatedAt" TIMESTAMP(3),
ADD COLUMN     "annotatedById" TEXT,
ADD COLUMN     "doctorAnnotation" TEXT;

-- AlterTable
ALTER TABLE "TreatmentPlan" ADD COLUMN     "dietitianReferralNote" TEXT,
ADD COLUMN     "dietitianReferralStatus" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "TreatmentPlan_parentId_idx" ON "TreatmentPlan"("parentId");

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_annotatedById_fkey" FOREIGN KEY ("annotatedById") REFERENCES "ProfessionalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
