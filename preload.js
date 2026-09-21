'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const boot = ipcRenderer.sendSync('nova:boot');
contextBridge.exposeInMainWorld('nova', {
  boot: () => boot,
  saveState: s => ipcRenderer.send('nova:state', s),
  addFolder: () => ipcRenderer.invoke('lib:add'),
  addPath: p => ipcRenderer.invoke('lib:addPath', p),
  removeFolder: n => ipcRenderer.invoke('lib:remove', n),
  rescan: () => ipcRenderer.invoke('lib:rescan'),
  onScan: cb => ipcRenderer.on('lib:progress', (_e, p) => cb(p)),
  pickImage: () => ipcRenderer.invoke('art:pick'),
  importImage: p => ipcRenderer.invoke('art:import', p),
  win: cmd => ipcRenderer.send('nova:win', cmd),
  onMax: cb => ipcRenderer.on('nova:max', (_e, v) => cb(v)),
  pathForFile: f => { try { return webUtils.getPathForFile(f); } catch (_) { return ''; } }
});
