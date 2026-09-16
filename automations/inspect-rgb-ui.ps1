param(
  [ValidateRange(1, 10)][int]$MaxDepth = 8,
  [ValidateRange(100, 3000)][int]$MaxElements = 1500
)

$ErrorActionPreference = 'Stop'
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'rgb-central-interface.txt'
$processPattern = 'iCUE|NGenuity|HyperX|Redragon|OemDrv|RGBFusion|GCC|L-Connect'
$windowPattern = 'iCUE|CUE5|NGENUITY|HyperX|Redragon|RGB Fusion|GIGABYTE|L-Connect'

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class RgbCentralWin32 {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")]
    public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern int GetDlgCtrlID(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowEnabled(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
'@

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('RGB Central - inspecao avancada somente de leitura das interfaces')
$lines.Add("Gerado em: $(Get-Date -Format s)")
$lines.Add('Valores de caixas de texto e campos de senha sao ocultados.')
$lines.Add('Nenhum controle e acionado durante esta leitura.')
$lines.Add('')

$targetProcesses = @(
  Get-Process |
    Where-Object { $_.ProcessName -match $processPattern } |
    Sort-Object Id -Unique
)
$targetPids = @($targetProcesses | ForEach-Object { $_.Id })
$rawWalker = [System.Windows.Automation.TreeWalker]::RawViewWalker
$root = [System.Windows.Automation.AutomationElement]::RootElement
$windows = $root.FindAll(
  [System.Windows.Automation.TreeScope]::Children,
  [System.Windows.Automation.Condition]::TrueCondition
)
$count = 0
$visitedWindowPids = [System.Collections.Generic.HashSet[int]]::new()

function Clean-Text {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
  return (($Value -replace '[\r\n|]+', ' ') -replace '\s{2,}', ' ').Trim()
}

function Get-PatternNames {
  param([System.Windows.Automation.AutomationElement]$Element)
  try {
    $names = @(
      $Element.GetSupportedPatterns() |
        ForEach-Object { $_.ProgrammaticName -replace '^.*PatternIdentifiers\.', '' } |
        Sort-Object -Unique
    )
    return ($names -join ',')
  } catch { return '' }
}

function Add-ElementTree {
  param(
    [System.Windows.Automation.AutomationElement]$Element,
    [int]$Depth,
    [string]$Path
  )

  if ($script:count -ge $MaxElements -or $Depth -gt $MaxDepth) { return }
  $script:count++

  try {
    $controlType = $Element.Current.ControlType.ProgrammaticName -replace '^ControlType\.', ''
    $isSensitive = $controlType -eq 'Edit' -or $Element.Current.IsPassword
    $name = if ($isSensitive) { '[oculto]' } else { Clean-Text $Element.Current.Name }
    $automationId = Clean-Text $Element.Current.AutomationId
    $className = Clean-Text $Element.Current.ClassName
    $patterns = Get-PatternNames $Element
    $rectangle = $Element.Current.BoundingRectangle
    $bounds = if ($rectangle.IsEmpty) { '' } else {
      "$([math]::Round($rectangle.X)),$([math]::Round($rectangle.Y)),$([math]::Round($rectangle.Width)),$([math]::Round($rectangle.Height))"
    }
    $indent = '  ' * $Depth
    $lines.Add("$indent[$Path] $controlType | Name=$name | AutomationId=$automationId | Class=$className | Patterns=$patterns | Bounds=$bounds | Enabled=$($Element.Current.IsEnabled) | Offscreen=$($Element.Current.IsOffscreen)")
  } catch { return }

  $child = $rawWalker.GetFirstChild($Element)
  $childIndex = 0
  while ($null -ne $child -and $script:count -lt $MaxElements) {
    Add-ElementTree -Element $child -Depth ($Depth + 1) -Path "$Path.$childIndex"
    $childIndex++
    $child = $rawWalker.GetNextSibling($child)
  }
}

function Add-Win32Tree {
  param(
    [IntPtr]$Handle,
    [int]$Depth,
    [string]$Path
  )

  if ($Depth -gt $MaxDepth -or $Handle -eq [IntPtr]::Zero) { return }
  $child = [RgbCentralWin32]::GetWindow($Handle, 5)
  $index = 0
  while ($child -ne [IntPtr]::Zero -and $index -lt 500) {
    $classBuilder = [System.Text.StringBuilder]::new(256)
    $textBuilder = [System.Text.StringBuilder]::new(512)
    [void][RgbCentralWin32]::GetClassName($child, $classBuilder, $classBuilder.Capacity)
    $className = Clean-Text $classBuilder.ToString()
    if ($className -notmatch '(?i)edit|textbox|richedit') {
      [void][RgbCentralWin32]::GetWindowText($child, $textBuilder, $textBuilder.Capacity)
    }
    $text = Clean-Text $textBuilder.ToString()
    $rect = [RgbCentralWin32+RECT]::new()
    [void][RgbCentralWin32]::GetWindowRect($child, [ref]$rect)
    $bounds = "$($rect.Left),$($rect.Top),$($rect.Right - $rect.Left),$($rect.Bottom - $rect.Top)"
    $controlId = [RgbCentralWin32]::GetDlgCtrlID($child)
    $indent = '  ' * $Depth
    $lines.Add("$indent[$Path.$index] HWND | Text=$text | ControlId=$controlId | Class=$className | Bounds=$bounds | Visible=$([RgbCentralWin32]::IsWindowVisible($child)) | Enabled=$([RgbCentralWin32]::IsWindowEnabled($child))")
    Add-Win32Tree -Handle $child -Depth ($Depth + 1) -Path "$Path.$index"
    $child = [RgbCentralWin32]::GetWindow($child, 2)
    $index++
  }
}

foreach ($window in $windows) {
  try {
    $pidMatches = $targetPids -contains $window.Current.ProcessId
    $nameMatches = $window.Current.Name -match $windowPattern
    if (-not $pidMatches -and -not $nameMatches) { continue }

    [void]$visitedWindowPids.Add($window.Current.ProcessId)
    $processName = ''
    try { $processName = (Get-Process -Id $window.Current.ProcessId).ProcessName } catch {}
    $safeWindowName = Clean-Text $window.Current.Name
    $lines.Add("=== UI Automation: $safeWindowName | Processo: $processName | PID: $($window.Current.ProcessId) ===")
    Add-ElementTree -Element $window -Depth 0 -Path '0'
    $lines.Add('')

    $nativeHandle = [IntPtr]$window.Current.NativeWindowHandle
    if ($nativeHandle -ne [IntPtr]::Zero) {
      $lines.Add("=== Win32: $safeWindowName | Processo: $processName ===")
      Add-Win32Tree -Handle $nativeHandle -Depth 0 -Path 'W'
      $lines.Add('')
    }
  } catch {}
}

foreach ($process in $targetProcesses) {
  if ($visitedWindowPids.Contains($process.Id)) { continue }
  try {
    $condition = [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
      $process.Id
    )
    $elements = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($elements.Count -eq 0) { continue }
    $lines.Add("=== Elementos sem janela principal | Processo: $($process.ProcessName) | PID: $($process.Id) ===")
    $limit = [math]::Min($elements.Count, 250)
    for ($i = 0; $i -lt $limit; $i++) {
      Add-ElementTree -Element $elements.Item($i) -Depth 0 -Path "O.$i"
    }
    $lines.Add('')
  } catch {}
}

if ($count -eq 0) {
  $lines.Add('Nenhuma janela compativel foi encontrada. Abra os aplicativos RGB, entre na tela de iluminacao e execute novamente.')
}
if ($count -ge $MaxElements) {
  $lines.Add('')
  $lines.Add("Limite de $MaxElements elementos atingido. Feche aplicativos que nao deseja inspecionar ou aumente -MaxElements.")
}

$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllLines($out, [string[]]$lines, $utf8Bom)
Write-Host "Inspecao avancada salva em: $out"
Write-Host 'Revise nomes de janelas e perfis antes de compartilhar o arquivo publicamente.'
