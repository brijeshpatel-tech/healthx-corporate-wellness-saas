@echo off
title HealthX Web (localhost:3000)
cd /d "%~dp0web"
if not exist node_modules (
  echo Installing packages, please wait...
  call npm install
)
echo.
echo Starting HealthX web app...  Open http://localhost:3000
echo   Admin Portal    : http://localhost:3000/admin-portal     (arjun.nair@healthx.life)
echo   Business Portal : http://localhost:3000/business-portal  (ananya.iyer@nimbustech.in)
echo   Employee App    : http://localhost:3000/employee-app     (priya.sharma@nimbustech.in)
echo   Password: Demo@1234   Code: 123456   Company code: NIMBUS
echo.
start "" http://localhost:3000
call npm run dev
