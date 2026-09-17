param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9_-]+$')][string]$SceneId,
  [Parameter(Mandatory = $true)][ValidatePattern('^#[0-9a-fA-F]{6}$')][string]$Color,
  [Parameter(Mandatory = $true)][ValidateRange(0, 100)][int]$Brightness
)

$ErrorActionPreference = 'Stop'

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
    public delegate bool EnumWindowsProc(IntPtr handle, IntPtr lParam);
    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr handle);
    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
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

    // RGB Fusion can be hosted by different Gigabyte executables depending on
    // the installed package. Find its visible top-level window by title so the
    // adapter does not depend on one process name or MainWindowHandle access.
    public static IntPtr FindRgbFusionWindow() {
        IntPtr found = IntPtr.Zero;
        IntPtr visualMatch = IntPtr.Zero;
        int visualScore = 0;
        EnumWindows((handle, lParam) => {
            if (found != IntPtr.Zero || !IsWindowVisible(handle)) return true;
            string title = GetWindowTitle(handle);
            if (title.IndexOf("B550M AORUS ELITE", StringComparison.OrdinalIgnoreCase) >= 0 ||
                title.IndexOf("RGB Fusion", StringComparison.OrdinalIgnoreCase) >= 0) {
                found = handle;
                return false;
            }
            // Algumas versões desenham o título dentro da própria interface,
            // deixando o texto Win32 vazio. Nesse caso, use a faixa laranja
            // exclusiva do RGB Fusion como segunda forma de identificação.
            RECT rect;
            if (GetWindowRect(handle, out rect)) {
                int width = rect.Right - rect.Left;
                int height = rect.Bottom - rect.Top;
                double aspect = height == 0 ? 0 : width / (double)height;
                if (width >= 1000 && height >= 600 && aspect >= 1.55 && aspect <= 1.90) {
                    int score = GetOrangeHeaderScore(handle);
                    if (score > visualScore) {
                        visualScore = score;
                        visualMatch = handle;
                    }
                }
            }
            return true;
        }, IntPtr.Zero);
        return found != IntPtr.Zero ? found : (visualScore >= 12 ? visualMatch : IntPtr.Zero);
    }

    public static IntPtr FindWindowForProcessIds(uint[] processIds) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((handle, lParam) => {
            if (!IsWindowVisible(handle)) return true;
            uint processId;
            GetWindowThreadProcessId(handle, out processId);
            bool matches = false;
            foreach (uint candidate in processIds) {
                if (candidate == processId) { matches = true; break; }
            }
            if (!matches) return true;
            RECT rect;
            if (GetWindowRect(handle, out rect)) {
                int width = rect.Right - rect.Left;
                int height = rect.Bottom - rect.Top;
                double aspect = height == 0 ? 0 : width / (double)height;
                if (width >= 800 && height >= 500 && aspect >= 1.35 && aspect <= 2.10) {
                    found = handle;
                    return false;
                }
            }
            return true;
        }, IntPtr.Zero);
        return found;
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

    public static int ReadRelativeRgb(IntPtr handle, double relativeX, double relativeY) {
        RECT rect;
        if (!GetWindowRect(handle, out rect)) return -1;
        int x = rect.Left + (int)Math.Round((rect.Right - rect.Left) * relativeX);
        int y = rect.Top + (int)Math.Round((rect.Bottom - rect.Top) * relativeY);
        IntPtr dc = GetDC(IntPtr.Zero);
        if (dc == IntPtr.Zero) return -1;
        try {
            uint color = GetPixel(dc, x, y);
            int red = (int)(color & 0xff);
            int green = (int)((color >> 8) & 0xff);
            int blue = (int)((color >> 16) & 0xff);
            return (red << 16) | (green << 8) | blue;
        } finally {
            ReleaseDC(IntPtr.Zero, dc);
        }
    }
}
'@

function Write-Stage {
  param([string]$Message)
  [Console]::Error.WriteLine("[etapa] $Message")
}

