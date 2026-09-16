param(
  [ValidateRange(1, 8)][int]$MaxDepth = 5,
  [ValidateRange(50, 2000)][int]$MaxElements = 700
)

$ErrorActionPreference = 'Stop'
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'rgb-central-interface.txt'
$processPattern = 'iCUE|NGenuity|HyperX|Redragon|RGBFusion|GCC|L-Connect'
$windowPattern = 'iCUE|NGENUITY|HyperX|Redragon|RGB Fusion|GIGABYTE|L-Connect'

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('RGB Central - inspecao somente de leitura das interfaces')
$lines.Add("Gerado em: $(Get-Date -Format s)")
$lines.Add('Nao inclui valores digitados em caixas de texto.')
$lines.Add('')

$targetPids = @(
  Get-Process |
    Where-Object { $_.ProcessName -match $processPattern } |
    ForEach-Object { $_.Id }
)

$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$root = [System.Windows.Automation.AutomationElement]::RootElement
$windows = $root.FindAll(
  [System.Windows.Automation.TreeScope]::Children,
  [System.Windows.Automation.Condition]::TrueCondition
)
$count = 0

function Add-ElementTree {
  param(
    [System.Windows.Automation.AutomationElement]$Element,
    [int]$Depth
  )

  if ($script:count -ge $MaxElements -or $Depth -gt $MaxDepth) { return }
  $script:count++

  try {
    $name = $Element.Current.Name
    $automationId = $Element.Current.AutomationId
    $className = $Element.Current.ClassName
    $controlType = $Element.Current.ControlType.ProgrammaticName -replace '^ControlType\.', ''
    $enabled = $Element.Current.IsEnabled
    $offscreen = $Element.Current.IsOffscreen
    $indent = '  ' * $Depth
    $lines.Add("$indent$controlType | Name=$name | AutomationId=$automationId | Class=$className | Enabled=$enabled | Offscreen=$offscreen")
  } catch {
    return
  }

  $child = $walker.GetFirstChild($Element)
  while ($null -ne $child -and $script:count -lt $MaxElements) {
    Add-ElementTree -Element $child -Depth ($Depth + 1)
    $child = $walker.GetNextSibling($child)
  }
}

foreach ($window in $windows) {
  try {
    $pidMatches = $targetPids -contains $window.Current.ProcessId
    $nameMatches = $window.Current.Name -match $windowPattern
    if (-not $pidMatches -and -not $nameMatches) { continue }

    $processName = ''
    try { $processName = (Get-Process -Id $window.Current.ProcessId).ProcessName } catch {}
    $lines.Add("=== Janela: $($window.Current.Name) | Processo: $processName | PID: $($window.Current.ProcessId) ===")
    Add-ElementTree -Element $window -Depth 0
    $lines.Add('')
  } catch {}
}

if ($count -eq 0) {
  $lines.Add('Nenhuma janela compativel foi encontrada. Abra os aplicativos RGB e execute novamente.')
}
if ($count -ge $MaxElements) {
  $lines.Add('')
  $lines.Add("Limite de $MaxElements elementos atingido. Aumente -MaxElements se necessario.")
}

$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllLines($out, [string[]]$lines, $utf8Bom)
Write-Host "Inspecao salva em: $out"
Write-Host 'Revise nomes de janelas antes de compartilhar o arquivo publicamente.'
