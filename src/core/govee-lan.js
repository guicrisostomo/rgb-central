const dgram = require('node:dgram');
const net = require('node:net');

const MULTICAST_ADDRESS = '239.255.255.250';
const SCAN_PORT = 4001;
const RECEIVE_PORT = 4002;
const DEVICE_PORT = 4003;

function isLocalIPv4(value) {
  if (net.isIP(value) !== 4) return false;
  const [a, b] = value.split('.').map(Number);
  return a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168);
}

function command(cmd, data) {
  return { msg: { cmd, data } };
}

function colorFromScene(scene) {
  return {
    r: Number.parseInt(scene.color.slice(1, 3), 16),
    g: Number.parseInt(scene.color.slice(3, 5), 16),
    b: Number.parseInt(scene.color.slice(5, 7), 16)
  };
}

function packetsForScene(scene) {
  const color = colorFromScene(scene);
  const shouldTurnOff = scene.brightness === 0 || (color.r === 0 && color.g === 0 && color.b === 0);
  if (shouldTurnOff) return [command('turn', { value: 0 })];
  return [
    command('turn', { value: 1 }),
    command('brightness', { value: scene.brightness }),
    command('colorwc', { color, colorTemInKelvin: 0 })
  ];
}

function parseDiscoveryMessage(message, remoteAddress = '') {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.isBuffer(message) ? message.toString('utf8') : String(message));
  } catch {
    return null;
  }
  if (parsed?.msg?.cmd !== 'scan' || !parsed.msg.data) return null;
  const data = parsed.msg.data;
  const ip = data.ip || remoteAddress;
  if (!isLocalIPv4(ip)) return null;
  const id = String(data.device || '').trim();
  const sku = String(data.sku || 'Govee').trim().slice(0, 40);
  if (!id || id.length > 100) return null;
  return { id, ip, sku };
}

function discoverGoveeDevices({ timeoutMs = 2600, socketFactory = () => dgram.createSocket({ type: 'udp4', reuseAddr: true }) } = {}) {
  return new Promise((resolve, reject) => {
    const socket = socketFactory();
    const devices = new Map();
    let finished = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      if (error) reject(error);
      else resolve([...devices.values()].sort((a, b) => a.sku.localeCompare(b.sku)));
    };
    const timer = setTimeout(() => finish(), Math.min(Math.max(timeoutMs, 500), 10000));
    socket.on('error', (error) => finish(new Error(`Não foi possível procurar dispositivos Govee na rede: ${error.message}`)));
    socket.on('message', (message, remote) => {
      const device = parseDiscoveryMessage(message, remote?.address);
      if (device) devices.set(device.id, device);
    });
    socket.bind(RECEIVE_PORT, '0.0.0.0', () => {
      try { socket.addMembership(MULTICAST_ADDRESS); } catch {}
      const payload = Buffer.from(JSON.stringify(command('scan', { account_topic: 'reserve' })), 'utf8');
      socket.send(payload, SCAN_PORT, MULTICAST_ADDRESS, (error) => {
        if (error) finish(new Error(`A busca Govee não pôde ser enviada: ${error.message}`));
      });
    });
  });
}

function sendPacket(ip, payload, socketFactory = () => dgram.createSocket('udp4')) {
  return new Promise((resolve, reject) => {
    if (!isLocalIPv4(ip)) {
      reject(new Error('O endereço do dispositivo Govee não pertence à rede local.'));
      return;
    }
    const socket = socketFactory();
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    socket.send(body, DEVICE_PORT, ip, (error) => {
      try { socket.close(); } catch {}
      if (error) reject(error);
      else resolve();
    });
  });
}

class GoveeLanController {
  constructor({ devices = [] } = {}, options = {}) {
    this.devices = devices;
    this.send = options.send || sendPacket;
  }

  async apply(scene) {
    if (!this.devices.length) {
      return { ok: false, message: 'Nenhum dispositivo Govee foi configurado.' };
    }
    try {
      const packets = packetsForScene(scene);
      await Promise.all(this.devices.map(async (device) => {
        for (const packet of packets) await this.send(device.ip, packet);
      }));
      const action = packets[0].msg.data.value === 0
        ? 'desligados'
        : `ajustados para ${scene.color} a ${scene.brightness}%`;
      return { ok: true, message: `${this.devices.length} dispositivo(s) Govee ${action}.` };
    } catch (error) {
      return {
        ok: false,
        message: `Não foi possível controlar a iluminação Govee: ${error.message}`
      };
    }
  }
}

module.exports = {
  DEVICE_PORT,
  GoveeLanController,
  MULTICAST_ADDRESS,
  RECEIVE_PORT,
  SCAN_PORT,
  discoverGoveeDevices,
  isLocalIPv4,
  packetsForScene,
  parseDiscoveryMessage,
  sendPacket
};
