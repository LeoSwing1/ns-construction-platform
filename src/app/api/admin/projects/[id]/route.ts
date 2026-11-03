import {NextResponse} from "next/server";
import {z} from "zod";
import {logApiError} from "@/lib/api-errors";
import {canManageContent,getAdminOrResponse} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {databaseErrorResponse,prismaErrorCode} from "@/lib/prisma-errors";
const schema=z.object({title:z.string().min(3).optional(),slug:z.string().regex(/^[a-z0-9-]+$/).optional(),category:z.string().min(2).optional(),location:z.string().min(2).optional(),year:z.number().int().nullable().optional(),summary:z.string().min(5).optional(),description:z.string().min(5).optional(),coverImage:z.string().url().nullable().optional(),gallery:z.array(z.string().url()).optional(),featured:z.boolean().optional(),published:z.boolean().optional()});
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const authorization=await getAdminOrResponse();if(authorization.response)return authorization.response;const admin=authorization.admin;if(!canManageContent(admin))return NextResponse.json({error:"You do not have permission to manage projects."},{status:403});
 const {id}=await params;const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:p.error.flatten()},{status:400});
 try{const item=await prisma.project.update({where:{id},data:p.data});await prisma.activityLog.create({data:{action:"PROJECT_UPDATED",entityType:"PROJECT",entityId:id,actorEmail:admin.email,details:"Project details or publication state updated."}});return NextResponse.json(item);}
 catch(error){const code=prismaErrorCode(error);logApiError("/api/admin/projects PATCH",error);return code==="P2025"?NextResponse.json({error:"Project not found.",code:"RECORD_NOT_FOUND"},{status:404}):code==="P2002"?NextResponse.json({error:"A project with this slug already exists.",code:"DUPLICATE_SLUG"},{status:409}):NextResponse.json(databaseErrorResponse(error,"Project could not be updated."),{status:503});}
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
 const authorization=await getAdminOrResponse();if(authorization.response)return authorization.response;const admin=authorization.admin;if(!canManageContent(admin))return NextResponse.json({error:"You do not have permission to manage projects."},{status:403});
 const {id}=await params;try{await prisma.$transaction([prisma.activityLog.create({data:{action:"PROJECT_DELETED",entityType:"PROJECT",entityId:id,actorEmail:admin.email,details:"Project deleted from the website."}}),prisma.project.delete({where:{id}})]);return NextResponse.json({ok:true});}
 catch(error){const code=prismaErrorCode(error);logApiError("/api/admin/projects DELETE",error);return code==="P2025"?NextResponse.json({error:"Project not found.",code:"RECORD_NOT_FOUND"},{status:404}):NextResponse.json(databaseErrorResponse(error,"Project could not be deleted."),{status:503});}
}
