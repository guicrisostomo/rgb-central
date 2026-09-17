const { spawn } = require('node:child_process');
const path = require('node:path');
const { CorsairSdkController } = require('./corsair-sdk');

function replaceTokens(value, scene) {
  return String(value)
    .replaceAll('{scene}', scene.id)
    .replaceAll('{color}', scene.color)
    .replaceAll('{brightness}', String(scene.brightness));
}

function sanitizePowerShellOutput(value) {
  return String(value || '')
    .replace(/[A-Za-z]:\\Users\\[^\\\r\n]+/gi, '%USERPROFILE%')
    .replaceAll('\u0000', '')
    .trim()
    .slice(0, 500);
}

function summarizePowerShellError(value) {
  const details = sanitizePowerShellOutput(value);
  const firstLine = details.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || 'A automação não pôde ser concluída.';
  const scriptMessage = firstLine.match(/\.ps1\s*:\s*(.+)$/i);
  return (scriptMessage ? scriptMessage[1] : firstLine)
    .replace(/^Error invoking remote method '[^']+':\s*Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .slice(0, 280);
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
      resolve({
        ok: false,
        message: summarizePowerShellError(cause.message),
        technical: sanitizePowerShellOutput(cause.stack || cause.message)
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const raw = code === 0 ? output : error || output || `Código ${code}`;
      resolve({
        ok: code === 0,
        message: code === 0 ? sanitizePowerShellOutput(raw) : summarizePowerShellError(raw),
        ...(code === 0 ? {} : { technical: sanitizePowerShellOutput(raw) })
      });
    });
  });
}

class Orchestrator {
  constructor({ config, automationRoot, onUpdate = () => {}, corsairController = new CorsairSdkController() }) {
    this.config = config;
    this.automationRoot = automationRoot;
    this.onUpdate = onUpdate;
    this.corsairController = corsairController;
    this.state = { busy: false, activeScene: null, lastRunAt: null, results: [] };
  }

  publicState() {
    return { ...this.state, tokenConfigured: Boolean(this.config.api.token) };
  }

  async executeController(controller, scene) {
    if (controller.type === 'simulation') {
      await new Promise((resolve) => setTimeout(resolve, 180));
      return { ok: true, message: `Simulado: ${scene.color} a ${scene.brightness}%` };
    }
    if (controller.type === 'corsair-sdk') return this.corsairController.apply(scene);
    return executePowerShell(controller, scene, this.automationRoot);
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
      result = await this.executeController(controller, scene);
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

module.exports = { Orchestrator, executePowerShell, replaceTokens, sanitizePowerShellOutput, summarizePowerShellError };
