'use strict';
// Local-only media server: serves audio files (with HTTP range support so seeking works)
// and cached cover art to the player window. Bound to 127.0.0.1 and protected by a random token.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIME = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.wma': 'audio/x-ms-wma', '.jpg': 'image/jpeg'
};

function start({ getTrackPath, artDir }) {
  const token = crypto.randomBytes(16).toString('hex');
  const server = http.createServer((req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' };
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.searchParams.get('t') !== token) { res.writeHead(403, cors); return res.end(); }
      let file = null;
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'track') file = getTrackPath(Number(parts[1]));
      else if (parts[0] === 'art' && /^[a-f0-9]{32}$/.test(parts[1] || '')) file = path.join(artDir, parts[1] + '.jpg');
      if (!file) { res.writeHead(404, cors); return res.end(); }
      fs.stat(file, (err, stat) => {
        if (err || !stat.isFile()) { res.writeHead(404, cors); return res.end(); }
        const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
        const base = { ...cors, 'Content-Type': type, 'Accept-Ranges': 'bytes' };
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
        let start = 0, end = stat.size - 1, status = 200;
        if (range) {
          if (range[1] !== '') { start = parseInt(range[1], 10); if (range[2] !== '') end = Math.min(end, parseInt(range[2], 10)); }
          else if (range[2] !== '') { start = Math.max(0, stat.size - parseInt(range[2], 10)); }
          if (start > end || start >= stat.size) { res.writeHead(416, { ...cors, 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
          status = 206;
        }
        const headers = { ...base, 'Content-Length': end - start + 1 };
        if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
        res.writeHead(status, headers);
        if (req.method === 'HEAD') return res.end();
        const stream = fs.createReadStream(file, { start, end });
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        stream.pipe(res);
      });
    } catch (e) { res.writeHead(400, cors); res.end(); }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, token, server })));
}
module.exports = { start };
