@echo off
title HealthX Web - fast mode (localhost:3000)
cd /d "%~dp0web"
if not exist node_modules (
  echo Installing packages, please wait...
  call npm install
)
if not exist .next\BUILD_ID (
  echo Building the app once (takes a few minutes)...
  call npm run build
)
echo.
echo HealthX web app (fast mode)  -  http://localhost:3000
echo   Admin Portal    : /admin-portal     (arjun.nair@healthx.life)
echo   Business Portal : /business-portal  (ananya.iyer@nimbustech.in)
echo   Employee App    : /employee-app     (company code NIMBUS, priya.sharma@nimbustech.in)
echo   Password: Demo@1234   Code: 123456
echo   After code changes, delete the web\.next folder to rebuild.
echo.
start "" http://localhost:3000
call npm run start
