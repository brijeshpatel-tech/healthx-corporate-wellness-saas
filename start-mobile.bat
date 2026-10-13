@echo off
title HealthX Mobile (Expo)
cd /d "%~dp0mobile"
if not exist node_modules (
  echo Installing packages, please wait...
  call npm install
)
echo.
echo Starting HealthX mobile app (Expo). Press  w = open in browser,  a = Android emulator.
echo Or scan the QR code with the Expo Go app on your phone.
echo.
call npx expo start
