@echo off
setlocal
echo ===================================================
echo TIEN TRINH SAO LUU HE THONG TU DONG (1-CLICK)
echo ===================================================

cd /d "%~dp0"
python scripts\system_backup.py

echo.
echo [!] Backup hoan tat. Bam phim bat ky de thoat.
pause >nul
exit
