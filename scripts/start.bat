@echo off
REM ===========================================================================
REM  start.bat  —  aiqtrader-next-js report viewer (dev server)
REM
REM  Runs on port 3001 so it can coexist with trading-ui (Module 4) on 3000.
REM  Foreground dev server (next dev): edits are picked up live via HMR, so you
REM  don't need to restart for a code change. Press Ctrl+C to stop, or run
REM  scripts\stop.bat from another shell. Launch detached to keep it running:
REM      start "" /min cmd /c "%~dp0start.bat"
REM ===========================================================================
echo [START] aiqtrader-next-js report viewer
cd /d "%~dp0.."

echo.
echo Viewer starting at http://localhost:3001
echo (predev runs sync-reports.mjs to mirror data\reports -^> public\reports)
echo Press Ctrl+C to stop.
echo.
npm run dev -- -p 3001
