#!/bin/bash
# =============================================================
# Script cài đặt lần đầu trên máy Ubuntu server
# Cách dùng: bash install.sh
# =============================================================
set -e

echo "=================================================="
echo "  KHHH Antigravity V3.0 - Cài đặt server"
echo "=================================================="
echo ""

# Hỏi thông tin máy Windows
read -p "  Nhập IP máy Windows của bạn (ví dụ: 10.1.45.24): " WIN_IP
read -p "  Nhập tên user Windows (ví dụ: Admin): " WIN_USER
WIN_PROJECT_DIR="/mnt/c/Users/$WIN_USER"

echo ""
echo "  Sẽ kéo code từ: $WIN_USER@$WIN_IP"
echo ""

# 1. Cài Docker
if ! command -v docker &> /dev/null; then
    echo "[1/6] Đang cài Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "      Docker đã cài xong."
else
    echo "[1/6] Docker đã có sẵn, bỏ qua."
fi

# 2. Cài Docker Compose plugin
if ! docker compose version &> /dev/null; then
    echo "[2/6] Đang cài Docker Compose..."
    sudo apt-get update -qq
    sudo apt-get install -y docker-compose-plugin
    echo "      Docker Compose đã cài xong."
else
    echo "[2/6] Docker Compose đã có sẵn, bỏ qua."
fi

# 3. Tạo thư mục project
echo "[3/6] Tạo thư mục project..."
mkdir -p ~/khhh/data/database
mkdir -p ~/khhh/data/raw_files

# 4. Kéo code từ máy Windows sang
echo "[4/6] Đang kéo code từ máy Windows ($WIN_IP)..."
echo "      (Sẽ hỏi mật khẩu Windows của bạn)"
scp -r \
    $WIN_USER@$WIN_IP:"D:/Antigravity\ -\ Project/KHHH\ -\ Antigravity\ -\ V3.0/backend" \
    $WIN_USER@$WIN_IP:"D:/Antigravity\ -\ Project/KHHH\ -\ Antigravity\ -\ V3.0/src" \
    $WIN_USER@$WIN_IP:"D:/Antigravity\ -\ Project/KHHH\ -\ Antigravity\ -\ V3.0/public" \
    $WIN_USER@$WIN_IP:"D:/Antigravity\ -\ Project/KHHH\ -\ Antigravity\ -\ V3.0/package.json" \
    $WIN_USER@$WIN_IP:"D:/Antigravity\ -\ Project/KHHH\ -\ Antigravity\ -\ V3.0/vite.config.js" \
    $WIN_USER@$WIN_IP:"D:/Antigravity\ -\ Project/KHHH\ -\ Antigravity\ -\ V3.0/Dockerfile.backend" \
    $WIN_USER@$WIN_IP:"D:/Antigravity\ -\ Project/KHHH\ -\ Antigravity\ -\ V3.0/Dockerfile.frontend" \
    $WIN_USER@$WIN_IP:"D:/Antigravity\ -\ Project/KHHH\ -\ Antigravity\ -\ V3.0/docker-compose.yml" \
    $WIN_USER@$WIN_IP:"D:/Antigravity\ -\ Project/KHHH\ -\ Antigravity\ -\ V3.0/.env.example" \
    $WIN_USER@$WIN_IP:"D:/Antigravity\ -\ Project/KHHH\ -\ Antigravity\ -\ V3.0/deploy" \
    ~/khhh/
echo "      Kéo code xong."

# 5. Tạo file .env
echo "[5/6] Cấu hình môi trường..."
if [ ! -f ~/khhh/.env ]; then
    cp ~/khhh/.env.example ~/khhh/.env
    echo ""
    echo "  *** QUAN TRỌNG ***"
    echo "  Điền mật khẩu SFTP vào file .env:"
    echo ""
    read -p "  Nhập mật khẩu SFTP (cas_hue@10.1.45.10): " SFTP_PASS
    sed -i "s/your_sftp_password_here/$SFTP_PASS/" ~/khhh/.env
    echo "  Đã lưu mật khẩu SFTP."
else
    echo "      File .env đã có sẵn."
fi

# 6. Build và khởi động
echo "[6/6] Build và khởi động hệ thống..."
cd ~/khhh
sudo docker compose up -d --build

echo ""
echo "=================================================="
echo "  Cài đặt hoàn tất!"
echo ""
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "  Truy cập hệ thống tại: http://$SERVER_IP"
echo ""
echo "  Lệnh kiểm tra:  docker compose ps"
echo "  Lệnh xem log:   docker compose logs -f"
echo "=================================================="
