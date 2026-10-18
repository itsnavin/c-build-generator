import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = process.cwd();
const allowed = new Set(["index.html", "style.css", "app.js", "generator.js", "zip.js"]);
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
createServer(async (req, res) => {
  try {
    const name = new URL(req.url, "http://localhost").pathname.slice(1) || "index.html";
    const path = resolve(root, name);
    if (!allowed.has(name) || !path.startsWith(root + sep)) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": `${mime[extname(path)]}; charset=utf-8` });
    res.end(await readFile(path));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end("Unable to serve file");
  }
}).listen(4173, "127.0.0.1", () => console.log("C Build Lab: http://127.0.0.1:4173"));
