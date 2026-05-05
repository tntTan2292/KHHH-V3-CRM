@echo off
echo ===================================================
echo DUNG HE THONG QL KHHH 3.0 - BUU DIEN TP HUE
echo ===================================================

echo [1] Dang dung Backend (Port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [2] Dang dung Frontend (Port 5181)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5181') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [3] Dang dung cac tien trinh Node/Python du thua...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im python.exe >nul 2>&1

echo ---------------------------------------------------
echo He thong da duoc dung hoan toan.
echo ---------------------------------------------------
pause
