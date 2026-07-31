@echo off
title Running Branch Payflow & WhatsApp Gateway...
echo ===================================================
echo [1/3] Menjalankan WhatsApp Gateway Backend...
echo ===================================================
cd backend
start /B npm start
cd ..
timeout /t 2 >nul

echo ===================================================
echo [2/3] Menjalankan Vite Development Server...
echo ===================================================
start /B npm run dev
timeout /t 3 >nul

echo ===================================================
echo [3/3] Membuka browser ke http://localhost:5173 ...
echo ===================================================
start http://localhost:5173

echo ===================================================
echo Sistem berjalan di latar belakang.
echo Tutup jendela cmd ini untuk mematikan server.
echo ===================================================
cmd /k
