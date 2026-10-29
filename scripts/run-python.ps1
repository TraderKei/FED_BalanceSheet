param([ValidateSet('serve','ingest','test')][string]$Mode='serve')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$bundledPython=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (Test-Path -LiteralPath $bundledPython) { $pythonCommand=$bundledPython } else { $pythonCommand=(Get-Command python -ErrorAction Stop).Source }
$env:PYTHONIOENCODING='utf-8'
Push-Location -LiteralPath $projectRoot
try {
    if ($Mode -eq 'serve') { & $pythonCommand (Join-Path $PSScriptRoot 'serve.py') --open }
    elseif ($Mode -eq 'test') { & $pythonCommand -m unittest discover -s tests -p 'test_*.py' }
    else { & $pythonCommand (Join-Path $PSScriptRoot 'ingest.py') }
    if ($LASTEXITCODE -ne 0) { throw "Python exited with code $LASTEXITCODE" }
} finally { Pop-Location }
