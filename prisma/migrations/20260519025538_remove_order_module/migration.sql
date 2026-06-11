/*
  Warnings:

  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_pharmacyId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_prescriptionId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_subscriptionId_fkey";

-- DropTable
DROP TABLE "Order";

-- DropEnum
DROP TYPE "LogisticsPartner";

-- DropEnum
DROP TYPE "OrderStatus";
