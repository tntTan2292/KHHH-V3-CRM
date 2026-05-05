@echo off
setlocal
echo ===================================================
echo CHUONG TRINH SAO LUU DU LIEU THU CONG - V2
echo ===================================================

cd /d "%~dp0"

echo [*] Dang thuc hien Backup... Vui long cho trong giay lat (Co the mat 1-2 phut)...
python scripts\system_backup.py

echo.
if %errorlevel% equ 0 (
    echo [OK] Sao luu thanh cong!
    echo File backup duoc luu tai thu muc BACKUPS.
) else (
    echo [!] LOI: Co su co trong qua trinh sao luu.
)

echo.
pause
exit
