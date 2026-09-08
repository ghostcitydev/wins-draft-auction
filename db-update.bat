@echo off
setlocal

rem Double-click this after pulling a change that adds/edits the database
rem schema: pushes the latest schema (src/db/schema.ts) to your Postgres
rem database, then reseeds reference/seed data (teams, draft picks, nfelo
rem ratings, bets, etc.) from prisma/seed-data/*.json.

cd /d "%~dp0"

echo ==============================================
echo  Wins Draft - database push + seed
echo ==============================================
echo.

echo [1/2] npm run db:push
call npm run db:push
if errorlevel 1 (
  echo.
  echo db:push failed - stopping before seeding. Scroll up for the error.
  pause
  exit /b 1
)

echo.
echo [2/2] npm run db:seed
call npm run db:seed
if errorlevel 1 (
  echo.
  echo db:seed failed. Scroll up for the error.
  pause
  exit /b 1
)

echo.
echo Done - database schema and seed data are up to date.
pause
