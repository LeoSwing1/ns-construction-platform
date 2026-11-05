import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
 const { slug } = await context.params;
 try { const p = await prisma.product.findFirst({ where: { slug, active: true }, select: { id:true,name:true,slug:true,category:true,description:true,brand:true,grade:true,model:true,dimensions:true,specifications:true,unit:true,sellingPrice:true,stockStatus:true,images:true,updatedAt:true } }); if (!p) return NextResponse.json({error:"Product not found."},{status:404}); return NextResponse.json({...p,sellingPrice:p.sellingPrice?.toString()??null}); }
 catch(error){console.error("Product detail failed",error);return NextResponse.json({error:"Product details are temporarily unavailable."},{status:503})}
}
