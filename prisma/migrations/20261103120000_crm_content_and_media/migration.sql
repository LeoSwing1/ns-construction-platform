CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'SALES');

ALTER TABLE "Project" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Enquiry"
    ADD COLUMN "projectArea" TEXT,
    ADD COLUMN "floors" INTEGER,
    ADD COLUMN "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "timeline" TEXT,
    ADD COLUMN "documents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "submissionId" TEXT,
    ADD COLUMN "assignedToId" TEXT,
    ADD COLUMN "followUpAt" TIMESTAMP(3),
    ADD COLUMN "emailDeliveryStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "emailLastAttemptAt" TIMESTAMP(3);

ALTER TABLE "AdminUser"
    ADD COLUMN "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "details" TEXT,
    "enquiryId" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "attribution" TEXT,
    "quote" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key", "windowStart")
);

CREATE UNIQUE INDEX "Enquiry_submissionId_key" ON "Enquiry"("submissionId");
CREATE INDEX "Enquiry_status_createdAt_idx" ON "Enquiry"("status", "createdAt");
CREATE INDEX "Enquiry_assignedToId_followUpAt_idx" ON "Enquiry"("assignedToId", "followUpAt");
CREATE INDEX "ActivityLog_entityType_entityId_createdAt_idx" ON "ActivityLog"("entityType", "entityId", "createdAt");
CREATE INDEX "ActivityLog_enquiryId_createdAt_idx" ON "ActivityLog"("enquiryId", "createdAt");
CREATE INDEX "EmailDeliveryAttempt_enquiryId_attemptedAt_idx" ON "EmailDeliveryAttempt"("enquiryId", "attemptedAt");
CREATE UNIQUE INDEX "MediaAsset_publicId_key" ON "MediaAsset"("publicId");
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_enquiryId_fkey"
    FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailDeliveryAttempt" ADD CONSTRAINT "EmailDeliveryAttempt_enquiryId_fkey"
    FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
