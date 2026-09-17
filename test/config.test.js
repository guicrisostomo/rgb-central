const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ensureUserFiles, loadConfig, saveConfig, validateConfig } = require('../src/core/config');

test('configuração padrão é válida', () => {
  const value = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'default.json'), 'utf8'));
  assert.equal(validateConfig(value), value);
});

test('rejeita cena com ID perigoso', () => {
  const value = { configVersion: 6, api: { host: '127.0.0.1', port: 47831, token: '' }, scenes: [{ id: '../x', name: 'Inválida', color: '#ffffff', brightness: 1 }], controllers: [] };
  assert.throws(() => validateConfig(value), /ID de cena inválido/);
});

test('não permite API na rede sem token forte', () => {
  const value = {
    configVersion: 6,
    api: { host: '0.0.0.0', port: 47831, token: 'curto' },
    scenes: [{ id: 'green', name: 'Verde', color: '#00ff00', brightness: 70 }],
    controllers: []
  };
  assert.throws(() => validateConfig(value), /token com ao menos 24/);
});

test('aceita cenas personalizadas sem depender de fabricante', () => {
  const value = {
    configVersion: 6,
    api: { host: '127.0.0.1', port: 47831, token: '' },
    scenes: [{ id: 'reading', name: 'Leitura', color: '#f2c94c', brightness: 42 }],
    controllers: [{ id: 'demo', name: 'Demonstração', type: 'simulation', configured: true, enabled: true, ignored: false }]
  };
  assert.equal(validateConfig(value).scenes[0].brightness, 42);
});

