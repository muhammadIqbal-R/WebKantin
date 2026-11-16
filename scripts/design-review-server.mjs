// Standalone design review server. Only proposal files and approved public assets.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
const proposals=path.join(project,'docs/design/proposals');
const publicAssets=path.join(project,'apps/web-user/public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost:3200').pathname);
 let base,relative;
 if(pathname.startsWith('/assets/brand/')||pathname.startsWith('/assets/food/')){base=publicAssets;relative=pathname.slice('/assets/'.length);}
 else if(pathname.startsWith('/fonts/')){base=path.join(proposals,'assets/fonts');relative=pathname.slice('/fonts/'.length);}
 else if(['/','/index.html','/proposal.css','/proposal.js'].includes(pathname)){base=proposals;relative=pathname==='/'?'index.html':pathname.slice(1);}
 else{res.writeHead(404);res.end();return;}
 const target=path.resolve(base,relative);
 if(!target.startsWith(path.resolve(base)+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(target,(error,bytes)=>{
  if(error){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(target)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);
 });
});
server.listen(3200,'127.0.0.1',()=>console.log('Design review: http://localhost:3200 — only proposal files, public photos/logo and local fonts.'));
process.on('SIGINT',()=>server.close());process.on('SIGTERM',()=>server.close());
