from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any, Dict, Optional
from datetime import datetime, date
import calendar
import json
import copy

from ..core.database import get_db
from ..core.security import get_current_active_user, get_head_nurse_user, get_current_user
from ..models.user import User
from ..models.schedule import MonthlySchedule, ScheduleVersion, ScheduleVersionDiff
from ..models.formula_schedule import FormulaSchedule, NurseFormulaAssignment
from ..models.log import Log
from ..schemas.schedule import (
    MonthlyScheduleCreate, MonthlyScheduleUpdate, MonthlySchedule as MonthlyScheduleSchema,
    ScheduleVersionCreate, ScheduleVersionUpdate, ScheduleVersion as ScheduleVersionSchema,
    ScheduleVersionDiffCreate, ScheduleVersionDiff as ScheduleVersionDiffSchema,
    GenerateMonthScheduleRequest
)

router = APIRouter()

@router.post("/schedules/generate", response_model=Dict[str, Any])
async def generate_monthly_schedule(
    request: GenerateMonthScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """生成月度排班表（僅護理長可操作）"""
    
    # 驗證年月
    try:
        # 確保年月有效
        if request.month < 1 or request.month > 12:
            raise ValueError("月份必須在1至12之間")
        
        # 驗證年份範圍（這裡可以根據需要調整）
        current_year = datetime.now().year
        if request.year < current_year - 1 or request.year > current_year + 1:
            raise ValueError(f"年份必須在 {current_year-1} 至 {current_year+1} 之間")
            
        # 創建目標月份的第一天
        first_day = date(request.year, request.month, 1)
        
        # 計算該月的天數
        _, days_in_month = calendar.monthrange(request.year, request.month)
        
        # 計算月份的第一天是星期幾 (0-6 代表週一到週日)
        first_day_weekday = first_day.weekday()
        
        # 檢查是否已有該月份的排班表
        month_str = f"{request.year}{request.month:02d}"
        existing_version = db.query(ScheduleVersion).filter(
            ScheduleVersion.month == month_str
        ).first()
        
        if existing_version:
            # 刪除現有排班記錄
            db.query(MonthlySchedule).filter(
                MonthlySchedule.version_id == existing_version.id
            ).delete()
            version = existing_version
            version.is_base_version = request.as_base_version  # 設置是否為基準版本
        else:
            # 創建新版本
            version = ScheduleVersion(
                version_number=f"v1.0_{month_str}",
                month=month_str,
                notes=request.description or f"{request.year}年{request.month}月排班表",
                is_published=False,
                published_by=current_user.id,
                is_base_version=request.as_base_version  # 設置是否為基準版本
            )
            db.add(version)
            db.commit()
            db.refresh(version)
        
        # 獲取所有公式班表及其patterns
        from ..models.formula_schedule import FormulaSchedulePattern
        formula_patterns = {}
        
        formulas = db.query(FormulaSchedule).all()
        
        # 建立公式名稱到ID的映射
        formula_name_to_id = {}
        formula_id_to_name = {}
        for formula in formulas:
            formula_name_to_id[formula.name] = formula.id
            formula_id_to_name[formula.id] = formula.name
            
            patterns = db.query(FormulaSchedulePattern).filter(
                FormulaSchedulePattern.formula_id == formula.id
            ).order_by(FormulaSchedulePattern.group_number).all()
            
            # 使用字典去重複，確保每個group_number只有一個pattern
            patterns_dict = {}
            for pattern in patterns:
                if pattern.group_number not in patterns_dict:
                    patterns_dict[pattern.group_number] = pattern
            
            # 轉換為列表並按group_number排序
            formula_patterns[formula.id] = sorted(
                patterns_dict.values(),
                key=lambda p: p.group_number
            )
            
            print(f"公式班表 '{formula.name}' (ID: {formula.id}) 有 {len(patterns_dict)} 個有效pattern")
            for p in patterns_dict.values():
                print(f" - 組別: {p.group_number}, pattern: {p.pattern}")
        
        # 獲取所有護理師
        all_nurses = db.query(User).filter(
            User.role.in_(['nurse', 'secretary', 'leader', 'head_nurse'])
        ).all()
        
        if not all_nurses:
            raise ValueError("未找到任何護理師，無法生成班表")
            
        print(f"找到 {len(all_nurses)} 名護理師")
        
        # 生成月度排班
        schedule_entries = []
        
        # 身份與公式ID對應關係
        identity_to_formula = {
            '麻醉專科護理師': 1,
            '恢復室護理師': 2,
            '麻醉科Leader': 3,
            '麻醉科書記': 4
        }
        
        # 處理每個護理師的排班
        for nurse in all_nurses:
            # 護理長特殊處理：週一至週五為A班，週六日為O休假
            if nurse.role == 'head_nurse':
                print(f"護理長 {nurse.full_name} (ID: {nurse.id}) 使用特殊班表: 週一至週五A班，週六日休假")
                
                # 為護理長生成特殊班表
                for day in range(1, days_in_month + 1):
                    entry_date = date(request.year, request.month, day)
                    
                    # 計算當前日期是一週中的第幾天 (0=週一, 6=週日)
                    day_of_week = entry_date.weekday()
                    
                    # 週一至週五為A班，週六日為O休假
                    shift_type = 'A' if day_of_week < 5 else 'O'
                    
                    # 創建排班記錄
                    schedule_entry = MonthlySchedule(
                        user_id=nurse.id,
                        date=entry_date,
                        shift_type=shift_type,
                        area_code=nurse.identity,
                        version_id=version.id
                    )
                    schedule_entries.append(schedule_entry)
                    
                print(f"護理長 {nurse.full_name} 的排班已完成")
                continue
                
            # 檢查group_data是否有值
            formula_id = None
            start_pattern = 1
            
            if nurse.group_data:
                try:
                    # 解析group_data JSON
                    group_data = json.loads(nurse.group_data)
                    
                    # group_data應是["公式ID", "起始組別"]格式的數組
                    if isinstance(group_data, list) and len(group_data) >= 2:
                        # 第一個元素是公式ID
                        formula_id = int(group_data[0])
                        # 第二個元素是起始pattern組
                        start_pattern = int(group_data[1])
                        
                        print(f"護理師 {nurse.full_name} (ID: {nurse.id}) 的 group_data: {group_data}")
                        print(f"  解析得到: 公式ID: {formula_id}, 起始組別: {start_pattern}")
                    else:
                        print(f"護理師 {nurse.full_name} 的 group_data 格式不正確: {group_data}")
                        formula_id = identity_to_formula.get(nurse.identity)
                        start_pattern = 1
                except Exception as e:
                    print(f"解析護理師 {nurse.full_name} 的group_data時發生錯誤: {str(e)}")
                    formula_id = None
            else:
                # group_data 為 null，直接生成全休假排班
                print(f"護理師 {nurse.full_name} 的 group_data 為 null，生成全休假排班")
                
                # 為這個護理師生成全休假排班
                for day in range(1, days_in_month + 1):
                    entry_date = date(request.year, request.month, day)
                    
                    schedule_entry = MonthlySchedule(
                        user_id=nurse.id,
                        date=entry_date,
                        shift_type='O',  # 休假
                        area_code=nurse.identity,
                        version_id=version.id
                    )
                    schedule_entries.append(schedule_entry)
                continue
            
            # 如果沒有從group_data獲取到，則根據護理師身份設置默認公式
            if formula_id is None:
                formula_id = identity_to_formula.get(nurse.identity)
                print(f"護理師 {nurse.full_name} 未設置組別，使用身份 {nurse.identity} 對應的公式 ID: {formula_id}")
            
            # 如果沒有找到有效的公式班表設定，則生成預設休假排班
            if formula_id is None or formula_id not in formula_patterns:
                print(f"護理師 {nurse.full_name} 沒有有效的公式班表設定，生成全休假排班")
                
                # 為這個護理師生成全休假排班
                for day in range(1, days_in_month + 1):
                    entry_date = date(request.year, request.month, day)
                    
                    schedule_entry = MonthlySchedule(
                        user_id=nurse.id,
                        date=entry_date,
                        shift_type='O',  # 休假
                        area_code=nurse.identity,
                        version_id=version.id
                    )
                    schedule_entries.append(schedule_entry)
                continue
            
            # 獲取該公式班表的所有patterns
            patterns = formula_patterns.get(formula_id, [])
            
            if not patterns:
                print(f"警告: 公式班表ID {formula_id} ({formula_id_to_name.get(formula_id, '未知')}) 沒有pattern定義，將使用默認休假排班")
                
                # 為這個護理師生成默認排班
                for day in range(1, days_in_month + 1):
                    entry_date = date(request.year, request.month, day)
                    
                    schedule_entry = MonthlySchedule(
                        user_id=nurse.id,
                        date=entry_date,
                        shift_type='O',  # 休假
                        area_code=nurse.identity,
                        version_id=version.id
                    )
                    schedule_entries.append(schedule_entry)
                continue
            
            # 計算pattern的最大組別數
            max_group = max(p.group_number for p in patterns)
            
            print(f"護理師 {nurse.full_name} 使用公式班表ID: {formula_id} ({formula_id_to_name.get(formula_id, '未知')}), 起始組別: {start_pattern}, 最大組別數: {max_group}")
            
            # 為這個護理師生成整月排班
            print(f"開始為護理師 {nurse.full_name} 生成 {request.year}年{request.month}月 的排班")
            print(f"  月初第一天是星期 {first_day_weekday+1}，共 {days_in_month} 天")
            print(f"  使用公式班表ID: {formula_id}，起始pattern組: {start_pattern}，最大pattern組數: {max_group}")
            
            for day in range(1, days_in_month + 1):
                entry_date = date(request.year, request.month, day)
                
                # 計算當前日期是一週中的第幾天 (0=週一, 6=週日)
                day_of_week = entry_date.weekday()
                
                # 計算第一天到當前日期過了多少周（向下取整，第一周從0開始）
                current_week = ((day - 1) + first_day_weekday) // 7
                
                # 根據周數確定當前使用的pattern組
                # 從起始pattern組開始，每過一周增加1，循環使用
                current_pattern = (start_pattern + current_week - 1) % max_group
                if current_pattern == 0:
                    current_pattern = max_group  # 如果餘數為0，則使用最大組別
                
                # 查找對應的pattern
                pattern = next((p for p in patterns if p.group_number == current_pattern), None)
                
                # 默認班次為休息
                shift_type = 'O'
                
                if pattern and pattern.pattern:
                    # pattern字串通常格式為"DDDAAOO"，表示週一到週日的班次
                    pattern_str = pattern.pattern
                    
                    # 獲取當天對應的班次，注意pattern中的第一個字符代表週一
                    if 0 <= day_of_week < len(pattern_str):
                        shift_type = pattern_str[day_of_week]
                        # 移除日誌限制條件，顯示每天的排班信息
                        print(f"  日期: {entry_date.strftime('%Y-%m-%d')}(星期{day_of_week+1}), 第{current_week+1}周, 使用pattern組: {current_pattern}, 班別: {shift_type}")
                    else:
                        # 如果pattern字串不夠長，默認休假
                        print(f"警告: 日期 {entry_date} 的星期 {day_of_week+1} 超出pattern長度 {len(pattern_str)}")
                
                # 創建排班記錄
                schedule_entry = MonthlySchedule(
                    user_id=nurse.id,
                    date=entry_date,
                    shift_type=shift_type,
                    area_code=nurse.identity,
                    version_id=version.id
                )
                schedule_entries.append(schedule_entry)
        
        # 批量添加排班記錄
        db.add_all(schedule_entries)
        db.commit()
        
        # 添加操作日誌
        log = Log(
            user_id=current_user.id,
            action="generate_schedule",
            operation_type="generate_schedule",
            description=f"生成 {request.year}年{request.month}月排班表，共 {len(schedule_entries)} 條記錄"
        )
        db.add(log)
        db.commit()
        
        return {
            "success": True,
            "message": f"成功生成 {request.year}年{request.month}月排班表",
            "version_id": version.id,
            "entries_count": len(schedule_entries)
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        print(f"生成排班表時發生錯誤: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"獲取排班表時發生錯誤: {str(e)}"
        )

@router.get("/schedules/monthly/{year}/{month}", response_model=Dict[str, Any])
async def get_monthly_schedule(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """獲取特定月份的排班表"""
    try:
        # 確保年月有效
        if month < 1 or month > 12:
            raise ValueError("月份必須在1至12之間")
        
        month_str = f"{year}{month:02d}"
        
        # 獲取該月份的排班版本
        version = db.query(ScheduleVersion).filter(
            ScheduleVersion.month == month_str
        ).first()
        
        if not version:
            # 返回新的格式結構，但保持為空
            return {
                "success": False,
                "message": f"找不到 {year}年{month}月的排班表",
                "data": {
                    [year]: {
                        [month]: {
                            "year": year,
                            "month": month,
                            "schedule": []
                        }
                    }
                }
            }
        
        # 獲取所有排班記錄
        schedules = db.query(MonthlySchedule).filter(
            MonthlySchedule.version_id == version.id
        ).all()
        
        # 獲取所有相關的護理師信息
        user_ids = set([s.user_id for s in schedules])
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        users_dict = {user.id: user for user in users}
        
        # 處理排班數據，按護理師分組
        schedules_by_user = {}
        for schedule in schedules:
            user_id = schedule.user_id
            if user_id not in schedules_by_user:
                user = users_dict.get(user_id)
                # 從 User 模型的 last_login_ip 欄位獲取 formula_group
                formula_group = 0
                if user and user.last_login_ip and user.last_login_ip.isdigit():
                    formula_group = int(user.last_login_ip)
                
                schedules_by_user[user_id] = {
                    "id": user_id,
                    "name": user.full_name if user else f"User {user_id}",
                    "role": user.role if user else "member",
                    "identity": user.identity if user else "",
                    "group": formula_group,
                    "shifts": ["O"] * 31,  # 最大31天，用O填充
                    "vacationDays": 0,
                    "accumulatedLeave": 0
                }
            
            # 獲取日期的天數部分 (1-31)
            day = schedule.date.day - 1  # 轉為0-based索引
            
            # 確保不會超出數組範圍
            if 0 <= day < 31:
                schedules_by_user[user_id]["shifts"][day] = schedule.shift_type
        
        # 將字典轉換為數組，並修剪shifts到當月實際天數
        import calendar
        days_in_month = calendar.monthrange(year, month)[1]
        
        schedule_list = []
        for user_id, user_data in schedules_by_user.items():
            user_data["shifts"] = user_data["shifts"][:days_in_month]
            schedule_list.append(user_data)
        
        # 按組別和姓名排序
        schedule_list.sort(key=lambda x: (x["group"], x["name"]))
        
        # 按照要求的格式構建返回結果
        result = {
            "success": True,
            "message": f"成功獲取 {year}年{month}月排班表",
            "data": {
                str(year): {
                    str(month): {
                        "year": year,
                        "month": month,
                        "schedule": schedule_list
                    }
                }
            }
        }
        
        return result
    
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        print(f"獲取排班表時發生錯誤: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"獲取排班表時發生錯誤: {str(e)}"
        )

@router.put("/schedules/{schedule_id}", response_model=MonthlyScheduleSchema)
async def update_schedule(
    schedule_id: int,
    schedule_update: MonthlyScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """更新特定排班記錄（僅護理長可操作）"""
    db_schedule = db.query(MonthlySchedule).filter(
        MonthlySchedule.id == schedule_id
    ).first()
    
    if not db_schedule:
        raise HTTPException(
            status_code=404,
            detail="排班記錄不存在"
        )
    
    # 更新排班記錄
    update_data = schedule_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_schedule, field, value)
    
    db.commit()
    db.refresh(db_schedule)
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        action="update_schedule",
        operation_type="update_schedule",
        description=f"更新排班記錄: ID {schedule_id}, 護理師ID {db_schedule.user_id}, 日期 {db_schedule.date}"
    )
    db.add(log)
    db.commit()
    
    return db_schedule

@router.post("/schedules/versions/{version_id}/publish", response_model=ScheduleVersionSchema)
async def publish_schedule_version(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """發布排班表版本（僅護理長可操作）"""
    db_version = db.query(ScheduleVersion).filter(
        ScheduleVersion.id == version_id
    ).first()
    
    if not db_version:
        raise HTTPException(
            status_code=404,
            detail="排班表版本不存在"
        )
    
    # 更新為已發布狀態
    db_version.is_published = True
    db_version.published_at = datetime.now()
    db_version.published_by = current_user.id
    
    db.commit()
    db.refresh(db_version)
    
    # 添加操作日誌
    log = Log(
        user_id=current_user.id,
        action="publish_schedule",
        operation_type="publish_schedule",
        description=f"發布排班表版本: {db_version.version_number}, 月份 {db_version.month}"
    )
    db.add(log)
    db.commit()
    
    return db_version

@router.post("/schedules/versions/compare")
async def compare_versions(
    version_id1: int,
    version_id2: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """比較兩個版本之間的差異"""
    try:
        # 檢查兩個版本是否存在
        version1 = db.query(ScheduleVersion).filter(ScheduleVersion.id == version_id1).first()
        version2 = db.query(ScheduleVersion).filter(ScheduleVersion.id == version_id2).first()
        
        if not version1 or not version2:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="找不到指定的版本"
            )
        
        # 檢查兩個版本是否屬於同一個月份
        if version1.month != version2.month:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="只能比較相同月份的版本"
            )
        
        # 獲取兩個版本的排班記錄
        version1_schedules = db.query(MonthlySchedule).filter(MonthlySchedule.version_id == version_id1).all()
        version2_schedules = db.query(MonthlySchedule).filter(MonthlySchedule.version_id == version_id2).all()
        
        # 將排班記錄轉換為字典，方便比較
        version1_dict = {}
        for schedule in version1_schedules:
            key = f"{schedule.user_id}_{schedule.date}"
            version1_dict[key] = {
                "id": schedule.id,
                "user_id": schedule.user_id,
                "date": schedule.date.isoformat(),
                "shift_type": schedule.shift_type,
                "area_code": schedule.area_code,
                "work_time": schedule.work_time
            }
        
        version2_dict = {}
        for schedule in version2_schedules:
            key = f"{schedule.user_id}_{schedule.date}"
            version2_dict[key] = {
                "id": schedule.id,
                "user_id": schedule.user_id,
                "date": schedule.date.isoformat(),
                "shift_type": schedule.shift_type,
                "area_code": schedule.area_code,
                "work_time": schedule.work_time
            }
        
        # 計算差異
        diff_items = []
        all_keys = set(list(version1_dict.keys()) + list(version2_dict.keys()))
        
        for key in all_keys:
            if key in version1_dict and key in version2_dict:
                v1 = version1_dict[key]
                v2 = version2_dict[key]
                
                if (v1["shift_type"] != v2["shift_type"] or 
                    v1["area_code"] != v2["area_code"] or 
                    v1["work_time"] != v2["work_time"]):
                    
                    user = db.query(User).filter(User.id == v1["user_id"]).first()
                    user_name = user.full_name if user else None
                    
                    diff_items.append({
                        "type": "modified",
                        "user_id": v1["user_id"],
                        "user_name": user_name,
                        "date": v1["date"],
                        "version1_value": v1["shift_type"],
                        "version2_value": v2["shift_type"]
                    })
            elif key in version1_dict:
                v1 = version1_dict[key]
                user = db.query(User).filter(User.id == v1["user_id"]).first()
                user_name = user.full_name if user else None
                
                diff_items.append({
                    "type": "deleted",
                    "user_id": v1["user_id"],
                    "user_name": user_name,
                    "date": v1["date"],
                    "version1_value": v1["shift_type"],
                    "version2_value": None
                })
            else:  # key in version2_dict
                v2 = version2_dict[key]
                user = db.query(User).filter(User.id == v2["user_id"]).first()
                user_name = user.full_name if user else None
                
                diff_items.append({
                    "type": "added",
                    "user_id": v2["user_id"],
                    "user_name": user_name,
                    "date": v2["date"],
                    "version1_value": None,
                    "version2_value": v2["shift_type"]
                })
        
        # 按日期排序
        diff_items.sort(key=lambda x: x["date"])
        
        # 返回比較結果
        return {
            "version1": {
                "id": version1.id,
                "version_number": version1.version_number,
                "published_at": version1.published_at
            },
            "version2": {
                "id": version2.id,
                "version_number": version2.version_number,
                "published_at": version2.published_at
            },
            "diff": {
                "items": diff_items,
                "added": [item for item in diff_items if item["type"] == "added"],
                "modified": [item for item in diff_items if item["type"] == "modified"],
                "deleted": [item for item in diff_items if item["type"] == "deleted"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"比較版本時出錯: {str(e)}"
        )

@router.post("/schedules/updateShift", response_model=Dict[str, Any])
async def update_shift(
    shift_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)  # 只允許護理長和管理員更新
):
    """更新單一護理師的單日班次，不創建新版本"""
    
    # 驗證請求數據
    user_id = shift_data.get("user_id")
    date_str = shift_data.get("date")
    shift_type = shift_data.get("shift_type")
    create_version = shift_data.get("create_version", False)
    
    if not user_id or not date_str or not shift_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少必要數據：user_id、date 或 shift_type"
        )
    
    try:
        # 轉換日期字符串為日期對象
        schedule_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="日期格式錯誤，應為YYYY-MM-DD"
        )
    
    # 檢查用戶是否存在
    nurse = db.query(User).filter(User.id == user_id).first()
    if not nurse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到ID為 {user_id} 的護理師"
        )
    
    # 獲取年月
    year = schedule_date.year
    month = schedule_date.month
    month_str = f"{year}{month:02d}"
    
    # 查找當前最新版本
    latest_version = db.query(ScheduleVersion).filter(
        ScheduleVersion.month == month_str
    ).order_by(ScheduleVersion.id.desc()).first()
    
    if not latest_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 {year}年{month}月 的排班表，請先生成排班表"
        )
    
    # 查找現有排班記錄
    schedule_entry = db.query(MonthlySchedule).filter(
        MonthlySchedule.user_id == user_id,
        MonthlySchedule.date == schedule_date,
        MonthlySchedule.version_id == latest_version.id
    ).first()
    
    # 更新記錄日誌
    log_action = "更新"
    old_shift_type = None
    
    if schedule_entry:
        old_shift_type = schedule_entry.shift_type
        schedule_entry.shift_type = shift_type
        schedule_entry.updated_at = datetime.now()
        
        # 如果有area_code，更新它
        if "area_code" in shift_data and shift_data["area_code"] is not None:
            schedule_entry.area_code = shift_data["area_code"]
    else:
        # 創建新記錄
        log_action = "創建"
        schedule_entry = MonthlySchedule(
            user_id=user_id,
            date=schedule_date,
            shift_type=shift_type,
            area_code=shift_data.get("area_code"),
            version_id=latest_version.id
        )
        db.add(schedule_entry)
    
    # 創建日誌記錄
    log_entry = Log(
        action=f"{log_action}排班記錄",
        description=f"護理師: {nurse.full_name}, 日期: {date_str}, 班次: {old_shift_type if old_shift_type else '無'} -> {shift_type}",
        user_id=current_user.id
    )
    db.add(log_entry)
    
    db.commit()
    db.refresh(schedule_entry)
    
    return {
        "success": True,
        "message": f"成功{log_action}排班記錄",
        "data": {
            "id": schedule_entry.id,
            "user_id": schedule_entry.user_id,
            "date": schedule_entry.date.strftime('%Y-%m-%d'),
            "shift_type": schedule_entry.shift_type,
            "area_code": schedule_entry.area_code
        }
    }

