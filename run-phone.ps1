Set-Location -LiteralPath "D:\StoryMaker5000"
Write-Host "Starting StoryMaker5000 on http://0.0.0.0:3456"
Write-Host "Phone URL should be http://192.168.68.62:3456 while this window stays open."
node.exe "D:\StoryMaker5000\node_modules\next\dist\bin\next" dev --hostname 0.0.0.0 --port 3456
