$ErrorActionPreference = 'Stop'

if (-not ('QaqmKeySender' -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class QaqmKeySender {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
}

$VK_F10 = 0x79
$KEYEVENTF_KEYUP = 0x0002

[QaqmKeySender]::keybd_event([byte]$VK_F10, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 50
[QaqmKeySender]::keybd_event([byte]$VK_F10, 0, [uint32]$KEYEVENTF_KEYUP, [UIntPtr]::Zero)
