$ErrorActionPreference = 'Continue'
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'rgb-central-diagnostico.txt'
$patterns = 'Corsair|iCUE|HyperX|NGENUITY|Redragon|Gigabyte|RGB Fusion|ARCTIC|L-Connect|Lian Li'

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('RGB Central - diagnóstico sem senhas')
$lines.Add("Gerado em: $(Get-Date -Format s)")
$lines.Add('')
$lines.Add('=== Aplicativos instalados relacionados ===')

$uninstallRoots = @(
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
Get-ItemProperty $uninstallRoots |
  Where-Object { $_.DisplayName -match $patterns } |
  Sort-Object DisplayName -Unique |
  ForEach-Object { $lines.Add("$($_.DisplayName) | versão $($_.DisplayVersion) | $($_.InstallLocation)") }

$lines.Add('')
$lines.Add('=== Dispositivos relacionados ===')
Get-PnpDevice -PresentOnly |
  Where-Object { $_.FriendlyName -match $patterns -or $_.Manufacturer -match $patterns } |
  Sort-Object FriendlyName -Unique |
  ForEach-Object { $lines.Add("$($_.Class) | $($_.FriendlyName) | $($_.Manufacturer)") }

$lines.Add('')
$lines.Add('=== Processos relacionados em execução ===')
Get-Process |
  Where-Object { $_.ProcessName -match 'iCUE|NGenuity|Redragon|RGBFusion|GCC|L-Connect' } |
  Sort-Object ProcessName -Unique |
  ForEach-Object { $lines.Add("$($_.ProcessName) | $($_.Path)") }

$lines | Set-Content -LiteralPath $out -Encoding UTF8
Write-Host "Diagnóstico salvo em: $out"
