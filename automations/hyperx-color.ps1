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

$desktop = [System.Windows.Automation.AutomationElement]::RootElement
$window = Find-One $desktop ([System.Windows.Automation.AutomationElement]::NameProperty) 'HyperX NGENUITY'
if (-not $window) { throw 'Abra o HyperX NGENUITY e tente novamente.' }

$windowPattern = $null
if ($window.TryGetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern, [ref]$windowPattern)) {
  $windowPattern.SetWindowVisualState([System.Windows.Automation.WindowVisualState]::Normal)
}

$lightsTab = Find-One $window ([System.Windows.Automation.AutomationElement]::AutomationIdProperty) 'tabLights'
if (-not (Invoke-Element $lightsTab)) { throw 'A aba Lights do NGENUITY não pôde ser selecionada.' }
Start-Sleep -Milliseconds 250

$solidText = Find-One $window ([System.Windows.Automation.AutomationElement]::AutomationIdProperty) 'txtSolid'
if (-not $solidText) { throw 'O efeito Solid não foi encontrado no NGENUITY.' }
$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$solidItem = $solidText
while ($solidItem -and $solidItem.Current.ControlType -ne [System.Windows.Automation.ControlType]::ListItem) {
  $solidItem = $walker.GetParent($solidItem)
}
if (-not (Invoke-Element $solidItem)) { throw 'O efeito Solid não pôde ser ativado.' }
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
$sliderCondition = [System.Windows.Automation.PropertyCondition]::new(
  [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
  [System.Windows.Automation.ControlType]::Slider
)
foreach ($slider in $desktop.FindAll([System.Windows.Automation.TreeScope]::Descendants, $sliderCondition)) {
  $slidersBefore[($slider.GetRuntimeId() -join '.')] = $true
}

$brightnessButton = Find-One $window ([System.Windows.Automation.AutomationElement]::AutomationIdProperty) 'cmdBrightness'
if (-not (Invoke-Element $brightnessButton)) { throw 'O controle de brilho do NGENUITY não pôde ser aberto.' }
Start-Sleep -Milliseconds 250

$brightnessSlider = $null
foreach ($slider in $desktop.FindAll([System.Windows.Automation.TreeScope]::Descendants, $sliderCondition)) {
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
