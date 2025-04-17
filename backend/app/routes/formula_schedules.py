from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from typing import List, Any

from ..core.database import get_db
from ..core.security import get_current_active_user, get_head_nurse_user
from ..models.user import User
from ..models.formula_schedule import FormulaSchedule, NurseFormulaAssignment, FormulaSchedulePattern, PatternNurseAssignment
from ..models.log import Log
from ..schemas.formula_schedule import (
    FormulaScheduleCreate, FormulaScheduleUpdate, FormulaSchedule as FormulaScheduleSchema,
    FormulaSchedulePatternCreate, FormulaSchedulePatternUpdate, FormulaSchedulePattern as FormulaSchedulePatternSchema,
    PatternNurseAssignmentCreate, PatternNurseAssignment as PatternNurseAssignmentSchema
)

router = APIRouter()

@router.post("/formula-schedules", response_model=FormulaScheduleSchema)
async def create_formula_schedule(
    formula_in: FormulaScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """創建新的公式班表（僅護理長可操作）"""
    # 檢查名稱是否已存在
    db_formula = db.query(FormulaSchedule).filter(FormulaSchedule.name == formula_in.name).first()
    if db_formula:
        raise HTTPException(
            status_code=400,
            detail="公式班表名稱已存在"
        )
    
    # 創建新公式班表
    db_formula = FormulaSchedule(
        name=formula_in.name,
        description=formula_in.description
    )
    db.add(db_formula)
    db.commit()
    db.refresh(db_formula)
    
    # 處理patterns
    if formula_in.patterns:
        for i, pattern_data in enumerate(formula_in.patterns):
            db_pattern = FormulaSchedulePattern(
                formula_id=db_formula.id,
                group_number=pattern_data.group_number if hasattr(pattern_data, 'group_number') else i+1,
                pattern=pattern_data.pattern
            )
            db.add(db_pattern)
    
    db.commit()
    db.refresh(db_formula)
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="create_formula_schedule",
        description=f"創建公式班表: {formula_in.name}"
    )
    db.add(log)
    db.commit()
    
    return db_formula

