CREATE TYPE "ConstructionJobStatus" AS ENUM ('PLANNING','APPROVED','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED');
CREATE TYPE "JobCostCategory" AS ENUM ('MATERIAL','LABOUR','EQUIPMENT','TRANSPORT','SUBCONTRACT','OTHER');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT','SENT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED');
CREATE TYPE "CustomerPaymentMethod" AS ENUM ('CASH','BANK_TRANSFER','UPI','CHEQUE','CARD','OTHER');
CREATE TYPE "CustomerPaymentStatus" AS ENUM ('PENDING','CLEARED','FAILED','REFUNDED');

CREATE TABLE "ConstructionJob" (
  "id" TEXT NOT NULL, "jobNo" TEXT NOT NULL, "name" TEXT NOT NULL, "siteLocation" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "status" "ConstructionJobStatus" NOT NULL DEFAULT 'PLANNING',
  "customerId" TEXT, "quotationId" TEXT, "startDate" TIMESTAMP(3), "targetEndDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3), "budgetAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "contractAmount" DECIMAL(14,2) NOT NULL DEFAULT 0, "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstructionJob_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BoqItem" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "materialRateId" TEXT, "code" TEXT, "description" TEXT NOT NULL,
  "category" TEXT NOT NULL, "unit" TEXT NOT NULL, "quantity" DECIMAL(14,3) NOT NULL,
  "unitRate" DECIMAL(14,2) NOT NULL, "estimatedTotal" DECIMAL(14,2) NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BoqItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "JobCost" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "category" "JobCostCategory" NOT NULL,
  "description" TEXT NOT NULL, "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
  "unit" TEXT NOT NULL DEFAULT 'lot', "unitRate" DECIMAL(14,2) NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL, "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reference" TEXT, "notes" TEXT NOT NULL DEFAULT '', "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobCost_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseOrder" (
  "id" TEXT NOT NULL, "poNumber" TEXT NOT NULL, "jobId" TEXT NOT NULL, "supplierId" TEXT NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT', "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedDate" TIMESTAMP(3), "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0, "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "notes" TEXT NOT NULL DEFAULT '', "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseOrderItem" (
  "id" TEXT NOT NULL, "purchaseOrderId" TEXT NOT NULL, "description" TEXT NOT NULL,
  "unit" TEXT NOT NULL, "quantity" DECIMAL(14,3) NOT NULL, "unitRate" DECIMAL(14,2) NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL, "receivedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseDelivery" (
  "id" TEXT NOT NULL, "purchaseOrderId" TEXT NOT NULL, "deliveryRef" TEXT,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "receivedBy" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '', "attachmentUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseDelivery_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseDeliveryItem" (
  "id" TEXT NOT NULL, "deliveryId" TEXT NOT NULL, "purchaseOrderItemId" TEXT NOT NULL,
  "quantityReceived" DECIMAL(14,3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseDeliveryItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CustomerPayment" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "receiptNo" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL, "method" "CustomerPaymentMethod" NOT NULL,
  "status" "CustomerPaymentStatus" NOT NULL DEFAULT 'PENDING', "reference" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '',
  "recordedBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProjectProgressUpdate" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "progressPercent" INTEGER NOT NULL,
  "updateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "blockers" TEXT NOT NULL DEFAULT '', "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectProgressUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConstructionJob_jobNo_key" ON "ConstructionJob"("jobNo");
CREATE UNIQUE INDEX "ConstructionJob_quotationId_key" ON "ConstructionJob"("quotationId");
CREATE INDEX "ConstructionJob_status_createdAt_idx" ON "ConstructionJob"("status","createdAt");
CREATE INDEX "ConstructionJob_customerId_createdAt_idx" ON "ConstructionJob"("customerId","createdAt");
CREATE INDEX "BoqItem_jobId_category_idx" ON "BoqItem"("jobId","category");
CREATE INDEX "BoqItem_materialRateId_idx" ON "BoqItem"("materialRateId");
CREATE INDEX "JobCost_jobId_category_incurredAt_idx" ON "JobCost"("jobId","category","incurredAt");
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
CREATE INDEX "PurchaseOrder_jobId_status_idx" ON "PurchaseOrder"("jobId","status");
CREATE INDEX "PurchaseOrder_supplierId_orderDate_idx" ON "PurchaseOrder"("supplierId","orderDate");
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
CREATE INDEX "PurchaseDelivery_purchaseOrderId_deliveredAt_idx" ON "PurchaseDelivery"("purchaseOrderId","deliveredAt");
CREATE INDEX "PurchaseDeliveryItem_deliveryId_idx" ON "PurchaseDeliveryItem"("deliveryId");
CREATE INDEX "PurchaseDeliveryItem_purchaseOrderItemId_createdAt_idx" ON "PurchaseDeliveryItem"("purchaseOrderItemId","createdAt");
CREATE UNIQUE INDEX "CustomerPayment_receiptNo_key" ON "CustomerPayment"("receiptNo");
CREATE INDEX "CustomerPayment_jobId_status_paidAt_idx" ON "CustomerPayment"("jobId","status","paidAt");
CREATE INDEX "ProjectProgressUpdate_jobId_updateDate_idx" ON "ProjectProgressUpdate"("jobId","updateDate");

ALTER TABLE "ConstructionJob" ADD CONSTRAINT "ConstructionJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstructionJob" ADD CONSTRAINT "ConstructionJob_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_materialRateId_fkey" FOREIGN KEY ("materialRateId") REFERENCES "MaterialRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConstructionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobCost" ADD CONSTRAINT "JobCost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConstructionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConstructionJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseDelivery" ADD CONSTRAINT "PurchaseDelivery_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseDeliveryItem" ADD CONSTRAINT "PurchaseDeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "PurchaseDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseDeliveryItem" ADD CONSTRAINT "PurchaseDeliveryItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConstructionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectProgressUpdate" ADD CONSTRAINT "ProjectProgressUpdate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ConstructionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
