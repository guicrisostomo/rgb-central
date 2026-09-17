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
- Erros apresentados dentro do aplicativo com resumo, orientação prática e detalhes técnicos anonimizados e copiáveis.
- Descoberta local de fitas, mangueiras e backlights Govee compatíveis com a API LAN oficial.
- Assistente para luzes Higoogoo, Smart Life, Tuya e outras já disponíveis no Home Assistant.
- API HTTP local para Home Assistant e outras automações.
- Token aleatório criado na primeira execução.
- Modo de demonstração que não toca no hardware.
- Editor visual para criar cenas com qualquer nome, cor e brilho.
- Telas separadas de Visão geral, Automações e Configurações, com linguagem guiada.
- Diagnóstico e inspeção de interfaces executados por botões, inclusive sob políticas restritas do PowerShell.
- Configuração visual de acesso local/rede, porta e renovação da chave de proteção.
- Gerador local da configuração do Home Assistant, copiada sem exibir o token na tela.
- Controladores opcionais que podem ser ativados, desativados ou ocultados individualmente e restaurados depois.
- Adaptador opt-in para Corsair usando o pacote oficial iCUE SDK para Node/Electron.
- Adaptadores experimentais e opt-in para HyperX NGENUITY e Redragon, sempre testados individualmente antes da ativação.
- Adaptador visual experimental e opt-in para RGB Fusion 3.24, limitado à janela oficial e validado antes de clicar.
- Modelo bloqueado para L-Connect 3 até existir um caminho seguro e necessário para o hardware detectado.
- Suporte a novos adaptadores por configuração, sem limitar o projeto a um setup específico.
- Script de diagnóstico para identificar versões e caminhos instalados.

