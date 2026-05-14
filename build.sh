#!/usr/bin/env bash
# exit on error
set -o errexit

# Cài đặt thư viện
pip install -r requirements.txt

# Reset và tạo mới toàn bộ dữ liệu mẫu (chỉ dùng cho lần đầu deploy)
# Nếu sau này có migrate db, đổi dòng dưới thành: flask db upgrade
python seed.py --reset
