@echo off
title Running Branch Payflow & WhatsApp Gateway (Tanpa Browser)...
echo ===================================================
echo [1/2] Menjalankan WhatsApp Gateway Backend...
echo ===================================================
cd backend
start /B npm start
cd ..
timeout /t 2 >nul

echo ===================================================
echo [2/2] Menjalankan Vite Development Server...
echo ===================================================
start /B npm run dev
timeout /t 3 >nul

echo ===================================================
echo Sistem berjalan di latar belakang (Tanpa membuka browser).
echo Frontend: http://localhost:5173
echo Backend WA: http://localhost:5000
echo.
echo Tutup jendela cmd ini untuk mematikan server.
echo ===================================================
cmd /k