@router.get("/formula-schedules", response_model=List[FormulaScheduleSchema])
async def read_formula_schedules(
    skip: int = 0,
    limit: int = 100,
    include_patterns: bool = False,
    include_assignments: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """獲取所有公式班表列表"""
    print(f"讀取公式班表，include_patterns={include_patterns}, include_assignments={include_assignments}")
    
    # 1. 獲取所有公式班表
    query = db.query(FormulaSchedule)
    
    # 2. 可選加載nurse_assignments
    if include_assignments:
        query = query.options(joinedload(FormulaSchedule.nurse_assignments))
    
    formula_schedules = query.offset(skip).limit(limit).all()
    
    # 3. 若需要，為每個公式班表手動加載所有patterns
    if include_patterns:
        for formula in formula_schedules:
            print(f"\n===== 處理公式班表 '{formula.name}' (ID: {formula.id}) =====")
            
            # 使用原始SQL查詢而非ORM，確保獲取所有patterns
            raw_patterns = db.execute(
                text("SELECT * FROM formula_schedule_patterns WHERE formula_id = :formula_id ORDER BY group_number"),
                {"formula_id": formula.id}
            ).fetchall()
            
            print(f"資料庫中查詢到的patterns數量: {len(raw_patterns)}")
            print("原始查詢結果:")
            for i, row in enumerate(raw_patterns):
                print(f" - 原始記錄 {i+1}: id={row[0]}, formula_id={row[1]}, group_number={row[2]}, pattern={row[3]}")
            
            # 創建FormulaSchedulePattern對象列表，使用字典確保每個group_number只有一個pattern
            patterns_dict = {}
            for row in raw_patterns:
                group_number = row[2]  # group_number 在第三列
                if group_number not in patterns_dict:
                    pattern = FormulaSchedulePattern(
                        id=row[0],             # Correct index
                        formula_id=row[1],     # Correct index
                        group_number=row[2],   # Correct index
                        day_offset=row[3],     # NEW - Index 3 is day_offset
                        pattern=row[4],        # UPDATED - Index 4 is pattern
                        shift_type=row[5],     # NEW - Index 5 is shift_type
                        created_at=row[6],     # UPDATED - Index 6 is created_at
                        updated_at=row[7]      # UPDATED - Index 7 is updated_at
                    )
                    patterns_dict[group_number] = pattern
                    print(f" - 添加 group_number={group_number}, pattern={row[4]}, id={row[0]}") # Update print statement index
                else:
                    print(f" - 忽略重複的 group_number={group_number}, pattern={row[4]}, id={row[0]}") # Update print statement index
            
            # 將字典轉換為列表
            patterns = list(patterns_dict.values())
            
            # 這裡直接覆蓋patterns屬性，確保所有patterns都被包含
            formula.patterns = patterns
            
            print(f"去重後的patterns數量: {len(patterns)}")
            print("最終加載的patterns:")
            for i, pattern in enumerate(formula.patterns):
                print(f" - Pattern {i+1}: id={pattern.id}, group_number={pattern.group_number}, pattern={pattern.pattern}")
    
    # 4. 返回處理後的公式班表列表
    return formula_schedules

@router.get("/formula-schedules/{formula_id}", response_model=FormulaScheduleSchema)
async def read_formula_schedule(
    formula_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """獲取特定公式班表詳情"""
    print(f"\n===== 讀取單個公式班表，ID={formula_id} =====")
    
    # 1. 先獲取公式班表基本資訊和nurse_assignments
    db_formula = db.query(FormulaSchedule).options(
        joinedload(FormulaSchedule.nurse_assignments)
    ).filter(FormulaSchedule.id == formula_id).first()
    
    if not db_formula:
        raise HTTPException(
            status_code=404,
            detail="公式班表不存在"
        )
    
    # 2. 使用原始SQL查詢而非ORM，確保獲取所有patterns
    raw_patterns = db.execute(
        text("SELECT * FROM formula_schedule_patterns WHERE formula_id = :formula_id ORDER BY group_number"),
        {"formula_id": formula_id}
    ).fetchall()
    
    print(f"公式班表 '{db_formula.name}' (ID: {formula_id}):")
    print(f"資料庫中查詢到的patterns數量: {len(raw_patterns)}")
    print("原始查詢結果:")
    for i, row in enumerate(raw_patterns):
        print(f" - 原始記錄 {i+1}: id={row[0]}, formula_id={row[1]}, group_number={row[2]}, pattern={row[3]}")
    
    # 3. 創建FormulaSchedulePattern對象列表並分配給formula，使用字典確保每個group_number只有一個pattern
    patterns_dict = {}
    for row in raw_patterns:
        group_number = row[2]  # group_number 在第三列
        if group_number not in patterns_dict:
            pattern = FormulaSchedulePattern(
                id=row[0],             # Correct index
                formula_id=row[1],     # Correct index
                group_number=row[2],   # Correct index
                day_offset=row[3],     # NEW - Index 3 is day_offset
                pattern=row[4],        # UPDATED - Index 4 is pattern
                shift_type=row[5],     # NEW - Index 5 is shift_type
                created_at=row[6],     # UPDATED - Index 6 is created_at
                updated_at=row[7]      # UPDATED - Index 7 is updated_at
            )
            patterns_dict[group_number] = pattern
            print(f" - 添加 group_number={group_number}, pattern={row[4]}, id={row[0]}") # Update print statement index
        else:
            print(f" - 忽略重複的 group_number={group_number}, pattern={row[4]}, id={row[0]}") # Update print statement index
    
    # 將字典轉換為列表
    patterns = list(patterns_dict.values())
    
    # 直接分配patterns
    db_formula.patterns = patterns
    
    print(f"去重後的patterns數量: {len(patterns)}")
    print("最終加載的patterns:")
    for i, pattern in enumerate(db_formula.patterns):
        print(f" - Pattern {i+1}: id={pattern.id}, group_number={pattern.group_number}, pattern={pattern.pattern}")
    
    return db_formula

@router.put("/formula-schedules/{formula_id}", response_model=FormulaScheduleSchema)
async def update_formula_schedule(
    formula_id: int,
    formula_in: FormulaScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """更新公式班表（僅護理長可操作）"""
    db_formula = db.query(FormulaSchedule).filter(FormulaSchedule.id == formula_id).first()
    if not db_formula:
        raise HTTPException(
            status_code=404,
            detail="公式班表不存在"
        )
    
    # 更新公式班表基本資訊
    update_data = formula_in.dict(exclude={"patterns"}, exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_formula, field, value)
    
    # 處理patterns
    if formula_in.patterns is not None:
        # 刪除現有patterns
        db.query(FormulaSchedulePattern).filter(
            FormulaSchedulePattern.formula_id == formula_id
        ).delete()
        
        # 添加新patterns
        for i, pattern_data in enumerate(formula_in.patterns):
            db_pattern = FormulaSchedulePattern(
                formula_id=formula_id,
                group_number=pattern_data.group_number if hasattr(pattern_data, 'group_number') else i+1,
                pattern=pattern_data.pattern
            )
            db.add(db_pattern)
    
    db.commit()
    db.refresh(db_formula)
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        action="更新公式班表",
        operation_type="update_formula_schedule",
        description=f"更新公式班表: {db_formula.name} (ID: {formula_id})"
    )
    db.add(log)
    db.commit()
    
    return db_formula

@router.delete("/formula-schedules/{formula_id}", response_model=FormulaScheduleSchema)
async def delete_formula_schedule(
    formula_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """刪除公式班表（僅護理長可操作）"""
    db_formula = db.query(FormulaSchedule).filter(FormulaSchedule.id == formula_id).first()
    if not db_formula:
        raise HTTPException(
            status_code=404,
            detail="公式班表不存在"
        )
    
    # 檢查是否有關聯的護理師指派
    assignments = db.query(NurseFormulaAssignment).filter(
        NurseFormulaAssignment.formula_id == formula_id
    ).all()
    
    if assignments:
        raise HTTPException(
            status_code=400,
            detail="該公式班表已分配給護理師，無法刪除"
        )
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="delete_formula_schedule",
        description=f"刪除公式班表: {db_formula.name} (ID: {formula_id})"
    )
    db.add(log)
    
    # 刪除公式班表
    db.delete(db_formula)
    db.commit()
    
    return db_formula

# 護理師公式班表指派相關API
@router.post("/formula-assignments", response_model=Any)
async def assign_nurse_to_formula(
    nurse_id: int,
    formula_id: int,
    start_cycle: int = 1,
    sort_order: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """將護理師指派到特定公式班表（僅護理長可操作）"""
    # 檢查護理師是否存在
    nurse = db.query(User).filter(User.id == nurse_id).first()
    if not nurse:
        raise HTTPException(
            status_code=404,
            detail="護理師不存在"
        )
    
    # 檢查公式班表是否存在
    formula = db.query(FormulaSchedule).filter(FormulaSchedule.id == formula_id).first()
    if not formula:
        raise HTTPException(
            status_code=404,
            detail="公式班表不存在"
        )
    
    # 檢查護理師是否已經分配到其他公式班表
    existing_assignment = db.query(NurseFormulaAssignment).filter(
        NurseFormulaAssignment.user_id == nurse_id
    ).first()
    
    if existing_assignment:
        # 更新現有指派
        existing_assignment.formula_id = formula_id
        existing_assignment.start_cycle = start_cycle
        if sort_order is not None:
            existing_assignment.sort_order = sort_order
    else:
        # 創建新指派
        if sort_order is None:
            # 如果未指定排序，獲取當前最大排序值並+1
            max_order = db.query(NurseFormulaAssignment).filter(
                NurseFormulaAssignment.formula_id == formula_id
            ).order_by(NurseFormulaAssignment.sort_order.desc()).first()
            
            sort_order = 1 if not max_order else max_order.sort_order + 1
        
        new_assignment = NurseFormulaAssignment(
            user_id=nurse_id,
            formula_id=formula_id,
            start_cycle=start_cycle,
            sort_order=sort_order
        )
        db.add(new_assignment)
    
    db.commit()
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="assign_nurse_to_formula",
        description=f"將護理師 {nurse.username} 指派到公式班表 {formula.name}"
    )
    db.add(log)
    db.commit()
    
    return {"status": "success", "message": "護理師已成功指派到公式班表"}

@router.post("/formula-patterns", response_model=FormulaSchedulePatternSchema)
async def create_formula_pattern(
    pattern_in: FormulaSchedulePatternCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """創建新的公式班表模式（僅護理長可操作）"""
    # 檢查公式班表是否存在
    formula = db.query(FormulaSchedule).filter(FormulaSchedule.id == pattern_in.formula_id).first()
    if not formula:
        raise HTTPException(
            status_code=404,
            detail="公式班表不存在"
        )
    
    # 創建新的公式班表模式
    db_pattern = FormulaSchedulePattern(
        formula_id=pattern_in.formula_id,
        group_number=pattern_in.group_number,
        pattern=pattern_in.pattern
    )
    db.add(db_pattern)
    db.commit()
    db.refresh(db_pattern)
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="create_formula_pattern",
        description=f"創建公式班表模式: {pattern_in.pattern} (公式班表ID: {pattern_in.formula_id})"
    )
    db.add(log)
    db.commit()
    
    return db_pattern

@router.get("/formula-schedules/{formula_id}/patterns", response_model=List[FormulaSchedulePatternSchema])
async def read_formula_patterns(
    formula_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """獲取特定公式班表的所有模式"""
    print(f"讀取公式班表模式，ID={formula_id}")
    
    # 使用直接SQL查詢獲取所有模式
    raw_patterns = db.execute(
        text("SELECT * FROM formula_schedule_patterns WHERE formula_id = :formula_id ORDER BY group_number"),
        {"formula_id": formula_id}
    ).fetchall()
    
    print(f"公式ID {formula_id} 共查詢到 {len(raw_patterns)} 個模式")
    
    # 轉換SQL結果為模型對象
    patterns = []
    for row in raw_patterns:
        pattern = FormulaSchedulePattern(
            id=row[0],
            formula_id=row[1],
            group_number=row[2],
            pattern=row[3],
            created_at=row[4],
            updated_at=row[5]
        )
        patterns.append(pattern)
        print(f" - Pattern: id={pattern.id}, group_number={pattern.group_number}, pattern={pattern.pattern}")
    
    return patterns

@router.put("/formula-patterns/{pattern_id}", response_model=FormulaSchedulePatternSchema)
async def update_formula_pattern(
    pattern_id: int,
    pattern_in: FormulaSchedulePatternUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """更新公式班表模式（僅護理長可操作）"""
    db_pattern = db.query(FormulaSchedulePattern).filter(FormulaSchedulePattern.id == pattern_id).first()
    if not db_pattern:
        raise HTTPException(
            status_code=404,
            detail="公式班表模式不存在"
        )
    
    # 更新公式班表模式
    update_data = pattern_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_pattern, field, value)
    
    db.commit()
    db.refresh(db_pattern)
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="update_formula_pattern",
        description=f"更新公式班表模式: ID {pattern_id}"
    )
    db.add(log)
    db.commit()
    
    return db_pattern

@router.delete("/formula-patterns/{pattern_id}", response_model=FormulaSchedulePatternSchema)
async def delete_formula_pattern(
    pattern_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """刪除公式班表模式（僅護理長可操作）"""
    db_pattern = db.query(FormulaSchedulePattern).filter(FormulaSchedulePattern.id == pattern_id).first()
    if not db_pattern:
        raise HTTPException(
            status_code=404,
            detail="公式班表模式不存在"
        )
    
    # 檢查是否有關聯的護理師指派
    assignments = db.query(PatternNurseAssignment).filter(
        PatternNurseAssignment.pattern_id == pattern_id
    ).all()
    
    if assignments:
        raise HTTPException(
            status_code=400,
            detail="該公式班表模式已分配給護理師，無法刪除"
        )
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        operation_type="delete_formula_pattern",
        description=f"刪除公式班表模式: ID {pattern_id}"
    )
    db.add(log)
    
    # 刪除公式班表模式
    db.delete(db_pattern)
    db.commit()
    
    return db_pattern

@router.get("/formula-schedules/{formula_id}/check-duplicates")
async def check_pattern_duplicates(
    formula_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """檢查特定公式班表的模式是否有重複"""
    print(f"\n===== 檢查公式班表ID={formula_id}的模式是否有重複 =====")
    
    # 檢查公式班表是否存在
    db_formula = db.query(FormulaSchedule).filter(FormulaSchedule.id == formula_id).first()
    if not db_formula:
        raise HTTPException(
            status_code=404,
            detail="公式班表不存在"
        )
    
    # 使用原始SQL查詢獲取所有模式
    raw_patterns = db.execute(
        text("SELECT * FROM formula_schedule_patterns WHERE formula_id = :formula_id ORDER BY group_number"),
        {"formula_id": formula_id}
    ).fetchall()
    
    print(f"公式班表 '{db_formula.name}' (ID: {formula_id}):")
    print(f"查詢到的patterns總數量: {len(raw_patterns)}")
    
    # 檢查是否有重複的group_number
    group_counts = {}
    duplicate_groups = []
    
    for row in raw_patterns:
        group_number = row[2]  # group_number 在第三列
        pattern_id = row[0]    # id 在第一列
        pattern = row[3]       # pattern 在第四列
        
        if group_number not in group_counts:
            group_counts[group_number] = {
                "count": 1,
                "patterns": [{"id": pattern_id, "pattern": pattern}]
            }
        else:
            group_counts[group_number]["count"] += 1
            group_counts[group_number]["patterns"].append({"id": pattern_id, "pattern": pattern})
            duplicate_groups.append(group_number)
    
    # 發現重複的 group_number
    has_duplicates = len(duplicate_groups) > 0
    unique_count = len(group_counts)
    
    result = {
        "formula_id": formula_id,
        "formula_name": db_formula.name,
        "total_pattern_count": len(raw_patterns),
        "unique_group_count": unique_count,
        "has_duplicates": has_duplicates,
    }
    
    if has_duplicates:
        duplicate_details = {}
        for group in set(duplicate_groups):
            duplicate_details[f"group_{group}"] = {
                "count": group_counts[group]["count"],
                "patterns": group_counts[group]["patterns"]
            }
        
        result["duplicate_groups"] = duplicate_details
        
        print(f"發現 {len(set(duplicate_groups))} 個重複的group_number")
        for group, details in duplicate_details.items():
            print(f" - {group}: 重複 {details['count']} 次")
            for p in details["patterns"]:
                print(f"   - ID: {p['id']}, Pattern: {p['pattern']}")
    else:
        print("未發現重複的group_number")
    
    return result

@router.post("/formula-schedules/{formula_id}/clean-duplicates")
async def clean_pattern_duplicates(
    formula_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """清理特定公式班表的重複模式記錄（僅護理長可操作）"""
    print(f"\n===== 清理公式班表ID={formula_id}的重複模式 =====")
    
    # 檢查公式班表是否存在
    db_formula = db.query(FormulaSchedule).filter(FormulaSchedule.id == formula_id).first()
    if not db_formula:
        raise HTTPException(
            status_code=404,
            detail="公式班表不存在"
        )
    
    # 使用原始SQL查詢獲取所有模式
    raw_patterns = db.execute(
        text("SELECT * FROM formula_schedule_patterns WHERE formula_id = :formula_id ORDER BY group_number, id"),
        {"formula_id": formula_id}
    ).fetchall()
    
    print(f"公式班表 '{db_formula.name}' (ID: {formula_id}):")
    print(f"清理前patterns總數量: {len(raw_patterns)}")
    
    # 收集要保留的模式ID和要刪除的模式ID
    group_to_keep = {}  # 每個group_number保留最小ID的pattern
    ids_to_delete = []
    
    for row in raw_patterns:
        pattern_id = row[0]      # id 在第一列
        group_number = row[2]    # group_number 在第三列
        
        if group_number not in group_to_keep:
            group_to_keep[group_number] = pattern_id
            print(f" - 保留 group_number={group_number} 的 pattern_id={pattern_id}")
        else:
            ids_to_delete.append(pattern_id)
            print(f" - 刪除 group_number={group_number} 的 pattern_id={pattern_id}")
    
    # 執行刪除操作
    if ids_to_delete:
        # 使用SQL直接刪除，處理不同數量的ID
        if len(ids_to_delete) == 1:
            # 單個ID的情況
            delete_sql = text("DELETE FROM formula_schedule_patterns WHERE id = :id")
            db.execute(delete_sql, {"id": ids_to_delete[0]})
        else:
            # 多個ID的情況
            for id_to_delete in ids_to_delete:
                delete_sql = text("DELETE FROM formula_schedule_patterns WHERE id = :id")
                db.execute(delete_sql, {"id": id_to_delete})
        
        db.commit()
        
        print(f"已刪除 {len(ids_to_delete)} 個重複的pattern記錄")
        
        # 添加操作日誌
        log = Log(
            user_id=current_user.id,
            operation_type="clean_pattern_duplicates",
            description=f"清理公式班表 '{db_formula.name}' (ID: {formula_id}) 的重複模式記錄，共刪除 {len(ids_to_delete)} 條記錄"
        )
        db.add(log)
        db.commit()
        
        return {
            "formula_id": formula_id,
            "formula_name": db_formula.name,
            "total_before": len(raw_patterns),
            "total_after": len(raw_patterns) - len(ids_to_delete),
            "deleted_count": len(ids_to_delete),
            "deleted_ids": ids_to_delete,
            "status": "success",
            "message": f"已成功清理 {len(ids_to_delete)} 個重複的模式記錄"
        }
    else:
        print("未發現需要清理的重複記錄")
        return {
            "formula_id": formula_id,
            "formula_name": db_formula.name,
            "total_count": len(raw_patterns),
            "deleted_count": 0,
            "status": "success",
            "message": "未發現需要清理的重複記錄"
        } 