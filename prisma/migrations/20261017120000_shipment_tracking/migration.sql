-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ShipmentStatus" AS ENUM ('LABEL_CREATED', 'SHIPPED', 'DELIVERED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: token generato anche per le spedizioni già esistenti
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "confirmToken" TEXT;
UPDATE "Shipment" SET "confirmToken" = md5(random()::text || "id") WHERE "confirmToken" IS NULL;
ALTER TABLE "Shipment" ALTER COLUMN "confirmToken" SET NOT NULL;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "shipperNote" TEXT,
ADD COLUMN IF NOT EXISTS "status" "ShipmentStatus" NOT NULL DEFAULT 'LABEL_CREATED';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Shipment_confirmToken_key" ON "Shipment"("confirmToken");
