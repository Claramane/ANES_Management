from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List, Optional, Dict

from ..core.database import get_db
from ..core.security import get_current_active_user
from ..models.user import User
from ..models.formula import FormulaSchedule, FormulaSchedulePattern

router = APIRouter(
    prefix="/formula-schedules",
    tags=["formula schedules"]
)

@router.get("/patterns", response_model=List[Dict])
async def get_all_formula_patterns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    formula_id: Optional[int] = None,
    group_number: Optional[int] = None
):
    """
    獲取所有公式班表模式數據，可選擇通過formula_id或group_number過濾
    """
    query = db.query(FormulaSchedulePattern)
    
    # 添加可選過濾條件
    if formula_id is not None:
        query = query.filter(FormulaSchedulePattern.formula_id == formula_id)
    
    if group_number is not None:
        query = query.filter(FormulaSchedulePattern.group_number == group_number)
    
    # 執行查詢
    patterns = query.all()
    
    # 構建結果
    result = []
    for pattern in patterns:
        # 獲取關聯的公式班表資訊
        formula = db.query(FormulaSchedule).filter(FormulaSchedule.id == pattern.formula_id).first()
        formula_name = formula.name if formula else "未知公式班表"
        
        result.append({
            "id": pattern.id,
            "formula_id": pattern.formula_id,
            "formula_name": formula_name,
            "group_number": pattern.group_number,
            "day_offset": pattern.day_offset,
            "pattern": pattern.pattern,
            "shift_type": pattern.shift_type,
            "pattern_data": pattern.pattern_data if hasattr(pattern, 'pattern_data') else None,
            "created_at": pattern.created_at,
            "updated_at": pattern.updated_at
        })
    
    return result

@router.get("/", response_model=List[Dict])
async def get_all_formula_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    include_patterns: bool = False,
    include_assignments: bool = False
):
    """
    獲取所有公式班表設定
    """
    formula_schedules = db.query(FormulaSchedule).filter(FormulaSchedule.is_active == True).all()
    
    result = []
    for formula in formula_schedules:
        formula_data = {
            "id": formula.id,
            "name": formula.name,
            "identity": formula.identity,
            "num_groups": formula.num_groups,
            "description": formula.description,
            "is_active": formula.is_active,
            "created_at": formula.created_at,
            "updated_at": formula.updated_at
        }
        
        # 如果需要包含模式信息
        if include_patterns:
            patterns = db.query(FormulaSchedulePattern).filter(
                FormulaSchedulePattern.formula_id == formula.id
            ).all()
            
            formula_data["patterns"] = [
                {
                    "id": pattern.id,
                    "group_number": pattern.group_number,
                    "day_offset": pattern.day_offset,
                    "pattern": pattern.pattern,
                    "shift_type": pattern.shift_type
                }
                for pattern in patterns
            ]
        
        result.append(formula_data)
    
    return result

@router.get("/{formula_id}", response_model=Dict)
async def get_formula_schedule(
    formula_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    include_patterns: bool = False
):
    """
    獲取特定公式班表的詳細信息
    """
    formula = db.query(FormulaSchedule).filter(
        FormulaSchedule.id == formula_id,
        FormulaSchedule.is_active == True
    ).first()
    
    if not formula:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到指定的公式班表"
        )
    
    formula_data = {
        "id": formula.id,
        "name": formula.name,
        "identity": formula.identity,
        "num_groups": formula.num_groups,
        "description": formula.description,
        "is_active": formula.is_active,
        "created_at": formula.created_at,
        "updated_at": formula.updated_at
    }
    
    # 如果需要包含模式信息
    if include_patterns:
        patterns = db.query(FormulaSchedulePattern).filter(
            FormulaSchedulePattern.formula_id == formula.id
        ).all()
        
        formula_data["patterns"] = [
            {
                "id": pattern.id,
                "group_number": pattern.group_number,
                "day_offset": pattern.day_offset,
                "pattern": pattern.pattern,
                "shift_type": pattern.shift_type
            }
            for pattern in patterns
        ]
    
    return formula_data

