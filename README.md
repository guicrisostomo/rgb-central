# RGB Central

Central de cenas RGB para Windows que coordena os **softwares oficiais dos fabricantes**, sem acessar diretamente SMBus, firmware ou controladores de iluminação.

> Status: protótipo comunitário. A interface, a bandeja, as cenas e a API local funcionam. Os adaptadores de cada fabricante precisam ser calibrados para a versão do software e o hardware de cada computador antes de serem ativados.

## Por que este projeto existe?

Um setup pode misturar Corsair, HyperX, Redragon, Gigabyte, Arctic e outros fabricantes. Normalmente, cada marca exige um aplicativo diferente. O RGB Central oferece um único botão ou comando de automação para selecionar perfis equivalentes em todos eles.

Ao contrário de soluções que controlam os dispositivos diretamente, este projeto foi desenhado para **orquestrar perfis nos programas oficiais**. Isso reduz o risco de uma implementação genérica escrever em registradores ou controladores incompatíveis.

## Recursos atuais

- Cenas Verde, Vermelho, Azul, Branco, Trabalho e Apagar.
- Aplicativo Electron para Windows com ícone na bandeja.
- Inicialização opcional com o Windows.
- Resultado individual por controlador, sem esconder falhas.
- API HTTP local para Home Assistant e outras automações.
- Token aleatório criado na primeira execução.
- Modo de demonstração que não toca no hardware.
- Estrutura de adaptadores para iCUE, NGENUITY, Redragon e RGB Fusion.
- Script de diagnóstico para identificar versões e caminhos instalados.

## Modelo de segurança

- Não usa OpenRGB, SMBus ou escrita direta no hardware.
- Executa somente scripts localizados na pasta privada de automações.
- A API escuta apenas `127.0.0.1` por padrão.
- Acesso pela rede exige token com no mínimo 24 caracteres.
- O token só é aceito no cabeçalho `Authorization`, evitando exposição em URLs.
- IDs de cena são validados e nunca são executados como comandos de shell.
- Controladores reais começam desativados.
- O script genérico falha de propósito até ser calibrado para aquele aplicativo.

Nenhuma automação de interface é completamente livre de risco: atualizações dos programas podem mudar botões, menus e atalhos. Valide cada adaptador primeiro em uma conta e instalação de teste.

## Executar em desenvolvimento

Requisitos:

- Windows 10 ou 11.
- Node.js 22 ou superior.
- Os aplicativos oficiais dos dispositivos que você pretende controlar.

```powershell
npm install
npm test
npm start
```

Na primeira execução, o aplicativo cria `config.json` e a pasta `automations` dentro de `%APPDATA%\rgb-central`. Fechar a janela mantém o aplicativo na bandeja. Use **Sair** no menu da bandeja para encerrá-lo completamente.

## Gerar instalador e versão portátil

```powershell
npm install
npm run dist:win
```

Os artefatos são gerados em `dist/`.

## Calibrar os programas oficiais

1. Instale e atualize os aplicativos oficiais utilizados no computador.
2. Em cada aplicativo, crie os seis perfis descritos em `automations/profiles.json`.
3. Execute `automations/diagnostics.ps1` no PowerShell.
4. Revise o arquivo `rgb-central-diagnostico.txt` criado na Área de Trabalho.
5. Implemente e teste a seleção de perfil do fabricante desejado.
6. Somente depois altere `enabled` para `true` no controlador correspondente.

O diagnóstico não coleta senhas ou tokens. Entretanto, caminhos de instalação podem conter o nome da conta do Windows. **Revise e remova essas partes antes de anexar o diagnóstico a uma issue pública.** O arquivo de diagnóstico está incluído no `.gitignore`.

## Home Assistant e Alexa

Depois de validar tudo localmente:

1. Altere `api.host` para `0.0.0.0` no `config.json` criado pelo aplicativo.
2. Mantenha o token aleatório e não o publique.
3. Libere a porta TCP `47831` somente no perfil de rede privada do Windows.
4. Reinicie o RGB Central.
5. Adapte o exemplo em `docs/home-assistant.yaml.example`.

Exemplo de teste local:

```powershell
$token = 'TOKEN_DO_SEU_CONFIG_JSON'
Invoke-RestMethod `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token" } `
  -Uri 'http://127.0.0.1:47831/api/scenes/green/apply'
```

No Home Assistant, associe os comandos REST a scripts ou cenas e exponha somente esses scripts à Alexa. Nunca publique o token no repositório ou em capturas de tela.

## Estrutura

```text
src/core/       Configuração, orquestração e API local
src/renderer/   Interface do aplicativo
automations/    Scripts e mapeamentos de perfis
config/         Configuração segura inicial
docs/           Exemplos de integrações
test/           Testes automatizados
```

## Como contribuir

Contribuições para novos fabricantes, testes e melhorias de acessibilidade são bem-vindas. Leia [CONTRIBUTING.md](CONTRIBUTING.md) e evite incluir dumps, logs ou capturas com dados pessoais. Para vulnerabilidades, siga [SECURITY.md](SECURITY.md).

## English summary

RGB Central is a Windows tray app that coordinates equivalent RGB scenes through vendor-provided software instead of directly accessing lighting controllers. It currently provides the UI, local API, configuration model, simulation mode, tests, and safe adapter scaffolding. Vendor adapters must be calibrated and tested before use.

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](LICENSE).
