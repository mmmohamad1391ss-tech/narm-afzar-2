'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { start: startServer } = require('./server');
const { scanFolder, saveArt } = require('./scanner');

app.setAppUserModelId('app.nova.music');
if (!app.requestSingleInstanceLock()) { app.quit(); }

const userData = app.getPath('userData');
const artDir = path.join(userData, 'art');
const F = { state: path.join(userData, 'state.json'), lib: path.join(userData, 'library.json'), win: path.join(userData, 'window.json') };
fs.mkdirSync(artDir, { recursive: true });

const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return d; } };
const writeJSON = (f, o) => { try { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(o)); fs.renameSync(t, f); } catch (e) { console.error('write failed', f, e.message); } };

let lib = readJSON(F.lib, { nextId: 1, folders: [], tracks: [] });
let state = readJSON(F.state, {});
let win = null, media = null, busy = false;
const trackMap = () => new Map(lib.tracks.map(t => [t.id, t.path]));
let tm = trackMap();
const saveLib = () => { writeJSON(F.lib, lib); tm = trackMap(); };
const publicLib = () => ({
  folders: lib.folders.map(f => ({ name: f.name, path: f.path })),
  tracks: lib.tracks.map(({ m, s, ...t }) => t)
});

function uniqueName(p) {
  let base = path.basename(p) || p;
  if (!lib.folders.some(f => f.name === base)) return base;
  const parent = path.basename(path.dirname(p));
  base = `${base} (${parent || 'root'})`;
  let n = 2, cand = base;
  while (lib.folders.some(f => f.name === cand)) cand = `${base} ${n++}`;
  return cand;
}
const progress = (name) => (done, total) => { if (win && !win.isDestroyed()) win.webContents.send('lib:progress', { folder: name, done, total }); };

async function scanInto(folder) {
  const others = lib.tracks.filter(t => t.f !== folder.name);
  const mine = lib.tracks.filter(t => t.f === folder.name);
  const r = await scanFolder({ folder, existing: mine, nextId: lib.nextId, artDir, onProgress: progress(folder.name) });
  lib.nextId = r.nextId;
  lib.tracks = others.concat(r.tracks);
  return r.tracks.length;
}
async function addFolderPath(p) {
  let st; try { st = fs.statSync(p); } catch (_) { return { error: 'That folder could not be opened.' }; }
  if (!st.isDirectory()) return { error: 'Please choose a folder.' };
  if (lib.folders.some(f => path.resolve(f.path).toLowerCase() === path.resolve(p).toLowerCase())) return { error: 'That folder is already in your library.' };
  const folder = { name: uniqueName(p), path: p };
  lib.folders.push(folder);
  const n = await scanInto(folder);
  saveLib();
  return { library: publicLib(), name: folder.name, added: n };
}
const guarded = fn => async (...a) => {
  if (busy) return { error: 'A scan is already running.' };
  busy = true;
  try { return await fn(...a); } catch (e) { return { error: e.message }; } finally { busy = false; }
};

ipcMain.on('nova:boot', e => {
  e.returnValue = { state, library: publicLib(), port: media ? media.port : 0, token: media ? media.token : '', platform: process.platform, version: app.getVersion() };
});
ipcMain.on('nova:state', (_e, s) => { state = s; writeJSON(F.state, s); });
ipcMain.handle('lib:add', guarded(async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Add a music folder', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  return addFolderPath(r.filePaths[0]);
}));
ipcMain.handle('lib:addPath', guarded(async (_e, p) => addFolderPath(p)));
ipcMain.handle('lib:remove', guarded(async (_e, name) => {
  lib.folders = lib.folders.filter(f => f.name !== name);
  lib.tracks = lib.tracks.filter(t => t.f !== name);
  saveLib();
  return { library: publicLib() };
}));
ipcMain.handle('lib:rescan', guarded(async () => {
  for (const f of [...lib.folders]) {
    if (!fs.existsSync(f.path)) { lib.tracks = lib.tracks.filter(t => t.f !== f.name); continue; }
    await scanInto(f);
  }
  saveLib();
  return { library: publicLib() };
}));
// Custom cover images: pick a file (or import a dropped one), resize, and store in the art cache.
async function importImage(p) {
  try {
    const ext = path.extname(p).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) return { error: 'Please choose a JPG or PNG image.' };
    const st = fs.statSync(p);
    if (st.size > 40 * 1024 * 1024) return { error: 'That image is too large (over 40 MB).' };
    const buf = fs.readFileSync(p);
    if (require('electron').nativeImage.createFromBuffer(buf).isEmpty()) return { error: 'That file is not a readable image.' };
    return { art: await saveArt(buf, artDir) };
  } catch (e) { return { error: 'Could not read that image.' }; }
}
ipcMain.handle('art:pick', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose a cover image', properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }] });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  return importImage(r.filePaths[0]);
});
ipcMain.handle('art:import', (_e, p) => importImage(p));
ipcMain.on('nova:win', (e, cmd) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  if (cmd === 'min') w.minimize();
  else if (cmd === 'max') (w.isMaximized() ? w.unmaximize() : w.maximize());
  else if (cmd === 'close') w.close();
});

function createWindow() {
  const b = readJSON(F.win, {});
  win = new BrowserWindow({
    width: b.width || 1360, height: b.height || 860, x: b.x, y: b.y, minWidth: 900, minHeight: 620,
    frame: false, show: false, backgroundColor: '#05060a', title: 'NOVA Music',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required', spellcheck: false }
  });
  if (b.max) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  let t; const keep = () => { clearTimeout(t); t = setTimeout(() => {
    if (!win || win.isDestroyed()) return;
    const max = win.isMaximized(); const nb = max ? { ...b, max } : { ...win.getBounds(), max };
    Object.assign(b, nb); writeJSON(F.win, nb); }, 400); };
  win.on('resize', keep); win.on('move', keep); win.on('maximize', () => { keep(); win.webContents.send('nova:max', true); }); win.on('unmaximize', () => { keep(); win.webContents.send('nova:max', false); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.on('closed', () => { win = null; });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  media = await startServer({ getTrackPath: id => tm.get(id), artDir });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