@router.put("/{formula_id}", response_model=Dict)
async def update_formula_schedule(
    formula_id: int,
    update_data: Dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    更新公式班表設定，包括基本信息和班表模式
    """
    # 確認用戶權限（只有管理員或護理長可修改）
    if current_user.role not in ["admin", "head_nurse"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="權限不足，只有管理員或護理長可以修改公式班表"
        )
    
    # 獲取要更新的公式班表
    formula = db.query(FormulaSchedule).filter(
        FormulaSchedule.id == formula_id,
        FormulaSchedule.is_active == True
    ).first()
    
    if not formula:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到指定的公式班表"
        )
    
    try:
        # 開始事務
        db.begin_nested()
        
        # 更新公式班表屬性
        for key, value in update_data.items():
            if key != "patterns" and hasattr(formula, key):
                setattr(formula, key, value)
        
        # 取得 num_groups（優先用 update_data，否則用 formula 原本的值）
        num_groups = update_data.get("num_groups", formula.num_groups)
        formula.num_groups = num_groups  # 確保主表同步
        
        # 如果提供了patterns，更新班表模式
        if "patterns" in update_data and isinstance(update_data["patterns"], list):
            for pattern_data in update_data["patterns"]:
                if "group_number" not in pattern_data or "pattern" not in pattern_data:
                    continue
                # 查找該組別的現有模式
                existing_pattern = db.query(FormulaSchedulePattern).filter(
                    FormulaSchedulePattern.formula_id == formula_id,
                    FormulaSchedulePattern.group_number == pattern_data["group_number"]
                ).first()
                if existing_pattern:
                    # 更新現有模式
                    existing_pattern.pattern = pattern_data["pattern"]
                    if "day_offset" in pattern_data:
                        existing_pattern.day_offset = pattern_data["day_offset"]
                    if "shift_type" in pattern_data:
                        existing_pattern.shift_type = pattern_data["shift_type"]
                else:
                    # 創建新模式
                    new_pattern = FormulaSchedulePattern(
                        formula_id=formula_id,
                        group_number=pattern_data["group_number"],
                        pattern=pattern_data["pattern"],
                        day_offset=pattern_data.get("day_offset"),
                        shift_type=pattern_data.get("shift_type")
                    )
                    db.add(new_pattern)
        
        # --- 根據 num_groups 同步 patterns ---
        # 先獲取現有所有 patterns，根據 group_number 排序
        existing_patterns = db.query(FormulaSchedulePattern).filter(
            FormulaSchedulePattern.formula_id == formula_id
        ).order_by(FormulaSchedulePattern.group_number).all()
        
        # 計算現有 patterns 數量
        current_count = len(existing_patterns)
        
        # 與 num_groups 比較
        if num_groups > current_count:
            # 如果 num_groups 大於現有數量，需要新增 pattern
            # 找出最大的 group_number
            max_group_number = 0
            if current_count > 0:
                max_group_number = max(p.group_number for p in existing_patterns)
            
            # 新增缺少的 pattern
            for i in range(1, num_groups - current_count + 1):
                new_group_number = max_group_number + i
                new_pattern = FormulaSchedulePattern(
                    formula_id=formula_id,
                    group_number=new_group_number,
                    pattern="OOOOOOO",  # 預設全部都是休假
                    day_offset=0,
                    shift_type=None
                )
                db.add(new_pattern)
            
            print(f"增加了 {num_groups - current_count} 個新的組別，從 {current_count} 增加到 {num_groups}")
        
        elif num_groups < current_count:
            # 如果 num_groups 小於現有數量，需要刪除多餘的 pattern
            # 根據 group_number 從大到小排序，刪除多餘的 patterns
            patterns_to_delete = sorted(existing_patterns, key=lambda p: p.group_number, reverse=True)[:current_count - num_groups]
            
            for pattern in patterns_to_delete:
                db.delete(pattern)
            
            print(f"刪除了 {current_count - num_groups} 個組別，從 {current_count} 減少到 {num_groups}")
        
        else:
            # 如果相等，不做任何事
            print(f"組別數量沒有變化，保持在 {num_groups}")
        
        # 提交更改
        db.commit()
        db.refresh(formula)
        
        # 獲取更新後的pattern列表
        patterns = db.query(FormulaSchedulePattern).filter(
            FormulaSchedulePattern.formula_id == formula_id
        ).all()
        
        pattern_list = [
            {
                "id": pattern.id,
                "group_number": pattern.group_number,
                "day_offset": pattern.day_offset,
                "pattern": pattern.pattern,
                "shift_type": pattern.shift_type
            }
            for pattern in patterns
        ]
        
        # 返回更新後的公式班表，包含patterns
        return {
            "id": formula.id,
            "name": formula.name,
            "identity": formula.identity,
            "num_groups": formula.num_groups,
            "description": formula.description,
            "is_active": formula.is_active,
            "created_at": formula.created_at,
            "updated_at": formula.updated_at,
            "patterns": pattern_list
        }
        
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新公式班表時發生錯誤: {str(e)}"
        ) 