const ERROR_MESSAGES = {
  1: 'O iCUE não respondeu. Abra o iCUE e tente novamente.',
  2: 'Outro aplicativo assumiu o controle exclusivo da iluminação Corsair.',
  3: 'A versão do iCUE não é compatível com este SDK.',
  4: 'O iCUE recusou os parâmetros enviados pelo adaptador.',
  5: 'O iCUE recusou esta operação no estado atual.',
  6: 'Um dispositivo Corsair foi desconectado durante o comando.',
  7: 'O controle por aplicativos está bloqueado no iCUE.'
};

function sdkError(code, fallback = 'Falha desconhecida no SDK do iCUE.') {
  return ERROR_MESSAGES[code] || fallback;
}

function colorForScene(scene) {
  const factor = scene.brightness / 100;
  return {
    r: Math.round(Number.parseInt(scene.color.slice(1, 3), 16) * factor),
    g: Math.round(Number.parseInt(scene.color.slice(3, 5), 16) * factor),
    b: Math.round(Number.parseInt(scene.color.slice(5, 7), 16) * factor),
    a: 255
  };
}

class CorsairSdkController {
  constructor({ loadSdk = () => require('cue-sdk'), platform = process.platform, connectTimeoutMs = 8000 } = {}) {
    this.loadSdk = loadSdk;
    this.platform = platform;
    this.connectTimeoutMs = connectTimeoutMs;
    this.sdk = null;
    this.connected = false;
    this.connecting = null;
  }

  getSdk() {
    if (this.platform !== 'win32') throw new Error('O adaptador Corsair está disponível somente no Windows.');
    if (!this.sdk) {
      try {
        this.sdk = this.loadSdk();
      } catch {
        throw new Error('O componente oficial do iCUE SDK não pôde ser carregado. Reinstale o RGB Central.');
      }
    }
    return this.sdk;
  }

  async connect() {
    if (this.connected) return this.getSdk();
    if (this.connecting) return this.connecting;
    const sdk = this.getSdk();
    this.connecting = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.connecting = null;
        reject(new Error('O iCUE não respondeu a tempo. Confirme que ele está aberto e que o SDK está ativado.'));
      }, this.connectTimeoutMs);
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.connecting = null;
        if (error) reject(error);
        else {
          this.connected = true;
          resolve(sdk);
        }
      };
      const result = sdk.CorsairConnect((event) => {
        const state = event?.data?.state;
        if (state === sdk.CorsairSessionState.CSS_Connected) finish();
        else if (state === sdk.CorsairSessionState.CSS_ConnectionRefused) {
          finish(new Error('Ative “iCUE SDK” em Configurações → SDK no iCUE e tente novamente.'));
        } else if (state === sdk.CorsairSessionState.CSS_Timeout) {
          finish(new Error('O iCUE não foi encontrado. Abra-o e tente novamente.'));
        }
      });
      if (result.error !== sdk.CorsairError.CE_Success) finish(new Error(sdkError(result.error)));
    });
    return this.connecting;
  }

  async apply(scene) {
    let sdk;
    try {
      sdk = await this.connect();
    } catch (error) {
      return { ok: false, message: error.message };
    }
    const devicesResult = sdk.CorsairGetDevices({ deviceTypeMask: sdk.CorsairDeviceType.CDT_All });
    if (devicesResult.error !== sdk.CorsairError.CE_Success) {
      return { ok: false, message: sdkError(devicesResult.error) };
    }
    const devices = (devicesResult.data || []).filter((device) => device.ledCount > 0);
    if (devices.length === 0) {
      return { ok: false, message: 'O iCUE SDK não encontrou nenhum dispositivo com LEDs controláveis.' };
    }

    const color = colorForScene(scene);
    let changedDevices = 0;
    let changedLeds = 0;
    for (const device of devices) {
      const positions = sdk.CorsairGetLedPositions(device.id);
      if (positions.error !== sdk.CorsairError.CE_Success) continue;
      const leds = (positions.data || []).map((position) => ({ id: position.id, ...color }));
      if (leds.length === 0) continue;
      const result = sdk.CorsairSetLedColors(device.id, leds);
      if (result.error !== sdk.CorsairError.CE_Success) {
        return { ok: false, message: `${device.model || 'Dispositivo Corsair'}: ${sdkError(result.error)}` };
      }
      changedDevices += 1;
      changedLeds += leds.length;
    }
    if (changedDevices === 0) {
      return { ok: false, message: 'Os dispositivos Corsair foram encontrados, mas nenhum LED aceitou controle pelo SDK.' };
    }
    return {
      ok: true,
      message: `iCUE SDK: ${changedDevices} dispositivo(s) e ${changedLeds} LED(s) atualizados.`
    };
  }
}

module.exports = { CorsairSdkController, colorForScene, sdkError };
