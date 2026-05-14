@echo off
setlocal enabledelayedexpansion
echo ===================================================
echo KHOI DONG HE THONG QL KHHH 3.0 - BUU DIEN TP HUE
echo ===================================================

cd /d "%~dp0"

echo [0] Bo qua Backup tu dong (Da chuyen sang che do Thu cong)...
:: python scripts\system_backup.py

echo [1] Kiem tra trang thai dich vu...

set PY_PATH=C:\Users\Admin\AppData\Local\Programs\Python\Python311\python.exe
set NODE_ROOT=D:\Setup\nodejs_portable\node-v22.12.0-win-x64
set PATH=%NODE_ROOT%;%PATH%
set NPM_PATH=%NODE_ROOT%\npm.cmd

echo [1.5] Kiem tra dong bo du lieu (Startup Sync - Background)...
start "" "%PY_PATH%" backend\scripts\check_sync_on_startup.py

echo [2] Khoi dong Backend API (Port 8000)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port=8000; $conns=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if ($conns) { $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } ; Start-Sleep -Seconds 2 }"
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo [OK] Backend API dang chay tren Port 8000.
) else (
    echo [+] Dang bat Backend API V3.0...
    start "KHHH_BACKEND_3.0" /MIN /D "%~dp0backend" "%PY_PATH%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
)

echo [2.1] Cho Backend san sang...
set BACKEND_READY=0
for /l %%i in (1,1,20) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
    if !errorlevel! equ 0 (
        set BACKEND_READY=1
        goto BACKEND_OK
    )
    timeout /t 1 /nobreak >nul
)

:BACKEND_OK
if "%BACKEND_READY%"=="1" (
    echo [OK] Backend API da san sang.
) else (
    echo [LOI] Backend API chua san sang. Dashboard se khong co du lieu neu Port 8000 offline.
    echo      Hay kiem tra cua so KHHH_BACKEND_3.0 hoac chay lai RUN_APP.bat.
)

echo [3] Khoi dong Frontend (Port 5181)...
netstat -ano | findstr :5181 >nul
if %errorlevel% equ 0 (
    echo [!] Canh bao: Port 5181 dang bi chiem dung.
) else (
    start "KHHH_FRONTEND_3.0" /B /D "%~dp0" cmd /c "%NPM_PATH%" run dev -- --port 5181 --host
)

timeout /t 3 /nobreak >nul
start http://localhost:5181

echo [4] Hoan tat khoi dong he thong.
echo ---------------------------------------------------
pause
