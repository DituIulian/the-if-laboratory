import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve(process.argv.includes('--dist')?'dist':'.');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!path.startsWith(root+sep) || (!['.html','.js','.css','.svg','.webp','.png'].includes(extname(path))) || path.includes(`${sep}supabase${sep}`)) {res.writeHead(403);res.end();return;}
    const data=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)],'Cache-Control':'no-cache'});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4173,'0.0.0.0',()=>console.log('The If Laboratory: http://localhost:4173'));
