-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('LAPTOP', 'PHONE');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('OFFICE', 'REMOTE');

-- CreateEnum
CREATE TYPE "ReturnMethod" AS ENUM ('SHIPPING', 'OFFICE');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'DONE', 'WAITING_IT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Os" ADD VALUE 'IOS';
ALTER TYPE "Os" ADD VALUE 'ANDROID';

-- AlterEnum
ALTER TYPE "PlanStatus" ADD VALUE 'EXECUTING';

-- DropIndex
DROP INDEX "Device_status_os_idx";

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "type" "DeviceType" NOT NULL DEFAULT 'LAPTOP';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "address" TEXT,
ADD COLUMN     "workMode" "WorkMode" NOT NULL DEFAULT 'OFFICE';

-- AlterTable
ALTER TABLE "ItRequest" ADD COLUMN     "returnMethod" "ReturnMethod",
ADD COLUMN     "shipmentId" TEXT;

-- AlterTable
ALTER TABLE "Plan" RENAME COLUMN "welcomeText" TO "emailText";

-- AlterTable
ALTER TABLE "RoleProfile" ADD COLUMN     "needsPhone" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlanStep" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "detail" TEXT,
    "itRequestId" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanStep_itRequestId_key" ON "PlanStep"("itRequestId");

-- CreateIndex
CREATE INDEX "PlanStep_planId_position_idx" ON "PlanStep"("planId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_trackingCode_key" ON "Shipment"("trackingCode");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_planId_key" ON "Shipment"("planId");

-- CreateIndex
CREATE INDEX "Device_status_type_os_idx" ON "Device"("status", "type", "os");

-- AddForeignKey
ALTER TABLE "PlanStep" ADD CONSTRAINT "PlanStep_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanStep" ADD CONSTRAINT "PlanStep_itRequestId_fkey" FOREIGN KEY ("itRequestId") REFERENCES "ItRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItRequest" ADD CONSTRAINT "ItRequest_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

