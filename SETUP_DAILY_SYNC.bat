@echo off
setlocal
echo ===================================================
echo 1: THIET LAP LICH DONG BO DU LIEU TU DONG (07:00 AM)
echo ===================================================

:: Lay duong dan hien tai
set "PROJECT_DIR=%~dp0"
set "SCRIPT_PATH=%PROJECT_DIR%backend\scripts\automate_sync.py"

echo [*] Dang kiem tra quyen Admin...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Da co quyen Admin.
) else (
    echo [!] Vui long chay file .bat nay bang quyen "Run as Administrator" de thiet lap lich.
    pause
    exit /b 1
)

echo [*] Dang tao Task "VnPost_Daily_Sync" chay vao 07:00 hang ngay...
echo [*] Thiet lap Repeat moi 1h trong vong 12h neu loi...

:: Su dung duong dan tuyet doi den Python de dam bao on dinh
set "PYTHON_EXE=C:\Users\Admin\AppData\Local\Programs\Python\Python311\python.exe"

:: Xoa task cu neu co va tao moi voi cau hinh Repeat chuan
schtasks /delete /tn "VnPost_Daily_Sync" /f >nul 2>&1
schtasks /create /tn "VnPost_Daily_Sync" /tr "\"%PYTHON_EXE%\" \"%SCRIPT_PATH%\"" /sc daily /st 07:00 /ri 60 /du 12:00 /f

if %errorLevel% == 0 (
    echo.
    echo ===================================================
    echo [THANH CONG] Da thiet lap lich vao 07:00 AM (Retry moi 1h).
    echo [!] He thong cung se tu check khi sếp chạy START_SERVICE_V3.0.
    echo ===================================================
) else (
    echo.
    echo [LOI] Khong the thiet lap lich. Vui long kiem tra lai.
)

pause
