param(
    [Parameter(Mandatory=$true)][string]$Executable,
    [ValidateSet('requireAdministrator', 'asInvoker')][string]$ExecutionLevel = 'requireAdministrator',
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies 'System.Xml.dll','System.dll','System.Core.dll' -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Xml;
public static class RevivalManifestResource {
    public class Manifest { public ushort Language; public string Xml; public string Level; }
    delegate bool EnumLang(IntPtr module, IntPtr type, IntPtr name, ushort language, IntPtr data);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadLibraryEx(string path, IntPtr file, uint flags);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EnumResourceLanguages(IntPtr module, IntPtr type, IntPtr name, EnumLang callback, IntPtr param);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr FindResourceEx(IntPtr module, IntPtr type, IntPtr name, ushort language);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint SizeofResource(IntPtr module, IntPtr resource);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr LoadResource(IntPtr module, IntPtr resource);
    [DllImport("kernel32.dll")] static extern IntPtr LockResource(IntPtr resource);
    [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr module);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr BeginUpdateResource(string path, bool deleteAll);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool UpdateResource(IntPtr handle, IntPtr type, IntPtr name, ushort language, byte[] data, uint length);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EndUpdateResource(IntPtr handle, bool discard);
    static XmlDocument Parse(string xml) {
        var document = new XmlDocument { PreserveWhitespace = true, XmlResolver = null };
        document.LoadXml(xml);
        return document;
    }
    static XmlElement ExecutionNode(XmlDocument document) {
        var nodes = document.SelectNodes("//*[local-name()='requestedExecutionLevel' and namespace-uri()='urn:schemas-microsoft-com:asm.v3']");
        if (nodes.Count != 1) throw new InvalidDataException("Expected one requestedExecutionLevel in the embedded manifest");
        return (XmlElement)nodes[0];
    }
    public static Manifest[] Read(string executable) {
        var module = LoadLibraryEx(executable, IntPtr.Zero, 2);
        if (module == IntPtr.Zero) throw new Win32Exception();
        try {
            var languages = new List<ushort>();
            if (!EnumResourceLanguages(module, (IntPtr)24, (IntPtr)1, (m,t,n,l,p) => { languages.Add(l); return true; }, IntPtr.Zero)) throw new Win32Exception();
            var result = new List<Manifest>();
            foreach (var language in languages) {
                var resource = FindResourceEx(module, (IntPtr)24, (IntPtr)1, language);
                if (resource == IntPtr.Zero) throw new Win32Exception();
                var size = SizeofResource(module, resource);
                var loaded = LoadResource(module, resource);
                var memory = LockResource(loaded);
                if (size == 0 || memory == IntPtr.Zero) throw new Win32Exception();
                var data = new byte[size]; Marshal.Copy(memory, data, 0, (int)size);
                string xml;
                using (var reader = new StreamReader(new MemoryStream(data), Encoding.UTF8, true)) xml = reader.ReadToEnd().TrimEnd('\0');
                var doc = Parse(xml);
                result.Add(new Manifest { Language = language, Xml = doc.OuterXml, Level = ExecutionNode(doc).GetAttribute("level") });
            }
            return result.ToArray();
        } finally { FreeLibrary(module); }
    }
    public static void Stamp(string executable, string level) {
        // Preserve compatibility/DPI declarations, icon, version and all other resources.
        var manifests = Read(executable);
        var handle = BeginUpdateResource(executable, false);
        if (handle == IntPtr.Zero) throw new Win32Exception();
        try {
            foreach (var manifest in manifests) {
                var doc = Parse(manifest.Xml);
                ExecutionNode(doc).SetAttribute("level", level);
                var data = new UTF8Encoding(false).GetBytes(doc.OuterXml);
                if (!UpdateResource(handle, (IntPtr)24, (IntPtr)1, manifest.Language, data, (uint)data.Length)) throw new Win32Exception();
            }
        } catch { EndUpdateResource(handle, true); throw; }
        if (!EndUpdateResource(handle, false)) throw new Win32Exception();
    }
}
'@
$taskExecutable = (Resolve-Path -LiteralPath $Executable).Path
if (-not $CheckOnly) { [RevivalManifestResource]::Stamp($taskExecutable, $ExecutionLevel) }
$manifests = @([RevivalManifestResource]::Read($taskExecutable))
if ($manifests.Count -eq 0 -or @($manifests | Where-Object { $_.Level -ne $ExecutionLevel }).Count -ne 0) { throw "Executable does not request $ExecutionLevel" }
ConvertTo-Json -InputObject $manifests -Depth 3 -Compress
