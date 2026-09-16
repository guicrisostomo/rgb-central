const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell } = require('electron');
const path = require('node:path');
const { ensureUserFiles, loadConfig, saveConfig } = require('./core/config');
const { Orchestrator } = require('./core/orchestrator');
const { createApiServer } = require('./core/api-server');

let windowRef;
let trayRef;
let apiRef;
let config;
let paths;
let orchestrator;
let quitting = false;

function resourceRoot() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
}

function createWindow() {
  windowRef = new BrowserWindow({
    width: 920,
    height: 700,
    minWidth: 760,
    minHeight: 580,
    title: 'RGB Central',
    backgroundColor: '#0b0d12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  windowRef.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  windowRef.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      windowRef.hide();
    }
  });
}

function createTray() {
  const traySvg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="16" fill="#0b0d12"/><circle cx="32" cy="32" r="20" fill="none" stroke="#31e981" stroke-width="8"/><circle cx="32" cy="32" r="6" fill="#31e981"/></svg>';
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(traySvg).toString('base64')}`);
  trayRef = new Tray(icon.resize({ width: 16, height: 16 }));
  trayRef.setToolTip('RGB Central');
  refreshTrayMenu();
  trayRef.on('double-click', () => windowRef.show());
}

function refreshTrayMenu() {
  const sceneItems = config.scenes.map((scene) => ({
    label: scene.name,
    click: () => orchestrator.applyScene(scene.id).catch(() => {})
  }));
  trayRef.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir RGB Central', click: () => { windowRef.show(); windowRef.focus(); } },
    { type: 'separator' },
    ...sceneItems,
    { type: 'separator' },
    { label: 'Sair', click: () => { quitting = true; app.quit(); } }
  ]));
}

function publicConfig() {
  return {
    scenes: config.scenes,
    controllers: config.controllers.map(({ script, args, ...safe }) => safe),
    state: orchestrator.publicState(),
    api: { host: config.api.host, port: config.api.port, lanEnabled: config.api.host !== '127.0.0.1' },
    launchAtLogin: app.getLoginItemSettings().openAtLogin
  };
}

function persistConfig(nextConfig) {
  const validated = saveConfig(paths.configPath, nextConfig);
  Object.assign(config, validated);
  orchestrator.config = config;
  refreshTrayMenu();
  const snapshot = publicConfig();
  windowRef?.webContents.send('config-updated', snapshot);
  return snapshot;
}

app.whenReady().then(async () => {
  paths = ensureUserFiles({ userDataPath: app.getPath('userData'), resourcesPath: resourceRoot() });
  config = loadConfig(paths.configPath);
  orchestrator = new Orchestrator({
    config,
    automationRoot: paths.automationRoot,
    onUpdate: (state) => windowRef?.webContents.send('state-updated', state)
  });
  apiRef = createApiServer({ config, orchestrator });
  await apiRef.start();
  createWindow();
  createTray();
});

ipcMain.handle('get-bootstrap', () => publicConfig());
ipcMain.handle('apply-scene', (_event, sceneId) => orchestrator.applyScene(sceneId));
ipcMain.handle('save-scenes', (_event, scenes) => {
  if (!Array.isArray(scenes)) throw new Error('Lista de cenas inválida.');
  const sanitizedScenes = scenes.map(({ id, name, color, brightness }) => ({ id, name, color, brightness }));
  return persistConfig({ ...config, scenes: sanitizedScenes });
});
ipcMain.handle('set-controller-enabled', (_event, controllerId, enabled) => {
  const controllers = config.controllers.map((controller) => (
    controller.id === controllerId ? { ...controller, enabled: Boolean(enabled) } : controller
  ));
  if (!controllers.some((controller) => controller.id === controllerId)) {
    throw new Error('Controlador não encontrado.');
  }
  return persistConfig({ ...config, controllers });
});
ipcMain.handle('set-launch-at-login', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled), openAsHidden: true });
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.handle('open-config', () => shell.openPath(paths.configPath));
ipcMain.handle('open-automations', () => shell.openPath(paths.automationRoot));

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {});
