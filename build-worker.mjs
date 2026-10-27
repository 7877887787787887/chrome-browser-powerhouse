import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const worker = "export default { async fetch(request, env, ctx) { const html = " + JSON.stringify(html) + "; return new Response(html, { headers: { \"content-type\": \"text/html; charset=utf-8\", \"cache-control\": \"no-store\", \"x-content-type-options\": \"nosniff\", \"referrer-policy\": \"strict-origin-when-cross-origin\", \"content-security-policy\": \"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' https://msi.tail28f016.ts.net:8443; img-src 'self' data: blob: https://msi.tail28f016.ts.net:8443; frame-ancestors 'none';\" } }); } };";
fs.writeFileSync(path.join(root, "_worker.js"), worker, "utf8");
console.log(JSON.stringify({ hash: crypto.createHash("sha256").update(worker).digest("hex"), bytes: Buffer.byteLength(worker) }));
