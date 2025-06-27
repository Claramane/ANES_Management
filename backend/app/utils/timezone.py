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

def utc_to_taiwan(utc_datetime: Optional[datetime]) -> Optional[datetime]:
    """
    將UTC時間轉換為台灣時間
    
    Args:
        utc_datetime: UTC時間
        
    Returns:
        datetime: 台灣時間，如果輸入為None則返回None
    """
    if utc_datetime is None:
        return None
    
    # 如果已經有時區資訊，先轉為UTC
    if utc_datetime.tzinfo is not None:
        utc_datetime = utc_datetime.astimezone(pytz.UTC).replace(tzinfo=None)
    
    # 將UTC時間標記為UTC時區
    utc_tz_datetime = pytz.UTC.localize(utc_datetime)
    
    # 轉換為台灣時區
    taiwan_tz_datetime = utc_tz_datetime.astimezone(TAIWAN_TZ)
    
    # 返回不帶時區資訊的datetime
    return taiwan_tz_datetime.replace(tzinfo=None)

def taiwan_to_utc(taiwan_datetime: Optional[datetime]) -> Optional[datetime]:
    """
    將台灣時間轉換為UTC時間
    
    Args:
        taiwan_datetime: 台灣時間
        
    Returns:
        datetime: UTC時間，如果輸入為None則返回None
    """
    if taiwan_datetime is None:
        return None
    
    # 如果已經有時區資訊，先轉為台灣時區
    if taiwan_datetime.tzinfo is not None:
        taiwan_datetime = taiwan_datetime.astimezone(TAIWAN_TZ).replace(tzinfo=None)
    
    # 將台灣時間標記為台灣時區
    taiwan_tz_datetime = TAIWAN_TZ.localize(taiwan_datetime)
    
    # 轉換為UTC時區
    utc_tz_datetime = taiwan_tz_datetime.astimezone(pytz.UTC)
    
    # 返回不帶時區資訊的datetime
    return utc_tz_datetime.replace(tzinfo=None)

def format_taiwan_time(utc_datetime: Optional[datetime], format_str: str = '%Y-%m-%d %H:%M:%S') -> Optional[str]:
    """
    將UTC時間格式化為台灣時間字串
    
    Args:
        utc_datetime: UTC時間
        format_str: 格式化字串
        
    Returns:
        str: 格式化後的台灣時間字串，如果輸入為None則返回None
    """
    if utc_datetime is None:
        return None
    
    taiwan_time = utc_to_taiwan(utc_datetime)
    return taiwan_time.strftime(format_str) if taiwan_time else None 