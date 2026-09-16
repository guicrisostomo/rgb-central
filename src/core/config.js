const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCENE_ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const CONTROLLER_ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const CURRENT_CONFIG_VERSION = 2;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('Configuração inválida.');
  if (config.configVersion !== CURRENT_CONFIG_VERSION) {
    throw new Error('Versão da configuração inválida.');
  }
  if (!config.api || typeof config.api !== 'object') throw new Error('Configuração da API ausente.');
  if (!['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(config.api.host)) {
    throw new Error('Host da API inválido. Use loopback ou 0.0.0.0 para a rede local.');
  }
  if (!Number.isInteger(config.api.port) || config.api.port < 1024 || config.api.port > 65535) {
    throw new Error('Porta da API inválida.');
  }
  if (config.api.host === '0.0.0.0' && (!config.api.token || config.api.token.length < 24)) {
    throw new Error('Acesso pela rede exige token com ao menos 24 caracteres.');
  }
  if (!Array.isArray(config.scenes) || config.scenes.length === 0) {
    throw new Error('Cadastre pelo menos uma cena.');
  }
  if (config.scenes.length > 30) throw new Error('O limite é de 30 cenas.');
  const ids = new Set();
  for (const scene of config.scenes) {
    if (!SCENE_ID.test(scene.id || '')) throw new Error(`ID de cena inválido: ${scene.id}`);
    if (ids.has(scene.id)) throw new Error(`Cena duplicada: ${scene.id}`);
    ids.add(scene.id);
    if (typeof scene.name !== 'string' || !scene.name.trim() || scene.name.length > 60) {
      throw new Error(`Nome inválido na cena ${scene.id}.`);
    }
    if (!/^#[0-9a-f]{6}$/i.test(scene.color || '')) throw new Error(`Cor inválida na cena ${scene.id}`);
    if (!Number.isInteger(scene.brightness) || scene.brightness < 0 || scene.brightness > 100) {
      throw new Error(`Brilho inválido na cena ${scene.id}`);
    }
  }
  if (!Array.isArray(config.controllers)) throw new Error('Lista de controladores inválida.');
  const controllerIds = new Set();
  for (const controller of config.controllers) {
    if (!controller.id || !controller.name) throw new Error('Controlador sem ID ou nome.');
    if (!CONTROLLER_ID.test(controller.id)) throw new Error(`ID de controlador inválido: ${controller.id}`);
    if (controllerIds.has(controller.id)) throw new Error(`Controlador duplicado: ${controller.id}`);
    controllerIds.add(controller.id);
    if (typeof controller.name !== 'string' || controller.name.length > 80) {
      throw new Error(`Nome inválido no controlador ${controller.id}.`);
    }
    if (typeof controller.enabled !== 'boolean') {
      throw new Error(`Estado inválido no controlador ${controller.id}.`);
    }
    if (typeof controller.configured !== 'boolean') {
      throw new Error(`Calibração inválida no controlador ${controller.id}.`);
    }
    if (!['simulation', 'powershell'].includes(controller.type)) {
      throw new Error(`Tipo não permitido no controlador ${controller.id}.`);
    }
    if (controller.type === 'powershell' && !controller.script) {
      throw new Error(`Script ausente no controlador ${controller.id}.`);
    }
  }
  return config;
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const item of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, item.name);
    const dst = path.join(destination, item.name);
    if (item.isDirectory()) copyDirectory(src, dst);
    else if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
  }
}

function ensureUserFiles({ userDataPath, resourcesPath }) {
  fs.mkdirSync(userDataPath, { recursive: true });
  const configPath = path.join(userDataPath, 'config.json');
  const sourceRoot = resourcesPath;
  if (!fs.existsSync(configPath)) {
    const defaultConfig = readJson(path.join(sourceRoot, 'config', 'default.json'));
    defaultConfig.api.token = crypto.randomBytes(24).toString('hex');
    fs.writeFileSync(configPath, `${JSON.stringify(defaultConfig, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    });
  }
  const sourceAutomations = path.join(sourceRoot, 'automations');
  const userAutomations = path.join(userDataPath, 'automations');
  copyDirectory(sourceAutomations, userAutomations);
  for (const managedScript of [
    'diagnostics.ps1',
    'inspect-rgb-ui.ps1',
    'official-app-profile.ps1',
    'powershell-runner.ps1'
  ]) {
    fs.copyFileSync(path.join(sourceAutomations, managedScript), path.join(userAutomations, managedScript));
  }

  const existing = readJson(configPath);
  if (existing.configVersion !== CURRENT_CONFIG_VERSION) {
    existing.configVersion = CURRENT_CONFIG_VERSION;
    existing.controllers = (existing.controllers || []).map((controller) => ({
      ...controller,
      configured: controller.type === 'simulation',
      enabled: controller.type === 'simulation' ? controller.enabled : false
    }));
    saveConfig(configPath, existing);
  }
  return { configPath, automationRoot: path.join(userDataPath, 'automations') };
}

function loadConfig(configPath) {
  return validateConfig(readJson(configPath));
}

function saveConfig(configPath, config) {
  const validated = validateConfig(config);
  const temporaryPath = `${configPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  fs.renameSync(temporaryPath, configPath);
  return validated;
}

module.exports = { ensureUserFiles, loadConfig, saveConfig, validateConfig };
