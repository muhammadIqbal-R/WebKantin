// Local Auth fixture for manual browser QA. Never deploy or use with real data.
import http from 'node:http';
import fs from 'node:fs';
import { randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const app = path.join(root, 'apps/web-user');
const require = createRequire(path.join(app, 'package.json'));
const qaTypeConfig = JSON.parse(fs.readFileSync(path.join(app, 'tsconfig.json'), 'utf8'));
qaTypeConfig.include = qaTypeConfig.include.filter(value => !value.startsWith('.next/'));
qaTypeConfig.exclude = ['node_modules', '.next'];
fs.writeFileSync(path.join(app, 'tsconfig.qa.json'), JSON.stringify(qaTypeConfig, null, 2)+'\n');
const users = new Map();
const sessions = new Map();
const signingSecret = randomUUID();
const endpoint = 'http://127.0.0.1:4100';
const hash = value => createHash('sha256').update(value).digest();
function publicUser(entry) {
  return { id: entry.id, aud: 'authenticated', role: 'authenticated', email: entry.email,
    email_confirmed_at: entry.created_at, created_at: entry.created_at, updated_at: entry.created_at,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: entry.name }, identities: [] };
}
function session(entry) {
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const unsigned = encode({ alg: 'HS256', typ: 'JWT' })+'.'+encode({
    sub: entry.id, role: 'authenticated', aud: 'authenticated', iat: now, exp: now+3600,
    iss: endpoint+'/auth/v1', email: entry.email,
  });
  const token = unsigned+'.'+createHmac('sha256',signingSecret).update(unsigned).digest('base64url');
  sessions.set(token,entry);
  return { access_token: token, token_type: 'bearer', expires_in: 3600,
    expires_at: now+3600, refresh_token: 'qa_'+randomUUID(), user: publicUser(entry) };
}
const server = http.createServer(async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','http://localhost:3100');
  res.setHeader('Access-Control-Allow-Headers','apikey,authorization,content-type,x-client-info,x-supabase-api-version');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Cache-Control','no-store');
  if (req.method==='OPTIONS') { res.writeHead(204);res.end();return; }
  const send = (status,body) => { res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body)); };
  const pathname = new URL(req.url,endpoint).pathname;
  try {
    let raw='';for await (const chunk of req) { raw+=chunk;if(raw.length>10000){send(413,{error:'body_too_large'});return;} }
    const input = raw ? JSON.parse(raw) : {};
    if (pathname==='/health') { send(200,{mode:'isolated-auth-fixture',realEmail:false,users:users.size});return; }
    if (pathname==='/auth/v1/settings') { send(200,{external:{email:true},disable_signup:false,mailer_autoconfirm:true});return; }
    if (pathname==='/auth/v1/signup' && req.method==='POST') {
      if(typeof input.email!=='string'||!input.email.endsWith('@example.test')||typeof input.password!=='string'||input.password.length<8) {
        send(422,{error:'invalid_test_identity',error_description:'Use an example.test identity with password >= 8 characters'});return;
      }
      const email=input.email.toLowerCase();
      if(users.has(email)){send(422,{error:'user_already_exists',error_description:'Test identity already exists'});return;}
      const entry={id:randomUUID(),email,name:typeof input.data?.display_name==='string'?input.data.display_name:'QA Customer',passwordHash:hash(input.password),created_at:new Date().toISOString()};
      users.set(email,entry);send(200,session(entry));return;
    }
    if (pathname==='/auth/v1/token' && req.method==='POST') {
      const entry=users.get(String(input.email).toLowerCase());
      if(!entry||typeof input.password!=='string'||!timingSafeEqual(entry.passwordHash,hash(input.password))){
        send(400,{error:'invalid_grant',error_description:'Invalid login credentials'});return;
      }
      send(200,session(entry));return;
    }
    const token=(req.headers.authorization??'').replace(/^Bearer /,'');
    const entry=sessions.get(token);
    if(pathname==='/auth/v1/user'){send(entry?200:401,entry?publicUser(entry):{error:'unauthorized'});return;}
    if(pathname==='/auth/v1/logout'&&req.method==='POST'){sessions.delete(token);res.writeHead(204);res.end();return;}
    send(404,{error:'fixture_endpoint_not_available'});
  } catch { send(400,{error:'invalid_fixture_request'}); }
});
let frontend;
let closing=false;
function stop() { if(closing)return;closing=true;frontend?.kill();server.close();users.clear();sessions.clear(); }
process.on('SIGINT',stop);process.on('SIGTERM',stop);
server.listen(4100,'127.0.0.1',()=>{
  console.log('ISOLATED QA ONLY: Auth fixture on 127.0.0.1:4100; web-user on localhost:3100. No email, no live database.');
  frontend=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--port','3100'],{
    cwd:app,stdio:'inherit',windowsHide:true,env:{...process.env,
      KANTIN_QA_ISOLATED:'1',NEXT_PUBLIC_QA_AUTH_SIMULATED:'true',
      NEXT_PUBLIC_API_URL:endpoint,
      NEXT_PUBLIC_SUPABASE_URL:endpoint,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_QA_ONLY_NOT_A_REAL_KEY',
    },
  });
  frontend.on('exit',()=>stop());
});
