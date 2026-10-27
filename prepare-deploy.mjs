import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const name of ["index.html", "_worker.js"]) {
  const source = path.join(root, name);
  if (!fs.existsSync(source)) throw new Error("Missing deployment input: " + name);
  fs.copyFileSync(source, path.join(dist, name));
}
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(dist, "_worker.js"), "utf8");
if (!html.includes('id="type"')) throw new Error("Typing control missing from index.html");
if (!worker.includes("content-security-policy")) throw new Error("Worker security headers missing");
console.log(JSON.stringify({ deploymentDirectory: "dist", files: fs.readdirSync(dist).sort(), htmlBytes: Buffer.byteLength(html), workerBytes: Buffer.byteLength(worker), secretsExcluded: true }));
