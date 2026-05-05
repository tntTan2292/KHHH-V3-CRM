@echo off
setlocal
echo ===================================================
echo CAI DAT TU DONG KHOI DONG - BAN NANG CAP 3.0
echo ===================================================

set "SCRIPT_PATH=%~dp0START_SERVICE_V3.0.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo [1] Dang kiem tra file START_SERVICE_V3.0.vbs...
if not exist "%SCRIPT_PATH%" (
    echo [!] LOI: Khong tim thay file %SCRIPT_PATH%
    pause
    exit /b
)

echo [2] Dang tao shortcut trong thu muc Startup...
copy /y "%SCRIPT_PATH%" "%STARTUP_FOLDER%\START_V3_AUTO.vbs"

if %errorlevel% equ 0 (
    echo ---------------------------------------------------
    echo CHUC MUNG! V3.0 DA DUOC CAI DAT TU DONG THANH CONG.
    echo He thong se tu dong khoi dong cung Windows.
    echo ---------------------------------------------------
) else (
    echo [!] LOI: Khong the copy file vao thu muc Startup.
)

pause
