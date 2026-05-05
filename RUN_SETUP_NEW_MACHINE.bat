@echo off
title 🚀 ANTIGRAVITY - NEW MACHINE SETUP
echo ==========================================
echo    CHAO MUNG SEP DEN VOI MAY TINH MOI
echo ==========================================
echo.
echo Dang kiem tra moi truong...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] LOI: Python chua duoc cai dat. Sep vui long cai Python truoc.
    pause
    exit
)

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] LOI: Node.js chua duoc cai dat. Sep vui long cai Node.js truoc.
    pause
    exit
)

echo [1/3] Dang cai dat thu vien Backend (Python)...
cd backend
pip install -r requirements.txt
cd ..

echo [2/3] Dang cai dat thu vien Frontend (Node.js)...
npm install

echo [3/3] Dang kiem tra ket noi Database...
python -c "import sqlite3; conn = sqlite3.connect(r'd:\Antigravity - Project\DATA_MASTER\khhh.db'); print('Ket noi CSDL: OK'); conn.close()"

echo.
echo ==========================================
echo ✅ SETUP HOAN TAT! PHAO DAI CRM DA SAN SANG.
echo Sep co the chay RUN_APP.bat de bat dau.
echo ==========================================
pause
