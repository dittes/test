import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'../dist');

test('every test page repeats its directory illustration as hidden decorative artwork',async()=>{
 const home=await readFile(resolve(root,'index.html'),'utf8');
 const cards=[...home.matchAll(/<a class="test-card" href="([^"]+)"[^>]*><div class="card-visual"[^>]*>(<svg[\s\S]*?<\/svg>)<\/div>/g)];
 assert.equal(cards.length,26);
 for(const [,route,icon] of cards){
  const html=await readFile(resolve(root,'.'+route,'index.html'),'utf8');
  assert.equal((html.match(/class="tool-page-art"/g)||[]).length,1,route);
  assert.ok(html.includes(`<div class="tool-page-art" aria-hidden="true">${icon}</div>`),`Mismatched artwork: ${route}`);
  assert.match(icon,/aria-hidden="true"/);
 }
 const css=await readFile(resolve(root,'assets','clean.css'),'utf8');
 assert.match(css,/pointer-events:none/);
 assert.match(css,/@media print\s*\{\s*\.tool-heading > \.tool-page-art\s*\{\s*display:none/);
});
const pages=JSON.parse(await readFile(new URL('../content/pages.json',import.meta.url),'utf8'));
async function htmlFiles(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory())files.push(...await htmlFiles(resolve(dir,entry.name)));else if(entry.name.endsWith('.html'))files.push(resolve(dir,entry.name));}return files;}

test('all generated internal links and assets resolve, with unique IDs per page',async()=>{
 for(const path of await htmlFiles(root)){
  const html=await readFile(path,'utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,`Duplicate ID in ${path}`);
  for(const [,link] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   if(link.startsWith('#')){assert.ok(ids.includes(link.slice(1)),`Missing anchor ${link} in ${path}`);continue;}
   if(!link.startsWith('/'))continue;
   const url=new URL(link.replaceAll('&amp;','&'),'https://test.institute');
   const file=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
   assert.ok((await stat(file)).isFile(),`Missing ${file}`);
   if(url.hash){const target=await readFile(file,'utf8');assert.ok(target.includes(`id="${url.hash.slice(1)}"`),`Missing ${link}`);}
  }
 }
});

test('complete tool pages have unique SEO content and preserved canonical routes',async()=>{
 assert.equal(pages.length,8);assert.equal(new Set(pages.map(p=>p.title)).size,8);
 assert.ok(pages.some(p=>p.slug==='headphone-test'));
 for(const page of pages){
  const html=await readFile(resolve(root,page.slug,'index.html'),'utf8');
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
  assert.ok(html.includes(`href="https://test.institute/${page.slug}/"`));
  assert.ok(html.includes(`data-tool="${page.id}"`));
  assert.ok(page.steps.length>=3&&page.troubleshooting.length>=4&&page.faqs.length>=4);
 }
 const sitemap=await readFile(resolve(root,'sitemap.xml'),'utf8');
 assert.equal((sitemap.match(/<url>/g)||[]).length,33);
 assert.ok(sitemap.includes('https://test.institute/imprint/'));
 assert.ok(!sitemap.includes('404.html'));
});

test('headphone page uses search-aligned copy without internal test identifiers',async()=>{
 const html=await readFile(resolve(root,'headphone-test','index.html'),'utf8');
 assert.match(html,/online headphone test/i);
 assert.match(html,/headset, earphones, earbuds/i);
 assert.match(html,/noise cancelling or sound quality/i);
 assert.doesNotMatch(html,/INSTRUMENT 0\d/i);
 assert.doesNotMatch(html,/TI—0\d/i);
});

test('directory cards are direct and the new input tests are generated',async()=>{
 const home=await readFile(resolve(root,'index.html'),'utf8');
 assert.equal((home.match(/class="test-card"/g)||[]).length,26);
 assert.match(home,/data-category="Input devices"/);
 assert.doesNotMatch(home,/Runs in your browser|class="arrow"|↗|→/);
 for (const slug of ['touchscreen-test','gamepad-test']) {
  const html=await readFile(resolve(root,slug,'index.html'),'utf8');
  assert.match(html,/data-tool="(?:touch|gamepad)"/);
 }
 assert.match(home,/Wi-Fi speed test/);
 assert.match(home,/Mobile device/);
 assert.doesNotMatch(home,/cx="100" cy="60" r="31"/);
 assert.equal((await stat(resolve(root,'assets','speed-sample.bin'))).size,2*1024*1024);
});
