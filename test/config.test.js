const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig, saveConfig, validateConfig } = require('../src/core/config');

test('configuração padrão é válida', () => {
  const value = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'default.json'), 'utf8'));
  assert.equal(validateConfig(value), value);
});

test('rejeita cena com ID perigoso', () => {
  const value = { api: { host: '127.0.0.1', port: 47831, token: '' }, scenes: [{ id: '../x', color: '#ffffff', brightness: 1 }], controllers: [] };
  assert.throws(() => validateConfig(value), /ID de cena inválido/);
});

test('não permite API na rede sem token forte', () => {
  const value = {
    api: { host: '0.0.0.0', port: 47831, token: 'curto' },
    scenes: [{ id: 'green', color: '#00ff00', brightness: 70 }],
    controllers: []
  };
  assert.throws(() => validateConfig(value), /token com ao menos 24/);
});

test('aceita cenas personalizadas sem depender de fabricante', () => {
  const value = {
    api: { host: '127.0.0.1', port: 47831, token: '' },
    scenes: [{ id: 'reading', name: 'Leitura', color: '#f2c94c', brightness: 42 }],
    controllers: [{ id: 'demo', name: 'Demonstração', type: 'simulation', enabled: true }]
  };
  assert.equal(validateConfig(value).scenes[0].brightness, 42);
});

test('salva e recarrega configuração validada', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rgb-central-'));
  const configPath = path.join(directory, 'config.json');
  const value = {
    api: { host: '127.0.0.1', port: 47831, token: '' },
    scenes: [{ id: 'custom', name: 'Minha cena', color: '#123abc', brightness: 55 }],
    controllers: [{ id: 'demo', name: 'Demonstração', type: 'simulation', enabled: false }]
  };
  try {
    saveConfig(configPath, value);
    assert.deepEqual(loadConfig(configPath), value);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
