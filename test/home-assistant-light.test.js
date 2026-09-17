const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HomeAssistantLightController,
  normalizeBaseUrl,
  normalizeEntities,
  serviceForScene
} = require('../src/core/home-assistant-light');

test('normaliza endereço e entidades do Home Assistant', () => {
  assert.equal(normalizeBaseUrl('http://homeassistant.local:8123/lovelace'), 'http://homeassistant.local:8123');
  assert.deepEqual(normalizeEntities('light.mangueira\nlight.backlight_tv'), ['light.mangueira', 'light.backlight_tv']);
  assert.throws(() => normalizeEntities('switch.tomada'), /light\.nome_da_luz/);
});

test('converte uma cena RGB em serviço de luz do Home Assistant', () => {
  assert.deepEqual(serviceForScene({ color: '#1122aa', brightness: 55 }), {
    service: 'turn_on', body: { rgb_color: [17, 34, 170], brightness_pct: 55 }
  });
  assert.equal(serviceForScene({ color: '#000000', brightness: 0 }).service, 'turn_off');
});

test('envia luzes em grupo sem expor o token no resultado', async () => {
  let request;
  const controller = new HomeAssistantLightController({
    baseUrl: 'http://homeassistant.local:8123',
    token: 'token-seguro-com-mais-de-vinte-caracteres',
    entities: ['light.mangueira', 'light.backlight_tv']
  }, {
    fetch: async (url, options) => {
      request = { url, options };
      return { ok: true, text: async () => '' };
    }
  });
  const result = await controller.apply({ color: '#00ff00', brightness: 70 });
  assert.equal(result.ok, true);
  assert.match(request.url, /light\/turn_on$/);
  assert.deepEqual(JSON.parse(request.options.body).entity_id, ['light.mangueira', 'light.backlight_tv']);
  assert.doesNotMatch(JSON.stringify(result), /token-seguro/);
});
