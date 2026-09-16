# Contribuindo

Obrigado por ajudar a tornar setups com dispositivos de várias marcas mais simples e seguros.

## Antes de enviar uma alteração

1. Crie uma branch a partir de `main`.
2. Mantenha controladores novos desativados por padrão.
3. Não adicione escrita direta em SMBus, firmware ou memória de controladores.
4. Valide toda entrada usada em processos, scripts ou chamadas HTTP.
5. Adicione testes para alterações na configuração ou no orquestrador.
6. Execute `npm test`.

## Privacidade

Não envie:

- `config.json` gerado pelo aplicativo;
- tokens da API;
- diagnóstico sem revisão;
- caminhos contendo nomes pessoais;
- números de série, IDs únicos ou endereços de rede;
- capturas mostrando contas ou outros dados pessoais.

Ao relatar compatibilidade, prefira fabricante, modelo, versão do software e comportamento observado.

## Adaptadores de fabricantes

Documente:

- fabricante e modelo testado;
- versão exata do aplicativo oficial;
- método de seleção de perfil;
- comportamento quando o aplicativo está fechado;
- como a automação detecta falhas;
- como reverter a alteração.

Automação baseada em posição fixa do mouse não será aceita. Prefira SDKs oficiais, interfaces de acessibilidade do Windows ou controles identificados semanticamente.
