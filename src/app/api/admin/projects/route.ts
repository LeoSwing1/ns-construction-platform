import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageContent, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";
const schema = z.object({
  title:z.string().min(3), slug:z.string().min(3).regex(/^[a-z0-9-]+$/), category:z.string().min(2),
  location:z.string().min(2), year:z.coerce.number().int().optional(), summary:z.string().min(5),
  description:z.string().min(5), coverImage:z.string().url().optional().or(z.literal("")),
  gallery:z.array(z.string().url()).default([]), featured:z.boolean().default(false), published:z.boolean().default(true)
});
export async function GET() {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  try { return NextResponse.json(await prisma.project.findMany({orderBy:{createdAt:"desc"}})); }
  catch(error) { console.error("Admin projects could not be loaded");return NextResponse.json(databaseErrorResponse(error,"Projects are temporarily unavailable."),{status:503}); }
}
export async function POST(req:Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageContent(admin)) return NextResponse.json({error:"You do not have permission to manage projects."},{status:403});
  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:parsed.error.flatten()},{status:400});
  try {
    const project = await prisma.project.create({data:{...parsed.data,coverImage:parsed.data.coverImage||null}});
    await prisma.activityLog.create({data:{action:"PROJECT_CREATED",entityType:"PROJECT",entityId:project.id,actorEmail:admin.email,details:`Project ${project.slug} created.`}});
    return NextResponse.json(project,{status:201});
  } catch (error) {
    console.error("Project creation failed", { code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return prismaErrorCode(error) === "P2002"
      ? NextResponse.json({error:"A project with this slug already exists."},{status:409})
      : NextResponse.json(databaseErrorResponse(error,"Project could not be saved."),{status:503});
  }
}
