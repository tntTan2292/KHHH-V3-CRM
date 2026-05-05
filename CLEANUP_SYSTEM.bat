@echo off
echo ===================================================
echo DON DEP HE THONG KHHH 3.0 - ELITE CLEANUP
echo ===================================================
cd /d "%~dp0"

echo [1] Dang xoa cac file Script cu (V1, V2)...
if exist SETUP_AUTOSTART.bat del SETUP_AUTOSTART.bat /q
if exist SETUP_AUTOSTART_V2.bat del SETUP_AUTOSTART_V2.bat /q
if exist START_SERVICE.vbs del START_SERVICE.vbs /q
if exist START_SERVICE_V2.vbs del START_SERVICE_V2.vbs /q
if exist STOP_APP.bat del STOP_APP.bat /q
if exist STOP_APP_V2.bat del STOP_APP_V2.bat /q

echo [2] Dang xoa cac file Log va Rac...
if exist frontend_error.log del frontend_error.log /q
if exist frontend_startup.log del frontend_startup.log /q
if exist reimport_log.txt del reimport_log.txt /q
if exist winscp_stderr.bin del winscp_stderr.bin /q
if exist winscp_stdout.bin del winscp_stdout.bin /q
if exist test_v3.txt del test_v3.txt /q
if exist backend_diagnosis.log del backend_diagnosis.log /q
if exist temp_sftp.txt del temp_sftp.txt /q

echo [3] Dang xoa tai lieu va anh cu...
if exist Rules\NK_PHAT_TRIEN_V2.md del Rules\NK_PHAT_TRIEN_V2.md /q
if exist src\assets\Logo-VietNam-Post.webp del src\assets\Logo-VietNam-Post.webp /q

echo [4] Dang don dep Backend...
if exist backend\data.db del backend\data.db /q
if exist backend\khhh.db del backend\khhh.db /q
if exist backend\sort_results.txt del backend\sort_results.txt /q
if exist backend\sort_results_v2.txt del backend\sort_results_v2.txt /q
if exist backend\sort_results_v3.txt del backend\sort_results_v3.txt /q
if exist backend\test_result.txt del backend\test_result.txt /q

echo ---------------------------------------------------
echo ✅ HE THONG DA DUOC DON DEP GON GANG!
echo ---------------------------------------------------
pause
