import type {z} from 'zod';
import {OrderSignalSchema} from './vendor.js';
type Signal=z.infer<typeof OrderSignalSchema>;
export class OrderNoticeLedger {
 private versions=new Map<string,number>();
 baseline(rows:Signal[]){for(const row of rows)this.versions.set(row.id,row.version);}
 consume(row:Signal):'order'|'payment'|null{const previous=this.versions.get(row.id)??0;if(row.version<=previous)return null;this.versions.set(row.id,row.version);if(this.versions.size>5000){const first=this.versions.keys().next().value;if(first)this.versions.delete(first);}return row.status==='menunggu_bayar'&&row.version===1?'order':row.status==='menunggu_konfirmasi'?'payment':null;}
}
