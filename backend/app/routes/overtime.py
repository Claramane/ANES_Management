from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta

from ..core.database import get_db
from ..core.security import get_current_active_user, get_head_nurse_user
from ..models.user import User
from ..models.overtime import OvertimeRecord
from ..models.log import Log
from ..schemas.overtime import (
    OvertimeRecordCreate,
    OvertimeRecordUpdate,
    OvertimeRecord as OvertimeRecordSchema,
    BulkOvertimeRecordCreate,
    BulkOvertimeRecordUpdate,
    MultipleDatesOvertimeUpdate
)

router = APIRouter()

# 獲取當前用戶的加班記錄
@router.get("/overtime/me", response_model=List[OvertimeRecordSchema])
async def get_my_overtime_records(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """獲取當前用戶的加班記錄"""
    query = db.query(OvertimeRecord).filter(OvertimeRecord.user_id == current_user.id)
    
    if start_date:
        query = query.filter(OvertimeRecord.date >= start_date)
    if end_date:
        query = query.filter(OvertimeRecord.date <= end_date)
        
    records = query.order_by(OvertimeRecord.date).all()
    return records

# 創建加班記錄 - 僅限護理長和admin
@router.post("/overtime", response_model=OvertimeRecordSchema)
async def create_overtime_record(
    record_in: OvertimeRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)  # 修改為僅限護理長
):
    """創建加班記錄（僅限護理長）"""
    # 檢查是否已存在該日期的記錄
    existing_record = db.query(OvertimeRecord).filter(
        OvertimeRecord.user_id == current_user.id,
        OvertimeRecord.date == record_in.date
    ).first()
    
    if existing_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"該日期 {record_in.date} 已存在加班記錄"
        )
    
    # 創建新記錄
    db_record = OvertimeRecord(
        user_id=current_user.id,
        date=record_in.date,
        overtime_shift=record_in.overtime_shift
    )
    
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    # 記錄操作日誌
    log = Log(
        user_id=current_user.id,
        action="create_overtime",
        operation_type="create",
        description=f"創建加班記錄: {record_in.date} - {record_in.overtime_shift}"
    )
    db.add(log)
    db.commit()
    
    return db_record

# 護理長：為特定用戶創建加班記錄
@router.post("/overtime/user/{user_id}", response_model=OvertimeRecordSchema)
async def create_user_overtime_record(
    user_id: int,
    record_in: OvertimeRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """為特定用戶創建加班記錄（僅護理長可操作）"""
    # 檢查用戶是否存在
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用戶不存在"
        )
    
    # 檢查是否已存在該日期的記錄
    existing_record = db.query(OvertimeRecord).filter(
        OvertimeRecord.user_id == user_id,
        OvertimeRecord.date == record_in.date
    ).first()
    
    if existing_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"該用戶在 {record_in.date} 已存在加班記錄"
        )
    
    # 創建新記錄
    db_record = OvertimeRecord(
        user_id=user_id,
        date=record_in.date,
        overtime_shift=record_in.overtime_shift
    )
    
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    # 記錄操作日誌
    log = Log(
        user_id=current_user.id,
        action="create_user_overtime",
        operation_type="create",
        description=f"為用戶 {user.username} 創建加班記錄: {record_in.date} - {record_in.overtime_shift}"
    )
    db.add(log)
    db.commit()
    
    return db_record

# 護理長：批量創建加班記錄
@router.post("/overtime/bulk", response_model=List[OvertimeRecordSchema])
async def bulk_create_overtime_records(
    bulk_records: BulkOvertimeRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """批量創建加班記錄（僅護理長可操作）"""
    user_id = bulk_records.user_id or current_user.id
    
    # 檢查用戶是否存在
    if user_id != current_user.id:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用戶不存在"
            )
    
    created_records = []
    for record_data in bulk_records.records:
        # 檢查是否已存在該日期的記錄
        existing_record = db.query(OvertimeRecord).filter(
            OvertimeRecord.user_id == user_id,
            OvertimeRecord.date == record_data.date
        ).first()
        
        if existing_record:
            # 更新現有記錄
            existing_record.overtime_shift = record_data.overtime_shift
            existing_record.updated_at = datetime.now()
            db.commit()
            db.refresh(existing_record)
            created_records.append(existing_record)
        else:
            # 創建新記錄
            db_record = OvertimeRecord(
                user_id=user_id,
                date=record_data.date,
                overtime_shift=record_data.overtime_shift
            )
            db.add(db_record)
            db.commit()
            db.refresh(db_record)
            created_records.append(db_record)
    
    # 記錄操作日誌
    log = Log(
        user_id=current_user.id,
        action="bulk_create_overtime",
        operation_type="create",
        description=f"批量創建加班記錄: {len(created_records)} 條記錄"
    )
    db.add(log)
    db.commit()
    
    return created_records

