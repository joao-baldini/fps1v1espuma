import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const reference = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.slice(7) || 8081);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = pathname === '/reference.mp4' && reference ? resolve(reference) : pathname === '/tools/knife-preview.html' ? resolve(root,'tools/knife-preview.html') : pathname === '/' || pathname === '/index.html' ? resolve(root, 'index.html') : null;
  if (!file) { res.writeHead(404); res.end(); return; }
  try {
    const { size } = statSync(file), video = file.endsWith('.mp4');
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416); res.end(); return; }
    res.writeHead(range ? 206 : 200, { 'Content-Type': video ? 'video/mp4' : 'text/html; charset=utf-8', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}), 'Cache-Control': 'no-store' });
    createReadStream(file, { start, end }).pipe(res);
  } catch { res.writeHead(404); res.end(); }
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}`));
