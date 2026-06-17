@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\server\restart-servers.ps1"
pause
