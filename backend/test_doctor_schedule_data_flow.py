#!/usr/bin/env python3
"""
醫師班表數據流測試腳本
測試：外部API → 資料庫 → 本地API

執行方式：python test_doctor_schedule_data_flow.py
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.doctor_schedule_service import DoctorScheduleService
from app.models.doctor_schedule import DoctorSchedule, DayShiftDoctor, DoctorScheduleUpdateLog
from app.core.database import SessionLocal
from datetime import datetime
import logging

# 設置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_external_api_fetch():
    """測試從外部API獲取數據"""
    print("\n=== 測試1: 從外部API獲取數據 ===")
    try:
        start_date = "20250601"
        end_date = "20250605"  # 測試較小範圍
        
        data = DoctorScheduleService.fetch_external_schedule_data(start_date, end_date)
        
        print(f"✅ 成功從外部API獲取數據")
        print(f"   查詢期間: {start_date} 到 {end_date}")
        print(f"   獲得天數: {len(data.get('schedules', []))}")
        
        # 顯示第一天的示例數據
        if data.get('schedules'):
            first_day = data['schedules'][0]
            print(f"   示例數據 - 日期: {first_day.get('date')}")
            print(f"              值班: {first_day.get('值班')}")
            print(f"              白班: {len(first_day.get('白班', []))} 人")
        
        return data
        
    except Exception as e:
        print(f"❌ 外部API測試失敗: {str(e)}")
        return None

def test_database_save(external_data):
    """測試將數據保存到資料庫"""
    print("\n=== 測試2: 保存數據到資料庫 ===")
    if not external_data:
        print("❌ 沒有外部數據可保存")
        return False
        
    db = SessionLocal()
    try:
        schedules = external_data.get('schedules', [])
        saved_count = DoctorScheduleService.save_schedule_data(db, schedules)
        
        print(f"✅ 成功保存數據到資料庫")
        print(f"   保存天數: {saved_count}")
        
        # 檢查資料庫中的記錄
        total_schedules = db.query(DoctorSchedule).count()
        total_doctors = db.query(DayShiftDoctor).count()
        
        print(f"   資料庫總班表記錄: {total_schedules}")
        print(f"   資料庫總醫師記錄: {total_doctors}")
        
        return True
        
    except Exception as e:
        print(f"❌ 資料庫保存測試失敗: {str(e)}")
        return False
    finally:
        db.close()

def test_database_read():
    """測試從資料庫讀取數據"""
    print("\n=== 測試3: 從資料庫讀取數據 ===")
    db = SessionLocal()
    try:
        start_date = "20250601"
        end_date = "20250605"
        
        schedules = DoctorScheduleService.get_schedules_by_date_range(db, start_date, end_date)
        
        print(f"✅ 成功從資料庫讀取數據")
        print(f"   查詢期間: {start_date} 到 {end_date}")
        print(f"   獲得天數: {len(schedules)}")
        
        # 顯示數據格式
        if schedules:
            first_schedule = schedules[0]
            print(f"   示例數據 - 日期: {first_schedule.get('date')}")
            print(f"              值班: {first_schedule.get('值班')}")
            print(f"              白班: {len(first_schedule.get('白班', []))} 人")
            
            # 顯示白班醫師詳細信息
            if first_schedule.get('白班'):
                first_doctor = first_schedule['白班'][0]
                print(f"              第一位白班醫師:")
                print(f"                姓名: {first_doctor.get('name')}")
                print(f"                原始: {first_doctor.get('summary')}")
                print(f"                區域: {first_doctor.get('area_code')}")
        
        return schedules
        
    except Exception as e:
        print(f"❌ 資料庫讀取測試失敗: {str(e)}")
        return None
    finally:
        db.close()

def test_complete_data_flow():
    """測試完整的數據流程"""
    print("\n=== 測試4: 完整數據流程測試 ===")
    try:
        start_date = "20250601"
        end_date = "20250603"  # 更小的測試範圍
        
        # 使用服務層的完整更新方法
        result = DoctorScheduleService.update_schedules_from_external_api(start_date, end_date)
        
        print(f"✅ 完整數據流程測試成功")
        print(f"   結果: {result}")
        
        return True
        
    except Exception as e:
        print(f"❌ 完整數據流程測試失敗: {str(e)}")
        return False

def check_database_status():
    """檢查資料庫狀態"""
    print("\n=== 資料庫狀態檢查 ===")
    db = SessionLocal()
    try:
        # 檢查表是否存在且有數據
        schedule_count = db.query(DoctorSchedule).count()
        doctor_count = db.query(DayShiftDoctor).count()
        log_count = db.query(DoctorScheduleUpdateLog).count()
        
        print(f"醫師班表記錄數: {schedule_count}")
        print(f"白班醫師記錄數: {doctor_count}")
        print(f"更新日誌記錄數: {log_count}")
        
        # 顯示最近的記錄
        if schedule_count > 0:
            recent_schedule = db.query(DoctorSchedule).order_by(DoctorSchedule.date.desc()).first()
            print(f"最新班表日期: {recent_schedule.date}")
            print(f"最新班表值班: {recent_schedule.duty_doctor}")
            print(f"最新班表白班數: {len(recent_schedule.day_shift_doctors)}")
        
        if log_count > 0:
            recent_log = db.query(DoctorScheduleUpdateLog).order_by(DoctorScheduleUpdateLog.update_time.desc()).first()
            print(f"最近更新時間: {recent_log.update_time}")
            print(f"最近更新狀態: {'成功' if recent_log.success else '失敗'}")
        
    except Exception as e:
        print(f"❌ 資料庫狀態檢查失敗: {str(e)}")
    finally:
        db.close()

def main():
    """主測試函數"""
    print("🧪 醫師班表數據流測試開始")
    print("=" * 50)
    
    # 檢查資料庫初始狀態
    check_database_status()
    
    # 測試1: 從外部API獲取數據
    external_data = test_external_api_fetch()
    
    # 測試2: 保存數據到資料庫
    if external_data:
        test_database_save(external_data)
    
    # 測試3: 從資料庫讀取數據
    db_data = test_database_read()
    
    # 測試4: 完整數據流程
    test_complete_data_flow()
    
    # 最終狀態檢查
    print("\n=== 最終狀態檢查 ===")
    check_database_status()
    
    print("\n🎉 數據流測試完成！")
    print("=" * 50)
    
    # 總結
    if external_data and db_data:
        print("✅ 數據流程正常：外部API → 資料庫 → 本地讀取")
        print("📋 前端現在應該能從本地資料庫獲取班表數據")
    else:
        print("❌ 數據流程存在問題，需要檢查")

if __name__ == "__main__":
    main() 