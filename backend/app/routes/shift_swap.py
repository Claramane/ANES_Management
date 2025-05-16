from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List, Optional, Dict, Any
from datetime import datetime, date

from ..core.database import get_db
from ..models.shift_swap import ShiftSwapRequest, ShiftRule
from ..schemas.shift_swap import (
    ShiftSwapRequest as ShiftSwapRequestSchema,
    ShiftSwapRequestCreate,
    ShiftSwapRequestUpdate,
    ShiftSwapRequestFull,
    ShiftRule as ShiftRuleSchema,
    ShiftRuleCreate,
    ShiftRuleUpdate,
    ValidateSwapRequest
)
from ..core.security import get_current_active_user as get_current_user, get_shift_swap_privileged_user
from ..models.user import User

router = APIRouter(
    prefix="/shift-swap",
    tags=["shift_swap"],
    responses={404: {"description": "未找到"}},
)

# 獲取所有換班請求
@router.get("/", response_model=List[ShiftSwapRequestFull])
async def get_all_shift_swaps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """
    獲取所有換班請求
    """
    requests = db.query(ShiftSwapRequest).offset(skip).limit(limit).all()
    
    # 處理響應，添加相關信息
    result = []
    for req in requests:
        # 獲取請求者信息
        requestor = db.query(User).filter(User.id == req.requestor_id).first()
        requestor_info = None
        if requestor:
            requestor_info = {
                "id": requestor.id,
                "full_name": requestor.full_name,
                "identity": requestor.identity
            }
        
        # 獲取接受者信息
        acceptor_info = None
        if req.acceptor_id:
            acceptor = db.query(User).filter(User.id == req.acceptor_id).first()
            if acceptor:
                acceptor_info = {
                    "id": acceptor.id,
                    "full_name": acceptor.full_name,
                    "identity": acceptor.identity
                }
        
        # 構建響應
        request_data = {
            "id": req.id,
            "requestor_id": req.requestor_id,
            "acceptor_id": req.acceptor_id,
            "from_date": req.from_date,
            "from_shift": req.from_shift,
            "from_mission": req.from_mission,
            "from_overtime": req.from_overtime,
            "to_date": req.to_date,
            "to_shift": req.to_shift,
            "to_mission": req.to_mission,
            "to_overtime": req.to_overtime,
            "target_nurse_id": req.target_nurse_id,
            "swap_type": req.swap_type,
            "notes": req.notes,
            "status": req.status,
            "validation_result": req.validation_result,
            "validation_message": req.validation_message,
            "created_at": req.created_at,
            "updated_at": req.updated_at,
            "requestor": requestor_info,
            "acceptor": acceptor_info
        }
        
        result.append(request_data)
    
    return result

