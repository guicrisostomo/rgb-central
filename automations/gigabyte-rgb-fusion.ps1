param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9_-]+$')][string]$SceneId,
  [Parameter(Mandatory = $true)][ValidatePattern('^#[0-9a-fA-F]{6}$')][string]$Color,
  [Parameter(Mandatory = $true)][ValidateRange(0, 100)][int]$Brightness
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class RgbCentralGigabyte {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X, Y; }

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr handle, out RECT rect);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr handle, int command);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr handle);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr handle, System.Text.StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT point);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
    [DllImport("user32.dll")]
    static extern IntPtr GetDC(IntPtr handle);
    [DllImport("user32.dll")]
    static extern int ReleaseDC(IntPtr handle, IntPtr dc);
    [DllImport("gdi32.dll")]
    static extern uint GetPixel(IntPtr dc, int x, int y);

    public static void ClickRelative(IntPtr handle, double relativeX, double relativeY) {
        RECT rect;
        if (!GetWindowRect(handle, out rect)) throw new InvalidOperationException("Window bounds unavailable.");
        int x = rect.Left + (int)Math.Round((rect.Right - rect.Left) * relativeX);
        int y = rect.Top + (int)Math.Round((rect.Bottom - rect.Top) * relativeY);
        SetCursorPos(x, y);
        mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
        mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
    }

    public static string GetWindowTitle(IntPtr handle) {
        var text = new System.Text.StringBuilder(256);
        GetWindowText(handle, text, text.Capacity);
        return text.ToString();
    }

    // RGB Fusion 3.24 uses a custom-rendered interface with no accessible
    // child controls. Scan a vertical band instead of one exact row because
    // Windows DPI scaling and the title-bar size move the orange header by a
    // few pixels between otherwise identical installations.
    public static int GetOrangeHeaderScore(IntPtr handle) {
        RECT rect;
        if (!GetWindowRect(handle, out rect)) return 0;
        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;
        IntPtr dc = GetDC(IntPtr.Zero);
        if (dc == IntPtr.Zero) return 0;
        int bestRow = 0;
        try {
            int firstY = rect.Top + (int)Math.Round(height * 0.045);
            int lastY = rect.Top + (int)Math.Round(height * 0.110);
            for (int y = firstY; y <= lastY; y += 2) {
                int orangeSamples = 0;
                for (int x = rect.Left + (int)(width * 0.01); x < rect.Left + (int)(width * 0.82); x += 4) {
                    uint color = GetPixel(dc, x, y);
                    int red = (int)(color & 0xff);
                    int green = (int)((color >> 8) & 0xff);
                    int blue = (int)((color >> 16) & 0xff);
                    if (red > 145 && green > 25 && green < 180 && blue < 85 && red > green + 45) {
                        orangeSamples++;
                    }
                }
                if (orangeSamples > bestRow) bestRow = orangeSamples;
            }
        } finally {
            ReleaseDC(IntPtr.Zero, dc);
        }
        return bestRow;
    }
}
'@

function Set-TextField {
  param(
    [IntPtr]$Window,
    [double]$RelativeX,
    [double]$RelativeY,
    [string]$Value
  )
  if ([RgbCentralGigabyte]::GetForegroundWindow() -ne $Window) {
    throw 'O RGB Fusion perdeu o foco; nenhuma alteração foi confirmada.'
  }
  [RgbCentralGigabyte]::ClickRelative($Window, $RelativeX, $RelativeY)
  Start-Sleep -Milliseconds 90
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  [System.Windows.Forms.SendKeys]::SendWait($Value)
  Start-Sleep -Milliseconds 90
}

[void][RgbCentralGigabyte]::SetProcessDPIAware()
$process = Get-Process -Name 'RGBFusion' -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Select-Object -First 1
if (-not $process) {
  throw 'Abra o RGB Fusion na tela da placa-mãe e tente novamente.'
}

$window = [IntPtr]$process.MainWindowHandle
[void][RgbCentralGigabyte]::ShowWindow($window, 9)
[void][RgbCentralGigabyte]::SetForegroundWindow($window)
Start-Sleep -Milliseconds 500
if ([RgbCentralGigabyte]::GetForegroundWindow() -ne $window) {
  throw 'Não foi possível colocar o RGB Fusion em primeiro plano. Restaure a janela e tente novamente.'
}

$rect = [RgbCentralGigabyte+RECT]::new()
if (-not [RgbCentralGigabyte]::GetWindowRect($window, [ref]$rect)) {
  throw 'Não foi possível medir a janela do RGB Fusion.'
}
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
$aspect = $width / [double]$height
if ($width -lt 1000 -or $height -lt 600 -or $aspect -lt 1.55 -or $aspect -gt 1.90) {
  throw 'Maximize o RGB Fusion e mantenha aberta a tela B550M AORUS ELITE.'
}
$windowTitle = [RgbCentralGigabyte]::GetWindowTitle($window)
$orangeHeaderScore = [RgbCentralGigabyte]::GetOrangeHeaderScore($window)
if ($windowTitle -notmatch 'B550M AORUS ELITE|RGB Fusion' -or $orangeHeaderScore -lt 12) {
  throw "O layout conhecido do RGB Fusion 3.24 não foi reconhecido. Nenhum clique foi executado. Janela: '$windowTitle'; faixa laranja: $orangeHeaderScore."
}

$originalCursor = [RgbCentralGigabyte+POINT]::new()
[void][RgbCentralGigabyte]::GetCursorPos([ref]$originalCursor)
try {
  # Seleciona o modo sincronizado mostrado pela interface oficial, de forma
  # que os conectores Digital LED recebam a mesma cor sólida.
  [RgbCentralGigabyte]::ClickRelative($window, 0.082, 0.122)
  Start-Sleep -Milliseconds 350
  if ([RgbCentralGigabyte]::GetForegroundWindow() -ne $window) {
    throw 'O RGB Fusion perdeu o foco antes da edição.'
  }

  $red = [Convert]::ToInt32($Color.Substring(1, 2), 16)
  $green = [Convert]::ToInt32($Color.Substring(3, 2), 16)
  $blue = [Convert]::ToInt32($Color.Substring(5, 2), 16)

  # Campos R, G e B da versão 3.24.1202.1. As coordenadas são relativas à
  # janela validada, e não à posição absoluta do monitor.
  Set-TextField $window 0.750 0.574 ([string]$red)
  Set-TextField $window 0.798 0.574 ([string]$green)
  Set-TextField $window 0.846 0.574 ([string]$blue)

  # Barra de brilho: 72,8% a 95,0% da largura da janela.
  $brightnessX = 0.728 + (0.222 * $Brightness / 100.0)
  [RgbCentralGigabyte]::ClickRelative($window, $brightnessX, 0.714)
  Start-Sleep -Milliseconds 180

  if ([RgbCentralGigabyte]::GetForegroundWindow() -ne $window) {
    throw 'O RGB Fusion perdeu o foco antes de aplicar a alteração.'
  }
  [RgbCentralGigabyte]::ClickRelative($window, 0.776, 0.970)
  Start-Sleep -Milliseconds 300
} finally {
  [void][RgbCentralGigabyte]::SetCursorPos($originalCursor.X, $originalCursor.Y)
}

Write-Output "RGB Fusion: cor $Color e brilho $Brightness% enviados aos conectores sincronizados."
