const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rgbCentral', {
  bootstrap: () => ipcRenderer.invoke('get-bootstrap'),
  applyScene: (id) => ipcRenderer.invoke('apply-scene', id),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('set-launch-at-login', enabled),
  openConfig: () => ipcRenderer.invoke('open-config'),
  openAutomations: () => ipcRenderer.invoke('open-automations'),
  onState: (callback) => ipcRenderer.on('state-updated', (_event, state) => callback(state))
});