# 獲取當前用戶的換班請求
@router.get("/me", response_model=List[ShiftSwapRequestFull])
async def get_my_shift_swaps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取當前用戶的換班請求
    """
    requests = db.query(ShiftSwapRequest).filter(
        (ShiftSwapRequest.requestor_id == current_user.id) | 
        (ShiftSwapRequest.acceptor_id == current_user.id)
    ).all()
    
    # 處理響應
    result = []
    for req in requests:
        # 獲取請求者信息
        requestor = db.query(User).filter(User.id == req.requestor_id).first()
        requestor_info = None
        if requestor:
            requestor_info = {
                "id": requestor.id,
                "full_name": requestor.full_name,
                "identity": requestor.identity
            }
        
        # 獲取接受者信息
        acceptor_info = None
        if req.acceptor_id:
            acceptor = db.query(User).filter(User.id == req.acceptor_id).first()
            if acceptor:
                acceptor_info = {
                    "id": acceptor.id,
                    "full_name": acceptor.full_name,
                    "identity": acceptor.identity
                }
        
        # 構建響應
        request_data = {
            "id": req.id,
            "requestor_id": req.requestor_id,
            "acceptor_id": req.acceptor_id,
            "from_date": req.from_date,
            "from_shift": req.from_shift,
            "from_mission": req.from_mission,
            "from_overtime": req.from_overtime,
            "to_date": req.to_date,
            "to_shift": req.to_shift,
            "to_mission": req.to_mission,
            "to_overtime": req.to_overtime,
            "target_nurse_id": req.target_nurse_id,
            "swap_type": req.swap_type,
            "notes": req.notes,
            "status": req.status,
            "validation_result": req.validation_result,
            "validation_message": req.validation_message,
            "created_at": req.created_at,
            "updated_at": req.updated_at,
            "requestor": requestor_info,
            "acceptor": acceptor_info
        }
        
        result.append(request_data)
    
    return result

# 獲取可用的月份
@router.get("/available-months", response_model=List[str])
def get_available_months(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 這裡需要根據你的系統設計返回可用的月份
    # 可能是從排班表或其他相關表中獲取
    # 簡單示例：返回最近三個月
    today = date.today()
    months = [
        f"{today.year}-{today.month:02d}",
        f"{today.year if today.month > 1 else today.year - 1}-{(today.month - 1) if today.month > 1 else 12:02d}",
        f"{today.year if today.month > 2 else today.year - 1}-{(today.month - 2) if today.month > 2 else (12 - (2 - today.month)):02d}"
    ]
    return months

# 驗證換班請求
@router.post("/validate", response_model=dict)
def validate_shift_swap(
    validation_data: ValidateSwapRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    request = db.query(ShiftSwapRequest).filter(ShiftSwapRequest.id == validation_data.request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="換班請求不存在")
    
    # 實現驗證邏輯
    # 這裡應該檢查各種換班規則，例如是否符合休息時間要求，是否超過每週/每月最大班數等
    # 如果需要檢查的規則較複雜，可以將邏輯提取到單獨的服務中
    
    # 簡單的示例驗證
    is_valid = True
    validation_message = "符合換班規則"
    
    # 更新驗證結果
    request.validation_result = is_valid
    request.validation_message = validation_message
    db.commit()
    db.refresh(request)
    
    return {
        "is_valid": is_valid,
        "message": validation_message
    }

# 獲取所有班別規則
@router.get("/rules", response_model=List[ShiftRuleSchema])
async def get_shift_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """
    獲取所有班別規則
    """
    rules = db.query(ShiftRule).filter(ShiftRule.is_active == True).offset(skip).limit(limit).all()
    return rules

# 創建班別規則
@router.post("/rules", response_model=ShiftRuleSchema, status_code=status.HTTP_201_CREATED)
async def create_shift_rule(
    rule: ShiftRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    創建新的班別規則
    """
    # 檢查權限 - 只有管理員可以創建規則
    if current_user.role != "admin" and current_user.role != "head_nurse":
        raise HTTPException(status_code=403, detail="無權限執行此操作")
    
    try:
        # 創建新規則
        new_rule = ShiftRule(**rule.dict())
        
        db.add(new_rule)
        db.commit()
        db.refresh(new_rule)
        
        return new_rule
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"無法創建班別規則: {str(e)}")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}")