test('salva e recarrega configuração validada', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rgb-central-'));
  const configPath = path.join(directory, 'config.json');
  const value = {
    configVersion: 6,
    api: { host: '127.0.0.1', port: 47831, token: '' },
    scenes: [{ id: 'custom', name: 'Minha cena', color: '#123abc', brightness: 55 }],
    controllers: [{ id: 'demo', name: 'Demonstração', type: 'simulation', configured: true, enabled: false, ignored: false }]
  };
  try {
    saveConfig(configPath, value);
    assert.deepEqual(loadConfig(configPath), value);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('migra configuração antiga desativando adaptadores não calibrados', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rgb-central-migration-'));
  const configPath = path.join(directory, 'config.json');
  const oldConfig = {
    api: { host: '127.0.0.1', port: 47831, token: 'token-local' },
    scenes: [{ id: 'green', name: 'Verde', color: '#00ff00', brightness: 70 }],
    controllers: [
      { id: 'demo', name: 'Demonstração', type: 'simulation', enabled: true },
      { id: 'vendor', name: 'Fabricante', type: 'powershell', script: 'official-app-profile.ps1', enabled: true }
    ]
  };
  fs.writeFileSync(configPath, JSON.stringify(oldConfig), 'utf8');
  try {
    ensureUserFiles({ userDataPath: directory, resourcesPath: path.join(__dirname, '..') });
    const migrated = loadConfig(configPath);
    assert.equal(migrated.configVersion, 6);
    assert.equal(migrated.controllers[0].configured, true);
    assert.equal(migrated.controllers[1].configured, false);
    assert.equal(migrated.controllers[1].enabled, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('migra Corsair para o SDK oficial sem ativar automaticamente', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rgb-central-corsair-'));
  const configPath = path.join(directory, 'config.json');
  const oldConfig = {
    configVersion: 3,
    api: { host: '127.0.0.1', port: 47831, token: 'token-local' },
    scenes: [{ id: 'green', name: 'Verde', color: '#00ff00', brightness: 70 }],
    controllers: [{
      id: 'corsair', name: 'Corsair', type: 'powershell', script: 'official-app-profile.ps1',
      args: ['-Vendor', 'corsair'], configured: false, enabled: false
    }]
  };
  fs.writeFileSync(configPath, JSON.stringify(oldConfig), 'utf8');
  try {
    ensureUserFiles({ userDataPath: directory, resourcesPath: path.join(__dirname, '..') });
    const migrated = loadConfig(configPath).controllers[0];
    assert.equal(migrated.type, 'corsair-sdk');
    assert.equal(migrated.configured, false);
    assert.equal(migrated.enabled, false);
    assert.equal('script' in migrated, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('preserva adaptadores já confirmados ao adicionar o SDK Corsair', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rgb-central-preserve-'));
  const configPath = path.join(directory, 'config.json');
  const oldConfig = {
    configVersion: 3,
    api: { host: '127.0.0.1', port: 47831, token: 'token-local' },
    scenes: [{ id: 'green', name: 'Verde', color: '#00ff00', brightness: 70 }],
    controllers: [
      { id: 'hyperx', name: 'HyperX', type: 'powershell', script: 'hyperx-color.ps1', args: [], configured: true, enabled: true },
      { id: 'redragon', name: 'Redragon', type: 'powershell', script: 'redragon-color.ps1', args: [], configured: true, enabled: false }
    ]
  };
  fs.writeFileSync(configPath, JSON.stringify(oldConfig), 'utf8');
  try {
    ensureUserFiles({ userDataPath: directory, resourcesPath: path.join(__dirname, '..') });
    const migrated = loadConfig(configPath).controllers;
    assert.equal(migrated[0].configured, true);
    assert.equal(migrated[0].enabled, true);
    assert.equal(migrated[1].configured, true);
    assert.equal(migrated[1].enabled, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('migra preferências de controladores e permite ocultar apenas quando desativado', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rgb-central-ignore-'));
  const configPath = path.join(directory, 'config.json');
  const oldConfig = {
    configVersion: 4,
    api: { host: '127.0.0.1', port: 47831, token: 'token-local' },
    scenes: [{ id: 'green', name: 'Verde', color: '#00ff00', brightness: 70 }],
    controllers: [{
      id: 'lianli', name: 'Lian Li', type: 'powershell', script: 'official-app-profile.ps1',
      args: ['-Vendor', 'lianli'], configured: false, enabled: false
    }]
  };
  fs.writeFileSync(configPath, JSON.stringify(oldConfig), 'utf8');
  try {
    ensureUserFiles({ userDataPath: directory, resourcesPath: path.join(__dirname, '..') });
    const migrated = loadConfig(configPath);
    assert.equal(migrated.configVersion, 6);
    assert.equal(migrated.controllers[0].ignored, false);
    const invalid = structuredClone(migrated);
    invalid.controllers[0].ignored = true;
    invalid.controllers[0].enabled = true;
    assert.throws(() => validateConfig(invalid), /ignorado não pode ficar ativo/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('preserva Corsair já preparado ao migrar apenas a preferência de exibição', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rgb-central-corsair-v5-'));
  const configPath = path.join(directory, 'config.json');
  const oldConfig = {
    configVersion: 4,
    api: { host: '127.0.0.1', port: 47831, token: 'token-local' },
    scenes: [{ id: 'green', name: 'Verde', color: '#00ff00', brightness: 70 }],
    controllers: [{
      id: 'corsair', name: 'Corsair', type: 'corsair-sdk', configured: true, enabled: true,
      timeoutMs: 20000
    }]
  };
  fs.writeFileSync(configPath, JSON.stringify(oldConfig), 'utf8');
  try {
    ensureUserFiles({ userDataPath: directory, resourcesPath: path.join(__dirname, '..') });
    const migrated = loadConfig(configPath).controllers[0];
    assert.equal(migrated.configured, true);
    assert.equal(migrated.enabled, true);
    assert.equal(migrated.ignored, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('migra Gigabyte para a automação visual sem ativar automaticamente', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rgb-central-gigabyte-v6-'));
  const configPath = path.join(directory, 'config.json');
  const oldConfig = {
    configVersion: 5,
    api: { host: '127.0.0.1', port: 47831, token: 'token-local' },
    scenes: [{ id: 'green', name: 'Verde', color: '#00ff00', brightness: 70 }],
    controllers: [{
      id: 'gigabyte', name: 'Gigabyte RGB Fusion', type: 'powershell',
      script: 'official-app-profile.ps1', args: ['-Vendor', 'gigabyte'],
      configured: false, enabled: false, ignored: false
    }]
  };
  fs.writeFileSync(configPath, JSON.stringify(oldConfig), 'utf8');
  try {
    const paths = ensureUserFiles({ userDataPath: directory, resourcesPath: path.join(__dirname, '..') });
    const migrated = loadConfig(configPath).controllers[0];
    assert.equal(migrated.script, 'gigabyte-rgb-fusion.ps1');
    assert.deepEqual(migrated.args, []);
    assert.equal(migrated.configured, false);
    assert.equal(migrated.enabled, false);
    assert.equal(fs.existsSync(path.join(paths.automationRoot, 'gigabyte-rgb-fusion.ps1')), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('migra HyperX e Redragon para adaptadores testáveis sem ativá-los', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rgb-central-adapters-'));
  const configPath = path.join(directory, 'config.json');
  const oldConfig = {
    configVersion: 2,
    api: { host: '127.0.0.1', port: 47831, token: 'token-local' },
    scenes: [{ id: 'green', name: 'Verde', color: '#00ff00', brightness: 70 }],
    controllers: [
      { id: 'hyperx', name: 'HyperX', type: 'powershell', script: 'official-app-profile.ps1', args: ['-Vendor', 'hyperx'], configured: false, enabled: false },
      { id: 'redragon', name: 'Redragon', type: 'powershell', script: 'official-app-profile.ps1', args: ['-Vendor', 'redragon'], configured: false, enabled: false }
    ]
  };
  fs.writeFileSync(configPath, JSON.stringify(oldConfig), 'utf8');
  try {
    ensureUserFiles({ userDataPath: directory, resourcesPath: path.join(__dirname, '..') });
    const migrated = loadConfig(configPath);
    assert.equal(migrated.controllers[0].script, 'hyperx-color.ps1');
    assert.deepEqual(migrated.controllers[0].args, []);
    assert.equal(migrated.controllers[1].script, 'redragon-color.ps1');
    assert.equal(migrated.controllers[1].configured, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
