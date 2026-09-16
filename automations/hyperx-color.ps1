param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9_-]+$')][string]$SceneId,
  [Parameter(Mandatory = $true)][ValidatePattern('^#[0-9a-fA-F]{6}$')][string]$Color,
  [Parameter(Mandatory = $true)][ValidateRange(0, 100)][int]$Brightness
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Find-One {
  param(
    [System.Windows.Automation.AutomationElement]$Root,
    [System.Windows.Automation.AutomationProperty]$Property,
    [object]$Value
  )
  $condition = [System.Windows.Automation.PropertyCondition]::new($Property, $Value)
  return $Root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
}

function Invoke-Element {
  param([System.Windows.Automation.AutomationElement]$Element)
  if (-not $Element) { return $false }
  $pattern = $null
  if ($Element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
    $pattern.Invoke()
    return $true
  }
  if ($Element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
    $pattern.Select()
    return $true
  }
  return $false
}

function Find-SolidEffectItem {
  param([System.Windows.Automation.AutomationElement]$Root)

  $effectList = Find-One $Root ([System.Windows.Automation.AutomationElement]::AutomationIdProperty) 'lstLoopedEffects'
  if (-not $effectList) { return $null }

  $itemCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::ListItem
  )
  $textCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Text
  )
  $items = $effectList.FindAll([System.Windows.Automation.TreeScope]::Children, $itemCondition)

  foreach ($item in $items) {
    $idMatch = $item.FindFirst(
      [System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
        'txtSolid'
      )
    )
    if ($idMatch) { return $item }

    foreach ($text in $item.FindAll([System.Windows.Automation.TreeScope]::Descendants, $textCondition)) {
      # Identifica o mesmo efeito nas traducoes mais comuns do NGENUITY.
      # Escapes Unicode mantem o arquivo compativel com Windows PowerShell 5.1.
      if ($text.Current.Name -match '(?i)^(solid|s(o|\u00f3)lida?|static|est(a|\u00e1)tic[oa]|statique|statisch)$') {
        return $item
      }
    }
  }

  # NGENUITY 5.x mantem Solid como o terceiro efeito. Este fallback so e usado
  # dentro da lista oficial quando a traducao instalada ainda nao e conhecida.
  if ($items.Count -ge 3) { return $items.Item(2) }
  return $null
}

function Get-ColorDistance {
  param([string]$First, [string]$Second)
  $r1 = [Convert]::ToInt32($First.Substring(1, 2), 16)
  $g1 = [Convert]::ToInt32($First.Substring(3, 2), 16)
  $b1 = [Convert]::ToInt32($First.Substring(5, 2), 16)
  $r2 = [Convert]::ToInt32($Second.Substring(1, 2), 16)
  $g2 = [Convert]::ToInt32($Second.Substring(3, 2), 16)
  $b2 = [Convert]::ToInt32($Second.Substring(5, 2), 16)
  return [math]::Sqrt([math]::Pow($r1 - $r2, 2) + [math]::Pow($g1 - $g2, 2) + [math]::Pow($b1 - $b2, 2))
}

function Get-ProcessSliders {
  param(
    [int]$ProcessId,
    [System.Windows.Automation.AutomationElement]$MainWindow
  )

  $sliderCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Slider
  )
  $roots = New-Object 'System.Collections.Generic.List[System.Windows.Automation.AutomationElement]'
  $roots.Add($MainWindow)

  # Flyouts do NGENUITY podem aparecer como outra janela do mesmo processo.
  # Pesquisa somente janelas de primeiro nivel desse processo, sem percorrer
  # outros aplicativos do Windows.
  try {
    $processCondition = [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
      $ProcessId
    )
    $processWindows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
      [System.Windows.Automation.TreeScope]::Children,
      $processCondition
    )
    $mainRuntimeId = $MainWindow.GetRuntimeId() -join '.'
    foreach ($processWindow in $processWindows) {
      if (($processWindow.GetRuntimeId() -join '.') -ne $mainRuntimeId) { $roots.Add($processWindow) }
    }
  } catch {
    # A janela principal continua suficiente nas versoes em que o flyout e interno.
  }

  foreach ($root in $roots) {
    try {
      foreach ($slider in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $sliderCondition)) {
        Write-Output $slider
      }
    } catch {
      # Ignora somente uma raiz inacessivel pertencente ao proprio aplicativo.
    }
  }
}

