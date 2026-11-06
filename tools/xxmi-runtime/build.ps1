param([string]$Source, [string]$WorkRoot)
$ErrorActionPreference = 'Stop'
if (!$Source) { $Source = Join-Path $PSScriptRoot '../../native/xxmi-runtime' }
$taskSource = (Resolve-Path -LiteralPath $Source).Path
$taskBuilder = Join-Path $taskSource 'qaqr/build.ps1'
if (!(Test-Path -LiteralPath $taskBuilder)) { throw 'Use the QAQ-Revival/XXMI-Libs-Package fork; runtime patches are no longer applied during builds' }
if (!$WorkRoot) { $WorkRoot = Join-Path $PSScriptRoot '../../build/xxmi-runtime' }
& $taskBuilder -WorkRoot ([IO.Path]::GetFullPath($WorkRoot)) -Test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
