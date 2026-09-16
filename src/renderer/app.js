let model;

function appendTextElement(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

function controllerResult(id) {
  return model.state.results.find((item) => item.id === id);
}

function render() {
  const scenes = document.querySelector('#scenes');
  scenes.replaceChildren(...model.scenes.map((scene) => {
    const button = document.createElement('button');
    button.className = `scene${model.state.activeScene === scene.id ? ' active' : ''}`;
    button.style.setProperty('--scene-color', scene.color);
    button.disabled = model.state.busy;
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    button.appendChild(swatch);
    appendTextElement(button, 'strong', scene.name);
    appendTextElement(button, 'small', `${scene.brightness}% de brilho`);
    button.addEventListener('click', async () => {
      try { await window.rgbCentral.applyScene(scene.id); }
      catch (error) { window.alert(error.message); }
    });
    return button;
  }));

  const enabledCount = model.controllers.filter((item) => item.enabled).length;
  document.querySelector('#controller-summary').textContent = `${enabledCount} de ${model.controllers.length} ativos`;
  const list = document.querySelector('#controllers');
  list.replaceChildren(...model.controllers.map((controller) => {
    const result = controllerResult(controller.id);
    const item = document.createElement('div');
    item.className = 'controller';
    const stateClass = result ? (result.ok ? 'ok' : 'fail') : '';
    const stateLabel = !controller.enabled ? 'Desativado' : result ? (result.ok ? 'Aplicado' : 'Falhou') : 'Aguardando';
    appendTextElement(item, 'strong', controller.name);
    appendTextElement(item, 'span', stateLabel, `state ${stateClass}`);
    appendTextElement(item, 'small', result?.message || controller.description || '');
    return item;
  }));

  const pill = document.querySelector('#status-pill');
  pill.textContent = model.state.busy ? 'Aplicando…' : 'Pronto';
  pill.classList.toggle('busy', model.state.busy);
}

async function start() {
  model = await window.rgbCentral.bootstrap();
  document.querySelector('#api-address').textContent = model.api.lanEnabled
    ? `API disponível na rede pela porta ${model.api.port} (token obrigatório).`
    : `API protegida somente neste PC: ${model.api.host}:${model.api.port}.`;
  const launch = document.querySelector('#launch-at-login');
  launch.checked = model.launchAtLogin;
  launch.addEventListener('change', async () => {
    launch.checked = await window.rgbCentral.setLaunchAtLogin(launch.checked);
  });
  document.querySelector('#open-config').addEventListener('click', () => window.rgbCentral.openConfig());
  document.querySelector('#open-automations').addEventListener('click', () => window.rgbCentral.openAutomations());
  window.rgbCentral.onState((state) => { model.state = state; render(); });
  render();
}

start();
