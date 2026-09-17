const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rendererRoot = path.join(__dirname, '..', 'src', 'renderer');

test('interface usa diálogo próprio e não alertas nativos para erros', () => {
  const html = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  assert.match(html, /id="feedback-dialog"/);
  assert.match(html, /Detalhes técnicos/);
  assert.match(script, /function normalizeError/);
  assert.match(script, /copySupportText/);
  assert.doesNotMatch(script, /window\.alert/);
});

test('interface anonimiza caminhos do perfil antes de exibir detalhes', () => {
  const script = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  assert.match(script, /Users/);
  assert.match(script, /%USERPROFILE%/);
});

test('interface oferece configuração guiada para Govee e luzes do Home Assistant', () => {
  const html = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  assert.match(html, /id="govee-setup"/);
  assert.match(html, /id="home-assistant-setup"/);
  assert.match(html, /Higoogoo, Smart Life, Tuya/);
  assert.match(script, /discoverGovee/);
  assert.match(script, /configureAmbientLight/);
});
