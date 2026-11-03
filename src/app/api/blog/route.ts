import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse } from "@/lib/prisma-errors";
export async function GET(){
 try {
  const posts=await prisma.blogPost.findMany({where:{status:"PUBLISHED",publishedAt:{lte:new Date()}},orderBy:{publishedAt:"desc"},take:30});
  return NextResponse.json(posts);
 } catch(error) { logApiError("/api/blog GET",error);return NextResponse.json(databaseErrorResponse(error,"Articles are temporarily unavailable."),{status:503}); }
}
