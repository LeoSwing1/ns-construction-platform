ALTER TABLE "Product"
ADD COLUMN "quotationQuality" "ConstructionGrade" NOT NULL DEFAULT 'ESSENTIAL',
ADD COLUMN "quotationActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MaterialSpecification"
ADD COLUMN "productId" TEXT;

DROP INDEX "MaterialSpecification_categoryId_name_quality_brand_key";

CREATE UNIQUE INDEX "MaterialSpecification_categoryId_name_quality_brand_productId_key"
ON "MaterialSpecification"("categoryId", "name", "quality", "brand", "productId");

CREATE UNIQUE INDEX "MaterialSpecification_productId_key"
ON "MaterialSpecification"("productId");

ALTER TABLE "MaterialSpecification"
ADD CONSTRAINT "MaterialSpecification_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "MaterialCategory" ("id", "name", "sortOrder", "active", "createdAt", "updatedAt")
SELECT 'product-category-' || md5(product."category"), product."category", 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" AS product
WHERE btrim(product."category") <> ''
ON CONFLICT ("name") DO NOTHING;

UPDATE "MaterialSpecification" AS specification
SET "productId" = product."id",
    "details" = concat_ws(
      E'\n',
      NULLIF(btrim(product."description"), ''),
      CASE WHEN NULLIF(btrim(product."grade"), '') IS NOT NULL THEN 'Material grade: ' || btrim(product."grade") END,
      CASE WHEN NULLIF(btrim(product."model"), '') IS NOT NULL THEN 'Model: ' || btrim(product."model") END,
      CASE WHEN NULLIF(btrim(product."dimensions"), '') IS NOT NULL THEN 'Dimensions: ' || btrim(product."dimensions") END
    ),
    "active" = product."quotationActive",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Product" AS product
JOIN "MaterialCategory" AS category ON category."name" = product."category"
WHERE specification."productId" IS NULL
  AND specification."categoryId" = category."id"
  AND specification."name" = product."name"
  AND specification."quality" = product."quotationQuality"
  AND specification."brand" IS NOT DISTINCT FROM NULLIF(btrim(product."brand"), '');

INSERT INTO "MaterialSpecification" (
  "id", "categoryId", "productId", "name", "quality", "brand", "details", "active", "createdAt", "updatedAt"
)
SELECT
  'product-specification-' || md5(product."id"),
  category."id",
  product."id",
  product."name",
  product."quotationQuality",
  NULLIF(btrim(product."brand"), ''),
  concat_ws(
    E'\n',
    NULLIF(btrim(product."description"), ''),
    CASE WHEN NULLIF(btrim(product."grade"), '') IS NOT NULL THEN 'Material grade: ' || btrim(product."grade") END,
    CASE WHEN NULLIF(btrim(product."model"), '') IS NOT NULL THEN 'Model: ' || btrim(product."model") END,
    CASE WHEN NULLIF(btrim(product."dimensions"), '') IS NOT NULL THEN 'Dimensions: ' || btrim(product."dimensions") END
  ),
  product."quotationActive",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" AS product
JOIN "MaterialCategory" AS category ON category."name" = product."category"
WHERE btrim(product."category") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "MaterialSpecification" AS specification
    WHERE specification."productId" = product."id"
  );
