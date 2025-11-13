// http-server.ts
import { createServer } from "http";
import { readFile } from "fs/promises";
import { resolve, extname } from "path";

const PORT = 3000;

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

const server = createServer(async (req, res) => {
  try {
    let filePath = req.url === "/" ? "/index.html" : req.url || "/index.html";

    // Remove query params
    filePath = filePath.split("?")[0];

    const fullPath = resolve(process.cwd(), filePath.slice(1));
    const ext = extname(fullPath);
    const contentType = mimeTypes[ext] || "application/octet-stream";

    const content = await readFile(fullPath);

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin"
    });
    res.end(content);
  } catch (error) {
    console.error("Error serving file:", error);
    res.writeHead(404);
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`📄 HTTP server running at http://localhost:${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser`);
  console.log(`   Make sure the WebSocket server is also running!`);
});
