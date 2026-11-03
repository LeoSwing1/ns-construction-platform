import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-errors";
import { databaseErrorResponse } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
export async function GET(){
 try {
  const projects=await prisma.project.findMany({where:{published:true},orderBy:[{featured:"desc"},{createdAt:"desc"}],take:60});
  return NextResponse.json(projects);
 } catch(error) { logApiError("GET /api/projects",error);return NextResponse.json(databaseErrorResponse(error,"Projects are temporarily unavailable."),{status:503}); }
}
