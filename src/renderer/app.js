let model;
let draftScenes = [];

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

function sceneEditorRow(scene, index) {
  const row = document.createElement('div');
  row.className = 'scene-editor-row';

  const color = document.createElement('input');
  color.type = 'color';
  color.value = scene.color;
  color.setAttribute('aria-label', `Cor da cena ${index + 1}`);
  color.addEventListener('input', () => { draftScenes[index].color = color.value; });

  const details = document.createElement('div');
  details.className = 'scene-editor-details';
  const name = document.createElement('input');
  name.type = 'text';
  name.maxLength = 60;
  name.required = true;
  name.value = scene.name;
  name.placeholder = 'Nome da cena';
  name.setAttribute('aria-label', `Nome da cena ${index + 1}`);
  name.addEventListener('input', () => { draftScenes[index].name = name.value; });

  const brightnessLine = document.createElement('label');
  brightnessLine.className = 'brightness-line';
  const brightness = document.createElement('input');
  brightness.type = 'range';
  brightness.min = '0';
  brightness.max = '100';
  brightness.value = String(scene.brightness);
  const brightnessValue = document.createElement('span');
  brightnessValue.textContent = `${scene.brightness}%`;
  brightness.addEventListener('input', () => {
    draftScenes[index].brightness = Number(brightness.value);
    brightnessValue.textContent = `${brightness.value}%`;
  });
  brightnessLine.append('Brilho', brightness, brightnessValue);
  details.append(name, brightnessLine);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'icon-button danger';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Remover ${scene.name}`);
  remove.addEventListener('click', () => {
    if (draftScenes.length === 1) return;
    draftScenes.splice(index, 1);
    renderSceneEditor();
  });

  row.append(color, details, remove);
  return row;
}

function renderSceneEditor() {
  document.querySelector('#scene-editor').replaceChildren(...draftScenes.map(sceneEditorRow));
}

function openSceneEditor() {
  draftScenes = model.scenes.map((scene) => ({ ...scene }));
  document.querySelector('#scene-error').textContent = '';
  renderSceneEditor();
  document.querySelector('#scene-dialog').showModal();
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
    const configured = controller.configured;
    const item = document.createElement('div');
    item.className = 'controller';
    const stateClass = result ? (result.ok ? 'ok' : 'fail') : '';
    const stateLabel = !configured
      ? 'Configuração necessária'
      : result ? (result.ok ? 'Aplicado' : 'Falhou') : controller.enabled ? 'Ativo' : 'Desativado';
    appendTextElement(item, 'strong', controller.name);
    const toggle = document.createElement('label');
    toggle.className = 'controller-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = controller.enabled;
    checkbox.disabled = !configured;
    if (!configured) checkbox.title = 'Calibre o adaptador e marque configured=true no config.json.';
    checkbox.setAttribute('aria-label', `Ativar ${controller.name}`);
    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      try {
        model = await window.rgbCentral.setControllerEnabled(controller.id, checkbox.checked);
        render();
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        window.alert(error.message);
      } finally {
        checkbox.disabled = false;
      }
    });
    toggle.append(checkbox, appendTextElement(document.createDocumentFragment(), 'span', stateLabel, `state ${stateClass}`));
    item.appendChild(toggle);
    const description = !configured
      ? `${controller.description || ''} Calibre o adaptador antes de ativá-lo.`.trim()
      : result?.message || controller.description || '';
    appendTextElement(item, 'small', description);
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
  document.querySelector('#edit-scenes').addEventListener('click', openSceneEditor);
  document.querySelector('#close-scenes').addEventListener('click', () => document.querySelector('#scene-dialog').close());
  document.querySelector('#cancel-scenes').addEventListener('click', () => document.querySelector('#scene-dialog').close());
  document.querySelector('#add-scene').addEventListener('click', () => {
    if (draftScenes.length >= 30) return;
    draftScenes.push({
      id: `scene_${Date.now().toString(36)}`,
      name: `Cena ${draftScenes.length + 1}`,
      color: '#31e981',
      brightness: 70
    });
    renderSceneEditor();
  });
  document.querySelector('#scene-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.querySelector('#scene-error');
    error.textContent = '';
    try {
      model = await window.rgbCentral.saveScenes(draftScenes);
      document.querySelector('#scene-dialog').close();
      render();
    } catch (cause) {
      error.textContent = cause.message;
    }
  });
  window.rgbCentral.onState((state) => { model.state = state; render(); });
  window.rgbCentral.onConfig((snapshot) => { model = snapshot; render(); });
  render();
}

start();
