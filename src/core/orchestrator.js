const { spawn } = require('node:child_process');
const path = require('node:path');

function replaceTokens(value, scene) {
  return String(value)
    .replaceAll('{scene}', scene.id)
    .replaceAll('{color}', scene.color)
    .replaceAll('{brightness}', String(scene.brightness));
}

function executePowerShell(controller, scene, automationRoot) {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(automationRoot, controller.script);
    const runnerPath = path.resolve(automationRoot, 'powershell-runner.ps1');
    const safeRoot = `${path.resolve(automationRoot)}${path.sep}`;
    if (!scriptPath.startsWith(safeRoot) || !runnerPath.startsWith(safeRoot)) {
      resolve({ ok: false, message: 'Script fora da pasta autorizada.' });
      return;
    }
    const payload = Buffer.from(JSON.stringify({
      scriptPath,
      sceneId: scene.id,
      color: scene.color,
      brightness: scene.brightness,
      extraArgs: (controller.args || []).map((arg) => replaceTokens(arg, scene))
    }), 'utf8').toString('base64');
    const args = [
      '-NoLogo', '-NoProfile', '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', runnerPath
    ];
    const child = spawn('powershell.exe', args, {
      windowsHide: true,
      shell: false,
      env: { ...process.env, RGB_CENTRAL_PAYLOAD: payload }
    });
    let output = '';
    let error = '';
    const timeoutMs = Math.min(Math.max(controller.timeoutMs || 15000, 1000), 60000);
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { error += chunk.toString(); });
    child.on('error', (cause) => {
      clearTimeout(timer);
      resolve({ ok: false, message: cause.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        message: (code === 0 ? output : error || output || `Código ${code}`).trim().slice(0, 500)
      });
    });
  });
}

class Orchestrator {
  constructor({ config, automationRoot, onUpdate = () => {} }) {
    this.config = config;
    this.automationRoot = automationRoot;
    this.onUpdate = onUpdate;
    this.state = { busy: false, activeScene: null, lastRunAt: null, results: [] };
  }

  publicState() {
    return { ...this.state, tokenConfigured: Boolean(this.config.api.token) };
  }

  async applyScene(sceneId) {
    if (this.state.busy) throw new Error('Outra cena ainda está sendo aplicada.');
    const scene = this.config.scenes.find((item) => item.id === sceneId);
    if (!scene) throw new Error('Cena não encontrada.');
    this.state = { ...this.state, busy: true, results: [] };
    this.onUpdate(this.publicState());
    const enabled = this.config.controllers.filter((item) => item.enabled);
    const results = [];
    for (const controller of enabled) {
      let result;
      if (controller.type === 'simulation') {
        await new Promise((resolve) => setTimeout(resolve, 180));
        result = { ok: true, message: `Simulado: ${scene.color} a ${scene.brightness}%` };
      } else {
        result = await executePowerShell(controller, scene, this.automationRoot);
      }
      results.push({ id: controller.id, name: controller.name, ...result });
      this.state = { ...this.state, results: [...results] };
      this.onUpdate(this.publicState());
    }
    const allOk = results.every((item) => item.ok);
    this.state = {
      busy: false,
      activeScene: allOk ? scene.id : this.state.activeScene,
      lastRunAt: new Date().toISOString(),
      results
    };
    this.onUpdate(this.publicState());
    return { ok: allOk, scene, results };
  }
}

module.exports = { Orchestrator, executePowerShell, replaceTokens };
