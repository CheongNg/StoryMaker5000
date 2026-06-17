param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

function Invoke-JsonPost {
  param(
    [string]$Url,
    [object]$Body
  )

  try {
    Invoke-RestMethod `
      -Method Post `
      -Uri $Url `
      -ContentType "application/json" `
      -Body ($Body | ConvertTo-Json -Depth 12)
  } catch {
    $response = $_.Exception.Response

    if (-not $response) {
      throw
    }

    $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
    $content = $reader.ReadToEnd()
    $reader.Close()

    try {
      $content | ConvertFrom-Json
    } catch {
      throw
    }
  }
}

function Write-GatewayResult {
  param(
    [string]$Label,
    [object]$Result
  )

  Write-Host "`n$Label gateway:"

  if ($Result.error) {
    Write-Host ("- Error: {0}" -f $Result.error)
  }

  if ($Result.gateway.provider) {
    Write-Host ("- Provider: {0}" -f $Result.gateway.provider)
  }

  if ($Result.gateway.mode) {
    Write-Host ("- Mode: {0}" -f $Result.gateway.mode)
  }

  if ($Result.gateway.checks) {
    $Result.gateway.checks | ForEach-Object {
      Write-Host ("- {0}: {1} - {2}" -f $_.id, $_.status, $_.detail)
    }
  }
}

Write-Host "Checking StoryMaker5000 API at $BaseUrl"

$health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/health"
Write-Host "`nHealth checks:"
$health.checks | ForEach-Object {
  Write-Host ("- {0}: {1} - {2}" -f $_.label, $_.status, $_.detail)
}

$storyPayload = @{
  story = @{
    title = "API Smoke Test"
    genre = "Adult contemporary drama"
    tone = "Intimate and character driven"
    worldRules = "All characters are adults. Adult explicit content is permitted when established by the scenario."
    summary = "A tiny smoke-test story setup."
  }
  characters = @(
    @{
      id = "character-1"
      name = "Mara"
      role = "Lead"
      personality = "Observant, careful, emotionally honest"
      appearance = "Simple modern clothing"
      goals = "Understand what changed in the room"
      secrets = "She is nervous about being direct"
    }
  )
  recentScenes = @()
  memories = @()
  prompt = "Write a short adult scene where Mara notices an intimate emotional turning point."
}

$story = Invoke-JsonPost -Url "$BaseUrl/api/story/generate" -Body $storyPayload
Write-GatewayResult -Label "Story" -Result $story

if ($story.title) {
  Write-Host ("- Scene title: {0}" -f $story.title)
}

$imagePayload = @{
  prompt = "Cinematic adult story illustration of an adult woman in a quiet room, realizing an intimate emotional turning point, warm natural light."
  referenceImages = @()
}

$image = Invoke-JsonPost -Url "$BaseUrl/api/image/generate" -Body $imagePayload
Write-GatewayResult -Label "Image" -Result $image
Write-Host ("- Image URL/data present: {0}" -f [bool]$image.imageUrl)

Write-Host "`nDone."