Veja a tabela de [estado dos controladores](docs/controller-support.md) para entender o método e as limitações de cada integração.

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
npm run privacy-check
npm start
```

Na primeira execução, o aplicativo cria `config.json` e a pasta `automations` dentro de `%APPDATA%\rgb-central`. Fechar a janela mantém o aplicativo na bandeja. Use **Sair** no menu da bandeja para encerrá-lo completamente.

As cenas podem ser personalizadas diretamente na interface. O usuário escolhe nome, cor e brilho, adiciona ou remove cenas e ativa somente os controladores que realmente utiliza. As telas **Automações** e **Configurações** reúnem as tarefas comuns sem exigir a edição de JSON ou a execução manual de scripts. Os fabricantes presentes na configuração inicial são modelos opcionais e começam desativados.

Se um fabricante instalado não controla nenhuma luz do computador, use **Não uso este controlador**. O item fica desativado e sai da lista principal, mas continua disponível em **Controladores ocultos** para ser restaurado sem editar arquivos.

Controladores ainda não calibrados aparecem como **Configuração necessária** e não podem ser ativados. Isso impede que um modelo incompleto tente controlar aplicativos ou hardware por engano.

Quando um adaptador seguro está disponível, a tela **Automações** apresenta o botão **Testar adaptador**. O teste aplica verde a 70% somente naquele aplicativo. O controlador só é liberado depois de um teste bem-sucedido e ainda permanece desligado até o usuário ativá-lo.

Para a Corsair, abra **iCUE → Configurações → SDK** e ative **iCUE SDK**. O RGB Central usa o pacote oficial `cue-sdk`, mantido pela Corsair, em modo compartilhado. Ele pede ao próprio iCUE a lista de dispositivos e LEDs e não acessa USB, SMBus ou firmware diretamente. Caso o SDK esteja desativado, o teste explica onde habilitá-lo.

O projeto não utiliza o [SDK público legado do RGB Fusion](https://www.gigabyte.com/mb/rgb/sdk): o pacote é de 2019, sua documentação lista placas AMD somente até X470 e não apresenta uma licença clara para redistribuir as DLLs. Em vez disso, o adaptador Gigabyte automatiza a tela oficial do RGB Fusion 3.24.1202.1. Ele confere processo, dimensões, proporção e o cabeçalho visual conhecido antes de qualquer clique; seleciona a cor pela roda HSV; confirma a cor exibida na linha do conector; usa coordenadas relativas à janela; restaura o cursor e permanece desativado até a confirmação do usuário. Como a interface não oferece controles acessíveis, uma atualização visual do RGB Fusion pode exigir nova calibração.

Para testar a Gigabyte, abra o RGB Fusion na tela **B550M AORUS ELITE**, maximize a janela, deixe o **Sync Mode** disponível e não use o mouse durante alguns segundos. O teste envia verde a 70% aos conectores sincronizados, incluindo `Digital LED`. Confirme visualmente o resultado antes de ativar o controlador.

### Mangueiras, fitas e backlights

Para dispositivos Govee compatíveis, abra o Govee Home, entre nas configurações da luz e ative **LAN Control**. No RGB Central, abra **Automações → Govee / backlight → Localizar dispositivos**. A busca e os comandos ficam na rede local e não exigem a chave da API na nuvem. A descoberta usa UDP `4001` e `4002`; o controle usa UDP `4003`.

A marca Higoogoo utiliza controladores diferentes conforme o produto: há modelos Wi-Fi e modelos que dependem apenas de Bluetooth ou controle remoto. Por isso, o RGB Central não presume um protocolo só pela marca. Luzes Higoogoo, Smart Life, Tuya e outras que já aparecem no Home Assistant podem ser adicionadas em **Mangueira e backlight → Conectar luzes**, informando o endereço do Home Assistant, as entidades `light.*` e um token de longa duração. O token fica apenas no `config.json` local, é omitido da interface e nunca faz parte do repositório.

Se a Higoogoo não aparece no Home Assistant e funciona somente por Bluetooth, será necessário identificar o nome do aplicativo e o modelo do controlador ou substituir o controlador por uma opção com integração conhecida, como Wi-Fi/Tuya, Zigbee ou WLED. O RGB Central não tenta enviar comandos Bluetooth desconhecidos.

O L-Connect 3 permanece opcional e bloqueado quando nenhum controlador Lian Li é detectado.

No NGENUITY, o RGB Central escolhe a cor disponível mais próxima dentro de uma tolerância segura. Cores sem aproximação razoável, como branco quando ele não existe na paleta, precisam ser adicionadas uma vez pelo usuário; o aplicativo não troca uma cor solicitada por outra muito diferente. O adaptador Redragon preenche os campos RGB do software oficial e confirma pelo botão Apply.

Para integrar outra marca ou um script próprio, consulte [Criando adaptadores personalizados](docs/custom-adapters.md). O identificador do fabricante não é limitado às marcas fornecidas como exemplo.

## Gerar instalador e versão portátil

```powershell
npm install
npm run dist:win
```

Os artefatos são gerados em `dist/`.

## Calibrar os programas oficiais

1. Instale e atualize os aplicativos oficiais utilizados no computador.
2. Em cada aplicativo, crie os seis perfis descritos em `automations/profiles.json`.
3. Abra **Automações** no RGB Central e clique em **Verificar programas**.
4. Revise o arquivo `rgb-central-diagnostico.txt` criado na Área de Trabalho.
5. Em cada aplicativo RGB, abra a tela de perfis ou iluminação e clique em **Inspecionar telas abertas** para gerar uma árvore somente de leitura dos controles acessíveis, com uma leitura Win32 de apoio.
6. Revise o arquivo `rgb-central-interface.txt` criado na Área de Trabalho.
7. Implemente e teste a seleção de perfil do fabricante desejado.
8. Somente depois altere `enabled` para `true` no controlador correspondente.

O diagnóstico não coleta senhas ou tokens, e a inspeção não lê valores digitados em caixas de texto. Entretanto, caminhos e títulos de janela podem conter informações pessoais. **Revise e remova essas partes antes de anexar os arquivos a uma issue pública.** Os dois arquivos gerados estão incluídos no `.gitignore`.

## Home Assistant e Alexa

Depois de validar tudo localmente:

1. Abra **Configurações** e selecione **Minha rede local**.
2. Salve e mantenha a chave de proteção privada.
3. Libere a porta escolhida somente no perfil de rede privada do Windows.
4. Abra **Automações** e clique em **Copiar configuração**.
5. Cole o trecho no `configuration.yaml` do Home Assistant e substitua `IP_DO_PC`.

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
