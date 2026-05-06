@echo off
setlocal enabledelayedexpansion
title KHHH ANTIGRAVITY V3.0 - ELITE CONTROL CENTER
mode con: cols=80 lines=25
color 0B

:MENU
cls
echo =======================================================================
echo           KHHH ANTIGRAVITY V3.0 - TRUNG TAM DIEU KHAN ELITE
echo =======================================================================
echo.
echo    [1] KHOI DONG HE THONG (CHAY NGAM)
echo    [2] DUNG HE THONG (STOP ALL)
echo    [3] XEM NHAT KY HOAT DONG (LOGS)
echo    [4] TAI CAU TRUC DU LIEU (REBUILD SUMMARY)
echo    [5] SAO LUU DU LIEU (BACKUP)
echo    [6] DON DEP HE THONG (CLEANUP)
echo    [7] KIEM TRA TRANG THAI DICH VU
echo    [8] CAI DAT TU KHOI DONG
echo    [0] THOAT
echo.
echo =======================================================================
set /p choice="Nhap lua chon cua ban (0-8): "

if "%choice%"=="1" goto START_APP
if "%choice%"=="2" goto STOP_APP
if "%choice%"=="3" goto VIEW_LOGS
if "%choice%"=="4" goto REBUILD_DATA
if "%choice%"=="5" goto BACKUP
if "%choice%"=="6" goto CLEANUP
if "%choice%"=="7" goto CHECK_STATUS
if "%choice%"=="8" goto SETUP_AUTO
if "%choice%"=="0" exit
goto MENU

:START_APP
echo.
echo [+] Dang khoi dong cac dich vu ngam...
wscript.exe //B "%~dp0START_SERVICE_V3.0.vbs"
echo [OK] He thong dang duoc kich hoat. Vui long cho 5-10 giay.
timeout /t 3 >nul
goto MENU

:STOP_APP
cls
echo =======================================================================
echo           DANG DUNG CAC DICH VU HE THONG (ELITE STOP)
echo =======================================================================
echo.
echo [+] Dang tim va dung Backend (Cổng 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a /T 2>nul
    echo [OK] Da dung Backend (PID: %%a)
)

echo [+] Dang tim va dung Frontend (Cổng 5181)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5181 ^| findstr LISTENING') do (
    taskkill /F /PID %%a /T 2>nul
    echo [OK] Da dung Frontend (PID: %%a)
)

echo [+] Dang don dep cac tien trinh nen (node, python)...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM wscript.exe /T 2>nul

echo.
echo =======================================================================
echo [THANH CONG] He thong da dung hoan toan.
echo =======================================================================
pause
goto MENU

:SETUP_AUTO
echo.
echo [+] Dang thiet lap tu khoi dong...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "KHHH_Antigravity_V3" /t REG_SZ /d "\"%~dp0START_SERVICE_V3.0.vbs\"" /f
echo [OK] He thong se tu dong khoi dong cung Windows.
pause
goto MENU

:CLEANUP
echo.
echo [+] Dang thuc hien don dep Elite...
cd /d "%~dp0"
if exist SETUP_AUTOSTART_V2.bat del SETUP_AUTOSTART_V2.bat /q
if exist START_SERVICE_V2.vbs del START_SERVICE_V2.vbs /q
if exist STOP_APP_V2.bat del STOP_APP_V2.bat /q
if exist Rules\NK_PHAT_TRIEN_V2.md del Rules\NK_PHAT_TRIEN_V2.md /q
if exist *.log del *.log /q
echo [OK] Da don dep cac file rac va phien ban cu.
pause
goto MENU

:VIEW_LOGS
cls
echo =======================================================================
echo           XEM NHAT KY HOAT DONG (ELITE LOGS)
echo =======================================================================
echo.
echo    [1] Backend Log (FastAPI)
echo    [2] Frontend Log (Vite)
echo    [3] Bot Scheduler Log
echo    [4] Startup Sync Log
echo    [0] Quay lai
echo.
set /p log_choice="Chon log can xem: "
if "%log_choice%"=="1" start notepad "%~dp0data\logs\backend_runtime.log"
if "%log_choice%"=="2" start notepad "%~dp0data\logs\frontend_runtime.log"
if "%log_choice%"=="3" start notepad "%~dp0data\logs\bot_scheduler.log"
if "%log_choice%"=="4" start notepad "%~dp0data\logs\startup_sync.log"
goto MENU

:REBUILD_DATA
echo.
echo [+] Dang thuc hien tai cau truc du lieu summary...
echo [!] Canh bao: Qua trinh nay co the mat 1-3 phut tuy vao khoi luong data.
python "%~dp0scratch\full_rebuild_enhanced.py"
echo [OK] Da cap nhat lai toan bo du lieu Summary.
pause
goto MENU

:BACKUP
echo.
echo [+] Dang sao luu du lieu master...
set timestamp=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%
set timestamp=%timestamp: =0%
if not exist "backups" mkdir "backups"
copy "data\database\khhh_v3.db" "backups\khhh_v3_backup_%timestamp%.db"
echo [OK] Da sao luu tai backups\khhh_v3_backup_%timestamp%.db
pause
goto MENU

:CHECK_STATUS
echo.
echo =====================================
echo    TRANG THAI CAC CONG (PORTS)
echo =====================================
netstat -ano | findstr :8000 && echo [8000] BACKEND API - ONLINE || echo [8000] BACKEND API - OFFLINE
netstat -ano | findstr :5181 && echo [5181] FRONTEND UI - ONLINE || echo [5181] FRONTEND UI - OFFLINE
tasklist /FI "IMAGENAME eq python.exe" /V | findstr "bot_scheduler.py" >nul && (
    for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq python.exe" /V ^| findstr "bot_scheduler.py"') do set bot_pid=%%i
    echo [BOT] ELITE SCHEDULER - RUNNING (PID: !bot_pid!)
) || echo [BOT] ELITE SCHEDULER - STOPPED
echo =====================================
pause
goto MENU
