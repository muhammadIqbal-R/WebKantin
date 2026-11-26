import Busboy from 'busboy';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { IdSchema, LIMITS, UploadMetadataSchema } from '@kantin/shared';
import { HttpError } from './errors.js';
export type MediaPurpose = 'menu_photo' | 'tenant_qris' | 'floor_map' | 'payment_proof';
const buckets = {menu_photo:'menu-photos',tenant_qris:'tenant-qris',floor_map:'floor-maps',payment_proof:'payment-proofs'} as const;
export async function readImage(req: Request): Promise<{bytes:Buffer;mime:string}> {
  return new Promise((resolve,reject)=>{
    let parser:ReturnType<typeof Busboy>;
    try{parser=Busboy({headers:req.headers,limits:{files:1,fields:0,parts:2,fileSize:LIMITS.maxPhotoBytes,headerPairs:30}});}catch{reject(new HttpError(400,'Gunakan formulir satu file gambar.'));return;}
    let file:{bytes:Buffer;mime:string}|null=null;let failure:HttpError|null=null;
    parser.on('file',(name,stream,info)=>{
      if(name!=='file')failure=new HttpError(400,'Field gambar harus bernama file.');
      else if(!UploadMetadataSchema.shape.mime_type.safeParse(info.mimeType).success)failure=new HttpError(415,'Pilih gambar JPG, PNG, atau WebP.');
      const chunks:Buffer[]=[];
      stream.on('limit',()=>{failure=new HttpError(413,'Gambar maksimal 2 MiB.');});
      stream.on('data',(chunk:Buffer)=>{if(!failure)chunks.push(chunk);});
      stream.on('end',()=>{file={bytes:Buffer.concat(chunks),mime:info.mimeType};});
      stream.on('error',()=>reject(new HttpError(400,'Gambar tidak selesai dikirim.')));
    });
    parser.on('filesLimit',()=>{failure=new HttpError(400,'Kirim tepat satu gambar.');});
    parser.on('fieldsLimit',()=>{failure=new HttpError(400,'Field upload tidak valid.');});
    parser.on('partsLimit',()=>{failure=new HttpError(400,'Kirim tepat satu file tanpa field tambahan.');});
    parser.on('error',()=>reject(new HttpError(400,'Form upload tidak valid.')));
    req.on('aborted',()=>reject(new HttpError(400,'Upload terputus.')));
    parser.on('close',()=>{if(failure)reject(failure);else if(!file?.bytes.length)reject(new HttpError(400,'Pilih gambar terlebih dahulu.'));else resolve(file);});
    req.pipe(parser);
  });
}
export async function normalizeImage(bytes:Buffer,mime:string,purpose:MediaPurpose):Promise<Buffer>{
  if(!UploadMetadataSchema.safeParse({mime_type:mime,size_bytes:bytes.length}).success)throw new HttpError(bytes.length>LIMITS.maxPhotoBytes?413:415,'Gambar JPG, PNG, atau WebP maksimal 2 MiB.');
  const signature=bytes.subarray(0,12);
  const format=signature[0]===255&&signature[1]===216&&signature[2]===255?'jpeg':signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':signature.subarray(0,4).toString()==='RIFF'&&signature.subarray(8,12).toString()==='WEBP'?'webp':null;
  if(!format||mime!=='image/'+(format==='jpeg'?'jpeg':format))throw new HttpError(415,'Isi gambar tidak sesuai jenis file.');
  try{
    let image=sharp(bytes,{limitInputPixels:16_000_000,failOn:'warning'});
    const meta=await image.metadata();
    if(meta.format!==format||(meta.pages??1)!==1)throw new HttpError(415,'Gunakan gambar diam yang valid.');
    image=image.rotate();if(purpose==='menu_photo')image=image.resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true});
    const result=await image.webp({lossless:true}).toBuffer();
    if(result.length>LIMITS.maxPhotoBytes)throw new HttpError(413,'Gambar terlalu besar setelah diproses. Pilih resolusi lebih kecil.');
    return result;
  }catch(error:unknown){if(error instanceof HttpError)throw error;throw new HttpError(415,'Gambar rusak atau dimensinya terlalu besar.');}
}
export class Media {
  private client:SupabaseClient|null;
  private origin:string;
  constructor(url:string,key:string|undefined){this.origin=new URL(url).origin;this.client=key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;}
  private storage(){if(!this.client)throw new HttpError(503,'Penyimpanan gambar belum dikonfigurasi.');return this.client.storage;}
  path(url:string,purpose:MediaPurpose,owner:string):string{
    const uri=new URL(url),bucket=buckets[purpose],access=purpose==='menu_photo'?'public':'authenticated';
    const prefix='/storage/v1/object/'+access+'/'+bucket+'/'+owner+'/';
    const filename=uri.pathname.startsWith(prefix)?uri.pathname.slice(prefix.length):'';
    if(uri.origin!==this.origin||uri.username||uri.password||uri.search||uri.hash||!filename.endsWith('.webp')||!IdSchema.safeParse(filename.slice(0,-5)).success)throw new HttpError(400,'Gambar tidak cocok dengan pemilik atau tujuan yang dipilih.');
    return owner+'/'+filename;
  }
  async assertAsset(url:string,purpose:MediaPurpose,owner:string){const path=this.path(url,purpose,owner);const {data,error}=await this.storage().from(buckets[purpose]).info(path);if(error||!data)throw new HttpError(400,'Aset gambar tidak ditemukan. Unggah kembali melalui aplikasi.');}
  private async uploadObject(bytes:Buffer,purpose:MediaPurpose,owner:string){
    const path=owner+'/'+randomUUID()+'.webp',bucket=buckets[purpose],storage=this.storage().from(bucket);
    const {data,error}=await storage.createSignedUploadUrl(path,{upsert:false});
    if(error||!data)throw new HttpError(503,'Gambar belum dapat diunggah. Periksa konfigurasi Storage.');
    const result=await storage.uploadToSignedUrl(path,data.token,bytes,{contentType:'image/webp',cacheControl:purpose==='payment_proof'?'0':'31536000'});
    if(result.error)throw new HttpError(503,'Upload gambar gagal. Coba kembali.');
    return path;
  }
  async upload(bytes:Buffer,purpose:Exclude<MediaPurpose,'payment_proof'>,owner:string){
    const path = await this.uploadObject(bytes,purpose,owner);
    return this.origin+'/storage/v1/object/'+(purpose==='menu_photo'?'public':'authenticated')+'/'+buckets[purpose]+'/'+path;
  }
  uploadPaymentProof(bytes:Buffer,orderId:string){
    return this.uploadObject(bytes,'payment_proof',orderId);
  }
  async previewPaymentProof(path:string){
    const {data,error}=await this.storage().from(buckets.payment_proof).createSignedUrl(path,300);
    if(error||!data)throw new HttpError(503,'Bukti pembayaran belum dapat dimuat. Coba kembali.');
    return data.signedUrl;
  }
  async discardPaymentProof(path:string){
    await this.storage().from(buckets.payment_proof).remove([path]);
  }
  async preview(url:string,owner:string,purpose:'tenant_qris'|'floor_map'='tenant_qris'):Promise<string|null>{
    try {
      const path=this.path(url,purpose,owner);
      const {data,error}=await this.storage().from(buckets[purpose]).createSignedUrl(path,purpose==='floor_map'?300:3600);
      return error?null:data?.signedUrl??null;
    } catch { return null; }
  }
}
