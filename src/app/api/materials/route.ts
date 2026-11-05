import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const brand = searchParams.get("brand")?.trim();
  try {
    const products = await prisma.product.findMany({
      where: { active: true, ...(category ? { category } : {}), ...(brand ? { brand } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }] } : {}) },
      select: { id: true, name: true, slug: true, category: true, description: true, brand: true, grade: true, model: true, dimensions: true, specifications: true, unit: true, sellingPrice: true, stockStatus: true, images: true, featured: true, updatedAt: true },
      orderBy: [{ featured: "desc" }, { name: "asc" }], take: 100,
    });
    return NextResponse.json(products.map(p => ({ ...p, sellingPrice: p.sellingPrice?.toString() ?? null })));
  } catch (error) {
    console.error("Public materials catalogue failed", error);
    return NextResponse.json({ error: "Materials catalogue is temporarily unavailable." }, { status: 503 });
  }
}
