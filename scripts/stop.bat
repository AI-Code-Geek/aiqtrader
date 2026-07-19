@echo off
REM ===========================================================================
REM  stop.bat  —  stop the aiqtrader-next-js report viewer (port 3001)
REM
REM  Pass "nopause" to skip the trailing pause (e.g. when called from another
REM  script or launched detached):  scripts\stop.bat nopause
REM ===========================================================================
echo [STOP] Killing process on port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Done.
if /i "%~1"=="nopause" goto :eof
pause
