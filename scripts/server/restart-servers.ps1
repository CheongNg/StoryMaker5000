param(
  [int]$Port = 3456
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$NextBin = Join-Path $RepoRoot "node_modules\next\dist\bin\next"

Set-Location -LiteralPath $RepoRoot

foreach ($serverPort in @(3000, 3456)) {
  $connections = Get-NetTCPConnection `
    -LocalPort $serverPort `
    -State Listen `
    -ErrorAction SilentlyContinue

  foreach ($processId in ($connections | Select-Object -ExpandProperty OwningProcess -Unique)) {
    if ($processId -and $processId -ne $PID) {
      Write-Host "Stopping server on port $serverPort (PID $processId)."
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

$env:NODE_OPTIONS = "--use-system-ca"
$localUrl = "http://localhost:$Port"
$addresses = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notmatch "^127\." -and
    $_.IPAddress -notmatch "^169\.254\." -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Select-Object -ExpandProperty IPAddress

Write-Host ""
Write-Host "StoryMaker5000 server links:"
Write-Host "Computer: $localUrl"

foreach ($address in $addresses) {
  Write-Host "Phone:    http://$address`:$Port"
}

Write-Host ""
Write-Host "Keep this window open while using StoryMaker5000."

node.exe $NextBin dev --hostname 0.0.0.0 --port $Port
