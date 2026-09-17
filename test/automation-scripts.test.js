const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const automationRoot = path.join(__dirname, '..', 'automations');

test('scripts PowerShell usam BOM UTF-8 para compatibilidade com Windows PowerShell 5.1', () => {
  for (const file of fs.readdirSync(automationRoot).filter((name) => name.endsWith('.ps1'))) {
    const contents = fs.readFileSync(path.join(automationRoot, file));
    assert.deepEqual([...contents.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${file} precisa manter o BOM UTF-8`);
  }
});

test('adaptador HyperX limita a automação ao processo do NGENUITY e aceita tradução', () => {
  const script = fs.readFileSync(path.join(automationRoot, 'hyperx-color.ps1'), 'utf8');
  assert.match(script, /Get-Process -Name 'NGenuity2'/);
  assert.match(script, /lstLoopedEffects/);
  assert.match(script, /\\u00f3/);
});

test('adaptador Redragon converte coordenadas do mouse para ponteiro assinado', () => {
  const script = fs.readFileSync(path.join(automationRoot, 'redragon-color.ps1'), 'utf8');
  assert.match(script, /\[IntPtr\]::new\(\[int64\]\$packedPoint\)/);
});

test('adaptador Gigabyte limita cliques à janela e valida o layout conhecido', () => {
  const script = fs.readFileSync(path.join(automationRoot, 'gigabyte-rgb-fusion.ps1'), 'utf8');
  assert.match(script, /FindRgbFusionWindow/);
  assert.match(script, /faixa laranja/);
  assert.match(script, /GetOrangeHeaderScore/);
  assert.match(script, /GetWindowTitle/);
  assert.match(script, /B550M AORUS ELITE\|RGB Fusion/);
  assert.match(script, /Set-ColorWheel/);
  assert.match(script, /ReadRelativeRgb/);
  assert.doesNotMatch(script, /SendKeys/);
  assert.match(script, /ShowWindow\(\$window, 3\)/);
  assert.doesNotMatch(script, /ClickRelative\(\$window, 0\.082, 0\.122\)/);
  assert.match(script, /roda de cores pronta/);
  assert.match(script, /GetForegroundWindow\(\) -ne \$window/);
  assert.match(script, /ClickRelative/);
  assert.doesNotMatch(script, /GLedApi|SMBus|WinRing|inpout/i);
});
