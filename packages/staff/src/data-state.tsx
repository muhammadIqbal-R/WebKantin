'use client';
import { Button } from '@kantin/ui';
export function DataState({loading,error,retry}:{loading:boolean;error:string;retry:()=>Promise<void>}){
  if(loading)return <p role="status">Memuat data…</p>;
  if(error)return <div className="notice stack"><p role="alert">{error}</p><Button variant="outline" onClick={()=>void retry()}>Coba kembali</Button></div>;
  return null;
}
