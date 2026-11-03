CREATE TYPE "ConstructionGrade" AS ENUM ('ESSENTIAL', 'PREMIUM', 'LUXURY');
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'UNDER_DISCUSSION', 'REVISION_REQUESTED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "siteLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

ALTER TABLE "Enquiry" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ConstructionPackage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quality" "ConstructionGrade" NOT NULL,
    "ratePerSqFt" DECIMAL(12,2),
    "gstRate" DECIMAL(5,2),
    "validityDays" INTEGER NOT NULL DEFAULT 30,
    "inclusions" TEXT NOT NULL DEFAULT '',
    "exclusions" TEXT NOT NULL DEFAULT '',
    "additionalCharges" JSONB NOT NULL DEFAULT '[]',
    "paymentMilestones" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConstructionPackage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConstructionPackage_code_key" ON "ConstructionPackage"("code");
CREATE INDEX "ConstructionPackage_active_quality_idx" ON "ConstructionPackage"("active", "quality");

CREATE TABLE "MaterialCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaterialCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialCategory_name_key" ON "MaterialCategory"("name");

CREATE TABLE "MaterialSpecification" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quality" "ConstructionGrade" NOT NULL,
    "brand" TEXT,
    "details" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaterialSpecification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialSpecification_categoryId_name_quality_brand_key" ON "MaterialSpecification"("categoryId", "name", "quality", "brand");
CREATE INDEX "MaterialSpecification_categoryId_quality_active_idx" ON "MaterialSpecification"("categoryId", "quality", "active");
ALTER TABLE "MaterialSpecification" ADD CONSTRAINT "MaterialSpecification_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "MaterialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PackageMaterial" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    CONSTRAINT "PackageMaterial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PackageMaterial_packageId_categoryId_key" ON "PackageMaterial"("packageId", "categoryId");
ALTER TABLE "PackageMaterial" ADD CONSTRAINT "PackageMaterial_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "ConstructionPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackageMaterial" ADD CONSTRAINT "PackageMaterial_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "MaterialCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackageMaterial" ADD CONSTRAINT "PackageMaterial_specificationId_fkey"
    FOREIGN KEY ("specificationId") REFERENCES "MaterialSpecification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "adjustmentPerSqFt" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PricingRule_packageId_specificationId_key" ON "PricingRule"("packageId", "specificationId");
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "ConstructionPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_specificationId_fkey"
    FOREIGN KEY ("specificationId") REFERENCES "MaterialSpecification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quotationNo" TEXT NOT NULL,
    "submissionId" TEXT,
    "publicTokenHash" TEXT,
    "customerId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "packageId" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "propertyType" TEXT NOT NULL,
    "siteLocation" TEXT NOT NULL,
    "plotAreaSqFt" DECIMAL(12,2),
    "constructionAreaSqFt" DECIMAL(12,2) NOT NULL,
    "floors" INTEGER,
    "requirements" TEXT NOT NULL DEFAULT '',
    "baseRatePerSqFt" DECIMAL(12,2) NOT NULL,
    "upgradeRatePerSqFt" DECIMAL(12,2) NOT NULL,
    "applicableRatePerSqFt" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "gstRate" DECIMAL(5,2),
    "gstAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "additionalCharges" JSONB NOT NULL DEFAULT '[]',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "inclusions" TEXT NOT NULL DEFAULT '',
    "exclusions" TEXT NOT NULL DEFAULT '',
    "paymentMilestones" JSONB NOT NULL DEFAULT '[]',
    "validityDays" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Quotation_quotationNo_key" ON "Quotation"("quotationNo");
CREATE UNIQUE INDEX "Quotation_submissionId_key" ON "Quotation"("submissionId");
CREATE UNIQUE INDEX "Quotation_publicTokenHash_key" ON "Quotation"("publicTokenHash");
CREATE INDEX "Quotation_status_createdAt_idx" ON "Quotation"("status", "createdAt");
CREATE INDEX "Quotation_customerId_createdAt_idx" ON "Quotation"("customerId", "createdAt");
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_enquiryId_fkey"
    FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "ConstructionPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "specificationId" TEXT,
    "categoryName" TEXT NOT NULL,
    "specificationName" TEXT NOT NULL,
    "quality" "ConstructionGrade",
    "brand" TEXT,
    "details" TEXT NOT NULL DEFAULT '',
    "adjustmentPerSqFt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "includedInPackage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_specificationId_fkey"
    FOREIGN KEY ("specificationId") REFERENCES "MaterialSpecification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "QuotationRevision" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuotationRevision_quotationId_revision_key" ON "QuotationRevision"("quotationId", "revision");
ALTER TABLE "QuotationRevision" ADD CONSTRAINT "QuotationRevision_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuotationActivity" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "actorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuotationActivity_quotationId_createdAt_idx" ON "QuotationActivity"("quotationId", "createdAt");
ALTER TABLE "QuotationActivity" ADD CONSTRAINT "QuotationActivity_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ConstructionPackage" ("id", "code", "name", "description", "quality", "ratePerSqFt", "updatedAt") VALUES
('quotation-package-essential', 'ESSENTIAL', 'Essential Construction', 'A transparent starting specification. Final scope and material selections are confirmed during estimation.', 'ESSENTIAL', 1750.00, CURRENT_TIMESTAMP),
('quotation-package-premium', 'PREMIUM', 'Premium Construction', 'Administrator-configured package. No rate is published until approved by the business.', 'PREMIUM', NULL, CURRENT_TIMESTAMP),
('quotation-package-luxury', 'LUXURY', 'Luxury Construction', 'Administrator-configured package. No rate is published until approved by the business.', 'LUXURY', NULL, CURRENT_TIMESTAMP);

