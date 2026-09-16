$ErrorActionPreference = 'Stop'

# O processo é iniciado com ExecutionPolicy Bypass somente para esta execução.
# O aplicativo valida previamente que o script está dentro da pasta autorizada.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

if (-not $env:RGB_CENTRAL_PAYLOAD) {
  throw 'Payload de execução ausente.'
}

$payloadBytes = [Convert]::FromBase64String($env:RGB_CENTRAL_PAYLOAD)
$payloadJson = [System.Text.Encoding]::UTF8.GetString($payloadBytes)
$payload = $payloadJson | ConvertFrom-Json

if (-not (Test-Path -LiteralPath $payload.scriptPath -PathType Leaf)) {
  throw 'Script autorizado não encontrado.'
}

$parameters = @{
  SceneId = [string]$payload.sceneId
  Color = [string]$payload.color
  Brightness = [int]$payload.brightness
}

$extraArguments = @($payload.extraArgs)
if (($extraArguments.Count % 2) -ne 0) {
  throw 'Parâmetros adicionais inválidos.'
}
for ($index = 0; $index -lt $extraArguments.Count; $index += 2) {
  $parameterName = [string]$extraArguments[$index]
  if ($parameterName -notmatch '^-([A-Za-z][A-Za-z0-9]{0,39})$') {
    throw 'Nome de parâmetro adicional inválido.'
  }
  $parameters[$Matches[1]] = [string]$extraArguments[$index + 1]
}

& $payload.scriptPath @parameters
