CREATE TYPE "BoqApprovalStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED');
CREATE TYPE "PurchaseApprovalStatus" AS ENUM ('NOT_SUBMITTED','PENDING_APPROVAL','APPROVED','REJECTED');
CREATE TYPE "LabourAttendanceStatus" AS ENUM ('RECORDED','APPROVED','REJECTED');
CREATE TYPE "ContractorPaymentStatus" AS ENUM ('PENDING','PAID','CANCELLED');
CREATE TYPE "PaymentScheduleStatus" AS ENUM ('UPCOMING','DUE','PARTIALLY_PAID','PAID','OVERDUE');

ALTER TABLE "ConstructionJob" ADD COLUMN "projectAreaSqFt" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "BoqItem" ADD COLUMN "calculationBasis" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "BoqItem" ADD COLUMN "areaFactor" DECIMAL(14,6) NOT NULL DEFAULT 0;
ALTER TABLE "BoqItem" ADD COLUMN "approvalStatus" "BoqApprovalStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "BoqItem" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "BoqItem" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "approvalStatus" "PurchaseApprovalStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "PurchaseOrder" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "approvalNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "boqItemId" TEXT;
ALTER TABLE "CustomerPayment" ADD COLUMN "scheduleId" TEXT;
ALTER TABLE "ProjectProgressUpdate" ADD COLUMN "weather" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectProgressUpdate" ADD COLUMN "crewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProjectProgressUpdate" ADD COLUMN "workDone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectProgressUpdate" ADD COLUMN "materialsUsed" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectProgressUpdate" ADD COLUMN "equipmentUsed" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectProgressUpdate" ADD COLUMN "safetyNotes" TEXT NOT NULL DEFAULT '';

CREATE TABLE "LabourContractor" (
  "id" TEXT NOT NULL, "contractorName" TEXT NOT NULL, "phone" TEXT, "trade" TEXT NOT NULL,
  "dailyRate" DECIMAL(14,2) NOT NULL, "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabourContractor_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LabourAttendance" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "contractorId" TEXT NOT NULL,
  "attendanceDate" TIMESTAMP(3) NOT NULL, "workerCount" INTEGER NOT NULL DEFAULT 1,
  "presentCount" INTEGER NOT NULL DEFAULT 1, "halfDayCount" INTEGER NOT NULL DEFAULT 0,
  "dailyRate" DECIMAL(14,2) NOT NULL, "totalAmount" DECIMAL(14,2) NOT NULL,
  "status" "LabourAttendanceStatus" NOT NULL DEFAULT 'RECORDED', "notes" TEXT NOT NULL DEFAULT '',
  "recordedBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabourAttendance_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ContractorPayment" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "contractorId" TEXT NOT NULL, "paymentNo" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL, "status" "ContractorPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3), "method" "CustomerPaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
  "reference" TEXT, "notes" TEXT NOT NULL DEFAULT '', "recordedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractorPayment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CustomerPaymentSchedule" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "title" TEXT NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL, "status" "PaymentScheduleStatus" NOT NULL DEFAULT 'UPCOMING',
  "notes" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerPaymentSchedule_pkey" PRIMARY KEY ("id")
);


CREATE INDEX "LabourContractor_contractorName_active_idx" ON "LabourContractor"("contractorName","active");
CREATE UNIQUE INDEX "LabourAttendance_jobId_contractorId_attendanceDate_key" ON "LabourAttendance"("jobId","contractorId","attendanceDate");
CREATE INDEX "LabourAttendance_jobId_attendanceDate_status_idx" ON "LabourAttendance"("jobId","attendanceDate","status");
CREATE UNIQUE INDEX "ContractorPayment_paymentNo_key" ON "ContractorPayment"("paymentNo");
CREATE INDEX "ContractorPayment_jobId_contractorId_status_idx" ON "ContractorPayment"("jobId","contractorId","status");
CREATE INDEX "CustomerPaymentSchedule_jobId_dueDate_status_idx" ON "CustomerPaymentSchedule"("jobId","dueDate","status");
CREATE INDEX "BoqItem_jobId_approvalStatus_idx" ON "BoqItem"("jobId","approvalStatus");
CREATE INDEX "PurchaseOrder_approvalStatus_createdAt_idx" ON "PurchaseOrder"("approvalStatus","createdAt");
CREATE INDEX "PurchaseOrderItem_boqItemId_idx" ON "PurchaseOrderItem"("boqItemId");
CREATE INDEX "CustomerPayment_scheduleId_idx" ON "CustomerPayment"("scheduleId");

ALTER TABLE "LabourAttendance" ADD CONSTRAINT "LabourAttendance_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConstructionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabourAttendance" ADD CONSTRAINT "LabourAttendance_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "LabourContractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractorPayment" ADD CONSTRAINT "ContractorPayment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConstructionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractorPayment" ADD CONSTRAINT "ContractorPayment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "LabourContractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerPaymentSchedule" ADD CONSTRAINT "CustomerPaymentSchedule_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConstructionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CustomerPaymentSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
