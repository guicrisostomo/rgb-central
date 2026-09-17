const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GoveeLanController,
  isLocalIPv4,
  packetsForScene,
  parseDiscoveryMessage
} = require('../src/core/govee-lan');

test('aceita apenas endereços IPv4 da rede local para dispositivos Govee', () => {
  assert.equal(isLocalIPv4('192.168.1.42'), true);
  assert.equal(isLocalIPv4('10.0.0.8'), true);
  assert.equal(isLocalIPv4('8.8.8.8'), false);
  assert.equal(isLocalIPv4('example.com'), false);
});

test('interpreta somente respostas válidas da descoberta Govee', () => {
  const device = parseDiscoveryMessage(JSON.stringify({
    msg: { cmd: 'scan', data: { ip: '192.168.1.51', device: 'AA:BB', sku: 'H6199' } }
  }));
  assert.deepEqual(device, { id: 'AA:BB', ip: '192.168.1.51', sku: 'H6199' });
  assert.equal(parseDiscoveryMessage('{inválido'), null);
  assert.equal(parseDiscoveryMessage(JSON.stringify({ msg: { cmd: 'scan', data: { ip: '1.1.1.1', device: 'x' } } })), null);
});

test('gera comandos oficiais de energia, brilho e cor para uma cena Govee', () => {
  const packets = packetsForScene({ color: '#12abef', brightness: 63 });
  assert.deepEqual(packets.map((packet) => packet.msg.cmd), ['turn', 'brightness', 'colorwc']);
  assert.deepEqual(packets[2].msg.data.color, { r: 18, g: 171, b: 239 });
  assert.equal(packetsForScene({ color: '#000000', brightness: 0 })[0].msg.data.value, 0);
});

test('aplica a mesma cena em todos os dispositivos Govee selecionados', async () => {
  const sent = [];
  const controller = new GoveeLanController({
    devices: [
      { id: 'one', ip: '192.168.1.20', sku: 'H6199' },
      { id: 'two', ip: '192.168.1.21', sku: 'H6054' }
    ]
  }, { send: async (ip, packet) => sent.push([ip, packet.msg.cmd]) });
  const result = await controller.apply({ color: '#00ff00', brightness: 70 });
  assert.equal(result.ok, true);
  assert.equal(sent.length, 6);
});
