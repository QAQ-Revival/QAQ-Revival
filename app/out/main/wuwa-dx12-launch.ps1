param([Parameter(Mandatory = $true)][string]$RequestFile)
$ErrorActionPreference = 'Stop'
$request = Get-Content -LiteralPath $RequestFile -Raw -Encoding UTF8 | ConvertFrom-Json
$mutex = New-Object Threading.Mutex($false, 'QAQ.WWMI.DX12.Launch')
$owned = $false
$locked = $false
$started = $false
$failure = $null
function Save-Result($value) {
    $json = $value | ConvertTo-Json -Compress
    [IO.File]::WriteAllText($request.resultFile, $json, (New-Object Text.UTF8Encoding($false)))
}
try {
    try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
    if (-not $owned) { throw 'Another DX12 launch is still in progress.' }
    if (Get-Process -Name 'Client-Win64-Shipping','Wuthering Waves' -ErrorAction SilentlyContinue) { throw 'Wuthering Waves is already running.' }
    $attributes = [IO.File]::GetAttributes($request.engine)
    [IO.File]::SetAttributes($request.engine, $attributes -bor [IO.FileAttributes]::ReadOnly)
    $locked = $true
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = [IO.Path]::Combine($request.gameRoot, 'Wuthering Waves.exe')
    $start.WorkingDirectory = $request.gameRoot
    $start.Arguments = $request.arguments
    [void][Diagnostics.Process]::Start($start)
    $started = $true
    Save-Result @{ success = $true }
    # The game rewrites Engine.ini at startup. Keep it read-only through that phase,
    # then restore its previous attribute, independently of the manager's lifetime.
    $deadline = [DateTime]::UtcNow.AddMinutes(10)
    do {
        $running = @(Get-Process -Name 'Client-Win64-Shipping' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($request.gameRoot + '\', [StringComparison]::OrdinalIgnoreCase) })
        if ($running.Count) { Start-Sleep -Seconds 60; break }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $deadline)
} catch {
    $failure = $_.Exception.Message
} finally {
    if ($locked -and [IO.File]::Exists($request.engine)) {
        $attributes = [IO.File]::GetAttributes($request.engine)
        if ($request.engineReadOnly) { $attributes = $attributes -bor [IO.FileAttributes]::ReadOnly }
        else { $attributes = $attributes -band -bnot [IO.FileAttributes]::ReadOnly }
        [IO.File]::SetAttributes($request.engine, $attributes)
    }
    if ($owned) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
if ($failure) { Save-Result @{ success = $false; error = $failure; started = $started } }
