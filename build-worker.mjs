import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const hashes = tag => {
  const re = tag === "script" ? /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi : /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi;
  return [...html.matchAll(re)].filter(m => !/\bsrc\s*=/i.test(m[1])).map(m => "'sha256-" + crypto.createHash("sha256").update(m[2].replace(/\r\n?/g, "\n")).digest("base64") + "'");
};
if (/\sstyle\s*=/i.test(html) || /\son[a-z0-9_-]+\s*=/i.test(html)) throw new Error("Inline style/event-handler attributes are not allowed");
const scripts = hashes("script"), styles = hashes("style");
if (!scripts.length || !styles.length) throw new Error("Inline script/style hash missing");
const csp = [
  "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
  "script-src 'self' https://msi.tail28f016.ts.net:8443 " + scripts.join(" "), "script-src-attr 'none'",
  "style-src 'self' " + styles.join(" "), "style-src-attr 'none'",
  "connect-src 'self' https://msi.tail28f016.ts.net:8443 wss://msi.tail28f016.ts.net:8443",
  "img-src 'self' data: blob: https://msi.tail28f016.ts.net:8443"
].join("; ");
const worker = "export default { async fetch(request, env, ctx) { const html = " + JSON.stringify(html) + "; return new Response(html, { headers: { \"content-type\": \"text/html; charset=utf-8\", \"cache-control\": \"no-store\", \"x-content-type-options\": \"nosniff\", \"referrer-policy\": \"no-referrer\", \"x-frame-options\": \"DENY\", \"permissions-policy\": \"camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()\", \"strict-transport-security\": \"max-age=31536000; includeSubDomains\", \"content-security-policy\": " + JSON.stringify(csp) + " } }); } };";
if (!worker.includes("strict-transport-security") || !worker.includes("content-security-policy") || /unsafe-inline/i.test(worker)) throw new Error("Worker security header assertion failed");
fs.writeFileSync(path.join(root, "_worker.js"), worker, "utf8");
console.log(JSON.stringify({ hash: crypto.createHash("sha256").update(worker).digest("hex"), bytes: Buffer.byteLength(worker), scriptHashes: scripts.length, styleHashes: styles.length, unsafeInline: false }));
