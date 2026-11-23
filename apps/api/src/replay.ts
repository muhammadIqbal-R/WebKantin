import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {HttpError} from './errors.js';
export class ReplayCipher {
  private key:Buffer|null;
  constructor(value:string|undefined){const decoded=value?Buffer.from(value,'base64'):null;this.key=decoded?.length===32?decoded:null;}
  private secret(){if(!this.key)throw new HttpError(503,'Enkripsi checkout belum dikonfigurasi. Hubungi pengelola.');return this.key;}
  assertReady(){this.secret();}
  encrypt(value:unknown){const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.secret(),nonce),body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return 'v1:'+Buffer.concat([nonce,cipher.getAuthTag(),body]).toString('base64url');}
  decrypt(value:string):unknown{try{if(!value.startsWith('v1:'))throw new Error('Invalid replay');const raw=Buffer.from(value.slice(3),'base64url'),cipher=createDecipheriv('aes-256-gcm',this.secret(),raw.subarray(0,12));cipher.setAuthTag(raw.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(raw.subarray(28)),cipher.final()]).toString('utf8')) as unknown;}catch{throw new HttpError(503,'Pesanan tersimpan belum dapat dibaca. Hubungi pengelola sebelum mengulang checkout.');}}
}
