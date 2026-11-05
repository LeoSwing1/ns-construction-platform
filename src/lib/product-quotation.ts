import { Prisma } from "@prisma/client";

type Product = Prisma.ProductGetPayload<Record<string, never>>;

export class ProductQuotationIntegrationError extends Error {}

export async function syncProductQuotationSpecification(
  transaction: Prisma.TransactionClient,
  product: Product,
  createIfMissing = true,
) {
  const existing = await transaction.materialSpecification.findUnique({
    where: { productId: product.id },
    select: { id: true, categoryId: true },
  });
  if (!existing && !createIfMissing) return;

  const category = await transaction.materialCategory.upsert({
    where: { name: product.category },
    create: { name: product.category },
    update: {},
  });
  if (product.quotationActive && !category.active) {
    throw new ProductQuotationIntegrationError("The selected quotation material category is inactive. Activate it before making this product available in quotations.");
  }

  const brand = product.brand?.trim() || null;
  const details = [
    product.description.trim(),
    product.grade && `Material grade: ${product.grade}`,
    product.model && `Model: ${product.model}`,
    product.dimensions && `Dimensions: ${product.dimensions}`,
  ].filter(Boolean).join("\n");
  const data = {
    categoryId: category.id,
    name: product.name,
    quality: product.quotationQuality,
    brand,
    details,
    active: product.quotationActive,
    productId: product.id,
  };

  if (existing) {
    if (existing.categoryId !== category.id) {
      const defaults = await transaction.packageMaterial.findMany({
        where: { specificationId: existing.id },
        select: { packageId: true },
      });
      for (const item of defaults) {
        const conflictingDefault = await transaction.packageMaterial.findUnique({
          where: { packageId_categoryId: { packageId: item.packageId, categoryId: category.id } },
          select: { specificationId: true },
        });
        if (conflictingDefault && conflictingDefault.specificationId !== existing.id) {
          throw new ProductQuotationIntegrationError("This product cannot change quotation categories because a package already has a different included material in the new category.");
        }
      }
      await transaction.packageMaterial.updateMany({
        where: { specificationId: existing.id },
        data: { categoryId: category.id },
      });
    }

    await transaction.materialSpecification.update({ where: { id: existing.id }, data });
    return;
  }

  const matchingSpecification = await transaction.materialSpecification.findFirst({
    where: {
      categoryId: category.id,
      name: product.name,
      quality: product.quotationQuality,
      brand,
    },
    select: { id: true, productId: true },
  });
  if (matchingSpecification?.productId) {
    throw new ProductQuotationIntegrationError("A different product already uses this quotation specification. Change the product name or brand to distinguish it.");
  }

  if (matchingSpecification) {
    await transaction.materialSpecification.update({
      where: { id: matchingSpecification.id },
      data,
    });
    return;
  }

  await transaction.materialSpecification.create({ data });
}
