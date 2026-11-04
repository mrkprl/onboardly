-- DropForeignKey
ALTER TABLE "Plan" DROP CONSTRAINT "Plan_employeeId_fkey";

-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "employeeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
