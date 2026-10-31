// Cloudflare serves the verified Private Chrome viewer. Never publish the classic index.html as the default.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import{fileURLToPath}from'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(root,'cloudflare-view.html'),'utf8');
const release=html.match(/const VERSION='([^']+)';/)?.[1];const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const approved=JSON.parse(fs.readFileSync(path.join(root,'cloudflare-release.json'),'utf8'));
assert(/^\d{4}\.\d{2}\.\d{2}-private-stable\d+$/.test(release||''),'Private stable release required.');
assert.equal(release,approved.release,'Release manifest mismatch.');assert.equal(hash(html),approved.htmlSha256,'Only the tested viewer may be published.');
for(const id of ['performanceMode','sizing','viewport','networkhelp','connectioninfo'])assert(html.includes('id="'+id+'"'));
assert(html.includes('sessionStorage')&&html.includes('tab-hidden-kept-connected'));assert(!html.includes('resumeOnVisible=wantConnection&&!!token;closeView()'));
assert(!/\sstyle\s*=|\son[a-z0-9_-]+\s*=/i.test(html));assert(!html.includes('passwordHash'));
const hashes=tag=>[...html.matchAll(new RegExp('<'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/'+tag+'>','gi'))].map(m=>"'sha256-"+crypto.createHash('sha256').update(m[1].replace(/\r\n?/g,'\n')).digest('base64')+"'");
const scripts=hashes('script'),styles=hashes('style');assert(scripts.length&&styles.length);
const csp=["default-src 'self'","base-uri 'none'","object-src 'none'","frame-ancestors 'none'","form-action 'self'","script-src 'self' https://harvard-advanced-none-house.trycloudflare.com "+scripts.join(' '),"script-src-attr 'none'","style-src 'self' "+styles.join(' '),"style-src-attr 'none'","img-src 'self' blob: data:","connect-src 'self' https://harvard-advanced-none-house.trycloudflare.com wss://msi.tail28f016.ts.net:8443"].join('; ');
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','strict-transport-security':'max-age=31536000; includeSubDomains','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()','content-security-policy':csp,'x-connor-release':release};
const worker='const HTML='+JSON.stringify(html)+';const HEADERS='+JSON.stringify(headers)+";export default {async fetch(request){const p=new URL(request.url).pathname;const head=request.method==='HEAD';if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...HEADERS,Allow:'GET, HEAD'}});if(p==='/favicon.ico')return new Response(null,{status:204,headers:HEADERS});if(p==='/legacy'||p==='/legacy/')return new Response(null,{status:302,headers:{...HEADERS,Location:'https://harvard-advanced-none-house.trycloudflare.com/private-chrome/'}});if(!['/','/index.html','/private-chrome','/private-chrome/','/virtual-browser/'].includes(p))return new Response(head?null:'Not found',{status:404,headers:{...HEADERS,'content-type':'text/plain; charset=utf-8'}});return new Response(head?null:HTML,{status:200,headers:{...HEADERS,'content-type':'text/html; charset=utf-8'}});}};\n";
fs.writeFileSync(path.join(root,'_worker.js'),worker);
console.log(JSON.stringify({release,htmlSha256:hash(html),workerSha256:hash(worker),bytes:Buffer.byteLength(worker),secretsIncluded:false,upstreamProxy:false}));
