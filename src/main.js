const { app, BrowserWindow, clipboard, ipcMain, Menu, Tray, nativeImage, shell } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { ensureUserFiles, loadConfig, saveConfig } = require('./core/config');
const { Orchestrator } = require('./core/orchestrator');
const { createApiServer } = require('./core/api-server');
const { buildHomeAssistantConfig, normalizeNetworkSettings } = require('./core/integrations');

const execFileAsync = promisify(execFile);
const SETUP_TOOLS = {
  diagnostics: { script: 'diagnostics.ps1', output: 'rgb-central-diagnostico.txt' },
  interface: { script: 'inspect-rgb-ui.ps1', output: 'rgb-central-interface.txt' }
};
const TESTABLE_CONTROLLERS = new Set(['corsair', 'hyperx', 'redragon']);

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
    width: 1040,
    height: 780,
    minWidth: 800,
    minHeight: 620,
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
    controllers: config.controllers.map(({ script, args, ...safe }) => ({
      ...safe,
      setupAvailable: TESTABLE_CONTROLLERS.has(safe.id)
    })),
    state: orchestrator.publicState(),
    api: {
      host: config.api.host,
      port: config.api.port,
      lanEnabled: config.api.host === '0.0.0.0',
      tokenConfigured: Boolean(config.api.token && config.api.token.length >= 24)
    },
    launchAtLogin: app.getLoginItemSettings().openAtLogin
  };
}

async function saveAppSettings(settings) {
  const network = normalizeNetworkSettings(settings);
  const oldConfig = JSON.parse(JSON.stringify(config));
  const oldLaunchAtLogin = app.getLoginItemSettings().openAtLogin;
  const nextToken = settings.regenerateToken
    ? crypto.randomBytes(24).toString('hex')
    : config.api.token;
  const nextConfig = {
    ...config,
    api: { ...config.api, ...network, token: nextToken }
  };

  if (Boolean(settings.launchAtLogin) !== app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: Boolean(settings.launchAtLogin), openAsHidden: true });
  }

  await apiRef.stop();
  try {
    const snapshot = persistConfig(nextConfig);
    apiRef = createApiServer({ config, orchestrator });
    await apiRef.start();
    return snapshot;
  } catch (error) {
    app.setLoginItemSettings({ openAtLogin: oldLaunchAtLogin, openAsHidden: true });
    persistConfig(oldConfig);
    apiRef = createApiServer({ config, orchestrator });
    await apiRef.start();
    throw new Error(`Não foi possível salvar: ${error.message}`);
  }
}

function setupTool(toolId) {
  const tool = SETUP_TOOLS[toolId];
  if (!tool) throw new Error('Ferramenta não permitida.');
  return tool;
}

async function runSetupTool(toolId) {
  const tool = setupTool(toolId);
  const scriptPath = path.join(paths.automationRoot, tool.script);
  if (!fs.existsSync(scriptPath)) throw new Error('Ferramenta de diagnóstico não encontrada.');
  await execFileAsync('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath
  ], { encoding: 'utf8', timeout: 120000, windowsHide: true, maxBuffer: 1024 * 1024 });
  return { ok: true, message: 'Concluído. O resultado foi salvo na Área de Trabalho.' };
}

async function openSetupOutput(toolId) {
  const tool = setupTool(toolId);
  const outputPath = path.join(app.getPath('desktop'), tool.output);
  if (!fs.existsSync(outputPath)) throw new Error('Execute esta verificação antes de abrir o resultado.');
  const result = await shell.openPath(outputPath);
  if (result) throw new Error(result);
  return true;
}

async function testController(controllerId) {
  if (!TESTABLE_CONTROLLERS.has(controllerId)) throw new Error('Este adaptador ainda não possui teste seguro.');
  const controller = config.controllers.find((item) => item.id === controllerId);
  if (!controller) throw new Error('Controlador não encontrado.');
  const result = await orchestrator.executeController(controller, {
    id: 'adapter_test',
    name: 'Teste do adaptador',
    color: '#00ff67',
    brightness: 70
  }, paths.automationRoot);
  if (!result.ok) {
    const error = new Error(result.message || 'O teste do adaptador falhou.');
    // O Electron registra automaticamente o stack no terminal. Para erros que
    // vao para a interface, preserve apenas a mensagem ja sanitizada e evite
    // expor o caminho local do projeto dentro do perfil do Windows.
    error.stack = `Error: ${error.message}`;
    throw error;
  }
  const controllers = config.controllers.map((item) => (
    item.id === controllerId ? { ...item, configured: true } : item
  ));
  const snapshot = persistConfig({ ...config, controllers });
  return { snapshot, message: `${controller.name} preparado. Confirme se o dispositivo ficou verde e então ative-o.` };
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
  const selected = config.controllers.find((controller) => controller.id === controllerId);
  if (!selected) throw new Error('Controlador não encontrado.');
  if (enabled && !selected.configured) {
    throw new Error('Calibre o adaptador antes de ativar este controlador.');
  }
  const controllers = config.controllers.map((controller) => (
    controller.id === controllerId ? { ...controller, enabled: Boolean(enabled) } : controller
  ));
  return persistConfig({ ...config, controllers });
});
ipcMain.handle('set-controller-ignored', (_event, controllerId, ignored) => {
  const selected = config.controllers.find((controller) => controller.id === controllerId);
  if (!selected) throw new Error('Controlador não encontrado.');
  if (selected.type === 'simulation') throw new Error('O modo de demonstração não pode ser ocultado.');
  const controllers = config.controllers.map((controller) => (
    controller.id === controllerId
      ? { ...controller, ignored: Boolean(ignored), enabled: ignored ? false : controller.enabled }
      : controller
  ));
  return persistConfig({ ...config, controllers });
});
ipcMain.handle('set-launch-at-login', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled), openAsHidden: true });
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.handle('save-app-settings', (_event, settings) => saveAppSettings(settings));
ipcMain.handle('run-setup-tool', (_event, toolId) => runSetupTool(toolId));
ipcMain.handle('test-controller', (_event, controllerId) => testController(controllerId));
ipcMain.handle('open-setup-output', (_event, toolId) => openSetupOutput(toolId));
ipcMain.handle('copy-home-assistant-config', () => {
  if (config.api.host !== '0.0.0.0') {
    throw new Error('Em Configurações, ative “Minha rede local” antes de conectar o Home Assistant.');
  }
  const value = buildHomeAssistantConfig({
    port: config.api.port,
    token: config.api.token,
    scenes: config.scenes
  });
  clipboard.writeText(value);
  return { ok: true, message: 'Configuração copiada. O token não foi mostrado na tela.' };
});
ipcMain.handle('open-config', () => shell.openPath(paths.configPath));
ipcMain.handle('open-automations', () => shell.openPath(paths.automationRoot));

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {});
