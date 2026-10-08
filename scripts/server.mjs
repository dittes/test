import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { watch } from 'node:fs';
import { spawnSync } from 'node:child_process';

const base=resolve(import.meta.dirname,'..');
const root=resolve(base,'dist');
const port=Number(process.env.PORT || 4173);
function build(){const result=spawnSync(process.execPath,[resolve(base,'scripts/build.mjs')],{stdio:'inherit'});return result.status===0;}
if(!build())process.exit(1);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain; charset=utf-8','.bin':'application/octet-stream'};
createServer(async(req,res)=>{
  try{
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/speed-test-upload'&&req.method==='POST'){for await(const _chunk of req){}res.writeHead(204,{'Cache-Control':'no-store'});return res.end();}
    let path=resolve(root,'.'+pathname);
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);return res.end('Forbidden');}
    try{const info=await stat(path);if(info.isDirectory()){if(!pathname.endsWith('/')){res.writeHead(308,{Location:pathname+'/'});return res.end();}path=resolve(path,'index.html');}}catch{}
    let body,status=200;
    try{body=await readFile(path);}catch{body=await readFile(resolve(root,'404.html'));path='404.html';status=404;}
    res.writeHead(status,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(self), microphone=(self), geolocation=()'});res.end(body);
  }catch{res.writeHead(400);res.end('Bad request');}
}).listen(port,'127.0.0.1',()=>console.log(`Test Institute: http://localhost:${port}`));
let timer;for(const dir of ['assets','content','scripts'])watch(resolve(base,dir),{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(build,150);});
