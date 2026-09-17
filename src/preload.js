const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rgbCentral', {
  bootstrap: () => ipcRenderer.invoke('get-bootstrap'),
  applyScene: (id) => ipcRenderer.invoke('apply-scene', id),
  saveScenes: (scenes) => ipcRenderer.invoke('save-scenes', scenes),
  setControllerEnabled: (id, enabled) => ipcRenderer.invoke('set-controller-enabled', id, enabled),
  setControllerIgnored: (id, ignored) => ipcRenderer.invoke('set-controller-ignored', id, ignored),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('set-launch-at-login', enabled),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  runSetupTool: (toolId) => ipcRenderer.invoke('run-setup-tool', toolId),
  testController: (controllerId) => ipcRenderer.invoke('test-controller', controllerId),
  openSetupOutput: (toolId) => ipcRenderer.invoke('open-setup-output', toolId),
  copyHomeAssistantConfig: () => ipcRenderer.invoke('copy-home-assistant-config'),
  copySupportText: (value) => ipcRenderer.invoke('copy-support-text', value),
  openConfig: () => ipcRenderer.invoke('open-config'),
  openAutomations: () => ipcRenderer.invoke('open-automations'),
  onState: (callback) => ipcRenderer.on('state-updated', (_event, state) => callback(state)),
  onConfig: (callback) => ipcRenderer.on('config-updated', (_event, snapshot) => callback(snapshot))
});
