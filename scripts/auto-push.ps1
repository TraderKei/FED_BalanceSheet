param(
    [int]$QuietSeconds = 10,
    [int]$RetrySeconds = 60,
    [switch]$Once
)

$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$logPath = Join-Path $repo 'auto-push.log'
$branch = 'main'

function Write-Log([string]$message) {
    Add-Content -LiteralPath $logPath -Value ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message) -Encoding UTF8
}

function Invoke-Git([string[]]$gitArgs) {
    $output = & git -C $repo @gitArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ('git {0} failed: {1}' -f ($gitArgs -join ' '), ($output -join ' '))
    }
    return $output
}

function Sync-Repository {
    $currentBranch = (Invoke-Git @('branch', '--show-current') | Select-Object -First 1)
    if ($currentBranch -ne $branch) {
        throw "Current branch is '$currentBranch'; expected '$branch'."
    }

    Invoke-Git @('fetch', 'origin') | Out-Null
    $behind = [int](Invoke-Git @('rev-list', '--count', "HEAD..origin/$branch") | Select-Object -First 1)
    if ($behind -gt 0) {
        throw "origin/$branch is $behind commit(s) ahead. Resolve or pull before automatic push."
    }

    $dirty = @(Invoke-Git @('status', '--porcelain', '--untracked-files=no'))
    if ($dirty.Count -gt 0) {
        Invoke-Git @('add', '-u') | Out-Null
        $staged = @(Invoke-Git @('diff', '--cached', '--name-only'))
        if ($staged.Count -gt 0) {
            $message = 'chore: auto-sync local changes ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
            Invoke-Git @('commit', '-m', $message) | Out-Null
            Write-Log ('Committed: ' + ($staged -join ', '))
        }
    }

    $ahead = [int](Invoke-Git @('rev-list', '--count', "origin/$branch..HEAD") | Select-Object -First 1)
    if ($ahead -gt 0) {
        Invoke-Git @('push', 'origin', "HEAD:$branch") | Out-Null
        Write-Log "Pushed $ahead commit(s) to origin/$branch."
    }
}

if ($Once) {
    try {
        Sync-Repository
        Write-Log 'One-time sync completed.'
        exit 0
    }
    catch {
        Write-Log ('ERROR: ' + $_.Exception.Message)
        Write-Error $_.Exception.Message
        exit 1
    }
}

$watcher = New-Object System.IO.FileSystemWatcher($repo)
$watcher.IncludeSubdirectories = $true
$watcher.InternalBufferSize = 65536
$watcher.EnableRaisingEvents = $true
$lastChange = Get-Date
$nextAttempt = Get-Date
Write-Log 'Auto-push watcher started.'

try {
    while ($true) {
        $change = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::All, 2000)
        if (-not $change.TimedOut) {
            $relativePath = $change.Name -replace '/', '\'
            if ($relativePath -notmatch '^(\.git)(\\|$)' -and $relativePath -ne 'auto-push.log') {
                $lastChange = Get-Date
            }
        }

        $now = Get-Date
        if ($now -ge $nextAttempt -and ($now - $lastChange).TotalSeconds -ge $QuietSeconds) {
            try {
                Sync-Repository
                $nextAttempt = $now.AddSeconds($RetrySeconds)
            }
            catch {
                Write-Log ('ERROR: ' + $_.Exception.Message)
                $nextAttempt = $now.AddSeconds($RetrySeconds)
            }
        }
    }
}
finally {
    $watcher.Dispose()
}
