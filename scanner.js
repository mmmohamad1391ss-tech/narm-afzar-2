'use strict';
// Recursive library scanner: finds audio files, reads tags with music-metadata,
// extracts embedded cover art (or a cover.jpg next to the files) into an art cache.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

let electron = null;
try { const e = require('electron'); if (e && typeof e === 'object') electron = e; } catch (_) {}

const EXT = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma']);
const COVER_NAMES = ['cover', 'folder', 'front', 'album', 'albumart', 'artwork'];
const md5 = s => crypto.createHash('md5').update(s).digest('hex');

let mmPromise = null;
const loadMM = () => (mmPromise ||= import('music-metadata'));

async function collect(dir, out) {
  let ents;
  try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith('.') && e.name !== '$RECYCLE.BIN' && e.name !== 'System Volume Information') await collect(p, out); }
    else if (e.isFile() && EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
}

async function saveArt(buf, artDir) {
  const hash = md5(buf);
  const out = path.join(artDir, hash + '.jpg');
  try { await fsp.access(out); return hash; } catch (_) {}
  let data = Buffer.from(buf);
  if (electron && electron.nativeImage) {
    try {
      const img = electron.nativeImage.createFromBuffer(data);
      if (!img.isEmpty()) {
        const s = img.getSize();
        data = (s.width > 900 ? img.resize({ width: 900, quality: 'best' }) : img).toJPEG(90);
      }
    } catch (_) {}
  }
  await fsp.writeFile(out, data);
  return hash;
}

const dirCoverCache = new Map();
async function folderCover(dir, artDir) {
  if (dirCoverCache.has(dir)) return dirCoverCache.get(dir);
  let result = null;
  try {
    const files = await fsp.readdir(dir);
    for (const n of COVER_NAMES) {
      const f = files.find(x => { const l = x.toLowerCase(); return (l === n + '.jpg' || l === n + '.jpeg' || l === n + '.png'); });
      if (f) { result = await saveArt(await fsp.readFile(path.join(dir, f)), artDir); break; }
    }
  } catch (_) {}
  dirCoverCache.set(dir, result);
  return result;
}

async function readTags(file, artDir) {
  const mm = await loadMM();
  let md = null;
  try { md = await mm.parseFile(file, { duration: true }); } catch (_) {}
  const c = (md && md.common) || {}, f = (md && md.format) || {};
  const base = path.basename(file, path.extname(file));
  const artist = c.artist || c.albumartist || 'Unknown artist';
  const aartist = c.albumartist || c.artist || 'Unknown artist';
  const album = c.album || 'Unknown album';
  let art = null;
  try {
    const pic = c.picture && c.picture[0];
    if (pic && pic.data && pic.data.length) art = await saveArt(pic.data, artDir);
  } catch (_) {}
  if (!art) art = await folderCover(path.dirname(file), artDir);
  const al = md5((aartist + '|' + (album === 'Unknown album' ? path.dirname(file) : album)).toLowerCase()).slice(0, 12);
  return { t: (c.title || base).trim(), artist, aartist, album, al, dur: Math.round(f.duration || 0), art, ext: path.extname(file).slice(1).toLowerCase() };
}

// Scan one folder. `existing` = tracks already known (any folder). Returns the folder's tracks.
async function scanFolder({ folder, existing, nextId, artDir, onProgress }) {
  dirCoverCache.clear();
  const files = [];
  await collect(folder.path, files);
  const byPath = new Map(existing.map(t => [t.path, t]));
  const out = new Array(files.length);
  let done = 0, next = 0, id = nextId;
  const todo = [];
  const stats = await Promise.all(files.map(f => fsp.stat(f).catch(() => null)));
  files.forEach((file, i) => {
    const st = stats[i]; if (!st) return;
    const old = byPath.get(file);
    if (old && old.m === Math.round(st.mtimeMs) && old.s === st.size && old.f === folder.name) { out[i] = old; }
    else todo.push({ i, file, st, old });
  });
  const total = todo.length;
  let last = 0;
  const worker = async () => {
    while (next < todo.length) {
      const job = todo[next++];
      const tags = await readTags(job.file, artDir);
      out[job.i] = {
        id: job.old ? job.old.id : id++, ...tags, f: folder.name, path: job.file,
        m: Math.round(job.st.mtimeMs), s: job.st.size, d: job.old ? job.old.d : new Date().toISOString().slice(0, 10)
      };
      done++;
      const now = Date.now();
      if (onProgress && (now - last > 150 || done === total)) { last = now; onProgress(done, total); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, todo.length || 1) }, worker));
  return { tracks: out.filter(Boolean), nextId: id };
}
module.exports = { scanFolder, saveArt, EXT };
