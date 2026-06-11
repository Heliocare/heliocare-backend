/*
  Warnings:

  - You are about to drop the column `formVersion` on the `Intake` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedAt` on the `Intake` table. All the data in the column will be lost.
  - You are about to drop the column `doctorId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `mediaType` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `mediaUrl` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `sender` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `acknowledgedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `coldChain` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `dispatchedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `estDeliveryDate` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `isDiscreet` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `packedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `pharmacyNotes` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `pdfHash` on the `Prescription` table. All the data in the column will be lost.
  - You are about to drop the column `pdfUrl` on the `Prescription` table. All the data in the column will be lost.
  - You are about to drop the column `refillsAuth` on the `Prescription` table. All the data in the column will be lost.
  - You are about to drop the column `refillsUsed` on the `Prescription` table. All the data in the column will be lost.
  - You are about to drop the column `photoUrl` on the `ProgressEntry` table. All the data in the column will be lost.
  - You are about to drop the column `cancelledAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `nextRefillDate` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `pausedUntil` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `paystackCustomerCode` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `paystackSubscriptionCode` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `VideoSlot` table. All the data in the column will be lost.
  - You are about to drop the column `consultNotes` on the `VideoSlot` table. All the data in the column will be lost.
  - You are about to drop the column `doctorId` on the `VideoSlot` table. All the data in the column will be lost.
  - You are about to drop the column `wherebyUrl` on the `VideoSlot` table. All the data in the column will be lost.
  - You are about to drop the `Doctor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pharmacist` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[paystackCode]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[consultationNoteId]` on the table `VideoSlot` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `senderId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `threadType` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `enteredById` to the `ProgressEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `professionalId` to the `VideoSlot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProfessionalStatus" AS ENUM ('VERIFIED', 'PENDING', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RegBody" AS ENUM ('MDCN', 'PCN', 'MLSCN', 'ODBN');

-- CreateEnum
CREATE TYPE "LabRequestStatus" AS ENUM ('PENDING', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResultFlag" AS ENUM ('NORMAL', 'ABNORMAL', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DietPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TreatmentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsultNoteType" AS ENUM ('SOAP', 'FOLLOW_UP', 'INITIAL');

-- CreateEnum
CREATE TYPE "MessageThread" AS ENUM ('PATIENT_DOCTOR', 'PATIENT_DIETITIAN', 'SYSTEM_ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "SampleMethod" AS ENUM ('HOME_COLLECTION', 'WALK_IN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'PHARMACIST';
ALTER TYPE "UserRole" ADD VALUE 'LAB_SCIENTIST';
ALTER TYPE "UserRole" ADD VALUE 'DIETITIAN';

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "Doctor" DROP CONSTRAINT "Doctor_userId_fkey";

-- DropForeignKey
ALTER TABLE "Intake" DROP CONSTRAINT "Intake_reviewedById_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "Pharmacist" DROP CONSTRAINT "Pharmacist_pharmacyId_fkey";

-- DropForeignKey
ALTER TABLE "Pharmacist" DROP CONSTRAINT "Pharmacist_userId_fkey";

-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "VideoSlot" DROP CONSTRAINT "VideoSlot_doctorId_fkey";

-- DropIndex
DROP INDEX "Intake_patientId_vertical_status_idx";

-- DropIndex
DROP INDEX "Message_doctorId_isRead_idx";

-- DropIndex
DROP INDEX "Order_patientId_status_idx";

-- DropIndex
DROP INDEX "Prescription_subscriptionId_idx";

-- DropIndex
DROP INDEX "Subscription_paystackSubscriptionCode_key";

-- DropIndex
DROP INDEX "User_emailVerificationToken_idx";

-- DropIndex
DROP INDEX "User_passwordResetToken_idx";

-- DropIndex
DROP INDEX "VideoSlot_doctorId_startTime_idx";

-- DropIndex
DROP INDEX "VideoSlot_isBooked_startTime_idx";

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "entityType" DROP NOT NULL,
ALTER COLUMN "entityId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Intake" DROP COLUMN "formVersion",
DROP COLUMN "reviewedAt";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "doctorId",
DROP COLUMN "mediaType",
DROP COLUMN "mediaUrl",
DROP COLUMN "sender",
ADD COLUMN     "senderId" TEXT NOT NULL,
ADD COLUMN     "threadType" "MessageThread" NOT NULL;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "acknowledgedAt",
DROP COLUMN "coldChain",
DROP COLUMN "dispatchedAt",
DROP COLUMN "estDeliveryDate",
DROP COLUMN "isDiscreet",
DROP COLUMN "packedAt",
DROP COLUMN "pharmacyNotes";

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "ndprConsentAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "Prescription" DROP COLUMN "pdfHash",
DROP COLUMN "pdfUrl",
DROP COLUMN "refillsAuth",
DROP COLUMN "refillsUsed";

-- AlterTable
ALTER TABLE "ProgressEntry" DROP COLUMN "photoUrl",
ADD COLUMN     "dietitianAnnotation" TEXT,
ADD COLUMN     "enteredById" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "cancelledAt",
DROP COLUMN "nextRefillDate",
DROP COLUMN "pausedUntil",
DROP COLUMN "paystackCustomerCode",
DROP COLUMN "paystackSubscriptionCode",
ADD COLUMN     "paystackCode" TEXT;

-- AlterTable
ALTER TABLE "VideoSlot" DROP COLUMN "completedAt",
DROP COLUMN "consultNotes",
DROP COLUMN "doctorId",
DROP COLUMN "wherebyUrl",
ADD COLUMN     "consultationNoteId" TEXT,
ADD COLUMN     "professionalId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Doctor";

-- DropTable
DROP TABLE "Pharmacist";

-- DropEnum
DROP TYPE "MessageSender";

-- CreateTable
CREATE TABLE "ProfessionalProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "registrationNum" TEXT NOT NULL,
    "regBody" "RegBody" NOT NULL,
    "specialisation" TEXT,
    "status" "ProfessionalStatus" NOT NULL DEFAULT 'PENDING',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "availability" TEXT,
    "maxOpenConsults" INTEGER NOT NULL DEFAULT 25,

    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfessional" (
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientProfessional_pkey" PRIMARY KEY ("patientId","professionalId")
);

-- CreateTable
CREATE TABLE "TreatmentPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TreatmentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTestRequest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "testCodes" TEXT NOT NULL,
    "status" "LabRequestStatus" NOT NULL DEFAULT 'PENDING',
    "sampleMethod" "SampleMethod" NOT NULL DEFAULT 'WALK_IN',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTestRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    "flag" "ResultFlag" NOT NULL DEFAULT 'NORMAL',
    "labNotes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "status" "DietPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "caloriesPerDay" INTEGER,
    "macroSplit" TEXT,
    "instructions" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "DietPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietAdherenceLog" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "adhered" BOOLEAN NOT NULL,
    "userNotes" TEXT,

    CONSTRAINT "DietAdherenceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "type" "ConsultNoteType" NOT NULL DEFAULT 'SOAP',
    "contentEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_registrationNum_key" ON "ProfessionalProfile"("registrationNum");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_status_idx" ON "ProfessionalProfile"("status");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_regBody_idx" ON "ProfessionalProfile"("regBody");

-- CreateIndex
CREATE INDEX "TreatmentPlan_patientId_idx" ON "TreatmentPlan"("patientId");

-- CreateIndex
CREATE INDEX "LabTestRequest_patientId_status_idx" ON "LabTestRequest"("patientId", "status");

-- CreateIndex
CREATE INDEX "LabResult_requestId_idx" ON "LabResult"("requestId");

-- CreateIndex
CREATE INDEX "DietPlan_patientId_idx" ON "DietPlan"("patientId");

-- CreateIndex
CREATE INDEX "DietAdherenceLog_planId_date_idx" ON "DietAdherenceLog"("planId", "date");

-- CreateIndex
CREATE INDEX "ConsultationNote_patientId_createdAt_idx" ON "ConsultationNote"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Intake_patientId_vertical_idx" ON "Intake"("patientId", "vertical");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_paystackCode_key" ON "Subscription"("paystackCode");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "VideoSlot_consultationNoteId_key" ON "VideoSlot"("consultationNoteId");

-- CreateIndex
CREATE INDEX "VideoSlot_professionalId_startTime_idx" ON "VideoSlot"("professionalId", "startTime");

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfessional" ADD CONSTRAINT "PatientProfessional_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfessional" ADD CONSTRAINT "PatientProfessional_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "ProfessionalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestRequest" ADD CONSTRAINT "LabTestRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestRequest" ADD CONSTRAINT "LabTestRequest_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LabTestRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietPlan" ADD CONSTRAINT "DietPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietPlan" ADD CONSTRAINT "DietPlan_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietAdherenceLog" ADD CONSTRAINT "DietAdherenceLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DietPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationNote" ADD CONSTRAINT "ConsultationNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationNote" ADD CONSTRAINT "ConsultationNote_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoSlot" ADD CONSTRAINT "VideoSlot_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoSlot" ADD CONSTRAINT "VideoSlot_consultationNoteId_fkey" FOREIGN KEY ("consultationNoteId") REFERENCES "ConsultationNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