# 更新班別規則
@router.put("/rules/{rule_id}", response_model=ShiftRuleSchema)
async def update_shift_rule(
    rule_id: int,
    rule_update: ShiftRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新班別規則
    """
    # 檢查權限 - 只有管理員可以更新規則
    if current_user.role != "admin" and current_user.role != "head_nurse":
        raise HTTPException(status_code=403, detail="無權限執行此操作")
    
    db_rule = db.query(ShiftRule).filter(ShiftRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="班別規則不存在")
    
    try:
        # 更新規則
        update_data = rule_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_rule, key, value)
        
        db.commit()
        db.refresh(db_rule)
        
        return db_rule
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"無法更新班別規則: {str(e)}")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}")

# 刪除班別規則（邏輯刪除）
@router.delete("/rules/{rule_id}", status_code=status.HTTP_200_OK)
async def delete_shift_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    刪除班別規則（邏輯刪除）
    """
    # 檢查權限 - 只有管理員可以刪除規則
    if current_user.role != "admin" and current_user.role != "head_nurse":
        raise HTTPException(status_code=403, detail="無權限執行此操作")
    
    db_rule = db.query(ShiftRule).filter(ShiftRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="班別規則不存在")
    
    try:
        # 邏輯刪除
        db_rule.is_active = False
        
        db.commit()
        
        return {"success": True, "message": "班別規則已刪除"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}")

# 創建換班請求
@router.post("/", response_model=ShiftSwapRequestSchema)
async def create_shift_swap(
    request: ShiftSwapRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    創建新的換班請求
    """
    try:
        # 創建新請求
        new_request = ShiftSwapRequest(
            requestor_id=current_user.id,
            from_date=request.from_date,
            from_shift=request.from_shift,
            to_date=request.to_date,
            to_shift=request.to_shift,
            swap_type=request.swap_type,
            target_nurse_id=request.target_nurse_id,
            from_mission=request.from_mission,
            to_mission=request.to_mission,
            from_overtime=request.from_overtime,
            to_overtime=request.to_overtime,
            notes=request.notes,
            status="pending"
        )
        
        db.add(new_request)
        db.commit()
        db.refresh(new_request)
        
        return new_request
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"無法創建換班請求: {str(e)}")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}")

# 獲取單個換班請求
@router.get("/{request_id}", response_model=ShiftSwapRequestFull)
async def get_shift_swap(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    獲取特定換班請求的詳細信息
    """
    request = db.query(ShiftSwapRequest).filter(ShiftSwapRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="換班請求不存在")
    
    # 獲取請求者信息
    requestor = db.query(User).filter(User.id == request.requestor_id).first()
    requestor_info = None
    if requestor:
        requestor_info = {
            "id": requestor.id,
            "full_name": requestor.full_name,
            "identity": requestor.identity
        }
    
    # 獲取接受者信息
    acceptor_info = None
    if request.acceptor_id:
        acceptor = db.query(User).filter(User.id == request.acceptor_id).first()
        if acceptor:
            acceptor_info = {
                "id": acceptor.id,
                "full_name": acceptor.full_name,
                "identity": acceptor.identity
            }
    
    # 獲取目標護理師信息(如果有指定)
    target_nurse_info = None
    if request.target_nurse_id:
        target_nurse = db.query(User).filter(User.id == request.target_nurse_id).first()
        if target_nurse:
            target_nurse_info = {
                "id": target_nurse.id,
                "full_name": target_nurse.full_name,
                "identity": target_nurse.identity
            }
    
    # 構建響應
    result = {
        "id": request.id,
        "requestor_id": request.requestor_id,
        "acceptor_id": request.acceptor_id,
        "from_date": request.from_date,
        "from_shift": request.from_shift,
        "from_mission": request.from_mission,
        "from_overtime": request.from_overtime,
        "to_date": request.to_date,
        "to_shift": request.to_shift,
        "to_mission": request.to_mission,
        "to_overtime": request.to_overtime,
        "target_nurse_id": request.target_nurse_id,
        "swap_type": request.swap_type,
        "notes": request.notes,
        "status": request.status,
        "validation_result": request.validation_result,
        "validation_message": request.validation_message,
        "created_at": request.created_at,
        "updated_at": request.updated_at,
        "accepted_at": request.accepted_at,
        "requestor": requestor_info,
        "acceptor": acceptor_info,
        "target_nurse": target_nurse_info
    }
    
    return result

# 更新換班請求
@router.put("/{request_id}", response_model=ShiftSwapRequestSchema)
async def update_shift_swap(
    request_id: int,
    request_update: ShiftSwapRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新換班請求
    """
    db_request = db.query(ShiftSwapRequest).filter(ShiftSwapRequest.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="換班請求不存在")
    
    # 更新權限檢查 - 考慮多種角色和身份
    # 1. 請求者可以更新自己的請求
    # 2. 管理員可以更新任何請求
    # 3. 護理長可以更新任何請求
    # 4. 目標護理師可以接受或拒絕指向自己的請求
    is_requester = db_request.requestor_id == current_user.id
    is_admin = current_user.role == "admin"
    is_head_nurse = current_user.role == "head_nurse"
    is_target_nurse = db_request.target_nurse_id == current_user.id
    
    if not (is_requester or is_admin or is_head_nurse or is_target_nurse):
        raise HTTPException(status_code=403, detail="無權限執行此操作")
    
    try:
        # 更新請求
        update_data = request_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_request, key, value)
        
        db.commit()
        db.refresh(db_request)
        
        return db_request
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"無法更新換班請求: {str(e)}")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}")

# 接受換班請求
@router.put("/{request_id}/accept", response_model=ShiftSwapRequestSchema)
async def accept_shift_swap(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_shift_swap_privileged_user)
):
    """
    接受換班請求
    """
    db_request = db.query(ShiftSwapRequest).filter(ShiftSwapRequest.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="換班請求不存在")
    
    # 檢查請求狀態
    if db_request.status != "pending":
        raise HTTPException(status_code=400, detail="此請求已被處理")
    
    # 禁止自己接受自己的請求
    if db_request.requestor_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能接受自己的換班請求")
    
    # 確保有權限接受請求
    # 1. 如果有指定目標護理師，則只有目標護理師可以接受
    # 2. 護理長可以接受任何請求
    # 3. 一般護理師可以接受公開的請求(無目標護理師)
    # 4. 管理員不應該接受換班請求(移除管理員權限)
    is_head_nurse = current_user.role == "head_nurse"
    is_target_nurse = db_request.target_nurse_id == current_user.id
    is_public_request = db_request.target_nurse_id is None
    
    if not (is_head_nurse or is_target_nurse or is_public_request):
        raise HTTPException(status_code=403, detail="無權限接受此換班請求")
    
    # 檢查接受者(current_user)是否有申請者想要的班別
    if db_request.swap_type == "shift":
        # 如果是班別交換，需要檢查接受者在to_date是否有from_shift的班別
        from ..models.schedule import Schedule
        
        # 查詢接受者在指定日期的排班
        acceptor_schedule = db.query(Schedule).filter(
            Schedule.user_id == current_user.id,
            Schedule.date == db_request.to_date
        ).first()
        
        if not acceptor_schedule:
            raise HTTPException(status_code=400, detail="您在指定日期沒有班別，無法進行交換")
        
        # 檢查接受者的班別是否與申請者想要交換的班別一致
        if acceptor_schedule.shift != db_request.from_shift:
            raise HTTPException(status_code=400, detail=f"您在該日期的班別({acceptor_schedule.shift})與申請者想要交換的班別({db_request.from_shift})不一致")
    
    try:
        # 更新請求
        db_request.acceptor_id = current_user.id
        db_request.status = "accepted"
        db_request.updated_at = datetime.now()
        db_request.accepted_at = datetime.now()
        
        db.commit()
        db.refresh(db_request)
        
        return db_request
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}")

# 拒絕換班請求
@router.put("/{request_id}/reject", response_model=ShiftSwapRequestSchema)
async def reject_shift_swap(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    拒絕或駁回換班請求
    """
    db_request = db.query(ShiftSwapRequest).filter(ShiftSwapRequest.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="換班請求不存在")
    
    # 檢查請求狀態
    if db_request.status not in ["pending", "accepted"]:
        raise HTTPException(status_code=400, detail="此請求無法被駁回（只能駁回待處理或已接受的請求）")
    
    # 確保有權限拒絕請求
    is_admin_or_head = current_user.role in ["admin", "head_nurse"]
    
    # 不同狀態的請求有不同的權限檢查
    if db_request.status == "pending":
        # 待處理狀態：
        # 1. 如果有指定目標護理師，則只有目標護理師可以拒絕
        # 2. 護理長和管理員可以拒絕任何請求
        if db_request.target_nurse_id and db_request.target_nurse_id != current_user.id and not is_admin_or_head:
            raise HTTPException(status_code=403, detail="您無權拒絕此換班請求")
    elif db_request.status == "accepted":
        # 已接受狀態：只有護理長和管理員可以駁回
        if not is_admin_or_head:
            raise HTTPException(status_code=403, detail="只有護理長和管理員可以駁回已接受的換班申請")
    
    # 更新狀態為rejected
    db_request.status = "rejected"
    db_request.updated_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(db_request)
        return db_request
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"數據庫錯誤: {str(e)}")

# 批量更新工作區域（為換班功能提供的路由）
@router.post("/update-areas", response_model=Dict[str, Any])
async def update_areas_for_swap(
    updates: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    批量更新護理師的工作區域代碼 - 專為換班功能提供的路由
    實際處理邏輯轉發到schedules模組
    """
    from ..routes.schedules import bulk_update_area_codes
    
    # 直接呼叫schedules模組的函數處理
    return await bulk_update_area_codes(updates, db, current_user)

# 更新班次（為換班功能提供的路由）
@router.post("/update-shift", response_model=Dict[str, Any])
async def update_shift_for_swap(
    shift_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新護理師的班次 - 專為換班功能提供的路由
    實際處理邏輯轉發到schedules模組
    """
    from ..routes.schedules import update_shift
    
    # 直接呼叫schedules模組的函數處理
    return await update_shift(shift_data, db, current_user)

# 更新加班（為換班功能提供的路由）
@router.post("/update-overtime", response_model=Dict[str, Any])
async def update_overtime_for_swap(
    overtime_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新護理師的加班 - 專為換班功能提供的路由
    實際處理邏輯轉發到overtime模組
    """
    from ..routes.overtime import bulk_create_overtime_records
    from ..schemas.overtime import BulkOvertimeRecordCreate, OvertimeRecordCreate
    from fastapi import Request, Header
    from starlette.datastructures import Headers
    
    # 將請求數據轉換為 BulkOvertimeRecordCreate 格式
    user_id = overtime_data.get("user_id")
    date_str = overtime_data.get("date")
    overtime_shift = overtime_data.get("overtime_shift")
    
    if not user_id or not date_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少必要數據：user_id 或 date"
        )
    
    try:
        # 轉換日期字符串為日期對象
        overtime_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # 構建 BulkOvertimeRecordCreate 對象
        bulk_data = BulkOvertimeRecordCreate(
            user_id=user_id,
            records=[
                OvertimeRecordCreate(
                    date=overtime_date,
                    overtime_shift=overtime_shift
                )
            ]
        )
        
        # 創建一個帶有標記的請求頭
        custom_headers = Headers({
            "X-Shift-Swap-Flow": "true",
            "Content-Type": "application/json"
        })
        
        # 呼叫 overtime 模組的批量創建函數，設置請求頭
        # 注意：FastAPI 不支持直接修改請求對象，
        # 但可以通過正確的依賴注入來解決權限問題
        return await bulk_create_overtime_records(bulk_data, db, current_user)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="日期格式錯誤，應為YYYY-MM-DD"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新加班記錄失敗: {str(e)}"
        )

# 更新整月加班（為換班功能提供的路由）
@router.post("/update-overtime-month", response_model=Dict[str, Any])
async def update_overtime_month_for_swap(
    overtime_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    整月更新護理師的加班 - 專為換班功能提供的路由
    實際處理邏輯轉發到overtime模組
    """
    from ..routes.overtime import bulk_month_update_overtime_records
    from ..schemas.overtime import MultipleDatesOvertimeUpdate
    import logging
    
    # 在函數開始即初始化 logger
    logger = logging.getLogger(__name__)
    
    try:
        # 記錄原始數據
        logger.info(f"收到的原始數據: {overtime_data}")
        
        # 處理可能的雙重嵌套
        records = overtime_data.get("records", [])
        
        # 檢查 records 是否還是一個字典且包含 records 字段（雙重嵌套）
        if isinstance(records, dict) and "records" in records:
            records = records.get("records", [])
            logger.info(f"處理雙重嵌套，提取內部 records: {records}")
        
        # 驗證 records 現在是列表
        if not isinstance(records, list):
            logger.error(f"records 不是列表: {records}")
            raise ValueError(f"records 格式錯誤，應該是列表而不是 {type(records)}")
        
        # 確保每個記錄都是字典
        for i, record in enumerate(records):
            if not isinstance(record, dict):
                logger.error(f"記錄 {i} 不是字典: {record}")
                raise ValueError(f"記錄格式錯誤，應該是字典而不是 {type(record)}")
            
            # 確保必要的字段存在
            if "date" not in record or "user_ids" not in record:
                logger.error(f"記錄 {i} 缺少必要字段: {record}")
                raise ValueError(f"記錄缺少必要字段 'date' 或 'user_ids': {record}")
        
        # 創建符合模型的數據對象
        updates = MultipleDatesOvertimeUpdate(records=records)
        
        # 呼叫 overtime 模組的整月更新函數
        result = await bulk_month_update_overtime_records(updates, db, current_user)
        
        return {
            "success": True,
            "message": "成功更新加班記錄",
            "data": result
        }
    except Exception as e:
        # 記錄詳細的錯誤信息
        error_message = f"更新加班記錄失敗: {str(e)}"
        logger.error(error_message)
        logger.error(f"收到的數據: {overtime_data}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message
        )