-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'PACKED', 'DISPATCHED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "LogisticsPartner" AS ENUM ('GIG', 'KWIK', 'SENDBOX', 'OTHER');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "pharmacyId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryAddrEnc" TEXT,
    "logisticsPartner" "LogisticsPartner",
    "trackingNumber" TEXT,
    "coldChain" BOOLEAN NOT NULL DEFAULT false,
    "discreetPackaging" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "packedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "estDeliveryDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "pharmacyNotes" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_pharmacyId_status_idx" ON "Order"("pharmacyId", "status");

-- CreateIndex
CREATE INDEX "Order_patientId_status_idx" ON "Order"("patientId", "status");

-- CreateIndex
CREATE INDEX "Order_prescriptionId_idx" ON "Order"("prescriptionId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
