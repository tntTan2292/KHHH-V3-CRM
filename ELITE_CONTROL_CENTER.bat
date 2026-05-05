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
echo    [3] CAI DAT TU KHOI DONG CUNG WINDOWS
echo    [4] DON DEP HE THONG (CLEANUP)
echo    [5] SAO LUU DU LIEU (BACKUP)
echo    [6] KIEM TRA TRANG THAI DICH VU
echo    [0] THOAT
echo.
echo =======================================================================
set /p choice="Nhap lua chon cua ban (0-6): "

if "%choice%"=="1" goto START_APP
if "%choice%"=="2" goto STOP_APP
if "%choice%"=="3" goto SETUP_AUTO
if "%choice%"=="4" goto CLEANUP
if "%choice%"=="5" goto BACKUP
if "%choice%"=="6" goto CHECK_STATUS
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

:BACKUP
echo.
echo [+] Dang sao luu du lieu master...
set timestamp=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%
set timestamp=%timestamp: =0%
if not exist "BACKUPS" mkdir "BACKUPS"
copy "DATA_MASTER\khhh.db" "BACKUPS\khhh_backup_%timestamp%.db"
echo [OK] Da sao luu tai BACKUPS\khhh_backup_%timestamp%.db
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
