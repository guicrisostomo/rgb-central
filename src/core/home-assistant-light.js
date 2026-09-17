function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new Error('Informe o endereço completo do Home Assistant, como http://homeassistant.local:8123.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('O endereço do Home Assistant precisa usar HTTP ou HTTPS e não pode conter usuário ou senha.');
  }
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function normalizeEntities(values) {
  const source = Array.isArray(values) ? values : String(values || '').split(/[\s,;]+/);
  const entities = [...new Set(source.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
  if (!entities.length) throw new Error('Informe pelo menos uma entidade de luz do Home Assistant.');
  if (entities.length > 30 || entities.some((entity) => !/^light\.[a-z0-9_]+$/.test(entity))) {
    throw new Error('Use entidades de luz no formato light.nome_da_luz.');
  }
  return entities;
}

function serviceForScene(scene) {
  const rgb = [
    Number.parseInt(scene.color.slice(1, 3), 16),
    Number.parseInt(scene.color.slice(3, 5), 16),
    Number.parseInt(scene.color.slice(5, 7), 16)
  ];
  const off = scene.brightness === 0 || rgb.every((value) => value === 0);
  return off
    ? { service: 'turn_off', body: {} }
    : { service: 'turn_on', body: { rgb_color: rgb, brightness_pct: scene.brightness } };
}

class HomeAssistantLightController {
  constructor({ baseUrl, token, entities } = {}, options = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = String(token || '').trim();
    this.entities = normalizeEntities(entities);
    this.fetch = options.fetch || globalThis.fetch;
    if (this.token.length < 20 || this.token.length > 4096) {
      throw new Error('Informe um token de acesso de longa duração válido do Home Assistant.');
    }
  }

  async apply(scene) {
    const request = serviceForScene(scene);
    try {
      const response = await this.fetch(`${this.baseUrl}/api/services/light/${request.service}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entity_id: this.entities, ...request.body }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) {
        const detail = String(await response.text()).slice(0, 180);
        throw new Error(`Home Assistant respondeu ${response.status}${detail ? `: ${detail}` : ''}`);
      }
      return {
        ok: true,
        message: `${this.entities.length} luz(es) atualizadas pelo Home Assistant.`
      };
    } catch (error) {
      return {
        ok: false,
        message: `Não foi possível controlar as luzes pelo Home Assistant: ${error.message}`
      };
    }
  }
}

module.exports = { HomeAssistantLightController, normalizeBaseUrl, normalizeEntities, serviceForScene };
