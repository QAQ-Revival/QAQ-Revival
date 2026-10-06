param([Parameter(Mandatory=$true)][string]$Executable, [Parameter(Mandatory=$true)][string]$Icon)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class RevivalIconResource {
    delegate bool EnumName(IntPtr module, IntPtr type, IntPtr name, IntPtr data);
    delegate bool EnumLang(IntPtr module, IntPtr type, IntPtr name, ushort language, IntPtr data);
    class Entry { public string Name; public ushort Language; }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadLibraryEx(string path, IntPtr file, uint flags);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EnumResourceNames(IntPtr module, IntPtr type, EnumName callback, IntPtr data);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EnumResourceLanguages(IntPtr module, IntPtr type, IntPtr name, EnumLang callback, IntPtr data);
    [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr module);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr BeginUpdateResource(string path, bool deleteAll);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool UpdateResource(IntPtr handle, IntPtr type, IntPtr name, ushort language, byte[] data, uint length);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EndUpdateResource(IntPtr handle, bool discard);
    static List<Entry> Entries(IntPtr module, int type) {
        var entries = new List<Entry>();
        bool result = EnumResourceNames(module, (IntPtr)type, (m,t,n,p) => {
            string name = ((ulong)n.ToInt64() >> 16) == 0 ? "#" + n.ToInt64() : Marshal.PtrToStringUni(n);
            if (!EnumResourceLanguages(m,t,n, (a,b,c,l,d) => { entries.Add(new Entry { Name=name, Language=l }); return true; }, IntPtr.Zero)) throw new Win32Exception();
            return true;
        }, IntPtr.Zero);
        if (!result && Marshal.GetLastWin32Error() != 1813) throw new Win32Exception();
        return entries;
    }
    static void Update(IntPtr handle, int type, string name, ushort language, byte[] data) {
        bool numeric = name.StartsWith("#");
        IntPtr key = numeric ? (IntPtr)Int32.Parse(name.Substring(1)) : Marshal.StringToHGlobalUni(name);
        try {
            if (!UpdateResource(handle, (IntPtr)type, key, language, data, data == null ? 0 : (uint)data.Length)) throw new Win32Exception();
        } finally { if (!numeric) Marshal.FreeHGlobal(key); }
    }
    // RT_GROUP_ICON points to individual RT_ICON images instead of file offsets.
    // https://devblogs.microsoft.com/oldnewthing/20120720-00/?p=7083
    public static int Stamp(string executable, byte[] icon) {
        if (icon.Length < 6 || BitConverter.ToUInt16(icon,0) != 0 || BitConverter.ToUInt16(icon,2) != 1) throw new ArgumentException("Invalid ICO header");
        int count = BitConverter.ToUInt16(icon,4);
        if (count == 0 || icon.Length < 6 + 16 * count) throw new ArgumentException("Invalid ICO directory");
        var group = new byte[6 + 14 * count];
        Buffer.BlockCopy(icon,0,group,0,6);
        var frames = new List<byte[]>();
        for (int i=0; i<count; i++) {
            int entry = 6 + 16 * i;
            uint length = BitConverter.ToUInt32(icon,entry+8), offset = BitConverter.ToUInt32(icon,entry+12);
            if (length == 0 || offset < 6 + 16 * count || (ulong)offset + length > (ulong)icon.Length) throw new ArgumentException("Invalid ICO frame");
            var frame = new byte[(int)length];
            Buffer.BlockCopy(icon,(int)offset,frame,0,(int)length); frames.Add(frame);
            Buffer.BlockCopy(icon,entry,group,6+14*i,12);
            Buffer.BlockCopy(BitConverter.GetBytes((ushort)(i+1)),0,group,6+14*i+12,2);
        }
        var module = LoadLibraryEx(executable,IntPtr.Zero,2);
        if (module == IntPtr.Zero) throw new Win32Exception();
        List<Entry> groups, images;
        try { groups=Entries(module,14); images=Entries(module,3); }
        finally { FreeLibrary(module); }
        if (groups.Count == 0) groups.Add(new Entry { Name="#1", Language=1033 });
        var languages = new HashSet<ushort>();
        foreach (var entry in groups) languages.Add(entry.Language);
        var handle = BeginUpdateResource(executable,false);
        if (handle == IntPtr.Zero) throw new Win32Exception();
        try {
            foreach (var entry in images) Update(handle,3,entry.Name,entry.Language,null);
            foreach (ushort language in languages) for (int i=0; i<count; i++) Update(handle,3,"#"+(i+1),language,frames[i]);
            foreach (var entry in groups) Update(handle,14,entry.Name,entry.Language,group);
        } catch { EndUpdateResource(handle,true); throw; }
        if (!EndUpdateResource(handle,false)) throw new Win32Exception();
        return groups.Count;
    }
}
'@
$groups = [RevivalIconResource]::Stamp((Resolve-Path -LiteralPath $Executable).Path, [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Icon).Path))
Write-Output "Updated $groups executable icon group(s)."
