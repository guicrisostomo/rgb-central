function normalizeNetworkSettings(value) {
  const lanEnabled = Boolean(value?.lanEnabled);
  const port = Number(value?.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Escolha uma porta entre 1024 e 65535.');
  }
  return {
    host: lanEnabled ? '0.0.0.0' : '127.0.0.1',
    port
  };
}

function yamlQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildHomeAssistantConfig({ port, token, scenes }) {
  if (!token || token.length < 24) throw new Error('Token de integração ausente ou inválido.');
  const lines = [
    '# RGB Central - cole em configuration.yaml',
    '# Troque IP_DO_PC pelo endereço do computador com o RGB Central.',
    'rest_command:'
  ];
  for (const scene of scenes) {
    lines.push(
      `  rgb_central_${scene.id}:`,
      `    url: ${yamlQuote(`http://IP_DO_PC:${port}/api/scenes/${scene.id}/apply`)}`,
      '    method: POST',
      '    headers:',
      `      authorization: ${yamlQuote(`Bearer ${token}`)}`,
      '    content_type: application/json'
    );
  }
  return `${lines.join('\n')}\n`;
}

module.exports = { buildHomeAssistantConfig, normalizeNetworkSettings };
