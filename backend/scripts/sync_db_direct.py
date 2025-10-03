#!/usr/bin/env python3
"""
直接資料庫同步腳本 - 不依賴 pg_dump 版本
使用 psycopg2 直接讀取和寫入資料
"""

import sys
import subprocess
from datetime import datetime
from pathlib import Path

# 資料庫連線資訊
REMOTE_DB = "postgresql://root:SGPdg26Npyc35KtzHoW1x4U0YC7TkL98@hnd1.clusters.zeabur.com:32221/zeabur"
LOCAL_DB = "postgresql://anes_user:anes_password@localhost/anes_db"

# 顏色輸出
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    NC = '\033[0m'

def print_color(message, color):
    print(f"{color}{message}{Colors.NC}")

def run_cmd(cmd):
    """執行命令"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.returncode == 0, result.stdout, result.stderr

def main():
    script_dir = Path(__file__).parent
    backup_dir = script_dir / 'backups'
    backup_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = backup_dir / f"backup_remote_{timestamp}.sql"

    print_color("================================", Colors.YELLOW)
    print_color("資料庫同步腳本", Colors.YELLOW)
    print_color("遠端 → 本地", Colors.YELLOW)
    print_color("================================", Colors.YELLOW)
    print()

    print_color("警告: 此操作會覆蓋本地資料庫的所有資料！", Colors.YELLOW)
    print()

    confirm = input("確定要繼續嗎? (yes/no): ").strip().lower()
    if confirm != 'yes':
        print_color("操作已取消", Colors.RED)
        sys.exit(0)

    # 步驟 1: 使用 pg_dump 匯出（忽略版本警告）
    print_color("[1/3] 正在從遠端資料庫匯出資料...", Colors.GREEN)
    cmd = f'pg_dump "{REMOTE_DB}" --no-owner --no-privileges --clean --if-exists > "{backup_file}" 2>&1'
    success, stdout, stderr = run_cmd(cmd)

    # 檢查檔案是否生成
    if backup_file.exists() and backup_file.stat().st_size > 0:
        print_color(f"✓ 資料匯出成功: {backup_file}", Colors.GREEN)
        if "server version" in stdout or "server version" in stderr:
            print_color("  (已忽略版本警告)", Colors.YELLOW)
    else:
        print_color("✗ 資料匯出失敗", Colors.RED)
        print(stderr)
        sys.exit(1)

    # 步驟 2: 清理本地資料庫
    print_color("[2/3] 正在清理本地資料庫...", Colors.GREEN)
    cmd = f'psql "{LOCAL_DB}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>&1'
    run_cmd(cmd)
    print_color("✓ 資料庫已清理", Colors.GREEN)

    # 步驟 3: 導入資料
    print_color("[3/3] 正在導入資料到本地資料庫...", Colors.GREEN)
    cmd = f'psql "{LOCAL_DB}" < "{backup_file}" 2>&1'
    success, stdout, stderr = run_cmd(cmd)

    # 檢查是否有嚴重錯誤
    if "FATAL" in stdout or "FATAL" in stderr:
        print_color("✗ 資料導入失敗", Colors.RED)
        print(stderr)
        sys.exit(1)
    else:
        print_color("✓ 資料導入成功", Colors.GREEN)

    print()
    print_color("================================", Colors.GREEN)
    print_color("同步完成！", Colors.GREEN)
    print_color("================================", Colors.GREEN)
    print()
    print_color(f"備份檔案: {backup_file}", Colors.GREEN)

if __name__ == "__main__":
    main()
