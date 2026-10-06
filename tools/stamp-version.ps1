param([Parameter(Mandatory=$true)][string]$Executable, [Parameter(Mandatory=$true)][string]$VersionResource)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class RevivalVersionResource {
    public delegate bool EnumLang(IntPtr module, IntPtr type, IntPtr name, ushort language, IntPtr data);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadLibraryEx(string path, IntPtr file, uint flags);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EnumResourceLanguages(IntPtr module, IntPtr type, IntPtr name, EnumLang callback, IntPtr param);
    [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr module);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr BeginUpdateResource(string path, bool deleteAll);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool UpdateResource(IntPtr handle, IntPtr type, IntPtr name, ushort language, byte[] data, uint length);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EndUpdateResource(IntPtr handle, bool discard);
    public static void Stamp(string executable, byte[] data) {
        var languages = new List<ushort>();
        var module = LoadLibraryEx(executable, IntPtr.Zero, 2);
        if (module == IntPtr.Zero) throw new Win32Exception();
        try { EnumResourceLanguages(module, (IntPtr)16, (IntPtr)1, (m,t,n,l,p) => { languages.Add(l); return true; }, IntPtr.Zero); }
        finally { FreeLibrary(module); }
        if (languages.Count == 0) languages.Add(1033);
        var handle = BeginUpdateResource(executable, false);
        if (handle == IntPtr.Zero) throw new Win32Exception();
        try {
            foreach(var language in languages) if (!UpdateResource(handle, (IntPtr)16, (IntPtr)1, language, data, (uint)data.Length)) throw new Win32Exception();
        } catch { EndUpdateResource(handle, true); throw; }
        if (!EndUpdateResource(handle, false)) throw new Win32Exception();
    }
}
'@
[RevivalVersionResource]::Stamp((Resolve-Path -LiteralPath $Executable).Path, [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $VersionResource).Path))
$versionInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo((Resolve-Path -LiteralPath $Executable).Path)
if ($versionInfo.ProductVersion -ne '1.0.0' -or $versionInfo.ProductName -ne 'QAQ-Revival') { throw 'Executable version verification failed' }
$versionInfo | Select-Object ProductName,ProductVersion,FileVersion,OriginalFilename
