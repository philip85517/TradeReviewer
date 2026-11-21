import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

test('built homepage uses only same-origin styles and ships its font files',async()=>{
 const {default:worker}=await import('../dist/server/index.js');
 const response=await worker.fetch(new Request('http://localhost/home'),{ASSETS:{fetch:async()=>new Response('',{status:404})}},{waitUntil(){},passThroughOnException(){}});
 const html=await response.text();assert.equal(response.status,200);
 assert.doesNotMatch(html,/https?:\/\/fonts\.(?:googleapis|gstatic)\.com/,'external font requests block a cold homepage');
 const links=[...html.matchAll(/<link\b[^>]*>/g)].map(x=>x[0]).filter(x=>/rel="stylesheet"/.test(x));assert.ok(links.length);
 let css='';for(const link of links){const href=link.match(/href="([^"]+)"/)?.[1];assert.ok(href?.startsWith('/'),'all styles are local');css+=readFileSync(new URL('../dist/client'+href,import.meta.url),'utf8');}
 assert.doesNotMatch(css,/https?:\/\/fonts\.(?:googleapis|gstatic)\.com/);
 const fonts=[...css.matchAll(/url\(["']?(\/[^)"']+\.woff2)["']?\)/g)].map(m=>m[1]);assert.ok(fonts.length>=2,'sans and mono files are shipped');
 for(const url of fonts)assert.equal(readFileSync(new URL('../dist/client'+url,import.meta.url)).subarray(0,4).toString(),'wOF2');
});