function Get-ColorSpread {
  param([int]$PackedRgb)
  if ($PackedRgb -lt 0) { return 0 }
  $sampleRed = ($PackedRgb -shr 16) -band 0xff
  $sampleGreen = ($PackedRgb -shr 8) -band 0xff
  $sampleBlue = $PackedRgb -band 0xff
  return [Math]::Max($sampleRed, [Math]::Max($sampleGreen, $sampleBlue)) -
    [Math]::Min($sampleRed, [Math]::Min($sampleGreen, $sampleBlue))
}

function Set-ColorWheel {
  param(
    [IntPtr]$Window,
    [int]$Red,
    [int]$Green,
    [int]$Blue
  )
  if ([RgbCentralGigabyte]::GetForegroundWindow() -ne $Window) {
    throw 'O RGB Fusion perdeu o foco; nenhuma alteração foi confirmada.'
  }

  $redValue = $Red / 255.0
  $greenValue = $Green / 255.0
  $blueValue = $Blue / 255.0
  $maximum = [Math]::Max($redValue, [Math]::Max($greenValue, $blueValue))
  $minimum = [Math]::Min($redValue, [Math]::Min($greenValue, $blueValue))
  $delta = $maximum - $minimum
  $saturation = if ($maximum -eq 0) { 0.0 } else { $delta / $maximum }
  $hue = 0.0
  if ($delta -ne 0) {
    if ($maximum -eq $redValue) {
      $hue = 60.0 * ((($greenValue - $blueValue) / $delta) % 6.0)
    } elseif ($maximum -eq $greenValue) {
      $hue = 60.0 * ((($blueValue - $redValue) / $delta) + 2.0)
    } else {
      $hue = 60.0 * ((($redValue - $greenValue) / $delta) + 4.0)
    }
  }
  if ($hue -lt 0) { $hue += 360.0 }

  # Centro e raio medidos na roda HSV do RGB Fusion 3.24. O raio usa eixos
  # relativos separados para continuar circular em qualquer resolução 16:9.
  $angle = $hue * [Math]::PI / 180.0
  $wheelX = 0.843 + (0.080 * $saturation * [Math]::Cos($angle))
  $wheelY = 0.293 - (0.137 * $saturation * [Math]::Sin($angle))
  [RgbCentralGigabyte]::ClickRelative($Window, $wheelX, $wheelY)
  Start-Sleep -Milliseconds 260
}

[void][RgbCentralGigabyte]::SetProcessDPIAware()
Write-Stage 'procurando a janela do RGB Fusion'
$processIds = @(
  Get-Process -Name 'RGBFusion' -ErrorAction SilentlyContinue |
    ForEach-Object { [uint32]$_.Id }
)
$window = if ($processIds.Count -gt 0) {
  [RgbCentralGigabyte]::FindWindowForProcessIds([uint32[]]$processIds)
} else {
  [IntPtr]::Zero
}
if ($window -ne [IntPtr]::Zero) {
  Write-Stage 'janela encontrada pelo processo RGBFusion'
} else {
  $window = [RgbCentralGigabyte]::FindRgbFusionWindow()
}
if ($window -eq [IntPtr]::Zero) {
  throw 'Não encontrei uma janela visível do RGB Fusion. Abra o RGB Fusion na tela B550M AORUS ELITE e tente novamente.'
}

[void][RgbCentralGigabyte]::ShowWindow($window, 3)
[void][RgbCentralGigabyte]::SetForegroundWindow($window)
Start-Sleep -Milliseconds 800
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
Write-Stage "janela validada: $windowTitle"

