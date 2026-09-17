# Estado dos controladores

O RGB Central só libera um controlador depois que existe um caminho limitado, testável e opt-in. Ter o aplicativo do fabricante instalado não significa que o adaptador esteja seguro para uso.

| Controlador | Estado | Método | Observação |
|---|---|---|---|
| Demonstração | Estável | Simulação local | Não acessa hardware. |
| Corsair iCUE | Disponível | SDK oficial em modo compartilhado | Requer habilitar o iCUE SDK e confirmar o teste individual. |
| HyperX NGENUITY | Experimental | Automação acessível do aplicativo oficial | Depende da versão, idioma e controles expostos pelo NGENUITY. |
| Redragon | Experimental | Automação limitada à janela do aplicativo oficial | Depende do modelo e da interface fornecida pelo software Redragon. |
| Gigabyte RGB Fusion | Bloqueado | Nenhum adaptador liberado | O SDK público legado é de 2019 e sua documentação lista plataformas AMD somente até X470. O projeto não redistribui suas DLLs. |
| Lian Li L-Connect 3 | Bloqueado | Nenhum adaptador liberado | Ainda não há uma interface oficial estável validada neste projeto. |

Controladores bloqueados podem ser marcados como **Não uso este controlador**. Eles ficam desativados e ocultos da lista principal, mas podem ser restaurados pela interface.

## Critérios para liberar um novo adaptador

- Não acessar diretamente SMBus, firmware ou registradores do dispositivo.
- Preferir um SDK ou uma API mantida oficialmente pelo fabricante.
- Limitar a automação de interface ao processo esperado e evitar coordenadas absolutas quando possível.
- Executar um teste isolado antes de permitir a ativação.
- Permanecer desativado por padrão e relatar falhas por controlador.
- Não incluir binários de terceiros sem licença explícita de redistribuição.

Fontes oficiais: [Corsair iCUE SDK para Node](https://github.com/CorsairOfficial/cue-sdk-node) e [Gigabyte RGB Fusion SDK](https://www.gigabyte.com/mb/rgb/sdk).
