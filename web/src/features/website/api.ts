import { validateImage } from '../../lib/business-media';
import { supabase } from '../../lib/supabase';
import { publicSiteFromSnapshot } from '../../store/db';
import type { PublicSite } from '../../types/domain';
import { completeDraft } from './templates';
export interface EditorData { draft:PublicSite; revision:number; publishedAt:string|null; publishedRevision:number|null }
export function websiteError(error:unknown) {
 const e=error as {code?:string;message?:string};
 if(e?.code==='PGRST202')return 'Falta instalar EDITOR_WEB.sql en Supabase, después de la migración de planes.';
 return e?.message || 'No se pudo completar la operación. Tus cambios siguen en el editor.';
}
export async function loadEditor(bid:string):Promise<EditorData> {
 const r=await supabase.rpc('get_website_editor',{p_business_id:bid});if(r.error)throw r.error;
 const site=publicSiteFromSnapshot(r.data?.draft);if(!site)throw new Error('El servidor no devolvió el borrador.');
 return {draft:completeDraft(site),revision:Number(r.data.revision),publishedAt:r.data.published_at,publishedRevision:r.data.published_revision==null?null:Number(r.data.published_revision)};
}
const editableDraft=(s:PublicSite)=>({business:s.business,branding:s.branding,website:s.website,sections:s.sections});
export async function saveDraft(bid:string,draft:PublicSite,revision:number) {
 const r=await supabase.rpc('save_website_draft',{p_business_id:bid,p_draft:editableDraft(draft),p_expected_revision:revision});if(r.error)throw r.error;return Number(r.data);
}
export async function publishDraft(bid:string,draft:PublicSite,revision:number):Promise<{revision:number;slug:string;published_at:string;release_id:string}> {
 const r=await supabase.rpc('publish_website_draft',{p_business_id:bid,p_draft:editableDraft(draft),p_expected_revision:revision});if(r.error)throw r.error;
 if(!r.data?.release_id||!r.data?.slug)throw new Error('No se recibió confirmación de publicación.');return r.data;
}
export async function uploadWebsiteImage(bid:string,file:File,role:'cover'|'logo'|'about'|'gallery'):Promise<string> {
 const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 await validateImage(file,10);
 const bucket=role==='cover'||role==='logo'?'brand-assets':'website-media';
 const path=`${bid}/website/${role}/${crypto.randomUUID()}.${ext[file.type]}`;
 const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type,cacheControl:'31536000'});
 if(error)throw error;
 return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
