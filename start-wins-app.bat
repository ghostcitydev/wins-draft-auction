@echo off
setlocal

rem Double-click this to run the app locally at http://localhost:3000
rem (same database as the deployed site - .env.local was pulled from Vercel,
rem so anything you paste into /admin here shows up on the live site too,
rem and vice versa).

cd /d "%~dp0"

echo ==============================================
echo  Wins Draft - starting local dev server
echo ==============================================
echo.
echo Once it says "Ready", open http://localhost:3000 in your browser.
echo Press Ctrl+C in this window to stop the server.
echo.

call npm run dev

pause
