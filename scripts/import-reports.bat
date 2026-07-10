@echo off
REM ===========================================================================
REM  import-reports.bat  —  local dev helper (Windows)
REM
REM  Mirrors the engine's report output into the aiqtrader-next-js app:
REM      C:\mythigs\moduler-based-trading-system\reports   (SOURCE, authored)
REM                     |
REM                     v
REM      aiqtrader-next-js\data\reports                    (app source of truth, committed)
REM                     |  node scripts\sync-reports.mjs
REM                     v
REM      aiqtrader-next-js\public\reports  +  src\lib\reports-manifest.ts
REM
REM  Run this, review `git status`, then commit + push data\reports (and
REM  public\reports / reports-manifest.ts) from your GitHub checkout.
REM ===========================================================================
setlocal

set "SRC=C:\mythigs\moduler-based-trading-system\reports"

REM App root = the folder above this script (scripts\..).
pushd "%~dp0.."
set "APP=%CD%"
set "DEST=%APP%\data\reports"

if not exist "%SRC%" (
    echo [import-reports] SOURCE NOT FOUND: %SRC%
    popd & exit /b 1
)

echo [import-reports] Mirroring reports...
echo   from: %SRC%
echo   to:   %DEST%
robocopy "%SRC%" "%DEST%" /MIR /NFL /NDL /NP
REM robocopy exit codes 0-7 are success; >=8 is a real error.
if %ERRORLEVEL% GEQ 8 (
    echo [import-reports] robocopy FAILED (code %ERRORLEVEL%)
    popd & exit /b %ERRORLEVEL%
)

echo.
echo [import-reports] Syncing public\reports + manifest...
cd /d "%APP%"
node scripts\sync-reports.mjs
if errorlevel 1 (
    echo [import-reports] sync-reports.mjs FAILED
    popd & exit /b 1
)

echo.
echo [import-reports] Done. Now review and push:
echo     git -C "%APP%" status --short
echo     git add data/reports public/reports src/lib/reports-manifest.ts
echo     git commit -m "Update reports"
echo     git push
popd
endlocal
