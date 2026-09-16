const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rgbCentral', {
  bootstrap: () => ipcRenderer.invoke('get-bootstrap'),
  applyScene: (id) => ipcRenderer.invoke('apply-scene', id),
  saveScenes: (scenes) => ipcRenderer.invoke('save-scenes', scenes),
  setControllerEnabled: (id, enabled) => ipcRenderer.invoke('set-controller-enabled', id, enabled),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('set-launch-at-login', enabled),
  openConfig: () => ipcRenderer.invoke('open-config'),
  openAutomations: () => ipcRenderer.invoke('open-automations'),
  onState: (callback) => ipcRenderer.on('state-updated', (_event, state) => callback(state)),
  onConfig: (callback) => ipcRenderer.on('config-updated', (_event, snapshot) => callback(snapshot))
});
