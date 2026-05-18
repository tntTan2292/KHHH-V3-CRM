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

echo [2] Kiem tra va Khoi dong Backend API (Port 8000)...
:: Kiem tra xem Backend da song va khoe manh san chua de tranh kill nham
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 3; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Backend API dang hoat dong tot tren Port 8000. Bo qua buoc khoi dong lai.
    set BACKEND_READY=1
    goto BACKEND_OK
)

:: Neu chua khoe manh, kiem tra va don dep dung tien trinh dang chiem dung cong 8000
echo [+] Dang quet va giai phong Port 8000 an toan...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port=8000; $conns=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if ($conns) { $pid = $conns.OwningProcess | Select-Object -Unique; $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue; if ($proc) { if ($proc.Name -ne 'python' -and $proc.Name -ne 'py') { echo 'Phat hien tien trinh la chiem dung cong 8000: ' + $proc.Name; Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 } else { echo 'Phat hien tien trinh Python cu tren cong 8000 nhung khong phan hoi (zombie). Dang don dep...'; Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 } } }"

:: Viet log khoi dong vao backend_runtime.log de theo doi
if not exist "data\logs" mkdir "data\logs"
echo [%DATE% %TIME%] Starting Backend Service via RUN_APP.bat... >> "data\logs\backend_runtime.log"

echo [+] Dang bat Backend API V3.0...
start "KHHH_BACKEND_3.0" /MIN /D "%~dp0backend" "%PY_PATH%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000

echo [2.1] Cho Backend san sang...
set BACKEND_READY=0
for /l %%i in (1,1,20) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 5; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
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
    echo [%DATE% %TIME%] Starting Frontend Service via RUN_APP.bat... >> "data\logs\frontend_runtime.log"
    start "KHHH_FRONTEND_3.0" /MIN /D "%~dp0" cmd /c "%NPM_PATH%" run dev -- --port 5181 --host
)

timeout /t 3 /nobreak >nul
start http://localhost:5181

echo [4] Hoan tat khoi dong he thong.
echo ---------------------------------------------------
pause
