import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiError } from "@/lib/api-errors";
import { canManageContent, getAdminOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";
const schema=z.object({
 title:z.string().min(5),slug:z.string().min(3).regex(/^[a-z0-9-]+$/),excerpt:z.string().min(10),
 content:z.string().min(20),coverImage:z.string().url().optional().or(z.literal("")),category:z.string().min(2),
 tags:z.array(z.string()).default([]),seoTitle:z.string().optional(),seoDescription:z.string().optional(),
 status:z.enum(["DRAFT","PUBLISHED","SCHEDULED"]).default("DRAFT")
});
export async function GET(){
 const authorization=await getAdminOrResponse();if(authorization.response)return authorization.response;
 try{return NextResponse.json(await prisma.blogPost.findMany({orderBy:{updatedAt:"desc"}}));}
 catch(error){logApiError("/api/admin/blog GET",error);return NextResponse.json(databaseErrorResponse(error,"Articles are temporarily unavailable."),{status:503});}
}
export async function POST(req:Request){
 const authorization=await getAdminOrResponse();if(authorization.response)return authorization.response;const admin=authorization.admin;if(!canManageContent(admin))return NextResponse.json({error:"You do not have permission to manage articles."},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success) return NextResponse.json({error:parsed.error.flatten()},{status:400});
 const data=parsed.data;
 try { const post=await prisma.blogPost.create({data:{...data,coverImage:data.coverImage||null,publishedAt:data.status==="PUBLISHED"?new Date():null}});await prisma.activityLog.create({data:{action:"ARTICLE_CREATED",entityType:"BLOG_POST",entityId:post.id,actorEmail:admin.email,details:`Article ${post.slug} created.`}});return NextResponse.json(post,{status:201}); }
 catch (error) { logApiError("/api/admin/blog POST",error);return prismaErrorCode(error)==="P2002"?NextResponse.json({error:"An article with this slug already exists."},{status:409}):NextResponse.json(databaseErrorResponse(error,"Article could not be saved."),{status:503}); }
}
