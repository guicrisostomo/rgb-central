param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9_-]+$')][string]$SceneId,
  [Parameter(Mandatory = $true)][ValidatePattern('^#[0-9a-fA-F]{6}$')][string]$Color,
  [Parameter(Mandatory = $true)][ValidateRange(0, 100)][int]$Brightness,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9_-]{1,40}$')][string]$Vendor
)

$ErrorActionPreference = 'Stop'
$profilesPath = Join-Path $PSScriptRoot 'profiles.json'
$profiles = Get-Content -Raw -LiteralPath $profilesPath | ConvertFrom-Json
$vendorConfig = $profiles.$Vendor

if (-not $vendorConfig) {
  throw "Controlador não configurado: $Vendor"
}
if (-not $vendorConfig.enabled) {
  throw "A automação de $Vendor ainda não foi calibrada para este PC."
}

# Este script deliberadamente não fala diretamente com o hardware. Após a
# calibração, ele abre o aplicativo oficial e seleciona um perfil existente.
# As etapas específicas serão adicionadas depois de confirmar a versão do app
# e os modelos dos dispositivos do computador.

Write-Output "Perfil '$SceneId' solicitado para $Vendor ($Color, $Brightness%)."
throw "Automação segura aguardando calibração da interface de $Vendor."
