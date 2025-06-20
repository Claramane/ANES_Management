"""
時區工具模組
提供台灣時區的時間處理功能
"""

import os
import pytz
from datetime import datetime
from typing import Optional

# 設定時區為台灣時區 (UTC+8)
os.environ['TZ'] = 'Asia/Taipei'
TAIWAN_TZ = pytz.timezone('Asia/Taipei')

# 在 Linux 系統上設定時區
try:
    import time
    time.tzset()
except:
    pass

def now(tz: Optional[pytz.BaseTzInfo] = None) -> datetime:
    """
    返回當前時間，預設使用台灣時區
    
    Args:
        tz: 時區，如果為 None 則使用台灣時區
        
    Returns:
        datetime: 當前時間（不帶時區資訊）
    """
    if tz is None:
        # 使用台灣時區
        return datetime.now(TAIWAN_TZ).replace(tzinfo=None)
    else:
        # 使用指定時區
        return datetime.now(tz)

def now_time():
    """
    返回當前時間的 time 部分（台灣時區）
    
    Returns:
        time: 當前時間
    """
    return now().time()

def utc_now() -> datetime:
    """
    返回 UTC 時間
    
    Returns:
        datetime: UTC 時間
    """
    return datetime.now(pytz.UTC).replace(tzinfo=None)

def taiwan_now() -> datetime:
    """
    返回台灣時間
    
    Returns:
        datetime: 台灣時間
    """
    return now()

def get_timezone_info() -> dict:
    """
    獲取時區資訊
    
    Returns:
        dict: 包含時區資訊的字典
    """
    taiwan_time = taiwan_now()
    utc_time = utc_now()
    time_diff = taiwan_time - utc_time
    
    return {
        "taiwan_time": taiwan_time,
        "utc_time": utc_time, 
        "timezone": "Asia/Taipei",
        "offset": "+08:00",
        "time_difference_hours": time_diff.total_seconds() / 3600
    } 