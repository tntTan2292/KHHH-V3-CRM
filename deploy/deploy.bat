@echo off
chcp 65001 >nul
echo ==================================================
echo   KHHH Antigravity V3.0 - Deploy Update
echo ==================================================

:: --- CẤU HÌNH: Điền IP máy server Ubuntu vào đây ---
set SERVER_IP=DIEN_IP_SERVER_VAO_DAY
set SERVER_USER=ubuntu
set DEPLOY_DIR=/home/ubuntu/khhh
:: ---------------------------------------------------

:: Kiểm tra IP đã được điền chưa
if "%SERVER_IP%"=="DIEN_IP_SERVER_VAO_DAY" (
    echo.
    echo  [LỖI] Chưa điền IP server!
    echo  Mở file deploy.bat và sửa dòng:
    echo    set SERVER_IP=DIEN_IP_SERVER_VAO_DAY
    echo  Thành IP thực của máy Ubuntu, ví dụ:
    echo    set SERVER_IP=10.1.45.50
    echo.
    pause
    exit /b 1
)

echo.
echo  Server: %SERVER_USER%@%SERVER_IP%
echo  Thư mục: %DEPLOY_DIR%
echo.

:: Bước 1: Copy code mới sang server (bỏ qua node_modules, data, .env)
echo [1/3] Đang copy code sang server...
scp -r -q ^
    backend ^
    src ^
    public ^
    package.json ^
    vite.config.js ^
    Dockerfile.backend ^
    Dockerfile.frontend ^
    docker-compose.yml ^
    deploy ^
    .env.example ^
    %SERVER_USER%@%SERVER_IP%:%DEPLOY_DIR%/

if %errorlevel% neq 0 (
    echo  [LỖI] Không copy được sang server. Kiểm tra:
    echo    - IP server đúng chưa?
    echo    - Máy server đang bật không?
    echo    - SSH có hoạt động không?
    pause
    exit /b 1
)
echo  Copy xong.

:: Bước 2: Build lại và restart trên server
echo [2/3] Đang build và restart hệ thống trên server...
ssh %SERVER_USER%@%SERVER_IP% "cd %DEPLOY_DIR% && docker compose up -d --build"

if %errorlevel% neq 0 (
    echo  [LỖI] Build thất bại. Xem log bằng lệnh:
    echo    ssh %SERVER_USER%@%SERVER_IP% "cd %DEPLOY_DIR% && docker compose logs --tail=50"
    pause
    exit /b 1
)

:: Bước 3: Kiểm tra trạng thái
echo [3/3] Kiểm tra trạng thái...
ssh %SERVER_USER%@%SERVER_IP% "cd %DEPLOY_DIR% && docker compose ps"

echo.
echo ==================================================
echo   Deploy hoàn tất!
echo   Truy cập: http://%SERVER_IP%
echo ==================================================
pause
