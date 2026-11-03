import type {MetadataRoute} from "next";
import {prisma} from "@/lib/prisma";
import {logApiError} from "@/lib/api-errors";
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const base=process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000";
 let projects:{slug:string;updatedAt:Date}[]=[],posts:{slug:string;updatedAt:Date}[]=[];
 try{[projects,posts]=await Promise.all([prisma.project.findMany({where:{published:true},select:{slug:true,updatedAt:true}}),prisma.blogPost.findMany({where:{status:"PUBLISHED",publishedAt:{lte:new Date()}},select:{slug:true,updatedAt:true}})])}catch(error){logApiError("GET /sitemap.xml",error)}
 return [
  {url:base,lastModified:new Date(),changeFrequency:"weekly",priority:1},
  {url:`${base}/projects`,lastModified:new Date(),changeFrequency:"weekly",priority:.8},
  {url:`${base}/blog`,lastModified:new Date(),changeFrequency:"weekly",priority:.8},
  ...projects.map(p=>({url:`${base}/projects/${p.slug}`,lastModified:p.updatedAt,changeFrequency:"monthly" as const,priority:.7})),
  ...posts.map(p=>({url:`${base}/blog/${p.slug}`,lastModified:p.updatedAt,changeFrequency:"monthly" as const,priority:.7}))
 ];
}