@router.post("/schedules/saveMonth", response_model=Dict[str, Any])
async def save_monthly_schedule(
    schedule_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)  # 只允許護理長和管理員保存
):
    """保存月度排班表並創建新版本"""
    
    # 驗證請求數據
    year = schedule_data.get("year")
    month = schedule_data.get("month")
    schedule_data_list = schedule_data.get("schedule_data", [])
    timestamp = schedule_data.get("timestamp")
    version_note = schedule_data.get("version_note")
    create_version = schedule_data.get("create_version", True)
    
    if not year or not month or not schedule_data_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少必要數據：year、month 或 schedule_data"
        )
    
    # 格式化年月字符串
    month_str = f"{year}{month:02d}"
    
    # 查找當前最新版本
    latest_version = db.query(ScheduleVersion).filter(
        ScheduleVersion.month == month_str
    ).order_by(ScheduleVersion.id.desc()).first()
    
    if not latest_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 {year}年{month}月 的排班表，請先生成排班表"
        )
    
    # 創建新版本（如果需要）
    if create_version:
        # 獲取現有版本數量
        version_count = db.query(ScheduleVersion).filter(
            ScheduleVersion.month == month_str
        ).count()
        
        # 創建新版本號
        new_version_number = f"v{version_count + 1}.0_{month_str}"
        
        # 使用默認版本說明（如果未提供）
        if not version_note:
            version_note = f"{current_user.full_name}於{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}保存的{year}年{month}月排班表"
        
        # 創建新版本
        new_version = ScheduleVersion(
            version_number=new_version_number,
            month=month_str,
            published_at=datetime.now(),
            notes=version_note,
            is_published=True,  # 直接發布
            published_by=current_user.id,
            is_base_version=False
        )
        db.add(new_version)
        db.commit()
        db.refresh(new_version)
        
        # 將所有排班記錄複製到新版本
        for schedule_item in schedule_data_list:
            user_id = schedule_item.get("user_id")
            shifts = schedule_item.get("shifts", [])
            area_codes = schedule_item.get("area_codes", [])
            
            # 檢查用戶是否存在
            nurse = db.query(User).filter(User.id == user_id).first()
            if not nurse:
                continue  # 跳過無效用戶
            
            # 為每天創建排班記錄
            for day, shift in enumerate(shifts, 1):
                try:
                    # 創建日期
                    schedule_date = date(year, month, day)
                    
                    # 獲取area_code（如果有）
                    area_code = area_codes[day-1] if len(area_codes) >= day else None
                    
                    # 創建排班記錄
                    schedule_entry = MonthlySchedule(
                        user_id=user_id,
                        date=schedule_date,
                        shift_type=shift,
                        area_code=area_code,
                        version_id=new_version.id
                    )
                    db.add(schedule_entry)
                except Exception as e:
                    print(f"處理護理師 {user_id} 於 {year}-{month}-{day} 的排班記錄時出錯: {str(e)}")
                    continue
        
        # 創建日誌記錄
        log_entry = Log(
            action="保存月度排班表",
            description=f"{current_user.full_name}保存了{year}年{month}月排班表，創建了新版本 {new_version_number}",
            user_id=current_user.id
        )
        db.add(log_entry)
        
        db.commit()
        
        # 計算與基礎版本的差異並保存（如果有基礎版本）
        base_version = db.query(ScheduleVersion).filter(
            ScheduleVersion.month == month_str,
            ScheduleVersion.is_base_version == True
        ).first()
        
        if base_version and base_version.id != new_version.id:
            try:
                # 調用計算差異的函數
                await calculate_and_save_version_diff(
                    version_id=new_version.id,
                    base_version_id=base_version.id,
                    db=db,
                    current_user=current_user
                )
            except Exception as e:
                print(f"計算版本差異時出錯: {str(e)}")
                # 不阻止保存過程繼續
        
        return {
            "success": True,
            "message": f"已成功保存{year}年{month}月排班表並創建新版本 {new_version_number}",
            "data": {
                "version_id": new_version.id,
                "version_number": new_version.version_number,
                "published_at": new_version.published_at
            }
        }
    else:
        # 不創建新版本，直接更新現有版本
        # 清空現有排班記錄
        db.query(MonthlySchedule).filter(
            MonthlySchedule.version_id == latest_version.id
        ).delete()
        
        # 重新創建排班記錄
        for schedule_item in schedule_data_list:
            user_id = schedule_item.get("user_id")
            shifts = schedule_item.get("shifts", [])
            area_codes = schedule_item.get("area_codes", [])
            
            # 檢查用戶是否存在
            nurse = db.query(User).filter(User.id == user_id).first()
            if not nurse:
                continue  # 跳過無效用戶
            
            # 為每天創建排班記錄
            for day, shift in enumerate(shifts, 1):
                try:
                    # 創建日期
                    schedule_date = date(year, month, day)
                    
                    # 獲取area_code（如果有）
                    area_code = area_codes[day-1] if len(area_codes) >= day else None
                    
                    # 創建排班記錄
                    schedule_entry = MonthlySchedule(
                        user_id=user_id,
                        date=schedule_date,
                        shift_type=shift,
                        area_code=area_code,
                        version_id=latest_version.id
                    )
                    db.add(schedule_entry)
                except Exception as e:
                    print(f"處理護理師 {user_id} 於 {year}-{month}-{day} 的排班記錄時出錯: {str(e)}")
                    continue
        
        # 創建日誌記錄
        log_entry = Log(
            action="更新月度排班表",
            description=f"{current_user.full_name}更新了{year}年{month}月排班表，但未創建新版本",
            user_id=current_user.id
        )
        db.add(log_entry)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"已成功更新{year}年{month}月排班表",
            "data": {
                "version_id": latest_version.id,
                "version_number": latest_version.version_number
            }
        } 

