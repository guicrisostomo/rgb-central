param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9_-]+$')][string]$SceneId,
  [Parameter(Mandatory = $true)][ValidatePattern('^#[0-9a-fA-F]{6}$')][string]$Color,
  [Parameter(Mandatory = $true)][ValidateRange(0, 100)][int]$Brightness
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class RgbCentralRedragon {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")]
    static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc callback, IntPtr data);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern int GetDlgCtrlID(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int command);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool SetWindowText(IntPtr hWnd, string text);
    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

    public static IntPtr[] Descendants(IntPtr parent) {
        var result = new List<IntPtr>();
        EnumChildWindows(parent, (handle, data) => { result.Add(handle); return true; }, IntPtr.Zero);
        return result.ToArray();
    }

    public static string ClassName(IntPtr handle) {
        var value = new StringBuilder(256);
        GetClassName(handle, value, value.Capacity);
        return value.ToString();
    }
}
'@

function Get-Rectangle {
  param([IntPtr]$Handle)
  $rect = [RgbCentralRedragon+RECT]::new()
  [void][RgbCentralRedragon]::GetWindowRect($Handle, [ref]$rect)
  return $rect
}

function Invoke-Button {
  param([IntPtr]$Handle)
  [void][RgbCentralRedragon]::SendMessage($Handle, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
}

$process = Get-Process -Name 'OemDrv' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $process -or $process.MainWindowHandle -eq 0) {
  throw 'Abra o software oficial Redragon na tela Lighting e tente novamente.'
}

$window = [IntPtr]$process.MainWindowHandle
[void][RgbCentralRedragon]::ShowWindow($window, 9)
Start-Sleep -Milliseconds 250
$windowRect = Get-Rectangle $window
$windowWidth = $windowRect.Right - $windowRect.Left
$windowHeight = $windowRect.Bottom - $windowRect.Top
if ($windowWidth -lt 600 -or $windowHeight -lt 400) {
  throw 'A janela do Redragon não está em um tamanho reconhecido.'
}

$handles = [RgbCentralRedragon]::Descendants($window)
$buttons = @($handles | Where-Object {
  [RgbCentralRedragon]::ClassName($_) -eq 'Button' -and [RgbCentralRedragon]::IsWindowVisible($_)
})

# A aba Lighting é o quarto botão vertical no lado esquerdo. A identificação
# usa proporções dentro da janela, não coordenadas absolutas da tela.
$lightingButton = $buttons | Where-Object {
  $rect = Get-Rectangle $_
  $centerX = (($rect.Left + $rect.Right) / 2 - $windowRect.Left) / $windowWidth
  $centerY = (($rect.Top + $rect.Bottom) / 2 - $windowRect.Top) / $windowHeight
  $centerX -gt 0.08 -and $centerX -lt 0.18 -and $centerY -gt 0.42 -and $centerY -lt 0.58
} | Sort-Object { (Get-Rectangle $_).Top } | Select-Object -Last 1

if ($lightingButton) {
  Invoke-Button $lightingButton
  Start-Sleep -Milliseconds 350
}

$handles = [RgbCentralRedragon]::Descendants($window)
$red = [Convert]::ToInt32($Color.Substring(1, 2), 16)
$green = [Convert]::ToInt32($Color.Substring(3, 2), 16)
$blue = [Convert]::ToInt32($Color.Substring(5, 2), 16)
$channels = @{ 257 = $red; 258 = $green; 259 = $blue }

foreach ($controlId in $channels.Keys) {
  $field = $handles | Where-Object {
    [RgbCentralRedragon]::GetDlgCtrlID($_) -eq $controlId -and
    [RgbCentralRedragon]::ClassName($_) -match '(?i)edit' -and
    [RgbCentralRedragon]::IsWindowVisible($_)
  } | Select-Object -First 1
  if (-not $field) { throw "Campo RGB $controlId não encontrado. Confirme que a tela Lighting está aberta." }
  if (-not [RgbCentralRedragon]::SetWindowText($field, [string]$channels[$controlId])) {
    throw "Não foi possível preencher o campo RGB $controlId."
  }
}

$slider = $handles | Where-Object {
  if ([RgbCentralRedragon]::ClassName($_) -ne 'AfxWnd90su' -or -not [RgbCentralRedragon]::IsWindowVisible($_)) { return $false }
  $rect = Get-Rectangle $_
  ($rect.Right - $rect.Left) -gt 150 -and ($rect.Bottom - $rect.Top) -le 30
} | Select-Object -First 1

if ($slider) {
  $sliderRect = Get-Rectangle $slider
  $sliderWidth = $sliderRect.Right - $sliderRect.Left
  $sliderHeight = $sliderRect.Bottom - $sliderRect.Top
  $x = [math]::Round(8 + (($sliderWidth - 16) * $Brightness / 100))
  $y = [math]::Max(1, [math]::Round($sliderHeight / 2))
  $packedPoint = (($y -band 0xffff) -shl 16) -bor ($x -band 0xffff)
  [void][RgbCentralRedragon]::SendMessage($slider, 0x0201, [IntPtr]1, [IntPtr]$packedPoint)
  [void][RgbCentralRedragon]::SendMessage($slider, 0x0202, [IntPtr]::Zero, [IntPtr]$packedPoint)
}

$handles = [RgbCentralRedragon]::Descendants($window)
$applyButton = $handles | Where-Object {
  if ([RgbCentralRedragon]::ClassName($_) -ne 'Button' -or -not [RgbCentralRedragon]::IsWindowVisible($_)) { return $false }
  $rect = Get-Rectangle $_
  $centerX = (($rect.Left + $rect.Right) / 2 - $windowRect.Left) / $windowWidth
  $centerY = (($rect.Top + $rect.Bottom) / 2 - $windowRect.Top) / $windowHeight
  $centerX -gt 0.50 -and $centerX -lt 0.59 -and $centerY -gt 0.82
} | Select-Object -First 1

if (-not $applyButton) { throw 'Botão Apply do Redragon não encontrado; nenhuma alteração foi confirmada.' }
Invoke-Button $applyButton
Write-Output "Redragon: cor $Color e brilho $Brightness% aplicados pelo software oficial."
