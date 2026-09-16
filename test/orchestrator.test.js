const test = require('node:test');
const assert = require('node:assert/strict');
const { Orchestrator, replaceTokens, sanitizePowerShellOutput } = require('../src/core/orchestrator');

test('substitui somente parâmetros conhecidos', () => {
  assert.equal(replaceTokens('{scene}:{color}:{brightness}', { id: 'green', color: '#00ff00', brightness: 70 }), 'green:#00ff00:70');
});

test('oculta o usuário do Windows em erros do PowerShell', () => {
  const output = ['C:', 'Users', 'nome-pessoal', 'AppData', 'Roaming', 'rgb-central', 'script.ps1: falhou'].join('\\');
  assert.equal(sanitizePowerShellOutput(output), '%USERPROFILE%\\AppData\\Roaming\\rgb-central\\script.ps1: falhou');
});

test('aplica uma cena no modo simulação', async () => {
  const orchestrator = new Orchestrator({
    config: {
      api: {},
      scenes: [{ id: 'green', name: 'Verde', color: '#00ff00', brightness: 70 }],
      controllers: [{ id: 'sim', name: 'Sim', type: 'simulation', enabled: true }]
    },
    automationRoot: process.cwd()
  });
  const result = await orchestrator.applyScene('green');
  assert.equal(result.ok, true);
  assert.equal(orchestrator.publicState().activeScene, 'green');
});
