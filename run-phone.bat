@echo off
cd /d D:\StoryMaker5000
echo Starting StoryMaker5000 for phone testing...
echo.
echo Computer URL: http://localhost:3456
echo Phone URL:    http://192.168.68.62:3456
echo.
echo Keep this window open while testing. Press Ctrl+C to stop the server.
echo.
node.exe D:\StoryMaker5000\node_modules\next\dist\bin\next dev --hostname 0.0.0.0 --port 3456
pause
