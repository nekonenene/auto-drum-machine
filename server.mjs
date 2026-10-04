import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve, sep } from 'node:path';

const publicRootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT || 5173);
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const requestedFilePath = resolve(publicRootDir, `.${pathname === '/' ? '/index.html' : pathname}`);

    if (!requestedFilePath.startsWith(publicRootDir + sep) || !mimeTypes[extname(requestedFilePath)]) {
      response.writeHead(404).end('Not found');

      return;
    }

    const fileContent = await readFile(requestedFilePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(requestedFilePath)], 'Cache-Control': 'no-cache' });
    response.end(fileContent);
  } catch {
    response.writeHead(404).end('Not found');
  }

}).listen(port, '127.0.0.1', () => {
  console.log(`Auto Drum Machine: http://localhost:${port}`);
});