INSERT INTO "MaterialCategory" ("id", "name", "sortOrder", "updatedAt") VALUES
('material-category-excavation', 'Excavation & Earthwork', 1, CURRENT_TIMESTAMP),
('material-category-foundation', 'Foundation', 2, CURRENT_TIMESTAMP),
('material-category-rcc', 'RCC & Structural Concrete', 3, CURRENT_TIMESTAMP),
('material-category-cement-steel', 'Cement & Steel', 4, CURRENT_TIMESTAMP),
('material-category-brickwork', 'Brickwork & Blockwork', 5, CURRENT_TIMESTAMP),
('material-category-plastering', 'Plastering', 6, CURRENT_TIMESTAMP),
('material-category-waterproofing', 'Waterproofing', 7, CURRENT_TIMESTAMP),
('material-category-staircase', 'Staircase', 8, CURRENT_TIMESTAMP),
('material-category-roof', 'Roof & Terrace Treatment', 9, CURRENT_TIMESTAMP),
('material-category-vitrified', 'Vitrified Tiles', 10, CURRENT_TIMESTAMP),
('material-category-premium-tiles', 'Premium Tiles', 11, CURRENT_TIMESTAMP),
('material-category-marble', 'Marble', 12, CURRENT_TIMESTAMP),
('material-category-granite', 'Granite', 13, CURRENT_TIMESTAMP),
('material-category-wood-flooring', 'Wooden Flooring', 14, CURRENT_TIMESTAMP),
('material-category-anti-skid', 'Anti-skid Flooring', 15, CURRENT_TIMESTAMP),
('material-category-wall-tiles', 'Wall Tiles', 16, CURRENT_TIMESTAMP),
('material-category-paint', 'Interior & Exterior Paint', 17, CURRENT_TIMESTAMP),
('material-category-texture', 'Texture Finishes', 18, CURRENT_TIMESTAMP),
('material-category-ceiling', 'False Ceiling & Gypsum Work', 19, CURRENT_TIMESTAMP),
('material-category-wiring', 'Electrical Wiring', 20, CURRENT_TIMESTAMP),
('material-category-switches', 'Switches & Sockets', 21, CURRENT_TIMESTAMP),
('material-category-db', 'Distribution Boards, MCB & RCCB', 22, CURRENT_TIMESTAMP),
('material-category-lighting', 'Lighting, Fans & Accessories', 23, CURRENT_TIMESTAMP),
('material-category-smart-home', 'Smart-home Provisions', 24, CURRENT_TIMESTAMP),
('material-category-plumbing', 'Plumbing Pipes & Fittings', 25, CURRENT_TIMESTAMP),
('material-category-sanitary', 'Sanitary Seats & WCs', 26, CURRENT_TIMESTAMP),
('material-category-basins', 'Washbasins', 27, CURRENT_TIMESTAMP),
('material-category-faucets', 'Faucets, Taps & Showers', 28, CURRENT_TIMESTAMP),
('material-category-bath-accessories', 'Bathroom Accessories & Concealed Cisterns', 29, CURRENT_TIMESTAMP),
('material-category-water-tanks', 'Water Tanks & Pumps', 30, CURRENT_TIMESTAMP),
('material-category-doors', 'Main & Internal Doors, Frames', 31, CURRENT_TIMESTAMP),
('material-category-windows', 'UPVC/Aluminium Windows & Glass', 32, CURRENT_TIMESTAMP),
('material-category-hardware', 'Locks, Hinges, Handles & Hardware', 33, CURRENT_TIMESTAMP),
('material-category-kitchen-counter', 'Kitchen Platform, Granite & Quartz', 34, CURRENT_TIMESTAMP),
('material-category-kitchen-sink', 'Kitchen Sink & Faucets', 35, CURRENT_TIMESTAMP),
('material-category-kitchen-cabinets', 'Kitchen Cabinets, Shutters & Hardware', 36, CURRENT_TIMESTAMP),
('material-category-kitchen-appliances', 'Chimney, Hob & Kitchen Appliances', 37, CURRENT_TIMESTAMP),
('material-category-railings', 'Railings & Balconies', 38, CURRENT_TIMESTAMP),
('material-category-elevation', 'Exterior Elevation', 39, CURRENT_TIMESTAMP),
('material-category-decorative-lighting', 'Decorative Lighting', 40, CURRENT_TIMESTAMP),
('material-category-wardrobes', 'Wardrobes & Storage', 41, CURRENT_TIMESTAMP),
('material-category-interior', 'Interior Finishing & Renovation', 42, CURRENT_TIMESTAMP),
('material-category-custom', 'Client-specific Requirements', 43, CURRENT_TIMESTAMP);
