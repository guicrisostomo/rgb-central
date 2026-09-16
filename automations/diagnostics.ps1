$ErrorActionPreference = 'Continue'
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'rgb-central-diagnostico.txt'
$patterns = 'Corsair|iCUE|HyperX|NGENUITY|Redragon|Gigabyte|RGB Fusion|ARCTIC|L-Connect|Lian[ -]Li'
$processPatterns = 'iCUE|NGenuity|HyperX|Redragon|RGBFusion|GCC|L-Connect'

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('RGB Central - diagnostico sem senhas')
$lines.Add("Gerado em: $(Get-Date -Format s)")
$lines.Add("PowerShell: $($PSVersionTable.PSVersion)")
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
  ForEach-Object { $lines.Add("$($_.DisplayName) | versao $($_.DisplayVersion) | $($_.InstallLocation)") }

$lines.Add('')
$lines.Add('=== Aplicativos Microsoft Store relacionados ===')
Get-AppxPackage |
  Where-Object { $_.Name -match $patterns -or $_.PackageFullName -match $patterns } |
  Sort-Object Name -Unique |
  ForEach-Object { $lines.Add("$($_.Name) | versao $($_.Version) | $($_.InstallLocation)") }

$lines.Add('')
$lines.Add('=== Placa-mae ===')
Get-CimInstance Win32_BaseBoard |
  ForEach-Object { $lines.Add("$($_.Manufacturer) | $($_.Product)") }

$lines.Add('')
$lines.Add('=== Memorias fisicas ===')
Get-CimInstance Win32_PhysicalMemory |
  ForEach-Object {
    $capacityGb = [math]::Round($_.Capacity / 1GB, 0)
    $partNumber = if ($_.PartNumber) { $_.PartNumber.Trim() } else { '' }
    $lines.Add("$($_.Manufacturer) | $partNumber | ${capacityGb} GB | $($_.Speed) MHz")
  }

$lines.Add('')
$lines.Add('=== Dispositivos RGB, teclado e mouse ===')
Get-PnpDevice -PresentOnly |
  Where-Object {
    $_.FriendlyName -match $patterns -or
    $_.Manufacturer -match $patterns -or
    $_.Class -in @('Keyboard', 'Mouse')
  } |
  Sort-Object Class, FriendlyName -Unique |
  ForEach-Object {
    $hardwareId = ''
    if ($_.InstanceId -match '(VID_[0-9A-F]{4}&PID_[0-9A-F]{4})') {
      $hardwareId = $Matches[1]
    }
    $lines.Add("$($_.Class) | $($_.FriendlyName) | $($_.Manufacturer) | $hardwareId")
  }

$lines.Add('')
$lines.Add('=== Processos relacionados em execucao ===')
Get-Process |
  Where-Object { $_.ProcessName -match $processPatterns } |
  Sort-Object ProcessName -Unique |
  ForEach-Object { $lines.Add("$($_.ProcessName) | $($_.Path)") }

$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllLines($out, [string[]]$lines, $utf8Bom)
Write-Host "Diagnostico salvo em: $out"
Write-Host 'Revise caminhos pessoais antes de compartilhar o arquivo publicamente.'
