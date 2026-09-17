let model;
let draftScenes = [];

const VIEW_COPY = {
  overview: ['SEU SETUP', 'Visão geral', 'Aplique uma cor em todos os controladores ativos.'],
  automations: ['PASSO A PASSO', 'Automações', 'Conecte os softwares oficiais sem precisar programar.'],
  settings: ['PREFERÊNCIAS', 'Configurações', 'Ajuste como o aplicativo inicia e quem pode acessá-lo.']
};

function appendTextElement(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

function setStatus(selector, message, failed = false) {
  const element = document.querySelector(selector);
  element.textContent = message;
  element.classList.toggle('error', failed);
}

function showView(name) {
  const copy = VIEW_COPY[name] || VIEW_COPY.overview;
  document.querySelectorAll('.view').forEach((view) => { view.hidden = view.id !== `view-${name}`; });
  document.querySelectorAll('.nav-button').forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('#view-eyebrow').textContent = copy[0];
  document.querySelector('#view-title').textContent = copy[1];
  document.querySelector('#view-subtitle').textContent = copy[2];
  document.querySelector('main').scrollTo({ top: 0, behavior: 'smooth' });
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

function renderScenes() {
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
}

function renderControllers() {
  const visibleControllers = model.controllers.filter((item) => !item.ignored);
  const ignoredControllers = model.controllers.filter((item) => item.ignored);
  const enabledCount = visibleControllers.filter((item) => item.enabled).length;
  const readyCount = visibleControllers.filter((item) => item.configured).length;
  document.querySelector('#controller-summary').textContent = `${enabledCount} ativos · ${readyCount} preparados`;
  document.querySelector('#overview-controller-count').textContent = `${enabledCount} de ${visibleControllers.length} ativos`;
  document.querySelector('#overview-controller-help').textContent = readyCount < visibleControllers.length
    ? 'Alguns dispositivos ainda precisam ser preparados.'
    : 'Todos os dispositivos estão preparados.';

  const list = document.querySelector('#controllers');
  list.replaceChildren(...visibleControllers.map((controller) => {
    const result = controllerResult(controller.id);
    const configured = controller.configured;
    const item = document.createElement('div');
    item.className = `controller${configured ? '' : ' needs-setup'}`;
    const stateClass = result ? (result.ok ? 'ok' : 'fail') : '';
    const stateLabel = !configured
      ? 'Preparação necessária'
      : result ? (result.ok ? 'Aplicado' : 'Falhou') : controller.enabled ? 'Ativo' : 'Desativado';
    appendTextElement(item, 'strong', controller.name);
    const toggle = document.createElement('label');
    toggle.className = 'controller-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = controller.enabled;
    checkbox.disabled = !configured;
    checkbox.title = configured ? '' : 'Faça as verificações desta tela antes de ativar.';
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
        checkbox.disabled = !controller.configured;
      }
    });
    const state = document.createElement('span');
    state.textContent = stateLabel;
    state.className = `state ${stateClass}`;
    toggle.append(checkbox, state);
    item.appendChild(toggle);
    const description = !configured
      ? controller.setupAvailable
        ? `${controller.description || ''} Abra o aplicativo oficial antes do teste.`.trim()
        : `${controller.description || ''} Adaptador seguro ainda indisponível.`.trim()
      : result?.message || controller.description || '';
    appendTextElement(item, 'small', description);
    const actions = document.createElement('div');
    actions.className = 'controller-actions';
    if (!configured && controller.setupAvailable) {
      const setupButton = document.createElement('button');
      setupButton.type = 'button';
      setupButton.className = 'secondary controller-setup';
      setupButton.textContent = 'Testar adaptador';
      setupButton.addEventListener('click', async () => {
        setupButton.disabled = true;
        setupButton.textContent = 'Testando verde…';
        try {
          const response = await window.rgbCentral.testController(controller.id);
          model = response.snapshot;
          render();
          window.alert(response.message);
        } catch (error) {
          setupButton.disabled = false;
          setupButton.textContent = 'Testar adaptador';
          window.alert(`Teste não concluído: ${error.message}`);
        }
      });
      actions.appendChild(setupButton);
    }
    if (controller.type !== 'simulation') {
      const ignoreButton = document.createElement('button');
      ignoreButton.type = 'button';
      ignoreButton.className = 'text-button controller-ignore';
      ignoreButton.textContent = 'Não uso este controlador';
      ignoreButton.addEventListener('click', async () => {
        ignoreButton.disabled = true;
        try {
          model = await window.rgbCentral.setControllerIgnored(controller.id, true);
          render();
        } catch (error) {
          ignoreButton.disabled = false;
          window.alert(error.message);
        }
      });
      actions.appendChild(ignoreButton);
    }
    if (actions.childElementCount) item.appendChild(actions);
    return item;
  }));

  const ignoredCard = document.querySelector('#ignored-controllers-card');
  ignoredCard.hidden = ignoredControllers.length === 0;
  document.querySelector('#ignored-controller-summary').textContent = ignoredControllers.length === 1
    ? '1 controlador oculto'
    : `${ignoredControllers.length} controladores ocultos`;
  document.querySelector('#ignored-controllers').replaceChildren(...ignoredControllers.map((controller) => {
    const row = document.createElement('div');
    row.className = 'ignored-controller';
    const label = document.createElement('span');
    appendTextElement(label, 'strong', controller.name);
    appendTextElement(label, 'small', 'Fora das cenas e desativado.');
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'secondary';
    restore.textContent = 'Restaurar';
    restore.addEventListener('click', async () => {
      restore.disabled = true;
      try {
        model = await window.rgbCentral.setControllerIgnored(controller.id, false);
        render();
      } catch (error) {
        restore.disabled = false;
        window.alert(error.message);
      }
    });
    row.append(label, restore);
    return row;
  }));
}

