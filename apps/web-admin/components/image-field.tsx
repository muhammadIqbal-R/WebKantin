'use client';
import { useEffect, useState } from 'react';
import { UploadMetadataSchema } from '@kantin/shared';
import { FoodPhoto, Field } from '@kantin/ui';
export function ImageField({label,file,current,onChange,disabled=false}:{label:string;file:File|null;current:string|null;onChange:(file:File|null)=>void;disabled?:boolean}){
  const [preview,setPreview]=useState<string|null>(null),[error,setError]=useState('');
  useEffect(()=>{if(!file)return;let alive=true;const url=URL.createObjectURL(file);Promise.resolve().then(()=>{if(alive)setPreview(url);});return()=>{alive=false;URL.revokeObjectURL(url);};},[file]);
  const source=file?preview:current;
  return <Field label={label}><div className="stack">{source?<FoodPhoto src={source} alt={label} className="upload-preview"/>:null}<input className="input" type="file" accept="image/jpeg,image/png,image/webp" aria-label={label} disabled={disabled} onChange={event=>{const selected=event.target.files?.[0]??null;if(selected&&!UploadMetadataSchema.safeParse({mime_type:selected.type,size_bytes:selected.size}).success){setError('Pilih JPG, PNG, atau WebP maksimal 2 MiB.');event.target.value='';onChange(null);return;}setError('');onChange(selected);}}/><span className="small muted">JPG, PNG, WebP · maksimal 2 MiB</span>{error?<span className="form-error" role="alert">{error}</span>:null}</div></Field>;
}
