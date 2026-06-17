param(
  [int]$Port = 3456,
  [int]$CodeMinutes = 20
)

$ErrorActionPreference = "Stop"

Set-Location -LiteralPath "D:\StoryMaker5000"

function New-Secret([int]$ByteCount) {
  $bytes = New-Object byte[] $ByteCount
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }

  return [Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")
}

function New-AccessCode {
  $bytes = New-Object byte[] 4
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }

  $number = [BitConverter]::ToUInt32($bytes, 0) % 100000000
  return $number.ToString("00000000")
}

function Get-Sha256Hex([string]$Value) {
  $sha = [System.Security.Cryptography.SHA256]::Create()

  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $hash = $sha.ComputeHash($bytes)
    return -join ($hash | ForEach-Object { $_.ToString("x2") })
  } finally {
    $sha.Dispose()
  }
}

function Stop-StoryMakerProcesses {
  foreach ($serverPort in @(3000, 3456)) {
    $connections = Get-NetTCPConnection `
      -LocalPort $serverPort `
      -State Listen `
      -ErrorAction SilentlyContinue

    foreach ($processId in ($connections | Select-Object -ExpandProperty OwningProcess -Unique)) {
      if ($processId -and $processId -ne $PID) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
      }
    }
  }

  Get-Process cloudflared -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

function Resolve-Cloudflared {
  $installed = Get-Command cloudflared -ErrorAction SilentlyContinue

  if ($installed) {
    return @{
      FilePath = $installed.Source
      Arguments = @("tunnel")
    }
  }

  $cached = Get-ChildItem `
    -Path "$env:LOCALAPPDATA\npm-cache\_npx" `
    -Recurse `
    -Filter "cloudflared.exe" `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if ($cached) {
    return @{
      FilePath = $cached.FullName
      Arguments = @("tunnel")
    }
  }

  return @{
    FilePath = "npx.cmd"
    Arguments = @("--yes", "cloudflared", "tunnel")
  }
}

Stop-StoryMakerProcesses

$env:NODE_OPTIONS = "--use-system-ca"
$env:ACCESS_PASSWORD = New-Secret 32
$accessCode = New-AccessCode
$expiresAt = [DateTimeOffset]::UtcNow.AddMinutes($CodeMinutes).ToUnixTimeMilliseconds()
$accessRecord = @{
  hash = Get-Sha256Hex "storymaker5000-access-otp-v1:$accessCode"
  expiresAt = $expiresAt
}

$accessRecordJson = $accessRecord | ConvertTo-Json -Compress
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path (Get-Location) ".access-otp.json"), $accessRecordJson, $utf8NoBom)

$server = Start-Process `
  -FilePath "node.exe" `
  -ArgumentList @(
    "D:\StoryMaker5000\node_modules\next\dist\bin\next",
    "dev",
    "--hostname",
    "0.0.0.0",
    "--port",
    "$Port"
  ) `
  -WorkingDirectory "D:\StoryMaker5000" `
  -WindowStyle Hidden `
  -PassThru

try {
  $localUrl = "http://localhost:$Port"

  for ($attempt = 1; $attempt -le 45; $attempt++) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri "$localUrl/access" -TimeoutSec 2 | Out-Null
      break
    } catch {
      if ($attempt -eq 45) {
        throw
      }

      Start-Sleep -Seconds 1
    }
  }

  $tunnel = Resolve-Cloudflared

  Write-Host ""
  Write-Host "StoryMaker5000 online access"
  Write-Host "Local server: $localUrl"
  Write-Host "One-time code: $accessCode"
  Write-Host "Code expires in $CodeMinutes minutes and is consumed after first login."
  Write-Host ""
  Write-Host "Starting Cloudflare tunnel. Keep this window open."
  Write-Host ""

  $tunnelLog = Join-Path (Get-Location) "online-tunnel-live.log"
  $liveInfoPath = Join-Path (Get-Location) "online-live-info.json"
  Set-Content -Path $tunnelLog -Value "" -Encoding utf8

  $tunnelProcess = Start-Process `
    -FilePath $tunnel.FilePath `
    -ArgumentList @($tunnel.Arguments + @(
      "--url",
      $localUrl,
      "--logfile",
      $tunnelLog,
      "--loglevel",
      "info",
      "--protocol",
      "quic",
      "--ha-connections",
      "1"
    )) `
    -WorkingDirectory "D:\StoryMaker5000" `
    -WindowStyle Hidden `
    -PassThru

  $publicUrl = ""

  for ($attempt = 1; $attempt -le 60; $attempt++) {
    $log = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue

    if ($log -match "https://[a-z0-9-]+\.trycloudflare\.com") {
      $publicUrl = $Matches[0]
      break
    }

    Start-Sleep -Seconds 1
  }

  $liveInfo = @{
    code = $accessCode
    createdAt = (Get-Date).ToString("s")
    localUrl = $localUrl
    publicUrl = $publicUrl
    serverPid = $server.Id
    tunnelPid = $tunnelProcess.Id
  }

  [System.IO.File]::WriteAllText(
    $liveInfoPath,
    ($liveInfo | ConvertTo-Json),
    $utf8NoBom
  )

  if ($publicUrl) {
    Write-Host "Public URL: $publicUrl/access"
  } else {
    Write-Host "Public URL was not detected yet. Check online-tunnel-live.log."
  }

  Write-Host "One-time code: $accessCode"
  Write-Host ""

  Wait-Process -Id $tunnelProcess.Id
} finally {
  Remove-Item ".access-otp.json" -Force -ErrorAction SilentlyContinue

  if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
  }

  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
}
