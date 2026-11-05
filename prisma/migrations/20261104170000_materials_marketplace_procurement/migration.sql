CREATE TYPE "RateApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL, "companyName" TEXT NOT NULL, "contactPerson" TEXT, "phone" TEXT, "whatsapp" TEXT,
  "email" TEXT, "address" TEXT, "gstNumber" TEXT, "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "brands" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "paymentTerms" TEXT, "deliveryTerms" TEXT, "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Product" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "category" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "brand" TEXT, "grade" TEXT, "model" TEXT, "dimensions" TEXT,
  "specifications" JSONB NOT NULL DEFAULT '{}', "unit" TEXT NOT NULL DEFAULT 'unit',
  "sellingPrice" DECIMAL(14,2), "wholesalePrice" DECIMAL(14,2), "stockQuantity" DECIMAL(14,3),
  "stockStatus" TEXT NOT NULL DEFAULT 'ENQUIRY_ONLY', "supplierId" TEXT, "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "featured" BOOLEAN NOT NULL DEFAULT false, "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SupplierQuote" (
  "id" TEXT NOT NULL, "supplierId" TEXT NOT NULL, "reference" TEXT, "category" TEXT, "productName" TEXT NOT NULL,
  "brand" TEXT, "specification" TEXT, "unit" TEXT NOT NULL, "unitRate" DECIMAL(14,2) NOT NULL,
  "minimumOrder" DECIMAL(14,3), "validUntil" TIMESTAMP(3), "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SupplierQuote_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MaterialRate" (
  "id" TEXT NOT NULL, "materialName" TEXT NOT NULL, "category" TEXT NOT NULL, "brand" TEXT,
  "specification" TEXT, "unit" TEXT NOT NULL, "rate" DECIMAL(14,2) NOT NULL,
  "location" TEXT NOT NULL DEFAULT 'Lucknow, Uttar Pradesh', "sourceLabel" TEXT, "supplierId" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3),
  "status" "RateApprovalStatus" NOT NULL DEFAULT 'PENDING', "approvedBy" TEXT, "approvedAt" TIMESTAMP(3),
  "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Supplier_companyName_idx" ON "Supplier"("companyName");
CREATE INDEX "Supplier_active_createdAt_idx" ON "Supplier"("active", "createdAt");
CREATE INDEX "Product_category_active_idx" ON "Product"("category", "active");
CREATE INDEX "Product_brand_active_idx" ON "Product"("brand", "active");
CREATE INDEX "Product_featured_active_idx" ON "Product"("featured", "active");
CREATE INDEX "SupplierQuote_supplierId_createdAt_idx" ON "SupplierQuote"("supplierId", "createdAt");
CREATE INDEX "MaterialRate_category_status_effectiveFrom_idx" ON "MaterialRate"("category", "status", "effectiveFrom");
CREATE INDEX "MaterialRate_materialName_location_status_idx" ON "MaterialRate"("materialName", "location", "status");
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialRate" ADD CONSTRAINT "MaterialRate_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
