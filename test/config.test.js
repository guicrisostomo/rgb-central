const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateConfig } = require('../src/core/config');

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
