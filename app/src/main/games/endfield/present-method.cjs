const path = require('node:path');
const childProcess = require('node:child_process');

// Read-only: the driver setting decides whether a D3D12 device exists for the Vulkan path to run Mods on.
// QAQR never writes it. 0 prefers native, 1 prefers layering on a DXGI swap chain, 2 and unset leave it to the driver.
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$adapters = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name })
$gpu = $adapters | Where-Object { $_ -match 'NVIDIA' } | Select-Object -First 1
if (-not $gpu) { @{ vendor = 'other'; gpu = ($adapters -join ', ') } | ConvertTo-Json -Compress; exit 0 }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class QaqrNvidiaPresent {
  [DllImport("nvapi64.dll", EntryPoint = "nvapi_QueryInterface", CallingConvention = CallingConvention.Cdecl)] static extern IntPtr Query(uint id);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int Init();
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int Create(out IntPtr session);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int Session(IntPtr session);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int Global(IntPtr session, out IntPtr profile);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int Setting(IntPtr session, IntPtr profile, uint id, IntPtr setting);
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int Find(IntPtr session, [MarshalAs(UnmanagedType.LPWStr)] string name, out IntPtr profile, IntPtr application);
  static T Get<T>(uint id) { return Marshal.GetDelegateForFunctionPointer<T>(Query(id)); }
  static int? Value(IntPtr session, IntPtr profile) {
    const int Size = 12320;
    IntPtr setting = Marshal.AllocHGlobal(Size);
    try {
      for (int i = 0; i < Size; i++) Marshal.WriteByte(setting, i, 0);
      Marshal.WriteInt32(setting, 0, Size | (1 << 16));
      if (Get<Setting>(0x73BF8338)(session, profile, 0x20D690F8, setting) != 0) return null;
      return Marshal.ReadInt32(setting, 8220);
    } finally { Marshal.FreeHGlobal(setting); }
  }
  public static string Read(string executable) {
    if (Get<Init>(0x0150E828)() != 0) throw new Exception("NVAPI");
    IntPtr session;
    if (Get<Create>(0x0694D52E)(out session) != 0) throw new Exception("session");
    try {
      if (Get<Session>(0x375DBD6B)(session) != 0) throw new Exception("settings");
      int? value = null;
      const int ApplicationSize = 20492;
      IntPtr application = Marshal.AllocHGlobal(ApplicationSize);
      try {
        for (int i = 0; i < ApplicationSize; i++) Marshal.WriteByte(application, i, 0);
        Marshal.WriteInt32(application, 0, ApplicationSize | (4 << 16));
        IntPtr profile;
        if (Get<Find>(0xEEE566B2)(session, executable, out profile, application) == 0) value = Value(session, profile);
      } finally { Marshal.FreeHGlobal(application); }
      if (value == null) {
        IntPtr global;
        if (Get<Global>(0x617BFF9F)(session, out global) == 0) value = Value(session, global);
      }
      return value == null ? "null" : value.ToString();
    } finally { Get<Session>(0xDAD9CFF8)(session); }
  }
}
'@
$value = [QaqrNvidiaPresent]::Read('Endfield.exe')
"{""vendor"":""nvidia"",""gpu"":$($gpu | ConvertTo-Json -Compress),""value"":$value}"
`;

function readPresentMethod() {
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  return new Promise(resolve => childProcess.execFile(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')], {
    windowsHide: true,
    timeout: 20000,
    maxBuffer: 1024 * 1024
  }, (error, stdout) => {
    try {
      if (error) throw error;
      resolve(JSON.parse(String(stdout).trim()));
    } catch {
      resolve({ vendor: 'unknown' });
    }
  }));
}
module.exports = {
  readPresentMethod
};
