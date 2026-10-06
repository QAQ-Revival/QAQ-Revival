param([string]$RuntimePath)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$runtime = if ($RuntimePath) { [System.IO.Path]::GetFullPath($RuntimePath) } else { Join-Path $taskRoot 'build\QAQ-Revival-local' }
$exe = Join-Path $runtime 'QAQ-Revival.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build first: node tools/build.cjs' }
$profile = Join-Path $env:APPDATA 'QAQ-Revival'
$env:ELECTRON_RUN_AS_NODE = $null
$env:QAQM_USER_DATA = $profile
$taskIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$taskPrincipal = New-Object Security.Principal.WindowsPrincipal($taskIdentity)
if ($taskPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process -FilePath $exe -WorkingDirectory $runtime -WindowStyle Hidden
} else {
    # One normal UAC confirmation for this application session. Children inherit it.
    Start-Process -FilePath $exe -WorkingDirectory $runtime -Verb RunAs -WindowStyle Hidden
}