# 護理長：整月批量更新加班記錄
@router.put("/overtime/bulk-month", response_model=int)
async def bulk_month_update_overtime_records(
    updates: MultipleDatesOvertimeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """批量更新多個日期的加班記錄（僅護理長可操作）"""
    total_updated_count = 0
    
    print(f"處理整月加班批量更新: 共 {len(updates.records)} 條更新記錄")
    
    # 收集所有需要更新的用戶ID和日期，用於清理舊數據
    all_user_ids = set()
    all_dates = set()
    
    # 先分析所有記錄，收集用戶ID和日期信息
    for record in updates.records:
        try:
            date_str = record.get('date')
            user_ids = record.get('user_ids', [])
            
            if not date_str or not user_ids:
                continue
                
            # 解析日期
            try:
                update_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                all_dates.add(update_date)
                
                # 添加用戶ID
                for user_id in user_ids:
                    all_user_ids.add(user_id)
            except ValueError:
                continue
        except Exception as e:
            print(f"分析記錄時出錯: {str(e)}")
            continue
    
    # 如果有收集到日期和用戶，先清理整月的加班記錄
    if all_dates and all_user_ids:
        # 獲取月份的第一天和最後一天
        first_date = min(all_dates)
        last_date = max(all_dates)
        month_start = datetime(first_date.year, first_date.month, 1).date()
        month_end = (datetime(first_date.year, first_date.month + 1, 1) - timedelta(days=1)).date()
        
        print(f"正在清理 {month_start} 到 {month_end} 期間的加班記錄...")
        
        # 刪除該月份所有相關用戶的加班記錄
        delete_count = db.query(OvertimeRecord).filter(
            OvertimeRecord.user_id.in_(list(all_user_ids)),
            OvertimeRecord.date >= month_start,
            OvertimeRecord.date <= month_end
        ).delete(synchronize_session=False)
        
        print(f"已刪除 {delete_count} 條舊的加班記錄")
    
    # 記錄操作日誌
    log = Log(
        user_id=current_user.id,
        action="bulk_month_update_overtime",
        operation_type="update",
        description=f"批量更新多個日期的加班記錄: {len(updates.records)} 個批次"
    )
    db.add(log)
    
    # 迭代每個更新記錄
    for record in updates.records:
        try:
            date_str = record.get('date')
            overtime_shift = record.get('overtime_shift')
            user_ids = record.get('user_ids', [])
            
            # 參數驗證
            if not date_str or not user_ids:
                continue
                
            # 解析日期
            try:
                update_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                continue
                
            # 處理overtime_shift的值
            if overtime_shift == "null" or overtime_shift == "undefined" or overtime_shift is None:
                overtime_shift = ""
            
            # 更新用戶記錄
            batch_updated = 0
            for user_id in user_ids:
                # 檢查用戶是否存在
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    continue
                
                # 由於已刪除舊記錄，直接創建新記錄
                if overtime_shift:  # 只有當班次不為空時才創建記錄
                    record = OvertimeRecord(
                        user_id=user_id,
                        date=update_date,
                        overtime_shift=overtime_shift
                    )
                    db.add(record)
                    batch_updated += 1
            
            total_updated_count += batch_updated
            
        except Exception as e:
            print(f"處理批量更新時出錯: {str(e)}")
            continue
    
    # 提交所有更改
    db.commit()
    
    return total_updated_count

# 更新加班記錄 - 僅限護理長和admin
@router.put("/overtime/{record_id}", response_model=OvertimeRecordSchema)
async def update_overtime_record(
    record_id: int,
    record_in: OvertimeRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)  # 修改為僅限護理長
):
    """更新加班記錄（僅限護理長）"""
    db_record = db.query(OvertimeRecord).filter(OvertimeRecord.id == record_id).first()
    
    if not db_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="加班記錄不存在"
        )
    
    # 更新記錄
    db_record.overtime_shift = record_in.overtime_shift
    db_record.updated_at = datetime.now()
    
    db.commit()
    db.refresh(db_record)
    
    # 記錄操作日誌
    log = Log(
        user_id=current_user.id,
        action="update_overtime",
        operation_type="update",
        description=f"更新加班記錄 ID: {record_id} - {db_record.date} - {db_record.overtime_shift}"
    )
    db.add(log)
    db.commit()
    
    return db_record

# 刪除加班記錄 - 僅限護理長和admin
@router.delete("/overtime/{record_id}", response_model=OvertimeRecordSchema)
async def delete_overtime_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)  # 修改為僅限護理長
):
    """刪除加班記錄（僅限護理長）"""
    db_record = db.query(OvertimeRecord).filter(OvertimeRecord.id == record_id).first()
    
    if not db_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="加班記錄不存在"
        )
    
    # 記錄操作日誌
    log = Log(
        user_id=current_user.id,
        action="delete_overtime",
        operation_type="delete",
        description=f"刪除加班記錄 ID: {record_id} - {db_record.date} - {db_record.overtime_shift}"
    )
    db.add(log)
    
    # 刪除記錄
    db.delete(db_record)
    db.commit()
    
    return db_record

# 以下是護理長專用功能 ----------------------------------------

# 護理長：獲取所有加班記錄
@router.get("/overtime", response_model=List[OvertimeRecordSchema])
async def get_all_overtime_records(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_head_nurse_user)
):
    """獲取所有加班記錄（僅護理長可操作）"""
    query = db.query(OvertimeRecord)
    
    if user_id:
        query = query.filter(OvertimeRecord.user_id == user_id)
    if start_date:
        query = query.filter(OvertimeRecord.date >= start_date)
    if end_date:
        query = query.filter(OvertimeRecord.date <= end_date)
        
    records = query.order_by(OvertimeRecord.date).all()
    return records 