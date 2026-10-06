param(
    [Parameter(Mandatory = $true)]
    [string]$HotkeyBase64
)

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

$KEYEVENTF_KEYUP = 0x0002
$staticVk = @{
    'VK_BACK' = 0x08
    'VK_TAB' = 0x09
    'VK_RETURN' = 0x0D
    'VK_SHIFT' = 0x10
    'VK_CONTROL' = 0x11
    'VK_MENU' = 0x12
    'VK_ESCAPE' = 0x1B
    'VK_SPACE' = 0x20
    'VK_PRIOR' = 0x21
    'VK_NEXT' = 0x22
    'VK_END' = 0x23
    'VK_HOME' = 0x24
    'VK_LEFT' = 0x25
    'VK_UP' = 0x26
    'VK_RIGHT' = 0x27
    'VK_DOWN' = 0x28
    'VK_INSERT' = 0x2D
    'VK_DELETE' = 0x2E
    'VK_LWIN' = 0x5B
    'VK_RWIN' = 0x5C
    'VK_NUMPAD0' = 0x60
    'VK_NUMPAD1' = 0x61
    'VK_NUMPAD2' = 0x62
    'VK_NUMPAD3' = 0x63
    'VK_NUMPAD4' = 0x64
    'VK_NUMPAD5' = 0x65
    'VK_NUMPAD6' = 0x66
    'VK_NUMPAD7' = 0x67
    'VK_NUMPAD8' = 0x68
    'VK_NUMPAD9' = 0x69
    'VK_MULTIPLY' = 0x6A
    'VK_ADD' = 0x6B
    'VK_SUBTRACT' = 0x6D
    'VK_DECIMAL' = 0x6E
    'VK_DIVIDE' = 0x6F
    'VK_LSHIFT' = 0xA0
    'VK_RSHIFT' = 0xA1
    'VK_LCONTROL' = 0xA2
    'VK_RCONTROL' = 0xA3
    'VK_LMENU' = 0xA4
    'VK_RMENU' = 0xA5
    'VK_OEM_1' = 0xBA
    'VK_OEM_PLUS' = 0xBB
    'VK_OEM_COMMA' = 0xBC
    'VK_OEM_MINUS' = 0xBD
    'VK_OEM_PERIOD' = 0xBE
    'VK_OEM_2' = 0xBF
    'VK_OEM_3' = 0xC0
    'VK_OEM_4' = 0xDB
    'VK_OEM_5' = 0xDC
    'VK_OEM_6' = 0xDD
    'VK_OEM_7' = 0xDE
}

function Resolve-Base64UrlString {
    param([string]$Value)

    $normalized = $Value.Replace('-', '+').Replace('_', '/')
    switch ($normalized.Length % 4) {
        0 { }
        2 { $normalized += '==' }
        3 { $normalized += '=' }
        default { throw 'invalid hotkey spec' }
    }
    return $normalized
}

function Resolve-VkCode {
    param([string]$Code)

    $value = ''
    if (-not [string]::IsNullOrWhiteSpace($Code)) {
        $value = $Code.Trim().ToUpperInvariant()
    }
    if (-not $value) {
        throw 'empty vk code'
    }

    if ($staticVk.ContainsKey($value)) {
        return [int]$staticVk[$value]
    }

    if ($value -match '^VK_[A-Z]$') {
        return [int][char]$value.Substring($value.Length - 1, 1)
    }

    if ($value -match '^VK_[0-9]$') {
        return [int][char]$value.Substring($value.Length - 1, 1)
    }

    if ($value -match '^VK_F([1-9]|1\d|2[0-4])$') {
        return 0x6F + [int]$Matches[1]
    }

    if ($value -match '^0X[0-9A-F]+$') {
        return [Convert]::ToInt32($value, 16)
    }

    throw "unsupported vk code: $Code"
}

function Press-Key {
    param([int]$VkCode)
    [QaqmKeySender]::keybd_event([byte]$VkCode, 0, 0, [UIntPtr]::Zero)
}

function Release-Key {
    param([int]$VkCode)
    [QaqmKeySender]::keybd_event([byte]$VkCode, 0, [uint32]$KEYEVENTF_KEYUP, [UIntPtr]::Zero)
}

$normalizedBase64 = Resolve-Base64UrlString -Value $HotkeyBase64
$jsonBytes = [Convert]::FromBase64String($normalizedBase64)
$json = [Text.Encoding]::UTF8.GetString($jsonBytes)
$spec = $json | ConvertFrom-Json
$pressed = @($spec.pressed)

if ($pressed.Count -eq 0) {
    throw 'no pressed keys in hotkey spec'
}

$vkCodes = New-Object System.Collections.Generic.List[int]
foreach ($token in $pressed) {
    if ($token.device -ne 'keyboard') {
        throw 'only keyboard hotkeys are supported by press_hotkey.ps1'
    }
    $vkCodes.Add((Resolve-VkCode -Code ([string]$token.code)))
}

foreach ($vkCode in $vkCodes) {
    Press-Key -VkCode $vkCode
    Start-Sleep -Milliseconds 15
}

Start-Sleep -Milliseconds 60

for ($index = $vkCodes.Count - 1; $index -ge 0; $index--) {
    Release-Key -VkCode $vkCodes[$index]
    Start-Sleep -Milliseconds 15
}
