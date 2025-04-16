from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any, Dict
from datetime import datetime, date
import calendar

from ..core.database import get_db
from ..core.security import get_current_active_user, get_head_nurse_user, get_current_user
from ..models.user import User
from ..models.schedule import MonthlySchedule, ScheduleVersion
from ..models.formula_schedule import FormulaSchedule, NurseFormulaAssignment
from ..models.log import Log
from ..schemas.schedule import (
    MonthlyScheduleCreate, MonthlyScheduleUpdate, MonthlySchedule as MonthlyScheduleSchema,
    ScheduleVersionCreate, ScheduleVersionUpdate, ScheduleVersion as ScheduleVersionSchema,
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
        else:
            # 創建新版本
            version = ScheduleVersion(
                version_number=f"v1.0_{month_str}",
                month=month_str,
                notes=request.description or f"{request.year}年{request.month}月排班表",
                is_published=False,
                published_by=current_user.id
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
                    import json
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
        operation_type="publish_schedule",
        description=f"發布排班表版本: {db_version.version_number}, 月份 {db_version.month}"
    )
    db.add(log)
    db.commit()
    
    return db_version

@router.get("/schedules/details/{year}/{month}")
async def get_monthly_schedule_details(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """獲取月排班表的詳細信息（包含ID映射）"""
    try:
        # 驗證年月的有效性
        if year < 2000 or year > 2100 or month < 1 or month > 12:
            raise ValueError("無效的年月")
        
        # 構建月份字符串，例如 "202304"
        month_str = f"{year}{month:02d}"
        
        # 獲取該月份的排班版本
        version = db.query(ScheduleVersion).filter(
            ScheduleVersion.month == month_str
        ).first()
        
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
        
        # 構建詳細信息列表
        schedule_details = []
        for schedule in schedules:
            schedule_details.append({
                "id": schedule.id,
                "user_id": schedule.user_id,
                "date": schedule.date.isoformat(),
                "shift_type": schedule.shift_type,
                "area_code": schedule.area_code,
                "version_id": schedule.version_id
            })
        
        return {
            "success": True,
            "message": f"成功獲取 {year}年{month}月排班詳細信息",
            "data": schedule_details
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        print(f"獲取排班詳細信息時發生錯誤: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"獲取排班詳細信息時發生錯誤: {str(e)}"
        ) 