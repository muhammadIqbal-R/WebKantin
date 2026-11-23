import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const target=new URL('../.env',import.meta.url);let text='';try{text=await readFile(target,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
const existing=text.match(/^IDEMPOTENCY_ENCRYPTION_KEY=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');
if(existing&&Buffer.from(existing,'base64').length===32){console.log('Existing checkout encryption key retained.');process.exit(0);}
const line='IDEMPOTENCY_ENCRYPTION_KEY='+randomBytes(32).toString('base64');
await writeFile(target,text.match(/^IDEMPOTENCY_ENCRYPTION_KEY=/m)?text.replace(/^IDEMPOTENCY_ENCRYPTION_KEY=.*$/m,line):text.trimEnd()+'\n'+line+'\n',{mode:0o600});
console.log('Checkout encryption key configured in apps/api/.env. Its value was not printed.');
