# StoryMaker5000 — Claude Code Instructions

## Protected file: app/api/instructions.ts

Do NOT edit `app/api/instructions.ts` during optimization, refactoring, token-budget work, provider changes, or any other general code work.

This file contains the user's hand-crafted story and image generation instruction text. It is user-owned content, not developer code.

Only change `app/api/instructions.ts` when the user explicitly asks to edit that file, or explicitly asks to change the backend story or picture instruction text itself.

## Local test URL

After making any change, restart the server and always provide both URLs so the user can test immediately.

**To restart:** run `restart-servers.bat` (double-click) or call the PowerShell script directly:
```
Start-Process powershell -ArgumentList '-ExecutionPolicy','Bypass','-File','scripts\server\restart-servers.ps1' -WindowStyle Normal
```
Then confirm port 3456 is listening before sharing the URLs.

**Desktop:** http://localhost:3456

**Phone (LAN):** find the current LAN IP with:
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\.254\." -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -ExpandProperty IPAddress
```
Then give the user `http://<IP>:3456`.

## Dev roadmap

See `CODEX_PATHWAY.md` for the full product roadmap and stage definitions.
