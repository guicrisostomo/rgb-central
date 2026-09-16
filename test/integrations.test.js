const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHomeAssistantConfig, normalizeNetworkSettings } = require('../src/core/integrations');

test('converte escolhas guiadas em configuração de rede segura', () => {
  assert.deepEqual(normalizeNetworkSettings({ lanEnabled: false, port: 47831 }), {
    host: '127.0.0.1',
    port: 47831
  });
  assert.deepEqual(normalizeNetworkSettings({ lanEnabled: true, port: '47832' }), {
    host: '0.0.0.0',
    port: 47832
  });
});

test('rejeita porta fora da faixa permitida', () => {
  assert.throws(() => normalizeNetworkSettings({ lanEnabled: true, port: 80 }), /entre 1024 e 65535/);
});

test('gera comandos do Home Assistant para cenas genéricas', () => {
  const token = 'a'.repeat(48);
  const value = buildHomeAssistantConfig({
    port: 47831,
    token,
    scenes: [{ id: 'reading', name: 'Leitura' }]
  });
  assert.match(value, /rgb_central_reading/);
  assert.match(value, /IP_DO_PC:47831\/api\/scenes\/reading\/apply/);
  assert.match(value, new RegExp(`Bearer ${token}`));
});

test('não gera integração sem chave forte', () => {
  assert.throws(() => buildHomeAssistantConfig({ port: 47831, token: 'curta', scenes: [] }), /Token/);
});
