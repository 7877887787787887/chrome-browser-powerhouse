import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)];
if (!scripts.length || !styles.length) throw new Error("Expected inline script and style blocks");
if (/\sstyle\s*=/i.test(html) || /\son[a-z0-9_-]+\s*=/i.test(html)) throw new Error("Inline style/event attributes are disallowed");
for (const match of scripts) new vm.Script(match[1]);
for (const required of ["2026.10.29-desktop-v1", 'id="desktopMode"', 'id="desktopPanel"', 'id="desktopViewport"', 'id="desktopPassword"', "new RFB", "/api/desktop/ticket", "desktopLowBandwidth", "qualityLevel", "compressionLevel", 'id="remotedesktop"']) {
  if (!html.includes(required)) throw new Error("Missing in-page desktop invariant: " + required);
}
if (html.includes("window.open(") || html.includes("remotedesktop.google.com/access")) throw new Error("Remote Desktop must not redirect outside the site");
const builder = fs.readFileSync(path.join(root, "build-worker.mjs"), "utf8");
if (!builder.includes("https://msi.tail28f016.ts.net:8443") || !builder.includes("content-security-policy")) throw new Error("Worker CSP is missing the desktop API origin");
if (!builder.includes("wss://msi.tail28f016.ts.net:8443")) throw new Error("Worker CSP is missing the desktop WebSocket origin");
if (builder.includes("https://cdn.jsdelivr.net")) throw new Error("Remote desktop module should not rely on external script CDN");
console.log(JSON.stringify({ htmlBytes: Buffer.byteLength(html), inlineScripts: scripts.length, inlineStyles: styles.length, jsSyntax: "ok", inPageDesktop: true, authenticatedTicketProxy: true, lowBandwidthControls: true, noExternalRedirect: true, selfHostedModuleOrigin: true }));
