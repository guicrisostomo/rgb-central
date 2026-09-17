const test = require('node:test');
const assert = require('node:assert/strict');
const { CorsairSdkController, colorForScene } = require('../src/core/corsair-sdk');

function fakeSdk(overrides = {}) {
  const calls = [];
  const sdk = {
    CorsairError: { CE_Success: 0 },
    CorsairSessionState: { CSS_Connected: 6, CSS_Timeout: 3, CSS_ConnectionRefused: 4 },
    CorsairDeviceType: { CDT_All: 0xffffffff },
    CorsairConnect(callback) {
      queueMicrotask(() => callback({ data: { state: 6 } }));
      return { error: 0 };
    },
    CorsairGetDevices() {
      return { error: 0, data: [{ id: 'device-1', model: 'Teste', ledCount: 2 }] };
    },
    CorsairGetLedPositions() {
      return { error: 0, data: [{ id: 10 }, { id: 11 }] };
    },
    CorsairSetLedColors(id, colors) {
      calls.push({ id, colors });
      return { error: 0 };
    },
    ...overrides
  };
  return { sdk, calls };
}

test('converte cor e brilho da cena para canais do iCUE', () => {
  assert.deepEqual(colorForScene({ color: '#80ff20', brightness: 50 }), { r: 64, g: 128, b: 16, a: 255 });
});

test('aplica cor sólida em todos os LEDs retornados pelo SDK oficial', async () => {
  const { sdk, calls } = fakeSdk();
  const controller = new CorsairSdkController({ loadSdk: () => sdk, platform: 'win32' });
  const result = await controller.apply({ color: '#00ff00', brightness: 70 });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].colors, [
    { id: 10, r: 0, g: 179, b: 0, a: 255 },
    { id: 11, r: 0, g: 179, b: 0, a: 255 }
  ]);
});

test('orienta a ativação do SDK quando o iCUE recusa a conexão', async () => {
  const { sdk } = fakeSdk({
    CorsairConnect(callback) {
      queueMicrotask(() => callback({ data: { state: 4 } }));
      return { error: 0 };
    }
  });
  const controller = new CorsairSdkController({ loadSdk: () => sdk, platform: 'win32' });
  const result = await controller.apply({ color: '#00ff00', brightness: 70 });
  assert.equal(result.ok, false);
  assert.match(result.message, /Configurações.*SDK/);
});