function syncSettingsForm() {
  document.querySelector('#launch-at-login').checked = model.launchAtLogin;
  const accessValue = model.api.lanEnabled ? 'lan' : 'local';
  document.querySelector(`input[name="access-mode"][value="${accessValue}"]`).checked = true;
  document.querySelector('#api-port').value = String(model.api.port);
  document.querySelector('#regenerate-token').checked = false;
  document.querySelector('#token-state').textContent = model.api.tokenConfigured ? 'Protegido' : 'Atenção necessária';
  document.querySelector('#token-state').classList.toggle('warning', !model.api.tokenConfigured);
  updateLanWarning();
}

function render() {
  renderScenes();
  renderControllers();
  const pill = document.querySelector('#status-pill');
  pill.textContent = model.state.busy ? 'Aplicando…' : 'Pronto';
  pill.classList.toggle('busy', model.state.busy);
}

function updateLanWarning() {
  const lan = document.querySelector('input[name="access-mode"]:checked')?.value === 'lan';
  document.querySelector('#lan-warning').hidden = !lan;
}

async function runTool(button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Verificando…';
  try {
    const result = await window.rgbCentral.runSetupTool(button.dataset.tool);
    window.alert(result.message);
  } catch (error) {
    window.alert(`Não foi possível concluir: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function start() {
  model = await window.rgbCentral.bootstrap();
  document.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  document.querySelectorAll('.navigate').forEach((button) => button.addEventListener('click', () => showView(button.dataset.target)));
  document.querySelectorAll('input[name="access-mode"]').forEach((input) => input.addEventListener('change', updateLanWarning));
  document.querySelectorAll('.tool-run').forEach((button) => button.addEventListener('click', () => runTool(button)));
  document.querySelectorAll('.tool-open').forEach((button) => button.addEventListener('click', async () => {
    try { await window.rgbCentral.openSetupOutput(button.dataset.tool); }
    catch (error) { window.alert(error.message); }
  }));
  document.querySelector('#copy-home-assistant').addEventListener('click', async () => {
    setStatus('#integration-status', 'Copiando…');
    try {
      const result = await window.rgbCentral.copyHomeAssistantConfig();
      setStatus('#integration-status', result.message);
    } catch (error) {
      setStatus('#integration-status', error.message, true);
    }
  });
  document.querySelector('#settings-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    submit.disabled = true;
    setStatus('#settings-status', 'Salvando…');
    try {
      model = await window.rgbCentral.saveAppSettings({
        launchAtLogin: document.querySelector('#launch-at-login').checked,
        lanEnabled: document.querySelector('input[name="access-mode"]:checked').value === 'lan',
        port: Number(document.querySelector('#api-port').value),
        regenerateToken: document.querySelector('#regenerate-token').checked
      });
      syncSettingsForm();
      setStatus('#settings-status', 'Configurações salvas com segurança.');
    } catch (error) {
      setStatus('#settings-status', error.message, true);
    } finally {
      submit.disabled = false;
    }
  });
  document.querySelector('#open-config').addEventListener('click', () => window.rgbCentral.openConfig());
  document.querySelector('#open-automations').addEventListener('click', () => window.rgbCentral.openAutomations());
  document.querySelector('#edit-scenes').addEventListener('click', openSceneEditor);
  document.querySelector('#close-scenes').addEventListener('click', () => document.querySelector('#scene-dialog').close());
  document.querySelector('#cancel-scenes').addEventListener('click', () => document.querySelector('#scene-dialog').close());
  document.querySelector('#add-scene').addEventListener('click', () => {
    if (draftScenes.length >= 30) return;
    draftScenes.push({ id: `scene_${Date.now().toString(36)}`, name: `Cena ${draftScenes.length + 1}`, color: '#31e981', brightness: 70 });
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
    } catch (cause) { error.textContent = cause.message; }
  });
  window.rgbCentral.onState((state) => { model.state = state; render(); });
  window.rgbCentral.onConfig((snapshot) => { model = snapshot; render(); });
  syncSettingsForm();
  render();
}

start().catch((error) => {
  document.querySelector('#status-pill').textContent = 'Erro ao iniciar';
  window.alert(error.message);
});