$process = Get-Process -Name 'NGenuity2' -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Select-Object -First 1
if (-not $process) { throw 'Abra o HyperX NGENUITY e tente novamente.' }
$window = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$process.MainWindowHandle)
if (-not $window) { throw 'A janela principal do HyperX NGENUITY nao foi encontrada.' }

$windowPattern = $null
if ($window.TryGetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern, [ref]$windowPattern)) {
  $windowPattern.SetWindowVisualState([System.Windows.Automation.WindowVisualState]::Normal)
}

$lightsTab = Find-One $window ([System.Windows.Automation.AutomationElement]::AutomationIdProperty) 'tabLights'
if (-not (Invoke-Element $lightsTab)) { throw 'A aba Lights do NGENUITY não pôde ser selecionada.' }
Start-Sleep -Milliseconds 250

$solidItem = $null
for ($attempt = 0; $attempt -lt 10 -and -not $solidItem; $attempt++) {
  $solidItem = Find-SolidEffectItem $window
  if (-not $solidItem) { Start-Sleep -Milliseconds 200 }
}
if (-not $solidItem) { throw 'O efeito de cor solida nao foi encontrado no NGENUITY.' }
if (-not (Invoke-Element $solidItem)) { throw 'O efeito de cor solida nao pode ser ativado.' }
Start-Sleep -Milliseconds 250

$selectedColor = $null
if ($Brightness -gt 0) {
  $listCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::ListItem
  )
  $items = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $listCondition)
  $bestItem = $null
  $bestDistance = [double]::MaxValue
  foreach ($item in $items) {
    if ($item.Current.Name -notmatch 'Color Palette Item (#[0-9A-Fa-f]{6})') { continue }
    $candidate = $Matches[1].ToUpperInvariant()
    $distance = Get-ColorDistance $Color $candidate
    if ($distance -lt $bestDistance) {
      $bestDistance = $distance
      $bestItem = $item
      $selectedColor = $candidate
    }
  }
  if (-not $bestItem -or $bestDistance -gt 80) {
    throw "Adicione a cor $Color à paleta do NGENUITY e teste novamente. A cor mais próxima está muito distante."
  }
  if (-not (Invoke-Element $bestItem)) { throw "A cor $selectedColor não pôde ser selecionada no NGENUITY." }
}

$slidersBefore = @{}
foreach ($slider in (Get-ProcessSliders $process.Id $window)) {
  $slidersBefore[($slider.GetRuntimeId() -join '.')] = $true
}

$brightnessButton = Find-One $window ([System.Windows.Automation.AutomationElement]::AutomationIdProperty) 'cmdBrightness'
if (-not (Invoke-Element $brightnessButton)) { throw 'O controle de brilho do NGENUITY não pôde ser aberto.' }
Start-Sleep -Milliseconds 250

$brightnessSlider = $null
foreach ($slider in (Get-ProcessSliders $process.Id $window)) {
  $runtimeId = $slider.GetRuntimeId() -join '.'
  if (-not $slidersBefore.ContainsKey($runtimeId)) { $brightnessSlider = $slider; break }
}
if (-not $brightnessSlider) { throw 'O seletor de brilho aberto pelo NGENUITY não foi encontrado.' }
$rangePattern = $null
if (-not $brightnessSlider.TryGetCurrentPattern([System.Windows.Automation.RangeValuePattern]::Pattern, [ref]$rangePattern)) {
  throw 'O seletor de brilho do NGENUITY não aceita alteração acessível.'
}
$target = $rangePattern.Current.Minimum + (($rangePattern.Current.Maximum - $rangePattern.Current.Minimum) * $Brightness / 100)
$rangePattern.SetValue($target)
$colorMessage = if ($selectedColor) { "cor disponível mais próxima $selectedColor" } else { 'cor atual preservada' }
Write-Output "HyperX: efeito Solid, $colorMessage e brilho $Brightness% aplicados pelo NGENUITY."
