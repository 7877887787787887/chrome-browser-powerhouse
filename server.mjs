import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "./node_modules/playwright-core/index.mjs";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, m => m.slice(1)));
const DATA = path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE, "ChromeBrowserPowerhouse");
const PROFILE = path.join(DATA, "VirtualChromiumProfile");
const TAB_STATE = path.join(DATA, "browser-tabs.json");
let persistTimer;
function tabSnapshot(){ const all=[...tabs.entries()].map(([id,p])=>{ try { const u=new URL(p.url()); if(!["http:","https:"].includes(u.protocol))return null; if(u.hostname.toLowerCase()==="accounts.google.com")return {id,url:"https://accounts.google.com/"}; return {id,url:u.toString()}; } catch { return null; } }).filter(Boolean); return {version:1,savedAt:new Date().toISOString(),tabs:all.map(t=>({url:t.url})),activeIndex:Math.max(0,all.findIndex(t=>t.id===activeTabId))}; }
function queuePersistTabs(){ clearTimeout(persistTimer); persistTimer=setTimeout(()=>{ try { fs.writeFileSync(TAB_STATE,JSON.stringify(tabSnapshot(),null,2),{encoding:"utf8",mode:0o600}); } catch {} },700); }
const CONFIG = path.join(ROOT, "config.json");
const EDGE = path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE, "ms-playwright", "chromium-1248", "chrome-win64", "chrome.exe");
const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGINS = new Set(["https://chrome-browser.pages.dev", "https://12ec2b51.chrome-browser.pages.dev", "http://localhost:5173", "http://127.0.0.1:5173"]);
fs.mkdirSync(DATA, { recursive: true }); fs.mkdirSync(PROFILE, { recursive: true });
let cfg; try { cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch { cfg = { password: crypto.randomBytes(24).toString("base64url") }; fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), { mode: 0o600 }); }
const sessions = new Map(), attempts = new Map(); let context, activePage, activeTabId, booting; const tabs = new Map();
function registerPage(p){ const existing=[...tabs.entries()].find(([,page])=>page===p); if(existing){activePage=p;activeTabId=existing[0];return existing[0];} const id=crypto.randomUUID();tabs.set(id,p);activePage=p;activeTabId=id;p.on("close",()=>{tabs.delete(id);if(activePage===p||!activePage||activePage.isClosed()){const last=[...tabs.entries()].at(-1);activeTabId=last?.[0];activePage=last?.[1];}queuePersistTabs();});return id; }
const now = () => Date.now();
function cleanUrl(raw) {
  if (typeof raw !== "string" || raw.length > 2048) throw new Error("URL must be under 2048 characters.");
  let u; try { u = new URL(raw.includes("://") ? raw : (/^[\w-]+(?:\.[\w-]+)+(?:\/.*)?$/.test(raw) ? "https://" + raw : "https://www.google.com/search?q=" + encodeURIComponent(raw))); } catch { throw new Error("Invalid URL."); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only HTTP and HTTPS websites are supported.");
  if (u.protocol === "http:" && !["localhost","127.0.0.1"].includes(u.hostname.toLowerCase())) u.protocol = "https:";
  const h = u.hostname.toLowerCase();
  if (h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h==="::1"||h==="0.0.0.0"||h.startsWith("127.")||h.startsWith("10.")||h.startsWith("192.168.")||h.startsWith("169.254.")||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)||h.endsWith(".internal")) throw new Error("Private and local network addresses are blocked.");
  return u.toString();
}
async function ensureBrowser() {
  if (context) return; if (booting) return booting;
  booting = (async()=>{ context=await chromium.launchPersistentContext(PROFILE,{executablePath:EDGE,headless:true,viewport:{width:1440,height:900},args:["--disable-features=Translate","--no-first-run","--force-webrtc-ip-handling-policy=disable_non_proxied_udp"]}); context.on("page",p=>registerPage(p));activePage=context.pages()[0]||await context.newPage();activeTabId=registerPage(activePage);const saved=(()=>{try{return JSON.parse(fs.readFileSync(TAB_STATE,"utf8"));}catch{return null;}})();const pages=context.pages();const meaningful=pages.some(p=>p.url()!=="about:blank");if(!meaningful&&Array.isArray(saved?.tabs)&&saved.tabs.length){for(let i=0;i<saved.tabs.length;i++){const item=saved.tabs[i];if(typeof item?.url!=="string"||!/^https?:\/\//i.test(item.url)||/(accounts\.google\.com\/(?:signin|o\/oauth)|oauth2|ServiceLogin)/i.test(item.url))continue;let p;if(i===0){p=activePage;}else{p=await context.newPage();}await p.goto(item.url,{waitUntil:"domcontentloaded",timeout:15000}).catch(()=>{});}const list=[...tabs.entries()];const pick=list[Math.min(Number(saved.activeIndex)||0,list.length-1)];if(pick){activeTabId=pick[0];activePage=pick[1];}} })();
  try { await booting; } finally { booting=null; }
}
function json(res,status,data){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","X-Frame-Options":"DENY","Permissions-Policy":"camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()","Cross-Origin-Resource-Policy":"same-site","Strict-Transport-Security":"max-age=31536000; includeSubDomains"});res.end(JSON.stringify(data));}
function cors(req,res){const origin=req.headers.origin;if(origin&&(ALLOWED_ORIGINS.has(origin)||/^https:\/\/[a-z0-9-]+\.chrome-browser\.pages\.dev$/i.test(origin))){res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin");res.setHeader("Access-Control-Allow-Headers","Authorization,Content-Type");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");}}
function body(req){return new Promise((resolve,reject)=>{let s="";req.on("data",c=>{s+=c.toString();if(s.length>32768){reject(new Error("Request too large"));req.destroy();}});req.on("end",()=>{try{resolve(s?JSON.parse(s):{});}catch{reject(new Error("Invalid JSON"));}});req.on("error",reject);});}
function authorized(req){const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");const exp=sessions.get(token);if(!exp||exp<now()){sessions.delete(token);return false;}sessions.set(token,now()+8*60*60*1000);return true;}
async function state(){await ensureBrowser();const tabList=await Promise.all([...tabs.entries()].map(async([id,p])=>({id,title:await p.title().catch(()=>""),url:p.url()})));return{ok:true,title:await activePage.title().catch(()=>""),url:activePage.url(),activeTab:activeTabId,tabs:tabList,browser:"Virtual Chromium browser on local PC"};}
const server=http.createServer(async(req,res)=>{cors(req,res);if(req.method==="OPTIONS"){res.writeHead(204);return res.end();}const u=new URL(req.url,"http://127.0.0.1");
try{
 if((u.pathname==="/"||u.pathname==="/index.html")&&req.method==="GET"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});return res.end(fs.readFileSync(path.join(ROOT,"index.html")));}
 if(u.pathname==="/health")return json(res,200,{ok:true,service:"Chrome Browser Powerhouse",browser:"Virtual Chromium",time:new Date().toISOString()});
 if(u.pathname==="/auth/login"&&req.method==="POST"){const ip=req.socket.remoteAddress||"unknown",times=(attempts.get(ip)||[]).filter(t=>now()-t<60000);if(times.length>=8){attempts.set(ip,times);return json(res,429,{error:"Too many attempts. Wait one minute."});}const b=await body(req);const a=crypto.createHash("sha256").update(typeof b.password==="string"?b.password:"").digest();const c=cfg.passwordHash?Buffer.from(cfg.passwordHash,"hex"):crypto.createHash("sha256").update(cfg.password||"").digest();if(a.length!==c.length||!crypto.timingSafeEqual(a,c)){times.push(now());attempts.set(ip,times);return json(res,401,{error:"Incorrect access password."});}const token=crypto.randomBytes(32).toString("base64url");sessions.set(token,now()+8*60*60*1000);return json(res,200,{ok:true,token,expiresIn:28800});}
 if(!u.pathname.startsWith("/api/"))return json(res,404,{error:"Not found"});if(!authorized(req))return json(res,401,{error:"Sign in to the local browser engine first."});await ensureBrowser();
 if(u.pathname==="/api/viewport"&&req.method==="POST"){const vb=await body(req);const width=Number(vb.width);const height=Number(vb.height);if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||width>2560||height<480||height>1600)throw new Error("Viewport size is out of range.");await activePage.setViewportSize({width,height});return json(res,200,await state());}
 if(u.pathname==="/api/state"&&req.method==="GET")return json(res,200,await state());
 if(u.pathname==="/api/stream"&&req.method==="GET"){
  const fpsRaw=Number(u.searchParams.get("fps")||12),qualityRaw=Number(u.searchParams.get("quality")||55);
  const fps=Math.max(1,Math.min(20,Number.isFinite(fpsRaw)?fpsRaw:12));
  const quality=Math.max(25,Math.min(75,Number.isFinite(qualityRaw)?qualityRaw:55));
  const boundary="ghostframe";
  res.writeHead(200,{"Content-Type":"multipart/x-mixed-replace; boundary="+boundary,"Cache-Control":"no-store, no-cache, must-revalidate","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Connection":"keep-alive",...(ALLOWED_ORIGINS.has(req.headers.origin)||((req.headers.origin||"").startsWith("https://")&&(req.headers.origin||"").endsWith(".chrome-browser.pages.dev"))?{"Access-Control-Allow-Origin":req.headers.origin,"Vary":"Origin"}:{})});
  res.flushHeaders?.();
  let stopped=false,busy=false;
  const stop=()=>{stopped=true;res.off("close",stop);};
  res.on("close",stop);req.on("aborted",stop);
  const delay=Math.round(1000/fps);
  while(!stopped&&!res.destroyed){
   const started=Date.now();
   if(!busy&&activePage&&!activePage.isClosed()){
    busy=true;
    try{const shot=await activePage.screenshot({type:"jpeg",quality,animations:"disabled",timeout:5000});if(!stopped&&!res.destroyed){res.write("--"+boundary+"\r\nContent-Type: image/jpeg\r\nContent-Length: "+shot.length+"\r\n\r\n");res.write(shot);res.write("\r\n");}}
    catch(e){if(!stopped&&!res.destroyed){res.write("--"+boundary+"\r\nContent-Type: application/json\r\n\r\n"+JSON.stringify({error:"Frame capture failed"})+"\r\n");}}
    finally{busy=false;}
   }
   if(stopped||res.destroyed)break;
   await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay-(Date.now()-started))));
  }
  return;
 }
 if(u.pathname==="/api/screenshot"&&req.method==="GET"){const shot=await activePage.screenshot({type:"jpeg",quality:58,animations:"disabled",timeout:12000});res.writeHead(200,{"Content-Type":"image/jpeg","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...((ALLOWED_ORIGINS.has(req.headers.origin)||/^https:\/\/[a-z0-9-]+\.chrome-browser\.pages\.dev$/i.test(req.headers.origin||""))?{"Access-Control-Allow-Origin":req.headers.origin}:{})});return res.end(shot);}
 if(req.method!=="POST")return json(res,405,{error:"POST required"});const b=await body(req);
 if(u.pathname==="/api/navigate"){const url=cleanUrl(b.url);await activePage.goto(url,{waitUntil:"domcontentloaded",timeout:30000}).catch(e=>{if(!/Timeout/i.test(e.message))throw e;});}
 else if(u.pathname==="/api/back")await activePage.goBack({waitUntil:"domcontentloaded",timeout:12000}).catch(()=>{});
 else if(u.pathname==="/api/forward")await activePage.goForward({waitUntil:"domcontentloaded",timeout:12000}).catch(()=>{});
 else if(u.pathname==="/api/reload")await activePage.reload({waitUntil:"domcontentloaded",timeout:15000}).catch(()=>{});
 else if(u.pathname==="/api/new-tab"){activePage=await context.newPage();const id=registerPage(activePage);activeTabId=id;if(b.url)await activePage.goto(cleanUrl(b.url),{waitUntil:"domcontentloaded",timeout:30000});queuePersistTabs();return json(res,200,{...(await state()),activeTab:id});}
 else if(u.pathname==="/api/switch-tab"){const p=tabs.get(b.id);if(!p)throw new Error("Tab not found.");activePage=p;activeTabId=b.id;}
 else if(u.pathname==="/api/close-tab"){const p=tabs.get(b.id);if(p){await p.close();tabs.delete(b.id);}if(activePage===p||!activePage||activePage.isClosed()){const last=[...tabs.entries()].at(-1);if(last){activeTabId=last[0];activePage=last[1];}else{activePage=await context.newPage();activeTabId=[...tabs.entries()].find(([id,p])=>p===activePage)?.[0];}}}
 else if(u.pathname==="/api/click"){const x=Number(b.x),y=Number(b.y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>4000||y>4000)throw new Error("Invalid click coordinates.");await activePage.mouse.click(x,y);}
 else if(u.pathname==="/api/type"){if(typeof b.text!=="string"||b.text.length>5000)throw new Error("Text must be under 5000 characters.");await activePage.keyboard.type(b.text);}
 else if(u.pathname==="/api/key"){const keys=new Set(["Enter","Tab","Escape","Backspace","Delete","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End","PageUp","PageDown","Control+A","Control+L","Control+R","Shift+Tab"]);if(!keys.has(b.key))throw new Error("Key not allowed.");await activePage.keyboard.press(b.key);}
 else if(u.pathname==="/api/scroll")await activePage.mouse.wheel(0,Math.max(-1500,Math.min(1500,Number(b.deltaY)||0)));
 else if(u.pathname==="/api/home")await activePage.goto("https://www.google.com",{waitUntil:"domcontentloaded",timeout:20000}).catch(()=>{});
 else return json(res,404,{error:"Unknown browser action"});queuePersistTabs();return json(res,200,await state());
}catch(e){return json(res,400,{error:String(e?.message||e).slice(0,300)});}
});
server.listen(PORT,"127.0.0.1",()=>console.log("Chrome Browser Powerhouse listening on "+PORT));
process.on("SIGINT",async()=>{clearTimeout(persistTimer);try{fs.writeFileSync(TAB_STATE,JSON.stringify(tabSnapshot(),null,2),{encoding:"utf8",mode:0o600});}catch{}if(context)await context.close();server.close(()=>process.exit(0));});