#!/usr/bin/env python3
"""
資料庫同步腳本 (Python版本)
用途：將遠端 Zeabur 資料庫的資料同步到本地開發資料庫

使用方法:
    python sync_remote_to_local.py

依賴:
    pip install psycopg2-binary
"""

import os
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
    NC = '\033[0m'  # No Color

def print_color(message, color):
    """彩色輸出"""
    print(f"{color}{message}{Colors.NC}")

def check_pg_tools():
    """檢查 PostgreSQL 工具是否安裝"""
    tools = ['pg_dump', 'psql']
    for tool in tools:
        try:
            subprocess.run([tool, '--version'],
                         capture_output=True,
                         check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print_color(f"錯誤: 找不到 {tool} 命令", Colors.RED)
            print_color("請安裝 PostgreSQL 客戶端工具", Colors.RED)
            sys.exit(1)

def run_command(cmd, error_message):
    """執行命令並處理錯誤"""
    try:
        result = subprocess.run(cmd,
                              shell=True,
                              check=True,
                              capture_output=True,
                              text=True)
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        print_color(f"✗ {error_message}", Colors.RED)
        if e.stderr:
            print(e.stderr)
        return False, e.stderr

def main():
    # 設定備份目錄
    script_dir = Path(__file__).parent
    backup_dir = script_dir / 'backups'
    backup_dir.mkdir(exist_ok=True)

    # 生成時間戳記
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    remote_backup = backup_dir / f"backup_remote_{timestamp}.sql"
    local_backup = backup_dir / f"backup_local_before_sync_{timestamp}.sql"

    print_color("================================", Colors.YELLOW)
    print_color("資料庫同步腳本", Colors.YELLOW)
    print_color("遠端 → 本地", Colors.YELLOW)
    print_color("================================", Colors.YELLOW)
    print()

    # 檢查工具
    check_pg_tools()

    # 確認操作
    print_color("警告: 此操作會覆蓋本地資料庫的所有資料！", Colors.YELLOW)
    print_color("本地資料庫: anes_db@localhost", Colors.YELLOW)
    print()

    confirm = input("確定要繼續嗎? (yes/no): ").strip().lower()
    if confirm != 'yes':
        print_color("操作已取消", Colors.RED)
        sys.exit(0)

    # 步驟 1: 從遠端匯出
    print_color("[1/4] 正在從遠端資料庫匯出資料...", Colors.GREEN)
    cmd = f'pg_dump "{REMOTE_DB}" --no-owner --no-privileges --clean --if-exists --file="{remote_backup}"'
    success, _ = run_command(cmd, "資料匯出失敗")

    if success:
        print_color(f"✓ 資料匯出成功: {remote_backup}", Colors.GREEN)
    else:
        sys.exit(1)

    # 步驟 2: 備份本地資料庫
    print_color("[2/4] 正在備份本地資料庫...", Colors.GREEN)
    cmd = f'pg_dump "{LOCAL_DB}" --no-owner --no-privileges --clean --if-exists --file="{local_backup}"'
    success, _ = run_command(cmd, "本地資料庫備份失敗")

    if success:
        print_color(f"✓ 本地資料庫已備份: {local_backup}", Colors.GREEN)
    else:
        print_color("! 本地資料庫備份跳過（資料庫可能不存在）", Colors.YELLOW)

    # 步驟 3: 清理本地資料庫
    print_color("[3/4] 正在清理本地資料庫...", Colors.GREEN)
    cmd = f'psql "{LOCAL_DB}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
    run_command(cmd, "清理失敗，嘗試直接導入")

    # 步驟 4: 導入到本地
    print_color("[4/4] 正在導入資料到本地資料庫...", Colors.GREEN)
    cmd = f'psql "{LOCAL_DB}" < "{remote_backup}"'
    success, _ = run_command(cmd, "資料導入失敗")

    if success:
        print_color("✓ 資料導入成功", Colors.GREEN)
    else:
        print_color(f"可以嘗試手動導入: psql {LOCAL_DB} < {remote_backup}", Colors.YELLOW)
        sys.exit(1)

    # 完成
    print()
    print_color("================================", Colors.GREEN)
    print_color("同步完成！", Colors.GREEN)
    print_color("================================", Colors.GREEN)
    print()
    print_color("備份檔案位置:", Colors.GREEN)
    print(f"  遠端備份: {remote_backup}")
    if local_backup.exists():
        print(f"  本地備份: {local_backup}")
    print()
    print_color(f"提示: 備份檔案會保留在 {backup_dir} 目錄", Colors.YELLOW)
    print_color(f"如需還原，請使用: psql {LOCAL_DB} < [備份檔案]", Colors.YELLOW)

if __name__ == "__main__":
    main()