# Não clique novamente em SYNC MODE: quando essa tela já está aberta, o clique
# reinicia o carregamento do RGB Fusion. Aguarde a roda de cores ficar visível.
$wheelReady = $false
for ($attempt = 0; $attempt -lt 25; $attempt++) {
  if ([RgbCentralGigabyte]::GetForegroundWindow() -ne $window) {
    throw 'O RGB Fusion perdeu o foco enquanto a tela de iluminação carregava.'
  }
  $redEdge = [RgbCentralGigabyte]::ReadRelativeRgb($window, 0.920, 0.293)
  $blueEdge = [RgbCentralGigabyte]::ReadRelativeRgb($window, 0.803, 0.412)
  if ((Get-ColorSpread $redEdge) -gt 35 -and (Get-ColorSpread $blueEdge) -gt 35) {
    $wheelReady = $true
    break
  }
  Start-Sleep -Milliseconds 200
}
if (-not $wheelReady) {
  throw 'A roda de cores do RGB Fusion não terminou de carregar. Abra SYNC MODE, aguarde a tela estabilizar e tente novamente.'
}
Write-Stage 'roda de cores pronta'

$originalCursor = [RgbCentralGigabyte+POINT]::new()
[void][RgbCentralGigabyte]::GetCursorPos([ref]$originalCursor)
try {
  $red = [Convert]::ToInt32($Color.Substring(1, 2), 16)
  $green = [Convert]::ToInt32($Color.Substring(3, 2), 16)
  $blue = [Convert]::ToInt32($Color.Substring(5, 2), 16)

  # Os campos R/G/B desta versão são renderizados pelo aplicativo e podem
  # ignorar entrada de teclado. A roda HSV é o controle interativo confiável.
  Set-ColorWheel $window $red $green $blue
  Write-Stage 'cor selecionada na roda HSV'

  # Barra de brilho: 72,8% a 95,0% da largura da janela.
  $brightnessX = 0.728 + (0.222 * $Brightness / 100.0)
  [RgbCentralGigabyte]::ClickRelative($window, $brightnessX, 0.714)
  Start-Sleep -Milliseconds 180
  Write-Stage 'brilho ajustado'

  if ([RgbCentralGigabyte]::GetForegroundWindow() -ne $window) {
    throw 'O RGB Fusion perdeu o foco antes de aplicar a alteração.'
  }
  [RgbCentralGigabyte]::ClickRelative($window, 0.776, 0.970)
  Start-Sleep -Milliseconds 450
  Write-Stage 'botão APPLY acionado'

  # A linha do conector LED_C2 reflete a cor sólida aplicada. Conferir esse
  # ponto evita declarar sucesso quando a interface recebeu o foco, mas
  # ignorou a seleção. O modo apagado é isento porque a interface preserva a
  # última cor mesmo com brilho zero.
  if ($Brightness -gt 0 -and ($red -gt 0 -or $green -gt 0 -or $blue -gt 0)) {
    $observed = [RgbCentralGigabyte]::ReadRelativeRgb($window, 0.323, 0.115)
    if ($observed -lt 0) {
      throw 'A cor foi enviada, mas não foi possível verificar o resultado na janela do RGB Fusion.'
    }
    $observedRed = ($observed -shr 16) -band 0xff
    $observedGreen = ($observed -shr 8) -band 0xff
    $observedBlue = $observed -band 0xff
    $difference = [Math]::Max(
      [Math]::Abs($red - $observedRed),
      [Math]::Max([Math]::Abs($green - $observedGreen), [Math]::Abs($blue - $observedBlue))
    )
    if ($difference -gt 70) {
      $observedHex = '#{0:X2}{1:X2}{2:X2}' -f $observedRed, $observedGreen, $observedBlue
      throw "O RGB Fusion abriu, mas não confirmou a nova cor. Esperado: $Color; exibido: $observedHex. Nenhuma confirmação de sucesso foi registrada."
    }
    Write-Stage 'cor confirmada na linha LED_C2'
  }
} finally {
  [void][RgbCentralGigabyte]::SetCursorPos($originalCursor.X, $originalCursor.Y)
}

Write-Output "RGB Fusion: cor $Color e brilho $Brightness% enviados aos conectores sincronizados."
