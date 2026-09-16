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

$arguments = @(
  '-SceneId', [string]$payload.sceneId,
  '-Color', [string]$payload.color,
  '-Brightness', [string]$payload.brightness
)
foreach ($argument in $payload.extraArgs) {
  $arguments += [string]$argument
}

& $payload.scriptPath @arguments