@router.post("/schedules/resetAreaCodes", response_model=Dict[str, Any])
async def reset_area_codes(
    data: Dict[str, int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)  # 只允許護理長和管理員操作
):
    """批量重置指定月份所有排班記錄的area_code為NULL"""
    try:
        # 從請求體中獲取年月
        year = data.get("year")
        month = data.get("month")
        
        if not year or not month:
            raise ValueError("缺少必要參數：year和month")
        
        # 確保年月有效
        if month < 1 or month > 12:
            raise ValueError("月份必須在1至12之間")
        
        month_str = f"{year}{month:02d}"
        
        # 獲取該月份的排班版本
        version = db.query(ScheduleVersion).filter(
            ScheduleVersion.month == month_str
        ).first()
        
        if not version:
            return {
                "success": False,
                "message": f"找不到 {year}年{month}月的排班表",
                "reset_count": 0
            }
        
        # 使用批量SQL更新所有排班記錄的area_code
        # 使用SQLAlchemy的更新語法進行批量更新
        from sqlalchemy import update
        stmt = update(MonthlySchedule).where(
            MonthlySchedule.version_id == version.id
        ).values(area_code=None)
        
        result = db.execute(stmt)
        reset_count = result.rowcount
        
        # 添加操作日誌
        log = Log(
            user_id=current_user.id,
            action="reset_area_codes",
            operation_type="update_schedule",
            description=f"批量重置 {year}年{month}月 {reset_count} 條排班記錄的工作分配"
        )
        db.add(log)
        db.commit()
        
        return {
            "success": True,
            "message": f"成功重置 {year}年{month}月的工作分配",
            "reset_count": reset_count
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        print(f"重置工作分配時發生錯誤: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"重置工作分配時發生錯誤: {str(e)}"
        )

@router.get("/schedules/details", response_model=Dict[str, Any])
async def get_monthly_schedule_details(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """獲取特定月份的排班詳細記錄，包含所有字段"""
    try:
        # 確保年月有效
        if month < 1 or month > 12:
            raise ValueError("月份必須在1至12之間")
        
        month_str = f"{year}{month:02d}"
        
        # 獲取該月份的排班版本
        version = db.query(ScheduleVersion).filter(
            ScheduleVersion.month == month_str
        ).order_by(ScheduleVersion.id.desc()).first()
        
        if not version:
            return {
                "success": False,
                "message": f"找不到 {year}年{month}月的排班表",
                "data": []
            }
        
        # 獲取所有排班記錄
        schedules = db.query(MonthlySchedule).filter(
            MonthlySchedule.version_id == version.id
        ).all()
        
        # 轉換為字典列表
        result_data = []
        for schedule in schedules:
            result_data.append({
                "id": schedule.id,
                "user_id": schedule.user_id,
                "date": schedule.date.isoformat(),
                "shift_type": schedule.shift_type,
                "area_code": schedule.area_code,
                "version_id": schedule.version_id
            })
        
        return {
            "success": True,
            "message": f"成功獲取 {year}年{month}月排班表詳細記錄",
            "data": result_data
        }
    
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        print(f"獲取排班詳細記錄時發生錯誤: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"獲取排班詳細記錄時發生錯誤: {str(e)}"
        ) 

@router.post("/schedules/bulkUpdateAreaCodes", response_model=Dict[str, Any])
async def bulk_update_area_codes(
    updates: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)  # 只允許護理長和管理員操作
):
    """批量更新多條排班記錄的area_code"""
    try:
        if not updates:
            return {
                "success": True,
                "message": "沒有需要更新的記錄",
                "updated_count": 0
            }
        
        # 從請求中提取所有的year-month組合
        date_patterns = set()
        for update in updates:
            date_str = update.get("date")
            if date_str:
                try:
                    dt = datetime.strptime(date_str, "%Y-%m-%d")
                    date_patterns.add(f"{dt.year}{dt.month:02d}")
                except ValueError:
                    continue
        
        # 獲取所有相關月份的最新版本ID
        version_ids = {}
        for month_str in date_patterns:
            version = db.query(ScheduleVersion).filter(
                ScheduleVersion.month == month_str
            ).order_by(ScheduleVersion.id.desc()).first()
            
            if version:
                version_ids[month_str] = version.id
        
        updated_count = 0
        failed_count = 0
        
        # 更新每條記錄
        for update in updates:
            try:
                user_id = update.get("user_id")
                date_str = update.get("date")
                area_code = update.get("area_code")
                
                if not user_id or not date_str:
                    failed_count += 1
                    continue
                
                try:
                    dt = datetime.strptime(date_str, "%Y-%m-%d")
                    schedule_date = dt.date()
                    month_str = f"{dt.year}{dt.month:02d}"
                except ValueError:
                    failed_count += 1
                    continue
                
                # 獲取對應月份的版本ID
                version_id = version_ids.get(month_str)
                if not version_id:
                    failed_count += 1
                    continue
                
                # 找到對應的排班記錄
                schedule = db.query(MonthlySchedule).filter(
                    MonthlySchedule.user_id == user_id,
                    MonthlySchedule.date == schedule_date,
                    MonthlySchedule.version_id == version_id
                ).first()
                
                if not schedule:
                    failed_count += 1
                    continue
                
                # 更新area_code
                schedule.area_code = area_code
                updated_count += 1
                
            except Exception as e:
                print(f"更新記錄時發生錯誤: {str(e)}")
                failed_count += 1
        
        # 提交所有更新
        db.commit()
        
        # 添加操作日誌
        log = Log(
            user_id=current_user.id,
            action="bulk_update_area_codes",
            operation_type="update_schedule",
            description=f"批量更新 {updated_count} 條排班記錄的工作分配"
        )
        db.add(log)
        db.commit()
        
        return {
            "success": True,
            "message": f"成功更新 {updated_count} 條排班記錄的工作分配",
            "updated_count": updated_count,
            "failed_count": failed_count
        }
        
    except Exception as e:
        import traceback
        print(f"批量更新工作分配時發生錯誤: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"批量更新工作分配時發生錯誤: {str(e)}"
        ) 