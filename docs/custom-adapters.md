# Criando adaptadores personalizados

O RGB Central não exige uma lista fixa de fabricantes. Um controlador pode chamar qualquer script PowerShell autorizado dentro da pasta `automations` do usuário.

## 1. Criar o script

Crie um arquivo como `automations/meu-controlador.ps1`:

```powershell
param(
  [Parameter(Mandatory = $true)][string]$SceneId,
  [Parameter(Mandatory = $true)][string]$Color,
  [Parameter(Mandatory = $true)][int]$Brightness
)

# Valide os parâmetros antes de chamar o software oficial.
Write-Output "Aplicando $SceneId com $Color e $Brightness%"
```

O aplicativo fornece apenas o ID da cena, a cor hexadecimal e o brilho. O script decide como selecionar o perfil equivalente no software oficial.

## 2. Adicionar o controlador

Abra o `config.json` pelo botão **Abrir configuração** e adicione um item a `controllers`:

```json
{
  "id": "meu-controlador",
  "name": "Meu controlador",
  "description": "Integração local personalizada.",
  "type": "powershell",
  "script": "meu-controlador.ps1",
  "args": [],
  "configured": false,
  "enabled": false,
  "timeoutMs": 20000
}
```

Reinicie o RGB Central e teste o script isoladamente. Depois da calibração, altere `configured` para `true`; somente então o controlador poderá ser ativado pela interface.

## Restrições de segurança

- O script deve permanecer dentro da pasta privada `automations`.
- Não monte comandos de shell com texto não validado.
- Não grave tokens, senhas ou caminhos pessoais no repositório.
- Prefira SDKs oficiais ou a automação acessível do Windows.
- Evite cliques por coordenadas fixas.
- Mantenha novos controladores desativados por padrão.
