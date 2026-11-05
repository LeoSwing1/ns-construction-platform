import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET(request: Request) {
 const { searchParams } = new URL(request.url); const category = searchParams.get("category"); const location = searchParams.get("location") || "Lucknow, Uttar Pradesh"; const now = new Date();
 try { const rates = await prisma.materialRate.findMany({ where: { status:"APPROVED", location, effectiveFrom:{lte:now}, OR:[{expiresAt:null},{expiresAt:{gt:now}}], ...(category?{category}:{}) }, orderBy:{effectiveFrom:"desc"}, take:200, select:{id:true,materialName:true,category:true,brand:true,specification:true,unit:true,rate:true,location:true,effectiveFrom:true,expiresAt:true,sourceLabel:true} }); return NextResponse.json(rates.map(r=>({...r,rate:r.rate.toString()}))); }
 catch(error){console.error("Published rates GET failed",error);return NextResponse.json({error:"Approved rates are temporarily unavailable."},{status:503})}
}
