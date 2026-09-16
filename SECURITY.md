# Política de segurança

## Versões suportadas

Enquanto o projeto estiver em fase inicial, apenas a versão mais recente da branch `main` receberá correções de segurança.

## Relatando vulnerabilidades

Não publique tokens, dados de diagnóstico completos ou detalhes que permitam explorar uma instalação real. Abra uma issue sem informações sensíveis para pedir um canal privado de contato, descrevendo apenas a categoria geral do problema.

## Limites de confiança

- A API deve permanecer em `127.0.0.1` até que autenticação e firewall tenham sido configurados.
- Scripts na pasta de automações executam com as permissões do usuário atual.
- Perfis e scripts de terceiros devem ser revisados antes do uso.
- Atualizações dos aplicativos oficiais podem invalidar automações de interface.
- O projeto não oferece garantia de compatibilidade com qualquer controlador RGB.
