#!/usr/bin/env python3
"""
數據遷移腳本：將現有的 FormulaSchedule 表中的 pattern 字段值遷移到 FormulaSchedulePattern 表中
"""
import sys
import os
from sqlalchemy.orm import sessionmaker, Session

# 添加backend目錄到系統路徑
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.core.database import engine
from app.models.formula_schedule import FormulaSchedule, FormulaSchedulePattern
from app.models.log import Log

def migrate_patterns(db: Session):
    """將FormulaSchedule表中的pattern遷移到FormulaSchedulePattern表"""
    # 查詢所有公式班表
    formula_schedules = db.query(FormulaSchedule).all()
    print(f"找到 {len(formula_schedules)} 個公式班表")
    
    # 遍歷每個公式班表
    for formula in formula_schedules:
        # 檢查是否已經有相關的pattern記錄
        existing_patterns = db.query(FormulaSchedulePattern).filter(
            FormulaSchedulePattern.formula_id == formula.id
        ).count()
        
        # 如果已經有模式記錄，則跳過
        if existing_patterns > 0:
            print(f"公式班表 '{formula.name}' (ID: {formula.id}) 已經有 {existing_patterns} 個模式記錄，跳過遷移")
            continue
        
        # 如果pattern為空，則跳過
        if not formula.pattern:
            print(f"公式班表 '{formula.name}' (ID: {formula.id}) 的pattern為空，跳過遷移")
            continue
        
        # 創建新的模式記錄
        db_pattern = FormulaSchedulePattern(
            formula_id=formula.id,
            group_number=1,  # 默認為第一組
            pattern=formula.pattern
        )
        db.add(db_pattern)
        print(f"為公式班表 '{formula.name}' (ID: {formula.id}) 創建了模式記錄: {formula.pattern}")
    
    # 提交事務
    db.commit()
    print("遷移完成")

def main():
    """主函數"""
    # 創建數據庫會話
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # 執行遷移
        migrate_patterns(db)
    except Exception as e:
        print(f"遷移過程中發生錯誤: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main() 