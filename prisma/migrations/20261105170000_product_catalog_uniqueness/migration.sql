DROP INDEX "MaterialSpecification_categoryId_name_quality_brand_productId_key";

CREATE UNIQUE INDEX "MaterialSpecification_categoryId_name_quality_brand_key"
ON "MaterialSpecification"("categoryId", "name", "quality", "brand");
